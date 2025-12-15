/**
 * Webhook Routes
 * Endpoints para receber webhooks de integrações externas
 *
 * INTEGRAÇÃO TINTIM:
 * 1. Acesse https://tintim.app e crie uma conta
 * 2. Configure o webhook para: {API_URL}/webhooks/tintim
 * 3. Copie o webhook secret e configure no .env como TINTIM_WEBHOOK_SECRET
 * 4. Ative a integração setando TINTIM_ENABLED=true no .env
 */

import { Router } from 'express';
import webhookController from '../controllers/webhook.controller.js';

const router = Router();

// Health check
router.get('/health', webhookController.health);

// Webhook do Tintim
router.post('/tintim', webhookController.tintimWebhook);

// Webhook genérico (para futuras integrações)
router.post('/:provider', webhookController.genericWebhook);

export default router;
