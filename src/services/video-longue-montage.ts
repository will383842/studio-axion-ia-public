/**
 * MONTAGE RÉEL DE LA « VIDÉO LONGUE » côté Studio (lot UI-4) : le port `monter` du moteur `montage-video-longue`.
 *
 *  1. plan 16:9 par chapitre, SANS IA (`planVideoLongue`, niveau 1) : aucun appel Claude, 0 € ;
 *  2. sous-titres (`fabriquerSousTitres`) sur les mêmes mots, passés en `proprietes.sousTitres` ;
 *  3. un morceau muet par plage d'images (`rendreChapitres`, une plage à la fois sur le service de rendu) ; chaque morceau
 *     terminé est NOTÉ (paramètre `videoLongue.plages.<videoId>`) : un redémarrage ne refait pas une plage rendue ;
 *  4. collage des morceaux (`collage-chapitres`) : SANS voix en mode sans voix (aucune piste son).
 *
 * Ce module ne parle jamais à HeyGen ni à ElevenLabs et n'importe aucun fournisseur de voix. Les ports (rendu, signatures,
 * clés, reprise) sont injectés : les tests n'ont aucun réseau. Les gardes d'argent restent dans `video-longue-branchements`.
 */
import { createHash } from "node:crypto";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import type { DemandeRendu, ServiceRendu } from "@/fournisseurs/types";
import { ErreurRendu } from "@/fournisseurs/rendu/client";
import type { SegmentCale } from "@/briques/plan-scenes-generateurs/adaptateur";
import { donneesCalque, fabriquerSousTitres } from "@/briques/sous-titres";
import { COMPOSITION_VIDEO_LONGUE, type DependancesVideoLongue, type PasMontageVideoLongue, type SuiviMontageVideoLongue } from "@/moteurs/montage-video-longue/chaine";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { planVideoLongue, type ChapitrePourPlan, type FormatVideoLongue } from "@/moteurs/montage-video-longue/plan";
import { DELAI_MAX_PLAGE_MS, idRenduPlage, parametresPlage, plagesDesChapitres, rendreChapitres, type DemandePlage, type MorceauRendu, type PlageARendre, type PortRenduPlage } from "@/moteurs/montage-video-longue/rendu-chapitres";

/** Nom du fichier final, PROPRE À CHAQUE TRAVAIL : une retouche n'écrase jamais la version précédente. */
export const nomFichierVideoLongue16x9 = (travailId: string): string => `video-longue-${idSur(travailId)}-16x9.mp4`;
/** Tolérance (ms) sur la borne de début d'un chapitre : un mot qui commence un peu avant reste dans le chapitre. */
export const TOLERANCE_DEBUT_CHAPITRE_MS = 50;
/** Paramètre où sont notées les plages rendues, par vidéo (reprise après redémarrage). */
export const cleParametrePlages = (videoId: string): string => `videoLongue.plages.${videoId}`;
/** Attente entre deux lectures de l'état d'un rendu. */
export const INTERVALLE_ETAT_RENDU_MS = 5_000;
/** Délai du collage (sans réencodage : court). */
export const DELAI_COLLAGE_MS = 20 * 60_000;
/** Mots au plus par segment calé (un segment finit aussi à la ponctuation de fin de phrase). */
const MOTS_PAR_SEGMENT_MAX = 18;

type Contexte = Parameters<DependancesVideoLongue["monter"]>[1];

/** Plage notée : la clé du morceau et l'empreinte de ce qui l'a produit (une retouche ne réutilise jamais un vieux morceau). */
export type PlageNotee = { sortieCle: string; empreinte: string };

export interface PortsMontageVideoLongue {
  rendu: ServiceRendu;
  signer: (lectures: Record<string, string>, depots: { cle: string; mime: string }[]) => Promise<{ lectures: Record<string, string>; depots: Record<string, string> }>;
  /** Clé de stockage d'une sortie de la vidéo (`studio/{env}/videos/{videoId}/{nom}`). */
  cle: (c: CommandeFabrication, nom: string) => string;
  lirePlages(videoId: string): Promise<Record<string, PlageNotee>>;
  ecrirePlages(videoId: string, plages: Record<string, PlageNotee>): Promise<void>;
  /** Attente entre deux lectures d'état (tests : rien). */
  attendre?: (ms: number) => Promise<void>;
  intervalleMs?: number;
  /** Relit le réglage `videoLongue.actif` (sans cache) : appelé avant CHAQUE plage ; faux = arrêt net, rien de plus ne part. */
  actif?: () => Promise<boolean>;
  delaiCollageMs?: number;
  /** Délai d'une plage (ms) pour le montage pas à pas ; défaut : celui du serveur de rendu. */
  delaiPlageMs?: number;
  /** Heure courante (ms) : tests seulement. */
  maintenant?: () => number;
}

