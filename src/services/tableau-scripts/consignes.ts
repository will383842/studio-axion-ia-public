/**
 * CONSIGNES DU GÉNÉRATEUR DE SCRIPTS DU TABLEAU ANIMÉ — trois appels distincts, chacun avec sa sortie structurée :
 *  (a) l'angle : la douleur, cinq accroches de types différents, une retenue ;
 *  (b) l'écriture selon le GABARIT CADRÉ validé par Will le 15/10 (UNE idée, UN gain, UNE preuve ; six passages :
 *      accroche → douleur (finie par une question) → promesse → CE QUI CHANGE (2 à 3 constats à l'indicatif, lot B1,
 *      décision D1 du 18/10 : plus de tutoriel numéroté) → exemple = promesse tenue → à retenir et appel),
 *      avec le témoin v5 et les scripts refusés en contre-exemples ;
 *  (c) la relecture en spectateur pressé ET en vérificateur : les 3 phrases les plus faibles corrigées (jamais de
 *      réécriture totale ni d'ajout), la grille qui juge la VALEUR, les affirmations justifiées.
 *
 * Source : `docs/formats/tableau-anime-scripts/REGLES.md` (v5 du 18/10) et `exemples-v5/01-continuite.md` (recopiés ici
 * pour être livrés avec le serveur ; `tests/tableau-scripts/consignes.test.ts` vérifie qu'ils ne s'en écartent pas).
 * Modèle d'écriture : Opus, jamais Haiku. Aucun appel ici : on construit les requêtes, le service les envoie. Le socle
 * de Will (charte, style, preuves, ton v4) est ajouté par `client-studio.ts`, par-dessous ces blocs.
 */
import "server-only";
import { z } from "zod";
import type { RequeteClaude } from "@/fournisseurs/claude/client";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import {
  CRITERES_GRILLE,
  MENTION_ILLUSTRATIF,
  NOTE_MINIMALE,
  RESEAUX_SCRIPT,
  RESEAUX_SCRIPT_INFOS,
  SUJET_DE_SERIE,
  TYPES_ACCROCHE,
  schemaAngle,
  schemaEcriture,
  schemaRelecture,
  type AngleScript,
  type DemandeScriptTableau,
  type DureeScript,
  type EcritureScript,
} from "@/domaine/scripts-tableau";
import {
  ACCROCHE_MAX_SEC,
  BORNES_PASSAGES,
  repereConstats,
  CORRECTIONS_MAX_RELECTURE,
  DOULEUR_FIN_MAX_SEC,
  ETAPES_MAX,
  ETAPES_MIN,
  MOTS_SCRIPT,
  dureeVisee,
  type DefautScript,
  type OptionsControles,
  type PassageBorne,
} from "@/domaine/scripts-tableau-controles";
import { ANTI_PATTERNS_SCRIPT, RECETTE_SCRIPT } from "@/donnees/generateur/recette-script";
import { DOULEUR_MAX_TABLEAU, MOTS_DOULEUR_MAX, MOTS_DOULEUR_MIN } from "@/domaine/douleur-tableau";
import { CARACTERES_DITS_MAX_TABLEAU, CARACTERES_PAR_SECONDE_TABLEAU, DEBUT_DOULEUR_SEC, DUREE_MAX_TABLEAU_SEC, caracteresEn } from "@/domaine/duree-tableau";

const virgule = (n: number) => String(n).replace(".", ",");
/** « 40 à 75 s (environ 820 à 1 537 caractères dits) » : la fourchette d'un réseau, en secondes et en caractères. */
const fourchette = (min: number, max: number) => `${min} à ${max} s (environ ${caracteresEn(min)} à ${caracteresEn(max)} caractères dits, espaces compris)`;

/** Modèle des trois passes : Opus (écriture). Haiku est refusé, même par erreur de réglage. */
export const MODELE_SCRIPTS_TABLEAU = MODELE_ECRITURE;
export function verifierModele(modele: string): string {
  if (/haiku/i.test(modele)) throw new Error("Le générateur de scripts du tableau animé n'utilise jamais Haiku.");
  return modele;
}

export type PasseScript = "angle" | "ecriture" | "relecture";

/**
 * Plafond de sortie de chaque passe (pensée comprise) : sert au pire cas du coût. Le script (parties, étapes,
 * affirmations, sources) est long : à 14 000, l'écriture réelle du 15/10 (v-d3e2a726cf0c) a été coupée. Ne pas baisser.
 */
export const MAX_TOKENS: Record<PasseScript, number> = { angle: 6_000, ecriture: 28_000, relecture: 28_000 };

/**
 * Méthode d'écriture (réglage `tableau.methode`, plan socle qualité § 5.4) : « courte » (DÉFAUT depuis le lot A5 : effort
 * moyen, plafonds réduits, recette en cache 1 h partagée par les passes, relance seulement sur un défaut de FORME) ou
 * « complete » (effort élevé, plafonds ci-dessus), à demander explicitement.
 */
export const METHODES_TABLEAU = ["complete", "courte"] as const;
export type MethodeTableau = (typeof METHODES_TABLEAU)[number];
export const PARAM_METHODE_TABLEAU = "tableau.methode";
export const METHODE_PAR_DEFAUT: MethodeTableau = "courte";

/** Une valeur de réglage lue (donnée non sûre) : « complete » seulement si elle est dite exactement ; sinon le défaut (« courte »). */
export function methodeLue(v: unknown): MethodeTableau {
  return v === "complete" ? "complete" : METHODE_PAR_DEFAUT;
}

/**
 * Méthode courte : effort moyen partout ; l'écriture à 20 000 (pas 16 000 : 14 000 avait déjà coupé une écriture), la
 * relance de même, l'angle à 8 000, la relecture à 8 000 (corrections et grille, jamais le script entier).
 */
