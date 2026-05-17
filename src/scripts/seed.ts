/**
 * Filflo CRM — Full Seed Script
 * Wipes all existing data and seeds:
 *   - 10 users (2 admin, 3 support, 5 developer)   password: admin1234
 *   - 20 projects (brands)
 *   - 40 tickets spread across all lifecycle statuses
 *
 * Usage: npx tsx src/scripts/seed.ts
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

import { User } from '../models/User.model';
import { Project } from '../models/Project.model';
import { Ticket } from '../models/Ticket.model';
import { PREvent } from '../models/PREvent.model';
import { CompanyMetrics } from '../models/CompanyMetrics.model';
import { DeveloperProfile } from '../models/DeveloperProfile.model';

// ─── Seed Data ───────────────────────────────────────────────────────────────

const BRANDS = [
  'Nexify', 'Lumora', 'Trakly', 'Vaultix', 'Zynapse',
  'Quorbit', 'Heliora', 'Drafto', 'Pinnex', 'Fluxar',
  'Cobble', 'Stryde', 'Aevio', 'Nuvix', 'Branto',
  'Optica', 'Credly', 'Skyflo', 'Marvyn', 'Plenix',
];

const GITHUB_REPOS = [
  'nexify/main-app', 'lumora/platform', 'trakly/core',
  'vaultix/backend', 'zynapse/frontend', 'quorbit/api',
  'heliora/web', 'drafto/saas', 'pinnex/dashboard',
  'fluxar/portal', 'cobble/crm', 'stryde/tracker',
  'aevio/marketplace', 'nuvix/suite', 'branto/hub',
  'optica/analytics', 'credly/growth', 'skyflo/ops',
  'marvyn/ai', 'plenix/infra',
];

const REQUEST_TYPES = [
  'bug', 'error', 'ui_ux_change', 'feature_request', 'special_request', 'miscellaneous',
] as const;

const PRIORITIES = ['P0', 'P1', 'P2', 'P3'] as const;

const STATUSES = [
  'open', 'approved', 'accepted', 'in_progress',
  'pr_raised', 'pr_merged', 'pr_rejected', 'closed', 'rejected',
] as const;

const DESCRIPTIONS = [
  'Login button unresponsive after password reset on mobile Chrome.',
  'Dashboard charts fail to load when date range exceeds 90 days.',
  'Redesign the onboarding flow — current UX feels outdated and confusing.',
  'Add bulk export to CSV feature for all filtered ticket results.',
  'Special white-label build required for enterprise client demo.',
  'Notification emails are not being delivered to Gmail accounts.',
  'User avatar upload crashes the app with files larger than 2MB.',
  'Add dark mode toggle across the entire platform.',
  'Payment gateway integration with Razorpay for Indian customers.',
  'Session timeout happening too quickly — users lose unsaved work.',
  'Search bar does not return results for special characters.',
  'PDF reports are missing the company logo on page 2+.',
  'Mobile navigation drawer overlaps content on iOS Safari.',
  'Add webhook support for Slack notifications on ticket status change.',
  'Calendar view for scheduled rollouts and delivery timelines.',
  'Error 500 on the /api/reports/export endpoint when data > 10k rows.',
  'Sidebar collapses unexpectedly on 1280px viewport width.',
  'Add role-based column visibility to the tickets table.',
  'Priority P0 tickets should trigger SMS alerts to on-call team.',
  'Integrate GitHub PR auto-detection with branch naming conventions.',
  'File upload hangs at 99% on slow connections without feedback.',
  'Multi-tenant data isolation issue — some users see wrong company data.',
  'Add ticket templates for common request types.',
  'Footer links are broken after the latest deployment.',
  'Performance: first meaningful paint takes 4.2s on average.',
  'OTP login flow sends OTP but never validates it correctly.',
  'Drag-and-drop kanban board for developer task management.',
  'API rate limiting returns 503 instead of 429 status code.',
  'Customer feedback form widget for post-resolution surveys.',
  'Generate monthly PDF summary report of all ticket activity.',
  'Ticket comment thread replies are not showing in chronological order.',
  'Fix z-index conflict between modal and navigation dropdown.',
  'Auto-assign tickets to least-loaded developer in a project.',
  'Two-factor authentication setup for admin accounts.',
  'Real-time ticket status updates via WebSocket notifications.',
  'Translate the UI into Hindi and Marathi for regional clients.',
  'Add audit log for all admin actions (approve, reject, assign).',
  'Analytics: track time-in-status for each lifecycle stage.',
  'Accessibility: fix missing aria-labels on all icon-only buttons.',
  'Consolidate duplicate API calls on the support dashboard page.',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(process.env['MONGO_URI'] as string);
  console.log('✅ Connected\n');

  // ── Wipe ──────────────────────────────────────────────────────────────────
  console.log('🗑️  Wiping existing data...');
  await Promise.all([
    User.deleteMany({}),
    Project.deleteMany({}),
    Ticket.deleteMany({}),
    PREvent.deleteMany({}),
    CompanyMetrics.deleteMany({}),
    DeveloperProfile.deleteMany({}),
  ]);
  console.log('   ✓ All collections cleared\n');

  // ── Users ─────────────────────────────────────────────────────────────────
  console.log('👤 Creating users...');
  const passwordHash = await bcrypt.hash('admin1234', 12);

  const userDefs = [
    { name: 'Aryan Mehta',      email: 'aryan@filflo.com',   role: 'admin' },
    { name: 'Riya Kapoor',      email: 'riya@filflo.com',    role: 'admin' },
    { name: 'Sneha Joshi',      email: 'sneha@filflo.com',   role: 'support' },
    { name: 'Kunal Sharma',     email: 'kunal@filflo.com',   role: 'support' },
    { name: 'Priya Patel',      email: 'priya@filflo.com',   role: 'support' },
    { name: 'Dev Agarwal',      email: 'dev@filflo.com',     role: 'developer' },
    { name: 'Harsh Verma',      email: 'harsh@filflo.com',   role: 'developer' },
    { name: 'Tanvi Singh',      email: 'tanvi@filflo.com',   role: 'developer' },
    { name: 'Rohan Gupta',      email: 'rohan@filflo.com',   role: 'developer' },
    { name: 'Meera Nair',       email: 'meera@filflo.com',   role: 'developer' },
  ];

  const users = await User.insertMany(
    userDefs.map(u => ({ ...u, passwordHash: passwordHash, isActive: true }))
  );

  const admins    = users.filter(u => u.role === 'admin');
  const supports  = users.filter(u => u.role === 'support');
  const devs      = users.filter(u => u.role === 'developer');

  console.log(`   ✓ ${admins.length} admins, ${supports.length} support, ${devs.length} developers`);
  console.log('   Password for all: admin1234\n');

  // ── Projects ──────────────────────────────────────────────────────────────
  console.log('🏢 Creating 20 projects (brands)...');
  const projects = await Project.insertMany(
    BRANDS.map((name, i) => ({
      name,
      description: `${name} — client project managed by Filflo CRM`,
      githubRepoUrl: `https://github.com/${GITHUB_REPOS[i]}`,
      webhookSecret: `sk_whk_seed_${name.toLowerCase()}_${Math.random().toString(36).slice(2)}`,
      isActive: true,
      createdBy: pick(admins)._id,
      mainDeveloper: pick(devs)._id,
      ticketCounter: 0,
    }))
  );
  console.log(`   ✓ ${projects.length} projects created\n`);

  // ── Tickets ───────────────────────────────────────────────────────────────
  console.log('🎫 Creating 40 tickets...');

  // Status distribution across 40 tickets
  const statusDistribution: Array<typeof STATUSES[number]> = [
    'open', 'open', 'open', 'open', 'open',          // 5
    'rejected',                                        // 1
    'approved', 'approved', 'approved', 'approved',    // 4
    'accepted', 'accepted', 'accepted',                // 3
    'in_progress', 'in_progress', 'in_progress', 'in_progress', 'in_progress', // 5
    'pr_raised', 'pr_raised', 'pr_raised', 'pr_raised', // 4
    'pr_rejected', 'pr_rejected',                      // 2
    'pr_merged', 'pr_merged', 'pr_merged',             // 3
    'closed', 'closed', 'closed', 'closed', 'closed',
    'closed', 'closed', 'closed', 'closed', 'closed', 'closed', 'closed', 'closed', // 13
  ];

  const tickets = [];
  const descShuffled = [...DESCRIPTIONS].sort(() => Math.random() - 0.5);

  for (let i = 0; i < 40; i++) {
    const status = statusDistribution[i] ?? 'open';
    const project = pick(projects);
    const raiser = pick(supports);
    const priority = pick(PRIORITIES);
    const requestType = pick(REQUEST_TYPES);
    const description = descShuffled[i] ?? descShuffled[i % descShuffled.length];

    // Increment project counter
    const updatedProject = await Project.findByIdAndUpdate(
      project._id,
      { $inc: { ticketCounter: 1 } },
      { new: true }
    );
    const brand = updatedProject!.name.toUpperCase().replace(/\s+/g, '-').slice(0, 12);
    const num   = String(updatedProject!.ticketCounter).padStart(3, '0');
    const ticketNumber = `${brand}-${num}`;

    const assignedDev = ['approved','accepted','in_progress','pr_raised','pr_merged','pr_rejected','closed'].includes(status)
      ? pick(devs)._id : undefined;

    const approvedAdmin = status !== 'open' && status !== 'rejected'
      ? pick(admins)._id : undefined;

    const closedAt = status === 'closed' ? daysAgo(Math.floor(Math.random() * 10)) : undefined;
    const createdAt = daysAgo(Math.floor(Math.random() * 60) + 5);
    const resolutionHrs = status === 'closed' && closedAt
      ? parseFloat(((closedAt.getTime() - createdAt.getTime()) / 3_600_000).toFixed(1))
      : undefined;

    tickets.push({
      ticketNumber,
      projectId: project._id,
      requestType,
      description,
      priority,
      requiredDeliveryDays: Math.random() > 0.4 ? Math.ceil(Math.random() * 7) + 1 : undefined,
      raisedBy: raiser._id,
      attachments: [],
      totalAttachmentBytes: 0,
      status,
      approvedBy: approvedAdmin,
      adminNotes: approvedAdmin ? (Math.random() > 0.5 ? `Please check the ${requestType} carefully before pushing.` : undefined) : undefined,
      rejectionReason: status === 'rejected' ? 'Duplicate of an existing ticket — please check before raising.' : undefined,
      assignedTo: assignedDev,
      acceptedAt: ['accepted','in_progress','pr_raised','pr_merged','pr_rejected','closed'].includes(status) ? daysAgo(Math.floor(Math.random() * 5) + 2) : undefined,
      devStartedAt: ['in_progress','pr_raised','pr_merged','pr_rejected','closed'].includes(status) ? daysAgo(Math.floor(Math.random() * 4) + 1) : undefined,
      prStatus: status === 'pr_raised' ? 'open'
               : status === 'pr_merged' ? 'merged'
               : status === 'pr_rejected' ? 'rejected'
               : status === 'closed' ? 'merged'
               : 'none',
      prRevisionCount: ['pr_rejected'].includes(status) ? Math.ceil(Math.random() * 2) : 0,
      clientFeedback: status === 'closed' && Math.random() > 0.5 ? 'Works perfectly now, thank you for the quick fix!' : undefined,
      supportRemark: status === 'closed' && Math.random() > 0.5 ? 'Great work on this one! Delivered ahead of schedule.' : undefined,
      closedBy: status === 'closed' ? pick(supports)._id : undefined,
      closedAt,
      resolutionHrs,
      createdAt,
      updatedAt: new Date(),
    });
  }

  await Ticket.insertMany(tickets);
  console.log(`   ✓ 40 tickets created\n`);

  // ── Developer Profiles ────────────────────────────────────────────────────
  console.log('📊 Generating developer profiles...');
  for (const dev of devs) {
    const devTickets = tickets.filter(t => t.assignedTo?.toString() === dev._id.toString());
    const closed = devTickets.filter(t => t.status === 'closed');
    const active = devTickets.filter(t => ['accepted','in_progress'].includes(t.status));
    const merged = devTickets.filter(t => ['pr_merged','closed'].includes(t.status));
    const avgRes = closed.length > 0
      ? closed.reduce((s, t) => s + (t.resolutionHrs ?? 0), 0) / closed.length
      : 0;
    const prAcceptRate = devTickets.length > 0 ? Math.round((merged.length / devTickets.length) * 100) : 0;

    await DeveloperProfile.findOneAndUpdate(
      { userId: dev._id },
      { userId: dev._id, totalCompleted: closed.length, avgResolutionHrs: parseFloat(avgRes.toFixed(1)), prAcceptRate, currentLoad: active.length },
      { upsert: true, new: true }
    );
  }
  console.log(`   ✓ ${devs.length} developer profiles upserted\n`);

  // ── Company Metrics ───────────────────────────────────────────────────────
  console.log('📈 Generating company metrics...');
  for (const project of projects) {
    const pTickets = tickets.filter(t => t.projectId.toString() === project._id.toString());
    const resolved = pTickets.filter(t => t.status === 'closed');
    const open     = pTickets.filter(t => ['open','approved','accepted','in_progress'].includes(t.status));
    const avgRes   = resolved.length > 0
      ? resolved.reduce((s, t) => s + (t.resolutionHrs ?? 0), 0) / resolved.length
      : 0;

    if (pTickets.length > 0) {
      await CompanyMetrics.findOneAndUpdate(
        { companyName: project.name },
        {
          companyName: project.name,
          totalQueries: pTickets.length,
          resolvedQueries: resolved.length,
          openTickets: open.length,
          avgResolutionHrs: parseFloat(avgRes.toFixed(1)),
          lastQueryDate: pTickets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt,
        },
        { upsert: true, new: true }
      );
    }
  }
  console.log(`   ✓ Metrics seeded for ${projects.length} brands\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════');
  console.log('✅ Seed Complete!');
  console.log('═══════════════════════════════════════');
  console.log('\n📋 Login Credentials (password: admin1234)\n');
  console.log('ADMINS:');
  admins.forEach(u => console.log(`  ${u.email}`));
  console.log('\nSUPPORT:');
  supports.forEach(u => console.log(`  ${u.email}`));
  console.log('\nDEVELOPERS:');
  devs.forEach(u => console.log(`  ${u.email}`));
  console.log('\n🏢 Brands:', BRANDS.join(', '));
  console.log(`\n🎫 40 tickets across statuses: ${[...new Set(statusDistribution)].join(', ')}`);

  await mongoose.disconnect();
  console.log('\n🔌 Disconnected from MongoDB');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
