/**
 * CLIENT du conteneur `studio-rendu` (lot M1b, B.9 ter) — contrat `ServiceRendu` (fournisseurs/types.ts).
 * HTTP vers `STUDIO_RENDU_URL` (réseau `interne` du compose, jamais exposé). Sans cette variable : service SIMULÉ.
 * Ce n'est pas un `TypeFournisseur` : les moteurs l'obtiennent par `obtenirServiceRendu()`.
 *
 * Reprise après redémarrage du conteneur : `suivreRendu` reçoit « inconnu » (404) pour un rendu connu et
 * soumet À NOUVEAU la même demande, avec le MÊME `idRendu` (sorties R2 écrasables, coût nul).
 */
import type { DemandeRendu, EtatRendu, ErreurFournisseur, ServiceRendu } from "../types";
import { serviceRenduSimule } from "../simulation/rendu";
import { refusRenduSansCle } from "@/lib/demarrage";

export const DELAI_RENDU_MS = 30_000;

export class ErreurRendu extends Error {
  constructor(public readonly erreur: ErreurFournisseur) {
    super(erreur.message);
    this.name = "ErreurRendu";
  }
  get reessayable() {
    return this.erreur.reessayable;
  }
}

export function creerServiceRenduHttp(adresse: string, options: { fetch?: typeof fetch; cle?: string } = {}): ServiceRendu {
  const base = adresse.replace(/\/+$/, "");
  const appeler = options.fetch ?? fetch;
  const entetes: Record<string, string> = { "content-type": "application/json" };
  if (options.cle) entetes["x-studio-rendu-cle"] = options.cle;

  async function requete(chemin: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await appeler(`${base}${chemin}`, { ...init, headers: { ...entetes, ...(init.headers as Record<string, string> | undefined) }, signal: AbortSignal.timeout(DELAI_RENDU_MS) });
    } catch (e) {
      console.warn(`[rendu] ${chemin} : pas de réponse (${(e as Error).message})`);
      throw new ErreurRendu({ code: "indisponible", reessayable: true, message: "Le service de rendu ne répond pas." });
    }
  }

  return {
    async soumettre(demande) {
      const r = await requete("/rendus", { method: "POST", body: JSON.stringify(demande) });
      if (!r.ok) console.warn(`[rendu] envoi d'un rendu : réponse ${r.status}`);
      if (r.status >= 500 || r.status === 429) throw new ErreurRendu({ code: "indisponible", reessayable: true, message: "Le service de rendu est momentanément indisponible." });
      if (!r.ok) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Le service de rendu a refusé la demande." });
      const corps = (await r.json()) as { idRendu?: string };
      return { idRendu: corps.idRendu ?? demande.idRendu };
    },
    async etat(idRendu) {
      const r = await requete(`/rendus/${encodeURIComponent(idRendu)}`);
      if (r.status === 404) return { statut: "inconnu" };
      if (!r.ok) {
        console.warn(`[rendu] état d'un rendu : réponse ${r.status}`);
        throw new ErreurRendu({ code: "indisponible", reessayable: true, message: "Le service de rendu est momentanément indisponible." });
      }
      return (await r.json()) as EtatRendu;
    },
  };
}

/**
 * État d'un rendu déjà soumis. Si le conteneur l'a oublié (redémarrage), la même demande est soumise
 * à nouveau sous le même identifiant ; l'état renvoyé est alors « en_file ».
 */
export async function suivreRendu(service: ServiceRendu, demande: DemandeRendu): Promise<EtatRendu & { resoumis?: boolean }> {
  const etat = await service.etat(demande.idRendu);
  if (etat.statut !== "inconnu") return etat;
  await service.soumettre(demande);
  return { statut: "en_file", rang: 0, resoumis: true };
}

/** Service de rendu de l'environnement : `studio-rendu` réel si `STUDIO_RENDU_URL` existe, sinon la simulation. */
export function obtenirServiceRendu(env: Record<string, string | undefined> = process.env): ServiceRendu {
  const url = env.STUDIO_RENDU_URL?.trim();
  // Relecture sécurité R45 n° 3 : jamais de demande sans clé en production (le démarrage le refuse déjà).
  const refus = refusRenduSansCle(env);
  if (refus) throw new Error(refus);
  return url ? creerServiceRenduHttp(url, { cle: env.STUDIO_RENDU_CLE?.trim() || undefined }) : serviceRenduSimule;
}

export function renduSimule(env: Record<string, string | undefined> = process.env): boolean {
  return !env.STUDIO_RENDU_URL?.trim();
}
