import { useState, useCallback, useEffect } from 'react';
import './index.css';
import UploadForm from './components/UploadForm';
import Configuration from './components/Configuration';
import ResultsDashboard from './components/ResultsDashboard';

export default function App() {
  const [dataInfo, setDataInfo] = useState(null); // Step 1 result
  const [results, setResults] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  
  // Resizer state
  const [splitRatio, setSplitRatio] = useState(30);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      let newRatio = (e.clientX / window.innerWidth) * 100;
      if (newRatio < 20) newRatio = 20;
      if (newRatio > 60) newRatio = 60;
      setSplitRatio(newRatio);
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleUploadSuccess = (data) => {
    setDataInfo(data);
    setResults(null); // Clear old results if new file uploaded
  };

  const handleRestart = () => {
    setDataInfo(null);
    setResults(null);
    setIsTraining(false);
  };

  return (
    <>
      <header className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1400px', margin: '0 auto' }}>
          <h1 className="app-title">AutoML Platform</h1>
          {dataInfo && (
            <button className="btn btn-secondary" onClick={handleRestart} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              Change Dataset
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        {!dataInfo ? (
          <div style={{ maxWidth: '800px', margin: '4rem auto' }}>
            <UploadForm onUploadSuccess={handleUploadSuccess} />
          </div>
        ) : (
          <div style={{
            display: 'flex',
            height: '100%',
            userSelect: isDragging ? 'none' : 'auto'
          }}>
            {/* Sidebar Area */}
            <div style={{ width: `${splitRatio}%`, flexShrink: 0, height: '100%', overflow: 'hidden' }}>
              <Configuration 
                dataInfo={dataInfo} 
                onTrainResults={setResults} 
                isTraining={isTraining}
                setIsTraining={setIsTraining}
              />
            </div>
            
            {/* Resizer Handle */}
            <div 
              onMouseDown={handleMouseDown}
              className="resizer"
              style={{
                width: '16px',
                cursor: 'col-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 0.5rem',
                backgroundColor: isDragging ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                borderRadius: '8px',
                transition: 'background-color 0.2s',
                zIndex: 10
              }}
            >
              <div style={{ width: '4px', height: '40px', backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: '2px' }} />
            </div>

            {/* Main Content Area */}
            <div style={{ width: `calc(${100 - splitRatio}% - 32px)`, flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', paddingRight: '0.5rem' }}>
              <ResultsDashboard 
                resultsData={results} 
                isTraining={isTraining}
              />
            </div>
          </div>
        )}
      </main>
    </>
  );
}
