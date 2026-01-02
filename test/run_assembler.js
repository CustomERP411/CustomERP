// test/run_assembler.js
// Usage: node test/run_assembler.js

const path = require('path');
const fs = require('fs').promises;

// Import the assembler components
const BrickRepository = require('../platform/backend/src/assembler/BrickRepository');
const ProjectAssembler = require('../platform/backend/src/assembler/ProjectAssembler');

async function main() {
  console.log('==============================================');
  console.log('  CustomERP Assembler Test');
  console.log('==============================================\n');

  // Paths
  const brickLibraryPath = path.resolve(__dirname, '../brick-library');
  const outputPath = path.resolve(__dirname, '../generated');
  const sdfPath = path.resolve(__dirname, 'sample_sdf.json');

  // Load SDF
  console.log('1. Loading SDF from:', sdfPath);
  const sdfContent = await fs.readFile(sdfPath, 'utf8');
  const sdf = JSON.parse(sdfContent);
  console.log(`   Project: ${sdf.project_name}`);
  console.log(`   Entities: ${sdf.entities.map(e => e.slug).join(', ')}\n`);

  // Initialize
  console.log('2. Initializing Assembler...');
  const brickRepo = new BrickRepository(brickLibraryPath);
  const assembler = new ProjectAssembler(brickRepo, outputPath);

  // Generate unique project ID
  const projectId = 'pharma-erp-' + Date.now();
  console.log(`   Project ID: ${projectId}\n`);

  // Run assembly
  console.log('3. Starting assembly...');
  try {
    const outputDir = await assembler.assemble(projectId, sdf);
    
    console.log('\n==============================================');
    console.log('  SUCCESS!');
    console.log('==============================================');
    console.log(`\nGenerated project at: ${outputDir}\n`);
    
    // List generated files
    console.log('Generated structure:');
    await listDir(outputDir, 0);

    console.log('\n--- NEXT STEPS ---');
    console.log(`\n1. Start everything with Docker (recommended):`);
    console.log(`   cd ${outputDir}`);
    console.log('   # Windows (PowerShell)');
    console.log('   .\\dev.ps1 start');
    console.log('   # Linux/macOS');
    console.log('   chmod +x dev.sh && ./dev.sh start\n');

    console.log(`2. Or start manually (without Docker):`);
    console.log(`   # Backend`);
    console.log(`   cd ${path.join(outputDir, 'backend')}`);
    console.log('   npm install');
    console.log('   npm start\n');
    console.log(`   # Frontend (in another terminal)`);
    console.log(`   cd ${path.join(outputDir, 'frontend')}`);
    console.log('   npm install');
    console.log('   npm run dev\n');

  } catch (error) {
    console.error('\n==============================================');
    console.error('  ASSEMBLY FAILED');
    console.error('==============================================');
    console.error(error);
    process.exit(1);
  }
}

async function listDir(dir, indent) {
  const prefix = '  '.repeat(indent);
  const items = await fs.readdir(dir, { withFileTypes: true });
  
  for (const item of items) {
    if (item.name === 'node_modules') continue;
    
    if (item.isDirectory()) {
      console.log(`${prefix}📁 ${item.name}/`);
      await listDir(path.join(dir, item.name), indent + 1);
    } else {
      console.log(`${prefix}📄 ${item.name}`);
    }
  }
}

main();

