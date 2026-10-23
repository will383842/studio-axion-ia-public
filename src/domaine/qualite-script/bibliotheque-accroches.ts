/**
 * SOCLE QUALITÉ · bibliothèque des structures d'accroche (recherche 2026-2027, section E), PASSÉE AU CRIBLE DU
 * POSITIONNEMENT DE WILL (`docs/ecriture/REGLES-DE-WILL.md`). PUR, donnée seule : elle n'est envoyée à aucun écrivain
 * dans cette version (aucune consigne à Claude ne change).
 *
 * Retirés (contraires au positionnement) : 11 « annonce de la semaine » (nouveauté d'outil), 16 « j'ai testé les deux »
 * (comparaison d'outils), 19 « faites ce test » (le spectateur le fait seul). La règle N13 de la recherche (valeur
 * « emportable » à l'impératif) est réécrite en « voici ce qu'on met en place ».
 * Les `{…}` se remplissent avec des éléments PROUVÉS (preuve validée), jamais inventés.
 */

export interface GabaritAccroche {
  /** Numéro dans la recherche (section E). */
  numero: number;
  type: string;
  gabarit: string;
}

export const GABARITS_ACCROCHE: readonly GabaritAccroche[] = [
  { numero: 1, type: "Chiffre-résultat", gabarit: "{N} heures par semaine. C'est ce que {métier} a récupéré avec {outil}." },
  { numero: 2, type: "Pour qui", gabarit: "Vous dirigez une entreprise de {taille} salariés ? Cette tâche vous coûte {N} €." },
  { numero: 3, type: "Contre-pied", gabarit: "Non, l'IA ne va pas remplacer votre {métier}. Elle va remplacer {tâche}." },
  { numero: 4, type: "Erreur fréquente", gabarit: "La 1re erreur des {cible} avec l'IA : {erreur}." },
  { numero: 5, type: "Liste numérotée", gabarit: "{N} tâches que je confie à l'IA chez mes clients ({cible}). Numéro {N} surprend." },
  { numero: 6, type: "Avant / après", gabarit: "Avant : {durée avant}. Après : {durée après}. Même équipe, même logiciel." },
  { numero: 7, type: "Coût caché", gabarit: "Ce que vous coûte vraiment {tâche manuelle} : {N} € par an." },
  { numero: 8, type: "Question de diagnostic", gabarit: "Combien d'heures votre équipe passe-t-elle à {tâche} ?" },
  { numero: 9, type: "Cas client", gabarit: "{Métier} à {ville}, {taille} salariés. Problème : {problème}." },
  { numero: 10, type: "Test en direct", gabarit: "J'ai donné {tâche} à l'IA. Voici ce qu'elle a fait en {durée}." },
  { numero: 12, type: "Seuil / règle", gabarit: "Si {tâche} vous prend plus de {N} minutes, on l'automatise pour vous." },
  { numero: 13, type: "Faux bon réflexe", gabarit: "Acheter {outil} n'est pas la 1re étape. La 1re, c'est {étape}." },
  { numero: 14, type: "Promesse de méthode", gabarit: "La méthode en {N} étapes pour {résultat} sans {contrainte}." },
  { numero: 15, type: "Aveu / erreur de Will", gabarit: "J'ai fait perdre {N} jours à un client. Voici ce que j'ai appris." },
  { numero: 17, type: "Objection", gabarit: "« L'IA, c'est trop cher pour nous. » Faux : {coût réel}." },
  { numero: 18, type: "Risque", gabarit: "Votre équipe utilise déjà l'IA. Sans règle, voici le risque : {risque}." },
  { numero: 20, type: "Signal de maturité", gabarit: "{N} signes que votre entreprise est prête pour l'IA. Le 3e est rare." },
];

/** Ce qui a été retiré de la recherche, et pourquoi (gardé pour qu'on ne le remette pas). */
export const ECARTES_DE_LA_RECHERCHE: readonly { quoi: string; texte: string; raison: string; remplacement?: string }[] = [
  { quoi: "Gabarit 11 · Actualité + avis", texte: "{Annonce de la semaine}. Pour une PME, ça change une chose.", raison: "Jamais « X vient d'annoncer » ni la nouveauté d'un outil : on parle du bénéfice pour l'entreprise." },
  { quoi: "Gabarit 16 · Comparaison", texte: "{Outil A} ou {outil B} pour {tâche} ? J'ai testé les deux.", raison: "Centré sur les outils et sur le choix que le spectateur ferait seul : ce choix, c'est notre métier." },
  { quoi: "Gabarit 19 · Mini-défi", texte: "Faites ce test en 2 minutes : {test}. Si {résultat}, vous perdez du temps.", raison: "Renvoie le spectateur à le faire lui-même ; jamais « faites-le vous-même »." },
  {
    quoi: "Règle N13 · Valeur « emportable »",
    texte: "Au moins une phrase à l'impératif hors bloc d'appel : le spectateur applique une action dès aujourd'hui.",
    raison: "Conclure sur « faites-le vous-même » est contraire au positionnement : l'entreprise est perdue face à l'IA, nous nous occupons de tout.",
    remplacement: "Montrer ce que nous mettons en place (« voici ce qu'on met en place chez nos clients ») : la valeur reste concrète, la conclusion revient vers nous.",
  },
];
