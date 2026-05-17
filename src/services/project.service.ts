import { Project } from '../models/Project.model';
import { AppError } from '../utils/AppError';
import { generateWebhookSecret } from '../utils/github';
import { env } from '../config/env';
import { CreateProjectInput, UpdateProjectInput } from '../validators/project.validator';

export const projectService = {
  async create(data: CreateProjectInput, createdBy: string) {
    const webhookSecret = generateWebhookSecret();
    const payload = { ...data, webhookSecret, createdBy };
    if (payload.mainDeveloper === '') payload.mainDeveloper = null as any;
    if (payload.githubRepoUrl === '') payload.githubRepoUrl = undefined;

    const project = await Project.create(payload);

    const webhookUrl = `${env.SERVER_URL}/api/webhooks/github/${project._id}`;
    return { project, webhookUrl, webhookSecret };
  },

  async list() {
    return Project.find({ isActive: true })
      .populate('createdBy', 'name email')
      .populate('mainDeveloper', 'name email')
      .sort({ createdAt: -1 });
  },

  async getById(id: string, includeSecret = false) {
    const query = Project.findById(id).populate('createdBy', 'name email').populate('mainDeveloper', 'name email');
    if (includeSecret) query.select('+webhookSecret');
    const project = await query;
    if (!project || !project.isActive) throw new AppError('Project not found', 404);
    return project;
  },

  async getByIdWithSecret(id: string) {
    const project = await Project.findById(id).select('+webhookSecret');
    if (!project || !project.isActive) throw new AppError('Project not found', 404);
    return project;
  },

  async update(id: string, data: UpdateProjectInput) {
    const payload = { ...data };
    if (payload.mainDeveloper === '') payload.mainDeveloper = null as any;
    const project = await Project.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!project) throw new AppError('Project not found', 404);
    return project;
  },

  async deactivate(id: string) {
    const project = await Project.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!project) throw new AppError('Project not found', 404);
    return project;
  },

  async regenerateSecret(id: string) {
    const newSecret = generateWebhookSecret();
    const project = await Project.findByIdAndUpdate(id, { webhookSecret: newSecret }, { new: true });
    if (!project) throw new AppError('Project not found', 404);
    const webhookUrl = `${env.SERVER_URL}/api/webhooks/github/${project._id}`;
    return { project, webhookUrl, webhookSecret: newSecret };
  },
};
