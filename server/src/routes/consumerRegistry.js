const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const consumerRegistryController = require('../controllers/consumerRegistryController');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));
router.get('/', consumerRegistryController.fetchConsumerRegistry);

module.exports = router;
