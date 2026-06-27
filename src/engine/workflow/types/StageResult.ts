export type StageStatus = 'continue' | 'retry' | 'short-circuit' | 'abort' | 'skip';

export interface StageResult<T = any, E = any> {
  status: StageStatus;
  value?: T;
  error?: E;
}
