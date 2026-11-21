/**
 * RACCORDS DE LA « VIDÉO LONGUE » (fiche VL-07) — SENSIBLE ARGENT, ÉTEINT PAR DÉFAUT.
 *
 * Ce que les services branchent sur le moteur `montage-video-longue` (pur : il n'importe jamais un service) : la voix par
 * morceaux de 5 000 caractères, l'aligneur (facultatif) et le montage. Chargé pour son effet par la boucle de fond.
 *
 * RÈGLES D'ARGENT (décision de Williams du 18/11/2026, réponse de will-dc) :
 *  - Réglage de dépenses `videoLongue.actif` : absent, ou autre que `true` EXACT = AUCUN appel payant, rien ne part. Le réglage est relu
 *    (base, sans cache) avant CHAQUE appel payant ; le moteur n'est en plus « relié » que si la dernière lecture disait `true`.
 *  - Accord EXPLICITE par vidéo (`commande.entrees.videoLongue.accord`) : `donne === true`, pour CETTE vidéo, avec les quantités
 *    affichées (caractères, morceaux). Une vidéo dont le script dépasse ces quantités est refusée avant tout appel.
 *  - Plafond de 10 $ par vidéo, vérifié AVANT chaque appel dans le PIRE CAS : déjà dépensé + tout ce qui reste à lire (au tarif
 *    maximal). Le registre de dépense est écrit AVANT l'appel (une panne en vol ne fait jamais sous-compter), rendu si l'appel
 *    n'est jamais parti. Au plafond : arrêt propre, une phrase claire, aucun appel.
 *  - Chemin gardé existant : chaque lecture passe par `verifierEtReserverSelonOrigine` (crédits, budget du mois), jamais un
 *    appel direct au fournisseur.
 *  - Reprise : chaque morceau lu est GARDÉ (clé = vidéo + empreinte du texte + voix). Après un échec, ou une retouche, seul ce
 *    qui n'est pas déjà fait est payé.
 *  - Rien n'est payé tant que le montage n'est pas prêt (les voix ne partent pas pour rien).
 *
 * Montage réel (UI-4) : `video-longue-montage.ts`, relié pour le mode SANS voix seulement (`MONTAGE_AVEC_VOIX_RELIE` faux :
 * avec voix, pause et rien n'est payé). Pas encore branché : l'aligneur réel (HeyGen rend déjà l'horodatage des mots).
 * Tant que le montage n'est pas relié, `montagePret()` est faux : AUCUNE voix n'est lue, rien n'est payé.
 */
import "server-only";
import { createHash } from "node:crypto";
import type { CommandeFabrication, MotHorodate, Ratio } from "@/domaine/types";
import { CENTIMES_USD_PAR_CARACTERE_HEYGEN } from "@/fournisseurs/heygen/voix";
import { decouperScript, type LectureMorceau, type MorceauVoix } from "@/briques/voix-longue";
import { lireEntreesVideoLongue } from "@/moteurs/montage-video-longue/entrees";
import { creerMoteurVideoLongue, moteurMontageVideoLongue, DUREE_MAX_SEC } from "@/moteurs/montage-video-longue";
import type { DependancesVideoLongue } from "@/moteurs/montage-video-longue/chaine";

/** Réglage de dépenses : seul `true` exact allume. */
export const PARAM_VIDEO_LONGUE_ACTIF = "videoLongue.actif";
/** Montage réel relié (plan, plages, collage : `video-longue-montage.ts`) ? Faux = PAUSE, jamais un échec. */
export const MONTAGE_VIDEO_LONGUE_RELIE = true;
/** Voix posée au collage ? Pas encore : seul le mode SANS voix est relié ; avec voix, pause et rien n'est payé (aucune voix lue pour rien). */
export const MONTAGE_AVEC_VOIX_RELIE = false;
/** Plafond par vidéo : 10 $ (décision du 18/11), en centimes de dollar. */
export const PLAFOND_VIDEO_LONGUE_CENTIMES_USD = 1000;

/** Un morceau lu et PAYÉ : on garde aussi son son (`fichierCle`, ou la copie encore en attente), pour ne jamais le repayer au montage. */
export type LectureGardee = LectureMorceau & { fichierCle?: string; copieEnAttente?: { adresse: string; idDemande: string; idExterne?: string } };

