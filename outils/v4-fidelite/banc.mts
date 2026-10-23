/**
 * BANC DE MESURE DE FIDÉLITÉ À LA V4 (tâche V4-1, mission A).
 *
 * (a) extrait des images de la v4 (`docs/formats/v4-reference/v4.mp4`) à des instants donnés (ffmpeg) ;
 * (b) rend les mêmes instants avec le moteur du format (composition `CasConcretEcran`, rendu Remotion local) à partir du
 *     MÊME texte et des MÊMES heures de mots (`fiche-v4.ts` : fiche équivalente, calée sur `voix4.json`) ;
 * (c) compare image par image : SSIM (ffmpeg, en niveaux de gris, bande des sous-titres de la v4 masquée dans les deux
 *     images, et sans masque), planche côte à côte, et relevé des composants (positions, tailles, couleurs) lus dans le
 *     DOM de `v4.html` et dans la mise en page du format (`disposer`) ;
 * (d) écrit `docs/formats/v4-reference/RAPPORT-ECARTS.md` (score par scène, liste des écarts) et `mesures.json`.
 *
 * Aucun appel payant : ni voix, ni Claude, ni stockage. Rendu local gratuit.
 *
 * Usage (racine du studio, après `pnpm install` et `npm --prefix studio-rendu ci`) :
 *   pnpm exec tsx outils/v4-fidelite/banc.mts [--etat avant|apres|v4-2|v4-3] [--sortie dossier] [--sans-rapport]
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/chrome   navigateur sans affichage (sinon celui de Playwright, s'il est là)
 * `--etat avant` : la fiche telle que le format la fabriquait avant la mission B (étape « L'annonce » sans image) ;
 * `--etat apres` : avec l'image de l'annonce fournie par le cas, dans la zone sûre commune des 4 réseaux (fin de V4-1) ;
 * `--etat v4-2` : zone pleine image (V4-2, mission D) ; le rapport la compare à `apres`.
 * `--etat v4-3` (défaut) : la chaîne d'aujourd'hui (script validé de la v4 : liste « avant » sur un écran, annonce
 * zoomée) ; le rapport la compare à `v4-2` (mesures de `sortie/v4-2/`, prises sur la branche de V4-2).
 * Sortie (défaut `outils/v4-fidelite/sortie/<etat>/`, non commitée) : `v4-<t>.png`, `format-<t>.png`, `paire-<t>.jpg`,
 * `planche.jpg`, `mesures.json`.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import type { ProprietesEcran, ZoneProtegeePct } from "../../src/briques/ecrans-motion";

const { disposer, zonesEcran } = await import("../../src/briques/ecrans-motion");
const { zoneProtegeeCombinee } = await import("../../src/reseaux");
const { BANDE_SOUS_TITRES_CAS_CONCRET, ZONE_PLEINE_IMAGE_CAS_CONCRET } = await import("../../src/formats/cas-concret");
const { DOSSIER_V4, FILM_FORMULAIRE_V4, plansDesEcrans, proprietesV4 } = await import("./fiche-v4");

const RACINE = process.cwd();
const V4 = join(RACINE, DOSSIER_V4);
const args = process.argv.slice(2);
const val = (nom: string) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
};
const etat = (val("--etat") ?? "v4-3") as "avant" | "apres" | "v4-2" | "v4-3";
const pleineImage = etat === "v4-2" || etat === "v4-3";
const sortie = resolve(val("--sortie") ?? join(RACINE, "outils/v4-fidelite/sortie", etat));
const avecRapport = !args.includes("--sans-rapport");
mkdirSync(sortie, { recursive: true });
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c)) ?? null;

/** Bande des sous-titres de la v4 (`#st`, top 1600 px, 42 px sur une ou deux lignes), masquée pour la SSIM. */
const BANDE_ST_V4 = { y: 1580, hauteur: 200 };

const ffmpeg = (a: string[]) => execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...a], { stdio: ["ignore", "pipe", "pipe"] }).toString();

/* ------------------------------------------------------------------ */
/* 1. Plans de la v4 et composants, lus dans `v4.html`                   */
/* ------------------------------------------------------------------ */