export const MAX_TOKENS_COURTE: Record<PasseScript, number> = { angle: 8_000, ecriture: 20_000, relecture: 8_000 };
const EFFORT: Record<MethodeTableau, RequeteClaude["effort"]> = { complete: "high", courte: "medium" };
const plafondSortie = (passe: PasseScript, m: MethodeTableau) => (m === "courte" ? MAX_TOKENS_COURTE : MAX_TOKENS)[passe];

/* ------------------------------------------------------------------ */
/* Les règles (REGLES.md, v4 du 15/10), données à chaque passe, en cache */
/* ------------------------------------------------------------------ */

const borne = (d: DureeScript, p: PassageBorne) => `${BORNES_PASSAGES[d][p].repere[0]} à ${BORNES_PASSAGES[d][p].repere[1]} mots`;
/** « 14 à 20 mots » : le repère d'un constat. */
const repereConstat = (d: DureeScript, n = 3) => `${repereConstats(d, n)[0]} à ${repereConstats(d, n)[1]} mots`;
const mots = (d: DureeScript) => `${MOTS_SCRIPT[d].min} à ${MOTS_SCRIPT[d].max} mots`;

/**
 * La recette commune réduite à ce qui ne contredit pas le gabarit du tableau : les éléments 3 à 7 seulement (question,
 * promesse, une idée, preuve, rupture), au vouvoiement. Les éléments 1, 2 et 8 (accroche, douleur, appel) ont d'autres
 * bornes dans le gabarit du tableau ; la ligne « Limites » (mots par seconde) est remplacée par l'estimateur en caractères dits.
 */
const RECETTE_SANS_DEBIT = ["RECETTE COMMUNE (éléments 3 à 7, dans cet ordre) :", ...RECETTE_SCRIPT.split(String.fromCharCode(10)).filter((l) => /^[3-7]\. /.test(l)).map((l) => l.replace(" (vous ou tu)", ""))].join(String.fromCharCode(10));

