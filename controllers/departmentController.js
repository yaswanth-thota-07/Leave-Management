const Department = require('../models/Department');
const { uid } = require('../utils/helpers');

// GET /api/departments
exports.getDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find({}, { _id: 0, __v: 0 });
    res.json(departments);
  } catch (err) {
    next(err);
  }
};

// POST /api/departments
exports.addDepartment = async (req, res, next) => {
  try {
    const { name, short, hod } = req.body;
    if (!name || !short || !hod) return res.status(400).json({ error: 'Fill all three fields' });
    const newDept = new Department({ id: uid().slice(0, 8), name: name.trim(), short: short.trim(), hod: hod.trim() });
    await newDept.save();
    res.json({ success: true, department: newDept.toObject() });
  } catch (err) {
    next(err);
  }
};