type Composant = { sorte: string; texte: string; x: number; y: number; l: number; h: number; taille: number; couleur: string; police: string };
type PlanV4 = { id: string; a: number; b: number };
const nav = await chromium.launch(navigateur ? { executablePath: navigateur } : {});
const page = await nav.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(`file://${join(V4, "v4.html")}`);
const pret = (await page.evaluate("window.pret")) as { plans: string; duree: number };
const plansV4: PlanV4[] = pret.plans.split(" ").map((x, i, tous) => {
  const [id, a] = x.split("@");
  return { id, a: Number(a), b: i + 1 < tous.length ? Number(tous[i + 1].split("@")[1]) : pret.duree };
});

/** Composants visibles de la v4 à l'instant `t` (plan actif). */
async function composantsV4(t: number): Promise<Composant[]> {
  await page.evaluate(`window.rendre(${t})`);
  // Script en texte : le code compilé par tsx porte des aides (`__name`) absentes de la page.
  return page.evaluate(`(() => {
    const plan = [...document.querySelectorAll(".plan")].find((p) => p.style.display === "block");
    if (!plan) return [];
    const sorte = (el) => (el.classList.contains("lab") ? "etiquette" : el.classList.contains("mm") ? "affiche" : el.classList.contains("ligne") ? "ligne" : el.classList.contains("puce") ? "puce" : el.classList.contains("etiq") ? "pastille" : el.classList.contains("tel") ? "telephone" : el.tagName === "svg" ? "anneau" : "objet");
    const els = [...plan.querySelectorAll(".lab, .mm, .ligne, .puce, .etiq, .obj, .corps > svg")].filter((el) => !el.parentElement.closest(".obj"));
    const fil = document.getElementById("fil");
    return [...els, fil].map((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return { sorte: el === fil ? "fil" : sorte(el), texte: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 40), x: Math.round(r.x), y: Math.round(r.y), l: Math.round(r.width), h: Math.round(r.height), taille: parseFloat(s.fontSize), couleur: s.color, police: s.fontFamily.split(",")[0].replace(/"/g, ""), opacite: +s.opacity };
    }).filter((c) => c.l > 0 && c.h > 0);
  })()`) as Promise<Composant[]>;
}

/* ------------------------------------------------------------------ */
/* 2. Écrans du format                                                   */
/* ------------------------------------------------------------------ */

const zone = (pleineImage ? { ...ZONE_PLEINE_IMAGE_CAS_CONCRET } : zoneProtegeeCombinee("9:16", ["facebook", "instagram", "tiktok", "linkedin"])) as ZoneProtegeePct;
const ecrans: ProprietesEcran[] = proprietesV4(RACINE, zone, (f) => `remotion-file:${f}`, { avantCorrection: etat === "avant", pleineImage });
const planDe = plansDesEcrans();
const zones = zonesEcran(zone, 1080, 1920, BANDE_SOUS_TITRES_CAS_CONCRET);

/** Instants mesurés : deux par plan de la v4 (40 % et 85 % de sa durée : l'entrée faite, puis l'écran posé). */
const INSTANTS = plansV4.flatMap((p) => [0.4, 0.85].map((f) => ({ plan: p.id, t: +(p.a + (p.b - p.a) * f).toFixed(2) })));

/* ------------------------------------------------------------------ */
/* 3. Images : v4 (ffmpeg) et format (Remotion)                          */
/* ------------------------------------------------------------------ */

const travail = mkdtempSync(join(tmpdir(), "banc-v4-"));
const publics = join(travail, "public");
mkdirSync(publics);
for (const f of ["pub.png", "rdv-entier.jpg"]) copyFileSync(join(V4, "rushes", f), join(publics, f));
ffmpeg(["-framerate", String(FILM_FORMULAIRE_V4.ips), "-i", join(V4, "rushes/form/f%03d.jpg"), "-vf", "fps=25,format=yuv420p", "-c:v", "libx264", "-crf", "18", join(publics, FILM_FORMULAIRE_V4.fichier)]);

for (const { t } of INSTANTS) ffmpeg(["-ss", String(t), "-i", join(V4, "v4.mp4"), "-frames:v", "1", join(sortie, `v4-${t}.png`)]);

const exiger = createRequire(join(RACINE, "studio-rendu/package.json"));
type Choisie = { width: number; height: number; fps: number; durationInFrames: number };
type Reglages = { browserExecutable: string | null; chromiumOptions: { gl: "swangle" } };
const { bundle } = (await import(exiger.resolve("@remotion/bundler"))) as { bundle: (o: { entryPoint: string; publicDir: string }) => Promise<string> };
const { renderStill, selectComposition } = (await import(exiger.resolve("@remotion/renderer"))) as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> } & Reglages) => Promise<Choisie>;
  renderStill: (o: { composition: Choisie; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; imageFormat: "png" } & Reglages) => Promise<unknown>;
};
const reglages: Reglages = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle" } };

