/** Capabilities that a memory provider can support. */
export enum MemoryCapability {
  Read = "read",
  Write = "write",
  Delete = "delete",
  Exists = "exists",
  List = "list",
  // Reserved capabilities
  VectorSearch = "vectorSearch",
  SimilaritySearch = "similaritySearch",
  MetadataFilter = "metadataFilter",
  Transactions = "transactions",
  Snapshots = "snapshots",
  Encryption = "encryption",
  TTL = "ttl",
}