/** Erreur du montage : non réessayable quand c'est le script lui-même qui est en cause (`problemes` dit quoi). */
export class ErreurMontageVideoLongue extends Error {
  constructor(message: string, readonly problemes: string[] = [], readonly reessayable = false) {
    super(message);
    this.name = "ErreurMontageVideoLongue";
  }
}

const empreinte = (v: unknown): string => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 24);
/** Caractères admis par studio-rendu pour un idRendu : `[A-Za-z0-9_.:-]`, 120 au plus. */
const idSur = (v: string): string => v.replace(/[^A-Za-z0-9_.:-]/g, "_");
/** Identifiant d'un morceau/collage : borné à 120 caractères (le début est haché si le tout est trop long). */
const idBorne = (v: string): string => (v.length <= 100 ? v : `${v.slice(0, 60)}-${createHash("sha256").update(v).digest("hex").slice(0, 24)}`);
/** Erreurs réessayables consécutives de lecture d'état tolérées avant d'échouer la plage. */
const MAX_ERREURS_ETAT_DE_SUITE = 5;
const attendreParDefaut = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Segments d'un chapitre, calés sur le temps des mots, en temps de la vidéo ENTIÈRE. PUR. */
export function segmentsDuChapitre(mots: MotHorodate[], debutMs: number, finMs: number): SegmentCale[] {
  const segments: SegmentCale[] = [];
  let courant: MotHorodate[] = [];
  const clore = () => {
    if (!courant.length) return;
    const d = Math.min(finMs, Math.max(debutMs, Math.round(courant[0].debutSec * 1000)));
    const f = Math.min(finMs, Math.max(d, Math.round(courant[courant.length - 1].finSec * 1000)));
    segments.push({ texte: courant.map((m) => m.mot).join(" "), debutMs: d, finMs: f });
    courant = [];
  };
  for (const m of mots) {
    courant.push(m);
    if (/[.!?…]$/.test(m.mot) || courant.length >= MOTS_PAR_SEGMENT_MAX) clore();
  }
  clore();
  return segments;
}

/** Chapitres pour le plan : les mots de chaque chapitre sont ceux qui commencent dans sa tranche de temps. PUR. */
export function chapitresPourPlan(ctx: Contexte): ChapitrePourPlan[] {
  return ctx.chapitres.map((c, i) => {
    const debutMs = Math.round(c.debutSec * 1000);
    const finMs = Math.round(c.finSec * 1000);
    const dernier = i === ctx.chapitres.length - 1;
    // Même tolérance des deux côtés de la frontière : un mot n'est jamais perdu ni compté dans deux chapitres.
    const tol = TOLERANCE_DEBUT_CHAPITRE_MS;
    const mots = ctx.mots.filter((m) => (i === 0 || m.debutSec * 1000 >= debutMs - tol) && (dernier || m.debutSec * 1000 < finMs - tol));
    return { id: `c${i + 1}`, debutMs, finMs, segments: segmentsDuChapitre(mots, debutMs, finMs) };
  });
}

/** Soumet une demande et attend sa fin ; `inconnu` = le conteneur a redémarré : même demande, soumise à nouveau. */
async function soumettreEtAttendre(demande: DemandeRendu, ports: PortsMontageVideoLongue, signal: AbortSignal): Promise<{ sortieCle: string }> {
  const attendre = ports.attendre ?? attendreParDefaut;
  const intervalle = ports.intervalleMs ?? INTERVALLE_ETAT_RENDU_MS;
  await ports.rendu.soumettre(demande);
  let erreursDeSuite = 0;
  for (;;) {
    if (signal.aborted) throw new Error("délai dépassé");
    let e: Awaited<ReturnType<ServiceRendu["etat"]>>;
    try {
      e = await ports.rendu.etat(demande.idRendu);
      erreursDeSuite = 0;
    } catch (err) {
      // Une lecture d'état qui échoue (réseau, service redémarré) ne perd pas la plage : quelques essais espacés d'abord.
      if (!(err instanceof ErreurRendu) || !err.reessayable || ++erreursDeSuite >= MAX_ERREURS_ETAT_DE_SUITE) throw err;
      await attendre(intervalle);
      continue;
    }
    if (e.statut === "termine") return { sortieCle: e.sortieCle || demande.sortie.cle };
    if (e.statut === "echec") throw new Error(`Le rendu a échoué : ${e.erreur.message}`);
    if (e.statut === "inconnu") await ports.rendu.soumettre(demande);
    await attendre(intervalle); // y compris après un renvoi : pas de boucle serrée sur un service qui répond « inconnu »
  }
}

