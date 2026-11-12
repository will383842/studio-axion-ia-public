/**
 * CAL-25 : média déposé à la main sur une entrée du calendrier.
 * - Le fichier arrive par le dépôt existant (/api/depots, inchangé) ; ici on RELIT sa taille et son empreinte dans le stockage avant de le rattacher.
 *   Dépôt incomplet ou différent : refusé, l'entrée reste en brouillon (statut « propose »), rien n'est rattaché.
 * - Format refusé par le réseau : jamais bloquant. Le fichier est gardé, la raison est donnée, l'entrée reste un brouillon à compléter.
 * - Privé tant que le fondateur n'a pas validé : aucun lien public et aucun téléversement avant. Après validation, le lien public
 *   réutilise le relais de L5-04 (jeton signé) et le SERVEUR téléverse le fichier privé chez le diffuseur.
 * - Tout est injecté (`DepotsMedias`) : aucun appel réel dans les tests. Les dépendances par défaut viennent de `_commun`.
 */
import "server-only";
import type { Fichier, IdReseau, Ratio } from "@/domaine/types";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";
import { ratioDe, typeDuMime, verifierFormat, type TypeMedia } from "@/domaine/calendrier/formats-media";
import { adresseRelaisMedias, type NomRelaisMedia } from "./relais-medias";

/** Durée de validité de l'adresse de lecture donnée à l'écran du Studio. */
export const DUREE_LECTURE_SEC = 600;

export interface DepotsMedias {
  fichiers: { obtenir(id: string): Promise<Fichier | null>; enregistrer(f: Fichier): Promise<Fichier> };
  creneaux: { obtenir(id: string): Promise<CreneauEditorial | null>; enregistrer(c: CreneauEditorial): Promise<CreneauEditorial> };
  stockage: {
    tailleObjet?(cle: string): Promise<number | null>;
    empreinteSha256?(cle: string, tailleAttendue: number): Promise<{ sha256: string; taille: number }>;
    urlLectureDuree?(cle: string, secondes: number): Promise<string>;
  };
  /** Téléversement chez le diffuseur (jamais appelé avant validation). */
  diffuseur?: { televerser(demande: { nom: string; mime: string; taille: number; url: string }): Promise<{ idDiffuseur: string }> };
  maintenant(): number;
}

export interface DepotRecu {
  fichierId: string;
  creneauId: string;
  reseau: IdReseau;
  /** Clé de stockage donnée par le dépôt (studio/<env>/entree/<créneau>/<fichier>.<ext>). */
  cle: string;
  nom: string;
  mime: string;
  taille: number;
  sha256: string;
  largeur?: number;
  hauteur?: number;
  dureeSec?: number;
  /** Clé de l'image d'affiche d'une vidéo, si elle existe déjà. */
  afficheCle?: string;
}

export type ResultatDepot =
  | { ok: true; etat: "brouillon" | "pret"; fichier: Fichier; formatRefuse?: string }
  | { ok: false; etat: "brouillon"; raison: string };

const SHA256 = /^[0-9a-f]{64}$/;
const refus = (raison: string): ResultatDepot => ({ ok: false, etat: "brouillon", raison });

/** Relit taille et empreinte dans le stockage puis rattache le fichier à l'entrée. */
export async function enregistrerDepot(d: DepotRecu, deps: DepotsMedias): Promise<ResultatDepot> {
  const creneau = await deps.creneaux.obtenir(d.creneauId);
  if (!creneau) return refus("Cette entrée du calendrier n'existe pas : le fichier n'a pas été rattaché.");
  if (creneau.statut === "archive") return refus("Cette entrée est archivée : le fichier n'a pas été rattaché.");
  const type = typeDuMime(d.mime);
  if (!type) return refus("Ce fichier n'est ni une vidéo, ni une image, ni un PDF : le format n'est pas reconnu.");
  if (!Number.isFinite(d.taille) || d.taille <= 0) return refus("Ce fichier semble vide : il n'a pas été reçu en entier.");
  if (!SHA256.test(d.sha256 ?? "")) return refus("L'empreinte du fichier est absente : impossible de vérifier qu'il est complet.");
  if (!deps.stockage.tailleObjet || !deps.stockage.empreinteSha256) return refus("Le stockage ne permet pas de vérifier le fichier pour le moment : réessayez plus tard.");

  try {
    const taille = await deps.stockage.tailleObjet(d.cle);
    if (taille === null || taille !== d.taille) return refus("Le fichier reçu est incomplet ou différent de celui envoyé : envoyez-le à nouveau.");
    const lu = await deps.stockage.empreinteSha256(d.cle, d.taille);
    if (lu.taille !== d.taille || lu.sha256.toLowerCase() !== d.sha256.toLowerCase()) return refus("Le fichier reçu est incomplet ou différent de celui envoyé : envoyez-le à nouveau.");
  } catch {
    return refus("Le stockage ne répond pas : le fichier n'a pas été rattaché. Réessayez dans un instant.");
  }

  const horo = deps.maintenant();
  const existant = await deps.fichiers.obtenir(d.fichierId);
  const instant = new Date(horo).toISOString();
  const fichier: Fichier = {
    ...(existant ?? { creeLe: instant }),
    id: d.fichierId, cleStockage: d.cle, nom: d.nom, mime: d.mime, taille: d.taille, sha256: d.sha256.toLowerCase(),
    ...(d.largeur ? { largeur: d.largeur } : {}), ...(d.hauteur ? { hauteur: d.hauteur } : {}), ...(d.dureeSec ? { dureeSec: d.dureeSec } : {}),
    origine: "depot", statut: "pret", modifieLe: instant,
    ...(d.afficheCle ? { afficheCle: d.afficheCle } : {}),
  } as Fichier;
  const enregistre = await deps.fichiers.enregistrer(fichier);

  // Rattachement : une vidéo OU un visuel, jamais les deux. Le statut de l'entrée ne bouge pas.
  const { videoId: _v, visuelId: _i, ...sans } = creneau;
  await deps.creneaux.enregistrer({ ...sans, ...(type === "video" ? { videoId: d.fichierId } : { visuelId: d.fichierId }) });

  const format = verifierFormat(d.reseau, { mime: d.mime, taille: d.taille, dureeSec: d.dureeSec });
  if (!format.ok) return { ok: true, etat: "brouillon", fichier: enregistre, formatRefuse: format.raison };
  return { ok: true, etat: "pret", fichier: enregistre };
}