/** Pourquoi rien n'est parti. */
export type MotifRefusVideoLongue = "eteint" | "sans-accord" | "accord-depasse" | "plafond" | "montage-non-relie" | "fournisseur" | "sans-voix" | "sans-personnage" | "duree-depassee";

export class ErreurVideoLongue extends Error {
  constructor(readonly motif: MotifRefusVideoLongue, message: string) {
    super(message);
    this.name = "ErreurVideoLongue";
  }
}

/** Accord de Williams pour UNE vidéo, avec les quantités qui lui ont été montrées. */
export interface AccordVideoLongue {
  donne: true;
  videoId: string;
  caracteres: number;
  morceaux: number;
}

/** Lit l'accord dans la commande. Tout ce qui n'est pas exactement valide pour CETTE vidéo vaut « pas d'accord ». */
export function lireAccordVideoLongue(commande: Pick<CommandeFabrication, "videoId" | "entrees">): AccordVideoLongue | null {
  const brut = ((commande.entrees as Record<string, unknown> | undefined)?.videoLongue as { accord?: unknown } | undefined)?.accord as Record<string, unknown> | undefined;
  if (!brut || brut.donne !== true || brut.videoId !== commande.videoId) return null;
  const { caracteres, morceaux } = brut;
  if (typeof caracteres !== "number" || !Number.isInteger(caracteres) || caracteres <= 0) return null;
  if (typeof morceaux !== "number" || !Number.isInteger(morceaux) || morceaux <= 0) return null;
  return { donne: true, videoId: commande.videoId, caracteres, morceaux };
}

/** Pire cas d'une lecture de `caracteres` caractères, en centimes de dollar (centime supérieur). */
export const pireCasVoixCentimesUsd = (caracteres: number): number => Math.ceil(caracteres * CENTIMES_USD_PAR_CARACTERE_HEYGEN - 1e-9);

/** Registre de dépense (centimes de dollar, par vidéo) et morceaux déjà lus. Réel : paramètres de la base. */
export interface RegistreVideoLongue {
  depense(videoId: string): Promise<number>;
  ecrireDepense(videoId: string, centimesUsd: number): Promise<void>;
  morceauFait(cle: string): Promise<LectureGardee | null>;
  noterMorceau(cle: string, lecture: LectureGardee): Promise<void>;
}

export interface PortsVideoLongue {
  /** Lecture du réglage `videoLongue.actif` (sans cache). */
  actif(): Promise<boolean>;
  registre: RegistreVideoLongue;
  /** Le montage réel est-il relié ? Faux = aucune voix n'est lue. */
  montagePret(): Promise<boolean>;
  /** Chemin gardé de l'argent (crédits, budget du mois) : lève si refus. Appelé avant la lecture, jamais après. */
  reserver(e: { caracteres: number; centimesUsd: number; morceau: number }): Promise<void>;
  /** Voix du double (HeyGen) : lit UN morceau. Seul point qui paie. */
  lireMorceau(texte: string): Promise<LectureGardee>;
  /** Voix du double (entre dans la clé de reprise : une autre voix = un autre son). Absent = clé sans voix. */
  idVoix?(): Promise<string>;
  /** Facultatif : horodatage des mots quand la voix n'en rend pas. */
  aligner?(texte: string, lecture: LectureMorceau): Promise<MotHorodate[]>;
  /** Montage réel d'un format (jamais appelé si éteint ou sans accord). */
  monter?(ratio: Ratio, ctx: Parameters<DependancesVideoLongue["monter"]>[1]): Promise<{ fichierCle: string }>;
}

export const empreinteMorceau = (videoId: string, texte: string, idVoix = ""): string => `videoLongue.voix.${videoId}.${createHash("sha256").update(`${idVoix}\n${texte}`).digest("hex").slice(0, 24)}`;
const cleDepense = (videoId: string): string => `videoLongue.depense.${videoId}`;

