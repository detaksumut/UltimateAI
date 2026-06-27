// src/engine/workflow/step/HandlerRegistry.ts
import { IHandlerRegistry } from './IHandlerRegistry';
import { IStepHandler } from './IStepHandler';

/** Concrete implementation of IHandlerRegistry */
export class HandlerRegistry implements IHandlerRegistry {
  private readonly handlers = new Map<string, IStepHandler>();

  register(id: string, handler: IStepHandler): void {
    this.handlers.set(id, handler);
  }

  resolve(id: string): IStepHandler {
    const handler = this.handlers.get(id);
    if (!handler) {
      throw new Error(`Handler not found for identifier: ${id}`);
    }
    return handler;
  }

  // optional future methods
  has?(id: string): boolean {
    return this.handlers.has(id);
  }

  list?(): string[] {
    return Array.from(this.handlers.keys());
  }

  unregister?(id: string): void {
    this.handlers.delete(id);
  }
}
