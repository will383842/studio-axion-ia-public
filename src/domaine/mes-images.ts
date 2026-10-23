/**
 * « MES IMAGES » — règles PURES (`MES-IMAGES-ORGANISATION.md`, lot A2).
 * Will dépose en vrac, le studio range ; Will ne fait que valider, un geste par image. Une image n'entre dans la
 * cascade des illustrations que PRÊTE : zones sensibles floutées (sur une COPIE), accord coché s'il faut un accord.
 * Rien n'est jamais supprimé : une image retirée est archivée ; un doublon n'est pas réimporté.
 */
import type { AnalyseImage } from "@/fournisseurs/types";
import type { CategorieMesImages, ConfidentialiteImage, ElementBibliotheque, Licence, ZoneSensible } from "./types";

export const CATEGORIES_MES_IMAGES: { id: CategorieMesImages; nom: string; exemples: string }[] = [
  { id: "bureau", nom: "Bureau et coulisses", exemples: "poste de travail, carnet, café, écran" },
  { id: "consoles", nom: "Consoles et tableaux de bord", exemples: "consoles livrées, graphiques, alertes" },
  { id: "interventions", nom: "Interventions et formations", exemples: "formation, conférence, atelier" },
  { id: "evenements", nom: "Événements et salons", exemples: "GOFAB, rencontres, stands" },
  { id: "clients", nom: "Clients et terrain", exemples: "ateliers, usines, bureaux de clients" },
  { id: "objets", nom: "Objets et documents", exemples: "contrats, factures, ordinateur, téléphone" },
  { id: "marque", nom: "Marque Axion", exemples: "logo, visuels, couvertures" },
];

export const nomCategorie = (c: CategorieMesImages | undefined) => CATEGORIES_MES_IMAGES.find((x) => x.id === c)?.nom ?? "À classer";

/** Licence par défaut d'une image de Will. */
export const LICENCE_MES_IMAGES: Licence = { type: "propriete", usageCommercial: true, reseaux: [], source: "Propriété Axion-IA" };

/** Libellés des zones sensibles (affichés sur l'image). */
export const LIBELLES_ZONES: Record<ZoneSensible["type"], string> = {
  nom: "Nom",
  email: "E-mail",
  numero: "Numéro",
  montant: "Montant",
  "logo-client": "Logo d'un client",
  visage: "Visage",
};

export type EtatMesImage = "a_verifier" | "prete";

/** Ce qui manque encore pour qu'une image soit prête (vide : elle peut l'être). */
export function manquesPourEtrePrete(e: Pick<ElementBibliotheque, "confidentialite" | "categorieImage">): string[] {
  const c = e.confidentialite;
  const manques: string[] = [];
  if (!c) return ["Contrôle de confidentialité"];
  if (c.zones.some((z) => !z.floutee)) manques.push("Zones à flouter");
  if (c.zones.some((z) => z.floutee) && !c.fichierFlouteId) manques.push("Copie floutée en préparation");
  if (c.accordTiers === false) manques.push("Accord de la personne visible");
  if (e.categorieImage === "clients" && !c.accordClient) manques.push("Accord du client");
  return manques;
}

/** Statut calculé (jamais « prête » sans validation de Will : `valideLe`). */
export function statutCalcule(e: Pick<ElementBibliotheque, "confidentialite" | "categorieImage" | "valideLe">): EtatMesImage {
  return e.valideLe && manquesPourEtrePrete(e).length === 0 ? "prete" : "a_verifier";
}

/** Pastilles d'une image (grille) : à vérifier (orange) / prête (vert), floutée, vidéo. */
export function pastillesMesImage(e: Pick<ElementBibliotheque, "confidentialite" | "type" | "qualiteImage" | "sourceSite">): { libelle: string; ton: "ambre" | "sauge" | "neutre" | "brique" }[] {
  const sortie: { libelle: string; ton: "ambre" | "sauge" | "neutre" | "brique" }[] = [];
  sortie.push(e.confidentialite?.statut === "prete" ? { libelle: "Prête", ton: "sauge" } : { libelle: "À vérifier", ton: "ambre" });
  if (e.sourceSite) sortie.push({ libelle: "Votre site", ton: "neutre" });
  if (e.confidentialite?.fichierFlouteId) sortie.push({ libelle: "Floutée", ton: "neutre" });
  if (e.type === "illustration-video") sortie.push({ libelle: "Vidéo", ton: "neutre" });
  if (e.qualiteImage && (!e.qualiteImage.nette || !e.qualiteImage.assezGrande)) sortie.push({ libelle: "Qualité faible", ton: "brique" });
  return sortie;
}

