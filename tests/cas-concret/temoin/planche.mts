/**
 * PLANCHE DE CONTRÔLE de la fiche témoin (T1, T1b) : rend 12 images fixes de la vidéo 1 aux instants des
 * `reference/ref-<t>.jpg` et pose chacune à côté de sa référence (à gauche la référence, à droite le studio).
 * Rendu local Remotion (gratuit, aucun service payant, aucune voix) : à lancer en routine cloud ou sur le serveur,
 * jamais sur le PC de Will.
 *
 * Usage (depuis la racine du studio, après `npm --prefix studio-rendu ci`) :
 *   pnpm exec tsx tests/cas-concret/temoin/planche.mts [dossier de sortie]
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/chrome   navigateur sans affichage (sinon celui de Playwright, s'il est là)
 *   FFMPEG=/chemin/ffmpeg                    pour assembler le film du formulaire (sinon `ffmpeg`, puis celui de Remotion)
 * Sortie (dossier par défaut : `tests/cas-concret/temoin/planche`) :
 *   - `temoin-<t>.jpg` : 1080 × 960, référence à gauche, studio à droite, sans aucun cadre ajouté ;
 *   - `zones-<t>.jpg` : la même, avec sur le studio le cadre de la zone de texte et la bande des sous-titres ;
 *   - `planche-temoin.jpg` : les 12 côte à côte, en petit (vue d'ensemble).
 *
 * La composition `CasConcretEcran` est rendue par la racine du rendu (`compositions/index.ts`, raccord R1b). Les vrais
 * écrans (`reference/rushes/`) sont servis au rendu comme fichiers publics ; le formulaire, six images, y devient un
 * court film. Les sous-titres ne sont pas dessinés (ils sont posés au montage) : la référence les montre.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import type { ProprietesEcran, ZoneProtegeePct } from "../../../src/briques/ecrans-motion";

// Modules du studio chargés dynamiquement : tsx les sert en CommonJS, dont les « export * » n'ont pas de noms statiques.
const { zonesEcran } = await import("../../../src/briques/ecrans-motion");
const { calerFiche } = await import("../../../src/moteurs/montage-cas-concret/calage");
const { zoneProtegeeCombinee } = await import("../../../src/reseaux");
const { BANDE_SOUS_TITRES_CAS_CONCRET } = await import("../../../src/formats/cas-concret");
const { ecransCales, FILM_FORMULAIRE, ficheTemoin, finTemoin, motsDitsTemoin, proprietesTemoin } = await import("./fiche-temoin");

const RACINE = process.cwd();
const REF = join(RACINE, "tests/cas-concret/temoin/reference");
const sortie = resolve(process.argv[2] ?? join(RACINE, "tests/cas-concret/temoin/planche"));
mkdirSync(sortie, { recursive: true });
const travail = mkdtempSync(join(tmpdir(), "planche-temoin-"));
const publics = join(travail, "public");
mkdirSync(publics);

/** Instants des images de référence, lus dans les noms `ref-<t>.jpg`. */
const INSTANTS = ["0.8", "2.5", "6", "13", "14.8", "16", "19.5", "23.5", "27", "32", "41", "47"];

// Vrais écrans : la publicité et la page du rendez-vous telles quelles, le formulaire en film (une image par 1/6 s).
for (const f of ["pub.png", "rdv-entier.jpg"]) copyFileSync(join(REF, "rushes", f), join(publics, f));
const ffmpeg = (() => {
  if (process.env.FFMPEG) return { bin: process.env.FFMPEG, env: process.env };
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return { bin: "ffmpeg", env: process.env };
  } catch {
    const dossier = dirname(createRequire(join(RACINE, "studio-rendu/package.json")).resolve("@remotion/compositor-linux-x64-gnu/package.json"));
    return { bin: join(dossier, "ffmpeg"), env: { ...process.env, LD_LIBRARY_PATH: dossier } };
  }
})();
FILM_FORMULAIRE.images.forEach((f, i) => copyFileSync(join(REF, "rushes", f), join(travail, `form-${String(i).padStart(3, "0")}.jpg`)));
execFileSync(
  ffmpeg.bin,
  ["-y", "-loglevel", "error", "-framerate", String(FILM_FORMULAIRE.ips), "-i", join(travail, "form-%03d.jpg"), "-vf", "fps=25,format=yuv420p", "-c:v", "libx264", "-crf", "18", join(publics, FILM_FORMULAIRE.fichier)],
  { env: ffmpeg.env },
);

type MotDit = { word: string; start: number; end: number };
const tempo = (JSON.parse(readFileSync(join(REF, "plans.json"), "utf8")) as { tempo: number }).tempo;
const mots = (JSON.parse(readFileSync(join(REF, "mots.json"), "utf8")) as { mots: MotDit[] }).mots;
const calage = calerFiche(ficheTemoin(), finTemoin(), motsDitsTemoin(mots, tempo), { finApresDernierMotSec: 2.1 });
if (!calage.ok) throw new Error(`Le calage de la fiche témoin échoue :\n${calage.problemes.join("\n")}`);
const zone = zoneProtegeeCombinee("9:16", ["facebook", "instagram", "tiktok", "linkedin"]);
if (!zone) throw new Error("Zone protégée commune introuvable.");
// `remotion-file:` : fichier du dossier public, résolu par Remotion à l'adresse servie au rendu.
const ecrans: ProprietesEcran[] = proprietesTemoin(ecransCales(calage.fiche.ecrans, calage.fin?.ecrans ?? [], calage.evenements), zone as ZoneProtegeePct, (f) => `remotion-file:${f}`);
const zones = zonesEcran(zone as ZoneProtegeePct, 1080, 1920, BANDE_SOUS_TITRES_CAS_CONCRET);

