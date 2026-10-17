/**
 * Approval-assist recommendation for admins/staff reviewing a leave request.
 *
 * Two layers, always computed together:
 *  1. A deterministic rule-based score from attendance %, last-semester %,
 *     leave duration and request frequency. Free, instant, fully explainable,
 *     and always available (even if the LLM call below fails or no API key
 *     is configured).
 *  2. A short natural-language narrative written by Claude, specifically
 *     addressing whether the request (hackathon / SSB / medical / family /
 *     other) looks worth granting given the student's standing. Requires
 *     ANTHROPIC_API_KEY; falls back to "unavailable" text (the rule-based
 *     score still renders) when the key is missing or the call fails.
 *
 * This is an assistive suggestion for staff, never a decision — the UI
 * always labels it as such, and it is never shown to the student.
 */

const REASON_PATTERNS = [
  { tag: 'HACKATHON', re: /\bhackathon|hack[-\s]?a?thon|coding competition|ideathon|code\s?fest\b/i },
  { tag: 'SSB', re: /\bssb\b|services selection board|afcat|nda\s+interview|defence academy|armed forces (selection|interview)/i },
  { tag: 'PLACEMENT', re: /\binterview|placement|internship|campus drive|job offer\b/i },
  { tag: 'MEDICAL', re: /\bmedical|hospital|surgery|illness|unwell|doctor|fever|injury\b/i },
  { tag: 'FAMILY', re: /\bwedding|marriage|family function|festival|funeral|bereavement|home visit\b/i },
];

function classifyReason(reason = '') {
  for (const { tag, re } of REASON_PATTERNS) if (re.test(reason)) return tag;
  return 'OTHER';
}

function daysBetween(fromAt, toAt) {
  if (!fromAt || !toAt || toAt <= fromAt) return 0;
  return Math.max(1, Math.round((toAt - fromAt) / 86400000));
}

const TAG_LABEL = {
  ATTENDANCE_CRITICAL: 'Attendance below 65%',
  ATTENDANCE_LOW: 'Attendance below 75%',
  ACADEMIC_CRITICAL: 'Last semester score below 50%',
  ACADEMIC_LOW: 'Last semester score below 60%',
  LONG_DURATION: 'Leave longer than 7 days',
  MEDIUM_DURATION: 'Leave of 3–7 days',
  FREQUENT_LEAVE_TAKER: '4+ other leave requests on record',
  OPPORTUNITY_HACKATHON: 'Hackathon / competitive event',
  OPPORTUNITY_SSB: 'SSB / defence selection process',
  OPPORTUNITY_PLACEMENT: 'Placement / internship opportunity',
  DOC_FLAGGED: 'One or more documents flagged as possibly AI-generated',
  DOC_REUSED: 'A document was also submitted by another student',
};

function ruleBasedScore({ attendance = 0, lastSem = 0, days = 0, reasonTag, priorLeaveCount = 0, flaggedDocCount = 0, reusedDocCount = 0 }) {
  const tags = [];
  let risk = 0;

  if (attendance < 65) { tags.push('ATTENDANCE_CRITICAL'); risk += 35; }
  else if (attendance < 75) { tags.push('ATTENDANCE_LOW'); risk += 18; }

  if (lastSem < 50) { tags.push('ACADEMIC_CRITICAL'); risk += 25; }
  else if (lastSem < 60) { tags.push('ACADEMIC_LOW'); risk += 12; }

  if (days > 7) { tags.push('LONG_DURATION'); risk += 15; }
  else if (days > 3) { tags.push('MEDIUM_DURATION'); risk += 5; }

  if (priorLeaveCount >= 4) { tags.push('FREQUENT_LEAVE_TAKER'); risk += 15; }
  if (flaggedDocCount > 0) { tags.push('DOC_FLAGGED'); risk += 20; }
  // A document shared across different students' requests is a harder signal
  // to explain away than a lone AI-metadata hit, so it weighs more heavily
  // and isn't softened by an "opportunity" reason below.
  if (reusedDocCount > 0) { tags.push('DOC_REUSED'); risk = Math.max(risk, 65); }

  const opportunity = ['HACKATHON', 'SSB', 'PLACEMENT'].includes(reasonTag);
  if (opportunity) tags.push('OPPORTUNITY_' + reasonTag);

  risk = Math.max(0, Math.min(100, risk));
  let verdict = 'APPROVE';
  if (risk >= 55) verdict = 'NEEDS_REVIEW';
  else if (risk >= 25) verdict = 'APPROVE_WITH_CAUTION';
  // A genuine opportunity (hackathon/SSB/placement) softens a borderline
  // verdict — still worth a human's attention, just not an automatic block.
  // Document reuse across students is excluded from this softening.
  if (opportunity && verdict === 'NEEDS_REVIEW' && risk < 70 && !reusedDocCount) verdict = 'APPROVE_WITH_CAUTION';

  return { risk, verdict, tags };
}

