// ====================================================================
// HR Årshjul — interactive year wheel builder
// ====================================================================

// Supabase project (anon publishable key — safe to ship, RLS enforces privacy)
const SUPABASE_URL = 'https://afcagjgztvmdpeljrjru.supabase.co';
const SUPABASE_KEY = 'sb_publishable__QjXJj6z2J2FaCyWvRVSWg_pbiIbHiI';
let sb = null;
let currentUser = null;

const STORAGE_KEY = 'hr-arshjul-v1';

const RING_PALETTE = [
  '#5B6B7A', // slate
  '#87A096', // sage
  '#B8624A', // terracotta
  '#C8A04A', // ockra
  '#6B8AA6', // dimblå
  '#7A5266', // plommon
  '#8B8B5C', // oliv
  '#A89F8E', // sten
];

// Agenda layout uses one unique color per activity. The palette below extends
// the muted earthy tone of the ring palette so 17–20 activities still look
// cohesive. Cycles for activity counts beyond the palette length.
const ACTIVITY_PALETTE = [
  '#5B6B7A', '#87A096', '#B8624A', '#C8A04A', '#6B8AA6',
  '#7A5266', '#8B8B5C', '#A89F8E', '#A05D6E', '#5E8B7E',
  '#C4865A', '#8A7AB8', '#8B5A3C', '#6B9080', '#D4A574',
  '#9CADCE', '#7C9885', '#B5838D', '#9C7A5C', '#6E8B6E',
];

function activityPaletteColor(idx) {
  return ACTIVITY_PALETTE[idx % ACTIVITY_PALETTE.length];
}

function getLayout() {
  return state && state.layout === 'agenda' ? 'agenda' : 'wheel';
}

// ---------- i18n ----------
const I18N = {
  sv: {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'],
    'auth.signin.title': 'Logga in',
    'auth.signin.sub': 'Logga in med din e-post och ditt lösenord.',
    'auth.signin.submit': 'Logga in',
    'auth.signin.signing': 'Loggar in...',
    'auth.signin.toggleText': 'Inget konto än?',
    'auth.signin.toggleLink': 'Skapa konto',
    'auth.signup.title': 'Skapa konto',
    'auth.signup.sub': 'Välj ett lösenord (minst 6 tecken). Du behåller samma e-post och lösenord för att logga in nästa gång.',
    'auth.signup.submit': 'Skapa konto',
    'auth.signup.signingUp': 'Skapar konto...',
    'auth.signup.toggleText': 'Har du redan ett konto?',
    'auth.signup.toggleLink': 'Logga in',
    'auth.signup.confirmEmail': 'Konto skapat. Vi har skickat ett bekräftelsemejl till {email} — klicka på länken där och kom sedan tillbaka och logga in.',
    'auth.reset.title': 'Glömt lösenord',
    'auth.reset.sub': 'Skriv in din e-postadress så skickar vi en länk för att välja ett nytt lösenord.',
    'auth.reset.submit': 'Skicka återställningslänk',
    'auth.reset.sending': 'Skickar...',
    'auth.reset.sent': 'Vi har skickat en återställningslänk till {email}. Klicka på länken i mejlet för att välja ett nytt lösenord. Om du inte ser mejlet, kolla skräpposten.',
    'auth.newpw.title': 'Välj nytt lösenord',
    'auth.newpw.sub': 'Skriv in det nya lösenordet (minst 6 tecken). Du loggas in automatiskt när det är sparat.',
    'auth.newpw.submit': 'Spara nytt lösenord',
    'auth.newpw.saving': 'Sparar...',
    'auth.newpw.updated': 'Lösenordet är uppdaterat. Logga in med det nya lösenordet.',
    'auth.forgotLink': 'Glömt lösenord?',
    'auth.backLink': '← Tillbaka till inloggning',
    'auth.emailPh': 'namn@exempel.se',
    'auth.passwordPh': 'Lösenord (minst 6 tecken)',
    'auth.passwordPhNew': 'Nytt lösenord (minst 6 tecken)',
    'auth.unavailable': 'Inloggningstjänsten kunde inte laddas. Kontrollera nätet och ladda om sidan.',
    'auth.sessionFailed': 'Inloggning gick igenom men sessionen kunde inte startas. Ladda om sidan och försök igen.',
    'auth.err.notInvited': 'Den här e-postadressen har inte tillgång till verktyget. Be administratören att lägga till dig.',
    'auth.err.invalidCreds': 'Fel e-post eller lösenord.',
    'auth.err.notConfirmed': 'Du måste bekräfta din e-post först. Kolla inkorgen (och skräpposten).',
    'auth.err.alreadyExists': 'Det här kontot finns redan. Tryck på "Logga in" istället.',
    'auth.err.tooShort': 'Lösenordet är för kort — minst 6 tecken.',
    'auth.err.rateLimit': 'För många försök. Vänta en stund och försök igen.',
    'auth.err.weakPwd': 'Lösenordet är för svagt — välj ett längre eller mer komplext.',
    'auth.err.generic': 'Något gick fel. Försök igen.',
    'topbar.client': 'Kund',
    'topbar.year': 'År',
    'topbar.clientPh': 't.ex. Acme AB',
    'topbar.newWheel': 'Nytt hjul',
    'topbar.uploadImage': 'Ladda upp bild',
    'topbar.export': 'Ladda ner ▾',
    'topbar.exportPng': 'Som bild (PNG)',
    'topbar.exportPdf': 'Som PDF',
    'topbar.exportPpt': 'Som PowerPoint',
    'topbar.adminLink': 'Hantera användare',
    'topbar.logout': 'Logga ut',
    'panel.rings.title': 'Ringar',
    'panel.rings.add': '+ Lägg till ring',
    'panel.rings.hint': 'Varje ring är en kategori — t.ex. Arbetsmiljö, Utveckling, Lön & förmåner.',
    'panel.rings.empty': 'Inga ringar än. Klicka "+ Lägg till ring" för att börja.',
    'panel.rings.namePh': 'Ringens namn',
    'panel.rings.dragHandle': 'Dra för att ändra ordning',
    'panel.rings.colorAria': 'Välj färg',
    'panel.rings.removeTitle': 'Ta bort',
    'panel.activities.title': 'Aktiviteter',
    'panel.activities.import': 'Importera',
    'panel.activities.add': '+ Lägg till',
    'panel.activities.hintBefore': 'Välj ring, startvecka (1–52) och hur många veckor aktiviteten pågår. Vill du importera en lista? ',
    'panel.activities.hintLink': 'Hämta mallen',
    'panel.activities.hintAfter': '.',
    'panel.activities.empty': 'Inga aktiviteter än. Klicka "+ Lägg till aktivitet".',
    'panel.activities.emptyNoRing': 'Lägg till en ring först — aktiviteter tillhör en ring.',
    'panel.activities.namePh': 'Aktivitetens namn',
    'panel.activities.ring': 'Ring',
    'panel.activities.startWeek': 'Startvecka',
    'panel.activities.length': 'Längd v.',
    'brand.name': 'HR Årshjul',
    'wheel.aria': 'HR årshjul',
    'wheel.centerFallback': 'Årshjul',
    'wheel.emptyHint': 'Lägg till en ring för att börja',
    'agenda.emptyHint': 'Lägg till en aktivitet för att börja',
    'confirm.newWheel': 'Börja om med ett tomt årshjul? Nuvarande hjul försvinner.',
    'confirm.removeRing': 'Ta bort ringen och alla aktiviteter i den?',
    'confirm.removeEmail': 'Ta bort {email} från listan? Personen kan inte längre skapa nytt konto, men befintliga konton påverkas inte.',
    'toast.imageDownloaded': 'Bilden är nedladdad',
    'toast.imageFailed': 'Kunde inte spara bilden',
    'toast.pdfDownloaded': 'PDF nedladdad',
    'toast.pdfFailed': 'Kunde inte skapa PDF',
    'toast.pptDownloaded': 'PowerPoint nedladdad',
    'toast.pptFailed': 'Kunde inte skapa PowerPoint',
    'toast.pdfLoading': 'PDF-biblioteket laddar fortfarande — försök igen om en stund',
    'toast.pptLoading': 'PowerPoint-biblioteket laddar fortfarande — försök igen om en stund',
    'toast.importLoading': 'Importbiblioteket laddar — försök igen om en stund',
    'toast.templateLoading': 'Mall-biblioteket laddar — försök igen om en stund',
    'toast.fileEmpty': 'Filen verkar tom',
    'toast.noRows': 'Hittade inga rader att importera',
    'toast.missingColumns': 'Filen saknar kolumn för Aktivitet eller Startvecka',
    'toast.noValidRows': 'Inga giltiga rader hittades — kontrollera mallen',
    'toast.importedActs': '{n} aktiviteter importerade',
    'toast.importedRings': '{n} nya ringar',
    'toast.importedSkipped': '{n} hoppades över',
    'toast.fileError': 'Kunde inte läsa filen — är det en xlsx eller csv?',
    'toast.templateDownloaded': 'Mall nedladdad',
    'toast.invalidPng': 'Filen är inte en giltig PNG-bild',
    'toast.noProjectData': 'Bilden saknar projektdata — välj en bild som laddats ner från appen',
    'toast.corruptData': 'Projektdatan i bilden är skadad',
    'toast.fileLoadError': 'Kunde inte läsa filen',
    'toast.wheelLoaded': 'Hjulet är inläst — du kan fortsätta redigera',
    'toast.wheelLoadFailed': 'Hjulet kunde inte laddas — försök ladda om sidan',
    'activity.weekShort': 'v.',
    'default.ring.workEnv': 'Arbetsmiljö',
    'default.ring.development': 'Utveckling',
    'default.ring.compensation': 'Lön & förmåner',
    'default.activity.review': 'Utvecklingssamtal',
    'default.activity.salaryReview': 'Lönerevision',
    'default.activity.workplaceInsp': 'Arbetsmiljörond',
    'default.activity.summerParty': 'Sommarfest',
    'default.activity.succession': 'Successionsplan',
    'default.ring.new': 'Ny ring',
    'default.activity.new': 'Ny aktivitet',
    'default.ring.general': 'Allmänt',
    'template.headerActivity': 'Aktivitet',
    'template.headerRing': 'Ring',
    'template.headerStartWeek': 'Startvecka',
    'template.headerLength': 'Längd (veckor)',
    'template.sheetName': 'Aktiviteter',
    'template.fileName': 'arshjul-mall.xlsx',
    'admin.title': 'Hantera användare',
    'admin.sub': 'Bara mejladresser i den här listan kan skapa konto. Lägg till en ny adress, säg till personen själv, så kan de gå till sidan och välja sitt eget lösenord.',
    'admin.closeAria': 'Stäng',
    'admin.notesPh': 'Anteckning (valfritt)',
    'admin.add': 'Lägg till',
    'admin.adding': 'Lägger till…',
    'admin.diag': 'Kör diagnostik',
    'admin.loading': 'Hämtar listan…',
    'admin.empty': 'Listan är tom — lägg till en mejladress för att börja bjuda in.',
    'admin.you': '(du)',
    'admin.cannotRemoveSelf': 'Du kan inte ta bort dig själv',
    'admin.added': '{email} har lagts till. Säg till personen att de kan gå till sidan och skapa konto.',
    'admin.duplicate': 'Den här mejladressen finns redan på listan.',
    'admin.loadFailed': 'Kunde inte hämta listan: {err}',
    'lang.toggleAria': 'Välj språk',
    'layout.toggleAria': 'Välj vy',
    'layout.wheel': 'Klassisk',
    'layout.agenda': 'Agenda',
  },
  en: {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    'auth.signin.title': 'Sign in',
    'auth.signin.sub': 'Sign in with your email and password.',
    'auth.signin.submit': 'Sign in',
    'auth.signin.signing': 'Signing in...',
    'auth.signin.toggleText': 'No account yet?',
    'auth.signin.toggleLink': 'Create account',
    'auth.signup.title': 'Create account',
    'auth.signup.sub': 'Choose a password (at least 6 characters). Use the same email and password to sign in next time.',
    'auth.signup.submit': 'Create account',
    'auth.signup.signingUp': 'Creating account...',
    'auth.signup.toggleText': 'Already have an account?',
    'auth.signup.toggleLink': 'Sign in',
    'auth.signup.confirmEmail': 'Account created. We sent a confirmation email to {email} — click the link there, then come back and sign in.',
    'auth.reset.title': 'Forgot password',
    'auth.reset.sub': 'Enter your email address and we\'ll send a link to choose a new password.',
    'auth.reset.submit': 'Send reset link',
    'auth.reset.sending': 'Sending...',
    'auth.reset.sent': 'We sent a reset link to {email}. Click the link in the email to choose a new password. If you don\'t see the email, check your spam folder.',
    'auth.newpw.title': 'Choose new password',
    'auth.newpw.sub': 'Enter the new password (at least 6 characters). You\'ll be signed in automatically when it\'s saved.',
    'auth.newpw.submit': 'Save new password',
    'auth.newpw.saving': 'Saving...',
    'auth.newpw.updated': 'Password updated. Sign in with the new password.',
    'auth.forgotLink': 'Forgot password?',
    'auth.backLink': '← Back to sign in',
    'auth.emailPh': 'name@example.com',
    'auth.passwordPh': 'Password (at least 6 characters)',
    'auth.passwordPhNew': 'New password (at least 6 characters)',
    'auth.unavailable': 'Sign-in service couldn\'t load. Check your connection and reload the page.',
    'auth.sessionFailed': 'Sign in succeeded but session couldn\'t start. Reload the page and try again.',
    'auth.err.notInvited': 'This email doesn\'t have access to the tool. Ask the administrator to add you.',
    'auth.err.invalidCreds': 'Wrong email or password.',
    'auth.err.notConfirmed': 'You need to confirm your email first. Check your inbox (and spam folder).',
    'auth.err.alreadyExists': 'This account already exists. Click "Sign in" instead.',
    'auth.err.tooShort': 'Password is too short — at least 6 characters.',
    'auth.err.rateLimit': 'Too many attempts. Wait a moment and try again.',
    'auth.err.weakPwd': 'Password is too weak — choose a longer or more complex one.',
    'auth.err.generic': 'Something went wrong. Try again.',
    'topbar.client': 'Client',
    'topbar.year': 'Year',
    'topbar.clientPh': 'e.g. Acme Inc.',
    'topbar.newWheel': 'New wheel',
    'topbar.uploadImage': 'Upload image',
    'topbar.export': 'Download ▾',
    'topbar.exportPng': 'As image (PNG)',
    'topbar.exportPdf': 'As PDF',
    'topbar.exportPpt': 'As PowerPoint',
    'topbar.adminLink': 'Manage users',
    'topbar.logout': 'Sign out',
    'panel.rings.title': 'Rings',
    'panel.rings.add': '+ Add ring',
    'panel.rings.hint': 'Each ring is a category — e.g. Work environment, Development, Compensation & benefits.',
    'panel.rings.empty': 'No rings yet. Click "+ Add ring" to start.',
    'panel.rings.namePh': 'Ring name',
    'panel.rings.dragHandle': 'Drag to reorder',
    'panel.rings.colorAria': 'Choose color',
    'panel.rings.removeTitle': 'Remove',
    'panel.activities.title': 'Activities',
    'panel.activities.import': 'Import',
    'panel.activities.add': '+ Add',
    'panel.activities.hintBefore': 'Choose a ring, start week (1–52) and how many weeks the activity runs. Want to import a list? ',
    'panel.activities.hintLink': 'Download the template',
    'panel.activities.hintAfter': '.',
    'panel.activities.empty': 'No activities yet. Click "+ Add activity".',
    'panel.activities.emptyNoRing': 'Add a ring first — activities belong to a ring.',
    'panel.activities.namePh': 'Activity name',
    'panel.activities.ring': 'Ring',
    'panel.activities.startWeek': 'Start week',
    'panel.activities.length': 'Length w.',
    'brand.name': 'HR Annual Agenda',
    'wheel.aria': 'HR year wheel',
    'wheel.centerFallback': 'Year wheel',
    'wheel.emptyHint': 'Add a ring to begin',
    'agenda.emptyHint': 'Add an activity to begin',
    'confirm.newWheel': 'Start over with a blank year wheel? The current wheel will be lost.',
    'confirm.removeRing': 'Remove the ring and all its activities?',
    'confirm.removeEmail': 'Remove {email} from the list? They can no longer create a new account, but existing accounts are unaffected.',
    'toast.imageDownloaded': 'Image downloaded',
    'toast.imageFailed': 'Couldn\'t save image',
    'toast.pdfDownloaded': 'PDF downloaded',
    'toast.pdfFailed': 'Couldn\'t create PDF',
    'toast.pptDownloaded': 'PowerPoint downloaded',
    'toast.pptFailed': 'Couldn\'t create PowerPoint',
    'toast.pdfLoading': 'PDF library still loading — try again in a moment',
    'toast.pptLoading': 'PowerPoint library still loading — try again in a moment',
    'toast.importLoading': 'Import library loading — try again in a moment',
    'toast.templateLoading': 'Template library loading — try again in a moment',
    'toast.fileEmpty': 'File appears to be empty',
    'toast.noRows': 'No rows found to import',
    'toast.missingColumns': 'File is missing column for Activity or Start week',
    'toast.noValidRows': 'No valid rows found — check the template',
    'toast.importedActs': '{n} activities imported',
    'toast.importedRings': '{n} new rings',
    'toast.importedSkipped': '{n} skipped',
    'toast.fileError': 'Couldn\'t read file — is it xlsx or csv?',
    'toast.templateDownloaded': 'Template downloaded',
    'toast.invalidPng': 'File is not a valid PNG image',
    'toast.noProjectData': 'Image has no project data — choose an image downloaded from the app',
    'toast.corruptData': 'Project data in the image is corrupt',
    'toast.fileLoadError': 'Couldn\'t read file',
    'toast.wheelLoaded': 'Wheel loaded — you can continue editing',
    'toast.wheelLoadFailed': 'Couldn\'t load wheel — try reloading the page',
    'activity.weekShort': 'w.',
    'default.ring.workEnv': 'Work environment',
    'default.ring.development': 'Development',
    'default.ring.compensation': 'Compensation & benefits',
    'default.activity.review': 'Performance review',
    'default.activity.salaryReview': 'Salary review',
    'default.activity.workplaceInsp': 'Workplace inspection',
    'default.activity.summerParty': 'Summer party',
    'default.activity.succession': 'Succession planning',
    'default.ring.new': 'New ring',
    'default.activity.new': 'New activity',
    'default.ring.general': 'General',
    'template.headerActivity': 'Activity',
    'template.headerRing': 'Ring',
    'template.headerStartWeek': 'Start week',
    'template.headerLength': 'Length (weeks)',
    'template.sheetName': 'Activities',
    'template.fileName': 'year-wheel-template.xlsx',
    'admin.title': 'Manage users',
    'admin.sub': 'Only email addresses on this list can create an account. Add a new address, tell the person, and they can go to the site and choose their own password.',
    'admin.closeAria': 'Close',
    'admin.notesPh': 'Note (optional)',
    'admin.add': 'Add',
    'admin.adding': 'Adding…',
    'admin.diag': 'Run diagnostics',
    'admin.loading': 'Loading list…',
    'admin.empty': 'List is empty — add an email to start inviting.',
    'admin.you': '(you)',
    'admin.cannotRemoveSelf': 'You can\'t remove yourself',
    'admin.added': '{email} has been added. Tell the person they can go to the site and create an account.',
    'admin.duplicate': 'This email is already on the list.',
    'admin.loadFailed': 'Couldn\'t load list: {err}',
    'lang.toggleAria': 'Choose language',
    'layout.toggleAria': 'Choose view',
    'layout.wheel': 'Classic',
    'layout.agenda': 'Agenda',
  },
};

