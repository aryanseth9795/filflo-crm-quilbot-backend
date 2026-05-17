import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters').trim(),
  description: z.string().trim().optional(),
  githubRepoUrl: z.string().url('Invalid GitHub repo URL').optional().or(z.literal('')),
  mainDeveloper: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid developer ID').optional().or(z.literal('')),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
