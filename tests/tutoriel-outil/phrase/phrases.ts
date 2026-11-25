/**
 * T-EXT-V2-10 · PIÈCES FIXES de l'essai « je pars d'une phrase » : les phrases, ce que rendent les doubles (description de la
 * maquette, flux, scripts), l'image d'aperçu et la navigation filmée. Aucun appel, aucun réseau, aucun réglage : des données.
 *
 * Marque : vouvoiement, aucun montant, chiffres marqués « exemple », noms neutres seulement (« Espace démo · <métier> »,
 * « Entreprise exemple »), courriels en `@exemple.invalid`, aucune étiquette « Douleur · Solution · Exemple · À vous ».
 * Tout texte d'ici est une PROPOSITION : dans l'essai, le double de Williams la voit mot pour mot et la garde avant toute voix.
 */
import { VERSION_NAVIGATION, type NavigationFilmee } from "../../../src/briques/plan-scenes/tutoriel/navigation-filmee";
import { VERSION_DESCRIPTION_MAQUETTE, ENTREPRISE_EXEMPLE, PREFIXE_NOM_MAQUETTE } from "../../../src/moteurs/montage-tutoriel-outil/description-maquette";
import { VERSION_FLUX } from "../../../src/moteurs/montage-tutoriel-outil/gabarit-flux";

/* ------------------------------------------------------------------ */
/* Les phrases (décision de Williams du 18/11, question 5)             */
/* ------------------------------------------------------------------ */

/** Cas 2 : un tableau de bord à créer. */
export const PHRASE_ATELIER = "un tableau de bord pour un atelier";
/** Cas 3 : une automatisation sans tableau de bord. */
export const PHRASE_TRI = "je veux un tri d'e-mails";
/** Cas 4 : un assistant. Hors V2 (décision de Williams, question 2) : la demande est gardée, rien n'est créé. */
export const PHRASE_ASSISTANT = "un assistant pour mes clients";

/* ------------------------------------------------------------------ */
/* Cas 2 : ce que rend le double du maquettiste                        */
/* ------------------------------------------------------------------ */

/** Chiffres d'exemple de la maquette (jamais un montant) : ceux que le script du double a le droit de dire. */
export const CHIFFRE_AVANT = 18;
export const CHIFFRE_MAINTENANT = 4;

/** Première proposition : `description-maquette.v1`, 3 zones, un chiffre présent dans les deux états sous le même libellé. */
export function descriptionAtelier(): Record<string, unknown> {
  return {
    version: VERSION_DESCRIPTION_MAQUETTE,
    nom: `${PREFIXE_NOM_MAQUETTE}Atelier`,
    entreprise: ENTREPRISE_EXEMPLE,
    metier: "Atelier",
    ecrans: [
      {
        id: "accueil",
        modele: "tableau-de-bord",
        titre: "Votre atelier du jour",
        zones: [
          {
            id: "commandes",
            type: "kpi",
            libelle: "Commandes du jour",
            donnees: [
              { id: "a-preparer-avant", libelle: "À préparer", valeur: CHIFFRE_AVANT, exemple: true, etat: "avant" },
              { id: "a-preparer-maintenant", libelle: "À préparer", valeur: CHIFFRE_MAINTENANT, exemple: true, etat: "maintenant" },
            ],
          },
          { id: "retards", type: "liste", libelle: "Retards à suivre", donnees: [{ id: "piece-attendue", libelle: "Pièce attendue", valeur: "À relancer" }] },
          {
            id: "semaine",
            type: "graphique",
            libelle: "Charge de la semaine",
            donnees: [
              { id: "lundi", libelle: "Lundi", valeur: 6, exemple: true },
              { id: "mardi", libelle: "Mardi", valeur: 9, exemple: true },
            ],
          },
        ],
      },
    ],
    etats: { avant: "Avant : tout au tableau blanc", maintenant: "Maintenant : tout est à jour" },
  };
}

/** L'« autre proposition » (la seule permise) : la même demande, montrée autrement. */
export function descriptionAtelierAutre(): Record<string, unknown> {
  const d = descriptionAtelier() as { ecrans: { titre: string; zones: { libelle: string }[] }[] };
  d.ecrans[0]!.titre = "Votre semaine en atelier";
  d.ecrans[0]!.zones[1]!.libelle = "Pièces à relancer";
  return d as unknown as Record<string, unknown>;
}

