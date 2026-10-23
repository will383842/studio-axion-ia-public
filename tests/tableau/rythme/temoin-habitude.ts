/**
 * FICHE TÉMOIN DE L'ESSAI RÉEL N° 3 (12/10, par l'écran `/tableau/nouvelle`) : script accepté par le générateur (10 sur
 * 10, YouTube, environ 82 s), fiche de 10 scènes REFUSÉE au découpage pour deux trous du rythme, scènes s04 et s07.
 * La fiche réelle n'a pas pu être gardée en fichier : celle-ci est RECONSTRUITE, fidèle aux deux scènes refusées (texte
 * dit, lignes écrites, dessin, geste, et ancres posées par le modèle groupées au début), les huit autres écrites dans
 * le même esprit pour que la fiche passe toutes les autres règles.
 */
import type { EcranTableau, ElementTableau, FicheTableau, SceneTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { ContexteTableau } from "../../../src/moteurs/montage-tableau/regles";
import { a } from "../style-v2/temoin-formation";

/** Texte dit, scène par scène (mot pour mot ; s04 et s07 : ceux de l'essai réel). */
export const SCRIPT_HABITUDE = [
  "Vous avez déjà essayé de prendre une habitude avec l'IA. Elle a tenu trois jours. Puis plus rien.",
  "Le lundi, vous êtes motivé. Le jeudi, vous avez oublié. Ce n'est pas un manque de volonté. Votre semaine est déjà pleine, et l'IA passe après tout le reste. Voici comment la faire tenir.",
  "Un. Choisissez une seule tâche qui revient chaque semaine. Une seule. Celle qui vous agace le plus : les comptes rendus, les relances ou les devis. Commencez petit, sinon vous arrêterez au bout de quelques jours.",
  "Deux. Accrochez-la à un moment fixe qui existe déjà. Par exemple : en sortant de chaque réunion, dictez trois notes à l'IA pour le compte rendu. Le déclencheur, c'est la réunion. Pas la bonne volonté.",
  "Trois. Gardez la même demande toute la semaine. Écrivez-la une fois, rangez-la dans une note, et collez-la à chaque fois. Vous ne repartez jamais de zéro.",
  "Quatre. Le vendredi, regardez ce que vous avez gagné. Notez-le en une ligne. C'est ce qui vous fera continuer.",
  "Prenons une agence immobilière de six personnes. Avant : chacun tape ses comptes rendus de visite le soir, quand il y pense. Leur seule tâche : le compte rendu, dicté à l'IA en sortant de chaque visite. Une demande commune, rangée dans le téléphone de chacun.",
  "Au bout d'un mois, les comptes rendus partent le jour même. Plus personne ne les tape le soir, et les clients ont leur retour avant de rappeler.",
  "Une tâche. Un moment fixe. Une demande gardée. C'est tout ce qu'il faut.",
  "Écrivez MOMENT en commentaire. Je vous envoie la demande prête à coller.",
];

type Sc = Omit<SceneTableau, "elements" | "ecrans"> & { elements: ElementTableau[]; ecrans?: EcranTableau[] };

function scenes(): Sc[] {
  const [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10] = SCRIPT_HABITUDE;
  return [
    {
      id: "s01",
      role: "accroche",
      page: 1,
      texteDit: t1,
      elements: [
        { id: "e01", type: "ligne", texte: "Une habitude avec l'IA ?", niveau: "titre", role: "titre", marque: "entoure", ancre: 0 },
        { id: "e02", type: "dessin", dessinId: "calendrier", cote: "droite", ancre: a(t1, "Elle") },
        { id: "e03", type: "ligne", texte: "Tenue trois jours", niveau: "texte", role: "alerte", ancre: a(t1, "tenu") },
        { id: "e04", type: "ligne", texte: "Puis plus rien", niveau: "titre", role: "alerte", marque: "barre", ancre: a(t1, "Puis") },
      ],
      ecrans: [
        {
          moment: "accroche",
          gabarit: "accroche-cases",
          etiquette: "Le constat",
          liste: [
            { texte: "Essayé", ancre: a(t1, "essayé") },
            { texte: "Trois jours", ancre: a(t1, "trois") },
            { texte: "Plus rien", ancre: a(t1, "rien") },
          ],
        },
      ],
    },
    {
      id: "s02",
      role: "douleur",
      page: 2,
      texteDit: t2,
      elements: [
        { id: "e06", type: "ligne", texte: "Lundi : motivé", niveau: "titre", role: "titre", ancre: 0 },
        { id: "e07", type: "ligne", texte: "Jeudi : oublié", niveau: "titre", role: "alerte", ancre: a(t2, "jeudi") },
        { id: "e08", type: "ligne", texte: "Pas un manque de volonté", niveau: "texte", role: "regle", marque: "barre", ancre: a(t2, "Ce") },
        { id: "e09", type: "dessin", dessinId: "sablier", cote: "droite", ancre: a(t2, "semaine") },
        { id: "e10", type: "ligne", texte: "L'IA passe après le reste", niveau: "texte", role: "condition", ancre: a(t2, "l'IA") },
        { id: "e11", type: "ligne", texte: "Comment la faire tenir", niveau: "titre", role: "resultat", ancre: a(t2, "Voici") },
      ],
      ecrans: [{ moment: "douleur", gabarit: "constat", etiquette: "Le vrai problème", motsForts: ["volonté"] }],
    },
    {
      id: "s03",
      role: "etape",
      page: 3,
      texteDit: t3,
      elements: [
        { id: "e12", type: "ligne", texte: "Une seule tâche", niveau: "titre", role: "regle", ancre: a(t3, "Choisissez") },
        { id: "e13", type: "ligne", texte: "Qui revient chaque semaine", niveau: "texte", role: "condition", ancre: a(t3, "Celle") },
        { id: "e14", type: "ligne", texte: "Commencez petit", niveau: "titre", role: "regle", marque: "souligne", ancre: a(t3, "Commencez") },
        { id: "e15", type: "dessin", dessinId: "cible", cote: "droite", ancre: a(t3, "arrêterez") },
      ],
      ecrans: [
        {
          moment: "etape",
          gabarit: "etape",
          etape: { n: 1, total: 4, nom: "Tâche" },
          liste: [
            { texte: "Comptes rendus", ancre: a(t3, "comptes") },
            { texte: "Relances", ancre: a(t3, "relances") },
            { texte: "Devis", ancre: a(t3, "devis") },
          ],
        },
      ],
    },
    {
      // Scène s04 de l'essai réel : 4 phrases (≈ 10 s), 3 lignes, 1 dessin, 1 geste ; ancres du modèle groupées.
      id: "s04",
      role: "etape",
      page: 3,
      texteDit: t4,
      elements: [
        { id: "e16", type: "ligne", texte: "Un moment fixe", niveau: "titre", role: "regle", ancre: a(t4, "Accrochez-la") },
        { id: "e17", type: "dessin", dessinId: "horloge", cote: "droite", ancre: a(t4, "moment") },
        { id: "e18", type: "ligne", texte: "Après chaque réunion : dicter des notes", niveau: "texte", role: "condition", ancre: a(t4, "Par") },
        { id: "e19", type: "ligne", texte: "Déclencheur = la réunion", niveau: "titre", role: "resultat", marque: "souligne", ancre: a(t4, "déclencheur,") },
        { id: "e20", type: "geste", geste: "entourer", cibleId: "e19", ancre: a(t4, "c'est") },
      ],
      ecrans: [{ moment: "etape", gabarit: "etape", etape: { n: 2, total: 4, nom: "Moment" }, motsForts: ["moment", "fixe"] }],
    },
    {
      id: "s05",
      role: "etape",
      page: 4,
      texteDit: t5,
      elements: [
        { id: "e21", type: "ligne", texte: "Gardez la même demande", niveau: "titre", role: "regle", ancre: a(t5, "Gardez") },
        { id: "e22", type: "ligne", texte: "Écrite une fois, rangée", niveau: "texte", role: "condition", ancre: a(t5, "Écrivez-la") },
        { id: "e23", type: "dessin", dessinId: "telephone", cote: "droite", ancre: a(t5, "note") },
        { id: "e24", type: "ligne", texte: "Jamais de zéro", niveau: "titre", role: "avantage", marque: "souligne", ancre: a(t5, "Vous") },
      ],
      ecrans: [{ moment: "etape", gabarit: "etape", etape: { n: 3, total: 4, nom: "Demande" }, motsForts: ["même"] }],
    },
    {
      id: "s06",
      role: "etape",
      page: 4,
      texteDit: t6,
      elements: [
        { id: "e25", type: "ligne", texte: "Le vendredi, regardez le gain", niveau: "titre", role: "regle", ancre: a(t6, "Le") },
        { id: "e26", type: "ligne", texte: "Notez-le en une ligne", niveau: "texte", role: "condition", ancre: a(t6, "Notez-le") },
        { id: "e27", type: "dessin", dessinId: "crayon", cote: "droite", ancre: a(t6, "ligne") },
        { id: "e28", type: "ligne", texte: "C'est ce qui fait continuer", niveau: "titre", role: "avantage", marque: "souligne", ancre: a(t6, "C'est") },
      ],
      ecrans: [{ moment: "etape", gabarit: "etape", etape: { n: 4, total: 4, nom: "Gain" }, motsForts: ["gain"] }],
    },
    {
      // Scène s07 de l'essai réel : 4 phrases (≈ 13 s), 4 lignes, 1 dessin, 1 geste ; ancres du modèle groupées.
      id: "s07",
      role: "exemple",
      page: 5,
      texteDit: t7,
      elements: [
        { id: "e29", type: "ligne", texte: "Exemple illustratif", niveau: "texte", role: "condition", ancre: 0 },
        { id: "e30", type: "ligne", texte: "Une agence immobilière", niveau: "titre", role: "titre", ancre: a(t7, "agence") },
        { id: "e31", type: "ligne", texte: "Avant : comptes rendus tapés le soir", niveau: "texte", role: "alerte", marque: "barre", ancre: a(t7, "Avant") },
        { id: "e32", type: "ligne", texte: "Après : dicté en sortant de visite", niveau: "titre", role: "resultat", ancre: a(t7, "dicté") },
        { id: "e33", type: "dessin", dessinId: "telephone", cote: "droite", ancre: a(t7, "dicté") },
        { id: "e34", type: "geste", geste: "souligner", cibleId: "e32", ancre: a(t7, "à") },
      ],
      ecrans: [{ moment: "exemple", gabarit: "exemple", etiquette: "Exemple" }],
    },
    {
      id: "s08",
      role: "preuve",
      page: 5,
      texteDit: t8,
      elements: [
        { id: "e35", type: "ligne", texte: "Au bout d'un mois", niveau: "titre", role: "titre", ancre: 0 },
        { id: "e36", type: "preuve", preuveId: "matiere-demo-agence", lignes: ["Compte rendu envoyé le jour même", "Plus rien à taper le soir"], ancre: a(t8, "comptes") },
        { id: "e37", type: "geste", geste: "cocher", cibleId: "e36", ancre: a(t8, "Plus") },
        { id: "e38", type: "ligne", texte: "Le retour avant le rappel", niveau: "texte", role: "avantage", ancre: a(t8, "clients") },
      ],
      ecrans: [{ moment: "exemple", gabarit: "exemple", etiquette: "Le résultat" }],
    },
    {
      id: "s09",
      role: "resultat",
      page: 6,
      texteDit: t9,
      elements: [
        { id: "e39", type: "ligne", texte: "Une habitude qui tient", niveau: "titre", role: "resultat", ancre: a(t9, "C'est") },
        { id: "e40", type: "dessin", dessinId: "coche-cercle", cote: "droite", ancre: a(t9, "faut") },
      ],
      ecrans: [
        {
          moment: "recapitulatif",
          gabarit: "recapitulatif",
          liste: [
            { texte: "Une tâche", ancre: 0 },
            { texte: "Un moment fixe", ancre: a(t9, "Un") },
            { texte: "Une demande gardée", ancre: a(t9, "Une", 1) },
          ],
        },
      ],
    },
    {
      id: "s10",
      role: "fin",
      page: 6,
      texteDit: t10,
      elements: [
        { id: "e41", type: "ligne", texte: "Écrivez MOMENT en commentaire", niveau: "titre", role: "titre", ancre: 0 },
        { id: "e42", type: "ligne", texte: "La demande prête à coller", niveau: "texte", role: "avantage", ancre: a(t10, "Je") },
      ],
      ecrans: [{ moment: "appel", gabarit: "appel-commentaire", motCommentaire: "MOMENT" }],
    },
  ];
}

/** La fiche témoin, telle que rendue par le découpage (ancres du modèle, AVANT toute réparation). */
export function ficheHabitude(): FicheTableau {
  return {
    version: "fiche-scenes/1",
    formatId: "tableau-anime",
    videoId: "temoin-habitude",
    versionId: "b1",
    habillage: "blocs/2",
    stylo: "crayon/1",
    ratio: "16:9",
    structure: "demonstration",
    serie: { code: "formation", nom: "Formation" },
    douleur: "Prendre une habitude avec l'IA qui tienne dans le temps.",
    gesteMinute: "Accrochez une seule tâche à un moment fixe qui existe déjà.",
    appelId: null,
    scenes: scenes() as SceneTableau[],
  };
}

/** Contexte des règles (démonstration de l'agence validée ; mot de la douleur dit au début). */
export function contexteHabitude(extra: Partial<ContexteTableau> = {}): ContexteTableau {
  return {
    texteScript: SCRIPT_HABITUDE.join(" "),
    aujourdhui: "2026-10-12",
    sourcesChiffres: [],
    preuves: [],
    matieres: [{ id: "matiere-demo-agence", type: "demonstration", statut: "validee", perimeLe: "2027-01-09" }],
    motsDouleur: ["habitude"],
    ...extra,
  };
}
