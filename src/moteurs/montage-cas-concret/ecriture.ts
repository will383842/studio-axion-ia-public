/**
 * ÉCRITURE DU CAS CONCRET : du cas à la fiche d'écrans brute (tâche M3, plan cas concret § 5 étape 1, § 6 et § 4-f).
 * PUR : l'appel Claude et le budget sont INJECTÉS (`OutilsEcriture`, `outils.ts`). Patron : le découpage du tableau animé
 * (`src/moteurs/montage-tableau/decoupage.ts`), jamais importé.
 *
 * Déroulé de `ecrireFiche`, au plus DEUX appels :
 *  1. coût estimé au PIRE (tarifs du studio) puis réservation, AVANT l'appel ; refusée → aucun appel, échec motivé ;
 *  2. UN appel du rôle `roleEcritureCasConcret` (modèle d'écriture du studio, sortie JSON sans schéma envoyé) ;
 *  3. la réponse est lue PAR SON TEXTE (X3 : un rôle sans schéma n'a pas de `donnees` en production), ses champs fixes
 *     contrôlés, puis validée par `validerFicheEcrans` (R01 à R22) ; coupée au plafond de jetons → refusée sans être lue ;
 *  4. refusée → UNE relance avec les refus ; encore refusée → échec motivé en français. Jamais de troisième appel.
 * X9 · Claude DÉSIGNE, le code REMPLIT : avant la validation, `completerFiche` (`champs-du-cas.ts`) pose les champs tirés
 * du cas (valeur d'un fait désigné par `faitId`, champs figés, marque…) et ceux que le code calcule (identifiants, numéros
 * d'étape) ; un écart avec ce que Claude a rendu est noté (`notes`), jamais caché. Refusée : la réponse brute du dernier
 * essai est gardée (`reponseBrute`, tronquée) pour le diagnostic.
 *
 * Simulation (aucune clé) : `roleEcritureCasConcret.simuler` relit `<cas-id>` et `<fiche_fixe>`, retrouve le cas du
 * catalogue et rend une fiche VALIDE et déterministe, bâtie par gabarit (une phrase par bloc de la recette).
 *
 * 18/10 · variété : la consigne donne plusieurs exemples de RYTHME (`exemples-ton.ts`, sujets inventés) et non le début de la
 * v4 ; la partie variable donne les FORMES tirées pour la vidéo (`patrons-ecriture.ts`) et la mémoire de ce qui a déjà été
 * dit (`scriptsAnterieurs`, lus par le service ; `domaine/cas-concret-variete.ts`). Une séquence de 5 mots reprise d'un
 * script antérieur est un refus de QUALITÉ : elle fait servir la relance existante (jamais un appel de plus) ; si la
 * ressemblance reste, le script est gardé et la ressemblance est dite dans les `notes`.
 *
 * `reformulerPhrase` : une phrase rejetée par le contrôle de prise, reformulée en UN appel (mêmes nombres, pas plus de mots).
 *
 * N'importe aucun fournisseur en direct ni aucun autre moteur ; du générateur, les types des rôles et leurs phrases fixes.
 */
