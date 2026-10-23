/**
 * PREUVE DU LOT M4 — rend EN LOCAL une vraie vidéo de démonstration au format avocat, avec le VRAI code :
 *   voix de synthèse de Windows (`fabriquer-voix-demo.ps1`, aucun service payant) → report des horodatages →
 *   découpage en plans (B.2) → sous-titres (lot M2) → paramètres de composition (lot M4) → opération `composition`
 *   de `studio-rendu` (Remotion + FFmpeg) pour 9:16, 4:5 et 1:1 → mesures sur les fichiers exportés.
 * Le double est SIMULÉ : une silhouette rendue d'abord en webm VP9 transparent 1080 × 1920 (comme un double HeyGen
 * entraîné avec `matting`), ce qui mesure aussi le décodage d'un webm alpha 1080p. Décor N1 Halo orange, LUT Axion
 * Clair-obscur à 70 %, une illustration de la démonstration, un montant en incrustation, le micro dessiné.
 *
 * Usage (racine du dépôt) : `pnpm exec tsx outils/demo-m4/rendre-demo.mts`
 * Sorties : docs/captures/m4-demo/ (la vidéo 9:16, les captures, les mesures) ; 4:5 et 1:1 dans le dossier temporaire.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { availableParallelism, cpus, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import type { CommandeFabrication, MotHorodate, SegmentSousTitres } from "@/domaine/types";
// Essai sur ce poste (entrées servies par 127.0.0.1) : mode essai EXPLICITE de studio-rendu (relecture sécurité R45).
process.env.STUDIO_RENDU_ESSAI ??= "1";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const SORTIE = join(RACINE, "docs", "captures", "m4-demo");
const TRAVAIL = join(tmpdir(), "studio-m4-demo");
mkdirSync(SORTIE, { recursive: true });
mkdirSync(TRAVAIL, { recursive: true });
// Lot M4b : la démonstration d'avant (lot M4) est gardée sous « v1 », jamais effacée.
const V1 = join(SORTIE, "v1");
if (!existsSync(V1)) {
  const anciens = readdirSync(SORTIE).filter((f) => statSync(join(SORTIE, f)).isFile());
  if (anciens.length) {
    mkdirSync(V1);
    for (const f of anciens) renameSync(join(SORTIE, f), join(V1, f));
  }
}

// Les modules du studio sont lus en CommonJS par tsx : leurs exports peuvent être sur `default`.
const charger = async <T,>(m: string): Promise<T> => {
  const x = (await import(m)) as T & { default?: T };
  return (x.default ?? x) as T;
};
const report = await charger<typeof import("@/moteurs/montage-avocat/report")>("@/moteurs/montage-avocat/report");
const decoupage = await charger<typeof import("@/moteurs/montage-avocat/decoupage")>("@/moteurs/montage-avocat/decoupage");
const comp = await charger<typeof import("@/moteurs/montage-avocat/composition")>("@/moteurs/montage-avocat/composition");
const brique = await charger<typeof import("@/briques/sous-titres")>("@/briques/sous-titres");
const avocat = await charger<typeof import("@/formats/avocat")>("@/formats/avocat");
const elements = await charger<typeof import("@/donnees/elements-avocat")>("@/donnees/elements-avocat");
const decors = await charger<typeof import("@/donnees/decors-catalogue")>("@/donnees/decors-catalogue");
const { composition } = await import("../../studio-rendu/src/operations/composition");
const { servirDossier } = await import("../../studio-rendu/src/composition/serveur-fichiers");
const { paquetCompositions, REGLAGES_RENDU, coeursDisponibles } = await import("../../studio-rendu/src/remotion");
const scene = await charger<typeof import("@/moteurs/montage-avocat/scene")>("@/moteurs/montage-avocat/scene");

/* --- 1. Le script (texte VALIDÉ) et la voix (texte PRONONCÉ, horodaté par Windows) --- */
const segments = [
  { id: "s1", bloc: "accroche", texte: "Vous recevez un PV de 135 € ?", emphase: ["135 €"], titreEcran: "Amende : l'erreur que tout le monde fait" },
  { id: "s2", bloc: "promesse", texte: "Ne le payez pas tout de suite : je vous explique pourquoi.", emphase: ["pas"] },
  { id: "s3", bloc: "coeur", texte: "Vous avez quarante-cinq jours pour le contester, et une seule erreur sur l'avis suffit.", emphase: ["quarante-cinq jours"], intentionIllustration: "un avis de contravention sur une table" },
  { id: "s4", bloc: "preuve", texte: "Un client a économisé 2 500 € comme ça.", emphase: ["2 500 €"], incrustation: { type: "montant" as const, texte: "+ 2 500 €", sens: "gain" as const } },
  { id: "s5", bloc: "appel", texte: "Gardez cette vidéo pour le prochain PV.", emphase: ["prochain"] },
];
const prononciations = [
  { mot: "PV", prononciation: "pé vé" },
  { mot: "135 €", prononciation: "cent trente-cinq euros" },
  { mot: "2 500 €", prononciation: "deux mille cinq cents euros" },
];
const VOIX = join(ICI, "voix-demo.wav");
if (!existsSync(VOIX)) throw new Error("Lancez d'abord : powershell -File outils/demo-m4/fabriquer-voix-demo.ps1");
const debuts = (JSON.parse(readFileSync(join(ICI, "voix-demo.debuts.json"), "utf8").replace(/^﻿/, "")) as { mot: string; debutSec: number }[]);
// Fin de chaque mot mesurée sur le son (dernière trame de 10 ms au-dessus de −40 dBFS avant le mot suivant).
const pcm = spawnSync("ffmpeg", ["-v", "error", "-i", VOIX, "-f", "f32le", "-ac", "1", "-ar", "48000", "-"], { maxBuffer: 1 << 28 }).stdout;
const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4);
const dureeVoix = x.length / 48000;
const db = (i: number) => {
  let s = 0;
  for (let k = i; k < Math.min(i + 480, x.length); k++) s += x[k] * x[k];
  return 10 * Math.log10(s / 480 + 1e-12);
};
const renvoyes: MotHorodate[] = debuts.map((d, i) => {
  const limite = i + 1 < debuts.length ? debuts[i + 1].debutSec : dureeVoix;
  let fin = d.debutSec + 0.05;
  for (let t = Math.floor(d.debutSec * 48000); t < Math.floor(limite * 48000) - 480; t += 480) if (db(t) > -40) fin = (t + 480) / 48000;
  return { mot: d.mot, debutSec: d.debutSec, finSec: +Math.min(limite, fin).toFixed(3) };
});
const texteVoix = report.preparerTexteVoix(segments, prononciations);
const mots = report.reporterHorodatages(texteVoix, renvoyes);
console.log(`voix : ${dureeVoix.toFixed(2)} s, ${renvoyes.length} mots prononcés → ${mots.length} mots validés`);

