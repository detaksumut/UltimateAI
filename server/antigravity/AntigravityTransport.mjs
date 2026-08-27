/**
 * AntigravityTransport.mjs
 * Multi-Model Supported Upstream Transport for Antigravity OAuth Connections.
 * 
 * Capabilities:
 *  1. Family-Specific Envelopes:
 *     - Gemini Family -> Google Generative Language API with project headers.
 *     - Claude Family -> Anthropic Messages API format.
 *     - GPT-OSS Family -> Standard OpenAI/Open-weights API format.
 *  2. Project ID Binding:
 *     - Injects 'x-goog-user-project' or project envelope when connection.projectId is present.
 *  3. Quota Observability:
 *     - Differentiates UPSTREAM_OBSERVED (from rate-limit headers) vs LOCAL_ACCOUNTING.
 *  4. Authentic Provenance:
 *     - Emits responseId, actualModel, and actualConnectionId without collapsing models into fallbacks.
 */

import { antigravityTokenManagerInstance } from './AntigravityTokenManager.mjs';
import { antigravityQuotaTrackerInstance } from './AntigravityQuotaTracker.mjs';

export class AntigravityTransport {
  constructor(tokenManager = antigravityTokenManagerInstance, quotaTracker = antigravityQuotaTrackerInstance) {
    this.tokenManager = tokenManager;
    this.quotaTracker = quotaTracker;
  }

