#!/usr/bin/env node
/**
 * Mémoire native, étapes 2 à 5 : lance le serveur AUTONOME (`node server.js`, comme le conteneur), relève toutes les 10 s
 * VmRSS, la Rss de la zone `[heap]` (tas malloc principal de glibc, /proc/PID/smaps) et process.memoryUsage() (route de
 * diagnostic `diag-memoire.cjs`), et peut jouer l'écran de Will (pages ouvertes) pendant ce temps. Tout au premier plan :
 * le serveur est arrêté à la fin.
 *
 *   node scripts/memoire-native/mesurer.mjs --nom A-boucles --standalone <dossier .next/standalone> [--duree 300] [--ecran]
 *   … --chroot <racine>  : serveur lancé dans la racine d'une image (node:22-bookworm-slim, glibc 2.36 comme le conteneur),
 *                          le serveur autonome copié dans <racine>/app, /proc monté dans <racine>/proc.
 *
 * Variables : celles du serveur (DATABASE_URL, SESSION_SECRET…), passées telles quelles (LD_PRELOAD, MALLOC_* compris).
 * Sortie : <--sortie>/<nom>.csv (défaut docs/memoire-native/releves).
 */
import { spawn } from "node:child_process";
import { copyFileSync, readFileSync, mkdirSync, writeFileSync, createWriteStream } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { SignJWT } from "jose";

const ici = dirname(fileURLToPath(import.meta.url));
const arg = (nom, defaut) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? process.argv[i + 1] : defaut;
};
const nom = arg("nom", "mesure");
const duree = Number(arg("duree", "300")) * 1000;
const pas = Number(arg("pas", "10")) * 1000;
const standalone = resolve(arg("standalone", ".next/standalone"));
const sortie = resolve(arg("sortie", join(ici, "../../docs/memoire-native/releves")));
const ecran = process.argv.includes("--ecran");
const racine = arg("chroot", "");
/** Fiches ouvertes à tour de rôle (tailles différentes), ex. `--fiches syn-trav-0,syn-trav-3` ; défaut : le travail actif. */
const fiches = (arg("fiches", "") || "").split(",").filter(Boolean);
/** Accélère l'écran (`--facteur 4` : 4 fois plus de requêtes, comme plusieurs onglets). */
const facteur = Number(arg("facteur", "1"));
/** Requêtes de l'écran jouées (bissection), parmi fiche,liste,accueil,video,cloche ; défaut : toutes. */
const jouees = new Set((arg("requetes", "fiche,liste,accueil,video,cloche") || "").split(","));
const port = Number(process.env.PORT || 3100);
const portDiag = 3199;
const base = `http://127.0.0.1:${port}`;

/* --- Session de mesure (cookie signé, session écrite en base avant le démarrage) --- */
const jti = "ses-mesure-memoire";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const m = new Date().toISOString();
const session = { id: jti, jti, appareil: "mesure", ip: "127.0.0.1", resterConnecte: true, expireLe: new Date(Date.now() + 864e5).toISOString(), derniereActivite: m, creeLe: m, modifieLe: m };
await db.query("INSERT INTO documents (collection, id, data) VALUES ('sessions', $1, $2) ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data", [jti, JSON.stringify(session)]);
const actif = (await db.query("SELECT id FROM documents WHERE collection = 'travaux' AND data->>'statut' IN ('en_cours', 'en_file') LIMIT 1")).rows[0]?.id;
await db.end();
const jeton = await new SignJWT({ rc: true }).setProtectedHeader({ alg: "HS256" }).setJti(jti).setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) + 86400).setAudience("studio-axion-ia").sign(new TextEncoder().encode(process.env.SESSION_SECRET));
const cookie = `studio_session=${jeton}`;

/* --- Serveur --- */
// Un serveur oublié (il se renomme « next-server ») fausserait la mesure : on refuse de démarrer si le port répond.
if (await fetch(`${base}/api/sante`).then(() => true, () => false)) throw new Error(`Le port ${port} répond déjà : arrêtez l'ancien serveur (processus « next-server »).`);
mkdirSync(sortie, { recursive: true });
const journal = createWriteStream(join(sortie, `${nom}.serveur.log`));
let diagChemin = join(ici, "diag-memoire.cjs");
if (racine) {
  copyFileSync(diagChemin, join(racine, "opt/diag-memoire.cjs"));
  diagChemin = "/opt/diag-memoire.cjs";
}
const options = [process.env.NODE_OPTIONS ?? "", `--require ${diagChemin}`, "--expose-gc"].join(" ").trim();
const env = { ...process.env, NODE_OPTIONS: options, DIAG_PORT: String(portDiag) };
// `exec` : le chroot devient le processus node (même PID, relevé dans /proc).
const serveur = racine
  ? spawn("/usr/sbin/chroot", [racine, "/bin/sh", "-c", "cd /app && exec /usr/local/bin/node server.js"], { env: { ...env, PATH: "/usr/local/bin:/usr/bin:/bin" }, stdio: ["ignore", "pipe", "pipe"] })
  : spawn(process.execPath, ["server.js"], { cwd: standalone, env, stdio: ["ignore", "pipe", "pipe"] });
serveur.stdout.pipe(journal);
serveur.stderr.pipe(journal);
const pid = serveur.pid;
const t0 = Date.now();

