const fs = require('fs');
const path = 'src/ui/simulator/ChatSimulator.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/sandbox="([^"]*)"/g, (match, p1) => {
    if (!p1.includes('allow-downloads')) {
        return `sandbox="${p1} allow-downloads"`;
    }
    return match;
});

fs.writeFileSync(path, content, 'utf8');
console.log('Added allow-downloads to all sandbox attributes in ChatSimulator.jsx');
