import request from 'supertest';
import express from 'express';
import { authRouter } from '../routes/auth';
import { visitorRouter } from '../routes/visitors';
import { healthRouter } from '../routes/health';
import { errorHandler } from '../middleware/errorHandler';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock database and cache
jest.mock('../database', () => ({
    db: {
        query: jest.fn(),
        healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
    },
    initializeDatabase: jest.fn()
}));

jest.mock('../cache', () => ({
    redis: {
        healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
    },
    initializeCache: jest.fn()
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() }
}));

// Create test app without starting server
const createTestApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    app.use('/api/visitors', visitorRouter);
    app.use('/api', healthRouter);
    app.use(errorHandler);
    return app;
};

describe('API Integration Tests', () => {
    let app: express.Application;

    beforeEach(() => {
        app = createTestApp();
        jest.clearAllMocks();
    });

    describe('Health Check', () => {
        it('should return healthy status', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.body.status).toBe('healthy');
        });
    });

    describe('Authentication Endpoints', () => {
        it('should validate registration input', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'invalid-email',
                    password: 'weak'
                });

            expect([400, 429]).toContain(response.status);
            if (response.status === 400) {
                expect(response.body.success).toBe(false);
                expect(response.body.error.code).toBe('VALIDATION_ERROR');
            }
        });

        it('should validate login input', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'invalid-email'
                });

            expect([400, 429]).toContain(response.status);
            if (response.status === 400) {
                expect(response.body.success).toBe(false);
                expect(response.body.error.code).toBe('VALIDATION_ERROR');
            }
        });

        it('should require refresh token for token refresh', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({});

            expect([400, 429]).toContain(response.status);
            if (response.status === 400) {
                expect(response.body.success).toBe(false);
                expect(response.body.error.code).toBe('VALIDATION_ERROR');
            }
        });
    });

    describe('Protected Routes', () => {
        it('should require authentication for visitor endpoints', async () => {
            const response = await request(app)
                .get('/api/visitors')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
        });
    });

    describe('Error Handling', () => {
        it('should handle 404 for unknown routes', async () => {
            const response = await request(app)
                .get('/api/unknown-endpoint')
                .expect(404);

            expect(response.status).toBe(404);
        });
    });

    describe('Request Processing', () => {
        it('should process JSON requests', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'password' });

            // Should process the request (even if it fails validation or auth)
            expect([400, 401, 429]).toContain(response.status);
        });

        it('should handle malformed JSON', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .set('Content-Type', 'application/json')
                .send('{"invalid": json}');

            expect(response.status).toBe(400);
        });
    });
});