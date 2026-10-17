const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  leaveId: { type: String, default: null },
  actorId: { type: String, required: true },
  action: { type: String, required: true },
  from: { type: String, default: null },
  to: { type: String, default: null },
  at: { type: Number, default: () => Date.now() }
}, {
  versionKey: false
});

module.exports = mongoose.model('Audit', auditSchema);