/** Port de rendu d'une plage : opération `composition` (mode `plage`), file longue, morceau muet déposé sous une clé stable. */
function portRenduPlage(commande: CommandeFabrication, ports: PortsMontageVideoLongue): PortRenduPlage {
  return {
    async rendre(d: DemandePlage) {
      // Le réglage peut avoir été éteint pendant un long montage : relu avant chaque plage.
      if (ports.actif && (await ports.actif()) !== true) throw new Error("La vidéo longue a été éteinte : le montage s'arrête, rien de plus n'est lancé.");
      const cle = ports.cle(commande, `video-longue-plages/${d.idRendu}.mp4`);
      const signe = await ports.signer({}, [{ cle, mime: "video/mp4" }]);
      const demande: DemandeRendu = { idRendu: d.idRendu, operation: "composition", file: d.file, entrees: {}, sortie: { urlDepot: signe.depots[cle], cle }, parametres: d.parametres };
      return soumettreEtAttendre(demande, ports, d.signal);
    },
  };
}

/** Plan sans scène (PUR) : mêmes habillage et durée que les autres chapitres, rien à dessiner de plus. */
function planVide(format: FormatVideoLongue, dureeMs: number): PlanValide {
  return { version: "plan-scenes-1", format, facecam: false, dureeMs, habillage: { fond: "ivoire", accent: "terracotta" }, mots: [], scenes: [] } as unknown as PlanValide;
}

/** Paramètres du collage : `m0..mN` dans l'ordre ; `voix` seulement si une voix est donnée (jamais en sans-voix). PUR. */
export function parametresCollage(nbMorceaux: number, avecVoix: boolean): { noms: string[]; parametres: Record<string, unknown> } {
  const noms = Array.from({ length: nbMorceaux }, (_, i) => `m${i}`);
  return { noms, parametres: { morceaux: noms, ...(avecVoix ? { voix: "voix" } : {}) } };
}

/**
 * Monte la vidéo longue (16:9) et rend `{ fichierCle }`. Aucun appel IA, aucun fournisseur de voix.
 * Seul le mode sans voix est relié ici : la pose d'une voix au collage n'est pas branchée (voir `video-longue-branchements`).
 */
