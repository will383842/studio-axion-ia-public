/**
 * CAL-22 (écrite EN AVANCE, avant RC-08a) · RETIRER UNE PUBLICATION PROGRAMMÉE.
 *
 * Retire chez le diffuseur, puis remet le contenu dans « À placer » (créneau archivé, visuel « valide » : texte et fichier gardés).
 * Règles :
 *  - un retrait chez le diffuseur est TOUJOURS confirmé par une relecture chez le diffuseur (client.retirer : GET avant, DELETE, GET après) ;
 *    jamais en aveugle ; réponse incertaine = « à vérifier » (marque `a-verifier:<clé>`, la garde L5-02d la lit), rien n'est changé ici ;
 *  - le diffuseur refuse ou ne répond pas : la publication reste « Programmé » et la phrase le dit ; refus définitif : « à retirer à la main » ;
 *  - rien n'est supprimé : les envois passent à « annule », le créneau à « archive » (avec `retireLe`), les textes restent ;
 *  - avant la promotion (aucun brouillon chez le diffuseur) : annuler = ne jamais promouvoir, sans aucun appel ;
 *  - une publication déjà partie, ou dont l'heure est passée, ne se retire pas ;
 *  - « Annuler » dans les 10 secondes : un NOUVEAU créneau à la même date (version suivante, donc nouvelle clé d'idempotence), jamais deux.
 * Tout est injecté : aucun service serveur, aucun appel réel ici. Les trois réglages d'envoi doivent être ouverts pour tout appel au diffuseur.
 */
