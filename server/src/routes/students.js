const express = require('express');
const router = express.Router();
const { authenticate, authorize, authorizeSchoolRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const { createStudentValidation, paginationValidation, idParam } = require('../middleware/validate');
const { tenantScope, requireLiveTenant } = require('../middleware/auth');
const studentController = require('../controllers/studentController');

router.use(authenticate);
router.use(authorize('admin', 'school'));
router.use(tenantScope);

router.get('/', paginationValidation, handleValidation, studentController.fetchStudents);
router.get('/financial-summary', studentController.fetchStudentFinancialSummary);
router.get('/ledger-summary', studentController.fetchStudentLedgerSummary);
router.get('/:id', idParam, handleValidation, studentController.getStudent);
router.post('/', authorizeSchoolRole('admin'), createStudentValidation, handleValidation, studentController.createStudent);
router.put('/:id', authorizeSchoolRole('admin'), idParam, handleValidation, studentController.updateStudent);
router.delete('/:id', authorizeSchoolRole('admin'), idParam, handleValidation, studentController.deleteStudent);
router.put('/:id/bus-service', authorizeSchoolRole('admin', 'finance'), idParam, handleValidation, studentController.updateStudentBusService);
router.patch('/:id/bus-service', authorizeSchoolRole('admin', 'finance'), idParam, handleValidation, studentController.updateStudentBusService);
router.get('/:id/ledger', idParam, handleValidation, studentController.getStudentLedger);
router.get('/:id/snapshot', idParam, handleValidation, studentController.getStudentSnapshot);
router.post('/:id/additional-charge', authorizeSchoolRole('admin', 'finance'), requireLiveTenant, idParam, handleValidation, studentController.createAdditionalCharge);

module.exports = router;
