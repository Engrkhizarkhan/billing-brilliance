const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const { createApplicantValidation, paginationValidation, idParam } = require('../middleware/validate');
const { tenantScope } = require('../middleware/auth');
const applicantController = require('../controllers/applicantController');

router.use(authenticate);
router.use(tenantScope);

router.get('/', paginationValidation, handleValidation, applicantController.fetchApplicants);
router.get('/:id', idParam, handleValidation, applicantController.getApplicant);
router.post('/', createApplicantValidation, handleValidation, applicantController.createApplicant);
router.put('/:id/assign-roll', idParam, handleValidation, applicantController.assignRoll);
router.put('/:id/result', idParam, handleValidation, applicantController.recordResult);

module.exports = router;
