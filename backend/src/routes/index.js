import { Router } from 'express';
import dashboardRoutes from './dashboard.routes.js';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Dashboard routes
router.use('/dashboard', dashboardRoutes);

export default router;
