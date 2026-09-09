require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { crypto } = require('crypto'); // Built-in Node.js crypto
const db = require('./db');
const {
  validateSummary,
  validateFlashcards,
  validateQuiz,
  validateChatReply,
  parseAIResponse,
  AIValidationError,
  AIParseError,
} = require('./utils/aiValidator');


const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'studyverse_secret_key_2026';
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'studyverse_refresh_secret_key_2026';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json());

// Helper to generate UUIDs
function generateUUID() {
  return require('crypto').randomUUID();
}

/**
 * Helper to run Codex thread without artificial timeout abort (unless timeoutMs > 0).
 */
async function runCodexWithTimeout(thread, prompt, turnOptions = {}, timeoutMs = 0) {
  if (!timeoutMs || timeoutMs <= 0) {
    return await thread.run(prompt, turnOptions);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const turn = await thread.run(prompt, { ...turnOptions, signal: controller.signal });
    return turn;
  } catch (error) {
    if (
      controller.signal.aborted ||
      error.name === 'AbortError' ||
      (error.message && error.message.toLowerCase().includes('abort'))
    ) {
      const timeoutError = new Error(`OpenAI request timed out`);
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// ── FAST FALLBACK GENERATORS (extracts real sentences from materials) ──
function generateFallbackQuiz(subjectName, materials = []) {
  const textSnippets = materials
    .map(m => {
      const txt = (m && m.summary) ? String(m.summary).trim() : ((m && m.extracted_text) ? String(m.extracted_text).trim() : '');
      return txt;
    })
    .filter(Boolean)
    .join(' ');

  const sentences = textSnippets
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.length < 200);

  if (sentences.length >= 3) {
    const s1 = sentences[0];
    const s2 = sentences[1];
    const s3 = sentences[2];
    const s4 = sentences[3] || sentences[0];
    const s5 = sentences[4] || sentences[1];

    return [
      {
        question_text: `Conform suportului de curs pentru "${subjectName}": care afirmație este corectă despre "${s1.slice(0, 60)}..."?`,
        question_type: 'multiple_choice',
        options: [
          s1.slice(0, 60),
          `Aspect neprecizat în suportul de curs`,
          `Afirmație contrară teoriei prezentate`,
          `Niciuna dintre variante`
        ],
        correct_answer: s1.slice(0, 60),
        explanation: `Afirmația este extrasă direct din materialul de studiu.`
      },
      {
        question_text: `Care dintre următoarele opțiuni este prezentată în documentele materiei "${subjectName}"?`,
        question_type: 'multiple_choice',
        options: [
          s2.slice(0, 60),
          `Aspecte nespecificate în suportul de curs`,
          `Configurații generice exterioare`,
          `Elemente secundare nedefinite`
        ],
        correct_answer: s2.slice(0, 60),
        explanation: `Informația apare în suportul de curs al materiei.`
      },
      {
        question_text: `Privind tema de curs: "${s3.slice(0, 60)}...", ce variantă este validă?`,
        question_type: 'multiple_choice',
        options: [
          s3.slice(0, 60),
          `Teorie necorelată cu domeniul`,
          `Definiție aleatorie din alt curs`,
          `Structură nedefinită`
        ],
        correct_answer: s3.slice(0, 60),
        explanation: 'Fapt confirmat de materialele atașate materiei.'
      },
      {
        question_text: `Identificați conceptul menționat în cursul de "${subjectName}":`,
        question_type: 'multiple_choice',
        options: [
          s4.slice(0, 60),
          `Teorie necorelată cu domeniul ${subjectName}`,
          `Definiții aleatorii din alte discipline`,
          `Structură neutilizată în suportul didactic`
        ],
        correct_answer: s4.slice(0, 60),
        explanation: 'Opțiunea corectă provine direct din notele de curs.'
      },
      {
        question_text: `Sinteza materiei "${subjectName}" evidențiază următoarea noțiune:`,
        question_type: 'multiple_choice',
        options: [
          s5.slice(0, 60),
          `Punct de vedere neacceptat în materie`,
          `Ipoteză invalidă conform cursului`,
          `Informație fără relevanță`
        ],
        correct_answer: s5.slice(0, 60),
        explanation: 'Informația este extrasă din sinteza materialelor.'
      }
    ];
  }

  return [
    {
      question_text: `Care este scopul principal al parcurgerii materiei "${subjectName}"?`,
      question_type: 'multiple_choice',
      options: [
        `Însușirea conceptelor din ${subjectName}`,
        `Memorarea de date fără legătură cu tema`,
        `Rularea de teste aleatorii`,
        `Niciuna dintre variante`
      ],
      correct_answer: `Însușirea conceptelor din ${subjectName}`,
      explanation: 'Scopul este înțelegerea și aplicarea cunoștințelor din materie.'
    },
    {
      question_text: `Care este rolul evaluărilor la materia "${subjectName}"?`,
      question_type: 'multiple_choice',
      options: [
        `Măsurarea gradului de înțelegere a noțiunilor`,
        `Generarea de erori în parcurgerea capitolelor`,
        `Omiterea suportului didactic`,
        `Ignorarea tematicilor de studiu`
      ],
      correct_answer: `Măsurarea gradului de înțelegere a noțiunilor`,
      explanation: 'Evaluarea măsoară nivelul de stăpânire a conceptelor.'
    },
    {
      question_text: `Materialele atașate materiei "${subjectName}" oferă:`,
      question_type: 'multiple_choice',
      options: [
        `Suport teoretic și practic structurat`,
        `Date fără relevanță pedagogică`,
        `Teme complet neasociate cursului`,
        `Nicio resursă de studiu`
      ],
      correct_answer: `Suport teoretic și practic structurat`,
      explanation: 'Suportul de curs oferă baza necesară pentru fixarea noțiunilor.'
    },
    {
      question_text: `Identificați orientarea principală a cursului de "${subjectName}":`,
      question_type: 'multiple_choice',
      options: [
        `Dezvoltarea competențelor în ${subjectName}`,
        `Studierea unor domenii neafiliate`,
        `Analiza unor date fără relevanță`,
        `Proceduri generice neincluse`
      ],
      correct_answer: `Dezvoltarea competențelor în ${subjectName}`,
      explanation: 'Fiecare modul vizează dezvoltarea cunoștințelor în domeniu.'
    },
    {
      question_text: `Cum se recomandă parcurgerea materialelor la "${subjectName}"?`,
      question_type: 'multiple_choice',
      options: [
        `Studiu sistematic al capitolelor și note de curs`,
        `Citire aleatorie fără urmărirea tematicii`,
        `Omiterea exemplelor practice`,
        `Niciuna dintre variante`
      ],
      correct_answer: `Studiu sistematic al capitolelor și note de curs`,
      explanation: 'Studiul sistematic garantează fixarea cunoștințelor.'
    }
  ];
}

function generateFallbackFlashcards(subjectName, materials = []) {
  const textSnippets = materials
    .map(m => {
      const txt = (m && m.summary) ? String(m.summary).trim() : ((m && m.extracted_text) ? String(m.extracted_text).trim() : '');
      return txt;
    })
    .filter(Boolean)
    .join(' ');

  const sentences = textSnippets
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.length < 200);

  if (sentences.length >= 3) {
    return [
      {
        question: `Ce precizează materialul cu privire la: "${sentences[0].slice(0, 80)}..."?`,
        answer: sentences[0],
        difficulty: 'easy'
      },
      {
        question: `Explicați afirmația: "${sentences[1].slice(0, 80)}..."`,
        answer: sentences[1],
        difficulty: 'medium'
      },
      {
        question: `Care este detaliul prezentat despre: "${sentences[2].slice(0, 80)}..."?`,
        answer: sentences[2],
        difficulty: 'easy'
      },
      {
        question: `Cum se definește ideea din suportul de curs: "${(sentences[3] || sentences[0]).slice(0, 80)}..."?`,
        answer: sentences[3] || sentences[0],
        difficulty: 'medium'
      },
      {
        question: `Care este concluzia privind: "${(sentences[4] || sentences[1]).slice(0, 80)}..."?`,
        answer: sentences[4] || sentences[1],
        difficulty: 'hard'
      }
    ];
  }

  return [
    {
      question: `Care este noțiunea principală abordată în materia "${subjectName}"?`,
      answer: `Materia "${subjectName}" tratează concepte fundamentale și aplicații practice.`,
      difficulty: 'easy'
    },
    {
      question: `Cum trebuie parcurse materialele pentru materia "${subjectName}"?`,
      answer: `Prin parcurgerea capitolelor de curs și fixarea termenilor cheie.`,
      difficulty: 'medium'
    },
    {
      question: `Care este obiectivul de studiu la "${subjectName}"?`,
      answer: `Înțelegerea aprofundată a tematicii și aplicarea în exerciții.`,
      difficulty: 'easy'
    },
    {
      question: `Ce recomandare există pentru recapitulare la "${subjectName}"?`,
      answer: `Revizuirea sintezelor și autoevaluarea prin quizz-uri.`,
      difficulty: 'medium'
    },
    {
      question: `Ce măsoară quizz-urile la materia "${subjectName}"?`,
      answer: `Progresul de învățare și gradul de stăpânire a noțiunilor.`,
      difficulty: 'hard'
    }
  ];
}

// Token Generators
function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
}

