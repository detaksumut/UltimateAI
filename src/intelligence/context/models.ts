export interface SpatialContext {
    readonly location: string;
    readonly coordinates?: { lat: number; lng: number };
    readonly geographyType?: string;
}

export interface TemporalContext {
    readonly timeframe: string;
    readonly isHistorical: boolean;
}

export interface ContextSignature {
    readonly id: string;
    readonly spatial?: SpatialContext;
    readonly temporal?: TemporalContext;
    readonly domainTags: ReadonlyArray<string>;
}
