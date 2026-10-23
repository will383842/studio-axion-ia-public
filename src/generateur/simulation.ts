/**
 * ÉCRITURE SIMULÉE du générateur (lot G1a). PUR, aucun appel, aucune dépense.
 *
 * Tant que Claude n'est pas branché (G0, clé de Will), un sujet se décline quand même en textes et en versions par réseau
 * pour éprouver le modèle de données de bout en bout. Le texte produit est un gabarit honnête, construit à partir de
 * l'idée, du mot-clé et de la matière citée MOT POUR MOT ; il n'invente aucun fait.
 *
 * Règle du générateur central (plan v5 B.4.0, B.0 n° 30) : ce dossier ne nomme AUCUN format, aucun code de format, aucun
 * réseau, aucune annotation ni structure en dur. Tout est lu dans la recette résolue et dans `reseaux/ecriture.ts`.
 * Un test le vérifie (recherche dans `src/generateur/`).
 */
import { ecritureReseau } from "@/reseaux/ecriture";
import type { RecetteResolue } from "@/formats/familles";
import type { Adresse, BlocScript, Id, ModeDiction, ObjectifSujet, ReseauDeclinaison, SegmentScript, TypeAppel, TypeMatiere, VarianteReseau } from "@/domaine/types";

export interface EntreeSimulation {
  idee: string;
  motCle: string;
  adresse: Adresse;
  mode: ModeDiction;
  objectif: ObjectifSujet;
  recette: RecetteResolue;
  ancrage: { matiereId: Id; texte: string; type: TypeMatiere };
  /** Préfixe des identifiants de segments (unique par texte). */
  prefixe: string;
}

function tuOuVous(adresse: Adresse, vous: string, tu: string): string {
  return adresse === "tu" ? tu : vous;
}

function segment(prefixe: string, n: number, texte: string, extra: Partial<SegmentScript> = {}): SegmentScript {
  return { id: `${prefixe}-s${n}`, texte, ...extra };
}

/** Corps commun : les blocs de la recette hors ouverture et fin ; la matière y est citée telle quelle. */
export function simulerCorps(e: EntreeSimulation, facultatifsPour: ReseauDeclinaison[] = []): BlocScript[] {
  const parties = e.recette.partiesDeclinaison;
  const blocsCorps = e.recette.blocs.filter((b) => !parties.ouverture.includes(b.id) && !parties.fin.includes(b.id));
  const modeles = blocsCorps.length ? blocsCorps : [{ id: "corps" }];
  let n = 0;
  const blocs: BlocScript[] = modeles.map((b, i) => {
    const segments: SegmentScript[] = [];
    if (i === 0) {
      segments.push(segment(e.prefixe, ++n, e.ancrage.texte.trim(), { matiereIds: [e.ancrage.matiereId], sourceTexte: { matiereId: e.ancrage.matiereId }, nature: "fait", marqueurs: ["ancrage"] }));
      segments.push(segment(e.prefixe, ++n, `${e.motCle}, ${tuOuVous(e.adresse, "voici ce que ça change pour vous", "voici ce que ça change pour toi")}.`, { nature: "fait" }));
    } else {
      segments.push(segment(e.prefixe, ++n, `${tuOuVous(e.adresse, "Retenez", "Retiens")} une chose sur ${e.motCle} : ${e.idee.trim().replace(/[.!?]+$/, "")}.`, { nature: "opinion" }));
    }
    return { id: `${e.prefixe}-b${i + 1}`, blocRecette: b.id, segments };
  });
  const dernier = blocs[blocs.length - 1];
  for (const r of facultatifsPour.slice(0, e.recette.segmentsFacultatifsMax)) {
    dernier.segments.push(segment(e.prefixe, ++n, `${tuOuVous(e.adresse, "Pour aller plus loin", "Pour aller plus loin")} : ${e.motCle}, pas à pas.`, { facultatif: r, nature: "fait" }));
  }
  return blocs;
}

/** Phrasés d'accroche tournants : deux versions d'un même sujet n'ont jamais la même accroche dite (C14). */
const ACCROCHES: ((motCle: string, adresse: Adresse) => string)[] = [
  (m, a) => `${m} : l'erreur que ${tuOuVous(a, "vous faites", "tu fais")} sans le savoir.`,
  (m) => `Ce que personne ne dit sur ${m}.`,
  (m, a) => `${tuOuVous(a, "Vous pensez", "Tu penses")} connaître ${m} ? Pas tout à fait.`,
  (m) => `${m} : la question que tout le monde se pose.`,
  (m, a) => `${tuOuVous(a, "Avant de toucher à", "Avant de toucher à")} ${m}, une seule chose compte.`,
  (m) => `${m}, en une minute.`,
  (m) => `Le vrai problème avec ${m}.`,
];

