import React, { useState, useRef } from 'react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage({ type: '', text: '' });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-active');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-active');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-active');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setMessage({ type: '', text: '' });
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Material încărcat cu succes! Acum poți începe să înveți.' });
        setFile(null);
      } else {
        setMessage({ type: 'error', text: data.error || 'A apărut o eroare la încărcare.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Nu ne-am putut conecta la server.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <div className="logo">Amsternlearn</div>
        <nav className="nav-links">
          <button 
            className={activeTab === 'dashboard' ? 'active' : ''} 
            onClick={() => setActiveTab('dashboard')}
          >
            Acasă
          </button>
          <button 
            className={activeTab === 'study' ? 'active' : ''} 
            onClick={() => setActiveTab('study')}
          >
            Sesiuni Studiu
          </button>
          <button 
            className={activeTab === 'city' ? 'active' : ''} 
            onClick={() => setActiveTab('city')}
          >
            Orașul Meu
          </button>
        </nav>
      </header>

      <main>
        {activeTab === 'dashboard' && (
          <div className="dashboard-grid">
            <div className="glass-card">
              <h2>Încarcă Materiale</h2>
              <p>Adaugă cursuri, notițe sau cărți în format PDF sau TXT. AI-ul nostru va analiza textul și îți va pregăti quiz-uri personalizate pentru următoarea sesiune de studiu.</p>
              
              <div 
                className="upload-area"
                onClick={() => fileInputRef.current.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input 
                  type="file" 
                  className="file-input" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                  accept=".pdf,.txt"
                />
                <span className="upload-icon">📄</span>
                {file ? (
                  <p style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>{file.name}</p>
                ) : (
                  <p>Apasă pentru a selecta un fișier sau trage-l aici</p>
                )}
              </div>
              
              <button 
                className="primary-btn" 
                onClick={handleUpload}
                disabled={!file || uploading}
              >
                {uploading ? 'Se încarcă...' : 'Începe Încărcarea'}
              </button>

              {message.text && (
                <div className={`status-message ${message.type}`}>
                  {message.text}
                </div>
              )}
            </div>

            <div className="glass-card">
              <h2>Orașul Tău</h2>
              <p>Răspunde corect la întrebări pentru a construi noi clădiri. Fii atent la atacurile extraterestre surpriză!</p>
              <div className="city-preview">
                <div className="building-placeholder">🏗️</div>
              </div>
              <button className="primary-btn" onClick={() => setActiveTab('city')}>
                Vezi Orașul Complet
              </button>
            </div>
          </div>
        )}

        {activeTab === 'study' && (
          <div className="glass-card">
            <h2>Sesiuni de Studiu (În curând)</h2>
            <p>Aici vor apărea quiz-urile generate automat din materialele tale de către inteligența artificială.</p>
          </div>
        )}

        {activeTab === 'city' && (
          <div className="glass-card">
            <h2>Orașul Amsternlearn (În curând)</h2>
            <p>Aici vei putea vizualiza toate clădirile tale obținute din studiu intens. Pregătește-te de invazie!</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
