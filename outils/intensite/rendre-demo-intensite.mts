/**
 * NOUVELLE DÉMONSTRATION M4 (v3) — intensité Équilibré + bruitages Discrets (lot intensité · bruitages, 02/10, D1).
 * Même script, même voix, même double d'essai et même chaîne que `outils/demo-m4/rendre-demo.mts` (qui reste
 * INCHANGÉ et rend toujours la démonstration d'avant, à l'identique) ; en plus, ce que le moteur fait désormais :
 *   découpage avec le réglage d'intensité (R14) → chef d'orchestre (brique `intensite` : zoom, incrustations,
 *   accents des sous-titres arbitrés sur la courbe unique) → bruitages de la banque posés 18-24 dB sous la voix.
 * Les sons de la banque sont traités ici comme validés (démonstration : en vrai, aucun n'est posé avant l'écoute de Will).
 *
 * Usage (racine du dépôt) : `pnpm exec tsx outils/intensite/rendre-demo-intensite.mts` (9:16 ; `DEMO_FORMATS=tous` : 9:16, 4:5, 1:1)
 * Sorties : docs/captures/d1-bruitages/demo-m4-v3/ (vidéo 9:16, captures, mesures, écart avec la démonstration d'avant).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism, cpus, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import type { CommandeFabrication, MotHorodate, SegmentSousTitres } from "@/domaine/types";
// Essai sur ce poste (entrées servies par 127.0.0.1) : mode essai EXPLICITE de studio-rendu (relecture sécurité R45).
process.env.STUDIO_RENDU_ESSAI ??= "1";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const SORTIE = join(RACINE, "docs", "captures", "d1-bruitages", "demo-m4-v3");
const TRAVAIL = join(tmpdir(), "studio-d1-demo-m4-v3");
mkdirSync(SORTIE, { recursive: true });
mkdirSync(TRAVAIL, { recursive: true });
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
const intensite = await charger<typeof import("@/briques/intensite")>("@/briques/intensite");
const banque = await charger<typeof import("@/donnees/bruitages")>("@/donnees/bruitages");
const { mesurerEcarts } = await import("../../studio-rendu/src/son/bruitages");
const { decoderPcm } = await import("../../studio-rendu/src/audio/pcm");

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
const DEMO = join(RACINE, "outils", "demo-m4");
const VOIX = join(DEMO, "voix-demo.wav");
if (!existsSync(VOIX)) throw new Error("Lancez d'abord : powershell -File outils/demo-m4/fabriquer-voix-demo.ps1");
const debuts = (JSON.parse(readFileSync(join(DEMO, "voix-demo.debuts.json"), "utf8").replace(/^﻿/, "")) as { mot: string; debutSec: number }[]);
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
const plansDecoupes = decoupage.decouperEnPlans({ mots, segments: segDecoupage, plansIndicatifs, recette, style: elements.STYLE_MONTAGE_AVOCAT, repartition: recette.angles.repartitionParDefaut, deuxAngles: false, ouvertureSurIllustration: false, illustrations: true, levresNote: 92, dureeAudioSec: dureeVoix, intensite: "equilibre" });
const dureeSec = plansDecoupes.at(-1)!.finSec;
const alertesRythme = decoupage.controlerRythme(plansDecoupes, { recette, style: elements.STYLE_MONTAGE_AVOCAT, mots, segments: segDecoupage });
console.log(`plans : ${plansDecoupes.length}, durée ${dureeSec.toFixed(2)} s`);
for (const p of plansDecoupes) console.log(`  ${p.ordre}. ${p.debutSec.toFixed(2)}-${p.finSec.toFixed(2)} ${p.sourceImage}${p.cadrage.valeur ? ` ${p.cadrage.valeur} ${Math.round(p.cadrage.zoom * 100)}→${Math.round((p.cadrage.zoomFin ?? p.cadrage.zoom) * 100)} %` : ""}${p.incrustation ? " +montant" : ""}  « ${p.texte} »`);

/* --- 3. Sous-titres (lot M2), calés sur les coupes --- */
const sousTitresMelange: SegmentSousTitres[] = brique.fabriquerSousTitres({
  texte: segments.map((s) => s.texte).join(" "),
  dureeSec,
  mots,
  prononciations,
  emphase: segments.flatMap((s) => s.emphase),
  style: elements.STYLE_SOUS_TITRES_AVOCAT,
  base: "karaoke",
  intensite: "equilibre",
  coupesSec: plansDecoupes.slice(1).map((p) => p.debutSec),
  reseaux: avocat.formatAvocat.reseauxConseilles,
  motsTitre: ["Amende", "erreur"],
});

