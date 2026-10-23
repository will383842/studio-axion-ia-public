/**
 * Solde ElevenLabs RÉEL (voix de secours, prévue ; lot « crédits », 02/10, D2) : `GET /v1/user/subscription`
 * (gratuit), caractères restants = `character_limit − character_count`. Lu seulement si `ELEVENLABS_API_KEY` existe.
 */
import type { LecteurCredit, LectureSolde } from "../types";
import { CLE_ABSENTE, cleDans, ErreurLecture, lireJson, messageErreur, resultatTest, type Env, type Fetch } from "./commun";

export const VARIABLE_CLE_ELEVENLABS = "ELEVENLABS_API_KEY";

export interface ReponseAbonnementElevenLabs {
  character_count?: number;
  character_limit?: number;
}

/** Caractères restants (PUR). */
export function caracteresRestants(r: ReponseAbonnementElevenLabs | null | undefined): number {
  const limite = Number(r?.character_limit);
  const utilises = Number(r?.character_count);
  if (!Number.isFinite(limite) || !Number.isFinite(utilises)) throw new ErreurLecture("inconnu", "ElevenLabs n'a pas renvoyé de solde.");
  return Math.max(0, limite - utilises);
}

export function creerLecteurElevenLabs(env: Env = process.env, appeler: Fetch = fetch): LecteurCredit {
  async function lire(): Promise<LectureSolde> {
    const cle = cleDans(env, VARIABLE_CLE_ELEVENLABS);
    if (!cle) throw new ErreurLecture("absente", CLE_ABSENTE);
    const r = (await lireJson(appeler, "https://api.elevenlabs.io/v1/user/subscription", { "xi-api-key": cle }, "ElevenLabs", cle)) as ReponseAbonnementElevenLabs;
    // Le solde ElevenLabs se compte en caractères : `centimes` reste à 0, `caracteresRestants` porte le solde.
    return { fournisseur: "elevenlabs", centimes: 0, devise: "USD", caracteresRestants: caracteresRestants(r), luLe: new Date().toISOString() };
  }
  return {
    fournisseur: "elevenlabs",
    nom: "ElevenLabs",
    mode: "reel",
    urlRecharge: "https://elevenlabs.io/app/subscription",
    variableCle: VARIABLE_CLE_ELEVENLABS,
    lireSolde: lire,
    async testerConnexion() {
      const cle = cleDans(env, VARIABLE_CLE_ELEVENLABS);
      if (!cle) return resultatTest(false, undefined, CLE_ABSENTE);
      try {
        await lire();
        return resultatTest(true, cle, "Clé acceptée");
      } catch (e) {
        return resultatTest(false, cle, messageErreur(e, "ElevenLabs"));
      }
    },
  };
}
