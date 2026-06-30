import { Project } from "ts-morph";
import * as path from "path";

describe("Architecture Convention Compliance", () => {
  let project: Project;

  beforeAll(() => {
    project = new Project({
      tsConfigFilePath: path.join(__dirname, "../../../tsconfig.json"),
    });
  });

  // Example test to ensure if a runtime has an Engine, it should probably be accessed via a Pipeline or Planner
  // This is a simpler static check to ensure no EngineImpl is directly instantiated inside the Kernel
  test("ProductionKernel must not directly instantiate EngineImpl classes", () => {
    const kernelFile = project.getSourceFile("src/production/kernel/ProductionKernel.ts");
    if (!kernelFile) return;

    const imports = kernelFile.getImportDeclarations();
    imports.forEach(imp => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      
      expect({
        import: moduleSpecifier,
        isEngine: moduleSpecifier.includes("EngineImpl")
      }).toEqual({
        import: moduleSpecifier,
        isEngine: false
      });
    });
  });
});
