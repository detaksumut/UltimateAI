# Architecture Compliance Guide

*Welcome to the UltimateAI Architecture Compliance System.*

As of v1.1, the UltimateAI Constitution is no longer just documentation; it is an executable guardrail. This guide explains the automated checks that run on every commit and pull request. If you encounter a failure, do not bypass it. Understand the principle it protects and refactor your code accordingly.

## 1. Boundary Enforcement (ESLint)
**Tool:** `eslint-plugin-boundaries`
**What it checks:** Ensures that imports strictly follow the Bounded Contexts defined in our architecture.
- **Rule:** The `ProductionKernel` can import from `Runtime Foundation`, but runtimes cannot import the Kernel.
- **Rule:** Domains (e.g., `Planning`, `Execution`) cannot import from each other horizontally. They communicate exclusively via artifacts passed by the Kernel.
- **How to fix:** If you get a boundary error, you are likely trying to couple two runtimes tightly. Refactor to use the `IRuntimeContext` and return an `IArtifact`.

## 2. Dependency Cruising
**Tool:** `dependency-cruiser`
**What it checks:** Scans the dependency graph for circular dependencies and structural anti-patterns.
- **Rule:** Absolutely no circular imports across `src/`.
- **How to fix:** Extract shared logic or interfaces into a common `contracts/` directory lower in the dependency tree.

## 3. Abstract Syntax Tree (AST) Architecture Tests
**Tool:** `ts-morph` and `Jest` (in `src/tests/architecture/`)
**What it checks:** Verifies the semantic structure of the code against the Constitution.

### A. Contract Tests
- **Rule:** Every class ending in `*RuntimeImpl.ts` MUST implement the `IRuntime` interface.
- **Rule:** Every payload inside `IRuntimeResult` MUST implement the `IArtifact` interface.
- **How to fix:** Add the missing interface implementation and ensure trace data is fully hydrated.

### B. Convention Tests
- **Rule:** Every Runtime MUST be structured with: Context ➔ Planner ➔ Engine ➔ Validator ➔ Result.
- **How to fix:** Do not shortcut the Cognitive Loop. If your runtime doesn't need AI, use a deterministic mock/runner in place of the Engine, but preserve the architectural pipeline.

### C. AI Leakage Tests
- **Rule:** ONLY files explicitly named `*EngineImpl.ts` are permitted to import AI SDKs (e.g., `@google/genai`, `openai`) or Prompt Builders.
- **Reason:** AI logic must remain strictly quarantined to prevent non-deterministic behavior in orchestrators.
- **How to fix:** Move the prompt assembly or SDK call into the appropriate Engine class.

## 4. The CI/CD Pipeline
All rules are enforced in two phases:
1. **Pre-commit (Husky + lint-staged):** Runs ESLint, Architecture Tests, and Unit Tests on changed files before you can commit.
2. **CI Pipeline (GitHub Actions):** Runs the full Architecture Compliance suite, type checking, unit tests, integration tests, and builds the project.

> [!WARNING]
> If the Architecture Compliance step fails in CI, the build will immediately halt. Architecture violations are treated as critical build failures.
