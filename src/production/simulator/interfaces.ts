import { SimulationState, RevisionRequest } from './models';
import { Blueprint } from '../requirement/models';

export interface ISimulatorEngine {
    startSimulation(blueprint: Blueprint): Promise<SimulationState>;
    requestRevision(request: RevisionRequest): Promise<Blueprint>;
}
