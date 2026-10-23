/**
 * PARAMÈTRES DU GÉNÉRATEUR PAR FORMAT (lot G3). PUR.
 *
 * Le générateur central ne nomme aucun format : il demande `parametresGenerateur(formatId)` et reçoit, en données, la
 * recette des contrôles (rôles des blocs, plafonds, structures), les tables du choix conjoint (points de vue par type
 * de matière, conditions des ressentis, bibliothèque d'accroches) et les règles de chaque réseau. Un format qui n'a pas
 * encore de recette v4 reçoit des valeurs déduites de sa recette résolue (famille + différences, B.4.0).
 */
import type { ParametresRecette, ParametresReseau, StructureGenerateur } from "@/domaine/controles-script/types";
import { formatGenerateur } from "@/formats";
import type { StructureRecette } from "@/formats/types";
import type { Emotion, ObjectifSujet, PointDeVue, ReseauDeclinaison, TypeAppel, TypeMatiere } from "@/domaine/types";
import { ecritureReseau } from "@/reseaux/ecriture";
import { CADRE_TYPE_AVOCAT } from "./domaine-axion";
import {
  ANNOTATIONS_AVOCAT,
  APPEL_PAR_DEFAUT_AVOCAT,
  APPELS_PAR_OBJECTIF_AVOCAT,
  APPELS_PERMIS_AVOCAT,
  BIBLIOTHEQUE_ACCROCHES_AVOCAT,
  CONDITIONS_EMOTIONS,
  DEBIT_AVATAR_MESURE_AVOCATREF,
  DOUBLE_DECONSEILLE_AVOCAT,
  EMOTIONS_AVOCAT,
  FAMILLES_INTERDITES_AVOCAT,
  FORMULES_APAISEMENT_AVOCAT,
  FORMULES_EXCEPTION_AVOCAT,
  PLAFONDS_AVOCAT,
  POINTS_DE_VUE_PAR_TYPE,
  STRUCTURES_AVOCAT,
  VERSION_RECETTE_AVOCAT,
  type LigneAccroche,
} from "./recette-avocat-v4";

export interface ParametresGenerateur {
  formatId: string;
  versionRecette: number;
  recette: ParametresRecette;
  pointsDeVueParType: Readonly<Record<TypeMatiere, PointDeVue[]>>;
  conditionsEmotions: Partial<Record<Emotion, TypeMatiere[]>>;
  accroches: LigneAccroche[];
  reseau: (r: ReseauDeclinaison) => ParametresReseau;
  famillesFavorisees: (r: ReseauDeclinaison) => { familles: string[]; poids: number };
  /** G4 : débits propres au générateur (mesurés), prioritaires sur la recette résolue du format. */
  debitParMode?: Partial<Record<import("@/domaine/types").ModeDiction, number>>;
  /**
   * Modèles de TON donnés dans `<gagnants>`, dans cet ordre : la v4 de Will (sa meilleure vidéo) pour tous les formats ;
   * les extraits de l'avocat de référence en plus pour un format qui imite ce style. Des modèles de ton, jamais un contenu à reprendre.
   */
  modelesDeTon: readonly SourceTon[];
  /**
   * Cadre propre au format, donné juste après la charte générale (`CADRE_AXION`) dans `<contexte_axion>` : seule la
   * recette avocat en a un (le style « type avocat », Will, 14/10). Absent : la charte générale seule.
   */
  cadreFormat?: string;
}

/** Ce que les blocs en cache lisent des paramètres d'un format. */
export type CadreDuFormat = Pick<ParametresGenerateur, "modelesDeTon" | "cadreFormat">;

/** Sources des modèles de ton : `will` (la v4, `modeles-will.ts`), `avocatref` (`modeles-avocatref.ts`). */
export type SourceTon = "will" | "avocatref";

/** Champs de publication exigés par réseau (C36, B.5.3). */
const CHAMPS_REQUIS: Partial<Record<ReseauDeclinaison, string[]>> = { "youtube-shorts": ["titres"] };
/** La 1re ligne doit porter le mot-clé (C10) ; exemptée là où la règle d'écriture le dit (2 premières lignes autonomes). */
const PREMIERE_LIGNE_EXEMPTEE: ReseauDeclinaison[] = ["linkedin"];

