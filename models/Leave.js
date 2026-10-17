const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
  stage: { type: Number, required: true },
  role: { type: String, required: true },
  decision: { type: String, default: 'PENDING' },
  actedBy: { type: String, default: null },
  actorName: { type: String, default: '' },
  note: { type: String, default: '' },
  actedAt: { type: Number, default: null }
}, { _id: false });

const leaveSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  type: { type: String, default: 'HOSTEL_LEAVE' },
  reason: { type: String, required: true },
  address: { type: String, required: true },
  fromAt: { type: Number, required: true },
  toAt: { type: Number, required: true },
  hostelId: { type: String, default: '' },
  block: { type: String, default: '' },
  roomNo: { type: String, default: '' },
  attendance: { type: Number, default: 0 },
  lastSem: { type: Number, default: 0 },
  informedParents: { type: Boolean, default: false },
  parentConfirm: { type: Boolean, default: false },
  mobile: { type: String, default: '' },
  guardianMobile: { type: String, default: '' },
  signature: { type: String, default: 'VERIFIED' },
  docs: { type: Array, default: [] },
  snapshot: { type: Object, default: {} },
  // Staff-only AI review (document authenticity signal + approval recommendation).
  // Never serialized to the student-facing views in app.js — see docDialog().
  aiReview: { type: Object, default: null },
  status: { type: String, default: 'PENDING_CLASS_TEACHER' },
  createdAt: { type: Number, default: () => Date.now() },
  approvals: [approvalSchema]
}, {
  versionKey: false
});

module.exports = mongoose.model('Leave', leaveSchema);