export const REGLES_TABLEAU = `Vous écrivez pour le format « tableau animé » : une voix montre UN seul changement utile, pendant qu'un crayon écrit des pages sur un tableau. Aucun visage. Vidéo de 60 s (${mots(60)}) ou de 30 s (${mots(30)}). Le texte est en français, au vouvoiement, avec les mots du spectateur.

RÈGLE D'OR : UNE idée, UN gain (avec son unité), UNE preuve.
- UNE idée : tout le script la sert ; « À retenir » la dit en une phrase. Pas quatre idées empilées, pas un règlement intérieur lu à voix haute.
- UN gain, avec son unité (« six lignes au lieu du fil entier », « dix minutes par relance ») : la promesse l'annonce, l'exemple le montre.
- UNE preuve : l'exemple, où la promesse est tenue (avant, maintenant), le gain visible.
Ce qui change se comprend tout de suite, à la première écoute : c'est la valeur de la vidéo. La vidéo ne dicte jamais un tutoriel au spectateur : l'entreprise s'occupe de tout pour lui. Et tout ce qui est dit est vrai. Peu de choses, dites clairement, valent mieux qu'une solution « complète » qui empile.

L'ENTREPRISE NE SE MET JAMAIS EN AVANT ; UN PEU, À LA FIN
La douleur est GÉNÉRALE : une situation que presque tout le monde a vécue. Le CORPS reste NEUTRE : il montre le réflexe et sa valeur, il ne décrit JAMAIS notre façon de travailler ni une prestation (une formation donnée, un formateur, un suivi, un audit commandé, « notre méthode ») et ne parle pas de l'entreprise.
La FIN dit en UNE phrase courte (15 mots au plus) que l'entreprise le met en place pour le spectateur (« [l'entreprise] le met en place pour vous. »), juste après la question sur l'IA (qu'on garde) et juste avant la demande de fin, à part (comme le témoin : « [l'entreprise] met cette fiche en place pour vous. Réservez un appel de diagnostic. »). Elle est LIÉE À L'IDÉE (elle reprend ce que la vidéo montre) et COHÉRENTE avec le corps : jamais « formez-les vous-même » dans le corps puis « nous formons les équipes » à la fin. Jamais de prix, de prestation détaillée ni de promesse chiffrée. Ailleurs, aucune phrase avec le nom de l'entreprise ou son « nous » (nous, notre, nos).
La signature (l'adresse du site) est ajoutée à l'image par le studio : la voix ne prononce JAMAIS l'adresse du site, même à la fin.

LE GABARIT : SIX PASSAGES, TOUJOURS DANS CET ORDRE (repères de mots pour 60 s ; entre parenthèses, 30 s)
1. ACCROCHE (${borne(60, "accroche")} visés, ${BORNES_PASSAGES[60].accroche.refus[1]} mots au plus, dite en ${virgule(ACCROCHE_MAX_SEC)} s au plus ; ${borne(30, "accroche")}) : UNE phrase, lisible sans le son (8 mots affichés au plus) : la situation, avec un chiffre, une contradiction ou pour qui. Exemple : « Le seul qui connaît ce dossier client est en congé. » Pas de question molle, pas de salutation, pas de « dans cette vidéo ».
2. DOULEUR (3,5 à 12 s, ${borne(60, "douleur")} ; ${borne(30, "douleur")}) : une scène vécue et son coût, concret et vrai, qui FINIT PAR UNE QUESTION au spectateur, en « vous » (« Chez vous, qui reprendrait ce dossier ? ») ; accroche et douleur dites en ${DOULEUR_FIN_MAX_SEC} s au plus. Le spectateur se dit « c'est moi ». Chiffrée seulement si la source est sûre, sans exagérer.
3. PROMESSE ET BOUCLE OUVERTE (12 à 17 s, ${borne(60, "promesse")} ; ${borne(30, "promesse")}) : une ou deux phrases. La promesse est le gain pour le spectateur (« Un dossier peut se reprendre en lisant trois lignes. »), SANS annoncer un nombre d'étapes (ni « trois réflexes », ni « cinq gestes ») ; une boucle ouverte facultative crée l'attente (« Reste à savoir qui les écrit. »).
4. CE QUI CHANGE (17 à 37 s) : 2 ou 3 constats à l'INDICATIF (3 par défaut ; 2 ou 3 en 30 s), SANS numéro dit et SANS impératif adressé au spectateur. Chaque constat = l'ACTION (« action » : une phrase dont le sujet est la chose qui change, l'outil ou « on » : « Une automatisation écrit trois lignes dans la fiche. », « Le nom du client devient Client A. ») puis une ou deux phrases CONCRÈTES (« comment » : ce qui est montré, un exemple de contenu, pourquoi). Mots par constat : ${repereConstat(60)} visés, 28 au plus ; en 60 s, avec 2 constats, visez le haut des repères de CHAQUE passage et ${repereConstat(60, 2)} par constat, ${MOTS_SCRIPT[60].min} mots au moins en tout ; avec 3 constats, restez au milieu des repères des passages ; en 30 s, une seule phrase, ${repereConstat(30)} visés (avec 2 constats : ${repereConstat(30, 2)}, passages au milieu de leurs repères), 16 au plus. Aucun constat vague (« Soyez précis », « Pensez à… », une phrase sans sujet ni objet). Un verbe à l'impératif en tête (« Listez… », « Un. Cochez… ») fait refuser le script : c'est un tutoriel.
5. EXEMPLE = LA PROMESSE TENUE (37 à 45 s, ${borne(60, "exemple")} ; ${borne(30, "exemple")}) : un métier, une tâche, l'AVANT (une phrase qui commence par « Avant, ») puis le MAINTENANT (« Maintenant, ») ; le gain y est visible (son unité y est dite). Le métier change d'une vidéo à l'autre (jamais celui des 3 dernières). Le vrai cas fourni s'il existe ; sinon l'écran porte « ${MENTION_ILLUSTRATIF} ».
6. À RETENIR ET APPEL (45 à 53 s, ${borne(60, "fin")} ; ${borne(30, "fin")}) : « aRetenir » = l'IDÉE en UNE phrase qui ne reprend pas les mots de l'accroche (jamais une liste de verbes, jamais « À retenir : demandez, écrivez, refaites, coupez ») ; puis la QUESTION SUR L'IA (ci-dessous) ; puis la phrase sur l'entreprise (elle le met en place), liée à l'idée ; puis UNE seule demande (commenter un mot, OU réserver un appel de diagnostic). La dernière phrase fait 2 à 5 mots, affirme et ferme : jamais de virgule, jamais de question. « Réservez un appel de diagnostic. » peut être cette dernière phrase.
QUESTION SUR L'IA : la formulation donnée dans <question_ia>, MOT POUR MOT, en une phrase à part de « appel », dite juste AVANT la phrase sur l'entreprise, qui y répond concrètement (« En quoi l'IA peut-elle vous aider ? [l'entreprise] le met en place pour vous. Réservez un appel de diagnostic. »). Elle est DITE, jamais écrite : son « ecran » est une chaîne vide. Jamais en dernière phrase, aucune autre question à la fin ; elle n'est pas comptée dans les bornes de mots.
Le script entier fait ${mots(60)} pour 60 s, ${mots(30)} pour 30 s. Les repères sont des guides (passages et constats) : seul le TOTAL de mots du script fait refuser (hors de la borne ci-dessus) ; un passage n'est refusé qu'à l'extrême (accroche de plus de ${BORNES_PASSAGES[60].accroche.refus[1]} mots, douleur de plus de ${BORNES_PASSAGES[60].douleur.refus[1]}, etc.) ; entre le repère et cette limite, c'est une remarque.

CLARTÉ (éliminatoire)
- Jamais le mot « problème » (ni dit, ni écrit à l'écran), jamais « le vrai problème », jamais de retournement.
- Aucune formule creuse : « votre parole est en jeu », « le bon geste », « la clé du succès », « changer la donne », « faire la différence », « tout simplement », « n'attendez plus », « incontournable », « un levier », « gagner en efficacité », « les bonnes pratiques ». Dites le fait concret à la place.
- Pas de jargon : « entraînement », « paramètres », « nettoyer », « le modèle », « prompt », les sigles techniques. Dites ce que le spectateur voit et dit lui-même (« selon les réglages, l'outil peut s'en servir pour s'entraîner »).
- Rien ne se répète : aucune phrase dite deux fois, aucune suite de 3 mots dite deux fois ; « à retenir » ne redit ni la clôture, ni les mots de l'accroche, ni les verbes des constats ; le résultat de l'exemple ne redit pas l'accroche.
- Les nombres se tiennent : un nombre de l'accroche n'est pas contredit par l'exemple.

VÉRITÉ (éliminatoire)
- Aucune affirmation absolue invérifiable : « rien n'est sorti », « rien ne sort », « aucun risque », « 100 % », « en toute sécurité », « totalement anonyme », « garanti », « plus jamais » sont refusés par le programme. « Toujours » et « jamais » ne sont permis que dans une consigne ou un fait réellement vrai.
- Aucun chiffre sans source : seulement les chiffres des preuves validées (<preuves>), déclarés dans « sources » ; un chiffre de l'exemple illustratif reste dans l'exemple.
- Aucun fait juridique approximatif. RGPD : formulations prudentes et exactes (« selon les réglages », « s'il cite des personnes ») ; jamais « conforme au RGPD », « c'est illégal », « la loi interdit » sans le texte exact.
- Des conseils exacts et sûrs. Retirer ce qui identifie = les noms, adresses, téléphones, e-mails, numéros (compte, dossier, sécurité sociale) et tout détail qui suffit à reconnaître quelqu'un.
- « affirmations » : chaque affirmation de fait, et chaque phrase qui porte un mot absolu ou juridique (jamais, toujours, rien, aucun, personne ne, tout le monde, forcément, obligatoire, interdit, légal, loi, RGPD, CNIL, amende, sanction, sécurisé, anonyme, confidentiel, conforme), relevée avec l'extrait exact tel qu'il est dit, sa nature (fait, consigne, exemple) et POURQUOI elle est vraie ou sûre. Une phrase non justifiée fait refuser le script.

LES QUATRE SÉRIES (le sujet parle de l'activité, sans jamais la vendre)
- formation : ${SUJET_DE_SERIE.formation.parleDe}. Question du spectateur : ${SUJET_DE_SERIE.formation.question} Il apprend : ${SUJET_DE_SERIE.formation.apprend}.
- audit : ${SUJET_DE_SERIE.audit.parleDe}. Question du spectateur : ${SUJET_DE_SERIE.audit.question} Il apprend : ${SUJET_DE_SERIE.audit.apprend}.
- automatisations : ${SUJET_DE_SERIE.automatisations.parleDe}. Question du spectateur : ${SUJET_DE_SERIE.automatisations.question} Il apprend : ${SUJET_DE_SERIE.automatisations.apprend}.
- coaching : ${SUJET_DE_SERIE.coaching.parleDe}. Question du spectateur : ${SUJET_DE_SERIE.coaching.question} Il apprend : ${SUJET_DE_SERIE.coaching.apprend}.

INTERDITS DANS LE TEXTE DIT (vérifiés par un programme : un seul suffit à refuser le script)
Le nom de l'entreprise ou son « nous » hors de la phrase courte de fin ; l'adresse du site ; « notre formation », « nos formations », « notre équipe », « nos clients », « contactez-nous » ; « aucun gain garanti » ; tout prix, tarif, euro ou symbole € ; une durée de prestation ; « demain » ; les mots vagues « optimiser », « booster », « révolutionner » ; le tutoiement ; « likez » ; « problème » ; les formules creuses ; un faux client présenté comme vrai ; tout chiffre statistique (pourcentage, « un sur deux », « trois fois plus », « en moyenne », « selon une étude ») sans source déclarée dans « sources ».

CONTRAINTES MESURÉES PAR LE PROGRAMME
- Aucune phrase dite de plus de 18 mots. Phrases courtes, rythmées, faciles à dire.
- Pour chaque phrase : le texte dit, et 2 à 6 mots écrits à l'écran (des mots-clés, pas la phrase recopiée).
- Un constat dit 22 mots au plus d'une traite (au-delà, la scène est coupée : remarque) ; l'écran ne reprend jamais 80 % des mots de la phrase dite ou plus (3 mots au moins) : remarque.
- « idee » : l'idée du script en une phrase (celle que « aRetenir » dit). « gain » : « formule » (le gain en quelques mots) et « unite » (un mot de la formule : « lignes », « minutes ») ; la promesse reprend au moins un mot de la formule, l'exemple dit l'unité. « metierExemple » : le métier de l'exemple, en un ou deux mots.
- Durée estimée sur la cible de la voix (à mesurer ; ${virgule(CARACTERES_PAR_SECONDE_TABLEAU)} caractères dits par seconde, espaces compris) : en 60 s, dans la fourchette du réseau ; en 30 s, 20 à 40 s ; jamais plus de ${DUREE_MAX_TABLEAU_SEC} s (${CARACTERES_DITS_MAX_TABLEAU} caractères dits au plus) :
${RESEAUX_SCRIPT.map((r) => `  - ${r} (${RESEAUX_SCRIPT_INFOS[r].libelle}, ${RESEAUX_SCRIPT_INFOS[r].dimensions}) : ${fourchette(RESEAUX_SCRIPT_INFOS[r].dureeMin, RESEAUX_SCRIPT_INFOS[r].dureeMax)}, accroche ${RESEAUX_SCRIPT_INFOS[r].accroche.toLowerCase()}.`).join("\n")}
- La douleur (passe 1) tient en ${DOULEUR_MAX_TABLEAU} caractères au plus.
- « motsDouleur » : ${MOTS_DOULEUR_MIN} à ${MOTS_DOULEUR_MAX} mots (ou courtes expressions) qui portent la douleur, recopiés MOT POUR MOT de l'accroche dite ; l'un d'eux est dit dans les ${DEBUT_DOULEUR_SEC} premières secondes (les ${caracteresEn(DEBUT_DOULEUR_SEC * 0.8)} premiers caractères de l'accroche). Ce sont eux que le crayon écrit et entoure au début de la vidéo.

VARIANTES PAR RÉSEAU
Le script principal est écrit pour le réseau demandé. Les variantes en sont dérivées : on raccourcit une phrase concrète d'une étape ou l'exemple, JAMAIS un passage entier ; on adapte le ton de l'accroche au réseau ; on garde la même idée, le même gain et la même action demandée. Chaque variante respecte les interdits, la vérité et la fourchette de durée de son réseau.

CE QUE LE PROPRIÉTAIRE NE VEUT JAMAIS (éliminatoire)
- Jamais conclure par « faites-le vous-même » (ni « à vous de jouer », « faites-le seul ») : l'entreprise s'occupe de tout. Aucune consigne à l'impératif adressée au spectateur avant l'appel : le corps montre ce qui change, la fin dit qu'on le met en place.
- Jamais « cet outil vient de sortir », « nouvel outil », « [une marque] vient d'annoncer » : on n'annonce pas l'actualité d'un outil.
- Une vidéo = UNE cible : TPE, PME, ETI ou grand groupe, une seule ; jamais deux tailles d'entreprise mélangées dans le même script.

GRILLE DE QUALITÉ : elle juge la VALEUR (une idée, un gain, la clarté), pas seulement la conformité. Un script sous ${NOTE_MINIMALE} sur 10, ou qui échoue à un critère éliminatoire, n'est pas montré.
${CRITERES_GRILLE.map((c) => `- [${c.id}] ${c.libelle}${c.eliminatoire ? " — ÉLIMINATOIRE" : ""}`).join("\n")}

RECETTE COMMUNE À TOUS LES SCRIPTS (rappel, partie fixe) : le tableau l'applique en six passages (ci-dessus) ; si un chiffre ou un nombre de mots diffère, le gabarit du tableau prime.
${RECETTE_SANS_DEBIT}
${ANTI_PATTERNS_SCRIPT}`;

