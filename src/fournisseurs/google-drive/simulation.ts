/**
 * DOUBLE DE SIMULATION de Google Drive (lot E2) — fournisseur PAR DÉFAUT : aucun appel à Google. La « page Google » est
 * remplacée par un retour immédiat sur `/api/google-drive/retour`, les vidéos sont fictives et leurs octets calculés.
 * Réglable pour les essais : refus permanent (`refus`), coupures passagères de la lecture (`coupures`, après
 * `coupureApres` lectures réussies) — ou, à la main, `GOOGLE_DRIVE_ESSAI=expire|refuse|coupure`.
 */
import { MO } from "@/lib/envoi-multipart";
import { RefusDrive, type FournisseurDrive, type JetonsDrive, type RaisonRefusDrive, type VideoDrive } from "./types";

const GO = 1024 * 1024 * 1024;

export const VIDEOS_DRIVE_ESSAI: VideoDrive[] = [
  { id: "essai-img-7747", nom: "IMG_7747.MOV", mime: "video/quicktime", taille: Math.round(2.1 * GO), dureeSec: 142.3, creeLe: "2026-10-08T07:12:00.000Z", modifieLe: "2026-10-08T07:12:00.000Z", largeur: 2160, hauteur: 3840, vignette: true },
  { id: "essai-img-7751", nom: "IMG_7751.MOV", mime: "video/quicktime", taille: Math.round(1.4 * GO), dureeSec: 95.8, creeLe: "2026-10-07T18:40:00.000Z", modifieLe: "2026-10-07T18:40:00.000Z", largeur: 2160, hauteur: 3840, vignette: true },
  { id: "essai-formation-opco", nom: "Formation OPCO - prise 2.mp4", mime: "video/mp4", taille: 820 * MO, dureeSec: 63, creeLe: "2026-10-05T09:00:00.000Z", modifieLe: "2026-10-05T09:00:00.000Z", largeur: 1080, hauteur: 1920, vignette: true },
  { id: "essai-longue", nom: "Tournage complet 4K.MOV", mime: "video/quicktime", taille: 14 * GO, dureeSec: 1180, creeLe: "2026-09-30T14:00:00.000Z", modifieLe: "2026-09-30T14:00:00.000Z", largeur: 2160, hauteur: 3840, vignette: false },
];

export interface OptionsDriveSimule {
  videos?: VideoDrive[];
  /** Chaque appel est refusé pour cette raison (connexion expirée, accès retiré…). */
  refus?: RaisonRefusDrive;
  /** Nombre de lectures de plage qui échouent (coupure réseau passagère)… */
  coupures?: number;
  /** …après ce nombre de lectures réussies. */
  coupureApres?: number;
  maintenant?: () => number;
}

/** Octet n° i d'une vidéo d'essai : calculable, donc vérifiable après transfert. */
export function octetEssai(id: string, i: number): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xff;
  return (i * 7 + h) & 0xff;
}

export function creerDriveSimule(o: OptionsDriveSimule = {}): FournisseurDrive & { lectures: { id: string; debut: number; fin: number }[] } {
  const videos = o.videos ?? VIDEOS_DRIVE_ESSAI;
  const maintenant = o.maintenant ?? Date.now;
  let coupuresRestantes = o.coupures ?? 0;
  let reussies = 0;
  const lectures: { id: string; debut: number; fin: number }[] = [];

  const verifier = (acces: string) => {
    if (o.refus) throw new RefusDrive(o.refus, o.refus === "expire" ? "Connexion au Drive expirée." : "Google refuse l'accès.");
    if (!acces.startsWith("essai-acces")) throw new RefusDrive("expire", "Connexion au Drive expirée.");
  };
  const trouver = (id: string) => {
    const v = videos.find((x) => x.id === id);
    if (!v) throw new RefusDrive("introuvable", "Cette vidéo n'est plus dans le Drive.");
    return v;
  };
  const nouveaux = (rafraichissement?: string): JetonsDrive => ({ acces: `essai-acces-${maintenant()}`, expireLe: maintenant() + 3600_000, rafraichissement });

  return {
    mode: "simulation",
    lectures,
    adresseConnexion(etat) {
      return `/api/google-drive/retour?code=essai&state=${encodeURIComponent(etat)}`;
    },
    async echangerCode(code) {
      if (o.refus === "refuse" || code !== "essai") throw new RefusDrive("refuse", "Google n'a pas donné l'accès.");
      return nouveaux("essai-rafraichissement");
    },
    async rafraichir(rafraichissement) {
      if (o.refus === "expire" || !rafraichissement.startsWith("essai-")) throw new RefusDrive("expire", "Connexion au Drive expirée.");
      return nouveaux();
    },
    async compte(acces) {
      verifier(acces);
      return "compte d'essai (simulation)";
    },
    async listerVideos(acces, p = {}) {
      verifier(acces);
      const r = p.recherche?.trim().toLowerCase();
      const liste = videos.filter((v) => !r || v.nom.toLowerCase().includes(r)).sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
      const debut = Number(p.suite ?? 0) || 0;
      const n = p.parPage ?? 24;
      return { videos: liste.slice(debut, debut + n), suite: debut + n < liste.length ? String(debut + n) : undefined };
    },
    async infosVideo(acces, id) {
      verifier(acces);
      return trouver(id);
    },
    async lirePlage(acces, id, debut, fin) {
      verifier(acces);
      const v = trouver(id);
      if (debut < 0 || fin > v.taille || fin <= debut) throw new RefusDrive("reseau", "Plage invalide.");
      if (coupuresRestantes > 0 && reussies >= (o.coupureApres ?? 0)) {
        coupuresRestantes--;
        throw new RefusDrive("reseau", "Google Drive ne répond pas.");
      }
      reussies++;
      lectures.push({ id, debut, fin });
      const octets = new Uint8Array(fin - debut);
      for (let i = 0; i < octets.length; i++) octets[i] = octetEssai(id, debut + i);
      return octets;
    },
    async lireVignette(acces, id) {
      verifier(acces);
      const v = trouver(id);
      if (!v.vignette) return null;
      const teinte = octetEssai(id, 0) * 1.4;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 160"><rect width="90" height="160" fill="hsl(${teinte} 25% 22%)"/><circle cx="45" cy="62" r="20" fill="hsl(${teinte} 30% 55%)"/><rect x="18" y="90" width="54" height="70" rx="24" fill="hsl(${teinte} 30% 45%)"/></svg>`;
      return { type: "image/svg+xml", octets: new TextEncoder().encode(svg) };
    },
    async revoquer() {
      /* rien chez Google */
    },
  };
}

/**
 * Réglage manuel du double (`GOOGLE_DRIVE_ESSAI`), pour voir les écrans de repli sans Google. Développement seulement :
 * ignoré en production (jamais transmis par le compose).
 */
export function optionsDepuisEnv(env: Record<string, string | undefined>): OptionsDriveSimule {
  if (env.NODE_ENV === "production") return {};
  switch (env.GOOGLE_DRIVE_ESSAI?.trim()) {
    case "expire":
      return { refus: "expire" };
    case "refuse":
      return { refus: "refuse" };
    case "coupure":
      return { coupures: 1, coupureApres: 2 };
    default:
      return {};
  }
}
