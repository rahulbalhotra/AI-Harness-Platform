import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Plus, 
  Trash2, 
  Key, 
  Zap, 
  DollarSign, 
  Clock, 
  Check, 
  Eye, 
  EyeOff, 
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Radio
} from 'lucide-react';
import { 
  addModel, 
  toggleModel, 
  deleteModel, 
  saveApiKey, 
  deleteApiKey, 
  getApiKeyDetails, 
  testModelConnection 
} from '../services/api';

export default function ModelHub({ models, onRefreshModels }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);

  // Connection testing states
  const [cardTestStatus, setCardTestStatus] = useState({});
  const [modalTestResult, setModalTestResult] = useState(null);

  // New model form
  const [newModel, setNewModel] = useState({
    id: '',
    name: '',
    provider: 'local',
    contextWindow: 128000,
    inputCostPerM: 1.0,
    outputCostPerM: 3.0,
    avgLatencyMs: 500,
    supportsTools: true,
    supportsVision: false,
    description: ''
  });

  // API Key state
  const [keyProvider, setKeyProvider] = useState('google');
  const [keyValue, setKeyValue] = useState('');
  const [azureEndpoint, setAzureEndpoint] = useState('');
  const [azureDeployment, setAzureDeployment] = useState('gpt-4o');
  const [azureApiVersion, setAzureApiVersion] = useState('2024-08-01-preview');
  const [keySaved, setKeySaved] = useState(false);
  const [keyDetails, setKeyDetails] = useState(null);

  const loadKeyDetails = async (provider) => {
    try {
      const details = await getApiKeyDetails(provider);
      setKeyDetails(details);
      if (provider === 'azureOpenAI' && details) {
        if (details.endpoint) setAzureEndpoint(details.endpoint);
        if (details.deployment) setAzureDeployment(details.deployment);
        if (details.apiVersion) setAzureApiVersion(details.apiVersion);
      }
    } catch (e) {
      console.warn('Failed to load key details:', e);
    }
  };

  useEffect(() => {
    if (showKeyModal) {
      loadKeyDetails(keyProvider);
    }
  }, [showKeyModal, keyProvider]);

  const handleDeleteKey = async () => {
    if (!confirm(`Are you sure you want to delete the saved key for ${keyProvider}?`)) return;
    try {
      await deleteApiKey(keyProvider);
      setKeyValue('');
      if (keyProvider === 'azureOpenAI') {
        setAzureEndpoint('');
        setAzureDeployment('gpt-4o');
      }
      setKeyDetails({ hasKey: false });
      onRefreshModels?.();
      alert(`API Key deleted successfully for ${keyProvider}.`);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCardTestConnection = async (model) => {
    const key = model.id;
    setCardTestStatus(prev => ({ ...prev, [key]: { loading: true } }));
    try {
      const result = await testModelConnection(model.provider);
      setCardTestStatus(prev => ({
        ...prev,
        [key]: {
          loading: false,
          success: result.success,
          message: result.message,
          latencyMs: result.latencyMs
        }
      }));
    } catch (err) {
      setCardTestStatus(prev => ({
        ...prev,
        [key]: {
          loading: false,
          success: false,
          message: err.message
        }
      }));
    }
  };

  const handleModalTestConnection = async () => {
    setModalTestResult({ loading: true });
    try {
      let config = null;
      if (keyProvider === 'azureOpenAI') {
        config = {
          key: keyValue,
          endpoint: azureEndpoint,
          deployment: azureDeployment,
          apiVersion: azureApiVersion
        };
      } else if (keyValue) {
        config = keyValue;
      }
      const result = await testModelConnection(keyProvider, config);
      setModalTestResult({
        loading: false,
        success: result.success,
        message: result.message,
        latencyMs: result.latencyMs
      });
    } catch (err) {
      setModalTestResult({
        loading: false,
        success: false,
        message: err.message
      });
    }
  };

  const handleToggle = async (modelId, currentEnabled) => {
    try {
      await toggleModel(modelId, !currentEnabled);
      onRefreshModels();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (modelId) => {
    if (!confirm('Are you sure you want to remove this model from the router?')) return;
    try {
      await deleteModel(modelId);
      onRefreshModels();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddModel = async (e) => {
    e.preventDefault();
    try {
      await addModel(newModel);
      onRefreshModels();
      setShowAddModal(false);
      setNewModel({
        id: '',
        name: '',
        provider: 'local',
        contextWindow: 128000,
        inputCostPerM: 1.0,
        outputCostPerM: 3.0,
        avgLatencyMs: 500,
        supportsTools: true,
        supportsVision: false,
        description: ''
      });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveKey = async (e) => {
    e.preventDefault();
    try {
      if (keyProvider === 'azureOpenAI') {
        await saveApiKey('azureOpenAI', {
          key: keyValue,
          endpoint: azureEndpoint,
          deployment: azureDeployment,
          apiVersion: azureApiVersion
        });
      } else {
        await saveApiKey(keyProvider, keyValue);
      }
      setKeySaved(true);
      setTimeout(() => {
        setKeySaved(false);
        setShowKeyModal(false);
        setKeyValue('');
      }, 1200);
    } catch (err) {
      alert(err.message);
    }
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
            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)'
          }}>
            <Cpu size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Model Hub & Intelligent Router
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Manage foundation models, configure fallback chains, benchmark latency, and store API keys.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowKeyModal(true)}
          >
            <Key size={14} /> Configure API Keys
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={14} /> Add Model Provider
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '18px'
        }}>
          {models.map(model => (
            <div
              key={model.id}
              className="glass-panel"
              style={{
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                border: '1px solid',
                borderColor: model.enabled ? 'var(--border-subtle)' : 'rgba(255, 255, 255, 0.03)',
                opacity: model.enabled ? 1 : 0.6
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {model.name}
                    </h3>
                    {model.isDefault && (
                      <span className="badge badge-indigo">Default</span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {model.id} &bull; <span style={{ textTransform: 'capitalize' }}>{model.provider}</span>
                  </div>
                </div>

                {/* Toggle & Delete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => handleToggle(model.id, model.enabled)}
                    className={model.enabled ? 'btn btn-success' : 'btn btn-secondary'}
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                  >
                    {model.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  {!model.isDefault && (
                    <button
                      onClick={() => handleDelete(model.id)}
                      title="Remove Model"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-rose)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Description */}
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {model.description}
              </p>

              {/* Metrics Matrix */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '10px',
                borderRadius: '8px'
              }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Layers size={10} /> Context
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {(model.contextWindow / 1000).toFixed(0)}k tokens
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Clock size={10} /> Latency
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-cyan)', marginTop: '2px' }}>
                    ~{model.avgLatencyMs}ms
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <DollarSign size={10} /> Cost/1M
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-emerald)', marginTop: '2px' }}>
                    ${model.inputCostPerM} / ${model.outputCostPerM}
                  </div>
                </div>
              </div>

              {/* Capabilities */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {model.supportsTools && <span className="badge badge-cyan">Tools / Function Calling</span>}
                {model.supportsVision && <span className="badge badge-indigo">Vision Support</span>}
              </div>

              {/* Live Connection Test */}
              <div style={{
                marginTop: 'auto',
                paddingTop: '10px',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    onClick={() => handleCardTestConnection(model)}
                    disabled={cardTestStatus[model.id]?.loading}
                    className="btn btn-secondary"
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <RefreshCw size={11} className={cardTestStatus[model.id]?.loading ? 'animate-spin' : ''} />
                    {cardTestStatus[model.id]?.loading ? 'Testing...' : 'Test Connection'}
                  </button>

                  {cardTestStatus[model.id] && !cardTestStatus[model.id].loading && (
                    cardTestStatus[model.id].success ? (
                      <span className="badge badge-emerald" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                        <CheckCircle2 size={11} /> Connected ({cardTestStatus[model.id].latencyMs}ms)
                      </span>
                    ) : (
                      <span className="badge badge-rose" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                        <AlertTriangle size={11} /> Failed
                      </span>
                    )
                  )}
                </div>

                {cardTestStatus[model.id] && !cardTestStatus[model.id].loading && !cardTestStatus[model.id].success && (
                  <div style={{ fontSize: '10px', color: 'var(--accent-rose)', lineHeight: '1.3', wordBreak: 'break-word' }}>
                    {cardTestStatus[model.id].message}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Add Model */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <form onSubmit={handleAddModel} className="glass-panel-elevated animate-fade-in" style={{
            width: '100%',
            maxWidth: '540px',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Register Custom Model Endpoint
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Model ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ollama/mistral-large"
                  value={newModel.id}
                  onChange={(e) => setNewModel({ ...newModel, id: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mistral Large 2"
                  value={newModel.name}
                  onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Provider
                </label>
                <select
                  value={newModel.provider}
                  onChange={(e) => setNewModel({ ...newModel, provider: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="google">Google Cloud / Vertex</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="azure">Azure OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="ollama">Ollama (Local)</option>
                  <option value="vllm">vLLM / HuggingFace</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Context Window (Tokens)
                </label>
                <input
                  type="number"
                  value={newModel.contextWindow}
                  onChange={(e) => setNewModel({ ...newModel, contextWindow: +e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Description
              </label>
              <textarea
                rows={2}
                placeholder="Model use-cases, specialization..."
                value={newModel.description}
                onChange={(e) => setNewModel({ ...newModel, description: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Add Model
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: API Keys */}
      {showKeyModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <form onSubmit={handleSaveKey} className="glass-panel-elevated animate-fade-in" style={{
            width: '100%',
            maxWidth: '520px',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Configure Provider API Keys & Endpoints
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Credentials are saved persistently to disk and will remain active across engine restarts unless changed or deleted.
            </p>

            {keyDetails?.hasKey && (
              <div style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid var(--accent-emerald)',
                fontSize: '11px',
                color: 'var(--accent-emerald)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <CheckCircle2 size={13} />
                <span>Saved Persistent Key: <code>{keyDetails.maskedKey}</code></span>
              </div>
            )}

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Provider
              </label>
              <select
                value={keyProvider}
                onChange={(e) => setKeyProvider(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="google">Google Gemini / Vertex AI</option>
                <option value="azureOpenAI">Azure OpenAI Service</option>
                <option value="anthropic">Anthropic Claude</option>
                <option value="openai">OpenAI Official</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                API Secret Key *
              </label>
              <input
                type="password"
                required
                placeholder={keyProvider === 'azureOpenAI' ? 'Azure API Key (from Azure Portal Keys & Endpoint)...' : 'sk-...'}
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {keyProvider === 'azureOpenAI' && (
              <>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Azure OpenAI Endpoint URL *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://your-resource-name.openai.azure.com/"
                    value={azureEndpoint}
                    onChange={(e) => setAzureEndpoint(e.target.value)}
                    style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Deployment Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. gpt-4o or gpt-4"
                      value={azureDeployment}
                      onChange={(e) => setAzureDeployment(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      API Version
                    </label>
                    <input
                      type="text"
                      placeholder="2024-08-01-preview"
                      value={azureApiVersion}
                      onChange={(e) => setAzureApiVersion(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </>
            )}


            {/* Real-time Connection Test Status in Modal */}
            {modalTestResult && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid',
                backgroundColor: modalTestResult.loading 
                  ? 'rgba(59, 130, 246, 0.1)' 
                  : modalTestResult.success 
                    ? 'rgba(16, 185, 129, 0.12)' 
                    : 'rgba(244, 63, 94, 0.12)',
                borderColor: modalTestResult.loading 
                  ? 'var(--accent-blue)' 
                  : modalTestResult.success 
                    ? 'var(--accent-emerald)' 
                    : 'var(--accent-rose)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}>
                {modalTestResult.loading ? (
                  <RefreshCw size={18} color="var(--accent-blue)" className="animate-spin" style={{ flexShrink: 0, marginTop: '2px' }} />
                ) : modalTestResult.success ? (
                  <CheckCircle2 size={18} color="var(--accent-emerald)" style={{ flexShrink: 0, marginTop: '2px' }} />
                ) : (
                  <AlertTriangle size={18} color="var(--accent-rose)" style={{ flexShrink: 0, marginTop: '2px' }} />
                )}
                <div>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: modalTestResult.loading 
                      ? 'var(--text-primary)' 
                      : modalTestResult.success 
                        ? 'var(--accent-emerald)' 
                        : 'var(--accent-rose)'
                  }}>
                    {modalTestResult.loading 
                      ? 'Testing connection...' 
                      : modalTestResult.success 
                        ? `Connection Established! (${modalTestResult.latencyMs}ms latency)` 
                        : 'Connection Handshake Failed'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {modalTestResult.message || 'Provider API ping completed.'}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleModalTestConnection}
                disabled={modalTestResult?.loading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Radio size={14} color="var(--accent-cyan)" />
                {modalTestResult?.loading ? 'Pinging Endpoint...' : 'Test Connection'}
              </button>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {keyDetails?.hasKey && (
                  <button
                    type="button"
                    onClick={handleDeleteKey}
                    className="btn btn-secondary"
                    style={{ color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.4)' }}
                    title="Delete saved persistent key"
                  >
                    <Trash2 size={13} /> Delete Key
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowKeyModal(false);
                    setModalTestResult(null);
                  }}
                >
                  Close
                </button>
                <button type="submit" className="btn btn-primary">
                  {keySaved ? <><Check size={14} /> Saved!</> : 'Save Key'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
