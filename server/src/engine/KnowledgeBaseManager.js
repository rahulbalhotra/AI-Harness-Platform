const fs = require('fs');
const path = require('path');

class KnowledgeBaseManager {
  constructor(db, modelRouter = null) {
    this.db = db;
    this.modelRouter = modelRouter;
    this.vocabulary = new Map(); // term -> docFreq
    this.totalDocsIndexed = 0;
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
      const tf = count / terms.length;
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

  cosineSimilarity(vecA, vecB) {
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
            // Find natural breakpoint (newline or period)
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

    return chunks;
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
      tags: Array.isArray(tags) ? tags : [tags],
      doc_metadata: metadata,
      chunk_count: rawChunks.length
    });

    const chunkRecords = rawChunks.map((chunkContent, idx) => {
      const embedding = this.computeTfIdfVector(chunkContent);
      return {
        id: `chunk_${docId}_${idx}`,
        document_id: docId,
        chunk_index: idx,
        content: chunkContent,
        embedding,
        token_count: Math.ceil(chunkContent.length / 4),
        metadata: {
          ...metadata,
          source,
          title: savedDoc.title,
          tags: savedDoc.tags
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

  async ingestFile(filePath, tags = []) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    let sourceType = 'code';
    if (['.md', '.markdown', '.txt'].includes(ext)) sourceType = 'markdown';
    else if (['.json', '.yaml', '.yml'].includes(ext)) sourceType = 'config';
    else if (['.sql'].includes(ext)) sourceType = 'sql';

    const detectedTags = [...tags, ext.replace('.', '')];
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

  // --- Semantic Search & RAG Retrieval ---

  async search(query, options = {}) {
    const {
      topK = 5,
      minScore = 0.08,
      tags = []
    } = options;

    if (!query || !query.trim()) return [];

    const queryVec = this.computeTfIdfVector(query);
    const allChunks = await this.db.getKnowledgeChunks();
    const allDocs = await this.db.getKnowledgeDocuments();
    const docMap = new Map(allDocs.map(d => [d.id, d]));

    const scored = [];

    for (const chunk of allChunks) {
      // Filter by tag if requested
      if (tags && tags.length > 0) {
        const chunkTags = chunk.metadata?.tags || [];
        const hasTag = tags.some(t => chunkTags.includes(t));
        if (!hasTag) continue;
      }

      const score = this.cosineSimilarity(queryVec, chunk.embedding);
      if (score >= minScore) {
        const parentDoc = docMap.get(chunk.document_id);
        scored.push({
          chunkId: chunk.id,
          documentId: chunk.document_id,
          documentTitle: parentDoc?.title || chunk.metadata?.title || 'Unknown',
          source: parentDoc?.source || chunk.metadata?.source || '',
          sourceType: parentDoc?.source_type || 'markdown',
          tags: parentDoc?.tags || chunk.metadata?.tags || [],
          content: chunk.content,
          score: Number(score.toFixed(4)),
          tokenCount: chunk.token_count
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  async buildRAGContext(query, maxTokens = 1200) {
    const results = await this.search(query, { topK: 4, minScore: 0.1 });
    if (!results || results.length === 0) return null;

    let totalTokens = 0;
    const snippets = [];

    for (const res of results) {
      if (totalTokens + res.tokenCount > maxTokens) break;
      snippets.push(
        `--- Knowledge Reference: ${res.documentTitle} (${res.source}) [Relevance: ${(res.score * 100).toFixed(0)}%] ---\n${res.content}`
      );
      totalTokens += res.tokenCount;
    }

    if (snippets.length === 0) return null;

    return `### 📚 Grounded Knowledge Base Context (RAG):\n${snippets.join('\n\n')}\n`;
  }
}

module.exports = KnowledgeBaseManager;
