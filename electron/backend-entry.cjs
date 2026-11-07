// electron/backend-entry.cjs
// The project root is an ES module ("type": "module") for the Vite/React app,
// while the legacy Express backend (server.js + services/*.js) is CommonJS.
// This entry scopes CommonJS compilation to project-owned .js files so the
// backend can run under Electron without renaming its entire module tree.
const Module = require('module');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(
  process.env.ULTIMATEAI_APP_ROOT || path.join(__dirname, '..'),
);
const nodeModulesSegment = `${path.sep}node_modules${path.sep}`;
const originalJsLoader = Module._extensions['.js'];

Module._extensions['.js'] = function projectCommonJsLoader(module, filename) {
  const normalized = path.resolve(filename);
  if (normalized.startsWith(projectRoot + path.sep) && !normalized.includes(nodeModulesSegment)) {
    module._compile(fs.readFileSync(normalized, 'utf8'), normalized);
    return;
  }
  originalJsLoader(module, filename);
};

require(path.join(projectRoot, 'server.js'));
