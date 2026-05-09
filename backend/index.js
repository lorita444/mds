const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'amsternlearn_secret_key'; // în producție ar trebui pus în .env

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// -- Rute Autentificare --

app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email și parola sunt obligatorii.' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`, [name, email, hashedPassword], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Acest email este deja folosit.' });
                }
                return res.status(500).json({ error: 'Eroare la crearea contului.' });
            }
            const token = jwt.sign({ id: this.lastID, email }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ message: 'Cont creat cu succes', token, user: { id: this.lastID, name, email } });
        });
    } catch (err) {
        res.status(500).json({ error: 'Eroare de server' });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email și parola sunt obligatorii.' });

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Eroare bază de date' });
        if (!user) return res.status(400).json({ error: 'Email sau parolă incorecte.' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Email sau parolă incorecte.' });

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ message: 'Autentificare reușită', token, user: { id: user.id, name: user.name, email: user.email } });
    });
});

// Middleware verificare token
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Neautorizat. Te rugăm să te loghezi.' });
    
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Token invalid sau expirat.' });
        req.user = decoded;
        next();
    });
};

// -- Rute Materiale --

app.get('/api/materials', verifyToken, (req, res) => {
    db.all(`SELECT id, filename, uploaded_at, summary, study_time FROM materials WHERE user_id = ? ORDER BY uploaded_at DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Eroare la preluarea materialelor' });
        res.json({ materials: rows });
    });
});

app.post('/api/upload', verifyToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Niciun fișier încărcat.' });

        let content = '';
        if (req.file.mimetype === 'application/pdf') {
            const dataBuffer = fs.readFileSync(req.file.path);
            const data = await pdfParse(dataBuffer);
            content = data.text;
        } else if (req.file.mimetype === 'text/plain') {
            content = fs.readFileSync(req.file.path, 'utf8');
        } else {
            return res.status(400).json({ error: 'Format nesuportat. Doar PDF sau TXT.' });
        }
        
        // Curățare fișier temporar
        fs.unlinkSync(req.file.path);

        // -- Integrare Ollama --
        let summary = "Generarea rezumatului a eșuat. Verifică dacă Ollama este pornit.";
        let study_time = "N/A";

        try {
            const prompt = `Analizează acest text dintr-un curs. 
Răspunde STRICT în format JSON cu următoarele chei: "summary" (un rezumat bine structurat, pe scurt, în limba română) și "study_time" (un string cu estimarea timpului de studiu în minute, ex: "45 minute", în română).
Dacă textul este prea scurt, estimează cel puțin 5 minute.
Text: ${content.substring(0, 4000)}`;

            const ollamaRes = await fetch('http://127.0.0.1:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'llama3', // modelul implicit
                    prompt: prompt,
                    stream: false,
                    format: 'json'
                })
            });

            if (ollamaRes.ok) {
                const ollamaData = await ollamaRes.json();
                const responseJson = JSON.parse(ollamaData.response);
                summary = responseJson.summary || summary;
                study_time = responseJson.study_time || study_time;
            } else {
                console.error("Ollama HTTP Error:", ollamaRes.status);
            }
        } catch (e) {
            console.error("Eroare conectare Ollama:", e.message);
        }

        db.run(`INSERT INTO materials (user_id, filename, content, summary, study_time) VALUES (?, ?, ?, ?, ?)`, 
            [req.user.id, req.file.originalname, content, summary, study_time], function(err) {
            if (err) return res.status(500).json({ error: 'Eroare la salvarea materialului în DB.' });
            res.json({ message: 'Material încărcat și analizat cu AI!', materialId: this.lastID });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Eroare la procesarea fișierului.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
