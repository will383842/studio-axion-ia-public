/** Cas de la porte B rendus par la simulation du rôle, un par sorte (P2R) : intégration (deux natures), formation, audit, coaching. */
import { verifierCas, type CasConcret } from "@/formats/cas-concret/cas";
import { brouillonParGabarit, casDuBrouillon } from "@/moteurs/montage-cas-concret/description";

export const DESCRIPTIONS: readonly string[] = [
  "Un cabinet comptable qui reçoit 200 factures par mois et les saisit à la main",
  "Une agence qui veut relier son formulaire de contact à son CRM et à son agenda partagé, sans rien recopier.",
  "Une équipe de dix personnes qui veut apprendre à se servir de l'IA pour répondre à ses e-mails.",
  "Un dirigeant qui ne sait pas par où commencer et voudrait un audit de ses tâches répétitives.",
  "Un dirigeant qui voudrait être accompagné, séance après séance, pour confier ses tâches répétitives à l'IA.",
];

let cache: CasConcret[] | undefined;
export function casPorteB(): CasConcret[] {
  return (cache ??= DESCRIPTIONS.map((t) => {
    const v = verifierCas(casDuBrouillon(brouillonParGabarit(t), t));
    if (!v.ok) throw new Error(v.raisons.join(" ; "));
    return v.cas;
  }));
}
