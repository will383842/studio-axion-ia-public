/**
 * Cas concret — adaptateur PUR du regardeur commun : de la fiche calée aux instants à regarder (un par écran), des textes
 * permis, et du verdict aux phrases de réserve. Rien n'est branché, aucun appel, aucun prix, aucun réglage.
 * Aucun texte fabriqué : seuls comptent le texte dit, les textes écrits des écrans et la marque.
 */
import { choisirInstants, type InstantRegard, type VerdictRegard } from "@/briques/regardeur";
import { texteDuCorps, type Ecran, type FicheEcrans, type FinPlanifiee } from "./fiche";
import { MARQUE, textesEcrits } from "./regles";

type Mots = NonNullable<Parameters<typeof choisirInstants>[0]["mots"]>;
type Fin = Pick<FinPlanifiee, "ecrans"> | null | undefined;

const ecransDe = (fiche: Pick<FicheEcrans, "ecrans">, fin?: Fin): Ecran[] => [...fiche.ecrans, ...(fin?.ecrans ?? [])];

/** Une partie par écran calé (début et fin en secondes), triées par début. Écran non calé : ignoré. */
export function partiesCasConcret(fiche: Pick<FicheEcrans, "ecrans">, fin?: Fin): { id: string; debutSec: number; finSec: number; texteAttendu: boolean }[] {
  const parties: { id: string; debutSec: number; finSec: number; texteAttendu: boolean }[] = [];
  for (const e of ecransDe(fiche, fin)) {
    if (typeof e.debutMs !== "number" || typeof e.finMs !== "number") continue;
    parties.push({ id: e.id, debutSec: e.debutMs / 1000, finSec: e.finMs / 1000, texteAttendu: textesEcrits(e).some((t) => t.trim() !== "") });
  }
  return parties.sort((a, b) => a.debutSec - b.debutSec);
}

/** Textes permis à l'écran : le texte dit du corps, tous les textes écrits (corps et fin) et la marque. */
export function textesPermisCasConcret(fiche: Pick<FicheEcrans, "ecrans">, fin?: Fin): string[] {
  return [texteDuCorps(fiche), ...ecransDe(fiche, fin).flatMap(textesEcrits), MARQUE];
}

/** Instants à regarder (24 au plus). Fiche non calée : début et fin seulement. */
export function instantsCasConcret(fiche: Pick<FicheEcrans, "ecrans">, fin: Fin, dureeSec: number, mots?: Mots): InstantRegard[] {
  return choisirInstants({ parties: partiesCasConcret(fiche, fin), dureeSec, ...(mots ? { mots } : {}) });
}

const ecranDe = (partieId: string | null) => (partieId && /^[ef]\d{2}$/.test(partieId) ? partieId : undefined);

/** Verdict du regardeur → une phrase par défaut (sauf « non relue »), puis « N images non relues » s'il y en a. */
export function reservesDuVerdict(v: VerdictRegard): string[] {
  const reserves: string[] = [];
  for (const d of v.defauts) {
    if (d.code === "non-relue") continue;
    const id = ecranDe(d.partieId);
    const ecran = id ? `écran ${id} : ` : "";
    const cite = /« (.*) »/.exec(d.detail)?.[1] ?? "";
    switch (d.code) {
      case "texte-coupe": reserves.push(`${ecran}texte coupé (« ${cite} »)`); break;
      case "phrase-non-choisie": reserves.push(`${ecran}phrase que vous n'avez ni écrite ni choisie (« ${cite} »)`); break;
      case "fin-absente": reserves.push("fin choisie absente de la vidéo"); break;
      case "page-vide": reserves.push(id ? `écran ${id} vide` : "écran vide"); break;
      case "desynchro": reserves.push(`${ecran}sous-titre décalé de la voix`); break;
      case "hors-cadre": reserves.push(`${ecran}texte qui dépasse du cadre (« ${cite} »)`); break;
      case "noire": reserves.push("image entièrement noire"); break;
      default: reserves.push("image illisible");
    }
  }
  if (v.nonRelues > 0) reserves.push(`${v.nonRelues} image${v.nonRelues > 1 ? "s" : ""} non relue${v.nonRelues > 1 ? "s" : ""}`);
  return reserves;
}
