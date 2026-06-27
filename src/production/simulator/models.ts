export interface SimulationState {
    readonly isRunning: boolean;
    readonly logs: ReadonlyArray<string>;
    readonly currentScreen: string;
}

export interface RevisionRequest {
    readonly targetComponent: string;
    readonly requestedChange: string;
}
