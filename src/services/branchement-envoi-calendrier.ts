/**
 * L5-02c · BRANCHEMENT SERVEUR (ÉTEINT) du tour des publications validées du calendrier. V1 : VISUELS SEULEMENT.
 *
 * `tourEnvoisCalendrierServeur` est lancé par la boucle du Studio (annexe protégée) ; la validation, elle, n'appelle JAMAIS le
 * diffuseur (`envoyer` n'est injecté nulle part). Ordre strict :
 *  1. la porte (`publicationEditorialeAutorisee`, trois réglages, erreur = fermé) est lue AVANT toute lecture : fermée = aucun
 *     accès au plan, aux publications, au client ; aucun appel ;
 *  2. un tour toutes les 5 minutes au plus, un seul tour à la fois (un tour en cours = sauté, pas de file) ;
 *  3. sous `sousVerrou` : l'annulation des versions périmées, la relecture du plan juste avant une promotion avec la pose de la marque
 *     `promotion:<clé>`, et les écritures de marque (L5-02d) ; les envois (`envoyerVisuelDuCreneau`) et l'appel de promotion
 *     prennent leur propre verrou ou aucun, et ne sont JAMAIS appelés sous celui-ci (verrou global non réentrant) ;
 *  4. les créneaux validés deviennent des lignes ; exclus (une notification, une fois) : les vidéos (`vid-…` comprises), les médias
 *     qui occupent déjà le compte sur ce réseau ; exclues sans bruit : les validations relayées par l'usine (V1) ;
 *  5. aucun nouveau réglage, aucune valeur par défaut changée, aucune migration, aucune réponse automatique, aucun quota.
 *  6. L5-02d : une marque durable `promotion:<clé>` (`en-cours`, `programme`, `a-verifier`, `libre`) entoure chaque promotion ; elle est
 *     posée sous le MÊME `sousVerrou` que la relecture du plan (jamais de notification sous ce verrou), et lue par la garde
 *     `garde-creneau-diffuseur.ts` : un décalage ou une modification du texte ne passe plus entre la relecture et le PUT.
 */
import "server-only";
import { estReseauVisuelEnvoi, PINTEREST_TOUR_GENERAL, type ReseauVisuelEnvoi, type ReseauEnvoiCreneau } from "@/domaine/reseaux-visuel-envoi";
import { occupeBuffer } from "@/domaine/buffer";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { cleEnvoi } from "@/domaine/envoi-planifie";
import { creneauEnvoyable } from "@/domaine/plan-editorial/envoyable";
import { heureAffichageParis } from "@/domaine/plan-editorial/statuts";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";
import type { Publication } from "@/domaine/types";
import { fournisseurParId } from "@/fournisseurs";
import { CODES_AVANT_RESEAU, estErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import type { ClientZernio } from "@/fournisseurs/publication/zernio-client";
import type { FournisseurPublication } from "@/fournisseurs/types";
import { cleJour } from "@/lib/dates";
import { depots, ecrireParametre, ErreurStudio, lireParametre, maintenant as maintenantIso, sousVerrou } from "./_commun";
import { RAISON_A_COMPLETER, lireDernierRefus, envoyerDepuisCreneau, tourEnvoisCalendrier, type CreneauCalendrier, type LigneCreneau, type DemandeBrouillonCreneau, type DepsEnvoiCreneau, type ResultatTourCreneaux } from "./envoi-depuis-creneau";
import { envoyerVisuelDuCreneau } from "./envoi-visuel-creneau";
import { dansEssai, essaiCouvre, essaiEnCours, lireEssai } from "./essai-zernio";
import { annulerEnvoi, resoudreCleEnvoi } from "./envois-planifies";
import { creerNotification } from "./notifications";
import { tableauDeLaCible, type EtatsPromotion, type NotificationPromotion } from "./promotion-envois";
import { CLE_PINTEREST_ACTIF } from "@/fournisseurs/publication/zernio";
import { clientZernio, editorialeActive, envoiCalendrierAutorise, envoiZernioAutorise, publicationEditorialeAutorisee } from "./zernio";
import { estCompteParDefaut } from "@/domaine/plan-editorial/compte-par-defaut";

/** Pinterest : au plus 3 créations de brouillons par tour (le reste au tour suivant, 5 min après). La promotion reste réglée par `SuiviDebitImport`. */
export const CREATIONS_PINTEREST_PAR_TOUR = 3;

/** Au plus un tour toutes les 5 minutes (débit du diffuseur). */
export const INTERVALLE_TOUR_ENVOIS_MS = 5 * 60_000;
/** Préfixe des états durables (paramètres existants : aucune table neuve, aucune migration). */
export const PREFIXE_ETATS_ENVOI_CALENDRIER = "envoi-calendrier:";

const ALT_MAX = 125;
export const DELAI_ENVOI_MAX_MS = 90_000;

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
  /** Délai maximal d'un envoi (défaut 90 s) : au-delà, le tour continue et la ligne passe « à vérifier » (aucun nouvel essai). */
  delaiEnvoiMs?: number;
}