const exiger = createRequire(join(RACINE, "studio-rendu/package.json"));
interface CompositionChoisie {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}
type Reglages = { browserExecutable: string | null; chromiumOptions: { gl: "swangle" } };
const { bundle } = (await import(exiger.resolve("@remotion/bundler"))) as { bundle: (o: { entryPoint: string; publicDir: string }) => Promise<string> };
const { renderStill, selectComposition } = (await import(exiger.resolve("@remotion/renderer"))) as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> } & Reglages) => Promise<CompositionChoisie>;
  renderStill: (o: { composition: CompositionChoisie; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; imageFormat: "jpeg"; jpegQuality: number } & Reglages) => Promise<unknown>;
};
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c)) ?? null;
const reglages: Reglages = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle" } };

const rendus: { t: string; id: string; fichier: string }[] = [];
try {
  const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts"), publicDir: publics });
  for (const t of INSTANTS) {
    const ms = Number(t) * 1000;
    const p = ecrans.find((e) => ms >= e.debutMs && ms < e.finMs) ?? ecrans[ecrans.length - 1];
    const inputProps = p as unknown as Record<string, unknown>;
    const composition = await selectComposition({ serveUrl, id: "CasConcretEcran", inputProps, ...reglages });
    const image = Math.min(composition.durationInFrames - 1, Math.max(0, Math.round(((ms - p.debutMs) / 1000) * composition.fps)));
    const fichier = join(travail, `rendu-${t}.jpg`);
    await renderStill({ composition, serveUrl, output: fichier, frame: image, inputProps, imageFormat: "jpeg", jpegQuality: 95, ...reglages });
    rendus.push({ t, id: p.id, fichier });
    console.log(`${t} s · écran ${p.id} (${p.type}) · image ${image}`);
  }

  // Images côte à côte, 1080 × 960 : chaque moitié à la moitié de la taille de la vidéo (540 × 960).
  const nav = await chromium.launch(navigateur ? { executablePath: navigateur } : {});
  const page = await nav.newPage({ viewport: { width: 1080, height: 960 } });
  const donnee = (f: string) => `data:image/jpeg;base64,${readFileSync(f).toString("base64")}`;
  const cadre = (b: { x: number; y: number; largeur: number; hauteur: number }, couleur: string) =>
    `<div style="position:absolute;left:${540 + b.x / 2}px;top:${b.y / 2}px;width:${b.largeur / 2}px;height:${b.hauteur / 2}px;border:2px dashed ${couleur};box-sizing:border-box"></div>`;
  for (const r of rendus) {
    for (const [nom, calque] of [
      ["temoin", ""],
      ["zones", cadre(zones.texte, "#00E5FF") + cadre(zones.sousTitres, "#FF2BD6")],
    ] as const) {
      await page.setContent(
        `<html><body style="margin:0;width:1080px;height:960px;position:relative;overflow:hidden;background:#000">` +
          `<img src="${donnee(join(REF, `ref-${r.t}.jpg`))}" style="position:absolute;left:0;top:0;width:540px;height:960px">` +
          `<img src="${donnee(r.fichier)}" style="position:absolute;left:540px;top:0;width:540px;height:960px">${calque}</body></html>`,
      );
      await page.waitForTimeout(100);
      const f = join(sortie, `${nom}-${r.t}.jpg`);
      await page.screenshot({ path: f, type: "jpeg", quality: 80 });
      const ko = statSync(f).size / 1024;
      if (ko >= 150) console.warn(`${nom}-${r.t}.jpg : ${ko.toFixed(0)} Ko (au-delà de 150 Ko)`);
    }
  }

  // Vue d'ensemble : la référence en haut, le studio en bas, au quart de la taille.
  await page.setViewportSize({ width: INSTANTS.length * 282 + 6, height: 1050 });
  const cases = (dossier: (t: string) => string, legende: (r: { t: string; id: string }) => string) =>
    rendus.map((r) => `<figure><img src="${donnee(dossier(r.t))}"><figcaption>${legende(r)}</figcaption></figure>`).join("");
  await page.setContent(
    `<html><body style="margin:0;background:#222;padding:6px"><style>div{display:flex;gap:12px;margin-bottom:12px}figure{margin:0;width:270px}img{width:270px;height:480px;object-fit:cover;display:block}figcaption{color:#eee;font:20px sans-serif;text-align:center;padding-top:4px}</style>` +
      `<div>${cases((t) => join(REF, `ref-${t}.jpg`), (r) => `référence ${r.t} s`)}</div><div>${cases((t) => join(travail, `rendu-${t}.jpg`), (r) => `studio ${r.t} s · ${r.id}`)}</div></body></html>`,
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(sortie, "planche-temoin.jpg"), type: "jpeg", quality: 80 });
  await nav.close();
} finally {
  rmSync(travail, { recursive: true, force: true });
}
console.log(`Planche : ${sortie}`);
