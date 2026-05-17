import { z } from 'zod';

export const createTicketSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  requestType: z.enum([
    'bug', 'error', 'ui_ux_change', 'feature_request', 'special_request', 'miscellaneous',
  ]),
  description: z.string().min(10, 'Description must be at least 10 characters').trim(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  requiredDeliveryDays: z.coerce.number().min(1).optional(),
  referenceUrls: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return [];
      if (Array.isArray(val)) return val.filter(Boolean);
      if (typeof val === 'string') return [val];
      return [];
    },
    z.array(z.string().url('Each reference URL must be a valid URL')).optional().default([])
  ),
});

export const approveTicketSchema = z.object({
  assignedTo: z.string().min(1, 'Developer ID is required'),
  adminNotes: z.string().trim().optional(),
});

export const rejectTicketSchema = z.object({
  rejectionReason: z.string().min(5, 'Please provide a reason for rejection').trim(),
});

export const assignTicketSchema = z.object({
  assignedTo: z.string().min(1, 'Developer ID is required'),
});

export const reviewPRSchema = z.object({
  action: z.enum(['merge', 'reject']),
  notes: z.string().trim().optional(),
});

export const addFeedbackSchema = z.object({
  clientFeedback: z.string().trim().optional(),
  supportRemark: z.string().trim().optional(),
});

export const devRolloutSchema = z.object({
  devRolloutTime: z.string().datetime({ message: 'Invalid datetime' }),
});

export const acceptTaskSchema = z.object({
  changeType: z.enum(['code', 'db_direct'], {
    required_error: 'Please select whether this is a code change or a DB change',
  }),
});

export const ticketFilterSchema = z.object({
  status: z
    .enum(['open', 'approved', 'accepted', 'in_progress', 'pr_raised', 'pr_review', 'pr_merged', 'pr_rejected', 'closed', 'rejected'])
    .optional(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
  requestType: z
    .enum(['bug', 'error', 'ui_ux_change', 'feature_request', 'special_request', 'miscellaneous'])
    .optional(),
  assignedTo: z.string().optional(),
  unassigned: z.coerce.boolean().optional(),
  projectId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type ApproveTicketInput = z.infer<typeof approveTicketSchema>;
export type RejectTicketInput = z.infer<typeof rejectTicketSchema>;
export type ReviewPRInput = z.infer<typeof reviewPRSchema>;
export type AddFeedbackInput = z.infer<typeof addFeedbackSchema>;
export type DevRolloutInput = z.infer<typeof devRolloutSchema>;
export type AcceptTaskInput = z.infer<typeof acceptTaskSchema>;
export type TicketFilterInput = z.infer<typeof ticketFilterSchema>;
