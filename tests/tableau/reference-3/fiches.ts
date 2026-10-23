/**
 * Témoin du style « reference/3 » (gabarit par parties, 14/10/2026) : la vidéo jugée « pas assez claire » par Will
 * (v-f1739d6a4f51, script complet : `docs/formats/apercus-reference-3/avant/script-temoin.txt`), REDÉCOUPÉE au
 * gabarit par parties (même texte dit, mot pour mot). Calée sur un minutage RÉALISTE (débit de la voix réelle,
 * 20,5 caractères par seconde, pauses aux virgules et aux points ; aucune voix lue). Partagé par les tests et les
 * aperçus (`apercus.mts`, `video.mts`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MotCalage } from "../../../src/briques/motion/calage";
import { calerFicheTableau, type ElementCale } from "../../../src/moteurs/montage-tableau/calage";
import { remettreEnForme } from "../../../src/moteurs/montage-tableau/decoupage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { ContexteTableau } from "../../../src/moteurs/montage-tableau/regles";

const DOSSIER = join(__dirname, "..", "temoins");

/** Mots de la douleur, tels que l'accroche les dit. */
export const MOTS_DOULEUR_TEMOIN = ["collé", "contrat client", "ChatGPT"];

/** La fiche brute, telle qu'écrite. */
export function ficheTemoin3Brute(): FicheTableau {
  return JSON.parse(readFileSync(join(DOSSIER, "fiche-temoin-v-f1739d6a4f51-reference-3.json"), "utf8")) as FicheTableau;
}

/** La fiche remise en forme comme en production. */
export function ficheTemoin3(): FicheTableau {
  return remettreEnForme(ficheTemoin3Brute(), { motsDouleur: MOTS_DOULEUR_TEMOIN });
}

export function contexteTemoin3(f: FicheTableau): ContexteTableau {
  return { aujourdhui: "2026-10-14", sourcesChiffres: [], preuves: [], matieres: [{ id: "mat-compromis-demo", type: "demonstration", statut: "validee", perimeLe: "2027-01-09" }], texteScript: f.scenes.map((s) => s.texteDit).join(" "), motsDouleur: MOTS_DOULEUR_TEMOIN };
}

/**
 * Minutage réaliste : `cps` caractères dits par seconde (20,5 : le débit commun ; 16,5 : une voix posée), 0,12 s de plus
 * après une virgule, 0,3 s après un point.
 */
export function motsRealistes(f: FicheTableau, cps = 20.5): MotCalage[] {
  const res: MotCalage[] = [];
  let t = 0.15;
  for (const m of f.scenes.map((s) => s.texteDit).join(" ").split(/\s+/)) {
    if (!/[\p{L}\p{N}]/u.test(m)) {
      t += 0.12;
      continue;
    }
    const d = (m.length + 1) / cps;
    res.push({ mot: m, debutSec: +t.toFixed(3), finSec: +(t + d * 0.92).toFixed(3) });
    t += d + (/[.?!]$/.test(m) ? 0.3 : /[,:;]$/.test(m) ? 0.12 : 0);
  }
  return res;
}

/** Calée sur le minutage réaliste ; lève si le calage refuse. */
export function caleeTemoin3(f: FicheTableau = ficheTemoin3()): { fiche: FicheTableau; mots: MotCalage[]; elements: ElementCale[] } {
  const mots = motsRealistes(f);
  const r = calerFicheTableau(f, mots, { contexte: contexteTemoin3(f), dureeSec: mots.at(-1)!.finSec + 0.3 });
  if (!r.ok) throw new Error(`témoin : calage refusé : ${r.problemes.join(" | ")}`);
  return { fiche: r.fiche, mots, elements: r.elements };
}

/* ------------------------------------------------------------------ */
/* Script Formation v3 (exemples-v3/01-formation.md)                    */
/* ------------------------------------------------------------------ */

/** Mots de la douleur du script Formation v3 (recopiés de l'accroche). */
export const MOTS_DOULEUR_FORMATION = ["contrat client", "ChatGPT", "sans vous le dire"];

/** Fiche « reference/3 » du script Formation v3, telle qu'un découpage la rend (même texte dit, mot pour mot). */
export function ficheFormationV3Brute(): FicheTableau {
  return JSON.parse(readFileSync(join(DOSSIER, "fiche-formation-v3-reference-3.json"), "utf8")) as FicheTableau;
}