let currentLang = (function() {
  try { return localStorage.getItem('hrArshjulLang') === 'en' ? 'en' : 'sv'; } catch { return 'sv'; }
})();

function t(key, vars) {
  const dict = I18N[currentLang] || I18N.sv;
  let s = dict[key];
  if (s == null) s = (I18N.sv && I18N.sv[key]);
  if (s == null) return key;
  if (vars) {
    for (const k in vars) s = String(s).split('{' + k + '}').join(vars[k]);
  }
  return s;
}

function monthName(idx) {
  const m = (I18N[currentLang] || I18N.sv).months;
  return m[idx];
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
  document.documentElement.lang = currentLang;
  document.title = t('brand.name');
}

function setLanguage(lang) {
  if (lang !== 'sv' && lang !== 'en') return;
  currentLang = lang;
  try { localStorage.setItem('hrArshjulLang', lang); } catch {}
  applyI18n();
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
  if (typeof renderAll === 'function') renderAll();
  if (typeof setAuthMode === 'function') setAuthMode(authMode);
  if (typeof refreshLayoutToggle === 'function') refreshLayoutToggle();
}

// ---------- State ----------
// Start with defaults; real wheel is fetched from Supabase after login.
let state = defaultState();

function defaultState() {
  return {
    client: '',
    year: new Date().getFullYear(),
    layout: 'wheel',
    rings: [
      { id: rid(), name: t('default.ring.workEnv'), color: RING_PALETTE[1] },
      { id: rid(), name: t('default.ring.development'), color: RING_PALETTE[0] },
      { id: rid(), name: t('default.ring.compensation'), color: RING_PALETTE[2] },
    ],
    activities: [
      { id: rid(), name: t('default.activity.review'), ringId: null, startWeek: 8, lengthWeeks: 4 },
      { id: rid(), name: t('default.activity.salaryReview'), ringId: null, startWeek: 14, lengthWeeks: 3 },
      { id: rid(), name: t('default.activity.workplaceInsp'), ringId: null, startWeek: 38, lengthWeeks: 2 },
      { id: rid(), name: t('default.activity.summerParty'), ringId: null, startWeek: 25, lengthWeeks: 1 },
      { id: rid(), name: t('default.activity.succession'), ringId: null, startWeek: 44, lengthWeeks: 6 },
    ],
  };
}
// link default activities to default rings
(function linkDefaults() {
  if (state.activities.length && state.activities[0].ringId === null) {
    state.activities[0].ringId = state.rings[1].id; // Utveckling
    state.activities[1].ringId = state.rings[2].id; // Lön
    state.activities[2].ringId = state.rings[0].id; // Arbetsmiljö
    state.activities[3].ringId = state.rings[0].id; // Arbetsmiljö
    state.activities[4].ringId = state.rings[1].id; // Utveckling
  }
})();

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

