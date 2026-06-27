import { ProjectTimeline } from './models';

export interface IProjectMemory {
    loadProject(id: string): Promise<ProjectTimeline>;
    saveSnapshot(project: ProjectTimeline): Promise<void>;
}
