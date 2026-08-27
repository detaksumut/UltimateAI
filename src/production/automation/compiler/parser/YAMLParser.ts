/**
 * YAMLParser.ts
 *
 * A minimal naive YAML parser for Phase Omega.
 * Converts the textual DSL into an Abstract Syntax Tree (AST) object.
 */

export class YAMLParser {
  static parse(yamlContent: string): Record<string, any> {
    // In a real production system, we would use `js-yaml` or similar.
    // For Phase Omega, we use a minimal stateful parser to extract the AST.
    const ast: Record<string, any> = {};
    const lines = yamlContent.split('\n');
    
    let currentKey = '';
    let currentArray: any[] = [];
    let inArray = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Top level object:
      if (!line.startsWith(' ') && trimmed.includes(':')) {
        const [key, value] = trimmed.split(':', 2).map(s => s.trim());
        currentKey = key;
        
        if (value) {
          ast[currentKey] = value;
          inArray = false;
        } else {
          // It's a block (object or array)
          ast[currentKey] = [];
          currentArray = ast[currentKey];
          inArray = true;
        }
      } 
      // Array item
      else if (line.startsWith('  -') && inArray) {
        const itemStr = trimmed.substring(1).trim();
        if (itemStr.includes(':')) {
          // Object in array (e.g. transitions)
          const obj: any = {};
          const [k, v] = itemStr.split(':', 2).map(s => s.trim());
          obj[k] = v;
          currentArray.push(obj);
        } else {
          // String in array (e.g. states)
          currentArray.push(itemStr);
        }
      }
      // Object properties inside array
      else if (line.startsWith('    ') && inArray && currentArray.length > 0) {
        const lastObj = currentArray[currentArray.length - 1];
        if (typeof lastObj === 'object' && trimmed.includes(':')) {
          const [k, v] = trimmed.split(':', 2).map(s => s.trim());
          lastObj[k] = v;
        }
      }
      // Nested object (like trigger: event: todo.created)
      else if (line.startsWith('  ') && !line.startsWith('  -') && trimmed.includes(':')) {
        const [k, v] = trimmed.split(':', 2).map(s => s.trim());
        if (!ast[currentKey]) ast[currentKey] = {};
        if (Array.isArray(ast[currentKey])) {
           // If it was wrongly initialized as array, fix it
           ast[currentKey] = {};
        }
        ast[currentKey][k] = v;
      }
    }
    
    return ast;
  }
}
