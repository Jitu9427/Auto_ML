import { useState, useMemo } from 'react';

export default function EDADashboard({ dataInfo }) {
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [plotType, setPlotType] = useState('');
  const [plotImage, setPlotImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const columnTypes = dataInfo.column_types || {}; // {"ColA": "numerical", "ColB": "categorical"}

  const toggleColumn = (col) => {
    setSelectedColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
    setPlotType(''); // Reset plot type when columns change
    setPlotImage(null);
  };

  const getPlotOptions = useMemo(() => {
    if (selectedColumns.length === 0) return [];
    
    if (selectedColumns.length === 1) {
        const type = columnTypes[selectedColumns[0]];
        if (type === 'numerical') return ['histogram', 'boxplot'];
        if (type === 'categorical') return ['countplot', 'pie'];
    }
    
    if (selectedColumns.length === 2) {
        const type1 = columnTypes[selectedColumns[0]];
        const type2 = columnTypes[selectedColumns[1]];
        if (type1 === 'numerical' && type2 === 'numerical') {
            return ['scatter', 'line'];
        } else if ((type1 === 'categorical' && type2 === 'numerical') || (type1 === 'numerical' && type2 === 'categorical')) {
            return ['boxplot', 'violin', 'bar'];
        } else if (type1 === 'categorical' && type2 === 'categorical') {
            return ['countplot']; 
        }
    }
    
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
      setPlotImage(data.image_base64);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
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
            <div className="select-wrapper">
              <label className="label">Suggested Plot Type</label>
              <select 
                className="select-input"
                value={plotType} 
                onChange={(e) => setPlotType(e.target.value)}
              >
                {getPlotOptions.map(opt => (
                  <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                ))}
              </select>
            </div>
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
      <div className="main-content" style={{ flex: 1, minWidth: 0, height: '100%' }}>
          <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: plotImage ? '1rem' : '2rem' }}>
              {isLoading ? (
                  <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }}>📊</div>
                      <h2>Crunching numbers...</h2>
                  </div>
              ) : plotImage ? (
                  <img src={`data:image/png;base64,${plotImage}`} alt="EDA Plot" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
              ) : (
                  <div style={{ textAlign: 'center', opacity: 0.5 }}>
                      <p>Select columns and choose a plot type to visually explore your dataset.</p>
                      <p style={{ fontSize: '0.85rem', marginTop: '1rem' }}>💡 Tip: Select multiple numerical columns to generate Correlation Heatmaps!</p>
                  </div>
              )}
          </div>
      </div>

    </div>
  );
}
