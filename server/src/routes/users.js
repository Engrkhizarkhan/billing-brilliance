const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const { createUserValidation, paginationValidation, idParam } = require('../middleware/validate');
const userController = require('../controllers/userController');

router.use(authenticate);

router.get('/', paginationValidation, handleValidation, userController.fetchUsers);
router.get('/:id', idParam, handleValidation, userController.getUser);
router.post('/', authorize('admin'), createUserValidation, handleValidation, userController.createUser);
router.put('/:id', idParam, handleValidation, userController.updateUser);
router.patch('/:id/status', authorize('admin'), idParam, handleValidation, userController.updateUserStatus);
router.put('/:id/reset-password', authorize('admin'), idParam, handleValidation, userController.resetPassword);

// School sub-user management
router.get('/school/:schoolRef', userController.fetchSchoolUsers);
router.post('/school/sub-user', userController.createSchoolSubUser);
router.delete('/school/:id', userController.deleteSchoolUser);

module.exports = router;
