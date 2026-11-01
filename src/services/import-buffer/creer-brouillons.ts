/**
 * IMP-2 — BROUILLONS ZERNIO DE L'IMPORT BUFFER (lots A, B, D). MODE « À BLANC » PAR DÉFAUT : aucun POST, aucun envoi.
 *
 * Même corps que Z1-P (`corpsPostZernio` : mêmes filtres, mêmes refus), avec `isDraft: true` et
 * `metadata { origine: "import-buffer", bufferId, studioCle }`. Toute écriture passe par le client à liste fermée
 * (jamais de fetch direct, jamais `publishNow`, jamais de suppression). Aucune création sans table des cibles confirmée.
 * Seuls les posts datés d'au moins 3 h après la création sont créés ; les autres restent à Buffer.
 * Après une erreur 5xx ou un délai dépassé : lecture GET avant tout nouvel envoi, jamais un renvoi à l'aveugle.
 */
import type { DemandePublication } from "../../fournisseurs/types";
import { cleIdempotenceImport, type ClientZernio, type CorpsPostZernio, type MediaItemZernio, type PostZernio } from "../../fournisseurs/publication/zernio-client";
import { compteLinkedinEstProfil, corpsPostZernio, mediasDemandes } from "../../fournisseurs/publication/zernio-corps";
import { estErreurZernio } from "../../fournisseurs/publication/zernio-erreurs";
import { exigerCorpsSansMotInterdit } from "../../fournisseurs/publication/zernio-filtre";
import { televerserMedias, type LecteurMedia } from "../../fournisseurs/publication/zernio-medias";
import { analyserCible } from "../../fournisseurs/publication/zernio-corps";
import { cibleDuCanal, exigerTableConfirmee, type TableCibles } from "./cibles";
import { raisonExclusion } from "./exclusions";
import type { MediaCopie } from "./medias-prives";
import { controlerGrille, dateUtilisable, SuiviDebitImport, type ViolationGrille } from "./plafonds";
import type { PostBuffer } from "./types";

export type LotImport = "A" | "B" | "D";
export const ORIGINE_IMPORT = "import-buffer";

/** Lot A = Instagram + Facebook ; lot B = LinkedIn (profil + page) ; lot D = delta (tout). */
export const reseauDansLot = (lot: LotImport, reseau: string): boolean => lot === "D" || (lot === "A" ? reseau === "instagram" || reseau === "facebook" : reseau === "linkedin");

/** Renseignements de média que Buffer ne donne pas (facultatifs). */
export interface InfosPost {
  format?: string;
  dureeSec?: number;
  contenuIA?: boolean;
}

export type EtatBrouillon = "cree" | "a-blanc" | "deja-fait" | "doublon" | "reste-buffer" | "refuse" | "a-verifier" | "arret";

export interface LigneBrouillon {
  bufferId: string;
  canalId: string;
  etat: EtatBrouillon;
  raison?: string;
  cle?: string;
  zernioId?: string;
  reseau?: string;
  dateIso?: string;
}

export interface ResultatBrouillons {
  aBlanc: boolean;
  lot: LotImport;
  lignes: LigneBrouillon[];
  violations: ViolationGrille[];
  /** Corps prêts (à blanc : montrés, jamais envoyés). */
  corps: Map<string, CorpsPostZernio>;
}

export interface OptionsBrouillons {
  client: ClientZernio;
  table: TableCibles | undefined;
  posts: PostBuffer[];
  /** Médias copiés dans R2 (IMP-1), par identifiant Buffer. */
  copies: Map<string, MediaCopie[]>;
  /** Service Buffer de chaque canal (réseau) : déjà résolu dans la table des cibles. */
  lot: LotImport;
  /** Défaut : vrai. Faux = vraies créations (exige la table confirmée). */
  aBlanc?: boolean;
  maintenant: () => number;
  attendre?: (ms: number) => Promise<void>;
  /** Adresse de lecture signée interne d'une clé R2. */
  urlLecture: (cleStockage: string) => Promise<string>;
  lecteur?: LecteurMedia;
  infos?: Map<string, InfosPost>;
  /** Journal du Studio : clés `imp-…` déjà créées → identifiant Zernio (le journal fait foi au-delà de 24 h). */
  dejaCrees?: Map<string, string>;
  suivi?: SuiviDebitImport;
  /** Appelé après chaque création ou doublon (journal des clés écrit au fil de l'eau, pas seulement en fin de lot). */
  apresChaque?: (ligne: LigneBrouillon) => void | Promise<void>;
  /** Compte relié avec la portée « comments » : le premier commentaire Instagram n'est transmis qu'alors. */
  commentairesInstagram?: boolean;
}

