// tools/shared/types.ts
/** Validation result interface */
export interface ValidationResult {
  tool: string;
  version: string;
  timestamp: string;
  status: 'PASS' | 'FAIL';
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: { checked: number; passed: number; failed: number };
}

export interface ValidationError {
  message: string;
  location?: string;
}

export interface ValidationWarning {
  message: string;
  location?: string;
}

/** Standard report interface for any tool */
export interface ToolReport extends ValidationResult {}
