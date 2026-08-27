/**
 * ICompilerPass.ts
 *
 * Interface for all Compiler Passes.
 * Each pass mutates the CompilationContext synchronously.
 */

import { ICompilationContext } from '../contracts/ICompilationContext';

export interface ICompilerPass {
  readonly name: string;
  execute(context: ICompilationContext): void;
}
