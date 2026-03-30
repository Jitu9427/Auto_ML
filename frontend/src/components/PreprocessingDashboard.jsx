import React, { useState } from 'react';

export default function PreprocessingDashboard({ dataInfo, setDataInfo, splitRatio = 35, isDragging = false, handleMouseDown }) {
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [category, setCategory] = useState('imputation');
  const [method, setMethod] = useState('mean');
  const [params, setParams] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [stagedChanges, setStagedChanges] = useState([]);
  const [expandedChangeId, setExpandedChangeId] = useState(null);

  const currentDatasetId = stagedChanges.length > 0 
      ? stagedChanges[stagedChanges.length - 1].dataset_id 
      : dataInfo?.dataset_id;
      
  const currentColumns = stagedChanges.length > 0 
      ? stagedChanges[stagedChanges.length - 1].columns 
      : dataInfo?.columns;

  const toggleColumn = (col) => {
    if (selectedColumns.includes(col)) {
      setSelectedColumns(selectedColumns.filter(c => c !== col));
    } else {
      setSelectedColumns([...selectedColumns, col]);
    }
  };

  const handleCategoryChange = (val) => {
    setCategory(val);
    setParams({});
    if (val === 'imputation') setMethod('mean');
    else if (val === 'scaling') setMethod('StandardScaler');
    else if (val === 'encoding') setMethod('OneHotEncoder');
    else if (val === 'outlier') setMethod('z-score');
    else if (val === 'transformation') setMethod('log');
    else if (val === 'power_transform') setMethod('yeo-johnson');
    else if (val === 'binning') setMethod('uniform');
  };

  const updateParam = (key, val) => {
    setParams(prev => ({ ...prev, [key]: val }));
  };

  const handleApplyStep = async () => {
    if (!currentDatasetId || selectedColumns.length === 0) {
        setError('You must explicitly select at least 1 column target to transform numerically.');
        return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const resp = await fetch('http://localhost:8000/api/v1/preprocess/apply_step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: currentDatasetId,
          columns: selectedColumns,
          technique: category,
          method: method,
          params: params
        })
      });
      
      const responseText = await resp.text();
      let data;
      try {
          data = JSON.parse(responseText);
      } catch (e) {
          throw new Error(`Backend Connection Dropped (Vite Proxy Error). Please wait 2 seconds and try again. Dev Error: ${responseText.substring(0, 50)}`);
      }
      
      if (!resp.ok) throw new Error(data.detail || 'Failed mathematically bounding structure');
      
      const newStage = {
          id: Math.random().toString(36).substring(2, 11),
          dataset_id: data.new_dataset_id,
          description: `Applied ${method} to ${selectedColumns.length} target column(s)`,
          columns: data.new_columns || currentColumns,
          preview: data
      };
      
      setStagedChanges([...stagedChanges, newStage]);
      setExpandedChangeId(newStage.id);
      setSelectedColumns([]);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = () => {
      if (stagedChanges.length === 0) return;
      const finalStage = stagedChanges[stagedChanges.length - 1];
      if (setDataInfo) {
          setDataInfo(prev => ({
              ...prev,
              dataset_id: finalStage.dataset_id,
              num_rows: finalStage.preview.after_shape[0],
              columns: finalStage.columns,
              history: [...(prev.history || []), ...stagedChanges]
          }));
      }
      setStagedChanges([]);
      setError('Changes successfully locked to your Global Dataset! You can process more or switch tabs.');
  };

  const handleDiscard = () => {
      setStagedChanges([]);
      setExpandedChangeId(null);
  };

  const handleDownload = (dataset_id) => {
    if (dataset_id) {
       window.open(`http://localhost:8000/api/v1/dataset/download/${dataset_id}`, '_blank');
    }
  };

  const renderTable = (sampleData, title) => {
    if (!sampleData || sampleData.length === 0) return null;
    const cols = Object.keys(sampleData[0]);
    return (
      <div style={{ padding: '0.5rem', overflowX: 'auto', background: 'rgba(0,0,0,0.1)' }}>
        <h4 style={{ marginBottom: '0.5rem', color: '#38bdf8', fontSize: '0.9rem' }}>{title}</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {cols.map(c => <th key={c} style={{ padding: '4px', textAlign: 'left', color: '#94a3b8' }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {sampleData.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {cols.map(c => (
                  <td key={c} style={{ padding: '4px', color: '#f1f5f9' }}>
                    {typeof row[c] === 'number' ? row[c].toFixed(4) : String(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', width: '100%' }}>
       {/* Left Configuration Panel */}
       <div className="glass-panel" style={{ width: `calc(${splitRatio}% - 32px)`, marginLeft: '0.5rem', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          
          <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Sequential Feature Engineer 🔧
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Select target columns, bind an algorithm, and preview.
              </p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Step 1: Column Selection */}
            <div>
                <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '0.75rem' }}>1. Target Columns ({selectedColumns.length})</h3>
            <div className="custom-multi-select" style={{ }}>
                {currentColumns?.map(col => {
                    const isSelected = selectedColumns.includes(col);
                    const isNum = dataInfo?.column_types?.[col] === 'numerical';
                    return (
                        <div 
                            key={col} 
                            className={`select-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => toggleColumn(col)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <span>{col}</span>
                            <span style={{ fontSize: '0.7rem', color: isNum ? '#38bdf8' : '#fbbf24', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '10px' }}>
                                {isNum ? '123' : 'ABC'}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setSelectedColumns(currentColumns || [])} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', padding: '0.5rem', color: '#f8fafc', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Select All</button>
                <button onClick={() => setSelectedColumns([])} style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', border: 'none', padding: '0.5rem', color: '#fca5a5', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Clear</button>
            </div>
            </div>
            
            {/* Step 2: Algorithm Execution Engine */}
            <div>
                <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '1rem' }}>2. Inject Transformation</h3>
                
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1 }}>
                        <label className="label">Algorithm Category</label>
                        <select className="select-input" value={category} onChange={e => handleCategoryChange(e.target.value)}>
                            <option value="imputation">Missing Values Imputation</option>
                            <option value="scaling">Mathematical Scaling</option>
                            <option value="encoding">Categorical Encoding</option>
                            <option value="outlier">Outlier Constraints</option>
                            <option value="transformation">Variable Math Transforms</option>
                            <option value="power_transform">Distribution Power Transforms</option>
                            <option value="binning">Continuous Binning Clustering</option>
                        </select>
                    </div>

                    <div style={{ flex: 1 }}>
                        <label className="label">Specific Technique</label>
                        <select className="select-input" value={method} onChange={e => setMethod(e.target.value)}>
                            {category === 'imputation' && <>
                                <option value="complete_case">Complete Case (Drop Row)</option>
                                <option value="mean">Mean Value Substitution</option>
                                <option value="median">Median Value</option>
                                <option value="most_frequent">Most Frequent (Mode)</option>
                                <option value="constant">Constant Fill</option>
                                <option value="knn">K-Nearest Neighbors Algorithm</option>
                                <option value="mice">Iterative MICE Prediction</option>
                            </>}
                            {category === 'scaling' && <>
                                <option value="StandardScaler">Z-Score Standardization</option>
                                <option value="MinMaxScaler">Min-Max Scaling</option>
                                <option value="RobustScaler">Robust IQR Scaling</option>
                                <option value="MaxAbsScaler">Max-Abs Scaling</option>
                            </>}
                            {category === 'encoding' && <>
                                <option value="OneHotEncoder">One-Hot Dummies</option>
                                <option value="OrdinalEncoder">Ordinal Sequences</option>
                                <option value="TargetEncoder">Target Mapping Encodings</option>
                                <option value="FrequencyEncoder">Frequency Rates Mapping</option>
                            </>}
                            {category === 'outlier' && <>
                                <option value="z-score">Z-Score Deviation Bound</option>
                                <option value="iqr">1.5x IQR Interquartile Bound</option>
                                <option value="percentile">Percentile Boundary Limits</option>
                            </>}
                            {category === 'transformation' && <>
                                <option value="log">Logarithmic Log1p</option>
                                <option value="reciprocal">Reciprocal Limits</option>
                                <option value="square">Quadratic Roots</option>
                                <option value="sqrt">Square Roots</option>
                            </>}
                            {category === 'power_transform' && <>
                                <option value="yeo-johnson">Yeo-Johnson Normals</option>
                                <option value="box-cox">Box-Cox Integrals</option>
                            </>}
                            {category === 'binning' && <>
                                <option value="uniform">Uniform Divisions</option>
                                <option value="quantile">Quantile Clusters</option>
                                <option value="kmeans">K-Means Separation groupings</option>
                            </>}
                        </select>
                    </div>
                </div>

                {/* Conditional Parameter Injections */}
                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '4px', borderLeft: '3px solid #6366f1' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#818cf8', fontSize: '0.85rem', textTransform: 'uppercase' }}>Algorithm Configuration Nodes</h4>
                    
                    {category === 'imputation' && method === 'constant' && (
                        <div>
                            <label className="label">Custom Constant Value Override:</label>
                            <input type="text" className="select-input" value={params.fill_value || ''} onChange={e => updateParam('fill_value', e.target.value)} placeholder="e.g. 0 or Unknown" />
                        </div>
                    )}
                    
                    {category === 'imputation' && method === 'knn' && (
                        <div>
                            <label className="label">Nearest Neighbor Clones (K):</label>
                            <input type="number" className="select-input" value={params.n_neighbors || 5} min="1" max="20" onChange={e => updateParam('n_neighbors', e.target.value)} />
                        </div>
                    )}

                    {category === 'outlier' && (
                        <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                            <div>
                                <label className="label">Violation Action Strategy:</label>
                                <select className="select-input" value={params.action || 'cap'} onChange={e => updateParam('action', e.target.value)}>
                                    <option value="cap">Winsorization (Mathematically Cap Bounds)</option>
                                    <option value="trim">Trimming (Delete Row Entry directly)</option>
                                </select>
                            </div>
                            {method === 'z-score' && (
                                <div>
                                    <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Z-Score Threshold Deviations</span>
                                        <span style={{ color: '#38bdf8' }}>{params.threshold || 3.0}</span>
                                    </label>
                                    <input type="range" min="1.0" max="5.0" step="0.1" value={params.threshold || 3.0} onChange={e => updateParam('threshold', parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8' }} />
                                </div>
                            )}
                        </div>
                    )}

                    {category === 'binning' && (
                        <div>
                            <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Algorithmic Cluster Sets / Bins</span>
                                <span style={{ color: '#38bdf8' }}>{params.n_bins || 5}</span>
                            </label>
                            <input type="range" min="2" max="30" step="1" value={params.n_bins || 5} onChange={e => updateParam('n_bins', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: '#38bdf8' }} />
                        </div>
                    )}

                    {category === 'encoding' && method === 'TargetEncoder' && (
                        <div>
                            <label className="label" style={{ color: '#fbbf24' }}>Target Column Extractor (Required):</label>
                            <select className="select-input" value={params.target_column || ''} onChange={e => updateParam('target_column', e.target.value)}>
                                <option value="">Select target...</option>
                                {currentColumns?.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    )}

                    {!(category === 'imputation' && ['constant', 'knn'].includes(method)) && 
                     !(category === 'outlier') && 
                     !(category === 'binning') && 
                     !(category === 'encoding' && method === 'TargetEncoder') && (
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>No additional configuration parameters required.</div>
                    )}
                </div>

                <button 
                  onClick={handleApplyStep} 
                  disabled={loading || selectedColumns.length === 0}
                  className="btn" 
                  style={{ width: '100%', marginTop: '1.5rem', background: selectedColumns.length > 0 ? 'linear-gradient(90deg, #1d4ed8, #4338ca)' : '#475569', border: 'none', padding: '0.9rem', fontWeight: 600, fontSize: '1.05rem', opacity: selectedColumns.length > 0 ? 1 : 0.5, cursor: selectedColumns.length > 0 ? 'pointer' : 'not-allowed' }}
                >
                  {loading ? 'Processing Preview...' : `Preview ${method} on ${selectedColumns.length} Columns 📝`}
                </button>
            </div>
            {error && <div style={{ background: error.startsWith('Changes') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', borderLeft: error.startsWith('Changes') ? '4px solid #10b981' : '4px solid #ef4444', padding: '1rem', marginTop: '1rem', borderRadius: '4px', color: error.startsWith('Changes') ? '#6ee7b7' : '#fca5a5', fontSize: '0.85rem' }}>{error}</div>}
          </div>
       </div>

      {/* Resizer Handle */}
      <div 
        onMouseDown={handleMouseDown}
        className={`resizer ${isDragging ? 'dragging' : ''}`}
        style={{
          width: '16px',
          cursor: 'col-resize',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '0 8px',
          userSelect: 'none',
          backgroundColor: isDragging ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
          borderRadius: '4px',
          transition: 'background-color 0.2s',
          flexShrink: 0
        }}
      >
          <div style={{ width: '2px', height: '30px', background: isDragging ? '#38bdf8' : 'rgba(255,255,255,0.2)', borderRadius: '2px' }} />
      </div>

       {/* Right Results Dashboard */}
       <div className="main-content" style={{ width: `calc(${100 - splitRatio}% - 32px)`, paddingRight: '0.5rem', flex: 1, minWidth: 0 }}>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem' }}>
              {stagedChanges.length > 0 && (
                  <>
                      <button onClick={handleDiscard} className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.5rem 1rem' }}>
                          Discard Previews ❌
                      </button>
                      <button onClick={handleCommit} className="btn" style={{ background: '#10b981', color: 'black', fontWeight: 'bold', boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)', padding: '0.5rem 1rem' }}>
                          Commit {stagedChanges.length} Changes ✅
                      </button>
                  </>
              )}
          </div>

          {/* Step 3: Staged Changes Timeline */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>3. Staged Previews</span>
                    <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>{stagedChanges.length} Stages</span>
                </h3>
                
                {stagedChanges.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', margin: '2rem 0' }}>
                        No changes staged yet. Configure parameters and preview them above.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                        {stagedChanges.map((stage, idx) => (
                            <div key={stage.id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', overflow: 'hidden' }}>
                                <div 
                                    onClick={() => setExpandedChangeId(expandedChangeId === stage.id ? null : stage.id)}
                                    style={{ padding: '0.75rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: expandedChangeId === stage.id ? 'rgba(56, 189, 248, 0.1)' : 'transparent' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#38bdf8', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>{idx + 1}</div>
                                        <span style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 'bold' }}>{stage.description}</span>
                                    </div>
                                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{expandedChangeId === stage.id ? '▲' : '▼'}</span>
                                </div>
                                
                                {expandedChangeId === stage.id && (
                                    <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}>✅ Preview Successful</span>
                                            <button onClick={() => handleDownload(stage.dataset_id)} style={{ background: 'transparent', border: 'none', color: '#38bdf8', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.75rem' }}>Download Segment CSV</button>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {renderTable(stage.preview.before_sample, 'Before Transition')}
                                            {renderTable(stage.preview.after_sample, 'After Execution Mappings')}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Committed Pipeline History Log */}
                {dataInfo?.history?.length > 0 && (
                     <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                         <h4 style={{ color: '#10b981', fontSize: '0.95rem', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              ✅ Locked Pipeline History
                         </h4>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.5rem' }}>
                             {dataInfo.history.map((hist, i) => (
                                 typeof hist === 'string' ? (
                                     <div key={i} style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                         <span style={{ color: '#10b981' }}>✓</span> {hist}
                                     </div>
                                 ) : (
                                    <div key={`hist-${i}`} style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px', overflow: 'hidden' }}>
                                        <div 
                                            onClick={() => setExpandedChangeId(expandedChangeId === `hist-${i}` ? null : `hist-${i}`)}
                                            style={{ padding: '0.75rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: expandedChangeId === `hist-${i}` ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ color: '#10b981', fontSize: '1rem', fontWeight: 'bold' }}>✓</span>
                                                <span style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 'bold' }}>{hist.description}</span>
                                            </div>
                                            <span style={{ color: '#10b981', fontSize: '0.8rem' }}>{expandedChangeId === `hist-${i}` ? '▲' : '▼'}</span>
                                        </div>
                                        
                                        {expandedChangeId === `hist-${i}` && (
                                            <div style={{ padding: '1rem', borderTop: '1px solid rgba(16, 185, 129, 0.1)', background: 'rgba(0,0,0,0.15)' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                    {renderTable(hist.preview.before_sample, 'Before Transition')}
                                                    {renderTable(hist.preview.after_sample, 'After Execution Mappings')}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                 )
                             ))}
                         </div>
                     </div>
                )}
            </div>
       </div>

    </div>
  );
}
