/**
 * LECTURE DES BASES DE L'USINE PAR LE STUDIO. Source unique : `le dépôt privé des bases/usine/bases/pour-la-machine/*.md`,
 * copiée en JSON par `scripts/bases/synchroniser-bases.mts` dans `donnees/` (jamais corrigée à la main ici). Resynchroniser :
 *
 *   npx tsx scripts/bases/synchroniser-bases.mts <chemin de le dépôt privé des bases>/usine/bases/pour-la-machine
 *
 * PUR : aucune écriture, aucun réseau, aucun alias « @/ ». Les noms sont ceux de `usine/CONTRATS-ECHANGE.md`.
 * Filtre d'état : sans filtre, tout sauf `retire` ; `{ etats: ["valide"] }` pour ne lire que le validé ; `["retire"]` est permis.
 */
import cibles from "./donnees/1-cibles.json";
import tailles_ from "./donnees/2-tailles.json";
import sujets_ from "./donnees/3-sujets.json";
import casUsage_ from "./donnees/4-cas-d-usage.json";
import formats_ from "./donnees/5-formats.json";
import reseaux_ from "./donnees/6-reseaux.json";
import appels_ from "./donnees/7-appels.json";
import voixInterdits from "./donnees/8-voix-et-interdits.json";
import accroches_ from "./donnees/9-accroches.json";
import source_ from "./donnees/source.json";
import type { SourceBases } from "./empreintes";
import { listeDe, type LigneBrute, type TablesBrutes } from "./parseur";

/* ------------------------------------------------------------------ */
/* Types communs                                                       */
/* ------------------------------------------------------------------ */

/** `etat` des bases (contrat d'échange). */
export const ETATS_BASE = ["brouillon", "propose", "valide", "retire"] as const;
export type EtatBase = (typeof ETATS_BASE)[number];

export interface FiltreEtat {
  etats?: readonly EtatBase[];
}

/** Colonnes communes à toutes les tables. `version` = entier ; `valideLe` vide si jamais validé. */
export interface Suivi {
  etat: EtatBase;
  version: number;
  origine: "repris" | "propose";
  source: string;
  valideLe: string;
}

export type TypeContenuBase = "video" | "carrousel" | "image" | "texte" | "story";
export type TailleCode = "TPE" | "PME" | "ETI" | "GE";
/** Réseaux du studio (`IdReseau`). */
export type ReseauBase = "linkedin" | "instagram" | "facebook" | "tiktok" | "youtube" | "youtube-shorts";
export type ObjectifAppelBase = "MOT_CADEAU" | "LIEN_PROFIL" | "QUESTION" | "ENREGISTRER" | "PARTAGER" | "ABONNEMENT" | "RENDEZ_VOUS" | "CANDIDATURE";
export type TypeAppelBase = "abonnement" | "enregistrement" | "envoi" | "question" | "commentaire" | "cadeau" | "rendez-vous" | "lien";

const TYPES_CONTENU: readonly TypeContenuBase[] = ["video", "carrousel", "image", "texte", "story"];

function tables(fichier: unknown): TablesBrutes {
  return (fichier as { tables: TablesBrutes }).tables;
}

function lignes(fichier: unknown, table: string): readonly LigneBrute[] {
  const t = tables(fichier)[table];
  if (!t) throw new Error(`Table « ${table} » absente des bases synchronisées : relancer la synchronisation.`);
  return t.lignes;
}

function etatDe(valeur: string, code: string): EtatBase {
  // « remplacee » = retire (règle de lecture du contrat).
  const v = valeur === "remplacee" ? "retire" : valeur;
  if (!(ETATS_BASE as readonly string[]).includes(v)) throw new Error(`Etat « ${valeur} » inconnu pour ${code}.`);
  return v as EtatBase;
}

function suiviDe(l: LigneBrute): Suivi {
  return {
    etat: etatDe(l.etat, l.code),
    version: Number(l.version) || 0,
    origine: l.origine === "propose" ? "propose" : "repris",
    source: l.source ?? "",
    valideLe: l.valide_le ?? "",
  };
}

function garde<T extends { etat: EtatBase }>(liste: readonly T[], f?: FiltreEtat): T[] {
  const permis = f?.etats ?? ETATS_BASE.filter((e) => e !== "retire");
  return liste.filter((x) => permis.includes(x.etat));
}

/** `type_contenu` : « post_texte » des bases = `texte` du contrat ; cellule vide = tous. */
function typesContenuDe(cellule: string): TypeContenuBase[] {
  const l = listeDe(cellule).map((t) => (t === "post_texte" ? "texte" : t));
  const connus = l.filter((t): t is TypeContenuBase => (TYPES_CONTENU as readonly string[]).includes(t));
  return l.length === 0 ? [...TYPES_CONTENU] : connus;
}

