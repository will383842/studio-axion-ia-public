"use client";

/**
 * Reprise de la fabrication depuis l'écran (lot L16) : « Refaire cette partie », ou la suite d'une validation quand le
 * studio demande de confirmer un prix. Adresse fixe `/api/image-video/{vidéo}` ; un prix à confirmer ouvre la feuille
 * commune « Confirmer ce prix » ; toute issue finit en une phrase (jamais un bouton qui tourne sans fin).
 */
import { confirmerPrix } from "@/components/ui/ConfirmationPrix";

export type IssueEcranIV = { statut: "reprise" } | { statut: "accord-requis"; centimes: number; phrase: string } | { statut: "refusee"; phrase: string };

export const PHRASES_REPRISE = Object.freeze({
  injoignable: "Le studio ne répond pas. Vérifiez la connexion, puis réessayez.",
  annulee: "Rien n'a été lancé.",
  delai: "Le studio met trop de temps à répondre. Réessayez dans un instant.",
});

const DELAI_REPRISE_MS = 30_000;

export function lireIssue(v: unknown): IssueEcranIV {
  const i = (v && typeof v === "object" ? (v as { issue?: unknown }).issue : null) as Partial<IssueEcranIV> | null;
  if (i?.statut === "reprise") return { statut: "reprise" };
  if (i?.statut === "accord-requis" && typeof (i as { centimes?: unknown }).centimes === "number") return i as IssueEcranIV;
  if (i?.statut === "refusee" && typeof (i as { phrase?: unknown }).phrase === "string") return i as IssueEcranIV;
  return { statut: "refusee", phrase: PHRASES_REPRISE.injoignable };
}

/** Envoie la reprise (avec l'accord éventuel) et rend son issue. */
export async function envoyerReprise(videoId: string, accord?: number): Promise<IssueEcranIV> {
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), DELAI_REPRISE_MS);
  try {
    const r = await fetch(`/api/image-video/${encodeURIComponent(videoId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accord !== undefined ? { accord } : {}),
      signal: controle.signal,
      cache: "no-store",
    });
    return lireIssue(await r.json().catch(() => null));
  } catch (err) {
    return { statut: "refusee", phrase: err instanceof DOMException && err.name === "AbortError" ? PHRASES_REPRISE.delai : PHRASES_REPRISE.injoignable };
  } finally {
    clearTimeout(minuterie);
  }
}

export type IssuePlafondIV = { statut: "releve"; plafondCentimes: number; reprise?: IssueEcranIV } | { statut: "accord-requis"; centimes: number; phrase: string } | { statut: "refusee"; phrase: string };

/** « Relever le plafond » : le montant demandé, puis sa confirmation explicite (feuille « Confirmer ce prix »). Rend la phrase finale, ou `null` si relevé (et repris). */
export async function releverPlafond(videoId: string, plafondCentimes: number, reprendre: boolean): Promise<string | null> {
  const envoyer = async (accord?: number): Promise<IssuePlafondIV> => {
    try {
      const r = await fetch(`/api/image-video/${encodeURIComponent(videoId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plafond: plafondCentimes, reprendre, ...(accord !== undefined ? { accord } : {}) }),
        cache: "no-store",
      });
      const i = ((await r.json().catch(() => null)) as { issue?: IssuePlafondIV } | null)?.issue;
      if (i?.statut === "releve" || i?.statut === "accord-requis" || i?.statut === "refusee") return i;
    } catch {
      // Studio injoignable : la phrase ci-dessous.
    }
    return { statut: "refusee", phrase: PHRASES_REPRISE.injoignable };
  };
  let issue = await envoyer();
  if (issue.statut === "accord-requis") {
    const accord = await confirmerPrix({ message: issue.phrase, montant: issue.centimes });
    if (typeof accord !== "number") return "Le plafond n'a pas changé.";
    issue = await envoyer(accord);
  }
  if (issue.statut === "refusee") return issue.phrase;
  if (issue.statut === "accord-requis") return "Le plafond n'a pas changé.";
  if (issue.reprise) return jusquALaReprise(videoId, issue.reprise);
  return null;
}

/** Mène une issue à son terme : tant qu'un prix est demandé, Will le confirme (ou abandonne). Rend la phrase finale, ou `null` si reprise. */
export async function jusquALaReprise(videoId: string, issue: IssueEcranIV): Promise<string | null> {
  let courante = issue;
  for (let tour = 0; tour < 3 && courante.statut === "accord-requis"; tour++) {
    const accord = await confirmerPrix({ message: courante.phrase, montant: courante.centimes });
    if (typeof accord !== "number") return PHRASES_REPRISE.annulee;
    courante = await envoyerReprise(videoId, accord);
  }
  if (courante.statut === "reprise") return null;
  return courante.statut === "refusee" ? courante.phrase : PHRASES_REPRISE.annulee;
}

/**
 * « Refaire cette partie » : après un arrêt sur le plafond, relancer avec le même plafond ferait revenir l'arrêt ; on relève donc au
 * montant proposé (sans saisie ni feuille) puis on reprend. Sinon, reprise simple. Rend la phrase finale, ou `null` si reprise.
 */
export async function refaireCettePartie(videoId: string, plafond?: { proposeCentimes: number; arrete: boolean }): Promise<string | null> {
  if (plafond?.arrete) return releverPlafond(videoId, plafond.proposeCentimes, true);
  return jusquALaReprise(videoId, await envoyerReprise(videoId));
}
