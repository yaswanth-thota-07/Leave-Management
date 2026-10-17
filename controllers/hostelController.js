const Hostel = require('../models/Hostel');
const { uid } = require('../utils/helpers');

// GET /api/hostels
exports.getHostels = async (req, res, next) => {
  try {
    const hostels = await Hostel.find({}, { _id: 0, __v: 0 });
    res.json(hostels);
  } catch (err) {
    next(err);
  }
};

// POST /api/hostels
exports.addHostel = async (req, res, next) => {
  try {
    const { name, blocks } = req.body;
    if (!name) return res.status(400).json({ error: 'Hostel name required' });
    const newHostel = new Hostel({ id: uid().slice(0, 8), name: name.trim(), blocks: blocks || [] });
    await newHostel.save();
    res.json({ success: true, hostel: newHostel.toObject() });
  } catch (err) {
    next(err);
  }
};
