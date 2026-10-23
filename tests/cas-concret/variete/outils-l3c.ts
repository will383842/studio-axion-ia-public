/**
 * L3c · outils des tests : le plan (PUR) de chaque type d'écran du corps, les images où on le regarde, une vidéo type et
 * une série de tirages. Aucun `.tsx`.
 */
import type { ProprietesEcran } from "@/briques/ecrans-motion";
import { ajouterAHistorique, entreeHistorique, tirer, type EcranAMettre, type EntreeHistorique } from "@/moteurs/montage-cas-concret/variete";

/** Écrans d'une vidéo type (plusieurs moments forts possibles : titre, chiffre, résultat, preuve). */
export const ECRANS_L3C: EcranAMettre[] = [
  { id: "e01", type: "accroche" },
  { id: "e02", type: "liste-avant" },
  { id: "e03", type: "titre" },
  { id: "e04", type: "etape" },
  { id: "e05", type: "etape" },
  { id: "e06", type: "chiffre" },
  { id: "e07", type: "resultat" },
  { id: "e08", type: "preuve" },
  { id: "e09", type: "titre" },
  { id: "e10", type: "question" },
];

/** Série de vidéos tirées l'une après l'autre (historique cumulé), déterministe. */
export function serieL3c(n: number): EntreeHistorique[] {
  let historique: EntreeHistorique[] = [];
  const faites: EntreeHistorique[] = [];
  for (let i = 0; i < n; i++) {
    const videoId = `v-l3c-${i}`;
    const canaux = i % 2 ? ["instagram", "tiktok"] : ["facebook"];
    const e = entreeHistorique(videoId, canaux, tirer({ videoId, canaux, historique }), "2026-10-15T12:00:00.000Z");
    faites.push(e);
    historique = ajouterAHistorique(historique, e);
  }
  return faites;
}
import { planAccroche } from "../../../studio-rendu/compositions/cas-concret/plans/Accroche";
import { planChiffre } from "../../../studio-rendu/compositions/cas-concret/plans/Chiffre";
import { planEtape } from "../../../studio-rendu/compositions/cas-concret/plans/Etape";
import { planListeAvant } from "../../../studio-rendu/compositions/cas-concret/plans/ListeAvant";
import { planObjet } from "../../../studio-rendu/compositions/cas-concret/plans/Objet";
import { planPreuve } from "../../../studio-rendu/compositions/cas-concret/plans/Preuve";
import { planQuestion } from "../../../studio-rendu/compositions/cas-concret/plans/Question";
import { planResultat } from "../../../studio-rendu/compositions/cas-concret/plans/Resultat";
import { planTitre } from "../../../studio-rendu/compositions/cas-concret/plans/Titre";

/** Images regardées (25 i/s) : début, entrées, milieu, fin d'un écran de 3 s. */
export const IMAGES = [0, 3, 8, 15, 25, 40, 60, 74] as const;

/** Types du corps (ceux qui lisent le `jeu` de L3c). */
export const TYPES_CORPS = ["accroche", "titre", "question", "chiffre", "resultat", "etape", "objet", "liste-avant", "preuve"] as const;

/** Le plan d'un écran du corps à l'image donnée (`null` pour un autre type). */
export function planDuCorps(p: ProprietesEcran, image: number): unknown {
  switch (p.type) {
    case "accroche":
      return planAccroche(p, image);
    case "titre":
      return planTitre(p, image);
    case "question":
      return planQuestion(p, image);
    case "chiffre":
      return planChiffre(p, image);
    case "resultat":
      return planResultat(p, image);
    case "etape":
      return planEtape(p, image);
    case "objet":
      return planObjet(p, image);
    case "liste-avant":
      return planListeAvant(p, image);
    case "preuve":
      return planPreuve(p, image);
    default:
      return null;
  }
}
