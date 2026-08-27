/**
 * AntigravityTokenManager.mjs
 * Proactive Token Refresh Guard & Lifecycle Manager.
 * Checks token expiration before dispatching requests.
 * Automatically triggers Google OAuth refresh when token has < 5 minutes remaining.
 */

import { antigravityConnectionStoreInstance } from './AntigravityConnectionStore.mjs';

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiration

export class AntigravityTokenManager {
  constructor(store = antigravityConnectionStoreInstance) {
    this.store = store;
  }

  /**
   * Ensures the connection has a valid access token.
   * If expired or expiring soon, refreshes automatically.
   * @param {Object} connection - Connection record with accessToken, refreshToken, expiresAt
   * @returns {Promise<Object>} { valid: boolean, accessToken: string, refreshed: boolean, error?: string }
   */
  async ensureValidToken(connection) {
    if (!connection) {
      return { valid: false, error: 'NO_CONNECTION_PROVIDED' };
    }

    let fullConn = connection;
    if ((!fullConn.accessToken || !fullConn.refreshToken) && fullConn.id) {
      const hydrated = this.store.getConnection(fullConn.id, true);
      if (hydrated) fullConn = hydrated;
    }

    const now = Date.now();
    const expiresAtMs = fullConn.expiresAt ? new Date(fullConn.expiresAt).getTime() : 0;
    const isExpiringSoon = !expiresAtMs || (expiresAtMs - now) < REFRESH_THRESHOLD_MS;

    // Token is fresh and valid
    if (fullConn.accessToken && !isExpiringSoon) {
      return {
        valid: true,
        accessToken: fullConn.accessToken,
        refreshed: false
      };
    }

    // Attempt proactive token refresh if refreshToken is available
    if (fullConn.refreshToken) {
      try {
        const refreshResult = await this.refreshToken(fullConn);
        return {
          valid: true,
          accessToken: refreshResult.accessToken,
          refreshed: true
        };
      } catch (err) {
        // Mark connection as AUTH_REFRESH_FAILED with 15-minute cooldown
        this.store.updateStatus(connection.id, {
          testStatus: 'AUTH_REFRESH_FAILED',
          cooldownUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        });

        return {
          valid: false,
          error: `AUTH_REFRESH_FAILED: ${err.message}`
        };
      }
    }

    // Direct token without refresh token (fallback if active)
    if (connection.accessToken) {
      return { valid: true, accessToken: connection.accessToken, refreshed: false };
    }

    return { valid: false, error: 'NO_VALID_ACCESS_OR_REFRESH_TOKEN' };
  }

  /**
   * Refreshes access token with Google OAuth 2.0 Token Endpoint
   */
  async refreshToken(connection) {
    const tokenEndpoint = 'https://oauth2.googleapis.com/token';
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || 'ultimateai-client-id';
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';

    const bodyParams = new URLSearchParams({
      client_id: clientId,
      refresh_token: connection.refreshToken,
      grant_type: 'refresh_token'
    });

    if (clientSecret) {
      bodyParams.append('client_secret', clientSecret);
    }

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString()
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google OAuth Refresh Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const newAccessToken = data.access_token;
    const expiresInSeconds = data.expires_in || 3600;
    const newExpiresAt = new Date(Date.now() + (expiresInSeconds * 1000)).toISOString();

    // Persist updated token in encrypted store
    this.store.saveConnection({
      id: connection.id,
      accessToken: newAccessToken,
      expiresAt: newExpiresAt,
      testStatus: 'ACTIVE',
      cooldownUntil: null
    });

    return {
      accessToken: newAccessToken,
      expiresAt: newExpiresAt
    };
  }
}

export const antigravityTokenManagerInstance = new AntigravityTokenManager();
export default antigravityTokenManagerInstance;
