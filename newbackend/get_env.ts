import * as fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf-8');
const mongoLine = envFile.split('\n').find(l => l.startsWith('MONGO_URI') || l.startsWith('DATABASE_URL'));
console.log(mongoLine);
