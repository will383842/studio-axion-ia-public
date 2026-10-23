/**
 * MON GOOGLE DRIVE (lot E2, plan facecam v4 L1 « Import depuis Google Drive ») — relie l'ébauche `preparerImportDrive`
 * (mes-images) : Will choisit une vidéo de SON Drive au lieu de l'envoyer depuis l'iPhone.
 * - Accès en LECTURE SEULE (`drive.readonly`), donné une fois dans Réglages › Mon Google Drive ; jetons chiffrés
 *   (AES-GCM) en base, jeton d'accès rafraîchi tout seul.
 * - Copie CÔTÉ SERVEUR, morceau par morceau (plage Google → morceau multipart R2), un morceau en mémoire à la fois,
 *   15 Go au plus ; chaque morceau reçu est noté : une coupure (réseau, redémarrage) reprend là où elle s'est arrêtée.
 * - Ensuite, EXACTEMENT le chemin d'un envoi depuis l'iPhone : `commencerEnvoi` / `terminerEnvoi` (contrôle de la
 *   taille réelle, plafond du format), puis l'écran range la prise (`enregistrerPriseAction`).
 * - Refus de Google → message clair et repli : « Reconnecter » ou « Envoyez depuis l'iPhone ».
 * Double de simulation par défaut (aucun appel à Google, voir `fournisseurs/google-drive`).
 */
import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { StockageFichiers } from "@/fournisseurs/types";
import { fournisseurDrive, RefusDrive, type FournisseurDrive, type JetonsDrive, type RaisonRefusDrive, type VideoDrive } from "@/fournisseurs/google-drive";
import { chiffrer, dechiffrer } from "@/lib/chiffrement-jeton";
import { decouper, morceauxRestants } from "@/lib/envoi-multipart";
import { nouvelId } from "@/lib/ids";
import { exigerSession } from "./auth";
import { creerVerrou, depots, ErreurStudio, fournisseur, journaliser, lireParametre, ecrireParametre, maintenant } from "./_commun";
import { commencerEnvoi, terminerEnvoi } from "./envois";

const P_CONNEXION = "googleDrive.connexion";
const P_ETAT_OAUTH = "googleDrive.etatConnexion";
const P_IMPORTS = "googleDrive.imports";
/** Plafond d'une vidéo copiée depuis le Drive (le format décide ensuite : 15 Go facecam, 4 Go ailleurs). */
export const TAILLE_MAX_DRIVE = 15 * 1024 * 1024 * 1024;
/** Imports gardés dans la liste (les plus récents). */
const IMPORTS_GARDES = 20;
const DUREE_ETAT_OAUTH_MS = 10 * 60_000;

/* ------------------------------------------------------------------ */
/* Connexion                                                            */
/* ------------------------------------------------------------------ */

interface ConnexionStockee {
  /** `JetonsDrive` chiffré. */
  jetons: string;
  compte: string;
  connecteLe: string;
  mode: "simulation" | "reel";
}

export interface VueDrive {
  relie: boolean;
  simulation: boolean;
  compte?: string;
  connecteLe?: string;
  /** Les jetons ne se lisent plus (clé changée) : il faut reconnecter. */
  aReconnecter?: boolean;
}

function drive(): FournisseurDrive {
  return fournisseurDrive();
}

function empreinte(texte: string): Buffer {
  return createHash("sha256").update(texte).digest();
}

export async function etatDrive(): Promise<VueDrive> {
  await exigerSession();
  const c = await lireParametre<ConnexionStockee | null>(P_CONNEXION, null);
  const simulation = drive().mode === "simulation";
  if (!c) return { relie: false, simulation };
  const lisible = dechiffrer(c.jetons) !== null;
  return { relie: lisible, simulation, compte: c.compte, connecteLe: c.connecteLe, ...(lisible ? {} : { aReconnecter: true }) };
}

/** Début de la connexion : adresse de la page Google, avec un jeton anti-falsification gardé 10 min. */
export async function lancerConnexionDrive(): Promise<{ adresse: string }> {
  await exigerSession();
  const etat = randomBytes(24).toString("base64url");
  await ecrireParametre(P_ETAT_OAUTH, { empreinte: empreinte(etat).toString("base64url"), expireLe: Date.now() + DUREE_ETAT_OAUTH_MS });
  return { adresse: drive().adresseConnexion(etat) };
}

