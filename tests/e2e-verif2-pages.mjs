/**
 * VÉRIFICATION E2E n° 2 — parcours HTTP de TOUTES les pages du studio, puis rendu réel à 375 px.
 * Usage (serveur déjà construit et lancé, ex. `STUDIO_SANS_BASE=1 SESSION_SECRET=… STUDIO_PASSWORD_HASH_B64=… npx next start -p 3201`) :
 *   E2E_MDP=… node tests/e2e-verif2-pages.mjs 3201 mem
 * 1. se connecte comme le studio (page /connexion, bouton « Entrer ») et garde le cookie de session ;
 * 2. parcourt en largeur toutes les pages liées depuis les entrées du menu (statut HTTP, pages « n'existe pas ») ;
 * 3. rend chaque page dans Chromium à 375 px : débordement horizontal, erreurs de la console, mots techniques ou
 *    anglais à l'écran, boutons/liens sans nom, champs sans libellé.
 * Résultats : $SORTIE (défaut /tmp/verif2)/{nom}.json et rendu-{nom}.json. Aucun appel aux services payants.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
const SORTIE = process.env.SORTIE ?? "/tmp/verif2";
mkdirSync(`${SORTIE}/crawl`, { recursive: true });
const NAVIGATEUR = { executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" };
{
  const port = process.argv[2];
  const b = await chromium.launch(NAVIGATEUR);
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${port}/connexion`);
  await p.getByLabel("Mot de passe", { exact: true }).fill(process.env.E2E_MDP ?? "");
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 30000 }), p.getByRole("button", { name: "Entrer" }).click()]);
  const c = (await ctx.cookies()).find((x) => x.name === "studio_session");
  writeFileSync(`${SORTIE}/cookie-${port}.txt`, `${c.name}=${c.value}`);
  await b.close();
}
const [port, nom] = process.argv.slice(2);
const cookie = readFileSync(`${SORTIE}/cookie-${port}.txt`, "utf8").trim();
const base = `http://localhost:${port}`;
const depart = ["/", "/bibliotheque", "/calendrier", "/ecrire", "/ecrire/atelier", "/ecrire/matieres", "/ecrire/tournage", "/ecrire/voix", "/formats", "/idees", "/mesures", "/mesures/ce-qui-marche", "/modeles", "/nouvelle", "/personnages", "/reglages", "/scripts", "/veille", "/videos", "/videos/a-ranger", "/maquettes-generateur", "/styleguide", "/hors-ligne", "/videos/inconnu-xyz", "/personnages/inconnu-xyz", "/nouvelle/inconnu-xyz", "/bibliotheque/inconnu-xyz", "/ecrire/tournage/inconnu-xyz", "/ecrire/sujets/inconnu-xyz/lire/zz"];
const vus = new Set(); const file = [...depart]; const res = [];
const SUSPECTS = [/\bSimulation\b/i, /\bsimul[ée]e?s?\b/i, /\bundefined\b/, /\bnull\b/, /\bNaN\b/, /\[object Object\]/, /\bError\b/, /\berror\b/, /\bloading\b/i, /\bsubmit\b/i, /\bcancel\b/i, /\bsave\b/i, /\bdelete\b/i, /\bsettings\b/i, /\bTODO\b/, /\bLorem\b/i, /\bmock\b/i, /\bfake\b/i, /\bstub\b/i, /\bfallback\b/i, /\bpayload\b/i, /\bwebhook\b/i, /\bAPI\b/, /\bJSON\b/, /\btoken\b/i, /\bid:\s/i, /\bstack\b/i, /\bENV\b|process\.env/, /\bDEBUG\b/i, /\bdemo\b/i];
function texteVisible(html) {
  return html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<template[\s\S]*?<\/template>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");
}
while (file.length && vus.size < 400) {
  const chemin = file.shift(); if (vus.has(chemin)) continue; vus.add(chemin);
  const t0 = Date.now();
  let r, html = "";
  try { r = await fetch(base + chemin, { headers: { cookie, accept: "text/html" }, redirect: "manual" }); html = await r.text(); } catch (e) { res.push({ chemin, statut: "ERR " + e.message }); continue; }
  const txt = texteVisible(html);
  const suspects = [];
  for (const re of SUSPECTS) { const m = txt.match(new RegExp(".{0,50}" + re.source + ".{0,50}", re.flags.replace("g", "") )); if (m) suspects.push(m[0].trim()); }
  // Boutons sans nom accessible
  const boutonsMuets = [];
  for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const attrs = m[1], inner = m[2];
    if (/aria-label=|aria-labelledby=|title=/.test(attrs)) continue;
    if (texteVisible(inner).trim()) continue;
    if (/aria-label=|sr-only/.test(inner)) continue;
    boutonsMuets.push(attrs.slice(0, 120));
  }
  const erreurPage = /Cette page n'existe pas|Une erreur|Quelque chose s'est mal passé|Application error|Internal Server Error/i.exec(txt)?.[0];
  res.push({ chemin, statut: r.status, ms: Date.now() - t0, taille: html.length, titre: /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]?.replace(/<[^>]+>/g, "").slice(0, 60), erreurPage, suspects, boutonsMuets: boutonsMuets.length ? boutonsMuets : undefined, loc: r.headers.get("location") ?? undefined });
  for (const m of html.matchAll(/href="(\/[^"#?]*)(\?[^"#]*)?"/g)) {
    const h = m[1];
    if (/^\/(_next|api|v\/|demo|icones|connexion|deconnexion)/.test(h) || /\.[a-z0-9]{2,4}$/i.test(h)) continue;
    const avecQ = m[2] ? h + m[2].replace(/&amp;/g, "&") : h;
    if (!vus.has(h)) file.push(h);
    if (m[2] && !vus.has(avecQ) && vus.size + file.length < 450) file.push(avecQ);
  }
}
writeFileSync(`${SORTIE}/crawl/${nom}.json`, JSON.stringify(res, null, 1));
const parStatut = {}; for (const x of res) parStatut[x.statut] = (parStatut[x.statut] ?? 0) + 1;
console.log(nom, "pages:", res.length, JSON.stringify(parStatut));

// --- Rendu réel à 375 px ---
{

const [port, nom] = process.argv.slice(2);
const cookie = readFileSync(`${SORTIE}/cookie-${port}.txt`, "utf8").trim().split("=");
const chemins = [...new Set(JSON.parse(readFileSync(`${SORTIE}/crawl/${nom}.json`)).map((x) => x.chemin))];
const b = await chromium.launch(NAVIGATEUR);
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: "fr-FR" });
await ctx.addCookies([{ name: cookie[0], value: cookie.slice(1).join("="), domain: "localhost", path: "/" }]);
const res = [];
const MOTS = /\b(Simulation|simulée?s?|undefined|null|NaN|Error|error|Loading|Submit|Cancel|Save|Delete|Settings|TODO|Lorem|mock|fake|stub|fallback|payload|webhook|JSON|token|stack|DEBUG)\b|\[object Object\]/g;
for (const chemin of chemins) {
  const p = await ctx.newPage();
  const erreurs = [];
  p.on("pageerror", (e) => erreurs.push("pageerror: " + e.message.slice(0, 200)));
  p.on("console", (m) => { if (m.type() === "error") erreurs.push("console: " + m.text().slice(0, 200)); });
  let statut;
  try {
    const r = await p.goto(`http://localhost:${port}${chemin}`, { waitUntil: "networkidle", timeout: 30000 });
    statut = r?.status();
    await p.waitForTimeout(300);
  } catch (e) { erreurs.push("goto: " + e.message.slice(0, 120)); }
  const info = await p.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    const texte = main.innerText;
    const largeur = document.documentElement.scrollWidth;
    // Éléments qui dépassent à droite (visibles)
    const deborde = [];
    for (const el of document.querySelectorAll("main *")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > window.innerWidth + 2 && getComputedStyle(el).visibility !== "hidden") {
        let parentScroll = false; let q = el.parentElement;
        while (q && q !== document.body) { const s = getComputedStyle(q); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { parentScroll = true; break; } q = q.parentElement; }
        if (!parentScroll) deborde.push(`${el.tagName.toLowerCase()}.${(el.className?.toString?.() ?? "").slice(0, 80)} →${Math.round(r.right)}px « ${(el.innerText ?? "").slice(0, 40).replace(/\s+/g, " ")} »`);
      }
    }
    const muets = [];
    for (const el of document.querySelectorAll("button, a[href], [role=button]")) {
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      const nomA = (el.getAttribute("aria-label") || el.getAttribute("title") || el.innerText || "").trim() || (el.getAttribute("aria-labelledby") ? "lb" : "") || (el.querySelector("img[alt]")?.getAttribute("alt") ?? "");
      if (!nomA) muets.push(el.outerHTML.slice(0, 160));
    }
    const champs = [];
    for (const el of document.querySelectorAll("input:not([type=hidden]), textarea, select")) {
      const id = el.id; const lab = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) || el.closest("label") || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title");
      if (!lab) champs.push(el.outerHTML.slice(0, 140));
    }
    const boutonsDesactives = [...document.querySelectorAll("main button[disabled]")].map((x) => x.innerText.trim().slice(0, 40)).filter(Boolean);
    return { texte, largeur, deborde: deborde.slice(0, 6), muets: muets.slice(0, 8), champs: champs.slice(0, 6), boutonsDesactives, h1: document.querySelector("h1")?.innerText };
  });
  const mots = [...new Set([...info.texte.matchAll(MOTS)].map((m) => { const i = m.index; return info.texte.slice(Math.max(0, i - 40), i + 50).replace(/\s+/g, " "); }))];
  res.push({ chemin, statut, h1: info.h1, largeur: info.largeur, deborde: info.deborde, muets: info.muets, champs: info.champs, boutonsDesactives: info.boutonsDesactives, erreurs, mots, introuvable: /Cette page n.existe pas/.test(info.texte), texte: info.texte.slice(0, 600) });
  await p.close();
}
await b.close();
writeFileSync(`${SORTIE}/crawl/rendu-${nom}.json`, JSON.stringify(res, null, 1));
console.log(nom, res.length, "pages ; débordements:", res.filter((x) => x.largeur > 377 || x.deborde.length).length, "; erreurs:", res.filter((x) => x.erreurs.length).length, "; mots:", res.filter((x) => x.mots.length).length, "; muets:", res.filter((x) => x.muets.length).length);
}
