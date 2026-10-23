/**
 * PLAN du type `lien` (R4) : le titre mot par mot, la bulle du lien qui entre (son texte est ajusté pour tenir), puis
 * la signature qui tombe 1,55 s avant la fin de l'écran. Référence : `v8-a.html`, bloc `s21`. PUR : ni `remotion` ni
 * React. Tous les textes viennent des propriétés.
 */
import { disposer, sansBalises, type BoitePx, type ProprietesEcran, type TextePose } from "../../../../src/briques/ecrans-motion";
import { c01, doux, heureEvenement, instant, planBiais, planEntreeEcran, planEntreeObjet, planEtiquette, planMotParMot, progres, rebond, type ProprietesObjet } from "./commun";

export type ProprietesLien = Extract<ProprietesEcran, { type: "lien" }>;

/** Propriétés de la bulle : celles d'un objet, plus la taille ajustée du texte. */
export type ProprietesBulle = ProprietesObjet & {
  /** Taille (px) voulue du texte ; la bulle la réduit (jusqu'à 60 %) pour que le texte tienne. */
  tailleTexte?: number;
};

/** La signature tombe cet instant (s) avant la fin de l'écran. */
export const SIGNATURE_AVANT_FIN_S = 1.55;
/** Instants par défaut (s) quand l'écran ne les fixe pas par un événement. */
export const DEBUTS_LIEN = Object.freeze({ titre: 0.02, bulle: 0.9 });
/** Pas entre deux mots du titre (s). */
const PAS_TITRE_S = 0.12;
/** Angles du biais de la bulle. */
export const BIAIS_BULLE = Object.freeze({ rotY: -6, rotX: 3 });

const opaciteMax = (mots: { opacite: number }[]) => mots.reduce((m, x) => Math.max(m, x.opacite), 0);
const poseDe = (textes: TextePose[], nom: string) => textes.find((x) => x.nom === nom)!;

/** La signature découpée selon le balisage : « Axion-*IA* » → « Axion- » puis « IA » (en accent). */
export function segmentsSignature(texte: string): { texte: string; accent: boolean }[] {
  return texte
    .split("*")
    .map((s, i) => ({ texte: s, accent: i % 2 === 1 }))
    .filter((s) => s.texte !== "");
}

/**
 * Titre sans balisage d'accent (texte de la table des fins) et coupé en deux lignes : la dernière ligne passe en accent,
 * comme la référence (« RÉSERVEZ VOTRE » puis « DIAGNOSTIC GRATUIT » en orange). Un titre balisé reste tel quel.
 */
export function titreAccentue(pose: Pick<TextePose, "texte" | "lignes">): string {
  if (pose.texte.includes("*") || pose.lignes.length < 2) return pose.texte;
  const mots = pose.texte.split(/\s+/).filter(Boolean);
  const n = Math.min(mots.length - 1, pose.lignes[pose.lignes.length - 1].split(/\s+/).filter(Boolean).length);
  return [...mots.slice(0, mots.length - n), `*${mots.slice(mots.length - n).join(" ")}*`].join(" ");
}

/** Durée de l'écran (s). */
export const dureeEcran = (p: Pick<ProprietesLien, "debutMs" | "finMs">) => Math.max(0, (p.finMs - p.debutMs) / 1000);

/** Signature : arrive en zoom arrière rapide (échelle 1,3 → 1), 1,55 s avant la fin de l'écran. */
export function planSignature(duree: number, t: number) {
  const debut = Math.max(0, duree - SIGNATURE_AVANT_FIN_S);
  const z = progres(t, debut, 0.3);
  return { debut, opacite: c01(z * 3), echelle: 1.3 - 0.3 * doux(z) };
}

/**
 * L3a · variantes de l'écran final, lues dans `p.jeu` (`finComposition`, `finAnimation`) ; absentes ou 0 : la v4 exacte.
 *  - composition 1 : textes alignés à gauche dans la marge de la zone utile, bulle posée à gauche sous le titre (maquette
 *    `m16-fin-variante`) ; mêmes boîtes verticales, mêmes tailles, mêmes couleurs ;
 *  - animation 1 : la bulle monte depuis le bas avec un léger rebond (`rebond` de `commun.ts`).
 * La marque (axion-ia.com) et la bulle (bouton) restent toujours là, dans la zone utile.
 */
export type VarianteFin = { composition: 0 | 1; animation: 0 | 1 };
/** Montée de la bulle (px) dans l'animation 1, et sa durée (s). */
export const MONTEE_BULLE = Object.freeze({ px: 360, dureeS: 0.55 });

/** Variante lue dans le jeu de l'écran (toute valeur autre que 1 : 0, la v4). */
export function varianteFin(p: Pick<ProprietesLien, "jeu">): VarianteFin {
  const lire = (v: unknown): 0 | 1 => (v === 1 ? 1 : 0);
  return { composition: lire(p.jeu?.finComposition), animation: lire(p.jeu?.finAnimation) };
}