/** Retour de Google (`/api/google-drive/retour`) : vérifie le jeton, échange le code, garde les jetons chiffrés. */
export async function terminerConnexionDrive(code: string, etat: string): Promise<VueDrive> {
  await exigerSession();
  const attendu = await lireParametre<{ empreinte: string; expireLe: number } | null>(P_ETAT_OAUTH, null);
  await ecrireParametre(P_ETAT_OAUTH, null); // usage unique
  const recu = empreinte(etat);
  const bon = attendu && attendu.expireLe > Date.now() && timingSafeEqual(Buffer.from(attendu.empreinte, "base64url"), recu);
  if (!bon) throw new ErreurStudio("DRIVE_LIEN", "Ce lien de connexion a expiré. Recommencez depuis Réglages › Mon Google Drive.");
  if (!code || code.length > 2000) throw new ErreurStudio("DRIVE_REFUS", "Google n'a pas donné l'accès.");
  const f = drive();
  let jetons: JetonsDrive;
  let compte = "";
  try {
    jetons = await f.echangerCode(code);
    compte = await f.compte(jetons.acces).catch(() => "");
  } catch (e) {
    throw versErreurStudio(e);
  }
  if (!jetons.rafraichissement) throw new ErreurStudio("DRIVE_REFUS", "Google n'a pas donné d'accès durable. Reconnectez le Drive.");
  await ecrireParametre(P_CONNEXION, { jetons: chiffrer(JSON.stringify(jetons)), compte, connecteLe: maintenant(), mode: f.mode } satisfies ConnexionStockee);
  await journaliser("connexion", `Google Drive relié en lecture seule${compte ? ` : ${compte}` : ""}`);
  return { relie: true, simulation: f.mode === "simulation", compte, connecteLe: maintenant() };
}

export async function deconnecterDrive(): Promise<void> {
  await exigerSession();
  const c = await lireParametre<ConnexionStockee | null>(P_CONNEXION, null);
  if (!c) return;
  const j = dechiffrer(c.jetons);
  if (j) await drive().revoquer((JSON.parse(j) as JetonsDrive).rafraichissement ?? (JSON.parse(j) as JetonsDrive).acces);
  await ecrireParametre(P_CONNEXION, null);
  await journaliser("connexion", "Google Drive déconnecté");
}

const verrouJetons = creerVerrou();

/** Jeton d'accès valable (rafraîchi s'il expire dans moins d'une minute, ou si `forcer`). */
async function accesValide(forcer = false): Promise<string> {
  return verrouJetons(async () => {
    const c = await lireParametre<ConnexionStockee | null>(P_CONNEXION, null);
    const clair = c ? dechiffrer(c.jetons) : null;
    if (!c || !clair) throw new RefusDrive("expire", "Le Drive n'est pas connecté.");
    const j = JSON.parse(clair) as JetonsDrive;
    if (!forcer && j.expireLe - 60_000 > Date.now()) return j.acces;
    if (!j.rafraichissement) throw new RefusDrive("expire", "Connexion au Drive expirée.");
    const neufs = await drive().rafraichir(j.rafraichissement);
    const garde: JetonsDrive = { ...neufs, rafraichissement: neufs.rafraichissement ?? j.rafraichissement };
    await ecrireParametre(P_CONNEXION, { ...c, jetons: chiffrer(JSON.stringify(garde)) } satisfies ConnexionStockee);
    return garde.acces;
  });
}

/** Un appel au Drive ; une connexion expirée est rafraîchie une fois puis l'appel refait. */
async function avecAcces<T>(f: (acces: string) => Promise<T>): Promise<T> {
  try {
    return await f(await accesValide());
  } catch (e) {
    if (!(e instanceof RefusDrive) || e.raison !== "expire") throw e;
    return f(await accesValide(true));
  }
}

/* ------------------------------------------------------------------ */
/* Messages de repli                                                    */
/* ------------------------------------------------------------------ */

export type ActionRepli = "reconnecter" | "iphone" | "reprendre";

