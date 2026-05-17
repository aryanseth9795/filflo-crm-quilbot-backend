import { Ticket } from '../models/Ticket.model';
import { CompanyMetrics } from '../models/CompanyMetrics.model';
import { DeveloperProfile } from '../models/DeveloperProfile.model';
import { User } from '../models/User.model';
import { Project } from '../models/Project.model';

export const reportService = {
  async getOverview(from?: string, to?: string) {
    const dateFilter = from || to
      ? { createdAt: { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) } }
      : {};

    const activeStatuses = ['open', 'approved', 'accepted', 'in_progress', 'pr_raised', 'pr_review', 'pr_merged'];
    const now = new Date();

    const [totalTickets, totalOpen, totalInProgress, totalClosed, totalRejected, statusBreakdown, requestTypeBreakdown] =
      await Promise.all([
        Ticket.countDocuments(dateFilter),
        Ticket.countDocuments({ ...dateFilter, status: 'open' }),
        Ticket.countDocuments({ ...dateFilter, status: { $in: ['accepted', 'in_progress'] } }),
        Ticket.countDocuments({ ...dateFilter, status: 'closed' }),
        Ticket.countDocuments({ ...dateFilter, status: 'rejected' }),
        Ticket.aggregate([
          { $match: dateFilter },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Ticket.aggregate([
          { $match: dateFilter },
          { $group: { _id: '$requestType', count: { $sum: 1 } } },
        ]),
      ]);

    const priorityBreakdownRaw = await Ticket.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$priority',
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $in: ['$status', activeStatuses] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ['$status', activeStatuses] },
                    { $gt: ['$requiredDeliveryDays', 0] },
                    { $lt: [{ $add: ['$createdAt', { $multiply: ['$requiredDeliveryDays', 24 * 60 * 60 * 1000] }] }, now] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const [openedTrend, closedTrend] = await Promise.all([
      Ticket.aggregate([
        { $match: { createdAt: { $gte: twelveMonthsAgo } } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } }
      ]),
      Ticket.aggregate([
        { $match: { closedAt: { $gte: twelveMonthsAgo }, status: 'closed' } },
        { $group: { _id: { year: { $year: '$closedAt' }, month: { $month: '$closedAt' } }, count: { $sum: 1 } } }
      ])
    ]);

    const trend12Months = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 0; i < 12; i++) {
      const d = new Date(twelveMonthsAgo);
      d.setMonth(d.getMonth() + i);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const opened = openedTrend.find(x => x._id.year === year && x._id.month === month)?.count || 0;
      const closed = closedTrend.find(x => x._id.year === year && x._id.month === month)?.count || 0;
      trend12Months.push({ name: `${monthNames[month - 1]} ${year.toString().slice(2)}`, Opened: opened, Closed: closed });
    }

    return { 
      totalTickets, totalOpen, totalInProgress, totalClosed, totalRejected, 
      statusBreakdown, priorityBreakdown: priorityBreakdownRaw, requestTypeBreakdown, trend12Months 
    };
  },

  async getHappinessIndex(from?: string, to?: string) {
    const dateFilter = from || to
      ? { createdAt: { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) } }
      : {};

    const activeStatuses = ['open', 'approved', 'accepted', 'in_progress', 'pr_raised', 'pr_review', 'pr_merged'];
    const now = new Date();

    // Group by projectId instead of companyName
    const data = await Ticket.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$projectId',
          totalQueries: { $sum: 1 },
          openTickets: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
          activeTickets: { $sum: { $cond: [{ $in: ['$status', activeStatuses] }, 1, 0] } },
          resolvedQueries: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
          p0p1Active: { 
            $sum: { 
              $cond: [
                { $and: [{ $in: ['$status', activeStatuses] }, { $in: ['$priority', ['P0', 'P1']] }] }, 
                1, 
                0
              ] 
            } 
          },
          docsAttached: { $sum: { $size: { $ifNull: ['$attachments', []] } } },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ['$status', activeStatuses] },
                    { $gt: ['$requiredDeliveryDays', 0] },
                    { $lt: [{ $add: ['$createdAt', { $multiply: ['$requiredDeliveryDays', 24 * 60 * 60 * 1000] }] }, now] }
                  ]
                },
                1,
                0
              ]
            }
          },
          avgResolutionHrs: { $avg: { $cond: [{ $ifNull: ['$resolutionHrs', false] }, '$resolutionHrs', null] } },
          lastQueryDate: { $max: '$createdAt' },
        },
      },
      { $sort: { totalQueries: -1 } },
    ]);

    // Populate project names
    const projectIds = data.map(d => d._id);
    const projects = await Project.find({ _id: { $in: projectIds } }).select('name').lean();
    const projectMap = new Map(projects.map(p => [p._id.toString(), p.name]));

    return data.map((d) => ({
      projectId: d._id,
      projectName: projectMap.get(d._id?.toString()) ?? 'Unknown',
      totalQueries: d.totalQueries,
      openTickets: d.openTickets,
      activeTickets: d.activeTickets,
      resolvedQueries: d.resolvedQueries,
      p0p1Active: d.p0p1Active,
      docsAttached: d.docsAttached,
      overdue: d.overdue,
      avgResolutionHrs: d.avgResolutionHrs ? parseFloat(d.avgResolutionHrs.toFixed(1)) : null,
      lastQueryDate: d.lastQueryDate,
    }));
  },

  async getProjectDetail(projectId: string) {
    const [tickets, metrics, project] = await Promise.all([
      Ticket.find({ projectId }).populate('assignedTo', 'name').sort({ createdAt: -1 }).limit(50),
      CompanyMetrics.findOne({ companyName: (await Project.findById(projectId).select('name').lean())?.name }),
      Project.findById(projectId).select('name mainDeveloper').populate('mainDeveloper', 'name email'),
    ]);
    return { project, metrics, tickets };
  },

  async getDeveloperStats(from?: string, to?: string) {
    const dateFilter = from || to
      ? { createdAt: { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) } }
      : {};

    const developers = await User.find({ role: 'developer', isActive: true }).select('name email');
    const activeStatuses = ['open', 'approved', 'accepted', 'in_progress', 'pr_raised', 'pr_review', 'pr_merged'];
    const now = new Date();

    const stats = await Ticket.aggregate([
      { $match: { ...dateFilter, assignedTo: { $in: developers.map(d => d._id) } } },
      {
        $group: {
          _id: '$assignedTo',
          assigned: { $sum: 1 },
          active: { $sum: { $cond: [{ $in: ['$status', activeStatuses] }, 1, 0] } },
          closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ['$status', activeStatuses] },
                    { $gt: ['$requiredDeliveryDays', 0] },
                    { $lt: [{ $add: ['$createdAt', { $multiply: ['$requiredDeliveryDays', 24 * 60 * 60 * 1000] }] }, now] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const statsMap = new Map(stats.map(s => [s._id.toString(), s]));

    return developers.map(d => {
      const s = statsMap.get(d._id.toString());
      return {
        userId: d._id,
        name: d.name,
        email: d.email,
        assigned: s?.assigned || 0,
        active: s?.active || 0,
        closed: s?.closed || 0,
        overdue: s?.overdue || 0,
      };
    });
  },

  async exportCSV(from?: string, to?: string): Promise<string> {
    const dateFilter = from || to
      ? { createdAt: { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) } }
      : {};

    const tickets = await Ticket.find(dateFilter)
      .populate('raisedBy', 'name')
      .populate('assignedTo', 'name')
      .populate('projectId', 'name')
      .lean();

    const header = 'Ticket No,Project,Request Type,Priority,Status,Raised By,Assigned To,Created,Closed,Resolution (hrs),Attachments';
    
    const formatDate = (date?: Date) => {
      if (!date) return '';
      return new Date(date).toLocaleString('en-US', { 
        year: 'numeric', month: 'short', day: '2-digit', 
        hour: '2-digit', minute: '2-digit' 
      }).replace(',', '');
    };

    const rows = tickets.map((t) =>
      [
        t.ticketNumber,
        (t.projectId as any)?.name ?? '',
        t.requestType,
        t.priority,
        t.status,
        (t.raisedBy as any)?.name ?? '',
        (t.assignedTo as any)?.name ?? '',
        formatDate(t.createdAt),
        formatDate(t.closedAt),
        t.resolutionHrs ?? '',
        t.attachments?.length ?? 0,
      ].map(field => `"${field}"`).join(',')
    );

    return [header, ...rows].join('\n');
  },

  async getCompanyReport(projectId: string, from?: string, to?: string) {
    const projectObjId = new (await import('mongoose')).default.Types.ObjectId(projectId);
    const dateFilter = from || to
      ? { createdAt: { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) } }
      : {};
    const baseMatch = { projectId: projectObjId, ...dateFilter };
    const activeStatuses = ['open', 'approved', 'accepted', 'in_progress', 'pr_raised', 'pr_review', 'pr_merged'];
    const now = new Date();

    const [project, totalTickets, totalOpen, totalClosed, totalRejected, totalInProgress,
      statusBreakdown, priorityBreakdown, requestTypeBreakdown, recentTickets, devStats] =
      await Promise.all([
        Project.findById(projectId).select('name description githubRepoUrl mainDeveloper').lean(),
        Ticket.countDocuments(baseMatch),
        Ticket.countDocuments({ ...baseMatch, status: 'open' }),
        Ticket.countDocuments({ ...baseMatch, status: 'closed' }),
        Ticket.countDocuments({ ...baseMatch, status: 'rejected' }),
        Ticket.countDocuments({ ...baseMatch, status: { $in: ['accepted', 'in_progress'] } }),
        Ticket.aggregate([{ $match: baseMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        Ticket.aggregate([{ $match: baseMatch }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
        Ticket.aggregate([{ $match: baseMatch }, { $group: { _id: '$requestType', count: { $sum: 1 } } }]),
        Ticket.find(baseMatch).populate('assignedTo', 'name').sort({ createdAt: -1 }).limit(20).lean(),
        Ticket.aggregate([
          { $match: { ...baseMatch, assignedTo: { $exists: true } } },
          { $group: { _id: '$assignedTo', assigned: { $sum: 1 }, closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } }, active: { $sum: { $cond: [{ $in: ['$status', activeStatuses] }, 1, 0] } }, overdue: { $sum: { $cond: [{ $and: [{ $in: ['$status', activeStatuses] }, { $gt: ['$requiredDeliveryDays', 0] }, { $lt: [{ $add: ['$createdAt', { $multiply: ['$requiredDeliveryDays', 24 * 60 * 60 * 1000] }] }, now] }] }, 1, 0] } } } },
        ]),
      ]);

    // Populate dev names for dev stats
    const devIds = devStats.map((d: any) => d._id);
    const devUsers = await User.find({ _id: { $in: devIds } }).select('name email').lean();
    const devUserMap = new Map(devUsers.map(u => [u._id.toString(), u]));

    // 12-month trend
    const twelveMonthsAgo = new Date(); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11); twelveMonthsAgo.setDate(1); twelveMonthsAgo.setHours(0, 0, 0, 0);
    const [openedTrend, closedTrend] = await Promise.all([
      Ticket.aggregate([{ $match: { projectId: projectObjId, createdAt: { $gte: twelveMonthsAgo } } }, { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } }]),
      Ticket.aggregate([{ $match: { projectId: projectObjId, closedAt: { $gte: twelveMonthsAgo }, status: 'closed' } }, { $group: { _id: { year: { $year: '$closedAt' }, month: { $month: '$closedAt' } }, count: { $sum: 1 } } }]),
    ]);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trend12Months = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(twelveMonthsAgo); d.setMonth(d.getMonth() + i);
      const year = d.getFullYear(); const month = d.getMonth() + 1;
      trend12Months.push({ name: `${monthNames[month - 1]} ${year.toString().slice(2)}`, Opened: openedTrend.find((x: any) => x._id.year === year && x._id.month === month)?.count || 0, Closed: closedTrend.find((x: any) => x._id.year === year && x._id.month === month)?.count || 0 });
    }

    // Avg resolution
    const resAgg = await Ticket.aggregate([{ $match: { ...baseMatch, status: 'closed', resolutionHrs: { $exists: true } } }, { $group: { _id: null, avg: { $avg: '$resolutionHrs' } } }]);
    const avgResolutionHrs = resAgg[0]?.avg ? parseFloat(resAgg[0].avg.toFixed(1)) : null;

    return {
      project,
      totalTickets, totalOpen, totalClosed, totalRejected, totalInProgress, avgResolutionHrs,
      statusBreakdown, priorityBreakdown, requestTypeBreakdown,
      trend12Months,
      recentTickets,
      developerStats: devStats.map((d: any) => ({
        ...d,
        name: devUserMap.get(d._id?.toString())?.name ?? 'Unknown',
        email: devUserMap.get(d._id?.toString())?.email ?? '',
      })),
    };
  },
};

