const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const leaveRoutes = require('./leaveRoutes');
const userRoutes = require('./userRoutes');
const departmentRoutes = require('./departmentRoutes');
const hostelRoutes = require('./hostelRoutes');
const fileRoutes = require('./fileRoutes');
const bootstrapController = require('../controllers/bootstrapController');

// System endpoints
router.get('/health', bootstrapController.healthCheck);
router.get('/bootstrap', bootstrapController.bootstrapAppData);
router.get('/gate/check/:reg', bootstrapController.gateCheck);

// Resource routers
router.use('/auth', authRoutes);
router.use('/leaves', leaveRoutes);
router.use('/users', userRoutes);
router.use('/departments', departmentRoutes);
router.use('/hostels', hostelRoutes);
router.use('/files', fileRoutes);

module.exports = router;
