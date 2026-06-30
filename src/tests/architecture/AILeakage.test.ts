import { Project } from "ts-morph";
import * as path from "path";

describe("Architecture AI Leakage Compliance", () => {
  let project: Project;

  beforeAll(() => {
    project = new Project({
      tsConfigFilePath: path.join(__dirname, "../../../tsconfig.json"),
    });
  });

  test("Only *EngineImpl.ts can import AI SDKs", () => {
    const sourceFiles = project.getSourceFiles("src/production/**/*.ts");
    const forbiddenModules = ["@google/genai", "openai", "anthropic"];

    sourceFiles.forEach(file => {
      // If it's an EngineImpl, it's allowed
      if (file.getBaseName().endsWith("EngineImpl.ts")) {
        return;
      }

      const imports = file.getImportDeclarations();
      imports.forEach(imp => {
        const moduleSpecifier = imp.getModuleSpecifierValue();
        
        const hasLeak = forbiddenModules.some(m => moduleSpecifier.includes(m));
        
        expect({
          file: file.getBaseName(),
          path: file.getFilePath(),
          import: moduleSpecifier,
          hasLeak
        }).toEqual({
          file: file.getBaseName(),
          path: file.getFilePath(),
          import: moduleSpecifier,
          hasLeak: false
        });
      });
    });
  });
});
