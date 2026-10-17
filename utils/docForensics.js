/**
 * Lightweight, dependency-free heuristics for spotting signs that an uploaded
 * leave-request document (image) may be AI-generated or digitally fabricated.
 *
 * IMPORTANT: this is a *signal*, not a verdict. It is not a forensic-grade
 * classifier and can both miss real AI output and false-flag genuine photos
 * (e.g. a scan with stripped metadata). Callers must treat the result as
 * something for a staff member to sanity-check, never as proof, and must
 * never surface it to the student who submitted the document — only to
 * staff reviewing the request (enforced in controllers/aiController.js and
 * in app.js's docDialog()).
 *
 * Detection strategy (free, offline, zero npm dependencies):
 *  1. Scan the raw file bytes for text fingerprints that popular AI image
 *     generators/editors embed in metadata (PNG tEXt/iTXt chunks, EXIF
 *     UserComment/Software fields, etc). This is how many "AI image
 *     detector" browser extensions work for untouched Stable Diffusion /
 *     Midjourney / etc. exports, and it is a strong signal when present.
 *  2. For JPEGs, note the absence of a camera EXIF block as a weak
 *     supporting signal (AI output and screenshots both typically lack it —
 *     so on its own this barely moves the score).
 *  3. Optional pluggable upgrade: if ANTHROPIC_API_KEY is set in the
 *     environment, ask a vision-capable Claude model for a second opinion
 *     and blend it in. Without a key, this step is skipped entirely — no
 *     network calls happen and no document ever leaves the server.
 */

const GEN_AI_MARKERS = [
  { needle: 'stable diffusion', label: 'Stable Diffusion metadata' },
  { needle: 'dreamstudio', label: 'DreamStudio metadata' },
  { needle: 'midjourney', label: 'Midjourney metadata' },
  { needle: 'dall-e', label: 'DALL·E metadata' },
  { needle: 'dalle', label: 'DALL·E metadata' },
  { needle: 'nightcafe', label: 'NightCafe metadata' },
  { needle: 'leonardo.ai', label: 'Leonardo.Ai metadata' },
  { needle: 'comfyui', label: 'ComfyUI workflow metadata' },
  { needle: 'automatic1111', label: 'AUTOMATIC1111 / webui metadata' },
  { needle: 'invokeai', label: 'InvokeAI metadata' },
  { needle: 'adobe firefly', label: 'Adobe Firefly metadata' },
  { needle: 'bing image creator', label: 'Bing Image Creator metadata' },
  { needle: 'negative prompt:', label: '"negative prompt" field (typical of diffusion UIs)' },
  { needle: 'parameters:', label: 'Generation "parameters" block (typical of diffusion UIs)' },
  { needle: 'c2pa', label: 'C2PA content-credentials marker present (may indicate AI provenance tagging)' },
];

function bufferFromDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  try {
    return { mime: m[1], buf: Buffer.from(m[2], 'base64') };
  } catch {
    return null;
  }
}

function isJpeg(buf) {
  return buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8;
}

function hasJpegCameraExif(buf) {
  // A real camera/phone JPEG almost always carries an "Exif\0\0" APP1 marker
  // near the start of the file. Its absence is a weak (not conclusive)
  // supporting signal — screenshots and re-saved images lack it too.
  return buf.subarray(0, 65536).includes(Buffer.from('Exif\0\0'));
}

function scanMetadataMarkers(buf) {
  // latin1 keeps the byte offsets 1:1 with the buffer, which is all we need
  // for a case-insensitive substring scan across binary + embedded text.
  const sample = buf.toString('latin1').toLowerCase();
  const hits = [];
  for (const { needle, label } of GEN_AI_MARKERS) {
    if (sample.includes(needle)) hits.push(label);
  }
  return hits;
}

function heuristicScore(buf, mime) {
  const signals = scanMetadataMarkers(buf);
  let suspicion = Math.min(90, signals.length * 35);

  if (isJpeg(buf) && !hasJpegCameraExif(buf)) {
    signals.push('No camera EXIF block found (weak signal — also common in screenshots/scans)');
    suspicion += 8;
  }

  suspicion = Math.max(0, Math.min(100, suspicion));
  const verdict = suspicion >= 60 ? 'LIKELY_AI' : suspicion >= 25 ? 'UNCERTAIN' : 'NO_SIGNAL';
  return { suspicion, verdict, signals, source: 'heuristic' };
}

