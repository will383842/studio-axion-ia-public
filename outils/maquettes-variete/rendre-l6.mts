/**
 * L6 · RENDU LOCAL de vidéos COMPLÈTES du cas concret avec les mises en page branchées (aucun appel payant : Chromium
 * local, aucune voix générée). Fiche réelle : le script validé de « recrutement-apporteurs » (v4), calé sur les heures de
 * mots de `voix4.json` ; le son est celui de la vidéo de référence (`v4.mp4`, mêmes heures de mots). Chaque vidéo a sa
 * graine (`videoId`) : le tirage passe par le VRAI moteur (`tirer`, `mettre`, `jeuDeLEcran`), l'historique s'enrichit
 * d'une vidéo à l'autre, comme en production.
 *
 * Usage (racine du dépôt, après `pnpm install` et `npm --prefix studio-rendu ci`) :
 *   pnpm exec tsx outils/maquettes-variete/rendre-l6.mts [--videos] [--planche]
 * Sorties : outils/maquettes-variete/sortie/l6/ (MP4, images clés, planche, `tirages.json`).
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { EcranCale, ProprietesEcran } from "../../src/briques/ecrans-motion";

const { proprietesEcrans, imagesEcran } = await import("../../src/briques/ecrans-motion");
const { NOMS_MISES_EN_PAGE } = await import("../../src/briques/ecrans-motion/mises-en-page");
const { BANDE_SOUS_TITRES_CAS_CONCRET, BAS_FIL_CAS_CONCRET, FIN_APRES_DERNIER_MOT_SEC, ZONE_PLEINE_IMAGE_CAS_CONCRET } = await import("../../src/formats/cas-concret");
const { recrutementApporteurs } = await import("../../src/formats/cas-concret/catalogue/recrutement-apporteurs");
const { calerFiche } = await import("../../src/moteurs/montage-cas-concret/calage");
const { ecransCales } = await import("../../src/moteurs/montage-cas-concret/etapes");
const { clesImagesDuCas, imagesDuCas } = await import("../../src/moteurs/montage-cas-concret/visuels-du-cas");
const { dessinAuDessusDesSousTitres } = await import("../../src/moteurs/montage-cas-concret/zone-objets");
const V = await import("../../src/moteurs/montage-cas-concret/variete");
const { DOSSIER_V4, FICHIER_ANNONCE, FILM_FORMULAIRE_V4, capturesV4, ficheV4, finV4, motsV4 } = await import("../v4-fidelite/fiche-v4");

const RACINE = resolve(import.meta.dirname, "../..");
const SORTIE = join(RACINE, "outils/maquettes-variete/sortie/l6");
/** Vidéos sans sous-titres (hors dépôt). */
const CACHE = join(tmpdir(), "rendu-l6-sans-sous-titres");
mkdirSync(join(SORTIE, "images"), { recursive: true });
const args = process.argv.slice(2);
const avecVideos = args.includes("--videos") || !args.includes("--planche");
/** Noms de vidéos à rendre (sans argument : toutes). */
const seules = args.filter((x) => !x.startsWith("--"));
const ffmpeg = (a: string[]) => execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...a], { stdio: ["ignore", "pipe", "pipe"] });

/** Les vidéos : trois graines en 9:16, et la première aussi en 4:5. */
const VIDEOS = [
  { id: "l6-recrutement-graine-a", hauteur: 1920 },
  { id: "l6-recrutement-graine-b", hauteur: 1920 },
  { id: "l6-recrutement-graine-c", hauteur: 1920 },
  { id: "l6-recrutement-graine-a", hauteur: 1350 },
];
const CANAUX = ["instagram", "tiktok"];

/** Les écrans calés de la fiche réelle (corps et fin), sans jeu. */
function cales(src: (f: string) => string) {
  const calage = calerFiche(ficheV4(), finV4(), motsV4(RACINE), { finApresDernierMotSec: FIN_APRES_DERNIER_MOT_SEC });
  if (!calage.ok) throw new Error(calage.problemes.join("\n"));
  const { captures, parEcran } = capturesV4(src);
  const deposees = new Set(clesImagesDuCas(recrutementApporteurs));
  const images = imagesDuCas(calage.fiche, recrutementApporteurs, deposees);
  for (const [id, c] of Object.entries(images.captures)) {
    parEcran[id] = { cle: c.cle };
    captures[c.cle] = { ...c, src: src(FICHIER_ANNONCE) };
  }
  const corps = ecransCales(images.fiche.ecrans, calage.evenements, null, parEcran, recrutementApporteurs.faits);
  const fin = ecransCales(calage.fin!.ecrans, calage.evenements, calage.fin!, {});
  return { corps, fin, captures };
}

/** Propriétés rendues : le jeu de chaque écran (moteur), fond alterné posé comme dans `fabriquer.ts`. */
function proprietes(corps: EcranCale[], fin: EcranCale[], captures: Record<string, never>, mise: ReturnType<typeof V.mettre>, hauteur: number): ProprietesEcran[] {
  const avecJeu = corps.map((e) => {
    const jeu = V.jeuDeLEcran(mise, e.id);
    if (!jeu) return e;
    return typeof jeu.fondAlterne === "string" ? ({ ...e, fond: jeu.fondAlterne, jeu } as EcranCale) : { ...e, jeu };
  });
  const brutes = proprietesEcrans({ ecrans: [...avecJeu, ...fin], captures, zoneProtegee: { ...ZONE_PLEINE_IMAGE_CAS_CONCRET }, bandeSousTitres: BANDE_SOUS_TITRES_CAS_CONCRET, hauteur });
  return dessinAuDessusDesSousTitres(brutes).map((e) => ({ ...e, basFil: BAS_FIL_CAS_CONCRET * e.hauteur }));
}

