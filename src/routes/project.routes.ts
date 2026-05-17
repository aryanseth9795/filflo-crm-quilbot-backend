import { Router } from 'express';
import { projectController } from '../controllers/project.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { createProjectSchema, updateProjectSchema } from '../validators/project.validator';

const router = Router();

router.use(authenticate);

router.get('/', authorize('admin', 'support', 'developer'), projectController.list);
router.post('/', authorize('admin'), validate(createProjectSchema), projectController.create);
router.get('/:id', authorize('admin'), projectController.getById);
router.put('/:id', authorize('admin'), validate(updateProjectSchema), projectController.update);
router.delete('/:id', authorize('admin'), projectController.deactivate);
router.post('/:id/regenerate-secret', authorize('admin'), projectController.regenerateSecret);

export default router;
