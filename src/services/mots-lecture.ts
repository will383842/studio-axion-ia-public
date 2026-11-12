/**
 * MOTS · lecture seule des mots posés pour un réseau. Aucune écriture, aucun appel réseau, aucune donnée de personne :
 * on lit seulement le registre local `mots.registre` (clé `MOT|idCompte`) et la liste locale des comptes déjà relevée.
 *
 * Règle de réponse (RC-43, voir `mots-capacites.ts`, relue et appliquée telle quelle) : la réponse publique est
 * « auto » pour Facebook et Instagram, « manuel » pour LinkedIn et TikTok.
 */
import "server-only";
import {
  GUIDE_PAR_DEFAUT,
  MOT_PAR_DEFAUT,
} from "@/domaine/guide-reseau/affectations";
import type { IdReseau } from "@/domaine/types";
import { lireParametre } from "./_commun";
import { CAPACITES, type Reseau } from "./mots-capacites";
import { PARAM_REGISTRE_MOTS, type LigneMot } from "./mots-service";
import { PARAM_COMPTES_ZERNIO, type ComptesZernioEnregistres } from "./zernio";

export interface MotLu {
  mot: string;
  guide: string | null;
  etat: "actif" | "pause";
  reponse: "auto" | "manuel";
}

/** Réseau du Studio → ligne de la matrice des capacités (LinkedIn : page et profil sont tous deux manuels). */
const CAPACITE_DU_RESEAU: Partial<Record<IdReseau, Reseau>> = {
  facebook: "facebook",
  instagram: "instagram",
  linkedin: "linkedin_page",
  tiktok: "tiktok",
};

export async function motsActifsPourReseau(reseau: IdReseau): Promise<MotLu[]> {
  const cap = CAPACITE_DU_RESEAU[reseau];
  if (!cap) return [];
  const reponse = CAPACITES[cap].reponsePublique;
  const comptes = await lireParametre<ComptesZernioEnregistres | null>(
    PARAM_COMPTES_ZERNIO,
    null,
  );
  const ids = new Set(
    (comptes?.comptes ?? [])
      .filter((c) => c.reseau === reseau)
      .map((c) => c.id),
  );
  if (ids.size === 0) return [];
  const registre = await lireParametre<Record<string, LigneMot>>(
    PARAM_REGISTRE_MOTS,
    {},
  );
  const parMot = new Map<string, MotLu>();
  for (const l of Object.values(registre)) {
    if (!l || !ids.has(l.compte)) continue;
    if (l.etat !== "actif" && l.etat !== "pause" && l.etat !== "pause_auto")
      continue;
    const etat = l.etat === "actif" ? "actif" : "pause";
    const deja = parMot.get(l.mot);
    if (deja && (deja.etat === "actif" || etat === "pause")) continue; // un seul résultat par mot ; « actif » l'emporte
    parMot.set(l.mot, {
      mot: l.mot,
      guide: l.mot === MOT_PAR_DEFAUT ? GUIDE_PAR_DEFAUT : null,
      etat,
      reponse,
    });
  }
  return [...parMot.values()];
}
