/**
 * FAL.AI — fabrication PAYANTE d'une illustration (B.6 étape 2, lot A2) : une image (Nano Banana) puis un clip de
 * 5 s animé à partir d'elle (Seedance 1.0 Pro Fast, 720p, 9:16). Payé à l'usage, usage commercial permis par fal.
 *
 * File d'attente fal (`https://queue.fal.run/{modèle}`, en-tête `Authorization: Key …`) : `POST` renvoie
 * `request_id`, `status_url`, `response_url` ; on interroge `status_url` jusqu'à `COMPLETED`, puis on lit
 * `response_url`. Le résultat est RECOPIÉ aussitôt dans notre stockage. La demande (adresses de suivi) est gardée
 * par le moteur dans le travail : un redémarrage reprend la même demande, rien n'est repayé.
 *
 * Jamais de personne, de logo ni d'uniforme : la requête est nettoyée en amont (`domaine/illustrations.ts`,
 * `requeteFabrication`) et refusée ici si elle contient encore un mot interdit. Filtre de sécurité de fal allumé.
 */
import type { Ratio } from "@/domaine/types";
import { contientInterdit, TARIFS_FABRICATION_USD } from "@/domaine/illustrations";
import { centimes, TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { cleIllustration, ErreurIllustration, telecharger, type Deposer } from "./depot";
import type { DemandeFabrication, EtatFabrication, FabricationParEtapes } from "./types";

export const MODELES_FAL = {
  image: "fal-ai/nano-banana",
  clip: "fal-ai/bytedance/seedance/v1/pro/fast/image-to-video",
} as const;

const RATIOS_FAL: Record<Ratio, string> = { "9:16": "9:16", "4:5": "3:4", "1:1": "1:1", "16:9": "16:9" };

/** Coût d'un clip Seedance en centimes de dollar : 1 $ / million de jetons ; jetons = h × l × 24 × durée / 1024. */
export function coutClipUsd(dureeSec: number, largeur = 720, hauteur = 1280): number {
  return ((largeur * hauteur * 24 * dureeSec) / 1024 / 1_000_000) * 100;
}

/** Corps envoyé à fal pour une demande (PUR, testé). */
export function corpsFal(d: DemandeFabrication): { modele: string; corps: Record<string, unknown> } {
  if (d.genre === "image") {
    return { modele: MODELES_FAL.image, corps: { prompt: d.requete, num_images: 1, aspect_ratio: RATIOS_FAL[d.ratio], output_format: "jpeg", safety_tolerance: "2" } };
  }
  return {
    modele: MODELES_FAL.clip,
    corps: { prompt: d.requete, image_url: d.imageUrl, aspect_ratio: RATIOS_FAL[d.ratio] === "3:4" ? "3:4" : RATIOS_FAL[d.ratio], resolution: "720p", duration: String(Math.min(12, Math.max(2, Math.round(d.dureeSec)))), enable_safety_checker: true },
  };
}

/** Identifiant d'une demande gardé par le moteur : les adresses de suivi fal (pas la clé). */
interface Suivi {
  genre: "image" | "clip";
  statut: string;
  reponse: string;
  dureeSec?: number;
  cle: string;
}

/**
 * INTÉGRATION FINALE (VERIF-E2E-1, fal.ai sans idempotence) : trace EN BASE de chaque soumission, par clé
 * d'idempotence. Écrite AVANT l'envoi (« envoi ») puis dès la réponse (« soumise », avec l'identifiant de la demande).
 * Si le serveur meurt entre la soumission et l'écriture de l'état du travail, le tour suivant retrouve l'identifiant
 * (la demande est suivie, jamais renvoyée) ; s'il meurt pendant l'envoi, la demande est traitée comme incertaine
 * (comptée comme payée, jamais renvoyée à l'aveugle).
 */
export type TraceDemandeFal = { etat: "envoi"; le: string } | { etat: "soumise"; idDemande: string; le: string } | { etat: "refusee"; le: string };

export interface JournalDemandesFal {
  lire(cle: string): Promise<TraceDemandeFal | null>;
  ecrire(cle: string, trace: TraceDemandeFal): Promise<void>;
}

export interface OptionsFal {
  /** Trace en base des soumissions (absente : essais, la mémoire de ce processus seule). */
  journal?: JournalDemandesFal;
  cle: string;
  deposer: Deposer;
  tauxUsdEur?: number;
  /** Plafond de dépense fal.ai, en centimes de dollar (garde-fou). */
  plafondUsdCentimes?: number;
  /**
   * CORRECTEUR 1 — B3 : ce qui est DÉJÀ dépensé chez fal.ai, lu EN BASE (dépenses du mois + demandes gardées par les
   * travaux en cours), et les demandes que la base connaît déjà. Le plafond tient donc après un redémarrage. Absent
   * (essais) : le compteur de ce processus seul.
   */
  depenseDeja?: () => Promise<{ usdCentimes: number; demandes: Set<string> }>;
}

/**
 * CORRECTEUR 1 — B3 : la soumission a pu partir chez fal.ai (coupure, délai dépassé ou réponse 5xx APRÈS l'envoi) :
 * fal a pu la mettre en file, donc la facturer. Elle n'est JAMAIS resoumise à l'aveugle.
 */
export function erreurSoumissionIncertaine(message: string): ErreurIllustration {
  return Object.assign(new ErreurIllustration({ code: "indisponible", reessayable: true, message }), { soumissionIncertaine: true as const });
}

/** Fabrication par étapes chez fal.ai. */
export function creerFabricationFal(o: OptionsFal): FabricationParEtapes & { depenseUsdCentimes(): number } {
  let depense = 0;
  /** Demandes soumises par CE processus (identifiant → prix en centimes de dollar). */
  const soumises = new Map<string, number>();
  /**
   * Relecture paquet 4 (exactitude petit défaut 1) : soumissions PARTIES mais pas encore revenues (prix réservé avant
   * l'envoi). Le contrôle du plafond et la réservation se font d'un seul tenant : trois soumissions simultanées ne
   * passent plus sur la place d'une seule.
   */
  const reservees = new Map<number, number>();
  let numeroReserve = 0;
  let fileControle: Promise<unknown> = Promise.resolve();
  function sousControle<T>(f: () => Promise<T>): Promise<T> {
    const suite = fileControle.then(f, f);
    fileControle = suite.catch(() => undefined);
    return suite;
  }
  const entetes = { Authorization: `Key ${o.cle}`, "content-type": "application/json" };

  async function appel(url: string, init?: RequestInit, soumission = false): Promise<unknown> {
    let r: Response;
    try {
      r = await fetch(url, { ...init, headers: { ...entetes, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(30_000) });
    } catch (e) {
      console.warn(`[illustrations] fal.ai ne répond pas : ${(e as Error).message}`);
      if (soumission) throw erreurSoumissionIncertaine("fal.ai n'a pas confirmé la demande.");
      throw new ErreurIllustration({ code: "indisponible", reessayable: true, message: "fal.ai ne répond pas." });
    }
    if (r.status === 401 || r.status === 403) throw new ErreurIllustration({ code: "refuse", reessayable: false, message: "fal.ai refuse la clé." });
    if (r.status === 402) throw new ErreurIllustration({ code: "quota", reessayable: false, message: "fal.ai : crédit épuisé." });
    if (r.status === 422) {
      console.warn(`[illustrations] fal.ai refuse la demande : ${(await r.text()).slice(0, 300)}`);
      throw new ErreurIllustration({ code: "refuse", reessayable: false, message: "fal.ai refuse la demande." });
    }
    if (!r.ok && r.status !== 202) {
      console.warn(`[illustrations] fal.ai : réponse ${r.status}`);
      if (soumission && r.status >= 500) throw erreurSoumissionIncertaine("fal.ai n'a pas confirmé la demande.");
      throw new ErreurIllustration({ code: "indisponible", reessayable: true, message: "fal.ai ne répond pas correctement pour l'instant." });
    }
    try {
      return await r.json();
    } catch {
      // Réponse illisible APRÈS l'envoi : la demande a pu être prise.
      if (soumission) throw erreurSoumissionIncertaine("fal.ai n'a pas confirmé la demande.");
      throw new ErreurIllustration({ code: "inconnu", reessayable: true, message: "fal.ai : réponse illisible." });
    }
  }

  /** Dépense à comparer au plafond : la base (si branchée) plus les demandes de ce processus qu'elle ne connaît pas encore. */
  async function dejaDepense(): Promise<number> {
    let reserve = 0;
    for (const prix of reservees.values()) reserve += prix;
    if (!o.depenseDeja) return depense + reserve;
    const enBase = await o.depenseDeja();
    let enPlus = reserve;
    for (const [id, prix] of soumises) if (!enBase.demandes.has(id)) enPlus += prix;
    return enBase.usdCentimes + enPlus;
  }

  return {
    depenseUsdCentimes: () => depense,

    async soumettre(d) {
      if (contientInterdit(d.requete.replace(/no people|no hands|no faces|no logo|no uniform/gi, ""))) {
        throw new ErreurIllustration({ code: "refuse", reessayable: false, message: "Cette image montrerait une personne, un logo ou un uniforme : elle n'est pas fabriquée." });
      }
      // Vérification AVANT toute nouvelle soumission : cette demande est-elle déjà partie ?
      const trace = o.journal ? await o.journal.lire(d.cleIdempotence) : null;
      if (trace?.etat === "soumise") return { idDemande: trace.idDemande };
      if (trace?.etat === "envoi") throw erreurSoumissionIncertaine("fal.ai n'a pas confirmé une demande déjà envoyée : elle n'est pas renvoyée.");
      const prix = d.genre === "image" ? TARIFS_FABRICATION_USD.image : coutClipUsd(d.dureeSec);
      const reservation = ++numeroReserve;
      await sousControle(async () => {
        if (o.plafondUsdCentimes !== undefined && (await dejaDepense()) + prix > o.plafondUsdCentimes) {
          // E2E-1 n° 9 (03/10) : plafond du studio (`FAL_PLAFOND_USD`), pas le crédit fal.ai : une recharge n'y change rien.
          throw new ErreurIllustration({ code: "refuse", reessayable: false, message: "Plafond de dépense des illustrations du studio atteint (réglé sur le serveur) : ce plan garde votre double." });
        }
        reservees.set(reservation, prix);
      });
      const { modele, corps } = corpsFal(d);
      let r: { request_id?: string; status_url?: string; response_url?: string };
      await o.journal?.ecrire(d.cleIdempotence, { etat: "envoi", le: new Date().toISOString() });
      try {
        r = (await appel(`https://queue.fal.run/${modele}`, { method: "POST", body: JSON.stringify(corps) }, true)) as typeof r;
      } catch (e) {
        // Refus net (rien n'est parti) : la trace est levée, une nouvelle tentative reste possible. Une soumission
        // incertaine garde sa trace « envoi » : elle ne sera jamais renvoyée.
        if (!(e as { soumissionIncertaine?: boolean }).soumissionIncertaine) await o.journal?.ecrire(d.cleIdempotence, { etat: "refusee", le: new Date().toISOString() });
        throw e;
      } finally {
        // Revenue (réussie ou non) : la place réservée passe à la dépense ci-dessous, ou se libère (une soumission
        // incertaine est comptée par l'appelant, comme avant).
        reservees.delete(reservation);
      }
      if (!r.request_id || !r.status_url || !r.response_url) {
        // Réponse sans suivi : la demande a pu être prise, sans moyen de la suivre.
        if (r.request_id) throw erreurSoumissionIncertaine("fal.ai : réponse inattendue.");
        await o.journal?.ecrire(d.cleIdempotence, { etat: "refusee", le: new Date().toISOString() });
        throw new ErreurIllustration({ code: "inconnu", reessayable: true, message: "fal.ai : réponse inattendue." });
      }
      depense += prix;
      const suivi: Suivi = { genre: d.genre, statut: r.status_url, reponse: r.response_url, dureeSec: d.genre === "clip" ? d.dureeSec : undefined, cle: d.cleIdempotence };
      const idDemande = JSON.stringify(suivi);
      soumises.set(idDemande, prix);
      await o.journal?.ecrire(d.cleIdempotence, { etat: "soumise", idDemande, le: new Date().toISOString() });
      return { idDemande };
    },

    async suivre(idDemande): Promise<EtatFabrication> {
      const s = JSON.parse(idDemande) as Suivi;
      const etat = (await appel(s.statut)) as { status?: string };
      if (etat.status === "IN_QUEUE" || etat.status === "IN_PROGRESS") return { statut: "en_cours" };
      if (etat.status !== "COMPLETED") return { statut: "echec", erreur: { code: "inconnu", reessayable: true, message: `fal.ai : état ${etat.status ?? "inconnu"}.` } };
      const sortie = (await appel(s.reponse)) as { images?: { url: string; content_type?: string }[]; video?: { url: string; content_type?: string } };
      const media = s.genre === "image" ? sortie.images?.[0] : sortie.video;
      if (!media?.url) return { statut: "echec", erreur: { code: "refuse", reessayable: false, message: "fal.ai n'a rien rendu (filtre de sécurité ?)." } };
      const { contenu, mime } = await telecharger(media.url);
      const ext = s.genre === "image" ? "jpg" : "mp4";
      const mimeFinal = media.content_type ?? (mime.startsWith(s.genre === "image" ? "image/" : "video/") ? mime : s.genre === "image" ? "image/jpeg" : "video/mp4");
      const fichierCle = await o.deposer(contenu, cleIllustration("fal", s.cle + s.genre, ext), mimeFinal);
      const usd = s.genre === "image" ? TARIFS_FABRICATION_USD.image : coutClipUsd(s.dureeSec ?? 5);
      return { statut: "fait", fichierCle, mime: mimeFinal, urlSource: media.url, cout: centimes(usd * (o.tauxUsdEur ?? TAUX_USD_EUR_PAR_DEFAUT)), coutUsdCentimes: usd, modele: s.genre === "image" ? MODELES_FAL.image : MODELES_FAL.clip };
    },
  };
}

/** Attente bornée d'une demande (essais, outils) : jamais dans la boucle de fond. */
export async function attendreFabrication(f: FabricationParEtapes, idDemande: string, delaiMs = 600_000, pauseMs = 3000): Promise<Extract<EtatFabrication, { statut: "fait" }>> {
  const fin = Date.now() + delaiMs;
  for (;;) {
    const e = await f.suivre(idDemande);
    if (e.statut === "fait") return e;
    if (e.statut === "echec") throw new ErreurIllustration(e.erreur);
    if (Date.now() > fin) throw new ErreurIllustration({ code: "indisponible", reessayable: true, message: "fal.ai : délai dépassé." });
    await new Promise((r) => setTimeout(r, pauseMs));
  }
}
