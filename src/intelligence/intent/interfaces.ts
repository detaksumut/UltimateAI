import { UserIntent } from './models';
import { UserGoal } from '../goal/models';

export interface IIntentParser {
    deriveIntent(goal: UserGoal): Promise<UserIntent>;
}