// Wheel persistence — local-first, sync to Supabase when possible.
// Local save is instant and works offline; remote sync runs in background.
let saveTimer = null;
function saveState() {
  saveLocal();          // immediate, reliable
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToSupabase, 800); // debounced remote sync
}

function localKey() {
  return STORAGE_KEY + ':' + (currentUser ? currentUser.id : 'anon');
}
function saveLocal() {
  try { localStorage.setItem(localKey(), JSON.stringify(state)); } catch {}
}
function loadLocal() {
  try {
    const raw = localStorage.getItem(localKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.rings)) return parsed;
  } catch {}
  return null;
}

async function saveToSupabase() {
  if (!sb || !currentUser) return;
  // Fall back to native fetch with timeout — supabase-js was hanging silently for some setups.
  try {
    const sessRes = await sb.auth.getSession();
    const token = sessRes && sessRes.data && sessRes.data.session && sessRes.data.session.access_token;
    if (!token) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(SUPABASE_URL + '/rest/v1/wheels?on_conflict=user_id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + token,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ user_id: currentUser.id, data: state }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) console.warn('Wheel save HTTP', res.status, await res.text().catch(() => ''));
  } catch (err) {
    console.warn('Wheel save failed (data finns kvar lokalt):', err.message || err);
  }
}

// ---------- Element refs ----------
const $ = (id) => document.getElementById(id);
const ringList = $('ringList');
const activityList = $('activityList');
const wheel = $('wheel');
const legend = $('legend');
const clientNameInput = $('clientName');
const clientYearInput = $('clientYear');

// ---------- Init ----------
clientNameInput.value = state.client || '';
clientYearInput.value = state.year || new Date().getFullYear();

clientNameInput.addEventListener('input', () => { state.client = clientNameInput.value; saveState(); renderWheel(); });
clientYearInput.addEventListener('input', () => { state.year = +clientYearInput.value || new Date().getFullYear(); saveState(); renderWheel(); });

$('addRingBtn').addEventListener('click', addRing);
$('addActivityBtn').addEventListener('click', addActivity);
$('importActivitiesBtn').addEventListener('click', () => $('activitiesFileInput').click());
$('activitiesFileInput').addEventListener('change', handleActivitiesImport);
$('downloadTemplateLink').addEventListener('click', e => {
  e.preventDefault();
  downloadActivitiesTemplate();
});
setupRingDragAndDrop();
$('newBtn').addEventListener('click', () => {
  if (!confirm(t('confirm.newWheel'))) return;
  const prevLayout = getLayout();
  state = defaultState();
  state.rings = [];
  state.activities = [];
  state.client = '';
  state.year = new Date().getFullYear();
  state.layout = prevLayout;
  clientNameInput.value = '';
  clientYearInput.value = state.year;
  saveState(); renderAll();
});
$('uploadBtn').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', handleFileUpload);
setupExportDropdown();

// Language toggle — wire up all .lang-btn[data-lang] elements (auth screen and topbar)
document.querySelectorAll('.lang-btn[data-lang]').forEach(btn => {
  btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  btn.classList.toggle('active', btn.dataset.lang === currentLang);
});
// Layout dropdown — same UX pattern as the export ("Ladda ner") dropdown
(function setupLayoutDropdown() {
  const btn = $('layoutBtn');
  const menu = $('layoutMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', e => {
    if (!menu.contains(e.target) && e.target !== btn) menu.hidden = true;
  });
  menu.querySelectorAll('.layout-option').forEach(item => {
    item.addEventListener('click', () => {
      menu.hidden = true;
      setLayout(item.dataset.layout);
    });
  });
})();
function refreshLayoutToggle() {
  const cur = getLayout();
  const label = document.querySelector('#layoutBtn .layout-current');
  if (label) label.textContent = t(cur === 'agenda' ? 'layout.agenda' : 'layout.wheel');
  document.querySelectorAll('.layout-option').forEach(b => {
    b.classList.toggle('is-current', b.dataset.layout === cur);
  });
}
function setLayout(layout) {
  if (layout !== 'wheel' && layout !== 'agenda') return;
  state.layout = layout;
  saveState();
  refreshLayoutToggle();
  renderWheel();
  renderLegend();
}
applyI18n();
refreshLayoutToggle();

// ---------- Render ----------
function renderAll() {
  renderRings();
  renderActivities();
  renderWheel();
  renderLegend();
}

function renderRings() {
  ringList.innerHTML = '';
  if (state.rings.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = t('panel.rings.empty');
    ringList.appendChild(li);
    return;
  }
  state.rings.forEach((ring, i) => {
    const li = document.createElement('li');
    li.className = 'ring-item';
    li.draggable = true;
    li.dataset.ringId = ring.id;
    li.innerHTML = `
      <span class="ring-handle" title="${escapeHtml(t('panel.rings.dragHandle'))}" aria-label="${escapeHtml(t('panel.rings.dragHandle'))}">⋮⋮</span>
      <span class="ring-color" style="background:${ring.color}">
        <input type="color" value="${ring.color}" data-id="${ring.id}" class="ring-color-input" aria-label="${escapeHtml(t('panel.rings.colorAria'))}" />
      </span>
      <input class="ring-name" type="text" value="${escapeHtml(ring.name)}" data-id="${ring.id}" placeholder="${escapeHtml(t('panel.rings.namePh'))}" />
      <button class="btn-icon" data-id="${ring.id}" data-action="delete-ring" title="${escapeHtml(t('panel.rings.removeTitle'))}">✕</button>
    `;
    ringList.appendChild(li);
  });

  ringList.querySelectorAll('.ring-color-input').forEach(el => {
    el.addEventListener('input', e => {
      const id = e.target.dataset.id;
      const ring = state.rings.find(r => r.id === id);
      if (ring) {
        ring.color = e.target.value;
        e.target.parentElement.style.background = e.target.value;
        saveState(); renderActivities(); renderWheel(); renderLegend();
      }
    });
  });
  ringList.querySelectorAll('.ring-name').forEach(el => {
    el.addEventListener('input', e => {
      const id = e.target.dataset.id;
      const ring = state.rings.find(r => r.id === id);
      if (ring) { ring.name = e.target.value; saveState(); renderActivitySelects(); renderLegend(); renderWheel(); }
    });
  });
  ringList.querySelectorAll('[data-action="delete-ring"]').forEach(el => {
    el.addEventListener('click', e => {
      const id = e.target.dataset.id;
      if (!confirm(t('confirm.removeRing'))) return;
      state.rings = state.rings.filter(r => r.id !== id);
      state.activities = state.activities.filter(a => a.ringId !== id);
      saveState(); renderAll();
    });
  });
}

function renderActivities() {
  activityList.innerHTML = '';
  if (state.activities.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = t('panel.activities.empty');
    activityList.appendChild(li);
    return;
  }
  if (state.rings.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = t('panel.activities.emptyNoRing');
    activityList.appendChild(li);
    return;
  }
  state.activities.forEach(act => {
    const li = document.createElement('li');
    li.className = 'activity-item';
    const monthLabel = weekToMonthLabel(act.startWeek);
    li.innerHTML = `
      <div class="activity-row">
        <input class="activity-name" type="text" value="${escapeHtml(act.name)}" data-id="${act.id}" data-field="name" placeholder="${escapeHtml(t('panel.activities.namePh'))}" />
        <button class="btn-icon" data-id="${act.id}" data-action="delete-activity" title="${escapeHtml(t('panel.rings.removeTitle'))}">✕</button>
      </div>
      <div class="activity-meta">
        <div class="mini-field">
          <label>${escapeHtml(t('panel.activities.ring'))}</label>
          <select data-id="${act.id}" data-field="ringId">
            ${state.rings.map(r => `<option value="${r.id}" ${r.id === act.ringId ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
          </select>
        </div>
        <div class="mini-field">
          <label>${escapeHtml(t('panel.activities.startWeek'))}</label>
          <input type="number" min="1" max="52" value="${act.startWeek}" data-id="${act.id}" data-field="startWeek" />
        </div>
        <div class="mini-field">
          <label>${escapeHtml(t('panel.activities.length'))}</label>
          <input type="number" min="1" max="52" value="${act.lengthWeeks}" data-id="${act.id}" data-field="lengthWeeks" />
        </div>
      </div>
      <div style="font-size:11px; color:var(--ink-faint); margin-top:2px;">≈ ${escapeHtml(monthLabel)}</div>
    `;
    activityList.appendChild(li);
  });

  activityList.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', e => {
      const id = e.target.dataset.id;
      const field = e.target.dataset.field;
      const act = state.activities.find(a => a.id === id);
      if (!act) return;
      let val = e.target.value;
      if (field === 'startWeek' || field === 'lengthWeeks') {
        val = Math.max(1, Math.min(52, +val || 1));
      }
      act[field] = val;
      saveState();
      renderWheel();
      // update inline month label
      if (field === 'startWeek') {
        const labelEl = e.target.closest('.activity-item').querySelector('div[style]');
        if (labelEl) labelEl.textContent = '≈ ' + weekToMonthLabel(act.startWeek);
      }
    });
  });
  activityList.querySelectorAll('[data-action="delete-activity"]').forEach(el => {
    el.addEventListener('click', e => {
      const id = e.target.dataset.id;
      state.activities = state.activities.filter(a => a.id !== id);
      saveState(); renderAll();
    });
  });
}

function renderActivitySelects() {
  // refresh dropdowns when ring names change
  activityList.querySelectorAll('select[data-field="ringId"]').forEach(sel => {
    const id = sel.dataset.id;
    const act = state.activities.find(a => a.id === id);
    sel.innerHTML = state.rings.map(r => `<option value="${r.id}" ${r.id === act.ringId ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('');
  });
}

function renderLegend() {
  legend.innerHTML = '';
  if (getLayout() === 'agenda') {
    legend.classList.add('legend-agenda');
    let n = 0;
    const ordered = orderedAgendaActivities();
    let currentRingId = '__nothing__';
    ordered.forEach(entry => {
      const ringId = entry.ring ? entry.ring.id : '__orphan__';
      if (ringId !== currentRingId) {
        currentRingId = ringId;
        const heading = document.createElement('div');
        heading.className = 'legend-heading';
        heading.textContent = entry.ring ? entry.ring.name : '—';
        legend.appendChild(heading);
      }
      n++;
      const item = document.createElement('span');
      item.className = 'legend-item';
      item.innerHTML = `<span class="legend-swatch" style="background:${activityPaletteColor(n - 1)}"></span><span class="legend-num">${n}.</span> ${escapeHtml(entry.act.name)}`;
      legend.appendChild(item);
    });
  } else {
    legend.classList.remove('legend-agenda');
    state.rings.forEach(r => {
      const span = document.createElement('span');
      span.className = 'legend-item';
      span.innerHTML = `<span class="legend-swatch" style="background:${r.color}"></span>${escapeHtml(r.name)}`;
      legend.appendChild(span);
    });
  }
}

// ---------- Wheel rendering (SVG) ----------
function drawMonthDividers(innerR, outerR) {
  for (let m = 0; m < 12; m++) {
    const angle = (m / 12) * Math.PI * 2 - Math.PI / 2;
    appendSvg('line', {
      x1: innerR * Math.cos(angle),
      y1: innerR * Math.sin(angle),
      x2: outerR * Math.cos(angle),
      y2: outerR * Math.sin(angle),
      stroke: '#8C95A6',
      'stroke-width': 0.8,
    });
  }
}

// Builds the ordered list of activities for agenda layout: grouped by ring
// (outermost = first ring's first activity), with orphaned activities at the
// end. Each entry knows its display index (= ACTIVITY_PALETTE color slot).
function orderedAgendaActivities() {
  const out = [];
  state.rings.forEach((ring, ringIdx) => {
    state.activities.forEach(act => {
      if (act.ringId === ring.id) out.push({ act, ring, ringIdx });
    });
  });
  state.activities.forEach(act => {
    if (!state.rings.some(r => r.id === act.ringId)) {
      out.push({ act, ring: null, ringIdx: -1 });
    }
  });
  return out;
}

function renderWheel() {
  while (wheel.firstChild) wheel.removeChild(wheel.firstChild);

  const innerR = 60;
  const outerR = 220;
  const monthLabelR = 245;
  const layout = getLayout();

  const empty = layout === 'wheel'
    ? state.rings.length === 0
    : state.activities.length === 0;
  if (empty) {
    appendSvg('text', {
      x: 0, y: 0,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      class: 'wheel-month-label',
    }, t(layout === 'agenda' ? 'agenda.emptyHint' : 'wheel.emptyHint'));
    return;
  }

  if (layout === 'wheel') {
    const ringCount = state.rings.length;
    const ringThickness = (outerR - innerR) / ringCount;
    // Convention: list index 0 = top of list = OUTERMOST ring on the wheel.
    const posFromCenter = (listIdx) => ringCount - 1 - listIdx;

    state.rings.forEach((ring, i) => {
      const pos = posFromCenter(i);
      const r1 = innerR + pos * ringThickness;
      const r2 = r1 + ringThickness;
      appendSvg('path', {
        d: ringBandPath(r1, r2),
        fill: lightenColor(ring.color, 0.92),
        stroke: '#8C95A6',
        'stroke-width': 0.8,
      });
    });

    drawMonthDividers(innerR, outerR);

    state.activities.forEach(act => {
      const ringIdx = state.rings.findIndex(r => r.id === act.ringId);
      if (ringIdx === -1) return;
      const ring = state.rings[ringIdx];
      const pos = posFromCenter(ringIdx);
      const r1 = innerR + pos * ringThickness;
      const r2 = r1 + ringThickness;
      const startAngle = weekToAngle(act.startWeek);
      const endAngle = weekToAngle(act.startWeek + act.lengthWeeks);
      const path = arcPath(r1, r2, startAngle, endAngle);
      appendSvg('path', {
        d: path,
        fill: ring.color,
        class: 'wheel-arc',
        stroke: '#fff',
        'stroke-width': 1,
      });
      appendRadialText(act.name, r1, r2, startAngle, endAngle, act.lengthWeeks);
    });
  } else {
    // Agenda layout — one thin band per activity, outermost = first activity
    // of first ring (legend ordering matches band ordering).
    const ordered = orderedAgendaActivities();
    const total = ordered.length;
    const bandThickness = (outerR - innerR) / total;

    // Faint background bands per activity
    ordered.forEach((entry, i) => {
      const r2 = outerR - i * bandThickness;
      const r1 = r2 - bandThickness;
      appendSvg('path', {
        d: ringBandPath(r1, r2),
        fill: '#F4F1EB',
        stroke: '#8C95A6',
        'stroke-width': 0.6,
      });
    });

    drawMonthDividers(innerR, outerR);

    // Activity arcs — unique color per activity from the activity palette
    ordered.forEach((entry, i) => {
      const r2 = outerR - i * bandThickness;
      const r1 = r2 - bandThickness;
      const startAngle = weekToAngle(entry.act.startWeek);
      const endAngle = weekToAngle(entry.act.startWeek + entry.act.lengthWeeks);
      const path = arcPath(r1, r2, startAngle, endAngle);
      appendSvg('path', {
        d: path,
        fill: activityPaletteColor(i),
        class: 'wheel-arc',
        stroke: '#fff',
        'stroke-width': 0.5,
      });
      // Bands too thin for radial text — names live in the legend.
    });
  }

  // Month labels
  for (let m = 0; m < 12; m++) {
    const midAngle = ((m + 0.5) / 12) * Math.PI * 2 - Math.PI / 2;
    const x = monthLabelR * Math.cos(midAngle);
    const y = monthLabelR * Math.sin(midAngle);
    appendSvg('text', {
      x, y,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      class: 'wheel-month-label',
    }, monthName(m));
  }

  // Center circle + client name (no year)
  appendSvg('circle', { cx: 0, cy: 0, r: innerR - 4, fill: '#fff', stroke: '#8C95A6', 'stroke-width': 0.8 });
  const title = (state.client || t('wheel.centerFallback')).trim();
  const lines = splitTitleOnWords(title, 12);
  const fontSize = lines.length === 1 ? 18 : 15;

  if (lines.length === 1) {
    appendSvg('text', {
      x: 0, y: 0,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      class: 'wheel-center-label',
      'font-size': fontSize,
    }, lines[0]);
  } else {
    // Center two lines vertically around y=0
    appendSvg('text', {
      x: 0, y: -fontSize * 0.6,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      class: 'wheel-center-label',
      'font-size': fontSize,
    }, lines[0]);
    appendSvg('text', {
      x: 0, y: fontSize * 0.6,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      class: 'wheel-center-label',
      'font-size': fontSize,
    }, lines[1]);
  }
}

function splitTitleOnWords(title, maxCharsPerLine) {
  if (!title) return [''];
  if (title.length <= maxCharsPerLine) return [title];
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 1) return [title]; // single long word — can't break
  let line1 = '';
  let i = 0;
  while (i < words.length) {
    const candidate = line1 ? line1 + ' ' + words[i] : words[i];
    if (candidate.length > maxCharsPerLine && line1) break;
    line1 = candidate;
    i++;
  }
  const line2 = words.slice(i).join(' ');
  return line2 ? [line1, line2] : [line1];
}

function appendSvg(tag, attrs, text) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (text != null) el.textContent = text;
  wheel.appendChild(el);
  return el;
}

function weekToAngle(week) {
  // Week 1 starts at top (12 o'clock = -90° = -π/2)
  return ((week - 1) / 52) * Math.PI * 2 - Math.PI / 2;
}

function arcPath(r1, r2, a1, a2) {
  const largeArc = (a2 - a1) > Math.PI ? 1 : 0;
  const x1o = r2 * Math.cos(a1), y1o = r2 * Math.sin(a1);
  const x2o = r2 * Math.cos(a2), y2o = r2 * Math.sin(a2);
  const x1i = r1 * Math.cos(a2), y1i = r1 * Math.sin(a2);
  const x2i = r1 * Math.cos(a1), y2i = r1 * Math.sin(a1);
  return [
    `M ${x1o} ${y1o}`,
    `A ${r2} ${r2} 0 ${largeArc} 1 ${x2o} ${y2o}`,
    `L ${x1i} ${y1i}`,
    `A ${r1} ${r1} 0 ${largeArc} 0 ${x2i} ${y2i}`,
    'Z'
  ].join(' ');
}

function ringBandPath(r1, r2) {
  // full ring band
  return [
    `M ${r2} 0`,
    `A ${r2} ${r2} 0 1 1 ${-r2} 0`,
    `A ${r2} ${r2} 0 1 1 ${r2} 0`,
    `M ${r1} 0`,
    `A ${r1} ${r1} 0 1 0 ${-r1} 0`,
    `A ${r1} ${r1} 0 1 0 ${r1} 0`,
    'Z',
  ].join(' ');
}

function appendRadialText(text, innerR, outerR, startAngle, endAngle, lengthWeeks) {
  // Text reads radially: from inner edge of the ring outward, centered in the arc.
  // This gives long activity names room even when the arc is narrow.
  const fontSize = 10;
  const charWidth = 5.6; // empirical width per char at 10px Inter
  const padding = 6;     // space at each end of the band
  const lineHeight = fontSize + 2;

  const radialLength = outerR - innerR - padding * 2;
  const arcThickness = (endAngle - startAngle) * (innerR + outerR) / 2;

  if (arcThickness < fontSize + 2) return;
  const maxChars = Math.max(0, Math.floor(radialLength / charWidth));
  if (maxChars < 3) return;

  // Wrap onto multiple radial lines only if the activity is wider than 2 weeks
  // AND the arc has room for an extra line. Otherwise fall back to ellipsis.
  const allowWrap = lengthWeeks > 2;
  const maxLinesByArc = Math.max(1, Math.floor(arcThickness / lineHeight));
  const maxLines = allowWrap ? Math.min(maxLinesByArc, 3) : 1;

  const lines = wrapRadialLabel(text, maxChars, maxLines);

  const midAngle = (startAngle + endAngle) / 2;
  const midR = (innerR + outerR) / 2;
  const cx = midR * Math.cos(midAngle);
  const cy = midR * Math.sin(midAngle);
  const rotation = midAngle * 180 / Math.PI;

  // Lines stack tangentially (perpendicular to the radial text direction)
  const perpX = -Math.sin(midAngle);
  const perpY =  Math.cos(midAngle);

  lines.forEach((line, i) => {
    const offset = (i - (lines.length - 1) / 2) * lineHeight;
    const x = cx + offset * perpX;
    const y = cy + offset * perpY;
    appendSvg('text', {
      x, y,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      transform: `rotate(${rotation} ${x} ${y})`,
      class: 'wheel-arc-label',
      'font-size': fontSize,
    }, line);
  });
}

function wrapRadialLabel(text, maxChars, maxLines) {
  if (maxLines <= 1) {
    if (text.length <= maxChars) return [text];
    return [text.slice(0, Math.max(1, maxChars - 1)) + '…'];
  }
  if (text.length <= maxChars) return [text];

  // Build tokens. Words that are much longer than the line are hard-chunked
  // (so e.g. "Utvecklingssamtal" -> ["Utveckl","ingssam","tal"]).
  // Words slightly over maxChars (e.g. "Performance" on a 10-char line)
  // are kept whole and placed on their own line — visually they stick out
  // a tiny bit but reading is far better than mid-word breaks.
  const tokens = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (word.length > maxChars * 1.3) {
      for (let j = 0; j < word.length; j += maxChars) {
        tokens.push({ text: word.slice(j, j + maxChars), standalone: true });
      }
    } else {
      tokens.push({ text: word, standalone: word.length > maxChars });
    }
  }

  const lines = [];
  let current = '';
  let truncated = false;

  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (tk.standalone) {
      if (current) {
        if (lines.length >= maxLines) { truncated = true; break; }
        lines.push(current);
        current = '';
      }
      if (lines.length >= maxLines) { truncated = true; break; }
      lines.push(tk.text);
      if (lines.length >= maxLines && i < tokens.length - 1) { truncated = true; break; }
    } else {
      const candidate = current ? current + ' ' + tk.text : tk.text;
      if (candidate.length <= maxChars) {
        current = candidate;
      } else {
        if (current) {
          if (lines.length >= maxLines) { truncated = true; break; }
          lines.push(current);
        }
        if (lines.length >= maxLines) { truncated = true; current = ''; break; }
        current = tk.text;
      }
    }
  }
  if (current) {
    if (lines.length < maxLines) lines.push(current);
    else truncated = true;
  }

  if (truncated && lines.length > 0) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.length >= maxChars
      ? last.slice(0, Math.max(1, maxChars - 1)) + '…'
      : last + '…';
  }

  return lines;
}

