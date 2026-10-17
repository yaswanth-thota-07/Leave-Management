const mongoose = require('mongoose');

const hostelSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  blocks: { type: [String], default: [] }
}, {
  versionKey: false
});

module.exports = mongoose.model('Hostel', hostelSchema);