/* ------------------------------------------------------------------ */
/* Le script témoin (exemples-v4/01-formation.md) et le contre-exemple */
/* ------------------------------------------------------------------ */

/**
 * Le script témoin v5 (lot B1, décision D1 de Will du 18/10 : « oui »), passage par passage, recopié mot pour mot de
 * `exemples-v5/01-continuite.md`. Il remplace le témoin du 15/10 (« devis collé dans ChatGPT »), un tutoriel numéroté à
 * l'impératif. La phrase sur l'entreprise y est remplacée par sa description (les consignes ne nomment pas l'entreprise :
 * le socle de Will le fait) ; la question sur l'IA y est signalée, sa formulation est donnée dans <question_ia>.
 */
export const SCRIPT_TEMOIN = `Script témoin (« Automatisations », TikTok/Reels, fin : appel de diagnostic, 150 mots question sur l'IA comprise, 144 hors question, environ 53 s ; chaque passage et chaque constat est dans son repère). Sujet : un dossier client qui se reprend sans appeler le collègue absent.
Idée : Une fiche tenue à jour remplace l'appel au collègue absent.
Gain : trois lignes à lire au lieu de fouiller la boîte mail (unité : lignes). Métier de l'exemple : cabinet comptable.

ACCROCHE (10 mots)
Le seul qui connaît ce dossier client est en congé.

DOULEUR (25 mots, elle finit par une question au spectateur)
Un client appelle. On fouille la boîte mail du collègue. Puis on l'appelle en congé. Le client s'en aperçoit. Chez vous, qui reprendrait ce dossier ?

PROMESSE ET BOUCLE OUVERTE (15 mots, aucun nombre d'étapes)
Un dossier peut se reprendre en lisant trois lignes. Reste à savoir qui les écrit.

CE QUI CHANGE (3 constats à l'indicatif de 18, 15 et 16 mots, aucun numéro dit, aucun impératif)
Constat 1 — action : Une automatisation écrit trois lignes dans la fiche. — comment : Elles disent où en est le dossier, et la suite.
Constat 2 — action : Le collègue n'est plus dérangé en congé. — comment : On ne fouille plus l'historique de ses mails.
Constat 3 — action : Le client ne répète plus son histoire. — comment : On connaît déjà sa demande, avant même de décrocher.

EXEMPLE = LA PROMESSE TENUE (à l'écran : « Exemple illustratif »)
Prenons un cabinet comptable. Avant, l'assistante cherchait partout, puis appelait le collègue absent. Maintenant, elle lit trois lignes et prépare la suite.

À RETENIR ET APPEL
Une fiche tenue à jour remplace l'appel au collègue absent.
[La question sur l'IA donnée dans <question_ia>, mot pour mot, dite sans rien à l'écran.]
[Une phrase de 8 mots sur l'entreprise, liée à l'idée : elle met cette fiche en place pour vous.] Réservez un appel de diagnostic.

Pourquoi il est validé (à reproduire) :
- UNE idée (une fiche à jour remplace l'appel), dite en une phrase à la fin, sans reprendre les mots de l'accroche.
- UN gain avec son unité : trois lignes à lire au lieu de fouiller la boîte mail.
- La douleur finit par une question au spectateur (« Chez vous, qui reprendrait ce dossier ? ») ; la promesse ne dit aucun nombre d'étapes.
- Chaque constat est à l'indicatif, son sujet est la chose qui change (« Une automatisation écrit trois lignes dans la fiche. », « Le client ne répète plus son histoire. »), puis une phrase concrète. Aucun numéro dit, aucun impératif adressé au spectateur.
- L'exemple est la promesse tenue : avant l'assistante cherchait partout, maintenant elle lit trois lignes ; un métier nouveau.
- La phrase sur l'entreprise vient juste après la question sur l'IA, reprend l'idée (« cette fiche ») et ne contredit pas le corps.
- Aucun chiffre statistique ; la seule affirmation de fait est justifiée.`;