import { nomDuReseau } from "@/reseaux/hors-video";
import type { LotEcritures } from "@/domaine/depots";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { transitionner } from "@/domaine/plan-editorial/statuts";
import type { Visuel } from "@/domaine/visuels/visuel";
import { estErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import type { ClientZernio, PostZernio } from "@/fournisseurs/publication/zernio-client";
import type { CreneauPlan } from "@/services/plan-editorial";

/** Même contrat que `EtatsPromotion` de promotion-envois.ts (clés sans préfixe). */
export interface EtatsRetrait {
  lire(cle: string): Promise<string | undefined>;
  noter(cle: string, valeur: string): Promise<void>;
}

export interface DepsRetrait {
  client: Pick<ClientZernio, "lirePost" | "listerPosts" | "retirer">;
  reglages: { envoiAutorise(): Promise<boolean>; envoiCalendrierAutorise(): Promise<boolean>; editorialeActive?(): Promise<boolean> };
  creneau(id: string): Promise<CreneauPlan | null>;
  envois(creneauId: string): Promise<EnvoiPlanifie[]>;
  visuel(id: string): Promise<Visuel | null>;
  /** Un seul lot d'écritures (effacements inclus, mais ce module n'en demande jamais). */
  appliquer(lot: LotEcritures): Promise<void>;
  etats: EtatsRetrait;
  maintenant(): Date;
  /** Essai borné : le retrait de CE créneau est-il couvert (fenêtre de nettoyage comprise) alors que les réglages généraux sont fermés ? Absent = non. */
  essai?(creneauId: string, geste: "retrait"): Promise<boolean>;
}

export type EtatRetrait = "retire" | "refuse" | "reste-programme" | "a-verifier" | "a-retirer-a-la-main";
export type ResultatRetrait = { ok: true; etat: "retire"; message: string; creneauId: string; annulableJusquA: string } | { ok: false; etat: Exclude<EtatRetrait, "retire">; message: string; /** Vrai si des écritures ont eu lieu (retrait partiel) : l'écran doit se rafraîchir. */ ecritures?: true };
/** Un code d'erreur par cas, pour que l'écran distingue « à vérifier », « à retirer à la main », « reste programmé » et « refusé ». */
export const CODES_RETRAIT = { refuse: "RETRAIT_REFUSE", "reste-programme": "RETRAIT_RESTE_PROGRAMME", "a-verifier": "RETRAIT_A_VERIFIER", "a-retirer-a-la-main": "RETRAIT_A_LA_MAIN" } as const;
export type ResultatAnnulation = { ok: true; creneauId: string; message: string } | { ok: false; message: string };

/** Délai de l'« Annuler » : 10 secondes après le retrait. */
export const DELAI_ANNULER_RETRAIT_MS = 10_000;
/** Marge minimale du diffuseur avant l'heure prévue (PROMOTION_MARGE_MIN_MS) : en deçà, il ne peut plus programmer. */
const MARGE_REPROGRAMMATION_MS = 30 * 60 * 1000;
/** Suffixe de l'identifiant du créneau recréé par « Annuler » : déterministe, donc jamais deux. */
export const SUFFIXE_REPRISE = "-reprise";

export const PHRASES_RETRAIT_PROGRAMMATION = {
  introuvable: "Cette publication est introuvable. Rechargez la page.",
  partie: "Cette publication est déjà partie : elle ne se retire plus.",
  passee: "L'heure est passée : cette publication ne se retire plus d'ici.",
  nonRetirable: "Seule une publication programmée ou validée se retire d'ici.",
  enCours: "Un envoi est en cours pour cette publication. Rien n'a été changé : réessayez dans une minute.",
  eteint: "L'envoi est éteint : le retrait chez le diffuseur n'est pas possible pour le moment. La publication reste programmée, rien n'a été changé.",
  sansReponse: "Le diffuseur ne répond pas pour le moment. La publication reste programmée, rien n'a été changé : réessayez plus tard.",
  aVerifier: "Le Studio ne sait pas si le retrait a bien eu lieu chez le diffuseur. La publication reste programmée, marquée « à vérifier » : relisez-la chez le diffuseur.",
  aLaMain: "Le diffuseur n'a pas pu retirer cette publication. Elle reste programmée et marquée « à retirer à la main » : retirez-la chez le diffuseur.",
  tropProche: "L'heure prévue est trop proche (moins de 30 minutes) : rien n'a été retiré. La publication reste programmée, marquée « à vérifier » : relisez-la chez le diffuseur.",
  dejaEnLigne: "Cette publication est déjà en ligne sur au moins un réseau : rien n'a été retiré. Elle est marquée « à retirer à la main » : vérifiez-la chez le diffuseur.",
  partielle: (retires: string, restent: string): string =>
    `Retrait partiel. Retiré chez le diffuseur : ${retires}. Reste programmé : ${restent}. Le texte et le fichier sont gardés.`,
  partielleEnLigne: (retires: string, restent: string): string =>
    `Retrait partiel. Retiré chez le diffuseur : ${retires}. Déjà en ligne, rien n'a été retiré : ${restent}. Le texte et le fichier sont gardés.`,
  partielleSuiteTropProche: "Pour le reste, l'heure prévue est trop proche (moins de 30 minutes) : rien n'a été retiré, il est marqué « à vérifier », relisez-le chez le diffuseur.",
  partielleSuiteEnLigne: "Le reste est marqué « à retirer à la main » : vérifiez-le chez le diffuseur.",
  partielleSuite: {
    "a-verifier": "Pour le reste, le Studio ne sait pas si le retrait a eu lieu : il est marqué « à vérifier », relisez-le chez le diffuseur.",
    "a-retirer-a-la-main": "Le reste n'a pas pu être retiré par le diffuseur : il est marqué « à retirer à la main », retirez-le chez le diffuseur.",
    "reste-programme": "Le diffuseur n'a pas répondu pour le reste : réessayez plus tard.",
  },
  retiree: "Retirée du calendrier. Vous la retrouvez dans « À placer », avec son texte et son fichier.",
  dejaRetiree: "Déjà retirée du calendrier.",
  annulerHorsDelai: "Le délai de 10 secondes est passé. Remettez la publication dans le calendrier depuis « À placer ».",
  annulerRien: "Cette publication n'a pas été retirée : il n'y a rien à annuler.",
  annulerTrop: "L'heure prévue est trop proche pour reprogrammer à l'identique. Choisissez une autre heure depuis « À placer ».",
  annulerOk: "Remise au calendrier à la même date.",
} as const;

const ETATS_FIN_ENVOI = new Set(["envoye", "a-envoyer"]);
const instants = (c: CreneauPlan): number[] => Object.values(c.heuresParReseau ?? {}).filter((h): h is string => typeof h === "string").map((h) => Date.parse(h));

/** Les trois réglages sont-ils ouverts ? Erreur ou valeur autre que `true` = fermé. */
async function ouverts(r: DepsRetrait["reglages"]): Promise<boolean> {
  try {
    return (await r.envoiAutorise()) === true && (await r.envoiCalendrierAutorise()) === true && (await r.editorialeActive?.()) === true;
  } catch {
    return false;
  }
}

/** Tous les posts d'un statut chez le diffuseur (pages de 100, 50 pages au plus). Lève si le diffuseur ne répond pas. */
async function listerPosts(client: DepsRetrait["client"], status: string): Promise<PostZernio[]> {
  const tous: PostZernio[] = [];
  const vus = new Set<string>();
  for (let page = 1; page <= 50; page++) {
    const lus = await client.listerPosts({ status, page, limit: 100 });
    const neufs = lus.filter((p) => !vus.has(p._id));
    neufs.forEach((p) => vus.add(p._id));
    tous.push(...neufs);
    if (lus.length < 100 || neufs.length === 0) break;
  }
  return tous;
}

/** Essai borné : une erreur = fermé. */
async function essaiCouvert(d: DepsRetrait, creneauId: string): Promise<boolean> {
  try {
    return typeof d.essai === "function" && (await d.essai(creneauId, "retrait")) === true;
  } catch {
    return false;
  }
}

/** Un post existe-t-il (ou a-t-il pu exister) chez le diffuseur pour cet envoi ? Sinon : rien à retirer, aucun appel. */
export async function aUnPostPossible(e: EnvoiPlanifie, etats: EtatsRetrait): Promise<boolean> {
  if (typeof e.cleDiffuseur === "string") return true;
  const [creation, promotion] = await Promise.all([etats.lire(`creation:${e.cle}`), etats.lire(`promotion:${e.cle}`)]);
  return creation === "cree" || creation === "en-cours" || promotion === "programme" || promotion === "en-cours" || promotion === "a-verifier";
}

const sansEcriture = (etat: Exclude<EtatRetrait, "retire">, message: string): ResultatRetrait => ({ ok: false, etat, message });

export async function retirerProgrammation(d: DepsRetrait, creneauId: string): Promise<ResultatRetrait> {
  const c = typeof creneauId === "string" && creneauId ? await d.creneau(creneauId) : null;
  if (!c) return sansEcriture("refuse", PHRASES_RETRAIT_PROGRAMMATION.introuvable);
  // Rejeu : déjà retirée (archivée avec `retireLe`) = rien à refaire, aucun appel.
  if (c.statut === "archive" && c.retireLe) return { ok: true, etat: "retire", message: PHRASES_RETRAIT_PROGRAMMATION.dejaRetiree, creneauId: c.id, annulableJusquA: new Date(Date.parse(c.retireLe) + DELAI_ANNULER_RETRAIT_MS).toISOString() };
  if (c.statut === "publie" || c.statut === "echec") return sansEcriture("refuse", PHRASES_RETRAIT_PROGRAMMATION.partie);
  if (c.statut !== "programme" && c.statut !== "valide") return sansEcriture("refuse", PHRASES_RETRAIT_PROGRAMMATION.nonRetirable);

  const maintenant = d.maintenant();
  const t = maintenant.getTime();
  const heures = instants(c);
  if (heures.some((h) => Number.isNaN(h) || h <= t)) return sansEcriture("refuse", PHRASES_RETRAIT_PROGRAMMATION.passee);

  const tous = await d.envois(c.id);
  if (tous.some((e) => ETATS_FIN_ENVOI.has(e.statut))) return sansEcriture("refuse", PHRASES_RETRAIT_PROGRAMMATION.partie);
  const vivants = tous.filter((e) => e.statut !== "annule");
  for (const e of vivants) {
    if ((await d.etats.lire(`promotion:${e.cle}`)) === "en-cours") return sansEcriture("refuse", PHRASES_RETRAIT_PROGRAMMATION.enCours);
  }

  // 1. Chez le diffuseur, envoi par envoi. Les envois dont le retrait est confirmé passent « annule » tout de suite (ils n'existent plus).
  const avecPost: EnvoiPlanifie[] = [];
  for (const e of vivants) if (await aUnPostPossible(e, d.etats)) avecPost.push(e);
  const retires = new Set<string>();
  const maintenantIso = maintenant.toISOString();
  const noterAnnules = async (liste: EnvoiPlanifie[]): Promise<void> => {
    if (liste.length === 0) return;
    await d.appliquer({ supprimer: [], enregistrer: liste.map((e) => ({ collection: "envoisPlanifies" as const, entite: { ...e, statut: "annule" as const, modifieLe: maintenantIso } })) });
  };

  if (avecPost.length > 0) {
    if (!(await ouverts(d.reglages)) && !(await essaiCouvert(d, c.id))) return sansEcriture("reste-programme", PHRASES_RETRAIT_PROGRAMMATION.eteint);
    let posts: PostZernio[];
    try {
      posts = [...(await listerPosts(d.client, "draft")), ...(await listerPosts(d.client, "scheduled"))];
    } catch {
      return sansEcriture("reste-programme", PHRASES_RETRAIT_PROGRAMMATION.sansReponse);
    }
    for (const e of avecPost) {
      const cleJournal = e.cleDiffuseur ?? e.cle;
      const post = posts.find((p) => p.metadata?.studioCle === cleJournal);
      let fin: ResultatRetrait | null = null;
      if (!post) {
        // Ni brouillon ni programmé sous cette clé alors qu'un post a existé : peut-être déjà parti, peut-être retiré à la main. Jamais en aveugle.
        fin = await aVerifier(d, e, retires, noterAnnules, avecPost);
      } else {
        const enLigne = !post.platforms.every((p) => typeof p.status === "string" && ["draft", "scheduled", "pending"].includes(p.status));
        const programme = typeof post.scheduledFor === "string" ? Date.parse(post.scheduledFor) : NaN;
        const tropProche = post.status === "scheduled" && Number.isFinite(programme) && programme < t + MARGE_REPROGRAMMATION_MS;
        if (enLigne) fin = await aLaMain(d, e, retires, noterAnnules, avecPost, PHRASES_RETRAIT_PROGRAMMATION.dejaEnLigne, "en-ligne");
        else if (tropProche) fin = await aVerifier(d, e, retires, noterAnnules, avecPost, PHRASES_RETRAIT_PROGRAMMATION.tropProche, "trop-proche");
        else try {
          const r = await d.client.retirer({ postId: post._id, cleJournal });
          if (r.etat === "retire") retires.add(e.id);
          else if (r.etat === "a-verifier") fin = await aVerifier(d, e, retires, noterAnnules, avecPost);
          else fin = await aLaMain(d, e, retires, noterAnnules, avecPost);
        } catch (err) {
          const code = estErreurZernio(err) ? err.code : "";
          if (code === "a-verifier" || code === "limite-incertaine" || code === "introuvable" || !estErreurZernio(err)) fin = await aVerifier(d, e, retires, noterAnnules, avecPost);
          else if (code === "refuse") fin = await aLaMain(d, e, retires, noterAnnules, avecPost);
          else fin = await rester(retires, noterAnnules, avecPost);
        }
      }
      if (fin) return fin;
    }
  }

  // 2. Tout est confirmé (ou rien n'était chez le diffuseur) : un seul lot local, aucun effacement.
  const restants = vivants.filter((e) => !retires.has(e.id));
  const r1 = c.statut === "programme" ? transitionner(c, "valide", "studio") : { ok: true as const, creneau: c };
  if (!r1.ok) return sansEcriture("refuse", PHRASES_RETRAIT_PROGRAMMATION.nonRetirable);
  const r2 = transitionner(r1.creneau, "archive", "studio");
  if (!r2.ok) return sansEcriture("refuse", PHRASES_RETRAIT_PROGRAMMATION.nonRetirable);
  const creneau: CreneauPlan = { ...r2.creneau, retireLe: maintenantIso };
  const lot: LotEcritures = {
    supprimer: [],
    enregistrer: [
      { collection: "creneauxEditoriaux", entite: creneau },
      ...[...restants, ...avecPost.filter((e) => retires.has(e.id))].map((e) => ({ collection: "envoisPlanifies" as const, entite: { ...e, statut: "annule" as const, modifieLe: maintenantIso } })),
    ],
  };
  if (c.visuelId) {
    const v = await d.visuel(c.visuelId);
    if (v && v.statut === "programme") {
      const rendu: Visuel = { ...v, statut: "valide", modifieLe: maintenantIso };
      lot.enregistrer.push({ collection: "visuels", entite: rendu });
    }
  }
  await d.appliquer(lot);
  return { ok: true, etat: "retire", message: PHRASES_RETRAIT_PROGRAMMATION.retiree, creneauId: c.id, annulableJusquA: new Date(t + DELAI_ANNULER_RETRAIT_MS).toISOString() };
}

const nomReseau = (r: string): string => nomDuReseau(r);

/** Retrait partiel : dit quels réseaux sont retirés et lesquels restent programmés (le message de base seul serait faux pour les premiers). */
function avecPartiel(res: ResultatRetrait, retires: Set<string>, avecPost: EnvoiPlanifie[], variante?: "trop-proche" | "en-ligne"): ResultatRetrait {
  if (res.ok || retires.size === 0) return res;
  const faits = avecPost.filter((x) => retires.has(x.id)).map((x) => nomReseau(x.reseau)).join(", ");
  const restent = avecPost.filter((x) => !retires.has(x.id)).map((x) => nomReseau(x.reseau)).join(", ");
  const P = PHRASES_RETRAIT_PROGRAMMATION;
  const debut = variante === "en-ligne" ? P.partielleEnLigne(faits, restent) : P.partielle(faits, restent);
  const suite = variante === "trop-proche" ? P.partielleSuiteTropProche : variante === "en-ligne" ? P.partielleSuiteEnLigne : (P.partielleSuite[res.etat as keyof typeof P.partielleSuite] ?? res.message);
  return { ...res, message: `${debut} ${suite}`, ecritures: true };
}

type Noter = (liste: EnvoiPlanifie[]) => Promise<void>;
const dejaRetires = (avecPost: EnvoiPlanifie[], retires: Set<string>): EnvoiPlanifie[] => avecPost.filter((x) => retires.has(x.id));

async function aVerifier(d: DepsRetrait, e: EnvoiPlanifie, retires: Set<string>, noter: Noter, avecPost: EnvoiPlanifie[], message: string = PHRASES_RETRAIT_PROGRAMMATION.aVerifier, variante?: "trop-proche"): Promise<ResultatRetrait> {
  await d.etats.noter(`a-verifier:${e.cle}`, "a-verifier");
  await noter(dejaRetires(avecPost, retires));
  return avecPartiel(sansEcriture("a-verifier", message), retires, avecPost, variante);
}

async function aLaMain(d: DepsRetrait, e: EnvoiPlanifie, retires: Set<string>, noter: Noter, avecPost: EnvoiPlanifie[], message: string = PHRASES_RETRAIT_PROGRAMMATION.aLaMain, variante?: "en-ligne"): Promise<ResultatRetrait> {
  await d.etats.noter(`retrait:${e.cle}`, "a-retirer-a-la-main");
  await noter(dejaRetires(avecPost, retires));
  return avecPartiel(sansEcriture("a-retirer-a-la-main", message), retires, avecPost, variante);
}

async function rester(retires: Set<string>, noter: Noter, avecPost: EnvoiPlanifie[]): Promise<ResultatRetrait> {
  await noter(dejaRetires(avecPost, retires));
  return avecPartiel(sansEcriture("reste-programme", PHRASES_RETRAIT_PROGRAMMATION.sansReponse), retires, avecPost);
}

/**
 * « Annuler » dans les 10 secondes : recrée UN créneau à la même date, à la version suivante (nouvelle clé d'idempotence, donc aucun doublon),
 * avec le même texte et la même validation. Le créneau retiré reste archivé. Un double clic rend le même créneau.
 */
export async function annulerRetrait(d: DepsRetrait, creneauId: string): Promise<ResultatAnnulation> {
  const c = typeof creneauId === "string" && creneauId ? await d.creneau(creneauId) : null;
  if (!c || c.statut !== "archive" || !c.retireLe) return { ok: false, message: PHRASES_RETRAIT_PROGRAMMATION.annulerRien };
  const nouveauId = c.id + SUFFIXE_REPRISE;
  const reprise = await d.creneau(nouveauId);
  if (reprise) {
    // Double clic : rendue telle quelle seulement si la reprise est toujours au calendrier ; retirée à son tour, il n'y a plus rien à annuler.
    const vivante = (reprise.statut === "valide" || reprise.statut === "programme") && !reprise.retireLe;
    return vivante ? { ok: true, creneauId: nouveauId, message: PHRASES_RETRAIT_PROGRAMMATION.annulerOk } : { ok: false, message: PHRASES_RETRAIT_PROGRAMMATION.annulerRien };
  }

  const t = d.maintenant().getTime();
  const retireLe = Date.parse(c.retireLe);
  if (!Number.isFinite(retireLe) || t - retireLe > DELAI_ANNULER_RETRAIT_MS) return { ok: false, message: PHRASES_RETRAIT_PROGRAMMATION.annulerHorsDelai };
  if (instants(c).some((h) => Number.isNaN(h) || h < t + MARGE_REPROGRAMMATION_MS)) return { ok: false, message: PHRASES_RETRAIT_PROGRAMMATION.annulerTrop };
  if (c.visuelId) {
    const v = await d.visuel(c.visuelId);
    if (!v || v.statut !== "valide") return { ok: false, message: PHRASES_RETRAIT_PROGRAMMATION.annulerRien };
  }

  const nouveau: CreneauPlan = { ...c, id: nouveauId, statut: "valide", decalages: c.decalages + 1 };
  delete nouveau.retireLe;
  delete nouveau.aRenvoyer;
  await d.appliquer({ supprimer: [], enregistrer: [{ collection: "creneauxEditoriaux", entite: nouveau }] });
  return { ok: true, creneauId: nouveauId, message: PHRASES_RETRAIT_PROGRAMMATION.annulerOk };
}

/**
 * Câblage serveur : construit les dépendances réelles (chargées à l'appel, pour que le service ci-dessus reste pur). Le client du diffuseur
 * n'est construit que si `retirerProgrammation` en a besoin, donc jamais quand les réglages d'envoi sont fermés ou qu'aucun post n'existe.
 */
async function depsServeur(): Promise<DepsRetrait> {
  const { depots, maintenant } = await import("@/services/_commun");
  const { appliquerLot } = await import("@/donnees/memoire");
  const z = await import("@/services/zernio");
  const d = depots();
  const { PREFIXE_ETATS_ENVOI_CALENDRIER: prefixe } = await import("@/services/branchement-envoi-calendrier");
  const client = () => z.clientZernio();
  return {
    client: { lirePost: (id) => client().lirePost(id), listerPosts: (q) => client().listerPosts(q), retirer: (x) => client().retirer(x) },
    reglages: { envoiAutorise: z.envoiZernioAutorise, envoiCalendrierAutorise: z.envoiCalendrierAutorise, editorialeActive: z.editorialeActive },
    creneau: async (id) => ((await d.creneauxEditoriaux.obtenir(id)) as CreneauPlan | null) ?? null,
    envois: (creneauId) => d.envoisPlanifies.lister((e) => e.creneauId === creneauId),
    visuel: async (id) => (await d.visuels.obtenir(id)) ?? null,
    appliquer: appliquerLot,
    // Marques d'état seulement (jamais un réglage) : lues et écrites dans le dépôt, sans passer par `lireParametre`.
    etats: {
      async lire(cle) {
        const v = (await d.parametres.obtenir(prefixe + cle))?.valeur;
        return typeof v === "string" ? v : undefined;
      },
      async noter(cle, valeur) {
        const id = prefixe + cle;
        const existant = await d.parametres.obtenir(id);
        const m = maintenant();
        await d.parametres.enregistrer({ id, valeur, creeLe: existant?.creeLe ?? m, modifieLe: m });
      },
    },
    maintenant: () => new Date(maintenant()),
    essai: async (id, geste) => (await import("@/services/essai-zernio")).essaiCouvre(id, geste),
  };
}

export const retirerProgrammationServeur = async (creneauId: string): Promise<ResultatRetrait> => retirerProgrammation(await depsServeur(), creneauId);
export const annulerRetraitServeur = async (creneauId: string): Promise<ResultatAnnulation> => annulerRetrait(await depsServeur(), creneauId);
