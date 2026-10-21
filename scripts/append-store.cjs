const fs = require('fs');
const storePath = 'C:/Users/zainp/agency-cockpit/src/lib/store.ts';
const content = fs.readFileSync(storePath, 'utf8');
const appendPath = 'C:/Users/zainp/AppData/Local/Temp/opencode/store-append.txt';
const appendContent = fs.readFileSync(appendPath, 'utf8');
const endIdx = content.lastIndexOf('}');
const newContent = content.substring(0, endIdx + 1) + '\n\n' + appendContent;
fs.writeFileSync(storePath, newContent, 'utf8');
console.log('Done. Original size:', content.length, 'New size:', newContent.length);