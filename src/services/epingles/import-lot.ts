/**
 * Import en lot d'épingles Pinterest (PR 6). Dépendances injectées (dépôts, stockage, canaux, horloge) : aucun appel à Zernio ni à
 * Pinterest, jamais. Rien n'est publié sans la validation du fondateur : un lot naît « à valider » ; « Valider ce lot » vaut
 * validation datée du fondateur, créneau par créneau ; seul le tour du calendrier envoie ensuite (porte fermée à Pinterest tant
 * que le tour général n'est pas ouvert).
 */
import { createHash } from "node:crypto";
import type { Depot, LotEcritures } from "@/domaine/depots";
import { lireLotEpingles, type EpingleDuLot } from "@/domaine/epingles/format-lot";
import { EXTENSION_DE_MIME, lireEnteteImage, raisonsImageEpingle, type EnteteImage } from "@/domaine/epingles/image";
import { planifierEpingles, type CreneauOccupe, type Placement } from "@/domaine/epingles/planification";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";
import type { Publication } from "@/domaine/types";
import type { Visuel } from "@/domaine/visuels/visuel";
import { transitionPermise } from "@/domaine/visuels/statuts";
import type { CanalPublication } from "@/fournisseurs/types";
import { programmerVisuel, type DepotsPasserelle } from "@/services/plan-vers-publication";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";

export type StatutLigne = "pret" | "refusee" | "deja-la" | "attente-image";

export interface LigneRapport {
  numero: number;
  cle?: string;
  statut: StatutLigne;
  raisons: string[];
  tableauId?: string;
  placement?: Placement;
}

export interface RapportLot {
  /** Faux : le fichier est de mauvaise forme, rien n'est lu ni écrit. */
  ok: boolean;
  erreur?: string;
  empreinte: string;
  lignes: LigneRapport[];
  /** Images attendues (nom de fichier) pour les lignes « en attente d'image ». */
  imagesAttendues: string[];
  avertissements: string[];
  /** Contrôle « lus = créés + déjà là + refusés (+ en attente) ». */
  lus: number;
}

export interface ImageDeposee {
  cle: string;
  /** Premiers octets du fichier (type réel et dimensions). */
  debut: Uint8Array;
  taille: number;
  sha256: string;
}

export interface DepsLot {
  maintenant(): string;
  domaineSite(): Promise<string>;
  /** Canaux gardés au dernier « Tester » (zernio.canaux) : l'écran ne lit jamais Zernio. */
  canaux(): Promise<CanalPublication[]>;
  heuresCadence(): Promise<{ heures: string[]; ecartMinMinutes: number }>;
  image(nom: string): Promise<ImageDeposee | null>;
  /** Écriture groupée : tout ou rien. */
  appliquerLot(lot: LotEcritures): Promise<void>;
  verrou<T>(f: () => Promise<T>): Promise<T>;
  noterRapport?(cle: string, valeur: unknown): Promise<void>;
  depots: {
    visuels: Depot<Visuel>;
    creneaux: Depot<CreneauEditorial>;
    publications: Depot<Publication>;
    envoisPlanifies?: Depot<EnvoiPlanifie>;
    journal: DepotsPasserelle["journal"];
  };
}

export interface SaisieLot {
  json: string;
  /** Compte Pinterest (identifiant du compte, tel que dans `zernio.canaux`). */
  compte: string;
  jourDepart: string;
  /** Heures de CE lot ; absentes : celles de la cadence. */
  heures?: string[];
  joursExclus?: string[];
  alternerTableaux?: boolean;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const cleDeLEpingle = (e: EpingleDuLot): string => e.cle ?? `ep-${sha(`${e.titre}|${e.url}|${e.tableau}|${e.image}`).slice(0, 16)}`;
export const idVisuelEpingle = (cle: string): string => `vis_${cle}`;
export const idCreneauEpingle = (cle: string): string => `cre_${idVisuelEpingle(cle)}`;
const NOM_TABLEAU = (nomCanal: string) => nomCanal.split(" · ").slice(1).join(" · ").trim();

/** Tableaux publics du compte : { nom → identifiants }. Un canal n'existe que pour un tableau public. */
function tableauxDuCompte(canaux: CanalPublication[], compte: string): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const c of canaux) {
    if (c.service !== "pinterest" || c.deconnecte || !c.id.startsWith(`${compte}:pin:`)) continue;
    const nom = NOM_TABLEAU(c.nom).toLowerCase();
    m.set(nom, [...(m.get(nom) ?? []), c.id]);
  }
  return m;
}

