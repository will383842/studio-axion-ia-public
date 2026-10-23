/**
 * FINS DU TABLEAU ANIMÉ, rangées par groupe de réseaux. Une fin dont le code est dans la base 7 de l'Usine en reprend les
 * phrases (`phrasesDeLaBanque`, banque commune : `banque.ts`), jamais recopiées. L'état `validee` reste celui du tableau :
 * ses fins de TikTok et Shorts restent coupées (la sortie de TikTok et Shorts se termine sans appel, PR #170) tant que
 * Will ne les allume pas pour lui. Les lignes non validées dont la phrase n'est pas reprise par la base 7 (« Abonnez-vous
 * pour… », « Commentez {MOT}… », « le lien est en description ») restent des propositions refusées, jamais utilisées.
 * Ton sobre, vouvoiement, ni promesse de gain, ni prix, ni lieu, ni « demain ».
 */
import { phrasesDeLaBanque } from "./banque";
import type { FinTable } from "./types";

export const TABLE_FINS: readonly FinTable[] = Object.freeze(
  [
    { id: "fin-if-abonnement", groupe: "instagram-facebook", type: "abonnement", dit: "Abonnez-vous pour retrouver une astuce de ce genre chaque semaine.", ecran: "Abonnez-vous pour la suite", validee: false },
    { id: "fin-if-enregistrement", groupe: "instagram-facebook", type: "enregistrement", ...phrasesDeLaBanque("fin-if-enregistrement"), validee: false },
    { id: "fin-ty-question", groupe: "tiktok-youtube", type: "question", ...phrasesDeLaBanque("fin-ty-question"), validee: false },
    { id: "fin-ty-commentaire", groupe: "tiktok-youtube", type: "commentaire", dit: "Commentez {MOT} et je vous envoie la méthode en détail.", ecran: "Commentez {MOT}", validee: false },
    { id: "fin-li-envoi", groupe: "linkedin", type: "envoi", dit: "Envoyez cette vidéo à un collègue qui pourrait en avoir l'usage.", ecran: "Envoyez-la à un collègue", validee: false },
    { id: "fin-li-abonnement", groupe: "linkedin", type: "abonnement", dit: "Abonnez-vous pour suivre les prochaines vidéos de la série.", ecran: "Abonnez-vous à la série", validee: false },
    // 11/10 : fin du tableau animé VALIDÉE par le propriétaire, la même phrase pour chaque groupe où l'on commente. La
    // phrase entière déborde du cadre de la fin commune (« commentaire. » seul : 880 px pour 872) : l'écran en garde le
    // début, la phrase dite est la phrase validée.
    { id: "fin-if-mot-envoi", groupe: "instagram-facebook", type: "commentaire", ...phrasesDeLaBanque("fin-if-mot-envoi"), validee: true },
    // 12/10 (décision du propriétaire) : rien n'est envoyé depuis TikTok ni YouTube Shorts ; la fin au mot n'y sert
    // plus (garde-fou en code : `src/services/tableau-fin.ts`). Elle reste pour YouTube (vidéo horizontale), avec la
    // phrase de la base 7 (code du studio : la base 7 n'a pas de fin au mot pour YouTube).
    { id: "fin-ty-mot-envoi", groupe: "tiktok-youtube", type: "commentaire", ...phrasesDeLaBanque("fin-if-mot-envoi"), validee: true, reseaux: ["youtube"] },
    // 14/10 : « fin-li-mot-envoi » RETIRÉE. Rien n'est dit dans une vidéo LinkedIn (Will, 12/10 ; base 7) : le mot va en
    // dernière ligne du texte, Williams répond lui-même. Garde-fou en code : `choisir` (index.ts) et `tableau-fin.ts`.
    // Appel de diagnostic : PROPOSITION, non validée (aucune vidéo ne l'affiche tant que Will ne l'a pas validée).
    { id: "fin-if-diagnostic", groupe: "instagram-facebook", type: "envoi", dit: "Réservez votre appel de diagnostic, le lien est en description.", ecran: "Réservez votre appel de diagnostic", validee: false },
    { id: "fin-ty-diagnostic", groupe: "tiktok-youtube", type: "envoi", dit: "Réservez votre appel de diagnostic, le lien est en description.", ecran: "Réservez votre appel de diagnostic", validee: false },
    { id: "fin-li-diagnostic", groupe: "linkedin", type: "envoi", dit: "Réservez votre appel de diagnostic, le lien est en description.", ecran: "Réservez votre appel de diagnostic", validee: false },
    // TikTok et Shorts : fin SANS promesse d'envoi, PROPOSITION à valider par Will. Une seule phrase pour les deux (le
    // même fichier vertical les sert : l'écran ne peut pas dire « profil » à l'un et « description » à l'autre).
    { id: "fin-ty-lien-profil", groupe: "tiktok-youtube", type: "lien", ...phrasesDeLaBanque("fin-ty-lien-profil"), validee: false, reseaux: ["tiktok", "youtube-shorts"] },
  ].map((f) => Object.freeze(f as FinTable)),
);
