/**
 * RES-3 · TIRAGE ATOMIQUE de la réserve de tutoriels (plan § 3.2) : prendre l'élément suivant et lancer sa fabrication
 * SANS clic, puis le suivre jusqu'à « fait » (la vidéo est « à valider ») ou « à revoir ». SANS session.
 *
 * ARGENT. Le tirage est une fabrication automatique : origine « usine » partout. AUCUN chemin ne lance une vidéo sans
 * avoir passé `conditionsTirage` (toutes avant la prise, donc avant toute dépense) :
 *  formulaire ouvert, entrée du type ouverte, script collé OU équipe active (même règle que `deposerTutoriel` : tutoriel.equipe ET
 *  tutoriel.claude), aucun élément déjà pris, voix allumée ⇒ devis
 *  avant dépense allumé, plafond Claude par vidéo ≤ limite de la réserve (1,25 € par défaut), plafond du mois non atteint,
 *  autonomie de l'usine allumée et sous son plafond. Tout est lu en ÉCHEC FERMÉ (une lecture qui lève = condition non remplie).
 * Sans voix par défaut, fin « à valider », jamais de publication, aucun créneau, aucun envoi. Le devis n'est jamais contourné.
 * Les montants ne sortent jamais d'ici : ni dans une phrase, ni dans une cloche.
 */
import "server-only";
import {
  CLE_TIRAGE_VALIDE,
  DELAI_PRIS_SANS_VIDEO_MS,
  MAX_EN_COURS,
  TENTATIVES_MAX,
  suivantFifo,
  type DeclencheurTirage,
  type ElementReserve,
  type EtatElementReserve,
  type IssueTirage,
  type RaisonAttente,
  type ReglagesReserve,
  type TirageReserve,
} from "@/domaine/tutoriel-reserve";
import { TAUX_USD_EUR_PAR_DEFAUT, usdVersEur } from "@/lib/montants";
import type { StatutVideo, TypeNotification } from "@/domaine/types";
import { creerVerrou, ErreurStudio, lireParametre, maintenant as maintenantReel } from "./_commun";
import { avecOrigineFournisseur } from "./plafond-fournisseur";
import type { IssueLancementReserve } from "./tutoriel-reserve-lancement";
import { changerEtatReserve, lireElementReserve, lireReglagesReserve, lireTirageReserve, listerReserve, noterVideoDuTirage, prendreSuivantReserve } from "./tutoriel-reserve";
import type { InterrupteursTutoriel } from "./tutoriel-depot";
import { CLE_DEVIS_AVANT_DEPENSE } from "./tutoriel-console";
import { fichierDeMaquetteDemo } from "./tutoriel-reserve-maquettes";

export interface DemandeTirage {
  declencheur: DeclencheurTirage;
  cle: string;
  elementId?: string;
}

/** Phrases lisibles (jamais un montant). */
export const PHRASES_ATTENTE: Record<RaisonAttente, string> = {
  formulaire_ferme: "Le tutoriel est fermé : rien n'est pris pour le moment.",
  entree_fermee: "L'entrée de ce type de tutoriel est fermée : rien n'est pris pour le moment.",
  equipe_eteinte: "Ni script collé ni équipe allumée : ce tutoriel resterait bloqué.",
  deja_en_cours: "Un tutoriel de la réserve est déjà en fabrication.",
  voix_sans_devis: "La voix demande le devis avant dépense : allumez-le d'abord.",
  plafond_video: "La limite par vidéo de la réserve est plus basse que le plafond d'écriture d'une vidéo.",
  plafond_mois: "Le plafond du mois est atteint : rien n'est pris.",
  autonomie_usine: "L'autonomie de l'usine n'est pas allumée, ou son plafond est atteint : rien n'est pris.",
  bail_occupe: "Un autre tirage est en cours : réessayez dans un instant.",
};

export const PHRASE_ECHEC_DEMO = "La maquette de démonstration n'a pas pu être préparée.";
export const PHRASE_ECHEC_LANCEMENT = "Le lancement a échoué : l'élément reste dans la réserve ou passe à revoir.";
export const PHRASE_VIDEO_ECHEC = "La vidéo n'a pas pu être fabriquée.";
export const PHRASE_PRIS_SANS_VIDEO = "Le lancement s'est interrompu avant la création de la vidéo.";
export const PHRASE_FAIT = "Un tutoriel de la réserve est prêt : à valider.";

