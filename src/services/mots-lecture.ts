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
import {
  chargerTextesFichier,
  lireValidationGuideParcours,
  MOT_STOP,
  PARAM_REGISTRE_MOTS,
  PARAM_VALIDATIONS_MOTS,
  type LigneMot,
} from "./mots-service";
import { empreinteTextes } from "./mots-textes";
import {
  empreinteGuideParcours,
  titreGuideParcours,
} from "@/domaine/guide-reseau/empreinte-guide";
import { PARAM_COMPTES_ZERNIO, type ComptesZernioEnregistres } from "./zernio";

export interface MotLu {
  mot: string;
  /** Titre du guide visé par le mot (GUIDE seulement), sinon null. */
  titreCible: string | null;
  /** Type de la cible : « guide » pour le mot par défaut, sinon null. */
  typeCible: "guide" | null;
  guide: string | null;
  /** Nom d'affichage du compte du réseau où le mot est actif (jamais de jeton ni de clé). */
  compte: string;
  /** Identique à `reponse` (LinkedIn et TikTok : toujours « manuel »). */
  mode: "auto" | "manuel";
  reponse: "auto" | "manuel";
  etat: "actif" | "pause";
  /** Vrai seulement si les textes du mot (réponse publique et message privé) sont validés par l'opérateur et inchangés. Faux en cas de doute. */
  textesValides: boolean;
}

/** Lecture seule : la validation enregistrée correspond-elle aux textes actuels ? Toute erreur ou ambiguïté = faux. */
async function textesValidesDuMot(
  mot: string,
  validations: Record<string, string>,
): Promise<boolean> {
  try {
    if (mot === MOT_PAR_DEFAUT) {
      const v = await lireValidationGuideParcours();
      if (!v) return false;
      const e = empreinteGuideParcours(titreGuideParcours(process.env));
      return e.ok && e.empreinte === v.empreinte;
    }
    const enregistree = validations[mot];
    if (!enregistree) return false;
    const f = await chargerTextesFichier(mot);
    return !!f && f.ok && empreinteTextes(f.textes) === enregistree;
  } catch {
    return false;
  }
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
  const noms = new Map(
    (comptes?.comptes ?? [])
      .filter((c) => c.reseau === reseau)
      .map((c) => [c.id, c.nom] as const),
  );
  const ids = new Set(noms.keys());
  if (ids.size === 0) return [];
  const registre = await lireParametre<Record<string, LigneMot>>(
    PARAM_REGISTRE_MOTS,
    {},
  );
  const parMot = new Map<string, MotLu>();
  // L'ordre du jsonb n'est pas garanti : on parcourt par identifiant de compte (le plus petit l'emporte à égalité).
  const lignes = Object.values(registre)
    .filter((l): l is LigneMot => !!l)
    .sort((a, b) => (a.compte < b.compte ? -1 : a.compte > b.compte ? 1 : 0));
  for (const l of lignes) {
    if (!l || l.mot === MOT_STOP || !ids.has(l.compte)) continue;
    if (l.etat !== "actif" && l.etat !== "pause" && l.etat !== "pause_auto")
      continue;
    const etat = l.etat === "actif" ? "actif" : "pause";
    const deja = parMot.get(l.mot);
    if (deja && (deja.etat === "actif" || etat === "pause")) continue; // un seul résultat par mot ; « actif » l'emporte
    parMot.set(l.mot, {
      mot: l.mot,
      titreCible:
        l.mot === MOT_PAR_DEFAUT
          ? titreGuideParcours(process.env) || null
          : null,
      typeCible: l.mot === MOT_PAR_DEFAUT ? "guide" : null,
      guide: l.mot === MOT_PAR_DEFAUT ? GUIDE_PAR_DEFAUT : null,
      compte: noms.get(l.compte) ?? l.compte,
      mode: reponse,
      reponse,
      etat,
      textesValides: false,
    });
  }
  const validations = await lireParametre<Record<string, string>>(
    PARAM_VALIDATIONS_MOTS,
    {},
  );
  const res = [...parMot.values()].sort((a, b) =>
    a.mot < b.mot ? -1 : a.mot > b.mot ? 1 : 0,
  );
  for (const m of res)
    m.textesValides = await textesValidesDuMot(m.mot, validations);
  return res;
}
