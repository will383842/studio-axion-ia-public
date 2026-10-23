/**
 * CLIENT HTTP HIGGSFIELD (lot L10 « Décor IA ») — utilisé SEULEMENT si on le choisit explicitement (voir `index.ts`).
 *
 * ⚠️ Les chemins, les noms de champs et l'en-tête d'authentification de l'API publique Higgsfield n'ont PAS été
 * vérifiés sur une documentation officielle : les noms de modèles (`flux_3_video_edit`, `kling_video_edit`), le
 * parcours d'envoi (media_upload → PUT présigné → confirm) et `declined_preset_id` viennent du connecteur Higgsfield
 * utilisé pour l'essai du 08/10. Tout ce qui est supposé est rangé dans `ContratApiHiggsfield` (un seul endroit à
 * corriger) et listé dans `API.md` et `docs/facecam/JOURNAL-E1.md`. Aucun appel réel n'a été fait pendant le lot.
 *
 * Ce client ne lève jamais : toute panne devient `{ ok: false }` ou un état `echec`. La clé ne sort jamais (masquée).
 */
import { masquerCles } from "@/domaine/credits";
import {
  erreurHiggsfield,
  verifierDemande,
  type DemandeEditionVideo,
  type EtatTravailHiggsfield,
  type FournisseurHiggsfield,
  type MediaAEnvoyer,
  type ResultatEdition,
  type ResultatHiggsfield,
} from "./types";

export const DELAI_HIGGSFIELD_MS = 30_000;
/** Une vidéo de 15 s en 704×1248 pèse quelques Mo : 120 s suffisent largement pour l'envoi et la reprise. */
export const DELAI_TRANSFERT_MS = 120_000;

interface Requete {
  methode: "GET" | "POST";
  chemin: string;
  corps?: unknown;
}

/**
 * CE QUI EST SUPPOSÉ de l'API Higgsfield, en un seul endroit. Chaque fonction décrit une requête ou lit une réponse ;
 * une réponse illisible rend `null` (→ échec « illisible », jamais d'exception).
 */
export interface ContratApiHiggsfield {
  entetesAuth(cle: string): Record<string, string>;
  solde: { requete(): Requete; lire(brut: unknown): number | null };
  /** Étape 1 de l'envoi : réserve un média et rend l'adresse présignée où déposer les octets. */
  reserverMedia: { requete(m: Pick<MediaAEnvoyer, "nom" | "type"> & { taille: number }): Requete; lire(brut: unknown): { mediaId: string; urlDepot: string } | null };
  /** Étape 3 : confirme que les octets sont déposés. */
  confirmerMedia: { requete(mediaId: string): Requete };
  lancer: { requete(d: DemandeEditionVideo): Requete; lire(brut: unknown): string | null };
  suivre: { requete(idTravail: string): Requete; lire(brut: unknown): EtatTravailHiggsfield | null };
}

const texte = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 && v.length <= 2000 ? v : undefined);
const nombre = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const objet = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** Contrat SUPPOSÉ (à vérifier avant le premier essai réel ; voir API.md). */
export const CONTRAT_SUPPOSE: ContratApiHiggsfield = {
  entetesAuth: (cle) => ({ authorization: `Bearer ${cle}` }),
  solde: {
    requete: () => ({ methode: "GET", chemin: "/v1/account/balance" }),
    lire: (brut) => nombre(objet(brut).credits) ?? null,
  },
  reserverMedia: {
    requete: (m) => ({ methode: "POST", chemin: "/v1/media_upload", corps: { filename: m.nom, content_type: m.type, size: m.taille } }),
    lire: (brut) => {
      const o = objet(brut);
      const mediaId = texte(o.media_id) ?? texte(o.id);
      const urlDepot = texte(o.upload_url);
      return mediaId && urlDepot ? { mediaId, urlDepot } : null;
    },
  },
  confirmerMedia: { requete: (mediaId) => ({ methode: "POST", chemin: `/v1/media_upload/${encodeURIComponent(mediaId)}/confirm` }) },
  lancer: {
    requete: (d) => ({
      methode: "POST",
      chemin: "/v1/generations",
      corps: {
        model: d.modele,
        params: {
          video_media_id: d.videoMediaId,
          prompt: d.consigne,
          ...(d.imageReferenceMediaId ? { reference_image_media_id: d.imageReferenceMediaId } : {}),
          ...(d.prereglageRefuseId ? { declined_preset_id: d.prereglageRefuseId } : {}),
          duration: Math.ceil(d.dureeSec),
        },
      },
    }),
    lire: (brut) => texte(objet(brut).job_id) ?? texte(objet(brut).id) ?? null,
  },
  suivre: {
    requete: (idTravail) => ({ methode: "GET", chemin: `/v1/generations/${encodeURIComponent(idTravail)}` }),
    lire: (brut) => {
      const o = objet(brut);
      const statut = texte(o.status);
      const credits = nombre(o.credits_used);
      if (statut === "queued" || statut === "pending") return { statut: "en_file" };
      if (statut === "in_progress" || statut === "processing") return { statut: "en_cours", progression: nombre(o.progress) ?? 0 };
      if (statut === "completed") {
        const r = objet(o.result);
        const url = texte(r.url);
        if (!url) return null;
        const resultat: ResultatEdition = { url, dureeSec: nombre(r.duration) ?? 0, largeur: nombre(r.width) ?? 0, hauteur: nombre(r.height) ?? 0, ips: nombre(r.fps) ?? 24, creditsDebites: credits };
        return { statut: "termine", resultat };
      }
      if (statut === "failed" || statut === "nsfw" || statut === "canceled") {
        const refuse = statut === "nsfw" || /face|ip|moderation|policy/i.test(texte(o.error) ?? "");
        return {
          statut: "echec",
          erreur: refuse ? { code: "refuse", reessayable: false, message: "Higgsfield a refusé ce passage." } : { code: "inconnu", reessayable: true, message: "Le décor de ce passage n'a pas abouti." },
          creditsDebites: credits,
        };
      }
      return null;
    },
  },
};

