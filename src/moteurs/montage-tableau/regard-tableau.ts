/**
 * Tableau — adaptateur PUR du regardeur commun (CLAUDE-REGARD-b) : de la fiche calée aux instants à regarder, des textes
 * permis, et du verdict aux remarques du rapport. Rien n'est branché, aucun appel, aucun prix. Aucun texte fabriqué :
 * seuls comptent le texte dit, les textes écrits de la fiche et la fin VALIDÉE donnée par l'appelant.
 */
import { choisirInstants, type InstantRegard, type VerdictRegard } from "@/briques/regardeur";
import type { FicheTableau } from "./fiche";
import { texteDitDe } from "./variantes-fin";
import { textesEcransScene, textesEcrits } from "./regles";
import type { RelectureImagesCles, RemarqueRelecture } from "./controles";

type Mots = NonNullable<Parameters<typeof choisirInstants>[0]["mots"]>;

const ecritsDe = (s: FicheTableau["scenes"][number]): string[] => [...s.elements.flatMap(textesEcrits), ...textesEcransScene(s)];

/** Une partie par page calée (début = min des débuts, fin = max des fins, en secondes). Page non calée : ignorée. */
export function partiesTableau(fiche: FicheTableau): { id: string; debutSec: number; finSec: number; texteAttendu: boolean }[] {
  const pages = new Map<number, FicheTableau["scenes"]>();
  for (const s of fiche.scenes) pages.set(s.page, [...(pages.get(s.page) ?? []), s]);
  const parties: { id: string; debutSec: number; finSec: number; texteAttendu: boolean }[] = [];
  for (const [page, scenes] of pages) {
    if (scenes.some((s) => typeof s.debutMs !== "number" || typeof s.finMs !== "number")) continue;
    parties.push({
      id: `page-${page}`,
      debutSec: Math.min(...scenes.map((s) => s.debutMs as number)) / 1000,
      finSec: Math.max(...scenes.map((s) => s.finMs as number)) / 1000,
      texteAttendu: scenes.some((s) => ecritsDe(s).some((t) => t.trim() !== "")),
    });
  }
  return parties.sort((a, b) => a.debutSec - b.debutSec);
}

/** Textes permis à l'écran : le texte dit, tous les textes écrits de la fiche, et l'écran de fin choisi s'il est donné. */
export function textesPermisTableau(fiche: FicheTableau, fin?: { ecran: string }): string[] {
  return [texteDitDe(fiche), ...fiche.scenes.flatMap(ecritsDe), ...(fin ? [fin.ecran] : [])];
}

/** Instants à regarder (≤ 24). Fiche non calée : début et fin seulement. */
export function instantsTableau(fiche: FicheTableau, dureeSec: number, mots?: Mots): InstantRegard[] {
  return choisirInstants({ parties: partiesTableau(fiche), dureeSec, ...(mots ? { mots } : {}) });
}

const numeroDe = (partieId: string | null) => (partieId ? /^page-(\d+)$/.exec(partieId)?.[1] : undefined);

/** Verdict du regardeur → relecture des images clés du rapport (une remarque par défaut, sauf « non relue »). */
export function relectureDuVerdict(v: VerdictRegard): RelectureImagesCles {
  const rang = (nom: string) => Number(/\d+/.exec(nom)?.[0] ?? 0);
  const remarques: RemarqueRelecture[] = [];
  for (const d of v.defauts) {
    if (d.code === "non-relue") continue;
    const n = numeroDe(d.partieId);
    const page = n ? `page ${n} : ` : "";
    const cite = /« (.*) »/.exec(d.detail)?.[1] ?? "";
    let raison: string;
    switch (d.code) {
      case "texte-coupe": raison = `${page}texte coupé (« ${cite} »)`; break;
      case "phrase-non-choisie": raison = `${page}phrase que vous n'avez ni écrite ni choisie (« ${cite} »)`; break;
      case "fin-absente": raison = "fin choisie absente de la vidéo"; break;
      case "page-vide": raison = n ? `page ${n} vide` : "page vide"; break;
      case "desynchro": raison = `${page}sous-titre décalé de la voix`; break;
      case "hors-cadre": raison = `${page}texte qui dépasse du cadre (« ${cite} »)`; break;
      case "noire": raison = "image entièrement noire"; break;
      default: raison = "image illisible";
    }
    remarques.push({ image: rang(d.nom), raison });
  }
  if (v.nonRelues > 0) remarques.push({ image: rang(v.defauts.find((d) => d.code === "non-relue")?.nom ?? "i01"), raison: `${v.nonRelues} image${v.nonRelues > 1 ? "s" : ""} non relue${v.nonRelues > 1 ? "s" : ""}` });
  return { imagesLues: v.relues, remarques };
}
