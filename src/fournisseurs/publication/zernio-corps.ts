/**
 * CORPS PUR d'une création de post Zernio (z1p, D8-D10). Aucune requête, aucune horloge cachée : tout est passé en
 * paramètre. Une seule plateforme par post (un réseau, une cible). Chaque refus a lieu avant le réseau, en phrase simple.
 *
 * Jamais : `publishNow`, `facebookSettings.draft`, `tiktokSettings.draft`. Toujours : `timezone` « Europe/Paris »,
 * `scheduledFor` en UTC avec Z, `metadata.origine = "studio"` + `metadata.studioCle`.
 */
import type { DemandePublication } from "../types";
import { motsInterditsEnvoiZernio } from "./mots-interdits-envoi";
import { pageInterdite } from "./zernio-pages-interdites";
import { ErreurZernio } from "./zernio-erreurs";
import { lienDuSite } from "./liens-du-site";
import { ALT_MAX_PINTEREST, DESCRIPTION_EPINGLE_MAX, LIEN_EPINGLE_MAX, TITRE_EPINGLE_MAX } from "./epingle-limites";
export { ALT_MAX_PINTEREST, DESCRIPTION_EPINGLE_MAX, LIEN_EPINGLE_MAX, TITRE_EPINGLE_MAX };
import { PROMOTION_MARGE_MIN_MS, type CorpsPostZernio, type MediaItemZernio, type PlateformePostZernio } from "./zernio-client";
import { DESCRIPTION_YOUTUBE_OCTETS_MAX, SHORT_DUREE_MAX_SEC, SHORT_FORMATS, titreYoutubeDepuisStudio, type ReglagesYoutube } from "./zernio-youtube";

export const FUSEAU_STUDIO = "Europe/Paris";
export const ALT_MAX = 125;
export const TITRE_DOCUMENT_MAX = 60;
export const DOCUMENT_TAILLE_MAX = 100 * 1024 * 1024;
/**
 * Images au plus par post. Relevé officiel L8-01 (docs/reseaux/regles-officielles.json, lu le 2026-11-12, spec Zernio
 * 1.429.1) : Instagram 20 éléments (schéma InstagramPlatformData), Facebook 10, LinkedIn 20, TikTok 35.
 */
export const IMAGES_MAX: Readonly<Record<string, number>> = { instagram: 20, facebook: 10, linkedin: 20, tiktok: 35, pinterest: 1 };
/**
 * Reel Facebook : on garde 60 s, par prudence. Deux sources divergent : le réseau (guide Meta, cité par la spec Zernio,
 * page Meta non consultée) donne 3 à 90 s ; le diffuseur (Zernio) ne contrôle pas la durée. Relevé L8-01 du 2026-11-12.
 */
export const REEL_FACEBOOK_DUREE_SEC = { min: 3, max: 60 } as const;

const SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;
const refus = (message: string, champs?: string[]) => new ErreurZernio("refuse", `${message} Rien n'a été envoyé.`, { champs });

/* --- Cible (D9) -------------------------------------------------------------------------------------------------- */

export interface CibleZernio {
  accountId: string;
  /** Facebook : page choisie (même accountId). */
  pageId?: string;
  /** LinkedIn : page (urn:li:organization:<n°>). */
  organizationUrn?: string;
  /** LinkedIn : profil personnel, forme explicite « accountId:li:profil » (à prouver par la lecture du compte). */
  profilLinkedin?: true;
  /** Pinterest : tableau choisi, forme explicite « accountId:pin:<boardId> » (jamais le premier tableau). */
  tableauId?: string;
}

/** Demande Zernio : la demande commune + le niveau de confidentialité TikTok choisi par la personne. */
export type DemandeZernio = DemandePublication & {
  niveauConfidentialiteTiktok?: string;
  /** TikTok : cases d'interaction cochées par la personne. Absentes = décochées ; jamais recopiées des réglages du créateur. */
  interactionsTiktok?: { commentaire?: boolean; duo?: boolean; collage?: boolean };
};

