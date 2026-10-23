/**
 * BOUCLE DE FOND (lot M1b, B.9 ter) — une fabrication avance SANS visiteur, dans le processus du studio
 * (celui qui tient les données : les dépôts gardent une copie en mémoire, un second processus ne la verrait pas).
 *
 * - `demarrerBoucle()` : lancée par `instrumentation.ts` après la préparation de la base, UNE fois par processus
 *   (`globalThis`), minuterie de 5 s, premier tour immédiat (reprise après un redémarrage : les travaux en cours
 *   sont relus en base et interrogés à nouveau).
 * - Sans empilement : un tour qui n'est pas fini fait SAUTER le suivant (drapeau « en cours », aucune mise en file).
 * - Aucun appel réseau sous le verrou : lecture sous le verrou, `moteur.avancer` hors verrou avec délai maximal
 *   (30 s ; 90 s tant que la voix n'est pas faite : synthèse d'un texte entier), réécriture sous le verrou seulement
 *   si le travail n'a pas changé entre-temps (« Arrêter » pendant un tour : l'état annulé reste).
 * - Reprise automatique : 3 essais espacés, puis « en attente du fournisseur » (10 min), échec après 24 h.
 * - Notifications (téléphone, e-mail) envoyées en fin de tour, hors verrou.
 * - Buffer (lot R1) : états des publications relus toutes les 15 minutes au plus, hors verrou (`services/buffer.ts`).
 *   Audit D, B9 : cette lecture (jusqu'à 50 lectures de 30 s) part HORS du tour, une seule à la fois ; le tour ne l'attend pas.
 * - Audit D, B9 : délai global par tour (`DELAI_TOUR_MS`) ; au-delà, le tour est abandonné (ce qui reste finit en
 *   arrière-plan : un travail encore en cours n'est jamais relancé tant qu'il est « en vol »), et la boucle repart.
 *   `/api/sante` répond 503 si aucun tour ne s'est terminé depuis 3 min (`services/sante.ts`).
 * - Audit D (un seul réplica) : `demarrerBoucleUnique` prend d'abord un verrou consultatif Postgres ; une seconde
 *   instance du studio ne fait PAS tourner la boucle (nouvel essai toutes les 30 s).
 * - Tableau animé (12/10) : l'écriture du script et le découpage en scènes sont des TÂCHES DE FOND enregistrées dans le
 *   brouillon (`services/tableau-taches.ts`) ; chaque tour lance leur traitement HORS du tour (tâche annexe, une seule
 *   à la fois, jamais attendue) : aucune requête de l'écran n'attend un appel à Claude.
 * - Crédits (lot « crédits », 02/10) : surveillance au plus une fois par minute (alertes 50 / 25 / 10 %, rapprochement
 *   quotidien des soldes lus, expiration fal.ai, brouillons « dès que possible » prêts) ; la reprise d'une vidéo
 *   « en attente de crédit » se fait par `services/credits.ts` dès la recharge (déclarée ou lue).
 */
