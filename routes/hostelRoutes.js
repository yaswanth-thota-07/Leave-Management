const express = require('express');
const router = express.Router();
const hostelController = require('../controllers/hostelController');

router.get('/', hostelController.getHostels);
router.post('/', hostelController.addHostel);

module.exports = router;
