/**
 * LA V4 DE WILL comme entrée des contrôles par code (référence d'écriture, `docs/formats/v4-reference/voix4.json`).
 *
 * Texte : `voix4.json`, MOT POUR MOT, découpé en phrases (un segment par phrase). Horodatage : RÉEL, lu mot à mot dans
 * `voix4.json` (aucune estimation, aucune marge). Preuves : les faits du cas « recrutement-apporteurs » qui portent les
 * nombres dits (15 minutes, 20 secondes, plus d'une heure). Réseau Facebook, objectif « conversation » (la v4 finit sur
 * une question au public puis « Écrivez PLAN en commentaire »). Aucune couche de publication : la v4 est jugée sur son
 * texte dit, comme Will l'a jugée.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Auteur, EntreeControle } from "@/domaine/controles-script";
import type { MarqueurScript, SegmentScript } from "@/domaine/types";
import { bloc, MAINTENANT, matiere, PARAMS, preuve, RECETTE, seg, TOURNURES } from "./g3";

export const VOIX4 = JSON.parse(readFileSync(join(process.cwd(), "docs/formats/v4-reference/voix4.json"), "utf8")) as { texte: string; duree: number; mots: { word: string; start: number; end: number }[] };

type Phrase = [id: string, texte: string, marqueurs: MarqueurScript[], preuveIds?: string[], extra?: Partial<SegmentScript>];

/** Les phrases de la v4, dans l'ordre, avec ce qu'elles font (lu à la main, sans rien ajouter au texte). */
const OUVERTURE: Phrase[] = [
  ["a1", "On recrute nos collaborateurs en quinze minutes.", ["ancrage"], ["F15"], { matiereIds: ["m-v4"] }],
  ["a2", "Oui, quinze minutes.", [], ["F15"], { coupeCourteVoulue: true }],
];
const CORPS: Phrase[] = [
  ["c1", "Avant, c'était ça : trier les candidatures, répondre à chacun, relancer, caler un rendez-vous, envoyer le contrat, courir après la signature.", ["relance"]],
  ["c2", "Plus d'une heure, pour chaque personne.", ["cout", "preuve", "relance"], ["F1H"]],
  ["c3", "Alors on a tout automatisé.", ["solution", "relance"]],
  ["c4", "La personne voit notre annonce.", ["solution"]],
  ["c5", "Elle s'inscrit toute seule, en vingt secondes.", ["solution", "preuve"], ["F20"]],
  ["c6", "Elle reçoit ses e-mails toute seule.", ["solution"]],
  ["c7", "Elle choisit elle-même son rendez-vous.", ["solution"]],
  ["c8", "Et si elle oublie, le rappel part tout seul.", ["solution", "relance"]],
  ["c9", "Nous, on arrive pour la visio.", ["relance"]],
  ["c10", "Quinze minutes.", ["preuve"], ["F15"], { coupeCourteVoulue: true }],
  ["c11", "C'est notre seul travail.", ["livraison"]],
  ["c12", "Derrière, le contrat part tout seul.", ["solution", "relance"]],
  ["c13", "Elle signe sur son téléphone.", ["solution"]],
  ["c14", "Et le dossier est classé.", ["solution"]],
  ["c15", "Résultat : des heures gagnées, à chaque recrutement.", ["resultat"], ["F1H"]],
  ["c16", "Et dans votre entreprise, quelle tâche pourrait tourner toute seule ?", ["relance"]],
];
const FIN: Phrase[] = [["f1", "Écrivez PLAN en commentaire. On vous envoie le plan de cette machine.", ["cta"]]];

const normal = (m: string) => m.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Horodatage réel de chaque phrase : du 1er au dernier mot de `voix4.json` qu'elle couvre. */
function horodatage(phrases: Phrase[]): { debutSec: number; finSec: number }[] {
  const mots = VOIX4.mots.filter((m) => normal(m.word));
  let i = 0;
  return phrases.map(([, texte]) => {
    const n = texte.split(/\s+/).filter((m) => normal(m)).length;
    const debut = mots[i];
    const fin = mots[i + n - 1];
    if (!debut || !fin) throw new Error(`voix4.json ne couvre pas « ${texte} »`);
    i += n;
    return { debutSec: debut.start, finSec: fin.end };
  });
}

