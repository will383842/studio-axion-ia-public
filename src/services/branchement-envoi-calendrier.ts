/**
 * L5-02c · BRANCHEMENT SERVEUR (ÉTEINT) du tour des publications validées du calendrier. V1 : VISUELS SEULEMENT.
 *
 * `tourEnvoisCalendrierServeur` est lancé par la boucle du Studio (annexe protégée) ; la validation, elle, n'appelle JAMAIS le
 * diffuseur (`envoyer` n'est injecté nulle part). Ordre strict :
 *  1. la porte (`publicationEditorialeAutorisee`, trois réglages, erreur = fermé) est lue AVANT toute lecture : fermée = aucun
 *     accès au plan, aux publications, au client ; aucun appel ;
 *  2. un tour toutes les 5 minutes au plus, un seul tour à la fois (un tour en cours = sauté, pas de file) ;
 *  3. seule l'annulation des versions périmées se fait sous `sousVerrou` ; les envois (`envoyerVisuelDuCreneau`) prennent leur
 *     propre verrou et ne sont JAMAIS appelés sous celui-ci (verrou global non réentrant) ;
 *  4. les créneaux validés deviennent des lignes ; exclus (une notification, une fois) : les vidéos (`vid-…` comprises), les médias
 *     qui occupent déjà le compte sur ce réseau ; exclues sans bruit : les validations relayées par l'usine (V1) ;
 *  5. aucun nouveau réglage, aucune valeur par défaut changée, aucune migration, aucune réponse automatique, aucun quota.
 */
import "server-only";
import { occupeBuffer } from "@/domaine/buffer";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { heureAffichageParis } from "@/domaine/plan-editorial/statuts";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";
import type { ReseauDeclinaison } from "@/domaine/types";
import { fournisseurParId } from "@/fournisseurs";
import type { ClientZernio } from "@/fournisseurs/publication/zernio-client";
import type { FournisseurPublication } from "@/fournisseurs/types";
import { cleJour } from "@/lib/dates";
import { depots, ecrireParametre, ErreurStudio, lireParametre, maintenant as maintenantIso, sousVerrou } from "./_commun";
import { tourEnvoisCalendrier, type CreneauCalendrier, type DemandeBrouillonCreneau, type DepsEnvoiCreneau, type ResultatTourCreneaux } from "./envoi-depuis-creneau";
import { envoyerVisuelDuCreneau } from "./envoi-visuel-creneau";
import { annulerEnvoi } from "./envois-planifies";
import { creerNotification } from "./notifications";
import type { EtatsPromotion, NotificationPromotion } from "./promotion-envois";
import { clientZernio, editorialeActive, envoiCalendrierAutorise, envoiZernioAutorise, publicationEditorialeAutorisee } from "./zernio";

/** Au plus un tour toutes les 5 minutes (débit du diffuseur). */
export const INTERVALLE_TOUR_ENVOIS_MS = 5 * 60_000;
/** Préfixe des états durables (paramètres existants : aucune table neuve, aucune migration). */
export const PREFIXE_ETATS_ENVOI_CALENDRIER = "envoi-calendrier:";

const RESEAUX_VISUELS: readonly ReseauDeclinaison[] = ["linkedin", "instagram", "facebook"];
const ALT_MAX = 125;

export interface InjectionsEnvoiCalendrier {
  /** Porte (défaut : `publicationEditorialeAutorisee`). Une erreur = fermé. */
  porte?: () => Promise<boolean>;
  client?: ClientZernio;
  /** Service de publication (défaut : celui du diffuseur). */
  service?: () => FournisseurPublication;
  maintenant?: () => number;
  etats?: EtatsPromotion;
  notifier?: (n: { titre: string; message?: string; lien?: string }) => Promise<unknown>;
  lireUrl?: (cle: string) => Promise<string>;
  fichierExiste?: (cle: string) => Promise<boolean>;
  attendre?: (ms: number) => Promise<void>;
}

export type TourEnvoisCalendrierServeur =
  | { saute: "porte-fermee" | "debit" | "tour-en-cours" | "non-relie" }
  | { saute?: undefined; annules: number; resultat: ResultatTourCreneaux };

