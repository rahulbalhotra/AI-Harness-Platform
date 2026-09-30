import React, { useState, useEffect } from 'react';
import { 
  FolderTree, 
  FileCode, 
  Folder, 
  File, 
  Save, 
  RefreshCw, 
  ChevronRight, 
  ChevronDown,
  Check
} from 'lucide-react';
import { getWorkspaceFiles, readWorkspaceFile, saveWorkspaceFile } from '../services/api';

export default function WorkspaceExplorer() {
  const [fileTree, setFileTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState('package.json');
  const [fileContent, setFileContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadTree = async () => {
    try {
      const data = await getWorkspaceFiles();
      setFileTree(data.tree || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadFile = async (path) => {
    try {
      setSelectedFile(path);
      const data = await readWorkspaceFile(path);
      // Strip line number prefixes if returned
      const clean = (data.content || '').split('\n').map(l => l.replace(/^\d+:\s/, '')).join('\n');
      setFileContent(clean);
    } catch (e) {
      setFileContent('// Error loading file: ' + e.message);
    }
  };

  useEffect(() => {
    loadTree();
    loadFile('package.json');
  }, []);

  const handleSave = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      await saveWorkspaceFile(selectedFile, fileContent);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1500);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const renderTreeNodes = (nodes, depth = 0) => {
    return nodes.map((node) => {
      const isDir = node.isDirectory;
      const isSelected = selectedFile === node.path;

      return (
        <div key={node.path || node.name} style={{ marginLeft: `${depth * 12}px` }}>
          <div
            onClick={() => isDir ? null : loadFile(node.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: isDir ? 'default' : 'pointer',
              background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              color: isSelected ? '#a5b4fc' : isDir ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
            onMouseEnter={(e) => {
              if (!isSelected && !isDir) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            }}
            onMouseLeave={(e) => {
              if (!isSelected && !isDir) e.currentTarget.style.background = 'transparent';
            }}
          >
            {isDir ? <Folder size={14} color="var(--accent-indigo)" /> : <FileCode size={14} color="var(--accent-cyan)" />}
            <span style={{ fontFamily: 'var(--font-mono)' }}>{node.name}</span>
          </div>

          {isDir && node.children && renderTreeNodes(node.children, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(15, 20, 32, 0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FolderTree size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Workspace Code & Diff Canvas
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Inspect and edit project files modified by the autonomous SDLC agents.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={loadTree}>
            <RefreshCw size={13} /> Refresh Tree
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {saveSuccess ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save File</>}
          </button>
        </div>
      </div>

      {/* Editor & Tree Canvas */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr', overflow: 'hidden' }}>
        {/* Tree panel */}
        <div style={{
          borderRight: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          padding: '14px',
          overflowY: 'auto'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
            Explorer
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {renderTreeNodes(fileTree)}
          </div>
        </div>

        {/* Code Canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#070a10' }}>
          {/* File Tab */}
          <div style={{
            height: '34px',
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent-cyan)'
          }}>
            {selectedFile}
          </div>

          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            style={{
              flex: 1,
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 0,
              padding: '16px',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              lineHeight: '1.6',
              color: '#e2e8f0',
              resize: 'none',
              outline: 'none'
            }}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
