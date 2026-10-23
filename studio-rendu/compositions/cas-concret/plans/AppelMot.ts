/**
 * PLAN du type `appel-mot` (R4) : ce qui est visible à une image donnée — l'invite mot par mot, le champ de saisie qui
 * entre et prend un léger biais, le mot qui se tape lettre par lettre (curseur clignotant), la suite. Référence :
 * `v8-a.html`, bloc `s19`. PUR : ni `remotion` ni React. Tous les textes viennent des propriétés.
 */
import { disposer, enCapitales, sansBalises, type BoitePx, type ProprietesEcran, type TextePose } from "../../../../src/briques/ecrans-motion";
import { c01, heureEvenement, instant, planBiais, planEntreeEcran, planEntreeObjet, planEtiquette, planMotParMot, progres, type ProprietesObjet } from "./commun";

export type ProprietesAppelMot = Extract<ProprietesEcran, { type: "appel-mot" }>;

/** Propriétés du champ de saisie : celles d'un objet, plus ce qui pilote la frappe. */
export type ProprietesChamp = ProprietesObjet & {
  /** Taille (px) voulue du mot, celle de la mise en page de l'écran ; le champ la réduit si le mot ne tient pas. */
  tailleTexte?: number;
  /** Taille (px) sous laquelle le mot ne descend pas (plancher de la charte). */
  plancherTexte?: number;
  /** Instant (s, depuis le début de l'écran) où la première lettre se tape. */
  debutFrappeS?: number;
};

/** Frappe : une lettre tous les 150 ms, au plus 1,2 s pour tout le mot ; le curseur change d'état trois fois par seconde. */
export const FRAPPE = Object.freeze({ pasS: 0.15, dureeMaxS: 1.2, clignotementHz: 3 });
/** Instants par défaut (s) quand l'écran ne les fixe pas par un événement. */
export const DEBUTS_APPEL_MOT = Object.freeze({ invite: 0, champ: 0.12, frappe: 0.7, suite: 1.35 });
/** Pas entre deux mots de l'invite et de la suite (s). */
const PAS_MOTS_S = 0.09;
/** Angles du biais du champ. */
export const BIAIS_CHAMP = Object.freeze({ rotY: 6, rotX: 3 });

/** Nombre de lettres du mot déjà tapées à l'instant `ecoule` (s) depuis le début de la frappe. */
export function lettresTapees(mot: string, ecoule: number): number {
  const n = [...mot].length;
  if (n === 0 || ecoule < 0) return 0;
  const pas = Math.min(FRAPPE.pasS, FRAPPE.dureeMaxS / n);
  return Math.max(0, Math.min(n, Math.floor(ecoule / pas) + 1));
}

/** Le curseur est allumé (il change d'état `clignotementHz` fois par seconde). */
export const curseurAllume = (t: number): boolean => Math.floor(Math.max(0, t) * FRAPPE.clignotementHz) % 2 === 1;

const opaciteMax = (mots: { opacite: number }[]) => mots.reduce((m, x) => Math.max(m, x.opacite), 0);
const poseDe = (textes: TextePose[], nom: string) => textes.find((x) => x.nom === nom);

export function planAppelMot(p: ProprietesAppelMot, image: number) {
  const t = instant(image, p.fps);
  const tVideo = t + p.debutMs / 1000;
  const mise = disposer(p);
  const ev = (cible: string, defaut: number) => heureEvenement(p, cible) ?? defaut;
  const debutFrappe = ev("mot", DEBUTS_APPEL_MOT.frappe);
  const motCapitales = enCapitales(sansBalises(p.mot));
  const nTapees = lettresTapees(motCapitales, t - debutFrappe);
  const lettres = [...motCapitales].slice(0, nTapees).join("");

  const poseEtiquette = poseDe(mise.textes, "etiquette");
  const poseInvite = poseDe(mise.textes, "invite")!;
  const poseMot = poseDe(mise.textes, "mot")!;
  const poseSuite = poseDe(mise.textes, "suite")!;
  const boiteChamp: BoitePx = mise.boites.objets.find((o) => o.nom === "champ")!.boite;

  const ecouleInvite = t - ev("invite", DEBUTS_APPEL_MOT.invite);
  const ecouleSuite = t - ev("suite", DEBUTS_APPEL_MOT.suite);
  const invite = planMotParMot(poseInvite.texte, ecouleInvite, PAS_MOTS_S);
  const suite = planMotParMot(poseSuite.texte, ecouleSuite, PAS_MOTS_S);
  const entreeChamp = c01(progres(t, ev("champ", DEBUTS_APPEL_MOT.champ), 0.35));

  return {
    t,
    tVideo,
    fond: p.fond,
    entree: planEntreeEcran(p, t),
    marque: poseDe(mise.textes, "marque")!.boite,
    eclair: heureEvenement(p, "eclair"),
    etiquette: poseEtiquette ? { pose: poseEtiquette, ...planEtiquette(p.fond, poseEtiquette, t) } : null,
    invite: { pose: poseInvite, mots: invite, opacite: opaciteMax(invite), ecoule: ecouleInvite, pas: PAS_MOTS_S },
    champ: {
      boite: boiteChamp,
      progres: entreeChamp,
      entree: planEntreeObjet(entreeChamp),
      biais: planBiais(tVideo, BIAIS_CHAMP.rotY, BIAIS_CHAMP.rotX),
      objet: { boite: boiteChamp, t, tVideo, fond: p.fond, textes: [p.mot], tailleTexte: poseMot.taille, plancherTexte: poseMot.plancher, debutFrappeS: debutFrappe } satisfies ProprietesChamp,
    },
    mot: { pose: poseMot, complet: motCapitales, tape: lettres, curseur: curseurAllume(t), tient: poseMot.tient },
    suite: { pose: poseSuite, mots: suite, opacite: opaciteMax(suite), ecoule: ecouleSuite, pas: PAS_MOTS_S },
    /** Textes visibles à cette image (nom de boîte → texte lu à l'écran). */
    textes: {
      marque: p.marque,
      ...(poseEtiquette && poseEtiquette.texte ? { etiquette: sansBalises(poseEtiquette.texte) } : {}),
      ...(opaciteMax(invite) > 0 ? { invite: sansBalises(p.invite) } : {}),
      ...(lettres ? { mot: lettres } : {}),
      ...(opaciteMax(suite) > 0 ? { suite: sansBalises(p.suite) } : {}),
    } as Record<string, string>,
  };
}
