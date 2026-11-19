/** G3-06b : libellé du prix d'une démo facecam, formé côté serveur (jamais dans src/app ni src/components). Fonction pure. */
import { centimes, formaterMontant } from "@/lib/montants";

export function libellePrixDemo(prixCentimes: number): string {
  return formaterMontant(centimes(prixCentimes));
}

export type IssueLancementDemo = { statut: "lancee"; travailId: string } | { statut: "accord-requis"; centimes: number; phrase: string; prix: string };
