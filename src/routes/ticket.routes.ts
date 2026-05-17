import { Router } from 'express';
import { ticketController } from '../controllers/ticket.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';
import {
  createTicketSchema,
  approveTicketSchema,
  rejectTicketSchema,
  reviewPRSchema,
  addFeedbackSchema,
  devRolloutSchema,
  acceptTaskSchema,
  ticketFilterSchema,
} from '../validators/ticket.validator';

const router = Router();
router.use(authenticate);

// List & Create
router.post(
  '/',
  authorize('support', 'admin'),
  uploadMiddleware.array('attachments'),
  validate(createTicketSchema),
  ticketController.create
);
router.get('/', authorize('admin'), validate(ticketFilterSchema, 'query'), ticketController.list);
router.get('/mine', authorize('support', 'developer'), ticketController.getMine);
router.get('/:id', ticketController.getById);

// Admin actions
router.patch('/:id/approve', authorize('admin'), validate(approveTicketSchema), ticketController.approve);
router.patch('/:id/reject', authorize('admin'), validate(rejectTicketSchema), ticketController.reject);
router.patch('/:id/review-pr', authorize('admin'), validate(reviewPRSchema), ticketController.reviewPR);

// Developer actions
router.patch('/:id/accept', authorize('developer'), validate(acceptTaskSchema), ticketController.acceptTask);
router.patch('/:id/start', authorize('developer'), ticketController.startWork);
router.patch('/:id/rollout', authorize('developer'), validate(devRolloutSchema), ticketController.setRolloutTime);
router.patch('/:id/complete-db-change', authorize('developer'), ticketController.completeDbChange);

// Timeline
router.get('/:id/timeline', ticketController.getTimeline);

// Support actions
router.patch('/:id/feedback', authorize('support'), validate(addFeedbackSchema), ticketController.addFeedback);
router.patch('/:id/close', authorize('support'), ticketController.close);

// Attachments
router.post(
  '/:id/attachments',
  authorize('support', 'admin'),
  uploadMiddleware.array('attachments'),
  ticketController.addAttachments
);

export default router;
