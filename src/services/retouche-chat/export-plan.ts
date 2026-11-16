/**
 * EXPORT LISIBLE DU PLAN (R1-09) — texte stable, lisible par un humain et par Claude hors Studio : en-tête, une ligne par
 * scène, les 12 opérations permises avec leurs champs et un exemple JSON. Pur, sans prix, aucun appel.
 */
import { TYPES_OPERATIONS_RETOUCHE, type TypeOperationRetouche } from "@/briques/operations";
import type { PlanValide } from "@/briques/plan-scenes/schema";

/** Champs de chaque opération (`?` = facultatif). Même liste fermée que `schema.ts`. */
const CHAMPS: Record<TypeOperationRetouche, string> = {
  "changer-mot": "sceneId, ancien, nouveau, champ?",
  "ajouter-chiffre": "sceneId, valeur, libelle, prefixe?, suffixe?, zone?",
  "changer-brique": "sceneId, piece, parametres?",
  "decaler-scene": "sceneId, mots? {premier, dernier}, decalageMs?",
  "changer-habillage": "habillage? {fond: ivoire|noir, accent: terracotta|orange}, transition? {sceneId, entree?, sortie?, dureeMs?}, position? {sceneId, position}",
  "ajouter-piece": "sceneId, piece, parametres?, zone?, debutMs?",
  "retirer-piece": "sceneId, piece",
  "remplacer-piece": "sceneId, ancienne, nouvelle, parametres?",
  "changer-transition": "sceneId?, entree?, sortie?, dureeMs?",
  "ajouter-dynamisme": "sceneIds?, intensite: leger|fort",
  "ajuster-zoom": "sceneId, facteur? (1 à 2,5), cible? {x, y}, moment? (0 à 0,8)",
  "modifier-script": "ancien, nouveau (seulement sur demande explicite)",
};

/** Exemple JSON valide, bâti sur la première scène du plan. */
export function EXEMPLE_OPERATIONS(plan: PlanValide): string {
  const sceneId = plan.scenes[0]?.id ?? "scene-1";
  return JSON.stringify({ operations: [{ type: "ajuster-zoom", sceneId, facteur: 1.3 }] });
}

const sec = (ms: number) => (ms / 1000).toFixed(1).replace(".", ",");

export function exporterPlanLisible(plan: PlanValide): string {
  const lignes: string[] = [
    "PLAN DE LA VIDÉO",
    `Format : ${plan.format.largeur}×${plan.format.hauteur}, ${plan.format.fps} images/s · durée ${sec(plan.dureeMs)} s · face caméra : ${plan.facecam ? "oui" : "non"}`,
    `Habillage : fond ${plan.habillage.fond}, accent ${plan.habillage.accent}`,
    "",
    "SCÈNES",
  ];
  for (const s of plan.scenes) {
    const lus = plan.mots.slice(s.mots.premier, s.mots.dernier + 1).map((m) => m.texte).join(" ");
    lignes.push(`- ${s.id} · ${sec(s.debutMs)}–${sec(s.finMs)} s · pièce ${s.piece} · écran « ${s.texte ?? ""} » · lu « ${lus} »`);
  }
  lignes.push("", "OPÉRATIONS PERMISES (12, rien d'autre)");
  for (const t of TYPES_OPERATIONS_RETOUCHE) lignes.push(`- ${t} : ${CHAMPS[t]}`);
  lignes.push("", "Réponds par un seul bloc JSON, 20 opérations au plus :", EXEMPLE_OPERATIONS(plan));
  return lignes.join("\n");
}