export interface NotificationReserve {
  type: TypeNotification;
  titre: string;
  message?: string;
  lien?: string;
}

export interface DependancesTirage {
  maintenant?: () => string;
  reglages?: () => Promise<ReglagesReserve>;
  interrupteurs?: () => Promise<InterrupteursTutoriel>;
  /** Interrupteur booléen (`tutoriel.devisAvantDepense`) : seul `true` exact allume, une lecture qui lève éteint. */
  interrupteur?: (cle: string) => Promise<boolean>;
  /** Équipe de rôles active : `equipeTutorielActive()` (tutoriel.equipe ET tutoriel.claude), comme `deposerTutoriel` ; une lecture qui lève éteint. */
  equipe?: () => Promise<boolean>;
  /** Taux € pour 1 $ (réglage `taux.usdEur`) ; le plus haut de ce taux et du défaut est retenu (jamais sous-compter). Lecture en échec : défaut. */
  tauxUsdEur?: () => Promise<number>;
  /** Plafond Claude d'UNE vidéo de ce type, en dollars (réglage `tutoriel.plafondClaudeUsd`, sinon le défaut du mode). */
  plafondVideoUsd?: (e: ElementReserve) => Promise<number>;
  plafondMoisAtteint?: () => Promise<boolean>;
  accordSansClic?: () => Promise<boolean>;
  /** Le besoin (centimes d'euro) tient sous le plafond du mois de l'usine ? */
  sousPlafondUsine?: (besoinCentimes: number) => Promise<boolean>;
  lister?: () => Promise<ElementReserve[]>;
  lireElement?: (id: string) => Promise<ElementReserve | null>;
  lireTirage?: (cle: string) => Promise<TirageReserve | null>;
  prendre?: typeof prendreSuivantReserve;
  changerEtat?: typeof changerEtatReserve;
  noterVideo?: typeof noterVideoDuTirage;
  /** RES-2 : fichier stocké d'une maquette de démo. Par défaut : `fichierDeMaquetteDemo` (RES-2). */
  fichierDemo?: (e: ElementReserve) => Promise<{ fichierId: string }>;
  lancer?: (e: ElementReserve, o: { voix: boolean; fichierId?: string; noterBrouillon: (videoId: string) => Promise<void> }) => Promise<IssueLancementReserve>;
  notifier?: (n: NotificationReserve) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Valeurs par défaut (paresseuses : aucun import lourd à la charge)   */
/* ------------------------------------------------------------------ */

/** Seul `true` exact allume ; une lecture qui lève éteint. Une seule clé est lue ici : le devis avant dépense. */
async function interrupteurParDefaut(cle: string): Promise<boolean> {
  try {
    if (cle === CLE_DEVIS_AVANT_DEPENSE) return (await lireParametre<unknown>(CLE_DEVIS_AVANT_DEPENSE, false)) === true;
    return false;
  } catch {
    return false;
  }
}

/** Même règle que `deposerTutoriel` : équipe ET Claude allumés (elle attrape elle-même une lecture en échec : éteint). */
async function equipeParDefaut(): Promise<boolean> {
  try {
    return await (await import("./tutoriel-equipe")).equipeTutorielActive();
  } catch {
    return false;
  }
}

async function tauxParDefaut(): Promise<number> {
  return lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
}

async function interrupteursParDefaut(): Promise<InterrupteursTutoriel> {
  const { lireInterrupteursTutoriel } = await import("./tutoriel-depot");
  return lireInterrupteursTutoriel();
}

async function plafondVideoParDefautUsd(e: ElementReserve): Promise<number> {
  const { PARAM_PLAFOND_TUTORIEL, plafondTutorielParDefautUsd, plafondTutorielPhraseUsd } = await import("./tutoriel-claude");
  const regle = await lireParametre<unknown>(PARAM_PLAFOND_TUTORIEL, null);
  if (typeof regle === "number" && Number.isFinite(regle) && regle > 0) return regle;
  return e.source.type === "idee" ? plafondTutorielPhraseUsd() : plafondTutorielParDefautUsd();
}

async function plafondMoisParDefaut(): Promise<boolean> {
  const { plafondClaudeDuMoisAtteint } = await import("./plafond-claude");
  return plafondClaudeDuMoisAtteint("usine");
}

async function accordSansClicParDefaut(): Promise<boolean> {
  const { accordSansClicPour } = await import("./autonomie-usine");
  return accordSansClicPour("usine");
}

async function sousPlafondUsineParDefaut(besoin: number): Promise<boolean> {
  const { jugerSousPlafondUsine } = await import("./autonomie-usine");
  return (await jugerSousPlafondUsine({ besoin })).ok;
}

/** Fichier stocké d'une maquette de démo (RES-2). Toute panne autre qu'une erreur lisible devient une phrase sans détail. */
async function fichierDemoParDefaut(e: ElementReserve): Promise<{ fichierId: string }> {
  try {
    return await fichierDeMaquetteDemo(e);
  } catch (err) {
    if (err instanceof ErreurStudio) throw err;
    throw new ErreurStudio("RESERVE_STOCKAGE", PHRASE_ECHEC_DEMO);
  }
}

async function lancerParDefaut(e: ElementReserve, o: { voix: boolean; fichierId?: string; noterBrouillon: (videoId: string) => Promise<void> }): Promise<IssueLancementReserve> {
  const { lancerDepuisReserve } = await import("./tutoriel-reserve-lancement");
  const { noterBrouillon, ...options } = o;
  return lancerDepuisReserve(e, options, { noterBrouillon });
}

async function notifierParDefaut(n: NotificationReserve): Promise<void> {
  const { creerNotification } = await import("./notifications");
  // Cloche seulement (aucun push, aucun e-mail), aucun montant.
  await creerNotification(n, { cloche: true });
}

/* ------------------------------------------------------------------ */
/* Conditions                                                          */
/* ------------------------------------------------------------------ */

const attente = (raison: RaisonAttente): { raison: RaisonAttente; phrase: string } => ({ raison, phrase: PHRASES_ATTENTE[raison] });

/** Plafond Claude d'une vidéo en centimes d'euro, au centime supérieur. `null` : illisible (échec fermé). */
async function plafondVideoCentimes(e: ElementReserve, dep: DependancesTirage): Promise<number | null> {
  try {
    const usd = await (dep.plafondVideoUsd ?? plafondVideoParDefautUsd)(e);
    if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) return null;
    // Taux : le plus haut du défaut et du réglage `taux.usdEur` (un taux plus bas ferait sous-compter) ; illisible : le défaut.
    let taux = TAUX_USD_EUR_PAR_DEFAUT;
    try {
      const lu = await (dep.tauxUsdEur ?? tauxParDefaut)();
      if (typeof lu === "number" && Number.isFinite(lu) && lu > 0) taux = Math.max(TAUX_USD_EUR_PAR_DEFAUT, lu);
    } catch {
      taux = TAUX_USD_EUR_PAR_DEFAUT;
    }
    return Math.ceil(usdVersEur(usd * 100, taux).centimes);
  } catch {
    return null;
  }
}