export function repliDrive(raison: RaisonRefusDrive): { message: string; action: ActionRepli } {
  switch (raison) {
    case "expire":
      return { message: "Connexion au Drive expirée — Reconnecter.", action: "reconnecter" };
    case "refuse":
      return { message: "Google refuse l'accès à cette vidéo. Envoyez-la depuis l'iPhone.", action: "iphone" };
    case "introuvable":
      return { message: "Cette vidéo n'est plus dans le Drive. Envoyez-la depuis l'iPhone.", action: "iphone" };
    case "quota":
      return { message: "Google limite les copies pour l'instant. Reprenez dans une heure, ou envoyez depuis l'iPhone.", action: "reprendre" };
    case "reseau":
      return { message: "Coupure pendant la copie. Elle reprendra là où elle s'est arrêtée.", action: "reprendre" };
  }
}

function versErreurStudio(e: unknown): unknown {
  if (!(e instanceof RefusDrive)) return e;
  const r = repliDrive(e.raison);
  return new ErreurStudio(e.raison === "expire" ? "DRIVE_EXPIRE" : "DRIVE_REFUS", r.message);
}

/* ------------------------------------------------------------------ */
/* Sélecteur                                                            */
/* ------------------------------------------------------------------ */

export async function listerVideosDrive(o: { recherche?: string; suite?: string } = {}): Promise<{ videos: VideoDrive[]; suite?: string }> {
  await exigerSession();
  const recherche = typeof o.recherche === "string" ? o.recherche.slice(0, 100) : undefined;
  const suite = typeof o.suite === "string" && o.suite.length < 500 ? o.suite : undefined;
  try {
    return await avecAcces((a) => drive().listerVideos(a, { recherche, suite }));
  } catch (e) {
    throw versErreurStudio(e);
  }
}

/** Vignette d'une vidéo (route `/api/google-drive/vignette`) ; `null` : pas de vignette. */
export async function vignetteDrive(id: string): Promise<{ type: string; octets: Uint8Array } | null> {
  await exigerSession();
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) return null;
  return avecAcces((a) => drive().lireVignette(a, id)).catch(() => null);
}

/* ------------------------------------------------------------------ */
/* Copie Drive → stockage, par morceaux, avec reprise                    */
/* ------------------------------------------------------------------ */

export type StatutImportDrive = "en_attente" | "en_cours" | "en_pause" | "refuse" | "termine";

export interface ImportDrive {
  id: string;
  driveId: string;
  nom: string;
  mime: string;
  taille: number;
  dureeSec: number;
  typeEntite: string;
  entiteId: string;
  /** Envoi ouvert par `commencerEnvoi` (même chemin que l'iPhone). */
  fichierId: string;
  cle: string;
  idEnvoi?: string;
  tailleMorceau: number;
  /** Morceaux déjà déposés (numéro, étiquette du stockage). */
  faits: { numero: number; etag: string }[];
  octetsFaits: number;
  statut: StatutImportDrive;
  raison?: RaisonRefusDrive;
  message?: string;
  creeLe: string;
  modifieLe: string;
  termineLe?: string;
}

export interface VueImportDrive {
  id: string;
  nom: string;
  taille: number;
  dureeSec: number;
  octetsFaits: number;
  statut: StatutImportDrive;
  message?: string;
  action?: ActionRepli;
  /** Fichier prêt à ranger comme une prise envoyée depuis l'iPhone. */
  fichierId?: string;
}

export function vueImport(i: ImportDrive): VueImportDrive {
  const repli = i.raison && (i.statut === "refuse" || i.statut === "en_pause") ? repliDrive(i.raison) : null;
  return {
    id: i.id,
    nom: i.nom,
    taille: i.taille,
    dureeSec: i.dureeSec,
    octetsFaits: i.octetsFaits,
    statut: i.statut,
    ...(i.message ? { message: i.message } : repli ? { message: repli.message } : {}),
    ...(repli ? { action: repli.action } : {}),
    ...(i.statut === "termine" ? { fichierId: i.fichierId } : {}),
  };
}

const verrouImports = creerVerrou();

async function lireImports(): Promise<ImportDrive[]> {
  return (await lireParametre<ImportDrive[] | null>(P_IMPORTS, null)) ?? [];
}

