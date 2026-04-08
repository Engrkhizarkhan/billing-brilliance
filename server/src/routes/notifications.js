const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

router.use(authenticate);

router.get('/', notificationController.fetchNotifications);
router.put('/read-all', notificationController.markAllRead);
router.delete('/', notificationController.clearNotifications);
router.put('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
