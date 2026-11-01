/**
 * Z3-M · services d'écriture de la migration (interfaces). L'implémentation par défaut est « non branchée » :
 * rien n'écrit chez Zernio ni chez Buffer tant que l'import des brouillons n'est pas branché sur l'écran.
 * Les composants n'appellent jamais le réseau : ils reçoivent un ServiceImport (faux dans les tests).
 */
import { lotDe, refuserPosts, type CodeLot, type MotifRefus, type PostMigration } from "./logique";

export const RAISON_NON_BRANCHE = "Disponible après l’import des brouillons";

export type ResultatService = { ok: true; message: string } | { ok: false; raison: string };

export interface ComparaisonPost {
  postId: string;
  original: Champs;
  copie: Champs;
}
export interface Champs {
  texte: string;
  medias: string;
  date: string;
  compte: string;
  premierCommentaire: string;
}

export interface ServiceImport {
  /** Faux tant que rien n'est branché : les boutons d'écriture restent inactifs. */
  readonly disponible: boolean;
  readonly raison: string;
  creerBrouillons(lot: CodeLot): Promise<ResultatService>;
  comparer(lot: CodeLot): Promise<ComparaisonPost[]>;
  /**
   * « Retirer » = passer le post en BROUILLON côté Buffer, ou le lister pour action manuelle. JAMAIS une suppression :
   * aucune méthode DELETE ni appel « delete » vers Buffer.
   */
  retirerDeBufferEtProgrammer(postIds: string[]): Promise<ResultatService>;
}

export const serviceNonBranche: ServiceImport = {
  disponible: false,
  raison: RAISON_NON_BRANCHE,
  async creerBrouillons() {
    return { ok: false, raison: RAISON_NON_BRANCHE };
  },
  async comparer() {
    return [];
  },
  async retirerDeBufferEtProgrammer() {
    return { ok: false, raison: RAISON_NON_BRANCHE };
  },
};

/** Plafonds : nombre d'ids par appel, et de posts admis par lot (A, B, C). Au-delà, rien n'est transmis. */
export const PLAFOND_IDS_PAR_APPEL = 50;
export const PLAFOND_POSTS_PAR_LOT = 50;

/** Seule action qui retire de Buffer : filtre les posts, puis délègue. Rien d'écrit si aucun post n'est admis. */
export async function confirmerRetraitEtProgrammation(
  service: ServiceImport,
  ids: string[],
  posts: PostMigration[],
  maintenant: Date,
): Promise<{ resultat: ResultatService; refuses: { id: string; motif: MotifRefus }[] }> {
  if (ids.length > PLAFOND_IDS_PAR_APPEL) return { resultat: { ok: false, raison: `Trop de posts d’un coup (${PLAFOND_IDS_PAR_APPEL} au plus)` }, refuses: [] };
  const { acceptes, refuses } = refuserPosts(ids, posts, maintenant);
  if (!service.disponible) return { resultat: { ok: false, raison: service.raison }, refuses };
  if (!acceptes.length) return { resultat: { ok: false, raison: "Aucun post à retirer" }, refuses };
  const parLot = new Map<string, number>();
  for (const p of acceptes) parLot.set(lotDe(p) ?? "?", (parLot.get(lotDe(p) ?? "?") ?? 0) + 1);
  if ([...parLot.values()].some((n) => n > PLAFOND_POSTS_PAR_LOT)) return { resultat: { ok: false, raison: `Trop de posts dans un lot (${PLAFOND_POSTS_PAR_LOT} au plus)` }, refuses };
  return { resultat: await service.retirerDeBufferEtProgrammer(acceptes.map((p) => p.id)), refuses };
}
