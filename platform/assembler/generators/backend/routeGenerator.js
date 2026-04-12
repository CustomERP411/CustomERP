// Route generation (split from BackendGenerator)
const TemplateEngine = require('../../TemplateEngine');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
  async _generateEntityRoute(moduleSrcDir, entity, context) {
    const workflowRoutes = this._buildWorkflowRouteDefinitions(entity);
    const routeTemplate = `
const express = require('express');
const router = express.Router();
const {{EntityName}}Controller = require('../controllers/{{EntityName}}Controller');

const controller = new {{EntityName}}Controller();

router.get('/', (req, res) => controller.getAll(req, res));
router.get('/:id', (req, res) => controller.getById(req, res));
router.post('/', (req, res) => controller.create(req, res));
router.put('/:id', (req, res) => controller.update(req, res));
router.delete('/:id', (req, res) => controller.delete(req, res));
${workflowRoutes ? `\n${workflowRoutes}\n` : ''}

module.exports = router;
`;
    const content = TemplateEngine.render(routeTemplate, context);
    await fs.writeFile(
      path.join(moduleSrcDir, `routes/${entity.slug}Routes.js`),
      content
    );
  },

  _buildWorkflowRouteDefinitions(entity) {
    const moduleKey = this._getModuleKey(entity);
    if (moduleKey !== 'inventory' && moduleKey !== 'invoice' && moduleKey !== 'hr' && moduleKey !== 'shared') return '';

    const slug = String(entity && entity.slug ? entity.slug : '');
    if (!slug) return '';

    const routes = [];

    if (moduleKey === 'inventory') {
      const cfg = this._getInventoryPriorityAConfig();

      if (this._isPackEnabled(cfg.transactions) && slug === cfg.stockEntity) {
        routes.push(
          `router.post('/:id/inventory/receive', (req, res) => controller.runAction(req, res, 'applyStockReceive', req.params.id, req.body || {}));`,
          `router.post('/:id/inventory/issue', (req, res) => controller.runAction(req, res, 'applyStockIssue', req.params.id, req.body || {}));`,
          `router.post('/:id/inventory/adjust', (req, res) => controller.runAction(req, res, 'applyStockAdjust', req.params.id, req.body || {}));`,
          `router.post('/:id/inventory/transfer', (req, res) => controller.runAction(req, res, 'applyStockTransfer', req.params.id, req.body || {}));`
        );
      }

      if (this._isPackEnabled(cfg.reservations) && slug === cfg.stockEntity) {
        routes.push(
          `router.get('/:id/reservations', (req, res) => controller.runAction(req, res, 'listReservations', req.params.id, req.query || {}));`,
          `router.post('/:id/reservations', (req, res) => controller.runAction(req, res, 'reserveStock', req.params.id, req.body || {}));`,
          `router.post('/:id/reservations/:reservationId/release', (req, res) => controller.runAction(req, res, 'releaseReservation', req.params.id, req.params.reservationId, req.body || {}));`,
          `router.post('/:id/reservations/:reservationId/commit', (req, res) => controller.runAction(req, res, 'commitReservation', req.params.id, req.params.reservationId, req.body || {}));`
        );
      }

      if (this._isPackEnabled(cfg.inbound) && slug === cfg.inbound.grn_entity) {
        routes.push(
          `router.post('/:id/post', (req, res) => controller.runAction(req, res, 'postGoodsReceipt', req.params.id, req.body || {}));`,
          `router.post('/:id/cancel', (req, res) => controller.runAction(req, res, 'cancelGoodsReceipt', req.params.id, req.body || {}));`
        );
      }

      if (this._isPackEnabled(cfg.cycleCounting) && slug === cfg.cycleCounting.session_entity) {
        routes.push(
          `router.post('/:id/start', (req, res) => controller.runAction(req, res, 'startCycleSession', req.params.id, req.body || {}));`,
          `router.post('/:id/recalculate', (req, res) => controller.runAction(req, res, 'recalculateCycleCount', req.params.id, req.body || {}));`,
          `router.post('/:id/approve', (req, res) => controller.runAction(req, res, 'approveCycleSession', req.params.id, req.body || {}));`,
          `router.post('/:id/post', (req, res) => controller.runAction(req, res, 'postCycleSession', req.params.id, req.body || {}));`
        );
      }
    }

    if (moduleKey === 'invoice') {
      const cfg = this._getInvoicePriorityAConfig();
      const invoiceSlug = String(cfg.invoiceEntity || 'invoices');
      const paymentSlug = String(cfg.payments?.payment_entity || 'invoice_payments');
      const noteSlug = String(cfg.notes?.note_entity || 'invoice_notes');

      if (this._isPackEnabled(cfg.transactions) && slug === invoiceSlug) {
        routes.push(
          `router.post('/:id/issue', (req, res) => controller.runAction(req, res, 'issueInvoice', req.params.id, req.body || {}));`,
          `router.post('/:id/cancel', (req, res) => controller.runAction(req, res, 'cancelInvoice', req.params.id, req.body || {}));`
        );
      }

      if (this._isPackEnabled(cfg.payments) && slug === invoiceSlug) {
        routes.push(
          `router.get('/:id/payments', (req, res) => controller.runAction(req, res, 'listInvoicePayments', req.params.id, req.query || {}));`,
          `router.post('/:id/payments', (req, res) => controller.runAction(req, res, 'recordInvoicePayment', req.params.id, req.body || {}));`
        );
      }

      if (this._isPackEnabled(cfg.notes) && slug === invoiceSlug) {
        routes.push(
          `router.get('/:id/notes', (req, res) => controller.runAction(req, res, 'listInvoiceNotes', req.params.id, req.query || {}));`,
          `router.post('/:id/notes', (req, res) => controller.runAction(req, res, 'createInvoiceNote', req.params.id, req.body || {}));`
        );
      }

      if (this._isPackEnabled(cfg.payments) && slug === paymentSlug) {
        routes.push(
          `router.post('/:id/post', (req, res) => controller.runAction(req, res, 'postPayment', req.params.id, req.body || {}));`,
          `router.post('/:id/cancel', (req, res) => controller.runAction(req, res, 'cancelPayment', req.params.id, req.body || {}));`
        );
      }

      if (this._isPackEnabled(cfg.notes) && slug === noteSlug) {
        routes.push(
          `router.post('/:id/post', (req, res) => controller.runAction(req, res, 'postInvoiceNote', req.params.id, req.body || {}));`,
          `router.post('/:id/cancel', (req, res) => controller.runAction(req, res, 'cancelInvoiceNote', req.params.id, req.body || {}));`
        );
      }
    }

    if (moduleKey === 'hr' || moduleKey === 'shared') {
      const cfg = this._getHRPriorityAConfig();
      const leaveSlug = String(cfg.leaveEntity || 'leaves');
      const employeeSlug = String(cfg.employeeEntity || 'employees');
      const attendanceSlug = String(cfg.attendanceTime?.attendance_entity || 'attendance_entries');
      const timesheetSlug = String(cfg.attendanceTime?.timesheet_entity || 'timesheet_entries');
      const ledgerSlug = String(cfg.compensationLedger?.ledger_entity || 'compensation_ledger');
      const snapshotSlug = String(cfg.compensationLedger?.snapshot_entity || 'compensation_snapshots');

      if (this._isPackEnabled(cfg.leaveApprovals) && slug === leaveSlug) {
        routes.push(
          `router.get('/approvals/pending', (req, res) => controller.runAction(req, res, 'listPendingLeaveApprovals', req.query || {}));`,
          `router.post('/:id/approve', (req, res) => controller.runAction(req, res, 'approveLeaveRequest', req.params.id, req.body || {}));`,
          `router.post('/:id/reject', (req, res) => controller.runAction(req, res, 'rejectLeaveRequest', req.params.id, req.body || {}));`,
          `router.post('/:id/cancel', (req, res) => controller.runAction(req, res, 'cancelLeaveRequest', req.params.id, req.body || {}));`
        );
      }
      if (this._isPackEnabled(cfg.leaveEngine) && slug === leaveSlug) {
        routes.push(
          `router.post('/:id/recalculate-days', (req, res) => controller.runAction(req, res, 'recalculateLeaveDays', req.params.id, req.body || {}));`
        );
      }
      if (this._isPackEnabled(cfg.leaveEngine) && slug === employeeSlug) {
        routes.push(
          `router.get('/:id/leave-balance', (req, res) => controller.runAction(req, res, 'getEmployeeLeaveBalance', req.params.id, req.query || {}));`,
          `router.post('/:id/leave-balance/accrue', (req, res) => controller.runAction(req, res, 'accrueLeaveBalance', req.params.id, req.body || {}));`,
          `router.post('/:id/leave-balance/adjust', (req, res) => controller.runAction(req, res, 'adjustLeaveBalance', req.params.id, req.body || {}));`
        );
      }
      if (this._isPackEnabled(cfg.attendanceTime) && slug === attendanceSlug) {
        routes.push(
          `router.post('/record', (req, res) => controller.runAction(req, res, 'recordAttendance', req.body || {}));`,
          `router.post('/:id/recalculate', (req, res) => controller.runAction(req, res, 'recalculateAttendance', req.params.id, req.body || {}));`
        );
      }
      if (this._isPackEnabled(cfg.attendanceTime) && slug === timesheetSlug) {
        routes.push(
          `router.post('/sync', (req, res) => controller.runAction(req, res, 'syncTimesheetWindow', req.body || {}));`,
          `router.post('/:id/approve', (req, res) => controller.runAction(req, res, 'approveTimesheetEntry', req.params.id, req.body || {}));`
        );
      }
      if (this._isPackEnabled(cfg.compensationLedger) && slug === ledgerSlug) {
        routes.push(
          `router.post('/snapshot', (req, res) => controller.runAction(req, res, 'createCompensationSnapshot', req.body || {}));`,
          `router.post('/:id/post', (req, res) => controller.runAction(req, res, 'postCompensationLedger', req.params.id, req.body || {}));`
        );
      }
      if (this._isPackEnabled(cfg.compensationLedger) && slug === snapshotSlug) {
        routes.push(
          `router.post('/:id/post', (req, res) => controller.runAction(req, res, 'postCompensationSnapshot', req.params.id, req.body || {}));`
        );
      }
    }

    return routes.join('\n');
  },

  async generateRoutesIndex(outputDir, entities) {
    let imports = '';
    let mappings = '';
    let rbacImport = '';
    let rbacSetup = '';

    if (this._accessControlEnabled) {
      rbacImport = `const { rbacLoader, requirePermission } = require('../rbac/rbacMiddleware');\nconst rbacRoutes = require('../rbac/rbacRoutes');\nconst { userEntityGuard } = rbacRoutes;\n`;
      rbacSetup = `router.use(rbacLoader);\nrouter.use('/auth', rbacRoutes);\nrouter.use('/__erp_users', userEntityGuard());\n`;
    }

    entities.forEach(entity => {
      const slug = entity.slug;
      const moduleKey = this._getModuleKey(entity);
      imports += `const ${slug}Router = require('../../modules/${moduleKey}/src/routes/${slug}Routes');\n`;
      if (this._accessControlEnabled) {
        mappings += `router.use('/${slug}', requirePermission('${slug}'), ${slug}Router);\n`;
      } else {
        mappings += `router.use('/${slug}', ${slug}Router);\n`;
      }
    });

    const template = `
const express = require('express');
const router = express.Router();

${rbacImport}${imports}

${rbacSetup}${mappings}

module.exports = router;
`;
    await fs.writeFile(path.join(outputDir, 'src/routes/index.js'), template);
  },
};
