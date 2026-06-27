export interface LogicalInference {
    readonly premise: string;
    readonly conclusion: string;
    readonly confidence: number;
}

export interface Constraint {
    readonly description: string;
    readonly strictness: 'MUST' | 'SHOULD' | 'COULD';
}

export interface ReasoningChain {
    readonly id: string;
    readonly inferences: ReadonlyArray<LogicalInference>;
    readonly constraints: ReadonlyArray<Constraint>;
    readonly synthesis: string;
}