/** ANALYSE à blanc (pure côté données : aucune écriture). */
export async function analyserLot(deps: DepsLot, s: SaisieLot): Promise<RapportLot> {
  const empreinte = sha(s.json).slice(0, 16);
  const domaine = await deps.domaineSite();
  const lu = lireLotEpingles(s.json, domaine);
  if (!lu.ok) return { ok: false, erreur: lu.erreur, empreinte, lignes: [], imagesAttendues: [], avertissements: [], lus: 0 };

  const canaux = await deps.canaux();
  const tableaux = tableauxDuCompte(canaux, s.compte);
  const visuels = await deps.depots.visuels.lister((v) => v.famille === "epingle" && !v.corbeilleLe);
  const creneaux = await deps.depots.creneaux.lister((c) => !(c.statut === "archive"));
  const vusCles = new Set<string>();
  const vusImages = new Map<string, string>(visuels.filter((v) => v.epingle).map((v) => [v.epingle!.image.sha256, v.epingle!.cle]));
  const vusLiens = new Set<string>();
  for (const v of visuels) {
    const c = creneaux.find((x) => x.visuelId === v.id);
    if (v.epingle && c) vusLiens.add(`${v.epingle.lien}|${c.compteCible}`);
  }
  const existants = new Set(visuels.map((v) => v.epingle?.cle).filter((x): x is string => !!x));

  const lignes: LigneRapport[] = [];
  const attendues: string[] = [];
  const pretes: { ligne: LigneRapport; e: EpingleDuLot }[] = [];
  for (const l of lu.lignes) {
    if (!l.epingle) { lignes.push({ numero: l.numero, statut: "refusee", raisons: l.erreurs }); continue; }
    const e = l.epingle;
    const cle = cleDeLEpingle(e);
    const ligne: LigneRapport = { numero: l.numero, cle, statut: "pret", raisons: [] };
    lignes.push(ligne);
    if (existants.has(cle)) { ligne.statut = "deja-la"; ligne.raisons.push("déjà importée"); continue; }
    if (vusCles.has(cle)) { ligne.statut = "refusee"; ligne.raisons.push("même clé qu'une ligne précédente du fichier"); continue; }
    vusCles.add(cle);
    const ids = tableaux.get(e.tableau.toLowerCase());
    if (!ids?.length) ligne.raisons.push(`tableau « ${e.tableau} » inconnu ou non public pour ce compte`);
    else if (ids.length > 1) ligne.raisons.push(`tableau « ${e.tableau} » ambigu (plusieurs tableaux de ce nom)`);
    else ligne.tableauId = ids[0];
    const img = await deps.image(e.image);
    if (!img) {
      if (!ligne.raisons.length) { ligne.statut = "attente-image"; ligne.raisons.push(`image « ${e.image} » pas encore déposée`); attendues.push(e.image); continue; }
    } else {
      const entete = lireEnteteImage(img.debut);
      ligne.raisons.push(...raisonsImageEpingle(entete, img.taille));
      const autre = vusImages.get(img.sha256);
      if (autre && autre !== cle) ligne.raisons.push("même image que celle d'une épingle déjà importée ou d'une ligne précédente");
      vusImages.set(img.sha256, vusImages.get(img.sha256) ?? cle);
    }
    const cleLien = ligne.tableauId ? `${e.url}|${ligne.tableauId}` : "";
    if (cleLien && vusLiens.has(cleLien)) ligne.raisons.push("même lien et même tableau déjà programmés");
    if (cleLien) vusLiens.add(cleLien);
    if (ligne.raisons.length) ligne.statut = "refusee";
    else pretes.push({ ligne, e });
  }

  // Planning des lignes prêtes seulement.
  const cadence = await deps.heuresCadence();
  const occupes: CreneauOccupe[] = [];
  for (const c of creneaux) {
    if (!c.heuresParReseau.pinterest || !c.compteCible.startsWith(`${s.compte}:pin:`) || c.statut === "echec") continue;
    const t = c.heuresParReseau.pinterest;
    occupes.push({ jour: c.jourVise, heure: heureParis(t) });
  }
  const plan = planifierEpingles({
    epingles: pretes.map(({ ligne }) => ({ cle: ligne.cle!, tableau: ligne.tableauId! })),
    jourDepart: s.jourDepart,
    heures: s.heures?.length ? s.heures : cadence.heures,
    joursExclus: s.joursExclus,
    alternerTableaux: s.alternerTableaux,
    occupes,
    maintenant: Date.parse(deps.maintenant()),
    ecartMinMinutes: cadence.ecartMinMinutes,
  });
  const parCle = new Map(plan.planning.map((p) => [p.cle, p]));
  for (const { ligne } of pretes) {
    const p = parCle.get(ligne.cle!);
    if (p) ligne.placement = p;
    else { ligne.statut = "refusee"; ligne.raisons.push("aucun créneau libre sur la période"); }
  }
  return { ok: true, empreinte, lignes, imagesAttendues: [...new Set(attendues)], avertissements: plan.avertissements, lus: lu.lignes.length };
}

