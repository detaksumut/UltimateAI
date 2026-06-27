import { IGenerationEngine } from './interfaces';
import { DigitalAsset, AssetType } from './models';
import { ProductBlueprint } from '../../intelligence/blueprint/models';
import { RouterManager } from '../../infrastructure/gateway/routerManager';

export class GenerationEngine implements IGenerationEngine {
    constructor(private router: RouterManager) {}

    async generate(blueprint: ProductBlueprint, target: AssetType): Promise<DigitalAsset> {
        console.log(`[GenerationEngine] Starting generation for asset type: ${target}`);
        
        // This is where heavy coding or content generation models are used
        const response = await this.router.routeTask({
            id: `gen-${Date.now()}`,
            prompt: `Generate production-ready asset of type ${target} based on blueprint ${blueprint.id}`,
            systemPrompt: 'You are the ultimate Generation Engine. You output raw code, text, or structure based on the target asset.',
            requiredCapability: 'CODING' // Deepseek, Anthropic, or Gemini
        });
        
        return {
            taskId: `task-${Date.now()}`,
            type: target,
            rawData: response.content,
            metadata: {
                generatedAt: new Date().toISOString(),
                providerUsed: response.provider
            }
        };
    }
}
