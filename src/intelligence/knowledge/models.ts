export interface ExternalSource {
    readonly name: string;
    readonly url: string;
    readonly authorityLevel: number;
}

export interface ScientificReference {
    readonly title: string;
    readonly authors: ReadonlyArray<string>;
    readonly abstract: string;
    readonly doi?: string;
}

export interface KnowledgeGraph {
    readonly nodes: ReadonlyArray<{ id: string; label: string }>;
    readonly edges: ReadonlyArray<{ source: string; target: string; relation: string }>;
}
