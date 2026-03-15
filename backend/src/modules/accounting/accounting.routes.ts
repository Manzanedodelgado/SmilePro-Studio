// ─── Accounting / Gestoría Routes ────────────────────────────────────────────
import { Router } from 'express';
import { AccountingController } from './accounting.controller.js';

const router = Router();

// Summary / KPIs
router.get('/summary', AccountingController.getSummary);

// Facturas emitidas
router.get('/invoices', AccountingController.listInvoices);
router.get('/invoices/:id', AccountingController.getInvoice);
router.post('/invoices', AccountingController.createInvoice);
router.patch('/invoices/:id/status', AccountingController.updateInvoiceStatus);

// Facturas email
router.get('/email-invoices', AccountingController.listEmailInvoices);
router.patch('/email-invoices/:gmailMessageId', AccountingController.updateEmailInvoice);

// Proveedores
router.get('/suppliers', AccountingController.listSuppliers);
router.get('/suppliers/:id', AccountingController.getSupplier);
router.post('/suppliers', AccountingController.createSupplier);
router.patch('/suppliers/:id', AccountingController.updateSupplier);

// Banco y conciliación
router.get('/bank-movements', AccountingController.listBankMovements);
router.patch('/bank-movements/:id/reconcile', AccountingController.reconcileMovement);

// Modelos fiscales
router.get('/tax-models', AccountingController.listTaxModels);
router.put('/tax-models', AccountingController.upsertTaxModel);

// Legacy
router.get('/payments', AccountingController.listPayments);
router.post('/payments', AccountingController.createPayment);
router.get('/budgets', AccountingController.listBudgets);
router.post('/budgets', AccountingController.createBudget);
router.get('/patients/:patientId/balance', AccountingController.patientBalance);

export default router;
