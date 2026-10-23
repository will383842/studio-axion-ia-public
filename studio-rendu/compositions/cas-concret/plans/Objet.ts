/**
 * PLAN DU TYPE `objet` (R3) : titre mot par mot, ligne facultative, un objet animé (vidéo de référence : `s11`, `s16`).
 * Porte aussi ce que les types `etape` et `objet` partagent : le cadrage d'un visuel à ses proportions dans la place
 * que la géométrie lui donne, et le contexte passé à l'objet (durée de l'écran, événements, capture).
 *
 * PUR : ni `remotion` ni React. Déterministe : tout se calcule depuis le numéro d'image.
 */
import { disposer, imagesEcran, type BoitePx, type CaptureEcran, type EvenementEcran, type IdObjet, type ProprietesEcran, type TextePose, type VisuelEcran } from "../../../../src/briques/ecrans-motion";
import { heureEvenement, instant, planBiais, planEclair, planEntreeEcran, planEntreeObjet, planImpulsion, planLigne, planMarque, planMotParMot, progres, type ProprietesObjet } from "./commun";

/**
 * Ce que reçoit un objet dessiné par les types `etape` et `objet` : les propriétés communes, plus la durée de l'écran,
 * ses événements (heures depuis le début de l'écran) et la durée du film d'une capture.
 */
export type ContexteObjet = ProprietesObjet & {
  /** Durée de l'écran (s). */
  dureeEcran?: number;
  evenements?: readonly EvenementEcran[];
  /** Durée du film (`capture.sorte === "video"`), en s. */
  dureeCaptureSec?: number;
  /** L7 · animation tirée de l'objet (1, 2… ; `plans/anim-objets.ts`) ; absente : l'animation de la v4. */
  anim?: number;
};

/** Entrée du visuel d'un écran `etape` ou `objet`, avec son impulsion (événement `objet`, moment où il s'anime). */
export function visuelEntre(t: number, impulsion: number | null) {
  const e = planEntreeObjet(progres(t, 0.1, 0.4));
  return { ...e, echelle: e.echelle * planImpulsion(t, impulsion) };
}

/** Heure (s, depuis le début de l'écran) d'un événement passé à un objet, sinon la valeur par défaut. */
export const heureObjet = (p: Pick<ContexteObjet, "evenements">, cible: string, defaut: number): number => heureEvenement({ evenements: [...(p.evenements ?? [])] }, cible) ?? defaut;

/** Proportions (largeur / hauteur) des objets dessinés par R3, en px de la vidéo de référence. */
export const RATIOS_OBJETS: Readonly<Partial<Record<IdObjet, number>>> = Object.freeze({
  "telephone-capture": 470 / 920,
  "telephone-notification": 470 / 920,
  "pile-notifications": 900 / 460,
  chrono: 1,
  "contrat-signature": 620 / 800,
  "dossier-classe": 600 / 900,
});

/** La plus grande boîte aux proportions `ratio` (largeur / hauteur) centrée dans `place`. */
export function cadrer(ratio: number, place: BoitePx): BoitePx {
  if (!(ratio > 0) || !(place.largeur > 0) || !(place.hauteur > 0)) return { ...place };
  let largeur = place.largeur;
  let hauteur = largeur / ratio;
  if (hauteur > place.hauteur) {
    hauteur = place.hauteur;
    largeur = hauteur * ratio;
  }
  return { x: place.x + (place.largeur - largeur) / 2, y: place.y + (place.hauteur - hauteur) / 2, largeur, hauteur };
}

/** L'objet qui dessine un visuel : l'objet nommé, ou le téléphone pour un vrai écran. */
export const objetDuVisuel = (v: VisuelEcran): IdObjet => ("objet" in v ? v.objet : "telephone-capture");

/**
 * V4-2 : taille et place de chaque objet dans la v4 (px de la v4, lus dans le DOM de `v4.html`), pour la boîte de visuel
 * du gabarit à la taille de référence (`hauteurRef` : 920 px pour une étape, le téléphone ; 760 px pour un écran `objet`).
 * `haut` : écart entre le haut de la boîte du gabarit et celui de l'objet. Proportions : celles de `RATIOS_OBJETS`. Un
 * objet absent garde l'ancienne règle.
 */
export const PLACES_V4: Readonly<Record<"etape" | "objet", { hauteurRef: number; objets: Readonly<Partial<Record<IdObjet, { largeur: number; hauteur: number; haut: number }>>> }>> = Object.freeze({
  // Étapes : notifications `s9` (694–1 172 px), anneau `s12` (740 px à 690), contrat `s14` (656–1 478 px) ; boîte du téléphone à 640 px.
  etape: { hauteurRef: 920, objets: { "pile-notifications": { largeur: 900, hauteur: 460, haut: 54 }, chrono: { largeur: 740, hauteur: 740, haut: 50 }, "contrat-signature": { largeur: 620, hauteur: 800, haut: 16 } } },
  // Écran `objet` : dossier `s16` (759–1 408 px) ; boîte du gabarit à 683 px. La boîte du dossier commence 260 px
  // au-dessus du dossier dessiné (la feuille y descend, `DossierClasse.ts`) : 759 − 260 − 683 = −184.
  objet: { hauteurRef: 760, objets: { "dossier-classe": { largeur: 600, hauteur: 900, haut: -184 } } },
});

