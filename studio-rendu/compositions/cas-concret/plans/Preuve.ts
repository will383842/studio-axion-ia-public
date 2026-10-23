/**
 * Plan du type `preuve` (R2) : étiquette, titre mot par mot, le bouclier dont la coche surgit, puis deux puces qui
 * surgissent l'une après l'autre (vidéo de référence, plan `s16b`). PUR : ni `remotion` ni React.
 */
import { boiteDans, disposer, largeurTexte, type ProprietesEcran, type TextePose } from "../../../../src/briques/ecrans-motion";
import { heureEvenement, instant, planEntreeEcran, planMarque, planMotParMot, planPuce, planSurgir, progres } from "./commun";
import { couleursDeLEcran } from "./fond-fort";
import { planBouclierCoche, type ProprietesBouclierCoche } from "./BouclierCoche";

export type ProprietesPreuve = Extract<ProprietesEcran, { type: "preuve" }>;

/** Une puce : rond à coche (2 em à gauche) + marge droite (0,77 em), cf. le composant `Puce` du socle. */
const MARGES_PUCE_EM = 2.77;
const DEPART_TITRE_S = 0.1;
const DEPART_COCHE_S = 0.5;
const DEPART_PUCE_S = 0.9;
const ECART_PUCES_S = 0.4;

export function planPreuve(p: ProprietesPreuve, image: number) {
  const t = instant(image, p.fps);
  const { textes, boites } = disposer(p);
  const pose = (nom: string): TextePose | undefined => textes.find((x) => x.nom === nom);
  const boiteBouclier = boites.objets.find((o) => o.nom === "bouclier")!.boite;
  const debutCoche = heureEvenement(p, "coche") ?? DEPART_COCHE_S;
  const proprietes: ProprietesBouclierCoche = { boite: { ...boiteBouclier, x: 0, y: 0 }, t, tVideo: t + p.debutMs / 1000, fond: p.fond, debutCoche };
  const bouclier = planBouclierCoche(proprietes, image, p.fps);

  const titre = pose("titre")!;
  const debutTitre = heureEvenement(p, "titre") ?? DEPART_TITRE_S;

  const puces = p.puces.map((texte, i) => {
    const nom = `puce-${i + 1}`;
    const pz = pose(nom)!;
    // La puce garde la taille du texte, réduite si pastille + marges dépassent la zone.
    const place = p.zone.largeur;
    const brut = largeurTexte(texte, "inter-gras", pz.tailleRendue) + MARGES_PUCE_EM * pz.tailleRendue;
    const taille = brut > place ? (pz.tailleRendue * place) / brut : pz.tailleRendue;
    const largeur = largeurTexte(texte, "inter-gras", taille) + MARGES_PUCE_EM * taille;
    const debut = heureEvenement(p, nom) ?? DEPART_PUCE_S + i * ECART_PUCES_S;
    const avance = progres(t, debut, 0.3);
    const surgir = planSurgir(avance, i % 2 ? 3 : -3);
    return {
      nom,
      ...planPuce(texte, taille),
      boite: pz.boite,
      centre: { x: pz.boite.x + pz.boite.largeur / 2, largeur },
      progres: avance,
      rotationFinale: surgir.rotation,
      opacite: surgir.opacite,
      echelle: surgir.echelle,
      rotation: surgir.rotation,
      tient: largeur <= place + 0.01 && boiteDans(pz.boite, p.zone),
    };
  });

  return {
    t,
    couleurs: couleursDeLEcran(p.fond, p.jeu),
    entree: planEntreeEcran(p, t),
    marque: planMarque(p, pose("marque")!.boite),
    etiquettePose: pose("etiquette") ?? null,
    titre: { pose: titre, texte: titre.texte, boite: titre.boite, ecoule: t - debutTitre, mots: planMotParMot(titre.texte, t - debutTitre, 0.16), pas: 0.16, tient: titre.tient && boiteDans(titre.boite, p.zone) },
    boiteBouclier,
    bouclier,
    debutCoche,
    entreeBouclier: progres(t, 0.1, 0.35),
    puces,
  };
}