async function narrativeFromLLM(ctx) {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!hasGemini && !hasAnthropic) return null;

  const prompt = `You are assisting a college administrator (class teacher / warden / HOD / joint director / director) who is reviewing a student's leave request. You do not make the final decision — you provide concise, pointwise guidance to help a human decide faster.

De-identified request details:
- Registration no.: ${ctx.regNo || 'unknown'}
- Year / branch: ${ctx.year || '—'} ${ctx.departmentId || ''}
- Attendance: ${ctx.attendance}%
- Last semester score: ${ctx.lastSem}%
- Leave type: ${ctx.type}
- Stated reason: "${ctx.reason}"
- Auto-detected reason category: ${ctx.reasonTag}
- Duration: ${ctx.days} day(s)
- Other leave requests by this student on record: ${ctx.priorLeaveCount}
- Document check: ${ctx.flaggedDocCount} of ${ctx.totalDocs} attached document(s) flagged for potential issues
- Document reuse check: ${ctx.reusedDocCount || 0} attached document(s) found attached to another student's request

Format your evaluation strictly as 3-4 concise, pointwise bullet points:
• Reason & Opportunity: Assessment of whether "${ctx.reason}" is a worthwhile/legitimate pursuit.
• Attendance & Academics: Evaluation of the student's attendance (${ctx.attendance}%) and semester score (${ctx.lastSem}%).
• Duration & Risk: Evaluation of the leave duration (${ctx.days} day${ctx.days > 1 ? 's' : ''}) and prior frequency.
• Verdict Recommendation: Brief verdict (approve / approve with caution / needs review) with key takeaway.

Respond with ONLY compact JSON matching this format:
{"points": ["Reason & Opportunity: ...", "Attendance & Academics: ...", "Duration & Risk: ...", "Verdict Recommendation: ..."], "verdict": "APPROVE" | "APPROVE_WITH_CAUTION" | "NEEDS_REVIEW"}`;

  if (hasGemini) {
    const model = (process.env.AI_MODEL && process.env.AI_MODEL.startsWith('gemini'))
      ? process.env.AI_MODEL
      : 'gemini-2.5-flash';
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
    if (!resp.ok) throw new Error(`Gemini Recommendation API responded ${resp.status}`);
    const json = await resp.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Unexpected response format from model');
    const parsed = JSON.parse(match[0]);
    const points = Array.isArray(parsed.points)
      ? parsed.points.map(p => String(p).trim().replace(/^[•\-\*]\s*/, '')).filter(Boolean)
      : (parsed.narrative ? parsed.narrative.split(/\n+/).map(p => p.trim().replace(/^[•\-\*]\s*/, '')).filter(Boolean) : []);
    const narrative = points.map(p => `• ${p}`).join('\n');
    const verdict = ['APPROVE', 'APPROVE_WITH_CAUTION', 'NEEDS_REVIEW'].includes(parsed.verdict) ? parsed.verdict : null;
    return { points, narrative, verdict };
  }

  if (hasAnthropic) {
    const model = process.env.AI_MODEL || 'claude-sonnet-5';
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!resp.ok) throw new Error(`Recommendation API responded ${resp.status}`);
    const json = await resp.json();
    const text = json?.content?.find(b => b.type === 'text')?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Unexpected response format from model');
    const parsed = JSON.parse(match[0]);
    const points = Array.isArray(parsed.points)
      ? parsed.points.map(p => String(p).trim().replace(/^[•\-\*]\s*/, '')).filter(Boolean)
      : (parsed.narrative ? parsed.narrative.split(/\n+/).map(p => p.trim().replace(/^[•\-\*]\s*/, '')).filter(Boolean) : []);
    const narrative = points.map(p => `• ${p}`).join('\n');
    const verdict = ['APPROVE', 'APPROVE_WITH_CAUTION', 'NEEDS_REVIEW'].includes(parsed.verdict) ? parsed.verdict : null;
    return { points, narrative, verdict };
  }

  return null;
}

async function generateRecommendation(ctx) {
  const reasonTag = ctx.reasonTag || classifyReason(ctx.reason);
  const days = ctx.days ?? daysBetween(ctx.fromAt, ctx.toAt);
  const base = ruleBasedScore({ ...ctx, reasonTag, days });

  let llm = null, llmError = null;
  try {
    llm = await narrativeFromLLM({ ...ctx, reasonTag, days });
  } catch (err) {
    llmError = err.message;
  }

  // If the model offers its own verdict, prefer it (it sees nuance the rules
  // can't, like a strong SSB justification) but never let it look *more*
  // lenient than the rules when a document was flagged as likely fabricated
  // or reused across students.
  let verdict = llm?.verdict || base.verdict;
  if (base.tags.includes('DOC_FLAGGED') && verdict === 'APPROVE') verdict = 'APPROVE_WITH_CAUTION';
  if (base.tags.includes('DOC_REUSED') && verdict !== 'NEEDS_REVIEW') verdict = 'NEEDS_REVIEW';

  return {
    risk: base.risk,
    tags: base.tags,
    reasonTag,
    days,
    verdict,
    narrative: llm?.narrative || null,
    points: llm?.points || (llm?.narrative ? llm.narrative.split(/\n+/).map(p => p.trim().replace(/^[•\-\*]\s*/, '')).filter(Boolean) : [
      `Reason & Opportunity: ${ctx.reason} (${reasonTag}).`,
      `Attendance & Academics: Attendance is ${ctx.attendance}% and last semester score is ${ctx.lastSem}%.`,
      `Duration & Risk: Requested for ${days} day${days > 1 ? 's' : ''}.`,
      `Verdict Recommendation: ${base.verdict.replace(/_/g, ' ')}.`
    ]),
    llmError,
    source: llm ? 'rules+llm' : 'rules-only',
    generatedAt: Date.now(),
  };
}

module.exports = { generateRecommendation, classifyReason, daysBetween, TAG_LABEL };
