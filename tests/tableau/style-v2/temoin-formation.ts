/**
 * FICHE TÉMOIN « Formation » du style « blocs/2 » : transcription du script validé par Will (`SCRIPT.md` de la vidéo
 * modèle, branche `tableau/maquettes-design-v2`) et de son minutage mot à mot (`temps-formation.json`, copie de
 * `temps.json`). Sert aux tests du style et aux aperçus (`apercus.mts`). Aucun appel : tout est local.
 *
 * Écarts assumés avec la vidéo modèle (bornes de la fiche commune : 10 scènes, 6 éléments par scène) : 11 écrans au lieu
 * de 12 (la page promise est le début de l'écran d'appel) ; « Voici comment, en cinq jours » est sa propre scène.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { calerFicheTableau } from "../../../src/moteurs/montage-tableau/calage";
import type { EcranTableau, ElementTableau, FicheTableau, SceneTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { ContexteTableau } from "../../../src/moteurs/montage-tableau/regles";
import { cleMot } from "../../../src/moteurs/montage-tableau/fiche";
import { mots as motsDe } from "../../../src/domaine/controles-script/texte";

/** Texte validé du script (mot pour mot, `SCRIPT.md`). */
export const SCRIPT_FORMATION = [
  "Vous avez essayé l'IA trois fois. Et vous avez laissé tomber.",
  "Des réponses plates. Du texte qu'il faut tout réécrire. Vous vous êtes dit : ce n'est pas pour moi.",
  "Le problème n'est pas l'outil. Vous l'avez essayé comme un moteur de recherche. Ça s'apprend comme un geste : en répétant.",
  "Voici comment, en cinq jours.",
  "Un. Choisissez une seule tâche que vous refaites chaque semaine. Un devis. Une relance. Un compte rendu.",
  "Deux. Faites-la avec l'IA cinq jours de suite. La même tâche. Pas une autre.",
  "Trois. Chaque jour, changez une seule chose dans votre demande. Lundi : dites pour qui c'est. Mardi : donnez un exemple que vous aimez. Mercredi : dites ce que vous ne voulez pas. Jeudi : imposez la longueur.",
  "Quatre. Vendredi, gardez la demande qui marche. Vous ne la retaperez plus jamais.",
  "Prenons un artisan et ses relances de devis. Lundi, le message est froid. Jeudi, il sonne comme lui. Vendredi, il a son modèle : il change un nom, et c'est parti.",
  "Une tâche. Cinq jours. Un changement par jour. Un modèle gardé. Le détail des cinq jours tient sur une page. Écrivez CINQ en commentaire. Je vous l'envoie.",
];

/** Index du `n`-ième mot `cible` dans un texte dit (même découpe que l'ancre). */
export function a(texte: string, cible: string, n = 0): number {
  const m = motsDe(texte);
  let k = 0;
  for (let i = 0; i < m.length; i++) if (cleMot(m[i]) === cleMot(cible) && k++ === n) return i;
  throw new Error(`mot « ${cible} » (n° ${n + 1}) absent de « ${texte} »`);
}

type Sc = Omit<SceneTableau, "elements" | "ecrans"> & { elements: ElementTableau[]; ecrans?: EcranTableau[] };