export async function monterVideoLongue(commande: CommandeFabrication, travailId: string, ctx: Contexte, ports: PortsMontageVideoLongue): Promise<{ fichierCle: string }> {
  const videoId = commande.videoId;
  const plan = await planVideoLongue(chapitresPourPlan(ctx));
  if (!plan.valide) throw new ErreurMontageVideoLongue(`Le plan de la vidéo n'a pas pu être préparé : ${plan.problemes.join(" ")}`, plan.problemes);

  // Données du calque que la composition dessine (`proprietes.sousTitres`, UI-5) ; 16:9, style par défaut.
  const segmentsSousTitres = fabriquerSousTitres({ texte: ctx.mots.map((m) => m.mot).join(" "), dureeSec: ctx.dureeSec, mots: ctx.mots, ratio: "16:9" });
  const sousTitres = donneesCalque({ segments: segmentsSousTitres, base: "karaoke", ratio: "16:9" });

  // Reprise : seules les plages notées avec la MÊME empreinte (même plan, mêmes bornes, mêmes sous-titres) sont gardées.
  const notees = await ports.lirePlages(videoId);
  const toutes: Record<string, PlageNotee> = { ...notees };
  const morceaux: MorceauRendu[] = [];
  const rendu = portRenduPlage(commande, ports);
  for (const c of plan.chapitres) {
    // Aucune scène à poser sur ce chapitre : plan vide de la bonne durée (le fond et les sous-titres restent dessinés).
    const planChapitre = c.plan ?? planVide(plan.format, c.finMs);
    const empreinteChapitre = empreinte({ plan: planChapitre, debutMs: c.debutMs, finMs: c.finMs, sousTitres });
    const dejaRendus: Record<string, string> = {};
    // L'empreinte du contenu entre dans l'identifiant : un contenu modifié a d'autres identifiants (le serveur de rendu ignore
    // un idRendu déjà connu et garde son résultat 24 h) ; le MÊME contenu garde les mêmes (relance parallèle sans doublon).
    const idVideo = idBorne(`${idSur(videoId)}-${empreinteChapitre.slice(0, 10)}`);
    for (const [id, n] of Object.entries(notees)) if (n.empreinte === empreinteChapitre && id.startsWith(`${idVideo}-${c.id}-p`)) dejaRendus[id] = n.sortieCle;
    morceaux.push(
      ...(await rendreChapitres(
        {
          idVideo,
          composition: COMPOSITION_VIDEO_LONGUE,
          proprietes: { plan: planChapitre, sousTitres },
          chapitres: [{ id: c.id, debutMs: c.debutMs, finMs: c.finMs }],
          dejaRendus,
          apresPlage: async (m) => {
            toutes[m.idRendu] = { sortieCle: m.sortieCle, empreinte: empreinteChapitre };
            await ports.ecrirePlages(videoId, toutes);
          },
        },
        rendu,
      )),
    );
  }

  // Collage : sans voix, aucune piste son.
  const { noms, parametres } = parametresCollage(morceaux.length, false);
  const sortieCle = ports.cle(commande, nomFichierVideoLongue16x9(travailId));
  const signe = await ports.signer(Object.fromEntries(noms.map((n, i) => [n, morceaux[i].sortieCle])), [{ cle: sortieCle, mime: "video/mp4" }]);
  const demande: DemandeRendu = {
    idRendu: idBorne(`${idSur(videoId)}-collage-${empreinte({ travailId, morceaux: morceaux.map((m) => m.idRendu) }).slice(0, 16)}`),
    operation: "collage-chapitres",
    file: "longue",
    entrees: Object.fromEntries(noms.map((n) => [n, signe.lectures[n]])),
    sortie: { urlDepot: signe.depots[sortieCle], cle: sortieCle },
    parametres,
  };
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), ports.delaiCollageMs ?? DELAI_COLLAGE_MS);
  try {
    return { fichierCle: (await soumettreEtAttendre(demande, ports, controleur.signal)).sortieCle };
  } finally {
    clearTimeout(minuterie);
  }
}


/* ------------------------------------------------------------------ */
/* Montage PAS À PAS (FIN-8) : chaque appel fait UNE action de rendu    */
/* ------------------------------------------------------------------ */

interface PlageDuPas {
  id: string;
  plage: PlageARendre;
  empreinte: string;
  parametres: Record<string, unknown>;
}

/** Lit l'état d'une demande une fois. Réessayable : `{ erreurs }` (on relira au pas suivant) ; sinon l'erreur remonte, lisible. */
async function relireUneFois(idRendu: string, ports: PortsMontageVideoLongue, erreursAvant: number): Promise<{ etat: Awaited<ReturnType<ServiceRendu["etat"]>> } | { erreurs: number }> {
  try {
    return { etat: await ports.rendu.etat(idRendu) };
  } catch (err) {
    if (!(err instanceof ErreurRendu)) throw err;
    if (err.reessayable && erreursAvant + 1 < MAX_ERREURS_ETAT_DE_SUITE) return { erreurs: erreursAvant + 1 };
    throw new ErreurMontageVideoLongue(`Le service de rendu ne répond pas comme prévu, le montage s'arrête : ${err.message}`, [], err.reessayable);
  }
}

/** Soumet une demande de rendu. Une erreur du service garde le caractère (définitif ou passager) donné par le serveur. */
async function soumettreUneFois(demande: DemandeRendu, ports: PortsMontageVideoLongue): Promise<void> {
  try {
    await ports.rendu.soumettre(demande);
  } catch (err) {
    if (!(err instanceof ErreurRendu)) throw err;
    throw new ErreurMontageVideoLongue(`Le service de rendu a refusé la demande, le montage s'arrête : ${err.message}`, [], err.reessayable);
  }
}

