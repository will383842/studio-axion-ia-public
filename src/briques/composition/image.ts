/**
 * CALQUES IMAGE depuis la commande — brique commune « composition » (née au lot M4 ; B.3, B.7, AV2.3 §5,
 * `decors/CATALOGUE-DECORS.md`). PUR : LUT de chaque plan (plan > vidéo > visage > format, « aucune » possible),
 * décor (méthode hybride : fond neutre posé par le studio, photo floutée, ou Look fabriqué avec le double), source du
 * double (piste transparente, image détourée ou silhouette simulée), côté du liseré de lumière.
 */
import type { AlerteQualite, AngleVisage, CommandeFabrication, ValeurDecor } from "@/domaine/types";
import { LUT_AUCUNE } from "@/donnees/luts-axion";
import type { PlanProduit } from "@/moteurs/types";
import type { RecetteComposition } from "./recette";
import { PREFIXE_ENTREE, type DecorScene, type SourceDouble } from "./scene";

/** Double simulé (aucun visage réel) : veste sombre, peau neutre. */
export const SILHOUETTE: SourceDouble = { type: "silhouette", tenue: "#1E2128", peau: "#C4967A" };

const ref = (nom: string) => `${PREFIXE_ENTREE}${nom}`;

/* ------------------------------------------------------------------ */
/* LUT                                                                 */
/* ------------------------------------------------------------------ */

/**
 * LUT d'un plan (B.7, AV2.3 §5) : plan > vidéo > visage > format. « Aucune » (sur le plan ou la vidéo) n'applique
 * rien, pas même la LUT du visage. `cible` : une illustration sans « illustrations », un plan du double sans
 * « personnage » ne reçoivent pas la LUT. Renvoie l'identifiant de l'élément LUT, ou null.
 */
export function lutDuPlan(c: Pick<CommandeFabrication, "styles" | "distribution" | "recetteMontage">, plan: Pick<PlanProduit, "lutId" | "sourceImage" | "angle">, anglesParDefaut: Pick<RecetteComposition["angles"], "principal">): string | null {
  const lut = c.styles.lut;
  const cible = lut?.cible ?? ["personnage", "illustrations", "rushs", "decor", "accessoire"];
  if (plan.sourceImage === "illustration" && !cible.includes("illustrations")) return null;
  if (plan.sourceImage === "double" && !cible.includes("personnage")) return null;
  if (plan.lutId) return plan.lutId === LUT_AUCUNE ? null : plan.lutId;
  if (lut === null) return null;
  if (lut?.id === LUT_AUCUNE) return null;
  if (lut && lut.origine === "video") return lut.id;
  if (plan.sourceImage === "double") {
    const angle = plan.angle ?? (c.recetteMontage?.angles ?? anglesParDefaut).principal;
    const duVisage = c.distribution[0]?.visagesResolus?.[angle]?.lutIdVisage;
    if (duVisage) return duVisage === LUT_AUCUNE ? null : duVisage;
  }
  return lut?.id ?? null;
}

/** Plages de chaque LUT sur la durée, par plan (coupes franches : une LUT change toujours sur une coupe). */
export function plagesDesLuts(c: Pick<CommandeFabrication, "styles" | "distribution" | "recetteMontage">, plans: PlanProduit[], anglesParDefaut: Pick<RecetteComposition["angles"], "principal">): Map<string, [number, number][]> {
  const plages = new Map<string, [number, number][]>();
  for (const p of plans) {
    const id = lutDuPlan(c, p, anglesParDefaut);
    if (!id) continue;
    const liste = plages.get(id) ?? [];
    const derniere = liste.at(-1);
    if (derniere && Math.abs(derniere[1] - p.debutSec) < 1e-6) derniere[1] = p.finSec;
    else liste.push([p.debutSec, p.finSec]);
    plages.set(id, liste);
  }
  return plages;
}

/* ------------------------------------------------------------------ */
/* Décor, double, accessoire                                            */
/* ------------------------------------------------------------------ */

/**
 * Décor (méthode hybride) : fond neutre Axion posé par le studio (image déjà floue), photo réelle floutée, ou Look
 * HeyGen (Will généré DANS la pièce : le décor est dans la vidéo du double ; tant qu'il est simulé ou à vérifier,
 * on pose le décor de repli et on le dit).
 */
