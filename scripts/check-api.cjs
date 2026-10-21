const fs = require('fs');
const c = fs.readFileSync('C:/Users/zainp/agency-cockpit/src/lib/api.ts', 'utf8');
console.log('Length:', c.length);
console.log('Last 300 chars:');
console.log(c.slice(-300));