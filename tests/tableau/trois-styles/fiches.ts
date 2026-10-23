/**
 * Fiches des trois styles du tableau (16/10/2026), partagées par les tests et les aperçus (`apercus.mts`) :
 *  - le TÉMOIN de la vidéo d'essai v-667edcd8e3a8 (jugée « catastrophe »), reconstitué depuis sa capture ;
 *  - la fiche des MAQUETTES validées (PR #280) : le même contenu que `maquettes/tableau-v2/` (accroche, étape 1 sur 3,
 *    exemple illustratif « 10 min → 3 min », à retenir en trois points cochés, appel), pour comparer le rendu du moteur
 *    aux maquettes écran par écran.
 * Calées sur un minutage réaliste (aucune voix lue).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MotCalage } from "../../../src/briques/motion/calage";
import type { StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { calerFicheTableau, type ElementCale } from "../../../src/moteurs/montage-tableau/calage";
import { remettreEnForme } from "../../../src/moteurs/montage-tableau/decoupage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { ContexteTableau } from "../../../src/moteurs/montage-tableau/regles";
import { motsRealistes } from "../reference-3/fiches";

const DOSSIER = join(__dirname, "..", "temoins");

export const MOTS_DOULEUR_V667 = ["mails", "temps"];

/** Le témoin v-667edcd8e3a8, remis en forme comme en production. */
export function ficheTemoinV667(style?: StyleTableau): FicheTableau {
  const f = remettreEnForme(JSON.parse(readFileSync(join(DOSSIER, "fiche-temoin-v-667edcd8e3a8-reference-3.json"), "utf8")) as FicheTableau, { motsDouleur: MOTS_DOULEUR_V667 });
  return style ? { ...f, styleTableau: style } : f;
}

