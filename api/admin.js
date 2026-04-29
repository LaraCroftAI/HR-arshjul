// Vercel serverless function — proxy för admin-operationer.
// Lara's webbläsarmiljö blockerar tyst direkta anrop till Supabase REST/RPC,
// men Vercel når servern utan problem. Browsern → Vercel → Supabase.
//
// Vidarebefordrar användarens JWT så att RLS / SECURITY DEFINER-funktionerna
// fortfarande gör admin-kontrollen i databasen.

const SUPABASE_URL = 'https://afcagjgztvmdpeljrjru.supabase.co';
const SUPABASE_KEY = 'sb_publishable__QjXJj6z2J2FaCyWvRVSWg_pbiIbHiI';

module.exports = async (req, res) => {
  // Bara POST tillåts (även list — vi skickar action i body)
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const auth = req.headers.authorization || req.headers.Authorization;
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    res.status(401).json({ error: 'Saknad auth-token' });
    return;
  }

  // Vercel parsar inte body automatiskt för raw functions — vi gör det själva.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  } else if (!body) {
    // läs som stream om Vercel inte parsade
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString('utf8');
      body = raw ? JSON.parse(raw) : {};
    } catch { body = {}; }
  }

  const action = (body && body.action) || '';
  let target, payload;

  if (action === 'list') {
    target = '/rest/v1/rpc/admin_list_emails';
    payload = '{}';
  } else if (action === 'add') {
    if (!body.email) { res.status(400).json({ error: 'Mejladress saknas' }); return; }
    target = '/rest/v1/rpc/admin_add_email';
    payload = JSON.stringify({ p_email: body.email, p_notes: body.notes || null });
  } else if (action === 'remove') {
    if (!body.email) { res.status(400).json({ error: 'Mejladress saknas' }); return; }
    target = '/rest/v1/rpc/admin_remove_email';
    payload = JSON.stringify({ p_email: body.email });
  } else {
    res.status(400).json({ error: 'Okänd action' });
    return;
  }

  try {
    const sbRes = await fetch(SUPABASE_URL + target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: auth,
      },
      body: payload,
    });
    const text = await sbRes.text();
    res.status(sbRes.status);
    res.setHeader('Content-Type', 'application/json');
    res.end(text || 'null');
  } catch (err) {
    res.status(502).json({ error: 'Fel vid anrop till Supabase: ' + (err.message || String(err)) });
  }
};
