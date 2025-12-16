import express from 'express';
import * as rolesController from '../controllers/roles.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require Admin or Diretor role
router.use(verifyToken);
router.use(requireRole('Admin', 'Diretor'));

router.get('/', rolesController.listRoles);
router.get('/pages', rolesController.listPages);
router.get('/:id', rolesController.getRole);
router.post('/', rolesController.createRole);
router.put('/:id', rolesController.updateRole);
router.put('/:id/permissions', rolesController.updatePermissions);
router.delete('/:id', rolesController.deleteRole);

export default router;
