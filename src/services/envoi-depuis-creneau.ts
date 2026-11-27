/**
 * L5-02a · ENVOI D'UNE VIDÉO DEPUIS LE CRÉNEAU : un créneau validé (statut `valide`, `valideeLe` lisible et passé) crée son
 * brouillon chez le diffuseur UNE SEULE FOIS, puis la promotion de L0-08 le programme dans sa fenêtre.
 *
 * Éteint par défaut : trois réglages doivent être `true` (zernio.envoi_autorise, zernio.envoi_calendrier_autorise,
 * publication.editoriale_active), lus avant tout appel ; absent, illisible ou non booléen = fermé. Aucun réglage n'est écrit ici.
 * Ce module ne dépend d'aucun service serveur : dépôt, client, réglages, états, notification et envoi (`envoyerReel`) sont
 * passés en paramètres. Personne ne l'appelle encore (socle pur ; le branchement de la boucle est L5-02c). Aucune suppression de données.
 *
 * L5-02b : un créneau peut porter un visuel (`nature`) ; la clé de 64 signes réellement envoyée au diffuseur est notée sur l'envoi
 * planifié (`cleDiffuseur`) pour que la promotion retrouve le brouillon ; un refus avant le réseau n'a droit qu'à UN nouvel essai
 * automatique par clé, puis « à corriger » (reprise par clic seulement). Création du brouillon au plus tôt 6 jours avant la date.
 */
