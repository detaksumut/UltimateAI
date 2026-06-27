import { IFeatureExtractor } from './interfaces';
import { FeatureSet } from './models';
import { ProductBlueprint } from '../blueprint/models';
import { RouterManager } from '../../infrastructure/gateway/routerManager';

export class FeatureExtractor implements IFeatureExtractor {
    constructor(private router: RouterManager) {}

    async extractFeatures(blueprint: ProductBlueprint): Promise<FeatureSet> {
        const response = await this.router.routeTask({
            id: `feature-${Date.now()}`,
            prompt: `Extract physical/digital features required for this blueprint.`,
            systemPrompt: 'You are the Feature Extractor. Extract things like CAMERA, GPS, MAP based on UX needs.',
            requiredCapability: 'FAST_INFERENCE'
        });
        
        return {
            blueprintId: blueprint.id,
            features: []
        };
    }
}