function reseauDepuis(r: ReseauDeclinaison, appels: { permis: TypeAppel[]; defaut: TypeAppel; parObjectif: Partial<Record<ObjectifSujet, TypeAppel>> }, doubleDeconseille: boolean): ParametresReseau {
  const e = ecritureReseau(r);
  return {
    id: r,
    zoneSec: e.zoneDureeSec.valeur,
    motsDiese: e.motsDiese.valeur,
    premiereLigneAvecMotCle: !PREMIERE_LIGNE_EXEMPTEE.includes(r),
    caracteresMaxPremiereLigne: e.premiereLigne.valeur.caracteresMax,
    boucle: e.boucle.valeur,
    appelsPermis: appels.permis,
    appelSelonObjectif: appels.parObjectif,
    appelParDefaut: appels.defaut,
    champsRequis: CHAMPS_REQUIS[r] ?? [],
    doubleDeconseille,
    ...(e.termesDuCompte ? { termesDuCompte: e.termesDuCompte.valeur } : {}),
  };
}

const TOUTES_ACCROCHES = BIBLIOTHEQUE_ACCROCHES_AVOCAT.map((l) => l.id as string);

function parametresAvocat(): ParametresGenerateur {
  const exigences: ParametresRecette["exigencesAccroche"] = Object.fromEntries(BIBLIOTHEQUE_ACCROCHES_AVOCAT.filter((l) => l.exige).map((l) => [l.id, { matiere: l.exige!.matiere, preuveChiffree: l.exige!.preuveChiffree, accordAvantApres: l.exige!.accordAvantApres, scene: l.exige!.scene }]));
  return {
    formatId: "avocat",
    versionRecette: VERSION_RECETTE_AVOCAT,
    recette: {
      roles: { accroche: "accroche", promesse: "promesse", appel: "appel", boucle: "boucle" },
      annotationsAcceptees: ANNOTATIONS_AVOCAT.acceptees,
      annotationsReservees: ANNOTATIONS_AVOCAT.reservees,
      intervenantsPermis: ["principal"],
      ...PLAFONDS_AVOCAT,
      famillesAccrochePermises: TOUTES_ACCROCHES.filter((f) => !FAMILLES_INTERDITES_AVOCAT.includes(f as never)),
      exigencesAccroche: exigences,
      emotionsPermises: EMOTIONS_AVOCAT,
      pointsDeVuePermis: ["je", "nous-clients", "vous", "un-dirigeant"],
      formulesException: FORMULES_EXCEPTION_AVOCAT,
      formulesApaisement: FORMULES_APAISEMENT_AVOCAT,
      structures: STRUCTURES_AVOCAT,
    },
    pointsDeVueParType: POINTS_DE_VUE_PAR_TYPE,
    conditionsEmotions: CONDITIONS_EMOTIONS,
    accroches: BIBLIOTHEQUE_ACCROCHES_AVOCAT,
    reseau: (r) => reseauDepuis(r, { permis: APPELS_PERMIS_AVOCAT[r], defaut: APPEL_PAR_DEFAUT_AVOCAT[r], parObjectif: Object.fromEntries(Object.entries(APPELS_PAR_OBJECTIF_AVOCAT).filter(([, v]) => v[r]).map(([k, v]) => [k, v[r]!])) }, DOUBLE_DECONSEILLE_AVOCAT.includes(r)),
    famillesFavorisees: (r) => ecritureReseau(r).famillesFavorisees.valeur,
    debitParMode: { avatar: DEBIT_AVATAR_MESURE_AVOCATREF },
    // La recette avocat imite le style de l'avocat de référence : ses extraits suivent ceux de Will.
    modelesDeTon: ["will", "avocatref"],
    cadreFormat: CADRE_TYPE_AVOCAT,
  };
}

/** Structure minimale d'une recette résolue (sans temps déclarés) vue par le générateur. */
function versStructureGenerateur(s: StructureRecette): StructureGenerateur {
  const appui = (s.exigences?.appui ?? []).map((x) => (x === "preuve" ? { preuve: "toute" as const } : { matiere: x }));
  return { id: s.id, nom: s.nom, enchainement: s.enchainement, typesAncrage: s.exigences?.typesAncrage ?? [], appui, temps: [], tirable: s.tirable ?? true, origine: "recette du format" };
}

/**
 * Face caméra (défaut de production du 15/10 : sans structure, tout sujet s'arrêtait sur MATIERE_INSUFFISANTE). Will se
 * filme et lit au téléprompteur : mêmes règles d'écriture que l'avocat (structures, contrôles, plafonds, accroches,
 * appels), la v4 de Will en référence. Restent propres au face caméra : ses blocs (accroche, corps, appel : ni promesse
 * ni boucle à part), son débit (celui du mode choisi dans sa recette, jamais le débit d'avatar mesuré sur l'avocat de référence), son
 * ton (Will seul, sans le cadre « type avocat ») et aucun double à déconseiller (il n'en a pas).
 */