function lireMemoire() {
  const status = readFileSync(`/proc/${pid}/status`, "utf8");
  const rss = Number(/VmRSS:\s+(\d+)/.exec(status)?.[1] ?? 0) / 1024;
  let tas = 0;
  let dansTas = false;
  for (const ligne of readFileSync(`/proc/${pid}/smaps`, "utf8").split("\n")) {
    if (/^[0-9a-f]+-[0-9a-f]+ /.test(ligne)) dansTas = ligne.trimEnd().endsWith("[heap]");
    else if (dansTas && ligne.startsWith("Rss:")) tas += Number(/(\d+)/.exec(ligne)[1]) / 1024;
  }
  return { rss, tas };
}
const mo = (x) => Math.round(x / 1048576);
async function diag(chemin = "/") {
  try {
    return await (await fetch(`http://127.0.0.1:${portDiag}${chemin}`)).json();
  } catch {
    return null;
  }
}

/* --- Écran de Will (facultatif) --- */
const requetes = { ok: 0, erreurs: 0, octets: 0 };
async function demander(chemin, entetes = {}) {
  try {
    const r = await fetch(base + chemin, { headers: { cookie, "accept-encoding": "gzip, deflate, br", ...entetes }, redirect: "manual" });
    const corps = await r.arrayBuffer();
    requetes.octets += corps.byteLength;
    if (r.status >= 300) requetes.erreurs++;
    else requetes.ok++;
  } catch {
    requetes.erreurs++;
  }
}
const minuteries = [];
function chaque(ms, f, quoi) {
  if (!jouees.has(quoi)) return;
  minuteries.push(setInterval(() => void f(), ms));
}

/* --- Déroulé --- */
const lignes = ["t_s,vmrss_mo,heap_glibc_mo,heapUsed_mo,heapTotal_mo,external_mo,arrayBuffers_mo,requetes_ok,requetes_erreurs"];
let pret = false;
for (let i = 0; i < 120 && !pret; i++) {
  await new Promise((r) => setTimeout(r, 500));
  pret = await fetch(`${base}/api/sante`).then(() => true, () => false);
}
if (!pret) {
  serveur.kill("SIGKILL");
  throw new Error("Le serveur ne répond pas.");
}
if (ecran) {
  // Fiche ouverte sur le travail actif (SuiviTravail / useTravaux : 2 s), accueil (EnCours : 2 s), router.refresh() (4 s),
  // fiche vidéo (10 s), cloche (20 s).
  let n = 0;
  const fiche = () => (fiches.length ? fiches[n++ % fiches.length] : actif);
  chaque(2000 / facteur, () => {
    const id = fiche();
    return demander(id ? `/api/travaux?id=${id}` : "/api/travaux");
  }, "fiche");
  chaque(2000 / facteur, () => demander("/api/travaux"), "liste");
  // `router.refresh()` rejoue le rendu serveur de la page : simulé par la page entière (Next 16 refuse une requête RSC
  // sans l'empreinte `_rsc` calculée par le navigateur : redirection 307, aucun rendu).
  chaque(4000 / facteur, () => demander("/"), "accueil");
  chaque(10000 / facteur, () => demander("/videos/syn-v-0"), "video");
  chaque(20000 / facteur, () => demander("/api/notifications"), "cloche");
}
console.log(`[mesure ${nom}] pid ${pid}${racine ? ` (chroot ${racine})` : ""}, travail actif : ${actif ?? "aucun"}, écran : ${ecran ? [...jouees].join("+") : "non"}, NODE_OPTIONS=${options}, LD_PRELOAD=${process.env.LD_PRELOAD ?? ""}`);
while (Date.now() - t0 < duree + 1000) {
  const { rss, tas } = lireMemoire();
  const u = (await diag()) ?? {};
  const t = Math.round((Date.now() - t0) / 1000);
  const ligne = [t, Math.round(rss), Math.round(tas), mo(u.heapUsed ?? 0), mo(u.heapTotal ?? 0), mo(u.external ?? 0), mo(u.arrayBuffers ?? 0), requetes.ok, requetes.erreurs].join(",");
  lignes.push(ligne);
  console.log(ligne);
  await new Promise((r) => setTimeout(r, pas));
}
for (const x of minuteries) clearInterval(x);
await new Promise((r) => setTimeout(r, 3000));
const apresGc = (await diag("/gc")) ?? {};
const fin = lireMemoire();
const resume = `# fin (après GC forcé) : VmRSS ${Math.round(fin.rss)} Mo, [heap] ${Math.round(fin.tas)} Mo, heapUsed ${mo(apresGc.heapUsed ?? 0)} Mo, heapTotal ${mo(apresGc.heapTotal ?? 0)} Mo, external ${mo(apresGc.external ?? 0)} Mo, arrayBuffers ${mo(apresGc.arrayBuffers ?? 0)} Mo ; requêtes ${requetes.ok} ok / ${requetes.erreurs} erreurs, ${mo(requetes.octets)} Mo reçus`;
lignes.push(resume);
console.log(resume);
writeFileSync(join(sortie, `${nom}.csv`), lignes.join("\n") + "\n");
if (process.argv.includes("--garder")) {
  console.log(`[mesure ${nom}] serveur laissé en marche : pid ${pid}`);
  process.exit(0);
}
serveur.kill("SIGTERM");
await new Promise((r) => setTimeout(r, 2000));
serveur.kill("SIGKILL");
process.exit(0);
