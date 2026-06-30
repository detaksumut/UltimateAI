import { FeatureSet } from './models';

export interface IFeatureExtractor {
    extractFeatures(data: any): Promise<FeatureSet>;
}
