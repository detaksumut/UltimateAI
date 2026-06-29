import { RouterManager } from '../../infrastructure/connectors/routerManager';
import { PromptBuilder } from '../../cognition/prompt-builder/builder';
import { OutputParser } from '../../cognition/output-parser/parser';

export interface ClarificationResult {
    level: 1 | 2 | 3;
    message: string;
    inferredRequirements: string | null;
    options: string[] | null;
    proposal?: any | null;
    diff?: string[] | null;
}

export class ClarificationEngine {
    private promptBuilder = new PromptBuilder();
    private outputParser = new OutputParser();

    constructor(private router: RouterManager) {}

    async analyzeRequirements(chatHistory: any[]): Promise<ClarificationResult> {
        console.log(`[ClarificationEngine] Analyzing conversation history...`);

        // Format history into text for the LLM
        const formattedHistory = chatHistory.map((msg, index) => 
            `[${msg.role.toUpperCase()}]: ${msg.content}`
        ).join('\n\n');

        // Dynamically build the prompt from cognition instructions
        const systemPrompt = await this.promptBuilder.build('clarification', {
            CONVERSATION_HISTORY: formattedHistory
        });

        let response;
        try {
            response = await this.router.routeTask({
                id: `clarify-${Date.now()}`,
                prompt: "Analyze the conversation history based on your instructions.",
                systemPrompt: systemPrompt,
                requiredCapability: 'REASONING'
            });
        } catch (routeError: any) {
            console.error('[ClarificationEngine] Router failed (e.g. 503 High Demand):', routeError.message);
            // Graceful fallback to prevent app crash
            return {
                level: 1,
                message: 'Melanjutkan proses (Mode Offline/Fallback)...',
                inferredRequirements: formattedHistory,
                options: null
            };
        }

        try {
            const parsed = this.outputParser.parseJson<any>(response.content);
            return {
                level: parsed.level || 1,
                message: parsed.message || 'Melanjutkan proses...',
                inferredRequirements: parsed.inferredRequirements || null,
                options: parsed.options || null,
                proposal: parsed.proposal || null,
                diff: parsed.diff || null
            };
        } catch (error) {
            console.error('[ClarificationEngine] Error parsing clarification:', error);
            // Default to Level 1 (proceed) if parsing fails to avoid blocking the pipeline completely
            return {
                level: 1,
                message: 'Melanjutkan proses...',
                inferredRequirements: formattedHistory,
                options: null
            };
        }
    }
}
