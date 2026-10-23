/**
 * Plan du type `accroche` (R1) : ce qui est visible à une image donnée — étiquette, puis jusqu'à trois lignes d'affiche
 * écrites mot par mot (vidéo de référence, plan `s1`). PUR : ni `remotion` ni React.
 */
import { disposer, type ProprietesEcran, type TextePose } from "../../../../src/briques/ecrans-motion";
import { boiteDans } from "../../../../src/briques/ecrans-motion";
import { couleursDuFond, heureEvenement, instant, planEntreeEcran, planEtiquette, planMarque, planMotParMot } from "./commun";

export type ProprietesAccroche = Extract<ProprietesEcran, { type: "accroche" }>;

/** Pas entre deux mots de la première ligne (la vidéo de référence l'écrit déjà à demi au départ). */
const PAS_PREMIERE = 0.12;
/** La première ligne a déjà commencé de 0,5 s à l'image 0 (la vidéo démarre sur un écran vivant). */
const AVANCE_PREMIERE_S = 0.5;
/** Écart par défaut entre deux lignes quand le calage ne donne pas l'heure d'une ligne (s). */
const ECART_LIGNES_S = 0.7;

export function planAccroche(p: ProprietesAccroche, image: number) {
  const t = instant(image, p.fps);
  const { textes } = disposer(p);
  const pose = (nom: string): TextePose | undefined => textes.find((x) => x.nom === nom);
  const marque = pose("marque")!;
  const etiquette = pose("etiquette");
  const lignes = p.lignes.map((_, i) => {
    const nom = `titre-${i + 1}`;
    const l = pose(nom)!;
    const debut = heureEvenement(p, nom) ?? (i === 0 ? -AVANCE_PREMIERE_S : i * ECART_LIGNES_S);
    const ecoule = t - debut;
    const pas = i === 0 ? PAS_PREMIERE : undefined;
    return { nom, pose: l, texte: l.texte, boite: l.boite, taille: l.tailleRendue, ecoule, pas, lueur: false, tient: l.tient && boiteDans(l.boite, p.zone), mots: planMotParMot(l.texte, ecoule, pas) };
  });
  return {
    t,
    couleurs: couleursDuFond(p.fond),
    entree: planEntreeEcran(p, t),
    marque: planMarque(p, marque.boite),
    etiquette: etiquette ? planEtiquette(p.fond, etiquette, t) : null,
    etiquettePose: etiquette ?? null,
    lignes,
  };
}
