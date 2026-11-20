/**
 * C7-25-a · Recette du chat de retouche par générateur (outil LOCAL, 0 €) : à partir d'un relevé des dépôts, dit si une
 * retouche est « gratuit-prouve », « non-branche » ou en « ecart ». Fonctions pures : aucun réseau, aucune écriture de fichier,
 * rien n'importe cet outil dans `src`. Montants en centimes entiers, jamais de symbole monétaire.
 */
import type { DepenseEnregistree, ReservationCredit } from "../../src/domaine/types";
import { GENERATEURS_RETOUCHE } from "../../src/services/retouche-chat/generateurs";

export const GENERATEURS_RECETTE: readonly string[] = Object.freeze([...new Set<string>([...GENERATEURS_RETOUCHE, "demo-facecam"])]);

export type ReleveDepots = {
  reservations: Pick<ReservationCredit, "travailId" | "centimes" | "devise" | "statut">[];
  engagements: Record<string, number | null>;
  depenses: Pick<DepenseEnregistree, "travailId" | "total" | "appelId">[];
  versions: { id: string; videoId: string; parentVersionId?: string }[];
};

export type Verdict = "gratuit-prouve" | "non-branche" | "ecart";

export type LigneRecette = {
  generateur: string;
  statut: string;
  reserveCentimes: number;
  engageCentimes: number;
  reelCentimes: number;
  versionsEcrites: number;
  appelsClaude: number;
  verdict: Verdict;
  raisons: string[];
};

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

export function ligneRecette(
  r: ReleveDepots,
  c: { generateur: string; videoId: string; versionAvant: string; issue: { statut: string; travailId?: string } },
): LigneRecette {
  const t = c.issue.travailId;
  const resa = t ? r.reservations.filter((x) => x.travailId === t) : [];
  const dep = t ? r.depenses.filter((x) => x.travailId === t) : [];
  const reserveCentimes = resa.reduce((s, x) => s + x.centimes, 0);
  const autreDevise = resa.some((x) => x.devise !== "EUR" && x.centimes !== 0) || dep.some((x) => x.total.devise !== "EUR" && x.total.centimes !== 0);
  const engageCentimes = (t ? r.engagements[t] : null) ?? 0;
  const reelCentimes = dep.reduce((s, x) => s + x.total.centimes, 0);
  const versionsEcrites = r.versions.filter((v) => v.videoId === c.videoId && v.parentVersionId === c.versionAvant).length;
  const appelsClaude = dep.filter((x) => x.appelId).length;

  const raisons: string[] = [];
  if (reserveCentimes !== 0) raisons.push(`réservé ${pluriel(reserveCentimes, "centime")}`);
  if (engageCentimes !== 0) raisons.push(`engagé ${pluriel(engageCentimes, "centime")}`);
  if (reelCentimes !== 0) raisons.push(`coût réel ${pluriel(reelCentimes, "centime")}`);
  if (autreDevise) raisons.push("devise autre que EUR non nulle");
  if (appelsClaude !== 0) raisons.push(pluriel(appelsClaude, "appel") + " Claude");

  let verdict: Verdict;
  if (c.issue.statut === "lancee") {
    if (versionsEcrites !== 1) raisons.push(`${pluriel(versionsEcrites, "version")} écrite${versionsEcrites > 1 ? "s" : ""} (une seule attendue)`);
    verdict = raisons.length ? "ecart" : "gratuit-prouve";
  } else if (c.issue.statut === "plan-pret" || c.issue.statut === "inchangee") {
    if (versionsEcrites !== 0) raisons.push(`${pluriel(versionsEcrites, "version")} écrite${versionsEcrites > 1 ? "s" : ""} (aucune attendue)`);
    verdict = raisons.length ? "ecart" : "non-branche";
  } else {
    raisons.push(`issue inattendue : ${c.issue.statut}`);
    verdict = "ecart";
  }
  return { generateur: c.generateur, statut: c.issue.statut, reserveCentimes, engageCentimes, reelCentimes, versionsEcrites, appelsClaude, verdict, raisons };
}

export function recetteEnMarkdown(lignes: readonly LigneRecette[]): string {
  const tete = "| Générateur | Issue | Réservé (centimes) | Engagé | Coût réel | Versions écrites | Appels Claude | Verdict |";
  const corps = lignes.map((l) => `| ${l.generateur} | ${l.statut} | ${l.reserveCentimes} | ${l.engageCentimes} | ${l.reelCentimes} | ${l.versionsEcrites} | ${l.appelsClaude} | ${l.verdict} |`);
  const raisons = lignes.filter((l) => l.raisons.length).map((l) => `- ${l.generateur} : ${l.raisons.join(" ; ")}`);
  return [tete, "|---|---|---|---|---|---|---|---|", ...corps, ...(raisons.length ? ["", "Raisons :", ...raisons] : [])].join("\n") + "\n";
}