export type TourEnvoisCalendrierServeur =
  | { saute: "porte-fermee" | "debit" | "tour-en-cours" | "non-relie" }
  /** `essai` n'est présent que pour un tour d'ESSAI borné : UN créneau, un brouillon, jamais de promotion. */
  | { saute?: undefined; annules: number; resultat: ResultatTourCreneaux; essai?: LigneCreneau };

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

/**
 * État d'envoi d'un créneau sur un réseau, pour l'affichage (lecture seule, ne lève jamais) :
 * `aCompleter` quand le texte du réseau est vide, `dernierRefus` quand un refus a été gardé pour la version courante.
 */
export async function etatEnvoiDuCreneau(c: CreneauEditorial, reseau: ReseauEnvoiCreneau): Promise<{ aCompleter?: string; dernierRefus?: { raison: string; le: string } }> {
  try {
    const media = c.videoId ?? c.visuelId;
    const sortie: { aCompleter?: string; dernierRefus?: { raison: string; le: string } } = {};
    if (!c.textes?.[reseau]?.texte?.trim()) sortie.aCompleter = RAISON_A_COMPLETER;
    if (media) {
      const refus = await lireDernierRefus(etatsParametres, await resoudreCleEnvoi(depots().envoisPlanifies, { videoId: media, reseau, versionCreneau: c.decalages, creneauId: c.id }));
      if (refus) sortie.dernierRefus = refus;
    }
    return sortie;
  } catch {
    return {};
  }
}

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
  creneauEnvoyable(c);

/** Une seule notification par motif (état durable) : jamais de répétition à chaque tour. */
async function notifierUneFois(etats: EtatsPromotion, notifier: (n: NotificationPromotion) => Promise<void>, cleEtat: string, n: NotificationPromotion): Promise<void> {
  if ((await etats.lire(cleEtat)) === "notifie") return;
  await notifier(n);
  await etats.noter(cleEtat, "notifie");
}

/** Les publications qui occupent déjà ce compte sur ce réseau (toute date, tout outil), hors notre propre brouillon de cette version. */
async function occupantsDuCompte(c: CreneauEditorial, media: string, reseau: ReseauEnvoiCreneau, version: number): Promise<Publication[]> {
  const siennes = (await depots().envoisPlanifies.lister((e) => e.creneauId === c.id && e.reseau === reseau && e.versionCreneau === version)).map((e) => e.cleDiffuseur).filter((k): k is string => typeof k === "string");
  const occupantes = await depots().publications.lister(
    (p) => (p.videoId === media || p.visuelId === media) && p.reseau === reseau && (estCompteParDefaut(c.compteCible) || !p.canalId || p.canalId === c.compteCible) && occupeBuffer(p),
  );
  return occupantes.filter((p) => !(typeof p.cleEnvoi === "string" && siennes.includes(p.cleEnvoi)));
}

const STATUTS_DEJA_PROGRAMMES: readonly string[] = ["programme", "confirme", "a-envoyer"];
const jjmm = (jour: string | undefined, heure: string | undefined): string | undefined => {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(jour ?? "");
  return m ? `${m[2]}/${m[1]}${heure ? ` à ${heure}` : ""}` : undefined;
};

