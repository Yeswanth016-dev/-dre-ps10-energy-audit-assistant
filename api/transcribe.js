const SARVAM_URL = 'https://api.sarvam.ai/speech-to-text';

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ source: 'sarvam', ...obj }));
}

async function getBody(req) {
  // Vercel may already provide a parsed body
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  let raw = '';

  for await (const chunk of req) {
    raw += Buffer.isBuffer(chunk)
      ? chunk.toString('utf8')
      : String(chunk);
  }

  if (!raw.trim()) {
    throw new Error('EMPTY_BODY');
  }

  return JSON.parse(raw);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return send(res, 405, {
      success: false,
      error: 'Use POST.',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  const key = process.env.SARVAM_API_KEY;

  if (!key) {
    return send(res, 500, {
      success: false,
      error: 'Server is missing SARVAM_API_KEY.',
      code: 'SARVAM_KEY_MISSING'
    });
  }

  let body;

  try {
    body = await getBody(req);
  } catch (e) {
    console.error('[URJA] Body parsing failed:', e);

    return send(res, 400, {
      success: false,
      error: 'Invalid JSON audio request.',
      code: 'BAD_JSON'
    });
  }

  if (!body || typeof body.audio !== 'string' || !body.audio.length) {
    return send(res, 400, {
      success: false,
      error: 'No audio received.',
      code: 'NO_AUDIO'
    });
  }

  const language =
    ['te-IN', 'en-IN'].includes(body.language)
      ? body.language
      : 'te-IN';

  const mimeType =
    typeof body.mimeType === 'string' && body.mimeType
      ? body.mimeType.split(';')[0]
      : 'audio/wav';

  const fileName =
    typeof body.fileName === 'string' && body.fileName
      ? body.fileName
      : 'urja-audit.wav';

  let audio;

  try {
    audio = Buffer.from(body.audio, 'base64');
  } catch (e) {
    return send(res, 400, {
      success: false,
      error: 'Invalid audio encoding.',
      code: 'BAD_AUDIO'
    });
  }

  if (!audio.length) {
    return send(res, 400, {
      success: false,
      error: 'Audio is empty.',
      code: 'NO_AUDIO'
    });
  }

  console.log(
    '[URJA] Received audio bytes:',
    audio.length,
    'type:',
    mimeType,
    'language:',
    language
  );

  const form = new FormData();

  form.append(
    'file',
    new Blob([audio], { type: mimeType }),
    fileName
  );

  form.append(
    'model',
    process.env.SARVAM_STT_MODEL || 'saarika:v2.5'
  );

  form.append('language_code', language);

  let response;

  try {
    response = await fetch(SARVAM_URL, {
      method: 'POST',
      headers: {
        'api-subscription-key': key
      },
      body: form
    });
  } catch (e) {
    console.error('[URJA] Sarvam network error:', e);

    return send(res, 502, {
      success: false,
      error: 'Could not reach Sarvam.',
      code: 'SARVAM_NETWORK_ERROR'
    });
  }

  let data = null;

  try {
    data = await response.json();
  } catch (_) {}

  console.log(
    '[URJA] Sarvam response status:',
    response.status
  );

  if (!response.ok) {
    console.error('[URJA] Sarvam error:', data);

    if (response.status === 401 || response.status === 403) {
      return send(res, 502, {
        success: false,
        error: 'Sarvam authentication failed. Check your API key.',
        code: 'SARVAM_AUTH_ERROR'
      });
    }

    if (response.status === 429) {
      return send(res, 429, {
        success: false,
        error: 'Sarvam rate limit reached.',
        code: 'SARVAM_RATE_LIMIT'
      });
    }

    return send(res, 400, {
      success: false,
      error: 'Sarvam could not process this audio.',
      code: 'SARVAM_BAD_AUDIO'
    });
  }

  const text = String(
    data && data.transcript ? data.transcript : ''
  ).trim();

  console.log('[URJA] Transcript length:', text.length);

  return send(res, 200, {
    success: true,
    text,
    language
  });
};

module.exports.config = {
  api: {
    bodyParser: false
  }
};