/* --- 2. Découpage (B.2) : l'illustration est verrouillée sur la phrase du cœur --- */
const recette = avocat.RECETTE_MONTAGE_AVOCAT;
const plansIndicatifs = [
  { id: "ind-1", ordre: 1, debutSec: 0, finSec: 2, texte: segments[0].texte, sourceImage: "double" as const, segmentId: "s1", texteEcran: { texte: segments[0].titreEcran!, position: "centre" as const, style: "encadre" as const, positionPct: 60 } },
  { id: "ind-3", ordre: 3, debutSec: 6, finSec: 8, texte: segments[2].texte, sourceImage: "illustration" as const, segmentId: "s3", illustration: { source: "bibliotheque" as const, elementId: "illu-02", requete: "avis", verrouille: true, candidats: [] } },
];
const segDecoupage = segments.map((s) => ({ id: s.id, texte: s.texte, bloc: s.bloc, emphase: s.emphase, intentionIllustration: s.intentionIllustration, incrustation: s.incrustation }));
const plans = decoupage.decouperEnPlans({ mots, segments: segDecoupage, plansIndicatifs, recette, style: elements.STYLE_MONTAGE_AVOCAT, repartition: recette.angles.repartitionParDefaut, deuxAngles: false, ouvertureSurIllustration: false, illustrations: true, levresNote: 92, dureeAudioSec: dureeVoix });
const dureeSec = plans.at(-1)!.finSec;
const alertesRythme = decoupage.controlerRythme(plans, { recette, style: elements.STYLE_MONTAGE_AVOCAT, mots, segments: segDecoupage });
console.log(`plans : ${plans.length}, durée ${dureeSec.toFixed(2)} s`);
for (const p of plans) console.log(`  ${p.ordre}. ${p.debutSec.toFixed(2)}-${p.finSec.toFixed(2)} ${p.sourceImage}${p.cadrage.valeur ? ` ${p.cadrage.valeur} ${Math.round(p.cadrage.zoom * 100)}→${Math.round((p.cadrage.zoomFin ?? p.cadrage.zoom) * 100)} %` : ""}${p.incrustation ? " +montant" : ""}  « ${p.texte} »`);

