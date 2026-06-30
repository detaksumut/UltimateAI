import { Project, ClassDeclaration } from "ts-morph";
import * as path from "path";

describe("Architecture Contract Compliance", () => {
  let project: Project;

  beforeAll(() => {
    project = new Project({
      tsConfigFilePath: path.join(__dirname, "../../../tsconfig.json"),
    });
  });

  test("All RuntimeImpl classes must implement IRuntime", () => {
    const sourceFiles = project.getSourceFiles("src/production/**/*RuntimeImpl.ts");
    
    expect(sourceFiles.length).toBeGreaterThan(0);

    sourceFiles.forEach(file => {
      const classes = file.getClasses();
      classes.forEach(cls => {
        if (cls.getName()?.endsWith("RuntimeImpl")) {
          const implementsClause = cls.getImplements().map(i => i.getText());
          
          // Check if it implements IRuntime (could be generic like IRuntime<IRuntimeContext, ...>)
          const implementsIRuntime = implementsClause.some(i => i.startsWith("IRuntime"));
          
          expect({
            file: file.getBaseName(),
            class: cls.getName(),
            implementsIRuntime
          }).toEqual({
            file: file.getBaseName(),
            class: cls.getName(),
            implementsIRuntime: true
          });
        }
      });
    });
  });
});
