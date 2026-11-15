/**
 * L5-02a · ENVOI D'UNE VIDÉO DEPUIS LE CRÉNEAU : un créneau validé (statut `valide`, `valideeLe` lisible et passé) crée son
 * brouillon chez le diffuseur UNE SEULE FOIS, puis la promotion de L0-08 le programme dans sa fenêtre.
 *
 * Éteint par défaut : trois réglages doivent être `true` (zernio.envoi_autorise, zernio.envoi_calendrier_autorise,
 * publication.editoriale_active), lus avant tout appel ; absent, illisible ou non booléen = fermé. Aucun réglage n'est écrit ici.
 * Ce module ne dépend d'aucun service serveur : dépôt, client, réglages, états, notification et envoi (`envoyerReel`) sont
 * passés en paramètres. Personne ne l'appelle encore (branchement de la boucle : L5-02b). Aucune suppression de données.
 */
import { createHash } from "node:crypto";
import type { Depot } from "@/domaine/depots";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { cleEnvoi } from "@/domaine/envoi-planifie";
import type { ReseauDeclinaison } from "@/domaine/types";
import { CODES_AVANT_RESEAU, estErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { PROMOTION_MARGE_MIN_MS, enteteIdempotenceStudio } from "@/fournisseurs/publication/zernio-client";
import type { ClientZernio } from "@/fournisseurs/publication/zernio-client";
import { instantParis } from "@/lib/horloge-paris";
import { creerEnvoi, validerEnvoi } from "./envois-planifies";
import { promouvoirEnvoisPlanifies, type EtatsPromotion, type NotificationPromotion, type OptionsPromotionEnvois } from "./promotion-envois";

/** Réglage éditorial (créé par L7-08, FAUX par défaut). Un test l'égale à `PARAM_EDITORIALE_ACTIVE` (services/zernio.ts). */
export const REGLAGE_EDITORIALE_ACTIVE = "publication.editoriale_active";

/** Un créneau du calendrier tel que le lit ce service (une vidéo, un réseau, une version de créneau). */
export interface CreneauCalendrier {
  id: string;
  videoId: string;
  reseau: ReseauDeclinaison;
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
  videoId: string;
  reseau: ReseauDeclinaison;
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

export type EtatLigneCreneau = "brouillon-cree" | "deja-cree" | "envoi-eteint" | "non-valide" | "a-verifier" | "a-reprogrammer" | "refuse";

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
  /** Seul l'outil « zernio » existe ici ; le type l'impose. Lève une erreur Zernio si l'envoi échoue. */
  envoyerReel: (outil: "zernio", demande: DemandeBrouillonCreneau) => Promise<void>;
  attendre?: (ms: number) => Promise<void>;
  suivi?: OptionsPromotionEnvois["suivi"];
  /** Facultatif : trace des outils appelés (tests). */
  outilsAppeles?: string[];
}

const cleVerifier = (cle: string): string => `a-verifier:${cle}`;
const cleCreation = (cle: string): string => `creation:${cle}`;
const cleNotifie = (cle: string, jour: string, heure?: string): string => `a-reprogrammer:${cle}:${jour}:${heure ?? ""}`;
const cleTiktok = (cle: string): string => `tiktok-incomplet:${cle}`;

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

const valideeLisible = (c: CreneauCalendrier, maintenant: number): boolean => {
  const t = typeof c.valideeLe === "string" && c.valideeLe ? Date.parse(c.valideeLe) : NaN;
  return Number.isFinite(t) && t <= maintenant;
};

const idempotenceDe = (cle: string): string => enteteIdempotenceStudio(createHash("sha256").update(cle).digest("hex"));

async function traiter(deps: DepsEnvoiCreneau, c: CreneauCalendrier): Promise<LigneCreneau> {
  const cle = cleEnvoi(c.videoId, c.reseau, c.versionCreneau);
  const ligne: LigneCreneau = { cle, creneauId: c.id, etat: "refuse" };
  const debut = deps.maintenant();

  if (c.statut !== "valide" || !valideeLisible(c, debut)) {
    ligne.etat = "non-valide";
    ligne.raison = "pas de validation datée : rien n'est envoyé";
    return ligne;
  }
  if (!(await ouverts(deps.reglages))) {
    ligne.etat = "envoi-eteint";
    ligne.raison = "envoi éteint (réglages zernio.envoi_autorise, zernio.envoi_calendrier_autorise, publication.editoriale_active)";
    return ligne;
  }
  if ((await deps.etats.lire(cleVerifier(cle))) === "a-verifier") {
    ligne.etat = "a-verifier";
    ligne.raison = "à vérifier chez le diffuseur : aucun nouvel essai automatique";
    return ligne;
  }
  if (!c.heure) {
    ligne.raison = "heure absente : aucune heure n'est inventée";
    return ligne;
  }
  const t = Date.parse(instantParis(c.jour, c.heure));
  if (!Number.isFinite(t)) {
    ligne.raison = "date illisible";
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
  if (c.reseau === "tiktok" && (c.consentementTiktok !== true || !c.niveauConfidentialiteTiktok)) {
    ligne.raison = "TikTok : consentement et niveau de confidentialité à renseigner avant tout brouillon";
    if ((await deps.etats.lire(cleTiktok(cle))) !== "notifie") {
      await deps.notifier({ cle, videoId: c.videoId, motif: "tiktok-incomplet", raison: ligne.raison });
      await deps.etats.noter(cleTiktok(cle), "notifie");
    }
    return ligne;
  }

  // Envoi planifié local : créé une fois (idempotent), validé avec la date de validation du créneau.
  let e = await creerEnvoi(deps.depot, { videoId: c.videoId, reseau: c.reseau, versionCreneau: c.versionCreneau, jour: c.jour, heure: c.heure }, new Date(debut).toISOString());
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
    return ligne;
  }
  // Rejeu après plantage entre la création et l'écriture locale (ou état « à vérifier » du client) : relire avant d'écrire.
  if ((await deps.etats.lire(cleCreation(cle))) === "en-cours" || deps.client.lectureExigee()) {
    const vus = [...(await deps.client.listerPosts({ status: "draft" })), ...(await deps.client.listerPosts({ status: "scheduled" }))];
    if (vus.some((p) => p.metadata?.studioCle === cle)) {
      await deps.etats.noter(cleCreation(cle), "cree");
      ligne.etat = "deja-cree";
      return ligne;
    }
  }

  await deps.etats.noter(cleCreation(cle), "en-cours");
  try {
    await deps.envoyerReel("zernio", {
      videoId: c.videoId,
      reseau: c.reseau,
      dateIso: new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z"),
      texte: c.texte,
      premierCommentaire: c.premierCommentaire,
      cleEnvoi: cle,
      idempotence: idempotenceDe(cle),
      consentementTiktok: c.consentementTiktok,
      niveauConfidentialiteTiktok: c.niveauConfidentialiteTiktok,
    });
    await deps.etats.noter(cleCreation(cle), "cree");
    ligne.etat = "brouillon-cree";
  } catch (err) {
    if (estErreurZernio(err) && (CODES_AVANT_RESEAU as readonly string[]).includes(err.code)) {
      // Refus avant le réseau : rien n'est parti, l'essai pourra être refait.
      await deps.etats.noter(cleCreation(cle), "refuse");
      ligne.etat = "refuse";
      ligne.raison = err.message;
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
export async function envoyerDepuisCreneau(deps: DepsEnvoiCreneau, creneauId: string): Promise<LigneCreneau | undefined> {
  const c = (await deps.creneaux()).find((x) => x.id === creneauId);
  return c ? traiter(deps, c) : undefined;
}

/** Un tour : chaque créneau validé est traité (brouillon chez le diffuseur), puis la promotion de L0-08 passe. */
export async function tourEnvoisCalendrier(deps: DepsEnvoiCreneau): Promise<ResultatTourCreneaux> {
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
    });
  }
  return res;
}
