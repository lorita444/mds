require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { crypto } = require('crypto'); // Built-in Node.js crypto
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'studyverse_secret_key_2026';

app.use(cors());
app.use(express.json());

// Helper to generate UUIDs
function generateUUID() {
  return require('crypto').randomUUID();
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

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
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

    const token = jwt.sign({ id: userId, email, username }, JWT_SECRET, { expiresIn: '30d' });
    const userProfile = await db.querySingle('SELECT id, email, username, avatar_url, crystal_balance, streak_days, longest_streak, consistency_multiplier, total_study_seconds, created_at FROM users WHERE id = ?', [userId]);

    res.status(201).json({
      session: { access_token: token },
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

    const token = jwt.sign({ id: user.id, email: user.email, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    
    // Remove password
    delete user.password;

    res.json({
      session: { access_token: token },
      user: mapBools(user, [])
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Authentication failed' });
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
      [id, user_id, name, description, color || '#7c3aed', emoji || '📚']
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
      [name, description, color, emoji, req.params.id]
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
  const { subject_id, name, order_index } = req.body;
  const id = generateUUID();
  try {
    await db.query(
      'INSERT INTO chapters (id, subject_id, name, order_index) VALUES (?, ?, ?, ?)',
      [id, subject_id, name, order_index || 0]
    );
    const chapter = await db.querySingle('SELECT * FROM chapters WHERE id = ?', [id]);
    res.json(chapter);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/chapters/:id', async (req, res) => {
  const { name, order_index } = req.body;
  try {
    await db.query(
      'UPDATE chapters SET name = COALESCE(?, name), order_index = COALESCE(?, order_index) WHERE id = ?',
      [name, order_index, req.params.id]
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
  const { subjectId, chapterId } = req.query;
  try {
    let rows;
    if (chapterId) {
      rows = await db.query('SELECT * FROM materials WHERE chapter_id = ? ORDER BY created_at ASC', [chapterId]);
    } else {
      rows = await db.query('SELECT * FROM materials WHERE subject_id = ? ORDER BY created_at ASC', [subjectId]);
    }
    res.json(mapBoolsArray(rows, ['is_summarized', 'embedding_done']));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/materials', async (req, res) => {
  const { subject_id, chapter_id, user_id, name, file_url, file_type, size_bytes } = req.body;
  const id = generateUUID();
  try {
    await db.query(
      `INSERT INTO materials (id, subject_id, chapter_id, user_id, name, file_url, file_type, size_bytes, is_summarized, embedding_done)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [id, subject_id, chapter_id || null, user_id, name, file_url, file_type, size_bytes || 0]
    );
    const material = await db.querySingle('SELECT * FROM materials WHERE id = ?', [id]);
    res.json(mapBools(material, ['is_summarized', 'embedding_done']));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/materials/:id/summary', async (req, res) => {
  const { summary } = req.body;
  try {
    await db.query(
      'UPDATE materials SET summary = ?, is_summarized = 1 WHERE id = ?',
      [summary, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
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
    res.json(rows);
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

// Start Express Server
db.initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`StudyVerse local MySQL backend running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database schema, server shutting down...', err);
  process.exit(1);
});