import "server-only";
import type { CommandeFabrication, LigneCout, Travail } from "@/domaine/types";
import { idFournisseur } from "@/domaine/credits";
import { CENTIMES_USD_PAR_CARACTERE_HEYGEN } from "@/fournisseurs/heygen/voix";
import { additionner, centimes, TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { nouvelId } from "@/lib/ids";
import { cleEtapeDeLigne } from "@/moteurs/couts-etapes";
import type { MoteurVideo } from "@/moteurs";
import { etatBoucle } from "./_boucle-etat";
import { prendreVerrouBoucle } from "@/donnees/memoire";
import { depots, ecrireParametre, horodatage, journaliser, lireParametre, maintenant, sousVerrou } from "./_commun";
import { ligneSimulee } from "./couts";
import { surveillerCredits } from "./credits";
import { synchroniserEtatsBuffer } from "./buffer";
import { diffuserNotifications } from "./notifications";
// Facecam lot E : raccords de la chaîne vidéo (agent monteur, Décor IA, relecture), posés au chargement.
import "./facecam-branchements";
import "./avocat-branchements";
import "./tableau-branchements";
import "./cas-concret-branchements";
import "./image-video";
import "./facecam-animee";
import { avecDelai, ecrireAvancement, ecrireAvancementTardif, ecrirePanne, executerSuites, lireTravauxAAvancer, rattraperFinitions, type ChoixMoteur, type SuiteFabrication } from "./travaux";

export { boucleActive, etatBoucle } from "./_boucle-etat";

export const INTERVALLE_BOUCLE_MS = 5_000;
/** Délai maximal d'un appel au fournisseur pendant un tour. */
export const DELAI_APPEL_MS = 30_000;
/** Délai maximal tant que la voix n'est pas faite (synthèse vocale d'un texte entier). */
export const DELAI_SYNTHESE_MS = 90_000;

/** Audit D, B9 : délai global d'un tour. Au-delà, il est abandonné (la boucle repart) et compté dans `toursAbandonnes`. */
export const DELAI_TOUR_MS = 150_000;
/** Délai d'attente des suites (miniatures, textes du kit) dans un tour ; elles continuent au-delà, hors du tour. */
export const DELAI_SUITES_MS = 45_000;
/** Délai d'attente des tâches annexes d'un tour (crédits, notifications). */
export const DELAI_ANNEXE_MS = 20_000;
/** Instance sans le verrou de la boucle : nouvel essai toutes les 30 s. */
export const ATTENTE_VERROU_MS = 30_000;

export type Tour = () => Promise<void>;

/** Délai maximal de l'avancement d'un travail. */
export function delaiPour(t: Travail): number {
  const voix = t.etapes.find((e) => e.cle === "voix");
  return voix && voix.statut !== "terminee" && voix.statut !== "ignoree" ? DELAI_SYNTHESE_MS : DELAI_APPEL_MS;
}

/**
 * Exécute un tour, ou le SAUTE si le précédent n'est pas fini (aucun empilement). Audit D, B9 : un tour qui dépasse
 * `delaiMs` est ABANDONNÉ (avant, il bloquait la boucle pour toujours, sans bruit) : le drapeau tombe, la boucle repart,
 * mais `dernierTour` n'avance pas (la sonde de santé le voit si cela se répète).
 */
export async function executerTour(tour: Tour, options: { delaiMs?: number } = {}): Promise<{ saute: boolean; abandonne?: boolean }> {
  const e = etatBoucle();
  if (e.enCours) {
    e.toursSautes++;
    return { saute: true };
  }
  e.enCours = true;
  let abandonne = false;
  try {
    await avecDelai(tour(), options.delaiMs ?? DELAI_TOUR_MS);
    e.toursFaits++;
  } catch (erreur) {
    if ((erreur as { delaiDepasse?: boolean } | null)?.delaiDepasse) {
      abandonne = true;
      e.toursAbandonnes++;
      console.error(`[studio] tour de la boucle de fond ABANDONNÉ après ${Math.round((options.delaiMs ?? DELAI_TOUR_MS) / 1000)} s (il finit en arrière-plan)`);
    } else {
      console.error("[studio] tour de la boucle de fond en échec", erreur);
    }
  } finally {
    e.enCours = false;
    if (!abandonne) e.dernierTour = Date.now();
  }
  return abandonne ? { saute: false, abandonne } : { saute: false };
}

/* ------------------------------------------------------------------ */
/* Tâches annexes d'un tour : une seule à la fois, attente bornée        */
/* ------------------------------------------------------------------ */

const cleAnnexes = Symbol.for("studio-axion-ia.annexes-en-vol");
/** Tâches annexes encore en cours (Buffer, crédits, notifications) : une seule de chaque à la fois. */
export function annexesEnVol(): Map<string, Promise<void>> {
  const g = globalThis as typeof globalThis & { [cleAnnexes]?: Map<string, Promise<void>> };
  g[cleAnnexes] ??= new Map();
  return g[cleAnnexes];
}

/**
 * Lance la tâche `nom`, sauf si la précédente n'est pas finie (aucun empilement). Attend au plus `attenteMs`
 * (0 : n'attend pas, la tâche tourne HORS du tour) ; au-delà, elle continue seule. Une erreur est journalisée.
 */
export async function lancerAnnexe(nom: string, f: () => Promise<unknown>, attenteMs: number): Promise<void> {
  const enVol = annexesEnVol();
  if (enVol.has(nom)) return;
  const p = Promise.resolve()
    .then(f)
    .then(
      () => undefined,
      (e: unknown) => console.error(`[studio] ${nom} en échec`, e instanceof Error ? e.name : "erreur"),
    )
    .finally(() => enVol.delete(nom));
  enVol.set(nom, p);
  if (attenteMs <= 0) return;
  await avecDelai(p, attenteMs).catch(() => console.error(`[studio] ${nom} : plus de ${Math.round(attenteMs / 1000)} s, la tâche continue hors du tour`));
}

/**
 * E2E-1 n° 1 (03/10) : avancements dont le délai a été dépassé mais dont l'appel continue (une lecture de voix longue
 * PAYÉE peut finir après les 90 s). Tant qu'il est en vol, le travail n'est pas relancé (aucune seconde lecture) ;
 * à son retour, son résultat est écrit (`ecrireAvancementTardif`) : la voix payée n'est jamais perdue ni relue.
 */
const cleEnVol = Symbol.for("studio-axion-ia.avancements-en-vol");
export function avancementsEnVol(): Map<string, Promise<void>> {
  const g = globalThis as typeof globalThis & { [cleEnVol]?: Map<string, Promise<void>> };
  g[cleEnVol] ??= new Map();
  return g[cleEnVol];
}

/* ------------------------------------------------------------------ */
/* Lecture de voix interrompue par un redémarrage (E2E-2 argent n° 9)    */
/* ------------------------------------------------------------------ */

const cleLectureEnVol = (travailId: string) => `fabrication.lectureVoixEnVol.${travailId}`;
const cleSolde = Symbol.for("studio-axion-ia.lectures-soldees");

/** La voix de ce travail est-elle sur le point d'être lue (et payée) par ce tour ? Moteurs qui paient la voix seulement. */
function lectureDeVoixAuProgramme(t: Travail, moteur: MoteurVideo): boolean {
  if (!moteur.lignesPayees) return false;
  const etape = t.etapes.find((e) => e.cle === "voix");
  if (!etape || etape.statut === "terminee" || etape.statut === "ignoree") return false;
  const phase = (t.parametres?.voix as { phase?: string } | undefined)?.phase;
  return phase === undefined || phase === "a-lire";
}

/**
 * Au premier tour d'un processus (après un redémarrage, une mise en ligne) : une lecture de voix notée « en vol » qui
 * n'est jamais revenue a probablement été PAYÉE. Elle est enregistrée comme dépense probable (estimation de la voix,
 * fournisseur réel), comme les appels Claude interrompus, pour que le budget et le rapprochement des soldes restent
 * justes. La voix sera relue (le son n'est jamais arrivé) ; la marque est retirée. Aucun appel réseau.
 */
async function solderLecturesInterrompues(): Promise<void> {
  const g = globalThis as typeof globalThis & { [cleSolde]?: boolean };
  if (g[cleSolde]) return;
  g[cleSolde] = true;
  const d = depots();
  for (const t of await d.travaux.lister((x) => x.statut === "en_cours" || x.statut === "en_file")) {
    const marque = await lireParametre<{ le: string; lignes: LigneCout[] } | null>(cleLectureEnVol(t.id), null);
    if (!marque) continue;
    await ecrireParametre(cleLectureEnVol(t.id), null);
    const lignes = marque.lignes.filter((l) => !ligneSimulee(l) && l.total.centimes > 0).map((l) => ({ ...l, etape: "Voix (lecture interrompue par un redémarrage, probablement payée)", nature: "reel" as const }));
    if (!lignes.length) continue;
    const total = additionner(...lignes.map((l) => l.total));
    await d.depenses.enregistrer({ id: nouvelId("dep"), videoId: t.cibleId, lignes, total, date: marque.le, ...horodatage(), estDemo: t.estDemo });
    await journaliser("credits", "Voix probablement payée puis perdue au redémarrage (comptée dans le budget)", { type: "video", id: t.cibleId });
  }
}

/** Remet à zéro le premier tour du processus (tests : simule un redémarrage). */
export function simulerRedemarragePourEssai(): void {
  (globalThis as typeof globalThis & { [cleSolde]?: boolean })[cleSolde] = false;
  (globalThis as typeof globalThis & { [cleFinitions]?: boolean })[cleFinitions] = false;
}

const cleFinitions = Symbol.for("studio-axion-ia.finitions-rattrapees");

/**
 * INTÉGRATION FINALE : au premier tour d'un processus, les finitions (miniatures, textes du kit, versions par réseau)
 * d'une vidéo terminée juste avant un arrêt sont reprises, HORS du tour (appels réseau possibles), une seule fois.
 */
function rattraperFinitionsUneFois(): Promise<void> | undefined {
  const g = globalThis as typeof globalThis & { [cleFinitions]?: boolean };
  if (g[cleFinitions]) return undefined;
  g[cleFinitions] = true;
  return rattraperFinitions().catch((e: unknown) => console.error("[studio] reprise des finitions en échec", e instanceof Error ? e.name : ""));
}

/** Note en base « la voix de ce travail est lue maintenant » (avec ce qu'elle coûte), avant l'appel payant. */
async function noterLectureEnVol(t: Travail, commande: CommandeFabrication, moteur: MoteurVideo): Promise<boolean> {
  if (!lectureDeVoixAuProgramme(t, moteur)) return false;
  const taux = commande.tauxUsdEur ?? (await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT));
  const lignes = ((await moteur.estimer(commande).catch(() => null))?.lignes ?? [])
    .filter((l) => cleEtapeDeLigne(l.etape) === "voix" && !ligneSimulee(l))
    // La voix HeyGen se paie au caractère (tarif en dollars) : le prix de la lecture, pas l'arrondi de l'estimation.
    .map((l) => (idFournisseur(l.fournisseur) === "heygen" && l.unite === "caractere" ? { ...l, total: centimes(l.quantite * CENTIMES_USD_PAR_CARACTERE_HEYGEN * taux), nature: "estime" as const } : l));
  if (!lignes.length) return false;
  await ecrireParametre(cleLectureEnVol(t.id), { le: maintenant(), lignes });
  return true;
}