// ---------- Helpers ----------
function lightenColor(hex, amount) {
  // amount 0-1 (1 = white)
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `rgb(${lr}, ${lg}, ${lb})`;
}

function weekToMonthLabel(week) {
  const monthIdx = Math.min(11, Math.floor((week - 1) / 4.333));
  return monthName(monthIdx) + ' (' + t('activity.weekShort') + week + ')';
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  setTimeout(() => { t.hidden = true; }, 1800);
}

// ---------- Import activities from XLSX/CSV ----------
const COL_ALIASES = {
  name:   ['aktivitet', 'aktiviteter', 'namn', 'activity', 'name', 'title'],
  ring:   ['ring', 'kategori', 'category', 'tema', 'grupp'],
  start:  ['startvecka', 'vecka', 'start', 'startweek', 'week'],
  length: ['längd', 'langd', 'veckor', 'length', 'duration', 'weeks', 'längd (veckor)'],
};

function findColumn(headers, aliases) {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').toLowerCase().trim();
    if (aliases.some(a => h === a || h.startsWith(a))) return i;
  }
  return -1;
}

async function handleActivitiesImport(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    toast(t('toast.importLoading'));
    return;
  }
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) { toast(t('toast.fileEmpty')); return; }
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
    if (rows.length < 2) { toast(t('toast.noRows')); return; }

    const headers = rows[0].map(h => String(h || '').toLowerCase().trim());
    const nameCol  = findColumn(headers, COL_ALIASES.name);
    const ringCol  = findColumn(headers, COL_ALIASES.ring);
    const startCol = findColumn(headers, COL_ALIASES.start);
    const lenCol   = findColumn(headers, COL_ALIASES.length);

    if (nameCol === -1 || startCol === -1) {
      toast(t('toast.missingColumns'));
      return;
    }

    const newRings = [];
    const newActivities = [];
    let skipped = 0;

    const usedColors = () => [...state.rings, ...newRings].map(r => r.color);
    const nextColor = () => RING_PALETTE.find(c => !usedColors().includes(c))
      || RING_PALETTE[(state.rings.length + newRings.length) % RING_PALETTE.length];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = String(row[nameCol] != null ? row[nameCol] : '').trim();
      const ringName = ringCol >= 0 ? String(row[ringCol] != null ? row[ringCol] : '').trim() : '';
      const startWeekRaw = row[startCol];
      const lengthRaw = lenCol >= 0 ? row[lenCol] : 1;

      const startWeek = parseInt(startWeekRaw, 10);
      const lengthWeeks = Math.max(1, parseInt(lengthRaw, 10) || 1);

      if (!name || isNaN(startWeek) || startWeek < 1 || startWeek > 52) { skipped++; continue; }

      // Resolve ring: existing → previously created in this import → new
      let ring = null;
      if (ringName) {
        const lc = ringName.toLowerCase();
        ring = state.rings.find(r => r.name.toLowerCase() === lc)
            || newRings.find(r => r.name.toLowerCase() === lc);
        if (!ring) {
          ring = { id: rid(), name: ringName, color: nextColor() };
          newRings.push(ring);
        }
      } else if (state.rings.length) {
        ring = state.rings[0];
      } else if (newRings.length) {
        ring = newRings[0];
      } else {
        // No ring at all — create a default
        ring = { id: rid(), name: t('default.ring.general'), color: nextColor() };
        newRings.push(ring);
      }

      newActivities.push({
        id: rid(),
        name,
        ringId: ring.id,
        startWeek: Math.min(52, Math.max(1, startWeek)),
        lengthWeeks: Math.min(52, lengthWeeks),
      });
    }

    if (newActivities.length === 0) {
      toast(t('toast.noValidRows'));
      return;
    }

    // Prepend so newest are on top, but preserve file order within the import
    state.rings = [...newRings, ...state.rings];
    state.activities = [...newActivities, ...state.activities];
    saveState();
    renderAll();

    let msg = t('toast.importedActs', { n: newActivities.length });
    if (newRings.length) msg += ' · ' + t('toast.importedRings', { n: newRings.length });
    if (skipped) msg += ' · ' + t('toast.importedSkipped', { n: skipped });
    toast(msg);
  } catch (err) {
    console.error(err);
    toast(t('toast.fileError'));
  }
}