/** La fiche des maquettes validées (même contenu que `maquettes/tableau-v2/`). */
export function ficheMaquettes(style?: StyleTableau): FicheTableau {
  const f: FicheTableau = {
    version: "fiche-scenes/1",
    formatId: "tableau-anime",
    videoId: "v-maquettes-tableau-v2",
    versionId: "r1",
    habillage: "reference/3",
    stylo: "crayon/1",
    ratio: "9:16",
    structure: "demonstration",
    serie: { code: "formation", nom: "Formation" },
    douleur: "Vos équipes ont l'IA, et leurs mails prennent le même temps.",
    gesteMinute: "Faire rédiger les réponses aux mails répétitifs, puis relire.",
    appelId: null,
    scenes: [
      { id: "s01", role: "accroche", page: 1, texteDit: "Vos équipes ont l'IA, et leurs mails prennent le même temps.", gabarit: { role: "accroche" }, elements: [{ id: "e01", type: "ligne", texte: "Vos équipes ont l'IA, et leurs mails prennent le même temps.", niveau: "texte", role: "regle", bloc: "phrase-cle", ancre: 0, marque: "entoure", importants: ["mails", "temps"] }] },
      {
        id: "s02",
        role: "etape",
        page: 2,
        texteDit: "Un. Faites rédiger les réponses aux mails répétitifs. Collez la demande sans nom, un brouillon de cinq lignes, relisez.",
        gabarit: { role: "solution", numero: { n: 1, ancre: 0 } },
        elements: [
          { id: "e02", type: "ligne", texte: "Faites rédiger", niveau: "titre", role: "regle", bloc: "titre", ancre: 1 },
          { id: "e03", type: "ligne", texte: "Faites rédiger les réponses aux mails répétitifs.", niveau: "texte", role: "regle", bloc: "phrase-cle", ancre: 1 },
          { id: "e04", type: "ligne", texte: "Collez, sans nom", niveau: "texte", role: "regle", bloc: "coche", ancre: 8 },
          { id: "e05", type: "ligne", texte: "Un brouillon de cinq lignes", niveau: "texte", role: "regle", bloc: "coche", ancre: 13 },
          { id: "e06", type: "ligne", texte: "Relisez", niveau: "texte", role: "regle", bloc: "coche", ancre: 18 },
        ],
      },
      { id: "s03", role: "etape", page: 3, texteDit: "Deux. Gardez les réponses validées dans un dossier commun.", gabarit: { role: "solution", numero: { n: 2, ancre: 0 } }, elements: [{ id: "e07", type: "ligne", texte: "Gardez", niveau: "titre", role: "regle", bloc: "titre", ancre: 1 }, { id: "e08", type: "ligne", texte: "Gardez les réponses validées dans un dossier commun.", niveau: "texte", role: "regle", bloc: "phrase-cle", ancre: 1 }] },
      { id: "s04", role: "etape", page: 4, texteDit: "Trois. Montrez la méthode à toute l'équipe.", gabarit: { role: "solution", numero: { n: 3, ancre: 0 } }, elements: [{ id: "e09", type: "ligne", texte: "Montrez", niveau: "titre", role: "regle", bloc: "titre", ancre: 1 }, { id: "e10", type: "ligne", texte: "Montrez la méthode à toute l'équipe.", niveau: "texte", role: "regle", bloc: "phrase-cle", ancre: 1 }] },
      { id: "s05", role: "exemple", page: 5, texteDit: "Exemple : avant, dix minutes par mail.", gabarit: { role: "exemple" }, elements: [{ id: "e11", type: "mention", texte: "Exemple illustratif" }, { id: "e12", type: "ligne", texte: "Avant, 10 minutes par mail.", niveau: "texte", role: "alerte", bloc: "avant", ancre: 1 }] },
      { id: "s06", role: "preuve", page: 5, texteDit: "Maintenant, trois minutes.", gabarit: { role: "exemple" }, elements: [{ id: "e13", type: "preuve", preuveId: "mat-mails-demo", lignes: ["Après : 3 minutes."], ancre: 0 }] },
      {
        id: "s07",
        role: "resultat",
        page: 6,
        texteDit: "À retenir : collez sans nom, un brouillon court, relisez toujours.",
        gabarit: { role: "retenir" },
        elements: [
          { id: "e14", type: "ligne", texte: "Collez sans nom", niveau: "texte", role: "regle", bloc: "liste", ancre: 2 },
          { id: "e15", type: "ligne", texte: "Brouillon court", niveau: "texte", role: "regle", bloc: "liste", ancre: 5 },
          { id: "e16", type: "ligne", texte: "Relisez toujours", niveau: "texte", role: "regle", bloc: "liste", ancre: 8 },
        ],
      },
      { id: "s08", role: "fin", page: 7, texteDit: "Réservez un appel de diagnostic sur axion-ia.com.", gabarit: { role: "appel" }, elements: [{ id: "e17", type: "ligne", texte: "Réservez un appel de diagnostic", niveau: "titre", role: "regle", bloc: "appel", ancre: 0 }] },
    ],
  } as FicheTableau;
  const r = remettreEnForme(f, { motsDouleur: ["mails", "temps"] });
  return style ? { ...r, styleTableau: style } : r;
}

/**
 * Le témoin tel que le découpage le rend APRÈS la correction (b) : la phrase tronquée de la page 3 refusée, puis
 * réécrite sans quantité (« Les tâches à apprendre en premier… ») ; la preuve de l'exemple montrée (la démonstration).
 */
export function ficheTemoinV667Corrige(style?: StyleTableau): FicheTableau {
  const f = ficheTemoinV667(style);
  return {
    ...f,
    scenes: f.scenes.map((s) => {
      if (s.id === "s03") return { ...s, elements: s.elements.map((e) => (e.id === "e05" && e.type === "ligne" ? { ...e, texte: "Les tâches à apprendre en premier, les minutes gagnées par mail." } : e)) };
      if (s.id === "s08") return { ...s, elements: [{ id: "e19", type: "preuve" as const, preuveId: "mat-mails-demo", lignes: ["Après : elle relit un brouillon et l'envoie."], ancre: 0 }] };
      return s;
    }),
  };
}