export function ficheFormationV3(): FicheTableau {
  return remettreEnForme(ficheFormationV3Brute(), { motsDouleur: MOTS_DOULEUR_FORMATION });
}

export function contexteFormationV3(f: FicheTableau): ContexteTableau {
  return { aujourdhui: "2026-10-15", sourcesChiffres: [], preuves: [], matieres: [{ id: "mat-cadastre-demo", type: "demonstration", statut: "validee", perimeLe: "2027-01-15" }], texteScript: f.scenes.map((s) => s.texteDit).join(" "), motsDouleur: MOTS_DOULEUR_FORMATION };
}

/** Calée sur le minutage réaliste (20,5 caractères par seconde) ; lève si le calage refuse. */
export function caleeFormationV3(f: FicheTableau = ficheFormationV3()): { fiche: FicheTableau; mots: MotCalage[]; elements: ElementCale[] } {
  const mots = motsRealistes(f);
  const r = calerFicheTableau(f, mots, { contexte: contexteFormationV3(f), dureeSec: mots.at(-1)!.finSec + 0.3 });
  if (!r.ok) throw new Error(`Formation v3 : calage refusé : ${r.problemes.join(" | ")}`);
  return { fiche: r.fiche, mots, elements: r.elements };
}

/* ------------------------------------------------------------------ */
/* Témoin réel du 15/10 : fabrication arrêtée « Blocs écrits à l'heure » */
/* ------------------------------------------------------------------ */

/** La fiche réelle de la vidéo v-d3e2a726cf0c (reference/3, 13 scènes), telle que la production l'a calée. */
export function ficheEcritureALHeure(): FicheTableau {
  return (JSON.parse(readFileSync(join(DOSSIER, "fabrication-arretee-ecriture-a-l-heure-2026-10-15.json"), "utf8")) as { fiche: FicheTableau }).fiche;
}

/**
 * Voix RAPIDE : `cps` caractères par seconde dans les mots, `virgule` s après une virgule (0 : liste dite d'une traite,
 * « Paramètres, Contrôles des données, décochez »), `point` s après un point.
 */
export function motsRapides(f: FicheTableau, cps = 19, virgule = 0.03, point = 0.15): MotCalage[] {
  const res: MotCalage[] = [];
  let t = 0.1;
  for (const m of f.scenes.map((s) => s.texteDit).join(" ").split(/\s+/)) {
    if (!/[\p{L}\p{N}]/u.test(m)) {
      t += 0.04;
      continue;
    }
    const d = (m.length + 1) / cps;
    res.push({ mot: m, debutSec: +t.toFixed(3), finSec: +(t + d * 0.92).toFixed(3) });
    t += d + (/[.?!»]$/.test(m) ? point : /[,:;]$/.test(m) ? virgule : 0);
  }
  return res;
}

/** Calée sur une voix rapide ; lève si le calage refuse. */
export function caleeEcritureALHeure(mots?: MotCalage[]): { fiche: FicheTableau; mots: MotCalage[]; elements: ElementCale[] } {
  const f = ficheEcritureALHeure();
  const m = mots ?? motsRapides(f);
  const texteScript = f.scenes.map((s) => s.texteDit).join(" ");
  const contexte: ContexteTableau = { aujourdhui: "2026-10-15", sourcesChiffres: [], preuves: [], matieres: [{ id: "mat-import-demo-02", type: "demonstration", statut: "validee", perimeLe: "2027-01-15" }], texteScript, motsDouleur: [] };
  const r = calerFicheTableau(f, m, { contexte, dureeSec: m.at(-1)!.finSec + 0.3 });
  if (!r.ok) throw new Error(`témoin du 15/10 : calage refusé : ${r.problemes.join(" | ")}`);
  return { fiche: r.fiche, mots: m, elements: r.elements };
}

/* ------------------------------------------------------------------ */
/* Exemple validé du gabarit cadré (15/10) : « Ce devis collé dans ChatGPT… » */
/* ------------------------------------------------------------------ */

/** Mots de la douleur de l'exemple validé (recopiés de l'accroche). */
export const MOTS_DOULEUR_GABARIT_CADRE = ["devis collé", "ChatGPT", "trois données de trop"];
/** Voix posée du minutage de preuve : 16,5 caractères par seconde (entre 16 et 17, la voix réelle la plus lente). */
export const CPS_VOIX_POSEE = 16.5;

