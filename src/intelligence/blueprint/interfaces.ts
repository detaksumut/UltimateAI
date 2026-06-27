import { ProductBlueprint } from './models';
import { Blueprint as RequirementBlueprint } from '../requirement/models';

export interface IBlueprintDesigner {
    designProduct(requirement: RequirementBlueprint): Promise<ProductBlueprint>;
}
