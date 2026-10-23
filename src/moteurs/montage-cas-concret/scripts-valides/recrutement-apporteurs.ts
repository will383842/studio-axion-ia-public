/**
 * SCRIPT VALIDÉ DE « RECRUTEMENT-APPORTEURS » (V4-3) : la v4, validée par Will (`docs/formats/v4-reference/`).
 *
 * ÉCART VOULU avec la v4 d'origine, l'accroche seule (écran 1) : la v4 disait « On recrute nos collaborateurs en… ».
 * L'accroche est celle validée par Will le 18/10/2026 (vidéo v-9b52c1ffadca, « parfaite ») : « Nos collaborateurs, on les
 * recrute en… », qui évite le « euh » de la voix après « recrute ». La règle R03 exige le mot exact de la promesse,
 * « recrute » : il reste dans l'accroche. Les événements du premier écran sont recalés sur les mots de cette accroche.
 *
 * Texte dit : celui de `voix4.json`, MOT POUR MOT (hors l'accroche ci-dessus), sans la fin (« Écrivez PLAN en commentaire… » : la fin vient de la
 * banque des fins, par réseau). Ordre : celui des plans de `v4.html` (ligne `PLANS`) : accroche (s1) → « quinze
 * minutes » (s2) → avant, les 6 tâches sur un plan (s4) → « Alors on a tout automatisé » (s6) → annonce (s7),
 * inscription (s8), e-mails (s9), rendez-vous (s10), rappel (s11), la visio AVANT le contrat (s12, s13), contrat (s14),
 * dossier classé (s16) → résultat (s17) → question (s18). Textes affichés, fonds, avances et mots-repères des
 * animations : ceux des plans (repris de la fiche du banc de V4-1, `outils/v4-fidelite/fiche-v4.ts`).
 */
import type { ScriptValide } from "../script-valide";

