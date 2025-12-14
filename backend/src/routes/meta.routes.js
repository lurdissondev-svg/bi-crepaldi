import express from 'express';
import {
  getConfig,
  saveConfig,
  validateConfig,
  getInsights,
  getCampaigns,
  getSummary,
  getMarketingROI,
  getSpendTrend,
  syncSpend,
} from '../controllers/meta.controller.js';

const router = express.Router();

// Configuration endpoints
router.get('/config', getConfig);
router.post('/config', saveConfig);
router.post('/validate', validateConfig);

// Data endpoints
router.get('/insights', getInsights);
router.get('/campaigns', getCampaigns);
router.get('/summary', getSummary);

// ROI and analytics endpoints (Phase 4)
router.get('/roi', getMarketingROI);
router.get('/spend-trend', getSpendTrend);
router.post('/sync-spend', syncSpend);

export default router;
