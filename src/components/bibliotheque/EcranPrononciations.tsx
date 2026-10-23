import { GestionPrononciations } from "@/components/prononciations/GestionPrononciations";
import type { Prononciation } from "@/domaine/types";
import { listerPrononciationsAvecUsage, voixPourPortee } from "@/services/prononciations";

/**
 * PRONONCIATIONS (AV2.3-3 ; système complet du lot A1, `PRONONCIATIONS-SYSTEME.md`) : comment la voix dit certains
 * mots ; la graphie s'impose aussi aux sous-titres. Composant SERVEUR : il recharge la liste avec « utilisé dans N
 * vidéos » et les voix (portée), puis rend l'écran interactif. `liste` et `ranges` restent acceptés (page de la
 * Bibliothèque) mais la liste affichée est relue ici, à jour.
 */
export async function EcranPrononciations({ ajouterAuDepart }: { liste?: Prononciation[]; ranges?: Prononciation[]; ajouterAuDepart?: boolean }) {
  const [liste, ranges, voix] = await Promise.all([listerPrononciationsAvecUsage(), listerPrononciationsAvecUsage({ ranges: true }), voixPourPortee()]);
  return <GestionPrononciations liste={liste} ranges={ranges} voix={voix} ajouterAuDepart={ajouterAuDepart} />;
}