/** Mots de la douleur de la fiche réaliste « démonstration en 3 gestes ». */
export const MOTS_DOULEUR_DEMO = ["compte", "jours"];

export function contexteTableau(f: FicheTableau): ContexteTableau {
  const demo = f.videoId === "v-demo-3-gestes";
  return { aujourdhui: "2026-10-16", sourcesChiffres: [], preuves: [], matieres: [{ id: demo ? "mat-compte-rendu-demo" : "mat-mails-demo", type: "demonstration", statut: "validee", perimeLe: "2027-01-15" }], texteScript: f.scenes.map((s) => s.texteDit).join(" "), motsDouleur: demo ? MOTS_DOULEUR_DEMO : ["mails", "temps"] };
}

/** Une fiche calée sur un minutage réaliste ; `rapport` : les refus du calage (vide s'il est accepté). */
export function calee(f: FicheTableau, cps = 20.5): { fiche: FicheTableau; mots: MotCalage[]; elements: ElementCale[]; refus: string[] } {
  const mots = motsRealistes(f, cps);
  const r = calerFicheTableau(f, mots, { contexte: contexteTableau(f), dureeSec: mots.at(-1)!.finSec + 0.3 });
  if (!r.ok) return { fiche: f, mots, elements: [], refus: r.problemes };
  return { fiche: r.fiche, mots, elements: r.elements, refus: [] };
}

/**
 * Fiche RÉALISTE de la première vraie vidéo tableau (v-b2d772d28b97, 17/10/2026, série Formation donc ardoise, TikTok,
 * fin « appel de diagnostic ») : une démonstration en 3 gestes, un décompte annoncé (« Trois réflexes… »), un visuel,
 * un dessin de la banque, un exemple « Avant / Maintenant » (3 jours, 4 pages → 10 minutes), « À retenir », l'appel.
 */
