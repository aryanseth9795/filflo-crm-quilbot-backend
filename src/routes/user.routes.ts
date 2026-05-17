import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

router.get('/developers', authorize('admin'), userController.getDevelopers);
router.get('/admins', authorize('admin', 'developer'), userController.getAdmins);
router.get('/:id/profile', authorize('admin', 'developer'), userController.getProfile);

export default router;