/* --- 3 bis. Lot « intensité · bruitages » : la courbe unique arbitre tout, puis les sons sont posés --- */
const disponibles = banque.SONS_BANQUE.map((s) => ({ elementId: banque.idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec, sonieLufs: banque.SONIE_BANQUE_DB }));
const relancesSec = segDecoupage.filter((s, i) => i > 0 && s.bloc !== segDecoupage[i - 1].bloc).map((s) => mots.find((m) => m.segmentId === s.id)?.debutSec ?? 0);
const hache = (t: string) => [...t].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const orchestration = intensite.orchestrerMontage({ niveau: "equilibre", dureeSec, plans: plansDecoupes, segments: sousTitresMelange, angleSecond: recette.angles.second, relancesSec, bruitages: { reglage: "discrets", disponibles, graine: hache("demo-m4") % 1000 } });
const plans = orchestration.plans;
const sousTitres = orchestration.segments;
console.log(`intensité Équilibré : ${orchestration.rapport.effetsGardes} gardés, ${orchestration.rapport.effetsDecales} décalés, ${orchestration.rapport.effetsSautes} sautés ; ${orchestration.bruitages.length} sons`);
for (const d of orchestration.decisions.filter((x) => x.decision !== "garde")) console.log(`  ${d.decision} ${d.id} (${d.raison})`);
for (const b of orchestration.bruitages) console.log(`  son ${b.debutSec.toFixed(2)} s ${b.declencheur} ${b.elementId}`);

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
  intensite: { niveau: "equilibre", bruitages: "discrets" },
  bruitagesDisponibles: disponibles,
  medias: {
    ...Object.fromEntries(orchestration.bruitages.map((b) => [b.elementId, { cle: `${b.elementId}.wav`, mime: "audio/wav" }])),
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
for (const b of orchestration.bruitages) {
  const son = banque.SONS_BANQUE.find((x) => banque.idElementBruitage(x) === b.elementId)!;
  copyFileSync(join(RACINE, "public", banque.cleBruitage(son)), join(ENTREES, `${b.elementId}.wav`));
}

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
const TOUS = process.env.DEMO_FORMATS === "tous";
for (const ratio of (MESURE || !TOUS ? ["9:16"] : ["9:16", "4:5", "1:1"]) as ("9:16" | "4:5" | "1:1")[]) {
  const p = comp.parametresComposition(commande, { ratio, plans, segments: sousTitres, dureeSec, mots: renvoyes, audioCle: "voix-demo.wav", pistesDouble: { "trois-quarts": "double-essai.webm" }, bruitages: orchestration.bruitages });
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
if (TOUS) {
  capture(join(TRAVAIL, "avocat-demo-4x5.mp4"), milieu(planLarge), join(SORTIE, "7-format-4x5.jpg"));
  capture(join(TRAVAIL, "avocat-demo-1x1.mp4"), milieu(planLarge), join(SORTIE, "8-format-1x1.jpg"));
}
// Lot « bruitages » : une image au moment de chaque son posé.
orchestration.bruitages.forEach((b, i) => capture(video916, Math.min(dureeSec - 0.1, b.debutSec + 0.15), join(SORTIE, `son-${i + 1}-${b.declencheur}.jpg`)));
// LUT avant / après sur la même image (calques image avant la LUT, puis la vidéo finale), côte à côte.
const tLut = milieu(planLarge);
// Lot M4b : les calques image sont composés par FFmpeg ; l'image « avant LUT » est refaite par la même passe, sans
// LUT, ni grain, ni vignette, sur les fichiers préparés du rendu 9:16 (décor, accessoire, double).
let imageAvant = join(TRAVAIL, "m4b-rendu-9x16", "image.mp4");
if (!existsSync(imageAvant)) {
  const { argumentsImageFfmpeg } = await import("../../studio-rendu/src/composition/image-ffmpeg");
  const { fichierEntree } = await import("../../studio-rendu/src/composition/entrees");
  const p916 = comp.parametresComposition(commande, { ratio: "9:16", plans, segments: sousTitres, dureeSec, mots: renvoyes, audioCle: "voix-demo.wav", pistesDouble: { "trois-quarts": "double-essai.webm" }, bruitages: orchestration.bruitages });
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
/* --- 8. Bruitages : 18-24 dB sous la voix, mesurés sur les fichiers du rendu 9:16 ; voix inchangée --- */
const dossier916 = join(TRAVAIL, "m4b-rendu-9x16");
const voixTraitee = await decoderPcm(join(dossier916, "voix-traitee.wav"));
const pisteSons = existsSync(join(dossier916, "bruitages.wav")) ? await decoderPcm(join(dossier916, "bruitages.wav")) : new Float32Array(0);
const ecarts = mesurerEcarts(voixTraitee, pisteSons, orchestration.bruitages.map((b) => b.debutSec));
const avant = JSON.parse(readFileSync(join(RACINE, "docs", "captures", "m4-demo", "mesures.json"), "utf8")) as { plans: { ordre: number; de: number; a: number; source: string; cadrage?: string; zoomFin?: number; incrustation: boolean }[]; resultats: Record<string, { mesures: Record<string, number> }> };
const ecart = {
  date: new Date().toISOString(),
  pourquoi: "Effet VOULU du lot intensité · bruitages (règle 0.5 du contrat) : le moteur passe désormais chaque effet par la courbe unique (Équilibré) et pose des bruitages discrets. La démonstration d'avant (docs/captures/m4-demo/, outils/demo-m4/rendre-demo.mts) reste rendue à l'identique : ce script ne la remplace pas, il la complète.",
  plansAvant: avant.plans,
  plansApres: plans.map((p) => ({ ordre: p.ordre, de: p.debutSec, a: p.finSec, source: p.sourceImage, cadrage: p.cadrage.valeur, zoomFin: p.cadrage.zoomFin, incrustation: !!p.incrustation, incrustationDecaleeSec: p.incrustation?.decalageSec })),
  accentsAvant: sousTitresMelange.filter((x) => x.style !== "base" || (x.souligne ?? null) !== null).map((x) => ({ de: x.debutSec, style: x.style, souligne: x.souligne ?? null, texte: x.mots.map((m) => m.mot).join(" ") })),
  accentsApres: sousTitres.filter((x) => x.style !== "base" || (x.souligne ?? null) !== null).map((x) => ({ de: x.debutSec, style: x.style, souligne: x.souligne ?? null, texte: x.mots.map((m) => m.mot).join(" ") })),
  decisions: orchestration.decisions.filter((d) => d.decision !== "garde"),
  bruitages: orchestration.bruitages.map((b, i) => ({ ...b, sousLaVoixMesureDb: ecarts.ecartsDb[i] })),
  courbe: { plafond: orchestration.rapport.plafond, chargeMax: Math.max(...orchestration.rapport.courbe.map((c) => c.charge)), depassements: orchestration.rapport.depassements },
  son: {
    lufsAvant: avant.resultats["9:16"]?.mesures?.lufs,
    lufsApres: (resultats["9:16"] as { mesures: Record<string, number> }).mesures.lufs,
    creteAvantDbtp: avant.resultats["9:16"]?.mesures?.creteVraieDbtp,
    creteApresDbtp: (resultats["9:16"] as { mesures: Record<string, number> }).mesures.creteVraieDbtp,
    voixNiveauActifDb: ecarts.voixDb,
    sousLaVoixMinDb: ecarts.ecartsDb.length ? Math.min(...ecarts.ecartsDb) : null,
    sousLaVoixMaxDb: ecarts.ecartsDb.length ? Math.max(...ecarts.ecartsDb) : null,
    mesuresStudioRendu: Object.fromEntries(Object.entries((resultats["9:16"] as { mesures: Record<string, number> }).mesures).filter(([k]) => k.startsWith("bruitages"))),
  },
};
writeFileSync(join(SORTIE, "ecart-avec-la-demo-d-avant.json"), JSON.stringify(ecart, null, 2) + "\n", "utf-8");
console.log(`bruitages sous la voix : ${ecart.son.sousLaVoixMinDb} à ${ecart.son.sousLaVoixMaxDb} dB ; sonie ${ecart.son.lufsAvant} → ${ecart.son.lufsApres} LUFS`);
writeFileSync(
  join(SORTIE, "mesures.json"),
  JSON.stringify({ date: new Date().toISOString(), lot: "intensite-bruitages (v3)", intensite: "equilibre", bruitages: orchestration.bruitages, machine: { processeur: cpus()[0]?.model, fils: availableParallelism(), coeursVus: coeursDisponibles(), concurrenceNavigateur: REGLAGES_RENDU.concurrency, image: process.env.STUDIO_RENDU_IMAGE === "navigateur" ? "navigateur" : "ffmpeg" }, avantM4b: { source: "v1/mesures.json (lot M4, même poste, concurrence 2)", "9:16": 210.4, "4:5": 173, "1:1": 146.8 }, voix: { dureeSec: +dureeVoix.toFixed(2), mots: renvoyes.length }, dureeVideoSec: +dureeSec.toFixed(2), doubleEssaiWebmSec: tempsDouble, plans: plans.map((p) => ({ ordre: p.ordre, de: p.debutSec, a: p.finSec, source: p.sourceImage, cadrage: p.cadrage.valeur, zoom: p.cadrage.zoom, zoomFin: p.cadrage.zoomFin, incrustation: !!p.incrustation })), alertesRythme, captures: choix, resultats }, null, 2) + "\n",
  "utf-8",
);
console.log(`terminé → ${SORTIE}`);
