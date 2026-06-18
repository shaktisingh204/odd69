
const fs = require('fs');

const filePath = '/Users/harshkhandelwal/Documents/100xwins/newbackend/src/sports/sports.service.ts';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let balance = 0;
let classOpenLine = -1;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Simple logic: count { and }
    // Ignore comments if possible, but for quick check maybe not needed if code is clean
    // Better: strip comments
    const cleanLine = line.replace(/\/\/.*$/, '').replace(/\/[\s\S]*?\//g, '');

    for (let char of cleanLine) {
        if (char === '{') {
            if (balance === 0) classOpenLine = i + 1;
            balance++;
        } else if (char === '}') {
            balance--;
            if (balance === 0) {
                console.log(`Class (or root block) closed at line ${i + 1}`);
                if (classOpenLine !== -1) {
                    console.log(`Started at line ${classOpenLine}`);
                }
            }
            if (balance < 0) {
                console.log(`ERROR: Balance went negative at line ${i + 1}`);
                process.exit(1);
            }
        }
    }
}

console.log(`Final Balance: ${balance}`);
