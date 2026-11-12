/**
 * Liste « À publier » : état d'une vidéo, filtres, tri et tranches de 20. Pure mise en forme : aucune règle d'envoi ici
 * (le serveur garde toutes ses gardes).
 */
import type { Tonalite } from "@/domaine/libelles";
import type { CarteVideo } from "./regrouper-a-publier";

export type FiltreListe = "a-envoyer" | "envoyees" | "publiees" | "problemes" | "toutes";
export type CategorieEtat = "a-envoyer" | "envoyee" | "publiee" | "probleme";

export const FILTRES: { id: FiltreListe; libelle: string }[] = [
  { id: "a-envoyer", libelle: "À envoyer" },
  { id: "envoyees", libelle: "Envoyées" },
  { id: "publiees", libelle: "Publiées" },
  { id: "problemes", libelle: "Problèmes" },
  { id: "toutes", libelle: "Toutes" },
];

export const FILTRE_PAR_DEFAUT: FiltreListe = "a-envoyer";
export const TRANCHE = 20;
const MAX_AFFICHEES = 2000;

export interface EtatListe {
  categorie: CategorieEtat;
  /** À envoyer · Brouillon dans Buffer · Programmée · Publiée · Problème (ou Envoi en cours, Essai). */
  libelle: string;
  ton: Tonalite;
}

const PROBLEMES = new Set(["Échec", "À vérifier"]);
const ORDRE_ENVOYEES = ["Envoi en cours", "Programmée", "Brouillon dans Buffer", "Brouillon", "Essai"];

/** L'état d'UNE vidéo dans la liste, déduit de ce que la page savait déjà (états des réseaux). */
export function etatDeCarte(c: CarteVideo): EtatListe {
  if (c.pretes.some((l) => !l.etat || !l.etat.envoye)) return { categorie: "a-envoyer", libelle: "À envoyer", ton: "orange" };
  const etats = [...c.pretes.map((l) => l.etat), ...c.pasPretes.map((p) => p.etat)].filter((e): e is NonNullable<typeof e> => !!e);
  if (!etats.length || etats.some((e) => PROBLEMES.has(e.libelle))) return { categorie: "probleme", libelle: "Problème", ton: "brique" };
  if (etats.every((e) => e.libelle === "Publiée")) return { categorie: "publiee", libelle: "Publiée", ton: "sauge" };
  const reste = etats.filter((e) => e.libelle !== "Publiée");
  const choisi = [...reste].sort((a, b) => rangEnvoyee(a.libelle) - rangEnvoyee(b.libelle))[0];
  return { categorie: "envoyee", libelle: choisi.libelle, ton: choisi.ton };
}

function rangEnvoyee(libelle: string): number {
  const i = ORDRE_ENVOYEES.indexOf(libelle);
  return i < 0 ? ORDRE_ENVOYEES.length : i;
}

export interface LigneListe {
  carte: CarteVideo;
  etat: EtatListe;
}

const RANG: Record<CategorieEtat, number> = { "a-envoyer": 0, probleme: 1, envoyee: 2, publiee: 3 };

/** Tri par défaut : À envoyer d'abord, puis les plus récentes. */
export function trierListe(cartes: CarteVideo[]): LigneListe[] {
  return cartes
    .map((carte) => ({ carte, etat: etatDeCarte(carte) }))
    .sort((a, b) => RANG[a.etat.categorie] - RANG[b.etat.categorie] || b.carte.creeLe.localeCompare(a.carte.creeLe) || a.carte.videoId.localeCompare(b.carte.videoId));
}

export function filtrerListe(lignes: LigneListe[], filtre: FiltreListe): LigneListe[] {
  if (filtre === "toutes") return lignes;
  const voulue: CategorieEtat = filtre === "a-envoyer" ? "a-envoyer" : filtre === "envoyees" ? "envoyee" : filtre === "problemes" ? "probleme" : "publiee";
  return lignes.filter((l) => l.etat.categorie === voulue);
}

export interface Compteurs {
  aEnvoyer: number;
  envoyees: number;
  publiees: number;
  problemes: number;
  toutes: number;
}

export function compter(lignes: LigneListe[]): Compteurs {
  const n = (c: CategorieEtat) => lignes.filter((l) => l.etat.categorie === c).length;
  return { aEnvoyer: n("a-envoyer"), envoyees: n("envoyee"), publiees: n("publiee"), problemes: n("probleme"), toutes: lignes.length };
}

export function filtreDepuis(brut: string | undefined): FiltreListe {
  return FILTRES.some((f) => f.id === brut) ? (brut as FiltreListe) : FILTRE_PAR_DEFAUT;
}

/** Nombre de vidéos montrées : toujours un multiple de 20 (jamais toute la liste d'un coup). */
export function nombreAffichees(brut: string | undefined): number {
  const n = Number.parseInt(brut ?? "", 10);
  if (!Number.isFinite(n) || n < TRANCHE) return TRANCHE;
  return Math.min(Math.ceil(n / TRANCHE) * TRANCHE, MAX_AFFICHEES);
}

export function tranche<T>(lignes: T[], affichees: number): T[] {
  return lignes.slice(0, affichees);
}

/** Adresse de la liste, filtre gardé (le filtre par défaut n'est pas écrit). */
export function lienListe(filtre: FiltreListe, affichees = TRANCHE): string {
  const q = new URLSearchParams();
  if (filtre !== FILTRE_PAR_DEFAUT) q.set("filtre", filtre);
  if (affichees > TRANCHE) q.set("n", String(affichees));
  const s = q.toString();
  return s ? `/a-publier?${s}` : "/a-publier";
}

/** Adresse du détail d'une vidéo, avec le filtre pour y revenir. */
export function lienDetail(videoId: string, filtre: FiltreListe, affichees = TRANCHE): string {
  const q = new URLSearchParams();
  if (filtre !== FILTRE_PAR_DEFAUT) q.set("filtre", filtre);
  if (affichees > TRANCHE) q.set("n", String(affichees));
  const s = q.toString();
  return `/a-publier/${encodeURIComponent(videoId)}${s ? `?${s}` : ""}`;
}
