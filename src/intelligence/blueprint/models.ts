export interface ScreenDesign {
    readonly name: string;
    readonly purpose: string;
    readonly requiredData: ReadonlyArray<string>;
}

export interface WorkflowDefinition {
    readonly name: string;
    readonly steps: ReadonlyArray<string>;
}

export interface ReportDefinition {
    readonly title: string;
    readonly metrics: ReadonlyArray<string>;
}

export interface Blueprint {
    // Contract between Intelligence and Production worlds
    readonly id: string;
    readonly version: string;
    readonly createdAt: string; // ISO timestamp
    readonly updatedAt?: string; // ISO timestamp
    readonly status: BlueprintStatus;
    readonly screens: ReadonlyArray<ScreenDesign>;
    readonly workflows: ReadonlyArray<WorkflowDefinition>;
    readonly dataModels: ReadonlyArray<string>;
    readonly reports: ReadonlyArray<ReportDefinition>;
    // List of lightweight requirement references
    readonly requirements: ReadonlyArray<RequirementRef>;
}

export enum BlueprintStatus {
    DRAFT = 'DRAFT',
    REVIEW = 'REVIEW',
    APPROVED = 'APPROVED',
    GENERATING = 'GENERATING',
    DELIVERED = 'DELIVERED',
    FAILED = 'FAILED'
}

// Lightweight reference to a Requirement, used to avoid circular dependencies
export interface RequirementRef {
    readonly id: string;
    readonly title: string;
    readonly priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    readonly source?: RequirementSource;
}
