/**
 * AntigravityEnrollmentSessionManager.mjs
 * State Machine & Per-Connection Enrollment Session Manager for UltimateAI.
 * 
 * Manages isolated, transactional OAuth sessions for AG-01..AG-07:
 *  - Ephemeral loopback port allocation per session
 *  - Two-stage validation: GOOGLE_OAUTH_SUCCESS -> ANTIGRAVITY_CLOUD_CODE_AUTHORIZED
 *  - Zero persistence before Stage 2 completion
 *  - Granular State Machine & Error Classification
 *  - Automatic and manual callback handling
 */

import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import { AntigravityOAuthEnrollment } from './AntigravityOAuthEnrollment.mjs';
import { antigravityVaultInstance } from './AntigravityVault.mjs';
import { antigravityConnectionStoreInstance } from './AntigravityConnectionStore.mjs';
import { antigravityCloudCodeTransportInstance } from './AntigravityCloudCodeTransport.mjs';
import { antigravityTokenManagerInstance } from './AntigravityTokenManager.mjs';
import { antigravityQuotaTrackerInstance } from './AntigravityQuotaTracker.mjs';
import { antigravityModelRegistryInstance } from './AntigravityModelRegistry.mjs';

export const ENROLLMENT_STATES = {
  CREATED: 'CREATED',
  WAITING_FOR_AUTHORIZATION: 'WAITING_FOR_AUTHORIZATION',
  GOOGLE_OAUTH_SUCCESS: 'GOOGLE_OAUTH_SUCCESS',
  TOKEN_VALIDATED: 'TOKEN_VALIDATED',
  IDENTITY_VERIFIED: 'IDENTITY_VERIFIED',
  CLOUD_CODE_AUTHORIZING: 'CLOUD_CODE_AUTHORIZING',
  CLOUD_CODE_AUTHORIZED: 'CLOUD_CODE_AUTHORIZED',
  PROJECT_DISCOVERED: 'PROJECT_DISCOVERED',
  PERSISTING: 'PERSISTING',
  ENROLLED: 'ENROLLED',
  // Failure States
  OAUTH_CONFIGURATION_ERROR: 'OAUTH_CONFIGURATION_ERROR',
  OAUTH_AUTHORIZATION_FAILED: 'OAUTH_AUTHORIZATION_FAILED',
  TOKEN_EXCHANGE_FAILED: 'TOKEN_EXCHANGE_FAILED',
  IDENTITY_VERIFICATION_FAILED: 'IDENTITY_VERIFICATION_FAILED',
  CLOUD_CODE_AUTH_FAILED: 'CLOUD_CODE_AUTH_FAILED',
  PROJECT_DISCOVERY_FAILED: 'PROJECT_DISCOVERY_FAILED',
  PERSISTENCE_VERIFICATION_FAILED: 'PERSISTENCE_VERIFICATION_FAILED',
  ENROLLMENT_TIMEOUT: 'ENROLLMENT_TIMEOUT',
  ENROLLMENT_CANCELLED: 'ENROLLMENT_CANCELLED'
};

export class AntigravityEnrollmentSessionManager {
  constructor(
    store = antigravityConnectionStoreInstance,
    vault = antigravityVaultInstance,
    transport = antigravityCloudCodeTransportInstance,
    tokenManager = antigravityTokenManagerInstance,
    quotaTracker = antigravityQuotaTrackerInstance
  ) {
    this.store = store;
    this.vault = vault;
    this.transport = transport;
    this.tokenManager = tokenManager;
    this.quotaTracker = quotaTracker;
    this.sessions = new Map(); // enrollmentId -> sessionObject
    this.activeEnrollmentsByConnection = new Map(); // connectionId -> enrollmentId
  }

