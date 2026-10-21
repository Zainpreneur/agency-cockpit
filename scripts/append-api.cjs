const fs = require('fs');
const apiPath = 'C:/Users/zainp/agency-cockpit/src/lib/api.ts';
const appendPath = 'C:/Users/zainp/AppData/Local/Temp/opencode/api-append.txt';
const content = fs.readFileSync(apiPath, 'utf8');
const appendContent = fs.readFileSync(appendPath, 'utf8');
const newContent = content + '\n\n' + appendContent;
fs.writeFileSync(apiPath, newContent, 'utf8');
console.log('Done. Original:', content.length, 'New:', newContent.length);