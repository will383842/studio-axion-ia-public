/**
 * TEST D'ÉCOUTE AVANT / APRÈS — script « 35 heures dans Excel » (lot intensité · bruitages, 02/10, D1 ; 0 €).
 *
 * Avec le VRAI code : voix de synthèse de Windows (`fabriquer-voix-35h.ps1`) → report des horodatages → découpage
 * (Équilibré, R14) → sous-titres (Équilibré) → chef d'orchestre (brique `intensite`, bruitages « Discrets ») → chaîne
 * du son de `studio-rendu` : une fois SANS bruitage (avant), une fois AVEC (après). Les sons de la banque sont traités
 * ici comme validés (essai d'écoute : en vrai, aucun n'est posé avant la validation de Will).
 *
 * Usage (racine du dépôt) : `pnpm exec tsx outils/intensite/ecoute-35h.mts`
 * Sorties : docs/captures/d1-bruitages/35h-avant.m4a, 35h-apres.m4a, 35h-bruitages-seuls.m4a, 35h-rapport.json
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import type { BruitageDisponible, MotHorodate } from "@/domaine/types";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const SORTIE = join(RACINE, "docs", "captures", "d1-bruitages");
const TRAVAIL = join(tmpdir(), "studio-d1-ecoute-35h");
mkdirSync(SORTIE, { recursive: true });
mkdirSync(TRAVAIL, { recursive: true });

const charger = async <T,>(m: string): Promise<T> => {
  const x = (await import(m)) as T & { default?: T };
  return (x.default ?? x) as T;
};
const report = await charger<typeof import("@/moteurs/montage-avocat/report")>("@/moteurs/montage-avocat/report");
const decoupage = await charger<typeof import("@/moteurs/montage-avocat/decoupage")>("@/moteurs/montage-avocat/decoupage");
const brique = await charger<typeof import("@/briques/sous-titres")>("@/briques/sous-titres");
const intensite = await charger<typeof import("@/briques/intensite")>("@/briques/intensite");
const avocat = await charger<typeof import("@/formats/avocat")>("@/formats/avocat");
const elements = await charger<typeof import("@/donnees/elements-avocat")>("@/donnees/elements-avocat");
const banque = await charger<typeof import("@/donnees/bruitages")>("@/donnees/bruitages");
const { preparerSon } = await import("../../studio-rendu/src/son/chaine");
const { mesurerEcarts } = await import("../../studio-rendu/src/son/bruitages");
const { decoderPcm } = await import("../../studio-rendu/src/audio/pcm");
const { mesurerFichier } = await import("../../studio-rendu/src/son/mesure");

const segments = [
  { id: "s1", bloc: "accroche", texte: "Une personne à temps plein. 35 heures par semaine. Juste pour remplir des tableaux Excel.", emphase: ["35 heures"], intentionIllustration: "un écran couvert de cellules Excel", incrustation: { type: "montant" as const, texte: "35 h / semaine", sens: "perte" as const } },
  { id: "s2", bloc: "promesse", texte: "Je vais vous raconter comment un de nos clients est passé de 35 heures à zéro. En moins d'un mois.", emphase: ["zéro"] },
  { id: "s3", bloc: "coeur", texte: "Chaque jour, la même routine : exporter, copier, coller, vérifier, et recommencer. Une seule erreur de formule, et tous les chiffres sont faux.", intentionIllustration: "des piles de dossiers et un fichier Excel" },
  { id: "s4", bloc: "coeur", texte: "Sauf qu'on ne s'est pas arrêtés là." },
  { id: "s5", bloc: "coeur", texte: "On lui a livré une console complète, avec un tableau de bord de toutes ses données.", intentionIllustration: "un tableau de bord avec des graphiques" },
  { id: "s6", bloc: "coeur", texte: "Et s'il y a un problème ? Une alerte arrive directement sur son téléphone.", intentionIllustration: "un téléphone avec une notification d'alerte" },
  { id: "s7", bloc: "preuve", texte: "Avant : 35 heures par semaine. Aujourd'hui : zéro heure. Et 100 % des données, en temps réel.", emphase: ["100 %"], incrustation: { type: "montant" as const, texte: "100 %", sens: "gain" as const } },
];
const prononciations = [
  { mot: "35 heures", prononciation: "trente-cinq heures" },
  { mot: "100 %", prononciation: "cent pour cent" },
];

/* --- Voix et horodatage (même méthode que la démonstration M4) --- */
const VOIX = join(ICI, "voix-35h.wav");
if (!existsSync(VOIX)) throw new Error("Lancez d'abord : powershell -File outils/intensite/fabriquer-voix-35h.ps1");
const debuts = JSON.parse(readFileSync(join(ICI, "voix-35h.debuts.json"), "utf8").replace(/^﻿/, "")) as { mot: string; debutSec: number }[];
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

