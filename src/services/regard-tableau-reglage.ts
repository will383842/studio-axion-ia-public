/**
 * S-10-BRANCHER-v20l : le regard de Claude sur la vidéo finie du tableau, branché derrière le réglage `regardeur.tableau`
 * (décision de Williams Q7 « POUR LE 5 OK » + pilote 21/11 07:20 : ALLUMÉ par défaut ; absent ou `true` exact allume, `false`, une autre valeur
 * ou une lecture en échec l'éteignent). Variante A : sortie PRINCIPALE seulement, 2 regards au plus par vidéo, plafond propre `tbreg`
 * (montant dans `plafond-regard-tableau.ts`, appliqué par `regardeur-tableau.ts`). Le relecteur n'est chargé qu'au premier regard.
 * DEUX arrêts : (1) la garde S-10-GARDE-A (compteur en mémoire) ne vaut QUE pour un passage : les outils sont refaits à chaque
 * passage de la fabrication ; (2) l'arrêt DURABLE `regardPermis`, lu dans les dépenses et réservations de la vidéo AVANT
 * chaque regard (dur, quel que soit le mode du budget) : déjà 2 regards payés, ou engagé + pire cas d'un regard au-delà du plafond
 * `tbreg` ⇒ « images non relues », sans appel (AUDIT ARGENT 25/11).
 */
import "server-only";
import type { FicheTableau } from "@/moteurs/montage-tableau/fiche";
import type { MiseEnPageTableau } from "@/moteurs/montage-tableau/mise-en-page";
import type { RelectureImagesCles } from "@/moteurs/montage-tableau/controles";
import { garderRegard, MAX_REGARDS_PAR_VIDEO, RAISON_NON_RELUE } from "@/moteurs/montage-tableau/garde-regard";
import type { OrigineLancement } from "./budget-mensuel";
import { depots, lireParametre } from "./_commun";

export const PARAM_REGARD_TABLEAU = "regardeur.tableau";
/** Pire cas d'UN regard, en centimes de dollar : la moitié du plafond `tbreg`, pour que les 2 regards permis tiennent. */
export const PIRE_CAS_REGARD_CENTIMES = 36;

type Video = { cle: string; dureeSec: number; attendre?: () => Promise<void> };
export type RelireImagesClesTableau = (fiche: FicheTableau, miseEnPage: MiseEnPageTableau, video: Video) => Promise<RelectureImagesCles>;

/** Ce que la vidéo a DÉJÀ engagé pour le regard (lu dans les dépôts), plus la valeur du plafond : tout en centimes de dollar. */
export interface EngagementRegard {
  engageCentimes: number;
  /** Regards déjà payés ou en cours (dépenses de l'étape « Tableau · regard » + réservations actives `tbreg`). */
  regardsPayes: number;
  plafondCentimes: number;
}

/** Vrai si un regard réel peut partir. Pure : l'engagement est lu par l'appelant. */
export function regardPermis(e: EngagementRegard, pireCasCentimes = PIRE_CAS_REGARD_CENTIMES): boolean {
  const ok = [e.engageCentimes, e.regardsPayes, e.plafondCentimes, pireCasCentimes].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0);
  return ok && e.regardsPayes < MAX_REGARDS_PAR_VIDEO && e.engageCentimes + pireCasCentimes <= e.plafondCentimes;
}

/** Lecture durable de l'engagement de la vidéo (dépenses + réservations), chargée seulement au premier regard. */
async function engagementDuStudio(videoId: string): Promise<EngagementRegard> {
  const [{ engagePlafondPropreCentimes, valeurPlafondPropre, PREFIXE_ETAPE_REGARD_TABLEAU, PREFIXE_APPEL_TEXTE }, { PLAFOND_REGARD_TABLEAU }] = await Promise.all([import("./depense-claude-video"), import("./plafond-regard-tableau")]);
  const d = depots();
  const [engageCentimes, plafondUsd, depenses, reservations] = await Promise.all([
    engagePlafondPropreCentimes(videoId, PLAFOND_REGARD_TABLEAU),
    valeurPlafondPropre(PLAFOND_REGARD_TABLEAU),
    d.depenses.lister((x) => x.videoId === videoId && x.lignes.some((l) => l.etape.startsWith(PREFIXE_ETAPE_REGARD_TABLEAU))),
    d.reservations.lister((x) => x.videoId === videoId && x.statut === "active" && !!x.travailId?.startsWith(`${PREFIXE_APPEL_TEXTE}-${PLAFOND_REGARD_TABLEAU.id}-`)),
  ]);
  return { engageCentimes, regardsPayes: depenses.length + reservations.length, plafondCentimes: Math.round(plafondUsd * 100) };
}

export interface ReglageRegardTableau {
  videoId: string;
  env: string;
  origine?: OrigineLancement;
  /** Phrase À L'ÉCRAN de la fin de la sortie principale (texte permis), ou rien. */
  finEcran?: (fiche: FicheTableau) => string | undefined;
  lire?: (id: string, defaut: unknown) => Promise<unknown>;
  /** Tests : le relecteur à garder (absent : `relecteurTableau` du studio, chargé au premier regard). */
  relecteur?: RelireImagesClesTableau;
  /** Lecture de l'engagement durable. Absent : le Studio (dépôts) ; absent AVEC un relecteur injecté : pas d'arrêt durable (anciens tests). Une lecture qui lève = refus. */
  engagement?: (videoId: string) => Promise<EngagementRegard>;
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
  // Arrêt durable AVANT chaque regard réel : en cas de doute (lecture en panne, valeur illisible) : pas d'appel.
  const lireEngagement = r.engagement ?? (r.relecteur ? undefined : engagementDuStudio);
  const nonRelue = () => ({ imagesLues: 0, remarques: [{ image: 1, raison: RAISON_NON_RELUE }] });
  const relecteurDur: RelireImagesClesTableau = async (fiche, miseEnPage, video) => {
    if (lireEngagement) {
      const permis = await Promise.resolve().then(() => lireEngagement(r.videoId)).then((e) => regardPermis(e), () => false);
      if (!permis) return nonRelue();
    }
    return relecteur(fiche, miseEnPage, video);
  };
  // La première vidéo regardée est la sortie principale (la fabrication ne passe le crochet qu'à elle) : la garde la retient.
  let garde: ReturnType<typeof garderRegard<FicheTableau, MiseEnPageTableau>> | null = null;
  return { relireImagesCles: async (fiche, miseEnPage, video) => (garde ??= garderRegard(relecteurDur, { clePrincipale: video.cle }))(fiche, miseEnPage, video) };
}