/* ------------------------------------------------------------------ */
/* Base 2 · tailles                                                    */
/* ------------------------------------------------------------------ */

export interface Taille extends Suivi {
  code: TailleCode;
  nom: string;
  effectif: string;
  quiDecide: string;
  commentParler: string;
  ceQuiChange: string;
  mots: string[];
  neJamaisDire: string[];
  reseauxPrivilegies: string[];
  poids: number;
  actif: boolean;
}

export function tailles(f?: FiltreEtat): Taille[] {
  return garde(
    lignes(tailles_, "taille").map((l) => ({
      ...suiviDe(l),
      code: l.code as TailleCode,
      nom: l.nom,
      effectif: l.effectif,
      quiDecide: l.qui_decide,
      commentParler: l.comment_parler,
      ceQuiChange: l.ce_qui_change,
      mots: listeDe(l.mots),
      neJamaisDire: listeDe(l.ne_jamais_dire),
      reseauxPrivilegies: listeDe(l.reseaux_privilegies),
      poids: Number(l.poids) || 0,
      actif: l.actif === "oui",
    })),
    f,
  );
}

/* ------------------------------------------------------------------ */
/* Base 1 · métiers, douleurs, objections                              */
/* ------------------------------------------------------------------ */

export interface Douleur extends Suivi {
  code: string;
  /** `metier.code` ou `public.code`. */
  cible: string;
  dite: string;
  sceneAvant: string;
  cout: string;
  services: string[];
  /** Vide = les tailles typiques du métier (règle de lecture du contrat). */
  tailles: string[];
  typesContenu: TypeContenuBase[];
}

export interface Objection extends Suivi {
  code: string;
  cible: string;
  objection: string;
  reponse: string;
  service: string;
  ouLUtiliser: string[];
}

export interface Metier extends Suivi {
  code: string;
  numero: string;
  secteur: string;
  nature: string;
  nom: string;
  seNomment: string;
  mots: string[];
  veutVraiment: string;
  neJamaisDire: string[];
  taillesTypiques: string[];
  /** Colonne `actif` de la base (jamais l'interrupteur `allume` de l'Usine). */
  actif: boolean;
  profondeur: string;
  douleurs: Douleur[];
  objections: Objection[];
}

function douleurDe(l: LigneBrute): Douleur {
  return {
    ...suiviDe(l),
    code: l.code,
    cible: l.cible,
    dite: l.dite,
    sceneAvant: l.scene_avant,
    cout: l.cout,
    services: listeDe(l.services),
    tailles: listeDe(l.tailles),
    typesContenu: typesContenuDe(l.type_contenu),
  };
}

function objectionDe(l: LigneBrute): Objection {
  return { ...suiviDe(l), code: l.code, cible: l.cible, objection: l.objection, reponse: l.reponse, service: l.service, ouLUtiliser: listeDe(l.ou_l_utiliser) };
}

/** Douleurs d'un métier (ou d'un public : `public.apporteurs`…). Le filtre d'état vaut aussi pour les douleurs. */
export function douleurs(cible: string, f?: FiltreEtat): Douleur[] {
  return garde(lignes(cibles, "douleur").filter((l) => l.cible === cible).map(douleurDe), f);
}

export function objections(cible: string, f?: FiltreEtat): Objection[] {
  return garde(lignes(cibles, "objection").filter((l) => l.cible === cible).map(objectionDe), f);
}

function metierDe(l: LigneBrute, f?: FiltreEtat): Metier {
  return {
    ...suiviDe(l),
    code: l.code,
    numero: l.numero,
    secteur: l.secteur,
    nature: l.nature,
    nom: l.nom,
    seNomment: l.se_nomment,
    mots: listeDe(l.mots),
    veutVraiment: l.veut_vraiment,
    neJamaisDire: listeDe(l.ne_jamais_dire),
    taillesTypiques: listeDe(l.tailles_typiques),
    actif: l.actif === "oui",
    profondeur: l.profondeur,
    douleurs: douleurs(l.code, f),
    objections: objections(l.code, f),
  };
}

/** Tous les métiers, chacun avec ses douleurs, ses objections et ses mots. */
export function metiers(f?: FiltreEtat): Metier[] {
  return garde(lignes(cibles, "metier").map((l) => metierDe(l, f)), f);
}

