import { MemoryRequest } from "../types/MemoryRequest";
import { MemoryResponse } from "../types/MemoryResponse";

export interface IMemory {
  /** Store a value at the given address */
  put(request: MemoryRequest): Promise<MemoryResponse>;

  /** Retrieve a value from the given address */
  get(request: MemoryRequest): Promise<MemoryResponse>;

  /** Delete a value at the given address */
  delete(request: MemoryRequest): Promise<MemoryResponse>;

  /** Check existence of a value at the given address */
  exists(request: MemoryRequest): Promise<MemoryResponse>;

  /** List entries under a given address */
  list(request: MemoryRequest): Promise<MemoryResponse>;
}
