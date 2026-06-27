import { UserGoal } from './models';

export interface IGoalAnalyzer {
    analyze(input: string): Promise<UserGoal>;
}
