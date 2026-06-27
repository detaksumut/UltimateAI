import { GenerationTask, DigitalAsset } from './models';
import { ProductBlueprint } from '../blueprint/models';

export interface IGenerationEngine {
    generate(blueprint: ProductBlueprint, target: AssetType): Promise<DigitalAsset>;
}
