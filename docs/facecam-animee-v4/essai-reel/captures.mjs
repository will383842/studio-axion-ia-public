// Captures du nouvel écran « Face caméra animée » (essai réel du 17/10) : serveur local temporaire SANS base (mémoire),
// stockage simulé, lancé puis arrêté par ce script. Usage : node captures.mjs <racine du dépôt> <dossier de sortie> <dossier des vidéos>
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
const [RACINE, SORTIE, VIDEOS] = process.argv.slice(2);
const require = createRequire(join(RACINE, "package.json"));
const { chromium } = require("@playwright/test");
const PORT = 3217;
const BASE = `http://localhost:${PORT}`;
const MDP = "essai-captures-local";
const serveur = spawn(join(RACINE, "node_modules/.bin/next"), ["dev", "-p", String(PORT)], {
  cwd: RACINE,
  env: { ...process.env, STUDIO_SANS_BASE: "1", STUDIO_PASSWORD_HASH_B64: readFileSync(join(SORTIE, "..", "hash.txt"), "utf8").trim(), SESSION_SECRET: "x".repeat(48), NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});
let journal = "";
serveur.stdout.on("data", (d) => (journal += d));
serveur.stderr.on("data", (d) => (journal += d));
const arreter = () => { try { process.kill(-serveur.pid, "SIGTERM"); } catch {} };
process.on("exit", arreter);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${BASE}/api/sante`)).status < 500) break; } catch {}
    if (i > 180) throw new Error("serveur muet\n" + journal.slice(-3000));
    await pause(1000);
  }
  const navigateur = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const bureau = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, locale: "fr-FR", colorScheme: "dark", reducedMotion: "reduce" });
  const p = await bureau.newPage();
  await p.goto(`${BASE}/connexion`, { timeout: 120000 });
  await p.getByLabel(/mot de passe/i).first().fill(MDP);
  await p.getByRole("button", { name: /Entrer|Se connecter|Connexion/i }).first().click();
  await p.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 120000 });
  await p.goto(`${BASE}/nouvelle`, { waitUntil: "networkidle", timeout: 120000 });
  await pause(1500);
  await p.screenshot({ path: join(SORTIE, "1-nouvelle-video-et-menu-1440.png") });

  // Dépôt : faux redémarrage du studio pendant l'ouverture de l'envoi de la 1re prise (3 × 503), session « expirée » pour la 3e.
  let ouvertures = 0;
  await p.route("**/api/depots", async (route) => {
    const corps = route.request().postDataJSON() ?? {};
    if (corps.action === "commencer" && corps.nom === "IMG_7747.MOV" && ouvertures++ < 3) return route.fulfill({ status: 503, contentType: "text/html", body: "<html>503</html>" });
    if (corps.action === "commencer" && corps.nom === "IMG_7802.MOV") return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ erreur: "Connexion requise." }) });
    return route.continue();
  });
  await p.goto(`${BASE}/face-camera-animee`, { waitUntil: "networkidle", timeout: 120000 });
  await pause(1000);
  await p.screenshot({ path: join(SORTIE, "2-depot-vide-1440.png"), fullPage: true });
  const entree = p.locator('input[type="file"]').first();
  await entree.setInputFiles([join(VIDEOS, "IMG_7747.MOV"), join(VIDEOS, "IMG_7801.MP4")]);
  await p.getByText("Le studio redémarre, l'envoi reprend tout seul…").first().waitFor({ timeout: 30000 });
  await p.screenshot({ path: join(SORTIE, "3-studio-redemarre-envoi-en-attente-1440.png"), fullPage: true });
  await p.getByText(/envoyée/).nth(1).waitFor({ timeout: 60000 });
  await p.getByRole("button", { name: /Ajouter ce que vous dites/ }).first().click();
  await p.getByLabel(/Ce que vous dites dans IMG_7747/).fill("Vous perdez des heures chaque semaine sur des tâches que l'IA fait en deux minutes. Je vous montre comment.");
  await entree.setInputFiles([join(VIDEOS, "IMG_7802.MOV")]);
  await p.getByText(/Votre session a expiré/).waitFor({ timeout: 30000 });
  await pause(800);
  await p.screenshot({ path: join(SORTIE, "4-trois-prises-horizontale-texte-erreur-1440.png"), fullPage: true });
  await p.getByRole("button", { name: "Retirer IMG_7802.MOV" }).click();
  await pause(500);
  await p.screenshot({ path: join(SORTIE, "5-pret-animer-mes-2-videos-1440.png"), fullPage: true });

  const tel = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR", colorScheme: "dark", reducedMotion: "reduce", storageState: await bureau.storageState() });
  const m = await tel.newPage();
  await m.goto(`${BASE}/face-camera-animee`, { waitUntil: "networkidle", timeout: 120000 });
  await m.locator('input[type="file"]').first().setInputFiles([join(VIDEOS, "IMG_7747.MOV"), join(VIDEOS, "IMG_7801.MP4")]);
  await m.getByText(/envoyée/).nth(1).waitFor({ timeout: 60000 });
  await pause(800);
  await m.screenshot({ path: join(SORTIE, "6-telephone-deux-prises-390.png"), fullPage: true });
  await m.getByText("J'accepte l'essai réel de ce format").click();
  console.log("animer", new Date().toISOString());
  await m.getByRole("button", { name: /Animer mes 2 vidéos/ }).click();
  await m.waitForURL((u) => u.pathname.startsWith("/formats/facecam-animee"), { timeout: 150000 }).catch(() => undefined);
  await pause(2000);
  await m.screenshot({ path: join(SORTIE, "7-telephone-apres-animer-390.png"), fullPage: true });
  console.log("fin :", m.url());
  await navigateur.close();
} catch (e) {
  console.error(e);
  console.error(journal.slice(-4000));
  process.exitCode = 1;
} finally {
  arreter();
}