function downloadActivitiesTemplate() {
  if (typeof XLSX === 'undefined') {
    toast(t('toast.templateLoading'));
    return;
  }
  const sampleData = currentLang === 'en' ? [
    ['Salary review meeting', 'Compensation & benefits', 14, 3],
    ['Performance review', 'Development', 8, 4],
    ['Summer party', 'Work environment', 25, 1],
    ['Skills development Q3', 'Skills development', 36, 6],
    ['Succession planning', 'Development', 44, 6],
  ] : [
    ['Lönesamtal', 'Lön & förmåner', 14, 3],
    ['Utvecklingssamtal', 'Utveckling', 8, 4],
    ['Sommarfest', 'Arbetsmiljö', 25, 1],
    ['Kompetensutveckling Q3', 'Kompetensutveckling', 36, 6],
    ['Successionsplan', 'Utveckling', 44, 6],
  ];
  const data = [
    [t('template.headerActivity'), t('template.headerRing'), t('template.headerStartWeek'), t('template.headerLength')],
    ...sampleData,
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 12 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t('template.sheetName'));
  XLSX.writeFile(wb, t('template.fileName'));
  toast(t('toast.templateDownloaded'));
}

// ---------- Drag-and-drop reorder of rings ----------
let draggedRingId = null;

function setupRingDragAndDrop() {
  ringList.addEventListener('dragstart', e => {
    const item = e.target.closest('.ring-item');
    if (!item) return;
    draggedRingId = item.dataset.ringId;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    // Firefox needs some data set to start a drag
    try { e.dataTransfer.setData('text/plain', draggedRingId); } catch {}
  });

  ringList.addEventListener('dragover', e => {
    if (!draggedRingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const item = e.target.closest('.ring-item');
    clearDropMarkers();
    if (!item || item.dataset.ringId === draggedRingId) return;
    const rect = item.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    item.classList.add(after ? 'drop-after' : 'drop-before');
  });

  ringList.addEventListener('drop', e => {
    if (!draggedRingId) return;
    e.preventDefault();
    const item = e.target.closest('.ring-item');
    clearDropMarkers();
    if (!item || item.dataset.ringId === draggedRingId) {
      draggedRingId = null;
      return;
    }
    const targetId = item.dataset.ringId;
    const rect = item.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;

    const draggedIdx = state.rings.findIndex(r => r.id === draggedRingId);
    if (draggedIdx === -1) { draggedRingId = null; return; }
    const [moved] = state.rings.splice(draggedIdx, 1);

    let targetIdx = state.rings.findIndex(r => r.id === targetId);
    if (after) targetIdx += 1;
    state.rings.splice(targetIdx, 0, moved);

    draggedRingId = null;
    saveState();
    renderAll();
  });

  ringList.addEventListener('dragend', () => {
    clearDropMarkers();
    ringList.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    draggedRingId = null;
  });

  function clearDropMarkers() {
    ringList.querySelectorAll('.drop-before, .drop-after').forEach(el => {
      el.classList.remove('drop-before', 'drop-after');
    });
  }
}

// ---------- Add handlers ----------
function addRing() {
  const usedColors = state.rings.map(r => r.color);
  const color = RING_PALETTE.find(c => !usedColors.includes(c)) || RING_PALETTE[state.rings.length % RING_PALETTE.length];
  state.rings.unshift({ id: rid(), name: t('default.ring.new'), color });
  saveState(); renderAll();
  // focus the new (top) name input
  setTimeout(() => {
    const first = ringList.querySelector('.ring-name');
    if (first) { first.focus(); first.select(); }
  }, 0);
}

function addActivity() {
  if (state.rings.length === 0) {
    alert(t('panel.activities.emptyNoRing'));
    return;
  }
  state.activities.unshift({
    id: rid(),
    name: t('default.activity.new'),
    ringId: state.rings[0].id,
    startWeek: 1,
    lengthWeeks: 2,
  });
  saveState(); renderAll();
  setTimeout(() => {
    const first = activityList.querySelector('.activity-name');
    if (first) { first.focus(); first.select(); }
  }, 0);
}

// ---------- Export — shared PNG builder + PNG/PDF/PPT outputs ----------
const PNG_KEYWORD = 'arshjul-state';

function setupExportDropdown() {
  const btn = $('exportBtn');
  const menu = $('exportMenu');
  btn.addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', e => {
    if (!menu.contains(e.target) && e.target !== btn) menu.hidden = true;
  });
  menu.addEventListener('click', async e => {
    const fmt = e.target.dataset && e.target.dataset.format;
    if (!fmt) return;
    menu.hidden = true;
    if (fmt === 'png') await exportWheelPNG();
    else if (fmt === 'pdf') await exportWheelPDF();
    else if (fmt === 'ppt') await exportWheelPPT();
  });
}

// Build the wheel as a PNG blob with embedded project state.
async function buildWheelPngBlob() {
  return new Promise((resolve, reject) => {
    const svgClone = wheel.cloneNode(true);
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '-260');
    bg.setAttribute('y', '-260');
    bg.setAttribute('width', '520');
    bg.setAttribute('height', '520');
    bg.setAttribute('fill', '#FFFFFF');
    svgClone.insertBefore(bg, svgClone.firstChild);

    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `
      .wheel-month-label { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; fill: #5C6577; text-transform: uppercase; }
      .wheel-center-label { font-family: 'Fraunces', Georgia, serif; font-weight: 500; fill: #1A2332; }
      .wheel-arc-label { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 9.5px; font-weight: 500; fill: #ffffff; }
    `;
    svgClone.insertBefore(styleEl, svgClone.firstChild);

    const svgString = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const size = 2400;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);

      canvas.toBlob(async (pngBlob) => {
        if (!pngBlob) { reject(new Error('canvas.toBlob returned null')); return; }
        try {
          const arrayBuf = await pngBlob.arrayBuffer();
          const stateJson = JSON.stringify(state);
          const stateB64 = btoa(unescape(encodeURIComponent(stateJson)));
          const pngBytes = injectTextChunk(new Uint8Array(arrayBuf), PNG_KEYWORD, stateB64);
          resolve(new Blob([pngBytes], { type: 'image/png' }));
        } catch (e) { reject(e); }
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to render SVG to image'));
    };
    img.src = url;
  });
}

