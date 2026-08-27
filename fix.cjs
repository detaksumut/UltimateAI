const fs = require('fs');
const file = 'd:/Users/ultimateai/src/infrastructure/server/server.ts';
let content = fs.readFileSync(file, 'utf8');

const scriptStart = content.indexOf('<script>');
const scriptEnd = content.indexOf('</script>', scriptStart);

if (scriptStart !== -1 && scriptEnd !== -1) {
    let scriptContent = content.substring(scriptStart + 8, scriptEnd);
    
    // Reset any existing escapes
    scriptContent = scriptContent.replace(/\\`/g, '`');
    scriptContent = scriptContent.replace(/\\\$/g, '$');
    
    // Apply proper escapes
    scriptContent = scriptContent.replace(/`/g, '\\`');
    scriptContent = scriptContent.replace(/\$/g, '\\$');
    
    content = content.substring(0, scriptStart + 8) + scriptContent + content.substring(scriptEnd);
    fs.writeFileSync(file, content);
    console.log('Fixed script block escaping.');
} else {
    console.log('Script block not found.');
}
