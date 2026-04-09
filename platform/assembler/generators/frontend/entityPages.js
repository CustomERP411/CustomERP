'use strict';

const { buildEntityListPage } = require('./entityPages/listPage');
const { buildEntityFormPage } = require('./entityPages/formPage');
const { buildEntityImportPage } = require('./entityPages/importPage');
const { buildReceivePage, buildIssuePage, buildAdjustPage, buildTransferPage } = require('./entityPages/inventoryOps');
const { buildLabelsPage } = require('./entityPages/labelsPage');

module.exports = {
  buildEntityListPage,
  buildEntityFormPage,
  buildEntityImportPage,
  buildReceivePage,
  buildIssuePage,
  buildAdjustPage,
  buildTransferPage,
  buildLabelsPage,
};