async function ecrireImport(i: ImportDrive): Promise<void> {
  await verrouImports(async () => {
    const tous = (await lireImports()).filter((x) => x.id !== i.id);
    await ecrireParametre(P_IMPORTS, [{ ...i, modifieLe: maintenant() }, ...tous].slice(0, IMPORTS_GARDES));
  });
}

async function lireImport(id: string): Promise<ImportDrive | null> {
  return (await lireImports()).find((x) => x.id === id) ?? null;
}

export interface DependancesTransfert {
  drive: FournisseurDrive;
  acces: (forcer?: boolean) => Promise<string>;
  stockage: StockageFichiers;
  /** Dépôt d'un morceau à l'adresse signée (renvoie l'étiquette du stockage). */
  deposer?: (adresse: string, octets: Uint8Array) => Promise<string>;
  /** Noté après CHAQUE morceau : c'est ce qui permet la reprise. */
  enregistrer: (i: ImportDrive) => Promise<void>;
  /** Attentes entre deux essais d'un morceau (défaut 1 s, 3 s, 9 s). */
  essaisMs?: number[];
}

async function deposerHttp(adresse: string, octets: Uint8Array): Promise<string> {
  const r = await fetch(adresse, { method: "PUT", body: octets as BodyInit, signal: AbortSignal.timeout(5 * 60_000) });
  const etag = r.headers.get("etag");
  if (!r.ok || !etag) throw new RefusDrive("reseau", "Le stockage n'a pas reçu le morceau.");
  return etag;
}

const attendre = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/**
 * Cœur de la copie (pur, testé) : reprend les morceaux manquants d'après ce que le STOCKAGE dit avoir reçu (ou, sans
 * stockage réel, d'après les morceaux notés), lit chaque plage dans le Drive et la dépose. Sans stockage réel
 * (simulation), aucun octet n'est gardé (comme l'envoi depuis l'iPhone) : seule une sonde d'un octet par morceau est lue.
 * Renvoie l'import mis à jour (« en_cours » terminé côté morceaux, « en_pause » ou « refuse »).
 */
export async function transfererParMorceaux(depart: ImportDrive, dep: DependancesTransfert): Promise<ImportDrive> {
  const essais = dep.essaisMs ?? [1_000, 3_000, 9_000];
  const deposer = dep.deposer ?? deposerHttp;
  const multipart = dep.stockage.multipart;
  let i: ImportDrive = { ...depart, statut: "en_cours", raison: undefined, message: undefined };
  const tous = decouper(i.taille, i.tailleMorceau);
  const recus = multipart && i.idEnvoi ? await multipart.morceauxRecus(i.cle, i.idEnvoi) : i.faits.map((f) => ({ numero: f.numero, etag: f.etag }));
  const restants = morceauxRestants(tous, recus);
  const gardes = new Map<number, string>();
  for (const r of recus) if (!restants.some((m) => m.numero === r.numero)) gardes.set(r.numero, r.etag);
  const octetsDe = (numeros: Iterable<number>) => [...numeros].reduce((s, n) => s + (tous[n - 1] ? tous[n - 1].fin - tous[n - 1].debut : 0), 0);
  i = { ...i, faits: [...gardes].map(([numero, etag]) => ({ numero, etag })), octetsFaits: octetsDe(gardes.keys()) };
  await dep.enregistrer(i);

  let acces = await dep.acces();
  for (const m of restants) {
    let derniere: unknown = null;
    let etag: string | null = null;
    for (let essai = 0; essai <= essais.length && etag === null; essai++) {
      try {
        if (multipart && i.idEnvoi) {
          const octets = await dep.drive.lirePlage(acces, i.driveId, m.debut, m.fin);
          const adresse = (await multipart.signerMorceaux(i.cle, i.idEnvoi, [m.numero]))[m.numero];
          if (!adresse) throw new RefusDrive("reseau", "Adresse de dépôt absente.");
          etag = await deposer(adresse, octets);
        } else {
          await dep.drive.lirePlage(acces, i.driveId, m.debut, Math.min(m.fin, m.debut + 1));
          etag = `simulation-${m.numero}`;
        }
      } catch (e) {
        derniere = e;
        if (e instanceof RefusDrive && e.raison === "expire" && essai === 0) {
          try {
            acces = await dep.acces(true);
            continue;
          } catch (e2) {
            derniere = e2;
            break;
          }
        }
        if (e instanceof RefusDrive && e.raison !== "reseau") break;
        if (essai < essais.length) await attendre(essais[essai]);
      }
    }
    if (etag === null) {
      const raison: RaisonRefusDrive = derniere instanceof RefusDrive ? derniere.raison : "reseau";
      i = { ...i, statut: raison === "reseau" || raison === "quota" ? "en_pause" : "refuse", raison };
      await dep.enregistrer(i);
      return i;
    }
    gardes.set(m.numero, etag);
    i = { ...i, faits: [...i.faits.filter((f) => f.numero !== m.numero), { numero: m.numero, etag }].sort((a, b) => a.numero - b.numero), octetsFaits: octetsDe(gardes.keys()) };
    await dep.enregistrer(i);
  }
  return i;
}