/* ------------------------------------------------------------------ */
/* Débit et tour unique                                                */
/* ------------------------------------------------------------------ */

const etatTour = { enCours: false, dernier: undefined as number | undefined };

/** Tests : oublie le dernier tour et le drapeau « en cours ». */
export function reinitialiserTourEnvoisCalendrier(): void {
  etatTour.enCours = false;
  etatTour.dernier = undefined;
}

/* ------------------------------------------------------------------ */
/* Pièces                                                              */
/* ------------------------------------------------------------------ */

const etatsParametres: EtatsPromotion = {
  async lire(cle) {
    const v = await lireParametre<unknown>(PREFIXE_ETATS_ENVOI_CALENDRIER + cle, undefined);
    return typeof v === "string" ? v : undefined;
  },
  async noter(cle, valeur) {
    await ecrireParametre(PREFIXE_ETATS_ENVOI_CALENDRIER + cle, valeur);
  },
};

/** Cloche seulement : aucun nom d'outil, vouvoiement. */
const notifierCloche = async (n: { titre: string; message?: string; lien?: string }): Promise<unknown> =>
  creerNotification({ type: "echec", titre: n.titre, message: n.message, lien: n.lien }, { cloche: true });

/** Texte alternatif d'une page : celui du visuel, suivi de « (page i sur N) », jamais plus de 125 signes (le suffixe est gardé). */
export function textesAlternatifsDuVisuel(alt: string | undefined, pages: number): string[] {
  const base = (alt ?? "").replace(/\s+/g, " ").trim();
  if (!base || !Number.isInteger(pages) || pages < 1) return [];
  return Array.from({ length: pages }, (_, i) => {
    const suffixe = ` (page ${i + 1} sur ${pages})`;
    const place = Math.max(0, ALT_MAX - [...suffixe].length);
    return `${[...base].slice(0, place).join("").trimEnd()}${suffixe}`;
  });
}

const valideeLisible = (c: CreneauEditorial): boolean => typeof c.valideeLe === "string" && c.valideeLe !== "" && Number.isFinite(Date.parse(c.valideeLe));

/** Un créneau est-il à envoyer en V1 (validé, daté, ni refusé, ni retiré, ni à renvoyer) ? */
const valideEnvoyable = (c: CreneauEditorial & { aRenvoyer?: boolean }): boolean =>
  c.statut === "valide" && valideeLisible(c) && !c.refuseLe && !c.retireLe && !c.aRenvoyer;

/** Une seule notification par motif (état durable) : jamais de répétition à chaque tour. */
async function notifierUneFois(etats: EtatsPromotion, notifier: (n: NotificationPromotion) => Promise<void>, cleEtat: string, n: NotificationPromotion): Promise<void> {
  if ((await etats.lire(cleEtat)) === "notifie") return;
  await notifier(n);
  await etats.noter(cleEtat, "notifie");
}

/** Le média occupe-t-il déjà ce compte sur ce réseau (toute date, tout outil) hors notre propre brouillon de cette version ? */
async function occupeDejaLeCompte(c: CreneauEditorial, media: string, reseau: ReseauDeclinaison, version: number): Promise<boolean> {
  const siennes = (await depots().envoisPlanifies.lister((e) => e.creneauId === c.id && e.reseau === reseau && e.versionCreneau === version)).map((e) => e.cleDiffuseur).filter((k): k is string => typeof k === "string");
  const occupantes = await depots().publications.lister(
    (p) => (p.videoId === media || p.visuelId === media) && p.reseau === reseau && (!p.canalId || p.canalId === c.compteCible) && occupeBuffer(p),
  );
  return occupantes.some((p) => !(typeof p.cleEnvoi === "string" && siennes.includes(p.cleEnvoi)));
}

/* ------------------------------------------------------------------ */
/* Dépendances du tour                                                 */
/* ------------------------------------------------------------------ */

