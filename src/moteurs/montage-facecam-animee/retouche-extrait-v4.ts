/**
 * R4-03-b1 : lire une demande « changer l'extrait du téléphone » et l'appliquer au projet gardé.
 * PUR : aucune horloge, aucun hasard, aucun service, aucun réglage, aucun appel. Rien ne l'importe (R4-03-c le branchera).
 * Le projet d'entrée n'est jamais modifié : on rend une copie, ou un refus clair.
 */
import { z } from "zod";
import { schemaPlanFacecamAnimee, type ElementV4Plan } from "@/domaine/facecam-animee/plan";
import type { ChoixVideoV4, FichierVideoV4 } from "./chaine-v4";
import { ecrireRechercheAxion, estRechercheAxion } from "./extraits-maison/recherche";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";

/**
 * Ce que la règle lit du projet gardé (le `ProjetGardeV4` y satisfait, tous ses autres champs passent tels quels).
 * Forme locale : un test voisin interdit à tout autre fichier de `src/` de citer le fichier de lecture du projet gardé.
 */
export interface ProjetExtraitV4 {
  plan: PlanFacecamAnimee;
  videos?: { fichiers: FichierVideoV4[]; choix?: unknown[] };
}

/** Nom de l'entrée que R4-03-c lira (ce n'est PAS une clé de réglage). */
export const CLE_ENTREE_RETOUCHE_EXTRAIT_V4 = "retoucheExtraitV4";

/** Identifiant de la plaquette téléphone (recopié du service du téléphone, jamais importé). */
const ID_TELEPHONE = "telephone-video";
const TOLERANCE_DUREE_SEC = 0.05;

export type DemandeExtraitV4 =
  | { action: "remplacer"; rang: number; recherche: string; sourceVideoId?: string }
  | { action: "retirer"; rang: number }
  | { action: "deplacer"; rang: number; debut: number; fin: number };

const rang = z.number().int().min(0);
const schemaDemande = z.union([
  z.object({ action: z.literal("remplacer"), rang, recherche: z.string().trim().min(1).max(54), sourceVideoId: z.string().min(1).optional() }).strict(),
  z.object({ action: z.literal("retirer"), rang }).strict(),
  z.object({ action: z.literal("deplacer"), rang, debut: z.number().finite().min(0), fin: z.number().finite().min(0) }).strict(),
]);

/** Lit une demande ; `null` si elle est inutilisable. Ne lève jamais. */
export function lireDemandeExtraitV4(x: unknown): DemandeExtraitV4 | null {
  try {
    const r = schemaDemande.safeParse(x);
    return r.success ? (r.data as DemandeExtraitV4) : null;
  } catch {
    return null;
  }
}

/** Même règle que R4-03-b2 : une recherche déjà préfixée `axion:` reste telle quelle. */
export function rechercheAxionDe(recherche: string): string {
  return estRechercheAxion(recherche) ? recherche.trim() : ecrireRechercheAxion([recherche]);
}

export interface ClipRetoucheV4 {
  nom: string;
  cle: string;
  choix: ChoixVideoV4;
}

export type CodeRefusExtraitV4 = "ARCHIVE_VIDE" | "AUCUN_EXTRAIT" | "ELEMENT_INTROUVABLE" | "HORS_DUREE" | "CHEVAUCHEMENT" | "NOM_PRIS";

export const MESSAGES_REFUS_EXTRAIT_V4: Record<CodeRefusExtraitV4, string> = {
  ARCHIVE_VIDE: "Votre archive n'a encore aucune vidéo utilisable : rien n'a changé.",
  AUCUN_EXTRAIT: "Aucun extrait de vos vidéos ne correspond à cette recherche : rien n'a changé.",
  ELEMENT_INTROUVABLE: "Ce téléphone n'existe plus dans cette version : rien n'a changé.",
  HORS_DUREE: "Cette place n'est pas possible dans la vidéo : rien n'a changé.",
  CHEVAUCHEMENT: "Cette place est déjà prise par un autre téléphone : rien n'a changé.",
  NOM_PRIS: "Cet extrait est déjà utilisé dans cette version : rien n'a changé.",
};

export type ResultatExtraitV4<P extends ProjetExtraitV4 = ProjetExtraitV4> = { projet: P } | { refus: { code: CodeRefusExtraitV4; message: string } } | { refus: { code: CodeRefusExtraitV4; message: string } };

const refus = (code: CodeRefusExtraitV4, message = MESSAGES_REFUS_EXTRAIT_V4[code]): { refus: { code: CodeRefusExtraitV4; message: string } } => ({ refus: { code, message } });