/** Une seule copie à la fois sur le serveur (règle « un seul calcul lourd ») ; les autres attendent leur tour. */
const fileCopies = creerVerrou();
const cleActifs = Symbol.for("studio-axion-ia.drive-imports-actifs");
type AvecActifs = typeof globalThis & { [cleActifs]?: Map<string, Promise<ImportDrive>> };
function actifs(): Map<string, Promise<ImportDrive>> {
  const g = globalThis as AvecActifs;
  return (g[cleActifs] ??= new Map());
}

/** Lance (ou rattache) la copie d'un import dans ce processus. */
function demarrer(id: string, essaisMs?: number[]): Promise<ImportDrive> {
  const deja = actifs().get(id);
  if (deja) return deja;
  const travail = fileCopies(async () => {
    const i = await lireImport(id);
    if (!i) throw new ErreurStudio("INTROUVABLE", "Cette copie n'existe plus.");
    if (i.statut === "termine" || i.statut === "refuse") return i;
    const stockage = await fournisseur("stockage");
    const fin = await transfererParMorceaux(i, { drive: drive(), acces: accesValide, stockage, enregistrer: ecrireImport, essaisMs });
    if (fin.statut !== "en_cours") return fin;
    try {
      // Même fin qu'un envoi depuis l'iPhone : le stockage assemble, la taille réelle est contrôlée.
      const f = await terminerEnvoi({ nom: fin.nom, mime: fin.mime, taille: fin.taille, typeEntite: fin.typeEntite, entiteId: fin.entiteId, fichierId: fin.fichierId, cle: fin.cle, idEnvoi: fin.idEnvoi, morceaux: fin.faits });
      if (fin.dureeSec && !f.dureeSec) await depots().fichiers.modifier(f.id, { dureeSec: fin.dureeSec });
      const ok: ImportDrive = { ...fin, statut: "termine", termineLe: maintenant() };
      await ecrireImport(ok);
      await journaliser("fichier", `Vidéo copiée depuis Google Drive : ${fin.nom}`);
      return ok;
    } catch (e) {
      const message = e instanceof ErreurStudio ? e.message : "Le fichier reçu ne correspond pas. Envoyez-le depuis l'iPhone.";
      const ko: ImportDrive = { ...fin, statut: "refuse", raison: "refuse", message };
      await ecrireImport(ko);
      return ko;
    }
  }).catch(async (e: unknown) => {
    // Erreur imprévue (stockage injoignable…) : en pause, reprenable.
    console.error("[studio] copie Drive", e);
    const i = await lireImport(id);
    if (!i) throw e;
    const pause: ImportDrive = { ...i, statut: "en_pause", raison: "reseau" };
    await ecrireImport(pause);
    return pause;
  }).finally(() => actifs().delete(id));
  actifs().set(id, travail);
  return travail;
}

/**
 * « Copier depuis le Drive » : vérifie la vidéo (vidéo, 15 Go au plus), ouvre l'envoi PAR LE MÊME CHEMIN que l'iPhone
 * (`commencerEnvoi`, plafond du format compris) et lance la copie côté serveur. Répond tout de suite ; l'écran suit
 * avec `suivreImportDrive`.
 */
