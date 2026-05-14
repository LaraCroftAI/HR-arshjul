// Vercel serverless function — proxy för wheels-CRUD.
// Lara's webbläsarmiljö blockerar tyst direkta anrop till Supabase REST,
// men Vercel når servern utan problem. Browsern → Vercel → Supabase.
//
// Vidarebefordrar användarens JWT så att RLS i databasen gör behörighets-
// kontrollen — användaren kan bara läsa/skriva sina egna hjul.

const SUPABASE_URL = 'https://afcagjgztvmdpeljrjru.supabase.co';
const SUPABASE_KEY = 'sb_publishable__QjXJj6z2J2FaCyWvRVSWg_pbiIbHiI';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const auth = req.headers.authorization || req.headers.Authorization;
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    res.status(401).json({ error: 'Saknad auth-token' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  } else if (!body) {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString('utf8');
      body = raw ? JSON.parse(raw) : {};
    } catch { body = {}; }
  }

  const action = (body && body.action) || '';

  try {
    if (action === 'list') {
      // RLS-policy filtrerar automatiskt till användarens egna hjul
      const sbRes = await fetch(
        SUPABASE_URL + '/rest/v1/wheels?select=id,data,updated_at&order=created_at.asc',
        { headers: { apikey: SUPABASE_KEY, Authorization: auth } }
      );
      const text = await sbRes.text();
      res.status(sbRes.status);
      res.setHeader('Content-Type', 'application/json');
      res.end(text || '[]');
      return;
    }

    if (action === 'save') {
      if (!body.id || !body.user_id || !body.data) {
        res.status(400).json({ error: 'id, user_id eller data saknas' });
        return;
      }
      const sbRes = await fetch(
        SUPABASE_URL + '/rest/v1/wheels?on_conflict=id',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: auth,
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({ id: body.id, user_id: body.user_id, data: body.data }),
        }
      );
      const text = await sbRes.text();
      res.status(sbRes.status);
      res.setHeader('Content-Type', 'application/json');
      res.end(text || 'null');
      return;
    }

    if (action === 'delete') {
      if (!body.id) { res.status(400).json({ error: 'id saknas' }); return; }
      const sbRes = await fetch(
        SUPABASE_URL + '/rest/v1/wheels?id=eq.' + encodeURIComponent(body.id),
        { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: auth } }
      );
      const text = await sbRes.text();
      res.status(sbRes.status);
      res.setHeader('Content-Type', 'application/json');
      res.end(text || 'null');
      return;
    }

    res.status(400).json({ error: 'Okänd action' });
  } catch (err) {
    res.status(502).json({ error: 'Fel vid anrop till Supabase: ' + (err.message || String(err)) });
  }
};