const PHRASES: Record<MotifRefusVideoLongue, string> = {
  eteint: "La vidéo longue est éteinte : rien n'est parti, rien n'est payé.",
  "sans-accord": "Votre accord pour cette vidéo manque : rien n'est parti, rien n'est payé.",
  "accord-depasse": "Le script dépasse les quantités que vous avez acceptées : rien n'est parti, rien n'est payé. Relancez en confirmant les nouvelles quantités.",
  plafond: "Le plafond prévu pour cette vidéo serait dépassé : la fabrication s'arrête ici. Ce qui est déjà lu est gardé, rien de plus n'est payé.",
  "montage-non-relie": "Le montage de la vidéo longue n'est pas encore relié : aucune voix n'est lue, rien n'est payé.",
  "sans-voix": "Mode sans voix : aucune voix n'est lue, rien n'est payé pour la voix.",
  "sans-personnage": "Choisissez qui parle : rien n'est parti, rien n'est payé.",
  "duree-depassee": "La vidéo dépasse la durée maximale prévue (20 minutes) : rien n'a été monté, rien n'est payé. Raccourcissez le script.",
  fournisseur: "La voix n'a pas pu être lue : vous pouvez réessayer, ce qui est déjà fait est conservé.",
};
const refus = (m: MotifRefusVideoLongue): ErreurVideoLongue => new ErreurVideoLongue(m, PHRASES[m]);

/**
 * Dépendances du moteur, bâties sur des PORTS. Aucun port n'est touché à la construction. Chaque appel payant refait, dans
 * cet ordre : réglage allumé, accord, quantités dans l'accord, plafond (pire cas), montage prêt, réservation gardée, appel.
 */
