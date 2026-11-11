/**
 * ENTRÉES DE LA DÉMO FACECAM (lot J) — lues dans `commande.entrees.demoFacecam`, tolérantes : ce qui manque prend sa
 * valeur par défaut, ce qui est mal formé devient une remarque. Jamais de refus (seule l'absence de toute vidéo
 * empêche le montage).
 *
 * Deux façons de déposer :
 *  - deux fichiers : `facecam` (Williams, sa voix) + `ecran` (l'enregistrement d'écran), synchronisés par l'audio
 *    (mots communs aux deux transcriptions), par le début (`synchro.mode = "debut"`), ou par un décalage donné ;
 *  - une seule vidéo déjà en écran partagé (`facecam` seul, `ecranPartage.ecran` = la moitié où est l'écran).
 * Repli : sans `facecam`, la première prise de la commande (`prises`).
 */
import type { CommandeFabrication } from "@/domaine/types";
import { lireConsignes, type ConsigneDemo } from "./pistes";
import { opposee, type PartieSource } from "./mise-en-page";

export interface SourceDemo {
  cle: string;
  dureeSec?: number;
  largeur: number;
  hauteur: number;
}

export interface EntreesDemo {
  facecam: SourceDemo | null;
  /** Fichier d'écran à part (deux fichiers) ; absent : une seule vidéo. */
  ecran: SourceDemo | null;
  /** Moitié de chaque source montrée : `entier` pour deux fichiers. */
  partieFacecam: PartieSource;
  partieEcran: PartieSource;
  synchro: { mode: "audio" } | { mode: "debut" } | { mode: "fourni"; decalageSec: number } | { mode: "aucune" };
  consignes: ConsigneDemo[];
  cadrageVisage: { x: number; y: number };
  carteFin: { titre: string; sousTitre: string };
  /** Plan corrigé (retouche par chat), relu par le validateur du lot C. */
  plan?: unknown;
  remarques: string[];
}

export const CARTE_FIN_AXION = { titre: "Axion IA", sousTitre: "axion-ia.com" } as const;

const estCle = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const entier = (v: unknown, defaut: number) => (typeof v === "number" && Number.isFinite(v) && v >= 16 ? Math.round(v) : defaut);

function source(brut: unknown, defaut: { largeur: number; hauteur: number }): SourceDemo | null {
  const o = (brut ?? {}) as Record<string, unknown>;
  if (!estCle(o.cle)) return null;
  return {
    cle: o.cle,
    ...(typeof o.dureeSec === "number" && o.dureeSec > 0 ? { dureeSec: o.dureeSec } : {}),
    largeur: entier(o.largeur, defaut.largeur),
    hauteur: entier(o.hauteur, defaut.hauteur),
  };
}

const PARTIES: PartieSource[] = ["gauche", "droite", "haut", "bas"];

export function lireEntreesDemo(commande: Pick<CommandeFabrication, "entrees" | "prises">): EntreesDemo {
  const brut = ((commande.entrees ?? {}) as { demoFacecam?: Record<string, unknown> }).demoFacecam ?? {};
  const remarques: string[] = [];
  const prise = (commande.prises ?? [])[0];
  const facecam = source(brut.facecam, { largeur: 1920, hauteur: 1080 }) ?? (prise ? { cle: prise.cle, dureeSec: prise.dureeSec, largeur: 1920, hauteur: 1080 } : null);
  const ecran = source(brut.ecran, { largeur: 1920, hauteur: 1080 });
  const partage = (brut.ecranPartage ?? {}) as { ecran?: unknown };
  let partieEcran: PartieSource = "entier";
  if (!ecran) {
    partieEcran = PARTIES.includes(partage.ecran as PartieSource) ? (partage.ecran as PartieSource) : "droite";
    if (!PARTIES.includes(partage.ecran as PartieSource)) remarques.push("Une seule vidéo : l'écran est pris sur sa moitié droite, votre visage sur la gauche.");
  }
  const s = (brut.synchro ?? {}) as { mode?: unknown; decalageSec?: unknown };
  const synchro: EntreesDemo["synchro"] = !ecran
    ? { mode: "aucune" }
    : typeof s.decalageSec === "number" && Number.isFinite(s.decalageSec)
      ? { mode: "fourni", decalageSec: s.decalageSec }
      : s.mode === "debut"
        ? { mode: "debut" }
        : { mode: "audio" };
  const lues = lireConsignes(brut.consignes);
  remarques.push(...lues.remarques);
  const c = (brut.cadrageVisage ?? {}) as { x?: unknown; y?: unknown };
  const unite = (v: unknown, d: number) => (typeof v === "number" && v >= 0 && v <= 1 ? v : d);
  const f = (brut.carteFin ?? {}) as { titre?: unknown; sousTitre?: unknown };
  return {
    facecam,
    ecran,
    partieFacecam: ecran ? "entier" : opposee(partieEcran),
    partieEcran,
    synchro,
    consignes: lues.consignes,
    // Cadrage habituel : visage un peu au-dessus du centre.
    cadrageVisage: { x: unite(c.x, 0.5), y: unite(c.y, 0.42) },
    carteFin: { titre: estCle(f.titre) ? f.titre.trim().slice(0, 40) : CARTE_FIN_AXION.titre, sousTitre: estCle(f.sousTitre) ? f.sousTitre.trim().slice(0, 60) : CARTE_FIN_AXION.sousTitre },
    ...(brut.plan !== undefined ? { plan: brut.plan } : {}),
    remarques,
  };
}
