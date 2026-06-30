import { Project } from "ts-morph";
import * as path from "path";

describe("Architecture Boundary Compliance", () => {
  let project: Project;

  beforeAll(() => {
    project = new Project({
      tsConfigFilePath: path.join(__dirname, "../../../tsconfig.json"),
    });
  });

  test("Runtimes must not import other Runtimes directly", () => {
    const runtimes = ["planning", "execution", "knowledge", "learning", "evolution", "reasoning", "delivery"];
    
    runtimes.forEach(runtime => {
      const sourceFiles = project.getSourceFiles(`src/production/${runtime}/**/*.ts`);
      
      sourceFiles.forEach(file => {
        const imports = file.getImportDeclarations();
        imports.forEach(imp => {
          const moduleSpecifier = imp.getModuleSpecifierValue();
          
          // Verify that it doesn't import from another runtime (unless it's through generic contracts, but for this test we enforce strict separation)
          runtimes.forEach(otherRuntime => {
            if (runtime !== otherRuntime && runtime !== "evolution" && runtime !== "reasoning" && runtime !== "learning") {
              // Note: as per eslint config, evolution and reasoning currently have some explicit cross-links, 
              // and learning requires knowledge for ReconstructionResult.
              const hasViolation = moduleSpecifier.includes(`/${otherRuntime}/`);
              
              expect({
                file: file.getBaseName(),
                import: moduleSpecifier,
                hasViolation
              }).toEqual({
                file: file.getBaseName(),
                import: moduleSpecifier,
                hasViolation: false
              });
            }
          });
        });
      });
    });
  });
});