/**
 * La première condition qui manque pour tirer `e` (sinon `null`). Dans l'ordre du plan § 3.2. LECTURE SEULE : aucune écriture,
 * aucune dépense. Toute lecture qui lève compte comme « condition non remplie » (échec fermé).
 */
export async function conditionsTirage(e: ElementReserve, r: ReglagesReserve, dep: DependancesTirage = {}): Promise<{ raison: RaisonAttente; phrase: string } | null> {
  const faux = async <T>(f: () => Promise<T>, defaut: T): Promise<T> => {
    try {
      return await f();
    } catch {
      return defaut;
    }
  };
  const sw = await faux(dep.interrupteurs ?? interrupteursParDefaut, { formulaire: false, dossier: false, phrase: false });
  if (sw.formulaire !== true) return attente("formulaire_ferme");
  const entree = e.source.type === "idee" ? sw.phrase : sw.dossier;
  if (entree !== true) return attente("entree_fermee");

  const lireInterrupteur = dep.interrupteur ?? interrupteurParDefaut;
  const aScript = typeof e.script === "string" && e.script.trim() !== "";
  if (!aScript && !(await faux(dep.equipe ?? equipeParDefaut, false))) return attente("equipe_eteinte");

  const liste = await faux(dep.lister ?? listerReserve, null as ElementReserve[] | null);
  if (liste === null || liste.filter((x) => x.etat === "pris").length >= MAX_EN_COURS) return attente("deja_en_cours");

  if (r.voix === true && !(await faux(() => lireInterrupteur(CLE_DEVIS_AVANT_DEPENSE), false))) return attente("voix_sans_devis");

  const limite = r.plafondVideoCentimes;
  const plafond = await plafondVideoCentimes(e, dep);
  if (plafond === null || !Number.isFinite(limite) || plafond > limite) return attente("plafond_video");

  if (await faux(dep.plafondMoisAtteint ?? plafondMoisParDefaut, true)) return attente("plafond_mois");

  const accord = await faux(dep.accordSansClic ?? accordSansClicParDefaut, false);
  if (!accord || !(await faux(() => (dep.sousPlafondUsine ?? sousPlafondUsineParDefaut)(limite), false))) return attente("autonomie_usine");
  return null;
}

