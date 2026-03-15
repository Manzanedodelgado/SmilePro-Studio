// ─── Accounting / Gestoría Routes ────────────────────────────────────────────
import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { AccountingController } from './accounting.controller';

const router = Router();
router.use(authenticate);

// Summary / KPIs
router.get('/summary', requirePermission('accounting:read'), AccountingController.getSummary);

// Facturas emitidas
router.get('/invoices', requirePermission('accounting:read'), AccountingController.listInvoices);
router.get('/invoices/:id', requirePermission('accounting:read'), AccountingController.getInvoice);
router.post('/invoices', requirePermission('accounting:write'), AccountingController.createInvoice);
router.patch('/invoices/:id/status', requirePermission('accounting:write'), AccountingController.updateInvoiceStatus);

// Facturas email (recibidas desde Gmail)
router.get('/email-invoices', requirePermission('accounting:read'), AccountingController.listEmailInvoices);
router.patch('/email-invoices/:gmailMessageId', requirePermission('accounting:write'), AccountingController.updateEmailInvoice);

// Proveedores
router.get('/suppliers', requirePermission('accounting:read'), AccountingController.listSuppliers);
router.get('/suppliers/:id', requirePermission('accounting:read'), AccountingController.getSupplier);
router.post('/suppliers', requirePermission('accounting:write'), AccountingController.createSupplier);
router.patch('/suppliers/:id', requirePermission('accounting:write'), AccountingController.updateSupplier);

// Banco y conciliación
router.get('/bank-movements', requirePermission('accounting:read'), AccountingController.listBankMovements);
router.patch('/bank-movements/:id/reconcile', requirePermission('accounting:write'), AccountingController.reconcileMovement);

// Modelos fiscales
router.get('/tax-models', requirePermission('accounting:read'), AccountingController.listTaxModels);
router.put('/tax-models', requirePermission('accounting:write'), AccountingController.upsertTaxModel);

// Legacy
router.get('/payments', requirePermission('accounting:read'), AccountingController.listPayments);
router.post('/payments', requirePermission('accounting:write'), AccountingController.createPayment);
router.get('/budgets', requirePermission('accounting:read'), AccountingController.listBudgets);
router.post('/budgets', requirePermission('accounting:write'), AccountingController.createBudget);
router.get('/patients/:patientId/balance', requirePermission('accounting:read'), AccountingController.patientBalance);

export default router;
