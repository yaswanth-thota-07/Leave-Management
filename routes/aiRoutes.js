const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Staff-only (enforced in the controller, not just the UI) — see aiController.requireStaffViewer.
router.post('/leaves/:id/analyze', aiController.analyzeLeave);
router.get('/leaves/:id', aiController.getLeaveReview);

module.exports = router;
