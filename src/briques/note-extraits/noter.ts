/**
 * Note d'intérêt d'un moment (X4-04). Fonction pure : même entrée, même sortie ; aucune date, aucun hasard, aucun réseau.
 * Appelée seulement par X4-06. Un moment exclu par le chantier 3 n'est jamais noté. Chaque raison est { code, points }
 * (affichée à l'écran en clair) : la somme des raisons = la note avant bornage (0..100).
 */
import type { EtatPlageExtrait } from "@/domaine/archive-extraits";
import { normaliser } from "@/domaine/ciblage/controles";
import { faitsDuScript, type Fait, type MotFait } from "@/briques/faits-script";
import { estPiece } from "@/briques/plan-scenes/catalogue";
import {
  DUREE_BONUS_MAX_SEC, DUREE_BONUS_MIN_SEC, INTERET_PAR_PIECE, MOTS_CREUX, MOTS_PLEINS_MIN, MOTS_VIDES, POINTS, POINTS_PAR_MONTRE,
  SEUIL_GARDE, SEUIL_PEUT_ETRE,
} from "./bareme";
import type { Moment, NoteMoment, SujetExtrait } from "./types";

export interface ContexteNote {
  /** Sujet déjà décidé par `sujetDuMoment` (X4-02) ; `null` = aucun reconnu. */
  sujet: SujetExtrait | null;
  /** État du chantier 3 : « exclue » passe avant tout. */
  etat?: EtatPlageExtrait;
  /** Source propre (écran de démo, capture, scène rendue seule). Défaut : vrai pour `ecran-demo` et `capture-cas`. */
  sourcePropre?: boolean;
  /** Mot-clé de la vidéo (`couvertureVignette.motCle`). */
  motCle?: string;
  /** Faits déjà extraits de la phrase, ou les mots (extraits ici par `faitsDuScript`). */
  faits?: readonly Fait[];
  mots?: readonly MotFait[];
}

const TYPES_FAIT = new Set(["nombre", "passage", "comparaison", "etapes"]);
const VIDES = new Set(MOTS_VIDES);

function estCreuse(texte: string): boolean {
  const t = ` ${normaliser(texte)} `;
  if (MOTS_CREUX.some((f) => t.includes(` ${f} `) || t.includes(` ${f}`))) return true;
  const pleins = t.split(" ").filter((w) => w && !VIDES.has(w));
  return pleins.length < MOTS_PLEINS_MIN;
}

export function noter(moment: Moment, contexte: ContexteNote): NoteMoment {
  const sujet = contexte.sujet;
  if (contexte.etat === "exclue") {
    return { note: 0, raisons: [{ code: "exclu-droit", points: 0 }], sujet, usages: [], decision: "ignore" };
  }
  const raisons: { code: string; points: number }[] = [];
  const ajoute = (code: string, points: number) => { if (points !== 0) raisons.push({ code, points }); };

  const ecran = moment.origine === "ecran-demo" || moment.origine === "capture-cas";
  const principale = moment.pieces?.[0];
  if (ecran) ajoute("interface", POINTS.interface);
  else if (principale && estPiece(principale)) ajoute(moment.montre, INTERET_PAR_PIECE[principale]);
  else ajoute(moment.montre, POINTS_PAR_MONTRE[moment.montre]);

  const propre = contexte.sourcePropre ?? ecran;
  if (propre && !moment.avecVisage && !moment.texteIncruste) ajoute("source-propre", POINTS.sourcePropre);
  if (moment.texteIncruste) ajoute("texte-incruste", POINTS.texteIncruste);
  ajoute(sujet ? "sujet-reconnu" : "sujet-absent", sujet ? POINTS.sujetReconnu : POINTS.sujetAbsent);

  const texte = moment.texte ?? "";
  if (texte) {
    const faits = contexte.faits ?? (contexte.mots ? faitsDuScript(contexte.mots) : []);
    if (faits.some((f) => TYPES_FAIT.has(f.type))) ajoute("fait", POINTS.fait);
    const cle = contexte.motCle ? normaliser(contexte.motCle) : "";
    if (cle && ` ${normaliser(texte)} `.includes(` ${cle} `)) ajoute("mot-cle", POINTS.motCle);
    if (estCreuse(texte)) ajoute("phrase-creuse", POINTS.creuse);
  } else if (contexte.faits?.some((f) => TYPES_FAIT.has(f.type))) {
    ajoute("fait", POINTS.fait);
  }

  const duree = moment.finSec - moment.debutSec;
  if (duree >= DUREE_BONUS_MIN_SEC && duree <= DUREE_BONUS_MAX_SEC) ajoute("duree", POINTS.duree);

  const brut = raisons.reduce((s, r) => s + r.points, 0);
  const note = Math.max(0, Math.min(100, brut));
  const decision = note >= SEUIL_GARDE ? "garde" : note >= SEUIL_PEUT_ETRE ? "peut-etre" : "ignore";
  return { note, raisons, sujet, usages: [], decision };
}
