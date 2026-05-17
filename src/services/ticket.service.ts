import mongoose from 'mongoose';
import { Ticket } from '../models/Ticket.model';
import { Project } from '../models/Project.model';
import { CompanyMetrics } from '../models/CompanyMetrics.model';
import { DeveloperProfile } from '../models/DeveloperProfile.model';
import { User } from '../models/User.model';
import { AppError } from '../utils/AppError';
import { getMediaProvider } from '../providers';
import { notificationService } from './notification.service';
import { eventService } from './event.service';
import { MAX_TOTAL_BYTES } from '../middleware/upload.middleware';
import {
  CreateTicketInput,
  ApproveTicketInput,
  RejectTicketInput,
  ReviewPRInput,
  AddFeedbackInput,
  AcceptTaskInput,
  TicketFilterInput,
} from '../validators/ticket.validator';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function generateTicketNumber(projectId: string): Promise<string> {
  const project = await Project.findByIdAndUpdate(
    projectId,
    { $inc: { ticketCounter: 1 } },
    { new: true }
  );
  if (!project) throw new AppError('Project not found', 404);
  const brand = project.name.toUpperCase().replace(/\s+/g, '-').slice(0, 12);
  const num = String(project.ticketCounter).padStart(3, '0');
  return `${brand}-${num}`;
}

async function getAllAdmins(): Promise<{ email: string; name: string }[]> {
  return User.find({ role: 'admin', isActive: true }).select('email name').lean();
}

async function recalcProjectMetrics(projectId: string) {
  // Use projectId to scope metrics instead of companyName
  const [total, resolved, openCount, resolutionData] = await Promise.all([
    Ticket.countDocuments({ projectId }),
    Ticket.countDocuments({ projectId, status: 'closed' }),
    Ticket.countDocuments({ projectId, status: { $in: ['open', 'approved', 'accepted', 'in_progress'] } }),
    Ticket.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(projectId), status: 'closed', resolutionHrs: { $exists: true } } },
      { $group: { _id: null, avg: { $avg: '$resolutionHrs' }, lastDate: { $max: '$createdAt' } } },
    ]),
  ]);

  const project = await Project.findById(projectId).select('name').lean();
  if (!project) return;

  await CompanyMetrics.findOneAndUpdate(
    { companyName: project.name },
    {
      totalQueries: total,
      resolvedQueries: resolved,
      openTickets: openCount,
      avgResolutionHrs: resolutionData[0]?.avg ?? 0,
      lastQueryDate: resolutionData[0]?.lastDate,
    },
    { upsert: true, new: true }
  );
}