export interface OptionsTour {
  choisirMoteur?: ChoixMoteur;
  delai?: (t: Travail) => number;
  /** Lecture des états Buffer (injection pour les tests ; défaut : `synchroniserEtatsBuffer`). */
  synchroBuffer?: () => Promise<unknown>;
}

/** Le contenu d'un tour (sans le drapeau). `choisirMoteur`, `delai`, `synchroBuffer` : injection pour les tests. */
export async function contenuDuTour(options: OptionsTour = {}): Promise<void> {
  // 0. Premier tour du processus : lectures de voix interrompues par l'arrêt précédent (dépense probable).
  await solderLecturesInterrompues();
  const finitions = rattraperFinitionsUneFois();
  if (finitions) await avecDelai(finitions, DELAI_SUITES_MS).catch(() => undefined);
  // 1. Lecture sous le verrou (aucun réseau). Un travail dont l'appel précédent est encore en vol attend son retour.
  const enVol = avancementsEnVol();
  const lus = (await sousVerrou(() => lireTravauxAAvancer(Date.now(), options.choisirMoteur))).filter((lu) => !enVol.has(lu.travail.id));
  const suites: SuiteFabrication[] = [];
  // Audit D, B9 : chaque travail est « en vol » pendant TOUT son traitement (pas seulement après un délai dépassé) : si
  // ce tour est abandonné (délai global), le tour suivant ne relance jamais un travail encore en cours.
  const traiter = async (lu: (typeof lus)[number]) => {
    // 2. Appels au fournisseur HORS verrou, avec délai maximal.
    let sortie: Awaited<ReturnType<typeof lu.moteur.avancer>>;
    const marquee = await noterLectureEnVol(lu.travail, lu.commande, lu.moteur);
    // Relecture paquet 4 (exactitude petit défaut 4) : la marque tombe seulement APRÈS l'écriture de l'avancement (la voix
    // payée est alors gardée), ou quand l'appel a échoué. Un arrêt entre le retour de HeyGen et l'écriture la laisse :
    // la voix est comptée en dépense probable au redémarrage, jamais oubliée.
    const retirerMarque = async () => {
      if (marquee) await ecrireParametre(cleLectureEnVol(lu.travail.id), null);
    };
    const appel = lu.moteur.avancer(lu.travail, lu.commande);
    try {
      sortie = await avecDelai(appel, (options.delai ?? delaiPour)(lu.travail));
    } catch (panne) {
      await sousVerrou(() => ecrirePanne(lu, panne, Date.now()));
      // Délai dépassé : l'appel continue. Son résultat (la voix payée) sera écrit à son retour, jamais relancé avant.
      if ((panne as { delaiDepasse?: boolean } | null)?.delaiDepasse) {
        const retour = appel
          .then(
            async (tardive) => {
              const r = await sousVerrou(() => ecrireAvancementTardif(lu, tardive));
              await retirerMarque();
              if (r.suites.length) await executerSuites(r.suites);
            },
            () => retirerMarque(),
          )
          .catch(() => undefined)
          .finally(() => enVol.delete(lu.travail.id));
        enVol.set(lu.travail.id, retour);
      } else await retirerMarque();
      return;
    }
    // 3. Réécriture sous le verrou, si rien n'a changé entre-temps.
    const r = await sousVerrou(() => ecrireAvancement(lu, sortie));
    await retirerMarque();
    suites.push(...r.suites);
  };
  await Promise.all(
    lus.map(async (lu) => {
      const id = lu.travail.id;
      const traitement = traiter(lu);
      enVol.set(id, traitement.then(() => undefined, () => undefined));
      const marque = enVol.get(id);
      try {
        await traitement;
      } finally {
        // Délai dépassé : `traiter` a remplacé la marque par l'attente du retour tardif ; elle reste.
        if (enVol.get(id) === marque) enVol.delete(id);
      }
    }),
  );
  // Hors verrou : miniatures et textes du kit (attente bornée : au-delà, elles finissent hors du tour).
  if (suites.length) {
    await avecDelai(executerSuites(suites), DELAI_SUITES_MS).catch((e: unknown) =>
      console.error("[studio] suites de fabrication", (e as { delaiDepasse?: boolean } | null)?.delaiDepasse ? "longues : elles continuent hors du tour" : "en échec", e instanceof Error ? e.name : ""),
    );
  }
  // Lot « crédits » : alertes, rapprochement quotidien, expiration, brouillons prêts (au plus une fois par minute).
  await lancerAnnexe("surveillance des crédits", () => surveillerCredits(), DELAI_ANNEXE_MS);
  // Lot R1 : états des publications Buffer (au plus toutes les 15 min ; lectures HORS verrou, jamais un envoi).
  // Audit D, B9 : HORS du tour (jusqu'à 50 lectures de 30 s) ; une seule synchronisation à la fois.
  void lancerAnnexe("synchronisation Buffer", options.synchroBuffer ?? (() => synchroniserEtatsBuffer()), 0);
  // Tableau animé : écriture du script et découpage en scènes (plusieurs minutes) HORS du tour, une seule fois à la fois.
  void lancerAnnexe("tâches du tableau animé", async () => (await import("./tableau-creation")).travaillerTachesTableau(), 0);
  // Comité éditorial des idées (éteint par défaut, réglage `idees.comite`) : lot groupé à moitié prix, HORS du tour.
  void lancerAnnexe("comité éditorial", async () => (await import("./comite-editorial")).travaillerComite(), 0);
  // Cas concrets déjà finis avant l'inscription des cas traités : inscrits une seule fois par processus (ajouts seulement).
  void lancerAnnexe("cas traités", async () => (await import("./cas-concret-traites")).inscrireLesCasDejaTraites(), 0);
  // Corbeille (18/10) : supprime les vidéos à la corbeille depuis 30 jours ou plus (au plus une fois par heure, sans session).
  void lancerAnnexe("corbeille", async () => (await import("./corbeille")).purgerCorbeille(), 0);
  // Image → vidéo, lot d'images (réglage éteint par défaut : sans lot en cours, ce tour ne fait rien) : le séquenceur lance
  // la vidéo suivante, une seule fabrication à la fois, sans session.
  await lancerAnnexe("lots d'images", async () => (await import("./image-video-lot")).avancerLotsIV(), DELAI_ANNEXE_MS);
  // Audit D, B10 : la file des notifications est en base ; un envoi raté est réessayé aux tours suivants.
  await lancerAnnexe("notifications", () => diffuserNotifications(), DELAI_ANNEXE_MS);
}

