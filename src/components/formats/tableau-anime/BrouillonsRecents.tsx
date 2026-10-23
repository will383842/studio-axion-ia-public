/**
 * « VOS BROUILLONS » (tableau animé) : les brouillons récents, le plus récent d'abord, avec leur état en clair
 * (écriture en cours, interrompue, script écrit, scènes prêtes…) et leur date ; un toucher y revient
 * (`/tableau/nouvelle?brouillon=<id>`). Le travail en cours ou terminé est toujours retrouvé, page fermée ou non.
 * Enveloppe d'une ligne autour de `RecentsGenerateur`.
 */
import { RecentsGenerateur } from "@/components/creation/RecentsGenerateur";
import type { BrouillonRecentTableau } from "@/services/tableau-creation";
import { versRecentsTableau } from "./vues-gabarit";

export function BrouillonsRecentsTableau({ recents, courant }: { recents: BrouillonRecentTableau[]; courant?: string }) {
  return <RecentsGenerateur titre="Vos brouillons" elements={versRecentsTableau(recents)} courant={courant} vide={null} />;
}