/* --- Montage : découpage, sous-titres, chef d'orchestre --- */
const recette = avocat.RECETTE_MONTAGE_AVOCAT;
const segDecoupage = segments.map((s) => ({ id: s.id, texte: s.texte, bloc: s.bloc, emphase: s.emphase, intentionIllustration: s.intentionIllustration, incrustation: s.incrustation }));
const plans = decoupage.decouperEnPlans({ mots, segments: segDecoupage, plansIndicatifs: [], recette, style: elements.STYLE_MONTAGE_AVOCAT, repartition: recette.angles.repartitionParDefaut, deuxAngles: false, ouvertureSurIllustration: false, illustrations: true, levresNote: 92, dureeAudioSec: dureeVoix, intensite: "equilibre" });
const dureeSec = plans.at(-1)!.finSec;
const sousTitres = brique.fabriquerSousTitres({ texte: segments.map((s) => s.texte).join(" "), dureeSec, mots, prononciations, emphase: segments.flatMap((s) => s.emphase ?? []), style: elements.STYLE_SOUS_TITRES_AVOCAT, base: "karaoke", intensite: "equilibre", coupesSec: plans.slice(1).map((p) => p.debutSec) });
const relancesSec = segDecoupage.filter((s, i) => i > 0 && s.bloc !== segDecoupage[i - 1].bloc).map((s) => mots.find((m) => m.segmentId === s.id)?.debutSec ?? 0);
// Essai d'écoute : toute la banque, comme si Will l'avait validée.
const disponibles: BruitageDisponible[] = banque.SONS_BANQUE.map((s) => ({ elementId: banque.idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec, sonieLufs: banque.SONIE_BANQUE_DB }));
const o = intensite.orchestrerMontage({ niveau: "equilibre", dureeSec, plans, segments: sousTitres, angleSecond: recette.angles.second, relancesSec, bruitages: { reglage: "discrets", disponibles, graine: 35 } });
console.log(`voix ${dureeVoix.toFixed(1)} s · ${plans.length} plans · ${o.bruitages.length} sons posés`);
for (const b of o.bruitages) console.log(`  ${b.debutSec.toFixed(2)} s  ${b.declencheur.padEnd(19)} ${b.elementId}`);
if (process.env.D1_DEBUG) { console.log(JSON.stringify(o.decisions.filter((d) => d.decision !== "garde"))); console.log(JSON.stringify(intensite.declencheursVus(o.plans, o.segments))); }

/* --- Son : avant (sans bruitage) et après (avec), même chaîne --- */
const base = { voix: VOIX, dureeSec, passeHautHz: 80, seuilLraCompression: 3, ratioCompression: 3, lufs: -14, creteVraieMaxDbtp: -1.5, tonPieceDb: -42.5, graine: 35 };
const dAvant = join(TRAVAIL, "avant");
const dApres = join(TRAVAIL, "apres");
mkdirSync(dAvant, { recursive: true });
mkdirSync(dApres, { recursive: true });
const avant = await preparerSon({ ...base, dossier: dAvant });
const fichierSon = (id: string) => {
  const s = banque.SONS_BANQUE.find((x) => banque.idElementBruitage(x) === id)!;
  return join(RACINE, "public", banque.cleBruitage(s));
};
const apres = await preparerSon({ ...base, dossier: dApres, bruitages: o.bruitages.map((b) => ({ chemin: fichierSon(b.elementId), debutSec: b.debutSec, gainDb: b.gainDb, passeHautHz: intensite.REGLES_BRUITAGES.passeHautHz })) });
const enM4a = (src: string, nom: string) => spawnSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", join(SORTIE, nom)]);
enM4a(avant.chemin, "35h-avant.m4a");
enM4a(apres.chemin, "35h-apres.m4a");
if (apres.bruitages) {
  // Les sons seuls, remontés de 21 dB pour qu'on les entende (à écouter pour juger chaque son).
  spawnSync("ffmpeg", ["-v", "error", "-y", "-i", apres.bruitages.chemin, "-af", "volume=21dB", "-c:a", "aac", "-b:a", "192k", "-ac", "2", join(SORTIE, "35h-bruitages-seuls-remontes.m4a")]);
}
copyFileSync(join(dApres, "voix-traitee.wav"), join(TRAVAIL, "voix-traitee.wav"));