async function exportWheelPNG() {
  try {
    const blob = await buildWheelPngBlob();
    downloadBlob(blob, `${exportFilenameStem()}-${safeClientName()}-${state.year}.png`);
    toast(t('toast.imageDownloaded'));
  } catch (e) {
    console.error(e);
    toast(t('toast.imageFailed'));
  }
}

async function exportWheelPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    toast(t('toast.pdfLoading'));
    return;
  }
  try {
    const blob = await buildWheelPngBlob();
    const dataUrl = await blobToDataUrl(blob);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297, pageH = 210;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.setTextColor(26, 35, 50);
    const title = (state.client || t('wheel.centerFallback')).trim();
    doc.text(`${title}  ·  ${state.year}`, pageW / 2, 13, { align: 'center' });

    if (getLayout() === 'agenda') {
      // Wheel on the right, legend on the left
      const imgSize = 175;
      const wheelX = pageW - imgSize - 6;
      const wheelY = 17;
      doc.addImage(dataUrl, 'PNG', wheelX, wheelY, imgSize, imgSize);
      drawPdfLegend(doc, pageW, pageH);
    } else {
      const imgSize = 180;
      doc.addImage(dataUrl, 'PNG', (pageW - imgSize) / 2, 17, imgSize, imgSize);
      drawPdfLegend(doc, pageW, pageH);
    }

    doc.save(`${exportFilenameStem()}-${safeClientName()}-${state.year}.pdf`);
    toast(t('toast.pdfDownloaded'));
  } catch (e) {
    console.error(e);
    toast(t('toast.pdfFailed'));
  }
}

function drawPdfLegend(doc, pageW, pageH) {
  if (getLayout() === 'agenda') {
    drawPdfLegendAgenda(doc, pageW, pageH);
    return;
  }
  if (!state.rings.length) return;
  doc.setFontSize(9);
  doc.setTextColor(60, 70, 90);
  const margin = 14;
  const swatch = 3;
  const gap = 2.5;
  const itemGap = 6;
  const rowHeight = 5;
  let y = pageH - 6;
  let x = margin;
  state.rings.forEach(ring => {
    const label = ring.name || 'Ring';
    const labelW = doc.getTextWidth(label);
    const itemW = swatch + gap + labelW + itemGap;
    if (x + itemW > pageW - margin) {
      x = margin;
      y -= rowHeight;
    }
    const rgb = hexToRgb(ring.color);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(x, y - swatch + 0.4, swatch, swatch, 'F');
    doc.setTextColor(40, 45, 60);
    doc.text(label, x + swatch + gap, y);
    x += itemW;
  });
}

function drawPdfLegendAgenda(doc, pageW, pageH) {
  const ordered = orderedAgendaActivities();
  if (!ordered.length) return;
  const xLeft = 8;
  const colWidth = 110; // leaves room for 175mm wheel on the right
  const swatch = 2.6;
  const headingFs = 8;
  const itemFs = 8;
  const lineH = 4.2;
  const headingTopGap = 2.5;
  let y = 22;

  let currentRingId = null;
  ordered.forEach((entry, i) => {
    const ringId = entry.ring ? entry.ring.id : '__orphan__';
    if (ringId !== currentRingId) {
      currentRingId = ringId;
      if (i > 0) y += headingTopGap;
      doc.setFontSize(headingFs);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 35, 50);
      const ringName = entry.ring ? entry.ring.name : '—';
      doc.text(ringName.toUpperCase(), xLeft, y);
      y += lineH;
    }
    if (y > pageH - 8) return; // out of room
    doc.setFontSize(itemFs);
    doc.setFont('helvetica', 'normal');
    const rgb = hexToRgb(activityPaletteColor(i));
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(xLeft, y - swatch + 0.3, swatch, swatch, 'F');
    doc.setTextColor(60, 70, 90);
    const label = `${i + 1}. ${entry.act.name}`;
    const truncated = doc.splitTextToSize(label, colWidth - swatch - 4)[0] || label;
    doc.text(truncated, xLeft + swatch + 2, y);
    y += lineH;
  });
}

async function exportWheelPPT() {
  if (typeof PptxGenJS === 'undefined') {
    toast(t('toast.pptLoading'));
    return;
  }
  try {
    const blob = await buildWheelPngBlob();
    const dataUrl = await blobToDataUrl(blob);
    const pres = new PptxGenJS();
    pres.layout = 'LAYOUT_WIDE'; // 13.333" x 7.5"
    const slideW = 13.333, slideH = 7.5;
    const slide = pres.addSlide();
    slide.background = { color: 'FFFFFF' };

    // Title (compact so wheel can take more vertical room)
    slide.addText(`${(state.client || t('wheel.centerFallback')).trim()}  ·  ${state.year}`, {
      x: 0.5, y: 0.15, w: slideW - 1, h: 0.45,
      fontSize: 20, fontFace: 'Calibri', color: '1A2332',
      align: 'center', valign: 'middle', bold: false,
    });

    if (getLayout() === 'agenda') {
      // Wheel on the right, legend on the left
      const imgSize = 6.45;
      slide.addImage({
        data: dataUrl,
        x: slideW - imgSize - 0.25, y: 0.65,
        w: imgSize, h: imgSize,
      });
      addPptLegendAgenda(slide, slideW, slideH);
    } else {
      const imgSize = 6.45;
      slide.addImage({
        data: dataUrl,
        x: (slideW - imgSize) / 2, y: 0.65,
        w: imgSize, h: imgSize,
      });
      addPptLegend(slide, slideW, slideH);
    }

    await pres.writeFile({ fileName: `${exportFilenameStem()}-${safeClientName()}-${state.year}.pptx` });
    toast(t('toast.pptDownloaded'));
  } catch (e) {
    console.error(e);
    toast(t('toast.pptFailed'));
  }
}

function addPptLegend(slide, slideW, slideH) {
  if (!state.rings.length) return;
  const swatch = 0.13;
  const gap = 0.1;
  const itemGap = 0.32;
  const fontSize = 10;
  const charWidthApprox = 0.07;
  const margin = 0.5;
  const rowHeight = 0.24;
  let y = slideH - 0.28;
  let x = margin;
  state.rings.forEach(ring => {
    const label = ring.name || 'Ring';
    const textW = label.length * charWidthApprox;
    const itemW = swatch + gap + textW + itemGap;
    if (x + itemW > slideW - margin) { x = margin; y += rowHeight; }
    slide.addShape('rect', {
      x, y: y - swatch / 2, w: swatch, h: swatch,
      fill: { color: ring.color.replace('#', '') },
      line: { color: ring.color.replace('#', ''), width: 0 },
    });
    slide.addText(label, {
      x: x + swatch + gap, y: y - rowHeight / 2,
      w: textW + 0.2, h: rowHeight,
      fontSize, fontFace: 'Calibri', color: '1A2332',
      valign: 'middle',
    });
    x += itemW;
  });
}

function addPptLegendAgenda(slide, slideW, slideH) {
  const ordered = orderedAgendaActivities();
  if (!ordered.length) return;
  const xLeft = 0.3;
  const colWidth = 6.0; // wheel takes 6.45 + 0.25 = 6.7 on the right
  const swatch = 0.12;
  const headingFs = 9;
  const itemFs = 9;
  const lineH = 0.22;
  const headingTopGap = 0.1;
  let y = 0.7;

  let currentRingId = null;
  ordered.forEach((entry, i) => {
    const ringId = entry.ring ? entry.ring.id : '__orphan__';
    if (ringId !== currentRingId) {
      currentRingId = ringId;
      if (i > 0) y += headingTopGap;
      const ringName = entry.ring ? entry.ring.name : '—';
      slide.addText(ringName.toUpperCase(), {
        x: xLeft, y, w: colWidth, h: lineH,
        fontSize: headingFs, fontFace: 'Calibri', color: '1A2332',
        bold: true, valign: 'middle',
      });
      y += lineH;
    }
    if (y > slideH - lineH) return; // out of room
    slide.addShape('rect', {
      x: xLeft, y: y + (lineH - swatch) / 2, w: swatch, h: swatch,
      fill: { color: activityPaletteColor(i).replace('#', '') },
      line: { color: activityPaletteColor(i).replace('#', ''), width: 0 },
    });
    slide.addText(`${i + 1}. ${entry.act.name}`, {
      x: xLeft + swatch + 0.08, y, w: colWidth - swatch - 0.1, h: lineH,
      fontSize: itemFs, fontFace: 'Calibri', color: '3C465A',
      valign: 'middle',
    });
    y += lineH;
  });
}

// ---------- Small helpers for export ----------
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
function safeClientName() {
  const fallback = currentLang === 'en' ? 'client' : 'kund';
  return (state.client || fallback).trim().replace(/[^a-zA-ZåäöÅÄÖ0-9_-]/g, '_') || fallback;
}
function exportFilenameStem() {
  return currentLang === 'en' ? 'year-wheel' : 'arshjul';
}
function hexToRgb(hex) {
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16),
  };
}

// ====================================================================
// Authentication — magic link via Supabase, one wheel per user
// ====================================================================
async function initAuth() {
  // Fallback: if neither screen is visible after 1.5s, force the login screen.
  // (Catches any edge case where init silently throws somewhere.)
  setTimeout(() => {
    const a = $('authScreen'), b = $('appScreen');
    if (a && b && a.hidden && b.hidden) {
      console.warn('Both screens hidden — forcing login screen visible');
      a.hidden = false;
    }
  }, 1500);

  if (typeof supabase === 'undefined') {
    showAuthMessage(t('auth.unavailable'), true);
    showLoginScreen();
    return;
  }
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  setupAuthHandlers();

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      isPasswordRecovery = true;
      showLoginScreen();
      setAuthMode('newpw');
      return;
    }
    // While the user is in the middle of setting a new password,
    // don't auto-route them into the app even though Supabase has a session.
    if (isPasswordRecovery) return;
    if (session && session.user) await onSignedIn(session.user);
    else onSignedOut();
  });

  const { data } = await sb.auth.getSession();
  if (isPasswordRecovery) return; // PASSWORD_RECOVERY already routed us to the new-password screen
  if (data.session && data.session.user) {
    await onSignedIn(data.session.user);
  } else {
    onSignedOut();
  }
}

// 'signin' | 'signup' | 'reset' | 'newpw'
let authMode = 'signin';
let isPasswordRecovery = false;