/* ------------------------------------------------------------------ */
/* Échec d'un élément                                                  */
/* ------------------------------------------------------------------ */

/** Échec : moins de `TENTATIVES_MAX` échecs et non définitif → retour en réserve à sa place ; sinon « à revoir ». */
async function echouer(e: ElementReserve, phrase: string, definitif: boolean, dep: DependancesTirage): Promise<Extract<IssueTirage, { etat: "echec" }>> {
  const tentatives = e.tentatives + 1;
  const retourEnReserve = !definitif && tentatives < TENTATIVES_MAX;
  const vers: EtatElementReserve = retourEnReserve ? "en_reserve" : "a_revoir";
  try {
    await (dep.changerEtat ?? changerEtatReserve)(e.id, vers, { motif: phrase, patch: { tentatives, prise: undefined, motif: phrase } });
  } catch {
    /* l'élément reste « pris » : le suivi (15 min sans vidéo) le ramènera ; jamais de relance ici */
  }
  return { etat: "echec", elementId: e.id, phrase, retourEnReserve };
}

/* ------------------------------------------------------------------ */
/* Tirage                                                              */
/* ------------------------------------------------------------------ */

// Un seul tirage à la fois dans ce processus (conditions → prise) ; entre machines, le bail de `prendreSuivantReserve`.
const enSerie = creerVerrou();

function issueRejouee(t: TirageReserve, e: ElementReserve | null): IssueTirage {
  // Contrat § 6.3 : une clé dont la fiche porte une vidéo rend TOUJOURS « pris, déjà », quel que soit l'état de l'élément depuis.
  if (t.videoId) return { etat: "pris", deja: true, elementId: t.elementId, videoId: t.videoId, titre: e?.titre ?? "" };
  const priseCourante = !!e && (e.etat === "pris" || e.etat === "fait") && e.prise?.cle === t.cle;
  if (priseCourante) return { etat: "pris", deja: true, elementId: t.elementId, titre: e?.titre ?? "" };
  // Tirage déjà tenté puis échoué : rien n'est repris sous cette clé (une autre clé fera un autre essai).
  return { etat: "echec", elementId: t.elementId, phrase: e?.motif ?? PHRASE_ECHEC_LANCEMENT, retourEnReserve: e?.etat === "en_reserve" };
}

/**
 * Tire le suivant (ou l'élément demandé) et lance sa fabrication. Ordre du plan § 3.2 :
 * 1 rejeu de `cle` → 2 interrupteur → 3 conditions (élément candidat, avant la prise) → 4 prise atomique → 5 démo → 6 lancement
 * sans clic (origine usine) → 7 issue.
 */
export async function tirerSuivantReserve(d: DemandeTirage, dep: DependancesTirage = {}): Promise<IssueTirage> {
  if (typeof d?.cle !== "string" || !CLE_TIRAGE_VALIDE.test(d.cle)) throw new ErreurStudio("RESERVE_CLE", "La clé du tirage n'est pas valable.");
  return enSerie(() => tirer(d, dep));
}

