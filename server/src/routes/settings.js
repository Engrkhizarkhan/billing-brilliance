const express = require('express');
const router = express.Router();
const { authenticate, authorize, authorizeSchoolRole } = require('../middleware/auth');
const { tenantScope } = require('../middleware/auth');
const settingsController = require('../controllers/settingsController');

router.use(authenticate);
router.use(authorize('admin', 'school'));
router.use(tenantScope);

router.get('/fee-plans', settingsController.fetchFeePlans);
router.post('/fee-plans', authorizeSchoolRole('admin', 'finance'), settingsController.createFeePlan);
router.put('/fee-plans/:id', authorizeSchoolRole('admin', 'finance'), settingsController.updateFeePlan);
router.delete('/fee-plans/:id', authorizeSchoolRole('admin'), settingsController.deleteFeePlan);
router.get('/fee-heads', settingsController.fetchFeeHeads);
router.get('/scholarships', settingsController.fetchScholarships);
router.post('/scholarships', authorizeSchoolRole('admin', 'finance'), settingsController.createScholarship);
router.patch('/scholarships/:id/status', authorizeSchoolRole('admin', 'finance'), settingsController.updateScholarshipStatus);
router.get('/students/:studentId/scholarships', settingsController.fetchStudentScholarships);
router.get('/scholarship-assignments', settingsController.fetchAllScholarshipAssignments);
router.post('/scholarship-assignments', authorizeSchoolRole('admin', 'finance'), settingsController.createScholarshipAssignment);
router.post('/scholarship-assignments/bulk', authorizeSchoolRole('admin', 'finance'), settingsController.bulkCreateScholarshipAssignments);
router.patch('/scholarship-assignments/:id/status', authorizeSchoolRole('admin', 'finance'), settingsController.updateScholarshipAssignment);
router.get('/payment-plan-assignments', settingsController.fetchPaymentPlanAssignments);
router.post('/payment-plan-assignments', authorizeSchoolRole('admin', 'finance'), settingsController.createPaymentPlanAssignment);
router.post('/payment-plan-assignments/bulk', authorizeSchoolRole('admin', 'finance'), settingsController.bulkCreatePaymentPlanAssignments);
router.put('/payment-plan-assignments/:id', authorizeSchoolRole('admin', 'finance'), settingsController.updatePaymentPlanAssignment);
router.delete('/payment-plan-assignments/:id', authorizeSchoolRole('admin', 'finance'), settingsController.deletePaymentPlanAssignment);
router.get('/settings/:key', settingsController.getSetting);
router.put('/settings/:key', authorizeSchoolRole('admin'), settingsController.upsertSetting);

module.exports = router;