/* --- 3. Sous-titres (lot M2), calés sur les coupes --- */
const sousTitres: SegmentSousTitres[] = brique.fabriquerSousTitres({
  texte: segments.map((s) => s.texte).join(" "),
  dureeSec,
  mots,
  prononciations,
  emphase: segments.flatMap((s) => s.emphase),
  style: elements.STYLE_SOUS_TITRES_AVOCAT,
  base: "karaoke",
  intensite: "equilibre",
  coupesSec: plans.slice(1).map((p) => p.debutSec),
  reseaux: avocat.formatAvocat.reseauxConseilles,
  motsTitre: ["Amende", "erreur"],
});

/* --- 4. La commande (ce que le service construit), fichiers servis en local --- */
const n1 = decors.decorsCatalogue(new Date().toISOString()).find((d) => d.id === "decor-n1-halo-orange")!;
const commande = {
  versionContrat: 2,
  moteurId: "montage-avocat",
  videoId: "demo-m4",
  formatId: "avocat",
  versionFormat: 2,
  profilRenduVersion: 1,
  dureeCibleSec: dureeSec,
  ratios: ["9:16", "4:5", "1:1"],
  script: { blocs: segments.map((s) => ({ id: `b-${s.id}`, blocRecette: s.bloc, segments: [{ id: s.id, texte: s.texte, emphase: s.emphase, titreEcran: s.titreEcran, incrustation: s.incrustation }] })), texteComplet: segments.map((s) => s.texte).join(" ") },
  distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: { "trois-quarts": { visageId: "vis-essai", levresNote: 92 } } }],
  styles: {
    lut: { id: "lut-avocat-v1", nom: "Axion clair-obscur (v1)", intensite: 70, cible: ["personnage", "illustrations", "rushs", "decor", "accessoire"], origine: "format" },
    sousTitres: { id: "st-avocat-v1", nom: "Avocat", valeur: elements.STYLE_SOUS_TITRES_AVOCAT },
    habillage: { id: "hab-avocat-v1", nom: "Avocat", valeur: elements.HABILLAGE_AVOCAT },
    styleMontage: { id: "sm-avocat-v1", nom: "Avocat", valeur: elements.STYLE_MONTAGE_AVOCAT },
    profilSon: { id: "ps-avocat-v1", nom: "Avocat", valeur: elements.PROFIL_SON_AVOCAT },
    musique: null,
    decor: { id: n1.id, nom: n1.nom, valeur: n1.valeur },
  },
  briques: { "sous-titres": true, etalonnage: true, illustrations: true, son: true, habillage: true, "texte-ecran": true, "mention-ia": false },
  entrees: {},
  reglages: { micro: true },
  plans: plansIndicatifs,
  prononciations,
  mentionIA: { active: false },
  budgetMax: { centimes: 15000, devise: "EUR" },
  adresse: "vous",
  accessoires: [{ id: "acc-micro-podcast", nom: "Micro de podcast", valeur: elements.ACCESSOIRE_MICRO }],
  profilRealisme: avocat.formatAvocat.profilRendu?.realisme,
  profilRendu: avocat.formatAvocat.profilRendu,
  recetteMontage: recette,
  construiteLe: new Date().toISOString(),
  sousTitres: { base: "karaoke", intensite: "equilibre" },
  medias: {
    "decor-n1-halo-orange": { cle: "fond-1-halo-orange.jpg", mime: "image/jpeg" },
    "lut-avocat-v1": { cle: "axion-buffer-clair-obscur.cube", mime: "text/plain", tailleCube: 65 },
    "illu-02": { cle: "illu-02.jpg", mime: "image/jpeg" },
  },
} as unknown as CommandeFabrication;

