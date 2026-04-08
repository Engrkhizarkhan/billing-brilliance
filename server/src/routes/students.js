const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const { createStudentValidation, paginationValidation, idParam } = require('../middleware/validate');
const { tenantScope } = require('../middleware/auth');
const studentController = require('../controllers/studentController');

router.use(authenticate);
router.use(tenantScope);

router.get('/', paginationValidation, handleValidation, studentController.fetchStudents);
router.get('/financial-summary', studentController.fetchStudentFinancialSummary);
router.get('/:id', idParam, handleValidation, studentController.getStudent);
router.post('/', createStudentValidation, handleValidation, studentController.createStudent);
router.put('/:id', idParam, handleValidation, studentController.updateStudent);
router.delete('/:id', idParam, handleValidation, studentController.deleteStudent);
router.put('/:id/bus-service', idParam, handleValidation, studentController.updateStudentBusService);
router.patch('/:id/bus-service', idParam, handleValidation, studentController.updateStudentBusService);
router.get('/:id/ledger', idParam, handleValidation, studentController.getStudentLedger);
router.get('/:id/snapshot', idParam, handleValidation, studentController.getStudentSnapshot);

module.exports = router;
