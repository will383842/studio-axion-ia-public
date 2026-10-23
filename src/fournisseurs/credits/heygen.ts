/**
 * Solde HeyGen RÉEL (lot « crédits », 02/10, D2) : `GET /v3/users/me` (gratuit), `data.wallet.remaining_balance` en
 * dollars. API v3 uniquement (v1 et v2 s'arrêtent le 31/10/2026). Réutilise le client HeyGen commun (jamais recopié).
 */
import { creerClientHeygen, ErreurHeygen } from "../heygen/client";
import type { LecteurCredit, LectureSolde } from "../types";
import { CLE_ABSENTE, cleDans, ErreurLecture, messageErreur, resultatTest, type Env, type Fetch } from "./commun";

export const VARIABLE_CLE_HEYGEN = "HEYGEN_API_KEY";

/** Réponse de `GET /v3/users/me` (champs utiles ; le reste est ignoré, l'identité n'est jamais gardée). */
export interface ReponseUtilisateurHeygen {
  billing_type?: string;
  wallet?: { currency?: string; remaining_balance?: number | string } | null;
}

/** Solde du porte-monnaie en centimes de dollar (PUR, testé sur la réponse enregistrée). */
export function soldeDepuisReponse(data: ReponseUtilisateurHeygen | null | undefined): number {
  const brut = data?.wallet?.remaining_balance;
  const dollars = typeof brut === "string" ? Number.parseFloat(brut) : brut;
  if (typeof dollars !== "number" || !Number.isFinite(dollars)) throw new ErreurLecture("inconnu", "HeyGen n'a pas renvoyé de solde.");
  return Math.round(dollars * 100);
}

function traduire(e: unknown): ErreurLecture {
  if (e instanceof ErreurLecture) return e;
  if (e instanceof ErreurHeygen) {
    if (e.code === "refuse") return new ErreurLecture("refuse", "HeyGen refuse la clé.");
    if (e.code === "indisponible") return new ErreurLecture("indisponible", "HeyGen ne répond pas.");
    // « quota » : le compte répond, la clé est bonne, le porte-monnaie est vide.
    if (e.code === "quota") return new ErreurLecture("inconnu", "Le porte-monnaie HeyGen est vide.");
  }
  return new ErreurLecture("inconnu", "HeyGen : lecture impossible.");
}

export function creerLecteurHeygen(env: Env = process.env, appeler?: Fetch): LecteurCredit {
  async function lire(): Promise<LectureSolde> {
    const cle = cleDans(env, VARIABLE_CLE_HEYGEN);
    if (!cle) throw new ErreurLecture("absente", CLE_ABSENTE);
    try {
      const data = await creerClientHeygen({ cle, fetch: appeler, delaiMs: 15_000 }).requete<ReponseUtilisateurHeygen>("GET", "/v3/users/me");
      return { fournisseur: "heygen", centimes: soldeDepuisReponse(data), devise: "USD", luLe: new Date().toISOString() };
    } catch (e) {
      throw traduire(e);
    }
  }
  return {
    fournisseur: "heygen",
    nom: "HeyGen",
    mode: "reel",
    urlRecharge: "https://app.heygen.com/settings/api",
    variableCle: VARIABLE_CLE_HEYGEN,
    lireSolde: lire,
    async testerConnexion() {
      const cle = cleDans(env, VARIABLE_CLE_HEYGEN);
      if (!cle) return resultatTest(false, undefined, CLE_ABSENTE);
      try {
        await lire();
        return resultatTest(true, cle, "Clé acceptée");
      } catch (e) {
        return resultatTest(false, cle, messageErreur(e, "HeyGen"));
      }
    },
  };
}
