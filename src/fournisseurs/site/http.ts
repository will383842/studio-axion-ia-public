/**
 * LE VRAI CLIENT du site (vidéos sur le site, lot S4) : appels signés (plan § 7.2) en HTTPS, délai borné à 10 s,
 * réponses 401, 409, 410, 422 et 5xx traduites en phrases claires (`fournisseur.ts`). Il reçoit son `fetch` : les tests
 * lui donnent le site factice. ÉCRIT ET TESTÉ, JAMAIS BRANCHÉ : inscrit au registre comme implémentation PRÉVUE
 * (`SITE_VIDEOS_URL` et `SITE_VIDEOS_SECRET`), la simulation reste le choix par défaut ; le choisir est une décision de
 * Will (réglage « fournisseur.site »), après les lots W1 et W2 du site.
 */
import { fournisseurSiteDepuisTransport } from "./fournisseur";
import type { FournisseurSite, ReponseSite, TransportSite } from "./types";

/** Délai d'un appel au site, en millisecondes (`AbortSignal.timeout`). */
export const DELAI_SITE_MS = 10_000;

export interface OptionsClientSite {
  /** Adresse du site (`https://axion-ia.com`). */
  url: string;
  secret: string;
  fetch: typeof fetch;
  /** Millisecondes Unix (injectable). */
  maintenant?: () => number;
  delaiMs?: number;
}

export function creerFournisseurSiteHttp(o: OptionsClientSite): FournisseurSite {
  const base = o.url.replace(/\/+$/, "");
  const transport: TransportSite = async (r): Promise<ReponseSite> => {
    const reponse = await o.fetch(`${base}${r.chemin}`, {
      method: r.methode,
      headers: { ...r.entetes, ...(r.corps ? { "content-type": "application/json" } : {}), accept: "application/json" },
      ...(r.corps ? { body: r.corps } : {}),
      signal: AbortSignal.timeout(o.delaiMs ?? DELAI_SITE_MS),
      redirect: "error",
      cache: "no-store",
    });
    const texte = await reponse.text();
    let corps: unknown = null;
    try {
      corps = texte ? JSON.parse(texte) : null;
    } catch {
      corps = null;
    }
    return { statut: reponse.status, corps };
  };
  return fournisseurSiteDepuisTransport({ id: "http", nom: "Le site de l'entreprise", reelPrevu: "Le site de l'entreprise", mode: "reel", secret: o.secret, transport, maintenant: o.maintenant ?? (() => Date.now()) });
}

/**
 * Implémentation « http » pour le registre : présente SEULEMENT si l'adresse (http ou https) ET le secret existent. Sans
 * eux, rien n'est inscrit : « À relier », jamais d'appel. Choisie seulement par le réglage « fournisseur.site ».
 */
export function siteHttpDepuisEnv(env: Record<string, string | undefined> = process.env): Record<string, FournisseurSite> {
  const url = env.SITE_VIDEOS_URL?.trim();
  const secret = env.SITE_VIDEOS_SECRET?.trim();
  if (!url || !secret || !/^https?:\/\//i.test(url)) return {};
  return { http: creerFournisseurSiteHttp({ url, secret, fetch: (...a) => fetch(...a) }) };
}
