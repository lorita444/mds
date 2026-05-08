import React, { useState, useRef, useEffect } from 'react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  
  const [activeTab, setActiveTab] = useState('home');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [authError, setAuthError] = useState('');
  const fileInputRef = useRef(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Check local storage on initial load
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    const url = authMode === 'login' ? 'http://localhost:3000/api/login' : 'http://localhost:3000/api/register';
    const payload = authMode === 'login' ? { email, password } : { name, email, password };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setIsAuthenticated(true);
        setUser(data.user);
        setActiveTab('profile'); // redirect to profile after successful login
      } else {
        setAuthError(data.error || 'A apărut o eroare.');
      }
    } catch (error) {
      setAuthError('Eroare de conexiune la server.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setActiveTab('home');
  };

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

    const token = localStorage.getItem('token');
    if (!token) {
      setMessage({ type: 'error', text: 'Nu ești autentificat.' });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Material încărcat cu succes!' });
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

  const handleTabChange = (tab) => {
    if (!isAuthenticated && (tab === 'city' || tab === 'profile')) {
      setActiveTab('auth');
      return;
    }
    setActiveTab(tab);
  };

  return (
    <div className="app-container">
      <header>
        <div className="logo">amsternlearn</div>
        <nav className="nav-links">
          <button 
            className={activeTab === 'home' ? 'active' : ''} 
            onClick={() => handleTabChange('home')}
          >
            Acasă
          </button>
          <button 
            className={activeTab === 'city' ? 'active' : ''} 
            onClick={() => handleTabChange('city')}
          >
            Orașul tău
          </button>
          <button 
            className={activeTab === 'profile' ? 'active' : ''} 
            onClick={() => handleTabChange('profile')}
          >
            Profilul tău
          </button>
          {isAuthenticated && (
            <button 
              onClick={handleLogout}
              style={{ color: 'var(--primary-color)' }}
            >
              Delogare
            </button>
          )}
        </nav>
      </header>

      <main className="page-content">
        {activeTab === 'home' && (
          <div className="card">
            <h2>Bun venit la Amsternlearn</h2>
            <p>
              Amsternlearn este o platformă inovatoare dedicată elevilor și studenților. Aici îți poți 
              încărca propriile materiale de studiu (cărți, cursuri, notițe), iar inteligența noastră artificială 
              te va ajuta să le aprofundezi prin generarea de quiz-uri personalizate.
            </p>
            <p>
              Învață interactiv: extinde-ți orașul virtual cu fiecare răspuns corect și fii mereu pregătit 
              să-l aperi de atacurile extraterestre surpriză. Succes!
            </p>
            
            {!isAuthenticated && (
              <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                <button 
                  className="primary-btn" 
                  style={{ width: 'auto', padding: '1rem 2rem', fontSize: '1.05rem' }}
                  onClick={() => setActiveTab('auth')}
                >
                  Autentificare / Creare Cont
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'auth' && !isAuthenticated && (
          <div className="auth-container">
            <div className="auth-card">
              <h2>{authMode === 'login' ? 'Intră în cont' : 'Creează un cont'}</h2>
              <p>
                {authMode === 'login' 
                  ? 'Conectează-te pentru a-ți continua studiul.' 
                  : 'Alătură-te Amsternlearn pentru a învăța inteligent.'}
              </p>

              <form onSubmit={handleAuthSubmit}>
                {authMode === 'signup' && (
                  <div className="form-group">
                    <label>Nume complet</label>
                    <input 
                      type="text" 
                      placeholder="ex. Ion Popescu" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      required 
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>Email</label>
                  <input 
                    type="email" 
                    placeholder="nume@exemplu.ro" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Parolă</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                  />
                </div>
                {authError && <p style={{ color: 'red', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>{authError}</p>}
                
                <button type="submit" className="primary-btn">
                  {authMode === 'login' ? 'Autentificare' : 'Înregistrare'}
                </button>
              </form>

              <div className="auth-switch">
                {authMode === 'login' ? (
                  <>Nu ai cont? <span onClick={() => { setAuthMode('signup'); setAuthError(''); }}>Creează unul</span></>
                ) : (
                  <>Ai deja cont? <span onClick={() => { setAuthMode('login'); setAuthError(''); }}>Autentifică-te</span></>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'city' && isAuthenticated && (
          <div className="card">
            <h2>Orașul tău</h2>
            <p>Aici va fi afișat progresul tău sub forma unui oraș pe care îl construiești din cunoștințe.</p>
            <div style={{ height: '200px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--accent-beige)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '3rem' }}>🏗️</span>
            </div>
          </div>
        )}

        {activeTab === 'profile' && isAuthenticated && (
          <div className="card">
            <h2>Salut, {user?.name || 'Student'}! 👋</h2>
            <p>Încarcă aici cursurile, notițele sau cărțile din care vrei să înveți (format PDF sau TXT).</p>
            
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
                <p style={{ fontWeight: '600' }}>{file.name}</p>
              ) : (
                <p>Apasă pentru a selecta un fișier sau trage-l aici</p>
              )}
            </div>
            
            <button 
              className="primary-btn" 
              onClick={handleUpload}
              disabled={!file || uploading}
              style={{ marginTop: '1rem', width: 'auto' }}
            >
              {uploading ? 'Se încarcă...' : 'Încarcă Materialul'}
            </button>
            
            {message.text && (
              <p style={{ 
                marginTop: '1rem', 
                fontWeight: '500',
                color: message.type === 'error' ? '#ef4444' : '#10b981' 
              }}>
                {message.text}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