function cleIdempotence(post: PostBuffer, cible: string): string {
  const c = analyserCible(cible);
  const t = c.pageId ? { pageId: c.pageId } : c.organizationUrn ? { organizationUrn: c.organizationUrn } : { pageId: "profil" };
  return cleIdempotenceImport(post.id, c.accountId, t);
}

/** Demande Z1-P équivalente à un post Buffer (médias lus par adresse signée interne). */
async function demandeDepuisPost(post: PostBuffer, reseau: string, cible: string, copies: MediaCopie[], urlLecture: (c: string) => Promise<string>, infos: InfosPost | undefined): Promise<DemandePublication> {
  const adresses = new Map<MediaCopie, string>();
  for (const m of copies) adresses.set(m, await urlLecture(m.cleStockage));
  const images = copies.filter((m) => m.type === "image");
  const doc = copies.find((m) => m.type === "document");
  const video = copies.find((m) => m.type === "video");
  if (!images.length && !doc && !video) throw new Error("Le post n'a aucun média copié : il reste à Buffer.");
  if (doc && (images.length || video)) throw new Error("LinkedIn : un seul type de média par publication (document ou images).");
  if (images.length && video) throw new Error("Un post mêlant images et vidéo n'est pas importé.");
  return {
    reseau: reseau as DemandePublication["reseau"],
    texte: post.texte,
    date: post.dateUtc ?? "",
    fichierCle: video ? adresses.get(video)! : "",
    mode: "brouillon",
    cible,
    premierCommentaire: post.premierCommentaire,
    titre: post.titre,
    images: images.length ? images.map((m) => ({ url: adresses.get(m)!, texteAlternatif: m.texteAlternatif ?? "" })) : undefined,
    document: doc ? { url: adresses.get(doc)!, titre: doc.titre ?? post.titre } : undefined,
    tailleOctets: doc?.taille,
    format: infos?.format,
    dureeSec: infos?.dureeSec,
    contenuIA: infos?.contenuIA,
  } as DemandePublication;
}

/** Corps de brouillon d'un post : mêmes filtres que Z1-P, puis métadonnées d'import et contrôle récursif des mots interdits. */
export function corpsBrouillonImport(demande: DemandePublication, post: PostBuffer, cle: string, maintenant: number, medias?: MediaItemZernio[], hotes?: ReadonlySet<string>, commentairesInstagram = false, profilLinkedinProuve = false): CorpsPostZernio {
  const corps = corpsPostZernio(demande, { maintenant, medias, hotesPublics: hotes, profilLinkedinProuve });
  if (commentairesInstagram && demande.reseau === "instagram" && demande.premierCommentaire?.trim()) {
    const e = corps.platforms[0];
    e.platformSpecificData = { ...(e.platformSpecificData ?? {}), firstComment: demande.premierCommentaire.trim() };
  }
  const final: CorpsPostZernio = { ...corps, isDraft: true, metadata: { origine: ORIGINE_IMPORT, bufferId: post.id, studioCle: cle } };
  exigerCorpsSansMotInterdit(final, "Le brouillon d'import");
  return final;
}

