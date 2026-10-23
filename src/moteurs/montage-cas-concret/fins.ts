/**
 * PLAN DES FINS DU CAS CONCRET (tâche M2, plan cas concret § 4-d et § 4-e). PUR.
 *
 * La fin n'est jamais écrite par le format ni par Claude : elle est tirée d'une table de fins passée explicitement
 * (`TABLE_FINS_DIAGNOSTIC`) par `suiteDeFins`. Deux réseaux dont la suite est la même partagent une fin (un fichier).
 * X6 (12/10/2026) : une seule demande par fin. Fin « diagnostic » partout (« Faites votre diagnostic gratuit en quelques
 * minutes. » puis la phrase du lien du réseau) ; fin au mot (« Écrivez {MOT} en commentaire. » puis « Je vous envoie la
 * structure complète. », sans lien) seulement pour les sorties destinées à un compte où le mot est branché (`motSur`).
 * X7 : sur Instagram, la fin au mot est une seule phrase, « Abonnez-vous et écrivez {MOT} en commentaire : je vous
 * l'envoie. » (l'écran « appel-mot » seul).
 * Une suite dont une ligne n'est pas utilisable revient à la fin « diagnostic » de son réseau.
 */
import { choisir, ErreurFin, suiteDeFins, type FinChoisie, type FinTable } from "@/briques/fins";
import { construireLienSuivi, type ActiviteLien } from "@/domaine/mesures";
import { cadeauDeLOffre, FINS_DIAGNOSTIC, finsParReseau, formatCasConcret, type ReseauCas } from "@/formats/cas-concret";
import { estBranchable } from "@/formats/cas-concret/mots-branches";
import { codeReseau } from "@/reseaux/codes";
import type { NatureCas, Offre } from "@/formats/cas-concret/cas";
import { idEcranFinAttendu, type EcranFin, type FinPlanifiee, type PlanDesFins } from "./fiche";

export const MARQUE_FIN = "axion-ia.com";
export const RAISON_SUITE_REDUITE = "La fin au mot n'est pas encore validée : la fin propose le diagnostic.";
export const RAISON_SANS_CADEAU = "Cette offre n'a pas encore de document à envoyer : la fin propose le diagnostic.";
export const RAISON_MOT_NON_BRANCHE = "Le mot n'est pas branché sur ce compte : la fin propose le diagnostic.";

export interface DemandePlanDesFins {
  reseaux: readonly ReseauCas[];
  offre: Offre;
  /** Nature du cas (une intégration) : elle choisit le cadeau annoncé. */
  nature?: NatureCas;
  /** Mot à commenter, forme écrite (« IA »). */
  mot: string;
  /** Forme lue du mot (« I.A. »). */
  motDit?: string;
  /** Vrai : Will a coché « Avec le mot ». */
  avecMot: boolean;
  /** Réseaux où le mot est branché (posés au lancement) ; absent : nulle part. Le mot n'est dit que là, et si `avecMot`. */
  motSur?: readonly ReseauCas[];
  table: readonly FinTable[];
  /**
   * L3a · rang de la phrase « diagnostic » dans la rotation des phrases VALIDÉES interchangeables
   * (`phrasesDiagnosticInterchangeables`) ; absent ou 0 : la phrase par défaut du réseau (plan strictement identique).
   * RESTE À FAIRE : non branché dans `fabriquer.ts`. Le plan des fins est calculé AVANT l'écriture et la voix, alors que
   * la mise (`mise.tirage.fin.phrase`) n'est tirée qu'APRÈS le calage ; le brancher demande d'avancer le tirage.
   */
  rangPhrase?: number;
}

/** 2 à 24 lettres ou chiffres, sans espace. */
export function motValide(mot: string): boolean {
  return /^[\p{L}\p{N}]{2,24}$/u.test(mot);
}

/**
 * Code de version d'une vidéo du format pour un réseau (X4) : « 0042-CC-FB », numéro de version sur quatre chiffres,
 * code du format, code du réseau (`src/reseaux/codes.ts`).
 */
export function codeVersionCasConcret(numeroVersion: number, reseau: ReseauCas): string {
  return [String(numeroVersion).padStart(4, "0"), formatCasConcret.codeClassement, codeReseau(reseau)].join("-");
}

