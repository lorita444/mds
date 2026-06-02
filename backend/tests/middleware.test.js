const jwt = require('jsonwebtoken');
const app = require('../index');

describe('Authentication Middleware', () => {
  const { authenticateToken } = app;
  const JWT_SECRET = process.env.JWT_SECRET || 'studyverse_secret_key_2026';

  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  it('should return 401 if authorization header is missing', () => {
    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access token missing' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if authorization token is empty', () => {
    req.headers['authorization'] = 'Bearer ';
    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access token missing' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 if token is invalid', () => {
    req.headers['authorization'] = 'Bearer invalidtokenhere';
    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next and set req.user if token is valid', () => {
    const payload = { id: 'user-id-123', email: 'test@example.com' };
    const token = jwt.sign(payload, JWT_SECRET);

    req.headers['authorization'] = `Bearer ${token}`;
    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(payload.id);
    expect(req.user.email).toBe(payload.email);
  });
});
