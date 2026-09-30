import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  FileText, 
  FolderPlus, 
  CheckCircle, 
  Sparkles, 
  RefreshCw, 
  Layers, 
  Database,
  Upload,
  Eye,
  X,
  FileCode,
  Cpu,
  ChevronRight,
  Copy,
  Check
} from 'lucide-react';
import { 
  getKnowledgeDocuments, 
  getKnowledgeDocumentById,
  uploadKnowledgeDocuments,
  createKnowledgeDocument, 
  deleteKnowledgeDocument, 
  ingestWorkspaceFile,
  ingestWorkspaceDefaults 
} from '../services/api';

export default function KnowledgeBaseHub() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Upload & Pipeline state
  const [isDragging, setIsDragging] = useState(false);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [uploadTags, setUploadTags] = useState('pdf, specification, knowledge-hub');
  const [pipelineStage, setPipelineStage] = useState(null); // 'extracting' | 'chunking' | 'embedding' | null
  const fileInputRef = useRef(null);

  // Right Pane Document Reader state
  const [viewingDoc, setViewingDoc] = useState(null);
  const [loadingViewer, setLoadingViewer] = useState(false);
  const [viewerTab, setViewerTab] = useState('full'); // 'full' | 'chunks'
  const [copiedContent, setCopiedContent] = useState(false);

  // Manual & Workspace File Modals
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

  // Read dropped or selected files into base64 / text payloads
  const processSelectedFiles = async (fileList) => {
    const filesArray = Array.from(fileList || []);
    if (filesArray.length === 0) return;

    const processed = await Promise.all(
      filesArray.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            const isTextLike =
              file.type.startsWith('text/') ||
              /\.(md|markdown|txt|json|csv|tsv|yaml|yml|sql|js|jsx|ts|tsx|py|html|css)$/i.test(file.name);

            reader.onload = (ev) => {
              const resultStr = ev.target.result || '';
              resolve({
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                sizeBytes: file.size,
                base64Data: !isTextLike ? resultStr : '',
                textContent: isTextLike ? resultStr : ''
              });
            };
            if (isTextLike) {
              reader.readAsText(file);
            } else {
              reader.readAsDataURL(file);
            }
          })
      )
    );

    setStagedFiles((prev) => [...prev, ...processed]);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files?.length > 0) {
      await processSelectedFiles(e.dataTransfer.files);
    }
  };

  const handleRunIngestionPipeline = async () => {
    if (stagedFiles.length === 0) return;
    try {
      setSubmitting(true);
      setPipelineStage('extracting');
      await new Promise((r) => setTimeout(r, 250));
      setPipelineStage('chunking');
      await new Promise((r) => setTimeout(r, 250));
      setPipelineStage('embedding');

      const tags = uploadTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await uploadKnowledgeDocuments(stagedFiles, tags);
      setStagedFiles([]);
      setPipelineStage(null);
      setStatusMsg(
        `Ingested ${res.ingestedCount} document(s) into the pgvector Knowledge Hub! Click any tile below to open it in the right-hand reader pane.`
      );
      setTimeout(() => setStatusMsg(null), 5000);
      await loadDocuments();
      if (res.results?.[0]?.document) {
        handleOpenDocumentViewer(res.results[0].document);
      }
    } catch (err) {
      setPipelineStage(null);
      alert('Ingestion pipeline error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDocumentViewer = async (doc) => {
    try {
      setLoadingViewer(true);
      setViewerTab('full');
      setViewingDoc({ ...doc, full_content: 'Loading document content...', chunks: [] });
      const detailed = await getKnowledgeDocumentById(doc.id);
      setViewingDoc(detailed);
    } catch (err) {
      alert('Failed to open document: ' + err.message);
      setViewingDoc(null);
    } finally {
      setLoadingViewer(false);
    }
  };

  const handleCopyContent = () => {
    if (!viewingDoc?.full_content) return;
    navigator.clipboard.writeText(viewingDoc.full_content);
    setCopiedContent(true);
    setTimeout(() => setCopiedContent(false), 2000);
  };

  const handleAddDocument = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    try {
      setSubmitting(true);
      const tags = newTags.split(',').map((t) => t.trim()).filter(Boolean);
      const created = await createKnowledgeDocument({
        title: newTitle,
        content: newContent,
        tags,
        source: 'manual_entry'
      });
      setShowAddModal(false);
      setNewTitle('');
      setNewContent('');
      setStatusMsg('Document ingested and indexed with 384-dim pgvector embeddings!');
      setTimeout(() => setStatusMsg(null), 4000);
      await loadDocuments();
      if (created?.document) {
        handleOpenDocumentViewer(created.document);
      }
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
      const tags = fileTags.split(',').map((t) => t.trim()).filter(Boolean);
      const res = await ingestWorkspaceFile(filePathToIngest, tags);
      setShowFileModal(false);
      setStatusMsg(`Workspace file '${filePathToIngest}' indexed into pgvector store!`);
      setTimeout(() => setStatusMsg(null), 4000);
      await loadDocuments();
      if (res?.document) {
        handleOpenDocumentViewer(res.document);
      }
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
      setStatusMsg(`Auto-indexed ${res.ingestedCount} repository files into pgvector RAG store.`);
      setTimeout(() => setStatusMsg(null), 4000);
      await loadDocuments();
    } catch (err) {
      alert('Failed to auto-index workspace: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (docId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to remove this document from the Knowledge Hub?')) return;
    try {
      await deleteKnowledgeDocument(docId);
      if (viewingDoc && viewingDoc.id === docId) {
        setViewingDoc(null);
      }
      await loadDocuments();
    } catch (err) {
      alert('Failed to delete document: ' + err.message);
    }
  };

  const totalChunks = documents.reduce((acc, d) => acc + (d.chunk_count || 1), 0);

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 48px)',
      width: '100%',
      overflow: 'hidden',
      color: 'var(--text-primary)'
    }}>
      {/* LEFT / MAIN WORKSPACE PANE */}
      <div style={{
        flex: viewingDoc ? '1 1 54%' : '1 1 100%',
        overflowY: 'auto',
        padding: '24px 28px',
        transition: 'flex 0.25s ease'
      }}>
        {/* Top Banner */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
              <h1 style={{ fontSize: '21px', fontWeight: 600, margin: 0 }}>Knowledge Hub & pgvector Ingestion Pipeline</h1>
              <span style={{
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontWeight: 600
              }}>
                pgvector (384-dim Cosine HNSW) Active
              </span>
              <span style={{
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: '12px',
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#c4b5fd',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                fontWeight: 600
              }}>
                📚 RAG Specialist Agent Connected
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>
              Upload PDFs, PRDs, Markdown, SQL, or code files. Click any document tile below to open and read its content in the right-hand inspector pane.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              onClick={handleIngestDefaults}
              disabled={submitting}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
            >
              <Sparkles size={14} color="#60a5fa" />
              Auto-Index Workspace
            </button>
            <button 
              onClick={() => setShowFileModal(true)}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
            >
              <FolderPlus size={14} />
              Index Repo File
            </button>
            <button 
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
            >
              <Plus size={14} />
              Write / Paste Document
            </button>
          </div>
        </div>

        {statusMsg && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '18px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
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

        {/* Document & PDF Ingestion Pipeline Dropzone */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: isDragging ? '2px dashed #38bdf8' : '1px solid var(--border-subtle)',
          borderRadius: '14px',
          padding: '18px 20px',
          marginBottom: '24px',
          boxShadow: '0 8px 26px rgba(0, 0, 0, 0.18)',
          transition: 'all 0.2s ease'
        }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
        onDrop={handleDrop}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Upload size={18} color="#38bdf8" />
              <div>
                <h3 style={{ fontSize: '14.5px', fontWeight: 600, margin: 0 }}>Document & PDF Ingestion Pipeline</h3>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Stage 1: Multi-Format Parser (PDF, MD, TXT, JSON, CSV, SQL) → Stage 2: Semantic Chunking → Stage 3: pgvector(384) Indexing
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Database size={13} color="#38bdf8" />
                <strong>{documents.length}</strong> Documents
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Layers size={13} color="#a78bfa" />
                <strong>{totalChunks}</strong> pgvector Chunks
              </span>
            </div>
          </div>

          {/* Dropzone Box */}
          <div
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{
              border: '1.5px dashed rgba(56, 189, 248, 0.35)',
              borderRadius: '10px',
              padding: '18px',
              textAlign: 'center',
              background: isDragging ? 'rgba(56, 189, 248, 0.08)' : 'rgba(15, 23, 42, 0.45)',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.md,.markdown,.txt,.json,.csv,.tsv,.yaml,.yml,.sql,.py,.js,.jsx,.ts,.tsx,.html,.css"
              style={{ display: 'none' }}
              onChange={(e) => processSelectedFiles(e.target.files)}
            />
            <Upload size={24} color="#38bdf8" style={{ marginBottom: '6px', opacity: 0.9 }} />
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc', marginBottom: '3px' }}>
              Drag & drop PDFs, Architecture Docs, Markdown, CSV, or Code files here — or click to browse
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              Supports <code>.pdf</code>, <code>.md</code>, <code>.txt</code>, <code>.json</code>, <code>.csv</code>, <code>.sql</code>, and source files.
            </div>
          </div>

          {/* Staged Files Queue & Pipeline Trigger */}
          {stagedFiles.length > 0 && (
            <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#bae6fd', marginBottom: '8px' }}>
                Staged for Ingestion ({stagedFiles.length} file{stagedFiles.length > 1 ? 's' : ''}):
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {stagedFiles.map((f, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: 'rgba(30, 41, 59, 0.9)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    fontSize: '12px'
                  }}>
                    <FileText size={13} color="#38bdf8" />
                    <span style={{ fontWeight: 500, color: '#f8fafc' }}>{f.fileName}</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>({(f.sizeBytes / 1024).toFixed(1)} KB)</span>
                    <button
                      type="button"
                      onClick={() => setStagedFiles(stagedFiles.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <input
                    type="text"
                    value={uploadTags}
                    onChange={(e) => setUploadTags(e.target.value)}
                    placeholder="Pipeline tags (comma separated): e.g. pdf, prd, architecture"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-subtle)',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleRunIngestionPipeline}
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '8px 14px' }}
                >
                  {submitting ? <RefreshCw size={14} className="spin" /> : <Cpu size={14} />}
                  {pipelineStage === 'extracting' && '1/3 Extracting Document & PDF Text...'}
                  {pipelineStage === 'chunking' && '2/3 Splitting Semantic Chunks...'}
                  {pipelineStage === 'embedding' && '3/3 Computing pgvector(384) Embeddings...'}
                  {!pipelineStage && 'Run Ingestion Pipeline & Index into pgvector'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Ingested Documents Clickable Tiles Grid */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '15.5px', fontWeight: 600, margin: 0 }}>
              Indexed Knowledge Hub Documents ({documents.length}) — Click Any Tile to Open in Right Pane
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
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>No documents in Knowledge Hub yet</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Upload a PDF or document above, or auto-index your repository README to give Willow and the RAG Specialist Agent grounded context.
              </p>
              <button onClick={handleIngestDefaults} className="btn btn-primary" style={{ fontSize: '13px' }}>
                <Sparkles size={14} style={{ marginRight: '6px' }} />
                Auto-Index Workspace README
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: viewingDoc ? 'repeat(auto-fill, minmax(290px, 1fr))' : 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '14px'
            }}>
              {documents.map((doc) => {
                const isSelected = viewingDoc && viewingDoc.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => handleOpenDocumentViewer(doc)}
                    style={{
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.14) 0%, rgba(15, 23, 42, 0.95) 100%)'
                        : 'var(--bg-secondary)',
                      border: isSelected
                        ? '1.5px solid #38bdf8'
                        : '1px solid var(--border-subtle)',
                      boxShadow: isSelected
                        ? '0 0 0 1px rgba(56, 189, 248, 0.25), 0 8px 24px rgba(0, 0, 0, 0.35)'
                        : '0 4px 14px rgba(0, 0, 0, 0.15)',
                      borderRadius: '11px',
                      padding: '15px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={18} color={doc.source_type === 'pdf' ? '#f43f5e' : (isSelected ? '#38bdf8' : '#60a5fa')} />
                          <h4 style={{ fontSize: '13.5px', fontWeight: 600, margin: 0, color: '#f8fafc', lineHeight: 1.35 }}>
                            {doc.title}
                          </h4>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <span style={{
                            fontSize: '10px',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: doc.source_type === 'pdf' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(56, 189, 248, 0.12)',
                            color: doc.source_type === 'pdf' ? '#fb7185' : '#38bdf8',
                            fontWeight: 600,
                            textTransform: 'uppercase'
                          }}>
                            {doc.source_type || 'doc'}
                          </span>
                          <button 
                            onClick={(e) => handleDelete(doc.id, e)}
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
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', wordBreak: 'break-all' }}>
                        Source: <code>{doc.source}</code>
                      </div>

                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {(doc.tags || []).slice(0, 5).map((t, idx) => (
                          <span key={idx} style={{
                            fontSize: '10px',
                            padding: '2px 7px',
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
                      paddingTop: '9px',
                      fontSize: '11px',
                      color: isSelected ? '#38bdf8' : 'var(--text-secondary)'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Layers size={12} color="#a78bfa" />
                        {doc.chunk_count || 1} pgvector Chunks
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600, color: isSelected ? '#38bdf8' : '#93c5fd' }}>
                        <Eye size={12} />
                        {isSelected ? 'Viewing in Right Pane' : 'Open Document'}
                        <ChevronRight size={13} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SLIDE-OVER DOCUMENT READER PANE */}
      {viewingDoc && (
        <div style={{
          width: '46%',
          minWidth: '420px',
          maxWidth: '720px',
          height: '100%',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(9, 13, 22, 0.99) 100%)',
          borderLeft: '1px solid rgba(56, 189, 248, 0.3)',
          boxShadow: '-12px 0 32px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 20
        }}>
          {/* Right Pane Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(30, 41, 59, 0.55)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                <FileText size={17} color="#38bdf8" />
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#f8fafc', wordBreak: 'break-word' }}>
                  {viewingDoc.title}
                </h3>
                <span className="badge badge-cyan" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                  {viewingDoc.source_type || 'markdown'}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <span>ID: <code style={{ color: '#bae6fd' }}>{viewingDoc.id}</code></span>
                <span>Source: <code style={{ color: '#bae6fd' }}>{viewingDoc.source}</code></span>
                <span>Chunks: <strong style={{ color: '#c4b5fd' }}>{viewingDoc.chunks?.length || viewingDoc.chunk_count || 1}</strong></span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleCopyContent}
                className="btn btn-secondary"
                style={{ padding: '5px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Copy full document text"
              >
                {copiedContent ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                {copiedContent ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => setViewingDoc(null)}
                className="btn btn-secondary"
                style={{ padding: '5px 9px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                title="Close right reader pane"
              >
                <X size={14} /> Close
              </button>
            </div>
          </div>

          {/* Right Pane View Mode Tabs */}
          <div style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.7)'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setViewerTab('full')}
                className={viewerTab === 'full' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ fontSize: '11.5px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <FileCode size={13} /> Document Content
              </button>
              <button
                type="button"
                onClick={() => setViewerTab('chunks')}
                className={viewerTab === 'chunks' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ fontSize: '11.5px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Layers size={13} /> pgvector Chunks ({viewingDoc.chunks?.length || viewingDoc.chunk_count || 0})
              </button>
            </div>

            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {(viewingDoc.full_content || '').length.toLocaleString()} chars
            </span>
          </div>

          {/* Right Pane Scrollable Document Content Body */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '18px 20px'
          }}>
            {loadingViewer ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                Loading document content & pgvector chunks...
              </div>
            ) : viewerTab === 'full' ? (
              <div style={{
                background: 'rgba(2, 6, 23, 0.75)',
                border: '1px solid rgba(148, 163, 184, 0.16)',
                borderRadius: '10px',
                padding: '16px 18px'
              }}>
                <pre style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: '12.5px',
                  lineHeight: 1.65,
                  color: '#e2e8f0',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                }}>
                  {viewingDoc.full_content || 'No text content available.'}
                </pre>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(viewingDoc.chunks || []).map((chunk, idx) => (
                  <div key={chunk.id || idx} style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(30, 41, 59, 0.55)',
                    border: '1px solid rgba(56, 189, 248, 0.22)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px', color: '#93c5fd' }}>
                      <span><strong>Chunk #{chunk.chunk_index ?? idx}</strong> ({chunk.id})</span>
                      <span>~{chunk.token_count || Math.ceil((chunk.content || '').length / 4)} tokens • 384-dim pgvector</span>
                    </div>
                    <pre style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: '12px',
                      lineHeight: 1.55,
                      color: '#e2e8f0',
                      fontFamily: 'monospace'
                    }}>
                      {chunk.content}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Write / Paste Document Modal */}
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

      {/* Index Workspace File Modal */}
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
                  placeholder="e.g. README.md or docs/amazon-clone-architecture-prd.md"
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
