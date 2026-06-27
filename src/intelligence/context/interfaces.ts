import { ContextSignature } from './models';
import { UserIntent } from '../intent/models';

export interface IContextEngine {
    analyze(intent: UserIntent): Promise<ContextSignature>;
}
