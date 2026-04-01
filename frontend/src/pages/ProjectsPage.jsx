import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export default function ProjectsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState('');

  const fetchProjects = async () => {
    try {
      const res = await client.get('/projects/');
      setProjects(res.data.projects);
    } catch {
      setError('Failed to load projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newProject.name.trim()) return;
    setCreating(true);
    try {
      await client.post('/projects/', newProject);
      setNewProject({ name: '', description: '' });
      setShowForm(false);
      fetchProjects();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create project.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await client.delete(`/projects/${id}`);
      setDeleteTarget(null);
      setProjects((p) => p.filter((x) => x.id !== id));
    } catch {
      setError('Failed to delete project.');
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="projects-page">
      {/* Header */}
      <header className="projects-header">
        <div className="projects-header-left">
          <div className="auth-logo-icon" style={{ fontSize: '1.4rem' }}>⚡</div>
          <h1 className="projects-logo-text">ML Automator</h1>
        </div>
        <div className="projects-header-right">
          <div className="projects-user-info">
            <div className="projects-avatar">{user?.full_name?.[0]?.toUpperCase() || 'U'}</div>
            <div>
              <div className="projects-user-name">{user?.full_name}</div>
              <div className="projects-user-sub">@{user?.username}</div>
            </div>
          </div>
          <button id="btn-logout" className="btn-logout" onClick={logout}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="projects-main">
        {/* Hero */}
        <div className="projects-hero">
          <h2 className="projects-hero-title">
            Your <span className="grad-text">ML Projects</span>
          </h2>
          <p className="projects-hero-sub">
            Each project is a self-contained workspace — upload datasets, run EDA, preprocess, and train models. All results are saved automatically.
          </p>
          <button id="btn-new-project" className="btn-new-project" onClick={() => setShowForm(true)}>
            + New Project
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="auth-error" style={{ margin: '0 auto 1.5rem', maxWidth: '680px' }}>
            {error}
          </div>
        )}

        {/* Create Form Modal */}
        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-title">Create New Project</h3>
              <form onSubmit={handleCreate}>
                <div className="auth-field">
                  <label htmlFor="proj-name">Project Name *</label>
                  <input
                    id="proj-name"
                    type="text"
                    placeholder="e.g. Customer Churn Prediction"
                    value={newProject.name}
                    onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="proj-desc">Description (optional)</label>
                  <textarea
                    id="proj-desc"
                    placeholder="What are you trying to predict or classify?"
                    value={newProject.description}
                    onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                  <button id="btn-create-confirm" type="submit" className="auth-submit" style={{ flex: 1 }} disabled={creating}>
                    {creating ? <span className="auth-spinner" /> : 'Create Project →'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {deleteTarget && (
          <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-title" style={{ color: '#f87171' }}>⚠ Delete Project?</h3>
              <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                Permanently delete <strong style={{ color: 'white' }}>{deleteTarget.name}</strong>? This will remove all datasets and training runs. This action cannot be undone.
              </p>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button
                  id="btn-delete-confirm"
                  className="btn-delete-confirm"
                  onClick={() => handleDelete(deleteTarget.id)}
                >
                  Delete Everything
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {loading ? (
          <div className="projects-loading">
            <div className="loading-spinner-lg" />
            <p>Loading your projects…</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="projects-empty">
            <div className="projects-empty-icon">🧪</div>
            <h3>No projects yet</h3>
            <p>Create your first project to start training ML models.</p>
            <button className="btn-new-project" onClick={() => setShowForm(true)}>
              + Create First Project
            </button>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((p) => (
              <div
                key={p.id}
                id={`project-card-${p.id}`}
                className="project-card"
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <div className="project-card-header">
                  <div className="project-card-icon">
                    {p.name[0]?.toUpperCase() || '?'}
                  </div>
                  <button
                    id={`btn-delete-project-${p.id}`}
                    className="project-delete-btn"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
                    title="Delete project"
                  >
                    ×
                  </button>
                </div>
                <h3 className="project-card-name">{p.name}</h3>
                {p.description && (
                  <p className="project-card-desc">{p.description}</p>
                )}
                <div className="project-card-stats">
                  <div className="project-stat">
                    <span className="project-stat-val">{p.dataset_count}</span>
                    <span className="project-stat-label">Datasets</span>
                  </div>
                  <div className="project-stat">
                    <span className="project-stat-val">{p.run_count}</span>
                    <span className="project-stat-label">Runs</span>
                  </div>
                  <div className="project-stat">
                    <span className="project-stat-val" style={{ fontSize: '0.75rem' }}>{formatDate(p.created_at)}</span>
                    <span className="project-stat-label">Created</span>
                  </div>
                </div>
                <div className="project-card-cta">Open Workspace →</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
