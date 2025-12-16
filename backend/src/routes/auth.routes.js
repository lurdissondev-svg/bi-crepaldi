import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);

// Protected routes
router.post('/logout', verifyToken, authController.logout);
router.get('/me', verifyToken, authController.me);
router.post('/change-password', verifyToken, authController.changePassword);

export default router;
