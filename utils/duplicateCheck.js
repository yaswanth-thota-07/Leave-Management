/**
 * Cross-student duplicate document detection.
 *
 * Every uploaded file is hashed (SHA-256 of its raw bytes) at upload time —
 * see controllers/fileController.js. During an AI review, we look for other
 * leave requests that reused a file with the exact same hash:
 *
 *  - A match on a DIFFERENT student's request is the interesting fraud
 *    pattern this is built for — the same forged invite/ticket/letter image
 *    recycled across students, which a per-image "is this AI-generated"
 *    check alone would miss.
 *  - A match on the SAME student's own earlier request is reported too, but
 *    is not treated as suspicious by itself — students legitimately re-use
 *    their own documents when editing or resubmitting.
 *
 * Zero external dependencies, zero cost, runs entirely against this app's
 * own MongoDB data.
 */

const crypto = require('crypto');
const Leave = require('../models/Leave');
const FileDoc = require('../models/FileDoc');

function hashBuffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function hashBase64DataUrl(dataUrl) {
  const m = /^data:[^;]+;base64,(.+)$/.exec(dataUrl || '');
  if (!m) return '';
  try {
    return hashBuffer(Buffer.from(m[1], 'base64'));
  } catch {
    return '';
  }
}

/**
 * @param {{hash:string, fileId:string, studentId:string, excludeLeaveId:string}} args
 * @returns {Promise<{crossStudent: Array, sameStudent: Array}>}
 */
async function findReuse({ hash, fileId, studentId, excludeLeaveId }) {
  if (!hash) return { crossStudent: [], sameStudent: [] };

  const matches = await FileDoc.find({ hash, id: { $ne: fileId } }, { id: 1, _id: 0 });
  if (!matches.length) return { crossStudent: [], sameStudent: [] };

  const matchIds = matches.map(m => m.id);
  const leaves = await Leave.find(
    { 'docs.id': { $in: matchIds }, id: { $ne: excludeLeaveId } },
    { id: 1, studentId: 1, createdAt: 1, snapshot: 1, _id: 0 }
  );

  const crossStudent = [], sameStudent = [];
  for (const l of leaves) {
    const entry = { leaveId: l.id, regNo: l.snapshot?.regNo || '—', submittedAt: l.createdAt };
    (l.studentId === studentId ? sameStudent : crossStudent).push(entry);
  }
  return { crossStudent, sameStudent };
}

module.exports = { hashBuffer, hashBase64DataUrl, findReuse };
