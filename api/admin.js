// Vercel serverless function — proxy för de RPC-anrop appen behöver.
// Lara's webbläsarmiljö blockerar tyst direkta anrop till Supabase REST/RPC,
// men Vercel når servern utan problem. Browsern → Vercel → Supabase.
//
// Vidarebefordrar användarens JWT så att RLS / SECURITY DEFINER-funktionerna
// fortfarande gör sina kontroller i databasen. Heter fortfarande admin.js av
// historiska skäl; hanterar numera även gallringstiden (retention_*), som är
// användarens egna anrop och inte kräver admin.

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

  // Inbjudningsmejl är inte en ren proxy — det gör en egen behörighetskoll och
  // pratar med mejlleverantören i stället för med Supabase.
  if (action === 'invite') {
    await handleInvite(res, body, auth);
    return;
  }

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
  } else if (action === 'retention_status') {
    target = '/rest/v1/rpc/retention_status';
    payload = '{}';
  } else if (action === 'retention_renew') {
    target = '/rest/v1/rpc/retention_renew';
    payload = '{}';
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

// ---------------------------------------------------------------------------
// Inbjudningsmejl
// ---------------------------------------------------------------------------

const SITE_URL = 'https://hr-arshjul.vercel.app';

// Skickar inbjudan till en adress som redan ligger på allowlistan.
//
// Två spärrar, båda nödvändiga:
//   1. Anroparen måste vara admin. Vi återanvänder admin_list_emails i stället
//      för att bygga en ny kontroll — den skyddas redan av RLS i databasen.
//   2. Mottagaren måste finnas på listan. Utan den kontrollen vore endpointen
//      en öppen mejlrelä för vem som helst som är admin.
async function handleInvite(res, body, auth) {
  const email = String(body.email || '').trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: 'Mejladress saknas' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM;
  if (!apiKey || !from) {
    res.status(503).json({
      error: 'Mejlutskick är inte konfigurerat. Sätt miljövariablerna '
           + 'RESEND_API_KEY och INVITE_FROM i Vercel och deploya om.',
    });
    return;
  }

  // Spärr 1 och 2 i ett anrop: listan går bara att hämta som admin.
  let allowed;
  try {
    const sbRes = await fetch(SUPABASE_URL + '/rest/v1/rpc/admin_list_emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: auth,
      },
      body: '{}',
    });
    if (!sbRes.ok) {
      res.status(sbRes.status === 401 ? 401 : 403)
         .json({ error: 'Bara administratörer kan skicka inbjudningar.' });
      return;
    }
    allowed = await sbRes.json();
  } catch (err) {
    res.status(502).json({ error: 'Kunde inte kontrollera behörigheten: ' + (err.message || String(err)) });
    return;
  }

  const onList = Array.isArray(allowed)
    && allowed.some(r => String(r.email || '').toLowerCase() === email);
  if (!onList) {
    res.status(400).json({
      error: 'Adressen ligger inte på listan. Lägg till den först — '
           + 'inbjudan går bara att skicka till någon som redan har behörighet.',
    });
    return;
  }

  try {
    const id = await sendInviteEmail({ to: email, from, apiKey,
                                       replyTo: process.env.INVITE_REPLY_TO || null });
    res.status(200).json({ sent: true, id });
  } catch (err) {
    res.status(502).json({ error: 'Mejlet gick inte iväg: ' + (err.message || String(err)) });
  }
}

// Enda stället som känner till mejlleverantören. Byter du från Resend är det
// bara den här funktionen som behöver skrivas om — Resend valdes för att den
// har ett rent HTTP-API, så projektet slipper både package.json och byggsteg.
async function sendInviteEmail({ to, from, apiKey, replyTo }) {
  const payload = {
    from,
    to: [to],
    subject: 'Tillgång till HR Årshjul',
    text: inviteText(to),
    html: inviteHtml(to),
  };
  if (replyTo) payload.reply_to = replyTo;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok) {
    throw new Error((data && (data.message || data.error)) || ('HTTP ' + r.status));
  }
  return data && data.id;
}

function inviteText(email) {
  return [
    'Hej!',
    '',
    'Du har fått tillgång till HR Årshjul — ett verktyg för att bygga och',
    'exportera visuella HR-årshjul.',
    '',
    'Så kommer du igång:',
    '',
    '1. Gå till ' + SITE_URL,
    '2. Klicka på "Skapa konto"',
    '3. Använd den här e-postadressen: ' + email,
    '4. Välj ett lösenord (minst 6 tecken)',
    '',
    'Din adress ligger redan inlagd, så du kommer in direkt — det kommer',
    'inget bekräftelsemejl att vänta på. Nästa gång loggar du in med samma',
    'e-post och lösenord.',
    '',
    'Hjulen går att exportera till PowerPoint, PDF och bild.',
    '',
    'Hör av dig om något krånglar.',
  ].join('\n');
}

function inviteHtml(email) {
  const safe = String(email).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return `<!doctype html>
<html lang="sv"><body style="margin:0;padding:24px;background:#FAF8F4;
  font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#1A2332;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E8E3DA;
       border-radius:10px;padding:28px;">
    <h1 style="margin:0 0 4px;font-size:20px;font-weight:500;">HR Årshjul</h1>
    <p style="margin:0 0 20px;color:#5C6577;font-size:14px;">
      Du har fått tillgång till verktyget.</p>

    <ol style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.7;">
      <li>Gå till <a href="${SITE_URL}" style="color:#1A2332;">${SITE_URL}</a></li>
      <li>Klicka på <strong>Skapa konto</strong></li>
      <li>Använd adressen <strong>${safe}</strong></li>
      <li>Välj ett lösenord (minst 6 tecken)</li>
    </ol>

    <p style="margin:0 0 20px;">
      <a href="${SITE_URL}" style="display:inline-block;background:#1A2332;color:#fff;
         text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px;">
        Öppna HR Årshjul</a></p>

    <p style="margin:0 0 16px;font-size:13px;color:#5C6577;line-height:1.6;">
      Din adress ligger redan inlagd, så du kommer in direkt — det kommer inget
      bekräftelsemejl att vänta på. Nästa gång loggar du in med samma e-post
      och lösenord.</p>

    <p style="margin:0;font-size:13px;color:#8C95A6;line-height:1.6;">
      Hjulen går att exportera till PowerPoint, PDF och bild.
      Hör av dig om något krånglar.</p>
  </div>
</body></html>`;
}
