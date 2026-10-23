/**
 * Plan du type `resultat` (R2) : étiquette, titre mot par mot, deux barres (« avant » longue qui se remplit,
 * « maintenant » plus courte qui rebondit) avec leurs étiquettes, puis la ligne finale (vidéo de référence, plan
 * `s17`). PUR : ni `remotion` ni React.
 */
import { boiteDans, disposer, type BoitePx, type ProprietesEcran, type TextePose } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { c01, famille, heureEvenement, instant, planEntreeEcran, planLigne, planMarque, planMotParMot, progres } from "./commun";
import { debutBarreParDefaut, partsBarres, planBarresAvantApres, type ProprietesBarresAvantApres } from "./BarresAvantApres";
import { couleursDeLEcran, estFort } from "./fond-fort";

export type ProprietesResultat = Extract<ProprietesEcran, { type: "resultat" }>;

const DEPART_TITRE_S = 0.2;
const DEPART_LIGNE_S = 1.6;

export function planResultat(p: ProprietesResultat, image: number) {
  const t = instant(image, p.fps);
  const { textes, boites } = disposer(p);
  const pose = (nom: string): TextePose | undefined => textes.find((x) => x.nom === nom);
  const couleurs = couleursDeLEcran(p.fond, p.jeu);
  // L3c · fond fort et barres proportionnelles aux nombres écrits (illisibles : la v4 exacte, 520 / 900).
  const fort = estFort(p.jeu);
  const parts = p.jeu?.barres === "proportionnelles" ? partsBarres(p.avant, p.maintenant) : null;
  const objet = (nom: string) => boites.objets.find((o) => o.nom === nom)!.boite;

  const barre = (variante: "avant" | "maintenant", texte: string) => {
    const boite = objet(`barre-${variante}`);
    const debut = heureEvenement(p, `barre-${variante}`) ?? debutBarreParDefaut(variante);
    const reglage = { ...(parts ? { part: parts[variante] } : {}), ...(fort ? { fort: true } : {}) };
    const props: ProprietesBarresAvantApres = { boite: { ...boite, x: 0, y: 0 }, t, tVideo: t + p.debutMs / 1000, fond: p.fond, textes: [texte], variante, debut, ...reglage };
    // `reglage` (L3c) n'est rendu que s'il change quelque chose : sans jeu, le plan reste celui de la v4.
    return { boite, plan: planBarresAvantApres(props, image, p.fps), ...(Object.keys(reglage).length ? { reglage } : {}) };
  };
  const avant = barre("avant", p.avant);
  const maintenant = barre("maintenant", p.maintenant);

  /** Étiquette alignée à gauche sur sa barre. */
  const etiquetteBarre = (nom: string, barreBoite: BoitePx, couleur: string) => {
    const pz = pose(nom);
    if (!pz) return null;
    const boite: BoitePx = { ...pz.boite, x: barreBoite.x, largeur: barreBoite.largeur };
    return { texte: pz.texte, boite, taille: pz.tailleRendue, approcheEm: pz.approche, couleur, famille: famille("inter-gras"), opacite: progres(t, 0, 0.2), tient: pz.tient && boiteDans(boite, p.zone) };
  };

  const titre = pose("titre")!;
  const debutTitre = heureEvenement(p, "titre") ?? DEPART_TITRE_S;
  const ligne = pose("ligne")!;
  const debutLigne = heureEvenement(p, "ligne") ?? DEPART_LIGNE_S;
  const entreeLigne = planLigne(t, debutLigne);

  return {
    t,
    couleurs,
    entree: planEntreeEcran(p, t),
    marque: planMarque(p, pose("marque")!.boite),
    etiquettePose: pose("etiquette") ?? null,
    titre: { pose: titre, texte: titre.texte, boite: titre.boite, ecoule: t - debutTitre, pas: 0.12, mots: planMotParMot(titre.texte, t - debutTitre, 0.12), tient: titre.tient && boiteDans(titre.boite, p.zone) },
    etiquetteAvant: etiquetteBarre("etiquette-avant", avant.boite, couleurs.secondaire),
    etiquetteMaintenant: etiquetteBarre("etiquette-maintenant", maintenant.boite, couleurs.accent),
    avant: { ...avant, tient: avant.plan.texte.tient && boiteDans(avant.boite, p.zone) },
    maintenant: { ...maintenant, tient: maintenant.plan.texte.tient && boiteDans(maintenant.boite, p.zone) },
    ligne: { pose: ligne, texte: ligne.texte, boite: ligne.boite, taille: ligne.tailleRendue, couleur: couleurs.secondaire, famille: famille("inter-gras"), opacite: c01(entreeLigne.opacite), decalageY: entreeLigne.decalageY, tient: ligne.tient && boiteDans(ligne.boite, p.zone) },
    couleurEncre: COULEURS_DUO.encre,
  };
}