export interface InfosMedia {
  type: TypeMedia | null;
  ratio: Ratio | null;
  /** Clé de l'image d'affiche : celle de la vidéo si elle existe, le fichier lui-même pour une image, sinon null. */
  affiche: string | null;
}

export async function infosMedia(mediaId: string, deps: Pick<DepotsMedias, "fichiers">): Promise<InfosMedia | null> {
  const f = await deps.fichiers.obtenir(mediaId);
  if (!f) return null;
  const type = typeDuMime(f.mime);
  const affiche = (f as Fichier & { afficheCle?: string }).afficheCle ?? (type === "image" ? f.cleStockage : null);
  return { type, ratio: ratioDe(f.largeur, f.hauteur), affiche };
}

/** Adresse de lecture à durée limitée pour l'écran du Studio ; null si le média est inconnu ou pas prêt. Reste privée (signée). */
export async function urlDeLecture(mediaId: string, deps: Pick<DepotsMedias, "fichiers" | "stockage">): Promise<string | null> {
  const f = await deps.fichiers.obtenir(mediaId);
  if (!f || f.statut !== "pret" || !f.cleStockage || !deps.stockage.urlLectureDuree) return null;
  const url = await deps.stockage.urlLectureDuree(f.cleStockage, DUREE_LECTURE_SEC);
  return /^https:\/\//.test(url) ? url : null;
}

type Porte = { ok: true; fichier: Fichier } | { ok: false; raison: string };

/** Le fichier doit être celui de CETTE entrée, prêt, et l'entrée doit être validée (ou déjà programmée / publiée). */
async function porteValidee(mediaId: string, creneauId: string, deps: Pick<DepotsMedias, "fichiers" | "creneaux">): Promise<Porte> {
  const c = await deps.creneaux.obtenir(creneauId);
  if (!c) return { ok: false, raison: "Cette entrée du calendrier n'existe pas." };
  if (c.videoId !== mediaId && c.visuelId !== mediaId) return { ok: false, raison: "Ce fichier n'est pas joint à cette entrée." };
  if (c.statut !== "valide" && c.statut !== "programme" && c.statut !== "publie") return { ok: false, raison: "Le fichier reste privé tant que vous n'avez pas validé la publication." };
  const f = await deps.fichiers.obtenir(mediaId);
  if (!f || f.statut !== "pret") return { ok: false, raison: "Le fichier n'est pas prêt." };
  return { ok: true, fichier: f };
}

function nomRelais(f: Fichier): NomRelaisMedia | null {
  const m = f.mime.toLowerCase();
  if (m.startsWith("video/")) return "video.mp4";
  if (m === "image/png") return "image.png";
  if (m === "image/jpeg") return "image.jpg";
  if (m === "application/pdf") return "document.pdf";
  return null;
}

/** Lien public signé (relais L5-04) que le diffuseur peut lire ; refusé avant validation. */
export async function lienPublicPourDiffuseur(mediaId: string, creneauId: string, deps: Pick<DepotsMedias, "fichiers" | "creneaux">): Promise<{ ok: true; url: string } | { ok: false; raison: string }> {
  const p = await porteValidee(mediaId, creneauId, deps);
  if (!p.ok) return p;
  const nom = nomRelais(p.fichier);
  if (!nom) return { ok: false, raison: "Ce type de fichier ne peut pas être joint par lien." };
  try {
    return { ok: true, url: adresseRelaisMedias(p.fichier.id, nom) };
  } catch {
    return { ok: false, raison: "Le lien public n'a pas pu être créé : l'adresse du Studio n'est pas sécurisée." };
  }
}

/** Après validation, le serveur téléverse lui-même le fichier privé chez le diffuseur (via le lien du relais). */
export async function televerserChezDiffuseur(mediaId: string, creneauId: string, deps: DepotsMedias): Promise<{ ok: true; idDiffuseur: string } | { ok: false; raison: string }> {
  const lien = await lienPublicPourDiffuseur(mediaId, creneauId, deps);
  if (!lien.ok) return lien;
  const f = (await deps.fichiers.obtenir(mediaId))!;
  if (!deps.diffuseur) return { ok: false, raison: "Le diffuseur n'est pas branché." };
  try {
    const r = await deps.diffuseur.televerser({ nom: f.nom, mime: f.mime, taille: f.taille, url: lien.url });
    return { ok: true, idDiffuseur: r.idDiffuseur };
  } catch {
    return { ok: false, raison: "Le diffuseur n'a pas pu recevoir le fichier : rien n'est parti, vous pouvez réessayer." };
  }
}
