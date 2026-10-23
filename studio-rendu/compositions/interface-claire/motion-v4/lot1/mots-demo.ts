/**
 * Mots de démonstration (spec § I.1) : phrases d'exemple de chaque fiche, au débit ≈ 3,5 mots/s, avec mots forts (`*MOT*`), chiffres (`#MOT#`) et mots isolés (`_MOT_`).
 * Format texte « temps MOT, temps MOT… » (temps en secondes) converti en `[{ mot, debut, fin, fort }]`. La synchro avec la voix de la prise n'est PAS exacte :
 * les mots sont calés à l'œil sur les éléments (la voix de la prise est celle de Will, qui ne dit pas ces mots).
 */
import type { Mot } from "./commun-lot1";

export function lireMots(texte: string): Mot[] {
  const brut = texte.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
    const [t, ...reste] = s.split(" ");
    let mot = reste.join(" ");
    const fort = /^\*.*\*$/.test(mot) || /^_\*.*\*_$/.test(mot);
    const chiffre = /^#.*#$/.test(mot);
    const seul = /^_.*_$/.test(mot);
    mot = mot.replace(/^_/, "").replace(/_$/, "").replace(/^[*#]/, "").replace(/[*#]$/, "");
    return { mot, debut: parseFloat(t), fort: fort || seul, chiffre, seul };
  });
  return brut.map((m, k) => ({ ...m, fin: k + 1 < brut.length ? brut[k + 1].debut - 0.02 : m.debut + 0.32 }));
}

export const MOTS = {
  EtiquetteTete: lireMots("0.30 SANS, 0.50 ME, 0.65 VANTER, 1.00 MES, 1.20 DEVIS, 1.50 CLAUDE, 1.62 M'A, 1.74 CRÉÉ, 1.90 UNE, 2.02 ÉQUIPE, 2.20 D'AGENTS, 2.42 IA, 2.90 TOUT, 3.05 *SEUL*"),
  Interjection: lireMots("0.10 MAINTENANT, 0.75 REGARDEZ, 1.40 MAIS, 1.70 ATTENTION, 2.40 CE, 2.55 N'EST, 2.75 PAS, 2.95 *FINI*"),
  BadgeCompteur: lireMots("0.15 J'AI, 0.35 ENVOYÉ, 0.65 1 200, 1.00 RELANCES, 1.45 CE, 1.60 MOIS-CI, 1.80 #ZÉRO#, 2.20 OUBLI"),
  BadgeProfil: lireMots("0.30 CLAIRE, 0.55 S'OCCUPE, 0.85 DES, 0.95 RELANCES, 1.30 HUGO, 1.55 FAIT, 1.75 LES, 1.85 DEVIS, 2.30 LÉO, 2.55 CALE, 2.80 LES, 2.90 RENDEZ-VOUS, 3.45 TOUT, 3.65 *SEUL*"),
  LogoOutil: lireMots("0.10 MON, 0.30 PREMIER, 0.55 OUTIL, 0.85 CLAUDE, 1.00 MON, 1.10 RÉDACTEUR, 1.45 LE, 1.60 DEUXIÈME, 1.90 C'EST, 2.00 L'AGENDA, 2.15 MON, 2.27 PLANNING, 2.90 *FIN*"),
  RangeePastilles: lireMots("0.20 VOICI, 0.55 LES, 0.70 6, 0.95 ÉTAPES, 1.35 LA, 1.50 *PREMIÈRE*, 1.85 LA, 2.00 *DEUXIÈME*, 2.30 LA, 2.45 *TROISIÈME*, 2.80 ET, 2.90 AINSI, 3.20 DE, 3.35 SUITE"),
  Equation: lireMots("0.30 SAVOIR-FAIRE, 0.85 PLUS, 1.05 L'IA, 1.45 ÉGALE, 1.70 TEMPS, 2.00 GAGNÉ, 2.60 ET, 2.75 C'EST, 2.95 *TOUT*"),
  MotSaute: lireMots("0.20 TOUT, 0.40 ÇA, 0.60 C'EST, 0.80 DU, 1.00 _TEMPS_, 1.50 ET, 1.70 PLUS, 1.90 DE, 2.05 _DEVIS_, 2.60 À, 2.80 FAIRE"),
};

export const MOTS_ENCHAINEMENT = lireMots([
  "0.00 SANS, 0.20 ME, 0.38 VANTER, 0.65 MES, 0.90 DEVIS, 1.20 REGARDEZ, 1.55 J'AI, 1.75 ENVOYÉ, 2.30 1 200, 2.65 RELANCES, 3.00 CE, 3.10 MOIS-CI, 3.43 #ZÉRO#, 3.80 OUBLI,",
  "4.10 CLAIRE, 4.40 S'OCCUPE, 4.70 DES, 4.80 RELANCES, 5.10 HUGO, 5.40 FAIT, 5.65 LES, 5.75 DEVIS, 6.10 LÉO, 6.40 CALE, 6.65 LES, 6.75 RENDEZ-VOUS,",
  "7.10 CLAUDE, 7.30 MON, 7.37 RÉDACTEUR, 8.00 ET, 8.40 VOICI, 8.60 LES, 8.75 6, 8.95 ÉTAPES, 9.55 *PREMIÈRE*, 9.95 *DEUXIÈME*, 10.30 *TROISIÈME*,",
  "10.80 SAVOIR-FAIRE, 11.10 PLUS, 11.35 L'IA, 11.80 ÉGALE, 12.05 TEMPS, 12.20 GAGNÉ, 12.35 TOUT, 12.45 ÇA, 12.55 SE, 12.63 FAIT, 12.72 _SEUL_, 13.20 PAS, 13.40 DE, 13.55 STRESS, 14.20 ET, 14.40 *VOILÀ*",
].join(" "));