/** Nom réel glissé dans la proposition : elle doit être refusée (« à revoir »), rien n'est construit ni dit. */
export const NOM_REEL = "Dupont Menuiserie";
export function descriptionAvecNomReel(): Record<string, unknown> {
  const d = descriptionAtelier() as { ecrans: { titre: string }[] };
  d.ecrans[0]!.titre = `Atelier ${NOM_REEL}`;
  return d as unknown as Record<string, unknown>;
}

/** Texte de la maquette que le double de Williams corrige, et son texte à lui (il fait foi, mot pour mot). */
export const TEXTE_AVANT_CORRECTION = "Retards à suivre";
export const TEXTE_CORRIGE = "Retards à rattraper";

/* ------------------------------------------------------------------ */
/* Cas 3 : ce que rend le double du maquettiste                        */
/* ------------------------------------------------------------------ */

export const DOMAINE_EXEMPLE = "@exemple.invalid";

/** `flux-automatisation.v1` sur les vues du bureau exemple : une étape faite par un humain, aucun chiffre, courriels d'exemple. */
export function fluxTri(): Record<string, unknown> {
  return {
    version: VERSION_FLUX,
    avant: { vue: "boite", etat: "avant", surMot: "Chaque" },
    declencheur: { vue: "boite", etat: "nouveau", surMot: "arrive" },
    etapes: [
      { id: "lecture", vue: "boite", etat: "ouvert", acteur: "ia", libelleSchema: "Lecture du message", surMot: "lit" },
      { id: "classement", vue: "boite", etat: "etiquete", acteur: "automatisation", libelleSchema: "Classement", surMot: "range" },
      { id: "brouillon", vue: "boite", etat: "brouillon", acteur: "ia", libelleSchema: "Brouillon de réponse", surMot: "brouillon" },
      { id: "relecture", vue: "boite", etat: "brouillon", acteur: "humain", libelleSchema: "Votre relecture", surMot: "relisez" },
      { id: "prevenu", vue: "messagerie", etat: "notification", acteur: "automatisation", libelleSchema: "Message à l'équipe", surMot: "prévenue" },
    ],
    moments: ["classement", "brouillon", "relecture"],
    resultat: { vue: "messagerie", etat: "tache-creee", surMot: "sereine" },
    contenus: {
      boite: {
        messages: [{ id: "m1", de: "Client exemple", objet: "Demande de rendez-vous", adresse: `contact${DOMAINE_EXEMPLE}`, corps: "Bonjour, pouvez-vous me rappeler cette semaine", dossier: "d1" }],
        nouveau: "m1",
        dossiers: [{ id: "d1", nom: "Demandes" }],
        brouillon: { texte: "Bonjour, merci de votre message" },
      },
      messagerie: {
        fil: [{ de: "Équipe exemple", texte: "Bonjour à tous" }],
        notification: { de: "Automatisation", texte: "Un brouillon attend votre relecture" },
        tache: { titre: "Relire le brouillon", responsable: "Vous" },
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Scripts du double du scénariste                                     */
/* ------------------------------------------------------------------ */

export interface MomentFiche {
  id: string;
  zoneId: string;
}

interface PhraseDuDouble {
  texte: string;
  temps: "situation" | "changement" | "gain";
  apport: string;
  zoneId?: string;
  momentId?: string;
}

const situation = (texte: string): PhraseDuDouble => ({ texte, temps: "situation", apport: "Le spectateur reconnaît sa journée." });

/** Phrase qui dit les deux chiffres d'exemple de la maquette (cas 2 seulement) : ils sont à l'écran, dans la zone montrée. */
export const PHRASE_CHIFFREE = `Vos commandes à préparer passent de ${CHIFFRE_AVANT} à ${CHIFFRE_MAINTENANT}, sans rien recompter à la main.`;

/**
 * Deux versions (A courte, B plus complète), une phrase « changement » par moment de la fiche du stratège. `chiffree` : la
 * première phrase de changement dit les chiffres d'exemple (cas 2) ; sans elle, aucun chiffre n'est dit (cas 3).
 */
export function scriptsDuDouble(moments: readonly MomentFiche[], chiffree?: string): unknown {
  const changements = moments.map(
    (m, i): PhraseDuDouble => ({
      texte: i === 0 && chiffree ? chiffree : "Vous voyez ici, d'un seul regard, ce qui change pour votre journée, sans rien chercher ailleurs.",
      temps: "changement",
      apport: "Montre au spectateur ce qui change pour lui.",
      zoneId: m.zoneId,
      momentId: m.id,
    }),
  );
  const debut = [
    situation("Chaque matin, vous cherchez qui fait quoi."),
    situation("Vous attendez d'avoir fait le tour de chacun avant de pouvoir décider quoi que ce soit."),
    situation("Vous passez d'une feuille à l'autre, et une partie de votre énergie part dans ces vérifications."),
    situation("Pendant ce temps, vos clients attendent une réponse que vous aimeriez donner tout de suite."),
  ];
  const plus = situation("Le soir, vous n'êtes jamais tout à fait sûr de n'avoir rien oublié pour le lendemain.");
  const gain: PhraseDuDouble = { texte: "Votre entreprise devient plus sereine et plus solide, parce que chacun sait où en sont les choses.", temps: "gain", apport: "Dit ce que l'entreprise devient." };
  return {
    version: "scripts-tutoriel.v1",
    versions: [
      { id: "A", source: "ecrit", phrases: [...debut, ...changements, gain] },
      { id: "B", source: "ecrit", phrases: [...debut, plus, ...changements, gain] },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Aperçu fixe et navigation fixe (ce que le poste rendrait)           */
/* ------------------------------------------------------------------ */

/** Image d'aperçu fixe (un point ivoire, PNG) : écrite par le double du capteur, jamais par un navigateur. */
export const IMAGE_APERCU_FIXE = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8+/fPfwAJjgPdZ3m7PwAAAABJRU5ErkJggg==", "base64"));

/** `navigation-filmee.v1` fixe : le film de la maquette gardée, tel que le poste de capture le rendrait (aucun film réel). */
export function navigationFixe(maquette: string, etapes: readonly string[], dureeVoixMs: number): NavigationFilmee {
  const pas = Math.floor(dureeVoixMs / (etapes.length + 1));
  return {
    version: VERSION_NAVIGATION,
    videoCle: "studio/test/phrase/navigation.mp4",
    maquette,
    largeur: 1080,
    hauteur: 1350,
    debutFilmMs: 400,
    dureeVoixMs,
    cibles: etapes.map((etapeId, i) => ({ etapeId, zonePct: { x: 10, y: 10 + ((i * 20) % 60), largeur: 40, hauteur: 14 }, instantMs: pas * i + 500, finMs: pas * (i + 1) })),
  };
}

/* ------------------------------------------------------------------ */
/* Plan de scènes du double de Claude                                  */
/* ------------------------------------------------------------------ */

/**
 * Plan rendu par le double de Claude : deux scènes de niveau 1, dont les seuls textes d'écran sont `textes` (pris par l'essai
 * dans le registre figé : des textes de la maquette gardée). `lignes` : le contenu de la requête du plan (une ligne par mot).
 */
export function planDuDouble(lignes: string, textes: readonly [string, string]): string {
  const mots = lignes.split("\n").filter((l) => /^\d+\t/.test(l));
  const n = mots.length;
  const ms = (i: number, col: 2 | 3) => Number(mots[i]!.split("\t")[col]);
  const moitie = Math.floor(n / 2);
  const scene = (id: string, premier: number, dernier: number, finMs: number, texte: string) => ({
    id,
    version: 1,
    mots: { premier, dernier },
    debutMs: ms(premier, 2),
    finMs,
    niveau: 1,
    position: "plein",
    transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 },
    piece: "legende",
    parametres: { texte, sousTexte: "", style: "titre" },
  });
  return JSON.stringify({
    version: "plan-scenes-1",
    habillage: { fond: "ivoire", accent: "terracotta" },
    scenes: [scene("s1", 0, moitie - 1, ms(moitie, 2), textes[0]), scene("s2", moitie, n - 1, ms(n - 1, 3), textes[1])],
  });
}
