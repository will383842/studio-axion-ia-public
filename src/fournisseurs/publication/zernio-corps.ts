/**
 * CORPS PUR d'une création de post Zernio (z1p, D8-D10). Aucune requête, aucune horloge cachée : tout est passé en
 * paramètre. Une seule plateforme par post (un réseau, une cible). Chaque refus a lieu avant le réseau, en phrase simple.
 *
 * Jamais : `publishNow`, `facebookSettings.draft`, `tiktokSettings.draft`. Toujours : `timezone` « Europe/Paris »,
 * `scheduledFor` en UTC avec Z, `metadata.origine = "studio"` + `metadata.studioCle`.
 */
import type { DemandePublication } from "../types";
import { motsInterditsEnvoi } from "./mots-interdits-envoi";
import { ErreurZernio } from "./zernio-erreurs";
import { PROMOTION_MARGE_MIN_MS, type CorpsPostZernio, type MediaItemZernio, type PlateformePostZernio } from "./zernio-client";

export const FUSEAU_STUDIO = "Europe/Paris";
export const ALT_MAX = 125;
export const TITRE_DOCUMENT_MAX = 60;
export const DOCUMENT_TAILLE_MAX = 100 * 1024 * 1024;
export const IMAGES_MAX: Readonly<Record<string, number>> = { instagram: 10, facebook: 10, linkedin: 20, tiktok: 35 };
export const REEL_FACEBOOK_DUREE_SEC = { min: 3, max: 60 } as const;

const SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;
const refus = (message: string, champs?: string[]) => new ErreurZernio("refuse", `${message} Rien n'a été envoyé.`, { champs });

/* --- Cible (D9) -------------------------------------------------------------------------------------------------- */

export interface CibleZernio {
  accountId: string;
  /** Facebook : page choisie (même accountId). */
  pageId?: string;
  /** LinkedIn : page (absent = profil). */
  organizationUrn?: string;
}

/** Cible du Studio : « accountId », « accountId:fb:<pageId> », « accountId:li:<n°> ». */
export function analyserCible(brute: string | undefined | null): CibleZernio {
  const t = (brute ?? "").trim();
  if (!t) throw refus("Aucune cible choisie pour cette publication.");
  const [accountId, genre, reste, ...autres] = t.split(":");
  if (!SEGMENT.test(accountId) || autres.length) throw refus("La cible de la publication est illisible.");
  if (genre === undefined) return { accountId };
  if (genre === "fb" && reste && SEGMENT.test(reste)) return { accountId, pageId: reste };
  if (genre === "li" && reste && /^\d{1,20}$/.test(reste)) return { accountId, organizationUrn: `urn:li:organization:${reste}` };
  throw refus("La cible de la publication est illisible.");
}

/* --- TikTok (D8) ------------------------------------------------------------------------------------------------- */

export interface CreateurTiktok {
  privacyLevels: string[];
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
}

/** Lit la réponse de creator-info : valeurs permises seulement (un réglage coupé par le créateur reste faux). */
export function lireCreateurTiktok(brut: unknown): CreateurTiktok {
  const o = (brut ?? {}) as Record<string, unknown>;
  const niveaux = Array.isArray(o.privacyLevels) ? o.privacyLevels : [];
  const privacyLevels = niveaux.map((n) => (n && typeof n === "object" ? (n as Record<string, unknown>).value : undefined)).filter((v): v is string => typeof v === "string");
  const reglages = ((o.postingLimits as Record<string, unknown> | undefined)?.interactionSettings ?? {}) as Record<string, { enabled?: unknown } | null>;
  const permis = (cle: string) => reglages[cle]?.enabled === true;
  return { privacyLevels, allowComment: permis("allow_comment"), allowDuet: permis("allow_duet"), allowStitch: permis("allow_stitch") };
}

function niveauDeConfidentialite(c: CreateurTiktok): string {
  if (c.privacyLevels.includes("PUBLIC_TO_EVERYONE")) return "PUBLIC_TO_EVERYONE";
  if (c.privacyLevels.includes("SELF_ONLY")) return "SELF_ONLY";
  throw refus("TikTok n'offre aucun niveau de confidentialité utilisable pour ce compte.");
}

