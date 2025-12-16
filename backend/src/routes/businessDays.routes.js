import { Router } from 'express';
import { getBusinessDaysByYear, updateBusinessDays } from '../controllers/businessDays.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(verifyToken);

// GET /api/business-days/:year - Get business days config for a year
router.get('/:year', getBusinessDaysByYear);

// PUT /api/business-days/:year/:month - Update business days for a month
router.put('/:year/:month', updateBusinessDays);

export default router;