export async function importerDepuisDrive(demande: { driveId: string; typeEntite: string; entiteId: string }, o: { essaisMs?: number[] } = {}): Promise<VueImportDrive> {
  await exigerSession();
  if (typeof demande.driveId !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(demande.driveId)) throw new ErreurStudio("INTROUVABLE", "Vidéo inconnue.");
  const enCours = (await lireImports()).find((x) => x.driveId === demande.driveId && x.typeEntite === demande.typeEntite && x.entiteId === demande.entiteId && x.statut !== "refuse" && x.statut !== "termine");
  if (enCours) return suivreImportDrive(enCours.id, o);
  let v: VideoDrive;
  try {
    v = await avecAcces((a) => drive().infosVideo(a, demande.driveId));
  } catch (e) {
    throw versErreurStudio(e);
  }
  if (!v.mime.startsWith("video/")) throw new ErreurStudio("PAS_UNE_VIDEO", "Ce fichier n'est pas une vidéo.");
  if (!(v.taille > 0)) throw new ErreurStudio("TAILLE_INVALIDE", "Google ne donne pas la taille de cette vidéo. Envoyez-la depuis l'iPhone.");
  if (v.taille > TAILLE_MAX_DRIVE) throw new ErreurStudio("TAILLE_INVALIDE", "Cette vidéo dépasse 15 Go.");
  const nom = v.nom.length > 200 ? `${v.nom.slice(0, 190)}${/\.[A-Za-z0-9]{1,8}$/.exec(v.nom)?.[0] ?? ""}` : v.nom;
  const envoi = await commencerEnvoi({ nom, mime: v.mime, taille: v.taille, typeEntite: demande.typeEntite, entiteId: demande.entiteId });
  const m = maintenant();
  const i: ImportDrive = {
    id: nouvelId("drv"),
    driveId: v.id,
    nom,
    mime: v.mime,
    taille: v.taille,
    dureeSec: v.dureeSec,
    typeEntite: demande.typeEntite,
    entiteId: demande.entiteId,
    fichierId: envoi.fichierId,
    cle: envoi.cle,
    idEnvoi: envoi.idEnvoi,
    tailleMorceau: envoi.tailleMorceau,
    faits: [],
    octetsFaits: 0,
    statut: "en_attente",
    creeLe: m,
    modifieLe: m,
  };
  await ecrireImport(i);
  await journaliser("fichier", `Copie depuis Google Drive commencée : ${nom}`);
  void demarrer(i.id, o.essaisMs).catch(() => undefined);
  return vueImport(i);
}

/**
 * État d'une copie. Une copie « en cours » qui ne tourne plus dans ce processus (serveur redémarré) est RELANCÉE :
 * elle reprend au premier morceau manquant.
 */
export async function suivreImportDrive(id: string, o: { essaisMs?: number[] } = {}): Promise<VueImportDrive> {
  await exigerSession();
  const i = await lireImport(String(id));
  if (!i) throw new ErreurStudio("INTROUVABLE", "Cette copie n'existe plus.");
  if ((i.statut === "en_cours" || i.statut === "en_attente") && !actifs().has(i.id)) void demarrer(i.id, o.essaisMs).catch(() => undefined);
  return vueImport(i);
}

/** « Reprendre » après une coupure ou une reconnexion : repart du premier morceau manquant. */
export async function reprendreImportDrive(id: string, o: { essaisMs?: number[] } = {}): Promise<VueImportDrive> {
  await exigerSession();
  const i = await lireImport(String(id));
  if (!i) throw new ErreurStudio("INTROUVABLE", "Cette copie n'existe plus.");
  if (i.statut === "termine") return vueImport(i);
  if (i.statut === "refuse" && i.raison !== "expire") throw new ErreurStudio("DRIVE_REFUS", repliDrive(i.raison ?? "refuse").message);
  const relance: ImportDrive = { ...i, statut: "en_attente", raison: undefined, message: undefined };
  await ecrireImport(relance);
  void demarrer(i.id, o.essaisMs).catch(() => undefined);
  return vueImport(relance);
}

/** Attente de la fin d'une copie lancée dans ce processus (tests). */
export async function attendreImportDrive(id: string): Promise<VueImportDrive | null> {
  const t = actifs().get(id);
  if (t) await t.catch(() => undefined);
  const i = await lireImport(id);
  return i ? vueImport(i) : null;
}