/**
 * Un lien suivi par réseau (ADR 0002) : `utm_campaign` = le code de version (« 0042-CC-FB »), `utm_content` = l'activité
 * visée. Sans numéro de version : une erreur, jamais un lien absent en silence (le préfixe « cc-<cas>-<id> » n'est plus posé).
 */
export function liensSuivis(reseaux: readonly ReseauCas[], numeroVersion: number | undefined, activite: ActiviteLien = "clients"): Record<string, string> {
  if (numeroVersion === undefined || !Number.isInteger(numeroVersion) || numeroVersion < 1) {
    throw new ErreurFin("Le numéro de la version est introuvable : le lien suivi (code de version) ne peut pas être posé.");
  }
  return Object.fromEntries(
    reseaux.map((r) => [r, construireLienSuivi({ typeLien: "video", reseau: r, code: codeVersionCasConcret(numeroVersion, r), activite, page: "/fr/diagnostic" })]),
  );
}

/** Ce qui suit l'écrit dans la phrase dite (« en quelques minutes »), sans la ponctuation finale ; vide sinon. */
function suiteDuDit(dit: string, ecran: string): string {
  const d = dit.trim();
  if (!d.toLowerCase().startsWith(ecran.trim().toLowerCase())) return "";
  return d.slice(ecran.trim().length).replace(/[.!?…]+$/, "").trim();
}

/**
 * Les écrans de fin (« f01 »…) d'une suite de lignes. Fin au mot : l'appel au mot, puis la promesse d'envoi. Fin
 * « diagnostic » : l'écran du diagnostic (titre et ligne tirés de la phrase), puis l'écran du lien (sa bulle, la signature).
 */
function ecransDeFin(appels: readonly FinChoisie[], mot: string): EcranFin[] {
  const ecrans: EcranFin[] = [];
  const commun = (a: readonly FinChoisie[]) => ({ marque: MARQUE_FIN, texteDit: a.map((l) => l.dit).join(" "), avanceMs: 0, evenements: [], fins: a.map((l) => l.id) });
  const id = () => idEcranFinAttendu(ecrans.length);
  const mots = appels.filter((a) => a.type === "commentaire");
  const cadeaux = appels.filter((a) => a.type === "cadeau");
  if (mots.length) ecrans.push({ ...commun(mots), id: id(), type: "appel-mot", fond: "ivoire", mot: mot.toUpperCase() });
  if (cadeaux.length) {
    const suite = cadeaux[1];
    ecrans.push({ ...commun(cadeaux), id: id(), type: "promesse", fond: "sombre", cadeau: cadeaux[0].ecran, ...(suite ? { ligne: suite.ecran } : {}) });
  }
  const diagnostic = appels.find((a) => a.type === "rendez-vous");
  const lien = appels.find((a) => a.type === "lien");
  if (diagnostic && lien) {
    const ligne = suiteDuDit(diagnostic.dit, diagnostic.ecran);
    ecrans.push({ ...commun([diagnostic]), id: id(), type: "diagnostic", fond: "sombre", titre: diagnostic.ecran, ...(ligne ? { ligne } : {}) });
    ecrans.push({ ...commun([lien]), id: id(), type: "lien", fond: "ivoire", titre: lien.dit.trim().replace(/[.!?…]+$/, ""), bulle: lien.ecran });
  }
  return ecrans;
}

/** Lignes « au mot » qui annoncent elles-mêmes l'envoi (X7 : « … : je vous l'envoie. »). */
export const FINS_MOT_AVEC_ENVOI: ReadonlySet<string> = new Set(["fin-ig-mot-abonnement"]);

/** Une suite tient debout : le diagnostic et son lien, ou le mot et son envoi (dit par une ligne à part ou par la même). */
const finComplete = (appels: readonly FinChoisie[]): boolean => {
  const a = (t: string) => appels.some((x) => x.type === t);
  return (a("rendez-vous") && a("lien")) || (a("commentaire") && (a("cadeau") || appels.some((x) => FINS_MOT_AVEC_ENVOI.has(x.id))));
};

/**
 * L3a · phrases « diagnostic » interchangeables d'un réseau : les lignes de `table` de type « rendez-vous », du MÊME groupe
 * que la ligne par défaut, validées par Will et permises sur ce réseau ; la ligne par défaut (`defautId`, sinon celle de
 * `FINS_DIAGNOSTIC`) d'abord, puis les autres dans l'ordre de la table. Aucune phrase n'est écrite ici. Seule cette demande
 * tourne : jamais les lignes commentaire, cadeau ni lien (sens différents ; X7 d'Instagram). Ligne par défaut absente : vide.
 */
