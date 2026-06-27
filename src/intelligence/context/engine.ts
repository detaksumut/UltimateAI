import { IContextEngine } from './interfaces';
import { ContextSignature } from './models';
import { UserIntent } from '../intent/models';
import { RouterManager } from '../../infrastructure/connectors/routerManager';

export class ContextEngine implements IContextEngine {
    constructor(private router: RouterManager) {}

    async analyze(intent: UserIntent): Promise<ContextSignature> {
        const response = await this.router.routeTask({
            id: `context-${Date.now()}`,
            prompt: `Extract spatial and temporal context from: "${intent.rawInput}"`,
            systemPrompt: 'You are the Context Engine. Extract location and time frames.',
            requiredCapability: 'FAST_INFERENCE'
        });
        
        return {
            id: `ctx-${Date.now()}`,
            domainTags: ['mocked_tag']
        };
    }
}