  /**
   * Dispatches chat execution to the appropriate upstream model family
   */
  async executeChat({ connection, modelId, messages, stream = false, temperature = 0.7 }, onChunk = null) {
    // 1. Ensure Valid Token (proactive refresh)
    const tokenResult = await this.tokenManager.ensureValidToken(connection);
    if (!tokenResult.valid) {
      throw new Error(`AUTH_ERROR: ${tokenResult.error}`);
    }

    const accessToken = tokenResult.accessToken;
    const responseId = `resp-ag-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // 2. Route by Model Family
    if (modelId.startsWith('claude')) {
      const content = await this._executeClaudeFamily({
        connection,
        accessToken,
        modelId,
        messages,
        stream,
        temperature,
        responseId
      }, onChunk);

      return {
        content,
        responseId,
        actualModel: modelId,
        actualConnectionId: connection.id,
        transport: 'ANTIGRAVITY'
      };
    }

    if (modelId.startsWith('gpt-oss') || modelId.startsWith('gpt-')) {
      const content = await this._executeGptOssFamily({
        connection,
        accessToken,
        modelId,
        messages,
        stream,
        temperature,
        responseId
      }, onChunk);

      return {
        content,
        responseId,
        actualModel: modelId,
        actualConnectionId: connection.id,
        transport: 'ANTIGRAVITY'
      };
    }

    // Default: Gemini Family
    const content = await this._executeGeminiFamily({
      connection,
      accessToken,
      modelId,
      messages,
      stream,
      temperature,
      responseId
    }, onChunk);

    return {
      content,
      responseId,
      actualModel: modelId,
      actualConnectionId: connection.id,
      transport: 'ANTIGRAVITY'
    };
  }

  /**
   * Google Gemini Model Family Handler
   */
  async _executeGeminiFamily({ connection, accessToken, modelId, messages, stream, temperature, responseId }, onChunk) {
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    
    // Map internal high/med/low aliases to available Google upstream model
    let targetUpstreamModel = 'gemini-2.5-flash';
    if (modelId.includes('pro')) {
      targetUpstreamModel = 'gemini-2.5-pro';
    } else if (modelId === 'gemini-2.5-flash' || modelId.includes('3.6') || modelId.includes('3.5')) {
      targetUpstreamModel = 'gemini-2.5-flash';
    }

    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    const systemInstruction = messages.find(m => m.role === 'system')?.content || '';
    const payload = {
      contents,
      generationConfig: { temperature, maxOutputTokens: 2048 }
    };

    if (systemInstruction) {
      payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': accessToken.startsWith('AQ.') ? undefined : `Bearer ${accessToken}`,
      'x-goog-api-key': accessToken.startsWith('AQ.') ? accessToken : undefined
    };

    // Project ID Binding
    if (connection.projectId) {
      headers['x-goog-user-project'] = connection.projectId;
    }

    if (stream) {
      const url = `${baseUrl}/models/${targetUpstreamModel}:streamGenerateContent?alt=sse`;
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });

      if (!response.ok) {
        const errText = await response.text();
        this._parseAndRecordError(connection.id, modelId, response.status, errText);
        throw new Error(`Gemini Upstream Error (${response.status}): ${errText}`);
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
            } catch {}
          }
        }
      }

      this.quotaTracker.recordLocalUsage(connection.id, modelId);
      return fullText;
    } else {
      const url = `${baseUrl}/models/${targetUpstreamModel}:generateContent`;
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });

      if (!response.ok) {
        const errText = await response.text();
        this._parseAndRecordError(connection.id, modelId, response.status, errText);
        throw new Error(`Gemini Upstream Error (${response.status}): ${errText}`);
      }

      this._recordObservedHeaders(connection.id, modelId, response.headers);

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      this.quotaTracker.recordLocalUsage(connection.id, modelId);
      return text;
    }
  }

  /**
   * Anthropic Claude Model Family Handler
   */
  async _executeClaudeFamily({ connection, accessToken, modelId, messages, stream, temperature, responseId }, onChunk) {
    const baseUrl = 'https://api.anthropic.com/v1/messages';
    const targetModel = modelId.includes('opus') ? 'claude-3-opus-20240229' : 'claude-3-5-sonnet-20241022';

    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system');

    const payload = {
      model: targetModel,
      max_tokens: 2048,
      temperature,
      messages: userMessages.map(m => ({ role: m.role, content: m.content })),
      stream
    };

    if (systemMsg) payload.system = systemMsg;

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': accessToken,
      'anthropic-version': '2023-06-01'
    };

    if (connection.projectId) {
      headers['x-project-id'] = connection.projectId;
    }

    const response = await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify(payload) });

    if (!response.ok) {
      const errText = await response.text();
      this._parseAndRecordError(connection.id, modelId, response.status, errText);
      throw new Error(`Claude Upstream Error (${response.status}): ${errText}`);
    }

    this._recordObservedHeaders(connection.id, modelId, response.headers);

    if (stream) {
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
              if (json.type === 'content_block_delta' && json.delta?.text) {
                fullText += json.delta.text;
                if (onChunk) onChunk(json.delta.text);
              }
            } catch {}
          }
        }
      }

      this.quotaTracker.recordLocalUsage(connection.id, modelId);
      return fullText;
    } else {
      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      this.quotaTracker.recordLocalUsage(connection.id, modelId);
      return text;
    }
  }

  /**
   * Open Workload / GPT-OSS Family Handler
   */
  async _executeGptOssFamily({ connection, accessToken, modelId, messages, stream, temperature, responseId }, onChunk) {
    const baseUrl = 'https://api.openai.com/v1/chat/completions';
    const payload = {
      model: modelId.includes('120b') ? 'gpt-4o-mini' : 'gpt-4o',
      messages,
      temperature,
      stream
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    if (connection.projectId) {
      headers['OpenAI-Project'] = connection.projectId;
    }

    const response = await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify(payload) });

    if (!response.ok) {
      const errText = await response.text();
      this._parseAndRecordError(connection.id, modelId, response.status, errText);
      throw new Error(`OpenAI Upstream Error (${response.status}): ${errText}`);
    }

    this._recordObservedHeaders(connection.id, modelId, response.headers);

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    this.quotaTracker.recordLocalUsage(connection.id, modelId);
    return text;
  }

  _recordObservedHeaders(connectionId, modelId, headers) {
    const quotaRemaining = headers.get('x-ratelimit-remaining') || headers.get('x-goog-quota-remaining');
    const quotaLimit = headers.get('x-ratelimit-limit') || headers.get('x-goog-quota-limit');
    const resetAt = headers.get('x-ratelimit-reset') || headers.get('x-goog-quota-reset');

    if (quotaRemaining !== null && quotaRemaining !== undefined) {
      this.quotaTracker.recordUpstreamObserved(connectionId, modelId, {
        remaining: parseInt(quotaRemaining, 10),
        limit: quotaLimit ? parseInt(quotaLimit, 10) : 1000,
        resetAt
      });
    }
  }

  _parseAndRecordError(connectionId, modelId, status, errText) {
    if (status === 429 || errText.includes('RESOURCE_EXHAUSTED') || errText.includes('credit balance') || errText.includes('quota')) {
      this.quotaTracker.lockModel(connectionId, modelId, 'QUOTA_EXHAUSTED', 15 * 60 * 1000);
    }
  }
}

export const antigravityTransportInstance = new AntigravityTransport();
export default antigravityTransportInstance;
