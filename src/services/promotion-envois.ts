/**
 * L0-08 · PROMOTION AUTOMATIQUE DES BROUILLONS (D7-03) : une entrée validée du calendrier (statut `valide`, `valideeLe` posé)
 * dont le brouillon Zernio existe passe à « programmé » : UN PUT par entrée (`client.promouvoir`, forme D5), puis l'entrée
 * passe à `programme`. Rien n'est ouvert par défaut : de vraies écritures exigent les DEUX réglages (envoi général ET
 * réglage séparé de l'envoi du calendrier, L7-08, fermé par défaut), lus avant chaque PUT. Réglage illisible = fermé.
 *
 * Fenêtre : promue quand la date est à 3 h ou moins ; à 30 min ou moins (ou passée) : « à reprogrammer » + une notification,
 * jamais de PUT. Après « à vérifier » : aucun nouvel appel pour cette entrée. Heure de Paris (horloge-paris).
 * Ce module ne dépend d'aucun service serveur : client, dépôt, réglages, états et notification sont passés en paramètres.
 */
import type { Depot } from "@/domaine/depots";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { estErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import type { ClientZernio, PostZernio } from "@/fournisseurs/publication/zernio-client";
import { PROMOTION_MARGE_MIN_MS } from "@/fournisseurs/publication/zernio-client";
import { instantParis } from "@/lib/horloge-paris";
import { transiterEnvoi } from "./envois-planifies";
import { listerTousLesPosts } from "./import-buffer/creer-brouillons";
import { controlerGrille, MARGE_CREATION_MS, SuiviDebitImport } from "./import-buffer/plafonds";

/** Recopié de L7-08 (`PARAM_ENVOI_CALENDRIER`, services/zernio.ts) ; le test échoue si les deux diffèrent. */
export const REGLAGE_ENVOI_CALENDRIER = "zernio.envoi_calendrier_autorise";
/** Réglage éditorial (créé par L7-08, FAUX par défaut) : lu avant toute écriture ; absent ou illisible = FAUX. */
export const REGLAGE_EDITORIALE_ACTIVE = "publication.editoriale_active";
/** Début de la fenêtre de promotion : 3 h avant la date. */
export const FENETRE_PROMOTION_MS = MARGE_CREATION_MS;

export type EtatLignePromotion =
  | "programme"
  | "pas-encore"
  | "a-reprogrammer"
  | "a-verifier"
  | "non-valide"
  | "sans-brouillon"
  | "refuse"
  | "arret";

export interface LigneEnvoiPromotion {
  cle: string;
  etat: EtatLignePromotion;
  raison?: string;
}

export interface ResultatPromotionEnvois {
  lignes: LigneEnvoiPromotion[];
  /** Présent quand un réglage est fermé ou illisible : rien n'a été lu ni écrit. */
  refus?: string;
}

export interface NotificationPromotion {
  cle: string;
  videoId: string;
  motif: "a-reprogrammer" | "tiktok-incomplet";
  raison: string;
}

/** Mémoire durable des constats (« à vérifier », « déjà notifié »). Doublée en test ; aucune écriture réelle ici. */
export interface EtatsPromotion {
  lire(cle: string): Promise<string | undefined>;
  noter(cle: string, valeur: string): Promise<void>;
}

export interface OptionsPromotionEnvois {
  depot: Depot<EnvoiPlanifie>;
  client: ClientZernio;
  reglages: {
    envoiAutorise(): Promise<boolean>;
    envoiCalendrierAutorise(): Promise<boolean>;
    /** Lecture de `publication.editoriale_active` ; omise tant que le réglage n'existe pas = FAUX, rien n'est promu. */
    editorialeActive?(): Promise<boolean>;
  };
  maintenant: () => number;
  attendre?: (ms: number) => Promise<void>;
  suivi?: SuiviDebitImport;
  etats: EtatsPromotion;
  notifier: (n: NotificationPromotion) => Promise<void>;
}

const cleVerifier = (cle: string): string => `a-verifier:${cle}`;
const cleNotifie = (e: EnvoiPlanifie): string => `a-reprogrammer:${e.cle}:${e.jour}:${e.heure ?? ""}`;

const idCompte = (z: PostZernio): string => {
  const a = z.platforms?.[0]?.accountId;
  return a && typeof a === "object" ? String((a as { _id?: unknown })._id ?? "") : String(a ?? "");
};

/** Les DEUX réglages ouverts ; toute erreur de lecture ou toute valeur autre que `true` = fermé. */
async function ouverts(r: OptionsPromotionEnvois["reglages"]): Promise<boolean> {
  try {
    if (typeof r.editorialeActive !== "function") return false;
    return (await r.envoiAutorise()) === true && (await r.envoiCalendrierAutorise()) === true && (await r.editorialeActive()) === true;
  } catch {
    return false;
  }
}

/** TikTok : consentement ET niveau de confidentialité renseignés sur l'entrée, sinon rien ne part. */
const tiktokIncomplet = (e: EnvoiPlanifie): boolean => e.consentementTiktok !== true || !e.niveauConfidentialiteTiktok;
const cleTiktok = (e: EnvoiPlanifie): string => `tiktok-incomplet:${e.cle}`;

async function alerterTiktok(o: OptionsPromotionEnvois, e: EnvoiPlanifie, ligne: LigneEnvoiPromotion): Promise<void> {
  ligne.etat = "refuse";
  ligne.raison = "TikTok : consentement et niveau de confidentialité à renseigner avant toute promotion";
  if ((await o.etats.lire(cleTiktok(e))) !== "notifie") {
    await o.notifier({ cle: e.cle, videoId: e.videoId, motif: "tiktok-incomplet", raison: ligne.raison });
    await o.etats.noter(cleTiktok(e), "notifie");
  }
}

const valideeLisible = (e: EnvoiPlanifie, maintenant: number): boolean => {
  const t = typeof e.valideeLe === "string" && e.valideeLe ? Date.parse(e.valideeLe) : NaN;
  return Number.isFinite(t) && t <= maintenant;
};

export async function promouvoirEnvoisPlanifies(o: OptionsPromotionEnvois): Promise<ResultatPromotionEnvois> {
  const res: ResultatPromotionEnvois = { lignes: [] };
  if (!(await ouverts(o.reglages))) {
    res.refus = "envoi fermé (réglages zernio.envoi_autorise et zernio.envoi_calendrier_autorise) : rien n'a été lu ni écrit";
    return res;
  }
  const suivi = o.suivi ?? new SuiviDebitImport();
  const attendre = o.attendre ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const debut = o.maintenant();

  const entrees = await o.depot.lister((e) => e.statut === "brouillon" || e.statut === "valide");
  const candidates: { e: EnvoiPlanifie; t: number; ligne: LigneEnvoiPromotion }[] = [];
  for (const e of entrees.sort((a, b) => a.cle.localeCompare(b.cle))) {
    const ligne: LigneEnvoiPromotion = { cle: e.cle, etat: "arret" };
    if (e.statut !== "valide" || !valideeLisible(e, debut)) {
      // Jamais promue sans valideeLe : brouillon, ou « valide » dont la validation manque ou est illisible.
      if (e.statut === "valide" || e.statut === "brouillon") {
        ligne.etat = "non-valide";
        ligne.raison = "pas de validation datée : jamais promue";
        res.lignes.push(ligne);
      }
      continue;
    }
    res.lignes.push(ligne);
    if ((await o.etats.lire(cleVerifier(e.cle))) === "a-verifier") {
      ligne.etat = "a-verifier";
      ligne.raison = "à vérifier chez Zernio : aucun nouvel essai automatique";
      continue;
    }
    if (!e.heure) {
      ligne.etat = "refuse";
      ligne.raison = "heure absente : aucune heure n'est inventée";
      continue;
    }
    const t = Date.parse(instantParis(e.jour, e.heure));
    if (!Number.isFinite(t)) {
      ligne.etat = "refuse";
      ligne.raison = "date illisible";
      continue;
    }
    if (t - debut <= PROMOTION_MARGE_MIN_MS) {
      ligne.etat = "a-reprogrammer";
      ligne.raison = "date passée ou à 30 min ou moins : à reprogrammer par vous";
      if ((await o.etats.lire(cleNotifie(e))) !== "notifie") {
        await o.notifier({ cle: e.cle, videoId: e.videoId, motif: "a-reprogrammer", raison: ligne.raison });
        await o.etats.noter(cleNotifie(e), "notifie");
      }
      continue;
    }
    if (t - debut > FENETRE_PROMOTION_MS) {
      ligne.etat = "pas-encore";
      continue;
    }
    if (e.reseau === "tiktok" && tiktokIncomplet(e)) {
      await alerterTiktok(o, e, ligne);
      continue;
    }
    candidates.push({ e, t, ligne });
  }
  if (candidates.length === 0) return res;

  // Brouillons Zernio (lecture) : l'entrée est retrouvée par sa clé, jamais par le texte.
  const brouillons = await listerTousLesPosts(o.client, "draft");
  const trouvees: { e: EnvoiPlanifie; t: number; ligne: LigneEnvoiPromotion; post: PostZernio }[] = [];
  for (const c of candidates) {
    const post = brouillons.find((p) => p.metadata?.studioCle === c.e.cle);
    if (!post) {
      c.ligne.etat = "sans-brouillon";
      c.ligne.raison = "aucun brouillon Zernio pour cette entrée : rien à promouvoir";
    } else if (post.platforms?.[0]?.platform === "tiktok" && tiktokIncomplet(c.e)) {
      await alerterTiktok(o, c.e, c.ligne);
    } else trouvees.push({ ...c, post });
  }

  // Grille contrôlée avant le lot, avec les posts déjà programmés (lecture seule).
  if (trouvees.length) {
    const deja = (await listerTousLesPosts(o.client, "scheduled")).filter((z) => z.scheduledFor && !trouvees.some((c) => c.post._id === z._id));
    const violations = controlerGrille([
      ...trouvees.map((c) => ({ id: c.post._id, compte: idCompte(c.post), reseau: c.post.platforms?.[0]?.platform ?? "", dateIso: new Date(c.t).toISOString() })),
      ...deja.map((z) => ({ id: z._id, compte: idCompte(z), reseau: z.platforms?.[0]?.platform ?? "", dateIso: z.scheduledFor! })),
    ]).filter((v) => v.ids.some((i) => trouvees.some((c) => c.post._id === i)));
    if (violations.length) {
      for (const c of trouvees) {
        c.ligne.etat = "arret";
        c.ligne.raison = "grille hors plafond : lot non lancé";
      }
      return res;
    }
  }

  // Un seul à la fois, trié par date ; arrêt au premier doute.
  let arret: string | undefined;
  for (const { e, t, ligne, post } of trouvees.sort((a, b) => a.t - b.t || a.e.cle.localeCompare(b.e.cle))) {
    if (arret) {
      ligne.raison = arret;
      continue;
    }
    if (!(await ouverts(o.reglages))) {
      arret = "réglage d'envoi fermé en cours de lot : arrêt";
      ligne.raison = arret;
      continue;
    }
    try {
      const compte = idCompte(post);
      const reseau = post.platforms?.[0]?.platform ?? "";
      const permis = suivi.peutOperer(compte, reseau, o.maintenant());
      if (!permis.ok) {
        arret = permis.raison;
        ligne.raison = arret;
        continue;
      }
      const attente = suivi.delaiAvant(o.maintenant());
      if (attente > 0) await attendre(attente);
      for (let i = 0; i < 3; i++) suivi.noterRequete(o.maintenant()); // GET avant + PUT + GET après
      const r = await o.client.promouvoir({ postId: post._id, cleJournal: e.cle, dateJournal: new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z") });
      suivi.noterOperation(compte, o.maintenant());
      if (r.etat === "programme") {
        await transiterEnvoi(o.depot, e.id, "programme", new Date(o.maintenant()).toISOString());
        ligne.etat = "programme";
      } else if (r.etat === "a-verifier") {
        await o.etats.noter(cleVerifier(e.cle), "a-verifier");
        ligne.etat = "a-verifier";
        ligne.raison = r.raison;
        arret = "lot arrêté après un « à vérifier »";
      } else if (r.etat === "a-reprogrammer") {
        ligne.etat = "a-reprogrammer";
        ligne.raison = r.raison;
      } else {
        ligne.etat = "refuse";
        ligne.raison = r.raison;
      }
    } catch (err) {
      ligne.etat = "refuse";
      ligne.raison = err instanceof Error ? err.message : "erreur";
      if (!estErreurZernio(err) || ["debit", "indisponible", "acces", "envoi-coupe", "a-verifier"].includes(err.code)) arret = "lot arrêté après une erreur";
      if (estErreurZernio(err) && err.code === "a-verifier") await o.etats.noter(cleVerifier(e.cle), "a-verifier");
    }
  }
  return res;
}
