# Sicurezza e QA locale — 23 ottobre 2026

Branch `main`, baseline `d58a6b5`; nessun commit/push/deploy eseguito.

- Next ed eslint-config-next 16.4.0 → 16.4.2; override sharp 0.35.5 preservato.
- Node supportato: >=22.23.4 <23 oppure >=24.22.1 <25. `.node-version` e quattro workflow fissano 22.23.4. Test locali con Node 24.22.1 ufficiale verificato SHA-256; Node globale non modificato.
- Advisory Next: GHSA-2464-fhr4-w9xw (image optimization, sharp già mitigato), GHSA-673q-mjm6-r5xr (`use cache`, assente), GHSA-p3m5-59mp-jv5r (Server Actions, nessuna direttiva `use server` trovata); patch linea 16.4 da 16.4.1.
- Node CVE-2026-111497: decoder Brotli, corretto nelle versioni runtime fissate. Versione effettiva Vercel non verificata senza fase di pubblicazione.
- Audit completo e produzione: zero vulnerabilità. GHSA-vfj7-8cjw-p6xm su braces è stato ritirato da GitHub il 23 ottobre; nessun downgrade o soppressione dell'audit.

Verifiche superate: ESLint; TypeScript --noEmit; build Next 16.4.2 (77 pagine); check:auth; check:admin (statico/config/JWT); check:headers; check:api-bounds; check:pool; check:client-secrets; check:api (102 tornei EU e 33 team nel campione limitato); check:db e check:community su Supabase localhost isolato; check:seo su http://127.0.0.1:3001.

DB lint locale: una warning preesistente, parametro confirm_username inutilizzato in public.delete_account. Nessuna migrazione modificata.

Browser Chromium: home, italiano, guide, giocatori, login, dashboard e admin a 1440/390 px; HTTP200, zero errori JS/overflow; dashboard/admin reindirizzano al login. API admin overview/users/audit senza token: 403. Nessuna sessione reale o CAPTCHA completato.

Gitleaks diff: nessun riscontro. Scan completo cartella: 47 corrispondenze solo in .env*, .next e supabase/.temp/start-secrets ignorati; non includere questi file. Test bundle client superato. Nessun segreto riportato nei report.

Review indipendente della skill mattpocock-skills:code-review: nessun rilievo sulle modifiche Fantafort, limitate a dipendenze/lockfile/runtime. Produzione, CI remota e deploy non eseguiti né verificati. Anteprima lasciata su http://127.0.0.1:3001 con Supabase locale.

Fonti: https://nodejs.org/en/blog/vulnerability/october-2026-security-releases ; https://github.com/advisories/GHSA-2464-fhr4-w9xw ; https://github.com/advisories/GHSA-673q-mjm6-r5xr ; https://github.com/advisories/GHSA-p3m5-59mp-jv5r ; https://github.com/advisories/GHSA-vfj7-8cjw-p6xm .

Scope proposto: package.json, package-lock.json, .node-version, quattro workflow Node, questo report. Pubblicazione solo dopo approvazione esplicita; main protetto potrebbe richiedere PR/review e non verrà forzato.
