const fs = require('fs');
const path = require('path');
let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (_) {
  pdfParse = null;
}

class KnowledgeBaseManager {
  constructor(db, modelRouter = null) {
    this.db = db;
    this.modelRouter = modelRouter;
    this.vocabulary = new Map(); // term -> docFreq
    this.totalDocsIndexed = 0;
    this.vectorDimensions = 384; // Matches pgvector vector(384)
    this.isInitialized = false;

    this.init();
  }

  async init() {
    await this.rebuildIndex();
    this.isInitialized = true;
  }

  async rebuildIndex() {
    const chunks = await this.db.getKnowledgeChunks();
    this.totalDocsIndexed = chunks.length;
    this.vocabulary.clear();

    for (const chunk of chunks) {
      const terms = new Set(this.tokenize(chunk.content));
      for (const term of terms) {
        this.vocabulary.set(term, (this.vocabulary.get(term) || 0) + 1);
      }
    }
  }

  tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && w.length < 35);
  }

  computeTfIdfVector(text) {
    const terms = this.tokenize(text);
    const termCounts = new Map();
    for (const term of terms) {
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
    }

    const vector = {};
    let magnitudeSq = 0;

    for (const [term, count] of termCounts.entries()) {
      const tf = count / Math.max(terms.length, 1);
      const df = this.vocabulary.get(term) || 1;
      const idf = Math.log(1 + (Math.max(this.totalDocsIndexed, 1) / df));
      const tfIdf = tf * idf;
      vector[term] = tfIdf;
      magnitudeSq += tfIdf * tfIdf;
    }

    // Normalize
    const magnitude = Math.sqrt(magnitudeSq) || 1;
    for (const term in vector) {
      vector[term] = Number((vector[term] / magnitude).toFixed(5));
    }

    return vector;
  }

  /**
   * Generates a normalized 384-dimensional dense embedding vector compatible with PostgreSQL pgvector `vector(384)`.
   * Uses feature-hashing with signed projections and character n-gram enrichment for resilient semantic matching.
   */
  computeDensePgVector(text) {
    const dims = this.vectorDimensions;
    const vec = new Array(dims).fill(0);
    const terms = this.tokenize(text);
    if (terms.length === 0) return vec;

    const hashStr = (str, seed = 2166136261) => {
      let h = seed;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    };

    for (let i = 0; i < terms.length; i++) {
      const term = terms[i];
      const df = this.vocabulary.get(term) || 1;
      const weight = 1 + Math.log(1 + (Math.max(this.totalDocsIndexed, 1) / df));

      const h1 = hashStr(term, 2166136261);
      const h2 = hashStr(term, 1469598103);
      const idx = h1 % dims;
      const sign = (h2 & 1) === 0 ? 1 : -1;
      vec[idx] += sign * weight;

      // Bigram feature projection
      if (i + 1 < terms.length) {
        const bigram = `${term}_${terms[i + 1]}`;
        const hb1 = hashStr(bigram, 314159265);
        const hb2 = hashStr(bigram, 271828182);
        vec[hb1 % dims] += ((hb2 & 1) === 0 ? 1 : -1) * (weight * 0.65);
      }
    }

    // L2 normalize to unit hypersphere for pgvector `<=>` cosine distance
    let magSq = 0;
    for (let d = 0; d < dims; d++) {
      magSq += vec[d] * vec[d];
    }
    const mag = Math.sqrt(magSq) || 1;
    for (let d = 0; d < dims; d++) {
      vec[d] = Number((vec[d] / mag).toFixed(5));
    }
    return vec;
  }

  cosineSimilaritySparse(vecA, vecB) {
    if (!vecA || !vecB) return 0;
    let dot = 0;
    const keysA = Object.keys(vecA);
    for (const k of keysA) {
      if (vecB[k]) {
        dot += vecA[k] * vecB[k];
      }
    }
    return Math.max(0, Math.min(1, dot));
  }

  cosineSimilarityDense(vecA, vecB) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) return 0;
    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
    }
    return Math.max(0, Math.min(1, dot));
  }

  // --- Chunking Engine ---

  chunkText(text, options = {}) {
    const {
      maxChunkChars = 1200,
      overlapChars = 150
    } = options;

    const chunks = [];
    if (!text || text.trim().length === 0) return chunks;

    // Split by major sections (markdown headers or function/class markers)
    const sections = text.split(/(?=\n#{1,4}\s|\nclass\s|\nfunction\s|\nexport\s)/g);

    for (const section of sections) {
      const cleanSection = section.trim();
      if (!cleanSection) continue;

      if (cleanSection.length <= maxChunkChars) {
        chunks.push(cleanSection);
      } else {
        // Split section by paragraphs or lines with overlap
        let start = 0;
        while (start < cleanSection.length) {
          let end = start + maxChunkChars;
          if (end < cleanSection.length) {
            const breakPoint = cleanSection.lastIndexOf('\n', end);
            if (breakPoint > start + (maxChunkChars * 0.5)) {
              end = breakPoint;
            }
          }
          const chunkStr = cleanSection.substring(start, end).trim();
          if (chunkStr.length > 30) {
            chunks.push(chunkStr);
          }
          start = end - overlapChars;
          if (start >= cleanSection.length - 30) break;
        }
      }
    }

    if (chunks.length === 0 && text.trim().length > 0) {
      chunks.push(text.trim());
    }

    return chunks;
  }

  // --- Multi-Format Extraction Pipeline (PDF, Markdown, Code, JSON, CSV, TXT) ---

  async extractContentFromUpload({ fileName, mimeType = '', base64Data = '', textContent = '' }) {
    const ext = path.extname(fileName || '').toLowerCase();

    // Direct text provided
    if (textContent && textContent.trim().length > 0) {
      return {
        text: textContent,
        sourceType: this.detectSourceType(ext, mimeType),
        pageCount: 1
      };
    }

    if (!base64Data) {
      throw new Error(`No content or file payload provided for ${fileName || 'uploaded file'}`);
    }

    // Strip data URL prefix if present (e.g., data:application/pdf;base64,...)
    const cleanBase64 = base64Data.includes(',')
      ? base64Data.split(',')[1]
      : base64Data;
    const buffer = Buffer.from(cleanBase64, 'base64');

    // Handle PDF extraction
    if (ext === '.pdf' || (mimeType && mimeType.toLowerCase().includes('pdf'))) {
      if (pdfParse) {
        try {
          const parsed = await pdfParse(buffer);
          const extractedText = (parsed.text || '').trim();
          if (extractedText.length > 0) {
            return {
              text: extractedText,
              sourceType: 'pdf',
              pageCount: parsed.numpages || 1,
              pdfInfo: parsed.info || {}
            };
          }
        } catch (pdfErr) {
          console.warn('[KnowledgeBaseManager] pdf-parse warning, falling back to stream parser:', pdfErr.message);
        }
      }
      // Fallback PDF text stream extractor if pdf-parse encounters encrypted/custom streams
      const rawLatin = buffer.toString('latin1');
      const textMatches = [];
      const regex = /\(([^()\\]{3,})\)/g;
      let match;
      while ((match = regex.exec(rawLatin)) !== null) {
        const printable = match[1].replace(/[^\x20-\x7E\n\r\t]/g, '').trim();
        if (printable.length > 3) textMatches.push(printable);
      }
      const fallbackText = textMatches.join(' ').trim() || buffer.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').trim();
      return {
        text: fallbackText || `PDF Document: ${fileName}`,
        sourceType: 'pdf',
        pageCount: 1
      };
    }

    // Plain text / Markdown / JSON / CSV / Source Code
    const utf8Text = buffer.toString('utf8');
    return {
      text: utf8Text,
      sourceType: this.detectSourceType(ext, mimeType),
      pageCount: 1
    };
  }

  detectSourceType(ext, mimeType = '') {
    if (ext === '.pdf' || mimeType.includes('pdf')) return 'pdf';
    if (['.md', '.markdown'].includes(ext)) return 'markdown';
    if (['.txt', '.log'].includes(ext)) return 'text';
    if (['.csv', '.tsv'].includes(ext)) return 'csv';
    if (['.json', '.yaml', '.yml', '.xml'].includes(ext)) return 'config';
    if (['.sql'].includes(ext)) return 'sql';
    return 'code';
  }

  // --- Ingestion API ---

  async ingestDocument({ title, content, source = 'manual', sourceType = 'markdown', tags = [], metadata = {} }) {
    if (!content || !content.trim()) {
      throw new Error('Document content cannot be empty');
    }

    const rawChunks = this.chunkText(content);
    const docId = `kdoc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const savedDoc = await this.db.saveKnowledgeDocument({
      id: docId,
      title: title || path.basename(source) || 'Untitled Document',
      source,
      source_type: sourceType,
      full_content: content,
      tags: Array.isArray(tags) ? tags : [tags],
      doc_metadata: {
        ...metadata,
        vectorEngine: this.db.pgVectorEnabled ? 'pgvector_hnsw_384' : 'hybrid_pgvector_384',
        dimensions: this.vectorDimensions,
        sizeChars: content.length
      },
      chunk_count: rawChunks.length
    });

    const chunkRecords = rawChunks.map((chunkContent, idx) => {
      const sparseEmbedding = this.computeTfIdfVector(chunkContent);
      const denseVector = this.computeDensePgVector(`${savedDoc.title}\n${chunkContent}`);
      return {
        id: `chunk_${docId}_${idx}`,
        document_id: docId,
        chunk_index: idx,
        content: chunkContent,
        embedding: sparseEmbedding,
        embedding_vector: denseVector,
        token_count: Math.ceil(chunkContent.length / 4),
        metadata: {
          ...metadata,
          source,
          sourceType,
          title: savedDoc.title,
          tags: savedDoc.tags,
          chunkIndex: idx,
          totalChunks: rawChunks.length
        },
        created_at: new Date().toISOString()
      };
    });

    await this.db.saveKnowledgeChunks(chunkRecords);
    await this.rebuildIndex();

    return {
      document: savedDoc,
      chunkCount: chunkRecords.length
    };
  }

  async ingestUploadedDocument({ fileName, mimeType, base64Data, textContent, title, tags = [] }) {
    const extracted = await this.extractContentFromUpload({
      fileName,
      mimeType,
      base64Data,
      textContent
    });

    const ext = path.extname(fileName || '').toLowerCase().replace('.', '');
    const mergedTags = Array.from(new Set([
      ...(Array.isArray(tags) ? tags : String(tags || '').split(',').map(t => t.trim()).filter(Boolean)),
      extracted.sourceType,
      ext || 'document',
      'uploaded'
    ]));

    return this.ingestDocument({
      title: title || fileName || 'Uploaded Document',
      content: extracted.text,
      source: `upload://${fileName || 'document'}`,
      sourceType: extracted.sourceType,
      tags: mergedTags,
      metadata: {
        originalFileName: fileName,
        mimeType: mimeType || 'application/octet-stream',
        pageCount: extracted.pageCount || 1,
        ingestedVia: 'knowledge_hub_pipeline'
      }
    });
  }

  async ingestFile(filePath, tags = []) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') {
      const buf = fs.readFileSync(filePath);
      return this.ingestUploadedDocument({
        fileName: path.basename(filePath),
        mimeType: 'application/pdf',
        base64Data: buf.toString('base64'),
        title: path.basename(filePath),
        tags
      });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const sourceType = this.detectSourceType(ext);

    const detectedTags = [...tags, ext.replace('.', '')].filter(Boolean);
    if (filePath.toLowerCase().includes('readme')) detectedTags.push('readme', 'architecture');
    if (filePath.toLowerCase().includes('test')) detectedTags.push('test');

    return this.ingestDocument({
      title: path.basename(filePath),
      content,
      source: filePath,
      sourceType,
      tags: Array.from(new Set(detectedTags)),
      metadata: {
        absolutePath: path.resolve(filePath),
        sizeBytes: content.length,
        lines: content.split('\n').length
      }
    });
  }

  async getDocumentWithContent(docId) {
    return this.db.getKnowledgeDocumentById(docId);
  }

  // --- Hybrid pgvector & Semantic RAG Retrieval ---

  async search(query, options = {}) {
    const {
      topK = 5,
      minScore = 0.06,
      tags = []
    } = options;

    if (!query || !query.trim()) return [];

    const querySparseVec = this.computeTfIdfVector(query);
    const queryDenseVec = this.computeDensePgVector(query);

    // 1. If native PostgreSQL pgvector is active, try native HNSW cosine search first
    const pgVecRows = await this.db.searchPgVector(queryDenseVec, topK * 2);
    if (pgVecRows && pgVecRows.length > 0) {
      const results = pgVecRows
        .map(row => {
          const sparseScore = this.cosineSimilaritySparse(querySparseVec, row.embedding);
          const hybridScore = Number(((Number(row.cosine_score || 0) * 0.6) + (sparseScore * 0.4)).toFixed(4));
          return {
            chunkId: row.id,
            chunkIndex: row.chunk_index,
            documentId: row.document_id,
            documentTitle: row.document_title || row.metadata?.title || 'Unknown',
            source: row.document_source || row.metadata?.source || '',
            sourceType: row.source_type || row.metadata?.sourceType || 'markdown',
            tags: row.document_tags || row.metadata?.tags || [],
            content: row.content,
            score: Math.max(hybridScore, Number(row.cosine_score || 0)),
            vectorEngine: 'pgvector',
            tokenCount: row.token_count
          };
        })
        .filter(r => r.score >= minScore);
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, topK);
    }

    // 2. Hybrid Dense Vector(384) + Sparse TF-IDF Cosine Ranking
    const allChunks = await this.db.getKnowledgeChunks();
    const allDocs = await this.db.getKnowledgeDocuments();
    const docMap = new Map(allDocs.map(d => [d.id, d]));

    const queryLower = query.toLowerCase();
    const scored = [];

    for (const chunk of allChunks) {
      const parentDoc = docMap.get(chunk.document_id);
      if (tags && tags.length > 0) {
        const chunkTags = parentDoc?.tags || chunk.metadata?.tags || [];
        const hasTag = tags.some(t => chunkTags.includes(t));
        if (!hasTag) continue;
      }

      const sparseScore = this.cosineSimilaritySparse(querySparseVec, chunk.embedding);
      const denseScore = Array.isArray(chunk.embedding_vector)
        ? this.cosineSimilarityDense(queryDenseVec, chunk.embedding_vector)
        : sparseScore;

      // Title match boost if user mentions document title keywords
      const docTitle = (parentDoc?.title || chunk.metadata?.title || '').toLowerCase();
      let titleBoost = 0;
      for (const term of this.tokenize(queryLower)) {
        if (docTitle.includes(term)) titleBoost += 0.08;
      }

      const combinedScore = Math.min(0.99, (sparseScore * 0.65) + (denseScore * 0.35) + Math.min(titleBoost, 0.24));

      if (combinedScore >= minScore) {
        scored.push({
          chunkId: chunk.id,
          chunkIndex: chunk.chunk_index,
          documentId: chunk.document_id,
          documentTitle: parentDoc?.title || chunk.metadata?.title || 'Unknown',
          source: parentDoc?.source || chunk.metadata?.source || '',
          sourceType: parentDoc?.source_type || chunk.metadata?.sourceType || 'markdown',
          tags: parentDoc?.tags || chunk.metadata?.tags || [],
          content: chunk.content,
          score: Number(combinedScore.toFixed(4)),
          vectorEngine: this.db.pgVectorEnabled ? 'pgvector' : 'pgvector_hybrid_384',
          tokenCount: chunk.token_count
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Builds grounded RAG context AND returns structured citations so the Chat Assistant
   * and RAG Agent can explicitly display which Knowledge Hub documents were referenced.
   */
  async retrieveWithCitations(query, maxTokens = 1400) {
    const results = await this.search(query, { topK: 5, minScore: 0.08 });
    if (!results || results.length === 0) {
      return { contextText: null, citations: [] };
    }

    let totalTokens = 0;
    const snippets = [];
    const citationsMap = new Map();

    for (const res of results) {
      if (totalTokens + res.tokenCount > maxTokens) break;
      snippets.push(
        `--- [Knowledge Hub Document: "${res.documentTitle}" | DocID: ${res.documentId} | Source: ${res.source} | Match: ${(res.score * 100).toFixed(0)}%] ---\n${res.content}`
      );
      totalTokens += res.tokenCount;

      if (!citationsMap.has(res.documentId)) {
        citationsMap.set(res.documentId, {
          documentId: res.documentId,
          title: res.documentTitle,
          source: res.source,
          sourceType: res.sourceType || 'markdown',
          score: res.score,
          vectorEngine: res.vectorEngine || 'pgvector_hybrid_384',
          matchedChunks: 1,
          previewSnippet: res.content.substring(0, 220)
        });
      } else {
        const existing = citationsMap.get(res.documentId);
        existing.matchedChunks += 1;
        if (res.score > existing.score) existing.score = res.score;
      }
    }

    if (snippets.length === 0) {
      return { contextText: null, citations: [] };
    }

    const citations = Array.from(citationsMap.values());
    const citationListStr = citations.map(c => `"${c.title}" (${c.source})`).join(', ');

    const contextText = [
      `### 📚 Grounded Knowledge Hub Context (pgvector RAG):`,
      `Retrieved from Knowledge Hub documents: ${citationListStr}.`,
      `IMPORTANT: When answering, explicitly cite the document title(s) (${citationListStr}) that you retrieved this information from.`,
      ``,
      snippets.join('\n\n')
    ].join('\n');

    return {
      contextText,
      citations
    };
  }

  async buildRAGContext(query, maxTokens = 1400) {
    const { contextText } = await this.retrieveWithCitations(query, maxTokens);
    return contextText;
  }
}

module.exports = KnowledgeBaseManager;
