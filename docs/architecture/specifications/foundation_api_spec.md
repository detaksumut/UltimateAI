# Foundation API Specification
**Frozen Platform Core Interfaces (UAI-FB-1.0)**

Dokumen ini mencantumkan antarmuka pemrograman publik (*Public APIs*) dari platform UAI-FB-1.0 yang dibekukan secara mutlak.

---

## 1. Runtime Registry Interface

```typescript
export interface IRuntimeRegistry {
  register(runtime: IRuntime<any, any>): void;
  unregister(runtimeId: string): void;
  findById(runtimeId: string): IRuntime<any, any> | undefined;
  listAll(): ReadonlyArray<IRuntime<any, any>>;
  supports(capability: RuntimeCapability): ReadonlyArray<IRuntime<any, any>>;
}
```

---

## 2. Runtime Event Bus Interface

```typescript
export interface IRuntimeEventBus {
  publish(event: RuntimeEvent): void;
  subscribe(topic: string, handler: (event: RuntimeEvent) => void): void;
  unsubscribe(topic: string, handler: (event: RuntimeEvent) => void): void;
}
```

---

## 3. Blueprint Registry Interface

```typescript
export interface IBlueprintRegistry {
  register(blueprint: IDomainBlueprint): void;
  find(blueprintId: string): IDomainBlueprint | undefined;
  exists(blueprintId: string): boolean;
  list(): ReadonlyArray<IDomainBlueprint>;
}
```
