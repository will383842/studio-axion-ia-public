/**
 * PLAN DU TYPE `etape` (R3) : gabarit constant de la vidéo de référence (`ETAPES`, blocs `s7` à `s14`) — étiquette
 * « Étape 0n », titre mot par mot, une ligne, un visuel (objet redessiné ou vrai écran dans un téléphone), 0 à 2 puces,
 * fil d'avancement sur `n / total`.
 *
 * PUR : ni `remotion` ni React. Déterministe : tout se calcule depuis le numéro d'image.
 */
import { disposer, imagesEcran, largeurTexte, sansBalises, type BoitePx, type ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { heureEvenement, instant, planBiais, planEclair, planEntreeEcran, planEtiquette, planFilEtapes, planLigne, planMarque, planMotParMot, planSurgir, progres } from "./commun";
import { BIAIS_VISUEL, boiteVisuel, contexteVisuel, objetDuVisuel, pose, visuelEntre } from "./Objet";

/** Pas du mot par mot du titre d'une étape (référence : 100 ms, départ 20 ms après l'entrée de l'écran). */
export const PAS_TITRE_ETAPE = 0.1;

/** Boîte d'une puce (pastille de `socle/Puce.tsx`) de taille `taille`, pour le texte donné. */
export function boitePuce(texte: string, taille: number): { largeur: number; hauteur: number } {
  return { largeur: largeurTexte(sansBalises(texte), "inter-gras", taille) + taille * (2 + 0.77), hauteur: taille * 1.2 + taille * 0.82 };
}

/**
 * Place d'une puce : sa rangée verticale vient de la géométrie (bas du visuel ; la première de deux en haut) ; elle part du milieu du visuel vers la
 * droite, comme dans la référence, sans jamais sortir de la zone utile.
 */
export function placerPuce(rangee: BoitePx, visuel: BoitePx, zone: BoitePx, taille: { largeur: number; hauteur: number }): BoitePx {
  const largeur = Math.min(taille.largeur, zone.largeur);
  const voulu = visuel.x + visuel.largeur * 0.55;
  const x = Math.max(zone.x, Math.min(voulu, zone.x + zone.largeur - largeur));
  const hauteur = Math.min(taille.hauteur, rangee.hauteur);
  return { x, y: rangee.y + (rangee.hauteur - hauteur) / 2, largeur, hauteur };
}

/** Ce qui est visible d'un écran `etape` à l'image `image`. */
export function planEtape(p: Extract<ProprietesEcran, { type: "etape" }>, image: number) {
  const t = instant(image, p.fps);
  const tVideo = t + p.debutMs / 1000;
  const images = imagesEcran(p);
  const avance = progres(image, 0, Math.max(1, images - 1));
  const mise = disposer(p);
  const marque = pose(mise.textes, "marque")!;
  const etiquette = pose(mise.textes, "etiquette")!;
  const titre = pose(mise.textes, "titre")!;
  const ligne = pose(mise.textes, "ligne")!;
  const geometrie = mise.boites.objets.find((o) => o.nom === "visuel")!.boite;
  const boite = boiteVisuel(p.visuel, geometrie, p.zone, p.dessin, p.type);
  const biais = p.numero % 2 ? BIAIS_VISUEL.gauche : BIAIS_VISUEL.droite;
  const ecouleTitre = t - (heureEvenement(p, "titre") ?? 0.02);
  const debutLigne = heureEvenement(p, "ligne") ?? 0.35;
  const puces = p.puces.map((texte, i) => {
    const nom = `puce-${i + 1}`;
    const rangee = pose(mise.textes, nom)!;
    const debut = heureEvenement(p, nom) ?? 0.6 + i * 0.3;
    // Deux puces : la première en haut du visuel, la seconde en bas (référence : `s14`).
    const ligneDeLaPuce = p.puces.length > 1 && i === 0 ? { ...rangee.boite, y: boite.y + boite.hauteur * 0.1 } : rangee.boite;
    return { nom, texte, taille: rangee.tailleRendue, boite: placerPuce(ligneDeLaPuce, boite, p.zone, boitePuce(texte, rangee.tailleRendue)), debut, ...planSurgir(progres(t, debut, 0.3), i % 2 ? 4 : -4) };
  });
  return {
    t,
    tVideo,
    images,
    avance,
    fond: p.fond,
    entree: planEntreeEcran(p, t),
    marque: planMarque(p, marque.boite),
    etiquette: { pose: etiquette, ...planEtiquette(p.fond, etiquette, t) },
    titre: { pose: titre, ecoule: ecouleTitre, pas: PAS_TITRE_ETAPE, mots: planMotParMot(titre.texte, ecouleTitre, PAS_TITRE_ETAPE) },
    ligne: { pose: ligne, debut: debutLigne, ...planLigne(t, debutLigne) },
    visuel: {
      objet: objetDuVisuel(p.visuel),
      boite,
      entree: progres(t, 0.1, 0.4),
      ...visuelEntre(t, heureEvenement(p, "objet")),
      biais: planBiais(tVideo, biais.rotY, biais.rotX),
      contexte: contexteVisuel(p, boite, t),
    },
    puces,
    fil: { boite: mise.boites.fil!, numero: p.numero, nombreEtapes: p.nombreEtapes, ...planFilEtapes(p.numero, p.nombreEtapes, avance) },
    eclair: planEclair(t, heureEvenement(p, "eclair")),
  };
}