export function creerDependancesVideoLongue(commande: CommandeFabrication, ports: PortsVideoLongue): DependancesVideoLongue {
  const entrees = lireEntreesVideoLongue(commande);
  const accord = lireAccordVideoLongue(commande);
  const videoId = commande.videoId;

  /** Contrôles communs à tout appel payant (voix, aligneur, montage). */
  const garder = async (): Promise<AccordVideoLongue> => {
    if ((await ports.actif()) !== true) throw refus("eteint");
    // Sans voix : rien à accorder (aucune quantité de voix, 0 €) ; seul le réglage « allumé » compte.
    if (entrees.sansVoix) return { donne: true, videoId, caracteres: 0, morceaux: 0 };
    if (!accord) throw refus("sans-accord");
    return accord;
  };

  return {
    voix: {
      async lire(morceau: MorceauVoix): Promise<LectureMorceau> {
        // Mode sans voix : AUCUN appel HeyGen, aucun port touché, aucune réservation (le moteur n'appelle d'ailleurs pas ce port).
        if (entrees.sansVoix) throw refus("sans-voix");
        // Avec voix : sans personnage choisi, refus clair avant tout port (la distribution n'est plus exigée par le format).
        if (!commande.distribution?.[0]?.personnageId) throw refus("sans-personnage");
        const a = await garder();
        const tous = decouperScript(entrees.chapitres);
        if (tous.length > a.morceaux || tous.reduce((s, m) => s + m.texte.length, 0) > a.caracteres) throw refus("accord-depasse");
        const idVoix = (await ports.idVoix?.()) ?? "";
        const cleDe = (texte: string) => empreinteMorceau(videoId, texte, idVoix);
        const cle = cleDe(morceau.texte);
        // Reprise : un morceau déjà lu (même texte) n'est jamais relu ni repayé.
        const fait = await ports.registre.morceauFait(cle);
        if (fait) return fait;
        if (!(await ports.montagePret())) throw refus("montage-non-relie");
        // Pire cas : déjà dépensé + ce morceau + tous les morceaux encore à lire (jamais payé pour s'arrêter au milieu).
        const depense = await ports.registre.depense(videoId);
        let restant = 0;
        for (const m of tous) if (m.index === morceau.index || !(await ports.registre.morceauFait(cleDe(m.texte)))) restant += pireCasVoixCentimesUsd(m.texte.length);
        if (depense + restant > PLAFOND_VIDEO_LONGUE_CENTIMES_USD) throw refus("plafond");
        const centimesUsd = pireCasVoixCentimesUsd(morceau.texte.length);
        // Registre écrit AVANT l'appel ; rendu seulement si l'appel n'est jamais parti.
        await ports.registre.ecrireDepense(videoId, depense + centimesUsd);
        try {
          await ports.reserver({ caracteres: morceau.texte.length, centimesUsd, morceau: morceau.index });
        } catch (e) {
          await ports.registre.ecrireDepense(videoId, depense);
          throw e;
        }
        let lecture: LectureGardee;
        try {
          lecture = await ports.lireMorceau(morceau.texte);
        } catch (e) {
          // Le fournisseur a pu facturer : la dépense reste au registre (prudence).
          throw e instanceof ErreurVideoLongue ? e : Object.assign(refus("fournisseur"), { cause: e });
        }
        if (lecture.mots.length === 0 && ports.aligner) lecture = { ...lecture, mots: await ports.aligner(morceau.texte, lecture) };
        await ports.registre.noterMorceau(cle, lecture);
        return lecture;
      },
    },
    async monter(ratio, ctx) {
      await garder();
      // Durée trop longue : refus net AVANT tout rendu (le mode sans voix n'a pas d'accord qui la borne).
      if (ctx.dureeSec > DUREE_MAX_SEC) throw refus("duree-depassee");
      if (!ports.monter || !(await ports.montagePret())) throw refus("montage-non-relie");
      return ports.monter(ratio, ctx);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Ports réels (chargés à la demande, jamais à l'import)                 */
/* ------------------------------------------------------------------ */

async function registreReel(): Promise<RegistreVideoLongue> {
  const { lireParametre, ecrireParametre } = await import("./_commun");
  return {
    depense: async (videoId) => Number(await lireParametre<number>(cleDepense(videoId), 0)) || 0,
    ecrireDepense: (videoId, c) => ecrireParametre(cleDepense(videoId), c),
    morceauFait: async (cle) => (await lireParametre<LectureGardee | null>(cle, null)) ?? null,
    noterMorceau: (cle, l) => ecrireParametre(cle, l),
  };
}

async function portsReels(commande: CommandeFabrication, travailId: string): Promise<PortsVideoLongue> {
  const { lireParametre } = await import("./_commun");
  const registre = await registreReel();
  let branches: ReturnType<(typeof import("./tableau-outils"))["branchementsReels"]> | undefined;
  const branchements = () => {
    const personnageId = commande.distribution[0]?.personnageId;
    if (!personnageId) throw refus("sans-personnage");
    return (branches ??= import("./tableau-outils").then((m) => m.branchementsReels(personnageId, commande.videoId)));
  };
  return {
    actif: async () => (await lireParametre<unknown>("videoLongue.actif", false)) === true,
    registre,
    // Montage réel pas encore relié (collage de chapitres : déclaration du contrat de rendu, zone de will-dc) : rien n'est lu.
    montagePret: async () => MONTAGE_VIDEO_LONGUE_RELIE && (lireEntreesVideoLongue(commande).sansVoix || MONTAGE_AVEC_VOIX_RELIE),
    // Montage : rendu et stockage seulement (`branchementsReelsSansVoix`), jamais HeyGen, même quand la commande a une voix.
    monter: async (_ratio, ctx) => {
      const { branchementsReelsSansVoix } = await import("./tableau-outils");
      const { montage } = await branchementsReelsSansVoix(commande.videoId);
      const { monterVideoLongue, cleParametrePlages } = await import("./video-longue-montage");
      const { ecrireParametre } = await import("./_commun");
      return monterVideoLongue(commande, travailId, ctx, {
        rendu: montage.rendu(),
        signer: montage.signer,
        cle: montage.cle,
        actif: async () => (await lireParametre<unknown>("videoLongue.actif", false)) === true,
        lirePlages: async (v) => (await lireParametre<Record<string, { sortieCle: string; empreinte: string }> | null>(cleParametrePlages(v), null)) ?? {},
        ecrirePlages: (v, plages) => ecrireParametre(cleParametrePlages(v), plages),
      });
    },
    idVoix: async () => (await branchements()).voix.idVoix,
    reserver: async (e) => {
      const { verifierEtReserverSelonOrigine } = await import("./credits");
      const { centimes } = await import("@/lib/montants");
      const { cleDepenseUsine } = await import("./cle-depense-usine");
      const total = centimes(e.centimesUsd);
      await verifierEtReserverSelonOrigine(commande.origine, { lignes: [{ etape: "voix", fournisseur: "heygen", unite: "caractere", quantite: e.caracteres, prixUnitaire: centimes(CENTIMES_USD_PAR_CARACTERE_HEYGEN), total, nature: "estime" }], total }, total.centimes, "Cette vidéo", { videoId: commande.videoId, travailId, ...cleDepenseUsine(commande.origine, travailId) });
    },
    lireMorceau: async (texte) => {
      const v = (await branchements()).voix;
      const r = await v.voix().lire({ idExterne: v.idVoix, texte, reglages: v.reglages ?? { vitesse: 1, stabilite: 45, emotion: 30 }, prononciations: [], tauxUsdEur: v.tauxUsdEur });
      return { dureeSec: r.dureeSec, mots: r.mots, fichierCle: r.fichierCle, ...(r.copieEnAttente ? { copieEnAttente: { ...r.copieEnAttente, idExterne: v.idVoix } } : {}) };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Raccord sur le moteur                                                */
/* ------------------------------------------------------------------ */

/** Dernière lecture du réglage : il ne décide que de « moteur relié ou en pause » ; chaque appel payant relit le vrai réglage. */
const etatActif = { vu: false, deLe: 0, enCours: false };
const DUREE_CACHE_MS = 5_000;

function rafraichirActif(): void {
  if (etatActif.enCours || Date.now() - etatActif.deLe < DUREE_CACHE_MS) return;
  etatActif.enCours = true;
  void import("./_commun")
    .then(({ lireParametre }) => lireParametre<unknown>("videoLongue.actif", false))
    .then((v) => {
      etatActif.vu = v === true;
    })
    .catch(() => {
      etatActif.vu = false;
    })
    .finally(() => {
      etatActif.deLe = Date.now();
      etatActif.enCours = false;
    });
}

/** Lecture de test : le réglage a-t-il été vu allumé (`true` exact) ? Ne décide de rien d'autre. */
export const reglageVuAllume = (): boolean => etatActif.vu;

/** Dépendances réelles pour une commande : `null` (pause, rien n'est payé) tant que le réglage n'a pas été vu allumé. */
export function dependancesVideoLongue(commande: CommandeFabrication, travailId = commande.videoId): DependancesVideoLongue | null {
  rafraichirActif();
  if (!etatActif.vu) return null;
  // Pause (jamais un échec) tant que le montage réel n'est pas relié, et tant que l'accord de CETTE vidéo manque.
  if (!MONTAGE_VIDEO_LONGUE_RELIE) return null;
  if (!lireEntreesVideoLongue(commande).sansVoix && !MONTAGE_AVEC_VOIX_RELIE) return null;
  if (!lireEntreesVideoLongue(commande).sansVoix && !lireAccordVideoLongue(commande)) return null;
  let ports: Promise<PortsVideoLongue> | undefined;
  const p = (): Promise<PortsVideoLongue> => (ports ??= portsReels(commande, travailId));
  const paresseux: PortsVideoLongue = {
    actif: async () => (await p()).actif(),
    registre: {
      depense: async (v) => (await p()).registre.depense(v),
      ecrireDepense: async (v, c) => (await p()).registre.ecrireDepense(v, c),
      morceauFait: async (c) => (await p()).registre.morceauFait(c),
      noterMorceau: async (c, l) => (await p()).registre.noterMorceau(c, l),
    },
    montagePret: async () => (await p()).montagePret(),
    reserver: async (e) => (await p()).reserver(e),
    lireMorceau: async (t) => (await p()).lireMorceau(t),
    idVoix: async () => (await p()).idVoix?.() ?? "",
    monter: async (r, c) => (await p()).monter!(r, c),
  };
  return creerDependancesVideoLongue(commande, paresseux);
}

/** Pose les raccords sur le moteur inscrit (une fois par processus). */
export function brancherVideoLongue(): void {
  const g = globalThis as typeof globalThis & { [k: symbol]: unknown };
  const cle = Symbol.for("studio-axion-ia.video-longue-branche");
  if (g[cle]) return;
  g[cle] = true;
  Object.assign(moteurMontageVideoLongue, creerMoteurVideoLongue((c) => dependancesVideoLongue(c)));
  rafraichirActif();
}

brancherVideoLongue();