/**
 * Boîte d'un visuel : la boîte de la géométrie élargie à toute la largeur permise (la zone utile ; avec une zone de
 * dessin, jusqu'à ses bords, de part et d'autre du centre de la zone utile), puis cadrée aux proportions de l'objet (un
 * objet sans proportions connues garde la boîte de la géométrie). Avec le type de l'écran (V4-2), un objet de la v4
 * prend sa taille et sa place de la v4, à l'échelle de la boîte du gabarit, sans jamais en sortir.
 */
export function boiteVisuel(v: VisuelEcran, geometrie: BoitePx, zone: BoitePx, dessin?: BoitePx, type?: "etape" | "objet"): BoitePx {
  const ratio = RATIOS_OBJETS[objetDuVisuel(v)];
  if (!ratio) return { ...geometrie };
  const centre = zone.x + zone.largeur / 2;
  const largeur = dessin ? Math.max(zone.largeur, 2 * Math.min(centre - dessin.x, dessin.x + dessin.largeur - centre)) : zone.largeur;
  const place = type ? PLACES_V4[type].objets[objetDuVisuel(v)] : undefined;
  if (place) {
    const s = geometrie.hauteur / PLACES_V4[type!].hauteurRef;
    const haut = place.haut * s;
    const k = Math.max(0, Math.min(s, largeur / place.largeur, (geometrie.hauteur - haut) / place.hauteur));
    return { x: centre - (place.largeur * k) / 2, y: geometrie.y + haut, largeur: place.largeur * k, hauteur: place.hauteur * k };
  }
  return cadrer(ratio, { x: centre - largeur / 2, y: geometrie.y, largeur, hauteur: geometrie.hauteur });
}

/** Contexte passé à l'objet d'un visuel (boîte ramenée à l'origine : l'enveloppe `Biais` la place). */
export function contexteVisuel(p: Extract<ProprietesEcran, { type: "etape" | "objet" }>, boite: BoitePx, t: number): ContexteObjet {
  const v = p.visuel;
  const base: ContexteObjet = { boite: { x: 0, y: 0, largeur: boite.largeur, hauteur: boite.hauteur }, t, tVideo: t + p.debutMs / 1000, fond: p.fond, dureeEcran: (p.finMs - p.debutMs) / 1000, evenements: p.evenements, ...(typeof p.jeu?.animObjet === "number" && p.jeu.animObjet > 0 ? { anim: p.jeu.animObjet } : {}) };
  if ("objet" in v) return v.textes ? { ...base, textes: [...v.textes] } : base;
  // Le décalage de départ d'une page entière (`departY`) n'est pas un champ de la brique : la chaîne l'ajoute à la capture
  // (type `CaptureVraiEcran` du moteur, redéclaré ici) et la brique la recopie entière.
  const c: CaptureEcran & { departY?: number } = v.capture;
  const departY = c.sorte === "page-entiere" && typeof c.departY === "number" && c.departY > 0 ? Math.min(1, c.departY) : undefined;
  return { ...base, capture: { src: c.src, sorte: c.sorte, largeur: c.largeur, hauteur: c.hauteur, ...(departY !== undefined ? { departY } : {}) }, ...(c.dureeSec !== undefined ? { dureeCaptureSec: c.dureeSec } : {}) };
}

/** Pose d'un texte de l'écran par son nom (`undefined` s'il n'est pas écrit). */
export const pose = (textes: readonly TextePose[], nom: string): TextePose | undefined => textes.find((x) => x.nom === nom);

/** Biais du visuel : il penche d'un côté ou de l'autre, comme les téléphones de la référence. */
export const BIAIS_VISUEL = Object.freeze({ gauche: Object.freeze({ rotY: -11, rotX: 5 }), droite: Object.freeze({ rotY: 10, rotX: 4 }) });

/** Pas du mot par mot du titre de l'écran `objet` (référence : 120 ms). */
export const PAS_TITRE_OBJET = 0.12;

/** Ce qui est visible d'un écran `objet` à l'image `image`. */
export function planObjet(p: Extract<ProprietesEcran, { type: "objet" }>, image: number) {
  const t = instant(image, p.fps);
  const tVideo = t + p.debutMs / 1000;
  const mise = disposer(p);
  const marque = pose(mise.textes, "marque")!;
  const titre = pose(mise.textes, "titre")!;
  const ligne = pose(mise.textes, "ligne");
  const geometrie = mise.boites.objets.find((o) => o.nom === "visuel")!.boite;
  const boite = boiteVisuel(p.visuel, geometrie, p.zone, p.dessin, p.type);
  const ecouleTitre = t - (heureEvenement(p, "titre") ?? 0.02);
  const debutLigne = heureEvenement(p, "ligne") ?? 0.35;
  return {
    t,
    tVideo,
    images: imagesEcran(p),
    fond: p.fond,
    entree: planEntreeEcran(p, t),
    marque: planMarque(p, marque.boite),
    titre: { pose: titre, ecoule: ecouleTitre, pas: PAS_TITRE_OBJET, mots: planMotParMot(titre.texte, ecouleTitre, PAS_TITRE_OBJET) },
    ligne: ligne ? { pose: ligne, debut: debutLigne, ...planLigne(t, debutLigne) } : null,
    visuel: {
      objet: objetDuVisuel(p.visuel),
      boite,
      entree: progres(t, 0.1, 0.4),
      ...visuelEntre(t, heureEvenement(p, "objet")),
      biais: planBiais(tVideo, BIAIS_VISUEL.droite.rotY, BIAIS_VISUEL.droite.rotX),
      contexte: contexteVisuel(p, boite, t),
    },
    eclair: planEclair(t, heureEvenement(p, "eclair")),
  };
}
