const mongoose = require('mongoose');

const fileDocSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, default: '' },
  size: { type: Number, default: 0 },
  data: { type: String, required: true }
}, {
  versionKey: false
});

module.exports = mongoose.model('FileDoc', fileDocSchema);
