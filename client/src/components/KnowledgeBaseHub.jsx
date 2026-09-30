import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Trash2, 
  FileText, 
  FolderPlus, 
  CheckCircle, 
  Sparkles, 
  RefreshCw, 
  Tag, 
  Layers, 
  Database,
  ExternalLink,
  Code
} from 'lucide-react';
import { 
  getKnowledgeDocuments, 
  createKnowledgeDocument, 
  deleteKnowledgeDocument, 
  searchKnowledgeBase, 
  ingestWorkspaceFile,
  ingestWorkspaceDefaults 
} from '../services/api';

export default function KnowledgeBaseHub() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStats, setSearchStats] = useState(null);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('architecture, specs');
  const [filePathToIngest, setFilePathToIngest] = useState('README.md');
  const [fileTags, setFileTags] = useState('workspace, overview');
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await getKnowledgeDocuments();
      setDocuments(docs || []);
    } catch (err) {
      console.error('Failed to load knowledge documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      const res = await searchKnowledgeBase(searchQuery, 6);
      setSearchResults(res.results || []);
      setSearchStats({
        count: res.resultsCount || 0,
        query: res.query
      });
    } catch (err) {
      console.error('RAG Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddDocument = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    try {
      setSubmitting(true);
      const tags = newTags.split(',').map(t => t.trim()).filter(Boolean);
      await createKnowledgeDocument({
        title: newTitle,
        content: newContent,
        tags,
        source: 'manual_entry'
      });
      setShowAddModal(false);
      setNewTitle('');
      setNewContent('');
      setStatusMsg('Document ingested successfully into RAG vector store!');
      setTimeout(() => setStatusMsg(null), 4000);
      await loadDocuments();
    } catch (err) {
      alert('Error ingesting document: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleIngestFile = async (e) => {
    e.preventDefault();
    if (!filePathToIngest.trim()) return;
    try {
      setSubmitting(true);
      const tags = fileTags.split(',').map(t => t.trim()).filter(Boolean);
      await ingestWorkspaceFile(filePathToIngest, tags);
      setShowFileModal(false);
      setStatusMsg(`File '${filePathToIngest}' indexed successfully!`);
      setTimeout(() => setStatusMsg(null), 4000);
      await loadDocuments();
    } catch (err) {
      alert('Error indexing file: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleIngestDefaults = async () => {
    try {
      setSubmitting(true);
      const res = await ingestWorkspaceDefaults();
      setStatusMsg(`Auto-indexed ${res.ingestedCount} repository files into RAG store.`);
      setTimeout(() => setStatusMsg(null), 4000);
      await loadDocuments();
    } catch (err) {
      alert('Failed to auto-index workspace: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to remove this document from the knowledge base?')) return;
    try {
      await deleteKnowledgeDocument(docId);
      await loadDocuments();
      if (searchResults.length > 0) {
        setSearchResults(searchResults.filter(r => r.documentId !== docId));
      }
    } catch (err) {
      alert('Failed to delete document: ' + err.message);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <BookOpen size={20} color="#3b82f6" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, margin: 0 }}>Knowledge Base & RAG Engine</h1>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontWeight: 500
            }}>
              Hybrid Vector Store Active
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Semantic document ingestion, vector chunking, and grounded context augmentation for Willow and autonomous agents.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleIngestDefaults}
            disabled={submitting}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <Sparkles size={14} color="#60a5fa" />
            Auto-Index Workspace
          </button>
          <button 
            onClick={() => setShowFileModal(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <FolderPlus size={14} />
            Index File
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <Plus size={14} />
            Add Document
          </button>
        </div>
      </div>

      {statusMsg && (
        <div style={{
          padding: '10px 16px',
          marginBottom: '20px',
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '8px',
          color: '#34d399',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={16} />
          {statusMsg}
        </div>
      )}

      {/* RAG Semantic Search Section */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '28px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={16} color="#38bdf8" />
            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Semantic Vector RAG Retrieval Tester</h3>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            TF-IDF & Cosine Similarity Ranking
          </span>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Test a query e.g. 'How does Willow orchestrate parallel agents with AutoGen?'"
              style={{
                width: '100%',
                padding: '10px 14px 10px 36px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '13px'
              }}
            />
            <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
          </div>
          <button 
            type="submit" 
            disabled={isSearching || !searchQuery.trim()} 
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isSearching ? <RefreshCw size={14} className="spin" /> : <Search size={14} />}
            Retrieve Context
          </button>
        </form>

        {/* Search Results Preview */}
        {searchResults.length > 0 && (
          <div style={{ marginTop: '18px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Found {searchStats?.count} relevant chunk(s) for query "{searchStats?.query}":
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '12px' }}>
              {searchResults.map((res, i) => (
                <div key={i} style={{
                  padding: '12px 14px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '8px',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#93c5fd' }}>
                      📄 {res.documentTitle}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#34d399',
                      fontWeight: 600
                    }}>
                      {(res.score * 100).toFixed(1)}% match
                    </span>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#e2e8f0',
                    lineHeight: '1.5',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    background: 'rgba(0, 0, 0, 0.25)',
                    padding: '8px',
                    borderRadius: '4px'
                  }}>
                    {res.content}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {(res.tags || []).map((t, tidx) => (
                      <span key={tidx} style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-secondary)'
                      }}>
                        #{t}
                      </span>
                    ))}
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      ~{res.tokenCount} tokens
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ingested Documents Grid */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
            Indexed Documents ({documents.length})
          </h2>
          <button 
            onClick={loadDocuments} 
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 10px' }}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading knowledge base index...
          </div>
        ) : documents.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px dashed var(--border-subtle)'
          }}>
            <BookOpen size={36} color="var(--text-secondary)" style={{ marginBottom: '12px', opacity: 0.5 }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>No documents in knowledge base yet</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Index your repository README, technical specifications, or design RFCs to give agents grounded context.
            </p>
            <button onClick={handleIngestDefaults} className="btn btn-primary" style={{ fontSize: '13px' }}>
              <Sparkles size={14} style={{ marginRight: '6px' }} />
              Auto-Index Workspace README
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {documents.map((doc) => (
              <div key={doc.id} style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.2s'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={18} color="#60a5fa" />
                      <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{doc.title}</h4>
                    </div>
                    <button 
                      onClick={() => handleDelete(doc.id)}
                      title="Delete document"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      <Trash2 size={14} color="#f87171" />
                    </button>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', wordBreak: 'break-all' }}>
                    Source: {doc.source}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {(doc.tags || []).map((t, idx) => (
                      <span key={idx} style={{
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: '#60a5fa',
                        border: '1px solid rgba(59, 130, 246, 0.2)'
                      }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '10px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Layers size={12} />
                    {doc.chunk_count || 1} Chunks
                  </span>
                  <span>
                    Indexed: {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Document Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '600px', width: '90%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>Add Knowledge Document</h3>
            <form onSubmit={handleAddDocument}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Document Title
                </label>
                <input 
                  type="text" 
                  value={newTitle} 
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. System Authentication Architecture RFC"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Tags (comma separated)
                </label>
                <input 
                  type="text" 
                  value={newTags} 
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="e.g. auth, rfc, security"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Markdown / Text Content
                </label>
                <textarea 
                  rows={8}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Paste architectural specification, API design, or requirements..."
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '13px',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Indexing...' : 'Ingest & Index'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Index File Modal */}
      {showFileModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '500px', width: '90%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>Index Workspace File</h3>
            <form onSubmit={handleIngestFile}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Workspace Relative File Path
                </label>
                <input 
                  type="text" 
                  value={filePathToIngest} 
                  onChange={(e) => setFilePathToIngest(e.target.value)}
                  placeholder="e.g. README.md or client/src/App.jsx"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Tags (comma separated)
                </label>
                <input 
                  type="text" 
                  value={fileTags} 
                  onChange={(e) => setFileTags(e.target.value)}
                  placeholder="e.g. codebase, frontend"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowFileModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Indexing...' : 'Index File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