export function decorScene(
  c: Pick<CommandeFabrication, "styles" | "medias">,
  repli: Pick<RecetteComposition, "decorRepli" | "nomDecorRepli">,
  look?: { angle: AngleVisage; pisteDepuisLook: boolean },
): { decor: DecorScene; entrees: Record<string, string>; alertes: AlerteQualite[]; lookReel?: boolean } {
  const defaut = repli.decorRepli;
  const d = c.styles.decor;
  const v: ValeurDecor | undefined = d?.valeur;
  const alertes: AlerteQualite[] = [];
  if (!d || !v) return { decor: defaut, entrees: {}, alertes };
  const methode = v.methode ?? "neutre-incruste";
  // Lot B1 : Look RÉEL (un look existe pour cet angle ET la piste du double en vient) = le décor est DANS la vidéo du
  // double. Ni décor ni liseré ne sont posés ; hors 9:16, les côtés sont prolongés par l'image du look très floutée
  // (même pièce, même lumière), ou par sa teinte. Un look encore à vérifier part quand même, avec l'alerte.
  if (methode === "look-heygen" && look?.pisteDepuisLook && v.lookIdParAngle?.[look.angle]) {
    if (v.statut === "a_verifier") alertes.push({ code: "defaut-visuel", gravite: "attention", message: `Décor « ${d.nom} » à vérifier sur une capture avant de le publier.` });
    const media = c.medias?.[d.id];
    const decor: DecorScene = { image: media ? ref("decor") : undefined, teinte: v.teinte ?? defaut.teinte, directionLumiere: v.directionLumiere, flouPx: Math.max(24, v.profondeurFlou), clair: v.clair ?? false };
    return { decor, entrees: media ? { decor: media.cle } : {}, alertes, lookReel: true };
  }
  if (methode === "look-heygen") {
    alertes.push({ code: "defaut-visuel", gravite: "info", message: `Décor « ${d.nom} » : il est fabriqué avec votre double (en essai pour l'instant), le fond ${repli.nomDecorRepli} le remplace.` });
    if (v.statut === "a_verifier") alertes.push({ code: "defaut-visuel", gravite: "attention", message: `Décor « ${d.nom} » à vérifier sur une capture avant de le publier.` });
    return { decor: defaut, entrees: {}, alertes };
  }
  const media = c.medias?.[d.id];
  const decor: DecorScene = {
    image: media ? ref("decor") : undefined,
    teinte: v.teinte ?? defaut.teinte,
    teinteLumiere: v.teinteLumiere ?? defaut.teinteLumiere,
    directionLumiere: v.directionLumiere,
    // Une photo réelle est toujours floutée (profondeur de champ) ; un fond neutre l'est déjà.
    flouPx: methode === "photo-incrustee" ? Math.max(12, v.profondeurFlou) : v.profondeurFlou,
    clair: v.clair ?? false,
  };
  return { decor, entrees: media ? { decor: media.cle } : {}, alertes };
}

/** Liseré de lumière de contour : du côté OPPOSÉ à la lumière principale (le regard part vers la droite). */
export function coteContour(direction: DecorScene["directionLumiere"]): "gauche" | "droite" {
  return direction === "gauche" ? "droite" : "gauche";
}

export function sourceDuDouble(c: Pick<CommandeFabrication, "distribution" | "medias">, angle: AngleVisage, nom: string, piste?: string, opaque = false, tranches?: { cle: string; debutSec: number; finSec: number }[]): { source: SourceDouble; entrees: Record<string, string> } {
  // `opaque` (lot B1) : piste issue d'un Look réel, la pièce est dans la vidéo (pas de fond transparent).
  if (piste) return { source: { type: "video", url: ref(nom), transparent: !opaque }, entrees: { [nom]: piste } };
  // Lot R7d : second angle rendu par passages (un webm transparent par passage, posé à son moment).
  if (tranches?.length) {
    const entrees: Record<string, string> = {};
    const morceaux = tranches.map((t, i) => {
      entrees[`${nom}-${i}`] = t.cle;
      return { url: ref(`${nom}-${i}`), debutSec: t.debutSec, finSec: t.finSec };
    });
    return { source: { type: "tranches", morceaux, transparent: !opaque }, entrees };
  }
  const visage = c.distribution[0]?.visagesResolus?.[angle];
  const detoure = visage ? c.medias?.[`visage:${visage.visageId}`] : undefined;
  if (detoure) return { source: { type: "image", url: ref(nom) }, entrees: { [nom]: detoure.cle } };
  return { source: SILHOUETTE, entrees: {} };
}
