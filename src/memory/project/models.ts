export interface ConversationHistory {
    readonly messages: ReadonlyArray<{ role: string; content: string; timestamp: Date }>;
}

export interface ArchitectureState {
    readonly components: ReadonlyArray<string>;
    readonly topology: string;
}

export interface DatabaseState {
    readonly schemaVersion: string;
    readonly migrationHistory: ReadonlyArray<string>;
}

export interface SourceState {
    readonly commitHash: string;
    readonly repositoryUrl: string;
}

export interface EvolutionFeedback {
    readonly userId: string;
    readonly comment: string;
    readonly actionTaken: string;
}

export interface ProjectTimeline {
    readonly projectId: string;
    readonly conversation: ConversationHistory;
    readonly architecture: ArchitectureState;
    readonly database: DatabaseState;
    readonly source: SourceState;
    readonly feedback: ReadonlyArray<EvolutionFeedback>;
}
