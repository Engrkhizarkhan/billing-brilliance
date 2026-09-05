const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/auth');
const settingsController = require('../controllers/settingsController');

router.use(authenticate);
router.use(tenantScope);

router.get('/fee-plans', settingsController.fetchFeePlans);
router.post('/fee-plans', settingsController.createFeePlan);
router.put('/fee-plans/:id', settingsController.updateFeePlan);
router.delete('/fee-plans/:id', settingsController.deleteFeePlan);
router.get('/fee-heads', settingsController.fetchFeeHeads);
router.get('/scholarships', settingsController.fetchScholarships);
router.post('/scholarships', settingsController.createScholarship);
router.patch('/scholarships/:id/status', settingsController.updateScholarshipStatus);
router.get('/students/:studentId/scholarships', settingsController.fetchStudentScholarships);
router.get('/scholarship-assignments', settingsController.fetchAllScholarshipAssignments);
router.post('/scholarship-assignments', settingsController.createScholarshipAssignment);
router.post('/scholarship-assignments/bulk', settingsController.bulkCreateScholarshipAssignments);
router.patch('/scholarship-assignments/:id/status', settingsController.updateScholarshipAssignment);
router.get('/payment-plan-assignments', settingsController.fetchPaymentPlanAssignments);
router.post('/payment-plan-assignments', settingsController.createPaymentPlanAssignment);
router.post('/payment-plan-assignments/bulk', settingsController.bulkCreatePaymentPlanAssignments);
router.put('/payment-plan-assignments/:id', settingsController.updatePaymentPlanAssignment);
router.delete('/payment-plan-assignments/:id', settingsController.deletePaymentPlanAssignment);
router.get('/settings/:key', settingsController.getSetting);
router.put('/settings/:key', settingsController.upsertSetting);

module.exports = router;