const travail = mkdtempSync(join(tmpdir(), "rendu-l6-"));
const publics = join(travail, "public");
mkdirSync(publics);
const V4 = join(RACINE, DOSSIER_V4);
for (const f of ["pub.png", "rdv-entier.jpg"]) copyFileSync(join(V4, "rushes", f), join(publics, f));
ffmpeg(["-framerate", String(FILM_FORMULAIRE_V4.ips), "-i", join(V4, "rushes/form/f%03d.jpg"), "-vf", "fps=25,format=yuv420p", "-c:v", "libx264", "-crf", "18", join(publics, FILM_FORMULAIRE_V4.fichier)]);

const { corps, fin, captures } = cales((f) => `remotion-file:${f}`);
let historique: ReturnType<typeof V.lireHistorique> = [];
const tirages: Record<string, unknown>[] = [];
const plans: { video: string; hauteur: number; props: ProprietesEcran[] }[] = [];
const mises = new Map<string, ReturnType<typeof V.mettre>>();
for (const v of VIDEOS) {
  let mise = mises.get(v.id);
  if (!mise) {
    const tirage = V.tirer({ videoId: v.id, canaux: CANAUX, historique });
    mise = V.mettre(tirage, corps.map((e) => ({ id: e.id, type: e.type, fond: e.fond, contenu: e })), historique);
    historique = V.ajouterAHistorique(historique, V.entreeHistorique(v.id, CANAUX, mise.tirage, "2026-10-16T12:00:00.000Z"));
    mises.set(v.id, mise);
  }
  const props = proprietes(corps, fin, captures as Record<string, never>, mise, v.hauteur);
  plans.push({ video: v.id, hauteur: v.hauteur, props });
  tirages.push({
    video: v.id,
    format: v.hauteur === 1920 ? "9:16" : "4:5",
    graine: mise.tirage.graine,
    combinaison: mise.tirage.misesEnPage,
    ecrans: props.map((p) => ({ id: p.id, type: p.type, fond: p.fond, miseEnPage: p.jeu?.miseEnPage ? `${p.jeu.miseEnPage} · ${NOMS_MISES_EN_PAGE[p.jeu.miseEnPage as keyof typeof NOMS_MISES_EN_PAGE] ?? ""}` : "v4", ...(p.jeu?.raccordEntree ? { raccordEntree: p.jeu.raccordEntree } : {}), ...(p.jeu?.raccordSortie ? { raccordSortie: p.jeu.raccordSortie } : {}), ...(p.jeu?.fondFort ? { fondFort: true } : {}) })),
  });
}
writeFileSync(join(SORTIE, "tirages.json"), JSON.stringify(tirages, null, 1) + "\n");

const exiger = createRequire(join(RACINE, "studio-rendu/package.json"));
const { bundle } = exiger("@remotion/bundler");
const { renderMedia, renderStill, selectComposition } = exiger("@remotion/renderer");
const reglages = { browserExecutable: process.env.STUDIO_RENDU_NAVIGATEUR ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", chromiumOptions: { gl: "swangle" }, logLevel: "error" };
const serveUrl: string = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts"), publicDir: publics });

try {
  for (const v of plans) {
    const nom = `${v.video}${v.hauteur === 1350 ? "-4x5" : ""}`;
    if (seules.length && !seules.includes(nom)) continue;
    const morceaux: string[] = [];
    for (const p of v.props) {
      const inputProps = p as unknown as Record<string, unknown>;
      const composition = await selectComposition({ serveUrl, id: "CasConcretEcran", inputProps, ...reglages });
      // Image clé : 80 % de l'écran (animations posées), pour la planche.
      const cle = Math.min(composition.durationInFrames - 1, Math.round(imagesEcran(p) * 0.8));
      await renderStill({ composition, serveUrl, output: join(SORTIE, "images", `${nom}-${p.id}.jpg`), frame: cle, inputProps, imageFormat: "jpeg", jpegQuality: 80, ...reglages });
      if (avecVideos) {
        const f = join(travail, `${nom}-${p.id}.mp4`);
        await renderMedia({ composition, serveUrl, codec: "h264", crf: 30, muted: true, outputLocation: f, inputProps, concurrency: 4, ...reglages });
        morceaux.push(f);
      }
      console.log(`${nom} · ${p.id} (${p.type}) ${p.jeu?.miseEnPage ?? "v4"}${p.jeu?.raccordEntree ? ` +${p.jeu.raccordEntree}` : ""}`);
    }
    if (avecVideos) {
      const liste = join(travail, `${nom}.txt`);
      writeFileSync(liste, morceaux.map((m) => `file '${m}'`).join("\n"));
      const muet = join(travail, `${nom}-muet.mp4`);
      ffmpeg(["-f", "concat", "-safe", "0", "-i", liste, "-c", "copy", muet]);
      // Le son de la v4 (mêmes heures de mots que la fiche calée).
      const sortie = join(SORTIE, `${nom}.mp4`);
      ffmpeg(["-i", muet, "-i", join(V4, "v4.mp4"), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", "-shortest", sortie]);
      // Copie sans sous-titres (hors dépôt) : `planche-l6.mts` y incruste les sous-titres témoins, sans jamais les doubler.
      mkdirSync(CACHE, { recursive: true });
      copyFileSync(sortie, join(CACHE, `${nom}.mp4`));
      console.log(`→ ${sortie}`);
    }
  }
} finally {
  if (existsSync(travail)) rmSync(travail, { recursive: true, force: true });
}
