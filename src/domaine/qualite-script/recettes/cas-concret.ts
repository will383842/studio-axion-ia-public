/**
 * RECETTE QUALITÉ · CAS CONCRET (fiche d'écrans, la v4 en référence). PUR.
 * Débit : celui de la recette du format (`formatCasConcret.recetteScript.motsParSeconde`). Le corps finit sur UNE
 * question ; la fin (« Écrivez PLAN… ») vient de la banque des fins, par réseau. Vrais écrans et événements : la règle
 * « changement à l'écran » se mesure.
 */
import { formatCasConcret } from "@/formats/cas-concret";
import { MOTS_MAX } from "@/moteurs/montage-cas-concret/regles";
import type { RecetteQualite } from "../types";

export const RECETTE_CAS_CONCRET: RecetteQualite = {
  id: "cas-concret",
  libelle: "Cas concret",
  debit: { unite: "mots", parSeconde: formatCasConcret.recetteScript.motsParSeconde },
  reseaux: ["linkedin", "instagram", "facebook", "tiktok"],
  faceCamera: false,
  ecransReels: true,
  demandeFinale: "question",
  interdits: "cas-concret",
  structures: [{ id: "v4", parties: ["accroche", "preuve", "douleur", "corps", "preuve", "question"] }],
  ecarts: { motsEcritsMax: { valeur: MOTS_MAX.ligne, raison: "Cas concret R08 : une ligne d'écran fait 8 mots au plus." } },
};