// Fichiers d'entrée servis comme le serait R2 (adresses http locales).
const ENTREES = join(TRAVAIL, "entrees");
mkdirSync(ENTREES, { recursive: true });
copyFileSync(join(RACINE, "public", "demo", "decors", "fond-1-halo-orange.jpg"), join(ENTREES, "fond-1-halo-orange.jpg"));
copyFileSync(join(RACINE, "public", "luts", "axion-buffer-clair-obscur.cube"), join(ENTREES, "axion-buffer-clair-obscur.cube"));
copyFileSync(join(RACINE, "public", "demo", "illustrations", "illu-02.jpg"), join(ENTREES, "illu-02.jpg"));
copyFileSync(VOIX, join(ENTREES, "voix-demo.wav"));

/* --- 5. Le double d'essai simulé : webm VP9 TRANSPARENT 1080 × 1920 (comme HeyGen avec `matting`) --- */
const exiger = (await import("node:module")).createRequire(join(RACINE, "studio-rendu", "package.json"));
const { renderMedia, selectComposition } = exiger("@remotion/renderer") as typeof import("../../studio-rendu/node_modules/@remotion/renderer");
const serveUrl = await paquetCompositions();
const webm = join(ENTREES, "double-essai.webm");
const images = Math.round(dureeSec * 25);
let tempsDouble = 0;
if (!existsSync(webm)) {
  const t0 = Date.now();
  const props = { tenue: "#1E2128", peau: "#C4967A", images };
  const c = await selectComposition({ serveUrl, id: "DoubleEssai", inputProps: props });
  await renderMedia({ composition: c, serveUrl, codec: "vp9", pixelFormat: "yuva420p", imageFormat: "png", outputLocation: webm, inputProps: props, concurrency: 4, chromiumOptions: { gl: "swangle" }, muted: true });
  tempsDouble = (Date.now() - t0) / 1000;
  console.log(`double d'essai (webm alpha) : ${tempsDouble.toFixed(1)} s`);
}
const serveur = await servirDossier(ENTREES);

