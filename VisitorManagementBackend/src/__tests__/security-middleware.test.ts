import request from 'supertest';
import express from 'express';
import { 
  sanitizeInput, 
  securityHeaders, 
  requestSizeLimiter,
  suspiciousActivityDetector 
} from '@/middleware/security';

// Mock logger to prevent console output during tests
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Security Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any timers or intervals
    jest.clearAllTimers();
  });

  describe('sanitizeInput', () => {
    beforeEach(() => {
      app.use(sanitizeInput);
      app.post('/test', (req, res) => {
        res.json({ body: req.body, query: req.query, params: req.params });
      });
    });

    it('should remove script tags from input', async () => {
      const maliciousInput = {
        name: 'John<script>alert("xss")</script>Doe',
        description: 'Test<script src="evil.js"></script>content'
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousInput)
        .expect(200);

      expect(response.body.body.name).toBe('JohnDoe');
      expect(response.body.body.description).toBe('Testcontent');
    });

    it('should remove javascript: protocol', async () => {
      const maliciousInput = {
        url: 'javascript:alert("xss")',
        link: 'JAVASCRIPT:void(0)'
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousInput)
        .expect(200);

      expect(response.body.body.url).toBe('alert("xss")');
      expect(response.body.body.link).toBe('void(0)');
    });

    it('should remove event handlers', async () => {
      const maliciousInput = {
        content: 'Hello onload="alert(1)" world',
        text: 'Test onclick="malicious()" content'
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousInput)
        .expect(200);

      expect(response.body.body.content).toBe('Hello  world');
      expect(response.body.body.text).toBe('Test  content');
    });

    it('should remove HTML tags', async () => {
      const maliciousInput = {
        content: 'Hello <img src=x onerror=alert(1)> world'
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousInput)
        .expect(200);

      expect(response.body.body.content).toBe('Hello  world');
    });

    it('should handle nested objects and arrays', async () => {
      const maliciousInput = {
        user: {
          name: 'John<script>alert(1)</script>',
          tags: ['tag1<script>alert(2)</script>', 'tag2']
        },
        items: [
          { title: 'Item<script>alert(3)</script>1' },
          { title: 'Item2' }
        ]
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousInput)
        .expect(200);

      expect(response.body.body.user.name).toBe('John');
      expect(response.body.body.user.tags[0]).toBe('tag1');
      expect(response.body.body.user.tags[1]).toBe('tag2');
      expect(response.body.body.items[0].title).toBe('Item1');
      expect(response.body.body.items[1].title).toBe('Item2');
    });
  });

  describe('suspiciousActivityDetector', () => {
    beforeEach(() => {
      app.use(suspiciousActivityDetector);
      app.post('/test', (_req, res) => {
        res.json({ success: true });
      });
      app.get('/test/:id', (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should detect path traversal attempts', async () => {
      await request(app)
        .get('/test/../../../etc/passwd')
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('SUSPICIOUS_ACTIVITY');
        });
    });

    it('should detect SQL injection attempts', async () => {
      const sqlInjection = {
        query: "'; DROP TABLE users; --"
      };

      await request(app)
        .post('/test')
        .send(sqlInjection)
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('SUSPICIOUS_ACTIVITY');
        });
    });

    it('should detect XSS attempts', async () => {
      const xssAttempt = {
        content: '<script>alert("xss")</script>'
      };

      await request(app)
        .post('/test')
        .send(xssAttempt)
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('SUSPICIOUS_ACTIVITY');
        });
    });

    it('should detect command injection attempts', async () => {
      const commandInjection = {
        command: 'ls; rm -rf /'
      };

      await request(app)
        .post('/test')
        .send(commandInjection)
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('SUSPICIOUS_ACTIVITY');
        });
    });

    it('should allow legitimate requests', async () => {
      const legitimateData = {
        name: 'John Doe',
        email: 'john@example.com',
        description: 'This is a normal description'
      };

      await request(app)
        .post('/test')
        .send(legitimateData)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });
  });

  describe('requestSizeLimiter', () => {
    beforeEach(() => {
      app.use(requestSizeLimiter);
      app.post('/test', (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should reject requests that are too large', async () => {
      // Mock a large content-length header
      await request(app)
        .post('/test')
        .set('Content-Length', '20971520') // 20MB
        .send({ data: 'test' })
        .expect(413)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('REQUEST_TOO_LARGE');
        });
    });

    it('should allow requests within size limit', async () => {
      await request(app)
        .post('/test')
        .send({ data: 'test' })
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });
  });

  describe('securityHeaders', () => {
    beforeEach(() => {
      app.use(securityHeaders);
      app.get('/test', (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should set security headers', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.headers['permissions-policy']).toBe('geolocation=(), microphone=(), camera=()');
    });

    it('should remove server information headers', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });
  });
});