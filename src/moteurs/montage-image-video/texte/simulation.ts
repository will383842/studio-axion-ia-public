/**
 * IMAGE → VIDÉO · MODE TEXTE (R6a) · Doubles de simulation de la conception : AUCUN appel payant, aucun hasard.
 * `appelerConceptionEnSimulation` rend une conception prévue (ou une réponse forcée : panne, réponse coupée…).
 */
import type { LectureImage } from "../lecture/consigne";
import type { ReponseAppelLecture } from "../lecture";

type Noeud = LectureImage["noeuds"][number];
const noeud = (id: string, ordre: number, libelle: string, role: Noeud["role"], couleur: Noeud["couleur"], icone: string, detail = ""): Noeud => ({
  id, libelle, detail, role, icone, couleur, acteur: "auto", groupe: "", ordre, quantite: null, sousElements: [], exemple: false, photoPersonnes: false,
});
const lien = (id: string, de: string, vers: string): LectureImage["liens"][number] => ({ id, de, vers, etiquette: "", part: null, couleur: "orange", style: "plein" });

/** Conception d'exemple (relance de factures en retard, PME) : celle que rend le rôle en mode simulation du studio. */
export const CONCEPTION_DEMO: LectureImage = {
  type: "chaine",
  titre: "Relance des factures en retard, sans y penser",
  sousTitre: "",
  phraseChoc: "Vos factures se relancent toutes seules. Votre trésorerie respire.",
  signature: "",
  noeuds: [
    noeud("n01", 1, "Facture en retard", "declencheur", "noir", "horloge", "détectée dans le tableur"),
    noeud("n02", 2, "IA rédige la relance", "etape", "orange", "etincelle", "ton adapté au client"),
    noeud("n03", 3, "Envoi par e-mail", "etape", "orange", "enveloppe"),
    noeud("n04", 4, "Suivi du paiement", "etape", "orange", "tableau"),
    noeud("n05", 5, "Trésorerie encaissée plus tôt", "resultat", "vert", "coche"),
  ],
  liens: [lien("l01", "n01", "n02"), lien("l02", "n02", "n03"), lien("l03", "n03", "n04"), lien("l04", "n04", "n05")],
  groupes: [],
  bandeau: [],
  pied: ["Exemple de situation type."],
};

/** Conception vide (texte absurde : rien à concevoir). */
export const CONCEPTION_VIDE: LectureImage = { type: "inconnu", titre: "", sousTitre: "", phraseChoc: "", signature: "", noeuds: [], liens: [], groupes: [], bandeau: [], pied: [] };

/** Double de l'appel Claude : rend `reponses` dans l'ordre (la dernière se répète) ; chaque entrée envoyée est notée dans `journal`. */
export function appelerConceptionEnSimulation(
  reponses: LectureImage | ReponseAppelLecture | (ReponseAppelLecture | LectureImage)[] = CONCEPTION_DEMO,
  journal: { variable: string; envoye: string }[] = [],
) {
  let rang = 0;
  return async (_role: unknown, entree: { variable: string }): Promise<ReponseAppelLecture> => {
    journal.push({ variable: entree.variable, envoye: JSON.stringify(entree) });
    const r = Array.isArray(reponses) ? reponses[Math.min(rang++, reponses.length - 1)] : reponses;
    return "ok" in r ? r : { ok: true, simule: true, donnees: structuredClone(r) };
  };
}