/* --- Aides ------------------------------------------------------------------------------------------------------- */

/** Date ISO à la seconde, UTC, avec Z. */
export function dateZernio(dateIso: string): string {
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) throw refus("La date de publication est illisible.");
  return new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function texteAlt(brut: string): string {
  const t = brut.replace(/\s+/g, " ").trim();
  return t.length <= ALT_MAX ? t : `${t.slice(0, ALT_MAX - 1).trimEnd()}…`;
}

function exigerSansMotInterdit(texte: string, quoi: string): void {
  const mots = motsInterditsEnvoi(texte);
  if (mots.length) throw new ErreurZernio("mot-interdit", `${quoi} contient un mot interdit : rien n'a été envoyé. Retirez-le puis réessayez.`, { detailTechnique: `mots interdits : ${mots.join(", ")}` });
}

const RESEAUX_PLATEFORME: Readonly<Record<string, string>> = { instagram: "instagram", facebook: "facebook", linkedin: "linkedin", tiktok: "tiktok" };

/** Plateforme Zernio d'un réseau du Studio (YouTube n'est pas porté par Zernio). */
export function plateformeZernio(reseau: string): string {
  const p = RESEAUX_PLATEFORME[reseau];
  if (!p) throw refus("Ce réseau n'est pas pris en charge par Zernio.");
  return p;
}

/** Premier commentaire transmis par Zernio : Facebook et LinkedIn confirmés ; TikTok n'en a pas ; Instagram à prouver. */
export function premierCommentaireTransmissibleZernio(reseau: string): boolean {
  return reseau === "facebook" || reseau === "linkedin";
}

/* --- Corps ------------------------------------------------------------------------------------------------------- */

export interface OptionsCorps {
  /** Instant courant (ms) : les dates non futures sont refusées. */
  maintenant: number;
  /** Lu dans creator-info (TikTok seulement). */
  createurTiktok?: CreateurTiktok;
  /** Adresses des médias déjà téléversés chez Zernio (remplacent les adresses du Studio, dans le même ordre). */
  medias?: MediaItemZernio[];
  /** Hôtes des `publicUrl` rendus par presign : chaque `mediaItems[].url` téléversé doit en venir (sinon refus). */
  hotesPublics?: ReadonlySet<string>;
}

/** Médias demandés, sans adresse Zernio : sert au téléversement et au corps. Types : image | video | document. */
export function mediasDemandes(d: DemandePublication): MediaItemZernio[] {
  const plateforme = plateformeZernio(d.reseau);
  if (d.document) {
    if (plateforme !== "linkedin") throw refus("Un document PDF n'est publié que sur LinkedIn.");
    if (d.images?.length) throw refus("LinkedIn : un seul type de média par publication (document ou images).");
    const titre = (d.document.titre ?? "").replace(/\s+/g, " ").trim();
    if (!titre) throw refus("Le document PDF n'a pas de titre.");
    if (titre.length > TITRE_DOCUMENT_MAX) throw refus(`Le titre du document dépasse ${TITRE_DOCUMENT_MAX} signes.`);
    exigerSansMotInterdit(titre, "Le titre du document");
    if (d.tailleOctets !== undefined && d.tailleOctets > DOCUMENT_TAILLE_MAX) throw refus("Le document dépasse 100 Mo.");
    return [{ type: "document", url: d.document.url, title: titre, mimeType: "application/pdf" }];
  }
  const images = d.images ?? [];
  if (images.length) {
    const max = IMAGES_MAX[plateforme];
    if (images.length > max) throw refus(`${plateforme} accepte ${max} images au plus.`);
    return images.map((im) => {
      const alt = texteAlt(im.texteAlternatif ?? "");
      if (!alt) throw refus("Une image n'a pas de texte alternatif.");
      exigerSansMotInterdit(alt, "Le texte alternatif d'une image");
      return { type: "image", url: im.url, altText: alt };
    });
  }
  return [{ type: "video", url: d.fichierCle }];
}