async function tirer(d: DemandeTirage, dep: DependancesTirage): Promise<IssueTirage> {
  const lireElement = dep.lireElement ?? lireElementReserve;

  // 1. Rejeu : la même clé rend la même réponse, rien n'est retiré une seconde fois.
  const deja = await (dep.lireTirage ?? lireTirageReserve)(d.cle);
  if (deja) return issueRejouee(deja, await lireElement(deja.elementId));

  // 2. Interrupteur de la réserve (échec fermé). Seul l'essai (clic de Williams) passe éteint ; les conditions restent entières.
  let reglages: ReglagesReserve;
  try {
    reglages = await (dep.reglages ?? lireReglagesReserve)();
  } catch {
    return { etat: "eteint" };
  }
  if (reglages.actif !== true && d.declencheur !== "essai") return { etat: "eteint" };

  // 3. Conditions, sur l'élément candidat, AVANT la prise.
  const elements = await (dep.lister ?? listerReserve)();
  let candidat: ElementReserve | null;
  if (d.elementId) {
    const demande = elements.find((x) => x.id === d.elementId) ?? null;
    candidat = demande && demande.etat === "en_reserve" ? demande : null;
  } else {
    candidat = suivantFifo(elements.map((x) => x.id), new Map(elements.map((x) => [x.id, x] as const)));
  }
  if (!candidat) return { etat: "reserve_vide" };
  const manque = await conditionsTirage(candidat, reglages, dep);
  if (manque) return { etat: "attente", raison: manque.raison, phrase: manque.phrase };

  // 4. Prise atomique (verrou du processus + bail entre machines). Reprend le candidat DÉJÀ jugé : si un autre tirage a pris la
  // place entre-temps, la prise rend un autre élément ou rien, et les conditions sont rejouées sur lui.
  const prise = await (dep.prendre ?? prendreSuivantReserve)({ cle: d.cle, declencheur: d.declencheur, ...(d.elementId ? { elementId: d.elementId } : {}), maintenant: (dep.maintenant ?? maintenantReel)() });
  // `deja_en_cours` : la prise contrôle MAX_EN_COURS sous verrou (garde réelle) ; rien n'est pris, rien n'est lancé.
  if (prise === "deja_en_cours") return { etat: "attente", raison: "deja_en_cours", phrase: PHRASES_ATTENTE.deja_en_cours };
  if (prise === "bail_occupe") return { etat: "attente", raison: "bail_occupe", phrase: PHRASES_ATTENTE.bail_occupe };
  if (prise === null) return { etat: "reserve_vide" };
  const element = prise.element;
  if (prise.deja) return issueRejouee({ cle: d.cle, declencheur: d.declencheur, le: element.prise?.le ?? "", elementId: element.id, videoId: element.prise?.videoId }, element);
  if (element.id !== candidat.id) {
    // Garde : l'élément pris n'est pas celui dont les conditions ont été vérifiées (type, script) → on les vérifie sur lui, sinon retour.
    const manque2 = await conditionsTirage({ ...element }, reglages, { ...dep, lister: async () => elements.filter((x) => x.id !== element.id) });
    if (manque2) {
      await (dep.changerEtat ?? changerEtatReserve)(element.id, "en_reserve", { patch: { prise: undefined } }).catch(() => undefined);
      return { etat: "attente", raison: manque2.raison, phrase: manque2.phrase };
    }
  }

  // 5. Démo : une maquette sans fichier devient UNE FOIS un fichier stocké.
  let fichierId: string | undefined;
  if (element.source.type === "maquette-demo") {
    try {
      fichierId = element.source.fichierId ?? (await (dep.fichierDemo ?? fichierDemoParDefaut)(element)).fichierId;
    } catch (err) {
      return echouer(element, err instanceof ErreurStudio ? err.message : PHRASE_ECHEC_DEMO, true, dep);
    }
  }

  // 6. Lancement sans clic : origine « usine », sans voix sauf si Williams l'a allumée (devis exigé plus haut).
  // ARGENT : la vidéo est notée sur la fiche du tirage ET sur l'élément AVANT le lancement, puis relue : sans cela, un crash après le
  // lancement laisserait un élément « pris » sans vidéo, remis en réserve après 15 min, relancé et payé deux fois.
  const noterBrouillon = async (videoId: string): Promise<void> => {
    await (dep.noterVideo ?? noterVideoDuTirage)(d.cle, element.id, videoId);
    const prise = (await lireElement(element.id))?.prise;
    if (!prise || prise.cle !== d.cle || prise.videoId !== videoId) throw new ErreurStudio("RESERVE_NOTE", PHRASE_ECHEC_LANCEMENT);
  };
  let issue: IssueLancementReserve;
  try {
    issue = await avecOrigineFournisseur("usine", () => (dep.lancer ?? lancerParDefaut)(element, { voix: reglages.voix === true, ...(fichierId ? { fichierId } : {}), noterBrouillon }));
  } catch {
    return echouer(element, PHRASE_ECHEC_LANCEMENT, false, dep);
  }

  // 7. Issue.
  if (issue.statut === "refusee") return echouer(element, issue.phrase, issue.definitif, dep);
  try {
    await (dep.notifier ?? notifierParDefaut)({ type: "info", titre: "Un tutoriel de la réserve est en fabrication", lien: "/tutoriel-outil" });
  } catch {
    /* une cloche manquée ne défait pas le tirage */
  }
  return { etat: "pris", deja: false, elementId: element.id, videoId: issue.videoId, titre: element.titre };
}

