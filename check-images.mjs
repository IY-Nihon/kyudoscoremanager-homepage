import fs from 'fs';
const c = fs.readFileSync('index.html', 'utf8');
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('class="slide') && lines[i].includes('loading="lazy"')) {
    console.log((i+1) + ': ' + lines[i].trim());
  }
}