import { PHRASES_FIXES, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import { normaliser, texteCompare } from "@/domaine/controles-script/texte";
import { diyImperatif, NOUVEAUTE_OUTIL } from "@/domaine/positionnement";
import { anonymiserPourMemoire } from "@/domaine/ecriture-commune/memoire";
import { ajoutVariable, memoireCentraleApplicable, mesurerRessemblance, type MemoireCentrale } from "@/domaine/ecriture-commune/memoire-centrale";
import { blocMemoire, copiesDe, memoireAntiCopie, type Sequence } from "@/domaine/cas-concret-variete";
import { CARACTERES_PAR_SECONDE_ATEMPO_108, dureeDiteBrute } from "@/domaine/duree-tableau";
import { MODELE_ECRITURE, jetonsEstimes, pireCasUsd } from "@/fournisseurs/claude/tarifs";
import { OBJETS, type CasConcret, type FaitCas } from "@/formats/cas-concret/cas";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { ETIQUETTE_POSTURE, recettePour, type BlocCas } from "@/formats/cas-concret/recette";
import {
  AVANCE_MAX_MS,
  EVENEMENT_DE_L_OBJET,
  EVENEMENTS_CAS_CONCRET,
  TYPES_ECRAN_CORPS,
  TYPES_ECRAN_FIN,
  cleMot,
  idEcranAttendu,
  motsLus,
  texteDuCorps,
  validerSchemaFiche,
  type EcranCorps,
  type EcranDeType,
  type Evenement,
  type FicheEcrans,
  type FinPlanifiee,
} from "./fiche";
import { CLASSEMENT_CHAMPS, HAUTEURS_BARRES_SANS_FAIT, OBJETS_A_TEXTES, casSansFaitChiffre, completerFiche, ficheFixe, textesParDefautDuVisuel, uniteDuFait, type FicheFixe } from "./champs-du-cas";
import type { OutilsEcriture, ReponseAppelEcriture } from "./outils";
import { blocExemplesDeRythme } from "./exemples-ton";
import { blocPatrons, blocStructure, patronsDeLaVideo, placeDuResteHumain, type PatronsDeLaVideo } from "./patrons-ecriture";
import type { Structure } from "./variete";
import { AMORCE_GESTE_GABARIT, AMORCE_RESTE_HUMAIN_GABARIT, BASCULE_GABARIT, FORMAT_CAS_CONCRET, PHRASES_FIXES_CAS_CONCRET, QUESTION_GABARIT, QUESTION_GABARIT_LONGUE } from "./memoire-commune";
import {
  ACCROCHE_FIN_MAX_MS,
  ACCROCHE_MOTS_DITS_MAX,
  DEBIT_MAX,
  DEBIT_MIN,
  DEBIT_ECRAN_PRUDENT,
  DEBIT_RECETTE,
  DUREE_TOTALE_REFUS_MS,
  ECART_EVENEMENT_MAX_MS,
  ECRANS_CORPS,
  MOTS_ECRAN_MAX,
  MOTS_LISTE_AVANT_MAX,
  textesEcrits,
  ECRAN_DUREE_MAX_MS,
  ECRAN_DUREE_MIN_MS,
  ETAPES,
  LISTE_BLANCHE_NOMS,
  LISTE_DEBUT_MAX_MS,
  MARQUE,
  MOTS_MAX,
  RESERVES_ESTIMATION,
  nombresDe,
  sansPointsDeSigle,
  TENUE_FINALE_MS,
  dureeFinParDefautMs,
  tempsEcrans,
  texteNormalise,
  tutoie,
  validerFicheEcrans,
  type ContexteCasConcret,
} from "./regles";

/* ------------------------------------------------------------------ */
/* Réglages                                                              */
/* ------------------------------------------------------------------ */

/** Appels Claude au plus : le premier et UNE relance (plan § 5, étape 1). */
export const APPELS_ECRITURE_MAX = 2;
/** Libellés des étapes (dépense rattachée à la vidéo). */
export const ETAPE_ECRITURE = "Cas concret · écriture";
export const ETAPE_REFORMULATION = "Cas concret · reformulation";
/** Préfixes des appels (réservations retrouvables). */
export const PREFIXE_APPEL_ECRITURE = "ccecr";
export const PREFIXE_APPEL_REFORMULATION = "ccref";
/**
 * Sortie maximale : une fiche de 26 écrans tient sous 8 000 jetons ; le reste est pour la pensée (effort « medium »).
 * 15/10 : à 12 000, deux réponses coupées au plafond (pensée ≈ 11 000 jetons, fiche à moitié écrite, ≈ 0,25 € perdus
 * chacune) → 24 000. Seuls les jetons produits sont payés ; le prix « au plus » affiché monte d'autant.
 */
export const MAX_TOKENS_ECRITURE = 24000;
/** Sortie maximale d'une reformulation (une phrase). */
export const MAX_TOKENS_REFORMULATION = 600;

/* ------------------------------------------------------------------ */
/* Contrat                                                               */
/* ------------------------------------------------------------------ */

export type { FicheFixe } from "./champs-du-cas";

export interface EntreeEcriture extends FicheFixe {
  cas: CasConcret;
  /** Ce que la validation lit en plus de la fiche (interdits de Will, débit, fins planifiées). */
  controle?: Omit<ContexteCasConcret, "cas" | "texteScript">;
  /**
   * X12 : nombre de « Réessayer » de l'écriture après un arrêt (0 ou absent : premier passage). À partir de 1 : les
   * réponses déjà payées sont relues et jugées avec les règles du jour, puis, si aucune ne passe, UN nouvel appel.
   */
  reprise?: number;
  /**
   * 18/10 · textes dits de TOUS les scripts déjà écrits ou validés du format (lus par le service) : mémoire anti-copie.
   * Absent ou vide : aucune mémoire (comme avant).
   */
  scriptsAnterieurs?: readonly string[];
  /**
   * D2 · structure tirée pour la vidéo AVANT l'écriture (`journal.tirage`). Absente ou v4 : recette, patrons et partie
   * variable de toujours, octet pour octet (rien n'est repayé). Jamais changée en cours d'écriture.
   */
  structure?: Structure;
}

export type MotifEchecEcriture = "refusee" | "budget" | "appel";

/** Longueur gardée de la réponse brute d'un essai refusé (diagnostic, X9). */
export const REPONSE_BRUTE_MAX = 20_000;

export type ResultatEcriture =
  /** `notes` : écarts corrigés par les champs tirés du cas (X9), gardés au journal de l'étape. */
  | { ok: true; fiche: FicheEcrans; appels: number; relance: boolean; simule: boolean; coutUsd?: number; notes: string[] }
  /** `reponseBrute` : le texte rendu par le dernier essai, tronqué à `REPONSE_BRUTE_MAX` caractères. */
  | { ok: false; motif: MotifEchecEcriture; message: string; refus: string[]; appels: number; reponseBrute?: string };

/* ------------------------------------------------------------------ */
/* Consigne                                                              */
/* ------------------------------------------------------------------ */

const liste = (xs: readonly string[]) => xs.map((x) => `« ${x} »`).join(", ");
/**
 * Ce que l'écriture vise : la sortie la plus COURTE des réseaux cochés dure de 40 à 47 s (V4-2 : la v4, référence de
 * style, fait 41 s ; les essais réels duraient de 48 à 56 s), jamais plus de 50 s ; les bornes de refus de R21 (35 à
 * 65 s) ne changent pas.
 */
export const DUREE_SORTIE_COURTE_VISEE_MS = { min: 40_000, max: 47_000 } as const;

const virgule = (n: number) => String(n).replace(".", ",");

/** V4-2 : borne haute de la sortie la plus courte, dite dans la consigne (la visée s'arrête avant). */
export const DUREE_SORTIE_COURTE_MAX_MS = 50_000;

/**
 * V4-2 : le début de la v4 (`docs/formats/v4-reference/voix4.json`), mot pour mot, jusqu'à la bascule. 18/10 : il n'est PLUS
 * envoyé à Claude (seul, il faisait copier la v4 à tous les scripts) ; il reste pour la documentation et les tests, et
 * pour la mémoire anti-copie (la v4 est un script validé du catalogue). Le ton vient de `exemples-ton.ts`.
 */
export const EXEMPLE_TON_V4 =
  "On recrute nos collaborateurs en quinze minutes. Oui, quinze minutes. Avant, c'était ça : trier les candidatures, répondre à chacun, relancer, caler un rendez-vous, envoyer le contrat, courir après la signature. Plus d'une heure, pour chaque personne. Alors on a tout automatisé.";

/** Champs de chaque écran posés par le studio (`completerFiche`), jamais demandés à Claude. */
export const CHAMPS_POSES_PAR_LE_STUDIO = ["id", "marque", "valeur"] as const;

type PosesParLeStudio = "id" | "marque" | "avanceMs";
type BarreRendue = Omit<EcranDeType<"resultat">["avant"], "valeur">;
/** Un écran à chiffre tel que Claude le rend : le schéma, moins les champs posés par le studio. */
export type ExempleChiffre = Omit<EcranDeType<"chiffre">, PosesParLeStudio | "valeur">;
export type ExempleResultat = Omit<EcranDeType<"resultat">, PosesParLeStudio | "avant" | "maintenant"> & { avant: BarreRendue; maintenant: BarreRendue };

/**
 * X9 · UN exemple complet et exact de chaque écran à chiffre, tel que Claude le rend (sans les champs posés par le
 * studio). Un test vérifie qu'il passe `validerSchemaFiche` une fois complété par `completerFiche`.
 */
export const EXEMPLES_ECRANS_A_CHIFFRE: readonly [ExempleChiffre, ExempleResultat] = [
  { type: "chiffre", fond: "ivoire", texteDit: "Le dossier se traite en 15 minutes.", evenements: [{ cible: "unite", surMot: 5, avanceMs: 0 }], faitId: "duree-echange", unite: "minutes", pastilles: [], variante: "compteur" },
  {
    type: "resultat",
    fond: "sombre",
    texteDit: "Bilan : du temps libéré, jour après jour.",
    evenements: [{ cible: "barre-maintenant", surMot: 2, avanceMs: 0 }, { cible: "ligne", surMot: 4, avanceMs: 0 }],
    eclair: true,
    titre: "Du temps libéré",
    avant: { libelle: "Avant", faitId: "temps-avant" },
    maintenant: { libelle: "Maintenant", faitId: "duree-echange" },
    ligne: "Jour après jour",
  },
];

/**
 * Consigne fixe du rôle (en cache côté service). Les règles sont celles de la validation (`regles.ts`) ; la fin n'y est
 * jamais écrite : elle vient de la table des fins.
 */
export const CONSIGNE_ECRITURE = `Tu écris le CORPS d'une vidéo verticale « Cas concret » à partir d'un cas fourni : une voix dit le texte pendant que des écrans montrent une automatisation étape par étape. Tu rends la fiche d'écrans : le texte dit et les textes d'écran ensemble.

TON : on PARLE, on n'écrit pas. Phrases courtes, concrètes, au présent ; chaque phrase montre une action ; aucun adjectif creux ; vouvoiement quand on s'adresse au public. Une idée par phrase, avec un sujet qui NOMME la chose ou la personne (le client, la demande, l'automatisation, votre équipe) ; jamais un passif sans agent ; jamais « elle » ni « il » en tête d'écran si le nom n'est pas dans la phrase d'avant ; aucune phrase de moins de 3 mots. En posture « offre », sans « on a » ni « nous ».

${blocExemplesDeRythme()}

CLARTÉ D'ABORD : quelqu'un qui ne connaît pas le métier doit comprendre la vidéo en l'écoutant une fois.
- Avant le 3e écran, le sujet est dit en clair : qui, quelle chose, quel problème.
- Quand <recit> est donné : l'accroche dit son « sujet » ; le « avant » raconte sa « scene » au présent (les tâches de <avant> restent les cases de la liste) ; ses « mots_cles » sont dits dans les trois premiers écrans.
- Un seul exemple est suivi d'un bout à l'autre (celui de « exemple » dans <recit>, sinon une chose précise tirée de <avant>) : chaque étape dit ce qui arrive à CETTE chose, jamais une étiquette abstraite.
- Les étapes de <etapes> sont une source, pas un texte à lire : regroupe-les en 3 temps au plus, et ne dis jamais un titre d'étape seul.
- La part humaine (<reste_humain>, mot pour mot, R23) se dit à sa place ; puis le bénéfice vécu : la même scène, sans le problème.
- La question finale porte sur ce même problème.
- Ne recopie jamais la description d'une forme de <formes_de_la_video>.

FORME DE CETTE VIDÉO : <formes_de_la_video> donne la FORME de l'accroche, du « avant », de la bascule, du résultat et de la question finale, tirée pour cette vidéo seule : suis-la. Chaque description est une forme, jamais une phrase à recopier. Quand <place_reste_humain> est donné, dis ce qui reste humain à cet endroit.

DÉJÀ DIT : quand <deja_dit> est donné, ces tournures ont déjà servi dans d'autres vidéos : ne les reprends pas, ni leurs variantes proches (même ordre de mots avec quelques mots changés). Dis la même chose autrement ; la promesse et les faits du cas, eux, restent exacts. Une séquence de 5 mots de suite reprise de cette liste fait refuser le script.

ACCROCHE (e01, puis le premier chiffre) : elle met en avant la PROMESSE du cas, le gain annoncé, jamais le « avant » ; quand <recit> est donné, elle dit à la place le « sujet » de <recit> (mêmes limites de mots et de temps), et la promesse peut se redire au résultat. Le premier écran « chiffre », juste après e01, montre le fait chiffré de la PROMESSE quand la promesse porte un nombre : jamais le total de l'« avant », qui vient ensuite, dans la liste « avant ».

UNE SEULE IDÉE : la vidéo montre UN seul mécanisme, celui du cas ; aucune seconde promesse ni bénéfice ajouté ; après l'accroche, aucun écran ne redit la promesse (le « resultat » montre le gain : chiffré quand un fait le porte, en mots sinon).

CE QUE TU N'ÉCRIS JAMAIS : la fin de la vidéo. Elle est fabriquée à part. Le corps s'arrête sur la question au public. Aucune invitation à commenter, à cliquer, à suivre un lien, à écrire un mot ou à réserver quoi que ce soit, ni dans le texte dit ni dans les textes d'écran. Aucun écran de type ${liste(TYPES_ECRAN_FIN)}.

LES FAITS : les faits du cas sont dans <faits>. Chacun est à citer tel quel ou à ne pas citer. Tout nombre dit ou écrit (en chiffres ou en lettres) est une valeur d'un fait ; « un » et « une » ne comptent comme nombre que devant une unité (heure, minute, seconde, jour, semaine, mois, euro, %). Un fait de source « estimation » se dit avec sa réserve (${liste(RESERVES_ESTIMATION)}). Une tâche, une étape ou un détail qui porte un autre nombre se dit sans ce nombre, ou ne se dit pas. Tu n'inventes ni fait, ni chiffre, ni durée, ni prix.

SANS FAIT CHIFFRÉ : quand aucun fait de <faits> ne porte de valeur (« (aucun) », ou « valeurs aucune » sur chaque fait), la vidéo ne dit et n'écrit AUCUN nombre. Aucun écran « chiffre », même si <recette> nomme « Le chiffre ». Le « resultat » reste obligatoire (R04) : il dit le gain en mots, d'après <resultat> ; ses barres « avant » et « maintenant » sont { "libelle" } seuls, sans « faitId » ni « valeur » (le studio les dessine sans aucun nombre) ; chaque libellé, de 1 à 3 mots sans nombre, nomme l'état que la barre montre (« Avant » et « Maintenant » sont déjà écrits au-dessus). Ce n'est pas une preuve manquante : rends la fiche, jamais PREUVE_MANQUANTE pour cette raison.

RÈGLES (la fiche est refusée sinon) :
- R02 : les « texteDit » mis bout à bout forment le script du corps ; chaque écran dit sa part.
- R03 : écran e01 de type « accroche » ; il dit la promesse du cas (<promesse>), ou, quand <recit> est donné, son « sujet », avec tous ses mots pleins et ses nombres, en ${ACCROCHE_MOTS_DITS_MAX} mots dits au plus, fini avant ${virgule(ACCROCHE_FIN_MAX_MS / 1000)} s.
- R04 : ordre : accroche ; la liste « avant » (type « liste-avant ») commence avant ${virgule(LISTE_DEBUT_MAX_MS / 1000)} s ; un « titre » (la bascule) entre la liste et la première étape ; toutes les « etape » ; ce qui reste humain (<reste_humain>) est dit APRÈS la première étape ; le « resultat » suit la dernière étape ; la « question » est le dernier écran, et le seul de son type.
- R05 : chaque écran dure de ${virgule(ECRAN_DUREE_MIN_MS / 1000)} à ${virgule(ECRAN_DUREE_MAX_MS / 1000)} s, estimé au débit prudent de ${virgule(DEBIT_ECRAN_PRUDENT)} mots par seconde (la voix réelle est plus lente que 3,4) : de 4 à ${MOTS_ECRAN_MAX} mots dits par écran, 14 si l'écran a une avance ; écran liste-avant : ${MOTS_LISTE_AVANT_MAX} mots dits au plus. Coupez une phrase longue sur deux écrans. Jamais deux écrans sur deux mots voisins : le premier mot d'un écran vient au moins 4 mots dits (une seconde) après le premier mot du précédent ; un écran trop court est réuni à son voisin au calage.
- R06 : un événement visible toutes les ${virgule(ECART_EVENEMENT_MAX_MS / 1000)} s au plus (entrée d'écran ou « evenements ») : au plus 6 mots dits entre deux événements. Débit de ${virgule(DEBIT_MIN)} à ${virgule(DEBIT_MAX)} mots par seconde.
- R07 : jamais 3 écrans de suite sur le même « fond » (${liste(["sombre", "ivoire"])}).
- Texte d'écran : il ne répète jamais mot pour mot la phrase dite (le sous-titre la montre déjà) ; il la résume ou la complète (dit « Le client reçoit le devis. », écrit « Devis envoyé par courriel. »).
- R08 : textes d'écran courts : titre ${MOTS_MAX.titre} mots par ligne, ligne ${MOTS_MAX.ligne} mots, puce ${MOTS_MAX.puce} mots.
- R09 : la marque « ${MARQUE} » est posée par le studio sur chaque écran.
- R10 : aucun mot interdit (<interdits>), ni « machine » (dites « automatisation »).
- R11 : vouvoiement, jamais de tutoiement.
- R12 et R13 : voir LES FAITS. Un écran « chiffre » et chaque barre d'un « resultat » DÉSIGNENT un fait chiffré de <faits> par son identifiant (« faitId ») ; le studio y pose lui-même la valeur du fait : tu ne rends jamais « valeur ». Sans fait chiffré : voir SANS FAIT CHIFFRÉ.
- R14 : aucun récit de client, aucun avis ni témoignage ; aucun nom propre hors ${LISTE_BLANCHE_NOMS.join(", ")} (une majuscule ailleurs qu'en début de phrase est un nom propre, sauf un sigle tout en capitales).
- R15 : posture « offre » : aucune tournure d'usage réel chez nous (« chez nous », « notre équipe », « on utilise », « nous avons automatisé »…).
- R16 : aucun prix, sauf un fait de source « site » qui énonce un montant.
- R17 : la conformité n'est dite que si <conformite> porte une phrase, et alors mot pour mot ; ses textes d'écran n'emploient que des mots de cette phrase.
- R19 : objets de la banque <objets> seulement. Un vrai écran (« sorte »: « ecran ») vise une étape du cas dont le visuel est un écran, avec un « repli » de la banque.
- R20 : de ${ECRANS_CORPS.min} à ${ECRANS_CORPS.max} écrans ; de ${ETAPES.min} à ${ETAPES.max} écrans « etape » (le studio les numérote).
- R21 : la vidéo entière, fin comprise, tient de ${DUREE_TOTALE_REFUS_MS.min / 1000} à ${DUREE_TOTALE_REFUS_MS.max / 1000} s ; visée : la vidéo la plus COURTE (celle de la fin la plus courte) dure de ${DUREE_SORTIE_COURTE_VISEE_MS.min / 1000} à ${DUREE_SORTIE_COURTE_VISEE_MS.max / 1000} s, jamais plus de ${DUREE_SORTIE_COURTE_MAX_MS / 1000} s (la v4 dure 41 s) : mieux vaut un écran de moins qu'une phrase de trop. Quand <duree_fins> est donné, le corps dure ce qu'il indique : une fin courte demande plus d'écrans dans le corps (étapes détaillées, écrans « objet »). Ces durées sont estimées à ${virgule(CARACTERES_PAR_SECONDE_ATEMPO_108)} caractères dits par seconde (espaces et ponctuation compris). Quand la matière du cas est courte, ajoutez des écrans qui ne portent AUCUN fait nouveau : une « question » plus développée, une phrase de plus sur l'exemple suivi (ce qui lui arrive, ce qu'il évite) ; n'inventez jamais un fait pour durer.
- R23 : l'ordre du VRAI fonctionnement : les étapes se montrent dans l'ordre de <etapes> (jamais une étape avant une étape qui la précède) ; ce qui reste humain (<reste_humain>) se dit mot pour mot, À SA PLACE : juste après l'étape donnée par <reste_humain_apres_etape>, avant l'étape suivante (la visio avant le contrat, par exemple).
- R22 : un sigle dit s'écrit pour être lu dans le texte dit (« R.G.P.D. », « I.A. ») ; à l'écran il s'écrit « RGPD », « IA ».

FORME (JSON seul, aucun texte autour, aucun champ en plus) : { "ecrans": [...] }
Tu ne rends QUE ce que toi seul peux écrire. Le studio pose lui-même, d'après le cas et la commande : l'en-tête de la fiche (${liste(Object.keys(CLASSEMENT_CHAMPS.fiche).filter((k) => k !== "ecrans"))}), et dans chaque écran ${liste(CHAMPS_POSES_PAR_LE_STUDIO)}. Si tu les rends quand même, ce sont ceux du studio qui comptent.
Chaque écran, dans l'ordre (le premier est « e01 », puis « e02 »…) : { "type", "fond", "texteDit", "evenements": [{ "cible", "surMot" (rang du mot dans le texteDit, 0 = premier ; un signe isolé comme « : » ou « ? » ne compte pas), "avanceMs"? (0 à ${AVANCE_MAX_MS}) }], "avanceMs"? (0 à ${AVANCE_MAX_MS}), "eclair"? (trois écrans clés par vidéo) }, plus les champs de son type. Pas de « debutMs » ni « finMs ».
Les 9 types du corps (${liste(TYPES_ECRAN_CORPS)}) :
- accroche : "lignes" (2 ou 3), "motOrange" (un mot des lignes) ; l'étiquette est posée par le studio
- chiffre : "faitId" (un fait chiffré de <faits>), "unite"? (sinon celle de l'énoncé du fait), "pastilles"? (0 à 3), "variante" (« simple » ou « compteur ») ; jamais « valeur »
- liste-avant : "taches" (2 à 6 : une case par tâche dite, dans l'ordre ; chaque case apparaît sur un mot du morceau de phrase qui la dit, et reprend l'un de ses mots), "total"?
- titre : "lignes" (1 ou 2), "orange"? (1 ou 2 mots des lignes)
- etape : "titre", "ligne", "visuel", "puces"? (0 à 2) ; le titre, la ligne ou une puce reprend un mot-clé ou un chiffre dit pendant l'écran ; visuel : { "sorte": "objet", "objet", "textes"? } ou { "sorte": "ecran", "etapeCas" (rang de l'étape du cas), "repli"? (sinon celui du cas), "departPage"? (page longue : part de sa hauteur, de 0 à 1, montrée d'emblée) } ; numéro et total posés par le studio
- objet : "titre", "ligne"?, "visuel" (sorte « objet » seulement)
- textes d'un visuel « objet » : obligatoires pour « liste-taches » (1 à 3 tâches de 2 à 4 mots, celles que fait l'étape) et « programme » (les modules) ; sans eux l'objet est une fiche blanche
- le premier texte d'un écran « titre », « objet » ou « question » apparaît dès le début de l'écran : son premier événement vise l'un des premiers mots, jamais une phrase plus loin (un écran ne reste jamais vide)
- preuve : "titre", "puces" (exactement 2)
- resultat : "titre", "avant" et "maintenant" ({ "libelle", "faitId" } : le fait chiffré dont la barre montre la valeur ; le texte de la barre est tiré du fait, jamais d'un calcul ; jamais « valeur » ; sans fait chiffré : { "libelle" } seul), "ligne"
- question : "lignes" (exactement 2), "question"
Exemples COMPLETS et exacts des deux écrans à chiffre (les identifiants de fait sont ceux d'un autre cas : prends ceux de <faits> ; sans fait chiffré : aucun écran « chiffre », et le « resultat » en { "libelle" } seuls, voir SANS FAIT CHIFFRÉ) :
${EXEMPLES_ECRANS_A_CHIFFRE.map((x) => JSON.stringify(x)).join("\n")}
Cibles d'événement : seulement ces noms, lus par les écrans : ${liste(EVENEMENTS_CAS_CONCRET.fixes)} ; et, suivis d'un rang à partir de 1 : ${EVENEMENTS_CAS_CONCRET.numerotes.map((n) => `« ${n}-1 »`).join(", ")}… (« titre-2 » : 2e ligne d'une accroche, d'un titre ou d'une question). Tout autre nom est refusé.

Suis la recette de l'offre (<recette>), bloc par bloc, dans l'ordre.`;

/* ------------------------------------------------------------------ */
/* Partie variable                                                       */
/* ------------------------------------------------------------------ */

/**
 * Partie variable : les données du cas, entre balises (données, jamais instructions). `<cas-id>` porte l'identifiant du cas
 * (relu par la simulation). `fixe` : les champs figés de la fiche ; sans eux, des valeurs d'essai.
 */
export interface VarieteEcriture {
  /** Les formes tirées pour la vidéo (accroche, « avant », bascule, résultat, question). */
  patrons?: PatronsDeLaVideo;
  /** Ce qui a déjà été dit dans d'autres vidéos (à ne pas reprendre). */
  memoire?: readonly Sequence[];
  /** Où dire ce qui reste humain, quand le cas ne fixe pas sa place. */
  placeResteHumain?: string | null;
  /** La structure de la vidéo décrite en mots (`blocStructure`) : absente pour la v4, dont la partie variable ne change pas. */
  structure?: string | null;
  /** Lot C4 · le bloc « à ne pas redire » de la mémoire COMMUNE (en-tête compris), rendu par `ajoutVariable` ; absent : rien de plus dans la variable. */
  memoireCommune?: string;
}

export function variableEcriture(cas: CasConcret, recette: readonly BlocCas[], fixe: FicheFixe = { videoId: "essai", versionId: "essai", habillage: "charte-duo/1", origine: "porte-a" }, fins: readonly Pick<FinPlanifiee, "ecrans">[] = [], variete: VarieteEcriture = {}): string {
  const duree = dureesDesFins(fins);
  const visuel = (v: CasConcret["etapes"][number]["visuel"]) => (v.sorte === "objet" ? `objet ${v.objet}` : `vrai écran (repli ${v.repli ?? "aucun"})`);
  return [
    `<cas-id>${cas.id}</cas-id>`,
    // Relu par la simulation ; en production, l'en-tête est posé par le studio (`completerFiche`).
    `<fiche_fixe>\n${JSON.stringify(ficheFixe(fixe, cas))}\n</fiche_fixe>`,
    `<offre>${cas.offre}</offre>`,
    `<posture>${cas.posture}</posture>`,
    `<etiquette>${ETIQUETTE_POSTURE[cas.posture]}</etiquette>`,
    `<recette>\n${recette.map((b) => `${b.id} · ${b.nom} · ${b.dureeCibleSec[0]} à ${b.dureeCibleSec[1]} s${b.facultatif ? " · facultatif" : ""}${b.consigne ? ` · ${b.consigne}` : ""}`).join("\n")}\n</recette>`,
    `<titre>${cas.titre}</titre>`,
    `<cible>${cas.cible}</cible>`,
    ...(cas.recit ? [`<recit>
sujet : ${cas.recit.sujet}
scene : ${cas.recit.scene}
exemple : ${cas.recit.exemple}
mots_cles : ${cas.recit.motsCles.join(", ")}
</recit>`] : []),
    `<promesse>${cas.promesse}</promesse>`,
    `<avant>\n${cas.avant.taches.map((t) => `- ${t}`).join("\n")}${cas.avant.total ? `\ntotal : ${cas.avant.total}` : ""}\n</avant>`,
    `<etapes>\n${cas.etapes.map((x, i) => `${i + 1} · ${x.titre} · ${x.ligne} · détail : ${x.detail} · visuel : ${visuel(x.visuel)}${x.humaine ? " · humaine" : ""}`).join("\n")}\n</etapes>`,
    `<reste_humain>${cas.resteHumain}</reste_humain>`,
    ...(cas.resteHumainApresEtape ? [`<reste_humain_apres_etape>${cas.resteHumainApresEtape} · ${cas.etapes[cas.resteHumainApresEtape - 1]?.titre ?? ""}</reste_humain_apres_etape>`] : []),
    `<resultat>${cas.resultat}</resultat>`,
    `<faits>\n${cas.faits.map((f) => `${f.id} · source ${f.source} · valeurs ${f.valeurs.length ? f.valeurs.join(", ") : "aucune"} · ${f.enonce}`).join("\n") || "(aucun)"}\n</faits>`,
    `<conformite>${cas.conformite?.rgpd?.phrase ?? "(aucune : ne parlez pas de conformité)"}</conformite>`,
    `<vigilance>\n${cas.vigilance.map((v) => `- ${v}`).join("\n") || "(aucune)"}\n</vigilance>`,
    `<objets>${OBJETS.join(", ")}</objets>`,
    ...(duree ? [`<duree_fins>${texteDureeFins(duree)}</duree_fins>`] : []),
    ...(variete.structure ? [`<structure_de_la_video>\n${variete.structure}\n</structure_de_la_video>`] : []),
    ...(variete.patrons ? [`<formes_de_la_video>\n${blocPatrons(variete.patrons)}\n</formes_de_la_video>`] : []),
    ...(variete.placeResteHumain ? [`<place_reste_humain>${variete.placeResteHumain}</place_reste_humain>`] : []),
    ...(variete.memoire?.length ? [`<deja_dit>\n${blocMemoire(variete.memoire)}\n</deja_dit>`] : []),
    ...(variete.memoireCommune ? [variete.memoireCommune] : []),
  ].join("\n");
}

/* ---------- Durée des fins prévues (R21) ---------- */

/**
 * X7 · Durée DITE estimée d'une suite d'écrans, en ms : leurs « texteDit » mis bout à bout, au débit en caractères de la
 * voix réelle (`CARACTERES_PAR_SECONDE_ATEMPO_108`, 20,5 caractères par seconde : `atempo` 1,08, celui de ce format). Le
 * débit en mots (3,4 mots par seconde) s'écartait de plus de 5 % de cette estimation sur 5 des 7 cas (de −8,4 % à
 * +7,5 %) : l'écriture vise désormais la durée en caractères. Les règles par écran (R05, R06) restent en mots.
 */
export function dureeDiteMs(ecrans: readonly { texteDit: string }[], caracteresParSeconde: number = CARACTERES_PAR_SECONDE_ATEMPO_108): number {
  return Math.round(dureeDiteBrute(ecrans.map((e) => e.texteDit).join(" "), caracteresParSeconde) * 1000);
}

/** Visée de R21 pour la vidéo entière, fin comprise (demande de Will) ; les bornes de refus sont `DUREE_TOTALE_REFUS_MS`. */
export const DUREE_TOTALE_VISEE_MS = { min: 40_000, max: 60_000 } as const;

/** Durées des fins prévues : la plus courte et la plus longue, en ms ; `null` sans fin connue. */
export interface DureesFins {
  plusCourteMs: number;
  plusLongueMs: number;
}

export function dureesDesFins(fins: readonly Pick<FinPlanifiee, "ecrans">[]): DureesFins | null {
  if (!fins.length) return null;
  const d = fins.map((f) => dureeDiteMs(f.ecrans) + TENUE_FINALE_MS);
  return { plusCourteMs: Math.min(...d), plusLongueMs: Math.max(...d) };
}

/**
 * Durée du corps à viser : la vidéo la plus courte de 45 à 55 s, la plus longue sous la borne de refus (65 s) ; sinon les
 * bornes de refus seules.
 */
export function corpsVise(d: DureesFins): { minMs: number; maxMs: number } {
  const vise = { minMs: DUREE_SORTIE_COURTE_VISEE_MS.min - d.plusCourteMs, maxMs: Math.min(DUREE_SORTIE_COURTE_VISEE_MS.max - d.plusCourteMs, DUREE_TOTALE_REFUS_MS.max - d.plusLongueMs) };
  return vise.minMs <= vise.maxMs ? vise : { minMs: DUREE_TOTALE_REFUS_MS.min - d.plusCourteMs, maxMs: DUREE_TOTALE_REFUS_MS.max - d.plusLongueMs };
}

const sec = (ms: number) => `${virgule(Math.round(ms / 100) / 10)} s`;

function texteDureeFins(d: DureesFins): string {
  const c = corpsVise(d);
  return `fin la plus courte ${sec(d.plusCourteMs)} · fin la plus longue ${sec(d.plusLongueMs)} · corps à viser de ${sec(c.minMs)} à ${sec(c.maxMs)}`;
}

/** Relit `<duree_fins>` (simulation). */
function lireDureeFins(t: string | undefined): DureesFins | null {
  const lu = (nom: string) => {
    const m = new RegExp(`${nom} (\\d+(?:,\\d+)?) s`).exec(t ?? "");
    return m ? Math.round(Number(m[1].replace(",", ".")) * 1000) : undefined;
  };
  const plusCourteMs = lu("fin la plus courte");
  const plusLongueMs = lu("fin la plus longue");
  return plusCourteMs !== undefined && plusLongueMs !== undefined ? { plusCourteMs, plusLongueMs } : null;
}

/** Variable de la relance : la même, plus la réponse précédente et ses refus exacts. */
export function variableRelance(variable: string, reponsePrecedente: string, refus: readonly string[]): string {
  return `${variable}\n<reponse_precedente>\n${reponsePrecedente}\n</reponse_precedente>\n<refus_fiche_precedente>\n${refus.map((r) => `- ${r}`).join("\n")}\n</refus_fiche_precedente>\nTa fiche précédente a été refusée pour ces raisons. Rends la fiche COMPLÈTE corrigée, en JSON seul.`;
}

/** Contenu d'une balise de la partie variable. */
function balise(variable: string, nom: string): string | undefined {
  const m = new RegExp(`<${nom}>\\s*([\\s\\S]*?)\\s*</${nom}>`).exec(variable);
  return m?.[1];
}

/* ------------------------------------------------------------------ */
/* Simulation : fiche par gabarit                                        */
/* ------------------------------------------------------------------ */

const PAS_MOTS = 6;
/** Mots dits au plus sur un écran de la liste « avant ». */
const MOTS_LISTE_MAX = 15;
const MOTS_OUTILS_FIN = new Set(["de", "du", "des", "la", "le", "les", "l'", "d'", "à", "au", "aux", "et", "en", "sur", "pour", "un", "une", "avec", "sans", "dans", "par", "ou"]);

/** Un sigle tout en capitales (« CRM ») écrit pour être lu (« C.R.M. ») ; le reste est inchangé. */
export function sigleLu(t: string): string {
  return t.replace(/(^|[^\p{L}.])(\p{Lu}{2,})(?=[^\p{L}]|$)/gu, (_, avant: string, s: string) => `${avant}${[...s].join(".")}.`).replace(/\.\.(?=\s|$)/g, ".").replace(/\.\s*\./g, ".");
}

const minusculeInitiale = (t: string) => (/^\p{Lu}{2,}/u.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));
const sansPointFinal = (t: string) => t.trim().replace(/[.,;:]+$/, "");
const nombreLus = (t: string) => motsLus(t).length;