/**
 * Fiche « reference/3 » de l'exemple validé par Will le 15/10 (`exemples-v4/01-formation.md`), telle qu'un découpage
 * version 12 la rend : six passages, 3 étapes (« Étape x sur 3 »), « À retenir » = l'idée en une phrase clé ; même
 * texte dit, mot pour mot. Fiche de test, écrite à la main (aucun appel payant).
 */
export function ficheGabaritCadreBrute(): FicheTableau {
  return JSON.parse(readFileSync(join(DOSSIER, "fiche-gabarit-cadre-reference-3.json"), "utf8")) as FicheTableau;
}

export function ficheGabaritCadre(): FicheTableau {
  return remettreEnForme(ficheGabaritCadreBrute(), { motsDouleur: MOTS_DOULEUR_GABARIT_CADRE });
}

export function contexteGabaritCadre(f: FicheTableau): ContexteTableau {
  return { aujourdhui: "2026-10-15", sourcesChiffres: [], preuves: [], matieres: [{ id: "mat-relance-demo", type: "demonstration", statut: "validee", perimeLe: "2027-01-15" }], texteScript: f.scenes.map((s) => s.texteDit).join(" "), motsDouleur: MOTS_DOULEUR_GABARIT_CADRE };
}

/** Calée sur une voix posée (16,5 caractères par seconde) ; lève si le calage refuse. */
export function caleeGabaritCadre(f: FicheTableau = ficheGabaritCadre(), cps = CPS_VOIX_POSEE): { fiche: FicheTableau; mots: MotCalage[]; elements: ElementCale[] } {
  const mots = motsRealistes(f, cps);
  const r = calerFicheTableau(f, mots, { contexte: contexteGabaritCadre(f), dureeSec: mots.at(-1)!.finSec + 0.3 });
  if (!r.ok) throw new Error(`gabarit cadré : calage refusé : ${r.problemes.join(" | ")}`);
  return { fiche: r.fiche, mots, elements: r.elements };
}

/* ------------------------------------------------------------------ */
/* Exemple validé AVEC VISUELS ET PEPS (maquette PR #260, 15/10)         */
/* ------------------------------------------------------------------ */

/** Mots de la douleur de l'accroche coupée avant son bloc orange (« Ce devis collé dans ChatGPT contient : »). */
export const MOTS_DOULEUR_VISUELS = ["devis collé", "ChatGPT"];
/** Source du chiffre « 3 » montré par le bloc orange de l'accroche (les trois données du devis, comptées dans le script). */
export const SOURCE_CHIFFRE_VISUELS = "src-exemple-devis";

/**
 * L'exemple validé, tel qu'un découpage version 13 le rend AVEC les visuels de la banque et le peps : l'accroche
 * « Ce devis collé dans ChatGPT contient : » + bloc orange « 3 données de trop. » (compteur 0 → 3) et le document aux
 * lignes barrées ; la promesse avec la liste cochée ; l'étape 1 avec le schéma personne → A ; l'étape 2 avec le
 * document ; l'étape 3 avec l'e-mail ; l'exemple avec le bouclier coché. Même texte dit, mot pour mot.
 */
export function ficheGabaritCadreVisuelsBrute(): FicheTableau {
  return JSON.parse(readFileSync(join(DOSSIER, "fiche-gabarit-cadre-visuels-reference-3.json"), "utf8")) as FicheTableau;
}

export function ficheGabaritCadreVisuels(): FicheTableau {
  return remettreEnForme(ficheGabaritCadreVisuelsBrute(), { motsDouleur: MOTS_DOULEUR_VISUELS });
}

export function contexteGabaritCadreVisuels(f: FicheTableau): ContexteTableau {
  return { ...contexteGabaritCadre(f), sourcesChiffres: [SOURCE_CHIFFRE_VISUELS], motsDouleur: MOTS_DOULEUR_VISUELS };
}

/** Calée sur une voix posée (16,5 caractères par seconde) ; lève si le calage refuse. */
export function caleeGabaritCadreVisuels(f: FicheTableau = ficheGabaritCadreVisuels(), cps = CPS_VOIX_POSEE): { fiche: FicheTableau; mots: MotCalage[]; elements: ElementCale[] } {
  const mots = motsRealistes(f, cps);
  const r = calerFicheTableau(f, mots, { contexte: contexteGabaritCadreVisuels(f), dureeSec: mots.at(-1)!.finSec + 0.3 });
  if (!r.ok) throw new Error(`gabarit cadré avec visuels : calage refusé : ${r.problemes.join(" | ")}`);
  return { fiche: r.fiche, mots, elements: r.elements };
}
