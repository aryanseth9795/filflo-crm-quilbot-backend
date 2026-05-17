import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', reportController.getOverview);
router.get('/happiness-index', reportController.getHappinessIndex);
router.get('/developers', reportController.getDeveloperStats);
router.get('/export', reportController.exportCSV);
router.get('/company/:id', reportController.getCompanyReport);
router.get('/project/:id', reportController.getProjectDetail);

export default router;