/** Coupe un texte écrit à `n` mots, sans finir sur un mot outil. */
export function couper(t: string, n: number): string {
  const ms = t.trim().split(/\s+/);
  if (motsLus(t).length <= n) return t.trim();
  let garde = ms.slice(0, n);
  while (garde.length > 1 && MOTS_OUTILS_FIN.has(garde[garde.length - 1].toLowerCase().replace(/[,;:]$/, ""))) garde = garde.slice(0, -1);
  return sansPointFinal(garde.join(" "));
}

/** Un texte est-il dicible (vouvoiement, nombres des faits, réserve d'une estimation) ? */
function dicible(t: string, cas: CasConcret): boolean {
  if (tutoie(t)) return false;
  const permis = new Set(cas.faits.flatMap((f) => f.valeurs));
  const nombres = nombresDe(sansPointsDeSigle(t));
  if (!nombres.every((n) => permis.has(n))) return false;
  const estimationSeule = nombres.some((n) => cas.faits.filter((f) => f.valeurs.includes(n)).every((f) => f.source === "estimation"));
  if (!estimationSeule) return true;
  const c = ` ${texteCompare(t)} `;
  return RESERVES_ESTIMATION.some((r) => {
    const x = texteCompare(r);
    return x.endsWith("'") ? c.includes(` ${x}`) : c.includes(` ${x} `);
  });
}