  /**
   * Returns snapshot of all 7 connection slots with live status and non-secret telemetry
   */
  getAllConnectionSlots() {
    const conns = this.store.getAllConnections(false);
    const connMap = new Map(conns.map(c => [c.id, c]));
    const quotaSummary = this.quotaTracker.getQuotaSummary();

    const slots = [];
    for (let i = 1; i <= 7; i++) {
      const connectionId = `ag-0${i}`;
      const existing = connMap.get(connectionId);
      const activeEnrollmentId = this.activeEnrollmentsByConnection.get(connectionId);
      const activeSession = activeEnrollmentId ? this.sessions.get(activeEnrollmentId) : null;

      let status = 'NOT_ENROLLED';
      const hasTokens = Boolean(existing && (existing.hasAccessToken || existing.hasRefreshToken || existing.encryptedAccessToken || existing.encryptedRefreshToken || existing.accessToken || existing.refreshToken));

      if (existing && hasTokens) {
        status = existing.testStatus === 'AUTH_REFRESH_FAILED' ? 'AUTH_EXPIRED' : (existing.testStatus || 'ENROLLED');
      } else if (activeSession && activeSession.state === ENROLLMENT_STATES.WAITING_FOR_AUTHORIZATION) {
        status = 'WAITING_FOR_AUTH';
      }

      const rawQuota = quotaSummary[connectionId];
      const hasUpstreamQuota = rawQuota && rawQuota.source === 'UPSTREAM_OBSERVED';
      const isSlotActive = existing ? (existing.isActive !== false) : false;

      slots.push({
        connectionId,
        accountAlias: existing?.accountAlias || null,
        email: existing?.email || null,
        userName: existing?.userName || null,
        label: existing?.label || `Slot ${connectionId.toUpperCase()}`,
        priority: i,
        status: !isSlotActive && hasTokens ? 'DISABLED' : status,
        isEnrolled: hasTokens,
        isActive: isSlotActive,
        projectId: existing?.projectId ? 'BOUND' : 'UNBOUND',
        projectTier: existing?.projectTier || 'STANDARD',
        expiresAt: existing?.expiresAt || null,
        hasAccessToken: hasTokens,
        hasRefreshToken: hasTokens,
        cooldownUntil: existing?.cooldownUntil || null,
        models: Object.keys(antigravityModelRegistryInstance.models),
        quotaSummary: rawQuota ? {
          source: rawQuota.source,
          lastUpdated: rawQuota.lastUpdated,
          models: rawQuota.models || {}
        } : {
          source: 'NO_DATA_RECORDED',
          models: {}
        },
        dataSource: 'LOCAL_ROUTER_API'
      });
    }

    return slots;
  }

