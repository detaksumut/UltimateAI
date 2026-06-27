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

export interface ProductBlueprint {
    readonly id: string;
    readonly screens: ReadonlyArray<ScreenDesign>;
    readonly workflows: ReadonlyArray<WorkflowDefinition>;
    readonly dataModels: ReadonlyArray<string>;
    readonly reports: ReadonlyArray<ReportDefinition>;
}
