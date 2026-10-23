/**
 * Plan du type `liste-avant` (R2) : étiquette, titre mot par mot, la fiche de tâches dont les rangs entrent un à un,
 * puis la pastille du total qui surgit (vidéo de référence, plan `s4`). PUR : ni `remotion` ni React.
 */
import { boiteDans, disposer, largeurTexte, type BoitePx, type ProprietesEcran, type TextePose } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { couleursDuFond, famille, heureEvenement, instant, planEntreeEcran, planMarque, planMotParMot, planSurgir, progres } from "./commun";
import { debutRangParDefaut, planListeTaches, type ProprietesListeTaches } from "./ListeTaches";

export type ProprietesListeAvant = Extract<ProprietesEcran, { type: "liste-avant" }>;

/** Pastille du total : 170 px de texte, marges 46/26, ligne de 36 px (référence). */
const MARGE_X = 46 / 170;
const MARGE_HAUT = 26 / 170;
const MARGE_BAS = 20 / 170;
const LIGNE_REL = 36 / 170;
const ECART_LIGNE = 8 / 170;

export function planListeAvant(p: ProprietesListeAvant, image: number) {
  const t = instant(image, p.fps);
  const { textes, boites } = disposer(p);
  const pose = (nom: string): TextePose | undefined => textes.find((x) => x.nom === nom);
  const couleurs = couleursDuFond(p.fond);
  const boiteListe = boites.objets.find((o) => o.nom === "liste")!.boite;
  const n = p.taches.length;
  const debuts = p.taches.map((_, i) => heureEvenement(p, `tache-${i + 1}`) ?? debutRangParDefaut(i));
  const annonce = p.total ? (heureEvenement(p, "total") ?? debutRangParDefaut(n) + 0.4) : null;
  const proprietesListe: ProprietesListeTaches = { boite: { ...boiteListe, x: 0, y: 0 }, t, tVideo: t + p.debutMs / 1000, fond: p.fond, textes: p.taches, debuts, annonce };
  const liste = planListeTaches(proprietesListe, image, p.fps);

  const titre = pose("titre")!;
  const debutTitre = heureEvenement(p, "titre") ?? 0.02;
  const etiquette = pose("etiquette");

  let total = null;
  const poseTotal = pose("total");
  const infoTotal = p.total;
  if (infoTotal && poseTotal) {
    const surgir = planSurgir(progres(t, (annonce ?? 0) + 0.08, 0.3), 5);
    let taille = poseTotal.tailleRendue;
    const ligneTaille = (s: number) => s * LIGNE_REL;
    const largeurDe = (s: number) => Math.max(largeurTexte(poseTotal.texte.toUpperCase(), "anton", s), infoTotal.ligne ? largeurTexte(infoTotal.ligne, "inter-gras", ligneTaille(s)) : 0) + 2 * MARGE_X * s;
    // Au plus 70 % de la largeur de la fiche.
    const maxLargeur = boiteListe.largeur * 0.7;
    if (largeurDe(taille) > maxLargeur) taille = (taille * maxLargeur) / largeurDe(taille);
    const largeur = largeurDe(taille);
    const hauteur = taille * (MARGE_HAUT + 1 + MARGE_BAS) + (infoTotal.ligne ? taille * (LIGNE_REL + ECART_LIGNE) : 0);
    const bas = Math.min(boiteListe.y + boiteListe.hauteur + hauteur * 0.18, p.zone.y + p.zone.hauteur);
    const boite: BoitePx = { x: boiteListe.x + boiteListe.largeur - largeur - boiteListe.largeur * (20 / 860), y: bas - hauteur, largeur, hauteur };
    total = {
      valeur: poseTotal.texte,
      ligne: infoTotal.ligne ?? null,
      taille,
      tailleLigne: ligneTaille(taille),
      boite,
      couleurFond: COULEURS_DUO.orange,
      couleurTexte: COULEURS_DUO.blanc,
      rayon: (36 / 170) * taille,
      famille: famille("anton"),
      familleLigne: famille("inter-gras"),
      opacite: surgir.opacite,
      echelle: surgir.echelle,
      rotation: surgir.rotation,
      tient: boiteDans(boite, p.zone),
    };
  }

  return {
    t,
    couleurs,
    entree: planEntreeEcran(p, t),
    marque: planMarque(p, pose("marque")!.boite),
    etiquettePose: etiquette ?? null,
    titre: { pose: titre, texte: titre.texte, boite: titre.boite, ecoule: t - debutTitre, pas: 0.12, mots: planMotParMot(titre.texte, t - debutTitre, 0.12), tient: titre.tient && boiteDans(titre.boite, p.zone) },
    boiteListe,
    liste,
    proprietesListe,
    entreeListe: progres(t, 0.15, 0.4),
    total,
  };
}
