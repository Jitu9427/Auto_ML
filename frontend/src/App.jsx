import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import './index.css';
import UploadForm from './components/UploadForm';
import Configuration from './components/Configuration';
import ResultsDashboard from './components/ResultsDashboard';
import EDADashboard from './components/EDADashboard';
import PreprocessingDashboard from './components/PreprocessingDashboard';
import AuthPage from './pages/AuthPage';
import ProjectsPage from './pages/ProjectsPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import client from './api/client';

// ── Protected Route ────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="full-center"><div className="loading-spinner-lg" /></div>;
  return token ? children : <Navigate to="/auth" replace />;
}

// ── ML Workspace (existing app logic, now project-aware) ──────────────────
function Workspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [project, setProject] = useState(null);
  const [dataInfo, setDataInfo] = useState(null);
  const [runHistory, setRunHistory] = useState([]);
  const [isTraining, setIsTraining] = useState(false);
  const [splitRatio, setSplitRatio] = useState(30);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('train');
  const [splitConfig, setSplitConfig] = useState({ test_size: 0.2, random_state: 42 });
  const [stagedChanges, setStagedChanges] = useState([]);
  const [expandedChangeId, setExpandedChangeId] = useState(null);
  const [edaHistory, setEdaHistory] = useState([]);

  // Load project info
  useEffect(() => {
    if (projectId) {
      client.get(`/projects/${projectId}`)
        .then((res) => {
          const fetchedProject = res.data;
          setProject(fetchedProject);
          
          // Hydrate workspace with existing dataset and runs
          if (fetchedProject.datasets && fetchedProject.datasets.length > 0) {
            // Pick most recent dataset for dataInfo
            const latestDataset = fetchedProject.datasets[fetchedProject.datasets.length - 1];
            setDataInfo(latestDataset);
          }
          if (fetchedProject.runs && fetchedProject.runs.length > 0) {
            const parsedRuns = fetchedProject.runs.map(r => {
               const meta = r.run_metadata || {};
               // If results is nested, merge it with parent meta (which has model_name, etc.)
               if (meta.results) {
                  return { ...meta, ...meta.results };
               }
               return meta;
            });
            setRunHistory(parsedRuns);
          }
          if (fetchedProject.eda_history && fetchedProject.eda_history.length > 0) {
            const parsedEda = fetchedProject.eda_history.map(e => ({
                ...e.eda_metadata,
                id: e.id,
                created_at: e.created_at
            }));
            setEdaHistory(parsedEda);
          }
        })
        .catch(() => navigate('/projects'));
    }
  }, [projectId]);

  const handleMouseDown = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      let r = (e.clientX / window.innerWidth) * 100;
      if (r < 20) r = 20;
      if (r > 60) r = 60;
      setSplitRatio(r);
    }
  }, [isDragging]);
  const handleMouseUp = useCallback(() => setIsDragging(false), []);

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

  const handleUploadSuccess = (data) => { setDataInfo(data); setRunHistory([]); };
  const handleRestart = () => { setDataInfo(null); setRunHistory([]); setIsTraining(false); };
  const handleTrainResults = (newRun) => setRunHistory((prev) => [newRun, ...prev]);
  const handleDeleteRun = (i) => setRunHistory((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <>
      <header className="app-header">
        {/* Logo + breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            id="btn-back-projects"
            onClick={() => navigate('/projects')}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '1.1rem', padding: '0.2rem 0.4rem' }}
            title="Back to Projects"
          >
            ‹
          </button>
          <h1 style={{ margin: 0, fontSize: '1.5rem', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {project ? project.name : 'ML Automator'}
          </h1>
          {project && (
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', marginLeft: '0.25rem' }}>
              Project #{project.id}
            </span>
          )}
        </div>

        {dataInfo && (
          <div style={{ display: 'flex', gap: '0.75rem', margin: '0 auto' }}>
            {['prep', 'eda', 'train'].map((tab) => (
              <button
                key={tab}
                id={`btn-tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? 'rgba(56,189,248,0.2)' : 'transparent',
                  border: '1px solid rgba(56,189,248,0.5)',
                  color: activeTab === tab ? '#38bdf8' : 'white',
                  padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {tab === 'prep' ? 'Data Preprocessing 🔧' : tab === 'eda' ? 'Data Analysis 📊' : 'Model Training 🧠'}
              </button>
            ))}
            <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={handleRestart}>New Dataset</button>
          </div>
        )}

        {/* User info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: dataInfo ? '0' : 'auto' }}>
          <div className="projects-avatar" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <button id="btn-header-logout" className="btn-logout" onClick={logout}>Sign Out</button>
        </div>
      </header>

      <main className="app-main">
        {!dataInfo ? (
          <div style={{ maxWidth: '800px', margin: '4rem auto' }}>
            <UploadForm onUploadSuccess={handleUploadSuccess} projectId={projectId ? parseInt(projectId) : null} />
          </div>
        ) : (
          <div className="split-container" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            {activeTab === 'train' ? (
              <>
                <div style={{ width: `calc(${splitRatio}% - 32px)`, flexShrink: 0, paddingLeft: '0.5rem', minHeight: '100%' }}>
                  <Configuration
                    dataInfo={dataInfo}
                    onTrainResults={handleTrainResults}
                    isTraining={isTraining}
                    setIsTraining={setIsTraining}
                    splitConfig={splitConfig}
                    setSplitConfig={setSplitConfig}
                    projectId={projectId ? parseInt(projectId) : null}
                  />
                </div>
                <div
                  onMouseDown={handleMouseDown}
                  className={`resizer ${isDragging ? 'dragging' : ''}`}
                  style={{ width: '16px', cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 0.5rem', backgroundColor: isDragging ? 'rgba(255,255,255,0.08)' : 'transparent', borderRadius: '8px', transition: 'background-color 0.2s', zIndex: 10 }}
                >
                  <div style={{ width: '4px', height: '40px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '2px' }} />
                </div>
                <div style={{ width: `calc(${100 - splitRatio}% - 32px)`, flex: 1, minWidth: 0, paddingRight: '0.5rem', minHeight: '100%' }}>
                  <ResultsDashboard runHistory={runHistory} isTraining={isTraining} onDeleteRun={handleDeleteRun} />
                </div>
              </>
            ) : activeTab === 'eda' ? (
              <EDADashboard 
                dataInfo={dataInfo} 
                splitRatio={splitRatio} 
                isDragging={isDragging} 
                handleMouseDown={handleMouseDown} 
                projectId={projectId ? parseInt(projectId) : null}
                edaHistory={edaHistory}
                setEdaHistory={setEdaHistory}
              />
            ) : (
              <PreprocessingDashboard 
                dataInfo={dataInfo} 
                setDataInfo={setDataInfo} 
                splitRatio={splitRatio} 
                isDragging={isDragging} 
                handleMouseDown={handleMouseDown} 
                projectId={projectId ? parseInt(projectId) : null}
                stagedChanges={stagedChanges}
                setStagedChanges={setStagedChanges}
                expandedChangeId={expandedChangeId}
                setExpandedChangeId={setExpandedChangeId}
              />
            )}
          </div>
        )}
      </main>
    </>
  );
}

// ── Root App ───────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
          <Route path="/projects/:projectId" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
