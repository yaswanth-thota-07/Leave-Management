const Leave = require('../models/Leave');
const User = require('../models/User');
const FileDoc = require('../models/FileDoc');
const { analyzeDocument } = require('../utils/docForensics');
const { generateRecommendation } = require('../utils/aiRecommendation');
const { hashBase64DataUrl, findReuse } = require('../utils/duplicateCheck');

// Roles allowed to see AI review output. Students are deliberately excluded —
// this endpoint is the single enforcement point so the restriction holds
// even if someone calls the API directly instead of going through the UI.
const STAFF_ROLES = new Set(['ADMIN', 'CLASS_TEACHER', 'WARDEN', 'HOD', 'JD', 'DIRECTOR']);

// Matches this app's existing auth model — AI recommendation is restricted to admins and authorities.
async function requireAdminViewer(req, res) {
  const viewerId = req.body?.viewerId || req.query?.viewerId;
  if (!viewerId) {
    res.status(400).json({ error: 'viewerId is required.' });
    return null;
  }
  const viewer = await User.findOne({ id: viewerId });
  if (!viewer || !STAFF_ROLES.has(viewer.role)) {
    res.status(403).json({ error: 'AI recommendation is restricted to admin and authority accounts.' });
    return null;
  }
  return viewer;
}

// POST /api/ai/leaves/:id/analyze — runs (or re-runs) the AI review and caches it on the leave.
exports.analyzeLeave = async (req, res, next) => {
  try {
    const viewer = await requireAdminViewer(req, res);
    if (!viewer) return;

    const leave = await Leave.findOne({ id: req.params.id });
    if (!leave) return res.status(404).json({ error: 'Leave request not found.' });

    const docMetas = leave.docs || [];
    const files = docMetas.length ? await FileDoc.find({ id: { $in: docMetas.map(d => d.id) } }) : [];
    const fileById = new Map(files.map(f => [f.id, f]));

    const docFlags = await Promise.all(docMetas.map(async meta => {
      const file = fileById.get(meta.id);
      const result = await analyzeDocument(file ? { id: meta.id, name: meta.name, type: meta.type, data: file.data } : { id: meta.id, name: meta.name, type: meta.type });

      if (file) {
        let hash = file.hash;
        if (!hash && file.data) {
          // Lazily backfill the hash for files uploaded before this feature existed.
          hash = hashBase64DataUrl(file.data);
          if (hash) { file.hash = hash; await file.save().catch(() => {}); }
        }
        if (hash) {
          const reuse = await findReuse({ hash, fileId: file.id, studentId: leave.studentId, excludeLeaveId: leave.id });
          if (reuse.crossStudent.length || reuse.sameStudent.length) result.reuse = reuse;
        }
      }
      return result;
    }));

    const flaggedDocCount = docFlags.filter(d => d.checked && d.verdict === 'LIKELY_AI').length;
    const reusedDocCount = docFlags.filter(d => d.reuse?.crossStudent?.length).length;

    const priorLeaveCount = await Leave.countDocuments({ studentId: leave.studentId, id: { $ne: leave.id } });

    const recommendation = await generateRecommendation({
      regNo: leave.snapshot?.regNo || '',
      year: leave.snapshot?.year || '',
      departmentId: leave.snapshot?.departmentId || '',
      attendance: leave.attendance,
      lastSem: leave.lastSem,
      type: leave.type,
      reason: leave.reason,
      fromAt: leave.fromAt,
      toAt: leave.toAt,
      priorLeaveCount,
      flaggedDocCount,
      reusedDocCount,
      totalDocs: docMetas.length,
    });

    const aiReview = {
      docFlags,
      recommendation,
      computedAt: Date.now(),
      computedBy: viewer.id,
    };

    leave.aiReview = aiReview;
    await leave.save();

    res.json({ success: true, aiReview });
  } catch (err) {
    next(err);
  }
};

// GET /api/ai/leaves/:id?viewerId=... — returns the cached review, if any, without recomputing.
exports.getLeaveReview = async (req, res, next) => {
  try {
    const viewer = await requireAdminViewer(req, res);
    if (!viewer) return;

    const leave = await Leave.findOne({ id: req.params.id }, { aiReview: 1, _id: 0 });
    if (!leave) return res.status(404).json({ error: 'Leave request not found.' });

    res.json({ success: true, aiReview: leave.aiReview || null });
  } catch (err) {
    next(err);
  }
};
