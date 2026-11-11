/**
 * ADAPTATEUR « SOURCE RÉELLE » DES IDÉES DU COMITÉ (fiche L6-03). Serveur seulement.
 *
 * Il habille la porte de l'Usine (fonction fournie par l'appelant) en `SourceIdees`.
 *  - Inactif (ou sans porte) : `simulee: true`, la porte n'est jamais appelée (la simulation sert).
 *  - Actif : `simulee: false` ; `tirer(n)` demande `n` combinaisons (30 par lot du comité) à la porte, écarte les
 *    entrées invalides et les doublons de signature, ne rend jamais plus de `n`.
 *  - Porte en échec : liste vide (aucune fausse idée, aucune exception).
 * Ce module ne fait aucun appel réseau : la porte est injectée (`brancherSourceIdees` la branchera ailleurs).
 */
import "server-only";
import { sourceIdeesSimulee, type CombinaisonUsine, type SourceIdees } from "@/services/source-idees";

/** La porte : rend jusqu'à `n` combinaisons (forme non fiable, vérifiée ici). */
export type PorteIdees = (n: number) => Promise<unknown>;

export interface OptionsSourceReelle {
  actif: boolean;
  porte?: PorteIdees;
}

function valide(c: unknown): c is CombinaisonUsine {
  if (!c || typeof c !== "object") return false;
  const { signature, parts, textes } = c as Record<string, unknown>;
  if (typeof signature !== "string" || !signature.trim()) return false;
  if (!parts || typeof parts !== "object") return false;
  if (!textes || typeof textes !== "object") return false;
  return Object.values(textes as Record<string, unknown>).some((t) => typeof t === "string" && t.trim() !== "");
}

export function sourceIdeesReelle(options: OptionsSourceReelle): SourceIdees {
  const { actif, porte } = options;
  if (!actif || !porte) return sourceIdeesSimulee();
  return {
    nom: "Usine (porte)",
    simulee: false,
    async tirer(n: number) {
      if (!(n > 0)) return [];
      let brut: unknown;
      try {
        brut = await porte(n);
      } catch {
        return [];
      }
      if (!Array.isArray(brut)) return [];
      const vues = new Set<string>();
      const sortie: CombinaisonUsine[] = [];
      for (const c of brut) {
        if (sortie.length >= n) break;
        if (!valide(c) || vues.has(c.signature)) continue;
        vues.add(c.signature);
        sortie.push(c);
      }
      return sortie;
    },
  };
}