/**
 * Événements d'un écran : ceux donnés (`[cible, rang lu]`), complétés par les cibles de `relais` pour qu'il n'y ait jamais
 * plus de `PAS_MOTS` mots dits sans événement.
 */
function evenements(t: string, donnes: readonly [string, number][], relais: readonly string[]): Evenement[] {
  const n = nombreLus(t);
  const pris = [...donnes].filter(([, r]) => r > 0 && r < n).sort((a, b) => a[1] - b[1]);
  const res: [string, number][] = [];
  const reserve = [...relais];
  let dernier = 0;
  for (const p of [...pris, ["", n] as [string, number]]) {
    while (p[1] - dernier > PAS_MOTS && reserve.length) {
      dernier += PAS_MOTS;
      res.push([reserve.shift()!, dernier]);
    }
    if (p[0]) res.push(p);
    dernier = Math.max(dernier, p[1]);
  }
  return res.sort((a, b) => a[1] - b[1]).map(([cible, r]) => ({ cible, surMot: r, avanceMs: 0 }));
}

/** Relais d'un visuel : l'événement que lit son objet dessiné, sinon son impulsion (`objet`). */
const relaisDuVisuel = (objet: string): string[] => [EVENEMENT_DE_L_OBJET[objet as keyof typeof EVENEMENT_DE_L_OBJET] ?? "objet"];

/** Barre du résultat tirée d'un fait (sa première valeur) ; sans fait, la valeur par défaut, qui ne s'affiche pas. */
function barreDuFait(libelle: string, f: FaitCas | undefined, defaut: number): { libelle: string; valeur: number; faitId?: string } {
  return f && f.valeurs.length ? { libelle, valeur: f.valeurs[0], faitId: f.id } : { libelle, valeur: defaut };
}

/** Rang lu du premier mot de `partie` dans `t` (recherche à partir du rang `depuis`). */
function rangDe(t: string, partie: string, depuis = 0): number {
  const a = motsLus(t).map(cleMot);
  const b = motsLus(partie).map(cleMot);
  for (let i = depuis; i <= a.length - b.length; i++) if (b.every((m, k) => a[i + k] === m)) return i;
  return depuis;
}

type SansCommun<T> = T extends unknown ? Omit<T, "id" | "fond" | "marque" | "avanceMs"> : never;
type Brouillon = SansCommun<EcranCorps>;

/** Tâches « avant » en écrans de 2 à 4 tâches, chacun de `MOTS_LISTE_MAX` mots dits au plus ; une tâche isolée est laissée. */
function groupesAvant(taches: readonly string[]): string[][] {
  const groupes: string[][] = [];
  let courant: string[] = [];
  let n = 1; // « Avant : »
  for (const t of taches) {
    const k = nombreLus(t);
    if (courant.length && (courant.length === 4 || n + k > MOTS_LISTE_MAX)) {
      groupes.push(courant);
      courant = [];
      n = 0;
    }
    courant.push(t);
    n += k;
  }
  if (courant.length) groupes.push(courant);
  return groupes.filter((g) => g.length >= 2);
}

/**
 * Fiche du cas par gabarit : une phrase par bloc de la recette (accroche, chiffre, avant, bascule, étapes, reste humain,
 * conformité, résultat, question). Déterministe.
 */
/** Marge visée au-dessus de la durée minimale du corps (ms). */
/** Niveaux de remplissage d'un cas à peu de matière (`gabarit`). */
const REMPLISSAGES = 3;
const MARGE_VISEE_MS = 2000;

export function ficheParGabarit(cas: CasConcret, fixe: FicheFixe, finsConnues: DureesFins | null = null): FicheEcrans {
  let fins = finsConnues;
  if (!fins) {
    // Fins pas encore connues : le gabarit par défaut s'il tient avec la suite la plus longue de la table (R21), sinon
    // le corps qui tient avec elle (les fins à une seule demande, X6, sont courtes).
    const parDefaut = gabarit(cas, fixe);
    const d = dureeFinParDefautMs(cas);
    // Comparé à la borne de refus de R21, qui compte en mots : même débit qu'elle.
    const t = tempsEcrans(parDefaut.ecrans);
    if (t[t.length - 1].finMs - t[0].debutMs + d >= DUREE_TOTALE_REFUS_MS.min) return parDefaut;
    fins = { plusCourteMs: d, plusLongueMs: d };
  }
  // Les fins sont connues : le moins d'écrans « objet » de détail qui fait tenir le corps dans `corpsVise` (la vidéo la
  // plus courte de 45 à 55 s), sinon dans les bornes de R21 (35 à 65 s), sans dépasser le nombre d'écrans permis.
  const corpsMs = (f: FicheEcrans) => dureeDiteMs(f.ecrans);
  // En dernier recours (cas à peu de matière), la forme longue : le titre de chaque étape dit avant sa ligne, et les faits
  // sans nombre en écrans « objet ».
  // X7 : si la forme longue reste courte, des écrans sans AUCUN fait nouveau (question développée, puis un titre de
  // transition qui redit la promesse, puis la reprise d'une étape en deux écrans).
  const essais = [
    ...Array.from({ length: cas.etapes.length + 1 }, (_, details) => gabarit(cas, fixe, details)),
    ...Array.from({ length: REMPLISSAGES + 1 }, (_, remplissage) => gabarit(cas, fixe, cas.etapes.length, true, remplissage)),
  ].filter((f) => f.ecrans.length <= ECRANS_CORPS.max);
  const vise = corpsVise(fins);
  const tientVise = (f: FicheEcrans) => corpsMs(f) >= vise.minMs && corpsMs(f) <= vise.maxMs;
  // De préférence avec une marge au-dessus du minimum : la voix réelle lit souvent plus vite que le débit de la recette.
  const tientAvecMarge = (f: FicheEcrans) => corpsMs(f) >= vise.minMs + MARGE_VISEE_MS && corpsMs(f) <= vise.maxMs;
  const tientRefus = (f: FicheEcrans) => corpsMs(f) + fins.plusCourteMs >= DUREE_TOTALE_REFUS_MS.min && corpsMs(f) + fins.plusLongueMs <= DUREE_TOTALE_REFUS_MS.max;
  // Hors de la visée, le corps qui tient dans les bornes de refus au plus près de la visée (V4-2 : le plus long ne l'est
  // plus forcément, une visée manquée de peu par le haut tombait sur le corps le plus long).
  const ecart = (f: FicheEcrans) => Math.max(0, vise.minMs - corpsMs(f), corpsMs(f) - vise.maxMs);
  const proche = essais.filter(tientRefus).sort((a, b) => ecart(a) - ecart(b) || corpsMs(b) - corpsMs(a))[0];
  return essais.find(tientAvecMarge) ?? essais.find(tientVise) ?? proche ?? gabarit(cas, fixe);
}

