export default function ResultsDashboard({ resultsData, isTraining }) {
  if (isTraining) {
    return (
      <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse 2s infinite' }}>🧠</div>
        <h2 style={{ marginBottom: '0.5rem' }}>Training in Progress</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Our algorithms are crunching the numbers for you...</p>
      </div>
    );
  }

  if (!resultsData) {
    return (
      <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: 0.5 }}>
        <p>Configure and run analysis to see results here.</p>
      </div>
    );
  }

  const { task_type, results } = resultsData;

  return (
    <div className="main-content">
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', color: 'var(--primary-color)' }}>
          {task_type.charAt(0).toUpperCase() + task_type.slice(1)} Results
        </h2>
      </div>

      <div className="results-grid">
        {results.map((model, index) => (
          <div key={index} className="metric-card">
            <div className="model-name" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <span>{model.model_name}</span>
              {index === 0 && !model.error && <span className="winner-badge">#1</span>}
            </div>

            {model.error ? (
              <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>
                {model.error}
              </div>
            ) : (
              <div>
                {Object.entries(model.metrics).map(([key, value]) => (
                  <div className="metric-row" key={key}>
                    <span className="metric-label">{key}</span>
                    <span className="metric-value">
                      {typeof value === 'number' ? value.toFixed(4) : value}
                    </span>
                  </div>
                ))}
                
                <div className="metric-row" style={{ marginTop: '0.5rem', opacity: 0.6, fontSize: '0.8rem' }}>
                  <span className="metric-label">Duration</span>
                  <span className="metric-value">{model.training_time.toFixed(3)}s</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