/**
 * UN PAS du montage (16:9), à rappeler jusqu'à `fini`. Mêmes plan, sous-titres, empreintes et identifiants que `monterVideoLongue`.
 * Un pas ne fait QU'UNE action de rendu : soumettre une plage, ou relire l'état de la demande en cours (jamais d'attente en boucle).
 * Ordre : plage en cours -> relire ; sinon prochaine plage non rendue -> soumettre ; sinon collage -> soumettre ou relire.
 * Le réglage `videoLongue.actif` est relu à chaque pas : éteint, le pas s'arrête net et rien de plus n'est soumis.
 */
export async function pasMontageVideoLongue(commande: CommandeFabrication, travailId: string, ctx: Contexte, ports: PortsMontageVideoLongue, suivi?: SuiviMontageVideoLongue): Promise<PasMontageVideoLongue> {
  if (ports.actif && (await ports.actif()) !== true) throw new ErreurMontageVideoLongue("La vidéo longue a été éteinte : le montage s'arrête, rien de plus n'est lancé. Rallumez-la puis réessayez.", [], true);
  const maintenant = ports.maintenant ?? Date.now;
  const videoId = commande.videoId;
  const plan = await planVideoLongue(chapitresPourPlan(ctx));
  if (!plan.valide) throw new ErreurMontageVideoLongue(`Le plan de la vidéo n'a pas pu être préparé : ${plan.problemes.join(" ")}`, plan.problemes);
  const segmentsSousTitres = fabriquerSousTitres({ texte: ctx.mots.map((m) => m.mot).join(" "), dureeSec: ctx.dureeSec, mots: ctx.mots, ratio: "16:9" });
  const sousTitres = donneesCalque({ segments: segmentsSousTitres, base: "karaoke", ratio: "16:9" });

  // Toutes les plages, dans l'ordre (mêmes identifiants et empreintes que le montage « tout d'un coup »).
  const plages: PlageDuPas[] = [];
  for (const c of plan.chapitres) {
    const planChapitre = c.plan ?? planVide(plan.format, c.finMs);
    const empreinteChapitre = empreinte({ plan: planChapitre, debutMs: c.debutMs, finMs: c.finMs, sousTitres });
    const idVideo = idBorne(`${idSur(videoId)}-${empreinteChapitre.slice(0, 10)}`);
    for (const plage of plagesDesChapitres([{ id: c.id, debutMs: c.debutMs, finMs: c.finMs }])) {
      plages.push({ id: idRenduPlage(idVideo, plage), plage, empreinte: empreinteChapitre, parametres: parametresPlage(plage, { composition: COMPOSITION_VIDEO_LONGUE, proprietes: { plan: planChapitre, sousTitres } }) });
    }
  }

  // Reprise : plages notées avec la MÊME empreinte, plus celles que ce suivi a déjà vues terminées.
  const notees = await ports.lirePlages(videoId);
  const courant: SuiviMontageVideoLongue = { plages: {}, ...(suivi?.enCours ? { enCours: suivi.enCours } : {}), ...(suivi?.collage ? { collage: suivi.collage } : {}) };
  for (const p of plages) {
    const n = notees[p.id];
    const cle = n && n.empreinte === p.empreinte ? n.sortieCle : suivi?.plages[p.id];
    if (cle) courant.plages[p.id] = cle;
  }
  const total = plages.length + 1;
  const fait = () => Object.keys(courant.plages).length;
  const enCours = (): PasMontageVideoLongue => ({ enCours: { suivi: courant, fait: fait(), total } });

  const demandePlage = async (p: PlageDuPas): Promise<DemandeRendu> => {
    const cle = ports.cle(commande, `video-longue-plages/${p.id}.mp4`);
    const signe = await ports.signer({}, [{ cle, mime: "video/mp4" }]);
    return { idRendu: p.id, operation: "composition", file: "longue", entrees: {}, sortie: { urlDepot: signe.depots[cle], cle }, parametres: p.parametres };
  };

  // 1. Plage en cours : relire son état UNE fois.
  const attendue = courant.enCours ? plages.find((p) => p.id === courant.enCours!.idRendu && !courant.plages[p.id]) : undefined;
  if (courant.enCours && !attendue) delete courant.enCours; // terminée entre-temps, ou plus au plan (contenu retouché)
  if (attendue && courant.enCours) {
    const lu = await relireUneFois(attendue.id, ports, courant.enCours.erreurs);
    if ("erreurs" in lu) {
      courant.enCours = { ...courant.enCours, erreurs: lu.erreurs };
      return enCours();
    }
    const e = lu.etat;
    if (e.statut === "termine") {
      courant.plages[attendue.id] = e.sortieCle || ports.cle(commande, `video-longue-plages/${attendue.id}.mp4`);
      delete courant.enCours;
      await ports.ecrirePlages(videoId, { ...notees, ...Object.fromEntries(plages.filter((p) => courant.plages[p.id]).map((p) => [p.id, { sortieCle: courant.plages[p.id], empreinte: p.empreinte }])) });
      return enCours();
    }
    if (e.statut === "echec") throw new ErreurMontageVideoLongue(`Le rendu d'une partie de la vidéo a échoué : ${e.erreur.message}`, [], false);
    if (maintenant() - courant.enCours.depuisMs > (ports.delaiPlageMs ?? DELAI_MAX_PLAGE_MS)) throw new ErreurMontageVideoLongue("Une partie de la vidéo prend trop de temps à se rendre (délai dépassé), vous pouvez réessayer.", [], true);
    // « inconnu » : le conteneur a redémarré. On n'enchaîne pas : la même demande (même identifiant) repart au pas suivant.
    if (e.statut === "inconnu") delete courant.enCours;
    else courant.enCours = { ...courant.enCours, erreurs: 0 };
    return enCours();
  }

  // 2. Prochaine plage non rendue : la soumettre.
  const prochaine = plages.find((p) => !courant.plages[p.id]);
  if (prochaine) {
    await soumettreUneFois(await demandePlage(prochaine), ports);
    courant.enCours = { idRendu: prochaine.id, depuisMs: maintenant(), erreurs: 0 };
    return enCours();
  }

  // 3. Collage : sans voix, aucune piste son.
  const morceaux = plages.map((p) => ({ idRendu: p.id, sortieCle: courant.plages[p.id] }));
  const { noms, parametres } = parametresCollage(morceaux.length, false);
  const sortieCle = ports.cle(commande, nomFichierVideoLongue16x9(travailId));
  const idCollage = idBorne(`${idSur(videoId)}-collage-${empreinte({ travailId, morceaux: morceaux.map((m) => m.idRendu) }).slice(0, 16)}`);
  const demandeCollage = async (): Promise<DemandeRendu> => {
    const signe = await ports.signer(Object.fromEntries(noms.map((n, i) => [n, morceaux[i].sortieCle])), [{ cle: sortieCle, mime: "video/mp4" }]);
    return { idRendu: idCollage, operation: "collage-chapitres", file: "longue", entrees: Object.fromEntries(noms.map((n) => [n, signe.lectures[n]])), sortie: { urlDepot: signe.depots[sortieCle], cle: sortieCle }, parametres };
  };
  if (!courant.collage || courant.collage.idRendu !== idCollage) {
    await soumettreUneFois(await demandeCollage(), ports);
    courant.collage = { idRendu: idCollage, depuisMs: maintenant(), erreurs: 0 };
    return { enCours: { suivi: courant, fait: plages.length, total } };
  }
  const lu = await relireUneFois(idCollage, ports, courant.collage.erreurs);
  if ("erreurs" in lu) {
    courant.collage = { ...courant.collage, erreurs: lu.erreurs };
    return { enCours: { suivi: courant, fait: plages.length, total } };
  }
  const e = lu.etat;
  // La taille mesurée par le collage est transmise seulement si c'est un nombre positif (sinon : inconnue).
  if (e.statut === "termine") return { fini: { fichierCle: e.sortieCle || sortieCle, ...(typeof e.mesures?.taille === "number" && e.mesures.taille > 0 ? { taille: e.mesures.taille } : {}) } };
  if (e.statut === "echec") throw new ErreurMontageVideoLongue(`Le collage de la vidéo a échoué : ${e.erreur.message}`, [], false);
  if (maintenant() - courant.collage.depuisMs > (ports.delaiCollageMs ?? DELAI_COLLAGE_MS)) throw new ErreurMontageVideoLongue("L'assemblage final prend trop de temps (délai dépassé), vous pouvez réessayer.", [], true);
  // « inconnu » : le collage repart (même identifiant) au pas suivant, pas dans celui-ci.
  if (e.statut === "inconnu") delete courant.collage;
  else courant.collage = { ...courant.collage, erreurs: 0 };
  return { enCours: { suivi: courant, fait: plages.length, total } };
}