export interface OptionsClientHiggsfield {
  fetch?: typeof fetch;
  contrat?: ContratApiHiggsfield;
}

export function creerHiggsfieldHttp(adresse: string, cle: string, options: OptionsClientHiggsfield = {}): FournisseurHiggsfield {
  const base = adresse.replace(/\/+$/, "");
  const appeler = options.fetch ?? fetch;
  const contrat = options.contrat ?? CONTRAT_SUPPOSE;
  const masquer = (t: string) => masquerCles(t, [cle]);

  /** Appel JSON : rend le corps lu, ou une erreur typée (401/403 clé refusée, 402 solde, 429/5xx indisponible). */
  async function appelJson(r: Requete, entetesEnPlus: Record<string, string> = {}): Promise<ResultatHiggsfield<{ corps: unknown }>> {
    let reponse: Response;
    try {
      reponse = await appeler(`${base}${r.chemin}`, {
        method: r.methode,
        headers: { accept: "application/json", ...(r.corps !== undefined ? { "content-type": "application/json" } : {}), ...contrat.entetesAuth(cle), ...entetesEnPlus },
        body: r.corps !== undefined ? JSON.stringify(r.corps) : undefined,
        signal: AbortSignal.timeout(DELAI_HIGGSFIELD_MS),
      });
    } catch {
      return erreurHiggsfield("indisponible", "Higgsfield ne répond pas.");
    }
    if (reponse.status === 401 || reponse.status === 403) return erreurHiggsfield("cle-refusee", "Higgsfield refuse la clé.");
    if (reponse.status === 402) return erreurHiggsfield("solde-insuffisant", "Crédits Higgsfield insuffisants.");
    if (reponse.status === 429 || reponse.status >= 500) {
      console.warn(`[higgsfield] réponse ${reponse.status}`);
      return erreurHiggsfield("indisponible", "Higgsfield est momentanément indisponible.");
    }
    if (!reponse.ok) {
      console.warn(masquer(`[higgsfield] ${r.methode} ${r.chemin} : réponse ${reponse.status}`));
      return erreurHiggsfield("refuse", "Higgsfield a refusé la demande.");
    }
    const corps = await reponse.json().catch(() => undefined);
    return { ok: true, corps };
  }

  async function transfert(url: string, init: RequestInit): Promise<Response | null> {
    if (!/^https:\/\//.test(url)) return null;
    try {
      return await appeler(url, { ...init, signal: AbortSignal.timeout(DELAI_TRANSFERT_MS) });
    } catch {
      return null;
    }
  }

  return {
    id: "higgsfield",
    mode: "reel",

    async lireSolde() {
      const r = await appelJson(contrat.solde.requete());
      if (!r.ok) return r;
      const credits = contrat.solde.lire(r.corps);
      return credits === null ? erreurHiggsfield("illisible", "Solde Higgsfield illisible.") : { ok: true, credits };
    },

    async envoyerMedia(media) {
      const reserve = await appelJson(contrat.reserverMedia.requete({ nom: media.nom, type: media.type, taille: media.octets.byteLength }));
      if (!reserve.ok) return reserve;
      const lu = contrat.reserverMedia.lire(reserve.corps);
      if (!lu) return erreurHiggsfield("illisible", "Réponse d'envoi Higgsfield illisible.");
      // PUT sur l'adresse présignée : SANS la clé (elle ne doit jamais partir vers un stockage tiers).
      const depot = await transfert(lu.urlDepot, { method: "PUT", headers: { "content-type": media.type }, body: media.octets as unknown as BodyInit });
      if (!depot?.ok) return erreurHiggsfield("indisponible", "Envoi du passage vers Higgsfield interrompu.");
      const confirme = await appelJson(contrat.confirmerMedia.requete(lu.mediaId));
      if (!confirme.ok) return confirme;
      return { ok: true, mediaId: lu.mediaId };
    },

    async lancer(demande) {
      const invalide = verifierDemande(demande);
      if (invalide) return { ok: false, erreur: invalide };
      const r = await appelJson(contrat.lancer.requete(demande), { "idempotency-key": demande.idempotence });
      if (!r.ok) return r;
      const idTravail = contrat.lancer.lire(r.corps);
      return idTravail ? { ok: true, idTravail } : erreurHiggsfield("illisible", "Réponse de lancement Higgsfield illisible.");
    },

    async suivre(idTravail) {
      const r = await appelJson(contrat.suivre.requete(idTravail));
      if (!r.ok) return { statut: "echec", erreur: r.erreur };
      return contrat.suivre.lire(r.corps) ?? { statut: "echec", erreur: { code: "illisible", reessayable: true, message: "État Higgsfield illisible." } };
    },

    async telecharger(url) {
      const r = await transfert(url, { method: "GET" });
      if (!r?.ok) return erreurHiggsfield("indisponible", "Téléchargement du passage Higgsfield impossible.");
      try {
        return { ok: true, octets: new Uint8Array(await r.arrayBuffer()) };
      } catch {
        return erreurHiggsfield("indisponible", "Téléchargement du passage Higgsfield interrompu.");
      }
    },
  };
}
