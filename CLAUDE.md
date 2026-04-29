# HR årshjul

## Om projektet
Ett verktyg för att planera och visualisera HR-årets aktiviteter — från onboarding och utvecklingssamtal till lönerevision och årsavslut. Målet är att minska den tid HR lägger på administration och planering, så att mer tid frigörs till att skapa, lära och utveckla människor.

## Om mig (Lara Croft)
Jag bygger produkter för företag med särskilt fokus på HR. Mitt mål är att hjälpa företag effektivisera och hitta arbetssätt som är smarta — där det går fortare att leverera, output blir av högre kvalitet, och det blir mer tid över till att skapa och lära sig.

Det som tar mest tid i HR-vardagen är **administration**. Det är det jag vill lösa.

## Tekniska val
- Bygg med **vanlig HTML, CSS och JavaScript** — ingen React, ingen byggprocess, inga ramverk
- Koden sparas på **GitHub**
- Sidan publiceras med **Vercel**
- Data sparas i **Supabase**

Håll koden enkel och läsbar. Filer ska kunna öppnas direkt i webbläsaren utan extra steg.

## Designprinciper
**Stil: Proffsig men lättläst.** Stilren och seriös – ska kännas som ett verktyg en konsult tar med till en kunddialog – men aldrig på bekostnad av läsbarhet.

- Bakgrund: ljus (off-white, inte rent vit) — bra läsbarhet
- Typografi: tydlig hierarki, generös radhöjd, sans-serif som primärt typsnitt
- Färgpalett: dämpade, sofistikerade toner — djup grafit/marin som primär, varm accent
- Ringfärger: muted, jordiga (slate, sage, terracotta, ockra, dimblå, plommon) — inga skrikiga färger
- Mycket luft, tunna linjer, subtila skuggor
- Knappar och formulär: tydliga men inte högljudda

## Vad verktyget gör
1. Lara skapar ett nytt årshjul per kund
2. Hon kan lägga till och ta bort **ringar** efter kundens behov (Arbetsmiljö, Utveckling, Lön & Förmåner, Kompetensutveckling, etc.) — varje ring har namn + färg
3. Hon lägger in **aktiviteter** med namn, ring, startvecka och längd — placeras automatiskt rätt i hjulet
4. Hjulet visualiseras live (SVG) bredvid inmatningen
5. Kan sparas per kund (Supabase) och hämtas igen senare

## Struktur
(Fylls i allteftersom vi bygger)
