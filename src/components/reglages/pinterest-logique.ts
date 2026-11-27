import type { EtatComptePinterest } from "@/domaine/chaine-pinterest";

/** Logique pure de la carte « Pinterest » (testée sans écran). Aucun effet sur l'envoi. */
export const TEXTES_PINTEREST = {
  resumeFerme: "Fermé : rien ne part vers Pinterest tant que vous ne l'ouvrez pas",
  resumeOuvert: "Ouvert : les épingles programmées peuvent partir vers Pinterest",
  rappel: "Une épingle : une image 2:3, un titre de 100 signes au plus, une description de 500 signes au plus, un texte alternatif, un tableau et un lien vers votre site.",
  interrupteur: "Envoyer les épingles sur Pinterest",
  ferme: "Fermé : rien ne part vers Pinterest.",
  ouvert: "Ouvert : seules les épingles validées et programmées partent.",
  tourFerme: "Le tour général du calendrier reste fermé à Pinterest : une épingle ne part que par l'essai d'un créneau.",
  tourOuvert: "Le tour général du calendrier envoie aussi les épingles programmées.",
  compteAbsent: "Aucun tableau Pinterest n'est relié pour l'instant : rien ne peut partir.",
  compteDeconnecte: "Le compte Pinterest est déconnecté : reconnectez-le d'abord.",
  compteInconnu: "L'état du compte n'est pas encore connu : utilisez « Tester » dans « Vos comptes de publication ».",
  domaineVide: "Aucun domaine n'est réglé : aucun lien d'épingle ne serait accepté.",
  domaineAide: "Le lien de chaque épingle doit mener à ce domaine exact (https, sans sous-domaine).",
} as const;

export function resumeCartePinterest(actif: boolean): string {
  return actif ? TEXTES_PINTEREST.resumeOuvert : TEXTES_PINTEREST.resumeFerme;
}

export function phraseComptePinterest(c: EtatComptePinterest): string {
  if (c.etat === "relie") return `Compte relié : ${c.tableaux} tableau${c.tableaux > 1 ? "x" : ""} public${c.tableaux > 1 ? "s" : ""}.`;
  if (c.etat === "deconnecte") return TEXTES_PINTEREST.compteDeconnecte;
  if (c.etat === "absent") return TEXTES_PINTEREST.compteAbsent;
  return TEXTES_PINTEREST.compteInconnu;
}

/** L'interrupteur : fermer est toujours possible ; ouvrir exige un compte relié et un domaine. */
export function etatInterrupteurPinterest(e: { enCours: boolean; actif: boolean; compte: EtatComptePinterest; domaine: string }): { desactive: boolean; raison?: string } {
  if (e.enCours) return { desactive: true };
  if (e.actif) return { desactive: false };
  if (e.compte.etat !== "relie") return { desactive: true, raison: `Impossible d'ouvrir : ${phraseComptePinterest(e.compte).replace(/\.$/, "").toLowerCase()}.` };
  if (!e.domaine) return { desactive: true, raison: TEXTES_PINTEREST.domaineVide };
  return { desactive: false };
}
