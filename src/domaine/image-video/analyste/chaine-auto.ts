/**
 * IMAGE → VIDÉO · R5 · Chaîne d'adaptation AUTOMATIQUE de la carte. PUR, aucun appel IA, ni date, ni hasard.
 *
 * Règle : une image incohérente ne bloque jamais la vidéo, le code répare et adapte SEUL, sans validation.
 * Ordre fixe, AVANT la validation de la carte et l'écriture du script (l'empreinte de la carte, lue par la règle Q03, change
 * dès que la carte change) :
 *   1. `reparerEtSignaler` (R2) : doublons, références cassées, cycles, type non satisfait ;
 *   2. `reparerOrphelinsDeBranche` : blocs sans flèche rangés dans une branche ;
 *   3. `analyserRealisme` puis `appliquerOperations` (R3) : calculs faux, chiffres absurdes, parts, ordre ;
 *   4. les phrases affirmatives sont GARDÉES telles quelles ; seule une phrase « à vérifier » est écrite.
 * Chaque changement est dit dans `carte.adaptations` (canal unique de R1/R2). Si la carte change, `validation` est retirée
 * (elle porte l'empreinte de l'ancienne carte). Idempotent. Ne lève jamais : au pire la carte d'origine est rendue.
 */
import { reparerOrphelinsDeBranche, type CarteImage } from "../carte";
import { ecrireAdaptations, reparerEtSignaler } from "../reparation";
import { analyserRealisme, appliquerOperations, type CodeRealisme } from "./realisme";

export interface ResultatAdaptationAuto {
  carte: CarteImage;
  /** Vrai si la carte n'est plus celle d'entrée (la validation éventuelle a alors été retirée). */
  changee: boolean;
  /** Une phrase par adaptation de CET appel, pour le journal. */
  phrases: string[];
}

const A_VERIFIER: Readonly<Record<CodeRealisme, string>> = {
  "calcul-faux": "un calcul affiché ne tombe pas juste",
  "noeud-sans-lien": "un bloc n'est relié à rien",
  "boucle-sans-sortie": "une boucle n'a pas de sortie",
  "chiffre-absurde": "un chiffre paraît irréaliste",
  "parts-incorrectes": "des parts ne font pas 100",
  "entonnoir-croissant": "les étapes de l'entonnoir augmentent : la scène entonnoir est remplacée par la toile",
  "ordre-ambigu": "deux blocs ont le même rang",
};

export function adapterCarteAutomatiquement(entree: CarteImage, options: { typeChoisi?: boolean } = {}): ResultatAdaptationAuto {
  try {
    const phrases: string[] = [];
    let carte = reparerEtSignaler(entree, { typeChoisi: !!options.typeChoisi }).carte;
    const { carte: reliee, deduits } = reparerOrphelinsDeBranche(carte);
    if (deduits.length > 0) {
      phrases.push(`Lien déduit de la mise en page (aucune flèche sur l'image) : ${deduits.map((l) => `${l.de} → ${l.vers}`).join(", ")}.`);
      carte = reliee;
    }
    // Réalisme : les opérations sont fermées et sûres ; `appliquerOperations` ne lève jamais.
    const ops = analyserRealisme(carte).operationsProposees;
    if (ops.length > 0) {
      const avant = new Set(carte.lecture.alertes);
      const corrigee = appliquerOperations(carte, ops);
      for (const a of corrigee.lecture.alertes) if (!avant.has(a) && a.startsWith("Corrigé par le code")) phrases.push(a);
      carte = corrigee;
    }
    for (const p of analyserRealisme(carte).problemes) phrases.push(`À vérifier : ${A_VERIFIER[p.code]} (${p.blocs.join(", ") || "carte"}).`);
    // Phrases affirmatives : gardées, jamais remplacées ; dites pour relecture.
    for (const f of carte.formulesAbsolues) if (!f.choixWill) phrases.push(`Phrase affirmative gardée telle quelle, à vérifier : « ${f.texte} ».`);

    const ecrite = ecrireAdaptations(carte, phrases);
    if (JSON.stringify(ecrite) === JSON.stringify(entree)) return { carte: entree, changee: false, phrases: [] };
    // La carte change : sa validation (empreinte de l'ancienne carte) tombe.
    const { validation: _ancienne, ...sansValidation } = ecrite;
    const dejaDites = new Set(entree.adaptations ?? []);
    const nouvelles = (ecrite.adaptations ?? []).filter((x) => !dejaDites.has(x)).map((x) => x.replace(/^Adapté automatiquement : /, ""));
    return { carte: sansValidation as CarteImage, changee: true, phrases: nouvelles };
  } catch {
    return { carte: entree, changee: false, phrases: [] };
  }
}
