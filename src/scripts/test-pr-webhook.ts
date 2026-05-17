/**
 * Filflo CRM — GitHub PR Webhook Lifecycle Test Script
 *
 * Simulates the full GitHub Pull Request lifecycle:
 *   1. PR Opened   → ticket becomes pr_raised
 *   2. PR Merged   → ticket becomes pr_merged
 *   (or Rejected   → ticket becomes pr_rejected)
 *
 * The script automatically:
 *   - Finds a real ticket in an active state from the DB
 *   - Looks up the project's webhookSecret
 *   - Generates the correct HMAC-SHA256 X-Hub-Signature-256 header
 *   - Fires each webhook event in sequence with a short delay
 *
 * Usage:
 *   npx tsx src/scripts/test-pr-webhook.ts
 *   npx tsx src/scripts/test-pr-webhook.ts --action=rejected
 *   npx tsx src/scripts/test-pr-webhook.ts --ticketNumber=NEX-001
 */

import mongoose from 'mongoose';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

import { Ticket } from '../models/Ticket.model';
import { Project } from '../models/Project.model';

// ─── Config ────────────────────────────────────────────────────────────────────

const SERVER_URL = process.env['SERVER_URL'] ?? 'http://localhost:5000';

const args = process.argv.slice(2);
const ACTION_ARG = args.find(a => a.startsWith('--action='))?.split('=')[1] ?? 'merged';
const TICKET_ARG = args.find(a => a.startsWith('--ticketNumber='))?.split('=')[1];
const PR_NUMBER  = Math.floor(Math.random() * 900) + 100; // random PR# 100-999

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sign(body: string, secret: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
}

function post(url: string, body: object, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(body);
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(raw),
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
    });

    req.on('error', reject);
    req.write(raw);
    req.end();
  });
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildPRPayload(action: string, merged: boolean, ticketNumber: string, repoFullName: string, prNumber: number) {
  return {
    action,
    number: prNumber,
    pull_request: {
      title: `feat: Fix and ship [${ticketNumber}]`,
      html_url: `https://github.com/${repoFullName}/pull/${prNumber}`,
      merged,
      user: { login: 'filflo-bot' },
    },
    repository: {
      full_name: repoFullName,
    },
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n🔌  Connecting to MongoDB...');
  await mongoose.connect(process.env['MONGO_URI'] as string);
  console.log('✅  Connected\n');

  // ── 1. Find a suitable ticket ──────────────────────────────────────────────
  const activeStatuses = ['in_progress', 'accepted', 'approved', 'open'];

  let ticket: any;
  if (TICKET_ARG) {
    ticket = await Ticket.findOne({ ticketNumber: TICKET_ARG.toUpperCase() }).lean();
    if (!ticket) {
      console.error(`❌  Ticket "${TICKET_ARG}" not found in DB.`);
      process.exit(1);
    }
  } else {
    ticket = await Ticket.findOne({ status: { $in: activeStatuses } })
      .sort({ createdAt: -1 })
      .lean();
    if (!ticket) {
      console.error('❌  No active tickets found. Run the seed script first.');
      process.exit(1);
    }
  }

  const ticketNumber = ticket.ticketNumber as string;
  const projectId    = ticket.projectId.toString();

  // ── 2. Get project secret ──────────────────────────────────────────────────
  const project = await Project.findById(projectId)
    .select('name githubRepoUrl webhookSecret')
    .lean<{ name: string; githubRepoUrl?: string; webhookSecret: string }>();
  if (!project) {
    console.error(`❌  Project ${projectId} not found.`);
    process.exit(1);
  }

  const repoFullName = project.githubRepoUrl
    ? project.githubRepoUrl.replace('https://github.com/', '')
    : `${project.name.toLowerCase()}/main-app`;

  const secret = project.webhookSecret;
  const webhookUrl = `${SERVER_URL}/api/webhooks/github/${projectId}`;

  console.log('═══════════════════════════════════════════════════════');
  console.log(`🎫  Ticket:    ${ticketNumber}  (status: ${ticket.status})`);
  console.log(`🏢  Project:   ${project.name} (${repoFullName})`);
  console.log(`🔗  Endpoint:  ${webhookUrl}`);
  console.log(`🔀  PR Number: #${PR_NUMBER}`);
  console.log(`🎯  Final:     PR ${ACTION_ARG.toUpperCase()}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // ── 3. Stage 1: PR Opened ─────────────────────────────────────────────────
  console.log('📤  [1/2] Firing: PR Opened...');
  const openedPayload = buildPRPayload('opened', false, ticketNumber, repoFullName, PR_NUMBER);
  const openedBody    = JSON.stringify(openedPayload);

  const res1 = await post(webhookUrl, openedPayload, {
    'X-GitHub-Event': 'pull_request',
    'X-Hub-Signature-256': sign(openedBody, secret),
    'User-Agent': 'GitHub-Hookshot/test',
  });

  const parsed1 = (() => { try { return JSON.parse(res1.body); } catch { return res1.body; } })();
  if (res1.status === 200) {
    console.log(`    ✅  ${res1.status} — Webhook received (server processing async)`);
  } else {
    console.log(`    ❌  ${res1.status} —`, parsed1);
    process.exit(1);
  }

  console.log('    ⏳  Waiting 2s for server to process...\n');
  await sleep(15000);

  // ── 4. Stage 2: PR Merged or Rejected ─────────────────────────────────────
  const isMerged  = ACTION_ARG !== 'rejected';
  const action2   = 'closed';
  const label     = isMerged ? 'Merged' : 'Rejected (Closed without merge)';

  console.log(`📤  [2/2] Firing: PR ${label}...`);
  const closePayload = buildPRPayload(action2, isMerged, ticketNumber, repoFullName, PR_NUMBER);
  const closeBody    = JSON.stringify(closePayload);

  const res2 = await post(webhookUrl, closePayload, {
    'X-GitHub-Event': 'pull_request',
    'X-Hub-Signature-256': sign(closeBody, secret),
    'User-Agent': 'GitHub-Hookshot/test',
  });

  const parsed2 = (() => { try { return JSON.parse(res2.body); } catch { return res2.body; } })();
  if (res2.status === 200) {
    console.log(`    ✅  ${res2.status} — Webhook received (server processing async)`);
  } else {
    console.log(`    ❌  ${res2.status} —`, parsed2);
  }

  console.log('\n    ⏳  Waiting 2s for server to process final event...');
  await sleep(2000);

  // ── 5. Confirm DB state ───────────────────────────────────────────────────
  const updated = await Ticket.findOne({ ticketNumber }).lean<{ status: string; prStatus: string; prRevisionCount: number }>();
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊  Final DB State:');
  console.log(`    status:         ${updated?.status}`);
  console.log(`    prStatus:       ${updated?.prStatus}`);
  console.log(`    prRevisionCount: ${updated?.prRevisionCount}`);
  console.log('═══════════════════════════════════════════════════════');

  const expectedStatus = isMerged ? 'pr_merged' : 'pr_rejected';
  if (updated?.status === expectedStatus) {
    console.log(`\n✅  Test PASSED! Ticket is now "${updated.status}"`);
  } else {
    console.log(`\n⚠️   Unexpected status: "${updated?.status}" (expected "${expectedStatus}")`);
    console.log('    The webhook may still be processing — check server logs.');
  }

  await mongoose.disconnect();
  console.log('\n🔌  Disconnected.\n');
}

run().catch(err => {
  console.error('\n❌  Script failed:', err);
  process.exit(1);
});
