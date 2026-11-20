/**
 * ZERNIO (lot Z2-S) : client du serveur, test des comptes, synchronisation des états (toutes les 15 min, hors verrou).
 *
 * - La clé `ZERNIO_API_KEY` reste sur le serveur ; le client est celui de la liste fermée (`zernio-client.ts`).
 * - Synchronisation : brouillon / programmée / publiée / échec / partielle / annulée → états du Studio, avec le lien
 *   `platformPostUrl`. Un post introuvable depuis 30 minutes devient « À vérifier » : jamais renvoyé à l'aveugle.
 * - Rien n'est jamais effacé chez Zernio ; une publication change d'état, elle n'est jamais supprimée.
 */
import "server-only";
import { DELAI_ABSENCE_MS } from "@/domaine/buffer";
import { estRapatriee, type Publication, type StatutPublication, videoIdSure } from "@/domaine/types";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";
import { transitionPermise, type StatutVisuel } from "@/domaine/visuels/statuts";
import { reconcilier } from "./reconciliation-calendrier";
import { constateParLeDiffuseur, peutTransiter, type EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { transiterEnvoi } from "./envois-planifies";
import { cleDans } from "@/fournisseurs/mesures/commun";
import { creerClientZernio, type ClientZernio, type CompteZernio, type PlateformePostZernio, type PostZernio } from "@/fournisseurs/publication/zernio-client";
import { alertesJetonsZernio, compteSurveilleDepuisZernio } from "@/fournisseurs/publication/zernio-alertes-jetons";
import { estErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { phraseLisible } from "@/lib/erreur-lisible";
import { obtenirReseau } from "@/reseaux";
import { depsRapatriementServeur, rapatrierPostsZernio, type ResultatRapatriement } from "./rapatriement-zernio";
import { depots, ecrireParametre, ErreurStudio, journaliser, lireParametre, maintenant, sousVerrou, creerVerrou } from "./_commun";
import { exigerSession } from "./auth";
import { passerProgrammee } from "./buffer";
import { synchroniserEtats } from "./generateur";
import { creerNotification } from "./notifications";

export const VARIABLE_CLE_ZERNIO = "ZERNIO_API_KEY";
export const PARAM_COMPTES_ZERNIO = "zernio.comptes";
/** Interrupteur local « Tout arrêter » : à faux, toute écriture vers Zernio est refusée. Absent = envois permis. */
export const PARAM_ARRET_ZERNIO = "zernio.envoi_autorise";
/** L7-08 · interrupteur SÉPARÉ de l'envoi des publications du calendrier. FERMÉ par défaut (absent = fermé). Le parcours GUIDE ne le lit jamais. */
export const PARAM_ENVOI_CALENDRIER = "zernio.envoi_calendrier_autorise";

/** L7-08 · réglage ÉDITORIAL, séparé de `zernio.envoi_autorise` (que le parcours GUIDE lit). FAUX par défaut : absent = faux. Même nom que dans `promotion-envois.ts`. */
export const PARAM_EDITORIALE_ACTIVE = "publication.editoriale_active";

/** Jour (AAAA-MM-JJ, UTC) de la dernière alerte envoyée, par sujet : une alerte par sujet et par jour. */
export const PARAM_ALERTES_JETONS_ZERNIO = "zernio.alertes_jetons";

/** Verrou LOCAL (le verrou global est pris par `creerNotification`) : lecture, envoi et marque ne s'entrelacent pas. */
const verrouAlertes = creerVerrou();

/**
 * Alertes jetons / comptes déconnectés / quota : CLOCHE SEULEMENT (jamais de push ni d'e-mail), une par sujet et par jour.
 * `quotaRestantPct` : l'API lue aujourd'hui ne le donne pas (ESCALADE dans la PR) ; absent = pas d'alerte quota.
 */
export async function alerterJetonsZernio(comptes: readonly CompteZernio[], instant: number, quotaRestantPct?: number | null): Promise<number> {
  const alertes = alertesJetonsZernio({ comptes: comptes.map(compteSurveilleDepuisZernio), quotaRestantPct, maintenant: instant });
  const jour = new Date(instant).toISOString().slice(0, 10);
  return verrouAlertes(async () => {
    const lus = await lireParametre<Record<string, string>>(PARAM_ALERTES_JETONS_ZERNIO, {});
    // Purge : seules les marques du jour servent ; les autres (jours passés, comptes disparus) sont retirées.
    const etat: Record<string, string> = Object.fromEntries(Object.entries(lus).filter(([, j]) => j === jour));
    let envoyees = 0;
    for (const a of alertes.filter((x) => etat[x.sujet] !== jour)) {
      // Création d'abord, marque ensuite : si la création échoue, rien n'est marqué et l'alerte reviendra.
      await creerNotification({ type: "echec", titre: "Zernio : compte ou jeton à surveiller", message: a.message, lien: "/reglages" }, { cloche: true });
      etat[a.sujet] = jour;
      envoyees++;
      await ecrireParametre(PARAM_ALERTES_JETONS_ZERNIO, etat);
    }
    if (envoyees === 0 && Object.keys(etat).length !== Object.keys(lus).length) await ecrireParametre(PARAM_ALERTES_JETONS_ZERNIO, etat);
    return envoyees;
  });
}

export const INTERVALLE_SYNCHRO_ZERNIO_MS = 15 * 60_000;
/** L0-11 · écart toléré entre la date du Studio et celle du diffuseur : au-delà (strictement), la date du Studio fait foi. */
export const ECART_DATE_TOLERE_MS = 60_000;
const LECTURES_PAR_TOUR = 50;

/** Relu à CHAQUE requête (jamais mis en cache) : l'arrêt agit tout de suite. */
export async function envoiZernioAutorise(): Promise<boolean> {
  return (await lireParametre<boolean>(PARAM_ARRET_ZERNIO, true)) !== false;
}

/** Relu à chaque appel. Seul `true` ouvre : absent, faux ou toute autre valeur = fermé. */
export async function envoiCalendrierAutorise(): Promise<boolean> {
  return (await lireParametre<boolean>(PARAM_ENVOI_CALENDRIER, false)) === true;
}

/**
 * L5-06 · décision du pilote n° 2 : le suivi de l'ÉTAPE des visuels par la synchro (après un passage ET au rattrapage) est un
 * interrupteur NEUF, ÉTEINT par défaut. Éteint : la synchro n'écrit JAMAIS `visuels.statut`. Seul `true` allume. Relu à chaque passage.
 */
export async function synchroEtapeVisuelsActive(): Promise<boolean> {
  return (await lireParametre<boolean>("zernio.synchro_etape_visuels", false)) === true;
}

/** Envoi de publications (calendrier, promotion) : exige les DEUX réglages ouverts. Le GUIDE n'utilise pas cette porte. */
export async function envoiPublicationCalendrierAutorise(): Promise<boolean> {
  return (await envoiZernioAutorise()) && (await envoiCalendrierAutorise());
}

/** Relu à chaque appel. Seul `true` ouvre : absent, faux, autre valeur ou lecture impossible = fermé. */
export async function editorialeActive(): Promise<boolean> {
  try {
    return (await lireParametre<boolean>(PARAM_EDITORIALE_ACTIVE, false)) === true;
  } catch {
    return false;
  }
}

/** Phrases claires pour l'écran et le journal : l'état éteint est le défaut. */
export const PHRASE_EDITORIALE = {
  eteinte: "La publication éditoriale est éteinte : aucun brouillon ni envoi du calendrier ne part.",
  allumee: "La publication éditoriale est allumée : le calendrier peut créer des brouillons et les promouvoir, si les autres réglages d'envoi sont ouverts.",
} as const;

/** Création de brouillons et promotion du calendrier : exige les TROIS réglages ouverts (envoi général, calendrier, éditorial). Le GUIDE n'utilise pas cette porte. */
export async function publicationEditorialeAutorisee(): Promise<boolean> {
  return (await editorialeActive()) && (await envoiPublicationCalendrierAutorise().catch(() => false));
}

let clientInjecte: ClientZernio | null = null;
let clientCache: { cle: string; client: ClientZernio } | null = null;

/** Tests : remplace le client (null = retour au client réel). */
export function injecterClientZernio(client: ClientZernio | null): void {
  clientInjecte = client;
  clientCache = null;
}

/** La clé existe-t-elle sur le serveur ? (jamais sa valeur). */
export function cleZernioPresente(): boolean {
  return !!clientInjecte || !!cleDans(process.env, VARIABLE_CLE_ZERNIO);
}

/** Client Zernio du serveur. Sans clé : refus clair, aucun repli vers un autre outil. */
export function clientZernio(): ClientZernio {
  if (clientInjecte) return clientInjecte;
  const cle = cleDans(process.env, VARIABLE_CLE_ZERNIO);
  if (!cle) throw new ErreurStudio("ZERNIO_NON_RELIE", "Zernio n'est pas relié (clé absente) : l'envoi est refusé, aucun autre outil n'est utilisé à sa place.");
  if (clientCache?.cle !== cle) clientCache = { cle, client: creerClientZernio({ cle, envoiAutorise: envoiZernioAutorise }) };
  return clientCache.client;
}

/** Erreur Zernio → phrase française simple pour Will (le détail technique ne sort jamais). */
export function versErreurStudioZernio(e: unknown): ErreurStudio {
  if (e instanceof ErreurStudio) return e;
  if (estErreurZernio(e)) return new ErreurStudio(e.code === "acces" ? "ZERNIO_CLE" : "ZERNIO", e.message);
  return new ErreurStudio("ZERNIO", "Zernio n'a pas pu répondre : réessayez dans un instant.");
}

/* ------------------------------------------------------------------ */
/* Comptes                                                              */
/* ------------------------------------------------------------------ */

export interface ComptesZernioEnregistres {
  lusLe: string;
  /** `actif` : `isActive` lu chez le fournisseur ; absent = inconnu (enregistrements anciens). */
  comptes: { id: string; reseau: string; nom: string; actif?: boolean }[];
}

export async function comptesZernioEnregistres(): Promise<ComptesZernioEnregistres | null> {
  return lireParametre<ComptesZernioEnregistres | null>(PARAM_COMPTES_ZERNIO, null);
}

/** « Tester » (Réglages) : Zernio répond-il, et quels comptes y sont reliés ? RÉSEAU : jamais depuis un écran. */
export async function testerZernio(): Promise<{ message: string; comptes: number; etats: Record<string, boolean> }> {
  await exigerSession();
  let liste: CompteZernio[];
  try {
    liste = await clientZernio().listerComptes();
  } catch (e) {
    const erreur = versErreurStudioZernio(e);
    await journaliser("publication", `Zernio, lecture des comptes : ${erreur.message}`);
    throw erreur;
  }
  const comptes = liste.map((c) => ({ id: c._id, reseau: c.platform, nom: c.displayName ?? c.username ?? c.platform, ...(typeof c.isActive === "boolean" ? { actif: c.isActive } : {}) }));
  await ecrireParametre(PARAM_COMPTES_ZERNIO, { lusLe: maintenant(), comptes } satisfies ComptesZernioEnregistres);
  await journaliser("reglages", `Zernio testé : ${comptes.length} compte(s) relié(s)`);
  const reseaux = [...new Set(comptes.map((c) => c.reseau))].join(", ");
  return { comptes: comptes.length, etats: Object.fromEntries(liste.map((c) => [c._id, c.isActive !== false])), message: comptes.length ? `Le nouvel outil répond : ${reseaux}.` : "Le nouvel outil répond, mais aucun compte n'y est relié." };
}

/* ------------------------------------------------------------------ */
/* Correspondance des états                                             */
/* ------------------------------------------------------------------ */

export interface EtatLuZernio {
  statut: StatutPublication;
  lien?: string;
  erreur?: string;
  /** Statut Zernio « partial » sans verdict pour ce compte, ou « cancelled ». */
  note?: "partielle" | "annulee";
}

/** L0-11 · heure de Paris (jamais UTC) pour toute date montrée dans le Studio. */
const heureParis = (ms: number): string => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(ms).replace(",", " à");

const idCompte = (pf: PlateformePostZernio): string => (typeof pf.accountId === "string" ? pf.accountId : pf.accountId._id);

/** Statut d'un post (ou d'une plateforme) Zernio → statut du Studio. */
export function statutDepuisZernio(status: string | null | undefined): StatutPublication {
  switch (status) {
    case "published":
      return "publiee";
    case "scheduled":
    case "publishing":
      return "programmee";
    case "failed":
    case "partial":
    case "cancelled":
      return "echec";
    default: // draft, pending_approval, pending, inconnu : rien n'est parti
      return "brouillon";
  }
}

/** La cible du Studio (« compte », « compte:fb:page », « compte:li:n° ») commence par l'identifiant du compte Zernio. */
const compteDeCible = (canalId: string): string => canalId.split(":")[0];

/** État lu chez Zernio pour une publication : la plateforme du compte visé prime sur le statut global du post. */
export function etatDepuisPost(post: PostZernio, p: Pick<Publication, "canalId">): EtatLuZernio {
  const compte = p.canalId ? compteDeCible(p.canalId) : undefined;
  const pf = compte ? post.platforms.find((x) => idCompte(x) === compte) : post.platforms.length === 1 ? post.platforms[0] : undefined;
  const global = String(post.status);
  const lien = pf?.platformPostUrl || undefined;
  if (global === "cancelled") return { statut: "echec", note: "annulee", erreur: "Annulée chez Zernio." };
  if (pf?.status && ["published", "failed"].includes(pf.status)) {
    return { statut: statutDepuisZernio(pf.status), lien, ...(pf.status === "failed" ? { erreur: phraseLisible(pf.errorMessage) ? pf.errorMessage : "Zernio n'a pas pu publier." } : {}) };
  }
  if (global === "partial") return { statut: "echec", note: "partielle", erreur: "Publication partielle chez Zernio : voyez le détail dans Zernio." };
  return { statut: statutDepuisZernio(global), lien };
}

/* ------------------------------------------------------------------ */
/* Synchronisation (boucle de fond)                                     */
/* ------------------------------------------------------------------ */

const cleSynchro = Symbol.for("studio-axion-ia.synchro-zernio");
type AvecSynchro = typeof globalThis & { [cleSynchro]?: number };

async function ecrireSiInchange(p: Publication, modif: Partial<Publication>): Promise<boolean> {
  return sousVerrou(async () => {
    const actuelle = await depots().publications.obtenir(p.id);
    if (!actuelle || actuelle.modifieLe !== p.modifieLe) return false;
    await depots().publications.modifier(p.id, modif);
    return true;
  });
}

/** Préfixe des marques d'envoi du calendrier (recopié de `branchement-envoi-calendrier.ts`, qui importe ce module). */
export const PREFIXE_MARQUES_CALENDRIER = "envoi-calendrier:";

/**
 * Le créneau (statut final) ne passe « publie » que si, à sa version courante, CHAQUE réseau prévu (`heuresParReseau`) a un envoi vivant
 * (non annulé) et que tous ces envois sont « envoye » : un réseau sans envoi (texte manquant, trop tôt, exclu…) garde le créneau « programme ».
 * Un envoi d'une version périmée (décalé depuis) ne fait jamais publier la version courante.
 */
async function creneauToutParti(e: EnvoiPlanifie, creneau: CreneauEditorial | null | undefined): Promise<boolean> {
  if (!creneau || !e.creneauId) return false;
  const version = creneau.decalages ?? e.versionCreneau;
  if (e.versionCreneau !== version) return false;
  const freres = await depots().envoisPlanifies.lister((x) => x.creneauId === e.creneauId && x.versionCreneau === version && x.statut !== "annule");
  if (!freres.length || !freres.every((x) => x.statut === "envoye")) return false;
  const prevus = Object.keys(creneau.heuresParReseau ?? {}).filter((r) => (creneau.heuresParReseau as Record<string, string | undefined>)[r]);
  return prevus.every((r) => freres.some((x) => x.reseau === r));
}

/**
 * RETOUR-PUBLISHED · Zernio a CONFIRMÉ « published » pour cette Publication zernio : le Studio suit. On retrouve l'envoi planifié par sa clé
 * (`cleDiffuseur ?? cle` == `cleEnvoi`), puis : le VRAI créneau passe « publie » (via `reconcilier`), `pub_<clé>` passe « publiee »,
 * l'envoi passe « envoye » et les marques `promotion:<clé>` / `a-verifier:<clé>` (si elles existent) passent « parti ».
 * N'est appelée QUE sur un « published » confirmé ; un échec ou un statut ambigu ne lève rien (CAL-23 : jamais « annulé »).
 * Idempotent (chaque étape ne fait rien si elle est déjà faite) et sans appel au diffuseur. Un échec ici n'arrête jamais la synchro.
 */
async function suivrePublicationConfirmee(p: Publication): Promise<void> {
  if (!p.cleEnvoi) return;
  const d = depots();
  const envois = await d.envoisPlanifies.lister((e) => (e.cleDiffuseur ?? e.cle) === p.cleEnvoi);
  for (const e of envois) {
    await sousVerrou(async () => {
      // Une seule transition ouverte : « programme » → « envoye » ; tout autre état (annulé, brouillon, confirmé…) reste tel quel.
      let envoi = await d.envoisPlanifies.obtenir(e.id);
      if (envoi && envoi.statut !== "envoye" && peutTransiter(envoi.statut, "envoye")) envoi = await transiterEnvoi(d.envoisPlanifies, envoi.id, "envoye", maintenant());
      // RETOUR-PUBLISHED-2 (REC-V1) : seul cas où « valide » passe « envoye » : marque « a-verifier » ET Publication zernio de même clé relue « publiee » dans le dépôt.
      else if (envoi?.statut === "valide") {
        const confirmee = (await d.publications.lister((x) => x.via === "zernio" && x.statut === "publiee" && x.cleEnvoi === p.cleEnvoi)).length > 0;
        const promotion = await d.parametres.obtenir(`${PREFIXE_MARQUES_CALENDRIER}promotion:${e.cle}`);
        const verifier = await d.parametres.obtenir(`${PREFIXE_MARQUES_CALENDRIER}a-verifier:${e.cle}`);
        if (constateParLeDiffuseur(envoi, { promotion: promotion?.valeur, aVerifier: verifier?.valeur }, confirmee)) {
          envoi = await d.envoisPlanifies.modifier(envoi.id, { statut: "envoye", envoyeLe: maintenant(), modifieLe: maintenant() });
        }
      }
      // Tout autre état (annulé, valide, confirmé…) : rien n'est écrit, ni créneau, ni pub_<clé>, ni marques (même règle que la reprise).
      if (envoi?.statut !== "envoye") return;
      const creneau = e.creneauId ? await d.creneauxEditoriaux.obtenir(e.creneauId) : undefined;
      const pub = await d.publications.obtenir(`pub_${e.cle}`);
      const tousPartis = await creneauToutParti(e, creneau);
      const r = reconcilier({ diffuseur: "publie" }, {
        // Sans créneau réel, ou tant que des réseaux restent à partir : créneau fictif déjà « publie » (rien à changer de ce côté).
        creneau: creneau && tousPartis ? { id: creneau.id, statut: creneau.statut } : { id: "-", statut: "publie" },
        publication: { id: pub?.id ?? "-", statut: pub?.statut ?? "publiee" },
      });
      if (creneau && r.creneau) await d.creneauxEditoriaux.modifier(creneau.id, { statut: r.creneau.statut });
      if (pub && r.publication) await d.publications.modifier(pub.id, { statut: r.publication.statut, modifieLe: maintenant() });
      // Seules les marques qui disent « programmé » ou « à vérifier » sont levées ; « en-cours » (tentative en vol) et « libre » restent.
      // Lecture directe du dépôt (et non `lireParametre`) : ces marques ne sont pas des interrupteurs.
      for (const [nom, leve] of [["promotion", ["programme", "a-verifier"]], ["a-verifier", ["a-verifier"]]] as const) {
        const id = `${PREFIXE_MARQUES_CALENDRIER}${nom}:${e.cle}`;
        const m = await d.parametres.obtenir(id);
        if (m && (leve as readonly unknown[]).includes(m.valeur)) await d.parametres.enregistrer({ ...m, valeur: "parti", modifieLe: maintenant() });
      }
    });
  }
}

/**
 * RETOUR-PUBLISHED · reprise : une Publication zernio déjà « publiee » dont l'envoi planifié est resté « programme » (écriture interrompue
 * au passage précédent) est suivie à nouveau. Lecture des dépôts seule, 20 au plus par passage ; idempotent.
 */
async function reprendreRetoursPublies(): Promise<void> {
  const d = depots();
  // Envois restés « programme », ou déjà « envoye » dont le suivi (pub_<clé>, créneau, marques) n'est pas terminé : une coupure peut survenir entre deux écritures.
  const candidats = await d.envoisPlanifies.lister((e) => e.statut === "programme" || e.statut === "envoye" || e.statut === "valide");
  const restes: typeof candidats = [];
  for (const e of candidats) {
    if (e.statut === "programme") {
      restes.push(e);
      continue;
    }
    if (e.statut === "valide") {
      // RETOUR-PUBLISHED-2 : « valide » n'est un reste que s'il porte la marque « a-verifier » ; la Publication publiee est ensuite exigée par le suivi.
      const promotion = await d.parametres.obtenir(`${PREFIXE_MARQUES_CALENDRIER}promotion:${e.cle}`);
      const verifier = await d.parametres.obtenir(`${PREFIXE_MARQUES_CALENDRIER}a-verifier:${e.cle}`);
      if (promotion?.valeur === "a-verifier" || verifier?.valeur === "a-verifier") restes.push(e);
      continue;
    }
    const pub = await d.publications.obtenir(`pub_${e.cle}`);
    const creneau = e.creneauId ? await d.creneauxEditoriaux.obtenir(e.creneauId) : undefined;
    const marque = await d.parametres.obtenir(`${PREFIXE_MARQUES_CALENDRIER}promotion:${e.cle}`);
    const verifier = await d.parametres.obtenir(`${PREFIXE_MARQUES_CALENDRIER}a-verifier:${e.cle}`);
    // Le créneau « programme » n'est un reste que s'il peut vraiment passer « publie » (sinon il reste « programme » en permanence et saturerait la reprise).
    const creneauARattraper = creneau?.statut === "programme" && (await creneauToutParti(e, creneau));
    if ((pub && pub.statut === "programmee") || creneauARattraper || marque?.valeur === "programme" || marque?.valeur === "a-verifier" || verifier?.valeur === "a-verifier") restes.push(e);
  }
  if (!restes.length) return;
  const cles = new Set(restes.map((e) => e.cleDiffuseur ?? e.cle));
  const pubs = await d.publications.lister((p) => p.via === "zernio" && p.statut === "publiee" && !!p.cleEnvoi && cles.has(p.cleEnvoi));
  pubs.sort((x, y) => (x.etatLuLe ?? "").localeCompare(y.etatLuLe ?? "") || x.id.localeCompare(y.id));
  for (const p of pubs.slice(0, RATTRAPAGE_PAR_PASSAGE)) {
    try {
      await suivrePublicationConfirmee(p);
    } catch {
      await journaliser("publication", "Le calendrier n'a pas pu suivre une publication confirmée par Zernio : à vérifier.").catch(() => undefined);
    }
  }
}

/** L5-06 · plafond de sécurité du nombre de pages lues pour une liste de posts. */
export const PAGES_LISTE_MAX_ZERNIO = 50;
/** L5-06 · BUDGET d'UN passage, TOUTES requêtes comptées (lecture des comptes, pages de liste, lectures unitaires, échecs compris) : 51 au plus, sous le plafond de 60 par minute du client. */
export const BUDGET_REQUETES_PAR_PASSAGE = 51;
export const PAGES_LISTE_PAR_PASSAGE = 10;
export const LECTURES_UNITAIRES_PAR_PASSAGE_COMPLET = 40;
/** RAP-2 · requêtes de lecture du rapatriement par passage (comptées dans le budget de 51, qui ne change pas). */
export const BUDGET_RAPATRIEMENT_PAR_PASSAGE = 6;
/** RAP-2 · réglage `zernio.rapatriement_actif` (lu en littéral plus bas, pour l'inventaire) : absent = actif ; `false` = mesure seule, rien n'est créé. */
/** RAP-2 · mesure de l'écart calendrier / diffuseur (valeur lue par le bandeau ; ce n'est pas un interrupteur). */
export const PARAM_ECART_CALENDRIER = "zernio.ecart_calendrier";
const EXEMPLES_ECART_MAX = 10;
/** RAP-2 · la mesure inchangée est tout de même réécrite au-delà de ce délai, pour que « relu à HH:MM » reste vrai. */
const RAFRAICHISSEMENT_ECART_MS = 30 * 60_000;

export interface EcartCalendrier {
  luLe: string;
  /** Faux : la lecture chez le diffuseur n'a pas pu être menée à terme (budget, débit, panne) ; `absents` n'est alors qu'un minimum. */
  verifie: boolean;
  chezDiffuseur: number;
  absents: number;
  exemples: { postId6: string; reseau: string; jourParis: string; raison: string }[];
}

/** RAP-2 · écrit la mesure sous le verrou, seulement si elle change (ou si elle est devenue trop ancienne). Jamais bloquant. */
async function ecrireEcartCalendrier(valeur: EcartCalendrier): Promise<void> {
  await sousVerrou(async () => {
    const existant = await depots().parametres.obtenir(PARAM_ECART_CALENDRIER);
    const avant = existant?.valeur as EcartCalendrier | undefined;
    const sansHeure = (e?: EcartCalendrier) => JSON.stringify(e ? { ...e, luLe: "" } : null);
    const recent = !!avant && Date.parse(valeur.luLe) - Date.parse(avant.luLe) < RAFRAICHISSEMENT_ECART_MS;
    if (sansHeure(avant) === sansHeure(valeur) && recent) return;
    const m = maintenant();
    await depots().parametres.enregistrer({ id: PARAM_ECART_CALENDRIER, valeur, creeLe: existant?.creeLe ?? m, modifieLe: m });
  });
}

const ecartDepuis = (r: ResultatRapatriement, luLe: string): EcartCalendrier => ({
  luLe,
  verifie: r.lectureComplete,
  chezDiffuseur: r.lus,
  absents: r.absents.length,
  exemples: r.absents.slice(0, EXEMPLES_ECART_MAX).map((a) => ({ postId6: a.postId.slice(0, 6), reseau: a.reseau, jourParis: a.jour, raison: a.raison })),
});

/** L5-06 · nombre de visuels rattrapés au plus par passage. */
const RATTRAPAGE_PAR_PASSAGE = 20;

/** L5-06 · un post de liste n'est utilisable tel quel que s'il est complet (`lirePost` rejette les autres). */
const postDeListeComplet = (x: PostZernio | null | undefined): x is PostZernio => !!x && typeof x._id === "string" && typeof x.status === "string" && Array.isArray(x.platforms);

/**
 * L5-06 · LECTURE seule : lit TOUTES les pages d'une liste de posts (`page`, `limit`) par `listerPosts` du client (porte
 * unique : arrêt, filtre, débit). S'arrête à la première page incomplète, vide ou sans post nouveau, et au plafond de pages.
 */
export async function listerToutesLesPagesZernio(client: Pick<ClientZernio, "listerPosts">, query: Record<string, string | number | boolean> = {}, limite = 50, pagesMax = PAGES_LISTE_MAX_ZERNIO, sortie?: { posts: PostZernio[]; requetes: number }): Promise<PostZernio[]> {
  const tous: PostZernio[] = sortie?.posts ?? [];
  const vus = new Set<string>(tous.map((p) => p._id));
  for (let page = 1; page <= pagesMax; page++) {
    // `sortie` : posts déjà lus et requêtes faites (même si une page échoue), pour que l'appelant ne perde rien ni ne se trompe de compte.
    if (sortie) sortie.requetes++;
    const lus = await client.listerPosts({ ...query, page, limit: limite });
    const neufs = lus.filter((p) => !vus.has(p?._id));
    for (const p of neufs) vus.add(p?._id);
    tous.push(...neufs);
    if (lus.length < limite || neufs.length === 0) break;
  }
  return tous;
}

/**
 * L5-06 · RÈGLE UNIQUE (décision du pilote du 17/11/2026) : l'étape d'un visuel ne suit le diffuseur que sur l'ENSEMBLE de ses
 * publications actives chez le diffuseur, jamais sur une seule. Le résultat ne dépend donc pas de l'ordre des lectures.
 *  1. Une publication active ni programmée ni publiée (brouillon, envoi en cours ou à vérifier, échec), ou un réseau prévu au
 *     créneau qui n'a pas encore d'envoi actif : l'étape NE CHANGE PAS (« valide » : un autre réseau, un nouvel essai après un
 *     refus et la corbeille restent possibles ; la garde d'envoi n'est pas adaptée).
 *  2. Toutes programmées, ou programmées et publiées : « programme ». Toutes publiées : « publie ».
 *  3. TOUTES en échec : « echec_envoi ». Un échec partiel ne fait jamais bouger l'étape ; il reste visible sur la publication.
 * Jamais de mise à la corbeille par la synchro.
 */
type CibleVisuel = "programme" | "publie" | "echec_envoi";

/** Publication active chez le diffuseur : ni refusée ni absente (les refus nets permettent un nouvel essai). */
const publicationActive = (p: Publication): boolean => p.via === "zernio" && p.etatEnvoi !== "refuse" && p.etatEnvoi !== "absent";

/** Cible de l'étape d'un visuel d'après l'ENSEMBLE de ses publications actives (et des réseaux prévus au créneau). `undefined` = ne pas bouger. */
function cibleDuVisuel(actives: readonly Publication[], reseauxPrevus: ReadonlySet<string>): CibleVisuel | undefined {
  if (!actives.length) return undefined;
  for (const r of reseauxPrevus) if (!actives.some((p) => p.reseau === r)) return undefined; // un réseau prévu n'est pas encore envoyé
  if (actives.every((p) => p.statut === "echec")) return "echec_envoi";
  if (!actives.every((p) => p.statut === "programmee" || p.statut === "publiee")) return undefined;
  return actives.every((p) => p.statut === "publiee") ? "publie" : "programme";
}

/** Étape suivante du visuel pour cette cible, en enchaînant les pas permis (valide → programme → publie) ; `undefined` = inchangé. */
function etapeVisuel(courante: StatutVisuel, cible: CibleVisuel): StatutVisuel | undefined {
  let s = courante;
  if (cible === "programme") return s === "valide" && transitionPermise(s, "programme") ? "programme" : undefined;
  if (cible === "publie" && s === "valide" && transitionPermise(s, "programme")) s = "programme";
  // « publie » et « echec_envoi » : le pas passe par `reconcilier` (L5-05) ; une transition non permise est ignorée, jamais forcée.
  const vers = reconcilier({ diffuseur: cible === "publie" ? "publie" : "echec" }, { creneau: { id: "c", statut: "publie" }, publication: { id: "p", statut: "programmee" }, visuel: { id: "v", statut: s } }).visuel?.statut ?? s;
  return vers !== courante ? vers : undefined;
}

const RESEAUX_AVEC_VISUEL: readonly string[] = ["linkedin", "instagram", "facebook"];

/** Réseaux prévus au(x) créneau(x) vivant(s) du visuel. */
async function reseauxPrevusDuVisuel(visuelId: string): Promise<Set<string>> {
  const creneaux = await depots().creneauxEditoriaux.lister((c) => c.visuelId === visuelId && !c.refuseLe && !c.retireLe && (c.statut === "valide" || c.statut === "programme"));
  // Un réseau dont l'envoi a été refusé net par le diffuseur reste « prévu » : le nouvel essai doit rester possible.
  const refuses = await depots().publications.lister((p) => p.visuelId === visuelId && p.via === "zernio" && (p.etatEnvoi === "refuse" || p.etatEnvoi === "absent"));
  // Seuls les réseaux qui reçoivent un visuel comptent (un créneau peut porter d'autres réseaux, jamais envoyés par cette voie).
  return new Set([...creneaux.flatMap((c) => Object.entries(c.heuresParReseau).filter(([, h]) => !!h).map(([r]) => r)), ...refuses.map((p) => p.reseau)].filter((r) => RESEAUX_AVEC_VISUEL.includes(r)));
}

/**
 * L5-06 · l'étape du visuel suit le diffuseur, SOUS le verrou (comme tout changement de statut d'un visuel), en UNE écriture,
 * jamais pour un visuel à la corbeille. La cible est calculée sur l'état COURANT de toutes les publications du visuel.
 */
async function visuelSuitDiffuseur(visuelId: string): Promise<void> {
  await sousVerrou(async () => {
    const v = await depots().visuels.obtenir(visuelId);
    if (!v || v.corbeilleLe) return;
    const actives = await depots().publications.lister((p) => p.visuelId === visuelId && publicationActive(p));
    const cible = cibleDuVisuel(actives, await reseauxPrevusDuVisuel(visuelId));
    const vers = cible && etapeVisuel(v.statut, cible);
    if (vers) await depots().visuels.modifier(visuelId, { statut: vers });
  });
}

/** L5-06 · l'étape du visuel ne bloque jamais la synchronisation : l'échec est journalisé (rattaché au visuel), le rattrapage le reprendra. */
async function visuelSuitSansBloquer(visuelId: string | undefined): Promise<void> {
  if (!visuelId) return;
  try {
    await visuelSuitDiffuseur(visuelId);
  } catch {
    await journaliser("publication", "Le visuel n'a pas pu être mis à jour : il sera repris au prochain passage.", { type: "visuel", id: visuelId }).catch(() => undefined);
  }
}

/**
 * L5-06 · rattrapage BORNÉ : on choisit d'abord, par l'ÉTAT du visuel, ceux dont l'étape n'est pas celle que dit le diffuseur
 * (visuels « valide » ou « programme » qui ont des publications actives), puis on en reprend 20 au plus par passage
 * (les plus anciennement modifiés d'abord : aucun ne reste en queue).
 */
async function rattraperVisuels(): Promise<void> {
  const d = depots();
  const candidats = await d.visuels.lister((v) => !v.corbeilleLe && (v.statut === "valide" || v.statut === "programme"));
  if (!candidats.length) return;
  const ids = new Set(candidats.map((v) => v.id));
  const parVisuel = new Map<string, Publication[]>();
  for (const p of await d.publications.lister((p) => !!p.visuelId && ids.has(p.visuelId) && publicationActive(p))) (parVisuel.get(p.visuelId!) ?? parVisuel.set(p.visuelId!, []).get(p.visuelId!)!).push(p);
  const aRattraper: string[] = [];
  for (const v of candidats.sort((a, b) => a.modifieLe.localeCompare(b.modifieLe))) {
    const actives = parVisuel.get(v.id);
    if (!actives) continue;
    const cible = cibleDuVisuel(actives, await reseauxPrevusDuVisuel(v.id));
    if (cible && etapeVisuel(v.statut, cible)) aRattraper.push(v.id);
    if (aRattraper.length >= RATTRAPAGE_PAR_PASSAGE) break;
  }
  for (const id of aRattraper) await visuelSuitSansBloquer(id);
}

/**
 * Toutes les 15 minutes au plus : relit chez Zernio l'état des publications envoyées et pas encore publiées. Le réseau
 * se fait HORS verrou ; chaque écriture, sous le verrou, seulement si la publication n'a pas changé entre-temps.
 * Un post introuvable (404) depuis 30 minutes ou plus passe « À vérifier » ; avant, il est laissé tel quel.
 * L5-06 · passage COMPLET (option `complet`, ou automatique au-delà de 50 publications suivies) : relit d'abord les pages de
 * la liste du diffuseur (10 au plus, lecture seule) et n'interroge un post seul que s'il n'y figure pas (40 au plus) : 50
 * requêtes au plus par passage. Sinon, ou si la liste échoue, le passage reste celui de lectures unitaires par tour.
 * BUDGET : toutes requêtes comptées (comptes, pages, lectures, échecs), 51 au plus ; si la liste échoue en cours de route, les
 * pages déjà lues servent (aucun de leurs posts n'est relu seul) et le reste du budget va aux lectures unitaires.
 */
export async function synchroniserEtatsZernio(options: { force?: boolean; instant?: number; complet?: boolean } = {}): Promise<{ lues: number; changees: number }> {
  const instant = options.instant ?? Date.now();
  const g = globalThis as AvecSynchro;
  if (!options.force && g[cleSynchro] && instant - g[cleSynchro]! < INTERVALLE_SYNCHRO_ZERNIO_MS) return { lues: 0, changees: 0 };
  g[cleSynchro] = instant;
  if (!cleZernioPresente()) return { lues: 0, changees: 0 };
  const client = clientZernio();
  const d = depots();
  const r = { lues: 0, changees: 0 };
  let requetes = 0; // toutes les requêtes de ce passage (L5-06 : budget)
  // Passage périodique (15 min) : alertes jetons / comptes déconnectés. Jamais bloquant pour la synchronisation.
  requetes++;
  try {
    await alerterJetonsZernio(await client.listerComptes(), instant);
  } catch {
    /* lecture ou alerte impossible : on réessaiera au prochain passage */
  }
  // RAP-2 · rapatriement des posts du diffuseur absents du calendrier : lecture seule chez le diffuseur (6 requêtes au plus, décomptées du budget),
  // écriture seulement dans le Studio. Son échec n'arrête jamais la synchro ; les posts lus servent aux lectures du passage (jamais relus seuls).
  const deRapatriement = new Map<string, PostZernio>();
  {
    const budgetRap = { restant: BUDGET_RAPATRIEMENT_PAR_PASSAGE };
    const luLe = new Date(instant).toISOString();
    try {
      const actif = (await lireParametre<boolean>("zernio.rapatriement_actif", true)) !== false;
      const deps = await depsRapatriementServeur();
      const resultat = await rapatrierPostsZernio({ ...deps, client: { listerPosts: (q) => client.listerPosts(q) }, instant: () => luLe, budget: budgetRap }, { aBlanc: !actif });
      for (const x of resultat.posts) if (postDeListeComplet(x)) deRapatriement.set(x._id, x);
      await ecrireEcartCalendrier(ecartDepuis(resultat, luLe));
    } catch {
      // Lecture ou écriture locale impossible : la mesure est « non vérifiée », la synchro continue.
      try {
        const avant = (await d.parametres.obtenir(PARAM_ECART_CALENDRIER))?.valeur as EcartCalendrier | undefined;
        await ecrireEcartCalendrier({ chezDiffuseur: 0, absents: 0, exemples: [], ...avant, luLe, verifie: false });
      } catch {
        /* rien de plus à faire : on réessaiera au prochain passage */
      }
    }
    requetes += BUDGET_RAPATRIEMENT_PAR_PASSAGE - budgetRap.restant;
  }
  let suivies = (await d.publications.lister((p) => p.via === "zernio" && !!p.idExterne && !p.retireeLe && (p.statut === "brouillon" || p.statut === "programmee") && (p.etatEnvoi === undefined || p.etatEnvoi === "envoye" || p.etatEnvoi === "a-verifier")))
    .sort((a, b) => (a.etatLuLe ?? "").localeCompare(b.etatLuLe ?? ""));
  // L5-06 · liste complète (lecture seule) : un échec de lecture laisse le passage incrémental habituel.
  // Au-delà de 50 publications suivies (ou sur demande), le passage est complet : la boucle de fond en profite sans option.
  let dejaLus: Map<string, PostZernio> | null = null;
  let plafondUnitaires = LECTURES_PAR_TOUR;
  if (options.complet || suivies.length > LECTURES_PAR_TOUR) {
    const sortie = { posts: [] as PostZernio[], requetes: 0 };
    try {
      await listerToutesLesPagesZernio(client, {}, 50, PAGES_LISTE_PAR_PASSAGE, sortie);
      plafondUnitaires = LECTURES_UNITAIRES_PAR_PASSAGE_COMPLET;
    } catch {
      /* liste en échec : les pages déjà lues restent valables, le reste du budget va aux lectures unitaires */
    }
    requetes += sortie.requetes;
    // La liste n'est pas validée par le client : seuls les posts complets (_id et status chaînes, platforms tableau) servent ; les autres sont relus un à un (validés, comptés au budget).
    dejaLus = new Map(sortie.posts.filter(postDeListeComplet).map((x) => [x._id, x]));
  }
  let lecturesUnitaires = 0;
  if (!dejaLus) suivies = suivies.slice(0, LECTURES_PAR_TOUR);
  const lu = new Date(instant).toISOString();
  // L5-06 · l'étape des visuels est calculée UNE fois, après la boucle, sur l'état final du passage (jamais sur un état intermédiaire).
  const visuelsTouches = new Set<string>();
  for (const p of suivies) {
    const rapatriee = estRapatriee(p);
    const vid = rapatriee ? undefined : videoIdSure(p);
    const entite = vid ? { type: "video", id: vid } : undefined;
    const lien = vid ? `/videos/${vid}` : "/calendrier";
    // Une rapatriée n'a pas de vidéo à suivre : ses notifications restent à la cloche (pas de rafale de push si le diffuseur supprime en masse).
    const optionsNotif = rapatriee ? { cloche: true } : undefined;
    let post: PostZernio;
    try {
      const deListe = dejaLus?.get(p.idExterne!) ?? deRapatriement.get(p.idExterne!);
      if (deListe) post = deListe;
      // Une rapatriée déjà « à vérifier » (supprimée chez le diffuseur) se contente des listes : aucune lecture unitaire, pour ne pas affamer les publications du Studio.
      else if (rapatriee && p.etatEnvoi === "a-verifier") continue;
      else if (lecturesUnitaires >= plafondUnitaires || requetes >= BUDGET_REQUETES_PAR_PASSAGE) continue;
      else {
        lecturesUnitaires++;
        requetes++;
        post = await client.lirePost(p.idExterne!);
      }
    } catch (e) {
      if (estErreurZernio(e) && e.code === "introuvable") {
        const depuis = Date.parse(p.envoiCommenceLe ?? p.creeLe);
        if (p.etatEnvoi === "a-verifier") {
          // Déjà « à vérifier » : on date seulement la lecture, pour qu'elle tourne dans la file au lieu de rester en tête des lectures unitaires.
          await ecrireSiInchange(p, { etatLuLe: lu });
        } else if (instant - depuis >= DELAI_ABSENCE_MS && (await ecrireSiInchange(p, { etatEnvoi: "a-verifier", erreur: "Introuvable chez Zernio : vérifiez dans Zernio avant de renvoyer.", etatLuLe: lu }))) {
          r.changees++;
          await journaliser("publication", `Zernio : envoi à vérifier (${obtenirReseau(p.reseau).nom})`, entite);
          await creerNotification({ type: "echec", titre: "Envoi vers Zernio à vérifier", message: `${obtenirReseau(p.reseau).nom} : Zernio ne retrouve pas la publication. Vérifiez dans Zernio avant de renvoyer.`, lien, estDemo: p.estDemo }, optionsNotif);
        }
      }
      continue; // muet, 5xx, débit : on relira plus tard, jamais de renvoi
    }
    let etat: EtatLuZernio;
    try {
      etat = etatDepuisPost(post, p);
    } catch {
      continue; // post illisible : on relira plus tard, le passage continue
    }
    r.lues++;
    const changement: Partial<Publication> = { etatLuLe: lu };
    if (etat.statut !== p.statut) changement.statut = etat.statut;
    if (etat.lien && etat.lien !== p.urlPubliee) changement.urlPubliee = etat.lien;
    if (etat.statut === "echec") changement.erreur = etat.erreur;
    if (etat.statut === "publiee" && p.erreur) changement.erreur = undefined;
    // L0-11 : la date du Studio fait foi, la synchro ne l'écrase jamais. Celle du diffuseur est rangée dans `dateExterne`.
    // RAP-2 : exception pour une rapatriée, née chez le diffuseur : sa date suit celle du diffuseur (décision du fondateur), sans cloche.
    let ecartDate: { studio: number; diffuseur: number } | null = null;
    let deplaceeChezLeDiffuseur: { avant: number; apres: number } | null = null;
    if (etat.statut === "programmee" || (rapatriee && etat.statut === "brouillon")) {
      const diffuseur = typeof post.scheduledFor === "string" ? Date.parse(post.scheduledFor) : NaN;
      const studio = Date.parse(p.date);
      if (rapatriee) {
        if (Number.isFinite(diffuseur) && !(Math.abs(diffuseur - studio) <= ECART_DATE_TOLERE_MS)) {
          changement.date = new Date(post.scheduledFor!).toISOString();
          if (Number.isFinite(studio)) deplaceeChezLeDiffuseur = { avant: studio, apres: diffuseur };
        }
      } else if (Number.isFinite(diffuseur)) {
        const ecarte = Number.isFinite(studio) && Math.abs(diffuseur - studio) > ECART_DATE_TOLERE_MS;
        if (ecarte && p.dateExterne !== post.scheduledFor) {
          changement.dateExterne = post.scheduledFor;
          ecartDate = { studio, diffuseur };
        } else if (!ecarte && Number.isFinite(studio) && p.dateExterne) changement.dateExterne = undefined; // écart résorbé
      }
    }
    if (!(await ecrireSiInchange(p, changement))) continue;
    const nom = obtenirReseau(p.reseau).nom;
    if (deplaceeChezLeDiffuseur) await journaliser("publication", `Déplacée chez le diffuseur : ${heureParis(deplaceeChezLeDiffuseur.avant)} → ${heureParis(deplaceeChezLeDiffuseur.apres)} (heure de Paris)`);
    if (ecartDate) {
      // Cloche seulement (jamais de push ni d'e-mail) : une fois par date relue chez le diffuseur.
      const phrase = `${nom} : la date du Studio (${heureParis(ecartDate.studio)}) est gardée ; le diffuseur indique ${heureParis(ecartDate.diffuseur)}. Corrigez-la dans le Studio ou chez le diffuseur.`;
      await journaliser("publication", phrase, entite);
      await creerNotification({ type: "echec", titre: "Date différente chez le diffuseur", message: phrase, lien, estDemo: p.estDemo }, { cloche: true });
    }
    if (etat.statut === p.statut) continue;
    r.changees++;
    if (etat.statut === "publiee") {
      if (vid) await d.videos.modifier(vid, { etapeEditoriale: "publiee" });
      if (p.visuelId) visuelsTouches.add(p.visuelId);
      if (p.varianteId) await synchroniserEtats(p.varianteId);
      await journaliser("publication", `Publiée par Zernio sur ${nom}`, entite);
      try {
        await suivrePublicationConfirmee(p);
      } catch {
        /* repris au prochain passage par `reprendreRetoursPublies` : la synchro continue */
      }
    } else if (etat.statut === "programmee") {
      if (vid) await passerProgrammee(vid);
      if (p.visuelId) visuelsTouches.add(p.visuelId);
      if (p.varianteId) await synchroniserEtats(p.varianteId);
    } else if (etat.statut === "echec") {
      const phrase = etat.note === "annulee" ? `Zernio a annulé la publication sur ${nom}.` : `Zernio n'a pas pu publier sur ${nom} : voyez la raison dans Zernio.`;
      console.warn(`[studio] Zernio, échec sur ${p.reseau} : ${etat.note ?? "échec"}`);
      await journaliser("publication", phrase, entite);
      if (p.visuelId) visuelsTouches.add(p.visuelId);
      await creerNotification({ type: "echec", titre: "Zernio n'a pas pu publier", message: phrase, lien, estDemo: p.estDemo }, optionsNotif);
    }
  }
  try {
    await reprendreRetoursPublies();
  } catch {
    /* lecture impossible : on réessaiera au prochain passage */
  }
  // Interrupteur éteint (défaut) : aucune écriture sur `visuels.statut`, ni après le passage ni au rattrapage (comportement de master).
  let suitLesVisuels = false;
  try {
    suitLesVisuels = await synchroEtapeVisuelsActive();
  } catch {
    /* lecture du réglage impossible : éteint */
  }
  if (!suitLesVisuels) return r;
  for (const id of visuelsTouches) await visuelSuitSansBloquer(id);
  try {
    await rattraperVisuels();
  } catch {
    await journaliser("publication", "Le rattrapage des visuels n'a pas pu être fait : il sera repris au prochain passage.").catch(() => undefined);
  }
  return r;
}
