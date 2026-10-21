const fs = require('fs');
const c = fs.readFileSync('C:/Users/zainp/agency-cockpit/src/lib/analytics.ts', 'utf8');
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('investorMultiple') || l.includes('totalDeployed') || l.includes('totalReturned')) {
    console.log((i + 1) + ': ' + l.trim());
  }
});