type Mesure = { plan: string; t: number; ecran: string; type: string; ssim: number; ssimBrut: number; iou: number; v4: Composant[]; format: Composant[] };
const mesures: Mesure[] = [];

/** Composants du format, lus dans la mise en page de la brique (textes posés et boîtes d'objets). */
function composantsFormat(p: ProprietesEcran): Composant[] {
  const m = disposer(p);
  const textes = m.textes.map((x) => ({ sorte: x.nom === "marque" ? "marque" : x.nom.startsWith("etiquette") ? "etiquette" : x.nom.startsWith("puce") ? "puce" : x.police === "anton" ? "affiche" : "ligne", texte: x.texte.replace(/\*/g, "").slice(0, 40), x: Math.round(x.boite.x), y: Math.round(x.boite.y), l: Math.round(x.boite.largeur), h: Math.round(x.boite.hauteur), taille: Math.round(x.tailleRendue), couleur: "", police: x.police }));
  const objets = m.boites.objets.map((o) => ({ sorte: "objet", texte: o.nom, x: Math.round(o.boite.x), y: Math.round(o.boite.y), l: Math.round(o.boite.largeur), h: Math.round(o.boite.hauteur), taille: 0, couleur: "", police: "" }));
  const fil = m.boites.fil ? [{ sorte: "fil", texte: "", x: Math.round(m.boites.fil.x), y: Math.round(m.boites.fil.y), l: Math.round(m.boites.fil.largeur), h: Math.round(m.boites.fil.hauteur), taille: 0, couleur: "", police: "" }] : [];
  return [...textes, ...objets, ...fil];
}

/** SSIM (niveaux de gris) entre deux images 1080 × 1920 ; `masque` : la bande des sous-titres de la v4 noircie dans les deux. */
function lireSsim(a: string, b: string, masque: boolean): number {
  const boite = masque ? `,drawbox=x=0:y=${BANDE_ST_V4.y}:w=1080:h=${BANDE_ST_V4.hauteur}:color=black:t=fill` : "";
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", a, "-i", b, "-lavfi", `[0]format=gray${boite}[x];[1]scale=1080:1920,format=gray${boite}[y];[x][y]ssim`, "-f", "null", "-"], { encoding: "utf8" });
  const m = /All:([0-9.]+)/.exec(r.stderr ?? "");
  if (!m) throw new Error(`SSIM illisible : ${(r.stderr ?? "").slice(-300)}`);
  return Number(m[1]);
}

/** Image en niveaux de gris, réduite à 270 × 480 (octets bruts), éventuellement floutée (`flou` : estimation du fond). */
function gris(f: string, flou = 0): Uint8Array {
  const filtre = `scale=270:480,format=gray${flou ? `,gblur=sigma=${flou}` : ""}`;
  return new Uint8Array(execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", f, "-vf", filtre, "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 24 }));
}
/** Masque du contenu : pixels qui se détachent du fond lissé (écart > 18 niveaux), bande des sous-titres de la v4 exclue. */
function masqueContenu(f: string): Uint8Array {
  const net = gris(f);
  const fond = gris(f, 30);
  const haut = Math.round((BANDE_ST_V4.y / 1920) * 480);
  const bas = Math.round(((BANDE_ST_V4.y + BANDE_ST_V4.hauteur) / 1920) * 480);
  return net.map((v, i) => {
    const y = Math.floor(i / 270);
    return y >= haut && y < bas ? 0 : Math.abs(v - fond[i]) > 18 ? 1 : 0;
  });
}
/** Recouvrement des formes (IoU des masques de contenu), après une dilatation de 2 px pour tolérer l'anticrénelage. */
function recouvrement(a: string, b: string): number {
  const dilate = (m: Uint8Array) => m.map((_, i) => {
    const x = i % 270;
    const y = Math.floor(i / 270);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx >= 0 && xx < 270 && yy >= 0 && yy < 480 && m[yy * 270 + xx]) return 1;
    }
    return 0;
  });
  const ma = dilate(masqueContenu(a));
  const mb = dilate(masqueContenu(b));
  let inter = 0;
  let union = 0;
  for (let i = 0; i < ma.length; i++) {
    inter += ma[i] & mb[i];
    union += ma[i] | mb[i];
  }
  return union ? inter / union : 1;
}