/** Les dépendances réelles de `tourEnvoisCalendrier` (injections pour les tests). N'appelle rien : tout est paresseux. */
export function construireDepsEnvoiCalendrier(inj: InjectionsEnvoiCalendrier = {}): DepsEnvoiCreneau {
  const maintenant = inj.maintenant ?? (() => Date.parse(maintenantIso()));
  const etats = inj.etats ?? etatsParametres;
  const notifierBrut = inj.notifier ?? notifierCloche;
  const notifier = async (n: NotificationPromotion): Promise<void> => {
    await notifierBrut({ titre: "Calendrier : publication à revoir", message: n.raison, lien: "/calendrier" });
  };

  async function creneaux(): Promise<CreneauCalendrier[]> {
    const lignes: CreneauCalendrier[] = [];
    const plan = (await depots().creneauxEditoriaux.lister()) as (CreneauEditorial & { aRenvoyer?: boolean })[];
    for (const c of plan) {
      if (!valideEnvoyable(c)) continue;
      // V1 : une validation relayée par l'usine n'est pas envoyée seule (point rouvert quand le fondateur allumera l'autonomie).
      if (typeof c.valideePar === "string" && c.valideePar.startsWith("usine:")) continue;
      const media = c.videoId ?? c.visuelId;
      if (!media) continue;
      const estVideo = !!c.videoId;
      for (const reseau of Object.keys(c.heuresParReseau ?? {}) as ReseauDeclinaison[]) {
        const instant = c.heuresParReseau[reseau];
        if (typeof instant !== "string" || !Number.isFinite(Date.parse(instant))) continue;
        const exclu = (motif: string, raison: string): Promise<void> =>
          notifierUneFois(etats, notifier, `exclu:${motif}:${c.id}:${reseau}:v${c.decalages}`, { cle: `exclu:${c.id}:${reseau}:v${c.decalages}`, videoId: media, motif: "a-reprogrammer", raison });
        // a. Vidéos (dont les créneaux « vid-… » du plan vidéo) : jamais envoyées seules en V1.
        if (estVideo || c.id.startsWith("vid-")) {
          await exclu("video", "Une vidéo ne part pas seule depuis le calendrier pour l'instant : rien n'est envoyé. Elle suit son propre parcours.");
          continue;
        }
        if (!RESEAUX_VISUELS.includes(reseau)) continue;
        // b. Média déjà chez le diffuseur pour ce compte : jamais de second brouillon, jamais de reprise silencieuse.
        if (await occupeDejaLeCompte(c, media, reseau, c.decalages)) {
          await exclu("occupe", "Ce visuel est déjà chez le diffuseur pour ce réseau : rien n'est envoyé. Changez sa date chez le diffuseur ou retirez-le du calendrier.");
          continue;
        }
        const texte = c.textes?.[reseau];
        lignes.push({
          id: c.id,
          videoId: media,
          nature: "visuel",
          reseau,
          versionCreneau: c.decalages,
          jour: cleJour(instant),
          heure: heureAffichageParis(instant),
          statut: c.statut,
          valideeLe: c.valideeLe,
          valideePar: c.valideePar,
          texte: texte?.texte ?? "",
          premierCommentaire: texte?.premierCommentaire,
        });
      }
    }
    return lignes;
  }

  /** Adaptateur : un visuel par `envoyerVisuelDuCreneau` (L5-21) ; la vidéo n'a pas de branche en V1. */
  async function envoyerReel(_outil: "zernio", d: DemandeBrouillonCreneau): Promise<{ cleDiffuseur: string } | void> {
    if (d.nature !== "visuel" || !d.creneauId || !RESEAUX_VISUELS.includes(d.reseau as ReseauDeclinaison) || d.reseau === "tiktok") {
      throw new ErreurStudio("RESEAU", "Ce créneau ne part pas seul depuis le calendrier : rien n'est envoyé.");
    }
    let service: FournisseurPublication;
    try {
      service = (inj.service ?? (() => fournisseurParId("publication", "zernio")))();
    } catch {
      throw new ErreurStudio("OUTIL_NON_RELIE", "L'outil de publication n'est pas relié : rien n'est envoyé.");
    }
    const reseau = d.reseau as "linkedin" | "instagram" | "facebook";
    const visuel = await depots().visuels.obtenir(d.videoId);
    const textesAlternatifs = reseau === "linkedin" ? [] : textesAlternatifsDuVisuel(visuel?.spec?.alt, visuel?.rendu?.pages?.length ?? 0);
    const r = await envoyerVisuelDuCreneau(service, d.creneauId, reseau, { textesAlternatifs, lireUrl: inj.lireUrl, fichierExiste: inj.fichierExiste });
    return typeof r.publication.cleEnvoi === "string" ? { cleDiffuseur: r.publication.cleEnvoi } : undefined;
  }

  return {
    depot: depots().envoisPlanifies,
    creneaux,
    client: inj.client ?? clientZernio(),
    reglages: { envoiAutorise: envoiZernioAutorise, envoiCalendrierAutorise, editorialeActive },
    maintenant,
    etats,
    notifier,
    envoyerReel,
    ...(inj.attendre ? { attendre: inj.attendre } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Versions périmées                                                   */
/* ------------------------------------------------------------------ */

/**
 * Tout envoi planifié « brouillon » ou « valide » dont le créneau n'existe plus, n'est plus validé (retiré, refusé…) ou a changé de
 * version passe à « annulé » AVANT la promotion. Un envoi « programme » n'est jamais touché (déjà chez le diffuseur). Aucun appel au
 * diffuseur, rien n'est supprimé. Sous `sousVerrou` : seul cet écrit s'y fait, jamais un envoi.
 */
async function annulerVersionsPerimees(maintenant: number): Promise<number> {
  return sousVerrou(async () => {
    const d = depots();
    const plan = new Map(((await d.creneauxEditoriaux.lister()) as (CreneauEditorial & { aRenvoyer?: boolean })[]).map((c) => [c.id, c]));
    const envois: EnvoiPlanifie[] = await d.envoisPlanifies.lister((e) => !!e.creneauId && (e.statut === "brouillon" || e.statut === "valide"));
    let n = 0;
    for (const e of envois) {
      const c = e.creneauId ? plan.get(e.creneauId) : undefined;
      const perime = !c || c.statut !== "valide" || !!c.retireLe || !!c.refuseLe || e.versionCreneau < c.decalages;
      if (!perime) continue;
      try {
        await annulerEnvoi(d.envoisPlanifies, e.id, new Date(maintenant).toISOString());
        n++;
      } catch {
        // Un envoi qui ne peut pas être annulé reste tel quel ; le tour continue.
      }
    }
    return n;
  });
}

/* ------------------------------------------------------------------ */
/* Le tour                                                             */
/* ------------------------------------------------------------------ */

export async function tourEnvoisCalendrierServeur(options: InjectionsEnvoiCalendrier = {}): Promise<TourEnvoisCalendrierServeur> {
  // 1. Porte AVANT toute lecture : fermée, illisible ou absente = rien n'est lu, rien n'est appelé.
  let ouverte = false;
  try {
    ouverte = (await (options.porte ?? publicationEditorialeAutorisee)()) === true;
  } catch {
    ouverte = false;
  }
  if (!ouverte) return { saute: "porte-fermee" };

  // 2 et 3. Un tour à la fois, au plus toutes les 5 minutes : le drapeau est posé avant toute lecture (aucune attente entre le test et la pose).
  const maintenant = (options.maintenant ?? (() => Date.parse(maintenantIso())))();
  if (etatTour.enCours) return { saute: "tour-en-cours" };
  if (etatTour.dernier !== undefined && maintenant - etatTour.dernier < INTERVALLE_TOUR_ENVOIS_MS) return { saute: "debit" };
  etatTour.enCours = true;
  etatTour.dernier = maintenant;
  try {
    let deps: DepsEnvoiCreneau;
    try {
      deps = construireDepsEnvoiCalendrier(options);
    } catch {
      // Client du diffuseur absent (clé non posée) : rien n'est lu, rien n'est appelé.
      return { saute: "non-relie" };
    }
    const annules = await annulerVersionsPerimees(maintenant);
    const resultat = await tourEnvoisCalendrier(deps);
    return { annules, resultat };
  } finally {
    etatTour.enCours = false;
  }
}
