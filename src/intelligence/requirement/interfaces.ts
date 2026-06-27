import { Blueprint } from './models';
import { ReasoningChain } from '../reasoning/models';

export interface IRequirementBuilder {
    build(reasoning: ReasoningChain): Promise<Blueprint>;
}
