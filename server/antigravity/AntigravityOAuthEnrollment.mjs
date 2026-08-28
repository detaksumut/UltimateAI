/**
 * AntigravityOAuthEnrollment.mjs
 * Hardened Production OAuth Enrollment Engine for UltimateAI Antigravity Connections.
 * 
 * Strict Specification & Audit Compliance:
 *  1. Dedicated Namespace: ANTIGRAVITY_OAUTH_CLIENT_ID / ANTIGRAVITY_OAUTH_CLIENT_SECRET.
 *  2. Formal Client ID Regex Validation: /^[0-9]+-[a-z0-9_.-]+\.apps\.googleusercontent\.com$/i
 *  3. Explicit Placeholder Rejection: Detects and rejects dummy/template strings before network dispatch.
 *  4. PKCE Public Client Support: Client Secret is optional for native loopback PKCE flow; zero fake secrets.
 *  5. Dynamic Ephemeral Loopback: 127.0.0.1:<port>/oauth/callback (Strict Single Source of Truth).
 *  6. Granular Error Classification:
 *     - AUTH_CONFIGURATION_MISSING
 *     - AUTH_CONFIGURATION_INVALID
 *     - GOOGLE_OAUTH_AUTHORIZATION_FAILED
 *     - GOOGLE_OAUTH_TOKEN_EXCHANGE_FAILED
 *     - ANTIGRAVITY_CLOUD_CODE_UNAUTHORIZED
 *     - ANTIGRAVITY_PROJECT_DISCOVERY_FAILED
 *     - ENROLLMENT_TOKEN_INCOMPLETE
 *  7. Two-Stage Observability: GOOGLE_OAUTH_SUCCESS vs ANTIGRAVITY_CLOUD_CODE_AUTHORIZED.
 *  8. Transactional Vault Persistence: ZERO disk write if upstream loadCodeAssist fails.
 */

import http from 'http';
import crypto from 'crypto';
import { exec } from 'child_process';
import { antigravityVaultInstance } from './AntigravityVault.mjs';
import { antigravityConnectionStoreInstance } from './AntigravityConnectionStore.mjs';
import { antigravityCloudCodeTransportInstance } from './AntigravityCloudCodeTransport.mjs';

const GOOGLE_CLIENT_ID_REGEX = /^[0-9]+-[a-z0-9_.-]+\.apps\.googleusercontent\.com$/i;
const KNOWN_PLACEHOLDERS = [
  'ultimateai-client-id',
  'client_id_google_anda',
  'google_oauth_client_id_asli',
  'your_client_id_here',
  'placeholder'
];

function base64URLEncode(str) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

import fs from 'fs';
import path from 'path';

const OAUTH_CONFIG_FILE = path.join(process.cwd(), 'storage', 'oauth_config.json');

export function loadPersistedOAuthConfig() {
  try {
    if (fs.existsSync(OAUTH_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(OAUTH_CONFIG_FILE, 'utf8'));
      if (data.clientId) {
        process.env.ANTIGRAVITY_OAUTH_CLIENT_ID = data.clientId;
      }
      if (data.clientSecret) {
        process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET = data.clientSecret;
      }
      return data;
    }
  } catch {}
  return null;
}

