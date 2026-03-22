import { useState, useEffect } from 'react';

const CLASSIFICATION_MODELS = ['Logistic Regression', 'Random Forest', 'Gradient Boosting', 'AdaBoost', 'Bagging', 'Voting Ensemble', 'Stacking Ensemble', 'SVM', 'K-Nearest Neighbors', 'Decision Tree', 'Naive Bayes'];
const REGRESSION_MODELS = ['Linear Regression', 'Ridge Regression', 'Lasso Regression', 'Random Forest', 'Gradient Boosting', 'AdaBoost', 'Bagging', 'Voting Ensemble', 'Stacking Ensemble', 'SVR', 'K-Nearest Neighbors', 'Decision Tree'];
const CLUSTERING_MODELS = ['K-Means', 'DBSCAN', 'Hierarchical (Agglomerative)'];
const CLASSIFICATION_METRICS = ['Accuracy', 'F1 Score', 'Precision', 'Recall'];
const REGRESSION_METRICS = ['MSE', 'RMSE', 'MAE', 'R2 Score', 'Explained Variance', 'Max Error'];
const CLUSTERING_METRICS = ['Silhouette Score', 'Davies-Bouldin Index', 'Calinski-Harabasz Index'];

export default function Configuration({ dataInfo, onTrainResults, isTraining, setIsTraining }) {
  const [targetColumn, setTargetColumn] = useState(dataInfo.columns[dataInfo.columns.length - 1]);
  const [taskType, setTaskType] = useState('auto');
  const [selectedModels, setSelectedModels] = useState([]);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [error, setError] = useState(null);

  // Default selection based on task type
  useEffect(() => {
    if (taskType === 'clustering') {
       setSelectedModels(CLUSTERING_MODELS);
       setSelectedMetrics(CLUSTERING_METRICS);
    } else if (taskType === 'regression' || (taskType === 'auto' && dataInfo.num_rows > 100)) {
       setSelectedModels(REGRESSION_MODELS);
       setSelectedMetrics(REGRESSION_METRICS);
    } else {
       setSelectedModels(CLASSIFICATION_MODELS);
       setSelectedMetrics(CLASSIFICATION_METRICS);
    }
  }, [taskType, dataInfo.num_rows]);

  const toggleModel = (model) => {
    setSelectedModels(prev => 
      prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]
    );
  };

  const toggleMetric = (metric) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]
    );
  };

  const startTraining = async () => {
    if (selectedModels.length === 0) {
      setError("Please select at least one algorithm.");
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
          selected_models: selectedModels,
          selected_metrics: selectedMetrics
        }),
      });

      if (!response.ok) {
        throw new Error('Training failed to execute.');
      }
      
      const results = await response.json();
      onTrainResults(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsTraining(false);
    }
  };

  const isClustering = taskType === 'clustering';
  const availableModels = isClustering ? CLUSTERING_MODELS : ((taskType === 'regression' || (taskType === 'auto' && dataInfo.num_rows > 100)) ? REGRESSION_MODELS : CLASSIFICATION_MODELS);
  const availableMetrics = isClustering ? CLUSTERING_METRICS : ((taskType === 'regression' || (taskType === 'auto' && dataInfo.num_rows > 100)) ? REGRESSION_METRICS : CLASSIFICATION_METRICS);

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Configuration</h2>

      <div className="select-wrapper">
        <label className="label">Target Variable {isClustering && <span style={{fontSize: '0.8rem', color: '#888'}}>(Ignored for Clustering)</span>}</label>
        <select 
          className="select-input"
          value={targetColumn} 
          onChange={(e) => setTargetColumn(e.target.value)}
          disabled={isTraining || isClustering}
        >
          {dataInfo.columns.map(col => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </div>

      <div className="select-wrapper">
        <label className="label">Problem Type</label>
        <select 
          className="select-input"
          value={taskType} 
          onChange={(e) => setTaskType(e.target.value)}
          disabled={isTraining}
        >
          <option value="auto">Auto-detect</option>
          <option value="classification">Classification</option>
          <option value="regression">Regression</option>
          <option value="clustering">Clustering (Unsupervised)</option>
        </select>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem' }}>
        <div>
          <label className="label" style={{ marginBottom: '0.5rem' }}>Select Algorithms</label>
          <div className="custom-multi-select">
            {availableModels.map(model => {
              const isSelected = selectedModels.includes(model);
              return (
                <div 
                  key={model} 
                  className={`select-item ${isSelected ? 'selected' : ''} ${isTraining ? 'disabled' : ''}`}
                  onClick={() => !isTraining && toggleModel(model)}
                >
                  {model}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label" style={{ marginBottom: '0.5rem' }}>Select Metrics</label>
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
        disabled={isTraining || selectedModels.length === 0}
        style={{ width: '100%' }}
      >
        {isTraining ? "Training..." : "Run Analysis 🚀"}
      </button>

      {error && <div style={{ color: '#ef4444', marginTop: '1rem', fontSize: '0.85rem' }}>{error}</div>}
    </div>
  );
}
