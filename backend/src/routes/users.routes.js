import express from 'express';
import * as usersController from '../controllers/users.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require Admin or Diretor role
router.use(verifyToken);
router.use(requireRole('Admin', 'Diretor'));

router.get('/', usersController.listUsers);
router.get('/:id', usersController.getUser);
router.post('/', usersController.createUser);
router.put('/:id', usersController.updateUser);
router.delete('/:id', usersController.deleteUser);

export default router;