/** Lit TOUTES les pages d'une liste de posts (plafond de sécurité 50 pages ; arrêt si une page n'apporte rien de neuf). */
export async function listerTousLesPosts(client: ClientZernio, status: string, limite = 100): Promise<PostZernio[]> {
  const tous: PostZernio[] = [];
  const vus = new Set<string>();
  for (let page = 1; page <= 50; page++) {
    const lus = await client.listerPosts({ status, page, limit: limite });
    const neufs = lus.filter((p) => !vus.has(p._id));
    neufs.forEach((p) => vus.add(p._id));
    tous.push(...neufs);
    if (lus.length < limite || neufs.length === 0) break;
  }
  return tous;
}

const phrase = (e: unknown): string => (e instanceof Error ? e.message : "erreur inconnue");

export async function creerBrouillons(o: OptionsBrouillons): Promise<ResultatBrouillons> {
  const aBlanc = o.aBlanc ?? true;
  const table = aBlanc ? o.table : exigerTableConfirmee(o.table);
  const suivi = o.suivi ?? new SuiviDebitImport();
  const attendre = o.attendre ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const res: ResultatBrouillons = { aBlanc, lot: o.lot, lignes: [], violations: [], corps: new Map() };
  // LinkedIn profil : prouvé par la lecture des comptes en mode réel (comme Z1-P) ; à blanc, aucun réseau (non prouvé).
  const aProfil = !!table?.lignes.some((l) => l.reseau === "linkedin" && analyserCible(l.cible).profilLinkedin);
  const comptes = !aBlanc && aProfil ? await o.client.listerComptes() : [];
  const profilProuve = (cible: string): boolean => {
    const c = analyserCible(cible);
    if (!c.profilLinkedin) return false;
    return aBlanc ? true : compteLinkedinEstProfil(comptes.find((x) => x._id === c.accountId));
  };
  const prets: { post: PostBuffer; reseau: string; compte: string; cible: string; cle: string; demande: DemandePublication; ligne: LigneBrouillon }[] = [];

  // 1. Choix et corps de chaque post (aucun réseau).
  for (const post of o.posts) {
    const ligne: LigneBrouillon = { bufferId: post.id, canalId: post.canalId, etat: "refuse", dateIso: post.dateUtc };
    res.lignes.push(ligne);
    const cibleLigne = table ? cibleDuCanal(table, post.canalId) : undefined;
    if (!cibleLigne) {
      ligne.raison = "canal sans cible dans la table (TikTok : aucun post, ou cible à choisir)";
      continue;
    }
    ligne.reseau = cibleLigne.reseau;
    if (!reseauDansLot(o.lot, cibleLigne.reseau)) {
      ligne.etat = "reste-buffer";
      ligne.raison = `hors du lot ${o.lot}`;
      continue;
    }
    const excl = raisonExclusion(post, new Date(o.maintenant()));
    if (excl) {
      ligne.etat = "reste-buffer";
      ligne.raison = `exclu (${excl})`;
      continue;
    }
    const d = dateUtilisable(post.dateUtc, o.maintenant(), "creation");
    if (!d.ok) {
      ligne.etat = "reste-buffer";
      ligne.raison = d.raison;
      continue;
    }
    try {
      const cle = cleIdempotence(post, cibleLigne.cible);
      ligne.cle = cle;
      const demande = await demandeDepuisPost(post, cibleLigne.reseau, cibleLigne.cible, o.copies.get(post.id) ?? [], o.urlLecture, o.infos?.get(post.id));
      mediasDemandes(demande); // refus de médias avant le réseau
      const corps = corpsBrouillonImport(demande, post, cle, o.maintenant(), undefined, undefined, o.commentairesInstagram, profilProuve(cibleLigne.cible));
      res.corps.set(post.id, corps);
      prets.push({ post, reseau: cibleLigne.reseau, compte: analyserCible(cibleLigne.cible).accountId, cible: cibleLigne.cible, cle, demande, ligne });
    } catch (e) {
      ligne.raison = phrase(e);
    }
  }

  // 2. Grille contrôlée avant le lot : si elle dépasse un plafond, rien n'est créé.
  res.violations = controlerGrille(prets.map((p) => ({ id: p.post.id, compte: p.compte, reseau: p.reseau, dateIso: p.post.dateUtc! })));
  if (res.violations.length) {
    for (const p of prets) {
      p.ligne.etat = "arret";
      p.ligne.raison = "grille hors plafond : lot non lancé";
    }
    return res;
  }

  // 3. Création (ou simple annonce à blanc).
  let arret = false;
  for (const p of prets) {
    const { ligne } = p;
    try {
      if (arret) {
        ligne.etat = "arret";
        ligne.raison = "lot arrêté avant ce post";
        continue;
      }
      const connu = o.dejaCrees?.get(p.cle);
      if (connu) {
        ligne.etat = "deja-fait";
        ligne.zernioId = connu;
        continue;
      }
      if (aBlanc) {
        ligne.etat = "a-blanc";
        continue;
      }
      try {
        if (o.client.lectureExigee()) await o.client.listerPosts({ status: "draft" });
        const permis = suivi.peutOperer(p.compte, p.reseau, o.maintenant());
        if (!permis.ok) {
          ligne.etat = "arret";
          ligne.raison = permis.raison;
          arret = true;
          continue;
        }
        const attente = suivi.delaiAvant(o.maintenant());
        if (attente > 0) await attendre(attente);
        const hotes = new Set<string>();
        const lecteur = o.lecteur;
        if (!lecteur) throw new Error("Aucun lecteur de média fourni.");
        const televerses = await televerserMedias(o.client, lecteur, mediasDemandes(p.demande), hotes);
        for (let i = 0; i < televerses.length * 2; i++) suivi.noterRequete(o.maintenant());
        const corps = corpsBrouillonImport(p.demande, p.post, p.cle, o.maintenant(), televerses, hotes, o.commentairesInstagram, profilProuve(p.cible));
        res.corps.set(p.post.id, corps);
        suivi.noterRequete(o.maintenant());
        const r = await o.client.creerPost(corps, p.cle);
        suivi.noterOperation(p.compte, o.maintenant());
        ligne.zernioId = r.post._id;
        ligne.etat = r.issue === "echec" ? "refuse" : "cree";
        if (r.issue !== "ok") ligne.raison = `création ${r.issue}`;
      } catch (e) {
        if (estErreurZernio(e) && e.code === "doublon") {
          ligne.etat = "doublon";
          ligne.zernioId = e.existingPostId;
          ligne.raison = "déjà chez Zernio";
        } else if (estErreurZernio(e) && (e.code === "a-verifier" || e.code === "conflit-idempotence")) {
          ligne.etat = "a-verifier";
          ligne.raison = e.message;
          // Lecture avant tout nouvel envoi : le brouillon existe-t-il déjà ?
          try {
            const lus = await listerTousLesPosts(o.client, "draft");
            const trouve = lus.find((x: PostZernio) => x.metadata?.bufferId === p.post.id && x.metadata?.origine === ORIGINE_IMPORT);
            if (trouve) {
              ligne.etat = "cree";
              ligne.zernioId = trouve._id;
              ligne.raison = "retrouvé par lecture";
              continue;
            }
          } catch {
            /* lecture impossible : le lot s'arrête */
          }
          arret = true;
        } else if (estErreurZernio(e) && (e.code === "debit" || e.code === "indisponible")) {
          const pause = suivi.pauseRetryAfter((e.attenteMs ?? 0) / 1000, o.maintenant());
          ligne.etat = "arret";
          ligne.raison = pause.ok ? `débit : reprendre dans ${Math.ceil(pause.attenteMs / 1000)} s` : "débit : pause trop longue, lot arrêté";
          arret = true; // jamais de boucle
        } else {
          ligne.etat = "refuse";
          ligne.raison = phrase(e);
          if (estErreurZernio(e) && (e.code === "acces" || e.code === "envoi-coupe")) arret = true;
        }
      }
    } finally {
      if (o.apresChaque && ["cree", "doublon"].includes(ligne.etat)) await o.apresChaque(ligne);
    }
  }
  return res;
}