function heureParis(instantIso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(instantIso));
}

export interface ResultatImport {
  rapport: RapportLot;
  crees: number;
  dejaLa: number;
  refusees: number;
  enAttente: number;
  creneauIds: string[];
}

/** « Créer N épingles au calendrier » : relit tout, puis écrit en UN seul `appliquerLot` (tout ou rien). */
export async function importerLot(deps: DepsLot, s: SaisieLot): Promise<ResultatImport> {
  return deps.verrou(async () => {
    const rapport = await analyserLot(deps, s);
    const vide = { rapport, crees: 0, dejaLa: 0, refusees: 0, enAttente: 0, creneauIds: [] as string[] };
    if (!rapport.ok) return vide;
    const lot: LotEcritures = { supprimer: [], enregistrer: [] };
    const lu = lireLotEpingles(s.json, await deps.domaineSite());
    if (!lu.ok) return vide;
    const maintenant = deps.maintenant();
    const creneauIds: string[] = [];
    for (const l of rapport.lignes) {
      if (l.statut !== "pret" || !l.placement || !l.tableauId || !l.cle) continue;
      const e = lu.lignes[l.numero - 1].epingle!;
      const img = (await deps.image(e.image))!;
      const entete = lireEnteteImage(img.debut) as EnteteImage;
      const visuelId = idVisuelEpingle(l.cle);
      const visuel: Visuel = {
        id: visuelId, famille: "epingle", titre: e.titre, entree: { type: "session" }, statut: "a_valider", modeTexte: "import", reseaux: ["pinterest"],
        versionSpec: 1, coutCentimes: 0, creeLe: maintenant, modifieLe: maintenant,
        epingle: { titre: e.titre, lien: e.url, texteAlternatif: e.texteAlternatif, contenuIA: e.contenuIA, cle: l.cle, image: { cle: img.cle, largeur: entete.largeur, hauteur: entete.hauteur, mime: entete.mime, sha256: img.sha256, taille: img.taille } },
      };
      const creneau: CreneauEditorial = {
        id: idCreneauEpingle(l.cle), jourVise: l.placement.jour, heuresParReseau: { pinterest: l.placement.instant }, compteCible: l.tableauId, visuelId,
        textes: { pinterest: { texte: e.description, premierCommentaire: "" } }, statut: "a_valider", decalages: 0, origine: "vous",
      };
      lot.enregistrer.push({ collection: "visuels", entite: visuel }, { collection: "creneauxEditoriaux", entite: creneau });
      creneauIds.push(creneau.id);
    }
    if (lot.enregistrer.length) await deps.appliquerLot(lot); // échec : rien d'écrit (tout ou rien)
    const compte = (st: StatutLigne) => rapport.lignes.filter((x) => x.statut === st).length;
    const res = { rapport, crees: creneauIds.length, dejaLa: compte("deja-la"), refusees: compte("refusee"), enAttente: compte("attente-image"), creneauIds };
    await deps.noterRapport?.(`import-epingles:${rapport.empreinte}`, { le: maintenant, lus: rapport.lus, crees: res.crees, dejaLa: res.dejaLa, refusees: res.refusees, enAttente: res.enAttente });
    return res;
  });
}