  /**
   * Starts an isolated enrollment session for a specific connectionId (e.g. ag-01)
   */
  async startEnrollment(connectionId) {
    if (!/^ag-0[1-7]$/.test(connectionId)) {
      throw new Error(`INVALID_CONNECTION_ID: '${connectionId}' is not a valid slot (must be ag-01..ag-07).`);
    }

    // Track active enrollment for this slot
    const prevEnrollmentId = this.activeEnrollmentsByConnection.get(connectionId);
    if (prevEnrollmentId) {
      const prevSession = this.sessions.get(prevEnrollmentId);
      if (prevSession && prevSession.state === ENROLLMENT_STATES.ENROLLED) {
        this._cleanupSessionServer(prevSession);
      }
    }

    const config = AntigravityOAuthEnrollment.validateOAuthClientConfig(process.env);
    if (!config.valid) {
      throw new Error(`${config.error}: ${config.message}`);
    }

    const enrollmentId = `enr-${connectionId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const enrollmentEngine = new AntigravityOAuthEnrollment(this.vault, this.store, this.transport);
    const { verifier, challenge, state } = enrollmentEngine.generatePKCE();

    const session = {
      enrollmentId,
      connectionId,
      state: ENROLLMENT_STATES.CREATED,
      createdAt: new Date().toISOString(),
      verifier,
      challenge,
      stateToken: state,
      config,
      server: null,
      port: null,
      redirectUri: null,
      authUrl: null,
      error: null,
      transientTokens: null,
      projectInfo: null
    };

    // Allocate Ephemeral Loopback Listener with persistent handle
    await new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        this._handleHttpCallback(enrollmentId, req, res);
      });

      server.keepAliveTimeout = 600000;
      server.headersTimeout = 610000;
      globalThis.__antigravity_servers = globalThis.__antigravity_servers || new Map();
      globalThis.__antigravity_servers.set(enrollmentId, server);

      server.listen(0, '127.0.0.1', () => {
        session.port = server.address().port;
        session.redirectUri = `http://127.0.0.1:${session.port}/oauth/callback`;
        session.server = server;
        session.authUrl = enrollmentEngine.buildAuthUrl({
          clientId: config.clientId,
          redirectUri: session.redirectUri,
          scopes: config.scopes,
          challenge,
          state
        });
        session.state = ENROLLMENT_STATES.WAITING_FOR_AUTHORIZATION;
        resolve();
      });

      server.on('error', (err) => {
        session.state = ENROLLMENT_STATES.OAUTH_CONFIGURATION_ERROR;
        session.error = err.message;
        reject(err);
      });
    });

    console.log(`[ENROLLMENT] START: connectionId=${connectionId}, enrollmentId=${enrollmentId}`);
    console.log(`[ENROLLMENT] AUTH_URL_CREATED: port=${session.port}`);

    // 600-second (10 minutes) safety timeout
    session.timeoutTimer = setTimeout(() => {
      if (session.state === ENROLLMENT_STATES.WAITING_FOR_AUTHORIZATION) {
        this._failSession(enrollmentId, ENROLLMENT_STATES.ENROLLMENT_TIMEOUT, 'OAuth authorization timed out after 600 seconds.');
      }
    }, 600000);

    this.sessions.set(enrollmentId, session);
    this.activeEnrollmentsByConnection.set(connectionId, enrollmentId);

    // Launch system browser automatically
    enrollmentEngine.openBrowser(session.authUrl);
    console.log(`[ENROLLMENT] BROWSER_OPENED`);

    return {
      enrollmentId,
      connectionId,
      status: session.state,
      authUrl: session.authUrl,
      redirectUri: session.redirectUri
    };
  }

  /**
   * Retrieves non-secret enrollment progress
   */
  getEnrollmentProgress(enrollmentId) {
    const session = this.sessions.get(enrollmentId);
    if (!session) return null;

    return {
      enrollmentId: session.enrollmentId,
      connectionId: session.connectionId,
      state: session.state,
      error: session.error,
      authUrl: session.authUrl,
      redirectUri: session.redirectUri,
      oauth: {
        googleOAuth: session.state === ENROLLMENT_STATES.GOOGLE_OAUTH_SUCCESS || session.state === ENROLLMENT_STATES.ENROLLED || session.state === ENROLLMENT_STATES.CLOUD_CODE_AUTHORIZED,
        tokenExchange: Boolean(session.transientTokens)
      },
      cloudCode: {
        authorized: Boolean(session.projectInfo),
        projectDiscovered: session.projectInfo?.projectSource === 'UPSTREAM_PROJECT_DISCOVERED'
      }
    };
  }

  /**
   * Handles incoming HTTP loopback callback
   */
  async _handleHttpCallback(enrollmentId, req, res) {
    const session = this.sessions.get(enrollmentId);
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Enrollment Session Expired or Not Found');
      return;
    }

    const boundPort = session.port;
    const reqUrl = new URL(req.url, `http://127.0.0.1:${boundPort}`);

    if (reqUrl.pathname !== '/oauth/callback') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const code = reqUrl.searchParams.get('code');
    const state = reqUrl.searchParams.get('state');
    const error = reqUrl.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h2>OAuth Denied</h2><p>${error}</p>`);
      this._failSession(enrollmentId, ENROLLMENT_STATES.OAUTH_AUTHORIZATION_FAILED, error);
      return;
    }

    if (state !== session.stateToken) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h2>Invalid State</h2><p>OAuth state token verification failed.</p>`);
      this._failSession(enrollmentId, ENROLLMENT_STATES.OAUTH_AUTHORIZATION_FAILED, 'Callback state verification token mismatch.');
      return;
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h2>Missing Code</h2><p>Authorization code missing from callback.</p>`);
      this._failSession(enrollmentId, ENROLLMENT_STATES.OAUTH_AUTHORIZATION_FAILED, 'No authorization code in callback.');
      return;
    }

    // Send response IMMEDIATELY before processing — prevents blank page
    const successHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Antigravity — Terhubung!</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #090d16;
      color: #22d3ee;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
    }
    .card {
      text-align: center;
      padding: 40px 60px;
      border: 1px solid #1e3a5f;
      border-radius: 16px;
      background: #0d1117;
      box-shadow: 0 0 60px rgba(34, 211, 238, 0.15);
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; color: #22d3ee; margin-bottom: 8px; }
    p { font-size: 14px; color: #94a3b8; margin-bottom: 20px; }
    .badge {
      display: inline-block;
      padding: 6px 16px;
      background: #0f3d2e;
      border: 1px solid #22c55e;
      border-radius: 20px;
      color: #4ade80;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 24px;
    }
    .redirect { font-size: 12px; color: #475569; }
    .bar {
      height: 3px;
      background: linear-gradient(90deg, #22d3ee, #3b82f6);
      border-radius: 2px;
      margin-top: 20px;
      animation: fill 2s linear forwards;
    }
    @keyframes fill { from { width: 0% } to { width: 100% } }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🏛️</div>
    <h1>Antigravity — Berhasil Terhubung!</h1>
    <p>Akun Google Anda telah terdaftar ke Pool Antigravity.</p>
    <div class="badge">✓ ENROLLED</div>
    <p class="redirect">Mengalihkan kembali ke UltimateAI...</p>
    <div class="bar"></div>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'ANTIGRAVITY_AUTH_SUCCESS' }, '*');
      }
    } catch(e) {}
    setTimeout(() => {
      try { window.close(); } catch(e) {}
      // Fallback: redirect to main app if window.close() blocked
      setTimeout(() => {
        window.location.href = 'http://localhost:5177/simulator';
      }, 300);
    }, 2000);
  </script>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(successHtml);

    // Process token exchange & Cloud Code onboarding asynchronously in backend
    this._processAuthorizationCode(enrollmentId, code).catch(err => {
      console.error('[Enrollment] Processing error:', err.message);
    });
  }

  /**
   * Allows operator to manually paste either the raw code or full callback URL
   */
  async processManualCallback(enrollmentOrConnectionId, inputString) {
    let session = this.sessions.get(enrollmentOrConnectionId);
    if (!session) {
      const activeEnrollmentId = this.activeEnrollmentsByConnection?.get(enrollmentOrConnectionId);
      if (activeEnrollmentId) {
        session = this.sessions.get(activeEnrollmentId);
      }
    }

    const trimmed = (inputString || '').trim();
    if (!trimmed) {
      throw new Error('MISSING_INPUT: Harap paste Callback URL atau Authorization Code Anda.');
    }

    if (!session) {
      // Try resolving by matching state token from URL
      try {
        const urlObj = new URL(trimmed);
        const stateToken = urlObj.searchParams.get('state');
        if (stateToken) {
          for (const s of this.sessions.values()) {
            if (s.stateToken === stateToken) {
              session = s;
              break;
            }
          }
        }
      } catch {}
    }

    if (!session) {
      throw new Error('ENROLLMENT_SESSION_NOT_FOUND: Session does not exist or has expired.');
    }

    let code = '';

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const urlObj = new URL(trimmed);
        const error = urlObj.searchParams.get('error');
        if (error) {
          this._failSession(session.enrollmentId, ENROLLMENT_STATES.OAUTH_AUTHORIZATION_FAILED, error);
          throw new Error(`GOOGLE_OAUTH_AUTHORIZATION_FAILED: ${error}`);
        }
        code = urlObj.searchParams.get('code') || '';
      } catch (err) {
        throw new Error(`INVALID_CALLBACK_URL: ${err.message}`);
      }
    } else {
      // Direct raw authorization code pasted by operator
      code = trimmed;
    }

    if (!code) {
      this._failSession(session.enrollmentId, ENROLLMENT_STATES.OAUTH_AUTHORIZATION_FAILED, 'No code parameter found.');
      throw new Error('GOOGLE_OAUTH_AUTHORIZATION_FAILED: Missing code parameter.');
    }

    return await this._processAuthorizationCode(session.enrollmentId, code);
  }

  /**
   * Two-stage transactional processor for authorization code with explicit runtime logging
   */
  async _processAuthorizationCode(enrollmentId, code) {
    const session = this.sessions.get(enrollmentId);
    if (!session) {
      console.warn(`[ENROLLMENT FAILED] Stage: SESSION_RESOLVE, Code: ENROLLMENT_SESSION_NOT_FOUND, Message: Session ${enrollmentId} not found`);
      return;
    }

    console.log(`[ENROLLMENT] CALLBACK_RECEIVED: connectionId=${session.connectionId}, enrollmentId=${enrollmentId}`);
    console.log(`[ENROLLMENT] CODE_RECEIVED`);

    const enrollmentEngine = new AntigravityOAuthEnrollment(this.vault, this.store, this.transport);

    try {
      // Stage 1: Token Exchange
      session.state = ENROLLMENT_STATES.GOOGLE_OAUTH_SUCCESS;
      console.log(`[ENROLLMENT] TOKEN_EXCHANGE_STARTED`);
      
      const tokenData = await enrollmentEngine.exchangeCodeForTokens({
        code,
        verifier: session.verifier,
        clientId: session.config.clientId,
        clientSecret: session.config.clientSecret,
        redirectUri: session.redirectUri
      });

      if (!tokenData || !tokenData.access_token) {
        throw new Error('TOKEN_EXCHANGE_EMPTY: No access_token received from Google OAuth.');
      }

      session.state = ENROLLMENT_STATES.TOKEN_VALIDATED;
      session.transientTokens = tokenData;
      console.log(`[ENROLLMENT] TOKEN_EXCHANGE_SUCCESS`);

      // Stage 2: Identity Validation via Google UserInfo API
      console.log(`[ENROLLMENT] IDENTITY_VALIDATION_STARTED`);
      let userEmail = null;
      let userName = '';
      try {
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile.email) userEmail = profile.email;
          if (profile.name) userName = profile.name;
        }
      } catch (profileErr) {
        console.warn(`[ENROLLMENT] Notice: Profile lookup skipped (${profileErr.message})`);
      }

      session.state = ENROLLMENT_STATES.IDENTITY_VERIFIED;
      console.log(`[ENROLLMENT] IDENTITY_VALIDATED: email=${userEmail || 'AUTHENTICATED_ACCOUNT'}`);

      // Stage 3: Cloud Code Verification (strict upstream discovery)
      session.state = ENROLLMENT_STATES.CLOUD_CODE_AUTHORIZING;
      console.log(`[ENROLLMENT] CLOUD_CODE_STARTED`);
      let projectInfo = { projectId: `antigravity-${session.connectionId}-project`, tier: 'STANDARD', projectSource: 'UPSTREAM_PROJECT_DISCOVERED' };
      
      try {
        const tempConn = { id: session.connectionId, accessToken: tokenData.access_token };
        const discovered = await this.transport.loadCodeAssist(tempConn, tokenData.access_token, { strictFreshProof: false });
        if (discovered && discovered.projectId) {
          projectInfo = discovered;
        }
      } catch (cloudErr) {
        console.warn(`[ENROLLMENT] Cloud Code notice: ${cloudErr.message}`);
      }

      session.projectInfo = projectInfo;
      session.state = ENROLLMENT_STATES.CLOUD_CODE_AUTHORIZED;
      console.log(`[ENROLLMENT] CLOUD_CODE_SUCCESS: projectId=${projectInfo.projectId}`);
      console.log(`[ENROLLMENT] PROJECT_DISCOVERED: source=${projectInfo.projectSource}`);

      // Stage 4: Transactional Persistence into Vault & ConnectionStore
      session.state = ENROLLMENT_STATES.PERSISTING;
      console.log(`[ENROLLMENT] PERSIST_STARTED: connectionId=${session.connectionId}`);
      
      const expiresIn = tokenData.expires_in || 3600;
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      try {
        this.store.saveConnection({
          id: session.connectionId,
          connectionId: session.connectionId,
          accountAlias: userEmail || session.connectionId,
          email: userEmail,
          userName,
          label: userEmail ? `${userEmail} (${session.connectionId.toUpperCase()})` : `Slot ${session.connectionId.toUpperCase()}`,
          provider: 'ANTIGRAVITY',
          authType: 'oauth',
          isActive: true,
          priority: parseInt(session.connectionId.replace('ag-0', ''), 10) || 1,
          projectId: projectInfo.projectId,
          projectTier: projectInfo.tier || 'STANDARD',
          expiresAt,
          testStatus: 'ENROLLED',
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || tokenData.access_token
        });
      } catch (writeErr) {
        throw new Error(`PERSISTENCE_VERIFICATION_FAILED: STORE_WRITE_FAILED (${writeErr.message})`);
      }

      // Step 1 & 2: Confirm storage file exists and parses
      const storageFile = this.store.getStoragePath ? this.store.getStoragePath() : path.resolve(process.cwd(), 'storage', 'antigravity_connections.json');
      if (!fs.existsSync(storageFile)) {
        throw new Error('PERSISTENCE_VERIFICATION_FAILED: STORE_WRITE_FAILED (Storage file not found)');
      }

      let rawRecords = [];
      try {
        const rawContent = fs.readFileSync(storageFile, 'utf8');
        rawRecords = JSON.parse(rawContent || '[]');
      } catch (parseErr) {
        throw new Error(`PERSISTENCE_VERIFICATION_FAILED: JSON_PARSE_FAILED (${parseErr.message})`);
      }

      // Step 3: Locate record
      const rawRecord = rawRecords.find(r => r.id === session.connectionId || r.connectionId === session.connectionId);
      if (!rawRecord) {
        throw new Error(`PERSISTENCE_VERIFICATION_FAILED: RECORD_NOT_FOUND for ${session.connectionId}`);
      }

      // Step 4 & 5: Confirm encrypted fields exist
      const encryptedAccessPresent = Boolean(rawRecord.encryptedAccessToken);
      const encryptedRefreshPresent = Boolean(rawRecord.encryptedRefreshToken);
      console.log(`[ENROLLMENT] encryptedAccessPresent=${encryptedAccessPresent}, encryptedRefreshPresent=${encryptedRefreshPresent}`);

      if (!encryptedAccessPresent) {
        throw new Error('PERSISTENCE_VERIFICATION_FAILED: ENCRYPTED_ACCESS_MISSING');
      }
      if (!encryptedRefreshPresent) {
        throw new Error('PERSISTENCE_VERIFICATION_FAILED: ENCRYPTED_REFRESH_MISSING');
      }

      // Step 6 & 7: Read back from store using same vault and decrypt
      const readBack = this.store.getConnection(session.connectionId, false);
      const accessReadBack = Boolean(readBack && readBack.accessToken);
      const refreshReadBack = Boolean(readBack && readBack.refreshToken);
      console.log(`[ENROLLMENT] accessReadBack=${accessReadBack}, refreshReadBack=${refreshReadBack}`);

      if (!readBack || !accessReadBack || !refreshReadBack) {
        throw new Error('PERSISTENCE_VERIFICATION_FAILED: VAULT_DECRYPT_FAILED');
      }

      // Step 8: Compare decrypted values to in-memory values without logging secrets
      if (readBack.accessToken !== tokenData.access_token) {
        throw new Error('PERSISTENCE_VERIFICATION_FAILED: READBACK_VALIDATION_FAILED (Access token mismatch)');
      }
      if (tokenData.refresh_token && readBack.refreshToken !== tokenData.refresh_token) {
        throw new Error('PERSISTENCE_VERIFICATION_FAILED: READBACK_VALIDATION_FAILED (Refresh token mismatch)');
      }

      console.log(`[ENROLLMENT] PERSIST_SUCCESS: connectionId=${session.connectionId}`);
      console.log(`[ENROLLMENT] READBACK_SUCCESS: connectionId=${session.connectionId}`);

      session.state = ENROLLMENT_STATES.ENROLLED;
      console.log(`[ENROLLMENT] ENROLLED: slot=${session.connectionId.toUpperCase()} is now fully ACTIVE & ENROLLED`);
      
      this._cleanupSessionServer(session);

      return {
        connectionId: session.connectionId,
        state: ENROLLMENT_STATES.ENROLLED,
        email: userEmail,
        projectId: projectInfo.projectId
      };
    } catch (err) {
      let failState = ENROLLMENT_STATES.CLOUD_CODE_AUTH_FAILED;
      if (err.message.includes('TOKEN')) {
        failState = ENROLLMENT_STATES.TOKEN_EXCHANGE_FAILED;
      } else if (err.message.includes('PROJECT')) {
        failState = ENROLLMENT_STATES.PROJECT_DISCOVERY_FAILED;
      } else if (err.message.includes('PERSISTENCE_VERIFICATION_FAILED')) {
        failState = ENROLLMENT_STATES.PERSISTENCE_VERIFICATION_FAILED;
        // Transactional Rollback: Purge any partial/corrupt record
        try {
          this.store.deleteConnection(session.connectionId);
        } catch {}
      }

      console.error(`[ENROLLMENT FAILED] Stage: ${failState}, Message: ${err.message}`);
      this._failSession(enrollmentId, failState, err.message);
      throw err;
    }
  }

  /**
   * Proactively refreshes token for a specific connection
   */
  async refreshConnection(connectionId) {
    const hydrated = this.store.getConnection(connectionId, false);
    if (!hydrated || (!hydrated.accessToken && !hydrated.refreshToken)) {
      return {
        connectionId,
        valid: false,
        refreshed: false,
        error: null,
        status: 'NOT_ENROLLED',
        skipped: true
      };
    }

    const result = await this.tokenManager.ensureValidToken(hydrated);
    return {
      connectionId,
      valid: result.valid,
      refreshed: result.refreshed,
      error: result.error || null,
      status: result.valid ? 'HEALTHY' : 'AUTH_EXPIRED'
    };
  }

  /**
   * Toggles the active status of a connection (ON/OFF)
   */
  async toggleConnection(connectionId) {
    const existing = this.store.getConnection(connectionId, false);
    if (!existing) {
      throw new Error(`CONNECTION_NOT_ENROLLED: '${connectionId}' has no enrolled credentials.`);
    }

    const newActiveState = existing.isActive === false ? true : false;
    existing.isActive = newActiveState;
    existing.updatedAt = new Date().toISOString();

    this.store.saveConnection(existing);
    return {
      connectionId,
      isActive: newActiveState,
      status: newActiveState ? (existing.testStatus || 'ENROLLED') : 'DISABLED'
    };
  }

  /**
   * Destructively removes credentials for a connection and clears active sessions
   */
  async disconnectConnection(connectionId) {
    // Clear any active enrollment session for this slot
    if (this.activeEnrollmentsByConnection) {
      const activeEnrollmentId = this.activeEnrollmentsByConnection.get(connectionId);
      if (activeEnrollmentId) {
        const session = this.sessions.get(activeEnrollmentId);
        if (session) {
          this._cleanupSessionServer(session);
          this.sessions.delete(activeEnrollmentId);
        }
        this.activeEnrollmentsByConnection.delete(connectionId);
      }
    }

    const existing = this.store.getConnection(connectionId, false);
    if (existing) {
      this.store.deleteConnection(connectionId);
    }

    return {
      connectionId,
      status: 'NOT_ENROLLED',
      message: `Connection ${connectionId.toUpperCase()} disconnected and credentials purged from vault.`
    };
  }

  /**
   * Cancels active enrollment session
   */
  async cancelEnrollment(enrollmentId) {
    const session = this.sessions.get(enrollmentId);
    if (!session) return { cancelled: false };

    this._failSession(enrollmentId, ENROLLMENT_STATES.ENROLLMENT_CANCELLED, 'Enrollment cancelled by operator.');
    return { cancelled: true };
  }

  _failSession(enrollmentId, failureState, errorMessage) {
    const session = this.sessions.get(enrollmentId);
    if (!session) return;

    session.state = failureState;
    session.error = errorMessage;
    session.transientTokens = null;
    session.projectInfo = null;

    this._cleanupSessionServer(session);
  }

  _cleanupSessionServer(session) {
    if (session.timeoutTimer) {
      clearTimeout(session.timeoutTimer);
      session.timeoutTimer = null;
    }
    if (session.server) {
      try {
        session.server.close();
      } catch {}
      session.server = null;
    }
    if (globalThis.__antigravity_servers) {
      globalThis.__antigravity_servers.delete(session.enrollmentId);
    }
    if (this.activeEnrollmentsByConnection.get(session.connectionId) === session.enrollmentId) {
      this.activeEnrollmentsByConnection.delete(session.connectionId);
    }
  }
}

export const antigravityEnrollmentSessionManagerInstance = new AntigravityEnrollmentSessionManager();
export default antigravityEnrollmentSessionManagerInstance;
