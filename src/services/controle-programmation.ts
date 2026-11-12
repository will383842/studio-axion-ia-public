/**
 * L7-12 : le contrôleur de texte (L3-09) branché à la programmation. PUR : importable côté client, aucun appel réel.
 *
 * Il compose `controlerTextePost` (longueurs, appels, mots interdits) et ajoute le nombre de mots-dièse, comparé aux
 * bornes du réseau (`verifierLimitesTexte`). Il rend un voyant : vert (rien à dire), orange (à relire), rouge (format
 * que le réseau refuse). Le contrôle AVERTIT seulement : il n'empêche jamais d'enregistrer ni de programmer à la main.
 * Tout changement de texte d'une publication programmée repasse par ici (CAL-23). Aucun montant n'y figure.
 */
import { controlerTextePost, type EntreeTextePost, type ViolationTextePost } from "@/domaine/controles-script/texte-post";
import { verifierLimitesTexte } from "@/reseaux/ecriture";

export type VoyantControle = "vert" | "orange" | "rouge";

export type EntreeControleProgrammation = EntreeTextePost;

export interface ViolationProgrammation extends Omit<ViolationTextePost, "code"> {
  code: ViolationTextePost["code"] | "mots-diese";
}

export interface ResultatControleProgrammation {
  voyant: VoyantControle;
  /** Vrai si le réseau refuserait le format. Information seulement : la fiche n'empêche rien. */
  bloque: boolean;
  /** Les phrases à dire à la personne, la plus grave d'abord. */
  avertissements: string[];
  violations: ViolationProgrammation[];
}

const MOT_DIESE = /#[\p{L}\p{N}_]+/gu;

/** Nombre de mots-dièse d'un texte (un « # » seul n'en est pas un). PUR. */
export function compterMotsDiese(texte: string): number {
  return texte.match(MOT_DIESE)?.length ?? 0;
}

export function controlerProgrammation(e: EntreeControleProgrammation): ResultatControleProgrammation {
  const base = controlerTextePost(e);
  const violations: ViolationProgrammation[] = [...base.violations];
  const n = compterMotsDiese(`${e.texte}\n${e.legende ?? ""}`);
  for (const err of verifierLimitesTexte(e.reseau, { motsDiese: n }).filter((x) => x.code === "mots-diese-hors-bornes")) {
    violations.push({ code: "mots-diese", zone: "texte", niveau: "alerte", message: `${err.message}.` });
  }
  const bloque = violations.some((v) => v.niveau === "bloquant");
  const voyant: VoyantControle = bloque ? "rouge" : violations.some((v) => v.niveau === "alerte" || v.niveau === "correction") ? "orange" : "vert";
  const rang = (v: ViolationProgrammation) => (v.niveau === "bloquant" ? 0 : 1);
  const avertissements = [...violations].sort((a, b) => rang(a) - rang(b)).map((v) => v.message);
  return { voyant, bloque, avertissements, violations };
}