export function phrasesDiagnosticInterchangeables(reseau: ReseauCas, table: readonly FinTable[], defautId?: string): FinTable[] {
  const id = defautId ?? FINS_DIAGNOSTIC[reseau].find((x) => table.find((f) => f.id === x)?.type === "rendez-vous");
  const defaut = table.find((f) => f.id === id && f.type === "rendez-vous");
  if (!defaut) return [];
  const utilisable = (f: FinTable) => {
    try {
      choisir(f, reseau);
      return true;
    } catch (e) {
      if (e instanceof ErreurFin) return false;
      throw e;
    }
  };
  const autres = table.filter((f) => f !== defaut && f.type === "rendez-vous" && f.groupe === defaut.groupe && f.validee && (!f.reseaux || f.reseaux.includes(reseau)) && utilisable(f));
  return [defaut, ...autres];
}

/** La suite `ids` dont la ligne « rendez-vous » est remplacée par la phrase de rang `rang` (0 : `ids` tels quels). */
function suiteAuRang(reseau: ReseauCas, ids: string[], table: readonly FinTable[], rang: number): string[] {
  if (!(Number.isInteger(rang) && rang > 0)) return ids;
  const i = ids.findIndex((id) => table.find((f) => f.id === id)?.type === "rendez-vous");
  if (i < 0) return ids;
  const pool = phrasesDiagnosticInterchangeables(reseau, table, ids[i]);
  if (pool.length < 2) return ids;
  return ids.map((id, k) => (k === i ? pool[rang % pool.length].id : id));
}

/** Plan des fins : une fin par suite distincte, ses lignes tirées de la table, ses écrans « f01 »… */
export function planDesFins(demande: DemandePlanDesFins): PlanDesFins {
  const { reseaux, offre, nature, mot, motDit, avecMot, table } = demande;
  const motSur = avecMot ? (demande.motSur ?? []).filter(estBranchable) : [];
  const suites = finsParReseau(offre, motSur, nature);
  // Une offre sans cadeau (coaching) : le mot n'est jamais dit, la fin le dit avec sa raison.
  const sansCadeau = !cadeauDeLOffre(offre, nature);
  const options = { mot, ...(motDit ? { motDit } : {}) };
  const groupes = new Map<string, { reseaux: ReseauCas[]; ids: string[]; raison?: string }>();
  const sansFin: PlanDesFins["sansFin"] = [];

  for (const reseau of new Set(reseaux)) {
    let ids = suites[reseau];
    let raison: string | undefined;
    if (ids.some((id) => table.find((f) => f.id === id)?.validee === false)) {
      ids = [...FINS_DIAGNOSTIC[reseau]];
      raison = RAISON_SUITE_REDUITE;
    } else if (avecMot && estBranchable(reseau)) {
      if (!motSur.includes(reseau)) raison = RAISON_MOT_NON_BRANCHE;
      else if (sansCadeau) raison = RAISON_SANS_CADEAU;
    }
    ids = suiteAuRang(reseau, ids, table, demande.rangPhrase ?? 0);
    const cle = ids.join("|");
    const groupe = groupes.get(cle);
    if (groupe) groupe.reseaux.push(reseau);
    else groupes.set(cle, { reseaux: [reseau], ids, ...(raison ? { raison } : {}) });
  }

  const fins: FinPlanifiee[] = [];
  const reduites: PlanDesFins["reduites"] = [];
  for (const { reseaux: partages, ids, raison } of groupes.values()) {
    try {
      const appels = suiteDeFins(partages[0], ids, options, table);
      if (!finComplete(appels)) {
        sansFin.push({ reseaux: partages, raison: "Il manque une ligne de la fin : aucune fin possible pour ces réseaux." });
        continue;
      }
      fins.push({ id: `fin-${partages.join("-")}`, reseaux: partages, appels, ecrans: ecransDeFin(appels, mot) });
      if (raison) reduites.push({ reseaux: partages, raison });
    } catch (e) {
      if (!(e instanceof ErreurFin)) throw e;
      sansFin.push({ reseaux: partages, raison: e.message });
    }
  }
  return { fins, reduites, sansFin };
}