try {
  const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts"), publicDir: publics });
  for (const { plan, t } of INSTANTS) {
    const ms = t * 1000;
    const p = ecrans.find((e) => ms >= e.debutMs && ms < e.finMs) ?? ecrans[ecrans.length - 1];
    const inputProps = p as unknown as Record<string, unknown>;
    const composition = await selectComposition({ serveUrl, id: "CasConcretEcran", inputProps, ...reglages });
    const image = Math.min(composition.durationInFrames - 1, Math.max(0, Math.round(((ms - p.debutMs) / 1000) * composition.fps)));
    const fichier = join(sortie, `format-${t}.png`);
    await renderStill({ composition, serveUrl, output: fichier, frame: image, inputProps, imageFormat: "png", ...reglages });
    const ref = join(sortie, `v4-${t}.png`);
    const m: Mesure = { plan, t, ecran: p.id, type: p.type, ssim: lireSsim(ref, fichier, true), ssimBrut: lireSsim(ref, fichier, false), iou: recouvrement(ref, fichier), v4: await composantsV4(t), format: composantsFormat(p) };
    mesures.push(m);
    if (planDe[p.id] !== plan) console.warn(`${t} s : l'écran ${p.id} reproduit ${planDe[p.id]}, la v4 montre ${plan}`);
    // Paire côte à côte (540 × 960 chacune), v4 à gauche.
    ffmpeg(["-i", ref, "-i", fichier, "-filter_complex", "[0]scale=540:960[a];[1]scale=540:960[b];[a][b]hstack", "-q:v", "4", join(sortie, `paire-${t}.jpg`)]);
    console.log(`${t} s · ${plan} → ${p.id} (${p.type}) · SSIM ${m.ssim.toFixed(3)} (brut ${m.ssimBrut.toFixed(3)}) · formes ${m.iou.toFixed(2)}`);
  }
  // Vue d'ensemble : une paire par plan (instant posé), en petit, 6 par rangée.
  const posees = INSTANTS.filter((_, i) => i % 2 === 1).map(({ t }) => join(sortie, `paire-${t}.jpg`));
  const entrees = posees.flatMap((f) => ["-i", f]);
  const disposition = posees.map((_, i) => `${(i % 6) * 540}_${Math.floor(i / 6) * 480}`).join("|");
  ffmpeg([...entrees, "-filter_complex", `${posees.map((_, i) => `[${i}]scale=540:480[p${i}]`).join(";")};${posees.map((_, i) => `[p${i}]`).join("")}xstack=inputs=${posees.length}:layout=${disposition}:fill=black`, "-q:v", "5", join(sortie, "planche.jpg")]);
} finally {
  await nav.close();
  rmSync(travail, { recursive: true, force: true });
}

/* ------------------------------------------------------------------ */
/* 4. Rapport                                                            */
/* ------------------------------------------------------------------ */

const parPlan = plansV4.map((p) => {
  const ms = mesures.filter((m) => m.plan === p.id);
  return { plan: p.id, debut: p.a, fin: p.b, ecrans: [...new Set(ms.map((m) => `${m.ecran} (${m.type})`))].join(", "), ssim: ms.reduce((s, m) => s + m.ssim, 0) / ms.length, ssimBrut: ms.reduce((s, m) => s + m.ssimBrut, 0) / ms.length, iou: ms.reduce((s, m) => s + m.iou, 0) / ms.length };
});
const moyenne = parPlan.reduce((s, p) => s + p.ssim, 0) / parPlan.length;
const moyenneIou = parPlan.reduce((s, p) => s + p.iou, 0) / parPlan.length;
writeFileSync(join(sortie, "mesures.json"), JSON.stringify({ etat, zones, instants: mesures, parPlan, moyenne, moyenneIou }, null, 1));
console.log(`SSIM moyen (sous-titres masqués) : ${moyenne.toFixed(3)} · ${parPlan.filter((p) => p.ssim >= 0.9).length}/${parPlan.length} plans ≥ 0,90 · recouvrement des formes moyen ${moyenneIou.toFixed(2)}`);
if (avecRapport) {
  const { ecrireRapport } = await import("./rapport");
  ecrireRapport(join(V4, "RAPPORT-ECARTS.md"), { etat, parPlan, mesures, zones, moyenne, moyenneIou });
  console.log(`Rapport : ${join(V4, "RAPPORT-ECARTS.md")}`);
}
console.log(`Sortie : ${sortie}`);