function scenes(): Sc[] {
  const [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10] = SCRIPT_FORMATION;
  return [
    {
      id: "s01",
      role: "accroche",
      page: 1,
      texteDit: t1,
      elements: [
        { id: "e01", type: "ligne", texte: "Vous avez essayé l'IA 3 fois", niveau: "titre", role: "titre", ancre: 0 },
        { id: "e02", type: "chiffre", valeur: "3", unite: "fois", sourceId: "script-formation", ancre: a(t1, "trois") },
        { id: "e03", type: "geste", geste: "barrer", cibleId: "e01", ancre: a(t1, "essayé") },
        { id: "e04", type: "ligne", texte: "Et vous avez laissé tomber", niveau: "titre", role: "alerte", ancre: a(t1, "Et") },
      ],
      ecrans: [
        {
          moment: "accroche",
          gabarit: "accroche-cases",
          motsForts: ["3", "fois", "laissé", "tomber"],
          liste: [
            { texte: "Essai 1", ancre: a(t1, "essayé") },
            { texte: "Essai 2", ancre: a(t1, "l'IA") },
            { texte: "Essai 3", ancre: a(t1, "trois") },
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
        { id: "e05", type: "ligne", texte: "Des réponses plates", niveau: "titre", role: "titre", importants: ["plates"], ancre: 0 },
        { id: "e06", type: "ligne", texte: "Du texte à tout réécrire", niveau: "titre", role: "alerte", ancre: a(t2, "Du") },
        { id: "e07", type: "ligne", texte: "Vous vous êtes dit :", niveau: "texte", role: "condition", ancre: a(t2, "Vous") },
        { id: "e08", type: "ligne", texte: "« Pas pour moi »", niveau: "titre", role: "resultat", marque: "souligne", ancre: a(t2, "pas") },
      ],
      ecrans: [{ moment: "douleur", gabarit: "constat", liste: [{ texte: "À réécrire", ancre: a(t2, "réécrire") }] }],
    },
    {
      id: "s03",
      role: "idee-recue",
      page: 3,
      texteDit: t3,
      elements: [
        { id: "e09", type: "ligne", texte: "Le problème n'est pas l'outil", niveau: "titre", role: "titre", importants: ["pas"], ancre: 0 },
        { id: "e10", type: "ligne", texte: "Un moteur de recherche", niveau: "texte", role: "alerte", marque: "barre", ancre: a(t3, "Vous") },
        { id: "e11", type: "ligne", texte: "Ça s'apprend comme un geste", niveau: "titre", role: "regle", importants: ["geste"], ancre: a(t3, "Ça") },
        { id: "e12", type: "ligne", texte: "en répétant", niveau: "texte", role: "condition", ancre: a(t3, "en") },
      ],
      ecrans: [{ moment: "retournement", gabarit: "idee-recue", motsForts: ["s'apprend"] }],
    },
    {
      id: "s04",
      role: "etape",
      page: 3,
      texteDit: t4,
      elements: [
        { id: "e13", type: "ligne", texte: "Voici comment, en 5 jours", niveau: "titre", role: "titre", ancre: 0 },
        { id: "e14", type: "chiffre", valeur: "5", unite: "jours", sourceId: "script-formation", ancre: a(t4, "cinq") },
      ],
      ecrans: [{ moment: "promesse", gabarit: "semaine", motsForts: ["5", "jours"] }],
    },
    {
      id: "s05",
      role: "etape",
      page: 4,
      texteDit: t5,
      elements: [
        { id: "e15", type: "ligne", texte: "Choisissez une seule tâche", niveau: "titre", role: "regle", importants: ["une", "seule", "tâche"], ancre: a(t5, "Choisissez") },
        { id: "e16", type: "ligne", texte: "refaite chaque semaine", niveau: "texte", role: "condition", ancre: a(t5, "refaites") },
      ],
      ecrans: [
        {
          moment: "etape",
          gabarit: "etape",
          etape: { n: 1, total: 4, nom: "Tâche" },
          liste: [
            { texte: "Devis", ancre: a(t5, "devis") },
            { texte: "Relance", ancre: a(t5, "relance") },
            { texte: "Compte rendu", ancre: a(t5, "compte") },
          ],
        },
      ],
    },
    {
      id: "s06",
      role: "etape",
      page: 4,
      texteDit: t6,
      elements: [
        { id: "e17", type: "ligne", texte: "Faites-la 5 jours de suite", niveau: "titre", role: "regle", ancre: a(t6, "Faites-la") },
        { id: "e18", type: "chiffre", valeur: "5", unite: "jours", sourceId: "script-formation", ancre: a(t6, "cinq") },
        { id: "e19", type: "ligne", texte: "La même tâche", niveau: "titre", role: "condition", importants: ["même"], ancre: a(t6, "La") },
        { id: "e20", type: "ligne", texte: "Pas une autre", niveau: "texte", role: "alerte", ancre: a(t6, "Pas") },
      ],
      ecrans: [
        {
          moment: "etape",
          gabarit: "semaine",
          etape: { n: 2, total: 4, nom: "5 jours" },
          motsForts: ["5", "jours"],
          liste: ["L", "M", "M", "J", "V"].map((j, i) => ({ texte: j, detail: "Devis", ancre: a(t6, "cinq") + i })),
        },
      ],
    },
    {
      id: "s07",
      role: "etape",
      page: 5,
      texteDit: t7,
      elements: [
        { id: "e21", type: "ligne", texte: "Chaque jour, changez 1 seule chose", niveau: "titre", role: "regle", importants: ["1", "seule", "chose"], ancre: a(t7, "Chaque") },
        { id: "e22", type: "chiffre", valeur: "1", unite: "chose", sourceId: "script-formation", ancre: a(t7, "une") },
      ],
      ecrans: [
        {
          moment: "etape",
          gabarit: "liste",
          etape: { n: 3, total: 4, nom: "1 par jour" },
          liste: [
            { texte: "Lundi", detail: "Pour qui", ancre: a(t7, "Lundi") },
            { texte: "Mardi", detail: "Un exemple", ancre: a(t7, "Mardi") },
            { texte: "Mercredi", detail: "Ce que je ne veux pas", ancre: a(t7, "Mercredi") },
            { texte: "Jeudi", detail: "La longueur", ancre: a(t7, "Jeudi") },
          ],
        },
      ],
    },
    {
      id: "s08",
      role: "etape",
      page: 5,
      texteDit: t8,
      elements: [
        { id: "e23", type: "ligne", texte: "Vendredi, gardez ce qui marche", niveau: "titre", role: "regle", ancre: a(t8, "Vendredi") },
        { id: "e24", type: "ligne", texte: "Vous ne la retaperez plus jamais", niveau: "texte", role: "avantage", importants: ["jamais"], ancre: a(t8, "Vous") },
      ],
      ecrans: [
        {
          moment: "etape",
          gabarit: "liste",
          etape: { n: 4, total: 4, nom: "Garder" },
          motsForts: ["gardez"],
          liste: [
            { texte: "Lun", detail: "Pour qui", ancre: a(t8, "la") },
            { texte: "Mar", detail: "Un exemple", ancre: a(t8, "demande") },
            { texte: "Mer", detail: "Ce que je ne veux pas", ancre: a(t8, "qui") },
            { texte: "Jeu", detail: "La longueur", ancre: a(t8, "marche") },
          ],
        },
      ],
    },
    {
      id: "s09",
      role: "preuve",
      page: 6,
      texteDit: t9,
      elements: [
        { id: "e25", type: "ligne", texte: "Un artisan", niveau: "titre", role: "titre", ancre: 0 },
        { id: "e26", type: "ligne", texte: "et ses relances de devis", niveau: "texte", role: "condition", importants: ["relances"], ancre: a(t9, "et") },
        { id: "e27", type: "preuve", preuveId: "matiere-demo-relance", lignes: ["Bonjour, je reviens vers vous pour mon devis.", "Votre terrasse peut démarrer le 14. On cale ça ? Paul"], ancre: a(t9, "Lundi") },
        { id: "e28", type: "mention", texte: "Exemple illustratif" },
        { id: "e29", type: "geste", geste: "cocher", cibleId: "e27", ancre: a(t9, "modèle") },
      ],
      ecrans: [
        {
          moment: "exemple",
          gabarit: "exemple",
          liste: [
            { texte: "Trop froid", ancre: a(t9, "froid") },
            { texte: "À son image", ancre: a(t9, "sonne") },
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
        { id: "e30", type: "chiffre", valeur: "5", unite: "jours", sourceId: "script-formation", ancre: a(t10, "Cinq") },
        { id: "e31", type: "ligne", texte: "Le détail des 5 jours tient sur 1 page", niveau: "texte", role: "resultat", ancre: a(t10, "Le") },
        { id: "e32", type: "ligne", texte: "Écrivez CINQ en commentaire", niveau: "titre", role: "titre", ancre: a(t10, "Écrivez") },
      ],
      ecrans: [
        {
          moment: "recapitulatif",
          gabarit: "recapitulatif",
          liste: [
            { texte: "Une tâche", detail: "la même toute la semaine", ancre: a(t10, "Une") },
            { texte: "5 jours", detail: "de suite", ancre: a(t10, "Cinq") },
            { texte: "1 changement", detail: "par jour", ancre: a(t10, "changement") },
            { texte: "1 modèle", detail: "gardé", ancre: a(t10, "modèle") },
          ],
        },
        { moment: "appel", gabarit: "appel-commentaire", motCommentaire: "CINQ", ancre: a(t10, "Le") },
      ],
    },
  ];
}

/** La fiche témoin (style « blocs/2 »). */
export function ficheFormation(): FicheTableau {
  return {
    version: "fiche-scenes/1",
    formatId: "tableau-anime",
    videoId: "temoin-formation",
    versionId: "v1",
    habillage: "blocs/2",
    stylo: "crayon/1",
    ratio: "9:16",
    structure: "demonstration",
    serie: { code: "ia-au-quotidien", nom: "L'IA au quotidien" },
    douleur: "Vous avez essayé l'IA et vous avez laissé tomber.",
    gesteMinute: "Choisissez une tâche de la semaine et refaites-la avec l'IA cinq jours de suite.",
    appelId: null,
    scenes: scenes() as SceneTableau[],
  };
}

/** Contexte de validation de la fiche témoin (preuve « démonstration » fictive, source des chiffres du script). */
export function contexteFormation(extra: Partial<ContexteTableau> = {}): ContexteTableau {
  return {
    texteScript: SCRIPT_FORMATION.join(" "),
    aujourdhui: "2026-10-11",
    sourcesChiffres: ["script-formation"],
    preuves: [],
    matieres: [{ id: "matiere-demo-relance", type: "demonstration", statut: "validee", perimeLe: "2027-01-09" }],
    ...extra,
  };
}

/** Mots horodatés de la voix modèle (`temps.json`), au format de la voix maître. */
export function motsFormation(): { mot: string; debutSec: number; finSec: number }[] {
  const t = JSON.parse(readFileSync(fileURLToPath(new URL("./temps-formation.json", import.meta.url)), "utf8")) as { phrases: { mots: { mot: string; debutSec: number; finSec: number }[] }[] };
  return t.phrases.flatMap((p) => p.mots);
}

/** Durée du son de la voix modèle (s). */
export function dureeVoixFormation(): number {
  return (JSON.parse(readFileSync(fileURLToPath(new URL("./temps-formation.json", import.meta.url)), "utf8")) as { dureeSec: number }).dureeSec;
}

/** La fiche témoin calée sur la voix modèle. */
export function ficheFormationCalee() {
  const r = calerFicheTableau(ficheFormation(), motsFormation(), { contexte: contexteFormation(), dureeSec: dureeVoixFormation() });
  if (!r.ok) throw new Error(`calage refusé : ${r.problemes.join(" | ")}`);
  return r;
}
