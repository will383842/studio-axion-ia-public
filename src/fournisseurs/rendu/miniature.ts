/**
 * MINIATURES RÉELLES « studio-rendu » (lot R4, 03/10) — gratuites, calculées sur notre serveur (opération `miniature`).
 * Une demande par miniature (file courte) : 5 images autour de l'instant, la plus nette, titre de couverture posé
 * dans la zone sûre, JPEG ≤ 2 Mo. Le studio fournit la vidéo et les dépôts déjà signés (`SourceMiniature`).
 * Chaque miniature est attendue par `executerRendu` (attente BORNÉE, hors verrou ; une panne passagère est soumise à
 * nouveau deux fois au plus), toutes en même temps (`Promise.allSettled`) : une miniature qui n'aboutit pas est
 * simplement absente de la réponse, sans gêner les autres ; sans aucune, le studio pose la vignette réelle de la
 * vidéo, jamais une image de démonstration.
 * Inscrit seulement si `STUDIO_RENDU_URL` existe (`rendu/inscription.ts`) ; actif par `FOURNISSEUR_MINIATURE=studio-rendu`
 * (ou le réglage « fournisseur.miniature »).
 */
import { couvertureDepuisTitre } from "@/domaine/miniatures";
import { ambianceEtMises, interditsVignette } from "@/domaine/vignettes";
import type { FournisseurMiniature, PropositionMiniature, ServiceRendu } from "../types";
import { executerRendu } from "./attente";
import { identifiantSur } from "./commun";

export interface DependancesMiniature {
  rendu: () => ServiceRendu;
  attendre?: (ms: number) => Promise<void>;
  maintenant?: () => number;
  /** Attente maximale de chaque miniature (défaut 120 s ; elles sont attendues en même temps). */
  delaiMs?: number;
}

/** Nouvelles soumissions au plus après une panne passagère (celles d'`executerRendu`). */
export const ESSAIS_MINIATURE = 2;

export function creerFournisseurMiniatureStudioRendu(deps: DependancesMiniature): FournisseurMiniature {
  const maintenant = deps.maintenant ?? Date.now;
  return {
    id: "studio-rendu",
    type: "miniature",
    nom: "Miniatures, sur le serveur",
    reelPrevu: "Remotion + FFmpeg",
    mode: "reel",
    // Calculées sur notre serveur : aucun coût à l'usage.
    capacites: { asynchrone: false, accordExige: false },
    async proposer({ videoId, titre, nombre, source, couverture }) {
      if (!source) return [];
      const n = Math.min(nombre, source.instantsSec.length, source.depots.length);
      // 5 mots au plus sur l'image, quelle que soit la provenance (générateur, titre, saisie) : même règle partout.
      const texte = couvertureDepuisTitre(couverture?.texte ?? titre);
      const v2 = source.gabarit === "axion-v2";
      // Vignette v2 : un titre qui contient un interdit ne part jamais (journal sans le titre).
      if (v2 && interditsVignette(texte).length) {
        console.warn("[rendu] vignette refusée : le titre contient un mot interdit");
        return [];
      }
      const { ambiance, mises } = ambianceEtMises(source.rangVideo ?? 0);
      const marque = maintenant().toString(36);
      const service = deps.rendu();
      const demandes = Array.from({ length: n }, (_, i) => ({ instant: source.instantsSec[i], variante: source.variantes?.[i] ?? i % 3, sortie: source.depots[i], i }));
      const faites = await Promise.allSettled(
        demandes.map((d) =>
          executerRendu(
            service,
            {
              idRendu: `miniature-${identifiantSur(videoId)}-${d.i + 1}-${marque}`,
              operation: "miniature",
              file: "courte",
              entrees: { video: source.url },
              sortie: d.sortie,
              parametres: {
                instantSec: d.instant, dureeSec: source.dureeSec, ratio: source.ratio, couverture: texte, motCle: couverture?.motCle ?? "", variante: d.variante,
                ...(v2 ? { gabarit: "axion-v2", ambiance, mise: mises[d.variante % mises.length], generateur: source.formatId ?? "" } : {}),
              },
            },
            { delaiMs: deps.delaiMs ?? 120_000, essais: ESSAIS_MINIATURE, attendre: deps.attendre, maintenant: deps.maintenant },
          ),
        ),
      );
      const propositions: PropositionMiniature[] = [];
      faites.forEach((r, k) => {
        const d = demandes[k];
        if (r.status === "fulfilled") propositions.push({ fichierCle: d.sortie.cle, titre: texte, incrustee: !!texte, instantSec: r.value.mesures?.instant ?? d.instant, variante: d.variante, ...(v2 ? { ambiance, mise: mises[d.variante % mises.length] } : {}) });
      });
      return propositions;
    },
  };
}