function setAuthMode(mode) {
  authMode = mode;
  const emailEl = $('authEmail');
  const pwEl = $('authPassword');

  // Default visibility — adjusted per mode below
  emailEl.hidden = false;
  emailEl.disabled = false;
  pwEl.hidden = false;
  pwEl.disabled = false;
  $('authForgotRow').hidden = true;
  $('authToggleRow').hidden = true;
  $('authBackRow').hidden = true;

  if (mode === 'signin') {
    $('authTitle').textContent = t('auth.signin.title');
    $('authSub').textContent = t('auth.signin.sub');
    $('authSubmitBtn').textContent = t('auth.signin.submit');
    pwEl.setAttribute('autocomplete', 'current-password');
    pwEl.placeholder = t('auth.passwordPh');
    $('authToggleText').textContent = t('auth.signin.toggleText');
    $('authToggleLink').textContent = t('auth.signin.toggleLink');
    $('authForgotRow').hidden = false;
    $('authToggleRow').hidden = false;
  } else if (mode === 'signup') {
    $('authTitle').textContent = t('auth.signup.title');
    $('authSub').textContent = t('auth.signup.sub');
    $('authSubmitBtn').textContent = t('auth.signup.submit');
    pwEl.setAttribute('autocomplete', 'new-password');
    pwEl.placeholder = t('auth.passwordPh');
    $('authToggleText').textContent = t('auth.signup.toggleText');
    $('authToggleLink').textContent = t('auth.signup.toggleLink');
    $('authToggleRow').hidden = false;
  } else if (mode === 'reset') {
    $('authTitle').textContent = t('auth.reset.title');
    $('authSub').textContent = t('auth.reset.sub');
    $('authSubmitBtn').textContent = t('auth.reset.submit');
    pwEl.hidden = true;
    pwEl.disabled = true;
    $('authBackRow').hidden = false;
  } else if (mode === 'newpw') {
    $('authTitle').textContent = t('auth.newpw.title');
    $('authSub').textContent = t('auth.newpw.sub');
    $('authSubmitBtn').textContent = t('auth.newpw.submit');
    emailEl.hidden = true;
    emailEl.disabled = true;
    pwEl.setAttribute('autocomplete', 'new-password');
    pwEl.placeholder = t('auth.passwordPhNew');
    pwEl.value = '';
  }
  $('authForgotLink').textContent = t('auth.forgotLink');
  $('authBackLink').textContent = t('auth.backLink');
  emailEl.placeholder = t('auth.emailPh');
  showAuthMessage('', false);
}

function translateAuthError(message) {
  const m = String(message || '').toLowerCase();
  if (m.includes('inte inbjuden') || m.includes('inbjudna')) return t('auth.err.notInvited');
  if (m.includes('invalid login') || m.includes('invalid credentials')) return t('auth.err.invalidCreds');
  if (m.includes('email not confirmed')) return t('auth.err.notConfirmed');
  if (m.includes('user already registered') || m.includes('already exists')) return t('auth.err.alreadyExists');
  if (m.includes('password should be at least')) return t('auth.err.tooShort');
  if (m.includes('rate limit')) return t('auth.err.rateLimit');
  if (m.includes('weak password')) return t('auth.err.weakPwd');
  if (m.includes('database error') && m.includes('saving')) {
    // The signup trigger raises an exception that surfaces as a generic db error
    return t('auth.err.notInvited');
  }
  return message || t('auth.err.generic');
}

async function handleResetRequest(email) {
  const submitBtn = $('authSubmitBtn');
  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = t('auth.reset.sending');
  showAuthMessage('', false);
  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw error;
    showAuthMessage(t('auth.reset.sent', { email }), false);
  } catch (err) {
    showAuthMessage(translateAuthError(err.message || err), true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
}

async function handleNewPassword(password) {
  const submitBtn = $('authSubmitBtn');
  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = t('auth.newpw.saving');
  showAuthMessage('', false);
  try {
    const { data, error } = await sb.auth.updateUser({ password });
    if (error) throw error;
    isPasswordRecovery = false;
    const user = (data && data.user) || null;
    if (user) {
      await onSignedIn(user);
    } else {
      const sessRes = await sb.auth.getSession();
      const sessUser = sessRes && sessRes.data && sessRes.data.session && sessRes.data.session.user;
      if (sessUser) await onSignedIn(sessUser);
      else {
        setAuthMode('signin');
        showAuthMessage(t('auth.newpw.updated'), false);
      }
    }
  } catch (err) {
    showAuthMessage(translateAuthError(err.message || err), true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
}

function setupAuthHandlers() {
  $('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!sb) return;
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;

    if (authMode === 'reset') {
      if (!email) return;
      await handleResetRequest(email);
      return;
    }
    if (authMode === 'newpw') {
      if (!password) return;
      await handleNewPassword(password);
      return;
    }

    if (!email || !password) return;
    const submitBtn = $('authSubmitBtn');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = authMode === 'signin' ? t('auth.signin.signing') : t('auth.signup.signingUp');
    showAuthMessage('', false);
    try {
      const fn = authMode === 'signin' ? sb.auth.signInWithPassword : sb.auth.signUp;
      const { data, error } = await fn.call(sb.auth, { email, password });
      if (error) throw error;

      // Try to get a user from any of the places it might appear.
      let user = (data && data.user) || null;
      if (!user) {
        const sessRes = await sb.auth.getSession();
        user = (sessRes && sessRes.data && sessRes.data.session && sessRes.data.session.user) || null;
      }

      if (authMode === 'signup' && !user && !(data && data.session)) {
        // Email confirmation required and account just created
        showAuthMessage(t('auth.signup.confirmEmail', { email }), false);
        setAuthMode('signin');
      } else if (user) {
        // Force the screen swap synchronously, BEFORE awaiting any wheel data.
        $('authScreen').hidden = true;
        $('appScreen').hidden = false;
        $('userEmail').textContent = user.email || '';
        currentUser = user;
        // Load wheel + admin status in background; don't block UI swap on them
        loadUserWheel(user.id).catch(err => {
          console.error('loadUserWheel failed:', err);
          toast(t('toast.wheelLoadFailed'));
        });
        refreshAdminStatus().catch(err => console.error('refreshAdminStatus failed:', err));
      } else {
        showAuthMessage(t('auth.sessionFailed'), true);
      }
    } catch (err) {
      showAuthMessage(translateAuthError(err.message || err), true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });

  $('authToggleLink').addEventListener('click', (e) => {
    e.preventDefault();
    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
  });

  $('authForgotLink').addEventListener('click', (e) => {
    e.preventDefault();
    setAuthMode('reset');
  });

  $('authBackLink').addEventListener('click', (e) => {
    e.preventDefault();
    setAuthMode('signin');
  });

  $('logoutBtn').addEventListener('click', async () => {
    // Best-effort server signOut (don't wait if it hangs)
    if (sb) {
      try {
        await Promise.race([
          sb.auth.signOut(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
        ]);
      } catch {}
    }
    // Clear the local Supabase auth session so the next reload lands on the login screen.
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-')) localStorage.removeItem(key);
      }
    } catch {}
    // Hard reload to a clean state.
    window.location.reload();
  });

  // Admin modal wiring
  $('adminBtn').addEventListener('click', openAdminModal);
  $('adminCloseBtn').addEventListener('click', closeAdminModal);
  $('adminModal').addEventListener('click', (e) => {
    if (e.target === $('adminModal')) closeAdminModal();
  });
  $('adminAddForm').addEventListener('submit', handleAdminAdd);
  const diagBtn = $('adminDiagBtn');
  if (diagBtn) diagBtn.addEventListener('click', runAdminDiagnostic);
}

async function runAdminDiagnostic() {
  const log = ['== HR Årshjul diagnostik ==', 'Tid: ' + new Date().toISOString(), ''];
  log.push('navigator.onLine: ' + navigator.onLine);
  log.push('SUPABASE_URL: ' + SUPABASE_URL);
  log.push('User-Agent: ' + navigator.userAgent.slice(0, 100));
  log.push('');

  let token = null;
  try {
    const sessRes = await sb.auth.getSession();
    const sess = sessRes && sessRes.data && sessRes.data.session;
    log.push('Session: ' + (sess ? 'finns' : 'SAKNAS'));
    if (sess) {
      token = sess.access_token;
      log.push('  user.email: ' + (sess.user && sess.user.email));
    }
  } catch (err) {
    log.push('Session error: ' + (err.message || err));
  }
  log.push('');

  if (!token) {
    alert(log.join('\n') + '\n\nIngen session — logga ut och in.');
    return;
  }

  // Test flera endpoints, var och en med 5 sek timeout
  async function test(label, opts) {
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(opts.url, {
        method: opts.method,
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + token,
        },
        body: opts.body,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const ms = Date.now() - t0;
      const text = (await res.text()).slice(0, 120);
      log.push(`[${label}] ${res.status} på ${ms}ms - ${text}`);
    } catch (err) {
      clearTimeout(timer);
      const ms = Date.now() - t0;
      log.push(`[${label}] FEL på ${ms}ms - ${err.name}: ${err.message}`);
    }
  }

  log.push('Testar olika vägar (5 sek max per anrop):');
  log.push('');

  // Vercel-proxyn (ny väg som SKA fungera)
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'list' }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const ms = Date.now() - t0;
    const txt = (await res.text()).slice(0, 200);
    log.push(`[VERCEL /api/admin] ${res.status} på ${ms}ms`);
    log.push('  body: ' + txt);
  } catch (err) {
    const ms = Date.now() - t0;
    log.push(`[VERCEL /api/admin] FEL på ${ms}ms - ${err.name}: ${err.message}`);
  }

  log.push('');

  // Direkta Supabase-anrop (gamla vägen — testar om de funkar för dig nu)
  await test('GET wheels (direkt)', { method: 'GET', url: SUPABASE_URL + '/rest/v1/wheels?select=user_id&limit=1' });
  await test('POST rpc/whoami (direkt)', { method: 'POST', url: SUPABASE_URL + '/rest/v1/rpc/whoami', body: '{}' });

  alert(log.join('\n'));
}

// ---------- Admin (allowlist) UI ----------
async function openAdminModal() {
  $('adminModal').hidden = false;
  $('adminMessage').hidden = true;
  await renderAdminEmailList();
}
function closeAdminModal() {
  $('adminModal').hidden = true;
  $('adminAddEmail').value = '';
  $('adminAddNotes').value = '';
}

function showAdminMessage(text, isError) {
  const el = $('adminMessage');
  if (!text) { el.hidden = true; el.classList.remove('is-error'); return; }
  el.textContent = text;
  el.hidden = false;
  el.classList.toggle('is-error', !!isError);
}

// Anropa vår egen Vercel serverless-funktion som vidarebefordrar till Supabase.
// Bypass:ar vad som än blockerar direkta supabase.co-anrop i Lara's miljö.
async function callAdminApi(action, extra) {
  const sessRes = await sb.auth.getSession();
  const token = sessRes && sessRes.data && sessRes.data.session && sessRes.data.session.access_token;
  if (!token) throw new Error('Ingen aktiv session — logga ut och in igen.');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);

  let res;
  try {
    res = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify(Object.assign({ action }, extra || {})),
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Begäran tog för lång tid (10 sek).');
    throw err;
  }
  clearTimeout(timer);

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const msg = (data && (data.error || data.message || data.hint)) || ('HTTP ' + res.status);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function renderAdminEmailList() {
  const list = $('adminEmailList');
  list.innerHTML = `<li class="admin-email-empty">${escapeHtml(t('admin.loading'))}</li>`;
  try {
    const data = await callAdminApi('list');
    list.innerHTML = '';
    if (!data || data.length === 0) {
      list.innerHTML = `<li class="admin-email-empty">${escapeHtml(t('admin.empty'))}</li>`;
      return;
    }
    const myEmail = (currentUser && currentUser.email || '').toLowerCase();
    data.forEach(row => {
      const isSelf = row.email.toLowerCase() === myEmail;
      const li = document.createElement('li');
      li.className = 'admin-email-row' + (isSelf ? ' is-self' : '');
      const removeTitle = isSelf ? t('admin.cannotRemoveSelf') : t('panel.rings.removeTitle');
      li.innerHTML = `
        <span class="admin-email">${escapeHtml(row.email)}${isSelf ? ' ' + escapeHtml(t('admin.you')) : ''}</span>
        <span class="admin-notes">${escapeHtml(row.notes || '')}</span>
        <button class="btn-icon" type="button" data-email="${escapeHtml(row.email)}" ${isSelf ? 'disabled' : ''} title="${escapeHtml(removeTitle)}">✕</button>
      `;
      list.appendChild(li);
    });
    list.querySelectorAll('button[data-email]').forEach(btn => {
      btn.addEventListener('click', () => handleAdminRemove(btn.dataset.email));
    });
  } catch (err) {
    console.error('admin_list_emails error:', err);
    list.innerHTML = '';
    showAdminMessage(t('admin.loadFailed', { err: err.message || err }), true);
  }
}

async function handleAdminAdd(e) {
  e.preventDefault();
  const emailRaw = $('adminAddEmail').value.trim().toLowerCase();
  const notes = $('adminAddNotes').value.trim();
  if (!emailRaw) return;
  showAdminMessage('', false);
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.textContent : '';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('admin.adding'); }
  try {
    await callAdminApi('add', { email: emailRaw, notes: notes || null });
    $('adminAddEmail').value = '';
    $('adminAddNotes').value = '';
    showAdminMessage(t('admin.added', { email: emailRaw }), false);
    await renderAdminEmailList();
  } catch (err) {
    let msg = err.message || String(err);
    if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('unique')) {
      msg = t('admin.duplicate');
    }
    console.error('admin_add_email error:', err);
    showAdminMessage(msg, true);
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText || t('admin.add'); }
  }
}