import { createHash } from "node:crypto";
import type { Depot } from "@/domaine/depots";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { CLE_DIFFUSEUR } from "@/domaine/envoi-planifie";
import { STATUTS_CRENEAU_ENVOYABLES } from "@/domaine/plan-editorial/envoyable";
import type { ReseauEnvoiCreneau } from "@/domaine/reseaux-visuel-envoi";
import { CODES_AVANT_RESEAU, estErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { PROMOTION_MARGE_MIN_MS, enteteIdempotenceStudio } from "@/fournisseurs/publication/zernio-client";
import type { ClientZernio } from "@/fournisseurs/publication/zernio-client";
import { instantParis } from "@/lib/horloge-paris";
import { creerEnvoi, resoudreCleEnvoi, noterCleDiffuseur, validerEnvoi } from "./envois-planifies";
import { promouvoirEnvoisPlanifies, type EtatsPromotion, type NotificationPromotion, type OptionsPromotionEnvois } from "./promotion-envois";

/** Réglage éditorial (créé par L7-08, FAUX par défaut). Un test l'égale à `PARAM_EDITORIALE_ACTIVE` (services/zernio.ts). */
export const REGLAGE_EDITORIALE_ACTIVE = "publication.editoriale_active";

/** Un créneau du calendrier tel que le lit ce service (une vidéo, un réseau, une version de créneau). */
export interface CreneauCalendrier {
  id: string;
  /** Identifiant du MÉDIA (vidéo ou visuel, selon `nature`). */
  videoId: string;
  /** Absent = vidéo. */
  nature?: "video" | "visuel";
  reseau: ReseauEnvoiCreneau;
  versionCreneau: number;
  /** AAAA-MM-JJ, heure de Paris. */
  jour: string;
  /** HH:MM, heure de Paris ; jamais inventée. */
  heure?: string;
  statut: string;
  valideeLe?: string;
  valideePar?: string;
  texte: string;
  premierCommentaire?: string;
  consentementTiktok?: boolean;
  niveauConfidentialiteTiktok?: string;
}

/** Ce que reçoit l'envoi injecté (en production : un adaptateur autour de `envoyerReel("zernio", …)` en mode brouillon). */
export interface DemandeBrouillonCreneau {
  /** Identifiant du média (vidéo ou visuel). */
  videoId: string;
  nature?: "video" | "visuel";
  /** Le créneau du plan d'origine. */
  creneauId?: string;
  reseau: ReseauEnvoiCreneau;
  dateIso: string;
  texte: string;
  premierCommentaire?: string;
  /** `cleEnvoi(videoId, reseau, versionCreneau)` : arrive en `metadata.studioCle`. */
  cleEnvoi: string;
  /** `Idempotency-Key` (`studio-<sha256 de cleEnvoi>`). */
  idempotence: string;
  consentementTiktok?: boolean;
  niveauConfidentialiteTiktok?: string;
}

export type EtatLigneCreneau = "brouillon-cree" | "deja-cree" | "envoi-eteint" | "non-valide" | "a-verifier" | "a-reprogrammer" | "pas-encore" | "a-corriger" | "refuse" | "a-completer";

/** Création du brouillon au plus tôt 6 jours avant la date : le diffuseur garde les médias 7 jours (zernio-client.ts). */
export const FENETRE_CREATION_MS = 6 * 24 * 60 * 60 * 1000;

/**
 * Refus du Studio levés AVANT tout appel au diffuseur (rien n'est parti) : « refuse », avec un seul nouvel essai automatique.
 * Un code levé après l'appel au diffuseur n'a rien à faire ici. Vérifié dans publications.ts et envoi-visuel-creneau.ts (lecture seule).
 */
export const CODES_REFUS_STUDIO_AVANT_RESEAU: readonly string[] = [
  "ENVOI_CALENDRIER_FERME", "CRENEAU_NON_VALIDE", "CRENEAU_INCOMPLET", "RESEAU", "CIBLE_ZERNIO", "CIBLE_INCONNUE", "DATE_PASSEE",
  "STOCKAGE_SIMULE", "VISUEL_NON_VALIDE", "VISUEL_EXEMPLE", "VISUEL_ESSAI", "VISUEL_SANS_RENDU", "VISUEL_REFUSE", "FICHIER_ABSENT",
  "FICHIER_HORS_LIGNE", "TEXTE_ALTERNATIF_MANQUANT", "PREMIER_COMMENTAIRE_NON_TRANSMIS", "DEJA_DANS_OUTIL", "DEJA_CHEZ_UN_AUTRE_OUTIL",
  "TIKTOK_CASE", "PAS_PRETE", "AVANT_DE_PUBLIER", "TEXTES_MANQUANTS",
];

/** Refus qui ne comptent pas comme un essai : rien n'a été tenté (interrupteur fermé, arrêt d'urgence). */
const CODES_SANS_ESSAI: readonly string[] = ["ENVOI_CALENDRIER_FERME", "envoi-coupe"];

export interface LigneCreneau {
  cle: string;
  creneauId: string;
  etat: EtatLigneCreneau;
  raison?: string;
}

export interface ResultatTourCreneaux {
  lignes: LigneCreneau[];
  erreurs: string[];
  /** Compte rendu de la promotion (absent quand l'envoi est éteint ou qu'aucun créneau n'a été traité). */
  promotion?: Awaited<ReturnType<typeof promouvoirEnvoisPlanifies>>;
}

export interface DepsEnvoiCreneau {
  depot: Depot<EnvoiPlanifie>;
  creneaux(): Promise<CreneauCalendrier[]>;
  client: ClientZernio;
  reglages: {
    envoiAutorise(): Promise<boolean>;
    envoiCalendrierAutorise(): Promise<boolean>;
    editorialeActive?(): Promise<boolean>;
  };
  maintenant: () => number;
  etats: EtatsPromotion;
  notifier: (n: NotificationPromotion) => Promise<void>;
  /**
   * Seul l'outil « zernio » existe ici ; le type l'impose. Lève une erreur (Zernio ou du Studio) si l'envoi échoue.
   * Rend la clé de 64 signes réellement envoyée au diffuseur (`Publication.cleEnvoi`) : elle est notée, jamais recalculée.
   */
  envoyerReel: (outil: "zernio", demande: DemandeBrouillonCreneau) => Promise<{ cleDiffuseur: string } | void>;
  attendre?: (ms: number) => Promise<void>;
  /** Essai borné : la porte générale fermée, cet identifiant de créneau peut-il quand même créer SON brouillon ? Absent = non. */
  porteEssai?: (creneauId: string) => Promise<boolean>;
  suivi?: OptionsPromotionEnvois["suivi"];
  /** Pinterest : tableau voulu, relu dans la Publication de la clé d'envoi (garde de la promotion). */
  tableauAttendu?: OptionsPromotionEnvois["tableauAttendu"];
  /** Facultatif : trace des outils appelés (tests). */
  outilsAppeles?: string[];
}

const cleVerifier = (cle: string): string => `a-verifier:${cle}`;
const cleCreation = (cle: string): string => `creation:${cle}`;
const cleNotifie = (cle: string, jour: string, heure?: string): string => `a-reprogrammer:${cle}:${jour}:${heure ?? ""}`;
const cleTiktok = (cle: string): string => `tiktok-incomplet:${cle}`;
const cleEssais = (cle: string): string => `essais:${cle}`;
const cleCorrigerNotifie = (cle: string): string => `a-corriger-notifie:${cle}`;
const cleCompleterNotifie = (cle: string): string => `a-completer-notifie:${cle}`;
const cleDernierRefus = (cle: string): string => `dernier-refus:${cle}`;
const cleDernierRefusLe = (cle: string): string => `dernier-refus-le:${cle}`;

/** Raison affichée quand le texte du créneau est vide : rien n'est envoyé, aucun essai n'est consommé. */
export const RAISON_A_COMPLETER = "Légende à écrire : ouvrez le carrousel et écrivez sa légende. Rien n'est envoyé sans elle.";
const RAISON_MAX = 300;

/** Garde la dernière raison de refus de cette clé d'envoi (instant d'abord, raison ensuite). Jamais au journal : elle peut nommer des pages. */
async function noterDernierRefus(deps: DepsEnvoiCreneau, cle: string, raison: string): Promise<void> {
  try {
    await deps.etats.noter(cleDernierRefusLe(cle), new Date(deps.maintenant()).toISOString());
    await deps.etats.noter(cleDernierRefus(cle), raison.slice(0, RAISON_MAX));
  } catch {
    /* la mémoire de la raison ne bloque jamais un tour */
  }
}

/** Remet la raison à vide après un brouillon créé ; rien n'est écrit s'il n'y en avait pas. */
async function effacerDernierRefus(deps: DepsEnvoiCreneau, cle: string): Promise<void> {
  try {
    if (await deps.etats.lire(cleDernierRefus(cle))) {
      await deps.etats.noter(cleDernierRefus(cle), "");
      await deps.etats.noter(cleDernierRefusLe(cle), "");
    }
  } catch {
    /* idem */
  }
}

/** Dernière raison de refus gardée pour cette clé d'envoi (lecture seule, ne lève jamais). */
export async function lireDernierRefus(etats: Pick<EtatsPromotion, "lire">, cle: string): Promise<{ raison: string; le: string } | undefined> {
  try {
    const raison = await etats.lire(cleDernierRefus(cle));
    if (!raison) return undefined;
    return { raison, le: (await etats.lire(cleDernierRefusLe(cle))) ?? "" };
  } catch {
    return undefined;
  }
}

/** Erreur du Studio (`ErreurStudio`) reconnue sans l'importer (ce service est réservé au serveur) : un `code` en chaîne. */
const codeStudio = (e: unknown): string | undefined => (e instanceof Error && typeof (e as unknown as { code?: unknown }).code === "string" ? (e as unknown as { code: string }).code : undefined);

/** Passage en file : deux tours lancés ensemble dans le même processus ne se chevauchent jamais (l'état « creation: » est alors fiable). */
let file: Promise<unknown> = Promise.resolve();
function enFile<T>(f: () => Promise<T>): Promise<T> {
  const suite = file.then(f, f);
  file = suite.catch(() => undefined);
  return suite;
}

/** Corps de demande du brouillon (pur) : sert l'envoi injecté et le test du vrai constructeur de corps. */
export function corpsBrouillonCreneau(d: DemandeBrouillonCreneau): DemandeBrouillonCreneau & { mode: "brouillon"; date: string; cleEnvoi: string } {
  return { ...d, mode: "brouillon", date: d.dateIso };
}

/** Les trois réglages ouverts ; toute erreur ou toute valeur autre que `true` = fermé. */
async function ouverts(r: DepsEnvoiCreneau["reglages"]): Promise<boolean> {
  try {
    if (typeof r.editorialeActive !== "function") return false;
    return (await r.envoiAutorise()) === true && (await r.envoiCalendrierAutorise()) === true && (await r.editorialeActive()) === true;
  } catch {
    return false;
  }
}

/** Essai borné : une erreur = fermé. */
async function essaiOuvert(deps: DepsEnvoiCreneau, creneauId: string): Promise<boolean> {
  try {
    return typeof deps.porteEssai === "function" && (await deps.porteEssai(creneauId)) === true;
  } catch {
    return false;
  }
}

const valideeLisible = (c: CreneauCalendrier, maintenant: number): boolean => {
  const t = typeof c.valideeLe === "string" && c.valideeLe ? Date.parse(c.valideeLe) : NaN;
  return Number.isFinite(t) && t <= maintenant;
};

const idempotenceDe = (cle: string): string => enteteIdempotenceStudio(createHash("sha256").update(cle).digest("hex"));

async function traiter(deps: DepsEnvoiCreneau, c: CreneauCalendrier): Promise<LigneCreneau> {
  const cle = await resoudreCleEnvoi(deps.depot, { videoId: c.videoId, reseau: c.reseau, versionCreneau: c.versionCreneau, creneauId: c.id });
  const ligne: LigneCreneau = { cle, creneauId: c.id, etat: "refuse" };
  const debut = deps.maintenant();

  if (!STATUTS_CRENEAU_ENVOYABLES.includes(c.statut as never) || !valideeLisible(c, debut)) {
    ligne.etat = "non-valide";
    ligne.raison = "pas de validation datée : rien n'est envoyé";
    return ligne;
  }
  if (!(await ouverts(deps.reglages)) && !(await essaiOuvert(deps, c.id))) {
    ligne.etat = "envoi-eteint";
    ligne.raison = "envoi éteint (réglages zernio.envoi_autorise, zernio.envoi_calendrier_autorise, publication.editoriale_active)";
    return ligne;
  }
  if ((await deps.etats.lire(cleVerifier(cle))) === "a-verifier") {
    ligne.etat = "a-verifier";
    ligne.raison = "à vérifier chez le diffuseur : aucun nouvel essai automatique";
    return ligne;
  }
  if (!c.texte?.trim()) {
    ligne.etat = "a-completer";
    ligne.raison = RAISON_A_COMPLETER;
    await noterDernierRefus(deps, cle, ligne.raison);
    if ((await deps.etats.lire(cleCompleterNotifie(cle))) !== "notifie") {
      await deps.notifier({ cle, videoId: c.videoId, motif: "a-reprogrammer", raison: ligne.raison });
      await deps.etats.noter(cleCompleterNotifie(cle), "notifie");
    }
    return ligne;
  }
  if (!c.heure) {
    ligne.raison = "heure absente : aucune heure n'est inventée";
    await noterDernierRefus(deps, cle, ligne.raison);
    return ligne;
  }
  const t = Date.parse(instantParis(c.jour, c.heure));
  if (!Number.isFinite(t)) {
    ligne.raison = "date illisible";
    await noterDernierRefus(deps, cle, ligne.raison);
    return ligne;
  }
  if (t - debut <= PROMOTION_MARGE_MIN_MS) {
    ligne.etat = "a-reprogrammer";
    ligne.raison = "date passée ou à 30 min ou moins : à reprogrammer par vous";
    if ((await deps.etats.lire(cleNotifie(cle, c.jour, c.heure))) !== "notifie") {
      await deps.notifier({ cle, videoId: c.videoId, motif: "a-reprogrammer", raison: ligne.raison });
      await deps.etats.noter(cleNotifie(cle, c.jour, c.heure), "notifie");
    }
    return ligne;
  }
  if (t - debut > FENETRE_CREATION_MS) {
    ligne.etat = "pas-encore";
    ligne.raison = "à plus de 6 jours : le brouillon sera créé plus près de la date (médias gardés 7 jours par le diffuseur)";
    return ligne;
  }
  if (c.reseau === "tiktok" && (c.consentementTiktok !== true || !c.niveauConfidentialiteTiktok)) {
    ligne.raison = "TikTok : consentement et niveau de confidentialité à renseigner avant tout brouillon";
    if ((await deps.etats.lire(cleTiktok(cle))) !== "notifie") {
      await deps.notifier({ cle, videoId: c.videoId, motif: "tiktok-incomplet", raison: ligne.raison });
      await deps.etats.noter(cleTiktok(cle), "notifie");
    }
    return ligne;
  }

  // Envoi planifié local : créé une fois (idempotent), validé avec la date de validation du créneau.
  let e = await creerEnvoi(deps.depot, { videoId: c.videoId, reseau: c.reseau, versionCreneau: c.versionCreneau, jour: c.jour, heure: c.heure, nature: c.nature, creneauId: c.id }, new Date(debut).toISOString());
  if (e.cle !== cle) throw new Error("Clé d'envoi incohérente : rien n'est envoyé.");
  if (e.statut === "annule") {
    ligne.etat = "refuse";
    ligne.raison = "envoi annulé : rien n'est envoyé";
    return ligne;
  }
  if (e.statut === "brouillon") {
    e = await validerEnvoi(deps.depot, e.id, c.valideePar ?? "le fondateur", c.valideeLe as string);
    if (c.reseau === "tiktok") e = await deps.depot.modifier(e.id, { consentementTiktok: c.consentementTiktok, niveauConfidentialiteTiktok: c.niveauConfidentialiteTiktok });
  }

  if ((await deps.etats.lire(cleCreation(cle))) === "cree") {
    ligne.etat = "deja-cree";
    await effacerDernierRefus(deps, cle);
    return ligne;
  }
  // Rejeu après plantage entre la création et l'écriture locale (ou état « à vérifier » du client) : relire avant d'écrire.
  const etatCreation = await deps.etats.lire(cleCreation(cle));
  if (etatCreation === "en-cours" || deps.client.lectureExigee()) {
    const vus = [...(await deps.client.listerPosts({ status: "draft" })), ...(await deps.client.listerPosts({ status: "scheduled" }))];
    if (vus.some((p) => p.metadata?.studioCle === cle || (e.cleDiffuseur !== undefined && p.metadata?.studioCle === e.cleDiffuseur))) {
      await deps.etats.noter(cleCreation(cle), "cree");
      ligne.etat = "deja-cree";
      await effacerDernierRefus(deps, cle);
      return ligne;
    }
    if (etatCreation === "en-cours") {
      // Un appel a été commencé puis le processus s'est arrêté : la clé du diffuseur n'est pas connue, le brouillon est peut-être créé.
      await deps.etats.noter(cleVerifier(cle), "a-verifier");
      ligne.etat = "a-verifier";
      ligne.raison = "appel interrompu : à vérifier chez le diffuseur, aucun nouvel essai automatique";
      return ligne;
    }
  }

  // Un seul nouvel essai automatique par clé : au-delà, « à corriger » (reprise par clic seulement), aucun appel.
  const essais = Number(await deps.etats.lire(cleEssais(cle))) || 0;
  if (essais >= 2) {
    ligne.etat = "a-corriger";
    ligne.raison = "un nouvel essai a déjà eu lieu : corrigez puis réessayez depuis « À corriger »";
    if ((await deps.etats.lire(cleCorrigerNotifie(cle))) !== "notifie") {
      await deps.notifier({ cle, videoId: c.videoId, motif: "a-reprogrammer", raison: ligne.raison });
      await deps.etats.noter(cleCorrigerNotifie(cle), "notifie");
    }
    return ligne;
  }

  await deps.etats.noter(cleEssais(cle), String(essais + 1));
  await deps.etats.noter(cleCreation(cle), "en-cours");
  try {
    const rendu = await deps.envoyerReel("zernio", {
      videoId: c.videoId,
      nature: c.nature,
      creneauId: c.id,
      reseau: c.reseau,
      dateIso: new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z"),
      texte: c.texte,
      premierCommentaire: c.premierCommentaire,
      cleEnvoi: cle,
      idempotence: idempotenceDe(cle),
      consentementTiktok: c.consentementTiktok,
      niveauConfidentialiteTiktok: c.niveauConfidentialiteTiktok,
    });
    // Ordre : la clé du diffuseur d'abord, l'état ensuite.
    if (rendu && typeof rendu.cleDiffuseur === "string" && CLE_DIFFUSEUR.test(rendu.cleDiffuseur)) {
      await noterCleDiffuseur(deps.depot, e.id, rendu.cleDiffuseur, new Date(deps.maintenant()).toISOString());
    }
    await deps.etats.noter(cleCreation(cle), "cree");
    ligne.etat = "brouillon-cree";
    await effacerDernierRefus(deps, cle);
  } catch (err) {
    const code = estErreurZernio(err) ? err.code : codeStudio(err);
    const refusAvantReseau =
      (estErreurZernio(err) && (CODES_AVANT_RESEAU as readonly string[]).includes(err.code)) ||
      (!estErreurZernio(err) && code !== undefined && CODES_REFUS_STUDIO_AVANT_RESEAU.includes(code)) ||
      (!estErreurZernio(err) && code === "ENVOI_REFUSE");
    if (refusAvantReseau) {
      // Refus avant le réseau : rien n'est parti ; un seul nouvel essai automatique (voir « essais »).
      if (code !== undefined && CODES_SANS_ESSAI.includes(code)) await deps.etats.noter(cleEssais(cle), String(essais));
      await deps.etats.noter(cleCreation(cle), "refuse");
      ligne.etat = "refuse";
      ligne.raison = err instanceof Error ? err.message : "refus";
      await noterDernierRefus(deps, cle, ligne.raison);
    } else {
      // Réponse perdue (délai, 5xx, coupure) ou erreur inconnue : peut-être créé. « À vérifier », plus aucun appel.
      await deps.etats.noter(cleVerifier(cle), "a-verifier");
      ligne.etat = "a-verifier";
      ligne.raison = "réponse perdue : à vérifier chez le diffuseur, aucun nouvel essai automatique";
    }
  }
  return ligne;
}

/** Un créneau seul ; `undefined` si le créneau n'existe pas. */
export function envoyerDepuisCreneau(deps: DepsEnvoiCreneau, creneauId: string): Promise<LigneCreneau | undefined> {
  return enFile(async () => {
    const c = (await deps.creneaux()).find((x) => x.id === creneauId);
    return c ? traiter(deps, c) : undefined;
  });
}

/** Un tour : chaque créneau validé est traité (brouillon chez le diffuseur), puis la promotion de L0-08 passe. */
export function tourEnvoisCalendrier(deps: DepsEnvoiCreneau): Promise<ResultatTourCreneaux> {
  return enFile(() => tourSansFile(deps));
}

async function tourSansFile(deps: DepsEnvoiCreneau): Promise<ResultatTourCreneaux> {
  const res: ResultatTourCreneaux = { lignes: [], erreurs: [] };
  const creneaux = (await deps.creneaux()).sort((a, b) => a.id.localeCompare(b.id));
  for (const c of creneaux) {
    try {
      res.lignes.push(await traiter(deps, c));
    } catch (err) {
      // Journal sans donnée de personne : le message seul, jamais le texte du créneau.
      res.erreurs.push(err instanceof Error ? err.message : "erreur");
    }
  }
  if (res.lignes.some((l) => l.etat === "brouillon-cree" || l.etat === "deja-cree")) {
    res.promotion = await promouvoirEnvoisPlanifies({
      depot: deps.depot,
      client: deps.client,
      reglages: deps.reglages,
      maintenant: deps.maintenant,
      attendre: deps.attendre,
      suivi: deps.suivi,
      etats: deps.etats,
      notifier: deps.notifier,
      tableauAttendu: deps.tableauAttendu,
    });
  }
  return res;
}
