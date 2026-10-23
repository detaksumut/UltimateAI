/**
 * GitWorktreeSandbox.mjs
 * Real Git worktree isolation for supervised self-repair.
 *
 * Repairs are never written to the operator's active working tree. A separate
 * branch is created from a clean HEAD; failed repairs are discarded. Verified
 * repairs stay on their branch until an explicit approval step merges them.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MAX_PATCH_BYTES = 200 * 1024;
const SOURCE_ROOTS = ['src/', 'server/', 'api/'];
const TEST_ROOT = 'tests/engineering/repair-generated/';

function safeSegment(value) {
  return String(value || 'incident')
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 72) || 'incident';
}

function normalizeRelative(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function isWithin(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

export class GitWorktreeSandbox {
  constructor(workspaceRoot = process.cwd(), options = {}) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.sandboxBaseDir = path.resolve(options.sandboxBaseDir || path.join(os.tmpdir(), 'ultimateai-repair-sandboxes'));
    this.activeSandboxes = new Map();
  }

  async git(args, options = {}) {
    return execFileAsync('git', args, {
      cwd: options.cwd || this.workspaceRoot,
      timeout: options.timeout || 20000,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true
    });
  }

  ensureBaseDir() {
    fs.mkdirSync(this.sandboxBaseDir, { recursive: true });
  }

  _resolveAllowedPath(relativeFilePath, { allowGeneratedTest = true } = {}) {
    const relative = normalizeRelative(relativeFilePath);
    if (!relative || path.posix.isAbsolute(relative) || relative.includes('\0')) {
      throw new Error('PATCH_PATH_INVALID: path must be relative to the repository.');
    }
    const segments = relative.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
      throw new Error('PATCH_PATH_INVALID: traversal segments are forbidden.');
    }
    if (/(^|\/)(\.git|node_modules|\.env(?:\.|$)|credentials?|secrets?|tokens?|\.ssh|vault)(\/|$)/i.test(relative) ||
        /(?:^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|npm-shrinkwrap\.json|\.npmrc)$/i.test(relative) ||
        relative.startsWith('.github/') || relative.startsWith('scripts/')) {
      throw new Error('PATCH_PATH_PROTECTED: repair workflow cannot alter dependencies, credentials, CI, or deployment scripts.');
    }

    const isSource = SOURCE_ROOTS.some((prefix) => relative.startsWith(prefix));
    const isGeneratedTest = allowGeneratedTest && relative.startsWith(TEST_ROOT) && /\.(?:mjs|cjs|js)$/i.test(relative);
    if (!isSource && !isGeneratedTest) {
      throw new Error('PATCH_PATH_OUTSIDE_ALLOWLIST: only src/, server/, api/, or generated repair tests are allowed.');
    }

    const absolute = path.resolve(this.workspaceRoot, ...segments);
    if (!isWithin(this.workspaceRoot, absolute)) {
      throw new Error('PATCH_PATH_INVALID: path escaped repository root.');
    }
    return { relative, absolute };
  }

  _assertNoSymlinkParents(root, absolutePath) {
    const rel = path.relative(root, absolutePath);
    const parts = rel.split(path.sep);
    let current = root;
    for (const part of parts.slice(0, -1)) {
      current = path.join(current, part);
      try {
        if (fs.lstatSync(current).isSymbolicLink()) {
          throw new Error('PATCH_PATH_SYMLINK: symlink parents are not allowed.');
        }
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
  }

  async createSandbox(incidentId) {
    this.ensureBaseDir();
    const safeId = safeSegment(incidentId);
    const stamp = Date.now();
    const sandboxId = 'sandbox-' + safeId + '-' + stamp;
    const branchName = 'jin/repair/' + safeId + '-' + stamp;
    const sandboxPath = path.join(this.sandboxBaseDir, sandboxId);

    const { stdout: repoRootRaw } = await this.git(['rev-parse', '--show-toplevel']);
    const repoRoot = path.resolve(repoRootRaw.trim());
    if (repoRoot !== this.workspaceRoot) {
      throw new Error('WORKSPACE_ROOT_MISMATCH: configure sandbox with the Git repository root.');
    }

    const { stdout: status } = await this.git(['status', '--porcelain', '--untracked-files=no']);
    if (status.trim()) {
      throw new Error('WORKSPACE_DIRTY: commit or stash tracked changes before starting an automatic repair; the active working tree was not modified.');
    }

    const { stdout: headRaw } = await this.git(['rev-parse', 'HEAD']);
    const baseCommit = headRaw.trim();
    await this.git(['worktree', 'add', '-b', branchName, sandboxPath, baseCommit], { timeout: 30000 });

    // Reuse the already-installed dependency tree read-only by convention.
    // The patch path guard rejects node_modules and generated tests receive a
    // sanitized environment, while the worktree still gets reproducible builds.
    const sharedNodeModules = path.join(this.workspaceRoot, 'node_modules');
    const sandboxNodeModules = path.join(sandboxPath, 'node_modules');
    if (fs.existsSync(sharedNodeModules) && !fs.existsSync(sandboxNodeModules)) {
      try {
        fs.symlinkSync(sharedNodeModules, sandboxNodeModules, process.platform === 'win32' ? 'junction' : 'dir');
      } catch (err) {
        console.warn('[Sandbox] Could not link installed dependencies; build verification may require npm ci in the worktree:', err.message);
      }
    }

    const sandboxInfo = {
      sandboxId,
      incidentId: safeId,
      path: sandboxPath,
      branchName,
      baseCommit,
      createdAt: new Date().toISOString(),
      status: 'READY',
      changedFiles: []
    };
    this.activeSandboxes.set(sandboxId, sandboxInfo);
    console.log('[Sandbox] Created Git worktree', JSON.stringify({ sandboxId, branchName, baseCommit }));
    return { ...sandboxInfo };
  }

  async applyPatchToSandbox(sandboxId, relativeFilePath, patchContent, options = {}) {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) throw new Error('SANDBOX_NOT_FOUND: ' + sandboxId);
    if (typeof patchContent !== 'string' || Buffer.byteLength(patchContent, 'utf8') > MAX_PATCH_BYTES) {
      throw new Error('PATCH_SIZE_INVALID: each changed file must be text and at most 200 KB.');
    }

    const { relative } = this._resolveAllowedPath(relativeFilePath);
    const targetFile = path.resolve(sandbox.path, ...relative.split('/'));
    if (!isWithin(sandbox.path, targetFile)) throw new Error('PATCH_PATH_INVALID: target escaped worktree.');
    this._assertNoSymlinkParents(sandbox.path, targetFile);

    const exists = fs.existsSync(targetFile);
    const isGeneratedTest = relative.startsWith(TEST_ROOT);
    if (!exists && !isGeneratedTest) {
      throw new Error('PATCH_TARGET_NOT_FOUND: repair may modify existing source files only; only generated test files may be new.');
    }
    if (exists) {
      const targetStat = fs.lstatSync(targetFile);
      if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
        throw new Error('PATCH_TARGET_NOT_FILE: target must be a regular, non-symlink file.');
      }
    }
    if (options.expectedSha256 && exists) {
      const crypto = await import('node:crypto');
      const existing = fs.readFileSync(targetFile);
      const actual = crypto.createHash('sha256').update(existing).digest('hex');
      if (actual !== options.expectedSha256) {
        throw new Error('PATCH_BASE_MISMATCH: source file changed after patch planning.');
      }
    }

    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    const tempFile = targetFile + '.jin-repair-tmp';
    fs.writeFileSync(tempFile, patchContent, { encoding: 'utf8', flag: 'w' });
    fs.renameSync(tempFile, targetFile);

    if (!sandbox.changedFiles.includes(relative)) sandbox.changedFiles.push(relative);
    sandbox.status = 'PATCH_APPLIED';
    return { success: true, relativePath: relative, targetFile, sizeBytes: Buffer.byteLength(patchContent, 'utf8') };
  }

  async restoreSandbox(sandboxInfo) {
    if (!sandboxInfo || typeof sandboxInfo !== 'object') throw new Error('SANDBOX_METADATA_INVALID');
    const sandboxPath = path.resolve(String(sandboxInfo.path || ''));
    const branchName = String(sandboxInfo.branchName || '');
    if (!isWithin(this.sandboxBaseDir, sandboxPath) ||
        !branchName.startsWith('jin/repair/') ||
        !/^[A-Za-z0-9_/-]+$/.test(branchName)) {
      throw new Error('SANDBOX_RESTORE_DENIED: persisted path or branch is not an approved repair worktree.');
    }
    const { stdout: rootRaw } = await this.git(['rev-parse', '--show-toplevel'], { cwd: sandboxPath });
    if (path.resolve(rootRaw.trim()) !== sandboxPath) throw new Error('SANDBOX_RESTORE_DENIED: directory is not a Git worktree.');
    const { stdout: branchRaw } = await this.git(['branch', '--show-current'], { cwd: sandboxPath });
    if (branchRaw.trim() !== branchName) throw new Error('SANDBOX_RESTORE_DENIED: worktree branch mismatch.');
    const { stdout: headRaw } = await this.git(['rev-parse', 'HEAD'], { cwd: sandboxPath });
    const restored = {
      ...sandboxInfo,
      sandboxId: String(sandboxInfo.sandboxId),
      path: sandboxPath,
      branchName,
      baseCommit: String(sandboxInfo.baseCommit || ''),
      repairCommit: sandboxInfo.repairCommit || (headRaw.trim() !== sandboxInfo.baseCommit ? headRaw.trim() : null),
      changedFiles: Array.isArray(sandboxInfo.changedFiles) ? [...sandboxInfo.changedFiles] : [],
      status: sandboxInfo.status || 'RESTORED'
    };
    this.activeSandboxes.set(restored.sandboxId, restored);
    return { ...restored };
  }

  async readFileAtBaseCommit(sandboxId, relativeFilePath) {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) throw new Error('SANDBOX_NOT_FOUND: ' + sandboxId);
    const resolved = this._resolveAllowedPath(relativeFilePath, { allowGeneratedTest: false });
    const { stdout } = await this.git(['show', sandbox.baseCommit + ':' + resolved.relative], {
      cwd: sandbox.path,
      timeout: 20000
    });
    return stdout;
  }

  async inspectSandbox(sandboxId) {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) throw new Error('SANDBOX_NOT_FOUND: ' + sandboxId);
    const { stdout } = await this.git(['status', '--short'], { cwd: sandbox.path });
    const { stdout: diff } = await this.git(['diff', '--'], { cwd: sandbox.path });
    return { sandboxId, branchName: sandbox.branchName, baseCommit: sandbox.baseCommit, status: stdout, diff };
  }

  async commitSandboxChanges(sandboxId, message = 'fix: verified JINI self-repair') {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) throw new Error('SANDBOX_NOT_FOUND: ' + sandboxId);
    if (!sandbox.changedFiles.length) throw new Error('NO_PATCH_CHANGES: no approved patch files were recorded.');

    for (const file of sandbox.changedFiles) this._resolveAllowedPath(file);
    await this.git(['add', '--', ...sandbox.changedFiles], { cwd: sandbox.path });
    await this.git(['diff', '--cached', '--check'], { cwd: sandbox.path });
    const { stdout: staged } = await this.git(['diff', '--cached', '--name-only'], { cwd: sandbox.path });
    const stagedFiles = staged.split(/\r?\n/).filter(Boolean);
    if (stagedFiles.some((file) => !sandbox.changedFiles.includes(normalizeRelative(file)))) {
      throw new Error('STAGED_PATH_POLICY_VIOLATION: only recorded allowlisted files may be committed.');
    }
    if (!stagedFiles.length) {
      const { stdout: currentHead } = await this.git(['rev-parse', 'HEAD'], { cwd: sandbox.path });
      if (sandbox.repairCommit && sandbox.repairCommit === currentHead.trim()) {
        return { success: true, branchName: sandbox.branchName, commit: sandbox.repairCommit, files: [...sandbox.changedFiles], alreadyCommitted: true };
      }
      throw new Error('NO_PATCH_CHANGES: no staged changes remain and no repair commit was recorded.');
    }
    const safeMessage = String(message || 'fix: verified JINI self-repair').replace(/[\r\n]/g, ' ').slice(0, 160);
    await this.git(['commit', '-m', safeMessage], { cwd: sandbox.path, timeout: 30000 });
    const { stdout: commit } = await this.git(['rev-parse', 'HEAD'], { cwd: sandbox.path });
    sandbox.status = 'COMMITTED';
    sandbox.repairCommit = commit.trim();
    return { success: true, branchName: sandbox.branchName, commit: sandbox.repairCommit, files: stagedFiles };
  }

  async cleanupSandbox(sandboxId, { keepBranch = false } = {}) {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) return { success: true, skipped: true };
    try {
      await this.git(['worktree', 'remove', '--force', sandbox.path], { timeout: 30000 });
    } catch (err) {
      console.warn('[Sandbox] git worktree remove warning:', err.message);
      try { fs.rmSync(sandbox.path, { recursive: true, force: true }); } catch {}
    }
    if (!keepBranch) {
      try { await this.git(['branch', '-D', sandbox.branchName]); } catch (err) {
        console.warn('[Sandbox] branch cleanup warning:', err.message);
      }
    }
    this.activeSandboxes.delete(sandboxId);
    return { success: true, sandboxId, keepBranch };
  }
}

export const gitWorktreeSandboxInstance = new GitWorktreeSandbox();
