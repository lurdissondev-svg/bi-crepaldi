import express from 'express';
import {
  getConfig,
  saveConfig,
  validateConfig,
  getInsights,
  getCampaigns,
  getSummary,
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

export default router;
