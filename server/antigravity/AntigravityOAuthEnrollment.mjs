/**
 * AntigravityOAuthEnrollment.mjs
 * Production OAuth Enrollment Engine for UltimateAI Antigravity Connections.
 * 
 * Enrolls genuine Google accounts as independent provider connections:
 *  1. Generates PKCE challenge and secure random state.
 *  2. Hosts local HTTP callback listener.
 *  3. Exchanges authorization code for access_token and refresh_token.
 *  4. Performs native Cloud Code control-plane onboarding (/v1internal:loadCodeAssist).
 *  5. Encrypts tokens via AntigravityVault and persists metadata via AntigravityConnectionStore.
 * 
 * Strict Discipline:
 *  - Zero IDE/VS Code session scraping.
 *  - Zero placeholder / synthetic client IDs. Throws AUTH_CONFIGURATION_MISSING if unset.
 */

import http from 'http';
import crypto from 'crypto';
import { antigravityVaultInstance } from './AntigravityVault.mjs';
import { antigravityConnectionStoreInstance } from './AntigravityConnectionStore.mjs';
import { antigravityCloudCodeTransportInstance } from './AntigravityCloudCodeTransport.mjs';

function base64URLEncode(str) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

export class AntigravityOAuthEnrollment {
  constructor(
    vault = antigravityVaultInstance,
    store = antigravityConnectionStoreInstance,
    transport = antigravityCloudCodeTransportInstance
  ) {
    this.vault = vault;
    this.store = store;
    this.transport = transport;
  }

  /**
   * Validates OAuth client configuration
   */
  _getOAuthConfig() {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:8085/oauth/callback';

    if (!clientId) {
      throw new Error('AUTH_CONFIGURATION_MISSING: GOOGLE_OAUTH_CLIENT_ID environment variable is required for production OAuth enrollment.');
    }

    return { clientId, clientSecret, redirectUri };
  }

  /**
   * Generates PKCE code verifier and challenge
   */
  generatePKCE() {
    const verifier = base64URLEncode(crypto.randomBytes(32));
    const challenge = base64URLEncode(sha256(verifier));
    const state = base64URLEncode(crypto.randomBytes(16));
    return { verifier, challenge, state };
  }

  /**
   * Builds the Google OAuth 2.0 authorization URL
   */
  buildAuthUrl({ clientId, redirectUri, challenge, state }) {
    const scopes = [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/generative-language'
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for tokens
   */
  async exchangeCodeForTokens({ code, verifier, clientId, clientSecret, redirectUri }) {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier
    });

    if (clientSecret) {
      params.append('client_secret', clientSecret);
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Token Exchange Error (${response.status}): ${errText}`);
    }

    return await response.json();
  }

  /**
   * Starts local callback server and waits for authorization code
   */
  async listenForCallback({ port = 8085, expectedState, timeoutMs = 120000 }) {
    return new Promise((resolve, reject) => {
      let server = null;
      let timer = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (server) server.close();
      };

      timer = setTimeout(() => {
        cleanup();
        reject(new Error('ENROLLMENT_TIMEOUT: OAuth callback not received within 120 seconds.'));
      }, timeoutMs);

      server = http.createServer((req, res) => {
        const reqUrl = new URL(req.url, `http://localhost:${port}`);
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
          res.end(`<h2>OAuth Enrollment Failed</h2><p>${error}</p>`);
          cleanup();
          reject(new Error(`OAUTH_ERROR_CALLBACK: ${error}`));
          return;
        }

        if (state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h2>Invalid State</h2><p>OAuth state mismatch.</p>`);
          cleanup();
          reject(new Error('OAUTH_STATE_MISMATCH: Callback state did not match enrollment session.'));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h2>Missing Code</h2><p>Authorization code not present in callback.</p>`);
          cleanup();
          reject(new Error('MISSING_AUTH_CODE: Callback did not contain authorization code.'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: system-ui, sans-serif; text-align: center; padding: 40px; background: #0b0f19; color: #fff;">
              <h1 style="color: #10b981;">UltimateAI OAuth Authorization Successful</h1>
              <p>You can close this tab and return to the terminal.</p>
            </body>
          </html>
        `);

        cleanup();
        resolve(code);
      });

      server.listen(port, () => {
        // Server listening
      });

      server.on('error', (err) => {
        cleanup();
        reject(err);
      });
    });
  }

  /**
   * Enrolls an account connection (e.g. 'ag-01')
   */
  async enrollConnection({ connectionId, accountAlias, label, port = 8085 }) {
    const config = this._getOAuthConfig();
    const { verifier, challenge, state } = this.generatePKCE();
    const authUrl = this.buildAuthUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      challenge,
      state
    });

    console.log(`\n================================================================`);
    console.log(`  OAUTH ENROLLMENT FOR [${connectionId.toUpperCase()}] (${accountAlias})`);
    console.log(`================================================================`);
    console.log(`\n1. Open the following URL in your browser to authorize:\n`);
    console.log(`   ${authUrl}\n`);
    console.log(`2. Waiting for browser callback on ${config.redirectUri} (120s timeout)...`);

    const code = await this.listenForCallback({ port, expectedState: state });
    console.log(`\n✅ Authorization code received from browser callback.`);

    console.log(`3. Exchanging code for OAuth access & refresh tokens...`);
    const tokenData = await this.exchangeCodeForTokens({
      code,
      verifier,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri
    });

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    console.log(`✅ Tokens obtained successfully.`);

    console.log(`4. Discovering upstream Cloud Code project binding (/v1internal:loadCodeAssist)...`);
    const tempConn = { id: connectionId, accessToken };
    const projectInfo = await this.transport.loadCodeAssist(tempConn, accessToken, { strictFreshProof: true });

    console.log(`✅ Fresh Upstream Project Bound: ${projectInfo.projectId} (Tier: ${projectInfo.tier})`);

    console.log(`5. Encrypting credentials in Local Vault and persisting metadata...`);
    const saved = this.store.saveConnection({
      id: connectionId,
      accountAlias,
      label: label || `Antigravity Connection ${connectionId}`,
      provider: 'ANTIGRAVITY',
      authType: 'oauth',
      isActive: true,
      priority: parseInt(connectionId.replace('ag-0', ''), 10) || 1,
      projectId: projectInfo.projectId,
      projectTier: projectInfo.tier,
      expiresAt,
      testStatus: 'ENROLLED',
      accessToken,
      refreshToken
    });

    console.log(`\n🏆 Connection [${connectionId.toUpperCase()}] successfully enrolled and secured!\n`);
    return saved;
  }
}

export const antigravityOAuthEnrollmentInstance = new AntigravityOAuthEnrollment();
export default antigravityOAuthEnrollmentInstance;