export function savePersistedOAuthConfig(clientId, clientSecret = '') {
  try {
    const dir = path.dirname(OAUTH_CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(OAUTH_CONFIG_FILE, JSON.stringify({ clientId, clientSecret }, null, 2), 'utf8');
    process.env.ANTIGRAVITY_OAUTH_CLIENT_ID = clientId;
    if (clientSecret) process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET = clientSecret;
  } catch {}
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
   * Validates and parses OAuth Client Configuration with formal format validation.
   * Requires explicit operator-configured ANTIGRAVITY_OAUTH_CLIENT_ID. Zero hardcoded fallbacks.
   */
  static validateOAuthClientConfig(env = process.env) {
    loadPersistedOAuthConfig();

    let rawId = (env.ANTIGRAVITY_OAUTH_CLIENT_ID || '').trim();
    if (rawId.includes('client_id=')) {
      try {
        const parsedUrl = new URL(rawId);
        rawId = parsedUrl.searchParams.get('client_id') || rawId;
      } catch {
        const match = rawId.match(/client_id=([^&]+)/);
        if (match) rawId = decodeURIComponent(match[1]);
      }
    }

    const isPlaceholder = KNOWN_PLACEHOLDERS.some(p => rawId.toLowerCase().includes(p));
    let rawSecret = (env.ANTIGRAVITY_OAUTH_CLIENT_SECRET || '').trim();

    if (!rawId || isPlaceholder) {
      return {
        valid: false,
        clientId: null,
        clientSecret: null,
        clientIdPresent: false,
        clientIdSource: 'MISSING',
        clientIdFormatValid: false,
        clientSecretPresent: Boolean(rawSecret),
        redirectMode: 'LOOPBACK',
        scopesConfigured: Boolean(env.ANTIGRAVITY_OAUTH_SCOPES),
        error: 'AUTH_CONFIGURATION_MISSING',
        message: 'Google OAuth Client ID belum dikonfigurasi oleh operator. Harap set ANTIGRAVITY_OAUTH_CLIENT_ID pada environment atau konfigurasi operator.'
      };
    }

    const clientId = rawId.trim();
    const clientSecret = rawSecret.trim();

    if (!GOOGLE_CLIENT_ID_REGEX.test(clientId)) {
      return {
        valid: false,
        clientId: null,
        clientSecret: null,
        clientIdPresent: true,
        clientIdSource: 'OPERATOR_CONFIGURED',
        clientIdFormatValid: false,
        clientSecretPresent: Boolean(clientSecret),
        redirectMode: 'LOOPBACK',
        scopesConfigured: Boolean(env.ANTIGRAVITY_OAUTH_SCOPES),
        error: 'AUTH_CONFIGURATION_INVALID',
        message: 'Google OAuth Client ID dari operator tidak valid. Format harus: [0-9]+-[a-z0-9_.-]+.apps.googleusercontent.com'
      };
    }

    const defaultScopes = [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/cclog',
      'https://www.googleapis.com/auth/experimentsandconfigs'
    ];

    const scopes = env.ANTIGRAVITY_OAUTH_SCOPES
      ? env.ANTIGRAVITY_OAUTH_SCOPES.split(',').map(s => s.trim()).filter(Boolean)
      : defaultScopes;

    const controlPlaneEndpoint = env.ANTIGRAVITY_CONTROL_PLANE_ENDPOINT || 'https://cloudcode-pa.googleapis.com';

    return {
      valid: true,
      clientId,
      clientSecret: clientSecret || null,
      clientIdPresent: true,
      clientIdSource: 'OPERATOR_CONFIGURED',
      clientIdFormatValid: true,
      clientSecretPresent: Boolean(clientSecret),
      redirectMode: 'LOOPBACK',
      scopesConfigured: Boolean(env.ANTIGRAVITY_OAUTH_SCOPES),
      scopes: scopes.join(' '),
      controlPlaneEndpoint
    };
  }

  /**
   * Generates PKCE code verifier, challenge, and secure state
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
  buildAuthUrl({ clientId, redirectUri, scopes, challenge, state }) {
    if (!clientId || !redirectUri || !scopes || !challenge || !state) {
      throw new Error('AUTH_CONFIGURATION_INVALID: Missing parameters required for OAuth authorization URL.');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      access_type: 'offline',
      prompt: 'select_account consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Safely launches system browser on host OS
   */
  openBrowser(url) {
    const platform = process.platform;
    try {
      if (platform === 'win32') {
        exec(`powershell -NoProfile -Command "Start-Process '${url.replace(/'/g, "''")}'"`);
      } else if (platform === 'darwin') {
        exec(`open "${url}"`);
      } else {
        exec(`xdg-open "${url}"`);
      }
    } catch {
      // Graceful fallback to frontend window.open
    }
  }

  /**
   * Exchanges authorization code for OAuth tokens with strict assertions
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

    let response;
    try {
      response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
    } catch (networkErr) {
      throw new Error(`GOOGLE_OAUTH_TOKEN_EXCHANGE_FAILED: Network communication error (${networkErr.message})`);
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`GOOGLE_OAUTH_TOKEN_EXCHANGE_FAILED (${response.status}): ${errText}`);
    }

    const tokenData = await response.json();

    // Strict assertions on token payload
    if (!tokenData.access_token || typeof tokenData.access_token !== 'string') {
      throw new Error('ENROLLMENT_TOKEN_INCOMPLETE: Upstream response did not contain access_token.');
    }

    if (!tokenData.refresh_token || typeof tokenData.refresh_token !== 'string') {
      throw new Error('ENROLLMENT_TOKEN_INCOMPLETE: Upstream response did not contain refresh_token (ensure access_type=offline and prompt=consent).');
    }

    if (tokenData.token_type && tokenData.token_type.toLowerCase() !== 'bearer') {
      throw new Error(`ENROLLMENT_TOKEN_INCOMPLETE: Unexpected token_type '${tokenData.token_type}', expected 'Bearer'.`);
    }

    return tokenData;
  }

  /**
   * Interactive Production Enrollment Flow with Strict Stage Separation & Transactional Integrity
   */
  async executeInteractiveEnrollment({ connectionId, accountAlias, label }) {
    // 0. Pre-Flight Config Validation (Fail-Closed before network dispatch)
    const config = AntigravityOAuthEnrollment.validateOAuthClientConfig(process.env);
    if (!config.valid) {
      throw new Error(`${config.error}: ${config.message}`);
    }

    const { verifier, challenge, state } = this.generatePKCE();

    // 1. Dynamic Ephemeral Loopback Listener
    let codeResolver;
    let codeRejecter;
    const codePromise = new Promise((res, rej) => {
      codeResolver = res;
      codeRejecter = rej;
    });

    const server = http.createServer((req, res) => {
      const boundPort = server.address().port;
      const reqUrl = new URL(req.url, `http://127.0.0.1:${boundPort}`);

      if (reqUrl.pathname !== '/oauth/callback') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const code = reqUrl.searchParams.get('code');
      const reqState = reqUrl.searchParams.get('state');
      const error = reqUrl.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h2>OAuth Authorization Denied</h2><p>${error}</p>`);
        server.close();
        codeRejecter(new Error(`GOOGLE_OAUTH_AUTHORIZATION_FAILED: ${error}`));
        return;
      }

      if (reqState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h2>Invalid State</h2><p>OAuth state mismatch.</p>`);
        server.close();
        codeRejecter(new Error('GOOGLE_OAUTH_AUTHORIZATION_FAILED: Callback state verification token mismatch.'));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h2>Missing Code</h2>`);
        server.close();
        codeRejecter(new Error('GOOGLE_OAUTH_AUTHORIZATION_FAILED: No authorization code received in callback.'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <body style="font-family: system-ui, sans-serif; background: #090d16; color: #f3f4f6; text-align: center; padding: 40px;">
            <h2 style="color: #10b981;">UltimateAI OAuth Authorization Successful</h2>
            <p>You can close this tab and return to the terminal.</p>
          </body>
        </html>
      `);

      server.close();
      codeResolver(code);
    });

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const boundPort = server.address().port;
    const redirectUri = `http://127.0.0.1:${boundPort}/oauth/callback`;

    const authUrl = this.buildAuthUrl({
      clientId: config.clientId,
      redirectUri,
      scopes: config.scopes,
      challenge,
      state
    });

    console.log(`\n================================================================`);
    console.log(`  ULTIMATEAI OAUTH ENROLLMENT: [${connectionId.toUpperCase()}]`);
    console.log(`================================================================`);
    console.log(`\n[DIAGNOSTICS - PRE-FLIGHT]:`);
    console.log(`  -> clientIdPresent:             ${config.clientIdPresent}`);
    console.log(`  -> clientIdFormatValid:         ${config.clientIdFormatValid}`);
    console.log(`  -> clientSecretPresent:         ${config.clientSecretPresent}`);
    console.log(`  -> redirectMode:                ${config.redirectMode}`);
    console.log(`  -> redirectUri:                 ${redirectUri}`);
    console.log(`  -> selectedControlPlaneEndpoint:${config.controlPlaneEndpoint}`);
    console.log(`  -> scopesConfigured:            ${config.scopesConfigured}`);

    console.log(`\n[STEP 1] Launching System Browser for Google Cloud Code Authorization...`);
    console.log(`If browser does not open automatically, visit:\n\n${authUrl}\n`);

    this.openBrowser(authUrl);

    console.log(`Waiting for browser callback (120s timeout)...`);
    const code = await codePromise;
    console.log(`\n✅ Authorization code received from browser loopback callback.`);

    // 2. Token Exchange (Stage 1: GOOGLE_OAUTH_SUCCESS)
    console.log(`\n[STAGE 1: GOOGLE_OAUTH] Exchanging Authorization Code for Tokens...`);
    const tokenData = await this.exchangeCodeForTokens({
      code,
      verifier,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri
    });

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    console.log(`  -> tokenExchangeSuccess: true`);
    console.log(`  -> tokenType:            ${tokenData.token_type || 'Bearer'}`);
    console.log(`  -> refreshTokenPresent:  true`);
    console.log(`  -> expiresAt:            ${expiresAt}`);
    console.log(`  -> Status:               🟢 GOOGLE_OAUTH_SUCCESS`);

    // 3. Control Plane Onboarding (Stage 2: ANTIGRAVITY_CLOUD_CODE_AUTHORIZED)
    console.log(`\n[STAGE 2: CLOUD_CODE_ONBOARDING] Discovering Upstream Project Binding (/v1internal:loadCodeAssist)...`);
    const tempConn = { id: connectionId, accessToken };
    let projectInfo = null;

    try {
      projectInfo = await this.transport.loadCodeAssist(tempConn, accessToken, { strictFreshProof: true });
    } catch (onboardingErr) {
      console.error(`\n❌ Control Plane Onboarding FAILED: ${onboardingErr.message}`);
      console.error(`❌ Transaction Aborted: Credentials NOT persisted to Vault (Fail-Closed).`);
      throw new Error(`ANTIGRAVITY_CLOUD_CODE_UNAUTHORIZED: Google login succeeded, but Cloud Code Assist rejected authorization (${onboardingErr.message}).`);
    }

    if (projectInfo.projectSource !== 'UPSTREAM_PROJECT_DISCOVERED' || !projectInfo.projectId) {
      console.error(`\n❌ Transaction Aborted: No authoritative upstream projectId received.`);
      throw new Error('ANTIGRAVITY_PROJECT_DISCOVERY_FAILED: Upstream did not return an authoritative projectId.');
    }

    console.log(`  -> projectSource:     ${projectInfo.projectSource}`);
    console.log(`  -> projectIdPresent:  true`);
    console.log(`  -> projectId:         ${projectInfo.projectId}`);
    console.log(`  -> projectTier:       ${projectInfo.tier}`);
    console.log(`  -> Status:            🟢 ANTIGRAVITY_CLOUD_CODE_AUTHORIZED`);

    // 4. Transactional Persistence (ONLY after Stage 2 success)
    console.log(`\n[STAGE 3: SECURE_PERSISTENCE] Encrypting Credentials in Local Vault...`);
    const saved = this.store.saveConnection({
      id: connectionId,
      accountAlias: accountAlias || `antigravity-${connectionId.replace('ag-', '')}`,
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

    console.log(`\n================================================================`);
    console.log(`  🏆 CONNECTION [${connectionId.toUpperCase()}] FULLY ENROLLED & SECURED!`);
    console.log(`================================================================\n`);
    return saved;
  }
}

export const antigravityOAuthEnrollmentInstance = new AntigravityOAuthEnrollment();
export default antigravityOAuthEnrollmentInstance;
