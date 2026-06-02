const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../index');
const db = require('../db');

// Mock the db module
jest.mock('../db', () => ({
  query: jest.fn(),
  querySingle: jest.fn()
}));

describe('Backend API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/subjects', () => {
    it('should return a list of subjects for a given user', async () => {
      const mockSubjects = [
        { id: 'sub-1', user_id: 'user-123', name: 'Maths', color: '#7c3aed', emoji: '📚' },
        { id: 'sub-2', user_id: 'user-123', name: 'Science', color: '#3b82f6', emoji: '🔬' }
      ];
      db.query.mockResolvedValue(mockSubjects);

      const response = await request(app)
        .get('/api/subjects')
        .query({ userId: 'user-123' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSubjects);
      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM subjects WHERE user_id = ? ORDER BY created_at ASC',
        ['user-123']
      );
    });

    it('should return 500 error if database query fails', async () => {
      db.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/subjects')
        .query({ userId: 'user-123' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Database connection failed' });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 if email or password is empty', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: '' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Email and password are required' });
    });

    it('should return 400 if user does not exist', async () => {
      db.querySingle.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid login credentials' });
      expect(db.querySingle).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = ?',
        ['nonexistent@example.com']
      );
    });

    it('should login successfully and return token and user profile on correct password', async () => {
      const hashedPassword = await bcrypt.hash('correct_password', 10);
      const mockUser = {
        id: 'user-uuid-1',
        email: 'test@example.com',
        username: 'testuser',
        password: hashedPassword,
        crystal_balance: 100
      };
      
      db.querySingle.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'correct_password' });

      expect(response.status).toBe(200);
      expect(response.body.session).toBeDefined();
      expect(response.body.session.access_token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.password).toBeUndefined(); // password should be deleted
    });

    it('should return 400 on incorrect password', async () => {
      const hashedPassword = await bcrypt.hash('correct_password', 10);
      const mockUser = {
        id: 'user-uuid-1',
        email: 'test@example.com',
        username: 'testuser',
        password: hashedPassword
      };
      
      db.querySingle.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong_password' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid login credentials' });
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should return 404 if email does not exist', async () => {
      db.querySingle.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: 'missing@example.com' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });

    it('should return 200 with success message if email exists', async () => {
      db.querySingle.mockResolvedValue({ id: 'user-id-123' });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: 'exists@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Password reset link sent successfully (simulated).'
      });
    });
  });
});
