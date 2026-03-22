import { useState, useCallback } from 'react';
import '../index.css';

export default function UploadForm({ onUploadSuccess }) {
  const [isDragLoading, setIsDragLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragLoading(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragLoading(false);
  }, []);

  const uploadFile = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setError("Please upload a valid .csv file");
      return;
    }

    setIsUploading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/v1/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed. Check the server.');
      }

      const data = await response.json();
      onUploadSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragLoading(false);
    const file = e.dataTransfer.files[0];
    uploadFile(file);
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    uploadFile(file);
  };

  return (
    <div className="glass-panel">
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)' }}>Step 1: Upload Dataset</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
        Upload your structured data (.csv) to begin the automated machine learning pipeline. 
      </p>
      
      <div 
        className={`upload-zone ${isDragLoading ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input').click()}
      >
        <div className="upload-icon">📁</div>
        <div className="upload-text">
          {isUploading ? "Uploading & Analyzing..." : "Click or drag CSV here"}
        </div>
        {!isUploading && (
          <div className="upload-subtext">Supports comma-separated values up to 50MB</div>
        )}
      </div>

      <input 
        id="file-input"
        type="file" 
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {error && <div style={{ color: '#ef4444', marginTop: '1rem', textAlign: 'center' }}>{error}</div>}
    </div>
  );
}
