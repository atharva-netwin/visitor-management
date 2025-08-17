import { Router } from 'express';
import { AuthController } from '@/controllers/AuthController';
import { validateRequest, registerSchema, loginSchema } from '@/utils/validation';
import { authenticateToken } from '@/middleware/auth';
import { authBruteForce } from '@/middleware/rateLimiting';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user account
 *     description: |
 *       Creates a new user account with email and password authentication.
 *       Passwords must meet security requirements (8+ chars, uppercase, lowercase, number, special char).
 *       Email addresses must be unique across the system.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           examples:
 *             valid_registration:
 *               summary: Valid registration request
 *               value:
 *                 email: "john.doe@example.com"
 *                 password: "SecurePass123!"
 *                 firstName: "John"
 *                 lastName: "Doe"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             examples:
 *               success:
 *                 summary: Successful registration
 *                 value:
 *                   success: true
 *                   user:
 *                     id: "123e4567-e89b-12d3-a456-426614174000"
 *                     email: "john.doe@example.com"
 *                     firstName: "John"
 *                     lastName: "Doe"
 *                     isActive: true
 *                     createdAt: "2023-01-01T00:00:00.000Z"
 *                     updatedAt: "2023-01-01T00:00:00.000Z"
 *                   accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                   refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Validation error or duplicate email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               validation_error:
 *                 summary: Validation failed
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "VALIDATION_ERROR"
 *                     message: "Validation failed"
 *                     details:
 *                       - field: "password"
 *                         message: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
 *                     correlationId: "req_123456789"
 *               duplicate_email:
 *                 summary: Email already exists
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "DUPLICATE_RESOURCE"
 *                     message: "Email already exists"
 *                     correlationId: "req_123456789"
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register', 
  authBruteForce.prevent, 
  validateRequest(registerSchema), 
  AuthController.register
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and obtain tokens
 *     description: |
 *       Authenticates a user with email and password, returning JWT access and refresh tokens.
 *       Access tokens expire in 15 minutes, refresh tokens expire in 7 days.
 *       Failed login attempts are rate limited (5 attempts per 15 minutes).
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             valid_login:
 *               summary: Valid login request
 *               value:
 *                 email: "john.doe@example.com"
 *                 password: "SecurePass123!"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             examples:
 *               success:
 *                 summary: Successful login
 *                 value:
 *                   success: true
 *                   user:
 *                     id: "123e4567-e89b-12d3-a456-426614174000"
 *                     email: "john.doe@example.com"
 *                     firstName: "John"
 *                     lastName: "Doe"
 *                     isActive: true
 *                     createdAt: "2023-01-01T00:00:00.000Z"
 *                     updatedAt: "2023-01-01T00:00:00.000Z"
 *                     lastLoginAt: "2023-01-01T10:30:00.000Z"
 *                   accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                   refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalid_credentials:
 *                 summary: Invalid email or password
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "AUTHENTICATION_FAILED"
 *                     message: "Invalid email or password"
 *                     correlationId: "req_123456789"
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', 
  authBruteForce.prevent, 
  validateRequest(loginSchema), 
  AuthController.login
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token
 *     description: |
 *       Exchanges a valid refresh token for new access and refresh tokens.
 *       Implements token rotation for enhanced security - old refresh token is invalidated.
 *       Refresh tokens are automatically rotated on each use.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Valid refresh token obtained from login
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *           examples:
 *             valid_refresh:
 *               summary: Valid refresh token request
 *               value:
 *                 refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *             examples:
 *               success:
 *                 summary: Successful token refresh
 *                 value:
 *                   success: true
 *                   accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                   refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalid_token:
 *                 summary: Invalid refresh token
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "AUTHENTICATION_FAILED"
 *                     message: "Invalid or expired refresh token"
 *                     correlationId: "req_123456789"
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh', 
  authBruteForce.prevent, 
  AuthController.refreshToken
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user and revoke tokens
 *     description: |
 *       Logs out the authenticated user and revokes their refresh tokens.
 *       The access token will remain valid until expiry but refresh tokens are immediately invalidated.
 *       Requires valid authentication.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Logged out successfully"
 *             examples:
 *               success:
 *                 summary: Successful logout
 *                 value:
 *                   success: true
 *                   message: "Logged out successfully"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/logout', authenticateToken, AuthController.logout);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     description: |
 *       Retrieves the profile information for the currently authenticated user.
 *       Returns user details without sensitive information like password hashes.
 *       Requires valid authentication.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/UserProfile'
 *             examples:
 *               success:
 *                 summary: Successful profile retrieval
 *                 value:
 *                   success: true
 *                   user:
 *                     id: "123e4567-e89b-12d3-a456-426614174000"
 *                     email: "john.doe@example.com"
 *                     firstName: "John"
 *                     lastName: "Doe"
 *                     isActive: true
 *                     createdAt: "2023-01-01T00:00:00.000Z"
 *                     updatedAt: "2023-01-01T00:00:00.000Z"
 *                     lastLoginAt: "2023-01-01T10:30:00.000Z"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/me', authenticateToken, AuthController.me);

export { router as authRoutes };