/* --- 6. Composition pour chaque format d'image --- */
const resultats: Record<string, unknown> = {};
// `DEMO_MESURE=<nom>` (lot M4b) : 9:16 seulement, rien n'est écrit dans docs/ ; les temps vont dans
// <dossier temporaire>/studio-m4-demo/mesure-<nom>.json (essais avec moins de cœurs, par exemple sous `start /affinity`).
const MESURE = process.env.DEMO_MESURE?.trim();
for (const ratio of (MESURE ? ["9:16"] : ["9:16", "4:5", "1:1"]) as ("9:16" | "4:5" | "1:1")[]) {
  const p = comp.parametresComposition(commande, { ratio, plans, segments: sousTitres, dureeSec, mots: renvoyes, audioCle: "voix-demo.wav", pistesDouble: { "trois-quarts": "double-essai.webm" } });
  const entrees = Object.fromEntries(Object.entries(p.entrees).map(([nom, cle]) => [nom, `${serveur.base}/${cle}`]));
  const dossier = join(TRAVAIL, `m4b-rendu-${ratio.replace(":", "x")}`);
  mkdirSync(dossier, { recursive: true });
  const t0 = Date.now();
  let derniere = -10;
  const r = await composition(
    { idRendu: `demo-${ratio}`, operation: "composition", file: "longue", entrees, sortie: { urlDepot: "", cle: "video.mp4" }, parametres: { mode: "complet", ratio, dureeSec, image: p.image, texte: p.texte, couleurs: p.couleurs, son: p.son, export: p.export, depots: { master: { urlDepot: "", cle: "m" }, vignette: { urlDepot: "", cle: "v" } } } },
    {
      dossier,
      signal: new AbortController().signal,
      progression: (x) => {
        if (x - derniere >= 10) {
          derniere = x;
          process.stdout.write(`  ${ratio} ${Math.round(x)} %\n`);
        }
      },
    },
  );
  const secondes = (Date.now() - t0) / 1000;
  console.log(`${ratio} : ${secondes.toFixed(1)} s`, r.mesures);
  // Preuves des corrections M4b : encadré / sous-titres sans chevauchement, montant jamais écrit deux fois, capsule du micro entière.
  const fps = p.texte.fps;
  const e = p.texte.encadre;
  const boiteE = e ? comp.boiteEncadre(e, p.texte.largeur) : null;
  const basST = e && p.texte.sousTitres ? comp.basSousTitres(p.texte.sousTitres, e.deSec, e.aSec, fps) : null;
  const montantsEnDouble = p.texte.incrustations
    .filter((i) => i.type === "montant")
    .flatMap((i) => (p.texte.sousTitres?.segments ?? []).filter((s) => s.debutSec < i.aSec && i.deSec < s.finSec && comp.montantDit(i.texte ?? "", s.mots.map((m) => m.mot).join(" "))).map((s) => s.mots.map((m) => m.mot).join(" ")));
  const capsule = p.image.accessoire ? scene.boiteCapsule(p.image.accessoire) : null;
  const capsuleEntiere = capsule ? p.image.plans.filter((pl) => pl.type === "double").every((pl) => scene.contenuDans(capsule, scene.fenetreSource(ratio, pl, pl.debutSec, p.image.reductionLarge)) && scene.contenuDans(capsule, scene.fenetreSource(ratio, pl, pl.finSec - 1e-3, p.image.reductionLarge))) : null;
  const preuves = { encadreHautPx: boiteE ? Math.round(boiteE.haut) : null, sousTitresBasPx: basST === null ? null : Math.round(basST), ecartPx: boiteE && basST !== null ? Math.round(boiteE.haut - basST) : null, montantsEnDouble, capsuleMicro: capsule ? Object.fromEntries(Object.entries(capsule).map(([k, v]) => [k, Math.round(v)])) : null, capsuleEntiere };
  console.log(`${ratio} preuves :`, preuves);
  resultats[ratio] = { tempsSec: +secondes.toFixed(1), mesures: r.mesures, alertesComposition: p.alertes, luts: p.couleurs.luts, encadre: p.texte.encadre, incrustations: p.texte.incrustations, preuves };
  if (ratio === "9:16") {
    // Pour `mesurer-m4b.mts` : les paramètres et les fichiers préparés de ce rendu (dossier temporaire).
    const illustrations: Record<number, { fichier: string; video: boolean }> = {};
    p.image.plans.forEach((pl, i) => {
      if (pl.type === "illustration" && pl.illustration?.url.startsWith("entree:")) illustrations[i] = { fichier: `${pl.illustration.url.slice(7)}.jpg`, video: pl.illustration.video };
    });
    const acc = p.image.accessoire ? scene.tailleAccessoire(p.image.accessoire) : null;
    writeFileSync(join(TRAVAIL, "parametres-9x16.json"), JSON.stringify({ image: p.image, couleurs: p.couleurs, dureeSec, export: p.export, fichiers: { decor: "decor-pret.png", doubles: { principal: { fichier: "double-principal.webm", video: true } }, accessoire: acc ? { fichier: "accessoire.png", ...acc } : undefined, illustrations, luts: [{ fichier: "lut-1-melangee.cube", plages: p.couleurs.luts[0]?.plages ?? [] }], son: "son-final.wav" } }));
  }
  const nom = ratio.replace(":", "x");
  if (!MESURE) copyFileSync(join(dossier, "video.mp4"), ratio === "9:16" ? join(SORTIE, "avocat-demo-9x16.mp4") : join(TRAVAIL, `avocat-demo-${nom}.mp4`));
}
await serveur.fermer();
if (MESURE) {
  writeFileSync(join(TRAVAIL, `mesure-${MESURE}.json`), JSON.stringify({ date: new Date().toISOString(), fils: availableParallelism(), concurrenceNavigateur: REGLAGES_RENDU.concurrency, resultats }, null, 2));
  console.log(`mesure « ${MESURE} » → ${join(TRAVAIL, `mesure-${MESURE}.json`)}`);
  process.exit(0);
}

