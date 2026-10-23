/**
 * PLAN du type `promesse` (R4) : l'invite, puis le cadeau en orange avec lueur, puis une ligne qui monte. Référence :
 * `v8-a.html`, bloc `s20`. PUR : ni `remotion` ni React. Tous les textes viennent des propriétés.
 */
import { disposer, sansBalises, type ProprietesEcran, type TextePose } from "../../../../src/briques/ecrans-motion";
import { heureEvenement, instant, planEntreeEcran, planLigne, planMotParMot } from "./commun";

export type ProprietesPromesse = Extract<ProprietesEcran, { type: "promesse" }>;

/** Instants par défaut (s) quand l'écran ne les fixe pas par un événement. */
export const DEBUTS_PROMESSE = Object.freeze({ invite: 0.02, cadeau: 0.55, ligne: 1.2 });
/** Pas entre deux mots (s) : l'invite, puis le cadeau. */
export const PAS_PROMESSE = Object.freeze({ invite: 0.12, cadeau: 0.14 });

const opaciteMax = (mots: { opacite: number }[]) => mots.reduce((m, x) => Math.max(m, x.opacite), 0);
const poseDe = (textes: TextePose[], nom: string) => textes.find((x) => x.nom === nom)!;

export function planPromesse(p: ProprietesPromesse, image: number) {
  const t = instant(image, p.fps);
  const mise = disposer(p);
  const ev = (cible: string, defaut: number) => heureEvenement(p, cible) ?? defaut;
  const poseInvite = poseDe(mise.textes, "invite");
  // Le cadeau est toujours en accent (référence `s20`) : un texte sans balise (table des fins) est balisé en entier.
  const poseBrute = poseDe(mise.textes, "cadeau");
  const poseCadeau = poseBrute.texte.includes("*") ? poseBrute : { ...poseBrute, texte: `*${poseBrute.texte}*` };
  const poseLigne = poseDe(mise.textes, "ligne");
  const ecouleInvite = t - ev("invite", DEBUTS_PROMESSE.invite);
  const ecouleCadeau = t - ev("cadeau", DEBUTS_PROMESSE.cadeau);
  const invite = planMotParMot(poseInvite.texte, ecouleInvite, PAS_PROMESSE.invite);
  const cadeau = planMotParMot(poseCadeau.texte, ecouleCadeau, PAS_PROMESSE.cadeau);
  const ligne = planLigne(t, ev("ligne", DEBUTS_PROMESSE.ligne));
  // Cadeau coupé par la brique (trop long pour une ligne d'affiche) : sa suite monte en ligne quand le dernier mot de
  // la tête est tombé (référence `s20`).
  const poseSuite = mise.textes.find((x) => x.nom === "cadeau-suite") ?? null;
  const debutSuite = ev("cadeau", DEBUTS_PROMESSE.cadeau) + Math.max(0, cadeau.length - 1) * PAS_PROMESSE.cadeau + 0.1;
  const suite = poseSuite ? { pose: poseSuite, debut: debutSuite, ...planLigne(t, debutSuite) } : null;
  return {
    t,
    fond: p.fond,
    entree: planEntreeEcran(p, t),
    marque: poseDe(mise.textes, "marque").boite,
    eclair: heureEvenement(p, "eclair"),
    invite: { pose: poseInvite, mots: invite, opacite: opaciteMax(invite), ecoule: ecouleInvite, pas: PAS_PROMESSE.invite },
    /** Le cadeau est en couleur d'accent (balisage du texte) et porte une lueur. */
    cadeau: { pose: poseCadeau, mots: cadeau, opacite: opaciteMax(cadeau), ecoule: ecouleCadeau, pas: PAS_PROMESSE.cadeau, lueur: true },
    suite,
    ligne: { pose: poseLigne, debut: ev("ligne", DEBUTS_PROMESSE.ligne), ...ligne },
    textes: {
      marque: p.marque,
      ...(opaciteMax(invite) > 0 ? { invite: sansBalises(p.invite) } : {}),
      ...(opaciteMax(cadeau) > 0 ? { cadeau: sansBalises(poseCadeau.texte) } : {}),
      ...(suite && suite.opacite > 0 ? { "cadeau-suite": sansBalises(suite.pose.texte) } : {}),
      ...(ligne.opacite > 0 ? { ligne: sansBalises(p.ligne) } : {}),
    } as Record<string, string>,
  };
}
