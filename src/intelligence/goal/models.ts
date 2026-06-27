export interface UserGoal {
    readonly rawInput: string;
    readonly primaryObjective: string;
    readonly implicitNeeds: ReadonlyArray<string>;
}
