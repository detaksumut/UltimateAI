import { FeatureSet } from './models';
import { ProductBlueprint } from '../blueprint/models';

export interface IFeatureExtractor {
    extractFeatures(blueprint: ProductBlueprint): Promise<FeatureSet>;
}