/* --- 7. Captures (6 du 9:16 + 4:5, 1:1, LUT avant / après, côte à côte avec l'avocat de référence) --- */
const video916 = join(SORTIE, "avocat-demo-9x16.mp4");
const capture = (source: string, t: number, sortie: string, filtre = "scale=540:-2") =>
  spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(2), "-i", source, "-frames:v", "1", "-vf", filtre, "-q:v", "2", sortie]);
const planPoitrine = plans.find((p) => p.sourceImage === "double" && p.cadrage.valeur === "poitrine" && p.debutSec > 3);
const planIllu = plans.find((p) => p.sourceImage === "illustration");
const planMontant = plans.find((p) => p.incrustation);
const planLarge = plans.find((p) => p.sourceImage === "double" && p.cadrage.valeur !== "poitrine" && p.debutSec > 3);
const milieu = (p?: { debutSec: number; finSec: number }) => (p ? (p.debutSec + p.finSec) / 2 : dureeSec / 2);
const choix = [
  { nom: "1-ouverture-encadre", t: 1.0 },
  { nom: "2-plan-large", t: milieu(planLarge) },
  { nom: "3-plan-poitrine-120", t: milieu(planPoitrine) },
  { nom: "4-illustration", t: milieu(planIllu) },
  { nom: "5-montant-incruste", t: milieu(planMontant) },
  { nom: "6-fin", t: dureeSec - 0.7 },
];
for (const c of choix) capture(video916, c.t, join(SORTIE, `${c.nom}.jpg`));
capture(join(TRAVAIL, "avocat-demo-4x5.mp4"), milieu(planLarge), join(SORTIE, "7-format-4x5.jpg"));
capture(join(TRAVAIL, "avocat-demo-1x1.mp4"), milieu(planLarge), join(SORTIE, "8-format-1x1.jpg"));
// LUT avant / après sur la même image (calques image avant la LUT, puis la vidéo finale), côte à côte.
const tLut = milieu(planLarge);
// Lot M4b : les calques image sont composés par FFmpeg ; l'image « avant LUT » est refaite par la même passe, sans
// LUT, ni grain, ni vignette, sur les fichiers préparés du rendu 9:16 (décor, accessoire, double).
let imageAvant = join(TRAVAIL, "m4b-rendu-9x16", "image.mp4");
if (!existsSync(imageAvant)) {
  const { argumentsImageFfmpeg } = await import("../../studio-rendu/src/composition/image-ffmpeg");
  const { fichierEntree } = await import("../../studio-rendu/src/composition/entrees");
  const p916 = comp.parametresComposition(commande, { ratio: "9:16", plans, segments: sousTitres, dureeSec, mots: renvoyes, audioCle: "voix-demo.wav", pistesDouble: { "trois-quarts": "double-essai.webm" } });
  const local = (ref?: string) => (ref?.startsWith("entree:") ? fichierEntree(ref.slice(7), p916.entrees[ref.slice(7)]) : "");
  const dossier916 = join(TRAVAIL, "m4b-rendu-9x16");
  const acc = p916.image.accessoire ? scene.tailleAccessoire(p916.image.accessoire) : null;
  const illustrations: Record<number, { fichier: string; video: boolean }> = {};
  p916.image.plans.forEach((pl, i) => {
    if (pl.type === "illustration" && pl.illustration) illustrations[i] = { fichier: local(pl.illustration.url), video: pl.illustration.video };
  });
  const principal = p916.image.doubles.principal;
  const args = argumentsImageFfmpeg(
    p916.image,
    { grainPct: 0, grainTaillePx: 2, vignettePct: 0 },
    { decor: existsSync(join(dossier916, "decor-pret.png")) ? "decor-pret.png" : undefined, doubles: { principal: { fichier: principal.type === "silhouette" ? "" : local(principal.url), video: principal.type === "video" } }, accessoire: acc ? { fichier: "accessoire.png", ...acc } : undefined, illustrations, luts: [], son: "son-final.wav" },
    dureeSec,
    "image-sans-lut.mov",
  );
  spawnSync("ffmpeg", args, { cwd: dossier916 });
  imageAvant = join(dossier916, "image-sans-lut.mov");
}
spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", tLut.toFixed(2), "-i", imageAvant, "-ss", tLut.toFixed(2), "-i", video916, "-filter_complex", "[0:v]scale=540:-2[a];[1:v]scale=540:-2[b];[a][b]hstack", "-frames:v", "1", "-q:v", "2", join(SORTIE, "9-lut-avant-apres.jpg")]);
// Plan poitrine côte à côte avec une référence de l'avocat de référence (même hauteur).
const reference = resolve(RACINE, "..", "Axion-IA", "<dossier-de-plan-prive>", "references-avocat", "reference-locale.mp4");
if (existsSync(reference)) {
  spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", "3.5", "-i", reference, "-ss", milieu(planPoitrine).toFixed(2), "-i", video916, "-filter_complex", "[0:v]scale=-2:960[a];[1:v]scale=-2:960[b];[a][b]hstack", "-frames:v", "1", "-q:v", "2", join(SORTIE, "10-cote-a-cote-reference.jpg")]);
}
writeFileSync(
  join(SORTIE, "mesures.json"),
  JSON.stringify({ date: new Date().toISOString(), lot: "M4b", machine: { processeur: cpus()[0]?.model, fils: availableParallelism(), coeursVus: coeursDisponibles(), concurrenceNavigateur: REGLAGES_RENDU.concurrency, image: process.env.STUDIO_RENDU_IMAGE === "navigateur" ? "navigateur" : "ffmpeg" }, avantM4b: { source: "v1/mesures.json (lot M4, même poste, concurrence 2)", "9:16": 210.4, "4:5": 173, "1:1": 146.8 }, voix: { dureeSec: +dureeVoix.toFixed(2), mots: renvoyes.length }, dureeVideoSec: +dureeSec.toFixed(2), doubleEssaiWebmSec: tempsDouble, plans: plans.map((p) => ({ ordre: p.ordre, de: p.debutSec, a: p.finSec, source: p.sourceImage, cadrage: p.cadrage.valeur, zoom: p.cadrage.zoom, zoomFin: p.cadrage.zoomFin, incrustation: !!p.incrustation })), alertesRythme, captures: choix, resultats }, null, 2) + "\n",
  "utf-8",
);
console.log(`terminé → ${SORTIE}`);
