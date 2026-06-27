# ADR-0003 – Domain Model Rules

## Context & Goal
UltimateAI is built around clean‑architecture principles. To keep the code‑base maintainable, scalable and testable we need a **global contract** for *domain models* – the simple data structures that represent the core business concepts (e.g., `TaskNode`, `TaskGraph`, `PlanningRequest`). This ADR codifies the rules that every team must follow when creating or evolving such models.

---

## 1. Domain models are **immutable**
- All properties must be declared `readonly`.
- Collections are `readonly` arrays or `ReadonlyMap`/`ReadonlySet`.

**Good example**
```ts
export interface TaskNode {
  readonly id: string;
  readonly capability: string;
  readonly description: string;
  readonly dependencies: readonly string[];
}
```

**Bad example**
```ts
export interface TaskNode {
  id: string;                 // mutable
  capability: string;          // mutable
  dependencies: string[];       // mutable array
}
```
---

## 2. Domain models **must not contain business logic**
- Only data definitions, no methods or behaviour.
- Calculations, validation or side‑effects belong in *services* or *use‑cases*.

**Good**
```ts
export interface PlanningResult {
  readonly graph: TaskGraph;
  readonly errors?: PlannerError[];
}
```
**Bad**
```ts
export interface PlanningResult {
  readonly graph: TaskGraph;
  // ❌ business logic inside the model
  isSuccessful(): boolean { return this.errors?.length === 0; }
}
```
---

## 3. Domain models **must not store runtime state**
- No fields such as `status`, `progress`, `startedAt`, `finishedAt`, `retryCount`, etc.
- Those belong to the **Runtime Layer** (executors, schedulers, monitoring).

**Good**
```ts
export interface TaskNode {
  readonly id: string;
  readonly capability: string;
  readonly description: string;
  readonly dependencies: readonly string[];
}
```
**Bad**
```ts
export interface TaskNode {
  readonly id: string;
  readonly capability: string;
  readonly status: "pending" | "running" | "done"; // runtime state – wrong place
}
```
---

## 4. Runtime state lives **only** in the *Runtime Layer*
- Scheduler, executor, engine, and orchestration components keep mutable state.
- Domain models are passed *by value* (or read‑only reference) to those components.
---

## 5. Services **must not hold mutable global state**
- No module‑level variables that mutate over time.
- All mutable data is scoped to an instance created via DI.
---

## 6. **Constructor injection** for *all* dependencies
- Services receive collaborators (repositories, other services, factories) through their constructor.
- No `new` inside methods; enables easy testing and inversion of control.
---

## 7. **Avoid singletons** unless a compelling reason exists
- Examples: a stateless utility (e.g., `UuidGenerator`) can be a singleton, but *stateful* services must be instantiated.
---

## 8. Generics belong to the **most stable abstraction level**
- If a type parameter describes a **characteristic of the object** (e.g., the success payload of a step), place the generic on the **interface/class**, not on a method.
- Method‑level generics should only be used for *temporary* or *local* variations.
---

## 9. **Backward compatibility** guarantee
- Public APIs (interfaces, exported types, function signatures) must remain compatible for the duration of a **major version**.
- Deprecate changes with versioned flags before removal.
---

## 10. Every **cross‑module architectural change** requires an ADR
- Adds traceability, shared understanding and a decision record.
---

## Summary of Rules & Illustrations
| # | Rule | Good Example | Bad Example |
|---|------|--------------|-------------|
| 1 | Immutable domain model | `readonly id: string;` | `id: string;` |
| 2 | No business logic | Pure data interface | Methods inside model |
| 3 | No runtime state | No `status` fields | `status: "running";` |
| 4 | Runtime state only in Runtime Layer | Scheduler keeps mutable queues | Model holds counters |
| 5 | Services stateless (no global mutable) | `class MyService { constructor(repo) { … } }` | `let cache = {};` at module top |
| 6 | Constructor injection | `constructor(repo: Repo)` | `this.repo = new Repo()` inside method |
| 7 | Avoid singleton | `new Logger()` per instance | `export const logger = new Logger();` (unless stateless) |
| 8 | Stable‑level generics | `interface IStep<T, E>` | `execute<T, E>()` on method |
| 9 | Backward compatible API | Keep same signature across major version | Break API without deprecation |
| 10| ADR for cross‑module changes | This document | No record of decision |
---

*Document created on 2026‑06‑26.*
