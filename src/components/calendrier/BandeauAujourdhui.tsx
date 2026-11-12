import Link from "next/link";
import { cn } from "@/lib/cn";
import { libelleJour } from "./BarreVue";
import { jourLisible, type EntreeCarte } from "./CarteEntreeCalendrier";

/** Adresse de la vue Jour d'aujourd'hui (jour de Paris AAAA-MM-JJ). */
export function lienJournee(aujourdhui: string): string {
  return `/calendrier?vue=jour&date=${aujourdhui}`;
}

/** Publications du jour de Paris donné (les idées de l'IA ne comptent pas) et, parmi elles, celles à valider. */
export function compterAujourdhui(entrees: readonly Pick<EntreeCarte, "jour" | "etat">[], aujourdhui: string): { total: number; aValider: number } {
  let total = 0;
  let aValider = 0;
  for (const entree of entrees) {
    if (entree.jour !== aujourdhui || entree.etat === "idee") continue;
    total += 1;
    if (entree.etat === "a_valider") aValider += 1;
  }
  return { total, aValider };
}

/**
 * Phrase de la maquette : « Aujourd'hui, <date> : N publications, dont M à valider. Voir la journée ».
 * Le lien ouvre la vue Jour d'aujourd'hui. Jour illisible : rien n'est affiché.
 */
export function BandeauAujourdhui({ entrees, aujourdhui, className }: { entrees: readonly Pick<EntreeCarte, "jour" | "etat">[]; aujourdhui: string; className?: string }) {
  if (!jourLisible(aujourdhui)) return null;
  const { total, aValider } = compterAujourdhui(entrees, aujourdhui);
  return (
    <p className={cn("mb-2 text-sm text-doux", className)}>
      Aujourd&apos;hui, {libelleJour(aujourdhui)} : {total} publications, dont {aValider} à valider.{" "}
      <Link href={lienJournee(aujourdhui)} className="underline underline-offset-[3px]">Voir la journée</Link>
    </p>
  );
}