/** Le script du 15/10 (v-d3e2a726cf0c, noté 10 sur 10 par l'ancienne relecture), DÉCRIT avec ses défauts. */
export const CONTRE_EXEMPLES = `Les scripts refusés. D'abord le script de la vidéo du 15/10 (autre sujet que le témoin) : il a été jugé par le propriétaire « catastrophique, pas clair, valeur brouillon et pas sérieuse, structure pas cadrée », alors que l'ancienne relecture l'avait noté 10 sur 10. Ses défauts, à ne plus jamais reproduire :
1. 256 mots (environ 76 s) et QUATRE idées empilées (lister ce qui sort, une règle d'une page, refaire une tâche, un réglage de l'outil) : « un règlement intérieur lu à voix haute ».
2. Aucun gain chiffré, aucune attente ouverte ; l'idée forte (retirer ce qui identifie le client) enterrée à l'étape 2.
3. Des étapes de trois phrases chacune : « Un. Demandez à chacun ce qu'il confie déjà à l'IA. Sans reproche, par écrit : la tâche, l'outil, ce qui est collé. Vous avez une première liste de ce qui sort, et vers où. »
4. Du jargon (« entraînement », « modèle », « paramètres », « nettoyée ») et des formules creuses (« votre parole est en jeu », « le bon geste »).
5. Une fin qui récite des verbes : « À retenir : demandez, écrivez la règle, refaites ensemble, coupez l'entraînement. »
6. Un appel qui contredit le corps : « Voici comment les former vous-même » puis « [l'entreprise] forme les équipes à l'IA ».
7. Un exemple chez un plombier, le métier de 5 scripts sur 11.
8. v-365dd2ae67ee (18/10) : trois étapes dictées « Un. Listez… Deux. Cochez… Trois. Écrivez… », tutoriel à refaire seul, aucune question au spectateur, résultat qui répète l'accroche, ≈ 22 caractères/s.
Deux scripts plus anciens avaient été refusés pour une autre raison : ils décrivaient la FAÇON DE TRAVAILLER DE L'ENTREPRISE (une formation donnée par un formateur, « notre méthode ») au lieu de montrer un réflexe utile qui se comprend tout de suite.`;

