export interface BusinessRequirement {
    readonly objective: string;
    readonly kpi: ReadonlyArray<string>;
}

export interface FunctionalRequirement {
    readonly id: string;
    readonly description: string;
    readonly actor: string;
}

export interface NonFunctionalRequirement {
    readonly category: 'PERFORMANCE' | 'SECURITY' | 'USABILITY';
    readonly description: string;
}

export interface DataModel {
    readonly entities: ReadonlyArray<{ name: string; attributes: ReadonlyArray<string> }>;
}

export interface Workflow {
    readonly steps: ReadonlyArray<string>;
}

export interface UIDraft {
    readonly screens: ReadonlyArray<{ name: string; components: ReadonlyArray<string> }>;
}

export interface TestScenario {
    readonly title: string;
    readonly steps: ReadonlyArray<string>;
    readonly expectedResult: string;
}

export interface Blueprint {
    readonly business: BusinessRequirement;
    readonly functional: ReadonlyArray<FunctionalRequirement>;
    readonly nonFunctional: ReadonlyArray<NonFunctionalRequirement>;
    readonly data: DataModel;
    readonly workflow: Workflow;
    readonly ui: UIDraft;
    readonly tests: ReadonlyArray<TestScenario>;
}
