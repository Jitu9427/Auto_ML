import { useState } from 'react';

export default function ResultsDashboard({ runHistory, isTraining, onDeleteRun }) {
  const [selectedRunIndex, setSelectedRunIndex] = useState(null);

  if (isTraining && runHistory.length === 0) {
    return (
      <div className="glass-panel" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse 2s infinite' }}>🧠</div>
        <h2 style={{ marginBottom: '0.5rem' }}>Training first model...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Our algorithms are crunching the numbers for you.</p>
      </div>
    );
  }

  if (!runHistory || runHistory.length === 0) {
    return (
      <div className="glass-panel" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: 0.5 }}>
        <p>Configure model parameters and run an experiment to see history.</p>
      </div>
    );
  }

  const activeTaskType = runHistory[0].task_type;
  
  // Determine primary metric for highlighting
  let primaryMetric = '';
  let lowerIsBetter = false;
  if (activeTaskType === 'classification') {
      primaryMetric = 'Accuracy';
  } else if (activeTaskType === 'regression') {
      primaryMetric = 'R2 Score';
      if (!runHistory[0].metrics['R2 Score'] && runHistory[0].metrics['MSE']) {
          primaryMetric = 'MSE';
          lowerIsBetter = true;
      }
  } else if (activeTaskType === 'clustering') {
      primaryMetric = 'Silhouette Score';
  }

  // Find best run index based on primary metric
  let bestRunIndex = -1;
  let bestScore = lowerIsBetter ? Infinity : -Infinity;
  runHistory.forEach((run, i) => {
      if (!run.error && run.metrics && run.metrics[primaryMetric] !== undefined) {
          const score = run.metrics[primaryMetric];
          if (lowerIsBetter ? score < bestScore : score > bestScore) {
              bestScore = score;
              bestRunIndex = i;
          }
      }
  });

  if (selectedRunIndex !== null) {
      const run = runHistory[selectedRunIndex];
      return (
          <div className="main-content">
              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', background: 'rgba(255,255,255,0.1)' }} onClick={() => setSelectedRunIndex(null)}>
                      ← Back to Comparison
                  </button>
                  <h2 style={{ fontSize: '1.5rem', color: 'var(--primary-color)', margin: 0 }}>
                      Run #{runHistory.length - selectedRunIndex} Details
                  </h2>
              </div>

              <div className="glass-panel" style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                      <div>
                          <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>{run.model_name}</h1>
                          <span style={{ color: 'var(--text-secondary)' }}>Status: {run.error ? 'Failed' : 'Success'} | Duration: {run.training_time?.toFixed(3)}s</span>
                      </div>
                      {selectedRunIndex === bestRunIndex && <span className="winner-badge">🏆 Best Model</span>}
                  </div>

                  {run.error ? (
                      <div style={{ color: '#ef4444', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
                          <h3 style={{ margin: '0 0 0.5rem 0' }}>Execution Error</h3>
                          <code>{run.error}</code>
                      </div>
                  ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                          {/* Metrics Panel */}
                          <div>
                              <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Evaluation Metrics</h3>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  {Object.entries(run.metrics).map(([key, value]) => (
                                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: key === primaryMetric ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255,255,255,0.02)', borderRadius: '6px', borderLeft: key === primaryMetric ? '3px solid var(--primary-color)' : 'none' }}>
                                          <span style={{ color: 'var(--text-secondary)' }}>{key}</span>
                                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{typeof value === 'number' ? value.toFixed(5) : value}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>

                          {/* Parameters Panel */}
                          <div>
                              <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Hyperparameters</h3>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.5rem' }}>
                                  {Object.keys(run.params || {}).length > 0 ? (
                                      Object.entries(run.params).map(([key, value]) => (
                                          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', fontSize: '0.9rem' }}>
                                              <span style={{ color: 'var(--text-secondary)' }}>{key}</span>
                                              <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{value === null ? 'None' : String(value)}</span>
                                          </div>
                                      ))
                                  ) : (
                                      <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                          Default parameters used.
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  return (
    <div className="main-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
         <h2 style={{ fontSize: '1.5rem', color: 'var(--primary-color)' }}>
           Experiment Comparison
         </h2>
         <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Total Runs: {runHistory.length}</span>
      </div>

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Run ID</th>
                          <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Algorithm</th>
                          <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{primaryMetric || 'Primary Metric'}</th>
                          <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Duration</th>
                          <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                          <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Action</th>
                      </tr>
                  </thead>
                  <tbody>
                      {isTraining && (
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td colSpan="6" style={{ padding: '1rem', textAlign: 'center', color: 'var(--primary-color)', animation: 'pulse 1.5s infinite' }}>
                                  Training model in progress...
                              </td>
                          </tr>
                      )}
                      {runHistory.map((run, index) => {
                          const runNum = runHistory.length - index;
                          const isBest = index === bestRunIndex;
                          const primaryVal = run.metrics && primaryMetric ? run.metrics[primaryMetric] : null;

                          return (
                              <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: isBest ? 'rgba(56, 189, 248, 0.05)' : 'transparent', transition: 'background 0.2s' }}>
                                  <td style={{ padding: '1rem', fontWeight: 500 }}>#{runNum}</td>
                                  <td style={{ padding: '1rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                          {run.model_name}
                                          {isBest && <span title="Best Performing Model" style={{ cursor: 'help' }}>🏆</span>}
                                      </div>
                                  </td>
                                  <td style={{ padding: '1rem', fontWeight: isBest ? 700 : 400, color: isBest ? 'var(--primary-color)' : 'inherit' }}>
                                      {primaryVal !== null ? (typeof primaryVal === 'number' ? primaryVal.toFixed(4) : primaryVal) : '-'}
                                  </td>
                                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                      {run.training_time ? `${run.training_time.toFixed(2)}s` : '-'}
                                  </td>
                                  <td style={{ padding: '1rem' }}>
                                      {run.error ? <span style={{ color: '#ef4444', fontSize: '0.85rem', padding: '0.25rem 0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>Failed</span> : <span style={{ color: '#10b981', fontSize: '0.85rem', padding: '0.25rem 0.5rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '4px' }}>Success</span>}
                                  </td>
                                  <td style={{ padding: '1rem' }}>
                                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                          <button 
                                              onClick={() => setSelectedRunIndex(index)}
                                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                          >
                                              View Info
                                          </button>
                                          <button 
                                              onClick={() => {
                                                  if (window.confirm('Are you sure you want to delete this run?')) {
                                                      onDeleteRun && onDeleteRun(index);
                                                      if (selectedRunIndex === index) {
                                                          setSelectedRunIndex(null);
                                                      }
                                                  }
                                              }}
                                              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '4px', cursor: 'pointer' }}
                                              title="Delete Run"
                                          >
                                              ✕
                                          </button>
                                      </div>
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
}
