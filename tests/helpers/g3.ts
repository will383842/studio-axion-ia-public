/**
 * Aides des tests du lot G3 (contrôles par code, choix conjoint, recette v4).
 *
 * Registre TRANSPOSÉ du cas « fin des Excel » (banc 06 et banc v4 : P1-P11, une matière « cas client », une limite de
 * Will, une observation, une question reçue) et une VERSION TÉMOIN propre (le corps B du banc v4 corrigé selon les
 * juges : accroche avec anomalie, 3 preuves dites, limite de Will, destinataire = un rôle, boucle raccordée). Chaque
 * test l'abîme d'UN défaut et vérifie que le bon contrôle se lève.
 */
import type { EntreeControle, TournureControle } from "@/domaine/controles-script";
import type { BlocScript, Matiere, Preuve, SegmentScript } from "@/domaine/types";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import { DRAPEAUX_TOURNURES, TOURNURES_CALIBREES } from "@/donnees/generateur/tournures-calibrees";

export const MAINTENANT = "2026-10-02T10:00:00.000Z";
export const PARAMS = parametresGenerateur("avocat");
export const RECETTE = PARAMS.recette;
export const TOURNURES: TournureControle[] = TOURNURES_CALIBREES.map((t) => ({ id: t.id, motif: t.motif, regex: t.regex, drapeaux: DRAPEAUX_TOURNURES, niveau: t.niveau }));

const LE = "2026-09-01T08:00:00.000Z";

export function preuve(id: string, enonce: string, extra: Partial<Preuve> = {}): Preuve {
  return {
    id,
    enonce,
    type: "cas-client",
    nature: "qualitative",
    valeurs: [],
    formulationsAutorisees: [],
    formulationsInterdites: [],
    motsClesIncompatibles: [],
    source: { titre: "Cas client Axion-IA (transposé)", date: LE },
    saisiePar: "will",
    niveau: "observe",
    client: { anonymise: true, accordEcrit: true, accordAvantApres: true, accordCapture: false },
    motsCles: ["excel", "donnees"],
    pilier: "donnees",
    statut: "validee",
    creeLe: LE,
    modifieLe: LE,
    ...extra,
  };
}

let n = 0;
export function matiere(type: Matiere["type"], texte: string, extra: Partial<Matiere> = {}): Matiere {
  n++;
  return {
    id: extra.id ?? `mat-g3-${n}`,
    type,
    texte,
    source: { origine: "dictee", date: LE },
    motsCles: ["excel"],
    pilier: "donnees",
    saisiePar: "will",
    statut: "validee",
    creeLe: LE,
    modifieLe: LE,
    ...(["cas-client", "parole-dirigeant"].includes(type) ? { accord: { requis: true, obtenu: true, le: LE, forme: "ecrit" as const } } : {}),
    ...extra,
  };
}

/** Registre P1-P11 transposé (06 §0) : les énoncés exacts du brief, au niveau OBSERVÉ. */
export const P: Record<string, Preuve> = {
  P1: preuve("P1", "Avant : une personne à temps plein gérait les données du client, 35 heures par semaine", { nature: "chiffree", valeurs: [{ brut: "35 h", normalise: 35, unite: "h" }], formulationsAutorisees: ["un temps plein", "35 heures par semaine"] }),
  P2: preuve("P2", "Avant : seule une partie des données était exploitée", { nature: "qualitative" }),
  P3: preuve("P3", "Livré : une console d'administration complète, avec un tableau de bord de toutes ses données"),
  P4: preuve("P4", "Livré : tous les Excel ont été supprimés, le suivi est entièrement automatique", { motsClesIncompatibles: ["automatiser Excel", "Excel", "macro Excel"], formulationsInterdites: ["automatisé tous ses Excel", "tout est automatisé", "automatiser Excel"] }),
  P5: preuve("P5", "Après : la personne a été affectée à un autre poste"),
  P6: preuve("P6", "Après : la tâche ne prend plus aucun temps", { nature: "chiffree", valeurs: [{ brut: "0 h", normalise: 0, unite: "h" }] }),
  P7: preuve("P7", "Après : une alerte part sur Telegram en cas de problème"),
  P8: preuve("P8", "Après : toutes les données sont exploitées en temps réel", { nature: "chiffree", valeurs: [{ brut: "100 %", normalise: 100, unite: "%" }] }),
  P9: preuve("P9", "Délai de mise en place : moins d'un mois", { nature: "vague", formulationsAutorisees: ["en moins d'un mois"] }),
  P10: preuve("P10", "Retour sur investissement : amorti en quelques semaines", { nature: "vague", formulationsAutorisees: ["amorti en quelques semaines"] }),
  P11: preuve("P11", "Ressenti du dirigeant : moins de pression", { formulationsInterdites: ["paix d'esprit", "la paix d'esprit"] }),
};