/* ------------------------------------------------------------------ */
/* Suivi                                                               */
/* ------------------------------------------------------------------ */

export interface DependancesSuivi {
  maintenant?: () => string;
  lister?: () => Promise<ElementReserve[]>;
  /** Statut de la vidéo, ou `null` si elle n'existe plus. */
  statutVideo?: (videoId: string) => Promise<StatutVideo | null>;
  changerEtat?: typeof changerEtatReserve;
  notifier?: (n: NotificationReserve) => Promise<void>;
  /** Archive une vidéo restée brouillon (jamais effacée). Défaut : même geste que l'abandon du lancement. */
  abandonner?: (videoId: string) => Promise<void>;
}

async function abandonnerParDefaut(videoId: string): Promise<void> {
  const { abandonnerParDefaut: archiver } = await import("./tutoriel-reserve-lancement");
  await archiver(videoId);
}

async function statutVideoParDefaut(videoId: string): Promise<StatutVideo | null> {
  const { depots } = await import("./_commun");
  return (await depots().videos.obtenir(videoId))?.statut ?? null;
}

/**
 * À chaque tour de minuterie : un élément `pris` dont la vidéo est `prete` devient `fait` (cloche « à valider ») ; vidéo en
 * échec, annulée, archivée ou absente : échec ; `pris` sans vidéo depuis plus de 15 min : retour en réserve (tentative + 1) ; vidéo
 * restée `brouillon` depuis plus de 15 min (le lancement n'a jamais abouti) : brouillon archivé puis échec.
 * Aucun lancement, aucune dépense.
 */
export async function suivreElementsPris(dep: DependancesSuivi = {}): Promise<{ faits: number; echecs: number }> {
  const maintenant = Date.parse((dep.maintenant ?? maintenantReel)());
  const changer = dep.changerEtat ?? changerEtatReserve;
  let faits = 0;
  let echecs = 0;
  const pris = (await (dep.lister ?? listerReserve)()).filter((e) => e.etat === "pris");
  for (const e of pris) {
    try {
      const videoId = e.prise?.videoId;
      if (!videoId) {
        const depuis = Date.parse(e.prise?.le ?? "");
        if (!Number.isFinite(depuis) || maintenant - depuis > DELAI_PRIS_SANS_VIDEO_MS) {
          await echouer(e, PHRASE_PRIS_SANS_VIDEO, false, { changerEtat: changer });
          echecs++;
        }
        continue;
      }
      const statut = await (dep.statutVideo ?? statutVideoParDefaut)(videoId);
      if (statut === "prete") {
        await changer(e.id, "fait", { motif: PHRASE_FAIT });
        faits++;
        try {
          await (dep.notifier ?? notifierParDefaut)({ type: "video-prete", titre: PHRASE_FAIT, lien: `/tutoriel-outil/suivi/${videoId}` });
        } catch {
          /* une cloche manquée ne défait pas le suivi */
        }
      } else if (statut === "brouillon") {
        const depuis = Date.parse(e.prise?.le ?? "");
        if (!Number.isFinite(depuis) || maintenant - depuis > DELAI_PRIS_SANS_VIDEO_MS) {
          // Archivé D'ABORD : si l'archivage échoue, l'élément reste « pris » et le tour suivant réessaie.
          await (dep.abandonner ?? abandonnerParDefaut)(videoId);
          await echouer(e, PHRASE_PRIS_SANS_VIDEO, false, { changerEtat: changer });
          echecs++;
        }
      } else if (statut === null || statut === "echec" || statut === "annulee" || statut === "archivee") {
        await echouer(e, PHRASE_VIDEO_ECHEC, false, { changerEtat: changer });
        echecs++;
      }
    } catch {
      /* un élément à problème ne bloque pas les autres ; il sera revu au tour suivant */
    }
  }
  return { faits, echecs };
}
