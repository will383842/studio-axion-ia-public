/** Aides communes des tests « vidéos sur le site » (lots S1 à S4) : session d'essai et base de démonstration. */
import { reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";

export const MDP_SITE = "essai-site-videos";

/** Base de démonstration vierge, session ouverte, vidéos des exemples traitées comme de vraies vidéos. */
export async function preparerBase(): Promise<void> {
  const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
  const auth = await import("@/services/auth");
  reinitialiserDepots();
  await exemplesCommeVraies(depots());
  reinitialiserRequete();
  await auth.seConnecter(MDP_SITE, false);
}

export { preparerMotDePasse };
