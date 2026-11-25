/**
 * RÉSERVE DE TUTORIELS · les 7 maquettes de démo (plan PLAN-RESERVE-TUTORIELS-21-11, § 4.3, fiche RES-2).
 *
 * - `zipDeMaquetteDemo` : zip EN MÉMOIRE d'un dossier de `outils/maquettes-tableaux-de-bord/` (liste fermée : jamais un chemin
 *   venu de l'utilisateur), sans PROVENANCE.md.
 * - `fichierDeMaquetteDemo` : SANS session. Une seule fois, le zip devient un vrai fichier du stockage (origine « depot »,
 *   statut « pret », clé `studio/{env}/entree/tutoriel-reserve/…`), que la chaîne du tutoriel relit comme un dossier déposé.
 *
 * Aucun appel payant. Aucune donnée de client : ce sont nos propres maquettes. Le zip n'est jamais ouvert ici : il reste
 * soumis à `extraireZipSur` à la fabrication, comme tout dossier.
 */
import "server-only";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { ElementReserve } from "@/domaine/tutoriel-reserve";
import type { Fichier } from "@/domaine/types";
import type { StockageFichiers } from "@/fournisseurs/types";
import { creerZip } from "@/lib/zip";
import { nouvelId } from "@/lib/ids";
import { TAILLE_ZIP_MAX } from "@/moteurs/montage-tutoriel-outil/securite-entrees";
import { depots, ErreurStudio, fournisseur, horodatage } from "./_commun";
import { lireElementReserve, noterFichierDemoReserve } from "./tutoriel-reserve";

export interface MaquetteDemo {
  id: `demo-0${1 | 2 | 3 | 4 | 5 | 6 | 7}-${string}`;
  dossier: string;
  titre: string;
}

/** Les 7 maquettes de démo (liste FERMÉE). L'identifiant est `demo-` + le nom du dossier. */
export const MAQUETTES_DEMO: readonly MaquetteDemo[] = [
  { id: "demo-01-courriels", dossier: "01-courriels", titre: "Courriels" },
  { id: "demo-02-projets", dossier: "02-projets", titre: "Projets" },
  { id: "demo-03-accueil-24h", dossier: "03-accueil-24h", titre: "Accueil 24 h" },
  { id: "demo-04-clients", dossier: "04-clients", titre: "Clients" },
  { id: "demo-05-stocks", dossier: "05-stocks", titre: "Stocks" },
  { id: "demo-06-equipe", dossier: "06-equipe", titre: "Équipe" },
  { id: "demo-07-taches", dossier: "07-taches", titre: "Tâches" },
];

const RACINE_MAQUETTES = ["outils", "maquettes-tableaux-de-bord"] as const;
const RACINE_CHARTE = [...RACINE_MAQUETTES, "charte"] as const;
const FICHIER_EXCLU = "PROVENANCE.md";
const POLICE = "manrope-latin.woff2";
const LIEN_CHARTE_SOURCE = 'href="../charte/charte.css"';
const LIEN_CHARTE_ZIP = 'href="charte/charte.css"';
const POLICE_SOURCE = 'url("../../../src/app/polices/manrope-latin.woff2")';
const POLICE_ZIP = 'url("manrope-latin.woff2")';
/** Date fixe : le même dossier donne toujours les mêmes octets. */
const DATE_ZIP = new Date(2026, 0, 1, 0, 0, 0);
const VALIDITE_DEPOT_SEC = 600;
const MIME_ZIP = "application/zip";
export const ENTITE_RESERVE = "tutoriel-reserve";

export const PHRASE_STOCKAGE_NON_RELIE = "Le stockage des fichiers n'est pas relié : la maquette de démonstration ne peut pas être préparée.";

/** Nom de dossier de la liste fermée, ou null. */
function dossierConnu(dossier: unknown): string | null {
  return typeof dossier === "string" ? (MAQUETTES_DEMO.find((m) => m.dossier === dossier)?.dossier ?? null) : null;
}

/** Fichiers réguliers du premier niveau d'un dossier (jamais un sous-dossier ni un lien). */
async function lireDossierParDefaut(chemin: string): Promise<{ nom: string; donnees: Uint8Array }[]> {
  const entrees = await readdir(chemin, { withFileTypes: true });
  const fichiers = entrees.filter((e) => e.isFile()).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return Promise.all(fichiers.map(async (e) => ({ nom: e.name, donnees: new Uint8Array(await readFile(path.join(chemin, e.name))) })));
}

/** Un fichier régulier (jamais un lien symbolique ni un dossier), sinon erreur. */
async function lireFichierParDefaut(chemin: string): Promise<Buffer> {
  const st = await lstat(chemin);
  if (!st.isFile() || st.isSymbolicLink()) throw new Error("Pas un fichier régulier.");
  return readFile(chemin);
}

