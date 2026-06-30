import { IGenerationEngine } from './interfaces';
import { DigitalAsset, AssetType } from './models';
import { Blueprint } from '../../intelligence/blueprint/models';
import { RouterManager } from '../../infrastructure/connectors/routerManager';
import { PromptBuilder } from '../../cognition/prompt-builder/builder';
import { OutputParser } from '../../cognition/output-parser/parser';

export class GenerationEngine implements IGenerationEngine {
    private promptBuilder = new PromptBuilder();
    private outputParser = new OutputParser();

    constructor(private router: RouterManager) {}

    async generate(blueprint: any, target: string, rawInput: string = '', attachedImage: string = '', savedImageUrl: string = ''): Promise<DigitalAsset> {
        console.log(`[GenerationEngine] Starting generation for asset type: ${target}`);
        
        let systemPrompt = 'You are a general generation engine.';
        
        if (target === 'WEB_PROTOTYPE') {
            systemPrompt = await this.promptBuilder.build('generation', {
                USER_INPUT: rawInput,
                BLUEPRINT_ID: blueprint.id || 'N/A'
            });
        } else if (target === 'FLYER_PROTOTYPE') {
            systemPrompt = await this.promptBuilder.build('flyer-generation', {
                USER_INPUT: rawInput,
                IMAGE_URL: savedImageUrl
            });
        }

        const response = await this.router.routeTask({
            id: `gen-${Date.now()}`,
            prompt: `Generate the ${target} based on the instructions.`,
            systemPrompt: systemPrompt,
            requiredCapability: 'CODING',
            image: attachedImage
        });
        
        // Use Cognition OutputParser to strip markdown
        const rawData = this.outputParser.parseHtml(response.content);
        
        return {
            taskId: `task-${Date.now()}`,
            type: target as any,
            rawData: rawData,
            metadata: {
                generatedAt: new Date().toISOString(),
                providerUsed: response.provider
            }
        };
    }
}
