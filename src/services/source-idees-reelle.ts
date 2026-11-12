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
  if (!parts || typeof parts !== "object" || Array.isArray(parts)) return false;
  if (!Object.values(parts as Record<string, unknown>).every((v) => v === null || typeof v === "string")) return false;
  if (!textes || typeof textes !== "object" || Array.isArray(textes)) return false;
  const valeurs = Object.values(textes as Record<string, unknown>);
  if (!valeurs.every((t) => typeof t === "string")) return false;
  return valeurs.some((t) => (t as string).trim() !== "");
}

export function sourceIdeesReelle(options: OptionsSourceReelle): SourceIdees {
  const { actif, porte } = options;
  if (!actif || !porte) return sourceIdeesSimulee();
  return {
    nom: "Usine (porte)",
    simulee: false,
    async tirer(n: number) {
      const nb = Math.floor(n);
      if (!(nb > 0)) return [];
      let brut: unknown;
      try {
        brut = await porte(nb);
      } catch {
        return [];
      }
      if (!Array.isArray(brut)) return [];
      const vues = new Set<string>();
      const sortie: CombinaisonUsine[] = [];
      for (const c of brut) {
        if (sortie.length >= nb) break;
        if (!valide(c) || vues.has(c.signature.trim())) continue;
        vues.add(c.signature.trim());
        sortie.push(c);
      }
      return sortie;
    },
  };
}
