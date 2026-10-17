const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  role: {
    type: String,
    required: true,
    enum: ['STUDENT', 'ADMIN', 'CLASS_TEACHER', 'WARDEN', 'HOD', 'JD', 'DIRECTOR', 'GATE']
  },
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  mustChange: { type: Boolean, default: false },
  profile: {
    regNo: { type: String, default: '' },
    phone: { type: String, default: '' },
    parentPhone: { type: String, default: '' },
    year: { type: String, default: '' },
    departmentId: { type: String, default: '' },
    section: { type: String, default: '' },
    hostelId: { type: String, default: '' },
    block: { type: String, default: '' },
    roomNo: { type: String, default: '' }
  },
  scope: {
    year: { type: String, default: '' },
    departmentId: { type: String, default: '' },
    section: { type: String, default: '' },
    hostelId: { type: String, default: '' }
  },
  createdAt: { type: Number, default: () => Date.now() }
}, {
  versionKey: false
});

module.exports = mongoose.model('User', userSchema);