/** Le texte de l'exclusion « occupe », selon la publication qui occupe le compte (L5-02d). Le motif et la clé d'état ne changent pas. */
async function messageOccupe(c: CreneauEditorial, reseau: ReseauEnvoiCreneau, occupants: Publication[], etats: EtatsPromotion): Promise<string> {
  const anciennes = await depots().envoisPlanifies.lister((e) => e.creneauId === c.id && e.reseau === reseau && e.versionCreneau < c.decalages);
  const ancienne = anciennes.sort((a, b) => b.versionCreneau - a.versionCreneau).find((e) => typeof e.cleDiffuseur === "string" && occupants.some((p) => p.cleEnvoi === e.cleDiffuseur));
  if (!ancienne) {
    return "Ce visuel est déjà chez le diffuseur pour ce compte, en dehors de ce créneau : le calendrier ne l'envoie pas une seconde fois et ne le déplace pas. Vérifiez-le dans « À publier » ou dans l'outil de publication.";
  }
  const pub = occupants.find((p) => p.cleEnvoi === ancienne.cleDiffuseur);
  const quand = jjmm(ancienne.jour, ancienne.heure)
    ?? (pub && Number.isFinite(Date.parse(pub.date)) ? jjmm(cleJour(pub.date), heureAffichageParis(pub.date)) : undefined)
    ?? "la date prévue";
  if (ancienne.statut === "envoye") {
    return `Elle est déjà partie chez le diffuseur pour le ${quand} (heure de Paris), l'ancienne date. Le calendrier ne la renvoie pas et ne la déplace pas. Pour la retirer, faites-le dans l'outil de publication.`;
  }
  const programmee = STATUTS_DEJA_PROGRAMMES.includes(ancienne.statut) || (await etats.lire(`promotion:${ancienne.cle}`)) === "programme";
  if (programmee) {
    return `Elle est déjà programmée chez le diffuseur pour le ${quand} (heure de Paris), l'ancienne date, et partira à cette heure-là. Le calendrier ne la déplace pas. Pour la déplacer ou l'annuler, faites-le dans l'outil de publication.`;
  }
  return `Le brouillon préparé chez le diffuseur pour le ${quand} ne sera pas programmé : cette publication ne partira pas seule à sa nouvelle date. Programmez-la vous-même dans l'outil de publication.`;
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
    // Pinterest : une ligne n'existe que si le tour général est ouvert pour Pinterest, ou pour le seul créneau de l'essai borné.
    const essaiPinterest = (await lireEssai(maintenant()).catch(() => null))?.creneauId;
    /** Interrupteur `zernio.pinterest_actif` : seul `true` ouvre, lecture en panne = fermé. */
    const pinterestInterrupteurOuvert = async (): Promise<boolean> => (await lireParametre<unknown>(CLE_PINTEREST_ACTIF, false).catch(() => false)) === true;
    const essaiPinterestValable = async (id: string): Promise<boolean> => essaiPinterest === id && (await essaiCouvre(id, "brouillon", maintenant()).catch(() => false));
    let creationsPinterest = 0;
    const plan = (await depots().creneauxEditoriaux.lister()) as (CreneauEditorial & { aRenvoyer?: boolean })[];
    for (const c of plan) {
      if (!valideEnvoyable(c)) continue;
      // V1 : une validation relayée par l'usine n'est pas envoyée seule (point rouvert quand le fondateur allumera l'autonomie).
      if (typeof c.valideePar === "string" && c.valideePar.startsWith("usine:")) continue;
      const media = c.videoId ?? c.visuelId;
      if (!media) continue;
      const estVideo = !!c.videoId;
      for (const reseau of Object.keys(c.heuresParReseau ?? {}) as ReseauEnvoiCreneau[]) {
        const instant = c.heuresParReseau[reseau];
        if (typeof instant !== "string" || !Number.isFinite(Date.parse(instant))) continue;
        // Un créneau déjà passé n'a aucune ligne : au premier allumage, l'historique ne remplit pas la cloche.
        const passe = Date.parse(instant) <= maintenant();
        if (passe) continue;
        // Déjà chez le diffuseur sous cette version (programmé, confirmé, parti) : aucune ligne, donc aucune fausse alerte « à reprogrammer ».
        if ((await depots().envoisPlanifies.lister((e) => e.creneauId === c.id && e.reseau === reseau && e.versionCreneau === c.decalages && ["programme", "confirme", "a-envoyer", "envoye"].includes(e.statut))).length) continue;
        const exclu = (motif: string, raison: string): Promise<void> =>
          notifierUneFois(etats, notifier, `exclu:${motif}:${c.id}:${reseau}:v${c.decalages}`, { cle: `exclu:${c.id}:${reseau}:v${c.decalages}`, videoId: media, motif: "a-reprogrammer", raison });
        // a. Vidéos (dont les créneaux « vid-… » du plan vidéo) : jamais envoyées seules en V1.
        if (estVideo || c.id.startsWith("vid-")) {
          await exclu("video", "Une vidéo ne part pas seule depuis le calendrier pour l'instant : rien n'est envoyé. Elle suit son propre parcours.");
          continue;
        }
        if (!estReseauVisuelEnvoi(reseau)) continue;
        if (reseau === "pinterest" && !(PINTEREST_TOUR_GENERAL && (await pinterestInterrupteurOuvert())) && !(await essaiPinterestValable(c.id))) continue;
        // a'. Version courante annulée (dévalidée puis revalidée) : jamais de refus silencieux, une seule notification.
        if ((await depots().envoisPlanifies.lister((e) => e.creneauId === c.id && e.reseau === reseau && e.versionCreneau === c.decalages && e.statut === "annule")).length) {
          await exclu("annule", "Cette publication a été modifiée après une première préparation : elle ne partira pas seule à cette date. Pour qu'elle parte seule, décalez-la ; sinon, programmez-la dans l'outil de publication.");
          continue;
        }
        // b. Média déjà chez le diffuseur pour ce compte : jamais de second brouillon, jamais de reprise silencieuse.
        const occupants = await occupantsDuCompte(c, media, reseau, c.decalages);
        if (occupants.length) {
          await exclu("occupe", await messageOccupe(c, reseau, occupants, etats));
          continue;
        }
        const texte = c.textes?.[reseau];
        // Pinterest : plafond de CRÉATIONS par tour (un envoi déjà créé chez le diffuseur a été écarté plus haut).
        // Une ligne qui a déjà son envoi planifié (brouillon créé) n'est plus une création : elle ne compte pas dans le plafond.
        if (reseau === "pinterest" && (await depots().envoisPlanifies.lister((e) => e.creneauId === c.id && e.reseau === reseau && e.versionCreneau === c.decalages)).length === 0 && ++creationsPinterest > CREATIONS_PINTEREST_PAR_TOUR) continue;
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
    if (d.nature !== "visuel" || !d.creneauId || !estReseauVisuelEnvoi(d.reseau)) {
      throw new ErreurStudio("RESEAU", "Ce créneau ne part pas seul depuis le calendrier : rien n'est envoyé.");
    }
    // Une épingle ne part que sur Pinterest, rien d'autre n'y part : refus AVANT de résoudre le fournisseur.
    const visuel = await depots().visuels.obtenir(d.videoId);
    if (visuel && (visuel.famille === "epingle") !== (d.reseau === "pinterest")) {
      throw new ErreurStudio("VISUEL_REFUSE", d.reseau === "pinterest" ? "Seule une épingle part sur Pinterest : rien n'est parti." : "Une épingle ne part que sur Pinterest : rien n'est parti.");
    }
    let service: FournisseurPublication;
    try {
      service = (inj.service ?? (() => fournisseurParId("publication", "zernio")))();
    } catch {
      throw new ErreurStudio("OUTIL_NON_RELIE", "L'outil de publication n'est pas relié : rien n'est envoyé.");
    }
    const reseau = d.reseau as ReseauVisuelEnvoi;
    const textesAlternatifs = reseau === "linkedin" ? [] : reseau === "pinterest" ? (visuel?.epingle ? [visuel.epingle.texteAlternatif] : []) : textesAlternatifsDuVisuel(visuel?.spec?.alt, visuel?.rendu?.pages?.length ?? 0);
    // Délai maximal : un appel qui ne rend jamais la main ne bloque pas les tours suivants ; l'erreur (code inconnu) = « à vérifier », jamais un renvoi.
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    const delai = new Promise<never>((_, rejeter) => {
      minuteur = setTimeout(() => rejeter(new Error("délai maximal de l'envoi dépassé")), inj.delaiEnvoiMs ?? DELAI_ENVOI_MAX_MS);
    });
    const envoi = envoyerVisuelDuCreneau(service, d.creneauId, reseau, { textesAlternatifs, lireUrl: inj.lireUrl, fichierExiste: inj.fichierExiste });
    envoi.catch(() => undefined);
    const r = await Promise.race([envoi, delai]).finally(() => clearTimeout(minuteur));
    return typeof r.publication.cleEnvoi === "string" ? { cleDiffuseur: r.publication.cleEnvoi } : undefined;
  }

  // Le plan est relu à chaque lecture des envois et JUSTE AVANT chaque promotion : un créneau décalé, retiré, refusé ou dévalidé
  // pendant un tour long n'est jamais promu (son envoi passe à « annulé », le créneau est signalé une seule fois).
  const depotBrut = depots().envoisPlanifies;
  const depot: typeof depotBrut = new Proxy(depotBrut, {
    get: (cible, nom: string) => {
      const v = (cible as never)[nom] as unknown;
      if (nom !== "lister" || typeof v !== "function") return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(cible) : v;
      return async (...a: unknown[]) => {
        await annulerVersionsPerimees(maintenant(), etats);
        return (v as (...x: unknown[]) => unknown).apply(cible, a);
      };
    },
  });
  const clientBrut = inj.client ?? clientZernio();
  const client: ClientZernio = new Proxy(clientBrut, {
    get: (cible, nom: string) => {
      const v = (cible as never)[nom] as unknown;
      if (typeof v !== "function") return v;
      if (nom !== "promouvoir") return (v as (...a: unknown[]) => unknown).bind(cible);
      return async (d: Parameters<ClientZernio["promouvoir"]>[0]) => {
        // Défense en profondeur : sous un essai borné, jamais de promotion.
        if (essaiEnCours()) return { etat: "refuse" as const, raison: "essai borné : brouillon seulement, aucune promotion" };
        const pre = await envoiPerimeAvantPromotion(d.cleJournal, maintenant(), etats);
        if (pre.perime) {
          await notifierUneFois(etats, notifier, `perime:${d.cleJournal}`, { cle: d.cleJournal, videoId: pre.perime, motif: "a-reprogrammer", raison: "Ce créneau a changé (décalé, retiré ou plus validé) pendant l'envoi : il n'a pas été programmé. Vérifiez-le dans le calendrier." });
          return { etat: "refuse" as const, raison: "créneau changé pendant le tour : promotion abandonnée" };
        }
        if (pre.interrompue) {
          return { etat: "a-verifier" as const, raison: "promotion interrompue : à vérifier chez le diffuseur, aucun nouvel essai automatique" };
        }
        // Hors verrou : l'appel au diffuseur (jusqu'à 30 s) ne bloque ni les décalages ni les autres gestes. La marque « en-cours » ferme la fenêtre.
        let r: Awaited<ReturnType<ClientZernio["promouvoir"]>>;
        try {
          r = await cible.promouvoir(d);
        } catch (err) {
          if (pre.cle) await noterMarquePromotion(etats, pre.cle, estErreurZernio(err) && CODES_AVANT_RESEAU.includes(err.code) ? "libre" : "a-verifier");
          throw err;
        }
        // « refuse » est rangé en « a-verifier » par prudence : le client rend aussi « refuse » pour un post déjà programmé.
        if (pre.cle) await noterMarquePromotion(etats, pre.cle, r.etat === "programme" ? "programme" : r.etat === "a-reprogrammer" ? "libre" : "a-verifier");
        return r;
      };
    },
  });

  return {
    depot,
    creneaux,
    client,
    reglages: { envoiAutorise: envoiZernioAutorise, envoiCalendrierAutorise, editorialeActive },
    maintenant,
    etats,
    notifier,
    envoyerReel,
    // Pinterest : le tableau voulu est relu dans la Publication de l'envoi (cible « compte:pin:tableau »).
    tableauAttendu: async (cle) => tableauDeLaCible((await depots().publications.lister((x) => x.cleEnvoi === cle))[0]?.canalId),
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
const estPerime = (e: EnvoiPlanifie, c: (CreneauEditorial & { aRenvoyer?: boolean }) | undefined): boolean =>
  !c || !creneauEnvoyable(c) || e.versionCreneau < c.decalages;

async function annulerVersionsPerimees(maintenant: number, etats: EtatsPromotion): Promise<number> {
  return sousVerrou(async () => {
    const d = depots();
    const plan = new Map(((await d.creneauxEditoriaux.lister()) as (CreneauEditorial & { aRenvoyer?: boolean })[]).map((c) => [c.id, c]));
    const envois: EnvoiPlanifie[] = await d.envoisPlanifies.lister((e) => !!e.creneauId && (e.statut === "brouillon" || e.statut === "valide"));
    let n = 0;
    for (const e of envois) {
      if (!estPerime(e, e.creneauId ? plan.get(e.creneauId) : undefined)) continue;
      // Jamais annulé pendant que son PUT est en vol (la marque est posée sous ce même verrou).
      if ((await etats.lire(`promotion:${e.cle}`)) === "en-cours") continue;
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

type MarquePromotion = "en-cours" | "programme" | "a-verifier" | "libre";
const noterMarquePromotion = (etats: EtatsPromotion, cle: string, valeur: MarquePromotion): Promise<void> =>
  sousVerrou(async () => {
    await etats.noter(`promotion:${cle}`, valeur);
    // « à vérifier » (refus, erreur après le réseau) : l'état « a-verifier:<clé> » est noté aussi, pour que plus rien ne soit rappelé.
    if (valeur === "a-verifier") await etats.noter(`a-verifier:${cle}`, "a-verifier");
  });

/**
 * Relecture du plan juste avant une promotion, puis marque durable, sous le MÊME `sousVerrou` (aucune notification ici) :
 *  - l'envoi (désigné par sa clé de journal) vient de devenir périmé : il est annulé, le média est rendu (`perime`), rien n'est appelé ;
 *  - la marque `promotion:<clé>` vaut déjà `en-cours` (tentative interrompue) ou `a-verifier` : aucun appel, marque `a-verifier` (`interrompue`) ;
 *  - sinon la marque passe à `en-cours` et la clé est rendue : l'appelant la fait passer à son issue après le PUT.
 * Un décalage ou une modification du texte, lus sous le même verrou, voient donc soit la nouvelle version (la promotion est abandonnée),
 * soit la marque (le geste est refusé) : jamais un post programmé ET un créneau décalé.
 */
async function envoiPerimeAvantPromotion(cleJournal: string, maintenant: number, etats: EtatsPromotion): Promise<{ perime?: string; interrompue?: true; cle?: string }> {
  return sousVerrou(async () => {
    const d = depots();
    const [e] = await d.envoisPlanifies.lister((x) => !!x.creneauId && (x.statut === "brouillon" || x.statut === "valide") && (x.cleDiffuseur ?? x.cle) === cleJournal);
    if (!e) return {};
    const plan = (await d.creneauxEditoriaux.lister()) as (CreneauEditorial & { aRenvoyer?: boolean })[];
    if (estPerime(e, plan.find((c) => c.id === e.creneauId))) {
      try {
        await annulerEnvoi(d.envoisPlanifies, e.id, new Date(maintenant).toISOString());
      } catch {
        // Même si l'annulation échoue, la promotion est abandonnée : rien ne part.
      }
      return { perime: e.videoId };
    }
    const marque = await etats.lire(`promotion:${e.cle}`);
    if (marque === "en-cours" || marque === "a-verifier") {
      await etats.noter(`promotion:${e.cle}`, "a-verifier");
      return { interrompue: true, cle: e.cle };
    }
    // L'instant de départ d'abord, la marque ensuite : sous ce verrou, nul ne lit « en-cours » sans son instant (la garde en tire l'âge).
    await etats.noter(`promotion-debut:${e.cle}`, maintenantIso());
    await etats.noter(`promotion:${e.cle}`, "en-cours");
    return { cle: e.cle };
  });
}

/**
 * Début de tour : le tour est unique par processus, donc aucune promotion n'est en vol. Toute marque `promotion:<clé>` encore « en-cours »
 * est orpheline (plantage après le PUT : le post est peut-être déjà programmé, hors de la liste des brouillons) : elle passe à
 * « a-verifier », et l'état « a-verifier:<clé> » est noté pour que plus rien ne soit rappelé. Sous `sousVerrou`, aucune notification.
 */
async function marquerPromotionsOrphelines(etats: EtatsPromotion): Promise<void> {
  await sousVerrou(async () => {
    for (const e of await depots().envoisPlanifies.lister((x) => !!x.creneauId)) {
      if ((await etats.lire(`promotion:${e.cle}`)) !== "en-cours") continue;
      await etats.noter(`promotion:${e.cle}`, "a-verifier");
      await etats.noter(`a-verifier:${e.cle}`, "a-verifier");
    }
  });
}

/* ------------------------------------------------------------------ */
/* Le tour                                                             */
/* ------------------------------------------------------------------ */

export async function tourEnvoisCalendrierServeur(options: InjectionsEnvoiCalendrier = {}): Promise<TourEnvoisCalendrierServeur> {
  // 1. Porte générale lue en premier : fermée, illisible ou absente, seuls le réglage d'essai et son créneau sont lus (rien d'autre), et rien n'est appelé hors de l'essai.
  let ouverte = false;
  try {
    ouverte = (await (options.porte ?? publicationEditorialeAutorisee)()) === true;
  } catch {
    ouverte = false;
  }
  // Porte générale fermée : l'essai borné d'UN créneau (brouillon seulement) peut encore passer ; sinon, fermé comme avant.
  const maintenant = (options.maintenant ?? (() => Date.parse(maintenantIso())))();
  let essaiId: string | undefined;
  if (!ouverte) {
    const e = await lireEssai(maintenant);
    if (!e || !(await essaiCouvre(e.creneauId, "brouillon", maintenant))) return { saute: "porte-fermee" };
    essaiId = e.creneauId;
  }

  // 2 et 3. Un tour à la fois, au plus toutes les 5 minutes : le drapeau est posé avant toute lecture (aucune attente entre le test et la pose).
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
    await marquerPromotionsOrphelines(deps.etats);
    const annules = await annulerVersionsPerimees(maintenant, deps.etats);
    if (essaiId !== undefined) {
      // Tour d'essai : UN seul créneau, jamais `tourEnvoisCalendrier` (qui promeut). Chaque porte relit l'essai.
      const id = essaiId;
      // Marque durable `essai:<clé>`, posée AVANT `creation:<clé>` : la promotion générale ne touchera jamais ce brouillon.
      const etatsEssai: EtatsPromotion = {
        lire: (cle) => deps.etats.lire(cle),
        async noter(cle, valeur) {
          if (cle.startsWith("creation:")) await deps.etats.noter(`essai:${cle.slice("creation:".length)}`, maintenantIso());
          await deps.etats.noter(cle, valeur);
        },
      };
      const ligne = await dansEssai(id, () => envoyerDepuisCreneau({ ...deps, etats: etatsEssai, porteEssai: (c) => essaiCouvre(c, "brouillon") }, id));
      return { annules, resultat: { lignes: ligne ? [ligne] : [], erreurs: [] }, essai: ligne };
    }
    const resultat = await tourEnvoisCalendrier(deps);
    return { annules, resultat };
  } finally {
    etatTour.enCours = false;
  }
}
