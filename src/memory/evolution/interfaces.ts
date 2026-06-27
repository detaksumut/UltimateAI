import { EvolutionFeedback } from './models';

export interface IEvolutionEngine {
    adapt(feedback: EvolutionFeedback): Promise<void>;
}
