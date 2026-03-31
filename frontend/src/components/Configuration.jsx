import { useState, useEffect } from 'react';

const CLASSIFICATION_METRICS = ['Accuracy', 'F1 Score', 'Precision', 'Recall'];
const REGRESSION_METRICS = ['MSE', 'RMSE', 'MAE', 'R2 Score', 'Explained Variance', 'Max Error'];
const CLUSTERING_METRICS = ['Silhouette Score', 'Davies-Bouldin Index', 'Calinski-Harabasz Index'];

export default function Configuration({ dataInfo, onTrainResults, isTraining, setIsTraining, splitConfig, setSplitConfig }) {
  const [targetColumn, setTargetColumn] = useState(dataInfo.columns[dataInfo.columns.length - 1]);
  const [taskType, setTaskType] = useState('classification');
  
  const [availableModelsInfo, setAvailableModelsInfo] = useState({});
  const [selectedModel, setSelectedModel] = useState('');
  const [modelParams, setModelParams] = useState({});
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  
  const [selectedMetrics, setSelectedMetrics] = useState(CLASSIFICATION_METRICS);
  const [error, setError] = useState(null);
  
  const [tuningMethod, setTuningMethod] = useState('Bayesian Optimization');
  const [isTuning, setIsTuning] = useState(false);

  // Fetch models whenever taskType changes
  useEffect(() => {
    const fetchModels = async () => {
      setAvailableModelsInfo({});
      try {
        const response = await fetch(`http://localhost:8000/api/v1/models/${taskType}`);
        if (response.ok) {
          const data = await response.json();
          setAvailableModelsInfo(data.models);
          
          const modelNames = Object.keys(data.models);
          if (modelNames.length > 0) {
            const defaultModel = modelNames.includes('RandomForestClassifier') ? 'RandomForestClassifier' : modelNames[0];
            setSelectedModel(defaultModel);
          }
        }
      } catch (err) {
        console.error("Failed to fetch models", err);
      }
    };
    fetchModels();

    if (taskType === 'clustering') setSelectedMetrics(CLUSTERING_METRICS);
    else if (taskType === 'regression') setSelectedMetrics(REGRESSION_METRICS);
    else setSelectedMetrics(CLASSIFICATION_METRICS);
  }, [taskType]);

  // When selectedModel changes, reset initialized form params
  useEffect(() => {
    if (selectedModel && availableModelsInfo[selectedModel]) {
      const initialParams = {};
      Object.entries(availableModelsInfo[selectedModel]).forEach(([key, info]) => {
        initialParams[key] = info.default;
      });
      setModelParams(initialParams);
    } else {
      setModelParams({});
    }
  }, [selectedModel, availableModelsInfo]);

  const toggleMetric = (metric) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]
    );
  };

  const handleParamChange = (paramName, value) => {
    setModelParams(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const tuneHyperparameters = async () => {
    if (!selectedModel) {
      setError("Please select an algorithm to tune.");
      return;
    }

    setIsTuning(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/v1/tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: dataInfo.dataset_id,
          target_column: targetColumn,
          task_type: taskType,
          model_name: selectedModel,
          tuning_method: tuningMethod,
          preprocessing_config: splitConfig
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to tune hyperparameters.');
      }

      const data = await response.json();
      
      setModelParams(prev => ({ ...prev, ...data.best_params }));
      setShowAdvancedParams(true);
      setError("Changes saved! Hyperparameters successfully tuned to optimal configuration using " + tuningMethod + " 🚀");
      setTimeout(() => setError(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsTuning(false);
    }
  };

  const startTraining = async () => {
    if (!selectedModel) {
      setError("Please select an algorithm.");
      return;
    }
    if (selectedMetrics.length === 0) {
      setError("Please select at least one evaluation metric.");
      return;
    }

    setIsTraining(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/v1/train', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataset_id: dataInfo.dataset_id,
          target_column: targetColumn,
          task_type: taskType,
          model_name: selectedModel,
          model_params: modelParams,
          selected_metrics: selectedMetrics,
          preprocessing_config: splitConfig
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Execution failed: ${errData.detail || 'Server error'}`);
      }
      
      const newRun = await response.json();
      onTrainResults(newRun);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsTraining(false);
    }
  };

  const isClustering = taskType === 'clustering';
  const availableMetrics = isClustering ? CLUSTERING_METRICS : (taskType === 'regression' ? REGRESSION_METRICS : CLASSIFICATION_METRICS);

  return (
    <div className="glass-panel" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Configure Experiment</h2>

      {!isClustering && (
        <div className="select-wrapper" style={{ marginBottom: '1rem' }}>
          <label className="label">Target Variable</label>
          <select 
            className="select-input"
            value={targetColumn} 
            onChange={(e) => setTargetColumn(e.target.value)}
            disabled={isTraining}
          >
            {dataInfo.columns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>
      )}

      <div className="select-wrapper" style={{ marginBottom: '1rem' }}>
        <label className="label">Problem Type</label>
        <select 
          className="select-input"
          value={taskType} 
          onChange={(e) => setTaskType(e.target.value)}
          disabled={isTraining}
        >
          <option value="classification">Classification</option>
          <option value="regression">Regression</option>
          <option value="clustering">Clustering (Unsupervised)</option>
        </select>
      </div>

      <div className="select-wrapper" style={{ marginBottom: '1rem' }}>
        <label className="label">Algorithm</label>
        <select 
          className="select-input"
          value={selectedModel} 
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={isTraining}
        >
          {Object.keys(availableModelsInfo).map(modelName => (
            <option key={modelName} value={modelName}>{modelName}</option>
          ))}
        </select>
      </div>

      <div style={{ flex: 1, marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingRight: '0.5rem' }}>
      
        {/* Train Test Split Configuration */}
        {splitConfig && (
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#f8fafc', marginBottom: '0.75rem' }}>Train/Test Split Configuration</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Test Set Size (Holdout)</span>
                      <span style={{ color: '#38bdf8' }}>{Math.round(splitConfig.test_size * 100)}%</span>
                    </label>
                    <input 
                      type="range" min="0.05" max="0.5" step="0.05"
                      value={splitConfig.test_size || 0.2}
                      onChange={(e) => setSplitConfig(prev => ({...prev, test_size: parseFloat(e.target.value)}))}
                      style={{ width: '100%', accentColor: '#38bdf8' }}
                      disabled={isTraining}
                    />
                  </div>
                  <div>
                    <label className="label">Random State (Seed)</label>
                    <input 
                      type="number" className="select-input"
                      value={splitConfig.random_state || 42}
                      onChange={(e) => setSplitConfig(prev => ({...prev, random_state: parseInt(e.target.value, 10)}))}
                      disabled={isTraining}
                      style={{ maxWidth: '120px' }}
                    />
                  </div>
              </div>
            </div>
        )}

        
        {/* Hyperparameters Section */}
        {Object.keys(modelParams).length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Auto-Tuning Dashboard Array */}
            <div style={{ paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
               <label className="label" style={{ marginBottom: '0.5rem', color: '#c084fc' }}>Auto-Tune Hyperparameters ⚡</label>
               <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                  <select 
                     className="select-input" 
                     value={tuningMethod} 
                     onChange={(e) => setTuningMethod(e.target.value)}
                     disabled={isTraining || isTuning}
                     style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }}
                  >
                     <option value="Bayesian Optimization">Bayesian Optimization (Optuna)</option>
                     <option value="Hyperband">Hyperband (Successive Halving)</option>
                     <option value="Random Search">Random Grid Search</option>
                  </select>
                  
                  <button 
                     className="btn" 
                     onClick={tuneHyperparameters}
                     disabled={isTraining || isTuning}
                     style={{ padding: '0 1rem', background: isTuning ? 'rgba(192, 132, 252, 0.4)' : '#c084fc', color: '#fff', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                  >
                     {isTuning ? "Tuning ✨" : "Start Tuning"}
                  </button>
               </div>
               <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>* Tries up to 15 intelligent parameter variations to automatically find the best possible accuracy.</p>
            </div>

            <div 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setShowAdvancedParams(!showAdvancedParams)}
            >
              <label className="label" style={{ margin: 0, color: 'var(--primary-color)', cursor: 'pointer' }}>
                Advanced Hyperparameters ⚙️
              </label>
              <span style={{ color: 'var(--text-secondary)' }}>{showAdvancedParams ? '▲' : '▼'}</span>
            </div>
            
            {showAdvancedParams && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                {Object.entries(availableModelsInfo[selectedModel] || {}).map(([paramName, paramInfo]) => {
                  if (paramInfo.type === 'boolean') {
                    return (
                      <div key={paramName} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input 
                          type="checkbox" 
                          checked={modelParams[paramName] === true}
                          onChange={(e) => handleParamChange(paramName, e.target.checked)}
                          disabled={isTraining}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--primary-color)' }}
                        />
                        <span style={{ fontSize: '0.85rem' }}>{paramName}</span>
                      </div>
                    );
                  }
                  if (paramInfo.choices && Array.isArray(paramInfo.choices)) {
                    return (
                        <div key={paramName} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{paramName}</span>
                          <select 
                            value={modelParams[paramName] === null ? "" : modelParams[paramName]}
                            onChange={(e) => handleParamChange(paramName, e.target.value)}
                            disabled={isTraining}
                            className="select-input"
                            style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                          >
                             <option value="">{paramInfo.default === "" || paramInfo.default === null ? "Default" : paramInfo.default}</option>
                             {paramInfo.choices.map(choice => (
                               <option key={choice} value={choice}>{choice}</option>
                             ))}
                          </select>
                        </div>
                    );
                  }
                  
                  return (
                    <div key={paramName} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{paramName} ({paramInfo.type})</span>
                      <input 
                        type={paramInfo.type === 'string' ? "text" : "number"}
                        step={paramInfo.type === 'float' ? "any" : "1"}
                        value={modelParams[paramName] === null ? "" : modelParams[paramName]}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (val !== "" && paramInfo.type === 'int') val = parseInt(val, 10);
                          if (val !== "" && paramInfo.type === 'float') val = parseFloat(val);
                          handleParamChange(paramName, val);
                        }}
                        disabled={isTraining}
                        className="select-input"
                        style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="label" style={{ marginBottom: '0.5rem' }}>Evaluation Metrics</label>
          <div className="custom-multi-select">
            {availableMetrics.map(metric => {
              const isSelected = selectedMetrics.includes(metric);
              return (
                <div 
                  key={metric} 
                  className={`select-item ${isSelected ? 'selected' : ''} ${isTraining ? 'disabled' : ''}`}
                  onClick={() => !isTraining && toggleMetric(metric)}
                >
                  {metric}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <button 
        className="btn" 
        onClick={startTraining}
        disabled={isTraining || !selectedModel}
        style={{ width: '100%', padding: '1rem', marginTop: 'auto' }}
      >
        {isTraining ? "Running..." : "Run Experiment 🚀"}
      </button>

      {error && <div style={{ color: '#ef4444', marginTop: '1rem', fontSize: '0.85rem' }}>{error}</div>}
    </div>
  );
}