/**
 * Le gabarit, avec `details` écrans « objet » de détail au plus (par défaut : assez pour le minimum d'écrans, plus un) ;
 * `long` : la forme longue (titre de l'étape dit avant sa ligne, détail restant dit avec elle, faits sans nombre en écrans).
 * `remplissage` (X7, cas à peu de matière) : 1 la question développée ; 2 en plus un titre de transition qui redit la
 * promesse ; 3 en plus la reprise d'une étape en deux écrans (le geste, puis la tâche « avant » qu'il évite). Aucun ne
 * porte de fait nouveau : ils redisent la matière du cas.
 */
function gabarit(cas: CasConcret, fixe: FicheFixe, details?: number, long = false, remplissage = 0): FicheEcrans {
  const brouillons: Brouillon[] = [];
  const recette = recettePour(cas);
  const blocs = new Set(recette.map((b) => b.id));

  // Accroche : la promesse, en 2 ou 3 lignes ; un sigle de la promesse est écrit pour être lu (« C.R.M. »).
  const promesse = sansPointFinal(cas.promesse);
  const mp = promesse.split(/\s+/);
  const nl = mp.length <= 6 ? 2 : 3;
  const tailles = Array.from({ length: nl }, (_, i) => Math.floor(mp.length / nl) + (i < mp.length % nl ? 1 : 0));
  const lignes: string[] = [];
  tailles.reduce((d, k) => (lignes.push(mp.slice(d, d + k).join(" ")), d + k), 0);
  const candidats = lignes[lignes.length - 1].split(/\s+/).map((m) => m.replace(/[^\p{L}\p{N}'-]+/gu, ""));
  const chiffre = mp.map((m) => m.replace(/[^\p{L}\p{N}]+/gu, "")).find((m) => /^\d+$/.test(m));
  const motOrange = chiffre ?? [...candidats].sort((a, b) => b.length - a.length)[0];
  const ditAccroche = sigleLu(cas.promesse);
  brouillons.push({ type: "accroche", texteDit: ditAccroche, etiquette: ETIQUETTE_POSTURE[cas.posture], lignes, motOrange, eclair: true, evenements: evenements(ditAccroche, lignes.slice(1).map((l, i) => [`titre-${i + 2}`, rangDe(ditAccroche, l)]), []) });

  // Le chiffre : l'énoncé d'un fait, s'il tient avant la liste. V4-2 : quand la promesse porte un nombre, seul un fait
  // qui le porte (le gain : « 15 minutes ») est montré ici, jamais un autre (la v4 : « 15 MINUTES. », pas « 1 HEURE. »).
  const lusAccroche = nombreLus(ditAccroche);
  const nombresPromesse = (cas.promesse.match(/\d+/g) ?? []).map(Number);
  const faitsDuChiffre = nombresPromesse.length ? cas.faits.filter((f) => f.valeurs.some((v) => nombresPromesse.includes(v))) : cas.faits;
  let faitChiffre: FaitCas | undefined;
  if (blocs.has("chiffre")) {
    const motsMax = Math.floor((LISTE_DEBUT_MAX_MS / 1000) * DEBIT_RECETTE) - lusAccroche;
    for (const f of faitsDuChiffre) {
      const u = uniteDuFait(f);
      const dit = sigleLu(f.enonce);
      const n = nombreLus(dit);
      if (!u || f.source === "estimation" || n < 4 || n > Math.min(motsMax, 17) || !dicible(f.enonce, cas)) continue;
      brouillons.push({ type: "chiffre", texteDit: dit, valeur: u.valeur, unite: u.unite, faitId: f.id, pastilles: [], variante: "simple", evenements: evenements(dit, [], ["unite"]) });
      faitChiffre = f;
      break;
    }
  }

  // Avant : les tâches, deux à quatre par écran ; de préférence celles qui se disent en 6 mots au plus (un événement
  // par tâche suffit alors au rythme).
  const dicibles = cas.avant.taches.filter((t) => dicible(t, cas));
  const courtes = dicibles.filter((t) => nombreLus(t) <= PAS_MOTS);
  groupesAvant(courtes.length >= 2 ? courtes : dicibles).forEach((g, gi, tous) => {
    const morceaux = g.map((t) => minusculeInitiale(sigleLu(sansPointFinal(t))));
    const dernier = gi === tous.length - 1;
    const dit = `${gi === 0 ? "Avant : " : ""}${morceaux.join(", ")}${dernier ? "." : ","}`;
    let depuis = 0;
    const ev: [string, number][] = morceaux.map((m, i) => {
      const r = rangDe(dit, m, depuis);
      depuis = r + 1;
      return [`tache-${i + 1}`, r];
    });
    const total = dernier && cas.avant.total && dicible(cas.avant.total, cas) ? cas.avant.total : undefined;
    brouillons.push({ type: "liste-avant", texteDit: dit, taches: g.map((t) => couper(t, MOTS_MAX.ligne)), ...(total ? { total } : {}), evenements: evenements(dit, ev, total ? ["total"] : []) });
  });

  // La bascule.
  const bascule = BASCULE_GABARIT;
  brouillons.push({ type: "titre", texteDit: bascule, lignes: ["Voici la méthode"], orange: ["méthode"], eclair: true, evenements: [] });

  // Les étapes : la ligne de chaque étape (avec son détail si elle est trop courte). Tant que le corps n'a pas ses écrans
  // de détail (`details`, au moins le minimum d'écrans), le détail d'une étape devient un écran « objet » qui la suit.
  const etapes = cas.etapes.map((x, i) => ({ x, rang: i + 1 })).filter(({ x }) => dicible(x.ligne, cas) && dicible(x.titre, cas));
  const apres = 3 + (cas.conformite?.rgpd && blocs.has("conformite") ? 1 : 0);
  const minimum = ECRANS_CORPS.min - (brouillons.length + etapes.length + apres);
  let manque = details === undefined ? minimum + 1 : Math.max(details, minimum);
  // V4-3 : la partie humaine se dit à sa place dans la suite des étapes (R23), juste après l'étape `resteHumainApresEtape`.
  let placeReste: number | null = null;
  etapes.forEach(({ x, rang }, i) => {
    let dit = sigleLu(x.ligne);
    if (long && nombreLus(x.titre) + nombreLus(dit) <= 14) dit = `${sansPointFinal(sigleLu(x.titre))} : ${minusculeInitiale(dit)}`;
    const detailDicible = dicible(x.detail, cas) && nombreLus(x.detail) >= 4 && nombreLus(x.detail) <= 14;
    let detailDit = false;
    if (nombreLus(dit) < 4 && detailDicible && nombreLus(dit) + nombreLus(x.detail) <= 14) {
      dit = `${dit} ${sigleLu(x.detail)}`;
      detailDit = true;
    } else if (long && !detailDicible && dicible(x.detail, cas) && nombreLus(dit) + nombreLus(x.detail) <= 17) {
      dit = `${dit} ${sigleLu(x.detail)}`;
      detailDit = true;
    }
    const visuel = x.visuel.sorte === "objet" ? { sorte: "objet" as const, objet: x.visuel.objet } : { sorte: "ecran" as const, etapeCas: rang, repli: x.visuel.repli ?? "telephone-capture" };
    const titre = couper(x.titre, MOTS_MAX.titre);
    brouillons.push({ type: "etape", texteDit: dit, numero: i + 1, total: etapes.length, titre, ligne: couper(x.ligne, MOTS_MAX.ligne), visuel, puces: [], evenements: evenements(dit, [], ["ligne", ...relaisDuVisuel(visuel.sorte === "objet" ? visuel.objet : "telephone-capture")]) });
    // Remplissage 3 : la première étape est reprise en deux écrans, le geste puis la tâche « avant » qu'il évite.
    const evitee = remplissage >= 3 && i === 0 ? cas.avant.taches.find((t) => dicible(t, cas) && nombreLus(t) <= 10) : undefined;
    if (evitee) {
      const ditEvite = `${AMORCE_GESTE_GABARIT} ${minusculeInitiale(sigleLu(sansPointFinal(evitee)))}.`;
      const objet = visuel.sorte === "objet" ? visuel.objet : visuel.repli;
      brouillons.push({ type: "objet", texteDit: ditEvite, titre, ligne: couper(evitee, MOTS_MAX.ligne), visuel: { sorte: "objet", objet }, evenements: evenements(ditEvite, [], ["ligne", ...relaisDuVisuel(objet)]) });
    }
    if (manque > 0 && detailDicible && !detailDit) {
      const ditDetail = sigleLu(x.detail);
      const objet = visuel.sorte === "objet" ? visuel.objet : visuel.repli;
      brouillons.push({ type: "objet", texteDit: ditDetail, titre, ligne: couper(x.detail, MOTS_MAX.ligne), visuel: { sorte: "objet", objet }, evenements: evenements(ditDetail, [], ["ligne", ...relaisDuVisuel(objet)]) });
      manque--;
    }
    if (cas.resteHumainApresEtape !== undefined && rang <= cas.resteHumainApresEtape && i < etapes.length - 1) placeReste = brouillons.length;
    else if (cas.resteHumainApresEtape !== undefined && rang <= cas.resteHumainApresEtape) placeReste = null;
  });

  // Forme longue : les faits sans nombre, pas encore dits, en écrans « objet » sur le visuel de la dernière étape.
  if (long && etapes.length) {
    const dernier = etapes[etapes.length - 1].x.visuel;
    const objet = dernier.sorte === "objet" ? dernier.objet : (dernier.repli ?? "telephone-capture");
    const deja = texteCompare(brouillons.map((b) => b.texteDit).join(" "));
    for (const f of cas.faits) {
      const n = nombreLus(f.enonce);
      if (f.valeurs.length || n < 4 || n > 14 || !dicible(f.enonce, cas) || deja.includes(texteCompare(f.enonce))) continue;
      const dit = sigleLu(f.enonce);
      brouillons.push({ type: "objet", texteDit: dit, titre: couper(etapes[etapes.length - 1].x.titre, MOTS_MAX.titre), ligne: couper(f.enonce, MOTS_MAX.ligne), visuel: { sorte: "objet", objet }, evenements: evenements(dit, [], ["ligne", ...relaisDuVisuel(objet)]) });
    }
  }

  // Ce qui reste humain (annoncé en clair dans la forme longue, qui cherche quelques secondes de plus).
  const reste = long || nombreLus(cas.resteHumain) < 5 ? `${AMORCE_RESTE_HUMAIN_GABARIT} : ${minusculeInitiale(sigleLu(cas.resteHumain))}` : sigleLu(cas.resteHumain);
  const ecranReste: Brouillon = { type: "objet", texteDit: reste, titre: "La part humaine", ligne: couper(cas.resteHumain, MOTS_MAX.ligne), visuel: { sorte: "objet", objet: "liste-taches" }, evenements: evenements(reste, [], ["ligne", ...(long ? relaisDuVisuel("liste-taches") : [])]) };
  if (placeReste === null) brouillons.push(ecranReste);
  else brouillons.splice(placeReste, 0, ecranReste);

  // Conformité : la phrase validée, mot pour mot.
  const rgpd = cas.conformite?.rgpd?.phrase;
  if (rgpd && blocs.has("conformite")) {
    const motsPhrase = new Set(texteNormalise(rgpd).split(" "));
    const dansPhrase = (t: string) => texteNormalise(t).split(" ").every((m) => motsPhrase.has(m));
    const titre = ["Conforme au RGPD", "Conforme"].find(dansPhrase) ?? "Vérifié";
    const puces = ["100 % automatique", "Sans intervention"].every(dansPhrase) ? ["100 % automatique", "Sans intervention"] : ["Vérifié", "Validé"];
    brouillons.push({ type: "preuve", texteDit: rgpd, titre, puces, evenements: evenements(rgpd, [], ["puce-1", "puce-2"]) });
  }

  // Résultat : les barres portent des faits du cas (le total « avant », le fait du chiffre) ; sans fait, aucun nombre affiché.
  const total = cas.avant.total ? texteNormalise(cas.avant.total) : "";
  const faitAvant = total ? cas.faits.find((f) => f.valeurs.length > 0 && texteNormalise(f.enonce).includes(total)) : undefined;
  const ditResultat = `Résultat : ${minusculeInitiale(sigleLu(cas.resultat))}`;
  const tete = sansPointFinal(cas.resultat.split(",")[0]);
  brouillons.push({
    type: "resultat",
    texteDit: ditResultat,
    titre: nombreLus(tete) <= MOTS_MAX.titre ? tete : "Le résultat",
    avant: barreDuFait("Avant", faitAvant, HAUTEURS_BARRES_SANS_FAIT.avant),
    maintenant: barreDuFait("Maintenant", faitChiffre, HAUTEURS_BARRES_SANS_FAIT.maintenant),
    ligne: couper(cas.resultat, MOTS_MAX.ligne),
    eclair: true,
    evenements: evenements(ditResultat, [["barre-maintenant", 2]], ["ligne"]),
  });

  // Remplissage 2 : un titre de transition qui redit la promesse (aucun fait nouveau).
  if (remplissage >= 2 && dicible(cas.promesse, cas)) {
    const redite = `En résumé : ${minusculeInitiale(sigleLu(promesse))}.`;
    brouillons.push({ type: "titre", texteDit: redite, lignes: ["En résumé"], orange: ["résumé"], evenements: evenements(redite, [], ["titre-1"]) });
  }

  // Question (développée au remplissage 1).
  const question = remplissage >= 1 ? QUESTION_GABARIT_LONGUE : QUESTION_GABARIT;
  brouillons.push({ type: "question", texteDit: question, lignes: ["Et chez vous,", "dans votre entreprise"], question: "Quelle tâche pourrait tourner toute seule ?", evenements: evenements(question, remplissage >= 1 ? [["titre-2", 4], ["question", 9]] : [["question", 4]], []) });

  // Un objet vide sans ses textes (liste de tâches, programme) les reçoit ici, comme la complétion les poserait.
  let rang = 0;
  for (const b of brouillons as Record<string, unknown>[]) {
    if (b.type === "etape") rang++;
    const v = b.visuel as { sorte?: string; objet?: string; textes?: string[] } | undefined;
    if (v?.sorte === "objet" && v.objet && OBJETS_A_TEXTES.has(v.objet) && !v.textes?.length) v.textes = textesParDefautDuVisuel(b, cas, b.type === "etape" ? rang : undefined);
  }

  return {
    ...ficheFixe(fixe, cas),
    ecrans: brouillons.map((b, i) => ({ ...b, id: idEcranAttendu(i), fond: i % 2 === 0 ? "sombre" : "ivoire", marque: MARQUE, avanceMs: 0 }) as EcranCorps),
  };
}

/** Simulation du rôle : relit `<cas-id>` et `<fiche_fixe>` ; cas inconnu → texte vide (aucune fiche inventée). */
function simulerEcriture(entree: EntreeRole): FicheEcrans | string {
  const id = balise(entree.variable, "cas-id");
  const cas = id ? trouverCas(id) : undefined;
  if (!cas) return "";
  let fixe: FicheFixe = { videoId: "essai", versionId: "essai", habillage: "charte-duo/1", origine: "porte-a" };
  try {
    const lu = JSON.parse(balise(entree.variable, "fiche_fixe") ?? "{}") as Partial<FicheFixe>;
    fixe = { ...fixe, ...Object.fromEntries(Object.entries(lu).filter(([k]) => k in fixe)) };
  } catch {
    // Champs d'essai.
  }
  return ficheParGabarit(cas, fixe, lireDureeFins(balise(entree.variable, "duree_fins")));
}

/**
 * Rôle « écriture du cas concret » : modèle d'écriture du studio (configuration `tarifs.ts`), sortie en texte JSON, SANS
 * schéma envoyé (comme le découpage du tableau animé).
 */
export const roleEcritureCasConcret = {
  id: "ecriture-cas-concret",
  // 2 : cas sans fait chiffré (résultat en mots, barres sans nombre), 24/10/2026.
  // 3 : clarté et récit, 24/10/2026.
  version: 3,
  consigne: CONSIGNE_ECRITURE,
  modele: MODELE_ECRITURE,
  effort: "medium",
  maxTokens: MAX_TOKENS_ECRITURE,
  simuler: simulerEcriture,
} satisfies DefinitionRole;

/** Will, 14/10 (comme le tableau, #187) : dite entre sa charte et les règles du cas concret, quand les deux sont données. */
export const PRIORITE_REGLES_CAS_CONCRET = "Pour ce format, les règles du cas concret (la consigne) passent avant la charte générale quand elles diffèrent.";

/**
 * Contexte d'un appel : le socle de Will (charte suivie de la priorité du format, style, preuves, modèles de ton), sinon
 * rien (comme avant). Le socle n'est jamais bloquant.
 */
export function contexteDuSocle(socle: EntreeRole["contexte"] | undefined): EntreeRole["contexte"] {
  if (!socle) return {};
  const charte = socle.contexteAxion?.trim();
  return { ...socle, ...(charte ? { contexteAxion: `${charte}

${PRIORITE_REGLES_CAS_CONCRET}` } : {}) };
}

/** Le socle de l'outil, lu sans jamais faire échouer l'écriture. */
async function socleDe(outils: Pick<OutilsEcriture, "socle">): Promise<EntreeRole["contexte"]> {
  try {
    return contexteDuSocle(outils.socle ? await outils.socle() : undefined);
  } catch {
    return {};
  }
}

/** Coût PIRE d'un appel (consigne, phrases fixes et entrée estimées au pire + sortie maximale), en dollars. */
export function coutEstimeUsd(role: DefinitionRole, entree: EntreeRole): number {
  const texte = [role.consigne, ...PHRASES_FIXES, ...Object.values(entree.contexte), entree.variable].filter(Boolean).join("\n");
  return pireCasUsd(role.modele, jetonsEstimes(texte), role.maxTokens);
}

/* ------------------------------------------------------------------ */
/* Lecture et jugement d'une réponse                                     */
/* ------------------------------------------------------------------ */

type Lecture = { ok: true; brute: unknown; texte: string } | { ok: false; refus: string; texte: string };

/** Raison d'arrêt d'une réponse qui a atteint le plafond de jetons de sortie. */
const ARRET_PLAFOND = "max_tokens";
/** Refus d'une réponse coupée au plafond de jetons (elle n'est jamais lue : son JSON est incomplet ou trompeur). */
export const REPONSE_COUPEE = "La réponse a été coupée avant la fin.";
/** Relance après une réponse coupée : la même fiche, plus courte. */
const RELANCE_COUPEE = `${REPONSE_COUPEE} Rends une fiche plus courte : phrases plus brèves, aucun champ facultatif superflu, JSON seul et complet.`;

/**
 * X3 : ce que la réponse d'un appel porte. `donnees` (objet déjà lu, simulation) d'abord, sinon le TEXTE brut : un rôle
 * sans schéma n'a jamais de `donnees` en production. Même chemin que le découpage du tableau animé.
 */
const contenuDe = (reponse: Extract<ReponseAppelEcriture, { ok: true }>): unknown => reponse.donnees ?? reponse.texte;
const estCoupee = (reponse: Extract<ReponseAppelEcriture, { ok: true }>) => reponse.stopReason === ARRET_PLAFOND;

/**
 * Texte débarrassé d'une clôture Markdown qui l'enveloppe ENTIÈREMENT (trois accents graves, « json », le texte, trois
 * accents graves), sans rien d'autre autour. Essai réel du 14/10 : le vrai Claude a rendu deux fois un JSON correct
 * sous cette clôture (0,44 € perdus). Seule cette enveloppe est retirée ; un texte avant ou après reste refusé.
 */
export function sansCloture(texte: string): string {
  const m = /^\s*```[a-zA-Z]*[ \t]*\r?\n([\s\S]*?)\r?\n?[ \t]*```\s*$/.exec(texte);
  return m ? m[1]! : texte;
}

/** Cas sans fait chiffré et réponse « PREUVE_MANQUANTE » : dit à Claude que ce n'est pas une preuve manquante. */
export function refusSansFait(texte: string, cas: Pick<CasConcret, "faits">): string[] {
  return casSansFaitChiffre(cas) && texte.includes("PREUVE_MANQUANTE") ? ["Ce cas n'a aucun fait chiffré : ce n'est pas une preuve manquante. Rendez la fiche (voir SANS FAIT CHIFFRÉ)."] : [];
}

/** Lit la réponse : objet déjà lu, ou texte JSON (clôture Markdown entière retirée). Aucune autre réparation. */
export function lireReponse(donnees: unknown): Lecture {
  if (donnees === undefined || donnees === null || donnees === "") return { ok: false, refus: "La réponse est vide : aucune fiche rendue.", texte: "" };
  if (typeof donnees !== "string") return { ok: true, brute: donnees, texte: JSON.stringify(donnees) };
  try {
    const nu = sansCloture(donnees);
    return { ok: true, brute: JSON.parse(nu), texte: nu };
  } catch (e) {
    return { ok: false, refus: `La réponse n'est pas un JSON lisible (${e instanceof Error ? e.message : "erreur de lecture"}) : rendez le JSON seul, sans texte autour.`, texte: donnees };
  }
}

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** Champs figés recopiés tels quels. */
export function controlesEcriture(brute: unknown, e: EntreeEcriture): string[] {
  if (!estObjet(brute)) return ["La réponse n'est pas un objet JSON : une fiche d'écrans est attendue."];
  const refus: string[] = [];
  for (const [cle, attendu] of Object.entries(ficheFixe(e, e.cas))) {
    if (brute[cle] !== attendu) refus.push(`Le champ « ${cle} » vaut ${JSON.stringify(brute[cle]) ?? "rien"}, attendu ${JSON.stringify(attendu)} (recopié tel quel).`);
  }
  return refus;
}

/** « valeur » ou « faitId » absent sur un écran que la passe des champs du cas a déjà refusé (son fait manque) : redit. */
const valeurAbsenteRedite = (p: { sceneId?: string; message: string }, refuses: ReadonlySet<string>) => !!p.sceneId && refuses.has(p.sceneId) && /« (valeur|faitId) » : champ obligatoire absent/.test(p.message);

/**
 * B3 · positionnement de Will, en ALERTE seulement (jamais un refus) : un texte dit ou écrit qui renvoie le spectateur à le
 * faire seul, ou qui annonce un outil nouveau. Mêmes détecteurs que `qualite-script/regles/positionnement.ts` (diyImperatif
 * lit aussi un enchaînement d'impératifs).
 */
export function alertesPositionnement(f: FicheEcrans): string[] {
  const alertes: string[] = [];
  for (const e of f.ecrans) {
    for (const t of [e.texteDit, ...textesEcrits(e)]) {
      if (diyImperatif(t, "vous")) alertes.push(`Positionnement (alerte) · écran ${e.id} : « ${t} » renvoie le spectateur à le faire seul : dites ce que nous mettons en place pour lui.`);
      else if (NOUVEAUTE_OUTIL.exec(normaliser(t))?.[1]) alertes.push(`Positionnement (alerte) · écran ${e.id} : « ${t} » annonce un outil nouveau : montrez ce que nous faisons pour lui, pas l'outil.`);
    }
  }
  return alertes;
}

/**
 * Juge une réponse lue : d'abord la passe des champs tirés du cas (X9), puis les champs figés, puis la validation complète
 * (le script est le texte dit de la fiche elle-même). `notes` : les écarts corrigés par la passe.
 */
export function jugerFiche(lue: unknown, e: EntreeEcriture): { ok: true; fiche: FicheEcrans; notes: string[] } | { ok: false; refus: string[]; notes: string[] } {
  const c = completerFiche(lue, e);
  const refuses = new Set(c.ecransRefuses);
  const propres = [...c.refus, ...controlesEcriture(c.brute, e)];
  const forme = validerSchemaFiche(c.brute);
  if (!forme.ok) return { ok: false, refus: [...propres, ...forme.problemes.filter((p) => !valeurAbsenteRedite(p, refuses)).map((p) => p.message)], notes: c.notes };
  const v = validerFicheEcrans(c.brute, { ...e.controle, cas: e.cas, texteScript: texteDuCorps(forme.fiche) });
  const refus = [...propres, ...(v.ok ? [] : v.problemes.map((p) => p.message))];
  const notes = [...c.notes, ...alertesPositionnement(forme.fiche)];
  return refus.length || !v.ok ? { ok: false, refus, notes } : { ok: true, fiche: v.fiche, notes };
}

/* ------------------------------------------------------------------ */
/* Écriture                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Variété : mémoire, formes, ressemblance                               */
/* ------------------------------------------------------------------ */

/** Séquences citées au plus dans un refus de ressemblance ou dans une note. */
const COPIES_CITEES_MAX = 6;

/** Textes que le cas courant DOIT redire (jamais comptés comme une reprise) : promesse, faits, partie humaine, conformité, mot. */
export function textesImposesDuCas(cas: CasConcret): string[] {
  return [cas.promesse, cas.recit?.sujet, ...cas.faits.map((f) => f.enonce), cas.resteHumain, cas.conformite?.rgpd?.phrase, cas.mot, cas.motDit].filter((t): t is string => typeof t === "string" && t.trim().length > 0);
}

/** La variété d'un appel : graine = la vidéo (+ le numéro de « Réessayer »), mémoire des scripts antérieurs. */
function varieteDe(entree: EntreeEcriture, commune: MemoireCentrale | null = null): { options: VarieteEcriture; anterieurs: readonly string[]; tolere: string[] } {
  const anterieurs = entree.scriptsAnterieurs ?? [];
  const tolere = textesImposesDuCas(entree.cas);
  const sel = entree.reprise ?? 0;
  return {
    anterieurs,
    tolere,
    options: {
      patrons: patronsDeLaVideo(entree.videoId, sel, entree.structure, entree.cas.offre, { sansChiffre: casSansFaitChiffre(entree.cas), recit: !!entree.cas.recit }),
      ...(entree.structure ? { structure: blocStructure(entree.structure, entree.cas.offre) } : {}),
      placeResteHumain: placeDuResteHumain(entree.videoId, sel, entree.cas.resteHumainApresEtape, entree.cas.etapes.length),
      memoire: memoireAntiCopie(anterieurs, { tolere }),
      ...(ajoutVariable(commune ?? undefined) ? { memoireCommune: ajoutVariable(commune ?? undefined) } : {}),
    },
  };
}

const citees = (copies: readonly Sequence[]) => copies.slice(0, COPIES_CITEES_MAX).map((c) => `« ${c.texte} »`).join(", ");

/** Refus de qualité (relance) : une ligne par séquence reprise d'un script antérieur. */
function refusRessemblance(copies: readonly Sequence[]): string[] {
  return copies.slice(0, COPIES_CITEES_MAX).map((c) => `Ressemblance avec une autre vidéo : « ${c.texte} » (${c.mots} mots de suite) est repris d'un script déjà écrit. Dis-le autrement, avec d'autres mots et une autre construction.`);
}

/** Note de l'étape quand la ressemblance reste : Will la voit avant de valider. */
export function noteRessemblance(copies: readonly Sequence[], relanceFaite: boolean): string {
  return `Ressemblance restante avec d'autres vidéos${relanceFaite ? " après la relance" : ""} (à voir avant de valider) : ${citees(copies)}.`;
}

/**
 * Séquences d'un script rendu reprises d'un script antérieur. Jamais pour une réponse SIMULÉE : le gabarit de la simulation
 * est fixe (sa question finale est celle de la v4), une relance rendrait le même texte et ne coûterait qu'un faux refus.
 */
function copiesDuScript(fiche: FicheEcrans, v: { anterieurs: readonly string[]; tolere: readonly string[] }, simule: boolean): Sequence[] {
  return !simule && v.anterieurs.length ? copiesDe(texteDuCorps(fiche), v.anterieurs, { tolere: v.tolere }) : [];
}

/** Lot C4 · ce que le format impose ou répète à l'identique (phrases fixes) et ce que ce cas doit redire : jamais compté comme une reprise. */
export const phrasesImposeesDuCas = (cas: CasConcret): string[] => [...PHRASES_FIXES_CAS_CONCRET, ...textesImposesDuCas(cas)];

/** Lot C4 · la mémoire commune de cette écriture, ou `null` (pas d'outil, réglage coupé, script de Will, panne : silencieux). */
async function memoireCommuneDe(entree: EntreeEcriture, outils: OutilsEcriture): Promise<MemoireCentrale | null> {
  if (!outils.memoireCommune) return null;
  try {
    const m = await outils.memoireCommune.preparer(phrasesImposeesDuCas(entree.cas), entree.videoId);
    return m && memoireCentraleApplicable(FORMAT_CAS_CONCRET, m.origine) ? m : null;
  } catch {
    return null;
  }
}

/**
 * Lot C4 · après une écriture acceptée (jamais une réponse simulée) : ressemblance avec les scripts récents de TOUS les formats
 * en ALERTE dans les `notes` (aucune relance, aucun appel de plus), puis enregistrement du texte dit dans la mémoire commune.
 * Les phrases imposées sont exclues de la mesure. Tout échec est silencieux.
 */
async function apresEcriture(r: Extract<ResultatEcriture, { ok: true }>, entree: EntreeEcriture, outils: OutilsEcriture, commune: MemoireCentrale | null): Promise<ResultatEcriture> {
  if (!outils.memoireCommune || r.simule) return r;
  const texte = texteDuCorps(r.fiche);
  let res = r;
  try {
    if (commune?.anciens.length) {
      const m = mesurerRessemblance(anonymiserPourMemoire(texte, []), commune, phrasesImposeesDuCas(entree.cas));
      if (m.forte) res = { ...r, notes: [...r.notes, m.message] };
    }
  } catch {
    // la mémoire ne bloque jamais l'écriture
  }
  try {
    await outils.memoireCommune.enregistrer(texte);
  } catch {
    // idem
  }
  return res;
}

/**
 * Écrit la fiche d'écrans brute d'un cas (voir l'en-tête). Au plus 2 appels Claude, chacun précédé de sa réservation.
 * `ok: false` : la main revient à Will avec les refus en français.
 */
export async function ecrireFiche(entree: EntreeEcriture, outils: OutilsEcriture): Promise<ResultatEcriture> {
  const commune = await memoireCommuneDe(entree, outils);
  const r = (entree.reprise ?? 0) >= 1 ? await reprendreEcriture(entree, outils, entree.reprise!, commune) : await ecrireFicheInterne(entree, outils, commune);
  return r.ok ? apresEcriture(r, entree, outils, commune) : r;
}

async function ecrireFicheInterne(entree: EntreeEcriture, outils: OutilsEcriture, commune: MemoireCentrale | null): Promise<ResultatEcriture> {
  const role = roleEcritureCasConcret;
  const variete = varieteDe(entree, commune);
  const base = variableEcriture(entree.cas, recettePour(entree.cas, entree.structure), entree, entree.controle?.fins ?? [], variete.options);
  let variable = base;
  let refus: string[] = [];
  let appels = 0;
  /** Texte rendu par le dernier essai (diagnostic d'un refus). */
  let derniere: string | undefined;
  /** Coût réel rendu par les appels (X2 : chacun compté une fois). */
  let coutUsd: number | undefined;
  /** Premier script valide mais trop proche d'un script antérieur : gardé si la relance n'aboutit pas mieux. */
  let proche: { fiche: FicheEcrans; notes: string[]; copies: Sequence[] } | undefined;
  const garde = (simule: boolean): ResultatEcriture | undefined =>
    proche && { ok: true, fiche: proche.fiche, appels, relance: appels > 1, simule, ...(coutUsd !== undefined ? { coutUsd } : {}), notes: [...proche.notes, noteRessemblance(proche.copies, appels > 1)] };

  for (let essai = 1; essai <= APPELS_ECRITURE_MAX; essai++) {
    const entreeRole: EntreeRole = { contexte: await socleDe(outils), variable };
    const appelId = idAppelEcriture(entree, essai);
    const reservation = await outils.budget.reserver({ appelId, videoId: entree.videoId, etape: ETAPE_ECRITURE, modele: role.modele, coutEstimeUsd: coutEstimeUsd(role, entreeRole) });
    if (!reservation.ok) return garde(false) ?? { ok: false, motif: "budget", message: `Écriture non lancée : ${reservation.message}`, refus, appels, ...brute(derniere) };

    appels++;
    const reponse = await outils.appeler(role, entreeRole);
    if (!reponse.ok) return garde(false) ?? { ok: false, motif: "appel", message: `Écriture interrompue : ${reponse.message}`, refus, appels, ...brute(derniere) };
    if (reponse.coutUsd !== undefined) coutUsd = (coutUsd ?? 0) + reponse.coutUsd;

    // Réponse coupée : jamais lue (JSON incomplet) ni renvoyée telle quelle ; la relance demande une fiche plus courte.
    if (estCoupee(reponse)) {
      derniere = typeof reponse.texte === "string" ? reponse.texte : undefined;
      refus = [REPONSE_COUPEE];
      variable = variableRelance(base, "(réponse coupée, non reprise)", [RELANCE_COUPEE]);
      continue;
    }

    const lecture = lireReponse(contenuDe(reponse));
    derniere = lecture.texte;
    const jugement = lecture.ok ? jugerFiche(lecture.brute, entree) : { ok: false as const, refus: [lecture.refus, ...refusSansFait(lecture.texte, entree.cas)] };
    if (jugement.ok) {
      const copies = copiesDuScript(jugement.fiche, variete, reponse.simule);
      const resultat = { ok: true as const, fiche: jugement.fiche, appels, relance: essai > 1, simule: reponse.simule, ...(coutUsd !== undefined ? { coutUsd } : {}) };
      if (!copies.length) return { ...resultat, notes: jugement.notes };
      // Refus de qualité : la relance existante (jamais un appel de plus) ; la ressemblance restante n'est pas un échec.
      if (essai >= APPELS_ECRITURE_MAX) return { ...resultat, notes: [...jugement.notes, noteRessemblance(copies, essai > 1)] };
      proche = { fiche: jugement.fiche, notes: jugement.notes, copies };
      refus = refusRessemblance(copies);
      variable = variableRelance(base, lecture.texte, refus);
      continue;
    }

    refus = jugement.refus;
    variable = variableRelance(base, lecture.texte, refus);
  }

  return garde(false) ?? { ok: false, motif: "refusee", message: `${DEBUT_REFUS_ECRITURE} après ${APPELS_ECRITURE_MAX} essais (${refus.length} refus) : à reprendre à la main.`, refus, appels, ...brute(derniere) };
}

/** Début de la phrase d'une écriture refusée (premier passage ou reprise) : le moteur y ajoute le prix d'un nouvel essai. */
export const DEBUT_REFUS_ECRITURE = "Fiche d'écrans refusée";

/** Identifiant d'un appel d'écriture : `essai` du premier passage (1, 2), ou `r<n>` pour le n-ième « Réessayer ». */
export const idAppelEcriture = (entree: Pick<EntreeEcriture, "videoId" | "versionId">, essai: number | `r${number}`) => `${PREFIXE_APPEL_ECRITURE}-${entree.videoId}-${entree.versionId}-${essai}`;

/** Note du journal quand une réponse déjà payée passe avec les règles du jour. */
export const NOTE_REPONSE_REPRISE = "Réponse d'écriture déjà payée reprise avec les règles du jour : aucun nouvel appel.";

/**
 * X12 · « Réessayer » après un arrêt de l'écriture (`reprise` ≥ 1). Le premier passage rejouait sinon les MÊMES réponses
 * refusées (même refus, aucun effet), ou, si la consigne avait changé depuis (journal écrit par une version antérieure
 * du code), relançait deux appels en silence.
 *  1. Les réponses déjà payées (premier passage, puis chaque reprise précédente) sont RELUES, sans appel ni réservation,
 *     et jugées avec le code du jour : la passe des champs tirés du cas (X9) complète `valeur` ; l'une passe → finie.
 *  2. Sinon : UN nouvel appel (identifiant `r<reprise>`, réservé avant), avec la consigne du jour et les refus de la
 *     dernière réponse relue. Refusé → échec motivé ; un autre « Réessayer » refait au plus un appel.
 */
async function reprendreEcriture(entree: EntreeEcriture, outils: OutilsEcriture, reprise: number, commune: MemoireCentrale | null): Promise<ResultatEcriture> {
  const role = roleEcritureCasConcret;
  const variete = varieteDe(entree, commune);
  const base = variableEcriture(entree.cas, recettePour(entree.cas, entree.structure), entree, entree.controle?.fins ?? [], variete.options);
  /** Notes d'une réponse qui passe : la ressemblance éventuelle est dite, jamais refusée (pas de nouvel appel pour elle). */
  const notesDe = (j: { fiche: FicheEcrans; notes: string[] }, simule: boolean) => {
    const copies = copiesDuScript(j.fiche, variete, simule);
    return copies.length ? [...j.notes, noteRessemblance(copies, false)] : j.notes;
  };
  const anciennes = [...Array.from({ length: APPELS_ECRITURE_MAX }, (_, i) => idAppelEcriture(entree, i + 1)), ...Array.from({ length: reprise - 1 }, (_, i) => idAppelEcriture(entree, `r${i + 1}`))];
  let derniere: { texte: string; refus: string[] } | undefined;
  for (const id of anciennes) {
    const r = outils.relire ? await outils.relire(id) : null;
    if (!r?.ok || estCoupee(r)) continue;
    const lecture = lireReponse(contenuDe(r));
    const jugement = lecture.ok ? jugerFiche(lecture.brute, entree) : { ok: false as const, refus: [lecture.refus, ...refusSansFait(lecture.texte, entree.cas)] };
    if (jugement.ok) return { ok: true, fiche: jugement.fiche, appels: 0, relance: true, simule: r.simule, notes: [...notesDe(jugement, r.simule), NOTE_REPONSE_REPRISE] };
    derniere = { texte: lecture.texte, refus: jugement.refus };
  }

  const variable = derniere ? variableRelance(base, derniere.texte, derniere.refus) : base;
  const entreeRole: EntreeRole = { contexte: await socleDe(outils), variable };
  const appelId = idAppelEcriture(entree, `r${reprise}`);
  const reservation = await outils.budget.reserver({ appelId, videoId: entree.videoId, etape: ETAPE_ECRITURE, modele: role.modele, coutEstimeUsd: coutEstimeUsd(role, entreeRole) });
  const refusPrecedents = derniere?.refus ?? [];
  if (!reservation.ok) return { ok: false, motif: "budget", message: `Écriture non lancée : ${reservation.message}`, refus: refusPrecedents, appels: 0, ...brute(derniere?.texte) };
  const reponse = await outils.appeler(role, entreeRole);
  if (!reponse.ok) return { ok: false, motif: "appel", message: `Écriture interrompue : ${reponse.message}`, refus: refusPrecedents, appels: 1, ...brute(derniere?.texte) };
  const coutUsd = reponse.coutUsd;
  if (estCoupee(reponse)) return { ok: false, motif: "refusee", message: `${DEBUT_REFUS_ECRITURE} au nouvel essai : réponse coupée.`, refus: [REPONSE_COUPEE], appels: 1, ...brute(typeof reponse.texte === "string" ? reponse.texte : undefined) };
  const lecture = lireReponse(contenuDe(reponse));
  const jugement = lecture.ok ? jugerFiche(lecture.brute, entree) : { ok: false as const, refus: [lecture.refus, ...refusSansFait(lecture.texte, entree.cas)] };
  if (jugement.ok) return { ok: true, fiche: jugement.fiche, appels: 1, relance: true, simule: reponse.simule, ...(coutUsd !== undefined ? { coutUsd } : {}), notes: notesDe(jugement, reponse.simule) };
  return { ok: false, motif: "refusee", message: `${DEBUT_REFUS_ECRITURE} au nouvel essai (${jugement.refus.length} refus) : à reprendre à la main.`, refus: jugement.refus, appels: 1, ...brute(lecture.texte) };
}

/** La réponse brute d'un essai, tronquée à `REPONSE_BRUTE_MAX` caractères ; rien si elle est vide. */
function brute(texte: string | undefined): { reponseBrute?: string } {
  if (!texte) return {};
  return { reponseBrute: texte.length > REPONSE_BRUTE_MAX ? `${texte.slice(0, REPONSE_BRUTE_MAX)}…` : texte };
}

/* ------------------------------------------------------------------ */
/* Reformulation d'une phrase                                            */
/* ------------------------------------------------------------------ */

export const CONSIGNE_REFORMULATION = `Tu reformules UNE phrase dite par une voix de synthèse, parce que sa lecture a été rejetée (mot mal prononcé, rythme cassé). La phrase est dans <phrase>, les faits du cas dans <faits>.

RÈGLES ABSOLUES :
- Mêmes nombres, ni plus ni moins, écrits de la même façon.
- Pas plus de mots que la phrase d'origine.
- Même sens ; aucun fait ajouté ; vouvoiement ; aucun nom propre ; un sigle s'écrit pour être lu (« I.A. »).
- Aucune invitation à commenter, à cliquer ou à réserver.
- Quand <faits> vaut « (aucun) », ou que chaque fait porte « valeurs aucune », la phrase n'a aucun nombre et n'en reçoit aucun ; ce n'est pas une preuve manquante : rendez la phrase.

FORME : JSON seul, { "phrase": "…" }.`;

/** Simulation : la phrase rendue telle quelle (mêmes nombres, mêmes mots). */
function simulerReformulation(entree: EntreeRole): { phrase: string } | string {
  const phrase = balise(entree.variable, "phrase");
  return phrase ? { phrase } : "";
}

export const roleReformulationCasConcret = {
  id: "reformulation-cas-concret",
  version: 2,
  consigne: CONSIGNE_REFORMULATION,
  modele: MODELE_ECRITURE,
  effort: "low",
  maxTokens: MAX_TOKENS_REFORMULATION,
  simuler: simulerReformulation,
} satisfies DefinitionRole;

/** Nombres d'une phrase, triés (comparés comme une liste). */
const nombresTries = (t: string) => nombresDe(sansPointsDeSigle(t)).sort((a, b) => a - b);

/** Juge une reformulation : mêmes nombres, pas plus de mots. */
export function jugerReformulation(origine: string, proposee: string): string | undefined {
  if (!proposee.trim()) return "La reformulation est vide.";
  const a = nombresTries(origine);
  const b = nombresTries(proposee);
  if (a.length !== b.length || a.some((n, i) => n !== b[i])) return `La reformulation change les nombres (${a.join(", ") || "aucun"} → ${b.join(", ") || "aucun"}) : refusée.`;
  if (nombreLus(proposee) > nombreLus(origine)) return `La reformulation compte ${nombreLus(proposee)} mots, la phrase d'origine ${nombreLus(origine)} : refusée.`;
  return undefined;
}

/** Lit la phrase rendue : `{ phrase }`, son texte JSON, ou le texte seul. */
function lirePhrase(donnees: unknown): string | undefined {
  if (estObjet(donnees)) return typeof donnees.phrase === "string" ? donnees.phrase.trim() : undefined;
  if (typeof donnees !== "string" || !donnees.trim()) return undefined;
  try {
    const lu: unknown = JSON.parse(donnees);
    return estObjet(lu) && typeof lu.phrase === "string" ? lu.phrase.trim() : undefined;
  } catch {
    // Une réponse hors JSON (« PREUVE_MANQUANTE : … ») est un refus, jamais une phrase.
    return undefined;
  }
}

/** Où rattacher la dépense de la reformulation. */
export interface AppelReformulation {
  videoId: string;
  /** Identifiant unique de l'appel (même identifiant = même réservation). */
  appelId: string;
}

/**
 * Reformule une phrase rejetée en UN appel borné (réservé avant), mêmes nombres, pas plus de mots. Refusée → échec motivé,
 * jamais de second appel.
 */
export async function reformulerPhrase(phrase: string, faits: readonly FaitCas[], outils: OutilsEcriture, appel: AppelReformulation): Promise<{ ok: true; phrase: string } | { ok: false; raison: string }> {
  const role = roleReformulationCasConcret;
  const variable = `<phrase>${phrase}</phrase>\n<faits>\n${faits.map((f) => `${f.id} · source ${f.source} · valeurs ${f.valeurs.join(", ") || "aucune"} · ${f.enonce}`).join("\n") || "(aucun)"}\n</faits>`;
  const entreeRole: EntreeRole = { contexte: await socleDe(outils), variable };
  const reservation = await outils.budget.reserver({ appelId: `${PREFIXE_APPEL_REFORMULATION}-${appel.appelId}`, videoId: appel.videoId, etape: ETAPE_REFORMULATION, modele: role.modele, coutEstimeUsd: coutEstimeUsd(role, entreeRole) });
  if (!reservation.ok) return { ok: false, raison: `Reformulation non lancée : ${reservation.message}` };
  const reponse = await outils.appeler(role, entreeRole);
  if (!reponse.ok) return { ok: false, raison: `Reformulation interrompue : ${reponse.message}` };
  if (estCoupee(reponse)) return { ok: false, raison: REPONSE_COUPEE };
  const proposee = lirePhrase(contenuDe(reponse));
  if (!proposee) {
    const texte = contenuDe(reponse);
    const extrait = typeof texte === "string" && texte.trim() ? ` (réponse : « ${texte.trim().slice(0, 200)} »)` : "";
    return { ok: false, raison: `La reformulation n'a rendu aucune phrase${extrait}.` };
  }
  const refus = jugerReformulation(phrase, proposee);
  return refus ? { ok: false, raison: refus } : { ok: true, phrase: proposee };
}
