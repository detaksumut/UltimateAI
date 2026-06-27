const fs = require('fs');
const file = 'd:/Users/ultimateai/src/ui/simulator/ChatSimulator.jsx';
let content = fs.readFileSync(file, 'utf-8');
content = content.replace(/\\\$\{/g, '${').replace(/\\\`/g, '`');
fs.writeFileSync(file, content);
