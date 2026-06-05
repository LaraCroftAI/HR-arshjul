// Vercel serverless function — keep-alive ping.
//
// Supabase pausar gratisprojekt efter ca 7 dagars inaktivitet, och då slutar
// inloggning fungera för alla (det var precis vad som hände 2026-06-05).
// En schemalagd cron i vercel.json anropar den här funktionen dagligen och gör
// ett lätt databasanrop. Anropet räknas som aktivitet och håller projektet vaket.
//
// Körs på Vercels servrar — inte i webbläsaren — så det påverkas inte av
// nätverk som blockerar direkta supabase.co-anrop.

const SUPABASE_URL = 'https://afcagjgztvmdpeljrjru.supabase.co';
const SUPABASE_KEY = 'sb_publishable__QjXJj6z2J2FaCyWvRVSWg_pbiIbHiI';

module.exports = async (req, res) => {
  try {
    // Lätt läsning. RLS gör att anon inte ser några rader — vi bryr oss bara
    // om att anropet når databasen, inte om svaret.
    const sbRes = await fetch(SUPABASE_URL + '/rest/v1/wheels?select=id&limit=1', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
    });
    res.status(200).json({
      ok: sbRes.ok,
      status: sbRes.status,
      at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message || String(err) });
  }
};
