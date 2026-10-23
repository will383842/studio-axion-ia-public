import type { CasConcret } from "../cas";

/**
 * Cas demandé par Will le 14/10/2026 : le générateur d'articles de blog du site. Faits relevés dans le code du site
 * (dépôt axionia, chemins ci-dessous) et dans sa base de production (lecture seule, 14/10). Écrit par Claude, à valider
 * par Will (« Je valide ce cas »).
 */
export const articlesBlog: CasConcret = {
  id: "articles-blog",
  version: 3,
  offre: "integration",
  nature: "automatisation",
  posture: "chez-nous",
  titre: "Le blog qui s'écrit et se publie tout seul",
  theme: "Blog",
  promesse: "Nos articles s'écrivent et se publient seuls.",
  cible: "Toute entreprise qui veut être trouvée sur Google sans passer ses soirées à écrire.",
  avant: {
    taches: ["Trouver un sujet", "Écrire un long article", "Vérifier qu'on ne se répète pas", "Soigner le référencement", "Chercher une photo libre de droits", "Mettre en ligne"],
    total: "Une demi-journée par article",
  },
  etapes: [
    { titre: "Le sujet", ligne: "Un nouveau sujet est choisi toutes les 15 minutes.", detail: "Il vient d'une réserve de sujets ; les actualités de l'IA sont lues toutes les heures.", visuel: { sorte: "objet", objet: "liste-taches" } },
    { titre: "L'écriture", ligne: "L'IA écrit 900 à 1300 mots.", detail: "Un article complet, avec sa foire aux questions, réécrit sans jamais recopier une source.", visuel: { sorte: "objet", objet: "rapport" } },
    { titre: "Les contrôles", ligne: "Une note sur 100, sur 13 critères.", detail: "Doublons, plagiat, mots interdits : sous 75, l'article est réécrit.", visuel: { sorte: "objet", objet: "bouclier-coche" } },
    { titre: "La photo", ligne: "Une photo libre de droits est choisie.", detail: "Avec le nom du photographe, comme il se doit.", visuel: { sorte: "objet", objet: "carte-taches" } },
    { titre: "La publication", ligne: "Publié entre 8 h et 22 h, puis signalé aux moteurs.", detail: "L'article est en ligne et les moteurs de recherche en sont prévenus.", visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/blog", mouvement: "defilement", repli: "telephone-notification" } },
  ],
  resteHumain: "Relire seulement les articles mis de côté par les contrôles.",
  resteHumainApresEtape: 3,
  resultat: "Le blog grandit chaque jour, sans qu'on écrive une ligne.",
  faits: [
    // Version 3 (15/10, Will) : la CAPACITÉ de l'outil, en premier ; jamais présentée comme le rythme réel (15 par jour).
    { id: "capable-200-articles-par-jour", enonce: "L'outil peut écrire jusqu'à 200 articles par jour.", valeurs: [200], source: "code", preuve: "axionia base : 60 articles créés le 10/09/2026 entre 06:00 et 07:07 (≈ 1 h, 56 publiés), soit une capacité bien au-delà de 200 par jour ; rythme réglé à 15/jour en production (daily_generation_cap = 15 ; plafond de code 20 : anti-burst.ts l.114) — c'est une CAPACITÉ, pas le rythme courant." },
    { id: "sujet-15-minutes", enonce: "Un nouveau sujet est choisi toutes les 15 minutes.", valeurs: [15], source: "code", preuve: "axionia : src/server/queue/queues.ts l.1112-1116 (chef d'orchestre des campagnes, toutes les 15 min)." },
    { id: "article-900-1300-mots", enonce: "L'IA écrit 900 à 1300 mots par article.", valeurs: [900, 1300], source: "code", preuve: "axionia : src/server/content-gen/generators/blog-article.ts l.56 et l.88 (900 à 1300 mots visés)." },
    { id: "note-seo-13-criteres", enonce: "Une note sur 100 est calculée sur 13 critères.", valeurs: [100, 13], source: "code", preuve: "axionia : src/server/content-gen/quality/seo-score.ts l.4-20." },
    { id: "reecrit-sous-75", enonce: "Sous 75 sur 100, l'article est réécrit.", valeurs: [75, 100], source: "code", preuve: "axionia : src/server/queue/workers/content-gen-worker.ts l.133-134 et l.1133-1138 (boucle de réécriture, 2 tentatives au plus)." },
    { id: "photo-libre-de-droits", enonce: "Une photo libre de droits est choisie, avec le nom du photographe.", valeurs: [], source: "code", preuve: "axionia : src/server/content-gen/images/select-hero-image.ts l.5-21 (Unsplash d'abord)." },
    { id: "publication-8h-22h", enonce: "Publié entre 8 h et 22 h, puis signalé aux moteurs.", valeurs: [8, 22], source: "code", preuve: "axionia : content-publish-worker.ts l.140-141 et l.207-227 (8 h-22 h, Paris) ; signalement IndexNow (indexing/enqueue.ts l.181, clé présente en production le 14/10)." },
    { id: "cinq-actualites-par-jour", enonce: "5 actualités de l'IA par jour, réécrites et publiées seules.", valeurs: [5], source: "code", preuve: "axionia : src/server/queue/workers/content-rss-fetch-worker.ts l.251 (5 par défaut) ; base : 4 à 6 par jour du 01 au 07/10/2026." },
    { id: "relecture-mis-de-cote", enonce: "Un humain relit seulement les articles mis de côté par les contrôles.", valeurs: [], source: "code", preuve: "axionia : content-gen-worker.ts l.1126-1127 et l.1199 (file de relecture), l.1150-1159 (publication automatique sinon)." },
  ],
  documentPromis: { nom: "Structure du générateur d'articles", finCadeauId: "fin-if-cadeau-automatisation" },
  mot: "BLOG",
  vigilance: [
    "ARRÊTÉ depuis le 07/10/2026 (crédit OpenAI épuisé) : ne pas publier la vidéo avant que le blog republie.",
    "Ne citer aucun trafic, aucune position Google, aucun nombre de visiteurs.",
    "Ne pas dire « aucun humain » : les articles mis de côté sont relus.",
    "200 = capacité de l'outil (60 articles écrits en ≈ 1 h le 10/09), jamais présenté comme le rythme réel (15/jour).",
  ],
  enServiceVerifie: { le: "2026-10-14", source: "Base du site : publications chaque jour jusqu'au 07/10/2026, puis arrêt (crédit OpenAI épuisé, à recharger par Will)." },
};
