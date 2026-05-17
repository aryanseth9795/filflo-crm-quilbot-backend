/**
 * Reset Script: Drop all collections except `users`
 * Usage: npx tsx src/scripts/reset-db.ts
 *
 * This is destructive and irreversible. It will permanently delete all
 * tickets, projects, events, PR events, developer profiles, and company
 * metrics. User accounts are preserved.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env';

const PRESERVED = new Set(['users', 'projects']);

async function resetDb() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect("mongodb+srv://iiitianaryan:yPGKIPatYhTZFyzF@cluster0.n20if.mongodb.net/filflo?retryWrites=true&w=majority&appName=Cluster0", { serverSelectionTimeoutMS: 10000 } as any);
  console.log('✅ Connected.\n');

  const db = mongoose.connection.db!;
  const collections = await db.listCollections().toArray();
  const names = collections.map(c => c.name);

  const toDrop = names.filter(n => !PRESERVED.has(n));
  const toKeep = names.filter(n => PRESERVED.has(n));

  if (toDrop.length === 0) {
    console.log('ℹ️  No collections to drop (database may already be empty).');
    await mongoose.disconnect();
    return;
  }

  console.log('📋 Collections found:');
  toKeep.forEach(n => console.log(`   ✅ KEEP   ${n}`));
  toDrop.forEach(n => console.log(`   🗑️  DROP   ${n}`));

  console.log('\n⚠️  This will permanently delete the collections listed above.');
  console.log('   Press Ctrl+C within 5 seconds to abort...\n');
  await new Promise(r => setTimeout(r, 5000));

  for (const name of toDrop) {
    await db.dropCollection(name);
    console.log(`   Dropped: ${name}`);
  }

  console.log('\n✅ Database reset complete. User accounts are intact.');
  await mongoose.disconnect();
  console.log('🔌 Disconnected. Done.');
}

resetDb().catch((err) => {
  console.error('❌ Reset failed:', err.message);
  process.exit(1);
});