/** Un tour de boucle (sauté si un autre est en cours). */
export async function tourDeBoucle(options: OptionsTour = {}): Promise<{ saute: boolean; abandonne?: boolean }> {
  return executerTour(() => contenuDuTour(options));
}

/**
 * Démarre la boucle UNE fois par processus. Renvoie false si elle tournait déjà.
 * `tour` et `intervalleMs` : injection pour les tests.
 */
export function demarrerBoucle(options: { intervalleMs?: number; tour?: Tour } = {}): boolean {
  const e = etatBoucle();
  if (e.active) return false;
  const tour = options.tour ?? (() => contenuDuTour());
  const minuterie = setInterval(() => void executerTour(tour), options.intervalleMs ?? INTERVALLE_BOUCLE_MS);
  // La minuterie ne retient pas le processus (arrêt propre du serveur).
  (minuterie as { unref?: () => void }).unref?.();
  e.active = true;
  e.demarreLe = Date.now();
  e.arreter = () => {
    clearInterval(minuterie);
    e.active = false;
    e.arreter = undefined;
  };
  void executerTour(tour);
  return true;
}

export function arreterBoucle(): void {
  const e = etatBoucle();
  e.arreterAttente?.();
  e.arreter?.();
}

/** Prend le verrou de la boucle. `surPerte` : appelée si le verrou est perdu (connexion à la base coupée). */
export type PrendreVerrou = (surPerte: () => void) => Promise<boolean>;

