/**
 * S-06-a-v20k — adaptateur « tableau » du lecteur commun (SENSIBLE ARGENT, ÉTEINT : aucun importeur).
 * Quand les règles du tableau ne comprennent pas la demande, Claude peut proposer UNE opération du catalogue fermé ;
 * le code la revérifie toujours (schéma strict PUIS aperçu). Tout passe par les ports du lecteur commun : aucun second
 * lecteur, aucun second compteur, aucun appel direct à Claude. Pur : aucun accès base.
 */
import { z } from "zod";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { FicheTableau } from "@/moteurs/montage-tableau/fiche";
import { apercuRetouche, schemaOperationRetouche, type ContexteRetouche, type OperationRetouche as OperationRetoucheTableau } from "@/moteurs/montage-tableau/retouches";
import { envelopper, neutraliser } from "./donnees-sures";
import { lireDemande, type PortsLecteur, type SupplementLecteur } from "./lecteur-demande";

/** Le tableau n'a pas de plan de scènes : le lecteur commun en exige un, on lui donne un plan vide (aucune scène, aucun mot). */
export const PLAN_SCENES_VIDE = {
  version: "plan-scenes-1",
  format: { largeur: 1080, hauteur: 1920, fps: 25 },
  facecam: false,
  dureeMs: 1,
  habillage: { fond: "ivoire", accent: "terracotta" },
  mots: [],
  scenes: [],
} as unknown as PlanValide;

const REFUS = "Une opération proposée pour le tableau a été écartée.";

function blocTableau(fiche: FicheTableau): string {
  const schema = JSON.stringify(z.toJSONSchema(schemaOperationRetouche));
  const ecrans = fiche.scenes.map((s, i) => `Écran ${i + 1} · scène ${neutraliser(s.id)} · dit : ${envelopper("ecran", s.texteDit)} · éléments : ${s.elements.map((e) => `${neutraliser(e.id)} (${e.type})`).join(", ")}`).join("\n");
  return ["Opérations possibles sur le tableau (UNE seule, liste fermée, JSON de cette forme) :", schema, "Écrans :", ecrans].join("\n");
}

/** Supplément du lecteur : au plus UNE opération gardée, la première qui passe le schéma strict ET l'aperçu. */
export function supplementTableau(fiche: FicheTableau, contexte: ContexteRetouche): SupplementLecteur<OperationRetoucheTableau> {
  return {
    bloc: blocTableau(fiche),
    regles: () => [],
    relire: (brut) => {
      if (!Array.isArray(brut)) return { operations: [], remarques: [REFUS] };
      for (const candidate of brut) {
        const lu = schemaOperationRetouche.safeParse(candidate);
        if (!lu.success) continue;
        try {
          if (apercuRetouche(fiche, lu.data, contexte).ok) return { operations: [lu.data], remarques: [] };
        } catch {
          // Une fiche ou une opération qui fait lever l'aperçu = refus.
        }
      }
      return { operations: [], remarques: [REFUS] };
    },
  };
}

/** Ne lève jamais. Au plus un appel (celui du lecteur commun). Les opérations du plan de scènes rendues par le lecteur sont ignorées. */
export async function lireDemandeTableauParClaude(fiche: FicheTableau, texte: string, contexte: ContexteRetouche, ports: PortsLecteur): Promise<OperationRetoucheTableau | null> {
  try {
    const l = await lireDemande<OperationRetoucheTableau>({ phrase: texte, plan: PLAN_SCENES_VIDE, supplement: supplementTableau(fiche, contexte) }, ports);
    return l.supplementaires[0] ?? null;
  } catch {
    return null;
  }
}