function parametresFacecam(): ParametresGenerateur {
  const { debitParMode: _d, cadreFormat: _c, ...avocat } = parametresAvocat();
  void _d;
  void _c;
  const blocs = new Set(formatGenerateur("facecam").recette.blocs.map((b) => b.id));
  const { promesse, boucle, ...roles } = avocat.recette.roles;
  return {
    ...avocat,
    formatId: "facecam",
    recette: { ...avocat.recette, roles: { ...roles, ...(promesse && blocs.has(promesse) ? { promesse } : {}), ...(boucle && blocs.has(boucle) ? { boucle } : {}) } },
    reseau: (r) => ({ ...avocat.reseau(r), doubleDeconseille: false }),
    modelesDeTon: ["will"],
  };
}

/**
 * Face caméra animée (17/10) : même recette v4 que le face caméra (structures, contrôles, appels), plafonds de SA recette
 * (corps, accroche en 3 s) lus dans `formats/facecam-animee`. Sans cela, le format n'avait aucune structure.
 */
function parametresFacecamAnimee(): ParametresGenerateur {
  const p = parametresFacecam();
  const cibles = formatGenerateur("facecam-animee").recette.ciblesSecondes;
  return { ...p, formatId: "facecam-animee", recette: { ...p.recette, corpsMaxSec: cibles?.corpsMax ?? p.recette.corpsMaxSec, accrocheMaxSec: cibles?.ouvertureMax ?? p.recette.accrocheMaxSec, accrocheMaxMots: 12 } };
}

const RECETTES_V4: Record<string, () => ParametresGenerateur> = { avocat: parametresAvocat, facecam: parametresFacecam, "facecam-animee": parametresFacecamAnimee };

/** Paramètres du générateur pour un format (recette v4 si elle existe, sinon déduits de la recette résolue). */
export function parametresGenerateur(formatId: string): ParametresGenerateur {
  const v4 = RECETTES_V4[formatId];
  if (v4) return v4();
  const f = formatGenerateur(formatId);
  const r = f.recette;
  const roles = { accroche: r.partiesDeclinaison.ouverture[0] ?? "accroche", promesse: r.partiesDeclinaison.ouverture[1], appel: r.partiesDeclinaison.fin[0] ?? "appel", boucle: r.partiesDeclinaison.fin[1] };
  return {
    formatId,
    versionRecette: r.version,
    recette: {
      roles,
      annotationsAcceptees: r.annotations,
      annotationsReservees: r.annotationsReservees,
      accrocheMaxSec: PLAFONDS_AVOCAT.accrocheMaxSec,
      accrocheMaxMots: PLAFONDS_AVOCAT.accrocheMaxMots,
      appelFacultatif: true,
      appelMinMots: PLAFONDS_AVOCAT.appelMinMots,
      appelMaxMots: PLAFONDS_AVOCAT.appelMaxMots,
      corpsMaxSec: r.ciblesSecondes?.corpsMax ?? PLAFONDS_AVOCAT.corpsMaxSec,
      corpsIndicatifMinSec: r.ciblesSecondes?.corpsIndicatifMin,
      exceptionObligatoire: false,
      nombresMaxAccroche: r.nombresMaxAccroche ?? 1,
      famillesAccrochePermises: r.famillesAccroche?.permises ?? TOUTES_ACCROCHES,
      emotionsPermises: r.emotionsPermises,
      pointsDeVuePermis: r.pointsDeVuePermis,
      formulesException: [],
      formulesApaisement: [],
      structures: r.structures.map(versStructureGenerateur),
    },
    pointsDeVueParType: POINTS_DE_VUE_PAR_TYPE,
    conditionsEmotions: CONDITIONS_EMOTIONS,
    accroches: BIBLIOTHEQUE_ACCROCHES_AVOCAT,
    reseau: (x) => {
      const e = ecritureReseau(x);
      const permis = r.appelsParReseau?.[x] ?? e.appelsPermis?.valeur ?? ["envoi"];
      return reseauDepuis(x, { permis, defaut: permis[0], parObjectif: Object.fromEntries(Object.entries(r.appelsParObjectif ?? {}).filter(([, v]) => v?.[x]).map(([k, v]) => [k, v![x]!])) }, false);
    },
    famillesFavorisees: (x) => ecritureReseau(x).famillesFavorisees.valeur,
    modelesDeTon: ["will"],
  };
}