async function generateRefreshToken(user) {
  const refreshToken = jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const id = generateUUID();
  await db.query(
    `INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
    [id, user.id, refreshToken, expiresAt.toISOString().slice(0, 19).replace('T', ' ')]
  );

  return refreshToken;
}

// Helper to map DB row boolean values
const mapBools = (obj, keys) => {
  if (!obj) return obj;
  const newObj = { ...obj };
  keys.forEach(k => {
    if (newObj[k] !== undefined) {
      newObj[k] = newObj[k] === 1 || newObj[k] === true;
    }
  });
  return newObj;
};

const mapBoolsArray = (arr, keys) => {
  return arr.map(item => mapBools(item, keys));
};

// Middleware: Authenticate Request
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  // Try verifying with JWT_ACCESS_SECRET first, fallback to JWT_SECRET for backward compatibility
  jwt.verify(token, JWT_ACCESS_SECRET, (err, user) => {
    if (!err) {
      req.user = user;
      return next();
    }

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
    }

    jwt.verify(token, JWT_SECRET, (fallbackErr, fallbackUser) => {
      if (!fallbackErr) {
        req.user = fallbackUser;
        return next();
      }
      return res.status(403).json({ error: 'Invalid or expired token' });
    });
  });
};

// ── AUTHENTICATION ───────────────────────────────────────────

app.post('/api/auth/signup', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const emailExists = await db.querySingle('SELECT id FROM users WHERE email = ?', [email]);
    if (emailExists) {
      return res.status(400).json({ error: 'User already registered' });
    }

    const usernameExists = await db.querySingle('SELECT id FROM users WHERE username = ?', [username]);
    if (usernameExists) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = generateUUID();

    // Insert user
    await db.query(
      `INSERT INTO users (id, email, username, password) VALUES (?, ?, ?, ?)`,
      [userId, email.trim().toLowerCase(), username.trim(), hashedPassword]
    );

    // Create starter universe items (Starter Planet and companion Zorp)
    await db.query(
      `INSERT INTO user_universe_items (id, user_id, item_type, item_name, rarity, placeholder_key, earned_from)
       VALUES (?, ?, 'planet', 'Starter Planet', 'common', 'planet_starter', 'signup')`,
      [generateUUID(), userId]
    );

    await db.query(
      `INSERT INTO user_universe_items (id, user_id, item_type, item_name, rarity, placeholder_key, earned_from)
       VALUES (?, ?, 'alien', 'Zorp', 'common', 'alien_basic', 'signup')`,
      [generateUUID(), userId]
    );

    const userObj = { id: userId, email: email.trim().toLowerCase(), username: username.trim() };
    const accessToken = generateAccessToken(userObj);
    const refreshToken = await generateRefreshToken(userObj);

    const userProfile = await db.querySingle('SELECT id, email, username, avatar_url, crystal_balance, streak_days, longest_streak, consistency_multiplier, total_study_seconds, created_at FROM users WHERE id = ?', [userId]);

    res.status(201).json({
      session: { access_token: accessToken, refresh_token: refreshToken },
      user: mapBools(userProfile, ['is_active'])
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await db.querySingle('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid login credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid login credentials' });
    }

    const userObj = { id: user.id, email: user.email, username: user.username };
    const accessToken = generateAccessToken(userObj);
    const refreshToken = await generateRefreshToken(userObj);

    // Remove password
    delete user.password;

    res.json({
      session: { access_token: accessToken, refresh_token: refreshToken },
      user: mapBools(user, [])
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const payload = jwt.verify(refresh_token, JWT_REFRESH_SECRET);

    const stored = await db.querySingle(
      'SELECT * FROM refresh_tokens WHERE user_id = ? AND token = ? AND expires_at > NOW()',
      [payload.id, refresh_token]
    );

    if (!stored) {
      return res.status(403).json({ error: 'Invalid or revoked refresh token' });
    }

    // Delete old refresh token (Token rotation)
    await db.query('DELETE FROM refresh_tokens WHERE id = ?', [stored.id]);

    const userObj = { id: payload.id, email: payload.email, username: payload.username };
    const newAccessToken = generateAccessToken(userObj);
    const newRefreshToken = await generateRefreshToken(userObj);

    res.json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const { refresh_token } = req.body;
  if (refresh_token) {
    try {
      await db.query('DELETE FROM refresh_tokens WHERE token = ?', [refresh_token]);
    } catch (e) {
      console.error('Failed to revoke refresh token:', e.message);
    }
  }
  res.json({ success: true });
});


app.post('/api/auth/reset-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const user = await db.querySingle('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Since this is a simulated local setup, we log the password reset request to the console
    console.log(`[PASSWORD RESET SIMULATION] A reset password link request was received for: ${email.trim().toLowerCase()}`);
    res.json({ success: true, message: 'Password reset link sent successfully (simulated).' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process password reset' });
  }
});

// ── USERS & PROFILES ──────────────────────────────────────────

app.get('/api/users/profile/:userId', async (req, res) => {
  try {
    const profile = await db.querySingle(
      'SELECT id, email, username, avatar_url, crystal_balance, streak_days, longest_streak, consistency_multiplier, total_study_seconds, created_at FROM users WHERE id = ?',
      [req.params.userId]
    );
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/profile/:userId', async (req, res) => {
  const { username, avatar_url } = req.body;
  try {
    await db.query(
      'UPDATE users SET username = COALESCE(?, username), avatar_url = COALESCE(?, avatar_url) WHERE id = ?',
      [username, avatar_url, req.params.userId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users/profile/reset', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    await db.query(
      'UPDATE users SET streak_days = 0, longest_streak = 0, consistency_multiplier = 1.00, crystal_balance = 50, total_study_seconds = 0 WHERE id = ?',
      [userId]
    );
    await db.query('DELETE FROM study_sessions WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM streaks WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM rewards WHERE user_id = ?', [userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/profile', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── SUBJECTS ─────────────────────────────────────────────────

app.get('/api/subjects', async (req, res) => {
  const { userId } = req.query;
  try {
    const rows = await db.query('SELECT * FROM subjects WHERE user_id = ? ORDER BY created_at ASC', [userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/subjects/:id', async (req, res) => {
  try {
    const subject = await db.querySingle('SELECT * FROM subjects WHERE id = ?', [req.params.id]);
    res.json(subject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/subjects', async (req, res) => {
  const { user_id, name, description, color, emoji } = req.body;
  const id = generateUUID();
  try {
    await db.query(
      `INSERT INTO subjects (id, user_id, name, description, color, emoji) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, user_id, name, description || null, color || '#7c3aed', emoji || '📚']
    );
    const subject = await db.querySingle('SELECT * FROM subjects WHERE id = ?', [id]);
    res.json(subject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/subjects/:id', async (req, res) => {
  const { name, description, color, emoji } = req.body;
  try {
    await db.query(
      `UPDATE subjects SET 
         name = COALESCE(?, name), 
         description = COALESCE(?, description), 
         color = COALESCE(?, color), 
         emoji = COALESCE(?, emoji) 
       WHERE id = ?`,
      [
        name || null,
        description !== undefined ? description : null,
        color || null,
        emoji || null,
        req.params.id
      ]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }

});

