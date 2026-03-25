import { useState, useMemo, useEffect } from 'react';

export default function EDADashboard({ dataInfo }) {
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [plotType, setPlotType] = useState('');
  const [outputHistory, setOutputHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHeadLoading, setIsHeadLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summaryData, setSummaryData] = useState(null);

  const columnTypes = dataInfo.column_types || {}; // {"ColA": "numerical", "ColB": "categorical"}

  const ALL_PLOTS = [
      'histogram', 'distplot', 'boxplot', 'countplot', 'pie', 'kdeplot', 'rugplot', 'ecdfplot',
      'scatter', 'line', 'violin', 'bar', 'stripplot', 'swarmplot', 'pointplot', 'hexbin', 'jointplot',
      'distplot_compare', 'crosstab_heatmap', 'cluster_map', 'pairplot', 'correlation_heatmap'
  ];

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/v1/eda/summary/${dataInfo.dataset_id}`);
        if(response.ok) {
           const data = await response.json();
           setSummaryData(data);
        }
      } catch (err) { }
    };
    fetchSummary();
  }, [dataInfo.dataset_id]);

  const toggleColumn = (col) => {
    setSelectedColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const getPlotOptions = useMemo(() => {
    if (selectedColumns.length === 0) return [];
    
    // Phase 2: Univariate
    if (selectedColumns.length === 1) {
        const type = columnTypes[selectedColumns[0]];
        if (type === 'numerical') return ['histogram', 'distplot', 'boxplot'];
        if (type === 'categorical') return ['countplot', 'pie'];
    }
    
    // Phase 3: Bivariate
    if (selectedColumns.length === 2) {
        const type1 = columnTypes[selectedColumns[0]];
        const type2 = columnTypes[selectedColumns[1]];
        if (type1 === 'numerical' && type2 === 'numerical') {
            return ['scatter', 'line'];
        } else if ((type1 === 'categorical' && type2 === 'numerical') || (type1 === 'numerical' && type2 === 'categorical')) {
            return ['bar', 'boxplot', 'distplot_compare', 'violin'];
        } else if (type1 === 'categorical' && type2 === 'categorical') {
            return ['crosstab_heatmap', 'cluster_map']; 
        }
    }
    
    // Phase 4: Multivariate / Specialised
    if (selectedColumns.length > 2) {
        return ['pairplot', 'correlation_heatmap'];
    }
    
    return [];
  }, [selectedColumns, columnTypes]);

  // Set default plot type when options change
  useMemo(() => {
    if (getPlotOptions.length > 0 && !getPlotOptions.includes(plotType)) {
      setPlotType(getPlotOptions[0]);
    }
  }, [getPlotOptions, plotType]);

  const generatePlot = async () => {
    if (selectedColumns.length === 0 || !plotType) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/v1/eda/plot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: dataInfo.dataset_id,
          selected_columns: selectedColumns,
          plot_type: plotType
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to generate plot');
      }
      
      const data = await response.json();
      setOutputHistory(prev => [...prev, {
         id: Date.now(),
         type: 'plot',
         plotType: data.plot_type || plotType,
         columns: selectedColumns,
         image_base64: data.image_base64
      }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHead = async () => {
    if (selectedColumns.length === 0) return;
    setIsHeadLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/v1/eda/head', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset_id: dataInfo.dataset_id, selected_columns: selectedColumns, plot_type: 'head' }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to fetch data sample.');
      }
      const data = await response.json();
      setOutputHistory(prev => [...prev, {
        id: Date.now(),
        type: 'head',
        columns: data.columns,
        sample: data.sample
      }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsHeadLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', gap: '1.5rem', padding: '0 0.5rem' }}>
      
      {/* Left Configuration Panel */}
      <div className="glass-panel" style={{ width: '350px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Data Analysis</h2>
        
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingRight: '0.5rem' }}>
          
          <div>
            <label className="label" style={{ marginBottom: '0.5rem' }}>Select Columns</label>
            <div className="custom-multi-select">
              {dataInfo.columns.map(col => {
                const isSelected = selectedColumns.includes(col);
                const isNum = columnTypes[col] === 'numerical';
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
          </div>

          {selectedColumns.length > 0 && (
            <>
              <div style={{ marginTop: '0.5rem' }}>
                 <button 
                  className="btn" 
                  onClick={fetchHead}
                  disabled={isHeadLoading}
                  style={{ width: '100%', padding: '0.6rem', fontSize: '0.9rem', background: 'rgba(255,255,255,0.05)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}
                 >
                   {isHeadLoading ? "Loading..." : "View selected .head() 📋"}
                 </button>
              </div>

              <div className="select-wrapper" style={{ marginTop: '1rem' }}>
                <label className="label">Suggested Plots</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  {getPlotOptions.map(opt => (
                     <button 
                        key={opt}
                        onClick={() => setPlotType(opt)}
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', background: plotType === opt ? '#38bdf8' : 'rgba(255,255,255,0.1)', color: plotType === opt ? '#000' : '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                     >
                        {opt}
                     </button>
                  ))}
                </div>

                <label className="label">Search All Supported Plots</label>
                <input 
                  type="text"
                  list="all-plots"
                  className="select-input"
                  placeholder="e.g. hexbin, swarmplot..."
                  value={plotType}
                  onChange={(e) => setPlotType(e.target.value)}
                />
                <datalist id="all-plots">
                  {ALL_PLOTS.map(opt => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </div>
            </>
          )}

        </div>

        <button 
          className="btn" 
          onClick={generatePlot}
          disabled={isLoading || selectedColumns.length === 0 || !plotType}
          style={{ width: '100%', padding: '1rem', marginTop: '1.5rem' }}
        >
          {isLoading ? "Generating..." : "Generate Graph 📊"}
        </button>

        {error && <div style={{ color: '#ef4444', marginTop: '1rem', fontSize: '0.85rem' }}>{error}</div>}
      </div>

      {/* Right Plot Display Panel */}
      <div className="main-content" style={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto' }}>
          
          {summaryData && (
            <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                 <h2 style={{ color: '#38bdf8', margin: 0 }}>[1] Initial Data Understanding</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Dataset Shape (Rows x Cols)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{summaryData.shape[0]} × {summaryData.shape[1]}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Duplicate Rows</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{summaryData.duplicates}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Estimated Memory Use</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{summaryData.memory_mb} MB</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Mathematical Summary (Numerical)</h3>
                  <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.1)' }}>
                           <th style={{ padding: '0.5rem', textAlign: 'left' }}>Metric</th>
                           {Object.keys(summaryData.describe).map(col => <th key={col} style={{ padding: '0.5rem', textAlign: 'right' }}>{col}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max'].map(metric => (
                          <tr key={metric} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{metric}</td>
                            {Object.keys(summaryData.describe).map(col => (
                              <td key={col} style={{ padding: '0.5rem', textAlign: 'right' }}>
                                {typeof summaryData.describe[col][metric] === 'number' 
                                  ? Number(summaryData.describe[col][metric]).toFixed(2) 
                                  : summaryData.describe[col][metric]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ width: '250px' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Types & Missing Values</h3>
                  <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', maxHeight: '300px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.1)' }}>
                           <th style={{ padding: '0.5rem', textAlign: 'left' }}>Column</th>
                           <th style={{ padding: '0.5rem', textAlign: 'left' }}>Type</th>
                           <th style={{ padding: '0.5rem', textAlign: 'right' }}>Missing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(summaryData.dtypes).map(col => (
                          <tr key={col} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{col}</td>
                            <td style={{ padding: '0.5rem' }}>{summaryData.dtypes[col]}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right', color: summaryData.missing[col] > 0 ? '#ef4444' : 'inherit' }}>
                               {summaryData.missing[col]}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {outputHistory.map((item, index) => (
             <div key={item.id} className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                <h2 style={{ marginBottom: '1rem', color: '#c084fc' }}>[{index + 2}] Output: {item.type === 'plot' ? item.plotType : '.head(5)'}</h2>
                <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                   Columns: {item.columns.join(', ')}
                </div>
                
                {item.type === 'plot' && (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <img src={`data:image/png;base64,${item.image_base64}`} alt="EDA Plot" style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain', borderRadius: '8px', background: 'white' }} />
                    </div>
                )}

                {item.type === 'head' && (
                    <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.1)' }}>
                            {item.columns.map(k => <th key={k} style={{ padding: '0.5rem', textAlign: 'left' }}>{k}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {item.sample.map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              {item.columns.map(col => <td key={col} style={{ padding: '0.5rem' }}>{row[col]}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                )}
             </div>
          ))}

          {isLoading && (
              <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }}>📊</div>
                  <h2>Rendering visual...</h2>
              </div>
          )}
          
          {outputHistory.length === 0 && !isLoading && summaryData && (
             <div style={{ textAlign: 'center', opacity: 0.5, marginTop: '3rem' }}>
                 <p>Select columns and choose a tool on the left to add blocks to your notebook.</p>
             </div>
          )}
      </div>

    </div>
  );
}
