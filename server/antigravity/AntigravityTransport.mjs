/**
 * AntigravityTransport.mjs
 * Real Supported Upstream Transport for Antigravity OAuth Connections.
 * Handles HTTPS chat completions and native SSE streaming.
 * Captures observed upstream quota headers for AntigravityQuotaTracker.
 */

import { antigravityTokenManagerInstance } from './AntigravityTokenManager.mjs';
import { antigravityQuotaTrackerInstance } from './AntigravityQuotaTracker.mjs';

export class AntigravityTransport {
  constructor(tokenManager = antigravityTokenManagerInstance, quotaTracker = antigravityQuotaTrackerInstance) {
    this.tokenManager = tokenManager;
    this.quotaTracker = quotaTracker;
    this.upstreamBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * Executes real chat request to upstream Google / Antigravity backend
   */
  async executeChat({ connection, modelId, messages, stream = false, temperature = 0.7 }, onChunk = null) {
    // 1. Ensure Valid Token (proactive refresh)
    const tokenResult = await this.tokenManager.ensureValidToken(connection);
    if (!tokenResult.valid) {
      throw new Error(`AUTH_ERROR: ${tokenResult.error}`);
    }

    const accessToken = tokenResult.accessToken;

    // 2. Build Standard Upstream Payload
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    const systemInstruction = messages.find(m => m.role === 'system')?.content || '';

    const payload = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: 2048
      }
    };

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    // Map internal model name to actual upstream model name if needed
    const targetUpstreamModel = modelId.includes('gemini') ? (modelId === 'gemini-3.1-pro-high' ? 'gemini-2.5-flash' : 'gemini-2.5-flash') : 'gemini-2.5-flash';

    if (stream) {
      const url = `${this.upstreamBaseUrl}/models/${targetUpstreamModel}:streamGenerateContent?alt=sse`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken.startsWith('AQ.') ? undefined : `Bearer ${accessToken}`,
          'x-goog-api-key': accessToken.startsWith('AQ.') ? accessToken : undefined
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        this._parseAndRecordError(connection.id, modelId, response.status, errText);
        throw new Error(`Upstream Error (${response.status}): ${errText}`);
      }

      this._recordObservedHeaders(connection.id, modelId, response.headers);

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const lines = chunkText.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.substring(6));
              const token = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (token) {
                fullText += token;
                if (onChunk) onChunk(token);
              }
            } catch {
              // Partial line
            }
          }
        }
      }

      this.quotaTracker.recordLocalUsage(connection.id, modelId);
      return fullText;
    } else {
      const url = `${this.upstreamBaseUrl}/models/${targetUpstreamModel}:generateContent`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken.startsWith('AQ.') ? undefined : `Bearer ${accessToken}`,
          'x-goog-api-key': accessToken.startsWith('AQ.') ? accessToken : undefined
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        this._parseAndRecordError(connection.id, modelId, response.status, errText);
        throw new Error(`Upstream Error (${response.status}): ${errText}`);
      }

      this._recordObservedHeaders(connection.id, modelId, response.headers);

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      this.quotaTracker.recordLocalUsage(connection.id, modelId);
      return text;
    }
  }

  _recordObservedHeaders(connectionId, modelId, headers) {
    const quotaRemaining = headers.get('x-ratelimit-remaining') || headers.get('x-goog-quota-remaining');
    const quotaLimit = headers.get('x-ratelimit-limit') || headers.get('x-goog-quota-limit');

    if (quotaRemaining !== null && quotaRemaining !== undefined) {
      this.quotaTracker.recordUpstreamObserved(connectionId, modelId, {
        remaining: parseInt(quotaRemaining, 10),
        limit: quotaLimit ? parseInt(quotaLimit, 10) : 1000
      });
    }
  }

  _parseAndRecordError(connectionId, modelId, status, errText) {
    if (status === 429 || errText.includes('RESOURCE_EXHAUSTED') || errText.includes('quota')) {
      this.quotaTracker.lockModel(connectionId, modelId, 'QUOTA_EXHAUSTED', 10 * 60 * 1000);
    }
  }
}

export const antigravityTransportInstance = new AntigravityTransport();
export default antigravityTransportInstance;
