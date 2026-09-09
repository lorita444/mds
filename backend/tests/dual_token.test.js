const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../index');
const db = require('../db');

// Mock db module
jest.mock('../db', () => ({
  query: jest.fn(),
  querySingle: jest.fn(),
}));

describe('Dual Token System (Access + Refresh Tokens)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login with Dual Tokens', () => {
    it('should return access_token, refresh_token and user object on successful login', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('correct_password', 10);

      const mockUser = {
        id: 'user-uuid-1',
        email: 'user@example.com',
        username: 'testuser',
        password: hashedPassword,
      };

      db.querySingle.mockResolvedValue(mockUser);
      db.query.mockResolvedValue({}); // DB insert for refresh_tokens

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'correct_password' });

      expect(response.status).toBe(200);
      expect(response.body.session).toBeDefined();
      expect(response.body.session.access_token).toBeDefined();
      expect(response.body.session.refresh_token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        expect.any(Array)
      );
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should issue new access_token and refresh_token when given valid active refresh_token', async () => {
      const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'studyverse_refresh_secret_key_2026';
      const validRefreshToken = jwt.sign(
        { id: 'user-uuid-1', email: 'user@example.com', username: 'testuser' },
        JWT_REFRESH_SECRET,
        { expiresIn: '30d' }
      );

      const mockStoredToken = {
        id: 'token-uuid-1',
        user_id: 'user-uuid-1',
        token: validRefreshToken,
        expires_at: new Date(Date.now() + 86400000),
      };

      db.querySingle.mockResolvedValue(mockStoredToken);
      db.query.mockResolvedValue({});

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: validRefreshToken });

      expect(response.status).toBe(200);
      expect(response.body.access_token).toBeDefined();
      expect(response.body.refresh_token).toBeDefined();
      // Token rotation check: should delete old token
      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM refresh_tokens WHERE id = ?',
        ['token-uuid-1']
      );
    });

    it('should return 400 if refresh_token parameter is missing', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Refresh token is required' });
    });

    it('should return 403 if refresh token is revoked or not found in database', async () => {
      const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'studyverse_refresh_secret_key_2026';
      const validRefreshToken = jwt.sign(
        { id: 'user-uuid-1', email: 'user@example.com', username: 'testuser' },
        JWT_REFRESH_SECRET,
        { expiresIn: '30d' }
      );

      // Database returns null (token revoked/deleted)
      db.querySingle.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: validRefreshToken });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Invalid or revoked refresh token' });
    });

    it('should return 403 if refresh_token signature is invalid or expired', async () => {
      const invalidRefreshToken = 'invalid.jwt.token';

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: invalidRefreshToken });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Invalid or expired refresh token' });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should revoke refresh_token by deleting it from database', async () => {
      db.query.mockResolvedValue({});

      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refresh_token: 'some_refresh_token_to_revoke' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM refresh_tokens WHERE token = ?',
        ['some_refresh_token_to_revoke']
      );
    });
  });
});
