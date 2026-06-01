require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3307', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'mata',
  database: process.env.DB_NAME || 'studyverse',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function query(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function querySingle(sql, params) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function initializeDatabase() {
  console.log('Initializing MySQL Database Schema...');
  const connection = await pool.getConnection();
  try {
    // Enable transactional security if needed, but simple tables DDL is fine.
    
    // 1. Users
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        avatar_url TEXT NULL,
        crystal_balance INT NOT NULL DEFAULT 50,
        streak_days INT NOT NULL DEFAULT 0,
        longest_streak INT NOT NULL DEFAULT 0,
        consistency_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
        total_study_seconds INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 2. Subjects
    await connection.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        color VARCHAR(50) NOT NULL DEFAULT '#7c3aed',
        emoji VARCHAR(50) NOT NULL DEFAULT '📚',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 3. Chapters
    await connection.query(`
      CREATE TABLE IF NOT EXISTS chapters (
        id VARCHAR(36) PRIMARY KEY,
        subject_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        order_index INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    try {
      await connection.query('ALTER TABLE chapters ADD COLUMN description TEXT NULL');
      console.log('Successfully added description column to chapters table.');
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error migrating chapters table:', err.message);
      }
    }


    // 4. Materials
    await connection.query(`
      CREATE TABLE IF NOT EXISTS materials (
        id VARCHAR(36) PRIMARY KEY,
        subject_id VARCHAR(36) NOT NULL,
        chapter_id VARCHAR(36) NULL,
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        size_bytes BIGINT NOT NULL DEFAULT 0,
        summary TEXT NULL,
        is_summarized TINYINT(1) NOT NULL DEFAULT 0,
        embedding_done TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 5. Study Sessions
    await connection.query(`
      CREATE TABLE IF NOT EXISTS study_sessions (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        session_type VARCHAR(50) NOT NULL DEFAULT 'casual',
        duration_seconds INT NOT NULL DEFAULT 0,
        planned_seconds INT NOT NULL,
        completed TINYINT(1) NOT NULL DEFAULT 0,
        abandoned_at TIMESTAMP NULL DEFAULT NULL,
        subject_id VARCHAR(36) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    // 6. Mission Sessions
    await connection.query(`
      CREATE TABLE IF NOT EXISTS mission_sessions (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL UNIQUE,
        user_id VARCHAR(36) NOT NULL,
        ai_estimated_seconds INT NULL,
        selected_chapter_ids TEXT NOT NULL, -- JSON list of chapter IDs
        quiz_enabled TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 7. Quizzes
    await connection.query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL UNIQUE,
        user_id VARCHAR(36) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        total_questions INT NOT NULL DEFAULT 0,
        correct_answers INT NULL,
        pass_score INT NOT NULL DEFAULT 80,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 8. Quiz Questions
    await connection.query(`
      CREATE TABLE IF NOT EXISTS quiz_questions (
        id VARCHAR(36) PRIMARY KEY,
        quiz_id VARCHAR(36) NOT NULL,
        question_text TEXT NOT NULL,
        question_type VARCHAR(50) NOT NULL DEFAULT 'multiple_choice',
        options TEXT NULL, -- JSON array of options
        correct_answer TEXT NOT NULL,
        order_index INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 9. Quiz Answers
    await connection.query(`
      CREATE TABLE IF NOT EXISTS quiz_answers (
        id VARCHAR(36) PRIMARY KEY,
        quiz_id VARCHAR(36) NOT NULL,
        question_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        user_answer TEXT NOT NULL,
        is_correct TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_quiz_question_user (quiz_id, question_id, user_id),
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 10. User Universe Items
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_universe_items (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        item_type VARCHAR(100) NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        rarity VARCHAR(50) NOT NULL DEFAULT 'common',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        placeholder_key VARCHAR(255) NOT NULL DEFAULT 'alien',
        position_x DECIMAL(10,2) NULL,
        position_y DECIMAL(10,2) NULL,
        earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        earned_from VARCHAR(255) NOT NULL DEFAULT 'signup',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 11. Rewards
    await connection.query(`
      CREATE TABLE IF NOT EXISTS rewards (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        session_id VARCHAR(36) NULL,
        reward_type VARCHAR(100) NOT NULL,
        crystal_amount INT NULL,
        item_name VARCHAR(255) NULL,
        universe_item_id VARCHAR(36) NULL,
        rarity VARCHAR(50) NOT NULL DEFAULT 'common',
        consistency_bonus TINYINT(1) NOT NULL DEFAULT 0,
        coop_bonus TINYINT(1) NOT NULL DEFAULT 0,
        quiz_bonus TINYINT(1) NOT NULL DEFAULT 0,
        description TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE SET NULL,
        FOREIGN KEY (universe_item_id) REFERENCES user_universe_items(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    // 12. Wagers
    await connection.query(`
      CREATE TABLE IF NOT EXISTS wagers (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        wager_type VARCHAR(50) NOT NULL DEFAULT 'crystals',
        crystal_amount INT NULL,
        universe_item_id VARCHAR(36) NULL,
        resolved TINYINT(1) NOT NULL DEFAULT 0,
        won TINYINT(1) NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (universe_item_id) REFERENCES user_universe_items(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    // 13. Flashcards
    await connection.query(`
      CREATE TABLE IF NOT EXISTS flashcards (
        id VARCHAR(36) PRIMARY KEY,
        subject_id VARCHAR(36) NOT NULL,
        chapter_id VARCHAR(36) NULL,
        user_id VARCHAR(36) NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        difficulty VARCHAR(50) NOT NULL DEFAULT 'medium',
        review_status VARCHAR(50) NOT NULL DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 14. AI Chat Messages
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ai_chat_messages (
        id VARCHAR(36) PRIMARY KEY,
        subject_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 15. Daily study streaks
    await connection.query(`
      CREATE TABLE IF NOT EXISTS streaks (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        study_date DATE NOT NULL,
        total_seconds INT NOT NULL DEFAULT 0,
        session_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_date (user_id, study_date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 16. Cooperative Study Rooms (Co-op)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS coop_rooms (
        id VARCHAR(36) PRIMARY KEY,
        created_by VARCHAR(36) NOT NULL,
        join_code VARCHAR(50) NOT NULL UNIQUE,
        duration_seconds INT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'waiting', -- 'waiting', 'starting', 'active', 'completed'
        started_at TIMESTAMP NULL DEFAULT NULL,
        completed_at TIMESTAMP NULL DEFAULT NULL,
        is_paused TINYINT(1) NOT NULL DEFAULT 0,
        paused_at TIMESTAMP NULL DEFAULT NULL,
        paused_seconds INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 17. Cooperative Study Room Members
    await connection.query(`
      CREATE TABLE IF NOT EXISTS coop_room_members (
        id VARCHAR(36) PRIMARY KEY,
        room_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'joined', -- 'joined', 'accepted', 'completed', 'abandoned'
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_room_user (room_id, user_id),
        FOREIGN KEY (room_id) REFERENCES coop_rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 18. Cooperative Study Room Shared Materials
    await connection.query(`
      CREATE TABLE IF NOT EXISTS coop_room_materials (
        id VARCHAR(36) PRIMARY KEY,
        room_id VARCHAR(36) NOT NULL,
        material_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_room_material (room_id, material_id),
        FOREIGN KEY (room_id) REFERENCES coop_rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Safe ALTER migrations for existing databases (coop_rooms pause state)
    const alterMigrations = [
      "ALTER TABLE coop_rooms ADD COLUMN is_paused TINYINT(1) NOT NULL DEFAULT 0",
      "ALTER TABLE coop_rooms ADD COLUMN paused_at TIMESTAMP NULL DEFAULT NULL",
      "ALTER TABLE coop_rooms ADD COLUMN paused_seconds INT NOT NULL DEFAULT 0",
    ];
    for (const sql of alterMigrations) {
      try {
        await connection.query(sql);
      } catch (e) {
        // Ignore duplicate column errors (errno 1060)
        if (e.errno !== 1060) console.warn('Migration warning:', e.message);
      }
    }

    console.log('MySQL Database Schema Initialized Successfully!');
  } catch (error) {
    console.error('Error initializing MySQL database schema:', error);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  query,
  querySingle,
  initializeDatabase,
};