const PREFIXE_BROLL = "broll/";
const nomsDe = (e: ElementV4Plan): string[] => (e.medias ?? []).filter((m) => m.startsWith(PREFIXE_BROLL)).map((m) => m.slice(PREFIXE_BROLL.length));
const arrondi = (n: number) => Math.round(n * 1e6) / 1e6;
const fichierDuChoix = (c: unknown): unknown => (typeof c === "object" && c !== null ? (c as { fichier?: unknown }).fichier : undefined);

/** Retire des fichiers et des choix les noms que plus aucun élément ne cite. */
function nettoyerVideos(p: ProjetExtraitV4, noms: string[]): void {
  if (!p.videos || noms.length === 0) return;
  const cites = new Set((p.plan.elementsV4 ?? []).flatMap(nomsDe));
  const aOter = new Set(noms.filter((n) => !cites.has(n)));
  p.videos.fichiers = p.videos.fichiers.filter((f) => !aOter.has(f.nom));
  if (p.videos.choix) p.videos.choix = p.videos.choix.filter((c) => !aOter.has(String(fichierDuChoix(c))));
}

function appliquer<P extends ProjetExtraitV4>(entree: P, demande: DemandeExtraitV4, clip?: ClipRetoucheV4): ResultatExtraitV4<P> {
  const p = structuredClone(entree);
  const elements = p.plan.elementsV4 ?? [];
  const el = elements[demande.rang];
  if (!el || el.id !== ID_TELEPHONE) return refus("ELEMENT_INTROUVABLE");

  if (demande.action === "remplacer") {
    if (!clip) return refus("AUCUN_EXTRAIT", `Aucun extrait de vos vidéos ne correspond à « ${demande.recherche} » : rien n'a changé.`);
    const conforme = new RegExp(`^v4-${demande.rang}-r[1-9]\\d*\\.mp4$`).test(clip.nom);
    if (!conforme || (p.videos?.fichiers ?? []).some((f) => f.nom === clip.nom)) return refus("NOM_PRIS");
    const anciens = nomsDe(el);
    el.medias = [`${PREFIXE_BROLL}${clip.nom}`];
    el.recherches = [rechercheAxionDe(demande.recherche)];
    p.videos = p.videos ?? { fichiers: [] };
    p.videos.fichiers = [...p.videos.fichiers, { nom: clip.nom, cle: clip.cle }];
    // les anciens fichiers restent (un autre élément peut les citer) ; seul l'ancien choix de cet élément part
    const encoreCites = new Set(elements.flatMap(nomsDe));
    const choixAOter = new Set(anciens.filter((n) => !encoreCites.has(n)));
    p.videos.choix = [...(p.videos.choix ?? []).filter((c) => !choixAOter.has(String(fichierDuChoix(c)))), clip.choix];
  } else if (demande.action === "retirer") {
    const noms = nomsDe(el);
    p.plan.elementsV4 = elements.filter((_, i) => i !== demande.rang);
    nettoyerVideos(p, noms);
  } else {
    const { debut, fin } = demande;
    if (debut < 0 || fin > p.plan.duree || fin <= debut || fin - debut > el.fin - el.debut + TOLERANCE_DUREE_SEC) return refus("HORS_DUREE");
    const pris = elements.some((o, i) => i !== demande.rang && o.id === ID_TELEPHONE && debut < o.fin && fin > o.debut);
    if (pris) return refus("CHEVAUCHEMENT");
    const ecart = debut - el.debut;
    el.debut = debut;
    el.fin = fin;
    if (el.instants) el.instants = el.instants.map((t) => arrondi(t + ecart));
    if (el.lignes) el.lignes = el.lignes.map((l) => ({ ...l, a: arrondi(l.a + ecart) }));
    delete el.motIndex; // absent = calage sur le mot le plus proche
  }

  if (!schemaPlanFacecamAnimee.safeParse(p.plan).success) return refus("HORS_DUREE");
  return { projet: p };
}

/** Applique la demande à une COPIE du projet gardé ; le projet d'entrée n'est jamais modifié. Ne lève jamais. */
export function appliquerDemandeExtraitV4<P extends ProjetExtraitV4>(projet: P, demande: DemandeExtraitV4, clip?: ClipRetoucheV4): ResultatExtraitV4<P> {
  try {
    return appliquer(projet, demande, clip);
  } catch {
    return refus("ELEMENT_INTROUVABLE");
  }
}
