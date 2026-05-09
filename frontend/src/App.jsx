import React, { useState, useRef, useEffect } from 'react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  
  const [activeTab, setActiveTab] = useState('home');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [authError, setAuthError] = useState('');
  
  const [materials, setMaterials] = useState([]);
  
  const fileInputRef = useRef(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Timer state
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [activeMaterialForTimer, setActiveMaterialForTimer] = useState(null);

  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      alert('Sesiunea de studiu a fost finalizată! 🎉 Acum ești gata pentru quiz-uri.');
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  const startTimer = (mins) => {
    setTimeLeft(mins * 60);
    setIsTimerRunning(true);
  };
  
  const stopTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(0);
  };

  const fetchMaterials = async (token) => {
    try {
      const response = await fetch('http://localhost:3000/api/materials', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setMaterials(data.materials || []);
      }
    } catch (err) {
      console.error('Eroare la preluarea materialelor:', err);
    }
  };

  // Check local storage on initial load
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
      fetchMaterials(token);
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
        
        // Fetch materials immediately after login
        await fetchMaterials(data.token);
        
        // Redirect to city
        setActiveTab('city'); 
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
    setMaterials([]);
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
        await fetchMaterials(token); // update the list
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
            
            {materials.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: '0.7' }}>🏙️</div>
                <p style={{ marginBottom: '2rem', fontSize: '1.1rem' }}>
                  Încă nu ai construit nicio clădire. Pentru a începe extinderea orașului, 
                  trebuie să încarci un curs și să rezolvi quiz-urile!
                </p>
                <button 
                  className="primary-btn" 
                  style={{ width: 'auto' }}
                  onClick={() => setActiveTab('profile')}
                >
                  Încarcă primul tău fișier
                </button>
              </div>
            ) : (
              <>
                <p>Acesta este progresul tău de până acum. Continuă să înveți pentru a debloca clădiri noi!</p>
                <div style={{ height: '300px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--accent-beige)', borderRadius: '16px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '1rem' }}>
                  <span style={{ fontSize: '4rem', margin: '0 10px' }}>🏠</span>
                  {materials.length > 1 && <span style={{ fontSize: '5rem', margin: '0 10px' }}>🏢</span>}
                  {materials.length > 2 && <span style={{ fontSize: '6rem', margin: '0 10px' }}>🏦</span>}
                </div>
              </>
            )}
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

            {materials.length > 0 && (
              <div style={{ marginTop: '3rem' }}>
                <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--accent-beige)', paddingBottom: '0.5rem' }}>Materialele Tale</h3>
                <ul style={{ listStyleType: 'none', padding: 0 }}>
                  {materials.map((mat) => (
                    <li key={mat.id} style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', marginBottom: '1rem', borderRadius: '16px', border: '1px solid var(--accent-beige)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>📄 <strong>{mat.filename}</strong></span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--primary-color)', fontWeight: '600', backgroundColor: 'var(--bg-main)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid var(--accent-beige)' }}>
                          ⏱️ Estimat: {mat.study_time || 'N/A'}
                        </span>
                      </div>
                      
                      {mat.summary && (
                        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--accent-beige)' }}>
                          <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-main)' }}>✨ Rezumat AI:</strong>
                          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '1.5rem' }}>{mat.summary}</p>
                          
                          {activeMaterialForTimer === mat.id ? (
                            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--accent-beige)' }}>
                              <h4 style={{ marginBottom: '0.8rem', color: 'var(--primary-color)' }}>⏳ Sesiune de studiu</h4>
                              {!isTimerRunning && timeLeft === 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Timp (minute):</label>
                                  <input 
                                    type="number" 
                                    value={timerMinutes} 
                                    onChange={(e) => setTimerMinutes(Number(e.target.value))} 
                                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--accent-beige)', width: '70px', textAlign: 'center' }}
                                  />
                                  <button className="primary-btn" style={{ padding: '0.5rem 1rem', width: 'auto' }} onClick={() => startTimer(timerMinutes)}>Start</button>
                                  <button style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', textDecoration: 'underline' }} onClick={() => setActiveMaterialForTimer(null)}>Închide</button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                  <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)', fontFamily: 'monospace' }}>
                                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                                  </span>
                                  {isTimerRunning ? (
                                    <button className="primary-btn" style={{ background: '#ef4444', padding: '0.5rem 1rem', width: 'auto' }} onClick={stopTimer}>Oprește</button>
                                  ) : (
                                    <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.1rem' }}>Sesiune finalizată! 🎉</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button 
                              className="primary-btn" 
                              style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', width: 'auto', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--accent-beige)', boxShadow: 'none' }}
                              onClick={() => {
                                setActiveMaterialForTimer(mat.id);
                                const est = parseInt(mat.study_time) || 25;
                                setTimerMinutes(est);
                                setTimeLeft(0);
                                setIsTimerRunning(false);
                              }}
                            >
                              📚 Începe Sesiunea de Studiu
                            </button>
                          )}
                        </div>
                      )}
                      
                      <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                        Adăugat pe: {new Date(mat.uploaded_at).toLocaleDateString()}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>

      {isAuthenticated && (
        <button 
          className="fab-button" 
          onClick={() => setActiveTab('profile')}
          title="Încarcă un fișier nou"
        >
          +
        </button>
      )}
    </div>
  );
}

export default App;
