/**
 * Plan du type `question` (R2) : une ou deux lignes d'affiche mot par mot, la dernière dans la lueur, puis la question
 * en ligne qui monte (vidéo de référence, plan `s18`). PUR : ni `remotion` ni React.
 */
import { boiteDans, disposer, type ProprietesEcran, type TextePose } from "../../../../src/briques/ecrans-motion";
import { couleursDuFond, famille, heureEvenement, instant, planEntreeEcran, planLigne, planMarque, planMotParMot } from "./commun";

export type ProprietesQuestion = Extract<ProprietesEcran, { type: "question" }>;

const PAS_PREMIERE = 0.12;
const DEPART_DEUXIEME_S = 0.5;
const DEPART_QUESTION_S = 1.2;

export function planQuestion(p: ProprietesQuestion, image: number) {
  const t = instant(image, p.fps);
  const { textes } = disposer(p);
  const pose = (nom: string): TextePose | undefined => textes.find((x) => x.nom === nom);
  const dernier = p.lignes.length - 1;
  const lignes = p.lignes.map((_, i) => {
    const nom = `titre-${i + 1}`;
    const l = pose(nom)!;
    const debut = heureEvenement(p, nom) ?? (i === 0 ? 0.02 : DEPART_DEUXIEME_S);
    const pas = i === 0 ? PAS_PREMIERE : undefined;
    const ecoule = t - debut;
    return { nom, pose: l, texte: l.texte, boite: l.boite, taille: l.tailleRendue, ecoule, pas, lueur: i === dernier, tient: l.tient && boiteDans(l.boite, p.zone), mots: planMotParMot(l.texte, ecoule, pas) };
  });
  const q = pose("question")!;
  const debutQuestion = heureEvenement(p, "question") ?? DEPART_QUESTION_S;
  return {
    t,
    couleurs: couleursDuFond(p.fond),
    entree: planEntreeEcran(p, t),
    marque: planMarque(p, pose("marque")!.boite),
    lignes,
    question: { pose: q, texte: q.lignes.join(" "), boite: q.boite, taille: q.tailleRendue, debut: debutQuestion, famille: famille("inter-gras"), ...planLigne(t, debutQuestion), tient: q.tient && boiteDans(q.boite, p.zone) },
  };
}
