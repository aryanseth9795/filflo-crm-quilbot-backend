/**
 * Migration script — run once to backfill existing tickets with new schema fields.
 * Usage: npx tsx src/scripts/migrate-tickets.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Ticket } from '../models/Ticket.model';
import { Project } from '../models/Project.model';

async function run() {
  await mongoose.connect(process.env['MONGO_URI'] as string);
  console.log('Connected to MongoDB');

  // 1. Ensure all projects have ticketCounter initialized
  await Project.updateMany(
    { ticketCounter: { $exists: false } },
    { $set: { ticketCounter: 0 } }
  );
  console.log('✓ Projects: ticketCounter initialized');

  // 2. Backfill tickets that have no ticketNumber
  const tickets = await Ticket.find({ ticketNumber: { $exists: false } }).sort({ createdAt: 1 });
  console.log(`Found ${tickets.length} tickets to migrate`);

  for (const ticket of tickets) {
    const project = await Project.findByIdAndUpdate(
      ticket.projectId,
      { $inc: { ticketCounter: 1 } },
      { new: true }
    );
    if (!project) {
      console.warn(`  Skipping ticket ${ticket._id}: project not found`);
      continue;
    }
    const brand = project.name.toUpperCase().replace(/\s+/g, '-').slice(0, 12);
    const num = String(project.ticketCounter).padStart(3, '0');
    const ticketNumber = `${brand}-${num}`;

    await Ticket.findByIdAndUpdate(ticket._id, {
      $set: {
        ticketNumber,
        requestType: ticket.requestType ?? 'bug',
        priority: ticket.priority ?? 'P2',
        attachments: ticket.attachments ?? [],
        totalAttachmentBytes: 0,
        prRevisionCount: ticket.prRevisionCount ?? 0,
        prStatus: ticket.prStatus ?? 'none',
      },
    });
    console.log(`  ✓ ${ticket._id} → ${ticketNumber}`);
  }

  console.log('\nMigration complete!');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
