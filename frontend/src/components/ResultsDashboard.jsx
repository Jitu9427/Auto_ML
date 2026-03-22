export default function ResultsDashboard({ resultsData, onRestart }) {
  const { task_type, results } = resultsData;
  const isClassification = task_type === 'classification';

  return (
    <div className="glass-panel" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ color: 'var(--primary-color)' }}>Step 3: Training Results</h2>
        <button className="btn btn-secondary" onClick={onRestart}>Start Over</button>
      </div>
      
      <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
        Models were automatically trained for a <strong>{task_type}</strong> task. Ranked by performance.
      </p>

      <div className="results-grid">
        {results.map((model, index) => (
          <div key={index} className="metric-card">
            <div className="model-name">
              {model.model_name}
              {index === 0 && !model.error && <span className="winner-badge">Top Performer 🏆</span>}
            </div>

            {model.error ? (
              <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>
                Error: {model.error}
              </div>
            ) : (
              <div>
                {Object.entries(model.metrics).map(([key, value]) => (
                  <div className="metric-row" key={key}>
                    <span className="metric-label">{key}</span>
                    <span className="metric-value">
                      {typeof value === 'number' ? (value > 1000 ? value.toExponential(3) : value.toFixed(4)) : value}
                    </span>
                  </div>
                ))}
                
                <div className="metric-row" style={{ marginTop: '0.5rem', opacity: 0.7 }}>
                  <span className="metric-label">Training Time</span>
                  <span className="metric-value">{model.training_time.toFixed(2)}s</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
