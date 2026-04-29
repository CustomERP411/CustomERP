const fs = require('fs');
const path = require('path');
const sqlFile = path.join(
  __dirname,
  '..',
  'generated',
  'custom-demo-erp-1777436476977',
  'backend',
  'src',
  'repository',
  'migrations',
  '001_initial_schema.sql'
);
const sql = fs.readFileSync(sqlFile, 'utf8');
const tables = process.argv.slice(2);
for (const t of tables) {
  const re = new RegExp(`CREATE TABLE IF NOT EXISTS "${t}"[\\s\\S]+?\\);`);
  const m = sql.match(re);
  console.log(`--- ${t} ---`);
  console.log(m ? m[0] : '(not found)');
  console.log('');
}
