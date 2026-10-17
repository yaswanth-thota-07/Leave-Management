const mongoose = require('mongoose');
const Department = require('../models/Department');
const Hostel = require('../models/Hostel');
const User = require('../models/User');
const Leave = require('../models/Leave');
const Audit = require('../models/Audit');

// GET /api/health
exports.healthCheck = (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: Date.now()
  });
};

// GET /api/bootstrap
exports.bootstrapAppData = async (req, res, next) => {
  try {
    const [departments, hostels, users, leaves, audit] = await Promise.all([
      Department.find({}, { _id: 0, __v: 0 }),
      Hostel.find({}, { _id: 0, __v: 0 }),
      User.find({}, { _id: 0, __v: 0 }),
      Leave.find({}, { _id: 0, __v: 0 }),
      Audit.find({}, { _id: 0, __v: 0 }),
    ]);
    res.json({ departments, hostels, users, leaves, audit });
  } catch (err) {
    next(err);
  }
};

// GET /api/gate/check/:reg
exports.gateCheck = async (req, res, next) => {
  try {
    const reg = req.params.reg.trim().toUpperCase();
    const student = await User.findOne({ role: 'STUDENT', 'profile.regNo': reg }, { _id: 0, __v: 0 });
    if (!student) return res.status(404).json({ error: 'No student found with this registration number.' });

    const leaves = await Leave.find({ studentId: student.id, status: { $ne: 'CANCELLED' } }).sort({ createdAt: -1 });
    res.json({ student, leaves });
  } catch (err) {
    next(err);
  }
};
