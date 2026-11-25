/**
 * S-10-BRANCHER-v20l : le regard de Claude sur la vidéo finie du tableau, branché derrière le réglage `regardeur.tableau`
 * (décision de Williams Q7 « POUR LE 5 OK » + pilote 21/11 07:20 : ALLUMÉ par défaut ; absent ou `true` exact allume, `false`, une autre valeur
 * ou une lecture en échec l'éteignent). Variante A : sortie PRINCIPALE seulement, 2 regards au plus par vidéo (garde
 * S-10-GARDE-A, créée UNE fois pour les outils de la fabrication, hors de la boucle des sorties), plafond propre `tbreg`
 * (montant dans `plafond-regard-tableau.ts`, appliqué par `regardeur-tableau.ts`). Le relecteur n'est chargé qu'au premier regard.
 */
import "server-only";
import type { FicheTableau } from "@/moteurs/montage-tableau/fiche";
import type { MiseEnPageTableau } from "@/moteurs/montage-tableau/mise-en-page";
import type { RelectureImagesCles } from "@/moteurs/montage-tableau/controles";
import { garderRegard } from "@/moteurs/montage-tableau/garde-regard";
import type { OrigineLancement } from "./budget-mensuel";
import { lireParametre } from "./_commun";

export const PARAM_REGARD_TABLEAU = "regardeur.tableau";

type Video = { cle: string; dureeSec: number; attendre?: () => Promise<void> };
export type RelireImagesClesTableau = (fiche: FicheTableau, miseEnPage: MiseEnPageTableau, video: Video) => Promise<RelectureImagesCles>;

export interface ReglageRegardTableau {
  videoId: string;
  env: string;
  origine?: OrigineLancement;
  /** Phrase À L'ÉCRAN de la fin de la sortie principale (texte permis), ou rien. */
  finEcran?: (fiche: FicheTableau) => string | undefined;
  lire?: (id: string, defaut: unknown) => Promise<unknown>;
  /** Tests : le relecteur à garder (absent : `relecteurTableau` du studio, chargé au premier regard). */
  relecteur?: RelireImagesClesTableau;
}

/** Le crochet `relireImagesCles` des outils du tableau, ou `{}` (réglage éteint : la fabrication d'avant, à l'identique). */
export async function regardTableauRegle(r: ReglageRegardTableau): Promise<{ relireImagesCles?: RelireImagesClesTableau }> {
  const lire = r.lire ?? ((id: string, defaut: unknown) => lireParametre<unknown>(id, defaut));
  const allume = (await Promise.resolve().then(() => lire(PARAM_REGARD_TABLEAU, true)).catch(() => false)) === true;
  if (!allume) return {};
  const relecteur: RelireImagesClesTableau =
    r.relecteur ??
    (async (fiche, miseEnPage, video) => {
      const { relecteurTableau } = await import("./regardeur-tableau");
      const ecran = r.finEcran?.(fiche);
      return relecteurTableau({ videoId: r.videoId, env: r.env, ...(r.origine ? { origine: r.origine } : {}), ...(ecran ? { fin: { ecran } } : {}) })(fiche, miseEnPage, video);
    });
  // La première vidéo regardée est la sortie principale (la fabrication ne passe le crochet qu'à elle) : la garde la retient.
  let garde: ReturnType<typeof garderRegard<FicheTableau, MiseEnPageTableau>> | null = null;
  return { relireImagesCles: async (fiche, miseEnPage, video) => (garde ??= garderRegard(relecteur, { clePrincipale: video.cle }))(fiche, miseEnPage, video) };
}
