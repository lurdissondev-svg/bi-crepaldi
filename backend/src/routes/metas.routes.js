import { Router } from 'express';
import {
  getMetasByYear,
  getMetasForEstabelecimento,
  updateMetas,
  bulkUpdateMetas,
} from '../controllers/metas.controller.js';

const router = Router();

// GET /api/metas-config/:year - Get all metas for a year
router.get('/:year', getMetasByYear);

// GET /api/metas-config/:year/:month/:codEstab - Get specific meta
router.get('/:year/:month/:codEstab', getMetasForEstabelecimento);

// PUT /api/metas-config/:year/:month/:codEstab - Update specific meta
router.put('/:year/:month/:codEstab', updateMetas);

// PUT /api/metas-config/:year/:codEstab/bulk - Bulk update all months for establishment
router.put('/:year/:codEstab/bulk', bulkUpdateMetas);

export default router;
