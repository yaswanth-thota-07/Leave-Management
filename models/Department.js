const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  short: { type: String, required: true },
  hod: { type: String, required: true }
}, {
  versionKey: false
});

module.exports = mongoose.model('Department', departmentSchema);
