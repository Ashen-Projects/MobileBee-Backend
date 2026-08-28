import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

import { env } from '../../env';
import { requireAuth } from '../../middlewares/authMiddleware';
import { asyncHandler } from '../../utils/async-handler';
import { login, logout, me } from '../../controllers/auth/authController';

export const authRoutes = Router();

const loginRateLimiter = rateLimit({
  windowMs: env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_LOGIN_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

authRoutes.post('/login', loginRateLimiter, asyncHandler(login));
authRoutes.get('/me', requireAuth, asyncHandler(me));
authRoutes.post('/logout', requireAuth, asyncHandler(logout));
