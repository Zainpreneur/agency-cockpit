const fs = require('fs');
const p = 'C:/Users/zainp/agency-cockpit/src/pages/AgencyAssets.tsx';
let c = fs.readFileSync(p, 'utf8');
// Remove the top-level TABLE_COLUMNS definition (lines 46-56)
const lines = c.split('\n');
// Find the start of TABLE_COLUMNS at top level
let startIdx = -1;
let endIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === 'const TABLE_COLUMNS = [' && i < 60) {
    startIdx = i;
  }
  if (startIdx !== -1 && i > startIdx && lines[i].trim() === ']' && endIdx === -1) {
    // Check if next line is empty and then export function
    if (i + 2 < lines.length && lines[i + 2].trim().startsWith('export function')) {
      endIdx = i;
      break;
    }
  }
}
if (startIdx !== -1 && endIdx !== -1) {
  // Remove from startIdx to endIdx+1 (including the empty line after)
  lines.splice(startIdx, endIdx - startIdx + 2);
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
  console.log('Removed lines', startIdx, 'to', endIdx + 1);
} else {
  console.log('Could not find TABLE_COLUMNS block. startIdx:', startIdx, 'endIdx:', endIdx);
}