"use server";

/**
 * Import en lot d'épingles Pinterest (PR 6). Chaque action commence par `exigerSession()` : sans session, rien n'est lu.
 * Aucun appel à Zernio ni à Pinterest : un lot naît « à valider » ; « Valider ce lot » programme dans le Studio seulement,
 * et seul le tour du calendrier envoie ensuite.
 */
import { revalidatePath } from "next/cache";
import { validerParLeFondateur } from "@/components/visuels/BoutonProgrammerVisuel";
import { LOT_EPINGLES_OCTETS_MAX } from "@/domaine/epingles/format-lot";
import { EPINGLE_OCTETS_ENTETE } from "@/domaine/epingles/image";
import { CLE_REGLAGES_CADENCE, normaliserReglagesCadence } from "@/domaine/cadence/reglages";
import { BASE_PUBLIQUE } from "@/domaine/site-videos/contrat";
import { exigerSession } from "@/services/auth";
import { appliquerLot } from "@/donnees/memoire";
import { canauxZernioEnregistres } from "@/services/comptes-envoi-zernio";
import { depots, ecrireParametre, fournisseur, lireParametre, maintenant, sousVerrou } from "@/services/_commun";
import { commencerEnvoi } from "@/services/envois";
import { analyserLot, importerLot, validerLot, type DepsLot, type RapportLot, type ResultatImport, type ResultatValidation, type SaisieLot } from "@/services/epingles/import-lot";

export type EtatImport = { rapport?: RapportLot; resultat?: ResultatImport; validation?: ResultatValidation; erreur?: string };

async function deps(): Promise<DepsLot> {
  const d = depots();
  return {
    maintenant,
    domaineSite: async () => {
      const v = await lireParametre<unknown>("site.domaine", new URL(BASE_PUBLIQUE).host).catch(() => "");
      return typeof v === "string" ? v : "";
    },
    canaux: async () => (await canauxZernioEnregistres())?.canaux ?? [],
    heuresCadence: async () => {
      const c = normaliserReglagesCadence(await lireParametre<unknown>(CLE_REGLAGES_CADENCE, null)).reseaux.pinterest;
      return { heures: c.heures, ecartMinMinutes: c.ecartMinMinutes };
    },
    // Une image du lot : fichier déposé pour ce lot (type d'entité « epingle »), retrouvé par son nom, lu par son en-tête.
    image: async (nom) => {
      const [f] = (await d.fichiers.lister((x) => x.nom === nom && x.statut === "pret" && x.cleStockage.includes("/epingle/"))).sort((a, b) => b.creeLe.localeCompare(a.creeLe));
      if (!f || !f.sha256) return null;
      const stockage = await fournisseur("stockage");
      if (!stockage.lireDebut) return null;
      return { cle: f.cleStockage, debut: await stockage.lireDebut(f.cleStockage, EPINGLE_OCTETS_ENTETE), taille: f.taille, sha256: f.sha256 };
    },
    appliquerLot,
    verrou: sousVerrou,
    noterRapport: (cle, valeur) => ecrireParametre(cle, valeur),
    depots: { visuels: d.visuels, creneaux: d.creneauxEditoriaux as never, publications: d.publications, envoisPlanifies: d.envoisPlanifies, journal: d.journalDecalages },
  };
}

function lireSaisie(f: FormData): SaisieLot | string {
  const json = f.get("json");
  if (typeof json !== "string" || new TextEncoder().encode(json).length > LOT_EPINGLES_OCTETS_MAX) return "Le fichier est absent ou dépasse 1 Mo.";
  const compte = String(f.get("compte") ?? "").trim();
  const jourDepart = String(f.get("jourDepart") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(compte)) return "Choisissez le compte Pinterest.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jourDepart)) return "Choisissez le jour de départ.";
  const liste = (nom: string) => String(f.get(nom) ?? "").split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
  return { json, compte, jourDepart, heures: liste("heures").filter((h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h)), joursExclus: liste("joursExclus"), alternerTableaux: f.get("alterner") === "on" };
}

/** Étape 2 : analyse à blanc (rien n'est écrit). */
export async function analyserLotAction(_: EtatImport, f: FormData): Promise<EtatImport> {
  await exigerSession();
  const s = lireSaisie(f);
  if (typeof s === "string") return { erreur: s };
  return { rapport: await analyserLot(await deps(), s) };
}

/** Étape 3 : prépare le dépôt d'UNE image du lot (signature seulement ; les octets vont du navigateur au stockage). */
export async function preparerDepotImageAction(nom: string, mime: string, taille: number, empreinteLot: string): Promise<{ fichierId: string; cle: string; idEnvoi?: string; simulation: boolean; tailleMorceau: number }> {
  await exigerSession();
  return commencerEnvoi({ nom, mime, taille, typeEntite: "epingle", entiteId: `lot-${String(empreinteLot).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)}` });
}

/** Étape 4 : « Créer N épingles au calendrier » (un seul lot d'écritures). */
export async function importerLotAction(_: EtatImport, f: FormData): Promise<EtatImport> {
  await exigerSession();
  const s = lireSaisie(f);
  if (typeof s === "string") return { erreur: s };
  const resultat = await importerLot(await deps(), s);
  revalidatePath("/calendrier");
  return { rapport: resultat.rapport, resultat };
}

/** Étape 5 : « Valider ce lot ». Aucun appel Zernio. */
export async function validerLotAction(_: EtatImport, f: FormData): Promise<EtatImport> {
  await exigerSession();
  const ids = String(f.get("creneaux") ?? "").split(",").map((x) => x.trim()).filter((x) => /^cre_vis_[A-Za-z0-9_-]{1,100}$/.test(x)).slice(0, 500);
  if (!ids.length) return { erreur: "Aucun créneau à valider." };
  const validation = await validerLot(await deps(), ids, validerParLeFondateur);
  revalidatePath("/calendrier");
  return { validation };
}
