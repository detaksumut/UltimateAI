export interface MemoryAddress {
  /** Canonical memory URI */
  uri: string;

  /** Memory namespace */
  namespace: string;

  /** Memory role */
  role: string;

  /** Relative path inside the namespace */
  path: string;
}
