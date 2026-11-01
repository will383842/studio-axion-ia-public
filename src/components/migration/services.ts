/**
 * Z3-M · services d'écriture de la migration (interfaces). L'implémentation par défaut est « non branchée » :
 * rien n'écrit chez Zernio ni chez Buffer tant que l'import des brouillons n'est pas branché sur l'écran.
 * Les composants n'appellent jamais le réseau : ils reçoivent un ServiceImport (faux dans les tests).
 */
import { refuserPosts, type CodeLot, type MotifRefus, type PostMigration } from "./logique";

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

/** Seule action qui retire de Buffer : filtre les posts, puis délègue. Rien d'écrit si aucun post n'est admis. */
export async function confirmerRetraitEtProgrammation(
  service: ServiceImport,
  ids: string[],
  posts: PostMigration[],
  maintenant: Date,
): Promise<{ resultat: ResultatService; refuses: { id: string; motif: MotifRefus }[] }> {
  const { acceptes, refuses } = refuserPosts(ids, posts, maintenant);
  if (!service.disponible) return { resultat: { ok: false, raison: service.raison }, refuses };
  if (!acceptes.length) return { resultat: { ok: false, raison: "Aucun post à retirer" }, refuses };
  return { resultat: await service.retirerDeBufferEtProgrammer(acceptes.map((p) => p.id)), refuses };
}