async function handleAdminRemove(email) {
  if (!confirm(t('confirm.removeEmail', { email }))) return;
  showAdminMessage('', false);
  try {
    await callAdminApi('remove', { email: email });
    await renderAdminEmailList();
  } catch (err) {
    console.error('admin_remove_email error:', err);
    showAdminMessage('Kunde inte ta bort: ' + (err.message || err), true);
  }
}

async function onSignedIn(user) {
  currentUser = user;
  showAppScreen(user);
  await loadUserWheel(user.id);
  await refreshAdminStatus();
}

let isAdmin = false;

// Klientsidig fallback: om mejlen är en känd admin, visa knappen direkt.
// Servern (RLS) gör fortfarande den riktiga kontrollen — knappen leder bara
// till handlingar som server-policys måste tillåta. Att visa knappen för fel
// person är alltså ofarligt.
const KNOWN_ADMIN_EMAILS = new Set([
  'eva.klevas@klevasconsulting.com',
  'klevas.ai@outlook.com',
]);

async function refreshAdminStatus() {
  if (!sb || !currentUser) {
    isAdmin = false;
    $('adminBtn').hidden = true;
    return;
  }
  const email = (currentUser.email || '').toLowerCase();

  // Snabb optimistisk check via mejl — visar knappen omedelbart för Lara.
  if (KNOWN_ADMIN_EMAILS.has(email)) {
    isAdmin = true;
    $('adminBtn').hidden = false;
    const link = $('adminLink');
    if (link) link.hidden = false;
  }

  // Bekräfta också via RPC (bästa möjliga; om den returnerar true håll knappen)
  try {
    const { data } = await sb.rpc('is_admin');
    if (data === true) {
      isAdmin = true;
      $('adminBtn').hidden = false;
      const link = $('adminLink');
      if (link) link.hidden = false;
    }
  } catch (err) {
    console.warn('refreshAdminStatus rpc exception:', err);
  }
}

// Re-check admin status when the tab regains focus — covers the case where
// the user came back to a stale tab and the previous check happened to fail.
window.addEventListener('focus', () => {
  if (currentUser) refreshAdminStatus().catch(() => {});
});

function onSignedOut() {
  currentUser = null;
  state = defaultState();
  isAdmin = false;
  $('adminBtn').hidden = true;
  showLoginScreen();
  // If we arrived from the admin page's "Glömt lösenord?" link, jump straight
  // into the reset flow so the user doesn't have to find the link again.
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('forgot') === '1' && authMode !== 'newpw') {
      setAuthMode('reset');
      params.delete('forgot');
      const qs = params.toString();
      const newUrl = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      history.replaceState(null, '', newUrl);
    }
  } catch {}
}

function showAppScreen(user) {
  $('authScreen').hidden = true;
  $('appScreen').hidden = false;
  $('userEmail').textContent = user.email || '';
  // Always re-check admin status when showing the app — never rely on the caller.
  refreshAdminStatus().catch(err => console.error('refreshAdminStatus failed:', err));
}
function showLoginScreen() {
  $('authScreen').hidden = false;
  $('appScreen').hidden = true;
  $('userEmail').textContent = '';
}

function showAuthMessage(text, isError) {
  const el = $('authMessage');
  if (!text) { el.hidden = true; el.classList.remove('is-error'); return; }
  el.textContent = text;
  el.hidden = false;
  el.classList.toggle('is-error', !!isError);
}

async function loadUserWheel(userId) {
  // Local-first: a local cache always wins because remote sync may be unreliable
  // in this user's network. Cross-device sync is a future concern.
  const local = loadLocal();
  if (local) {
    state = local;
    clientNameInput.value = state.client || '';
    clientYearInput.value = state.year || new Date().getFullYear();
    renderAll();
    return; // skip remote — local is authoritative
  }

  // No local cache — try Supabase as a starting point.
  let remote = null;
  try {
    const sessRes = await sb.auth.getSession();
    const token = sessRes && sessRes.data && sessRes.data.session && sessRes.data.session.access_token;
    if (!token) throw new Error('no token');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(SUPABASE_URL + '/rest/v1/wheels?select=data,updated_at&user_id=eq.' + encodeURIComponent(userId), {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const rows = await res.json();
      if (rows && rows.length && rows[0].data && Array.isArray(rows[0].data.rings)) {
        remote = rows[0].data;
      }
    }
  } catch (err) {
    console.warn('Wheel load failed (använder defaults):', err.message || err);
  }

  if (remote) {
    state = remote;
    saveLocal(); // seed the local cache with remote so we have it next time
  } else {
    // No remote, no local — fresh user, build defaults.
    state = defaultState();
    if (state.activities.length && state.activities[0].ringId === null) {
      state.activities[0].ringId = state.rings[1].id;
      state.activities[1].ringId = state.rings[2].id;
      state.activities[2].ringId = state.rings[0].id;
      state.activities[3].ringId = state.rings[0].id;
      state.activities[4].ringId = state.rings[1].id;
    }
  }
  clientNameInput.value = state.client || '';
  clientYearInput.value = state.year || new Date().getFullYear();
  refreshLayoutToggle();
  renderAll();
  saveState();
}

// ---------- Upload PNG and restore project ----------
async function handleFileUpload(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = ''; // reset so same file can be picked again
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (!isPng(bytes)) {
      toast(t('toast.invalidPng'));
      return;
    }
    const stateB64 = readTextChunk(bytes, PNG_KEYWORD);
    if (!stateB64) {
      toast(t('toast.noProjectData'));
      return;
    }
    const stateJson = decodeURIComponent(escape(atob(stateB64)));
    const loaded = JSON.parse(stateJson);
    if (!loaded || !Array.isArray(loaded.rings) || !Array.isArray(loaded.activities)) {
      toast(t('toast.corruptData'));
      return;
    }
    state = loaded;
    clientNameInput.value = state.client || '';
    clientYearInput.value = state.year || new Date().getFullYear();
    refreshLayoutToggle();
    saveState();
    renderAll();
    toast(t('toast.wheelLoaded'));
  } catch (err) {
    console.error(err);
    toast(t('toast.fileLoadError'));
  }
}

// ---------- PNG byte helpers ----------
function isPng(b) {
  const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  if (b.length < 8) return false;
  for (let i = 0; i < 8; i++) if (b[i] !== sig[i]) return false;
  return true;
}

// CRC32 used by PNG chunks
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeUint32BE(arr, offset, value) {
  arr[offset]     = (value >>> 24) & 0xFF;
  arr[offset + 1] = (value >>> 16) & 0xFF;
  arr[offset + 2] = (value >>> 8) & 0xFF;
  arr[offset + 3] = value & 0xFF;
}
function readUint32BE(arr, offset) {
  return ((arr[offset] << 24) | (arr[offset + 1] << 16) | (arr[offset + 2] << 8) | arr[offset + 3]) >>> 0;
}

function buildTextChunk(keyword, text) {
  const enc = new TextEncoder();
  const kw = enc.encode(keyword); // ASCII-only keyword
  const tx = enc.encode(text);    // base64 text → ASCII
  const dataLen = kw.length + 1 + tx.length;
  const data = new Uint8Array(dataLen);
  data.set(kw, 0);
  data[kw.length] = 0;
  data.set(tx, kw.length + 1);

  const type = new Uint8Array([0x74, 0x45, 0x58, 0x74]); // 'tEXt'
  const crcInput = new Uint8Array(type.length + data.length);
  crcInput.set(type, 0);
  crcInput.set(data, type.length);
  const crc = crc32(crcInput);

  const chunk = new Uint8Array(4 + 4 + dataLen + 4);
  writeUint32BE(chunk, 0, dataLen);
  chunk.set(type, 4);
  chunk.set(data, 8);
  writeUint32BE(chunk, 8 + dataLen, crc);
  return chunk;
}

function injectTextChunk(pngBytes, keyword, text) {
  // IEND is always the last 12 bytes (4 length + 4 type + 0 data + 4 crc)
  const chunk = buildTextChunk(keyword, text);
  const out = new Uint8Array(pngBytes.length + chunk.length);
  const insertAt = pngBytes.length - 12;
  out.set(pngBytes.subarray(0, insertAt), 0);
  out.set(chunk, insertAt);
  out.set(pngBytes.subarray(insertAt), insertAt + chunk.length);
  return out;
}

function readTextChunk(pngBytes, targetKeyword) {
  let pos = 8; // skip 8-byte signature
  while (pos + 12 <= pngBytes.length) {
    const length = readUint32BE(pngBytes, pos);
    const type = String.fromCharCode(pngBytes[pos + 4], pngBytes[pos + 5], pngBytes[pos + 6], pngBytes[pos + 7]);
    if (type === 'tEXt') {
      const data = pngBytes.subarray(pos + 8, pos + 8 + length);
      let nullIdx = -1;
      for (let i = 0; i < data.length; i++) if (data[i] === 0) { nullIdx = i; break; }
      if (nullIdx >= 0) {
        const kw = new TextDecoder().decode(data.subarray(0, nullIdx));
        if (kw === targetKeyword) {
          return new TextDecoder().decode(data.subarray(nullIdx + 1));
        }
      }
    }
    if (type === 'IEND') break;
    pos += 12 + length;
  }
  return null;
}

// ---------- Boot ----------
initAuth();