/** Un métier par son code, ou null. */
export function metier(code: string, f?: FiltreEtat): Metier | null {
  const l = lignes(cibles, "metier").find((x) => x.code === code);
  if (!l) return null;
  const m = metierDe(l, f);
  return garde([m], f).length ? m : null;
}

export interface Secteur extends Suivi {
  code: string;
  nom: string;
}

export function secteurs(f?: FiltreEtat): Secteur[] {
  return garde(lignes(cibles, "secteur").map((l) => ({ ...suiviDe(l), code: l.code, nom: l.nom })), f);
}

/* ------------------------------------------------------------------ */
/* Base 4 · cas d'usage                                                */
/* ------------------------------------------------------------------ */

export interface CasUsage extends Suivi {
  code: string;
  numero: string;
  /** `metier.code` (ou `public.code`). */
  cible: string;
  service: string;
  sorte: string;
  titre: string;
  probleme: string;
  etapes: string;
  ceQueCaChange: string;
  resteHumain: string;
  douleurs: string[];
  posture: string;
  faits: string[];
  offre: string;
  sujet: string;
  formatsConseilles: string[];
  /** « rang 1 »… ou vide : cas phare. */
  phare: string;
  accroche: string;
}

export function casUsage(metier: string, f?: FiltreEtat): CasUsage[] {
  return garde(
    lignes(casUsage_, "cas_usage")
      .filter((l) => l.cible === metier)
      .map((l) => ({
        ...suiviDe(l),
        code: l.code,
        numero: l.numero,
        cible: l.cible,
        service: l.service,
        sorte: l.sorte,
        titre: l.titre,
        probleme: l.probleme,
        etapes: l.etapes,
        ceQueCaChange: l.ce_que_ca_change,
        resteHumain: l.reste_humain,
        douleurs: listeDe(l.douleurs),
        posture: l.posture,
        faits: listeDe(l.faits),
        offre: l.offre,
        sujet: l.sujet,
        formatsConseilles: listeDe(l.formats_conseilles),
        phare: l.phare,
        accroche: l.accroche,
      })),
    f,
  );
}

/* ------------------------------------------------------------------ */
/* Base 3 · familles et sujets                                         */
/* ------------------------------------------------------------------ */

export interface Famille extends Suivi {
  code: string;
  nom: string;
  suivi: string;
  rythmeCible: string;
  public: string;
  toujoursValideParWill: boolean;
  dansLesLots: boolean;
}

export interface Sujet extends Suivi {
  code: string;
  famille: string;
  titre: string;
  deQuoi: string;
  public: string;
  nourriPar: string;
  serieStudio: string;
  typesContenu: TypeContenuBase[];
  interditsPropres: string;
  actif: boolean;
}

export function familles(f?: FiltreEtat): Famille[] {
  return garde(
    lignes(sujets_, "famille").map((l) => ({
      ...suiviDe(l),
      code: l.code,
      nom: l.nom,
      suivi: l.suivi,
      rythmeCible: l.rythme_cible,
      public: l.public,
      toujoursValideParWill: l.toujours_valide_par_will === "oui",
      dansLesLots: l.dans_les_lots === "oui",
    })),
    f,
  );
}

export function sujets(f?: FiltreEtat): Sujet[] {
  return garde(
    lignes(sujets_, "sujet").map((l) => ({
      ...suiviDe(l),
      code: l.code,
      famille: l.famille,
      titre: l.titre,
      deQuoi: l.de_quoi,
      public: l.public,
      nourriPar: l.nourri_par,
      serieStudio: l.serie_studio,
      typesContenu: typesContenuDe(l.types_contenu),
      interditsPropres: l.interdits_propres,
      actif: l.actif === "oui",
    })),
    f,
  );
}

/* ------------------------------------------------------------------ */
/* Base 5 · formats                                                    */
/* ------------------------------------------------------------------ */

export interface FormatVideo extends Suivi {
  /** `format.id` du studio. */
  code: string;
  /** `format.code` : 2 ou 3 majuscules. */
  codeClassement: string;
  nom: string;
  statut: string;
  tournage: boolean;
  duree: string;
  reseauxConseilles: string[];
  squelette: string;
  enLot: boolean;
}

export interface FormatAutre extends Suivi {
  /** `format_autre.code` : `legende`, `carrousel`, `story`… */
  code: string;
  proprietaire: string;
  squelette: string;
  longueurMin: string;
  longueurMax: string;
  contientAppel: boolean;
  validation: string;
  etatService: string;
}