/** Entrée de la bulle dans l'animation 1 : montée depuis le bas, léger dépassement, puis repos. */
export function planMonteeBulle(x: number) {
  return { opacite: c01(x * 3), decalageY: (1 - rebond(x)) * MONTEE_BULLE.px, echelle: 1 };
}

/** Plan de l'écran `lien` : celui de la v4, plus `variante` seulement quand le jeu en demande une. */
export function planLien(p: ProprietesLien, image: number): PlanLienV4 & { variante?: VarianteFin } {
  const v4 = planLienV4(p, image);
  const variante = varianteFin(p);
  if (!variante.composition && !variante.animation) return v4;
  const { t } = v4;
  let bulle = v4.bulle;
  let textes: Record<string, string> = v4.textes;
  if (variante.composition) {
    // À gauche, dans la marge de la zone utile (la bulle a déjà sa place dans la zone : seule sa colonne change).
    const boite = { ...bulle.boite, x: p.zone.x };
    bulle = { ...bulle, boite, objet: { ...bulle.objet, boite } };
  }
  if (variante.animation) {
    const x = progres(t, (heureEvenement(p, "lien") ?? DEBUTS_LIEN.bulle) - 0.1, MONTEE_BULLE.dureeS);
    bulle = { ...bulle, progres: x, entree: planMonteeBulle(x) };
    // Le texte du lien est lu dès que la bulle paraît (même règle que la v4), à sa place dans l'ordre des textes.
    const { signature, ...avant } = textes;
    const { lien: _lien, ...sansLien } = avant;
    void _lien;
    textes = { ...sansLien, ...(x > 0 ? { lien: sansBalises(p.lien) } : {}), ...(signature !== undefined ? { signature } : {}) };
  }
  return { ...v4, bulle, textes, variante };
}

type PlanLienV4 = ReturnType<typeof planLienV4>;

/** Le plan de la v4, inchangé. */
function planLienV4(p: ProprietesLien, image: number) {
  const t = instant(image, p.fps);
  const tVideo = t + p.debutMs / 1000;
  const mise = disposer(p);
  const ev = (cible: string, defaut: number) => heureEvenement(p, cible) ?? defaut;
  const poseEtiquette = mise.textes.find((x) => x.nom === "etiquette");
  const poseBrute = poseDe(mise.textes, "titre");
  const poseTitre = { ...poseBrute, texte: titreAccentue(poseBrute) };
  const poseLien = poseDe(mise.textes, "lien");
  const poseSignature = poseDe(mise.textes, "signature");
  const boiteBulle: BoitePx = mise.boites.objets.find((o) => o.nom === "bulle")!.boite;
  const ecouleTitre = t - ev("titre", DEBUTS_LIEN.titre);
  const titre = planMotParMot(poseTitre.texte, ecouleTitre, PAS_TITRE_S);
  const entreeBulle = progres(t, ev("lien", DEBUTS_LIEN.bulle) - 0.1, 0.4);
  const signature = planSignature(dureeEcran(p), t);
  return {
    t,
    tVideo,
    fond: p.fond,
    entree: planEntreeEcran(p, t),
    marque: poseDe(mise.textes, "marque").boite,
    eclair: heureEvenement(p, "eclair"),
    etiquette: poseEtiquette ? { pose: poseEtiquette, ...planEtiquette(p.fond, poseEtiquette, t) } : null,
    titre: { pose: poseTitre, mots: titre, opacite: opaciteMax(titre), ecoule: ecouleTitre, pas: PAS_TITRE_S },
    bulle: {
      boite: boiteBulle,
      progres: entreeBulle,
      entree: planEntreeObjet(entreeBulle, 100),
      biais: planBiais(tVideo, BIAIS_BULLE.rotY, BIAIS_BULLE.rotX),
      objet: { boite: boiteBulle, t, tVideo, fond: p.fond, textes: [p.lien], tailleTexte: poseLien.tailleRendue } satisfies ProprietesBulle,
      tient: poseLien.tient,
    },
    signature: { pose: poseSignature, segments: segmentsSignature(p.signature), ...signature },
    textes: {
      marque: p.marque,
      ...(poseEtiquette && poseEtiquette.texte ? { etiquette: sansBalises(poseEtiquette.texte) } : {}),
      ...(opaciteMax(titre) > 0 ? { titre: sansBalises(p.titre) } : {}),
      ...(entreeBulle > 0 ? { lien: sansBalises(p.lien) } : {}),
      ...(signature.opacite > 0 ? { signature: sansBalises(p.signature) } : {}),
    } as Record<string, string>,
  };
}
