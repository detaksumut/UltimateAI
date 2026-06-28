import { IGenerationEngine } from './interfaces';
import { DigitalAsset, AssetType } from './models';
import { ProductBlueprint } from '../../intelligence/blueprint/models';
import { RouterManager } from '../../infrastructure/connectors/routerManager';
import { PromptBuilder } from '../../cognition/prompt-builder/builder';
import { OutputParser } from '../../cognition/output-parser/parser';

export class GenerationEngine implements IGenerationEngine {
    private promptBuilder = new PromptBuilder();
    private outputParser = new OutputParser();

    constructor(private router: RouterManager) {}

    async generate(blueprint: any, target: AssetType | string, rawInput: string = ''): Promise<DigitalAsset> {
        console.log(`[GenerationEngine] Starting Pipeline generation for asset type: ${target}`);
        
        // Get base instructions
        let baseInstructions = 'You are a general generation engine.';
        if (target === 'WEB_PROTOTYPE') {
            baseInstructions = await this.promptBuilder.build('generation', {
                USER_INPUT: rawInput,
                BLUEPRINT_ID: blueprint.id || 'N/A'
            });
        }

        // Pipeline Step 1: The Analyst (REASONING)
        console.log(`\n>>> PIPELINE STEP 1: ANALYSIS <<<`);
        const analysisResponse = await this.router.routeTask({
            id: `gen-step1-${Date.now()}`,
            prompt: `Extract requirements and build a conceptual specification for the ${target} based on the user instructions.`,
            systemPrompt: baseInstructions + '\n\nYou are a Business Analyst. Do not write code yet, just outline the logic, data models, and features.',
            requiredCapability: 'REASONING'
        });
        
        // Pipeline Step 2: The Architect (CODING)
        console.log(`\n>>> PIPELINE STEP 2: ARCHITECTURE <<<`);
        const archResponse = await this.router.routeTask({
            id: `gen-step2-${Date.now()}`,
            prompt: `Here are the specifications:\n\n${analysisResponse.content}\n\nWrite the complete implementation for the ${target}.`,
            systemPrompt: 'You are an Expert Software Architect. Write the code implementing the specifications. Provide the full code in markdown blocks.',
            requiredCapability: 'CODING'
        });

        // Pipeline Step 3: The Reviewer (FAST_INFERENCE)
        console.log(`\n>>> PIPELINE STEP 3: REVIEW & DELIVERY <<<`);
        const reviewResponse = await this.router.routeTask({
            id: `gen-step3-${Date.now()}`,
            prompt: `Review and finalize the following code:\n\n${archResponse.content}\n\nEnsure it is completely functional and bug-free. Output the final HTML/JS/CSS code block.`,
            systemPrompt: 'You are a Code Reviewer and Delivery Agent. Polish the code and ensure it is ready for production.',
            requiredCapability: 'FAST_INFERENCE'
        });

        // Use Cognition OutputParser to strip markdown from final output
        const rawData = this.outputParser.parseHtml(reviewResponse.content);
        
        return {
            taskId: `task-${Date.now()}`,
            type: target as any,
            rawData: rawData,
            metadata: {
                generatedAt: new Date().toISOString(),
                providerUsed: reviewResponse.provider,
                pipelineProviders: [analysisResponse.provider, archResponse.provider, reviewResponse.provider]
            }
        };
    }
}