app.delete('/api/subjects/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM subjects WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── CHAPTERS ─────────────────────────────────────────────────

app.get('/api/chapters', async (req, res) => {
  const { subjectId } = req.query;
  try {
    const rows = await db.query('SELECT * FROM chapters WHERE subject_id = ? ORDER BY order_index ASC', [subjectId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chapters', async (req, res) => {
  const { subject_id, name, description, order_index } = req.body;
  const id = generateUUID();
  try {
    await db.query(
      'INSERT INTO chapters (id, subject_id, name, description, order_index) VALUES (?, ?, ?, ?, ?)',
      [id, subject_id, name, description || null, order_index || 0]
    );
    const chapter = await db.querySingle('SELECT * FROM chapters WHERE id = ?', [id]);
    res.json(chapter);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/chapters/:id', async (req, res) => {
  const { name, description, order_index } = req.body;
  try {
    await db.query(
      'UPDATE chapters SET name = COALESCE(?, name), description = COALESCE(?, description), order_index = COALESCE(?, order_index) WHERE id = ?',
      [
        name || null,
        description !== undefined ? description : null,
        order_index !== undefined ? order_index : null,
        req.params.id
      ]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.delete('/api/chapters/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM chapters WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── MATERIALS ────────────────────────────────────────────────

app.get('/api/materials', async (req, res) => {
  const { subjectId, chapterId, userId } = req.query;
  try {
    let rows;
    if (chapterId) {
      rows = await db.query('SELECT * FROM materials WHERE chapter_id = ? ORDER BY created_at ASC', [chapterId]);
    } else if (subjectId) {
      rows = await db.query('SELECT * FROM materials WHERE subject_id = ? ORDER BY created_at ASC', [subjectId]);
    } else if (userId) {
      rows = await db.query('SELECT * FROM materials WHERE user_id = ? ORDER BY created_at ASC', [userId]);
    } else {
      rows = await db.query('SELECT * FROM materials ORDER BY created_at ASC');
    }
    res.json(mapBoolsArray(rows, ['is_summarized', 'embedding_done']));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/materials', async (req, res) => {
  const { subject_id, chapter_id, user_id, name, file_url, file_type, size_bytes, summary, extracted_text } = req.body;
  const id = generateUUID();
  try {
    await db.query(
      `INSERT INTO materials (id, subject_id, chapter_id, user_id, name, file_url, file_type, size_bytes, summary, extracted_text, is_summarized, embedding_done)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, subject_id, chapter_id || null, user_id, name, file_url, file_type, size_bytes || 0, summary || null, extracted_text || null, summary ? 1 : 0]
    );
    const material = await db.querySingle('SELECT * FROM materials WHERE id = ?', [id]);
    res.json(mapBools(material, ['is_summarized', 'embedding_done']));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/materials/extract-text', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const mimeType = req.file.mimetype || '';
    const fileName = req.file.originalname || 'uploaded file';
    let text = '';

    console.log('[SUMMARIZE] EXTRACT START', {
      name: fileName,
      mimeType,
      size: req.file.size,
      at: new Date().toISOString(),
    });

    if (mimeType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')) {
      const parsed = await pdfParse(req.file.buffer);
      text = parsed.text || '';
    } else if (
      mimeType.includes('text') ||
      fileName.toLowerCase().endsWith('.txt') ||
      fileName.toLowerCase().endsWith('.md')
    ) {
      text = req.file.buffer.toString('utf8');
    } else {
      return res.status(400).json({
        error: 'Unsupported file type for text extraction. Upload a text-based PDF or TXT/MD file.',
      });
    }

    const cleaned = text
      .replace(/\0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (cleaned.replace(/\s/g, '').length < 200) {
      return res.status(400).json({
        error: 'Could not extract enough readable text from this file.',
      });
    }

    console.log('[SUMMARIZE] EXTRACT FINISH', {
      name: fileName,
      mimeType,
      textLength: cleaned.length,
      at: new Date().toISOString(),
    });

    res.json({ text: cleaned, length: cleaned.length });
  } catch (error) {
    console.error('[SUMMARIZE] EXTRACT error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/materials/:id/summarize-file', authenticateToken, upload.single('file'), async (req, res) => {
  const materialId = req.params.id;

  try {
    const material = await db.querySingle(
      `SELECT m.id, m.name, m.subject_id, m.chapter_id, m.user_id, s.name AS subject_name
       FROM materials m
       LEFT JOIN subjects s ON s.id = m.subject_id
       WHERE m.id = ?`,
      [materialId]
    );

    if (!material) {
      console.warn('[SUMMARIZE] START failed: material not found', { materialId });
      return res.status(404).json({ error: 'Material not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const mimeType = req.file.mimetype || '';
    const fileName = req.file.originalname || material.name || 'uploaded file';
    let text = '';

    if (mimeType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')) {
      const parsed = await pdfParse(req.file.buffer);
      text = parsed.text || '';
    } else if (
      mimeType.includes('text') ||
      fileName.toLowerCase().endsWith('.txt') ||
      fileName.toLowerCase().endsWith('.md')
    ) {
      text = req.file.buffer.toString('utf8');
    } else {
      return res.status(400).json({ error: 'Unsupported file type for summarization. Upload a text-based PDF or TXT/MD file.' });
    }

    const cleaned = text
      .replace(/\0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (cleaned.length > 25000) {
      return res.status(413).json({ error: 'Payload too large: material content exceeds maximum limit (25,000 characters)' });
    }

    if (cleaned.replace(/\s/g, '').length < 200) {
      return res.status(400).json({ error: 'Could not extract enough readable text from this file.' });
    }

    const summarySchema = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
      },
      required: ['summary'],
      additionalProperties: false,
    };

    const prompt = `Ești un asistent de studiu concis pentru materia "${material.subject_name || 'Subject'}".
Rezuma materialul de mai jos clar, în aceeași limbă ca materialul.
Concentrează-te pe concepte cheie, definiții, relații și pași importanți.
Nu include introduceri de umplutură.
Răspunde strict în JSON cu cheia "summary".

Material:
${cleaned.slice(0, 12000)}`;

    const { Codex } = await import('@openai/codex-sdk');
    const codex = new Codex({ apiKey: process.env.OPENAI_API_KEY });
    const thread = codex.startThread({ skipGitRepoCheck: true });
    const turn = await runCodexWithTimeout(thread, prompt, { outputSchema: summarySchema });

    const validatedObj = validateSummary(turn.finalResponse);
    const summary = validatedObj.summary;

    await db.query(
      'UPDATE materials SET summary = ?, extracted_text = ?, is_summarized = 1 WHERE id = ?',
      [summary, cleaned, material.id]
    );

    const updated = await db.querySingle('SELECT * FROM materials WHERE id = ?', [material.id]);
    res.json(mapBools(updated, ['is_summarized', 'embedding_done']));
  } catch (error) {
    console.error('[SUMMARIZE] FAILED', {
      materialId,
      error: error.message,
      at: new Date().toISOString(),
    });

    if (error.name === 'AIValidationError') {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === 'AIParseError') {
      return res.status(422).json({ error: error.message });
    }
    if (error.message && error.message.includes('timeout')) {
      return res.status(504).json({ error: 'OpenAI request timed out' });
    }
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/materials/:id/summarize-start', async (req, res) => {
  const materialId = req.params.id;
  try {
    const material = await db.querySingle(
      'SELECT id, name, subject_id, chapter_id, user_id FROM materials WHERE id = ?',
      [materialId]
    );

    if (!material) {
      console.warn('[SUMMARIZE] START failed: material not found', { materialId });
      return res.status(404).json({ error: 'Material not found' });
    }

    console.log('[SUMMARIZE] START', {
      materialId: material.id,
      name: material.name,
      subjectId: material.subject_id,
      chapterId: material.chapter_id,
      userId: material.user_id,
      at: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[SUMMARIZE] START error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/materials/:id/summarize-failed', async (req, res) => {
  const materialId = req.params.id;
  const { error } = req.body || {};
  try {
    const material = await db.querySingle(
      'SELECT id, name, subject_id, chapter_id, user_id FROM materials WHERE id = ?',
      [materialId]
    );

    if (!material) {
      console.warn('[SUMMARIZE] FAILED: material not found', {
        materialId,
        error,
        at: new Date().toISOString(),
      });
      return res.status(404).json({ error: 'Material not found' });
    }

    console.error('[SUMMARIZE] FAILED', {
      materialId: material.id,
      name: material.name,
      subjectId: material.subject_id,
      chapterId: material.chapter_id,
      userId: material.user_id,
      error: error || 'Unknown summarization error',
      at: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (logError) {
    console.error('[SUMMARIZE] FAILED log error:', logError.message);
    res.status(500).json({ error: logError.message });
  }
});

app.put('/api/materials/:id/summary', async (req, res) => {
  const { summary } = req.body;
  const materialId = req.params.id;
  try {
    const material = await db.querySingle(
      'SELECT id, name, subject_id, chapter_id, user_id FROM materials WHERE id = ?',
      [materialId]
    );

    if (!material) {
      console.warn('[SUMMARIZE] FINISH failed: material not found', { materialId });
      return res.status(404).json({ error: 'Material not found' });
    }

    console.log('[SUMMARIZE] SAVING', {
      materialId: material.id,
      name: material.name,
      subjectId: material.subject_id,
      chapterId: material.chapter_id,
      userId: material.user_id,
      summaryLength: typeof summary === 'string' ? summary.length : 0,
      at: new Date().toISOString(),
    });

    await db.query(
      'UPDATE materials SET summary = ?, is_summarized = 1 WHERE id = ?',
      [summary, materialId]
    );

    console.log('[SUMMARIZE] FINISH', {
      materialId: material.id,
      name: material.name,
      subjectId: material.subject_id,
      chapterId: material.chapter_id,
      userId: material.user_id,
      at: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[SUMMARIZE] FINISH error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/materials/:id/embedded', async (req, res) => {
  try {
    await db.query('UPDATE materials SET embedding_done = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/materials/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM materials WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── STUDY SESSIONS & MISSIONS ───────────────────────────────

app.post('/api/sessions', async (req, res) => {
  const { user_id, session_type, planned_seconds, subject_id, chapter_ids, quiz_enabled } = req.body;
  const sessionId = generateUUID();
  try {
    // Create base session
    await db.query(
      `INSERT INTO study_sessions (id, user_id, session_type, planned_seconds, completed, subject_id)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [sessionId, user_id, session_type || 'casual', planned_seconds, subject_id || null]
    );

    // If mission session, create extension
    if (session_type === 'mission') {
      const missionId = generateUUID();
      await db.query(
        `INSERT INTO mission_sessions (id, session_id, user_id, selected_chapter_ids, quiz_enabled)
         VALUES (?, ?, ?, ?, ?)`,
        [
          missionId,
          sessionId,
          user_id,
          JSON.stringify(chapter_ids || []),
          quiz_enabled ? 1 : 0
        ]
      );
    }

    const session = await db.querySingle('SELECT * FROM study_sessions WHERE id = ?', [sessionId]);
    res.json(mapBools(session, ['completed']));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/recent', async (req, res) => {
  const { userId, limit } = req.query;
  const limitVal = parseInt(limit || '20', 10);
  try {
    const rows = await db.query(
      `SELECT * FROM study_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ${limitVal}`,
      [userId]
    );
    res.json(mapBoolsArray(rows, ['completed']));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const session = await db.querySingle(
      `SELECT s.*, sub.name AS subject_name 
       FROM study_sessions s 
       LEFT JOIN subjects sub ON sub.id = s.subject_id 
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(mapBools(session, ['completed']));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// RPC: COMPLETE SESSION
app.post('/api/sessions/:id/complete', async (req, res) => {
  const sessionId = req.params.id;
  const { durationSeconds, quizPassed, coopBonus } = req.body;
  
  try {
    const session = await db.querySingle('SELECT * FROM study_sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const userId = session.user_id;

    // 1. Mark session as complete
    await db.query(
      'UPDATE study_sessions SET completed = 1, duration_seconds = ?, abandoned_at = NULL WHERE id = ?',
      [durationSeconds, sessionId]
    );

    // 2. STREAK & MULTIPLIER LOGIC
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Upsert streak day record
    const streakRow = await db.querySingle('SELECT id, total_seconds FROM streaks WHERE user_id = ? AND study_date = ?', [userId, todayStr]);
    if (streakRow) {
      await db.query(
        'UPDATE streaks SET total_seconds = total_seconds + ?, session_count = session_count + 1 WHERE id = ?',
        [durationSeconds, streakRow.id]
      );
    } else {
      await db.query(
        'INSERT INTO streaks (id, user_id, study_date, total_seconds, session_count) VALUES (?, ?, ?, ?, 1)',
        [generateUUID(), userId, todayStr, durationSeconds]
      );
    }

    // Calculate current consecutive days
    const allStreaks = await db.query('SELECT study_date FROM streaks WHERE user_id = ? ORDER BY study_date DESC', [userId]);
    let currentStreak = 0;
    if (allStreaks.length > 0) {
      let tempDate = new Date();
      currentStreak = 0;
      
      // Let's loop and verify consecutive days
      for (let i = 0; i < allStreaks.length; i++) {
        const sDate = new Date(allStreaks[i].study_date);
        const diffTime = Math.abs(tempDate - sDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 1) {
          currentStreak++;
          tempDate = sDate;
        } else {
          break;
        }
      }
      if (currentStreak === 0) currentStreak = 1;
    } else {
      currentStreak = 1;
    }

    const user = await db.querySingle('SELECT longest_streak, crystal_balance FROM users WHERE id = ?', [userId]);
    const longestStreak = Math.max(user.longest_streak, currentStreak);
    const multiplier = Math.min(3.00, parseFloat((1.00 + (currentStreak * 0.05)).toFixed(2)));

    // Update user stats
    await db.query(
      `UPDATE users SET 
         streak_days = ?, 
         longest_streak = ?, 
         consistency_multiplier = ?, 
         total_study_seconds = total_study_seconds + ?
       WHERE id = ?`,
      [currentStreak, longestStreak, multiplier, durationSeconds, userId]
    );

    // 3. REWARD CALCULATION
    const mins = Math.ceil(durationSeconds / 60);
    let rewardType = 'crystals';
    let crystalAmount = 0;
    let itemName = null;
    let rarity = 'common';
    let description = '';
    let rewardId = generateUUID();
    let itemId = null;
    const consBonus = multiplier >= 1.20;

    if (durationSeconds < 1800) { // < 30 mins
      rewardType = 'crystals';
      crystalAmount = Math.ceil(mins * 2.0 * multiplier);
      rarity = 'common';
      description = `Ai câștigat ${crystalAmount} cristale pentru o sesiune de ${mins} minute.`;
    } else if (durationSeconds < 3600) { // 30-60 mins
      rewardType = 'crystals';
      crystalAmount = Math.ceil(mins * 3.5 * multiplier);
      rarity = 'common';
      description = `Ai câștigat ${crystalAmount} cristale pentru o sesiune de ${mins} minute.`;
    } else if (durationSeconds < 7200) { // 60-120 mins
      if (Math.random() < 0.40 || quizPassed) {
        rewardType = 'alien';
        itemName = ['Glimmer', 'Zyx', 'Blobkin', 'Flikko', 'Nudo'][Math.floor(Math.random() * 5)];
        rarity = quizPassed ? 'uncommon' : 'common';
        description = `Ai deblocat ${itemName}, un nou companion extraterestru!`;
      } else {
        rewardType = 'crystals';
        crystalAmount = Math.ceil(mins * 5.0 * multiplier);
        rarity = 'uncommon';
        description = `Ai câștigat ${crystalAmount} cristale pentru o sesiune concentrată de ${mins} minute.`;
      }
    } else { // 120+ mins
      if (quizPassed && coopBonus) {
        rewardType = 'cosmic_structure';
        itemName = ['Nebula Beacon', 'Star Gate', 'Void Monolith', 'Apex Spire'][Math.floor(Math.random() * 4)];
        rarity = 'legendary';
      } else if (quizPassed) {
        const types = ['rare_alien', 'planet', 'habitat'];
        rewardType = types[Math.floor(Math.random() * 3)];
        if (rewardType === 'rare_alien') itemName = ['Luminos', 'Vexor', 'Crystara', 'Orbitex'][Math.floor(Math.random() * 4)];
        else if (rewardType === 'planet') itemName = ['Nebula Prime', 'Ice World', 'Lava Rock', 'Drift World'][Math.floor(Math.random() * 4)];
        else itemName = ['Crystal Cave', 'Nebula Nest', 'Void Den', 'Spark Dome'][Math.floor(Math.random() * 4)];
        rarity = 'epic';
      } else if (coopBonus) {
        rewardType = 'coop_element';
        itemName = ['Sync Station', 'Unity Beacon', 'Bond Crystal', 'Orbit Link'][Math.floor(Math.random() * 4)];
        rarity = 'rare';
      } else {
        rewardType = Math.random() < 0.5 ? 'alien' : 'habitat';
        if (rewardType === 'alien') itemName = ['Moonling', 'Dustmite', 'Starshell', 'Quarklet'][Math.floor(Math.random() * 4)];
        else itemName = ['Glow Cave', 'Spark Dome', 'Dust Hive', 'Moon Burrow'][Math.floor(Math.random() * 4)];
        rarity = multiplier >= 1.5 ? 'rare' : 'uncommon';
      }
      description = `Ai deblocat ${itemName} după o sesiune epică de ${(durationSeconds / 3600).toFixed(1)} ore!`;
    }

    if (coopBonus && rewardType === 'crystals') {
      crystalAmount = Math.ceil(crystalAmount * 1.5);
    }

    // Create universe item if physical reward
    if (rewardType !== 'crystals') {
      itemId = generateUUID();
      await db.query(
        `INSERT INTO user_universe_items (id, user_id, item_type, item_name, rarity, placeholder_key, earned_from)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [itemId, userId, rewardType, itemName, rarity, rewardType, sessionId]
      );
    }

    // Create reward record
    await db.query(
      `INSERT INTO rewards (id, user_id, session_id, reward_type, crystal_amount, item_name, universe_item_id, rarity, consistency_bonus, coop_bonus, quiz_bonus, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rewardId, userId, sessionId, rewardType,
        crystalAmount || null, itemName || null, itemId || null, rarity,
        consBonus ? 1 : 0, coopBonus ? 1 : 0, quizPassed ? 1 : 0, description
      ]
    );

    // Apply crystals to user if crystals
    if (rewardType === 'crystals') {
      await db.query('UPDATE users SET crystal_balance = crystal_balance + ? WHERE id = ?', [crystalAmount, userId]);
    }

    // 4. RESOLVE WAGER
    const activeWager = await db.querySingle('SELECT * FROM wagers WHERE session_id = ? AND resolved = 0', [sessionId]);
    if (activeWager) {
      await db.query('UPDATE wagers SET resolved = 1, won = 1 WHERE id = ?', [activeWager.id]);
      
      // Return escrow
      if (activeWager.wager_type === 'crystals') {
        // Return active wager crystal escrow + double crystals as win reward!
        const winBonus = activeWager.crystal_amount * 2;
        await db.query('UPDATE users SET crystal_balance = crystal_balance + ? WHERE id = ?', [winBonus, userId]);
      } else {
        // Unlock wagered item
        await db.query('UPDATE user_universe_items SET is_active = 1 WHERE id = ?', [activeWager.universe_item_id]);
      }
    }

    // Fetch updated balance
    const updatedUser = await db.querySingle('SELECT crystal_balance FROM users WHERE id = ?', [userId]);

    res.json({
      reward_id: rewardId,
      reward_type: rewardType,
      crystal_amount: crystalAmount,
      item_name: itemName,
      rarity: rarity,
      consistency_bonus: consBonus,
      coop_bonus: !!coopBonus,
      quiz_bonus: !!quizPassed,
      description: description,
      universe_item_id: itemId,
      streak_days: currentStreak,
      consistency_multiplier: multiplier,
      crystal_balance: updatedUser.crystal_balance
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// RPC: ABANDON SESSION
app.post('/api/sessions/:id/abandon', async (req, res) => {
  const sessionId = req.params.id;
  const { durationSeconds } = req.body;

  try {
    const session = await db.querySingle('SELECT * FROM study_sessions WHERE id = ?', [sessionId]);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const userId = session.user_id;

    // 1. Mark session as abandoned
    await db.query(
      'UPDATE study_sessions SET duration_seconds = ?, completed = 0, abandoned_at = CURRENT_TIMESTAMP WHERE id = ?',
      [durationSeconds, sessionId]
    );

    // 2. Escrow wager lost
    const activeWager = await db.querySingle('SELECT * FROM wagers WHERE session_id = ? AND resolved = 0', [sessionId]);
    if (activeWager) {
      await db.query('UPDATE wagers SET resolved = 1, won = 0 WHERE id = ?', [activeWager.id]);
      // Note: Escrowed crystals are already deducted. Wagered items remain is_active = 0 (destroyed)
    }

    const completion = durationSeconds / Math.max(session.planned_seconds, 1);

    // Count partial study time if > 10% done
    if (completion > 0.10) {
      await db.query('UPDATE users SET total_study_seconds = total_study_seconds + ? WHERE id = ?', [durationSeconds, userId]);
    }

    // Penalty: if > 50% done, deactivate one random common alien or habitat
    if (completion > 0.50) {
      const randomItem = await db.querySingle(
        `SELECT id FROM user_universe_items 
         WHERE user_id = ? AND is_active = 1 AND rarity = 'common' AND item_type IN ('alien', 'habitat') 
         ORDER BY RAND() LIMIT 1`,
        [userId]
      );
      if (randomItem) {
        await db.query('UPDATE user_universe_items SET is_active = 0 WHERE id = ?', [randomItem.id]);
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── WAGERS ───────────────────────────────────────────────────

app.post('/api/wagers', async (req, res) => {
  const { session_id, user_id, wager_type, crystal_amount, item_id } = req.body;
  const wagerId = generateUUID();
  try {
    if (wager_type === 'crystals') {
      if (!crystal_amount || crystal_amount <= 0) {
        return res.status(400).json({ error: 'Crystal amount must be positive' });
      }
      const user = await db.querySingle('SELECT crystal_balance FROM users WHERE id = ?', [user_id]);
      if (user.crystal_balance < crystal_amount) {
        return res.status(400).json({ error: 'Insufficient crystals' });
      }
      // Escrow crystals
      await db.query('UPDATE users SET crystal_balance = crystal_balance - ? WHERE id = ?', [crystal_amount, user_id]);
    } else {
      const item = await db.querySingle('SELECT id FROM user_universe_items WHERE id = ? AND user_id = ? AND is_active = 1', [item_id, user_id]);
      if (!item) {
        return res.status(400).json({ error: 'Item not found or inactive' });
      }
      // Lock item
      await db.query('UPDATE user_universe_items SET is_active = 0 WHERE id = ?', [item_id]);
    }

    await db.query(
      `INSERT INTO wagers (id, session_id, user_id, wager_type, crystal_amount, universe_item_id, resolved)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [wagerId, session_id, user_id, wager_type, crystal_amount || null, item_id || null]
    );

    res.json(wagerId);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── UNIVERSE ITEMS ───────────────────────────────────────────

app.get('/api/universe-items', async (req, res) => {
  const { userId, activeOnly } = req.query;
  try {
    let rows;
    if (activeOnly === 'true') {
      rows = await db.query(
        'SELECT * FROM user_universe_items WHERE user_id = ? AND is_active = 1 ORDER BY earned_at DESC',
        [userId]
      );
    } else {
      rows = await db.query(
        'SELECT * FROM user_universe_items WHERE user_id = ? ORDER BY earned_at DESC',
        [userId]
      );
    }
    res.json(mapBoolsArray(rows, ['is_active']));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── REWARDS ──────────────────────────────────────────────────

app.get('/api/rewards/:id', async (req, res) => {
  try {
    const reward = await db.querySingle('SELECT * FROM rewards WHERE id = ?', [req.params.id]);
    res.json(mapBools(reward, ['consistency_bonus', 'coop_bonus', 'quiz_bonus']));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rewards', async (req, res) => {
  const { userId, limit } = req.query;
  const limitVal = parseInt(limit || '30', 10);
  try {
    const rows = await db.query(
      `SELECT * FROM rewards WHERE user_id = ? ORDER BY created_at DESC LIMIT ${limitVal}`,
      [userId]
    );
    res.json(mapBoolsArray(rows, ['consistency_bonus', 'coop_bonus', 'quiz_bonus']));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── FLASHCARDS ───────────────────────────────────────────────

app.get('/api/flashcards', async (req, res) => {
  const { subjectId, chapterId } = req.query;
  try {
    let rows;
    if (chapterId) {
      rows = await db.query('SELECT * FROM flashcards WHERE subject_id = ? AND chapter_id = ? ORDER BY created_at DESC', [subjectId, chapterId]);
    } else {
      rows = await db.query('SELECT * FROM flashcards WHERE subject_id = ? ORDER BY created_at DESC', [subjectId]);
    }
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/flashcards', async (req, res) => {
  const cards = req.body; // Array of cards
  try {
    const createdCards = [];
    for (const card of cards) {
      const id = generateUUID();
      await db.query(
        `INSERT INTO flashcards (id, subject_id, chapter_id, user_id, question, answer, difficulty, review_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, card.subject_id, card.chapter_id || null, card.user_id, card.question, card.answer, card.difficulty || 'medium', card.review_status || 'new']
      );
      const inserted = await db.querySingle('SELECT * FROM flashcards WHERE id = ?', [id]);
      createdCards.push(inserted);
    }
    res.json(createdCards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/flashcards/generate', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { subjectId, chapterId, count = 5 } = req.body;

  if (!subjectId) {
    return res.status(400).json({ error: 'subjectId is required' });
  }

  try {
    const subject = await db.querySingle('SELECT * FROM subjects WHERE id = ?', [subjectId]);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    const chapters = await db.query('SELECT id, name, description FROM chapters WHERE subject_id = ? ORDER BY order_index', [subjectId]);

    // Prefer summarized materials; fall back to all materials for the subject/chapter
    let materials;
    if (chapterId) {
      materials = await db.query('SELECT name, summary, extracted_text FROM materials WHERE subject_id = ? AND chapter_id = ?', [subjectId, chapterId]);
    } else {
      materials = await db.query('SELECT name, summary, extracted_text FROM materials WHERE subject_id = ?', [subjectId]);
    }

    console.log('[FLASHCARDS GENERATE] Materiale încărcate în context:', materials);

    const validTexts = materials
      .map(m => {
        const txt = (m.summary && String(m.summary).trim()) || (m.extracted_text && String(m.extracted_text).trim());
        return txt ? `Material (${m.name}):\n${txt}` : null;
      })
      .filter(Boolean);

    const hasRealText = validTexts.length > 0;
    const context = hasRealText
      ? validTexts.join('\n\n---\n\n').slice(0, 6000)
      : `Materia: ${subject.name}\nDescriere: ${subject.description || 'Notite generale de curs'}`;

    const prompt = `Ești un profesor expert. Generează exact ${count} flashcard-uri bazate pe fapte reale și concepte reale extrase strict din materialele de mai jos pentru materia "${subject.name}".

Context din documente (Materiale):
${context}

Reguli de grounding:
- Fiecare flashcard trebuie să testeze informații reale prezentate în materiale
- Întrebările trebuie să fie clare și concise
- Răspunsurile trebuie să fie informative dar scurte (1-3 propoziții)
- Distribuie dificultatea: ~30% easy, ~50% medium, ~20% hard
- Limba: română`;

    const flashcardSchema = {
      type: 'object',
      properties: {
        flashcards: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              answer: { type: 'string' },
              difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            },
            required: ['question', 'answer', 'difficulty'],
            additionalProperties: false,
          },
        },
      },
      required: ['flashcards'],
      additionalProperties: false,
    };

    let generated;
    try {
      const { Codex } = await import('@openai/codex-sdk');
      const codex = new Codex({ apiKey: process.env.OPENAI_API_KEY });
      const thread = codex.startThread({ skipGitRepoCheck: true });

      const aiPromise = runCodexWithTimeout(thread, prompt, { outputSchema: flashcardSchema, maxTokens: 1000, max_tokens: 1000 }, 0);
      const raceTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('AI_RACE_TIMEOUT')), 30000));

      const turn = await Promise.race([aiPromise, raceTimeout]);
      generated = validateFlashcards(turn.finalResponse);
    } catch (aiError) {
      console.warn('[FLASHCARDS GENERATE] AI took >15s or errored. Serving fast fallback flashcards:', aiError.message);
      generated = generateFallbackFlashcards(subject.name, materials);
    }

    // Save to DB
    const createdCards = [];
    for (const card of generated) {
      const id = generateUUID();
      await db.query(
        `INSERT INTO flashcards (id, subject_id, chapter_id, user_id, question, answer, difficulty, review_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, subjectId, chapterId || null, userId, card.question, card.answer, card.difficulty || 'medium', 'new']
      );
      const inserted = await db.querySingle('SELECT * FROM flashcards WHERE id = ?', [id]);
      createdCards.push(inserted);
    }

    res.json(createdCards);
  } catch (error) {
    console.error('[GENERATE] Error:', error.message);
    if (error.name === 'AIValidationError') {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === 'AIParseError') {
      return res.status(422).json({ error: error.message });
    }
    if (error.message && error.message.includes('timeout')) {
      return res.status(504).json({ error: 'OpenAI request timed out' });
    }
    res.status(500).json({ error: error.message });
  }
});


app.put('/api/flashcards/:id/status', async (req, res) => {
  const { review_status } = req.body;
  try {
    await db.query('UPDATE flashcards SET review_status = ? WHERE id = ?', [review_status, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/flashcards/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM flashcards WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── AI CHAT HISTORY ──────────────────────────────────────────

app.get('/api/chat', async (req, res) => {
  const { subjectId } = req.query;
  try {
    const rows = await db.query(
      'SELECT * FROM ai_chat_messages WHERE subject_id = ? ORDER BY created_at ASC',
      [subjectId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { subject_id, user_id, role, content } = req.body;
  const id = generateUUID();
  try {
    await db.query(
      'INSERT INTO ai_chat_messages (id, subject_id, user_id, role, content) VALUES (?, ?, ?, ?, ?)',
      [id, subject_id, user_id, role, content]
    );
    const msg = await db.querySingle('SELECT * FROM ai_chat_messages WHERE id = ?', [id]);
    res.json(msg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat/respond', authenticateToken, async (req, res) => {
  const { subject_id, message, history = [] } = req.body;

  if (!subject_id || !message || typeof message !== 'string') {
    return res.status(400).json({ error: 'subject_id and message are required' });
  }

  if (message.length > 25000) {
    return res.status(413).json({ error: 'Payload too large: message content exceeds maximum limit (25,000 characters)' });
  }

  try {
    const subject = await db.querySingle('SELECT * FROM subjects WHERE id = ?', [subject_id]);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const materials = await db.query(
      'SELECT id, name, summary, extracted_text, is_summarized FROM materials WHERE subject_id = ? ORDER BY created_at ASC',
      [subject_id]
    );

    console.log('[CHAT RESPOND] Materiale încărcate în context:', materials);

    const chapters = await db.query(
      'SELECT name, description FROM chapters WHERE subject_id = ? ORDER BY order_index ASC, created_at ASC',
      [subject_id]
    );

    const formattedMaterials = materials.map((m, index) => {
      const textContent = (m.summary && String(m.summary).trim()) || (m.extracted_text && String(m.extracted_text).trim());
      if (textContent) {
        return `Material ${index + 1} (${m.name}):\n${textContent}`;
      }
      return `Material ${index + 1} (${m.name}): [Fișier încărcat, nesumarizat încă]`;
    });

    const documentContext = formattedMaterials.length > 0
      ? formattedMaterials.join('\n\n---\n\n')
      : 'Nu există materiale sau documente încărcate pentru această materie.';

    const chapterContext = chapters.length
      ? chapters.map((c, index) => `${index + 1}. ${c.name}${c.description ? ` - ${c.description}` : ''}`).join('\n')
      : 'Nu există capitole create încă.';

    const recentHistory = Array.isArray(history)
      ? history
          .slice(-8)
          .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
          .map((m) => `${m.role === 'user' ? 'Student' : 'Assistant'}: ${m.content}`)
          .join('\n')
      : '';

    const responseSchema = {
      type: 'object',
      properties: {
        reply: { type: 'string' },
      },
      required: ['reply'],
      additionalProperties: false,
    };

    const prompt = `Ești un asistent de studiu inteligent și primitor pentru materia "${subject.name}".

Descriere materie:
${subject.description || 'Fără descriere'}

Capitole:
${chapterContext}

Context din documente (Materiale încărcate):
${documentContext}

Istoric conversație recentă:
${recentHistory || 'Fără mesaje anterioare.'}

Întrebarea studentului:
${message}

Instrucțiuni de răspuns:
1. Răspunde direct, clar și prietenos la întrebarea studentului.
2. Dacă studentul pune o întrebare generală (ex: concepte de algoritmi, noțiuni teoretice, definiri de termeni, întrebări generale de programare/știință), răspunde direct și complet pe baza cunoștințelor tale generale de specialitate, FĂRĂ să afișezi nicio formulă rigidă sau avertisment de tipul "Nu am găsit detalii în materiale".
3. Folosește informațiile din secțiunea "Context din documente" pentru a oferi detalii specifice cursului ori de câte ori sunt relevante.
4. Precizează lipsa informațiilor din materiale (ex: "Nu am găsit detalii despre acest subiect în materialele încărcate pentru această materie.") DOAR DACĂ studentul întreabă EXPLICIT ceva legat de documente sau suportul de curs (de exemplu: "ce scrie în curs?", "ce zice profesorul la pagina X?", "apare acest subiect în documentele atașate?").
5. Răspunde strict în format JSON conform schemei cu cheia "reply". Răspunsul trebuie să fie un text curat.`;

    const { Codex } = await import('@openai/codex-sdk');
    const codex = new Codex({ apiKey: process.env.OPENAI_API_KEY });
    const thread = codex.startThread({ skipGitRepoCheck: true });
    const turn = await runCodexWithTimeout(thread, prompt.slice(0, 24000), { outputSchema: responseSchema });

    const validated = validateChatReply(turn.finalResponse);
    return res.json({ reply: validated.reply, provider: 'openai' });
  } catch (error) {
    console.error('[CHAT RESPOND] Error:', error.message);
    if (error.name === 'AIValidationError') {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === 'AIParseError') {
      return res.status(422).json({ error: error.message });
    }
    if (error.status === 504 || (error.message && error.message.includes('timed out'))) {
      return res.status(504).json({ error: error.message || 'OpenAI request timed out' });
    }
    return res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});

app.post('/api/chat/explain-course', authenticateToken, async (req, res) => {
  const { subject_id } = req.body;

  if (!subject_id) {
    return res.status(400).json({ error: 'subject_id is required' });
  }

  try {
    const subject = await db.querySingle('SELECT * FROM subjects WHERE id = ?', [subject_id]);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const materials = await db.query(
      'SELECT id, name, summary, extracted_text, is_summarized FROM materials WHERE subject_id = ? ORDER BY created_at ASC',
      [subject_id]
    );

    console.log('[CHAT EXPLAIN] Materiale încărcate în context:', materials);

    const chapters = await db.query(
      'SELECT name, description FROM chapters WHERE subject_id = ? ORDER BY order_index ASC, created_at ASC',
      [subject_id]
    );

    const formattedMaterials = materials.map((m, index) => {
      const textContent = (m.summary && String(m.summary).trim()) || (m.extracted_text && String(m.extracted_text).trim());
      if (textContent) {
        return `Material ${index + 1} (${m.name}):\n${textContent}`;
      }
      return `Material ${index + 1} (${m.name}): [Fișier încărcat, nesumarizat încă]`;
    });

    const documentContext = formattedMaterials.length > 0
      ? formattedMaterials.join('\n\n---\n\n')
      : 'Nu există materiale sau documente încărcate pentru această materie.';

    const chapterContext = chapters.length
      ? chapters.map((c, index) => `${index + 1}. ${c.name}${c.description ? ` - ${c.description}` : ''}`).join('\n')
      : 'Nu există capitole create încă.';

    const responseSchema = {
      type: 'object',
      properties: {
        explanation: { type: 'string' },
      },
      required: ['explanation'],
      additionalProperties: false,
    };

    const prompt = `Ești un profesor care explică materia "${subject.name}".

Descriere materie:
${subject.description || 'Fără descriere'}

Capitole:
${chapterContext}

Context din documente (Materiale încărcate):
${documentContext}

Instrucțiuni stricte de Grounding și explicație:
1. Construiește o explicație structurată a cursului bazându-te pe informațiile din secțiunea "Context din documente".
2. Dacă nu există materiale încărcate sau conținutul lor este indisponibil, precizează explicit acest lucru înainte de a oferi o privire de ansamblu generală.
3. Răspunde strict în JSON cu cheia "explanation".`;

    const { Codex } = await import('@openai/codex-sdk');
    const codex = new Codex({ apiKey: process.env.OPENAI_API_KEY });
    const thread = codex.startThread({ skipGitRepoCheck: true });
    const turn = await runCodexWithTimeout(thread, prompt.slice(0, 24000), { outputSchema: responseSchema });

    const validated = validateChatReply(turn.finalResponse);
    return res.json({ explanation: validated.reply, provider: 'openai' });
  } catch (error) {
    console.error('[CHAT EXPLAIN] Error:', error.message);
    if (error.name === 'AIValidationError') {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === 'AIParseError') {
      return res.status(422).json({ error: error.message });
    }
    if (error.status === 504 || (error.message && error.message.includes('timed out'))) {
      return res.status(504).json({ error: error.message || 'OpenAI request timed out' });
    }
    return res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  }
});


// ── QUIZZES ──────────────────────────────────────────────────

app.post('/api/quizzes', async (req, res) => {
  const { session_id, user_id, total_questions } = req.body;
  const id = generateUUID();
  try {
    await db.query(
      'INSERT INTO quizzes (id, session_id, user_id, status, total_questions) VALUES (?, ?, ?, "pending", ?)',
      [id, session_id, user_id, total_questions]
    );
    const quiz = await db.querySingle('SELECT * FROM quizzes WHERE id = ?', [id]);
    res.json(quiz);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/quizzes/:id', async (req, res) => {
  try {
    const quiz = await db.querySingle('SELECT * FROM quizzes WHERE id = ?', [req.params.id]);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    const questions = await db.query('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC', [req.params.id]);
    
    // Parse options JSON
    const parsedQuestions = questions.map(q => {
      if (q.options) {
        try { q.options = JSON.parse(q.options); } catch (e) {}
      }
      return q;
    });

    res.json({ ...quiz, questions: parsedQuestions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/quizzes/answers', async (req, res) => {
  const { quiz_id, question_id, user_id, user_answer, is_correct } = req.body;
  const id = generateUUID();
  try {
    await db.query(
      `INSERT INTO quiz_answers (id, quiz_id, question_id, user_id, user_answer, is_correct)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_answer = VALUES(user_answer), is_correct = VALUES(is_correct)`,
      [id, quiz_id, question_id, user_id, user_answer, is_correct ? 1 : 0]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/quizzes/generate', authenticateToken, async (req, res) => {
  const { subjectId, chapterIds, count = 5 } = req.body;
  if (!subjectId) return res.status(400).json({ error: 'subjectId is required' });

  try {
    const subject = await db.querySingle('SELECT * FROM subjects WHERE id = ?', [subjectId]);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    // Get material context — prefer summarized or extracted text
    let materials;
    if (chapterIds && chapterIds.length > 0) {
      const placeholders = chapterIds.map(() => '?').join(',');
      materials = await db.query(
        `SELECT name, summary, extracted_text FROM materials WHERE subject_id = ? AND chapter_id IN (${placeholders})`,
        [subjectId, ...chapterIds]
      );
    } else {
      materials = await db.query('SELECT name, summary, extracted_text FROM materials WHERE subject_id = ?', [subjectId]);
    }

    console.log('[QUIZ GENERATE] Materiale încărcate în context:', materials);

    const validTexts = materials
      .map(m => {
        const txt = (m.summary && String(m.summary).trim()) || (m.extracted_text && String(m.extracted_text).trim());
        return txt ? `Material (${m.name}):\n${txt}` : null;
      })
      .filter(Boolean);

    const hasRealText = validTexts.length > 0;
    const targetCount = Math.min(count || 5, 5);

    const context = hasRealText
      ? validTexts.join('\n\n---\n\n').slice(0, 6000)
      : `Materia: ${subject.name}\nDescriere: ${subject.description || 'Notite generale de curs'}`;

    const prompt = `Ești un profesor expert și generator de quiz-uri pentru materia "${subject.name}".

Context din documente (Materiale încărcate):
${context}

INSTRUCȚIUNI STRICTE DE GROUNDING ȘI ADEVĂR:
${hasRealText
  ? `1. Generează strict ${targetCount} întrebări extrase EXCLUSIV din faptele, definițiile și conceptele REALE prezentate în secțiunea "Context din documente".
2. Nu inventa informații exterioare sau speculații care nu se regăsesc în textul furnizat.
3. Răspunsul corect și explicația trebuie să fie 100% fidele textului din materiale.`
  : `1. Generează strict ${targetCount} întrebări fundamentale bazate pe materia "${subject.name}".`}

Reguli de formatare STRICTE:
- Toate întrebările TREBUIE să fie EXCLUSIV de tip 'multiple_choice' (grilă cu 4 variante de răspuns). NU folosi short_answer sau true_false.
- Fiecare întrebare TREBUIE să aibă exact 4 opțiuni de răspuns în vectorul 'options'.
- correct_answer: trebuie să fie exact unul dintre cele 4 string-uri prezente în vectorul 'options'.
- explanation: o singură propoziție scurtă (sub 25 de cuvinte) bazată pe text.
- Limba: română.`;

    const quizSchema = {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question_text: { type: 'string' },
              question_type: { type: 'string', enum: ['multiple_choice'] },
              options: { type: 'array', items: { type: 'string' } },
              correct_answer: { type: 'string' },
              explanation: { type: 'string' },
            },
            required: ['question_text', 'question_type', 'options', 'correct_answer', 'explanation'],
            additionalProperties: false,
          },
        },
      },
      required: ['questions'],
      additionalProperties: false,
    };

    try {
      const { Codex } = await import('@openai/codex-sdk');
      const codex = new Codex({ apiKey: process.env.OPENAI_API_KEY });
      const thread = codex.startThread({ skipGitRepoCheck: true });

      const aiPromise = runCodexWithTimeout(thread, prompt, { outputSchema: quizSchema, maxTokens: 1000, max_tokens: 1000 }, 0);
      const raceTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('AI_RACE_TIMEOUT')), 30000));

      const turn = await Promise.race([aiPromise, raceTimeout]);
      const questions = validateQuiz(turn.finalResponse);
      return res.json(questions);
    } catch (aiError) {
      console.warn('[QUIZ GENERATE] AI took >15s or errored. Serving fast fallback quiz:', aiError.message);
      const fallbackQuestions = generateFallbackQuiz(subject.name, materials);
      return res.json(fallbackQuestions);
    }
  } catch (error) {
    console.error('[QUIZ GENERATE] Error:', error.message);
    const fallbackQuestions = generateFallbackQuiz('Materie de studiu', []);
    return res.json(fallbackQuestions);
  }
});


app.post('/api/quizzes/:id/finalize', async (req, res) => {
  const quizId = req.params.id;
  const { correctAnswers } = req.body;
  try {
    const quiz = await db.querySingle('SELECT total_questions, pass_score FROM quizzes WHERE id = ?', [quizId]);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const score = Math.round((correctAnswers / quiz.total_questions) * 100);
    const status = score >= quiz.pass_score ? 'passed' : 'failed';

    await db.query(
      'UPDATE quizzes SET status = ?, correct_answers = ? WHERE id = ?',
      [status, correctAnswers, quizId]
    );

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── DAILY STUDY STREAKS ──────────────────────────────────────

app.get('/api/streaks', async (req, res) => {
  const { userId, days } = req.query;
  const daysVal = parseInt(days || '30', 10);
  try {
    const since = new Date();
    since.setDate(since.getDate() - daysVal);
    const sinceStr = since.toISOString().split('T')[0];

    const rows = await db.query(
      `SELECT * FROM streaks 
       WHERE user_id = ? AND study_date >= ?
       ORDER BY study_date DESC`,
      [userId, sinceStr]
    );

    // Format study_date to YYYY-MM-DD to avoid timezone/ISO string mismatch in client calendar mappings
    const formatted = rows.map(r => {
      let dStr = r.study_date;
      if (dStr instanceof Date) {
        // Adjust for timezone offset to get correct YYYY-MM-DD
        const year = dStr.getFullYear();
        const month = String(dStr.getMonth() + 1).padStart(2, '0');
        const day = String(dStr.getDate()).padStart(2, '0');
        dStr = `${year}-${month}-${day}`;
      } else if (typeof dStr === 'string') {
        dStr = dStr.split('T')[0];
      }
      return { ...r, study_date: dStr };
    });

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── FRIENDSHIPS ──────────────────────────────────────────────

app.get('/api/friendships', async (req, res) => {
  const { userId } = req.query;
  try {
    const rows = await db.query('SELECT * FROM users WHERE id <> ? LIMIT 10', [userId]);
    res.json(rows); // Dummy return of other users as friends since co-op is simulated
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── SEED AI QUIZ/FLASHCARD GENERATION HELPER ──────────────────

app.post('/api/quiz-questions/batch', async (req, res) => {
  const { quiz_id, questions } = req.body; // array of questions
  try {
    for (const q of questions) {
      const id = generateUUID();
      await db.query(
        `INSERT INTO quiz_questions (id, quiz_id, question_text, question_type, options, correct_answer, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          quiz_id,
          q.question_text,
          q.question_type || 'multiple_choice',
          q.options ? JSON.stringify(q.options) : null,
          q.correct_answer,
          q.order_index || 0
        ]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── COOPERATIVE ROOMS (CO-OP) ────────────────────────────────

// 1. Create a Co-op Room
app.post('/api/coop/rooms', authenticateToken, async (req, res) => {
  const { durationSeconds, joinCode } = req.body;
  const userId = req.user.id;

  if (!durationSeconds || !joinCode) {
    return res.status(400).json({ error: 'Duration and join code are required' });
  }

  try {
    const roomId = generateUUID();
    const cleanJoinCode = joinCode.toUpperCase().trim();

    // Check if code exists
    const codeExists = await db.querySingle('SELECT id FROM coop_rooms WHERE join_code = ? AND status != "completed"', [cleanJoinCode]);
    if (codeExists) {
      return res.status(400).json({ error: 'Codul de cameră este deja folosit activ.' });
    }

    // Insert room
    await db.query(
      `INSERT INTO coop_rooms (id, created_by, join_code, duration_seconds, status) VALUES (?, ?, ?, ?, 'waiting')`,
      [roomId, userId, cleanJoinCode, durationSeconds]
    );

    // Insert member (creator)
    const memberId = generateUUID();
    await db.query(
      `INSERT INTO coop_room_members (id, room_id, user_id, status) VALUES (?, ?, ?, 'joined')`,
      [memberId, roomId, userId]
    );

    res.json({
      id: roomId,
      created_by: userId,
      join_code: cleanJoinCode,
      duration_seconds: durationSeconds,
      status: 'waiting',
      started_at: null,
      completed_at: null,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get Co-op Room details (for polling)
app.get('/api/coop/rooms/:roomId', authenticateToken, async (req, res) => {
  const { roomId } = req.params;

  try {
    const room = await db.querySingle('SELECT * FROM coop_rooms WHERE id = ?', [roomId]);
    if (!room) {
      return res.status(404).json({ error: 'Camera nu a fost găsită' });
    }

    res.json(mapBools(room, []));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Find Room by Code
app.get('/api/coop/rooms/code/:code', authenticateToken, async (req, res) => {
  const { code } = req.params;
  const cleanCode = code.toUpperCase().trim();

  try {
    const room = await db.querySingle(
      'SELECT * FROM coop_rooms WHERE join_code = ? AND status != "completed"',
      [cleanCode]
    );
    if (!room) {
      return res.status(404).json({ error: 'Nu există nicio cameră activă cu acest cod' });
    }
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Join a Room
app.post('/api/coop/rooms/join', authenticateToken, async (req, res) => {
  const { joinCode } = req.body;
  const userId = req.user.id;

  if (!joinCode) {
    return res.status(400).json({ error: 'Codul de cameră este necesar' });
  }

  try {
    const cleanCode = joinCode.toUpperCase().trim();
    const room = await db.querySingle(
      'SELECT * FROM coop_rooms WHERE join_code = ? AND status = "waiting"',
      [cleanCode]
    );

    if (!room) {
      return res.status(404).json({ error: 'Cameră inactivă sau plină' });
    }

    const roomId = room.id;

    // Check if already member
    const existing = await db.querySingle(
      'SELECT id FROM coop_room_members WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );

    if (!existing) {
      const memberId = generateUUID();
      await db.query(
        'INSERT INTO coop_room_members (id, room_id, user_id, status) VALUES (?, ?, ?, "joined")',
        [memberId, roomId, userId]
      );
    }

    res.json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Get Co-op Members
app.get('/api/coop/rooms/:roomId/members', authenticateToken, async (req, res) => {
  const { roomId } = req.params;

  try {
    const members = await db.query(
      `SELECT m.*, u.username, u.avatar_url 
       FROM coop_room_members m
       JOIN users u ON m.user_id = u.id
       WHERE m.room_id = ?`,
      [roomId]
    );

    // Map rows to structure matching client
    const mapped = members.map(m => ({
      id: m.id,
      room_id: m.room_id,
      user_id: m.user_id,
      status: m.status,
      joined_at: m.joined_at,
      users: {
        username: m.username,
        avatar_url: m.avatar_url
      }
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Update Member Status (completed, abandoned, accepted)
app.post('/api/coop/rooms/:roomId/members/status', authenticateToken, async (req, res) => {
  const { roomId } = req.params;
  const { status } = req.body;
  const userId = req.user.id;

  try {
    await db.query(
      'UPDATE coop_room_members SET status = ? WHERE room_id = ? AND user_id = ?',
      [status, roomId, userId]
    );

    // If setting to accepted, check if everyone is accepted!
    if (status === 'accepted') {
      const members = await db.query('SELECT status FROM coop_room_members WHERE room_id = ?', [roomId]);
      const allAccepted = members.every(m => m.status === 'accepted');

      if (allAccepted) {
        // Start the room!
        const nowStr = new Date().toISOString();
        await db.query(
          'UPDATE coop_rooms SET status = "active", started_at = ? WHERE id = ?',
          [nowStr, roomId]
        );

        // Transition all member statuses to 'active'
        await db.query(
          'UPDATE coop_room_members SET status = "active" WHERE room_id = ?',
          [roomId]
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Request Start (Creator only) - Transitions to 'starting'
app.post('/api/coop/rooms/:roomId/start', authenticateToken, async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.id;

  try {
    const room = await db.querySingle('SELECT created_by FROM coop_rooms WHERE id = ?', [roomId]);
    if (!room || room.created_by !== userId) {
      return res.status(403).json({ error: 'Doar creatorul camerei poate iniția startul' });
    }

    // Change room status to starting
    await db.query('UPDATE coop_rooms SET status = "starting" WHERE id = ?', [roomId]);

    // Mark creator as automatically accepted
    await db.query(
      'UPDATE coop_room_members SET status = "accepted" WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );

    // Check if everyone is accepted (if they are alone in room)
    const members = await db.query('SELECT status FROM coop_room_members WHERE room_id = ?', [roomId]);
    const allAccepted = members.every(m => m.status === 'accepted');

    if (allAccepted) {
      const nowStr = new Date().toISOString();
      await db.query(
        'UPDATE coop_rooms SET status = "active", started_at = ? WHERE id = ?',
        [nowStr, roomId]
      );
      await db.query(
        'UPDATE coop_room_members SET status = "active" WHERE room_id = ?',
        [roomId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Add Shared Material to Room
app.post('/api/coop/rooms/:roomId/materials', authenticateToken, async (req, res) => {
  const { roomId } = req.params;
  const { materialId } = req.body;

  if (!materialId) {
    return res.status(400).json({ error: 'Material ID-ul este obligatoriu' });
  }

  try {
    // Check duplicate
    const exists = await db.querySingle(
      'SELECT id FROM coop_room_materials WHERE room_id = ? AND material_id = ?',
      [roomId, materialId]
    );

    if (!exists) {
      const id = generateUUID();
      await db.query(
        'INSERT INTO coop_room_materials (id, room_id, material_id) VALUES (?, ?, ?)',
        [id, roomId, materialId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Get Shared Materials in Room
app.get('/api/coop/rooms/:roomId/materials', authenticateToken, async (req, res) => {
  const { roomId } = req.params;

  try {
    const materials = await db.query(
      `SELECT m.* 
       FROM coop_room_materials rm
       JOIN materials m ON rm.material_id = m.id
       WHERE rm.room_id = ?`,
      [roomId]
    );

    res.json(mapBoolsArray(materials, ['is_summarized', 'embedding_done']));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Complete Room (Creator or auto)
app.post('/api/coop/rooms/:roomId/complete', authenticateToken, async (req, res) => {
  const { roomId } = req.params;

  try {
    const nowStr = new Date().toISOString();
    await db.query(
      'UPDATE coop_rooms SET status = "completed", completed_at = ? WHERE id = ?',
      [nowStr, roomId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// 11. Kick Member from Room (Creator only)
app.delete('/api/coop/rooms/:roomId/members/:userId', authenticateToken, async (req, res) => {
  const { roomId, userId } = req.params;
  const requesterId = req.user.id;

  try {
    const room = await db.querySingle('SELECT created_by FROM coop_rooms WHERE id = ?', [roomId]);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.created_by !== requesterId) return res.status(403).json({ error: 'Only the creator can kick members' });
    if (userId === requesterId) return res.status(400).json({ error: 'Cannot kick yourself' });

    await db.query('DELETE FROM coop_room_members WHERE room_id = ? AND user_id = ?', [roomId, userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 12. Toggle Ready Status (Member only, in waiting state)
app.post('/api/coop/rooms/:roomId/members/ready', authenticateToken, async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.id;
  const { ready } = req.body; // true = ready (accepted), false = not ready (joined)

  try {
    const newStatus = ready ? 'accepted' : 'joined';
    await db.query(
      'UPDATE coop_room_members SET status = ? WHERE room_id = ? AND user_id = ?',
      [newStatus, roomId, userId]
    );
    res.json({ success: true, status: newStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 13. Start Timer (Creator only - all members must be ready)
app.post('/api/coop/rooms/:roomId/start-timer', authenticateToken, async (req, res) => {
  const { roomId } = req.params;
  const requesterId = req.user.id;

  try {
    const room = await db.querySingle('SELECT created_by, status FROM coop_rooms WHERE id = ?', [roomId]);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.created_by !== requesterId) return res.status(403).json({ error: 'Only the creator can start the session' });
    if (room.status !== 'waiting') return res.status(400).json({ error: 'Room is not in waiting state' });

    const members = await db.query('SELECT user_id, status FROM coop_room_members WHERE room_id = ?', [roomId]);
    const notReady = members.filter(m => m.user_id !== requesterId && m.status !== 'accepted');
    if (notReady.length > 0) return res.status(400).json({ error: 'Not all members are ready' });

    const nowStr = new Date().toISOString();
    await db.query('UPDATE coop_rooms SET status = "active", started_at = ? WHERE id = ?', [nowStr, roomId]);
    await db.query('UPDATE coop_room_members SET status = "active" WHERE room_id = ?', [roomId]);
    res.json({ success: true, started_at: nowStr });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 14. Pause Timer (any member)
app.post('/api/coop/rooms/:roomId/pause', authenticateToken, async (req, res) => {
  const { roomId } = req.params;

  try {
    const room = await db.querySingle('SELECT status, is_paused FROM coop_rooms WHERE id = ?', [roomId]);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.status !== 'active') return res.status(400).json({ error: 'Room is not active' });
    if (room.is_paused) return res.json({ success: true, already: true });

    const nowStr = new Date().toISOString();
    await db.query('UPDATE coop_rooms SET is_paused = 1, paused_at = ? WHERE id = ?', [nowStr, roomId]);
    res.json({ success: true, paused_at: nowStr });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 15. Resume Timer (any member)
app.post('/api/coop/rooms/:roomId/resume', authenticateToken, async (req, res) => {
  const { roomId } = req.params;

  try {
    const room = await db.querySingle('SELECT status, is_paused, paused_at, paused_seconds FROM coop_rooms WHERE id = ?', [roomId]);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.status !== 'active') return res.status(400).json({ error: 'Room is not active' });
    if (!room.is_paused) return res.json({ success: true, already: true });

    const pausedDurationMs = room.paused_at ? (Date.now() - new Date(room.paused_at).getTime()) : 0;
    const addedSeconds = Math.round(pausedDurationMs / 1000);
    const newPausedSeconds = (room.paused_seconds || 0) + addedSeconds;

    await db.query(
      'UPDATE coop_rooms SET is_paused = 0, paused_at = NULL, paused_seconds = ? WHERE id = ?',
      [newPausedSeconds, roomId]
    );
    res.json({ success: true, paused_seconds: newPausedSeconds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 16. Abandon Session (any member can stop, marks room completed)
app.post('/api/coop/rooms/:roomId/abandon', authenticateToken, async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.id;

  try {
    await db.query(
      'UPDATE coop_room_members SET status = "abandoned" WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );
    const nowStr = new Date().toISOString();
    await db.query(
      'UPDATE coop_rooms SET status = "completed", completed_at = ? WHERE id = ?',
      [nowStr, roomId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Start Express Server
if (process.env.NODE_ENV !== 'test') {
  db.initializeDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`StudyVerse local MySQL backend running on http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error('Failed to initialize database schema, server shutting down...', err);
    process.exit(1);
  });
}

// Attach helpers for unit testing
app.mapBools = mapBools;
app.mapBoolsArray = mapBoolsArray;
app.generateUUID = generateUUID;
app.authenticateToken = authenticateToken;

module.exports = app;
