const Leave = require('../models/Leave');
const User = require('../models/User');
const Audit = require('../models/Audit');
const { uid, STAGES } = require('../utils/helpers');

// GET /api/leaves
exports.getLeaves = async (req, res, next) => {
  try {
    const leaves = await Leave.find({}, { _id: 0, __v: 0 }).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (err) {
    next(err);
  }
};

// POST /api/leaves
exports.createLeave = async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.studentId || !data.reason || !data.address || !data.fromAt || !data.toAt) {
      return res.status(400).json({ error: 'Missing required leave fields.' });
    }

    const newLeave = new Leave({
      id: uid(),
      studentId: data.studentId,
      type: data.type || 'HOSTEL_LEAVE',
      reason: data.reason.trim(),
      address: data.address.trim(),
      fromAt: Number(data.fromAt),
      toAt: Number(data.toAt),
      hostelId: data.hostelId || '',
      block: data.block || '',
      roomNo: data.roomNo || '',
      attendance: Number(data.attendance) || 0,
      lastSem: Number(data.lastSem) || 0,
      informedParents: !!data.informedParents,
      parentConfirm: !!data.parentConfirm,
      mobile: data.mobile || '',
      guardianMobile: data.guardianMobile || '',
      signature: 'VERIFIED',
      docs: data.docs || [],
      snapshot: data.snapshot || {},
      status: 'PENDING_CLASS_TEACHER',
      createdAt: Date.now(),
      approvals: STAGES.map((s, i) => ({
        stage: i + 1,
        role: s.role,
        decision: 'PENDING',
        actedBy: null,
        actorName: '',
        note: '',
        actedAt: null
      })),
    });

    await newLeave.save();

    await Audit.create({
      id: uid(),
      leaveId: newLeave.id,
      actorId: data.studentId,
      action: 'SUBMIT',
      from: null,
      to: newLeave.status,
      at: Date.now()
    });

    res.json({ success: true, leave: newLeave.toObject() });
  } catch (err) {
    next(err);
  }
};

// POST /api/leaves/:id/decide
exports.decideLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { actorId, decision, note } = req.body;

    const leave = await Leave.findOne({ id });
    if (!leave) return res.status(404).json({ error: 'Leave request not found.' });

    const actor = await User.findOne({ id: actorId });
    if (!actor) return res.status(404).json({ error: 'Actor not found.' });

    const stageIdx = STAGES.findIndex(s => s.role === actor.role);
    if (stageIdx === -1) return res.status(403).json({ error: 'Role not authorized for workflow stages.' });

    const from = leave.status;
    const updatedApprovals = [...leave.approvals];
    updatedApprovals[stageIdx] = {
      stage: stageIdx + 1,
      role: actor.role,
      decision,
      actedBy: actor.id,
      actorName: actor.name,
      note: (note || '').trim(),
      actedAt: Date.now()
    };

    leave.approvals = updatedApprovals;
    leave.status = decision === 'REJECTED' ? 'REJECTED' : stageIdx === 4 ? 'APPROVED' : 'PENDING_' + STAGES[stageIdx + 1].role;

    await leave.save();

    await Audit.create({
      id: uid(),
      leaveId: leave.id,
      actorId: actor.id,
      action: decision === 'REJECTED' ? 'REJECT' : 'APPROVE',
      from,
      to: leave.status,
      at: Date.now()
    });

    res.json({ success: true, leave: leave.toObject() });
  } catch (err) {
    next(err);
  }
};

// POST /api/leaves/:id/withdraw
exports.withdrawLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;
    const leave = await Leave.findOne({ id, studentId });
    if (!leave) return res.status(404).json({ error: 'Leave not found.' });

    const from = leave.status;
    leave.status = 'CANCELLED';
    await leave.save();

    await Audit.create({
      id: uid(),
      leaveId: leave.id,
      actorId: studentId,
      action: 'CANCEL',
      from,
      to: 'CANCELLED',
      at: Date.now()
    });

    res.json({ success: true, leave: leave.toObject() });
  } catch (err) {
    next(err);
  }
};
