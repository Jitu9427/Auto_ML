import { useState } from 'react';

export default function Configuration({ dataInfo, onTrainStart }) {
  const [targetColumn, setTargetColumn] = useState(dataInfo.columns[dataInfo.columns.length - 1]);
  const [taskType, setTaskType] = useState('auto');
  const [isTraining, setIsTraining] = useState(false);
  const [error, setError] = useState(null);

  const startTraining = async () => {
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
          task_type: taskType
        }),
      });

      if (!response.ok) {
        throw new Error('Training failed to execute.');
      }
      
      const results = await response.json();
      onTrainStart(results);
    } catch (err) {
      setError(err.message);
      setIsTraining(false);
    }
  };

  return (
    <div className="glass-panel">
      <h2 style={{ marginBottom: '1rem', color: 'var(--primary-color)' }}>Step 2: Configuration</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
        Dataset <strong>{dataInfo.filename}</strong> loaded with {dataInfo.num_rows} rows and {dataInfo.columns.length} columns.
      </p>

      <div className="select-wrapper">
        <label className="label">Select Target Variable to Predict</label>
        <select 
          className="select-input" 
          value={targetColumn} 
          onChange={(e) => setTargetColumn(e.target.value)}
          disabled={isTraining}
        >
          {dataInfo.columns.map((col) => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </div>

      <div className="select-wrapper">
        <label className="label">Task Type</label>
        <select 
          className="select-input" 
          value={taskType} 
          onChange={(e) => setTaskType(e.target.value)}
          disabled={isTraining}
        >
          <option value="auto">Auto-detect (Recommended)</option>
          <option value="classification">Classification</option>
          <option value="regression">Regression</option>
        </select>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <button 
          className="btn" 
          onClick={startTraining}
          disabled={isTraining}
          style={{ width: '100%' }}
        >
          {isTraining ? (
            <span style={{ animation: 'pulse 1.5s infinite running' }}>Training Models... This can take a while ⏳</span>
          ) : (
            "Start Auto-Training 🚀"
          )}
        </button>
      </div>

      {error && <div style={{ color: '#ef4444', marginTop: '1rem', textAlign: 'center' }}>{error}</div>}
    </div>
  );
}
