import { IGoalAnalyzer } from './interfaces';
import { UserGoal } from './models';
import { RouterManager } from '../../infrastructure/gateway/routerManager';

export class GoalAnalyzer implements IGoalAnalyzer {
    constructor(private router: RouterManager) {}

    async analyze(input: string): Promise<UserGoal> {
        const response = await this.router.routeTask({
            id: `goal-${Date.now()}`,
            prompt: `Extract primary objective from this user input: "${input}"`,
            systemPrompt: 'You are the Goal Analyzer of UltimateAI. Your job is to extract the core human objective.',
            requiredCapability: 'REASONING'
        });
        
        return {
            rawInput: input,
            primaryObjective: response.content,
            implicitNeeds: []
        };
    }
}