/* --- Mesures --- */
const voixTraitee = await decoderPcm(join(dApres, "voix-traitee.wav"));
const piste = apres.bruitages ? await decoderPcm(apres.bruitages.chemin) : new Float32Array(0);
const ecarts = mesurerEcarts(voixTraitee, piste, o.bruitages.map((b) => b.debutSec));
const mAvant = await mesurerFichier(avant.chemin, []);
const mApres = await mesurerFichier(apres.chemin, []);
const rapport = {
  date: new Date().toISOString(),
  objet: "Test d'écoute avant / après, script « 35 heures dans Excel » (extrait de 42 s), intensité Équilibré, bruitages Discrets. 0 € (voix de Windows).",
  methode: "Même code que le moteur : découpage (R14), sous-titres, chef d'orchestre (brique intensite), chaîne du son de studio-rendu. Écart sous la voix = niveau actif (RMS des trames de 10 ms à moins de 30 dB de la plus forte) de la voix traitée moins celui de chaque son posé, même mesure.",
  dureeSec: +dureeSec.toFixed(2),
  plans: plans.map((p) => ({ ordre: p.ordre, de: p.debutSec, a: p.finSec, source: p.sourceImage, cadrage: p.cadrage.valeur, incrustation: p.incrustation?.texte })),
  accents: o.segments.filter((s) => s.style !== "base").map((s) => ({ de: s.debutSec, style: s.style, texte: s.mots.map((m) => m.mot).join(" ") })),
  bruitages: o.bruitages.map((b, i) => ({ ...b, sousLaVoixMesureDb: ecarts.ecartsDb[i] })),
  sonsNonPoses: o.decisions.filter((d) => d.id.startsWith("bruitage") && d.decision === "saute").map((d) => ({ id: d.id, raison: d.raison })),
  intensite: { plafond: o.rapport.plafond, chargeMax: Math.max(...o.rapport.courbe.map((c) => c.charge)), depassements: o.rapport.depassements, gardes: o.rapport.effetsGardes, decales: o.rapport.effetsDecales, sautes: o.rapport.effetsSautes },
  son: {
    voixNiveauActifDb: ecarts.voixDb,
    avant: { lufs: mAvant.lufs, creteVraieDbtp: mAvant.creteVraieDbtp, gainVoixDb: avant.gainDb },
    apres: { lufs: mApres.lufs, creteVraieDbtp: mApres.creteVraieDbtp, gainVoixDb: apres.gainDb },
    ecartSonieVoixLu: +(mApres.lufs - mAvant.lufs).toFixed(2),
    sousLaVoixMinDb: ecarts.ecartsDb.length ? Math.min(...ecarts.ecartsDb) : null,
    sousLaVoixMaxDb: ecarts.ecartsDb.length ? Math.max(...ecarts.ecartsDb) : null,
  },
  fichiers: ["35h-avant.m4a", "35h-apres.m4a", "35h-bruitages-seuls-remontes.m4a"],
};
writeFileSync(join(SORTIE, "35h-rapport.json"), JSON.stringify(rapport, null, 2) + "\n");
console.log(`sous la voix : ${rapport.son.sousLaVoixMinDb} à ${rapport.son.sousLaVoixMaxDb} dB · sonie ${mAvant.lufs} → ${mApres.lufs} LUFS`);
console.log(`terminé → ${SORTIE}`);
