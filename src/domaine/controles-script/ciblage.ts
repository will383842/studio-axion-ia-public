/**
 * CONTRÔLES DE CIBLAGE (lot C1). PUR. Jamais bloquants, jamais garde-fous : une vidéo n'est jamais bloquée pour cela.
 *  - C100 : la cible déclarée n'est pas nommée dans les 5 premières secondes parlées (alerte) ;
 *  - C101 : aucun bénéfice clair (temps, argent, erreurs, clients, délais) dans le texte dit (alerte) ;
 *  - C102 : aucune cible déclarée (information).
 * Le socle (`domaine/ciblage/controles.ts`) porte la reconnaissance : `cibleNommee`, `debutParle`, `beneficeClair`.
 */
import { beneficeClair, cibleNommee, debutParle } from "@/domaine/ciblage/controles";
import { segmentsParles, type Analyse, type Collecte } from "./analyse";
import type { EntreeControle } from "./types";

export function c100c101c102(e: EntreeControle, a: Analyse, col: Collecte): void {
  const texte = segmentsParles(a).map((s) => s.dit).join(" ");
  const ciblage = e.maitre?.brief.ciblage;
  if (!ciblage?.libelle.trim()) col.ajouter("C102", "Aucune cible déclarée : choisissez à qui parle la vidéo (métier, secteur ou taille).");
  else if (!cibleNommee(debutParle(texte), ciblage)) col.ajouter("C100", `La cible « ${ciblage.libelle} » n'est pas nommée dans les 5 premières secondes : nommez-la dans l'accroche.`);
  if (texte.trim() && !beneficeClair(texte)) col.ajouter("C101", "Aucun bénéfice clair (temps, argent, erreurs, clients ou délais gagnés) : dites ce que la personne y gagne.");
}
