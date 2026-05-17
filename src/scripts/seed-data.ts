import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { User } from '../models/User.model';
import { DeveloperProfile } from '../models/DeveloperProfile.model';
import { Project } from '../models/Project.model';
import { Ticket } from '../models/Ticket.model';

const SEED_PASSWORD = 'Password123';

const companies = ['Acme Corp', 'Globex', 'Initech', 'Stark Industries', 'Wayne Enterprises'];
const projectNames = ['Phoenix', 'Apollo', 'Titan', 'Zeus', 'Hera', 'Athena', 'Ares', 'Hermes', 'Artemis', 'Poseidon'];
const skills = ['React', 'Node.js', 'Python', 'Go', 'AWS', 'Docker', 'MongoDB', 'PostgreSQL'];

const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const getRandomItems = <T>(arr: T[], count: number): T[] => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

async function seedData() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('✅ Connected.');

  // Find Admin for Project creation
  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    admin = await User.create({
      name: 'System Admin',
      email: 'admin_seed@filflo.com',
      passwordHash: SEED_PASSWORD,
      role: 'admin',
      isActive: true,
    });
  }

  // 1. Create 6 Developers
  console.log('👨‍💻 Creating Developers...');
  const developers = [];
  for (let i = 1; i <= 6; i++) {
    const email = `dev${i}_${Date.now()}@filflo.com`;
    const user = await User.create({
      name: `Developer ${i}`,
      email,
      passwordHash: SEED_PASSWORD,
      role: 'developer',
      isActive: true,
    });
    
    await DeveloperProfile.create({
      userId: user._id,
      skills: getRandomItems(skills, 3),
      domains: ['Frontend', 'Backend'],
      currentLoad: Math.floor(Math.random() * 3),
      totalCompleted: Math.floor(Math.random() * 20),
      avgResolutionHrs: Math.floor(Math.random() * 48) + 12,
      prAcceptRate: Math.floor(Math.random() * 30) + 70, // 70-100%
      githubUsername: `dev${i}github`,
    });
    
    developers.push(user);
  }

  // 2. Create 4 Support Team Members
  console.log('🎧 Creating Support Team...');
  const supports = [];
  for (let i = 1; i <= 4; i++) {
    const email = `support${i}_${Date.now()}@filflo.com`;
    const user = await User.create({
      name: `Support ${i}`,
      email,
      passwordHash: SEED_PASSWORD,
      role: 'support',
      companyName: getRandomItem(companies),
      isActive: true,
    });
    supports.push(user);
  }

  // 3. Create 10 Projects
  console.log('🚀 Creating Projects...');
  const projects = [];
  for (let i = 0; i < 10; i++) {
    const project = await Project.create({
      name: `${projectNames[i]} - ${Date.now()}`,
      description: `Description for project ${projectNames[i]}`,
      githubRepoUrl: `https://github.com/org/${projectNames[i].toLowerCase()}`,
      webhookSecret: `whsec_${Math.random().toString(36).substring(2, 15)}`,
      isActive: true,
      createdBy: admin._id,
    });
    projects.push(project);
  }

  // 4. Create 20 Tickets
  console.log('🎫 Creating Tickets...');
  const priorities = ['low', 'medium', 'high', 'critical'];
  const statuses = ['open', 'approved', 'in_progress', 'closed', 'rejected'];
  
  for (let i = 1; i <= 20; i++) {
    const project = getRandomItem(projects);
    const supportUser = getRandomItem(supports);
    const assignedDev = Math.random() > 0.3 ? getRandomItem(developers) : null;
    const status = assignedDev ? getRandomItem(['approved', 'in_progress', 'closed']) : getRandomItem(['open', 'rejected']);

    await Ticket.create({
      projectId: project._id,
      companyName: supportUser.companyName || 'Unknown Inc.',
      description: `Issue ticket #${i} for ${project.name}. Needs attention.`,
      raisedBy: supportUser._id,
      priority: getRandomItem(priorities),
      status: status,
      assignedTo: assignedDev ? assignedDev._id : undefined,
      prStatus: status === 'closed' ? 'merged' : (status === 'in_progress' ? 'open' : 'none'),
      adminNotes: status === 'rejected' ? undefined : 'Reviewed and looks good.',
      rejectionReason: status === 'rejected' ? 'Out of scope' : undefined,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000), // random past date
    });
  }

  console.log('🎉 Seeding complete!');
  await mongoose.disconnect();
}

seedData().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