/** Contrôle de confidentialité à l'import : TOUJOURS « à vérifier » ; zones proposées au floutage. */
export function confidentialiteInitiale(a: Pick<AnalyseImage, "zones" | "visageTiers" | "categorie">): ConfidentialiteImage {
  return {
    statut: "a_verifier",
    zones: a.zones.map((z) => ({ ...z, floutee: false })),
    ...(a.visageTiers ? { accordTiers: false } : {}),
    ...(a.categorie === "clients" ? { accordClient: false } : {}),
  };
}

/** Mots-clés propres (minuscules, sans doublon, 20 au plus). */
export function motsClesPropres(m: string[] | undefined): string[] {
  return Array.from(new Set((m ?? []).map((x) => String(x).trim().toLowerCase()).filter(Boolean))).slice(0, 20);
}

/** Correction de Will (validation en série) : catégorie, mots-clés, accords, zones à flouter. */
export interface ValidationMesImage {
  categorie?: CategorieMesImages;
  motsCles?: string[];
  /** Zones retenues pour le floutage (index dans la liste proposée) ; absent : toutes. */
  zonesAFlouter?: number[];
  accordTiers?: boolean;
  accordClient?: boolean;
}

/**
 * « OK » d'une image : les zones choisies sont marquées floutées (la copie est fabriquée à part), les accords
 * enregistrés ; le statut devient « prête » seulement si plus rien ne manque. PUR : renvoie le correctif à écrire.
 */
export function appliquerValidation(
  e: Pick<ElementBibliotheque, "confidentialite" | "categorieImage" | "motsCles">,
  v: ValidationMesImage,
  maintenant: string,
  fichierFlouteId?: string,
): Pick<ElementBibliotheque, "confidentialite" | "categorieImage" | "motsCles" | "valideLe"> {
  const avant = e.confidentialite ?? { statut: "a_verifier" as const, zones: [] };
  const choisies = v.zonesAFlouter ? new Set(v.zonesAFlouter) : null;
  // Une zone NON retenue par Will est gardée dans l'historique mais n'est plus à flouter : on la retire de la liste active.
  const zones = avant.zones.filter((_, i) => !choisies || choisies.has(i)).map((z) => ({ ...z, floutee: true }));
  const categorieImage = v.categorie ?? e.categorieImage;
  const confidentialite: ConfidentialiteImage = {
    ...avant,
    zones,
    fichierFlouteId: zones.length ? (fichierFlouteId ?? avant.fichierFlouteId) : avant.fichierFlouteId,
    ...(v.accordTiers !== undefined ? { accordTiers: v.accordTiers } : {}),
    ...(v.accordClient !== undefined ? { accordClient: v.accordClient } : {}),
    statut: "a_verifier",
  };
  const valideLe = maintenant;
  confidentialite.statut = statutCalcule({ confidentialite, categorieImage, valideLe });
  return { confidentialite, categorieImage, motsCles: v.motsCles ? motsClesPropres(v.motsCles) : e.motsCles, valideLe };
}

/** Doublon : même empreinte qu'une image déjà importée (archivée comprise). */
export function estDoublon(empreinte: string | undefined, existants: Pick<ElementBibliotheque, "empreinte">[]): boolean {
  return !!empreinte && existants.some((x) => x.empreinte === empreinte);
}

/** Recherche : nom, description, mots-clés FR / EN, catégorie. */
export function correspondRecherche(e: Pick<ElementBibliotheque, "nom" | "description" | "motsCles" | "motsClesEn" | "categorieImage">, q: string): boolean {
  const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const cible = n([e.nom, e.description ?? "", ...e.motsCles, ...(e.motsClesEn ?? []), nomCategorie(e.categorieImage)].join(" "));
  return n(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((m) => cible.includes(m));
}

/** Nom lisible tiré du nom de fichier (« IMG_2034-bureau.jpg » → « Img 2034 bureau »). */
export function nomDepuisFichier(nom: string): string {
  const base = nom.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || "Image";
  return (base.charAt(0).toUpperCase() + base.slice(1)).slice(0, 80);
}
