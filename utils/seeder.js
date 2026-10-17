const User = require('../models/User');
const Leave = require('../models/Leave');
const Department = require('../models/Department');
const Hostel = require('../models/Hostel');
const { uid, hash, STAGES, SEED_DEPTS, SEED_HOSTELS } = require('./helpers');

async function seedDatabaseIfEmpty() {
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    // Ensure demo students 250361 and 240362 exist
    const has250361 = await User.findOne({ 'profile.regNo': '250361' });
    if (!has250361) {
      await User.create([
        {
          id: uid(), role: 'STUDENT', name: 'Rahul Sharma', email: '250361@college.edu', passwordHash: hash('password123'), isActive: true, mustChange: false, createdAt: Date.now() - 864e5 * 2,
          profile: { regNo: '250361', phone: '9876543210', parentPhone: '9876543211', year: 'SE', departmentId: 'COMP', section: 'A', hostelId: 'VISH', block: 'A', roomNo: '204' }
        },
        {
          id: uid(), role: 'STUDENT', name: 'Priya Verma', email: '240362@college.edu', passwordHash: hash('password123'), isActive: true, mustChange: false, createdAt: Date.now() - 864e5 * 3,
          profile: { regNo: '240362', phone: '9876543220', parentPhone: '9876543221', year: 'SE', departmentId: 'COMP', section: 'A', hostelId: 'KALAM', block: 'E', roomNo: '312' }
        }
      ]);
    }
    return;
  }

  console.log('Seeding initial MongoDB collections...');
  await Department.insertMany(SEED_DEPTS.map(([id, name, short, hod]) => ({ id, name, short, hod })));
  await Hostel.insertMany(SEED_HOSTELS.map(([id, name, blocks]) => ({ id, name, blocks })));

  const s1Id = uid();
  const s2Id = uid();
  const teacherId = uid();
  const wardenId = uid();
  const now = Date.now();

  await User.insertMany([
    { id: 'admin', role: 'ADMIN', name: 'Main Admin', email: 'admin@gmail.com', passwordHash: hash('admin123'), isActive: true, mustChange: false, createdAt: now },
    {
      id: s1Id, role: 'STUDENT', name: 'Rahul Sharma', email: '250361@college.edu', passwordHash: hash('password123'), isActive: true, mustChange: false, createdAt: now - 864e5 * 2,
      profile: { regNo: '250361', phone: '9876543210', parentPhone: '9876543211', year: 'SE', departmentId: 'COMP', section: 'A', hostelId: 'VISH', block: 'A', roomNo: '204' }
    },
    {
      id: s2Id, role: 'STUDENT', name: 'Priya Verma', email: '240362@college.edu', passwordHash: hash('password123'), isActive: true, mustChange: false, createdAt: now - 864e5 * 3,
      profile: { regNo: '240362', phone: '9876543220', parentPhone: '9876543221', year: 'SE', departmentId: 'COMP', section: 'A', hostelId: 'KALAM', block: 'E', roomNo: '312' }
    },
    {
      id: teacherId, role: 'CLASS_TEACHER', name: 'Prof. Anjali Mehta', email: 'teacher@gmail.com', passwordHash: hash('teacher123'), isActive: true, mustChange: false,
      scope: { year: 'SE', departmentId: 'COMP', section: 'A' }, createdAt: now - 864e5 * 10
    },
    {
      id: wardenId, role: 'WARDEN', name: 'Dr. R. K. Nair', email: 'warden@gmail.com', passwordHash: hash('warden123'), isActive: true, mustChange: false,
      scope: { hostelId: 'VISH' }, createdAt: now - 864e5 * 10
    }
  ]);

  await Leave.insertMany([
    {
      id: uid(),
      studentId: s1Id,
      type: 'HOSTEL_LEAVE',
      reason: 'National Level Hackathon at IIT Bombay',
      address: 'Hostel 12, IIT Bombay, Powai, Mumbai - 400076',
      fromAt: now + 24 * 36e5,
      toAt: now + 96 * 36e5,
      hostelId: 'VISH',
      block: 'A',
      roomNo: '204',
      attendance: 88.5,
      lastSem: 84.2,
      informedParents: true,
      parentConfirm: true,
      mobile: '9876543210',
      guardianMobile: '9876543211',
      signature: 'VERIFIED',
      docs: [],
      snapshot: { regNo: '250361', year: 'SE', section: 'A', departmentId: 'COMP' },
      status: 'PENDING_CLASS_TEACHER',
      createdAt: now - 3 * 36e5,
      approvals: STAGES.map((s, i) => ({ stage: i + 1, role: s.role, decision: 'PENDING', actedBy: null, actorName: '', note: '', actedAt: null }))
    },
    {
      id: uid(),
      studentId: s2Id,
      type: 'ACADEMIC_OUTPASS',
      reason: 'Technical Project Expo & Paper Presentation',
      address: 'COEP Technological University, Shivajinagar, Pune',
      fromAt: now + 12 * 36e5,
      toAt: now + 36 * 36e5,
      hostelId: 'KALAM',
      block: 'E',
      roomNo: '312',
      attendance: 92.0,
      lastSem: 89.5,
      informedParents: true,
      parentConfirm: true,
      mobile: '9876543220',
      guardianMobile: '9876543221',
      signature: 'VERIFIED',
      docs: [],
      snapshot: { regNo: '240362', year: 'SE', section: 'A', departmentId: 'COMP' },
      status: 'PENDING_WARDEN',
      createdAt: now - 12 * 36e5,
      approvals: [
        { stage: 1, role: 'CLASS_TEACHER', decision: 'APPROVED', actedBy: teacherId, actorName: 'Prof. Anjali Mehta', note: 'Recommended. Good academic record.', actedAt: now - 8 * 36e5 },
        { stage: 2, role: 'WARDEN', decision: 'PENDING', actedBy: null, actorName: '', note: '', actedAt: null },
        { stage: 3, role: 'HOD', decision: 'PENDING', actedBy: null, actorName: '', note: '', actedAt: null },
        { stage: 4, role: 'JD', decision: 'PENDING', actedBy: null, actorName: '', note: '', actedAt: null },
        { stage: 5, role: 'DIRECTOR', decision: 'PENDING', actedBy: null, actorName: '', note: '', actedAt: null },
      ]
    }
  ]);

  console.log('MongoDB Seeded successfully with demo accounts (Rahul Sharma 250361, Priya Verma 240362, Class Teacher, Warden & leaves).');
}

module.exports = { seedDatabaseIfEmpty };