/* ------------------------------------------------------------------ */
/* La demande, mise en forme pour le modèle                            */
/* ------------------------------------------------------------------ */

export function demandeEnTexte(d: DemandeScriptTableau): string {
  const serie = SUJET_DE_SERIE[d.serie];
  const reseau = RESEAUX_SCRIPT_INFOS[d.reseau];
  const lignes = [
    `<demande>`,
    `Série : ${d.serie} (le sujet parle de : ${serie.parleDe.toLowerCase()} ; question du spectateur : ${serie.question})`,
    `Sujet : ${d.sujet}`,
    `Public : ${d.public}`,
    `Réseau principal : ${d.reseau} — ${reseau.libelle}, ${fourchette(reseau.dureeMin, reseau.dureeMax)}`,
    `Durée visée : ${dureeVisee(d)} s (${MOTS_SCRIPT[dureeVisee(d)].min} à ${MOTS_SCRIPT[dureeVisee(d)].max} mots ; ${dureeVisee(d) === 30 ? "2 ou 3 constats « ce qui change »" : `${ETAPES_MIN} à ${ETAPES_MAX} constats « ce qui change », 3 par défaut`})`,
    d.fin.type === "commentaire"
      ? `Fin : le spectateur écrit le mot « ${d.fin.mot} » en commentaire (une seule action).`
      : `Fin : le spectateur réserve un appel de diagnostic (une seule action, aucun prix, aucune durée de prestation).`,
    `Ce qui sera envoyé : ${d.envoi}`,
    d.vraiCas
      ? `Vrai cas à utiliser dans l'exemple (ne rien inventer au-delà) : métier ${d.vraiCas.metier} ; tâche ${d.vraiCas.tache} ; avant : ${d.vraiCas.avant} ; après : ${d.vraiCas.apres} ; date : ${d.vraiCas.date}.`
      : `Aucun vrai cas : l'exemple est illustratif, l'écran porte « ${MENTION_ILLUSTRATIF} », et aucun client n'est présenté comme réel.`,
    `</demande>`,
  ];
  return lignes.join("\n");
}

/* ------------------------------------------------------------------ */
/* Consignes propres à chaque passe                                    */
/* ------------------------------------------------------------------ */

export const CONSIGNE_ANGLE = `PASSE 1 SUR 3 : CHERCHER L'ANGLE.
1. Formulez la question que le spectateur se pose sur ce sujet (l'angle), jamais une offre.
2. Formulez la DOULEUR : la conséquence concrète et vraie pour le spectateur (un client, un secret, sa parole, son temps, son argent), qu'il reconnaîtra (« c'est moi ») : une phrase au vouvoiement, ${DOULEUR_MAX_TABLEAU} caractères au plus, avec les mots que l'accroche dira. Sans exagérer, sans chiffre non sourcé.
3. Proposez CINQ accroches, une de chaque type : ${TYPES_ACCROCHE.join(", ")}. Chacune dit la douleur ou son résultat, en UNE phrase. Pour chacune : le texte dit, les mots affichés (8 au plus), et pourquoi elle peut marcher ici. Une accroche « chiffre-vrai » n'utilise qu'un chiffre des preuves validées ; sinon, dites-le dans « pourquoi ».
4. Retenez celle qui se comprend sans le son en moins de 3 secondes et qui fait dire « c'est moi » (« retenue » : son rang, de 0 à 4) ; donnez la raison en une ou deux phrases.
Répondez uniquement par l'objet JSON demandé.`;