export function corpsPostZernio(d: DemandePublication, options: OptionsCorps): CorpsPostZernio {
  const plateforme = plateformeZernio(d.reseau);
  const cible = analyserCible(d.cible ?? d.canalId);
  const demandes = mediasDemandes(d);
  const type = demandes[0].type;
  const medias = options.medias ?? demandes;
  if (medias.length !== demandes.length) throw refus("Les médias téléversés ne correspondent pas à la demande.");
  if (options.medias) {
    for (const m of medias) {
      let hote = "";
      try {
        const u = new URL(m.url);
        if (u.protocol === "https:") hote = u.host;
      } catch {
        /* adresse illisible : refusée plus bas */
      }
      if (!hote || !options.hotesPublics?.has(hote)) throw refus("L'adresse d'un média ne vient pas du téléversement Zernio.");
    }
  }

  exigerSansMotInterdit(d.texte, "Le texte du post");
  const commentaire = d.premierCommentaire?.trim();
  if (commentaire) exigerSansMotInterdit(commentaire, "Le premier commentaire");

  const echeance = Date.parse(d.date);
  const brouillon = (d.mode ?? "brouillon") === "brouillon";
  if (!Number.isFinite(echeance) || echeance <= options.maintenant) throw refus("La date de publication n'est pas dans le futur.");
  if (!brouillon && echeance < options.maintenant + PROMOTION_MARGE_MIN_MS) throw refus("La date de publication est à moins de 30 minutes.");

  const specifique: Record<string, unknown> = {};
  switch (plateforme) {
    case "instagram":
      if (type === "video") specifique.shareToFeed = true; // vidéo seule = Reel
      if (d.contenuIA) specifique.isAiGenerated = true;
      break;
    case "facebook":
      if (!cible.pageId) throw refus("Facebook : aucune page choisie (la page par défaut n'est jamais utilisée).");
      specifique.pageId = cible.pageId;
      if (type === "video" && d.format === "9:16" && d.dureeSec !== undefined && d.dureeSec >= REEL_FACEBOOK_DUREE_SEC.min && d.dureeSec <= REEL_FACEBOOK_DUREE_SEC.max) specifique.contentType = "reel";
      if (commentaire) specifique.firstComment = commentaire;
      break;
    case "linkedin":
      if (cible.organizationUrn) specifique.organizationUrn = cible.organizationUrn;
      if (type === "document") specifique.documentTitle = demandes[0].title;
      if (commentaire) specifique.firstComment = commentaire;
      break;
    case "tiktok": {
      if (d.consentementTiktok !== true) throw refus("TikTok : la case de consentement n'est pas cochée.");
      if (d.contenuIA && type !== "video") throw refus("TikTok : la mention IA ne s'applique qu'à une vidéo.");
      const createur = options.createurTiktok;
      if (!createur) throw refus("TikTok : les réglages du créateur n'ont pas été lus.");
      Object.assign(specifique, {
        contentPreviewConfirmed: true,
        expressConsentGiven: true,
        allowComment: createur.allowComment,
        allowDuet: createur.allowDuet,
        allowStitch: createur.allowStitch,
        privacyLevel: niveauDeConfidentialite(createur),
      });
      if (d.votreMarque) specifique.commercialContentType = "brand_organic";
      if (d.contenuIA) specifique.videoMadeWithAi = true;
      break;
    }
  }

  const entree: PlateformePostZernio = { platform: plateforme, accountId: cible.accountId, ...(Object.keys(specifique).length ? { platformSpecificData: specifique } : {}) };
  const cleStudio = d.cleEnvoi ?? "";
  return {
    content: d.texte,
    isDraft: brouillon,
    scheduledFor: dateZernio(d.date),
    timezone: FUSEAU_STUDIO,
    platforms: [entree],
    mediaItems: medias,
    metadata: { origine: "studio", studioCle: cleStudio },
  };
}
