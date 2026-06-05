# Databas-schema (backup)

Det här är en spegling av databasens migrationer i Supabase-projektet
`afcagjgztvmdpeljrjru`. De skapades ursprungligen via MCP/Studio och fanns
**inte** i git — den 2026-06-05 pausades gratisprojektet, kom tillfälligt upp
tomt, och då stod det klart att schemat saknade backup. Nu ligger det här.

Filerna är namngivna `<version>_<namn>.sql` och motsvarar raderna i
`supabase_migrations.schema_migrations`. Kör dem i ordning (efter versionsnummer)
för att återskapa hela schemat: tabeller (`wheels`, `admins`, `allowed_emails`),
RLS-policies, `is_admin()`-hjälpfunktionen, allowlist-triggern på `auth.users`
och admin-RPC:erna.

## Viktigt om data vs. schema

Dessa filer återskapar **strukturen**, inte innehållet:

- **Användarkonton** (`auth.users`) och **lösenord** kan inte återskapas härifrån.
  Användare får registrera sig på nytt (allowlisten släpper in dem) eller
  återställa lösenord.
- **Sparade hjul** (`public.wheels`) ligger även local-first i varje användares
  webbläsare (`localStorage`) och synkas upp igen vid inloggning. De kan också
  återställas från exporterade PNG:er (projektdata i tEXt-chunk).
- `20260429141329` innehåller **bootstrap-inserts med hårdkodade user-ID**
  (Laras konton). De fungerar bara om exakt de auth-användarna finns. Vid en
  helt tom databas: hoppa över dem och sätt admins manuellt efter att kontona
  återskapats (se nedan).

## Återställ på ren databas

Om allt verkligen är borta: kör `20260605174156_recover_full_schema_after_reset.sql`
(den är idempotent och utelämnar de hårdkodade ID:na), låt admin-användarna
registrera sig på nytt, och sätt sedan admin:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'klevas.ai@outlook.com'
on conflict do nothing;
```