/** Chaque phrase de la v4 ouvre un plan (`v4.html`) : un changement à l'écran par segment. */
const segments = (ps: Phrase[]) => ps.map(([id, texte, marqueurs, preuveIds, extra]) => seg(id, texte, { nature: "fait", marqueurs, preuveIds: preuveIds ?? [], changementVisuel: true, ...extra }));

/** La v4, écrite par `auteur`, prête pour `controlerVersion`. */
export function versionV4(auteur: Auteur = "machine", modif: (e: EntreeControle) => void = () => {}): EntreeControle {
  const toutes = [...OUVERTURE, ...CORPS, ...FIN];
  const mots = VOIX4.texte.split(/\s+/).filter((m) => normal(m)).length;
  const e: EntreeControle = {
    auteur,
    mode: "avatar",
    adresse: "vous",
    debit: +(mots / VOIX4.duree).toFixed(2),
    debitMesure: true,
    horodatageReel: horodatage(toutes),
    ouverture: [bloc("accroche", ...segments(OUVERTURE))],
    corps: [bloc("coeur", ...segments(CORPS))],
    fin: [bloc("appel", ...segments(FIN))],
    recette: RECETTE,
    reseau: PARAMS.reseau("facebook"),
    structure: RECETTE.structures.find((s) => s.id === "AV.S2"),
    objectif: "conversation",
    appel: { type: "question-expert", texte: FIN[0][1], selonObjectif: true },
    boucle: false,
    motCle: "recrute",
    motCleSource: "hypothese",
    maitre: {
      ancrages: [{ matiereId: "m-v4", type: "anecdote-will", role: "principal", faible: false }],
      appuiPrincipal: { preuveId: "F15" },
      pointDeVue: "vous",
      emotion: "neutre",
      angle: {
        titre: "On recrute en quinze minutes",
        promesse: "On recrute nos collaborateurs en quinze minutes.",
        structure: "AV.S2",
        sourceAngle: "matiere",
        risqueBanal: 0.2,
        contrePied: false,
        quiParleConseille: "avatar",
        typeAngle: "cas",
        probleme: "Recruter : trier les candidatures, relancer, caler un rendez-vous, courir après la signature",
        cout: "plus d'une heure pour chaque personne",
        issue: "tout automatiser sauf la visio de quinze minutes",
        intensite: "douleur",
      },
      brief: { idee: "Recruter des apporteurs d'affaires", objectif: "conversation", niveauConscience: "connait-le-probleme", reseaux: ["facebook"], formatId: "facecam", formatsDemandes: ["facecam"], adresseParDefaut: "vous", modeChoix: "rapide", mentionIA: false },
    },
    preuves: [
      preuve("F15", "On recrute nos collaborateurs en quinze minutes : l'échange en visio dure 15 minutes, le reste est automatique.", { type: "chiffre-interne", nature: "chiffree", valeurs: [{ brut: "15 minutes", normalise: 15, unite: "min" }], formulationsAutorisees: ["quinze minutes"] }),
      preuve("F20", "Elle s'inscrit toute seule, en vingt secondes.", { type: "chiffre-interne", nature: "chiffree", valeurs: [{ brut: "20 secondes", normalise: 20, unite: "s" }], formulationsAutorisees: ["vingt secondes"] }),
      preuve("F1H", "Plus d'une heure, pour chaque personne.", { type: "chiffre-interne", nature: "chiffree", valeurs: [{ brut: "1 h", normalise: 1, unite: "h" }], formulationsAutorisees: ["plus d'une heure"] }),
    ],
    matieres: [matiere("anecdote-will", "On recrute nos collaborateurs en quinze minutes.", { id: "m-v4", motsCles: ["recrutement"], pilier: "automatisation" })],
    contexte: {
      interdits: [
        { id: "interdit-villeexemple", texte: "Villeexemple", regex: "villeexemple" },
        { id: "interdit-gain-garanti", texte: "Aucun gain garanti", regex: "gain garanti|aucun gain garanti" },
      ],
      promessesInterdites: [],
      rolesDestinataires: ["dirigeant", "DAF", "associé"],
      termesVagues: [],
      // Le carnet de voix de Will (« à reprendre telles quelles ») : son « Résultat : » de la v4.
      carnetVoix: ["Résultat :"],
    },
    // « PLAN » (la fin de la banque) se dit comme il s'écrit.
    prononciations: [{ forme: "PLAN", dit: "PLAN" }],
    tournures: TOURNURES,
    maintenant: MAINTENANT,
  };
  modif(e);
  return e;
}