export function ficheDemonstration3Gestes(style?: StyleTableau): FicheTableau {
  const f = {
    version: "fiche-scenes/1",
    formatId: "tableau-anime",
    videoId: "v-demo-3-gestes",
    versionId: "r1",
    habillage: "reference/3",
    stylo: "crayon/1",
    ratio: "9:16",
    structure: "demonstration",
    serie: { code: "formation", nom: "Formation" },
    douleur: "Votre compte rendu de chantier met trois jours à partir.",
    gesteMinute: "Dicter ses notes sur place, faire rédiger une demi-page, relire puis envoyer.",
    appelId: null,
    scenes: [
      { id: "s01", role: "accroche", page: 1, texteDit: "Votre compte rendu de chantier met trois jours à partir.", gabarit: { role: "accroche", visuel: { id: "calendrier" } }, elements: [{ id: "e01", type: "ligne", texte: "Votre compte rendu de chantier met trois jours à partir.", niveau: "texte", role: "regle", bloc: "phrase-cle", ancre: 0, marque: "entoure", importants: ["compte", "jours"] }] },
      { id: "s02", role: "douleur", page: 2, texteDit: "Quatre pages tapées le soir, que personne ne lit en entier.", gabarit: { role: "douleur" }, elements: [{ id: "e02", type: "ligne", texte: "Quatre pages tapées le soir, que personne ne lit en entier.", niveau: "texte", role: "alerte", bloc: "phrase-cle", ancre: 0 }, { id: "e03", type: "dessin", dessinId: "horloge", cote: "droite", ancre: 5 }] },
      { id: "s03", role: "etape", page: 3, texteDit: "Trois réflexes pour l'envoyer en dix minutes.", gabarit: { role: "solution" }, elements: [{ id: "e04", type: "ligne", texte: "Trois réflexes pour l'envoyer.", niveau: "texte", role: "regle", bloc: "phrase-cle", ancre: 0 }] },
      { id: "s04", role: "etape", page: 4, texteDit: "Un. Dictez vos notes sur place, en sortant du chantier.", gabarit: { role: "solution", numero: { n: 1, ancre: 0 } }, elements: [{ id: "e05", type: "ligne", texte: "Dictez", niveau: "titre", role: "regle", bloc: "titre", ancre: 1 }, { id: "e06", type: "ligne", texte: "Dictez vos notes sur place, en sortant du chantier.", niveau: "texte", role: "regle", bloc: "phrase-cle", ancre: 1 }] },
      {
        id: "s05",
        role: "etape",
        page: 5,
        texteDit: "Deux. Faites rédiger une demi-page : le fait, la décision, la suite.",
        gabarit: { role: "solution", numero: { n: 2, ancre: 0 } },
        elements: [
          { id: "e07", type: "ligne", texte: "Faites rédiger", niveau: "titre", role: "regle", bloc: "titre", ancre: 1 },
          { id: "e08", type: "ligne", texte: "Faites rédiger une demi-page.", niveau: "texte", role: "regle", bloc: "phrase-cle", ancre: 1 },
          { id: "e09", type: "ligne", texte: "Le fait", niveau: "texte", role: "regle", bloc: "coche", ancre: 6 },
          { id: "e10", type: "ligne", texte: "La décision", niveau: "texte", role: "regle", bloc: "coche", ancre: 8 },
          { id: "e11", type: "ligne", texte: "La suite", niveau: "texte", role: "regle", bloc: "coche", ancre: 10 },
        ],
      },
      { id: "s06", role: "etape", page: 6, texteDit: "Trois. Relisez les noms et les dates, puis envoyez.", gabarit: { role: "solution", numero: { n: 3, ancre: 0 } }, elements: [{ id: "e12", type: "ligne", texte: "Relisez", niveau: "titre", role: "regle", bloc: "titre", ancre: 1 }, { id: "e13", type: "ligne", texte: "Relisez les noms et les dates, puis envoyez.", niveau: "texte", role: "regle", bloc: "phrase-cle", ancre: 1 }] },
      { id: "s07", role: "exemple", page: 7, texteDit: "Exemple : avant, trois jours et quatre pages.", gabarit: { role: "exemple" }, elements: [{ id: "e14", type: "mention", texte: "Exemple illustratif" }, { id: "e15", type: "ligne", texte: "Avant, trois jours et quatre pages.", niveau: "texte", role: "alerte", bloc: "avant", ancre: 1 }] },
      { id: "s08", role: "preuve", page: 7, texteDit: "Maintenant, une demi-page part dix minutes plus tard.", gabarit: { role: "exemple" }, elements: [{ id: "e16", type: "preuve", preuveId: "mat-compte-rendu-demo", lignes: ["Après : une demi-page part dix minutes plus tard."], ancre: 0 }] },
      { id: "s09", role: "resultat", page: 8, texteDit: "Une demi-page dictée sur place, relue, envoyée le jour même.", gabarit: { role: "retenir" }, elements: [{ id: "e17", type: "ligne", texte: "Une demi-page dictée sur place, relue, envoyée le jour même.", niveau: "texte", role: "regle", bloc: "phrase-cle", ancre: 0 }] },
      { id: "s10", role: "fin", page: 9, texteDit: "Axion-IA forme vos équipes à ces réflexes. Réservez un appel de diagnostic.", gabarit: { role: "appel" }, elements: [{ id: "e18", type: "ligne", texte: "Axion-IA forme vos équipes à ces réflexes.", niveau: "texte", role: "regle", bloc: "detail", ancre: 0 }, { id: "e19", type: "ligne", texte: "Réservez un appel de diagnostic", niveau: "titre", role: "regle", bloc: "appel", ancre: 7 }] },
    ],
  } as FicheTableau;
  const r = remettreEnForme(f, { motsDouleur: MOTS_DOULEUR_DEMO });
  return style ? { ...r, styleTableau: style } : r;
}