export const M = {
  cas: matiere("cas-client", "Chez un client, une personne passait 35 heures par semaine sur des Excel.", { id: "m-cas", preuveId: "P1", nomsSensibles: ["Durand Logistique"] }),
  limite: matiere("limite", "Si vos tableaux changent de forme chaque mois, gardez le tableur.", { id: "m-limite" }),
  observation: matiere("observation", "Dans presque toutes les PME que j'accompagne, un tableur sert de base de données.", { id: "m-obs" }),
  question: matiere("question-recue", "Est-ce qu'on peut se passer de nos Excel sans tout casser ?", { id: "m-question" }),
};

export function seg(id: string, texte: string, extra: Partial<SegmentScript> = {}): SegmentScript {
  return { id, texte, ...extra };
}
export function bloc(blocRecette: string, ...segments: SegmentScript[]): BlocScript {
  return { id: `b-${blocRecette}-${segments[0]?.id ?? "vide"}`, blocRecette, segments };
}

/** Version TÉMOIN (TikTok, double, vous, objectif « faire partager ») : doit passer tous les garde-fous. */
export function temoin(modif: (e: EntreeControle) => void = () => {}): EntreeControle {
  const e: EntreeControle = {
    auteur: "machine",
    mode: "avatar",
    adresse: "vous",
    debit: 4.4,
    ouverture: [bloc("accroche", seg("a1", "Un temps plein, rien que pour des Excel.", { nature: "fait", matiereIds: ["m-cas"], marqueurs: ["ancrage", "cout"] }))],
    corps: [
      bloc(
        "coeur",
        seg("c1", "Remplacer Excel, ici, voulait dire tout supprimer.", { nature: "fait", marqueurs: ["mot-cle"] }),
        seg("c2", "Chez un client, une personne y passait 35 heures par semaine.", { nature: "fait", preuveIds: ["P1"], marqueurs: ["preuve"] }),
        seg("c3", "Remplacer Excel a fait disparaître tous ses fichiers.", { nature: "fait", preuveIds: ["P4"], marqueurs: ["solution", "relance"] }),
      ),
      bloc(
        "preuve",
        seg("c4", "Pourtant, la tâche prend aujourd'hui 0 heure par semaine.", { nature: "fait", preuveIds: ["P6"], marqueurs: ["livraison", "relance", "resultat"] }),
        seg("c5", "Par contre, si vos tableaux changent de forme chaque mois, gardez le tableur.", { nature: "fait", matiereIds: ["m-limite"], sourceTexte: { matiereId: "m-limite" }, marqueurs: ["exception", "relance"], changementVisuel: true }),
        seg("c6", "Et ce temps sert désormais à autre chose.", { nature: "fait", preuveIds: ["P1"], marqueurs: ["emotion"] }),
      ),
    ],
    fin: [bloc("appel", seg("f1", "Envoyez-la à votre DAF, il saura quoi en faire.", { marqueurs: ["cta"] })), bloc("boucle", seg("f2", "Avant, c'était…"))],
    recette: RECETTE,
    reseau: PARAMS.reseau("tiktok"),
    structure: RECETTE.structures.find((s) => s.id === "AV.S3"),
    objectif: "notoriete",
    appel: { type: "envoi", texte: "Envoyez-la à votre DAF, il saura quoi en faire.", selonObjectif: true },
    boucle: true,
    motCle: "remplacer Excel",
    motCleSource: "hypothese",
    encadre: { texte: "Remplacer Excel : cas client" },
    publication: {
      texte: "Remplacer Excel : chez un client, 35 h par semaine sur des fichiers, puis 0 h.\n\nTous ses Excel ont été supprimés.",
      premiereLigne: "Remplacer Excel : 35 h par semaine, puis 0 h",
      motsDiese: ["#tableaudebord", "#remplacerexcel", "#gestion"],
      commentaireEpingle: "Chiffres issus d'un cas client Axion-IA, anonymisé.",
      sources: [],
      rappels: {},
      etiquetteIAPlateforme: false,
      justifications: [{ texte: "Mot-clé exact en première ligne.", regleId: "tt-mots-cles-2026" }],
      motCleVariante: "se passer d'Excel",
    },
    familleAccroche: "avant-apres",
    maitre: {
      ancrages: [{ matiereId: "m-cas", type: "cas-client", role: "principal", faible: false }],
      appuiPrincipal: { preuveId: "P1" },
      exception: { texte: M.limite.texte, source: "matiere", matiereId: "m-limite", valideeParWill: true, place: "apres-livraison" },
      pointDeVue: "nous-clients",
      emotion: "soulagement",
      angle: { titre: "Remplacer Excel, ici, c'était supprimer", promesse: "", structure: "AV.S3", sourceAngle: "matiere", risqueBanal: 0.2, contrePied: true, quiParleConseille: "avatar", typeAngle: "contre-pied", probleme: "Une personne passe ses semaines à recopier des fichiers Excel", cout: "un temps plein, 35 heures par semaine", issue: "supprimer les fichiers au lieu de les automatiser", intensite: "douleur" },
      envoi: { destinataire: "votre DAF", phrase: "Envoyez-la à votre DAF, il saura quoi en faire.", preuveIds: [], destinataireRole: "DAF" },
      brief: { idee: "Remplacer Excel", objectif: "notoriete", niveauConscience: "connait-le-probleme", reseaux: ["tiktok"], formatId: "facecam", formatsDemandes: ["facecam"], adresseParDefaut: "vous", modeChoix: "rapide", mentionIA: false },
    },
    preuves: Object.values(P),
    matieres: Object.values(M),
    contexte: {
      interdits: [
        { id: "interdit-reservation-directe", texte: "lien de réservation directe", regex: "calendly|r[ée]servez (un|votre) (cr[ée]neau|appel)" },
        { id: "interdit-telephone", texte: "numéro de téléphone public", regex: "0[1-9](?:[ .]?\\d{2}){4}" },
        { id: "interdit-certifexemple", texte: "Certifexemple hors drapeau", regex: "certifexemple" },
        { id: "interdit-engagement", texte: "engagement intenable", regex: "un point chaque semaine|r[ée]ponse sous une heure" },
      ],
      promessesInterdites: ["rentabilité immédiate"],
      rolesDestinataires: ["DAF", "dirigeant", "associé", "responsable administratif"],
      termesVagues: ["outil adapté", "solution sur mesure"],
      jargonInterdit: ["synergie"],
      misEnCause: ["tient vos Excel", "la personne remplacée"],
    },
    tournures: TOURNURES,
    prononciations: [{ forme: "DAF", dit: "D-A-F" }],
    maintenant: MAINTENANT,
  };
  modif(e);
  return e;
}

/** Remplace le texte d'un segment (par son id) dans une version. */
export function texteDe(e: EntreeControle, id: string, texte: string, extra: Partial<SegmentScript> = {}): void {
  for (const b of [...e.ouverture, ...e.corps, ...e.fin]) for (const s of b.segments) if (s.id === id) Object.assign(s, { texte, ...extra });
}
export function segmentDe(e: EntreeControle, id: string): SegmentScript {
  for (const b of [...e.ouverture, ...e.corps, ...e.fin]) for (const s of b.segments) if (s.id === id) return s;
  throw new Error(`segment ${id} absent`);
}
