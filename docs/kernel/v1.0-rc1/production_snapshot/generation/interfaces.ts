import { GenerationTask, DigitalAsset } from './models';
import { Blueprint } from '../blueprint/models';

export interface IGenerationEngine {
    generate(blueprint: Blueprint, target: string, rawInput?: string, attachedImage?: string, savedImageUrl?: string): Promise<DigitalAsset>;
}
