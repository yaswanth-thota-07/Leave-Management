const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');

router.get('/', leaveController.getLeaves);
router.post('/', leaveController.createLeave);
router.post('/:id/decide', leaveController.decideLeave);
router.post('/:id/withdraw', leaveController.withdrawLeave);

module.exports = router;
