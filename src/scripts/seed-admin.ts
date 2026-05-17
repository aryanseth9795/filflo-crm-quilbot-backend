/**
 * Seed Script: Create the initial admin user
 * Usage: npx tsx src/scripts/seed-admin.ts
 *
 * Edit ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD below before running.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { User } from '../models/User.model';

// ──────────────────────────────────────────────
//  ✏️  Change these before running
// ──────────────────────────────────────────────
const ADMIN_NAME = 'Super Admin';
const ADMIN_EMAIL = 'admin@filflo.com';
const ADMIN_PASSWORD = 'Admin@1234'; // min 8 chars — change after first login!
// ──────────────────────────────────────────────

async function seedAdmin() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('✅ Connected.');

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log(`⚠️  Admin with email "${ADMIN_EMAIL}" already exists (role: ${existing.role}). Skipping.`);
    await mongoose.disconnect();
    return;
  }

  const admin = await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    passwordHash: ADMIN_PASSWORD, // the pre-save hook will bcrypt-hash this
    role: 'admin',
    isActive: true,
  });

  console.log('');
  console.log('🎉 Admin user created successfully!');
  console.log('──────────────────────────────────');
  console.log(`   Name  : ${admin.name}`);
  console.log(`   Email : ${admin.email}`);
  console.log(`   Role  : ${admin.role}`);
  console.log(`   ID    : ${admin._id}`);
  console.log('──────────────────────────────────');
  console.log('👉 Log in at http://localhost:5173 with the credentials above.');
  console.log('   Change your password after first login!');

  await mongoose.disconnect();
  console.log('🔌 Disconnected. Done.');
}

seedAdmin().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
