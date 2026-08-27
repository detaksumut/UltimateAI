/**
 * DocumentIntelligenceTool.mjs
 * PHASE 6 - Enterprise Document Intelligence & Semantic Chunking Engine for 9Router.
 * Supports PDF, DOCX, CSV, and TXT analysis with sliding-window chunking and citation provenance.
 */

import { ToolContract, PERMISSION_LEVELS } from './ToolContract.mjs';

export class DocumentIntelligenceTool extends ToolContract {
  constructor() {
    super({
      name: 'doc.analyze',
      version: '2.0.0',
      description: 'Performs semantic chunking, keyword-ranked extraction, and citation mapping on uploaded documents.',
      inputSchema: { documentText: 'string', query: 'string', fileName: 'string', maxChunks: 'number' },
      outputSchema: { fileName: 'string', totalChunks: 'number', relevantChunks: 'array', summary: 'string' },
      permissionLevel: PERMISSION_LEVELS.READ_ONLY,
      timeoutMs: 8000
    });
  }

  async execute({ documentText = '', query = '', fileName = 'document.txt', maxChunks = 4 }, signal = null) {
    const startTime = Date.now();

    if (!documentText || !documentText.trim()) {
      return {
        fileName,
        status: 'EMPTY_DOCUMENT',
        totalChunks: 0,
        relevantChunks: [],
        latencyMs: Date.now() - startTime
      };
    }

    // 1. Semantic Sliding Window Chunking (approx 600 chars with 100 char overlap)
    const chunks = this.createSlidingWindowChunks(documentText, 600, 100);

    // 2. Query Relevance Ranking
    const rankedChunks = this.rankChunksByRelevance(chunks, query);
    const topChunks = rankedChunks.slice(0, maxChunks);

    // 3. Attach Untrusted Boundary & Citation Provenance
    const securedChunks = topChunks.map((c, i) => ({
      chunkIndex: c.index,
      citationTag: `[Ref: ${fileName}#Chunk-${c.index + 1}]`,
      relevanceScore: c.score,
      textPreview: c.text.substring(0, 120) + '...',
      safePayload: `<<<UNTRUSTED_DOCUMENT_DATA [Source: ${fileName}, Chunk: ${c.index + 1}]>>>\n${c.text}\n<<<END_UNTRUSTED_DOCUMENT_DATA>>>`
    }));

    return {
      fileName,
      totalDocumentLength: documentText.length,
      totalChunks: chunks.length,
      relevantChunksCount: securedChunks.length,
      relevantChunks: securedChunks,
      securityPolicy: 'UNTRUSTED_DOCUMENT_BOUNDARY_ENFORCED',
      latencyMs: Date.now() - startTime
    };
  }

  createSlidingWindowChunks(text, chunkSize = 600, overlap = 100) {
    const cleanText = text.replace(/\r\n/g, '\n');
    const chunks = [];
    let start = 0;
    let index = 0;

    while (start < cleanText.length) {
      const end = Math.min(start + chunkSize, cleanText.length);
      const chunkContent = cleanText.substring(start, end).trim();

      if (chunkContent.length > 20) {
        chunks.push({
          index,
          text: chunkContent,
          startOffset: start,
          endOffset: end
        });
        index++;
      }

      start += (chunkSize - overlap);
    }

    return chunks;
  }

  rankChunksByRelevance(chunks, query) {
    if (!query || !query.trim()) {
      return chunks.map(c => ({ ...c, score: 1.0 }));
    }

    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    return chunks
      .map(c => {
        const textLower = c.text.toLowerCase();
        let matchCount = 0;

        for (const kw of keywords) {
          const occurrences = (textLower.match(new RegExp(kw, 'g')) || []).length;
          matchCount += occurrences;
        }

        return {
          ...c,
          score: matchCount
        };
      })
      .sort((a, b) => b.score - a.score);
  }
}

export const documentIntelligenceToolInstance = new DocumentIntelligenceTool();
export default documentIntelligenceToolInstance;
