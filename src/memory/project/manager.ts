import { IProjectMemory } from './interfaces';
import { ProjectTimeline } from './models';

export class ProjectManager implements IProjectMemory {
    private inMemoryStorage: Map<string, ProjectTimeline> = new Map();

    async loadProject(id: string): Promise<ProjectTimeline> {
        const project = this.inMemoryStorage.get(id);
        if (!project) {
            throw new Error(`Project with ID ${id} not found in memory.`);
        }
        return project;
    }

    async saveSnapshot(project: ProjectTimeline): Promise<void> {
        console.log(`[ProjectManager] Saving snapshot for project ${project.projectId}`);
        this.inMemoryStorage.set(project.projectId, project);
    }
}