/**
 * Zip EN MÉMOIRE du dossier `outils/maquettes-tableaux-de-bord/<dossier>`. `dossier` hors de `MAQUETTES_DEMO` : refus (pas
 * de lecture, pas de « .. »). Premier niveau seulement, sans PROVENANCE.md.
 */
export async function zipDeMaquetteDemo(dossier: string, dep: { lireDossier?: (chemin: string) => Promise<{ nom: string; donnees: Uint8Array }[]>; lireFichier?: (chemin: string) => Promise<Buffer> } = {}): Promise<Uint8Array> {
  const connu = dossierConnu(dossier);
  if (!connu) throw new ErreurStudio("RESERVE_MAQUETTE", "Cette maquette de démonstration n'existe pas.");
  const chemin = path.join(process.cwd(), ...RACINE_MAQUETTES, connu);
  let lus: { nom: string; donnees: Uint8Array }[];
  try {
    lus = await (dep.lireDossier ?? lireDossierParDefaut)(chemin);
  } catch {
    throw new ErreurStudio("RESERVE_MAQUETTE", "Cette maquette de démonstration n'a pas pu être lue.");
  }
  const gardes = lus.filter((f) => f.nom !== FICHIER_EXCLU && f.nom.length > 0 && !/[\\/]/.test(f.nom) && f.nom !== "." && f.nom !== "..");
  if (gardes.length === 0) throw new ErreurStudio("RESERVE_MAQUETTE", "Cette maquette de démonstration est vide.");
  const sortie = gardes.map((f) => ({ nom: f.nom, donnees: f.donnees, date: DATE_ZIP }));

  // La garde refuse tout chemin qui sort du dossier : la charte et la police entrent DANS le zip (sous `charte/`), les
  // liens sont réécrits par remplacement littéral. Rien n'est ajouté sans ce remplacement ; charte ou police absente : refus.
  const index = sortie.find((f) => f.nom === "index.html");
  if (index) {
    const html = new TextDecoder("utf-8").decode(index.donnees);
    if (html.includes(LIEN_CHARTE_SOURCE)) {
      const lire = dep.lireFichier ?? lireFichierParDefaut;
      const racine = process.cwd();
      const lireOuNull = async (chemin: string): Promise<Uint8Array | null> => {
        try {
          return new Uint8Array(await lire(chemin));
        } catch {
          return null;
        }
      };
      // Deux fichiers, chemins constants : jamais un dossier entier.
      const css = { donnees: await lireOuNull(path.join(racine, ...RACINE_CHARTE, "charte.css")) };
      const police = { donnees: (await lireOuNull(path.join(racine, ...RACINE_CHARTE, POLICE))) ?? (await lireOuNull(path.join(racine, "src", "app", "polices", POLICE))) };
      if (!css.donnees || !police.donnees) throw new ErreurStudio("RESERVE_MAQUETTE", "La charte ou la police des maquettes de démonstration est introuvable.");
      const texteCss = new TextDecoder("utf-8").decode(css.donnees);
      if (!texteCss.includes(POLICE_SOURCE)) throw new ErreurStudio("RESERVE_MAQUETTE", "La charte des maquettes de démonstration n'a pas la forme attendue.");
      index.donnees = new TextEncoder().encode(html.split(LIEN_CHARTE_SOURCE).join(LIEN_CHARTE_ZIP));
      sortie.push({ nom: "charte/charte.css", donnees: new TextEncoder().encode(texteCss.split(POLICE_SOURCE).join(POLICE_ZIP)), date: DATE_ZIP });
      sortie.push({ nom: `charte/${POLICE}`, donnees: police.donnees, date: DATE_ZIP });
    }
  }
  return creerZip(sortie);
}

export interface DependancesMaquetteDemo {
  /** Relit l'élément (le dépôt d'un appel précédent y est noté). Défaut : le stockage de la réserve. */
  lireElement?: (id: string) => Promise<ElementReserve | null>;
  zip?: (dossier: string) => Promise<Uint8Array>;
  stockage?: () => Promise<StockageFichiers>;
  /** Envoi du zip entier à l'adresse signée (PUT). */
  televerser?: (adresse: string, octets: Uint8Array, mime: string) => Promise<void>;
  fichier?: (id: string) => Promise<Fichier | null>;
  enregistrer?: (f: Fichier) => Promise<Fichier>;
  /** Note le `fichierId` sur `source` de l'élément (sans changer son état). */
  noter?: (elementId: string, fichierId: string) => Promise<void>;
}

