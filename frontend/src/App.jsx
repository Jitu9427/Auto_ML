import { useState, useCallback, useEffect } from 'react';
import './index.css';
import UploadForm from './components/UploadForm';
import Configuration from './components/Configuration';
import ResultsDashboard from './components/ResultsDashboard';
import EDADashboard from './components/EDADashboard';
import PreprocessingDashboard from './components/PreprocessingDashboard';

export default function App() {
  const [dataInfo, setDataInfo] = useState(null); // Step 1 result
  const [runHistory, setRunHistory] = useState([]);
  const [isTraining, setIsTraining] = useState(false);
  
  // Resizer state
  const [splitRatio, setSplitRatio] = useState(30);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('train');

  const [preprocessingConfig, setPreprocessingConfig] = useState({
    test_size: 0.2,
    random_state: 42,
    numerical_imputation: 'mean',
    categorical_imputation: 'most_frequent',
    scaling: 'StandardScaler',
    encoding: 'OneHotEncoder'
  });

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
    setRunHistory([]); 
  };

  const handleRestart = () => {
    setDataInfo(null);
    setRunHistory([]);
    setIsTraining(false);
  };
  
  const handleTrainResults = (newRun) => {
    setRunHistory(prev => [newRun, ...prev]);
  };

  const handleDeleteRun = (indexToDelete) => {
    setRunHistory(prev => prev.filter((_, i) => i !== indexToDelete));
  };

  return (
    <>
      <header className="app-header">
        <h1 style={{ margin: 0, fontSize: '1.5rem', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          ML Automator
        </h1>
        
        {dataInfo && (
          <div style={{display: 'flex', gap: '1rem', marginLeft: 'auto', marginRight: '2rem'}}>
            <button 
              onClick={() => setActiveTab('prep')} 
              style={{ background: activeTab === 'prep' ? 'rgba(56, 189, 248, 0.2)' : 'transparent', border: '1px solid rgba(56, 189, 248, 0.5)', color: activeTab === 'prep' ? '#38bdf8' : 'white', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Data Preprocessing 🔧
            </button>
            <button 
              onClick={() => setActiveTab('eda')} 
              style={{ background: activeTab === 'eda' ? 'rgba(56, 189, 248, 0.2)' : 'transparent', border: '1px solid rgba(56, 189, 248, 0.5)', color: activeTab === 'eda' ? '#38bdf8' : 'white', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Data Analysis 📊
            </button>
            <button 
              onClick={() => setActiveTab('train')} 
              style={{ background: activeTab === 'train' ? 'rgba(56, 189, 248, 0.2)' : 'transparent', border: '1px solid rgba(56, 189, 248, 0.5)', color: activeTab === 'train' ? '#38bdf8' : 'white', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Model Training 🧠
            </button>
            <button className="btn" style={{background: 'rgba(255,255,255,0.1)'}} onClick={handleRestart}>New Dataset</button>
          </div>
        )}
      </header>

      <main className="app-main">
        {!dataInfo ? (
          <div style={{ maxWidth: '800px', margin: '4rem auto' }}>
            <UploadForm onUploadSuccess={handleUploadSuccess} />
          </div>
        ) : (
          <div className="split-container" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            {activeTab === 'train' ? (
              <>
                {/* Left Configuration Panel */}
                <div style={{ width: `calc(${splitRatio}% - 32px)`, flexShrink: 0, height: '100%', overflowY: 'auto', paddingLeft: '0.5rem' }}>
                  <Configuration 
                    dataInfo={dataInfo} 
                    onTrainResults={handleTrainResults}  
                    isTraining={isTraining}
                    setIsTraining={setIsTraining}
                    preprocessingConfig={preprocessingConfig}
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

                {/* Right Results Panel */}
                <div style={{ width: `calc(${100 - splitRatio}% - 32px)`, flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  <ResultsDashboard 
                    runHistory={runHistory} 
                    isTraining={isTraining}
                    onDeleteRun={handleDeleteRun}
                  />
                </div>
              </>
            ) : activeTab === 'eda' ? (
              <EDADashboard dataInfo={dataInfo} />
            ) : (
              <PreprocessingDashboard config={preprocessingConfig} setConfig={setPreprocessingConfig} />
            )}
          </div>
        )}
      </main>
    </>
  );
}