export function formats(f?: FiltreEtat): { video: FormatVideo[]; autres: FormatAutre[] } {
  return {
    video: garde(
      lignes(formats_, "format_video").map((l) => ({
        ...suiviDe(l),
        code: l.code,
        codeClassement: l.code_classement,
        nom: l.nom,
        statut: l.statut,
        tournage: l.tournage === "oui",
        duree: l.duree,
        reseauxConseilles: listeDe(l.reseaux_conseilles),
        squelette: l.squelette,
        enLot: l.en_lot === "oui",
      })),
      f,
    ),
    autres: garde(
      lignes(formats_, "format_autre").map((l) => ({
        ...suiviDe(l),
        code: l.code,
        proprietaire: l.proprietaire,
        squelette: l.squelette,
        longueurMin: l.longueur_min,
        longueurMax: l.longueur_max,
        contientAppel: l.contient_appel === "oui",
        validation: l.validation,
        etatService: l.etat_service,
      })),
      f,
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Base 6 · réseaux (règles de publication) et comptes                 */
/* ------------------------------------------------------------------ */

/** Une règle par réseau et sorte de publication ; les cellules restent du texte (« 9:16 », « 15-30 s »…). */
export interface ReglePublication extends Suivi {
  code: string;
  reseau: string;
  type: string;
  ratio: string;
  dureeConseillee: string;
  dureeMax: string;
  accroche: string;
  legendeMax: string;
  legendeVisible: string;
  motsDiese: string;
  lienCliquable: string;
  premierCommentaire: string;
  motPermis: string;
  rythmeMaxSemaine: string;
  ecartMinH: string;
  publieur: string;
  luLe: string;
  relire: string;
}

export interface CompteBase extends Suivi {
  code: string;
  reseau: string;
  nom: string;
  pageOuProfil: string;
  publieur: string;
  motBranche: string;
  actif: boolean;
}

/** Règles de publication, toutes ou d'un réseau. */
export function reseaux(reseau?: string, f?: FiltreEtat): ReglePublication[] {
  return garde(
    lignes(reseaux_, "publication")
      .filter((l) => reseau === undefined || l.reseau === reseau)
      .map((l) => ({
        ...suiviDe(l),
        code: l.code,
        reseau: l.reseau,
        type: l.type,
        ratio: l.ratio,
        dureeConseillee: l.duree_conseillee,
        dureeMax: l.duree_max,
        accroche: l.accroche,
        legendeMax: l.legende_max,
        legendeVisible: l.legende_visible,
        motsDiese: l.mots_diese,
        lienCliquable: l.lien_cliquable,
        premierCommentaire: l.premier_commentaire,
        motPermis: l.mot_permis,
        rythmeMaxSemaine: l.rythme_max_semaine,
        ecartMinH: l.ecart_min_h,
        publieur: l.publieur,
        luLe: l.lu_le,
        relire: l.relire,
      })),
    f,
  );
}

/** Comptes décrits par la base 6 (les comptes réels sont tenus par l'Usine : contrat § 2). */
export function comptes(f?: FiltreEtat): CompteBase[] {
  return garde(
    lignes(reseaux_, "compte").map((l) => ({
      ...suiviDe(l),
      code: l.code,
      reseau: l.reseau,
      nom: l.nom,
      pageOuProfil: l.page_ou_profil,
      publieur: l.publieur,
      motBranche: l.mot_branche,
      actif: l.actif === "oui",
    })),
    f,
  );
}

/* ------------------------------------------------------------------ */
/* Base 7 · appels à l'action                                          */
/* ------------------------------------------------------------------ */

/** Même forme que `AppelBanque` (`src/briques/fins/banque.ts`) : le test de non-divergence les compare. */
export interface AppelBase extends Suivi {
  code: string;
  reseaux: ReseauBase[];
  /** LinkedIn seulement : `linkedin` = profil, `linkedin_page` = page, les deux = les deux. */
  naturesLinkedin?: ("profil" | "page")[];
  /** `public.code`. */
  public: string;
  typeContenu: TypeContenuBase;
  type: TypeAppelBase;
  objectif: ObjectifAppelBase;
  dit: string;
  ecran: string;
  legende: string;
  mot: string;
  lien: string;
  emplacement: string;
}

function reseauxDeLAppel(cellule: string): { reseaux: ReseauBase[]; natures?: ("profil" | "page")[] } {
  const brut = listeDe(cellule);
  const natures: ("profil" | "page")[] = [];
  const reseaux: ReseauBase[] = [];
  for (const r of brut) {
    // « linkedin-page » ou « linkedin_page » = réseau linkedin, compte de nature page (contrat § 2).
    if (r === "linkedin_page" || r === "linkedin-page") {
      if (!natures.includes("page")) natures.push("page");
      if (!reseaux.includes("linkedin")) reseaux.push("linkedin");
    } else {
      if (r === "linkedin" && !natures.includes("profil")) natures.push("profil");
      if (!reseaux.includes(r as ReseauBase)) reseaux.push(r as ReseauBase);
    }
  }
  const ordre = (n: "profil" | "page") => (n === "profil" ? 0 : 1);
  return { reseaux, natures: reseaux.includes("linkedin") ? natures.sort((a, b) => ordre(a) - ordre(b)) : undefined };
}

export function appelDepuisLigne(l: LigneBrute): AppelBase {
  const { reseaux, natures } = reseauxDeLAppel(l.reseaux);
  const typeContenu = typesContenuDe(l.type_contenu)[0];
  return {
    ...suiviDe(l),
    code: l.code,
    reseaux,
    ...(natures ? { naturesLinkedin: natures } : {}),
    // `appel.cible = x` se lit `public.x`.
    public: l.cible.startsWith("public.") ? l.cible : `public.${l.cible}`,
    typeContenu,
    type: l.type as TypeAppelBase,
    objectif: l.objectif as ObjectifAppelBase,
    dit: l.dit,
    ecran: l.ecran,
    legende: l.legende,
    mot: l.mot,
    lien: l.lien,
    emplacement: l.emplacement,
  };
}

/** Toutes les lignes de la base 7 (ordre de la base), filtrées par état. */
export function tousLesAppels(f?: FiltreEtat): AppelBase[] {
  return garde(lignes(appels_, "appel").map(appelDepuisLigne), f);
}

/** Appels d'un réseau pour un objectif (ordre de la base). */
export function appels(reseau: ReseauBase, objectif: ObjectifAppelBase, f?: FiltreEtat): AppelBase[] {
  return tousLesAppels(f).filter((a) => a.reseaux.includes(reseau) && a.objectif === objectif);
}

/* ------------------------------------------------------------------ */
/* Base 8 · voix et interdits                                          */
/* ------------------------------------------------------------------ */

export interface Voix extends Suivi {
  code: string;
  regle: string;
  pourquoi: string;
  sAppliqueA: string[];
}

export interface Interdit extends Suivi {
  code: string;
  expression: string;
  remplacement: string;
  raison: string;
  portee: string;
}

export interface Fait extends Suivi {
  code: string;
  enonce: string;
  source: string;
  date: string;
  portee: string;
  perimeLe: string;
}

export function voix(f?: FiltreEtat): Voix[] {
  return garde(lignes(voixInterdits, "voix").map((l) => ({ ...suiviDe(l), code: l.code, regle: l.regle, pourquoi: l.pourquoi, sAppliqueA: listeDe(l.s_applique_a) })), f);
}

export function interdits(f?: FiltreEtat): Interdit[] {
  return garde(lignes(voixInterdits, "interdit").map((l) => ({ ...suiviDe(l), code: l.code, expression: l.expression, remplacement: l.remplacement, raison: l.raison, portee: l.portee })), f);
}

/** Faits sourcés : le seul endroit d'où un chiffre peut entrer dans un contenu (vide tant qu'aucun n'est validé). */
export function faits(f?: FiltreEtat): Fait[] {
  return garde(
    lignes(voixInterdits, "fait").map((l) => ({ ...suiviDe(l), code: l.code, enonce: l.enonce, source: l.source, date: l.date, portee: l.portee, perimeLe: l.perime_le })),
    f,
  );
}

/* ------------------------------------------------------------------ */
/* Base 9 · accroches                                                  */
/* ------------------------------------------------------------------ */

export interface Accroche extends Suivi {
  code: string;
  famille: string;
  modele: string;
  exemple: string;
  nePasFaire: string;
  /** « tous » ou liste de réseaux. */
  reseaux: string[];
  typesContenu: TypeContenuBase[];
}

export function accroches(f?: FiltreEtat): Accroche[] {
  return garde(
    lignes(accroches_, "accroche").map((l) => ({
      ...suiviDe(l),
      code: l.code,
      famille: l.famille,
      modele: l.modele,
      exemple: l.exemple,
      nePasFaire: l.ne_pas_faire,
      reseaux: listeDe(l.reseaux),
      typesContenu: typesContenuDe(l.types_contenu),
    })),
    f,
  );
}

/* ------------------------------------------------------------------ */
/* Source                                                              */
/* ------------------------------------------------------------------ */

export type { SourceBases };

/** Commit et date de la source lue au dernier passage de la synchronisation. */
export function sourceDesBases(): SourceBases {
  return source_ as SourceBases;
}
