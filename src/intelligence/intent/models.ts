export type ActionType = 'CREATE' | 'RESEARCH' | 'ANALYZE' | 'AUTOMATE' | 'GENERATE';

export interface UserIntent {
    readonly id: string;
    readonly rawInput: string;
    readonly action: ActionType;
    readonly confidence: number;
    readonly timestamp: Date;
}