export interface ResultatValidation {
  valides: number;
  ignores: number;
  erreurs: { creneauId: string; raison: string }[];
  premier?: string;
  dernier?: string;
}

/** Les créneaux « à valider » d'un lot (pour la confirmation : nombre, première et dernière date). */
export async function resumeLot(deps: DepsLot, creneauIds: string[]): Promise<{ nombre: number; premier?: string; dernier?: string }> {
  const cs = (await Promise.all(creneauIds.map((id) => deps.depots.creneaux.obtenir(id)))).filter((c): c is CreneauEditorial => !!c && c.statut === "a_valider");
  const jours = cs.map((c) => c.jourVise).sort();
  return { nombre: cs.length, premier: jours[0], dernier: jours[jours.length - 1] };
}

/**
 * « Valider ce lot » : pour chaque créneau, sous verrou, visuel `a_valider → valide`, puis validation du fondateur et
 * `programmerVisuel` (même chemin que « programmer en un clic ») → Publication « manuel » programmée. Aucun appel Zernio.
 */
export async function validerLot(deps: DepsLot, creneauIds: string[], validerParLeFondateur: (d: DepotsPasserelle, id: string, le: string) => Promise<void>): Promise<ResultatValidation> {
  const sortie: ResultatValidation = { valides: 0, ignores: 0, erreurs: [] };
  const passerelle: DepotsPasserelle = {
    creneaux: deps.depots.creneaux as unknown as DepotsPasserelle["creneaux"],
    journal: deps.depots.journal,
    publications: deps.depots.publications,
    visuels: deps.depots.visuels,
    ...(deps.depots.envoisPlanifies ? { envoisPlanifies: deps.depots.envoisPlanifies } : {}),
  };
  const jours: string[] = [];
  for (const id of creneauIds) {
    try {
      await deps.verrou(async () => {
        const c = await deps.depots.creneaux.obtenir(id);
        if (!c || c.statut !== "a_valider" || !c.visuelId) { sortie.ignores++; return; }
        const v = await deps.depots.visuels.obtenir(c.visuelId);
        if (!v || v.famille !== "epingle" || v.statut !== "a_valider" || !transitionPermise("a_valider", "valide")) { sortie.ignores++; return; }
        const le = deps.maintenant();
        await deps.depots.visuels.enregistrer({ ...v, statut: "valide", valideLe: le, modifieLe: le });
        await validerParLeFondateur(passerelle, id, le);
        await programmerVisuel(passerelle, id, le);
        sortie.valides++;
        jours.push(c.jourVise);
      });
    } catch (e) {
      sortie.erreurs.push({ creneauId: id, raison: e instanceof Error ? e.message : "validation refusée" });
    }
  }
  jours.sort();
  sortie.premier = jours[0];
  sortie.dernier = jours[jours.length - 1];
  return sortie;
}

export { EXTENSION_DE_MIME };
