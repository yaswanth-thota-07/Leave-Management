const mongoose = require('mongoose');

const fileDocSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, default: '' },
  size: { type: Number, default: 0 },
  data: { type: String, required: true },
  // SHA-256 of the decoded file bytes, used to spot the same document being
  // reused across different students' leave requests (see utils/duplicateCheck.js).
  hash: { type: String, default: '', index: true }
}, {
  versionKey: false
});

module.exports = mongoose.model('FileDoc', fileDocSchema);
