import { IIntentParser } from './interfaces';
import { UserIntent } from './models';
import { UserGoal } from '../goal/models';
import { RouterManager } from '../../infrastructure/connectors/routerManager';

export class IntentParser implements IIntentParser {
    constructor(private router: RouterManager) {}

    async deriveIntent(goal: UserGoal): Promise<UserIntent> {
        const response = await this.router.routeTask({
            id: `intent-${Date.now()}`,
            prompt: `Determine the action required for this goal: "${goal.primaryObjective}"`,
            systemPrompt: 'You are the Intent Parser. Classify the goal into an action like CREATE, RESEARCH, ANALYZE, etc.',
            requiredCapability: 'FAST_INFERENCE'
        });
        
        return {
            id: `intent-obj-${Date.now()}`,
            rawInput: goal.primaryObjective,
            action: 'CREATE', // Simplified for structural purposes
            confidence: 0.95,
            timestamp: new Date()
        };
    }
}
