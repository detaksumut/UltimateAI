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
      if (activeSession && activeSession.state === ENROLLMENT_STATES.WAITING_FOR_AUTHORIZATION) {
        status = 'WAITING_FOR_AUTH';
      } else if (existing) {
        if (existing.hasAccessToken || existing.hasRefreshToken) {
          status = existing.testStatus === 'AUTH_REFRESH_FAILED' ? 'AUTH_EXPIRED' : (existing.testStatus || 'ENROLLED');
        } else {
          status = 'NOT_ENROLLED';
        }
      }

      slots.push({
        connectionId,
        accountAlias: existing?.accountAlias || `antigravity-0${i}`,
        email: existing?.email || existing?.accountAlias || null,
        label: existing?.label || `Antigravity Connection ${i}`,
        priority: i,
        status,
        isEnrolled: Boolean(existing && (existing.hasAccessToken || existing.hasRefreshToken)),
        projectId: existing?.projectId ? 'BOUND' : 'UNBOUND',
        projectTier: existing?.projectTier || 'STANDARD',
        expiresAt: existing?.expiresAt || null,
        hasAccessToken: Boolean(existing?.hasAccessToken),
        hasRefreshToken: Boolean(existing?.hasRefreshToken),
        cooldownUntil: existing?.cooldownUntil || null,
        models: Object.keys(antigravityModelRegistryInstance.models),
        quotaSummary: quotaSummary[connectionId] || { source: 'LOCAL_ACCOUNTING', remainingEstimate: 1000 }
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

    // Cancel existing session for this connection if active
    const prevEnrollmentId = this.activeEnrollmentsByConnection.get(connectionId);
    if (prevEnrollmentId) {
      await this.cancelEnrollment(prevEnrollmentId);
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

    // Allocate Ephemeral Loopback Listener
    await new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        this._handleHttpCallback(enrollmentId, req, res);
      });

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

    // 120-second safety timeout
    session.timeoutTimer = setTimeout(() => {
      if (session.state === ENROLLMENT_STATES.WAITING_FOR_AUTHORIZATION) {
        this._failSession(enrollmentId, ENROLLMENT_STATES.ENROLLMENT_TIMEOUT, 'OAuth authorization timed out after 120 seconds.');
      }
    }, 120000);

    this.sessions.set(enrollmentId, session);
    this.activeEnrollmentsByConnection.set(connectionId, enrollmentId);

    // Launch system browser automatically
    enrollmentEngine.openBrowser(session.authUrl);

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

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <body style="font-family: system-ui, sans-serif; background: #090d16; color: #f3f4f6; text-align: center; padding: 40px;">
          <h2 style="color: #10b981;">Otorisasi Antigravity Diterima</h2>
          <p>Memproses Cloud Code onboarding dan enkripsi Vault. Anda dapat menutup tab ini.</p>
        </body>
      </html>
    `);

    // Process token exchange & Cloud Code onboarding asynchronously
    this._processAuthorizationCode(enrollmentId, code).catch(err => {
      console.error('[Enrollment] Processing error:', err.message);
    });
  }

  /**
   * Allows operator to manually paste either the raw code or full callback URL
   */
  async processManualCallback(enrollmentId, inputString) {
    const session = this.sessions.get(enrollmentId);
    if (!session) {
      throw new Error('ENROLLMENT_SESSION_NOT_FOUND: Session does not exist or has expired.');
    }

    const trimmed = (inputString || '').trim();
    if (!trimmed) {
      throw new Error('MISSING_INPUT: Harap paste Callback URL atau Authorization Code Anda.');
    }

    let code = '';

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const urlObj = new URL(trimmed);
        const error = urlObj.searchParams.get('error');
        if (error) {
          this._failSession(enrollmentId, ENROLLMENT_STATES.OAUTH_AUTHORIZATION_FAILED, error);
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
      this._failSession(enrollmentId, ENROLLMENT_STATES.OAUTH_AUTHORIZATION_FAILED, 'No code parameter found.');
      throw new Error('GOOGLE_OAUTH_AUTHORIZATION_FAILED: Missing code parameter.');
    }

    return await this._processAuthorizationCode(enrollmentId, code);
  }

  /**
   * Two-stage transactional processor for authorization code
   */
  async _processAuthorizationCode(enrollmentId, code) {
    const session = this.sessions.get(enrollmentId);
    if (!session) return;

    const enrollmentEngine = new AntigravityOAuthEnrollment(this.vault, this.store, this.transport);

    try {
      // Stage 1: Token Exchange
      session.state = ENROLLMENT_STATES.GOOGLE_OAUTH_SUCCESS;
      const tokenData = await enrollmentEngine.exchangeCodeForTokens({
        code,
        verifier: session.verifier,
        clientId: session.config.clientId,
        clientSecret: session.config.clientSecret,
        redirectUri: session.redirectUri
      });

      session.state = ENROLLMENT_STATES.TOKEN_VALIDATED;
      session.transientTokens = tokenData;

      // Stage 2: Cloud Code Onboarding (Strict Fresh Proof)
      session.state = ENROLLMENT_STATES.CLOUD_CODE_AUTHORIZING;
      const tempConn = { id: session.connectionId, accessToken: tokenData.access_token };
      const projectInfo = await this.transport.loadCodeAssist(tempConn, tokenData.access_token, { strictFreshProof: true });

      if (projectInfo.projectSource !== 'UPSTREAM_PROJECT_DISCOVERED' || !projectInfo.projectId) {
        throw new Error('ANTIGRAVITY_PROJECT_DISCOVERY_FAILED: Upstream did not return an authoritative projectId.');
      }

      session.projectInfo = projectInfo;
      session.state = ENROLLMENT_STATES.CLOUD_CODE_AUTHORIZED;

      // Stage 3: Fetch Google User Profile for exact email identification
      let userEmail = `antigravity-${session.connectionId.replace('ag-', '')}`;
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
      } catch {}

      // Stage 4: Transactional Persistence
      session.state = ENROLLMENT_STATES.PERSISTING;
      const expiresIn = tokenData.expires_in || 3600;
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      this.store.saveConnection({
        id: session.connectionId,
        accountAlias: userEmail,
        email: userEmail,
        userName,
        label: `${userEmail} (${session.connectionId.toUpperCase()})`,
        provider: 'ANTIGRAVITY',
        authType: 'oauth',
        isActive: true,
        priority: parseInt(session.connectionId.replace('ag-0', ''), 10) || 1,
        projectId: projectInfo.projectId,
        projectTier: projectInfo.tier,
        expiresAt,
        testStatus: 'ENROLLED',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token
      });

      session.state = ENROLLMENT_STATES.ENROLLED;
      this._cleanupSessionServer(session);

      return {
        connectionId: session.connectionId,
        state: ENROLLMENT_STATES.ENROLLED,
        email: userEmail,
        projectId: projectInfo.projectId
      };
    } catch (err) {
      const failState = err.message.includes('TOKEN')
        ? ENROLLMENT_STATES.TOKEN_EXCHANGE_FAILED
        : (err.message.includes('PROJECT') ? ENROLLMENT_STATES.PROJECT_DISCOVERY_FAILED : ENROLLMENT_STATES.CLOUD_CODE_AUTH_FAILED);

      this._failSession(enrollmentId, failState, err.message);
      throw err;
    }
  }

  /**
   * Proactively refreshes token for a specific connection
   */
  async refreshConnection(connectionId) {
    const hydrated = this.store.getConnection(connectionId, true);
    if (!hydrated || (!hydrated.accessToken && !hydrated.refreshToken)) {
      throw new Error(`CONNECTION_NOT_ENROLLED: '${connectionId}' has no enrolled credentials.`);
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
   * Destructively removes credentials for a connection
   */
  async disconnectConnection(connectionId) {
    const existing = this.store.getConnection(connectionId, false);
    if (!existing) {
      return { connectionId, status: 'NOT_ENROLLED', message: 'Connection not found.' };
    }

    this.store.deleteConnection(connectionId);
    this.quotaTracker.recordLocalUsage(connectionId, 'gemini-3.6-flash-high'); // reset counter
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
      session.server.close();
      session.server = null;
    }
    if (this.activeEnrollmentsByConnection.get(session.connectionId) === session.enrollmentId) {
      this.activeEnrollmentsByConnection.delete(session.connectionId);
    }
  }
}

export const antigravityEnrollmentSessionManagerInstance = new AntigravityEnrollmentSessionManager();
export default antigravityEnrollmentSessionManagerInstance;
