import { KnowledgeGraph, ScientificReference } from './models';
import { ContextSignature } from '../context/models';

export interface ISourceConnector {
    fetchData(query: string): Promise<any>;
}

export interface IKnowledgeEngine {
    discover(context: ContextSignature): Promise<KnowledgeGraph>;
    findReferences(topic: string): Promise<ReadonlyArray<ScientificReference>>;
}