async function recalcDeveloperProfile(developerId: string) {
  const [completed, resolutionData, prData] = await Promise.all([
    Ticket.countDocuments({ assignedTo: developerId, status: 'closed' }),
    Ticket.aggregate([
      { $match: { assignedTo: new mongoose.Types.ObjectId(developerId), status: 'closed', resolutionHrs: { $exists: true } } },
      { $group: { _id: null, avg: { $avg: '$resolutionHrs' } } },
    ]),
    Ticket.aggregate([
      { $match: { assignedTo: new mongoose.Types.ObjectId(developerId) } },
      { $group: { _id: null, total: { $sum: 1 }, merged: { $sum: { $cond: [{ $eq: ['$prStatus', 'merged'] }, 1, 0] } } } },
    ]),
  ]);

  const prAcceptRate = prData[0]?.total > 0 ? (prData[0].merged / prData[0].total) * 100 : 0;
  const currentLoad = await Ticket.countDocuments({ assignedTo: developerId, status: { $in: ['accepted', 'in_progress'] } });

  await DeveloperProfile.findOneAndUpdate(
    { userId: developerId },
    { totalCompleted: completed, avgResolutionHrs: resolutionData[0]?.avg ?? 0, prAcceptRate: Math.round(prAcceptRate), currentLoad },
    { upsert: true }
  );
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const ticketService = {
  async create(
    data: CreateTicketInput,
    raisedBy: string,
    files: Express.Multer.File[] = []
  ) {
    // Generate ticket number (atomic increment on project)
    const ticketNumber = await generateTicketNumber(data.projectId);

    // Upload attachments
    const mediaProvider = getMediaProvider();
    let totalBytes = 0;
    const attachments = [];

    for (const file of files) {
      totalBytes += file.size;
      if (totalBytes > MAX_TOTAL_BYTES) {
        throw new AppError('Total attachment size exceeds 50MB limit', 400);
      }
      const result = await mediaProvider.upload(file.buffer, {
        folder: `tickets/${ticketNumber}`,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
      attachments.push({
        url: result.url,
        secureUrl: result.secureUrl,
        publicId: result.publicId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedAt: new Date(),
      });
    }

    const ticket = await Ticket.create({
      ticketNumber,
      ...data,
      raisedBy,
      attachments,
      totalAttachmentBytes: totalBytes,
    });

    const populated = await ticket.populate([
      { path: 'raisedBy', select: 'name email' },
      { path: 'projectId', select: 'name' },
    ]);

    // Log creation event
    const raiser = await User.findById(raisedBy).select('name email').lean();
    await eventService.logEvent({
      ticketId: ticket._id.toString(),
      event: 'created',
      performedBy: raisedBy,
      performedByName: raiser?.name,
    });

    // Notify all admins
    const admins = await getAllAdmins();
    if (admins.length > 0) {
      const project = await Project.findById(data.projectId).select('name').lean();
      await notificationService.ticketCreated({
        adminEmails: admins.map(a => a.email),
        ticketId: ticket._id.toString(),
        ticketNumber,
        projectName: project?.name ?? 'Unknown',
        requestType: data.requestType,
        description: data.description,
        priority: data.priority,
        raisedByName: raiser?.name ?? 'Unknown',
        raisedByEmail: raiser?.email ?? '',
        requiredDeliveryDays: data.requiredDeliveryDays,
        attachmentCount: attachments.length,
      });
    }

    await recalcProjectMetrics(data.projectId);
    return populated;
  },

  async list(filters: TicketFilterInput) {
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.requestType) query.requestType = filters.requestType;
    if (filters.unassigned) {
      query.assignedTo = { $exists: false };
    } else if (filters.assignedTo) {
      query.assignedTo = filters.assignedTo;
    }
    if (filters.projectId) query.projectId = filters.projectId;
    if (filters.from || filters.to) {
      query.createdAt = {
        ...(filters.from && { $gte: new Date(filters.from) }),
        ...(filters.to && { $lte: new Date(filters.to) }),
      };
    }
    const skip = (filters.page - 1) * filters.limit;
    const [tickets, total] = await Promise.all([
      Ticket.find(query)
        .populate('raisedBy', 'name email')
        .populate('assignedTo', 'name email')
        .populate('approvedBy', 'name')
        .populate({ path: 'projectId', select: 'name mainDeveloper', populate: { path: 'mainDeveloper', select: 'name email' } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filters.limit),
      Ticket.countDocuments(query),
    ]);
    return { tickets, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
  },

  async getMine(
    userId: string,
    role: string,
    page = 1,
    limit = 10,
    status?: string,
    from?: string,
    to?: string,
    projectId?: string,
    approvedBy?: string,
  ) {
    const query: Record<string, unknown> =
      role === 'developer' ? { assignedTo: userId } : { raisedBy: userId };
    if (status) query.status = status;
    if (projectId) query.projectId = projectId;
    if (approvedBy) query.approvedBy = approvedBy;
    if (from || to) {
      query.createdAt = {
        ...(from && { $gte: new Date(from) }),
        ...(to && { $lte: new Date(to) }),
      };
    }
    const skip = (page - 1) * limit;
    const [tickets, total] = await Promise.all([
      Ticket.find(query)
        .populate({ path: 'projectId', select: 'name mainDeveloper', populate: { path: 'mainDeveloper', select: 'name email' } })
        .populate('assignedTo', 'name email')
        .populate('approvedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Ticket.countDocuments(query),
    ]);
    return { tickets, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getById(id: string) {
    const ticket = await Ticket.findById(id)
      .populate('raisedBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('approvedBy', 'name email')
      .populate('closedBy', 'name')
      .populate({ path: 'projectId', select: 'name githubRepoUrl mainDeveloper', populate: { path: 'mainDeveloper', select: 'name email' } });
    if (!ticket) throw new AppError('Ticket not found', 404);
    return ticket;
  },

  async approve(id: string, data: ApproveTicketInput, adminId: string) {
    const dev = await User.findById(data.assignedTo).select('name email role');
    if (!dev || dev.role !== 'developer') throw new AppError('Invalid developer ID', 400);

    const ticket = await Ticket.findByIdAndUpdate(
      id,
      { status: 'approved', assignedTo: data.assignedTo, adminNotes: data.adminNotes, approvedBy: adminId },
      { new: true }
    ).populate('projectId', 'name').populate('raisedBy', 'name email');

    if (!ticket) throw new AppError('Ticket not found', 404);

    const project = ticket.projectId as any;
    const admin = await User.findById(adminId).select('name').lean();
    await notificationService.ticketAssigned({
      developerEmail: dev.email,
      developerName: dev.name,
      ticketId: ticket._id.toString(),
      ticketNumber: ticket.ticketNumber,
      projectName: project?.name ?? '',
      requestType: ticket.requestType,
      description: ticket.description,
      priority: ticket.priority,
      adminNotes: data.adminNotes,
      requiredDeliveryDays: ticket.requiredDeliveryDays,
      attachmentCount: ticket.attachments.length,
    });

    await eventService.logEvent({
      ticketId: ticket._id.toString(),
      event: 'approved',
      performedBy: adminId,
      performedByName: admin?.name,
      metadata: { assignedTo: dev.name, adminNotes: data.adminNotes },
    });

    await recalcDeveloperProfile(data.assignedTo);
    return ticket;
  },

  async reject(id: string, data: RejectTicketInput) {
    const ticket = await Ticket.findByIdAndUpdate(
      id,
      { status: 'rejected', rejectionReason: data.rejectionReason },
      { new: true }
    ).populate('raisedBy', 'name email').populate('projectId', 'name');

    if (!ticket) throw new AppError('Ticket not found', 404);

    const raiser = ticket.raisedBy as any;
    const project = ticket.projectId as any;
    await notificationService.ticketRejected({
      supportEmail: raiser.email,
      ticketId: ticket._id.toString(),
      ticketNumber: ticket.ticketNumber,
      projectName: project?.name ?? '',
      rejectionReason: data.rejectionReason,
    });

    await eventService.logEvent({
      ticketId: ticket._id.toString(),
      event: 'rejected',
      metadata: { rejectionReason: data.rejectionReason },
    });

    await recalcProjectMetrics((ticket.projectId as any)._id.toString());
    return ticket;
  },

  async acceptTask(id: string, developerId: string, data: AcceptTaskInput) {
    const ticket = await Ticket.findOne({ _id: id, assignedTo: developerId, status: 'approved' });
    if (!ticket) throw new AppError('Ticket not found or not assigned to you', 404);
    const dev = await User.findById(developerId).select('name').lean();
    ticket.status = 'accepted';
    ticket.acceptedAt = new Date();
    ticket.changeType = data.changeType;
    await ticket.save();
    await eventService.logEvent({
      ticketId: ticket._id.toString(),
      event: 'accepted',
      performedBy: developerId,
      performedByName: dev?.name,
      metadata: { changeType: data.changeType },
    });
    await recalcDeveloperProfile(developerId);
    return ticket;
  },

  async completeDbChange(id: string, developerId: string) {
    const ticket = await Ticket.findOne({
      _id: id,
      assignedTo: developerId,
      status: { $in: ['accepted', 'in_progress'] },
      changeType: 'db_direct',
    });
    if (!ticket) throw new AppError('Ticket not found, not assigned to you, or not a DB change ticket', 404);
    const dev = await User.findById(developerId).select('name').lean();
    ticket.status = 'pr_merged';
    ticket.prStatus = 'merged';
    await ticket.save();
    await eventService.logEvent({
      ticketId: ticket._id.toString(),
      event: 'db_change_completed',
      performedBy: developerId,
      performedByName: dev?.name,
      metadata: { note: 'Database change applied directly — no PR lifecycle' },
    });
    return ticket;
  },

  async startWork(id: string, developerId: string) {
    const ticket = await Ticket.findOne({ _id: id, assignedTo: developerId, status: 'accepted' });
    if (!ticket) throw new AppError('Ticket not found or not accepted yet', 404);
    const dev = await User.findById(developerId).select('name').lean();
    ticket.status = 'in_progress';
    ticket.devStartedAt = new Date();
    await ticket.save();
    await eventService.logEvent({
      ticketId: ticket._id.toString(),
      event: 'work_started',
      performedBy: developerId,
      performedByName: dev?.name,
    });
    return ticket;
  },

  async setRolloutTime(id: string, developerId: string, rolloutTime: Date) {
    const ticket = await Ticket.findOne({ _id: id, assignedTo: developerId });
    if (!ticket) throw new AppError('Ticket not found or not assigned to you', 404);
    const dev = await User.findById(developerId).select('name').lean();
    ticket.devRolloutTime = rolloutTime;
    await ticket.save();
    await eventService.logEvent({
      ticketId: ticket._id.toString(),
      event: 'rollout_set',
      performedBy: developerId,
      performedByName: dev?.name,
      metadata: { rolloutTime: rolloutTime.toISOString() },
    });
    return ticket;
  },

  async reviewPR(id: string, data: ReviewPRInput, adminId: string) {
    const ticket = await Ticket.findById(id)
      .populate('assignedTo', 'name email')
      .populate('raisedBy', 'name email')
      .populate('projectId', 'name');
    if (!ticket) throw new AppError('Ticket not found', 404);

    const dev = ticket.assignedTo as any;
    const raiser = ticket.raisedBy as any;
    const project = ticket.projectId as any;
    const admins = await getAllAdmins();

    if (data.action === 'merge') {
      ticket.status = 'pr_merged';
      ticket.prStatus = 'merged';
      await ticket.save();
      const triggeredByUser = await User.findById(adminId).select('name').lean();
      await eventService.logEvent({
        ticketId: ticket._id.toString(),
        event: 'pr_merged',
        performedBy: adminId,
        performedByName: triggeredByUser?.name,
        metadata: { notes: data.notes },
      });
      await notificationService.prMerged({
        supportEmail: raiser.email,
        developerEmail: dev.email,
        ticketId: ticket._id.toString(),
        ticketNumber: ticket.ticketNumber,
        projectName: project?.name ?? '',
        prNumber: 0, // PR number from webhook event
        prUrl: '',
        triggeredBy: (await User.findById(adminId).select('name').lean())?.name ?? 'Admin',
        attachmentCount: ticket.attachments.length,
      });
    } else {
      ticket.status = 'pr_rejected';
      ticket.prStatus = 'rejected';
      ticket.prRevisionCount = (ticket.prRevisionCount ?? 0) + 1;
      await ticket.save();
      const triggeredByUser = await User.findById(adminId).select('name').lean();
      await eventService.logEvent({
        ticketId: ticket._id.toString(),
        event: 'pr_rejected',
        performedBy: adminId,
        performedByName: triggeredByUser?.name,
        metadata: { notes: data.notes, revisionCount: ticket.prRevisionCount },
      });
      await notificationService.prRejected({
        developerEmail: dev.email,
        ticketId: ticket._id.toString(),
        ticketNumber: ticket.ticketNumber,
        projectName: project?.name ?? '',
        rejectionReason: data.notes ?? 'No reason provided',
        revisionCount: ticket.prRevisionCount,
      });
    }

    return ticket;
  },

  async addFeedback(id: string, data: AddFeedbackInput, supportId: string) {
    const ticket = await Ticket.findById(id);
    if (!ticket) throw new AppError('Ticket not found', 404);
    if (data.clientFeedback) ticket.clientFeedback = data.clientFeedback;
    if (data.supportRemark) ticket.supportRemark = data.supportRemark;
    await ticket.save();
    return ticket;
  },

  async close(id: string, supportId: string) {
    if (!mongoose.Types.ObjectId.isValid(supportId)) {
      throw new AppError('Invalid user session — please log in again', 401);
    }

    const ticket = await Ticket.findById(id)
      .populate('assignedTo', 'name email')
      .populate('projectId', 'name');
    if (!ticket) throw new AppError('Ticket not found', 404);

    if (ticket.status !== 'pr_merged') {
      throw new AppError('Ticket can only be closed after the PR has been merged or DB change has been marked complete', 400);
    }

    const closedAt = new Date();
    const resolutionHrs = ticket.createdAt
      ? parseFloat(((closedAt.getTime() - ticket.createdAt.getTime()) / 3_600_000).toFixed(2))
      : 0;

    ticket.status = 'closed';
    ticket.closedAt = closedAt;
    ticket.closedBy = new mongoose.Types.ObjectId(supportId);
    ticket.resolutionHrs = resolutionHrs;
    await ticket.save();

    const dev = ticket.assignedTo as any;
    const project = ticket.projectId as any;
    const admins = await getAllAdmins();
    const closer = await User.findById(supportId).select('name').lean();

    await eventService.logEvent({
      ticketId: ticket._id.toString(),
      event: 'closed',
      performedBy: supportId,
      performedByName: closer?.name,
      metadata: { resolutionHrs },
    });

    if (dev?.email) {
      await notificationService.ticketClosed({
        developerEmail: dev.email,
        adminEmails: admins.map(a => a.email),
        ticketId: ticket._id.toString(),
        ticketNumber: ticket.ticketNumber,
        projectName: project?.name ?? '',
        resolutionHrs,
        closedByName: closer?.name ?? 'Support',
        supportRemark: ticket.supportRemark,
        clientFeedback: ticket.clientFeedback,
      });
    }

    await recalcProjectMetrics((ticket.projectId as any)._id.toString());
    if (ticket.assignedTo) await recalcDeveloperProfile(ticket.assignedTo.toString());
    return ticket;
  },

  async addAttachments(id: string, files: Express.Multer.File[]) {
    const ticket = await Ticket.findById(id);
    if (!ticket) throw new AppError('Ticket not found', 404);

    const mediaProvider = getMediaProvider();
    let totalBytes = ticket.totalAttachmentBytes ?? 0;

    for (const file of files) {
      totalBytes += file.size;
      if (totalBytes > MAX_TOTAL_BYTES) {
        throw new AppError(`Adding these files would exceed the 50MB total attachment limit`, 400);
      }
      const result = await mediaProvider.upload(file.buffer, {
        folder: `tickets/${ticket.ticketNumber}`,
        fileName: file.originalname,
        mimeType: file.mimetype,
      });
      ticket.attachments.push({
        url: result.url,
        secureUrl: result.secureUrl,
        publicId: result.publicId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedAt: new Date(),
      });
    }

    ticket.totalAttachmentBytes = totalBytes;
    await ticket.save();
    return ticket;
  },
};