/** Le compte lu est-il un profil personnel LinkedIn ? Seules les valeurs explicites « personnel » comptent (sinon : non). */
export function compteLinkedinEstProfil(compte: Record<string, unknown> | undefined): boolean {
  if (!compte) return false;
  const lu = [compte.accountType, compte.profileType, compte.type].find((v) => typeof v === "string");
  return typeof lu === "string" && ["personal", "profile", "person"].includes(lu.toLowerCase());
}

/** Cible du Studio : « accountId:fb:<pageId> », « accountId:li:<n°> », « accountId:li:profil » ; « accountId » seul (Instagram, TikTok). */
export function analyserCible(brute: string | undefined | null): CibleZernio {
  const t = (brute ?? "").trim();
  if (!t) throw refus("Aucune cible choisie pour cette publication.");
  const [accountId, genre, reste, ...autres] = t.split(":");
  if (!SEGMENT.test(accountId) || autres.length) throw refus("La cible de la publication est illisible.");
  if (genre === undefined) return { accountId };
  if (genre === "fb" && reste && SEGMENT.test(reste)) return { accountId, pageId: reste };
  if (genre === "li" && reste === "profil") return { accountId, profilLinkedin: true };
  if (genre === "li" && reste && /^\d{1,20}$/.test(reste)) return { accountId, organizationUrn: `urn:li:organization:${reste}` };
  if (genre === "pin" && reste && /^\d{1,24}$/.test(reste)) return { accountId, tableauId: reste };
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

/** Le niveau est choisi par la personne (règles TikTok) : jamais déduit. Il doit faire partie de ceux que le compte offre. */
function niveauDeConfidentialite(c: CreateurTiktok, choisi: string | undefined): string {
  if (!choisi?.trim()) throw refus("TikTok : choisissez qui peut voir cette vidéo (niveau de confidentialité).");
  if (!c.privacyLevels.includes(choisi)) throw refus("TikTok : ce niveau de confidentialité n'est pas offert par ce compte.");
  return choisi;
}

/* --- Aides ------------------------------------------------------------------------------------------------------- */

/** Date ISO à la seconde, UTC, avec Z. */
export function dateZernio(dateIso: string): string {
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) throw refus("La date de publication est illisible.");
  return new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function texteAlt(brut: string, max: number = ALT_MAX): string {
  const t = brut.replace(/\s+/g, " ").trim();
  if (t.length > max) throw refus(`Le texte alternatif d'une image dépasse ${max} signes : raccourcissez-le.`);
  return t;
}

function exigerSansMotInterdit(texte: string, quoi: string): void {
  const mots = motsInterditsEnvoiZernio(texte);
  if (mots.length) throw new ErreurZernio("mot-interdit", `${quoi} contient un mot interdit : rien n'a été envoyé. Retirez-le puis réessayez.`, { detailTechnique: `mots interdits : ${mots.join(", ")}` });
}

const RESEAUX_PLATEFORME: Readonly<Record<string, string>> = { instagram: "instagram", facebook: "facebook", linkedin: "linkedin", tiktok: "tiktok", pinterest: "pinterest", "youtube-shorts": "youtube" };

/** Plateforme Zernio d'un réseau du Studio. YouTube Shorts : youtube (lot B) ; YouTube long n'est pas porté. */
export function plateformeZernio(reseau: string): string {
  const p = RESEAUX_PLATEFORME[reseau];
  if (!p) throw refus("Ce réseau n'est pas pris en charge par Zernio.");
  return p;
}

/** Premier commentaire transmis par Zernio : Facebook et LinkedIn confirmés ; Instagram prouvé par l'essai réel du 20/11/2026 ; TikTok et YouTube n'en ont pas. */
export function premierCommentaireTransmissibleZernio(reseau: string): boolean {
  return reseau === "instagram" || reseau === "facebook" || reseau === "linkedin";
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
  /** LinkedIn : le compte lu est bien un profil personnel (requis pour la cible « accountId:li:profil »). */
  profilLinkedinProuve?: boolean;
  /** Interrupteur « Premier commentaire » : `true` = le premier commentaire n'entre pas dans le corps. Sert uniquement à couper. */
  premierCommentaireCoupe?: boolean;
  /** YouTube Shorts : réglages lus en base par l'appelant ; absents = refus. */
  youtube?: ReglagesYoutube;
  /** Pinterest : domaine du site (réglage `site.domaine`, lu par l'appelant). Absent ou vide = tout lien est refusé. */
  domaineSite?: string;
}

/** Médias demandés, sans adresse Zernio : sert au téléversement et au corps. Types : image | video | document. */
export function mediasDemandes(d: DemandePublication): MediaItemZernio[] {
  const plateforme = plateformeZernio(d.reseau);
  if (d.document) {
    if (plateforme === "youtube") throw refus("YouTube Shorts : seule une vidéo est publiée.");
    if (plateforme !== "linkedin") throw refus("Un document PDF n'est publié que sur LinkedIn.");
    if (d.images?.length) throw refus("LinkedIn : un seul type de média par publication (document ou images).");
    const titre = (d.document.titre ?? "").replace(/\s+/g, " ").trim();
    if (!titre) throw refus("Le document PDF n'a pas de titre.");
    if (titre.length > TITRE_DOCUMENT_MAX) throw refus(`Le titre du document dépasse ${TITRE_DOCUMENT_MAX} signes.`);
    exigerSansMotInterdit(titre, "Le titre du document");
    if (d.tailleOctets !== undefined && d.tailleOctets > DOCUMENT_TAILLE_MAX) throw refus("Le document dépasse 100 Mo.");
    return [{ type: "document", url: d.document.url, title: titre, mimeType: "application/pdf" }];
  }
  if (plateforme === "youtube" && d.images?.length) throw refus("YouTube Shorts : seule une vidéo est publiée.");
  const images = d.images ?? [];
  if (plateforme === "pinterest" && images.length !== 1) throw refus("Pinterest : une épingle porte exactement une image (ni vidéo, ni document, ni plusieurs images).");
  if (images.length) {
    const max = IMAGES_MAX[plateforme];
    if (images.length > max) throw refus(`${plateforme} accepte ${max} images au plus.`);
    return images.map((im) => {
      const alt = texteAlt(im.texteAlternatif ?? "", plateforme === "pinterest" ? ALT_MAX_PINTEREST : ALT_MAX);
      if (!alt) throw refus("Une image n'a pas de texte alternatif.");
      exigerSansMotInterdit(alt, "Le texte alternatif d'une image");
      return { type: "image", url: im.url, altText: alt };
    });
  }
  return [{ type: "video", url: d.fichierCle }];
}

export function corpsPostZernio(d: DemandeZernio, options: OptionsCorps): CorpsPostZernio {
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
  const commentaire = options.premierCommentaireCoupe === true ? undefined : d.premierCommentaire?.trim();
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
      if (commentaire) specifique.firstComment = commentaire;
      break;
    case "facebook":
      if (!cible.pageId) throw refus("Facebook : aucune page choisie (la page par défaut n'est jamais utilisée).");
      if (pageInterdite(cible.pageId, undefined)) throw refus("Facebook : cette page ne peut jamais être une destination.");
      specifique.pageId = cible.pageId; // compte (accountId) ET page explicites : jamais la page par défaut d'un autre compte
      if (type === "video" && d.format === "9:16" && d.dureeSec !== undefined && d.dureeSec >= REEL_FACEBOOK_DUREE_SEC.min && d.dureeSec <= REEL_FACEBOOK_DUREE_SEC.max) specifique.contentType = "reel";
      if (commentaire) specifique.firstComment = commentaire;
      break;
    case "linkedin":
      // D9 : jamais l'organisation par défaut. Page = urn explicite ; profil = forme « li:profil » prouvée par la lecture du compte.
      if (cible.organizationUrn) specifique.organizationUrn = cible.organizationUrn;
      else if (cible.profilLinkedin) {
        if (!options.profilLinkedinProuve) throw refus("LinkedIn : ce compte n'est pas reconnu comme un profil personnel. Choisissez une page.");
      } else throw refus("LinkedIn : choisissez une page ou votre profil (la page par défaut n'est jamais utilisée).");
      if (type === "document") specifique.documentTitle = demandes[0].title;
      if (commentaire) specifique.firstComment = commentaire;
      break;
    case "youtube": {
      const r = options.youtube;
      if (!r) throw refus("YouTube : les réglages (visibilité, catégorie…) n'ont pas été choisis.");
      if (type !== "video") throw refus("YouTube Shorts : seule une vidéo est publiée.");
      const duree = d.dureeSec;
      if (!d.format || !SHORT_FORMATS.includes(d.format) || duree === undefined || !Number.isFinite(duree) || duree <= 0 || duree > SHORT_DUREE_MAX_SEC) {
        throw refus("YouTube Shorts : la vidéo doit être verticale (9:16) et durer 3 minutes au plus.");
      }
      if (Buffer.byteLength(d.texte, "utf8") > DESCRIPTION_YOUTUBE_OCTETS_MAX) throw refus("YouTube : la description dépasse 5 000 octets.");
      if (/[<>]/.test(d.texte)) throw refus("YouTube : la description ne peut pas contenir < ni >.");
      if (r.titre === "studio") {
        const t = titreYoutubeDepuisStudio(d.titre, d.texte);
        if (!t) throw refus("YouTube : le titre manque.");
        if (/[<>]/.test(t)) throw refus("YouTube : le titre ne peut pas contenir < ni >.");
        exigerSansMotInterdit(t, "Le titre YouTube");
        specifique.title = t;
      }
      specifique.visibility = r.visibilite;
      specifique.categoryId = r.categorieId;
      specifique.madeForKids = r.pourEnfants;
      specifique.containsSyntheticMedia = r.synthetique === "oui" ? true : r.synthetique === "non" ? false : d.contenuIA === true;
      break; // jamais firstComment, playlistId, notifySubscribers ni tags
    }
    case "pinterest": {
      // ADR-0015 D9 : tableau explicite, jamais le premier ; aucun commentaire, section ni couverture.
      if (!cible.tableauId) throw refus("Pinterest : aucun tableau choisi (le premier tableau n'est jamais utilisé).");
      if (type !== "image") throw refus("Pinterest : une épingle porte exactement une image.");
      const titre = (d.epingle?.titre ?? "").replace(/\s+/g, " ").trim();
      if (!titre) throw refus("Pinterest : le titre de l'épingle manque.");
      if (titre.length > TITRE_EPINGLE_MAX) throw refus(`Pinterest : le titre dépasse ${TITRE_EPINGLE_MAX} signes.`);
      exigerSansMotInterdit(titre, "Le titre de l'épingle");
      if (d.texte.length > DESCRIPTION_EPINGLE_MAX) throw refus(`Pinterest : la description dépasse ${DESCRIPTION_EPINGLE_MAX} signes.`);
      const lien = (d.epingle?.lien ?? "").trim();
      if (!lien || lien.length > LIEN_EPINGLE_MAX || !lienDuSite(lien, options.domaineSite)) {
        throw new ErreurZernio("lien-hors-domaine", "Pinterest : le lien doit mener au site (https, sans identifiants, domaine exact). Rien n'a été envoyé.", { champs: ["lien"] });
      }
      Object.assign(specifique, { boardId: cible.tableauId, title: titre, link: lien, ...(d.contenuIA === true ? { isAiGenerated: true } : {}) });
      break;
    }
    case "tiktok": {
      if (d.consentementTiktok !== true) throw refus("TikTok : la case de consentement n'est pas cochée.");
      if (d.contenuIA && type !== "video") throw refus("TikTok : la mention IA ne s'applique qu'à une vidéo.");
      const createur = options.createurTiktok;
      if (!createur) throw refus("TikTok : les réglages du créateur n'ont pas été lus.");
      Object.assign(specifique, {
        contentPreviewConfirmed: true,
        expressConsentGiven: true,
        // Décochées par défaut ; cochées seulement si la personne les coche ET si le créateur les permet.
        allowComment: d.interactionsTiktok?.commentaire === true && createur.allowComment,
        allowDuet: d.interactionsTiktok?.duo === true && createur.allowDuet,
        allowStitch: d.interactionsTiktok?.collage === true && createur.allowStitch,
        privacyLevel: niveauDeConfidentialite(createur, d.niveauConfidentialiteTiktok),
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
