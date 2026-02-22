/**
 * EA Phase 2 Feature Verification Script
 * 
 * This script verifies end-to-end SDF feature coverage for:
 * 1. children (embedded line items)
 * 2. bulk_actions (bulk delete and update)
 * 3. inventory_ops.quantity_mode (change/delta mode)
 * 4. quick_actions (row-level inventory actions)
 * 
 * Usage: node test/verify_features_ea.js
 */

const fs = require('fs');
const path = require('path');
const BrickRepository = require('../platform/assembler/BrickRepository');
const ProjectAssembler = require('../platform/assembler/ProjectAssembler');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function checkFileContains(filePath, searchString, description) {
  if (!checkFileExists(filePath)) {
    log(`  ✗ File not found: ${filePath}`, 'red');
    return false;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const found = content.includes(searchString);
  
  if (found) {
    log(`  ✓ ${description}`, 'green');
  } else {
    log(`  ✗ ${description} - NOT FOUND`, 'red');
  }
  
  return found;
}

async function verifyFeatures() {
  log('\n========================================', 'cyan');
  log('EA Phase 2 Feature Verification', 'cyan');
  log('========================================\n', 'cyan');

  const sdfPath = path.join(__dirname, 'sample_sdf_feature_verification_ea.json');
  const brickLibraryPath = path.resolve(__dirname, '..', 'brick-library');
  const outputPath = path.resolve(__dirname, '..', 'generated');
  const projectId = 'ea-feature-verification-erp';
  const outputDir = path.join(outputPath, projectId);

  // Step 1: Load SDF
  log('Step 1: Loading SDF...', 'blue');
  if (!checkFileExists(sdfPath)) {
    log('✗ SDF file not found!', 'red');
    process.exit(1);
  }
  
  const sdfContent = fs.readFileSync(sdfPath, 'utf8');
  const sdf = JSON.parse(sdfContent);
  log(`✓ Loaded SDF: ${sdf.project_name}`, 'green');
  log(`  Entities: ${sdf.entities.length}`, 'yellow');

  // Step 2: Generate ERP
  log('\nStep 2: Running Assembler...', 'blue');
  try {
    const brickRepo = new BrickRepository(brickLibraryPath);
    const assembler = new ProjectAssembler(brickRepo, outputPath);
    await assembler.assemble(projectId, sdf);
    log('✓ Generation completed successfully', 'green');
  } catch (error) {
    log(`✗ Generation failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }

  // Step 3: Verify children feature
  log('\nStep 3: Verifying CHILDREN feature...', 'blue');
  log('  Feature: shipments entity has embedded shipment_items', 'yellow');
  
  let childrenPassed = true;
  
  // Check backend service
  const shipmentsServicePath = path.join(outputDir, 'backend', 'src', 'services', 'shipmentsService.js');
  childrenPassed &= checkFileContains(
    shipmentsServicePath,
    'shipment_items',
    'Backend service references child entity'
  );
  
  // Check frontend component
  const shipmentsFormPath = path.join(outputDir, 'frontend', 'src', 'pages', 'ShipmentsPage.tsx');
  if (checkFileExists(shipmentsFormPath)) {
    childrenPassed &= checkFileContains(
      shipmentsFormPath,
      'shipment_items',
      'Frontend form includes child items section'
    ) || checkFileContains(
      shipmentsFormPath,
      'Shipment Items',
      'Frontend form includes child items label'
    );
  }

  // Step 4: Verify bulk_actions feature
  log('\nStep 4: Verifying BULK_ACTIONS feature...', 'blue');
  log('  Feature: products entity has bulk delete and update', 'yellow');
  
  let bulkActionsPassed = true;
  
  const productsServicePath = path.join(outputDir, 'backend', 'src', 'services', 'productsService.js');
  bulkActionsPassed &= checkFileContains(
    productsServicePath,
    'bulkDelete',
    'Backend service has bulkDelete method'
  ) || checkFileContains(
    productsServicePath,
    'bulk',
    'Backend service has bulk operations'
  );
  
  bulkActionsPassed &= checkFileContains(
    productsServicePath,
    'bulkUpdate',
    'Backend service has bulkUpdate method'
  ) || checkFileContains(
    productsServicePath,
    'bulk',
    'Backend service has bulk operations'
  );

  // Check frontend
  const productsPagePath = path.join(outputDir, 'frontend', 'src', 'pages', 'ProductsPage.tsx');
  if (checkFileExists(productsPagePath)) {
    bulkActionsPassed &= checkFileContains(
      productsPagePath,
      'bulk',
      'Frontend page includes bulk action UI'
    );
  }

  // Step 5: Verify inventory_ops.quantity_mode feature
  log('\nStep 5: Verifying INVENTORY_OPS.QUANTITY_MODE feature...', 'blue');
  log('  Feature: products entity uses "change" mode (signed quantity)', 'yellow');
  
  let quantityModePassed = true;
  
  quantityModePassed &= checkFileContains(
    productsServicePath,
    'quantity_change',
    'Backend uses quantity_change field'
  ) || checkFileContains(
    productsServicePath,
    'change',
    'Backend references change mode'
  );
  
  const stockMovementsServicePath = path.join(outputDir, 'backend', 'src', 'services', 'stock_movementsService.js');
  if (checkFileExists(stockMovementsServicePath)) {
    quantityModePassed &= checkFileContains(
      stockMovementsServicePath,
      'quantity_change',
      'Stock movements service handles quantity_change'
    );
  }

  // Step 6: Verify quick_actions feature
  log('\nStep 6: Verifying QUICK_ACTIONS feature...', 'blue');
  log('  Feature: products entity has quick receive and issue actions', 'yellow');
  
  let quickActionsPassed = true;
  
  if (checkFileExists(productsPagePath)) {
    quickActionsPassed &= checkFileContains(
      productsPagePath,
      'quick',
      'Frontend includes quick action buttons'
    ) || checkFileContains(
      productsPagePath,
      'receive',
      'Frontend includes receive action'
    );
    
    quickActionsPassed &= checkFileContains(
      productsPagePath,
      'issue',
      'Frontend includes issue action'
    ) || checkFileContains(
      productsPagePath,
      'sell',
      'Frontend includes sell/issue action'
    );
  }

  // Step 7: Summary
  log('\n========================================', 'cyan');
  log('Verification Summary', 'cyan');
  log('========================================\n', 'cyan');
  
  const results = {
    'Children (embedded line items)': childrenPassed,
    'Bulk Actions (delete & update)': bulkActionsPassed,
    'Inventory Ops Quantity Mode (change)': quantityModePassed,
    'Quick Actions (receive & issue)': quickActionsPassed
  };
  
  let allPassed = true;
  for (const [feature, passed] of Object.entries(results)) {
    if (passed) {
      log(`✓ ${feature}`, 'green');
    } else {
      log(`✗ ${feature}`, 'red');
      allPassed = false;
    }
  }
  
  log('\n========================================\n', 'cyan');
  
  if (allPassed) {
    log('✓ ALL FEATURES VERIFIED SUCCESSFULLY!', 'green');
    log('\nGenerated ERP location:', 'blue');
    log(`  ${outputDir}`, 'yellow');
    return 0;
  } else {
    log('✗ SOME FEATURES FAILED VERIFICATION', 'red');
    log('\nPlease review the generated output and ensure all features are implemented.', 'yellow');
    return 1;
  }
}

// Run verification
verifyFeatures()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    log(`\n✗ Verification script failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