export const SCRIPT_V4_RECRUTEMENT: ScriptValide = {
  casId: "recrutement-apporteurs",
  versionCas: 2,
  valideLe: "2026-10-18",
  source: "Vidéo de référence v4 validée par Will (docs/formats/v4-reference/v4.html, voix4.json).",
  ecrans: [
    { type: "accroche", fond: "sombre", texteDit: "Nos collaborateurs, on les recrute en", avanceMs: 0, etiquette: "Recrutement · cas réel", lignes: ["Nos collaborateurs,", "on les recrute", "*en…*"], motOrange: "en…", evenements: [{ cible: "titre-2", surMot: 2, avanceMs: 0 }, { cible: "titre-3", surMot: 5, avanceMs: 0 }] },
    { type: "chiffre", fond: "sombre", eclair: true, texteDit: "quinze minutes. Oui, quinze minutes.", avanceMs: 80, valeur: 15, unite: "minutes", faitId: "visio-quinze-minutes", pastilles: ["0 CV à trier", "0 relance", "0 papier"], variante: "simple", evenements: [{ cible: "unite", surMot: 1, avanceMs: 0 }, { cible: "pastille-1", surMot: 2, avanceMs: 0 }, { cible: "pastille-2", surMot: 2, avanceMs: 0 }, { cible: "pastille-3", surMot: 2, avanceMs: 0 }] },
    {
      type: "liste-avant",
      fond: "ivoire",
      texteDit: "Avant, c'était ça : trier les candidatures, répondre à chacun, relancer, caler un rendez-vous, envoyer le contrat, courir après la signature. Plus d'une heure, pour chaque personne.",
      avanceMs: 100,
      taches: ["Trier les candidatures", "Répondre à chacun", "Relancer", "Caler un rendez-vous", "Envoyer le contrat", "Courir après la signature"],
      total: "+1 H",
      evenements: [{ cible: "tache-1", surMot: 3, avanceMs: 50 }, { cible: "tache-2", surMot: 6, avanceMs: 50 }, { cible: "tache-3", surMot: 9, avanceMs: 50 }, { cible: "tache-4", surMot: 10, avanceMs: 50 }, { cible: "tache-5", surMot: 13, avanceMs: 50 }, { cible: "tache-6", surMot: 16, avanceMs: 50 }, { cible: "total", surMot: 20, avanceMs: 0 }],
    },
    { type: "titre", fond: "sombre", eclair: true, texteDit: "Alors on a tout automatisé. La personne", avanceMs: 100, lignes: ["Alors on a", "tout automatisé."], orange: ["automatisé."], evenements: [{ cible: "titre-2", surMot: 3, avanceMs: 0 }] },
    { type: "etape", fond: "ivoire", texteDit: "voit notre annonce. Elle", avanceMs: 450, numero: 1, total: 6, titre: "L'*annonce*", ligne: "Elle la voit sur Facebook.", visuel: { sorte: "objet", objet: "telephone-capture" }, puces: [], evenements: [] },
    { type: "etape", fond: "ivoire", texteDit: "s'inscrit toute seule, en vingt secondes. Elle", avanceMs: 250, numero: 2, total: 6, titre: "L'*inscription*", ligne: "Toute seule. En vingt secondes.", visuel: { sorte: "ecran", etapeCas: 2, repli: "telephone-notification" }, puces: ["Inscrite"], evenements: [{ cible: "puce-1", surMot: 4, avanceMs: 0 }] },
    { type: "etape", fond: "sombre", texteDit: "reçoit ses e-mails toute seule. Elle", avanceMs: 250, numero: 3, total: 6, titre: "Les *e-mails*", ligne: "Ils partent tout seuls.", visuel: { sorte: "objet", objet: "pile-notifications", textes: ["C'est noté", "Votre échange vous attend"] }, puces: [], evenements: [{ cible: "notification-1", surMot: 0, avanceMs: 50 }, { cible: "notification-2", surMot: 2, avanceMs: 50 }] },
    { type: "etape", fond: "ivoire", texteDit: "choisit elle-même son rendez-vous. Et si elle", avanceMs: 250, numero: 4, total: 6, titre: "Le *rendez-vous*", ligne: "Elle le choisit elle-même.", visuel: { sorte: "ecran", etapeCas: 4, repli: "calendrier", departPage: 0.27 }, puces: ["Réservé sans nous"], evenements: [{ cible: "onde", surMot: 1, avanceMs: 0 }, { cible: "puce-1", surMot: 3, avanceMs: 0 }] },
    { type: "objet", fond: "sombre", texteDit: "oublie, le rappel part tout seul.", avanceMs: 480, titre: "Elle *oublie ?*", ligne: "Le rappel part tout seul.", visuel: { sorte: "objet", objet: "telephone-notification", textes: ["Rappel : notre échange demain à 14:00"] }, evenements: [{ cible: "ligne", surMot: 2, avanceMs: 100 }, { cible: "notification", surMot: 2, avanceMs: 0 }] },
    { type: "etape", fond: "sombre", texteDit: "Nous, on arrive pour la visio. Quinze minutes.", avanceMs: 100, numero: 5, total: 6, titre: "La *visio*", ligne: "Là, c'est nous.", visuel: { sorte: "objet", objet: "chrono", textes: ["15"] }, puces: [], evenements: [{ cible: "chrono", surMot: 6, avanceMs: 0 }] },
    { type: "titre", fond: "sombre", texteDit: "C'est notre seul travail.", avanceMs: 80, lignes: ["Notre seul", "travail."], orange: ["travail."], evenements: [{ cible: "titre-2", surMot: 3, avanceMs: 0 }] },
    { type: "etape", fond: "ivoire", texteDit: "Derrière, le contrat part tout seul. Elle signe sur son téléphone. Et le", avanceMs: 100, numero: 6, total: 6, titre: "Le *contrat*", ligne: "Il part tout seul.", visuel: { sorte: "objet", objet: "contrat-signature" }, puces: ["Envoyé tout seul", "Signé"], evenements: [{ cible: "puce-1", surMot: 3, avanceMs: 0 }, { cible: "signature", surMot: 7, avanceMs: 0 }, { cible: "puce-2", surMot: 10, avanceMs: 0 }] },
    { type: "objet", fond: "sombre", texteDit: "dossier est classé.", avanceMs: 280, titre: "Dossier *classé.*", visuel: { sorte: "objet", objet: "dossier-classe" }, evenements: [{ cible: "classe", surMot: 2, avanceMs: 0 }] },
    { type: "resultat", fond: "ivoire", eclair: true, texteDit: "Résultat : des heures gagnées, à chaque recrutement. Et", avanceMs: 100, titre: "Des heures *gagnées.*", avant: { libelle: "Avant", valeur: 1, faitId: "plus-d-une-heure" }, maintenant: { libelle: "Maintenant", valeur: 15, faitId: "visio-quinze-minutes" }, ligne: "à chaque recrutement", evenements: [{ cible: "barre-maintenant", surMot: 2, avanceMs: 0 }, { cible: "ligne", surMot: 5, avanceMs: 0 }] },
    { type: "question", fond: "sombre", texteDit: "dans votre entreprise, quelle tâche pourrait tourner toute seule ?", avanceMs: 180, lignes: ["Et dans votre", "*entreprise ?*"], question: "Quelle tâche pourrait tourner toute seule ?", evenements: [{ cible: "titre-2", surMot: 2, avanceMs: 0 }, { cible: "question", surMot: 3, avanceMs: 0 }] },
  ],
};
