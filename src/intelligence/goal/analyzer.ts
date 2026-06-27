import { IGoalAnalyzer } from './interfaces';
import { ProductGoal } from './models';
import { RouterManager } from '../../infrastructure/connectors/routerManager';
import { PromptBuilder } from '../../cognition/prompt-builder/builder';
import { OutputParser } from '../../cognition/output-parser/parser';

export class GoalAnalyzer implements IGoalAnalyzer {
    private promptBuilder = new PromptBuilder();
    private outputParser = new OutputParser();

    constructor(private router: RouterManager) {}

    async analyze(rawInput: string): Promise<ProductGoal> {
        console.log(`[GoalAnalyzer] Analyzing raw input: "${rawInput}"`);

        // Dynamically build the prompt from cognition instructions
        const systemPrompt = await this.promptBuilder.build('goal', {
            USER_INPUT: rawInput
        });

        // The prompt is essentially identical to the system prompt in this new architecture,
        // or we can pass rawInput as the prompt.
        const response = await this.router.routeTask({
            id: `goal-${Date.now()}`,
            prompt: rawInput,
            systemPrompt: systemPrompt,
            requiredCapability: 'REASONING'
        });

        try {
            // Parse using our new cognition output parser
            const parsed = this.outputParser.parseJson<any>(response.content);
            
            return {
                id: `goal-${Date.now()}`,
                rawInput,
                primaryObjective: parsed.primaryObjective || parsed.objective || "Unknown",
                targetAudience: parsed.targetAudience || parsed.audience || "General",
                coreConstraints: parsed.coreConstraints || parsed.constraints || [],
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[GoalAnalyzer] Error parsing goal:', error);
            console.error('Raw content:', response.content);
            // Fallback object
            return {
                id: `goal-${Date.now()}`,
                rawInput,
                primaryObjective: response.content.substring(0, 50),
                targetAudience: "Unknown",
                coreConstraints: [],
                timestamp: new Date().toISOString()
            };
        }
    }
}