async function televerserParDefaut(adresse: string, octets: Uint8Array, mime: string): Promise<void> {
  const r = await fetch(adresse, { method: "PUT", headers: { "content-type": mime }, body: octets as unknown as BodyInit });
  if (!r.ok) throw new ErreurStudio("RESERVE_STOCKAGE", "La maquette de démonstration n'a pas pu être déposée au stockage.");
}

/** Ne touche que `source.fichierId` d'une maquette de démo : écriture protégée de la réserve (RES-1), état et passages intacts. */
async function noterParDefaut(elementId: string, fichierId: string): Promise<void> {
  await noterFichierDemoReserve(elementId, fichierId);
}

/** Un seul dépôt à la fois par élément (deux appels simultanés partagent le même travail). */
const enCours = new Map<string, Promise<{ fichierId: string }>>();

/**
 * SANS session. Rend `source.fichierId` s'il existe et que le Fichier est « pret » ; sinon fabrique le zip, le dépose au
 * stockage, enregistre le Fichier (origine « depot », statut « pret », même forme que `terminerEnvoi`) et le note sur l'élément.
 * Stockage sans dépôt signé (simulation) : `ErreurStudio("RESERVE_STOCKAGE")` ; rien n'est écrit.
 * Ne JAMAIS l'appeler sous `sousVerrou` ni `sousVerrouCredits` : elle prend le verrou de la réserve (note du fichier, RES-1) et fait des envois réseau longs.
 */
export async function fichierDeMaquetteDemo(e: ElementReserve, dep: DependancesMaquetteDemo = {}): Promise<{ fichierId: string }> {
  if (e.source.type !== "maquette-demo" || !dossierConnu(e.source.dossier)) throw new ErreurStudio("RESERVE_MAQUETTE", "Cet élément n'est pas une maquette de démonstration.");
  const enVol = enCours.get(e.id);
  if (enVol) return enVol;
  const travail = fabriquer(e, dep).finally(() => enCours.delete(e.id));
  enCours.set(e.id, travail);
  return travail;
}

async function fabriquer(e: ElementReserve, dep: DependancesMaquetteDemo): Promise<{ fichierId: string }> {
  const frais = (await (dep.lireElement ?? lireElementReserve)(e.id)) ?? e;
  const source = frais.source.type === "maquette-demo" ? frais.source : (e.source as Extract<ElementReserve["source"], { type: "maquette-demo" }>);
  const lire = dep.fichier ?? ((id: string) => depots().fichiers.obtenir(id));
  if (source.fichierId) {
    const existant = await lire(source.fichierId);
    if (existant && existant.statut === "pret" && existant.origine === "depot") return { fichierId: existant.id };
  }

  if (!dossierConnu(source.dossier)) throw new ErreurStudio("RESERVE_MAQUETTE", "Cet élément n'est pas une maquette de démonstration.");
  const octets = await (dep.zip ?? ((d: string) => zipDeMaquetteDemo(d)))(source.dossier);
  if (octets.length > TAILLE_ZIP_MAX) throw new ErreurStudio("RESERVE_MAQUETTE", "Cette maquette de démonstration est trop grosse.");
  const stockage = await (dep.stockage ?? (() => fournisseur("stockage")))();
  if (!stockage.urlDepotDuree) throw new ErreurStudio("RESERVE_STOCKAGE", PHRASE_STOCKAGE_NON_RELIE);

  const fichierId = nouvelId("f");
  const nom = `${source.dossier}.zip`;
  const { cleStockage } = await stockage.preparerDepot({ fichierId, nom, mime: MIME_ZIP, taille: octets.length, typeEntite: "entree", entiteId: ENTITE_RESERVE });
  const adresse = await stockage.urlDepotDuree(cleStockage, VALIDITE_DEPOT_SEC, MIME_ZIP);
  await (dep.televerser ?? televerserParDefaut)(adresse, octets, MIME_ZIP);
  const confirmation = await stockage.confirmerDepot(cleStockage);
  if (!confirmation.ok) throw new ErreurStudio("RESERVE_STOCKAGE", "La maquette de démonstration n'est pas arrivée au stockage.");
  if (confirmation.taille !== undefined && confirmation.taille !== octets.length) throw new ErreurStudio("RESERVE_STOCKAGE", "La maquette déposée ne correspond pas à celle envoyée.");
  const fichier: Fichier = { id: fichierId, cleStockage, nom, mime: MIME_ZIP, taille: octets.length, sha256: confirmation.sha256, origine: "depot", statut: "pret", ...horodatage() };
  await (dep.enregistrer ?? ((f: Fichier) => depots().fichiers.enregistrer(f)))(fichier);
  await (dep.noter ?? noterParDefaut)(e.id, fichierId);
  return { fichierId };
}