/**
 * Audit D (un seul réplica garanti) : démarre la boucle SEULEMENT si cette instance tient le verrou consultatif
 * Postgres. Une seconde instance (redéploiement mal fait, deux conteneurs) ne fait pas tourner la boucle : elle
 * réessaie toutes les 30 s (et prend le relais si la première s'arrête). Verrou perdu : la boucle s'arrête, on réessaie.
 * Renvoie true si la boucle a démarré tout de suite.
 */
export async function demarrerBoucleUnique(
  options: {
    prendreVerrou?: PrendreVerrou;
    attenteMs?: number;
    intervalleMs?: number;
    tour?: Tour;
    /** false : coupure de secours STUDIO_BOUCLE=0 (le verrou ne sert alors qu'à `avecLeVerrou`). */
    boucleFabrication?: boolean;
    /**
     * Lancé quand le verrou est pris (boucle d'écriture Claude, veille : jamais deux fois en même temps). Relance à chaque
     * reprise du verrou après une perte (relecture paquet 4, exactitude D1).
     */
    avecLeVerrou?: () => void | Promise<void>;
    /** Verrou perdu : arrête ce que `avecLeVerrou` a lancé (boucle d'écriture Claude, veille). */
    surPerte?: () => void;
  } = {},
): Promise<boolean> {
  const e = etatBoucle();
  if (e.active || e.arreterAttente) return false;
  // Seconde relecture (R1) : dès qu'un verrou existe dans ce processus, « pas encore pris » vaut « pas tenu » (une
  // écriture de la boucle n'y paie aucun rôle, `executerRoleFacture`).
  e.verrouTenu ??= false;
  let autresLances = false;
  const prendre = options.prendreVerrou ?? prendreVerrouBoucle;
  const attenteMs = options.attenteMs ?? ATTENTE_VERROU_MS;
  let minuterie: ReturnType<typeof setTimeout> | undefined;

  const essayer = async (): Promise<boolean> => {
    let pris = false;
    try {
      pris = await prendre(perdu);
    } catch (erreur) {
      console.error("[studio] verrou de la boucle illisible (base injoignable ?)", erreur instanceof Error ? erreur.message : "erreur");
    }
    if (!pris) return false;
    e.verrouTenu = true;
    e.attenteVerrouDepuis = undefined;
    e.arreterAttente = undefined;
    if (!autresLances) {
      autresLances = true;
      await options.avecLeVerrou?.();
    }
    if (options.boucleFabrication === false) return true;
    demarrerBoucle({ intervalleMs: options.intervalleMs, tour: options.tour });
    return true;
  };
  const attendre = () => {
    e.attenteVerrouDepuis ??= Date.now();
    e.arreterAttente = () => {
      clearTimeout(minuterie);
      e.arreterAttente = undefined;
      e.attenteVerrouDepuis = undefined;
    };
    minuterie = setTimeout(() => {
      void essayer().then((ok) => {
        if (!ok && e.arreterAttente) attendre();
      });
    }, attenteMs);
    (minuterie as { unref?: () => void }).unref?.();
  };
  function perdu() {
    console.error("[studio] verrou de la boucle de fond PERDU : boucles arrêtées, nouvel essai dans 30 s");
    // Relecture paquet 4 (exactitude D1, sécurité P3) : la boucle d'écriture Claude et la veille s'arrêtent AUSSI ; elles
    // repartent à la reprise du verrou (une autre instance a pu le prendre entre-temps : jamais deux boucles payantes).
    e.verrouTenu = false;
    autresLances = false;
    try {
      options.surPerte?.();
    } catch (erreur) {
      console.error("[studio] arrêt après perte du verrou incomplet", erreur instanceof Error ? erreur.message : "erreur");
    }
    e.arreter?.();
    attendre();
  }

  if (await essayer()) return true;
  console.error("[studio] une autre instance du studio tient la boucle de fond : celle-ci ne la fait PAS tourner (nouvel essai toutes les 30 s)");
  attendre();
  return false;
}