const TEXTES_APPEL: Record<TypeAppel, (a: Adresse) => string> = {
  envoi: (a) => tuOuVous(a, "À envoyer à la personne qui s'en occupe chez vous.", "À envoyer à la personne qui s'en occupe chez toi."),
  sauvegarde: (a) => tuOuVous(a, "Gardez cette vidéo pour le jour où vous en aurez besoin.", "Garde cette vidéo pour le jour où tu en auras besoin."),
  "question-expert": (a) => tuOuVous(a, "Et chez vous, combien de temps ça prend ?", "Et chez toi, combien de temps ça prend ?"),
  "episode-suivant": () => "La suite dans la prochaine vidéo.",
  diagnostic: (a) => tuOuVous(a, "Le lien pour en parler est en commentaire.", "Le lien pour en parler est en commentaire."),
};

export interface VersionSimulee {
  ouverture: BlocScript[];
  fin: BlocScript[];
  appel: VarianteReseau["appel"];
  boucle: boolean;
  encadre: VarianteReseau["encadre"];
  publication: VarianteReseau["publication"];
  accrocheId: Id;
}

/**
 * Ouverture et fin d'UNE version par réseau. `rang` = place de cette version parmi toutes celles du sujet (formats et
 * corps compris), pour que les accroches dites restent toutes différentes.
 */
export function simulerVersion(e: EntreeSimulation, reseau: ReseauDeclinaison, rang: number): VersionSimulee {
  const ecriture = ecritureReseau(reseau);
  const parties = e.recette.partiesDeclinaison;
  const accroche = ACCROCHES[rang % ACCROCHES.length](e.motCle, e.adresse) + (rang >= ACCROCHES.length ? ` (${Math.floor(rang / ACCROCHES.length) + 1})` : "");
  const promesse = tuOuVous(e.adresse, `Je vous explique en trente secondes.`, `Je t'explique en trente secondes.`);
  const typeAppel: TypeAppel | undefined = e.recette.appelsParObjectif?.[e.objectif]?.[reseau];
  const appelType: TypeAppel = typeAppel ?? ecriture.appelsPermis?.valeur[0] ?? "sauvegarde";
  const appel = { type: appelType, texte: TEXTES_APPEL[appelType](e.adresse), selonObjectif: !!typeAppel };
  const boucle = ecriture.boucle.valeur === "oui" || (ecriture.boucle.valeur === "sauf-apres-question" && appelType !== "question-expert");
  const p = `${e.prefixe}-${reseau}`;
  const ouverture: BlocScript[] = parties.ouverture
    .filter((id) => e.recette.blocs.some((b) => b.id === id))
    .map((id, i) => ({ id: `${p}-o${i + 1}`, blocRecette: id, segments: [segment(`${p}-o${i + 1}`, 1, i === 0 ? accroche : promesse, i === 0 ? { marqueurs: ["mot-cle"] } : {})] }));
  const textesFin = [appel.texte, boucle ? `Et c'est pour ça que ${e.motCle} mérite ${tuOuVous(e.adresse, "votre", "ton")} attention.` : ""];
  const fin: BlocScript[] = parties.fin
    .filter((id) => e.recette.blocs.some((b) => b.id === id))
    .map((id, i) => ({ id: `${p}-f${i + 1}`, blocRecette: id, segments: textesFin[i] ? [segment(`${p}-f${i + 1}`, 1, textesFin[i], i === 0 ? { marqueurs: ["cta"] } : { marqueurs: ["boucle-fermee"] })] : [] }))
    .filter((b) => b.segments.length > 0);
  const [min] = ecriture.motsDiese.valeur;
  const motsDiese = Array.from({ length: Math.max(min, 1) }, (_, i) => `#${e.motCle.replace(/[^\p{L}\p{N}]+/gu, "")}${i ? i + 1 : ""}`);
  const premiereLigne = `${e.motCle} : ${accroche.replace(/[.?!]+$/, "")}`.slice(0, ecriture.premiereLigne.valeur.caracteresMax ?? 125);
  return {
    ouverture,
    fin,
    appel,
    boucle,
    encadre: { texte: e.motCle.split(/\s+/).slice(0, 5).join(" ") },
    accrocheId: `${p}-accroche`,
    publication: {
      texte: `${premiereLigne}\n\n${e.idee.trim()}`,
      motsDiese,
      premiereLigne,
      sources: [],
      rappels: {},
      etiquetteIAPlateforme: false,
      justifications: [{ texte: ecriture.premiereLigne.valeur.consigne, regleId: ecriture.premiereLigne.regleId }],
    },
  };
}
