import { ReasoningChain } from './models';
import { UserIntent } from '../intent/models';
import { ContextSignature } from '../context/models';
import { KnowledgeGraph } from '../knowledge/models';

export interface IReasoningEngine {
    reason(intent: UserIntent, context: ContextSignature, knowledge: KnowledgeGraph): Promise<ReasoningChain>;
}
