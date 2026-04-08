const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/auth');
const postingController = require('../controllers/postingController');

router.use(authenticate);
router.use(tenantScope);

// Postings
router.get('/postings', postingController.fetchPostings);
router.get('/postings/:id', postingController.getPosting);
router.post('/postings', postingController.createPosting);
router.put('/postings/:id', postingController.updatePosting);
router.put('/postings/:id/status', postingController.updatePostingStatus);
router.patch('/postings/:id/status', postingController.updatePostingStatus);

// Services
router.get('/services', postingController.fetchServices);
router.post('/services', postingController.createService);

module.exports = router;
