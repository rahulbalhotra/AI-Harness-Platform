import React, { useState, useEffect } from 'react';
import { 
  Database, 
  History, 
  GitBranch, 
  RotateCcw, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  Table, 
  Users, 
  MessageSquare, 
  FileCode, 
  RefreshCw,
  Server,
  Layers,
  Check
} from 'lucide-react';
import { 
  getDbStatus, 
  updateDbConfig, 
  runDbQuery, 
  getFileVersions, 
  rollbackFileVersion,
  getUsers 
} from '../services/api';

export default function DatabaseVersioningHub() {
  const [dbStatus, setDbStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pgConnString, setPgConnString] = useState('');
  const [connTesting, setConnTesting] = useState(false);
  const [connResult, setConnResult] = useState(null);

  // Tabs: 'versioning' | 'tables' | 'sql'
  const [activeSubTab, setActiveSubTab] = useState('versioning');

  // Versioning state
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // SQL Console state
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM sessions LIMIT 10;');
  const [sqlRunning, setSqlRunning] = useState(false);
  const [sqlResult, setSqlResult] = useState(null);
  const [sqlError, setSqlError] = useState(null);

  // Table viewer state
  const [activeTable, setActiveTable] = useState('sessions');
  const [tableData, setTableData] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [status, verList] = await Promise.all([
        getDbStatus(),
        getFileVersions()
      ]);
      setDbStatus(status);
      setVersions(verList || []);
      if (status?.pgConnectionString) {
        setPgConnString(status.pgConnectionString);
      }
    } catch (err) {
      console.error('Failed to load DB & Versioning data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTestConnect = async (e) => {
    e.preventDefault();
    if (!pgConnString.trim()) return;
    try {
      setConnTesting(true);
      setConnResult(null);
      const res = await updateDbConfig(pgConnString);
      setConnResult(res);
      await loadData();
    } catch (err) {
      setConnResult({ success: false, error: err.message });
    } finally {
      setConnTesting(false);
    }
  };

  const handleRunSql = async () => {
    if (!sqlQuery.trim()) return;
    try {
      setSqlRunning(true);
      setSqlError(null);
      const res = await runDbQuery(sqlQuery);
      setSqlResult(res);
    } catch (err) {
      setSqlError(err.message);
      setSqlResult(null);
    } finally {
      setSqlRunning(false);
    }
  };

  const handleRollback = async (versionId) => {
    if (!window.confirm('Are you sure you want to revert the workspace file to this version snapshot?')) return;
    try {
      setRollingBack(true);
      const res = await rollbackFileVersion(versionId);
      setStatusMsg(res.message);
      setTimeout(() => setStatusMsg(null), 5000);
      await loadData();
    } catch (err) {
      alert('Rollback failed: ' + err.message);
    } finally {
      setRollingBack(false);
    }
  };

  const loadTableData = async (tbl) => {
    setActiveTable(tbl);
    try {
      const res = await runDbQuery(`SELECT * FROM ${tbl} LIMIT 25;`);
      setTableData(res.rows || []);
    } catch (err) {
      console.error('Failed to query table:', err);
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
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}>
              <Database size={20} color="#818cf8" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, margin: 0 }}>PostgreSQL & Versioning Hub</h1>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: dbStatus?.engine === 'postgres' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
              color: dbStatus?.engine === 'postgres' ? '#10b981' : '#818cf8',
              border: dbStatus?.engine === 'postgres' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)',
              fontWeight: 500
            }}>
              Engine: {dbStatus?.engine === 'postgres' ? 'Live PostgreSQL' : 'Embedded Relational (PostgreSQL-Compatible)'}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Persistent session history, user profiles, cryptographic code version snapshots, and rollback control.
          </p>
        </div>

        <button 
          onClick={loadData} 
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
        >
          <RefreshCw size={14} />
          Refresh Stats
        </button>
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

      {/* Database Connection & Table Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Table Stats Card */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Table size={16} color="#38bdf8" />
            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Relational Tables Status</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Users: </span>
              <strong style={{ color: '#fff' }}>{dbStatus?.tableStats?.users || 0}</strong>
            </div>
            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Sessions: </span>
              <strong style={{ color: '#fff' }}>{dbStatus?.tableStats?.sessions || 0}</strong>
            </div>
            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Messages: </span>
              <strong style={{ color: '#fff' }}>{dbStatus?.tableStats?.messages || 0}</strong>
            </div>
            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>File Versions: </span>
              <strong style={{ color: '#fff' }}>{dbStatus?.tableStats?.document_versions || 0}</strong>
            </div>
            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>RAG Docs: </span>
              <strong style={{ color: '#fff' }}>{dbStatus?.tableStats?.knowledge_documents || 0}</strong>
            </div>
            <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>RAG Chunks: </span>
              <strong style={{ color: '#fff' }}>{dbStatus?.tableStats?.knowledge_chunks || 0}</strong>
            </div>
          </div>
        </div>

        {/* PostgreSQL Config Card */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={16} color="#818cf8" />
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>PostgreSQL Connection</h3>
            </div>
            <span style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: dbStatus?.isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: dbStatus?.isConnected ? '#10b981' : '#f87171'
            }}>
              {dbStatus?.isConnected ? '● Connected' : '○ Standby'}
            </span>
          </div>

          <form onSubmit={handleTestConnect}>
            <input 
              type="text"
              value={pgConnString}
              onChange={(e) => setPgConnString(e.target.value)}
              placeholder="postgresql://user:password@localhost:5432/harness_db"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '12px',
                fontFamily: 'monospace',
                marginBottom: '10px'
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button 
                type="submit" 
                disabled={connTesting || !pgConnString.trim()}
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '5px 12px' }}
              >
                {connTesting ? 'Connecting...' : 'Connect & Migrate'}
              </button>
              {connResult && (
                <span style={{ fontSize: '11px', color: connResult.success ? '#10b981' : '#f87171' }}>
                  {connResult.success ? 'Connected!' : 'Fallback to Embedded'}
                </span>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '20px', gap: '8px' }}>
        <button
          onClick={() => setActiveSubTab('versioning')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'versioning' ? '2px solid #818cf8' : '2px solid transparent',
            color: activeSubTab === 'versioning' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <History size={15} />
          Code & Document Versioning ({versions.length})
        </button>

        <button
          onClick={() => { setActiveSubTab('tables'); loadTableData('sessions'); }}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'tables' ? '2px solid #818cf8' : '2px solid transparent',
            color: activeSubTab === 'tables' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Table size={15} />
          Relational Table Browser
        </button>

        <button
          onClick={() => setActiveSubTab('sql')}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'sql' ? '2px solid #818cf8' : '2px solid transparent',
            color: activeSubTab === 'sql' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <FileCode size={15} />
          Interactive SQL Console
        </button>
      </div>

      {/* SUB-TAB 1: Document Versioning */}
      {activeSubTab === 'versioning' && (
        <div>
          {versions.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              border: '1px dashed var(--border-subtle)'
            }}>
              <History size={36} color="var(--text-secondary)" style={{ marginBottom: '12px', opacity: 0.5 }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>No file versions recorded yet</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                When agents create or modify files (via write_file or replace_file_content), version snapshots with diffs will automatically appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {versions.map((ver) => (
                <div key={ver.id} style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(99, 102, 241, 0.2)',
                        color: '#a5b4fc',
                        fontWeight: 600
                      }}>
                        v{ver.version_number}
                      </span>
                      <strong style={{ fontSize: '13px', color: '#fff' }}>{ver.file_path}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        by {ver.created_by_agent}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {ver.change_summary} • {new Date(ver.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={() => setSelectedVersion(ver)}
                      className="btn btn-secondary"
                      style={{ fontSize: '12px', padding: '5px 12px' }}
                    >
                      View Diff
                    </button>
                    <button 
                      onClick={() => handleRollback(ver.id)}
                      disabled={rollingBack}
                      className="btn btn-primary"
                      style={{
                        fontSize: '12px',
                        padding: '5px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#dc2626'
                      }}
                    >
                      <RotateCcw size={12} />
                      Rollback to this Version
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: Relational Table Browser */}
      {activeSubTab === 'tables' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            {['sessions', 'users', 'messages', 'document_versions', 'knowledge_documents'].map((tbl) => (
              <button
                key={tbl}
                onClick={() => loadTableData(tbl)}
                className={activeTable === tbl ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                {tbl}
              </button>
            ))}
          </div>

          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            overflowX: 'auto',
            padding: '12px'
          }}>
            {tableData.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No records found in table '{activeTable}'.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: '#94a3b8' }}>
                    {Object.keys(tableData[0] || {}).map((col) => (
                      <th key={col} style={{ padding: '8px 10px', fontWeight: 600 }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {Object.entries(row).map(([k, val], cidx) => (
                        <td key={cidx} style={{
                          padding: '8px 10px',
                          maxWidth: '280px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: '#e2e8f0'
                        }}>
                          {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SQL Console */}
      {activeSubTab === 'sql' && (
        <div>
          <div style={{ marginBottom: '12px' }}>
            <textarea
              rows={4}
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="SELECT * FROM sessions LIMIT 10;"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '13px',
                fontFamily: 'monospace'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <button
              onClick={handleRunSql}
              disabled={sqlRunning || !sqlQuery.trim()}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Play size={14} />
              {sqlRunning ? 'Executing...' : 'Run Query'}
            </button>
            <button
              onClick={() => setSqlQuery('SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;')}
              className="btn btn-secondary"
              style={{ fontSize: '12px' }}
            >
              Recent Messages
            </button>
            <button
              onClick={() => setSqlQuery('SELECT * FROM document_versions ORDER BY version_number DESC;')}
              className="btn btn-secondary"
              style={{ fontSize: '12px' }}
            >
              Recent Versions
            </button>
          </div>

          {sqlError && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#f87171',
              fontSize: '13px',
              marginBottom: '16px'
            }}>
              Error: {sqlError}
            </div>
          )}

          {sqlResult && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '14px',
              overflowX: 'auto'
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Returned {sqlResult.rowCount || 0} row(s):
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: '#94a3b8' }}>
                    {(sqlResult.fields || Object.keys(sqlResult.rows?.[0] || {})).map((f) => (
                      <th key={f} style={{ padding: '8px 10px' }}>{f}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(sqlResult.rows || []).map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {Object.values(row).map((v, i) => (
                        <td key={i} style={{ padding: '8px 10px', color: '#e2e8f0' }}>
                          {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* View Diff Modal */}
      {selectedVersion && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '750px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
                  Version #{selectedVersion.version_number}: {selectedVersion.file_path}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {selectedVersion.change_summary} • {new Date(selectedVersion.created_at).toLocaleString()}
                </span>
              </div>
              <button 
                onClick={() => setSelectedVersion(null)}
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '4px 10px' }}
              >
                Close
              </button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>Diff / Changes:</div>
              <pre style={{
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#38bdf8',
                maxHeight: '160px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap'
              }}>
                {selectedVersion.diff_content || 'No diff content'}
              </pre>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>Full Content Snapshot:</div>
              <pre style={{
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#e2e8f0',
                maxHeight: '220px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap'
              }}>
                {selectedVersion.full_content || 'No content snapshot'}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button onClick={() => setSelectedVersion(null)} className="btn btn-secondary">
                Dismiss
              </button>
              <button 
                onClick={() => {
                  const id = selectedVersion.id;
                  setSelectedVersion(null);
                  handleRollback(id);
                }} 
                className="btn btn-primary"
                style={{ background: '#dc2626' }}
              >
                Rollback to this Version
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