export const CONSIGNE_ECRITURE = `PASSE 2 SUR 3 : ÉCRIRE.
D'abord, décidez en une phrase l'IDÉE (« idee ») et le GAIN (« gain » : « formule » et « unite »). Puis écrivez le gabarit, passage par passage, phrase par phrase. Pour chaque phrase : « dit » (le texte prononcé) et « ecran » (2 à 6 mots écrits par le crayon). Partez de l'accroche retenue. Comptez vos mots : chaque passage et chaque constat dans son repère (un guide), le script entier dans sa borne (le seul plafond qui refuse).
- « accroche » : UNE phrase. « douleur » : la scène vécue et son coût, en phrases courtes, qui FINIT PAR UNE QUESTION au spectateur (en « vous »). « promesse » : une ou deux phrases, le gain pour lui, SANS annoncer un nombre d'étapes, puis une boucle ouverte facultative.
- « etapes » (les constats « ce qui change ») : ${ETAPES_MIN} à ${ETAPES_MAX} (3 par défaut ; 2 ou 3 en 30 s ; le nombre que demande le sujet, jamais plus), SANS numéro dit. « action » : un constat à l'indicatif (sujet : la chose qui change, l'outil ou « on »), jamais un impératif adressé au spectateur ; il devient le titre de la page. « comment » : une ou deux phrases concrètes (une seule en 30 s). Pas de « resultat ».
- « exemple » : la situation, l'avant (« Avant, … »), puis le maintenant (« Maintenant, … ») : la promesse tenue, le gain visible (son unité dite). « exemple.mentionEcran » : « ${MENTION_ILLUSTRATIF} » s'il n'y a pas de vrai cas, sinon une chaîne vide. « metierExemple » : son métier, différent de ceux des scripts récents s'ils sont donnés (<metiers_recents>).
- « aRetenir » : l'idée en UNE phrase, sans reprendre les mots de l'accroche. « appel » : la question sur l'IA (si <question_ia> est donnée), la phrase sur l'entreprise « [l'entreprise] le met en place pour vous » (liée à l'idée, cohérente avec le corps), puis la demande ; la dernière phrase fait 2 à 5 mots, affirmative, sans virgule.
- « motsDouleur » : ${MOTS_DOULEUR_MIN} à ${MOTS_DOULEUR_MAX} mots de la douleur, recopiés mot pour mot de l'accroche dite (même orthographe), l'un d'eux dans ses premiers mots.
- « sources » : chaque chiffre statistique dit, avec l'extrait exact tel qu'il est dit et sa source dans les preuves validées. Sans source certaine, n'utilisez pas le chiffre.
- « affirmations » : chaque affirmation de fait, et chaque phrase qui porte un mot absolu ou juridique, avec l'extrait exact, sa nature et pourquoi elle est vraie ou sûre.
- « variantes » : une variante par AUTRE réseau que le réseau principal (texte dit complet, ce qui change).
- « aPreparer » : tout ce qui doit exister avant publication (le document envoyé à ceux qui commentent, la page, la source d'un chiffre, le lien de l'appel, un réglage d'outil à revérifier).

Inspirez-vous du script témoin ci-dessous pour le CADRE (une idée, un gain, une preuve, les bornes de mots), la clarté, la prudence des affirmations et l'effacement de l'entreprise ; ne le recopiez pas. Les scripts refusés disent ce qu'il ne faut plus faire, en particulier le tutoriel numéroté à l'impératif.
Répondez uniquement par l'objet JSON demandé.`;

export const CONSIGNE_RELECTURE = `PASSE 3 SUR 3 : RELIRE EN SPECTATEUR PRESSÉ, ET EN VÉRIFICATEUR.
Lisez le script comme quelqu'un qui fait défiler son fil, le son coupé, puis le son remis. Soyez exigeant : vous êtes le dernier filtre avant le propriétaire. Vous CORRIGEZ, vous ne réécrivez pas.
1. CORRECTIONS (« corrections ») : les ${CORRECTIONS_MAX_RELECTURE} phrases les plus FAIBLES au plus (floue, creuse, jargon, trop longue, inexacte, qui ne sert pas l'idée), chacune remplacée par UNE phrase meilleure. « avant » : la phrase dite, recopiée MOT POUR MOT ; « apres » : la nouvelle phrase ; « ecran » : ses 2 à 6 mots à l'écran ; « pourquoi » : en quelques mots. JAMAIS de réécriture totale, JAMAIS d'ajout (ni phrase, ni étape, ni idée) : le programme n'applique que ${CORRECTIONS_MAX_RELECTURE} remplacements de phrases existantes et écarte le reste. Une phrase juste se garde : une liste vide est permise.
2. VÉRITÉ : vérifiez chaque affirmation de fait (et chaque consigne absolue) du texte corrigé ; dans « affirmations », relevez celles qui manquent au relevé de l'écriture, avec pourquoi elles sont vraies ou sûres. Une affirmation fausse ou invérifiable se corrige (point 1).
3. GRILLE : notez chaque critère sur le texte CORRIGÉ (« respecte » vrai ou faux, et une remarque concrète). Jugez la VALEUR, pas seulement la conformité : y a-t-il UNE idée ? un gain concret, avec son unité, que l'exemple montre ? est-ce clair à la première écoute ? Un critère douteux est faux. Un 10 sur 10 se mérite.
4. FAIBLESSES (« faiblesses ») : ce qui reste faible après vos corrections (plusieurs idées, gain absent ou vague, promesse non tenue, étape floue, jargon, formule creuse, répétition, fin qui récite des verbes, phrase sur l'entreprise qui contredit le corps, tutoriel, aucune question au spectateur, À retenir qui redit l'accroche).
5. MANQUES (« manques ») : ce qui manquerait ENCORE pour comprendre le réflexe. Laissez la liste vide seulement si rien ne manque (une liste non vide refuse le script).
Répondez uniquement par l'objet JSON demandé.`;

/* ------------------------------------------------------------------ */
/* Sortie structurée                                                   */
/* ------------------------------------------------------------------ */

/** Contraintes refusées par la sortie structurée : le code les vérifie après coup. */
const CLES_REFUSEES = new Set(["$schema", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "maxItems", "pattern"]);

function nettoyer(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(nettoyer);
  if (!x || typeof x !== "object") return x;
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(x)) {
    if (CLES_REFUSEES.has(k)) continue;
    if (k === "minItems" && typeof v === "number" && v > 1) continue;
    o[k] = k === "properties" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([p, s]) => [p, nettoyer(s)])) : nettoyer(v);
  }
  return o;
}

