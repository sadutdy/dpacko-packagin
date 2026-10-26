import { Router } from 'express';

import { validate } from '../../core/validation/index.js';
import { authenticate } from '../../core/middleware/auth.js';
import { authLimiter, otpLimiter } from '../../core/middleware/rateLimit.js';
import { authController } from './auth.controller.js';
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  requestOtpSchema,
  updateProfileSchema,
  verifyOtpSchema,
} from './auth.schema.js';

export const authRouter: Router = Router();

authRouter.post('/otp/request', otpLimiter, validate(requestOtpSchema), authController.requestOtp);
authRouter.post('/otp/verify', authLimiter, validate(verifyOtpSchema), authController.verifyOtp);
authRouter.post('/register', authLimiter, validate(registerSchema), authController.register);
authRouter.post('/login', authLimiter, validate(loginSchema), authController.login);
authRouter.post('/refresh', validate(refreshSchema), authController.refresh);
authRouter.post('/logout', validate(refreshSchema), authController.logout);

authRouter.post('/logout-all', authenticate, authController.logoutAll);
authRouter.get('/me', authenticate, authController.me);
authRouter.put('/me', authenticate, validate(updateProfileSchema), authController.updateMe);
authRouter.put(
  '/password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword,
);
authRouter.get('/sessions', authenticate, authController.sessions);