/** Optional second opinion from a vision-capable Gemini or Claude model. */
async function visionSecondOpinion(mime, buf) {
  if (process.env.GEMINI_API_KEY) {
    const model = (process.env.AI_MODEL && process.env.AI_MODEL.startsWith('gemini'))
      ? process.env.AI_MODEL
      : 'gemini-2.5-flash';
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mime,
                data: buf.toString('base64'),
              },
            },
            {
              text: 'This image was submitted as supporting proof for a college leave request (e.g. an event invite, a travel ticket, a hospital letter, a competition registration). ' +
                'Estimate how likely it is to be AI-generated or digitally fabricated rather than a genuine photo, scan, screenshot or printed document. Be conservative — most real documents should score low. ' +
                'Respond with ONLY compact JSON, no markdown: {"suspicion": 0-100, "reasons": ["short phrase", ...]}',
            },
          ],
        }],
      }),
    });
    if (!resp.ok) throw new Error(`Gemini Vision API responded ${resp.status}`);
    const json = await resp.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return {
      suspicion: Math.max(0, Math.min(100, Number(parsed.suspicion) || 0)),
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 5) : [],
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
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
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } },
            {
              type: 'text',
              text: 'This image was submitted as supporting proof for a college leave request (e.g. an event invite, a travel ticket, a hospital letter, a competition registration). ' +
                'Estimate how likely it is to be AI-generated or digitally fabricated rather than a genuine photo, scan, screenshot or printed document. Be conservative — most real documents should score low. ' +
                'Respond with ONLY compact JSON, no markdown: {"suspicion": 0-100, "reasons": ["short phrase", ...]}',
            },
          ],
        }],
      }),
    });
    if (!resp.ok) throw new Error(`Vision API responded ${resp.status}`);
    const json = await resp.json();
    const text = json?.content?.find(b => b.type === 'text')?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return {
      suspicion: Math.max(0, Math.min(100, Number(parsed.suspicion) || 0)),
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 5) : [],
    };
  }

  return null;
}

function blend(heuristic, aiOpinion) {
  // Weight the higher of the two scores more heavily — a strong signal from
  // either method is worth surfacing, but a single source alone shouldn't
  // dominate the final call.
  const hi = Math.max(heuristic.suspicion, aiOpinion.suspicion);
  const lo = Math.min(heuristic.suspicion, aiOpinion.suspicion);
  const suspicion = Math.round(hi * 0.65 + lo * 0.35);
  const signals = [...heuristic.signals, ...aiOpinion.reasons.map(r => `AI second opinion: ${r}`)];
  const verdict = suspicion >= 60 ? 'LIKELY_AI' : suspicion >= 25 ? 'UNCERTAIN' : 'NO_SIGNAL';
  return { suspicion, verdict, signals, source: 'heuristic+vision-api' };
}

/**
 * @param {{id:string,name:string,type:string,data?:string}} doc - data is a base64 data: URL, when available.
 */
async function analyzeDocument(doc) {
  if (!doc) return { checked: false, reason: 'Missing document' };
  if (!doc.data) return { id: doc.id, name: doc.name, checked: false, reason: 'File bytes not available yet (upload may still be syncing)' };
  if (!/^image\//.test(doc.type || '')) {
    return { id: doc.id, name: doc.name, checked: false, reason: 'Not an image — this check only looks at images, not PDFs' };
  }

  const parsed = bufferFromDataUrl(doc.data);
  if (!parsed) return { id: doc.id, name: doc.name, checked: false, reason: 'Could not read file data' };

  let result = heuristicScore(parsed.buf, parsed.mime);

  if (process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY) {
    try {
      const opinion = await visionSecondOpinion(parsed.mime, parsed.buf);
      if (opinion) result = blend(result, opinion);
    } catch (err) {
      result.apiError = err.message;
    }
  }

  return { id: doc.id, name: doc.name, checked: true, ...result };
}

module.exports = { analyzeDocument };
