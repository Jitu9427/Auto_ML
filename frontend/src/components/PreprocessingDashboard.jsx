import React from 'react';

export default function PreprocessingDashboard({ config, setConfig }) {
  
  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="glass-panel" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowY: 'auto' }}>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Data Preprocessing & Transformation 🔧
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Configure how your data gets cleaned, scaled, and encoded before it reaches the models. These settings are applied dynamically using Scikit-Learn Pipelines to prevent data leakage.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        
        {/* Missing Values Section */}
        <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem', color: '#f8fafc' }}>1. Missing Values (Imputation)</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label className="label">Numerical Imputation Strategy</label>
            <select 
              className="select-input"
              value={config.numerical_imputation}
              onChange={(e) => updateConfig('numerical_imputation', e.target.value)}
            >
              <option value="mean">Mean (Average)</option>
              <option value="median">Median</option>
              <option value="most_frequent">Most Frequent (Mode)</option>
              <option value="constant">Constant (Zero)</option>
            </select>
          </div>

          <div>
            <label className="label">Categorical Imputation Strategy</label>
            <select 
              className="select-input"
              value={config.categorical_imputation}
              onChange={(e) => updateConfig('categorical_imputation', e.target.value)}
            >
              <option value="most_frequent">Most Frequent (Mode)</option>
              <option value="constant">Constant (Missing/Unknown)</option>
            </select>
          </div>
        </div>

        {/* Feature Scaling Section */}
        <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem', color: '#f8fafc' }}>2. Data Scaling</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label className="label">Numerical Scaler</label>
            <select 
              className="select-input"
              value={config.scaling}
              onChange={(e) => updateConfig('scaling', e.target.value)}
            >
              <option value="StandardScaler">StandardScaler (Z-score normalization)</option>
              <option value="MinMaxScaler">MinMaxScaler (0 to 1)</option>
              <option value="RobustScaler">RobustScaler (Resistant to outliers)</option>
              <option value="MaxAbsScaler">MaxAbsScaler (-1 to 1)</option>
              <option value="None">None (Do not scale)</option>
            </select>
          </div>

          <div>
            <label className="label">Categorical Encoder</label>
            <select 
              className="select-input"
              value={config.encoding}
              onChange={(e) => updateConfig('encoding', e.target.value)}
            >
              <option value="OneHotEncoder">OneHotEncoder (Dummy variables)</option>
              <option value="OrdinalEncoder">OrdinalEncoder (Integer mapping)</option>
            </select>
          </div>
        </div>

        {/* Train Test Split Section */}
        <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', gridColumn: '1 / -1' }}>
          <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem', color: '#f8fafc' }}>3. Data Splitting</h3>
          
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Test Set Size (0.01 - 0.99)</span>
                <span style={{ color: '#38bdf8' }}>{Math.round(config.test_size * 100)}%</span>
              </label>
              <input 
                type="range" 
                min="0.05" 
                max="0.5" 
                step="0.05"
                value={config.test_size}
                onChange={(e) => updateConfig('test_size', parseFloat(e.target.value))}
                style={{ width: '100%', marginTop: '0.5rem', accentColor: '#38bdf8' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  <span>Train: {100 - Math.round(config.test_size * 100)}%</span>
                  <span>Test: {Math.round(config.test_size * 100)}%</span>
              </div>
            </div>

            <div style={{ width: '150px' }}>
              <label className="label">Random State (Seed)</label>
              <input 
                type="number" 
                className="select-input"
                value={config.random_state}
                onChange={(e) => updateConfig('random_state', parseInt(e.target.value, 10))}
              />
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
