import "server-only";
import { createHash } from "node:crypto";
import type { NavigationFilmee } from "@/briques/plan-scenes/tutoriel/navigation-filmee";
import type { EntreesTutoriel } from "@/moteurs/montage-tutoriel-outil/entrees";
import { lireArtefactsTutoriel, type CaptureGardee } from "@/moteurs/montage-tutoriel-outil/artefacts-retouche";

/**
 * N-05-VOLET-g1 : source des 2 images du volet « avant / après » d'un tutoriel, prises dans le film de navigation (même maquette,
 * jamais un visage). « Avant » = l'instant où la voix commence ; « après » = la fin de la voix moins une marge. Le port
 * d'extraction est INJECTÉ (aucun réseau, aucun réglage ici). Aucun appelant pour l'instant (g2 le branchera, éteint) ; ne lève jamais.
 */
export const MARGE_FIN_VOLET_SEC = 0.5;

/** Forme du port d'extraction d'images d'un film (un échec LÈVE ; « en-cours » = à reprendre au tour suivant). */
export type PortExtraction = (d: {
  idTravail: string;
  source: string;
  instants: { nom: string; instantSec: number }[];
  largeur: number;
  cles: Record<string, string>;
}) => Promise<{ statut: "fini"; images: { nom: string; cle: string }[] } | { statut: "en-cours" }>;

const positif = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const positifOuNul = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Instants (secondes) des deux images ; `null` si le film, la taille de la page ou la durée de la voix ne permettent pas un volet. PURE. */
export function instantsDuVolet(nav: NavigationFilmee | undefined): { avantSec: number; apresSec: number } | null {
  try {
    if (!nav || typeof nav.videoCle !== "string" || nav.videoCle.trim() === "") return null;
    if (!positif(nav.largeur) || !positif(nav.hauteur) || !positifOuNul(nav.debutFilmMs) || !positifOuNul(nav.dureeVoixMs)) return null;
    const avantSec = nav.debutFilmMs / 1000;
    const apresSec = (nav.debutFilmMs + nav.dureeVoixMs) / 1000 - MARGE_FIN_VOLET_SEC;
    return apresSec > avantSec ? { avantSec, apresSec } : null;
  } catch {
    return null;
  }
}

/** Dossier déposé sans attestation d'images : pas de volet. Phrase (maquette dessinée par nous) ou dossier attesté : permis. PURE. */
export function voletPermisParEntrees(e: Pick<EntreesTutoriel, "depot">): boolean {
  return !(e.depot?.mode === "dossier" && e.depot.attestationImages !== true);
}

/** Les deux captures gardées complètes (avant puis après), l'attente (`en-cours`) ou `null` (rien de sûr : pas de volet). Un seul appel au port. */
export async function extraireCapturesVolet(
  e: Pick<EntreesTutoriel, "navigationFilmee" | "depot">,
  deja: unknown,
  deps: { extraire: PortExtraction; idTravail: string; cle: (nom: string) => string },
): Promise<{ etat: "fini"; captures: [CaptureGardee, CaptureGardee] } | { etat: "en-cours" } | null> {
  try {
    const nav = e.navigationFilmee;
    const instants = voletPermisParEntrees(e) ? instantsDuVolet(nav) : null;
    if (!nav || !instants) return null;
    const { avantSec, apresSec } = instants;
    const h = sha(nav.videoCle + avantSec + apresSec).slice(0, 12);
    const cles = { avant: deps.cle(`volet-avant-${h}.jpg`), apres: deps.cle(`volet-apres-${h}.jpg`) };
    const garde = lireArtefactsTutoriel(deja).captures;
    if (garde?.length === 2 && garde[0]!.cle === cles.avant && garde[1]!.cle === cles.apres) return { etat: "fini", captures: [garde[0]!, garde[1]!] };
    const r = await deps.extraire({
      idTravail: `${deps.idTravail}-volet-${h}`,
      source: nav.videoCle,
      instants: [{ nom: "avant", instantSec: avantSec }, { nom: "apres", instantSec: apresSec }],
      largeur: nav.largeur,
      cles,
    });
    if (r.statut === "en-cours") return { etat: "en-cours" };
    const trouve = (nom: "avant" | "apres") => r.images.some((i) => i.nom === nom && i.cle === cles[nom]);
    if (!trouve("avant") || !trouve("apres")) return null;
    const capture = (nom: "avant" | "apres", instantSec: number): CaptureGardee =>
      ({ cle: cles[nom], largeur: nav.largeur, hauteur: nav.hauteur, empreinte: sha(nav.videoCle + nom + instantSec + cles[nom]).slice(0, 24), zones: [] });
    return { etat: "fini", captures: [capture("avant", avantSec), capture("apres", apresSec)] };
  } catch {
    return null;
  }
}
