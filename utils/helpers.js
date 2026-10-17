const crypto = require('crypto');

function uid() {
  return 'id_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function hash(str) {
  if (!str) return '';
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

function fallbackHash(str) {
  if (!str) return '';
  return Buffer.from(String(str)).toString('base64');
}

const STAGES = [
  { role: 'CLASS_TEACHER', label: 'Class Teacher', paper: 'Counselor/Class Teacher', yes: 'Recommended', no: 'Not recommended' },
  { role: 'WARDEN', label: 'Warden', paper: 'Warden', yes: 'Recommended', no: 'Not recommended' },
  { role: 'HOD', label: 'HOD', paper: 'HOD', yes: 'Permitted', no: 'Not permitted' },
  { role: 'JD', label: 'Joint Director', paper: 'Jt Director', yes: 'Approved', no: 'Not Approved' },
  { role: 'DIRECTOR', label: 'Director', paper: 'Director', yes: 'Sanctioned', no: 'Not sanctioned' },
];

const SEED_DEPTS = [
  ['COMP', 'Computer Engineering', 'Comp', 'S. R. Dhore'],
  ['IT', 'Information Technology', 'IT', 'Sangeeta Jadhav'],
  ['ENTC', 'Electronics and Telecommunication', 'EnTC', 'Sushma Patil'],
  ['MECH', 'Mechanical Engineering', 'Mech', 'U. V. Awasarmol'],
  ['ARE', 'Automation and Robotics Engineering', 'ARE', 'J. D. Patil'],
];

const SEED_HOSTELS = [
  ['VISH', 'Vishweshwaraiya Hostel', ['A', 'B', 'C', 'D']],
  ['KALAM', 'Abdul Kalam Hostel', ['E', 'F', 'G']],
  ['BHABHA', 'Homi Bhabha Hostel', ['H']],
  ['BOSE', 'SN Bose Hostel', []],
  ['SARABHAI', 'Sarabhai Hostel', []],
  ['GURBIR', 'Capt. Gurbir Singh Hostel', []],
  ['RAMANUJAN', 'Ramanujan Hostel', []],
  ['KALPANA', 'Kalpana Hostel', []],
];

module.exports = {
  uid,
  hash,
  fallbackHash,
  STAGES,
  SEED_DEPTS,
  SEED_HOSTELS,
};