/** Schéma JSON envoyé pour la sortie structurée (objets fermés, contraintes non prises en charge retirées). */
export function schemaPourClaude(schema: z.ZodType): Record<string, unknown> {
  return nettoyer(z.toJSONSchema(schema, { io: "output" })) as Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Les trois requêtes                                                  */
/* ------------------------------------------------------------------ */

/**
 * Complète : comme avant (l'angle sans le témoin). Courte : les MÊMES blocs pour les trois passes (règles, témoin et
 * contre-exemple), le dernier marqué « 1h » : la recette entière est mise en cache 1 h et relue d'une passe à l'autre
 * (`roleDeRequete` en tire `cacheRecette`).
 */
function systeme(consigne: string, avecModele: boolean, methode: MethodeTableau = METHODE_PAR_DEFAUT): RequeteClaude["systeme"] {
  if (methode === "courte") {
    return [{ texte: `<regles>\n${REGLES_TABLEAU}\n</regles>` }, { texte: `<script_temoin>\n${SCRIPT_TEMOIN}\n</script_temoin>\n\n<scripts_refuses>\n${CONTRE_EXEMPLES}\n</scripts_refuses>`, cache: "1h" }, { texte: consigne }];
  }
  return [
    { texte: `<regles>\n${REGLES_TABLEAU}\n</regles>`, cache: true },
    ...(avecModele ? [{ texte: `<script_temoin>\n${SCRIPT_TEMOIN}\n</script_temoin>\n\n<scripts_refuses>\n${CONTRE_EXEMPLES}\n</scripts_refuses>`, cache: true }] : []),
    { texte: consigne },
  ];
}

export function requeteAngle(d: DemandeScriptTableau, methode: MethodeTableau = METHODE_PAR_DEFAUT): RequeteClaude {
  return {
    modele: verifierModele(MODELE_SCRIPTS_TABLEAU),
    maxTokens: plafondSortie("angle", methode),
    effort: EFFORT[methode],
    systeme: systeme(CONSIGNE_ANGLE, false, methode),
    messages: [{ role: "user", contenu: demandeEnTexte(d) }],
    schema: schemaPourClaude(schemaAngle),
  };
}

function angleEnTexte(a: AngleScript): string {
  const r = a.accroches[a.retenue];
  return [`<angle>`, `Question du spectateur : ${a.angle}`, `Douleur : ${a.douleur}`, `Accroche retenue (${r.type}) : ${r.dit} — à l'écran : ${r.ecran}`, `Raison : ${a.raison}`, `</angle>`].join("\n");
}

/**
 * Écriture ; avec `defauts` et `precedente` : la relance unique, qui corrige la liste précise des défauts. `options` :
 * les métiers des exemples des scripts récents, à ne pas reprendre. `memoire` : le bloc de la mémoire commune (partie variable).
 */
export function requeteEcriture(d: DemandeScriptTableau, a: AngleScript, relance?: { defauts: readonly DefautScript[]; precedente: EcritureScript }, options: OptionsControles = {}, methode: MethodeTableau = METHODE_PAR_DEFAUT, memoire?: string): RequeteClaude {
  const morceaux = [demandeEnTexte(d), angleEnTexte(a)];
  if (options.metiersRecents?.length) morceaux.push(`<metiers_recents>\nMétiers des exemples des derniers scripts (à ne pas reprendre) : ${options.metiersRecents.join(", ")}.\n</metiers_recents>`);
  if (options.questionIa) morceaux.push(`<question_ia>\n${options.questionIa}\n</question_ia>`);
  // Mémoire d'écriture commune (réglage coupé par défaut) : dans le message (partie VARIABLE), jamais dans le cache du système.
  if (memoire?.trim()) morceaux.push(`<memoire_ecriture>\n${memoire.trim()}\n</memoire_ecriture>`);
  if (relance) {
    morceaux.push(
      `<version_refusee>\n${JSON.stringify(relance.precedente)}\n</version_refusee>`,
      `<defauts_a_corriger>\nLe programme de contrôle a refusé cette version. Corrigez CHACUN de ces défauts, sans en créer d'autres, et rendez la version complète :\n${relance.defauts.map((x) => `- ${x.message}`).join("\n")}\n</defauts_a_corriger>`,
    );
  }
  return {
    modele: verifierModele(MODELE_SCRIPTS_TABLEAU),
    maxTokens: plafondSortie("ecriture", methode),
    effort: EFFORT[methode],
    systeme: systeme(CONSIGNE_ECRITURE, true, methode),
    messages: [{ role: "user", contenu: morceaux.join("\n\n") }],
    schema: schemaPourClaude(schemaEcriture),
  };
}

/**
 * Relecture. `defauts` (méthode courte seulement) : les défauts éliminatoires de FOND relevés par le programme et non
 * relancés ; la relecture les corrige parmi ses phrases (sinon le script est refusé).
 */
export function requeteRelecture(d: DemandeScriptTableau, a: AngleScript, e: EcritureScript, methode: MethodeTableau = METHODE_PAR_DEFAUT, defauts: readonly DefautScript[] = []): RequeteClaude {
  return {
    modele: verifierModele(MODELE_SCRIPTS_TABLEAU),
    maxTokens: plafondSortie("relecture", methode),
    effort: EFFORT[methode],
    systeme: systeme(CONSIGNE_RELECTURE, true, methode),
    // Sans les variantes (non relues, gardées de l'écriture) : la relecture rend des corrections, jamais le script entier.
    messages: [
      {
        role: "user",
        contenu: [
          demandeEnTexte(d),
          angleEnTexte(a),
          `<script_a_relire>\n${JSON.stringify({ idee: e.idee, gain: e.gain, metierExemple: e.metierExemple, script: e.script, motsDouleur: e.motsDouleur, sources: e.sources, affirmations: e.affirmations ?? [] })}\n</script_a_relire>`,
          ...(defauts.length ? [`<defauts_a_corriger>\nLe programme de contrôle a relevé ces défauts : corrigez-les parmi vos corrections (sinon le script est refusé) :\n${defauts.map((x) => `- ${x.message}`).join("\n")}\n</defauts_a_corriger>`] : []),
        ].join("\n\n"),
      },
    ],
    schema: schemaPourClaude(schemaRelecture),
  };
}
