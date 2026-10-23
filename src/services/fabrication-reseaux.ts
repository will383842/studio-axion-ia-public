/**
 * FABRICATION PAR RÉSEAU (générateur, lot G6 ; plan v5 B.2.3, B.4.2, B.6.17, B.8.10, B.10 ligne G6 ; accord de Will du
 * 03/10 pour la co-signature avec le moteur). Le savoir-faire est dans la brique commune `briques/declinaison` et dans
 * le moteur du format ; ce service ne fait que relier les versions du générateur à la fabrication :
 *
 *  - « Fabriquer les N » : la MÈRE (la version la plus longue de la ligne, 9:16 + ratios en option) est fabriquée en
 *    entier ; chaque autre version devient une vidéo `variante-reseau` (`sourceVideoId` = la mère) qui part dès que la
 *    mère est prête : seuls son début et sa fin sont lus et filmés, le corps est repris de la mère sur des coupes ;
 *  - un raccord qui se verrait (aucune coupe de la mère) : la version est fabriquée EN ENTIER, avec son coût affiché, et
 *    attend la confirmation de Will (jamais une dépense plus grande que celle qu'il a vue) ;
 *  - « 2e ouverture Reels » : la vidéo Instagram avec la 2e accroche finaliste (`variante-accroche`, fichier `-A2`) ;
 *  - la commande de chaque vidéo de version reçoit le texte ASSEMBLÉ de sa version, le texte DIT (prononciations
 *    appliquées une seule fois, liste vide), les réseaux cochés, l'union de leurs zones protégées, l'encadré, les
 *    parties (coupes imposées) et, pour une version sur mère, ce que la mère a produit ;
 *  - après chaque fabrication : C6, C7, C10, C11 et C26 relancés sur l'horodatage RÉEL, durée réelle, fiche `image`,
 *    et, pour une mère, le débit réel relevé (`debit.<format>.avatar`, recalage B.4.2).
 *
 * Aucun appel payant ici : tout passe par `lancerFabrication` (pré-vol budget et crédits). Moteurs payants simulés tant
 * qu'ils ne sont pas réels ; rien n'est effacé.
 */
import "server-only";
import { avecIncrustationAppel, choisirMere, debitMesure, etapesVariante, horodatageDesSegments, ratiosDeLaMere, raccordsSurMere, recalerDebit, zonesProtegeesUnion } from "@/briques/declinaison";
import { recontrolerSurHorodatageReel, type EntreeControle } from "@/domaine/controles-script";
import { controlerSelonAuteurs } from "@/domaine/relecture-generateur";
import type { OrigineLancement } from "./budget-mensuel";
import { entreeControleDeBlocs } from "./controles-version";
import { appliquerPrononciations, assemblerBlocs, versionsCourantes } from "@/domaine/derivations-generateur";
import { plansDepuisScript, texteScript } from "@/domaine/derivations";
import type { BlocScript, CommandeFabrication, Distribution, DistributionResolue, Id, IdReseau, LigneCout, MediaCommande, Montant, MereVariante, Plan, PlanCommande, PriseCommande, Prononciation, Ratio, Script, ScriptMaitre, VarianteReseau, Video } from "@/domaine/types";
import { MENTION_IA_PAR_DEFAUT } from "@/domaine/derivations";
import { partDoubleReel } from "@/domaine/double-reel";
import { visagePourFormat } from "@/domaine/distribution";
import { voixPourFormat } from "@/domaine/voix-format";
import type { PrisesVideo } from "./tournage";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import { briquesEffectives, debitLecture, dureeVideo, estimerDureeTexte, obtenirFormat, reglagesParDefaut } from "@/formats";
import { estBlocColle } from "@/domaine/relecture-script";
import { ADAPTATIONS_RESEAUX_PAR_DEFAUT, CLE_ADAPTATIONS_RESEAUX, adaptationsActives } from "@/reseaux/adaptations";
import { adapterBlocsDuCorps } from "@/reseaux/adaptation-derivation";
import { nouvelId } from "@/lib/ids";
import { additionner, centimes, TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { moteurDeCommande, obtenirMoteur, type Estimation } from "@/moteurs";
import { depots, ecrireParametre, ErreurStudio, fournisseurSimule, horodatage, journaliser, lireParametre, maintenant, sousVerrou } from "./_commun";
import { exigerSession } from "./auth";
import { creerNotification } from "./notifications";
import { decisionJeLis, moteurAuLancement } from "./reglages";
import { accordPropre, type AccordPrix } from "@/domaine/accord";
import { trouverMoi } from "./moi";
import { appliquerCascade, modeEconomique, optionsDuFormat } from "./illustrations";
import { capacitesRatios } from "./formats-voulus";

/** Ce que la commande d'une vidéo de version reçoit en plus pour ses plans indicatifs (VERIF-1 a1). */
interface ContexteGenerateur {
  distribution: DistributionResolue[];
  prononciations: Prononciation[];
  medias?: CommandeFabrication["medias"];
  /** Briques de la vidéo (illustrations coupées : aucun plan d'illustration). */
  briques?: Pick<CommandeFabrication["briques"], "illustrations">;
  /** Plans de l'Aperçu déjà passés par la cascade : repris par segment, sans réinterroger les banques. */
  plansApercu?: Pick<Plan, "segmentId" | "sourceImage" | "illustration" | "vignetteFichierId">[];
  /** Estimation avant accord (vidéo pas encore créée) : aucune banque interrogée, prix prudent. */
  estimation?: boolean;
  /** Correcteur réel 2 : vidéo d'essai (moteur simulé) : aucune banque interrogée, rien à fabriquer. */
  essai?: boolean;
  /** Estimation sur le texte RELU, pas encore enregistré (relecture n° 2) : il remplace celui de la version stockée. */
  relu?: TexteRelu;
}

/* ------------------------------------------------------------------ */
/* Ce que la vidéo d'une version garde de sa déclinaison                */
/* ------------------------------------------------------------------ */

/** Rangé dans `Video.entrees.declinaison` (aucun nouveau champ sur `Video`). */
export interface DeclinaisonVideo {
  role: "mere" | "variante" | "seconde-ouverture" | "complete";
  scriptMaitreId: Id;
  operationId: string;
  /** Vidéo dont le corps est repris (la mère ; pour une 2e ouverture, la vidéo Instagram). */
  mereVideoId?: Id;
  /** La version attend que sa mère soit prête pour partir (confirmée par « Fabriquer les N »). */
  attendMere?: boolean;
  /** Raccord visible : fabriquée en entier, Will confirme le coût affiché. */
  attendConfirmation?: boolean;
  /**
   * Correcteur R8 n° 1 : moteur annoncé quand Will a confirmé « Fabriquer les N » (la version qui suit sa mère ne part
   * montée pour de vrai que si c'est ce moteur-là qui a été confirmé).
   */
  moteurConfirme?: string;
  /**
   * CORRECTEUR 1 — B6 : Will a confirmé à l'écran le TOTAL de « Fabriquer les N » (lot compris) : la version qui suit sa
   * mère part avec cette confirmation. Absent sur une ancienne déclinaison : confirmée si `moteurConfirme` est posé
   * (il ne l'était qu'après la feuille de « Fabriquer les N »). Seconde relecture (R2) : c'est le MONTANT du total
   * confirmé (un ancien `true` ne couvre plus un prix au-delà du seuil).
   */
  prixConfirme?: AccordPrix;
  /** 2e ouverture : rang de l'essai d'accroche (fichier `-A2`) et son ouverture. */
  essaiAccroche?: number;
  accrocheId?: Id;
  ouverture?: BlocScript[];
}

const CLE = "declinaison";
const ELEMENTS_APPEL = ["incrustation-appel-logo", "incrustation-appel-telephone"];

export function declinaisonDe(video: Pick<Video, "entrees"> | null | undefined): DeclinaisonVideo | undefined {
  const x = video?.entrees?.[CLE];
  return x && typeof x === "object" ? (x as DeclinaisonVideo) : undefined;
}

const cleOperation = (id: string) => `generateur.fabricationN.${id}`;
const cleDebit = (formatId: string) => `debit.${formatId}.avatar`;

/* ------------------------------------------------------------------ */
/* La commande d'une vidéo de version                                   */
/* ------------------------------------------------------------------ */

/** Mère d'une vidéo (projet de montage de sa version choisie, lu par son moteur). */
async function mereDe(videoId: Id): Promise<MereVariante | null> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video || video.statut !== "prete" || !video.versionChoisieId) return null;
  const version = await d.versions.obtenir(video.versionChoisieId);
  if (!version?.commande) return null;
  const moteur = moteurDeCommande(version.commande);
  return moteur.mereDeclinaison?.(version.projetMontage as Record<string, unknown> | undefined, { videoId, versionId: version.id }) ?? null;
}

function segmentsDesBlocs(blocs: BlocScript[]): Id[] {
  return blocs.flatMap((b) => b.segments.filter((s) => s.texte.trim()).map((s) => s.id));
}

/**
 * Lot G2 : adaptations gratuites par réseau (coupe du segment facultatif), DERRIÈRE `adaptations_reseaux.actif` (coupé par
 * défaut : le corps rendu est celui d'avant, même référence). Script collé par Will, avocat : jamais adaptés. Aucun appel payant ;
 * toute erreur (lecture du réglage comprise) retombe sur le corps d'avant. Ratio, boucle, habillage : non branchés (docs/ecriture/LOT-D.md).
 */
export async function corpsAdapte(v: VarianteReseau, blocsScript: BlocScript[], corps: BlocScript[], autour?: { ouverture: BlocScript[]; fin: BlocScript[]; voixId?: Id }): Promise<BlocScript[]> {
  try {
    const actif = await lireParametre<unknown>(CLE_ADAPTATIONS_RESEAUX, ADAPTATIONS_RESEAUX_PAR_DEFAUT);
    if (!adaptationsActives(actif)) return corps;
    const format = obtenirFormat(v.formatId);
    // Même débit que la commande (`debitVoix`) ; le plafond porte sur la vidéo entière : ouverture et fin comptent.
    const debit = await debitVoix(format, autour?.voixId);
    const dureeTexte = (t: string) => estimerDureeTexte(format, t, debit);
    const dureeHorsCorpsSec = dureeTexte(texteScript([...(autour?.ouverture ?? []), ...(autour?.fin ?? [])]));
    return adapterBlocsDuCorps({ actif, blocs: corps, reseau: v.reseau, formatId: v.formatId, estCollee: blocsScript.some((b) => estBlocColle(b.id)), dureeTexte, dureeHorsCorpsSec });
  } catch {
    return corps;
  }
}

/** Ouverture de la version (ou celle de la 2e ouverture), corps commun, fin — et l'incrustation d'appel posée. */
export async function blocsDeLaVersion(v: VarianteReseau, decl: DeclinaisonVideo | undefined, corpsScript?: BlocScript[], voixId?: Id): Promise<{ ouverture: BlocScript[]; corps: BlocScript[]; fin: BlocScript[]; elementAppel?: Id }> {
  const d = depots();
  const blocsCorps = corpsScript ?? (await d.scripts.obtenir(v.scriptId))?.blocs ?? [];
  const ouverture = decl?.ouverture ?? v.ouverture;
  const tout = assemblerBlocs({ blocs: blocsCorps }, { ...v, ouverture });
  const corpsAssemble = tout.slice(ouverture.length, tout.length - v.fin.length);
  const corps = await corpsAdapte(v, blocsCorps, corpsAssemble, { ouverture, fin: v.fin, voixId });
  // Incrustation d'appel (B.4.1, objet : logo ou téléphone de la Bibliothèque), refaite par version, sur SON réseau.
  const roleAppel = parametresGenerateur(v.formatId).recette.roles.appel;
  let elementAppel: Id | undefined;
  for (const id of ELEMENTS_APPEL) {
    const e = await d.elements.obtenir(id);
    if (e && !e.archiveLe && e.fichierId) {
      elementAppel = id;
      break;
    }
  }
  const fin = elementAppel ? avecIncrustationAppel(v.fin, roleAppel, elementAppel) : v.fin;
  return { ouverture, corps, fin, elementAppel };
}

/**
 * Compléments de la commande d'une vidéo rattachée à une version (appelé par `construireCommande`). Ajouts purs ; une
 * vidéo sans version ne reçoit rien (commande d'avant G6).
 */
export async function complementsGenerateur(video: Video, ctx: ContexteGenerateur): Promise<Partial<CommandeFabrication>> {
  const d = depots();
  const stockee = video.varianteId ? await d.variantes.obtenir(video.varianteId) : null;
  if (!stockee) return {};
  const v = ctx.relu ? { ...stockee, ouverture: ctx.relu.ouverture, fin: ctx.relu.fin } : stockee;
  const m = await d.scriptsMaitres.obtenir(v.scriptMaitreId);
  const decl = declinaisonDe(video);
  const { ouverture, corps, fin, elementAppel } = await blocsDeLaVersion(v, decl, ctx.relu?.corpsScript, ctx.distribution[0]?.voixId);
  const blocs = [...ouverture, ...corps, ...fin];
  const texteComplet = texteScript(blocs);
  const format = obtenirFormat(video.formatId);
  // Texte DIT : le seul point d'application des prononciations (B.0 n° 24) ; la liste de la commande devient vide.
  const dits = appliquerPrononciations(
    blocs.flatMap((b) => b.segments.filter((s) => s.texte.trim())),
    ctx.prononciations,
    { voixId: ctx.distribution[0]?.voixId, personnageId: ctx.distribution[0]?.personnageId },
  ).map((s) => s.texteDit);
  const reseaux = (m?.brief.reseaux ?? [v.reseau]) as IdReseau[];
  const zones = zonesProtegeesUnion(reseaux, "9:16");
  const facultatifs = corps.flatMap((b) => b.segments.filter((s) => s.facultatif).map((s) => s.id));
  const parties = { ouverture: segmentsDesBlocs(ouverture), fin: segmentsDesBlocs(fin), facultatifs };
  const complements: Partial<CommandeFabrication> = {
    script: { id: v.scriptId, blocs, texteComplet },
    dureeCibleSec: dureeVideo(format, texteComplet, video.dureeCibleSec, await debitVoix(format, ctx.distribution[0]?.voixId)),
    // Plans indicatifs : seulement les illustrations du texte assemblé, posées plus bas (cascade appliquée) ; le
    // moteur refait tous les autres plans lui-même.
    plans: [],
    prononciations: [],
    texteDitParSegment: dits,
    reseaux,
    ...(zones ? { zonesProtegees: zones } : {}),
    encadreTexte: v.encadre.texte,
    partiesDeclinaison: parties,
  };
  // G6b : « je lis » — les prises filmées rangées sous la version (G4c) sont la source : rush, un seul angle (effet deux
  // caméras par recadrage), calées sur le texte validé (alignement forcé) ; aucune voix ni aucun double à payer.
  const prises = await prisesDeLaVideo(video, v, { ouverture: parties.ouverture, corps: segmentsDesBlocs(corps), fin: parties.fin });
  if (prises.length) {
    complements.prises = prises;
    complements.distribution = [{ ...(ctx.distribution[0] ?? { role: "Face caméra" }), source: "rush", modeAngles: "un-angle", visagesResolus: undefined }];
    // Lot R6 : vidéos « je lis » montées pour de vrai dès maintenant (interrupteur de la carte Montage, montage et
    // stockage reliés), sans attendre le double ; sinon le moteur du format, comme au lancement. Figé dans la commande.
    complements.moteurId = (await decisionJeLis(video.formatId)).moteurId;
  }
  // VERIF-1 a1 : les intentions d'illustration du texte assemblé passent par la cascade (Mes images → banques
  // gratuites → « à fabriquer »). Le moteur reporte l'élément trouvé sur ses plans du même segment ; un plan « à
  // fabriquer » est compté dans l'estimation (ligne « Illustrations à fabriquer »), donc vu et accepté avant toute
  // dépense. Version sur mère : seuls le début et la fin refaits (le corps vient de la mère). « Je lis » : rien ne
  // change (les prises filmées n'ont pas de plans d'illustration).
  if (!prises.length) {
    const surMere = !!decl?.mereVideoId && (decl.role === "variante" || decl.role === "seconde-ouverture");
    const refaits = surMere ? new Set(decl?.role === "seconde-ouverture" ? parties.ouverture : [...parties.ouverture, ...parties.fin]) : null;
    complements.plans = await plansIndicatifsDeLaVersion(video, blocs, complements.dureeCibleSec ?? video.dureeCibleSec, refaits, ctx);
  }
  if (elementAppel) {
    const e = await d.elements.obtenir(elementAppel);
    const f = e?.fichierId ? await d.fichiers.obtenir(e.fichierId) : null;
    if (f) complements.medias = { ...(ctx.medias ?? {}), [elementAppel]: { cle: f.cleStockage, mime: f.mime } satisfies MediaCommande };
  }
  // Version sur mère (ou 2e ouverture) : début et fin refaits, corps repris.
  if (!prises.length && decl && (decl.role === "variante" || decl.role === "seconde-ouverture") && decl.mereVideoId) {
    const refaits = decl.role === "seconde-ouverture" ? parties.ouverture : [...parties.ouverture, ...parties.fin];
    const mere = await mereDe(decl.mereVideoId);
    const ordre = segmentsDesBlocs(blocs);
    const tranches = mere ? raccordsSurMere({ nom: "mere", dureeSec: mere.dureeSec, segments: mere.segments, motsPrononces: mere.motsPrononces, plans: mere.plans }, etapesVariante({ ordreVersion: ordre, refaits: new Set(refaits), ordreMere: mere.segments.map((s) => s.segmentId) })).tranches : { debutRemplaceSec: 0, finRemplaceSec: 0 };
    complements.variante = {
      id: v.id,
      code: v.code,
      reseau: v.reseau,
      videoMereId: decl.mereVideoId,
      tranches,
      segmentsRefaits: refaits,
      ...(mere ? { mere } : {}),
      typeDerive: decl.role === "seconde-ouverture" ? "variante-accroche" : "variante-reseau",
    };
  }
  return complements;
}

/**
 * VERIF-1 a1 : plans INDICATIFS d'une vidéo de version — un par segment du texte assemblé qui porte une intention
 * d'illustration (segments `ids` seulement, si donnés). Un plan déjà décidé à l'Aperçu (même segment) est repris tel
 * quel (choix verrouillé de Will compris) ; les autres passent par la cascade si le format est en mode « auto ».
 * Estimation avant accord : aucune banque n'est interrogée (rien n'est téléchargé pour afficher un prix) ; ce qui
 * n'est pas déjà dans la Bibliothèque est compté « à fabriquer » : le prix annoncé n'est jamais plus bas que celui
 * du lancement.
 */
async function plansIndicatifsDeLaVersion(video: Video, blocs: BlocScript[], dureeSec: number, ids: Set<Id> | null, ctx: ContexteGenerateur): Promise<PlanCommande[]> {
  const format = obtenirFormat(video.formatId);
  if (ctx.briques && !ctx.briques.illustrations) return [];
  if (format.illustrations.mode === "aucune") return [];
  const plans = plansDepuisScript({
    videoId: video.id,
    versionId: `${video.id}-version`,
    blocs,
    dureeSec,
    modeIllustrations: format.illustrations.mode,
    personnageId: ctx.distribution[0]?.personnageId,
    maintenant: maintenant(),
  }).filter((p) => p.sourceImage === "illustration" && !!p.illustration && (!ids || (!!p.segmentId && ids.has(p.segmentId))));
  if (!plans.length) return [];
  const aDecider: Plan[] = [];
  for (const p of plans) {
    const a = ctx.plansApercu?.find((x) => !!x.segmentId && x.segmentId === p.segmentId && x.sourceImage === "illustration" && !!x.illustration);
    if (a?.illustration) {
      p.illustration = { ...a.illustration };
      p.vignetteFichierId = a.vignetteFichierId;
    } else aDecider.push(p);
  }
  if (format.illustrations.mode === "auto" && aDecider.length) {
    const options = optionsDuFormat(format, await modeEconomique(video.id));
    await appliquerCascade(video.id, aDecider, ctx.essai ? { ...options, banques: false } : ctx.estimation ? { ...options, banques: false } : options);
  }
  return plans.map((p) => ({
    id: p.id,
    ordre: p.ordre,
    debutSec: p.debutSec,
    finSec: p.finSec,
    texte: p.texte,
    sourceImage: p.sourceImage,
    illustration: p.illustration,
    // L'encadré et les incrustations restent lus par le moteur sur le texte : rien de plus ici.
    texteEcran: undefined,
    angle: p.angle,
    cadrage: p.cadrage,
    motsEnValeur: p.motsEnValeur,
    segmentId: p.segmentId,
  }));
}

/** Prises d'une vidéo « je lis » : 1 corps + le début et la fin de SON réseau (sinon la prise de toute la version). */
async function prisesDeLaVideo(video: Video, v: VarianteReseau, ids: { ouverture: Id[]; corps: Id[]; fin: Id[] }): Promise<PriseCommande[]> {
  const e = video.entrees as Partial<PrisesVideo>;
  if (e.origine !== "tournage" || !e.prises?.length) return [];
  const d = depots();
  const bonnes = e.prises.filter((p) => !p.ratee);
  const derniere = (liste: PrisesVideo["prises"], partie: string) => [...liste].reverse().find((p) => !p.ratee && p.partie === partie);
  const versPrise = async (p: PrisesVideo["prises"][number], partie: PriseCommande["partie"], segmentIds: Id[]): Promise<PriseCommande | null> => {
    const f = await d.fichiers.obtenir(p.fichierId);
    return f ? { id: p.rushId, partie, cle: f.cleStockage, mime: f.mime, dureeSec: p.dureeSec || f.dureeSec || 0, segmentIds } : null;
  };
  const debut = derniere(bonnes, "debut");
  const fin = derniere(bonnes, "fin");
  let corps = derniere(bonnes, "corps");
  if (!corps && debut && fin) {
    // Le corps commun est filmé une fois, rangé sous une autre version « je lis » du même texte.
    for (const s of await d.videos.lister((x) => x.id !== video.id && !!x.varianteId && (x.entrees as Partial<PrisesVideo>).origine === "tournage")) {
      const soeur = await d.variantes.obtenir(s.varianteId!);
      if (soeur?.scriptId !== v.scriptId) continue;
      corps = derniere((s.entrees as Partial<PrisesVideo>).prises ?? [], "corps");
      if (corps) break;
    }
  }
  if (debut && corps && fin) {
    const liste = await Promise.all([versPrise(debut, "debut", ids.ouverture), versPrise(corps, "corps", ids.corps), versPrise(fin, "fin", ids.fin)]);
    if (liste.every(Boolean)) return liste as PriseCommande[];
  }
  const retenue = bonnes.find((p) => p.rushId === e.priseRetenueId) ?? bonnes.filter((p) => !p.partie || p.partie === "version").at(-1);
  if (retenue && (!retenue.partie || retenue.partie === "version")) {
    const p = await versPrise(retenue, "version", [...ids.ouverture, ...ids.corps, ...ids.fin]);
    return p ? [p] : [];
  }
  return [];
}

/**
 * G6b « Monter ma prise » (0 € : Will a filmé) : la vidéo « je lis » de la version, rangée par la séance de tournage,
 * part en fabrication — prises calées sur le texte validé, assemblées (1 corps + début et fin), sous-titrées depuis le
 * texte validé, un seul angle recadré.
 */
export async function monterJeLis(varianteId: Id, options: { confirme: AccordPrix }): Promise<{ videoId: Id; travailId: Id }> {
  await exigerSession();
  const d = depots();
  const v = await d.variantes.obtenir(varianteId);
  if (!v || v.archiveLe) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  const video = v.videoId ? await d.videos.obtenir(v.videoId) : null;
  if (!video || !(video.entrees as Partial<PrisesVideo>).prises?.some((p) => !p.ratee)) throw new ErreurStudio("SANS_PRISE", "Filmez d'abord cette version.");
  // CORRECTEUR FINAL A (VERIF-E2E-1 n° 3) : la VRAIE prise de Will (stockage réel) n'est jamais remplacée par la vidéo
  // de démonstration du moteur d'essai. Refus clair AVANT tout lancement, avec le geste qui débloque.
  const jeLis = await decisionJeLis(video.formatId);
  if (jeLis.moteurId === "simulation" && !(await fournisseurSimule("stockage"))) {
    const geste = jeLis.manque ? `Reliez d'abord ${jeLis.manque} (Réglages › Connexions).` : "Allumez « Vidéos “je lis” montées pour de vrai » (Réglages › Connexions › Montage), puis touchez à nouveau « Monter ma prise ».";
    throw new ErreurStudio("JE_LIS_ETEINT", `Votre prise serait remplacée par une vidéo de démonstration : rien n'est parti, rien n'a été payé. ${geste}`);
  }
  const { lancerFabrication } = await import("./fabrication");
  const t = await lancerFabrication(video.id, { confirme: options.confirme });
  await journaliser("fabrication", `Montage de la prise « je lis » : ${v.code}`, { type: "video", id: video.id });
  return { videoId: video.id, travailId: t.travailId };
}

/* ------------------------------------------------------------------ */
/* « Fabriquer les N » : estimation, puis lancement                     */
/* ------------------------------------------------------------------ */

export interface VersionAFabriquer {
  varianteId: Id;
  code: string;
  reseau: VarianteReseau["reseau"];
  dureeSec: number;
  role: "mere" | "variante";
  cout: Montant;
  videoId?: Id;
  /** Lot R7e : part de l'avatar qui parle (HeyGen, payant) dans `cout`, à dire sur la feuille. Absente : rien. */
  avatarParle?: Montant;
}

export interface PlanFabricationSujet {
  formatId: string;
  mere: VersionAFabriquer;
  versions: VersionAFabriquer[];
  total: Montant;
  /** Ce que la mère seule coûterait par version, à comparer (≈ 3,50 € l'une). */
  sansDeclinaison: Montant;
  ratiosOption: Ratio[];
  /** false : le moteur du format ne reprend pas encore le corps d'une mère ; chaque version est fabriquée en entier. */
  surMere: boolean;
  /** Lignes estimées de tout ce qui reste à fabriquer (contrôle du budget et des crédits AVANT de rien créer). */
  lignes?: LigneCout[];
  /**
   * Lot R7e : part de l'avatar qui parle dans `total`. Le lancement part avec le total confirmé par la feuille
   * (CORRECTEUR 1 — B6 : `totalConfirme`) : la feuille DOIT donc le dire (`phraseAvatarParle`). Absente : l'avatar ne parle pas.
   */
  avatarParle?: Montant;
}

/**
 * Ligne avatar d'un sujet (le double) : versions courantes VALIDÉES d'un même format et d'un même corps (« vous » d'abord,
 * puis « tu »), une par réseau. La mère et ses versions sont toujours dans la même ligne.
 */
export async function versionsAvatar(m: ScriptMaitre): Promise<VarianteReseau[]> {
  const d = depots();
  const toutes = versionsCourantes(await d.variantes.lister((x) => x.scriptMaitreId === m.id));
  const scripts = new Map((await d.scripts.lister((s) => s.scriptMaitreId === m.id)).map((s) => [s.id, s]));
  const avatar = toutes.filter((v) => v.etat === "validee" && (scripts.get(v.scriptId)?.mode ?? "avatar") === "avatar" && !/-[LIV](-T)?$/.test(v.code));
  // Ligne = format + suffixes du code après le réseau (« » pour vous, « T » pour tu).
  const ligne = (v: VarianteReseau) => `${v.formatId}|${v.code.split("-").slice(3).join("-")}`;
  const lignes = [...new Set(avatar.map(ligne))].sort((a, b) => a.split("|")[1].length - b.split("|")[1].length || a.localeCompare(b));
  // E2E-2 parcours n° 9 : la ligne « vous » déjà fabriquée, « Fabriquer les N » propose la ligne suivante (« tu »).
  const choisie = lignes.find((l) => avatar.some((v) => ligne(v) === l && !v.videoId)) ?? lignes[0];
  return choisie ? avatar.filter((v) => ligne(v) === choisie) : [];
}

/** Moteur qui fabriquera ce format (réglage `moteur.<format>` > variable d'environnement > format), comme au lancement. */
async function moteurDuFormat(formatId: string): Promise<string> {
  // Lot R8 : l'interrupteur « montage réel » (double prêt, tout relié) compte, comme au lancement.
  return moteurAuLancement(formatId);
}

/** Le moteur du format sait-il reprendre le corps d'une mère (G6) ? Sinon chaque version est fabriquée en entier. */
async function declinable(formatId: string): Promise<boolean> {
  return !!obtenirMoteur(await moteurDuFormat(formatId)).mereDeclinaison;
}

/**
 * Formats par réseau T5 : formats de la mère et des versions. Une version : 9:16 + options + préféré de SON réseau que
 * le moteur sait faire (la version LinkedIn sort en 4:5, les autres en 9:16). La mère : 9:16 + options cochées +
 * préféré des réseaux du sujet, c'est-à-dire ceux du brief ET ceux des versions (chaque version suit `v.reseau`) : la
 * mère porte donc tout format dont une version a besoin (sauf formats exclus de T5 : l'avocat). Mère déjà faite (avant T5, en 9:16 seul) : ses formats tels
 * quels, et une version qui reprend son corps (`surMere`) est limitée aux formats de la mère (le corps d'un format que
 * la mère n'a pas n'existe pas : rien n'est annoncé ni fabriqué pour lui). Le prix annoncé et le lancement lisent
 * cette même règle.
 */
async function ratiosDuSujet(m: Pick<ScriptMaitre, "brief">, formatId: string, moteurId: string, options: Ratio[] | undefined, sujet: { versions: readonly Pick<VarianteReseau, "reseau">[]; mere: Pick<VarianteReseau, "videoId">; surMere: boolean }): Promise<{ mere: Ratio[]; version: (reseau: IdReseau) => Ratio[] }> {
  const capacites = await capacitesRatios(formatId, moteurId);
  const reseaux = [...new Set([...((m.brief.reseaux ?? []) as IdReseau[]), ...sujet.versions.map((v) => v.reseau)])];
  const faite = sujet.mere.videoId ? (await depots().videos.obtenir(sujet.mere.videoId))?.ratios : undefined;
  const mere = faite?.length ? faite : ratiosDeLaMere(options, reseaux, capacites);
  return { mere, version: (reseau) => ratiosVersion(options, reseau, capacites).filter((r) => !sujet.surMere || mere.includes(r)) };
}

/** Formats d'une version seule : 9:16 + options + préféré de SON réseau, limités aux capacités du moteur. */
function ratiosVersion(options: Ratio[] | undefined, reseau: IdReseau, capacites: readonly Ratio[]): Ratio[] {
  return ratiosDeLaMere(options, [reseau], capacites);
}

/**
 * Formats de la vidéo d'une version fabriquée seule (« Fabriquer cette version », tournage) : la règle du prix de
 * `verifierAvantDeCreer`, posée telle quelle sur son brouillon (relecture A3 : une seule règle pour le prix et les
 * fichiers, quel que soit le format maître).
 */
export async function ratiosDeLaVersion(v: { formatId: string; reseau: IdReseau }, options: { ratiosOption?: Ratio[] } = {}): Promise<Ratio[]> {
  return ratiosVersion(options.ratiosOption, v.reseau, await capacitesRatios(v.formatId, await moteurDuFormat(v.formatId)));
}

/** Commande légère d'estimation (mêmes briques que le moteur), sans vidéo : rien n'est créé pour afficher un prix. */
function commandeEstimation(v: VarianteReseau, blocs: BlocScript[], refaits: Id[] | null, taux: number, ratios: Ratio[], moteurId: string): CommandeFabrication {
  const format = obtenirFormat(v.formatId);
  const texteComplet = texteScript(blocs);
  return {
    versionContrat: 2,
    moteurId,
    videoId: `estimation-${v.id}`,
    formatId: v.formatId,
    versionFormat: format.version,
    profilRenduVersion: format.profilRendu?.version ?? 1,
    dureeCibleSec: Math.max(1, Math.round(v.dureeEstimeeSec)),
    ratios,
    script: { blocs, texteComplet },
    distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle" }],
    styles: {},
    briques: briquesEffectives(format, [], []),
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { active: false },
    budgetMax: centimes(0),
    tauxUsdEur: taux,
    construiteLe: maintenant(),
    ...(refaits ? { variante: { id: v.id, code: v.code, reseau: v.reseau, videoMereId: "", tranches: { debutRemplaceSec: 0, finRemplaceSec: 0 }, segmentsRefaits: refaits } } : {}),
  } as unknown as CommandeFabrication;
}

/** Distribution par défaut d'un brouillon (la même que `creerBrouillon`) : Will, son double et sa voix du format. */
/** TEST-UI-REEL U2 (CORRECTEUR FINAL A) : débit de lecture de la voix choisie (voix HeyGen : débit réel mesuré). */
async function debitVoix(format: Parameters<typeof debitLecture>[0], voixId: Id | undefined): Promise<number> {
  return debitLecture(format, voixId ? await depots().voix.obtenir(voixId) : null);
}

async function distributionParDefautEstimation(formatId: string): Promise<Distribution[]> {
  const format = obtenirFormat(formatId);
  if (format.personnages.max === 0) return [];
  const d = depots();
  const moi = await trouverMoi();
  const visage = moi ? visagePourFormat(await d.visages.lister((v) => v.personnageId === moi.id), moi, formatId) : null;
  const voix = moi ? voixPourFormat(await d.voix.lister((v) => v.personnageId === moi.id), moi, formatId) : null;
  const roles = format.personnages.roles ?? ["Face caméra"];
  return roles.slice(0, Math.max(1, format.personnages.min)).map((role, i) => ({ role, personnageId: i === 0 ? moi?.id : undefined, source: "double" as const, visageId: i === 0 ? visage?.id : undefined, voixId: i === 0 ? voix?.id : undefined }));
}

/**
 * E2E-2 parcours n° 4 : estimation d'une version par LE MÊME CHEMIN que son lancement (vidéo telle que « Fabriquer les N »
 * la créera : styles, habillage, double, deux angles, illustrations, formats cochés), sans rien créer. Le prix annoncé
 * est donc celui que le lancement contrôlera et réservera. Repli sur la commande légère si la vidéo ne peut pas encore
 * être construite (accord ou voix manquants : le lancement le dira).
 */
/**
 * Texte RELU d'une version, pas encore enregistré (écran « Relire le script ») : le prix est estimé sur ce texte, pour
 * contrôler le budget et l'accord AVANT d'enregistrer quoi que ce soit.
 */
export interface TexteRelu {
  ouverture: BlocScript[];
  fin: BlocScript[];
  /** Blocs du corps commun (tous réseaux), comme `Script.blocs`. */
  corpsScript: BlocScript[];
}

async function estimerVersion(version: VarianteReseau, m: ScriptMaitre, refaits: Id[] | null, taux: number, ratios: Ratio[], moteurId: string, relu?: TexteRelu): Promise<Estimation> {
  const v = relu ? { ...version, ouverture: relu.ouverture, fin: relu.fin } : version;
  // La distribution par défaut lit la base : indisponible, on retombe sur la commande légère (`commandeEstimation`), sans voix.
  let distribution: Distribution[] = [];
  let baseIndisponible = false;
  try {
    distribution = await distributionParDefautEstimation(v.formatId);
  } catch {
    baseIndisponible = true;
  }
  const { ouverture, corps, fin } = await blocsDeLaVersion(v, undefined, relu?.corpsScript, distribution[0]?.voixId);
  const blocs = [...ouverture, ...corps, ...fin];
  try {
    if (baseIndisponible) throw new Error("distribution par défaut indisponible");
    const d = depots();
    const { construireCommandeEstimation } = await import("./fabrication");
    const format = obtenirFormat(v.formatId);
    const script = await d.scripts.obtenir(v.scriptId);
    const mention = await lireParametre("mentionIA.parDefaut", MENTION_IA_PAR_DEFAUT);
    const id = `estimation-${v.id}`;
    const scriptFictif: Script = { ...(script as Script), id: `${id}-script`, blocs, version: 1, parentId: undefined, statutEditorial: "valide" };
    const video = {
      id,
      titre: v.code,
      sujet: m.angle?.titre ?? "",
      formatId: v.formatId,
      versionFormat: format.version,
      profilRenduVersion: format.profilRendu?.version ?? 1,
      marqueId: "marque-axion",
      statut: "brouillon",
      dureeCibleSec: dureeVideo(format, texteScript(blocs), Math.max(1, Math.round(v.dureeEstimeeSec)), await debitVoix(format, distribution[0]?.voixId)),
      ratios,
      scriptId: scriptFictif.id,
      distribution,
      entrees: { [CLE]: { role: refaits ? "variante" : "mere", scriptMaitreId: m.id, operationId: "estimation" } satisfies DeclinaisonVideo },
      reglages: reglagesParDefaut(format),
      styles: {},
      briquesCoupees: [],
      briquesAllumees: mention.incrustee ? ["mention-ia"] : [],
      mentionIA: mention,
      langue: "fr-FR",
      varianteId: v.id,
      reseau: v.reseau,
      ...horodatage(),
    } as Video;
    const c = await construireCommandeEstimation(video, scriptFictif, relu);
    c.moteurId = moteurId;
    if (refaits) c.variante = { id: v.id, code: v.code, reseau: v.reseau, videoMereId: "", tranches: { debutRemplaceSec: 0, finRemplaceSec: 0 }, segmentsRefaits: refaits };
    return await moteurDeCommande(c).estimer(c);
  } catch {
    const c = commandeEstimation(v, blocs, refaits, taux, ratios, moteurId);
    return moteurDeCommande(c).estimer(c);
  }
}

/** Ce que « Fabriquer les N » va faire et coûter (estimation des briques ; rien n'est créé). Null : rien à fabriquer. */
export async function planFabricationSujet(scriptMaitreId: Id, options: { ratiosOption?: Ratio[]; relus?: Map<Id, TexteRelu> } = {}): Promise<PlanFabricationSujet | null> {
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
  if (!m || m.archiveLe) return null;
  const vs = await versionsAvatar(m);
  const sansVideo = vs.filter((v) => !v.videoId);
  if (!sansVideo.length) return null;
  const mere = choisirMere(vs.map((v) => ({ ...v, dureeSec: v.dureeEstimeeSec })))!;
  const taux = await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
  const moteurId = await moteurDuFormat(mere.formatId);
  const surMere = await declinable(mere.formatId);
  const formats = await ratiosDuSujet(m, mere.formatId, moteurId, options.ratiosOption, { versions: vs, mere, surMere });
  const versions: VersionAFabriquer[] = [];
  const lignes: LigneCout[] = [];
  for (const v of vs) {
    const relu = options.relus?.get(v.id);
    const { ouverture, fin } = await blocsDeLaVersion(relu ? { ...v, ouverture: relu.ouverture, fin: relu.fin } : v, undefined, relu?.corpsScript);
    const estMere = v.id === mere.id;
    // E2E-1 n° 5 : les formats cochés valent pour CHAQUE version (pas seulement la mère), et le prix les compte.
    // T5 : la mère avec les formats des réseaux du sujet, chaque version dans le format de son réseau.
    const e = await estimerVersion(v, m, estMere || !surMere ? null : [...segmentsDesBlocs(ouverture), ...segmentsDesBlocs(fin)], taux, estMere ? formats.mere : formats.version(v.reseau), moteurId, relu);
    if (!v.videoId) lignes.push(...e.lignes);
    const avatar = v.videoId ? null : partDoubleReel(e.lignes);
    versions.push({ varianteId: v.id, code: v.code, reseau: v.reseau, dureeSec: v.dureeEstimeeSec, role: estMere ? "mere" : "variante", cout: v.videoId ? centimes(0) : e.total, videoId: v.videoId, ...(avatar ? { avatarParle: avatar } : {}) });
  }
  const laMere = versions.find((x) => x.role === "mere")!;
  const total = additionner(...versions.map((x) => x.cout));
  const complete = versions.find((x) => x.role === "mere")!;
  const avatarParle = partDoubleReel(lignes);
  return { formatId: mere.formatId, mere: laMere, versions: [laMere, ...versions.filter((x) => x.role !== "mere")], total, lignes, ...(avatarParle ? { avatarParle } : {}), sansDeclinaison: centimes(complete.cout.centimes * versions.length), ratiosOption: ratiosDeLaMere(options.ratiosOption).filter((r) => r !== "9:16"), surMere };
}

/** Vidéo d'une version (brouillon), rattachée ; le texte assemblé est fourni à la fabrication par `complementsGenerateur`. */
async function videoDeVersion(v: VarianteReseau, m: ScriptMaitre, extra: Partial<Video>, decl: DeclinaisonVideo, rattacher = true): Promise<Id> {
  const d = depots();
  const script = await d.scripts.obtenir(v.scriptId);
  const assemble: Script = { ...(script as Script), id: nouvelId("script"), blocs: assemblerBlocs({ blocs: script?.blocs ?? [] }, { ...v, ouverture: decl.ouverture ?? v.ouverture }), version: 1, parentId: undefined, creePourVideoId: undefined, sujet: m.angle?.titre ?? script?.sujet ?? "", statutEditorial: "valide", ...horodatage() };
  await d.scripts.enregistrer(assemble);
  const { creerBrouillon } = await import("./videos");
  const id = await creerBrouillon(v.formatId, { scriptId: assemble.id });
  await d.scripts.modifier(assemble.id, { creePourVideoId: id });
  const video = (await d.videos.obtenir(id))!;
  const titre = `${v.code}${decl.essaiAccroche ? `-A${decl.essaiAccroche}` : ""} · ${assemble.sujet || "version"}`;
  await d.videos.modifier(id, { titre, ...extra, entrees: { ...video.entrees, [CLE]: decl } });
  if (rattacher) {
    const { rattacherVideoAVariante } = await import("./generateur");
    await rattacherVideoAVariante(id, v.id);
  } else await d.videos.modifier(id, { varianteId: v.id, reseau: v.reseau });
  return id;
}

/* ------------------------------------------------------------------ */
/* Lancement sûr d'une vidéo de version (E2E-2 parcours n° 1 et n° 2)   */
/* ------------------------------------------------------------------ */

/** Refus qui se lèvent avec une recharge (ou un budget relevé) : la vidéo attend, elle n'est pas perdue. */
const CODES_ATTENTE = ["CREDIT_INSUFFISANT", "CLE_REFUSEE", "BUDGET_DEPASSE"];

/** La phrase simple qui dit pourquoi une vidéo attend et ce qui la fera partir. */
export function raisonAttente(attente: Pick<NonNullable<Video["lancementEnAttente"]>, "fournisseur"> | null | undefined): string | undefined {
  if (!attente) return undefined;
  if (attente.fournisseur === "budget") return "Budget du mois atteint : elle partira dès que le budget le permettra (Réglages › Budget).";
  const noms: Record<string, string> = { heygen: "HeyGen", elevenlabs: "ElevenLabs", fal: "fal.ai", anthropic: "Claude" };
  return `Crédit ${noms[attente.fournisseur] ?? attente.fournisseur} insuffisant : elle partira dès la recharge.`;
}

/**
 * E2E-2 parcours n° 1 et n° 2 — AVANT de créer quoi que ce soit : le budget du mois et les crédits suffisent-ils pour
 * ces versions (même contrôle que le lancement, sur le total annoncé) ? Sinon `BUDGET_DEPASSE` / `CREDIT_INSUFFISANT`
 * / `CLE_REFUSEE` est levé et RIEN n'est créé : le bouton reste sur la fiche, avec la raison. Lecture seule.
 * À appeler par « Fabriquer cette version » (`fabriquerVariante`) avant de créer son brouillon.
 */
export async function verifierAvantDeCreer(varianteIds: Id[], options: { ratiosOption?: Ratio[]; confirme?: AccordPrix; relus?: Map<Id, TexteRelu>; origine?: OrigineLancement } = {}): Promise<{ total: Montant }> {
  const d = depots();
  const lignes: LigneCout[] = [];
  let total = centimes(0);
  const taux = await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
  for (const id of varianteIds) {
    const v = await d.variantes.obtenir(id);
    if (!v || v.archiveLe || v.videoId) continue;
    const m = await d.scriptsMaitres.obtenir(v.scriptMaitreId);
    if (!m) continue;
    const moteurId = await moteurDuFormat(v.formatId);
    // T5 : « Fabriquer cette version » : la version dans le format de son réseau (son brouillon reçoit les mêmes,
    // `ratiosDeLaVersion`).
    const ratios = await ratiosDeLaVersion(v, { ratiosOption: options.ratiosOption });
    const e = await estimerVersion(v, m, null, taux, ratios, moteurId, options.relus?.get(v.id));
    lignes.push(...e.lignes);
    total = additionner(total, e.total);
  }
  if (lignes.length || total.centimes > 0) {
    const { verifierBudgetEtCredits } = await import("./credits");
    // CORRECTEUR 1 — B6 : la confirmation vient de l'écran (au-delà du seuil : CONFIRMATION_REQUISE).
    await verifierBudgetEtCredits({ lignes, total }, accordPropre(options.confirme), varianteIds.length > 1 ? `Ces ${varianteIds.length} vidéos` : "Cette vidéo", { origine: options.origine });
  }
  return { total };
}

/**
 * Pré-vol de « Fabriquer les N » (lecture seule) : budget du mois, accord sur le TOTAL et crédits, sur le plan (texte
 * enregistré, ou texte relu `relus` pas encore enregistré). Rend l'accord qui suit (le montant confirmé s'il couvre le
 * total, sinon `false`). Refus : `BUDGET_DEPASSE` / `CONFIRMATION_REQUISE` / `CREDIT_INSUFFISANT` / `CLE_REFUSEE`.
 */
export async function verifierAvantDeFabriquerLesN(scriptMaitreId: Id, options: { ratiosOption?: Ratio[]; totalConfirme?: number; relus?: Map<Id, TexteRelu>; origine?: OrigineLancement } = {}): Promise<AccordPrix> {
  const montant: AccordPrix = typeof options.totalConfirme === "number" ? accordPropre(options.totalConfirme) : false;
  const plan = await planFabricationSujet(scriptMaitreId, { ratiosOption: options.ratiosOption, relus: options.relus });
  if (!plan) return montant;
  const { verifierBudgetEtCredits } = await import("./credits");
  const n = plan.versions.filter((x) => !x.videoId).length;
  const prixConfirme: AccordPrix = typeof montant === "number" && plan.total.centimes <= montant ? montant : false;
  await verifierBudgetEtCredits({ lignes: plan.lignes ?? [], total: plan.total }, prixConfirme, n > 1 ? `Ces ${n} vidéos` : "Cette vidéo", { origine: options.origine });
  return prixConfirme;
}

/**
 * Lance la vidéo d'une version (geste confirmé par Will) SANS JAMAIS laisser d'impasse : refus de budget ou de crédit
 * (course avec un autre lancement, crédit HeyGen qui baisse) → la vidéo passe « attend du crédit · partira
 * d'elle-même » (`lancementEnAttente`, confirmée), Will est prévenu avec la raison, et elle repart après la recharge
 * ou la hausse du budget (`surveillerCredits` prévient, l'Accueil la lance). Tout autre refus remonte tel quel.
 * À appeler par « Fabriquer cette version » (`fabriquerVariante`) à la place de `lancerFabrication`.
 */
export async function lancerVideoDeVersion(videoId: Id, confirme: AccordPrix = false): Promise<{ travailId?: Id; enAttente?: string }> {
  const { lancerFabrication } = await import("./fabrication");
  try {
    return { travailId: (await lancerFabrication(videoId, { confirme })).travailId };
  } catch (e) {
    if (!(e instanceof ErreurStudio) || !CODES_ATTENTE.includes(e.code)) throw e;
    return { enAttente: await mettreEnAttenteDeCredit(videoId, e, confirme) };
  }
}

/** La vidéo attend du crédit (ou le budget) : brouillon « lancer dès que possible », notification avec la raison. */
async function mettreEnAttenteDeCredit(videoId: Id, e: ErreurStudio, confirme: AccordPrix): Promise<string> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video) throw e;
  const { fournisseurDeLErreur } = await import("./credits");
  // Correcteur R8 n° 1 : l'accord vient d'être donné, pour le moteur du moment (gardé avec l'attente).
  const attente = { depuis: video.lancementEnAttente?.depuis ?? maintenant(), fournisseur: e.code === "BUDGET_DEPASSE" ? "budget" : fournisseurDeLErreur(e, "heygen"), confirme, moteurId: await moteurDuFormat(video.formatId) };
  await d.videos.modifier(videoId, { lancementEnAttente: attente });
  const raison = raisonAttente(attente)!;
  const v = video.varianteId ? await d.variantes.obtenir(video.varianteId) : null;
  await creerNotification({ type: "credit", titre: `${v?.code ?? video.titre} attend ${attente.fournisseur === "budget" ? "le budget" : "du crédit"}`, message: raison, lien: v ? `/ecrire/sujets/${v.scriptMaitreId}` : `/videos/${videoId}`, estDemo: video.estDemo });
  await journaliser("credits", `« ${video.titre} » attend : ${raison}`, { type: "video", id: videoId });
  return raison;
}

/**
 * « Fabriquer les N » (B.6.6) : la mère part tout de suite (pré-vol budget et crédits) ; les autres versions sont
 * créées et partent d'elles-mêmes dès que la mère est prête. Un identifiant d'opération rend le double toucher
 * inoffensif. `lancer: false` : tout est préparé, rien n'est lancé (essais).
 *
 * E2E-2 parcours n° 1 : le budget et les crédits sont contrôlés sur le total AVANT de créer les vidéos (refus : rien
 * n'est créé, le bouton reste) ; un refus au lancement même (course, crédit qui baisse) ne laisse jamais d'impasse : la
 * mère attend du crédit et repart d'elle-même, ses versions la suivent.
 */
export async function fabriquerLesN(scriptMaitreId: Id, options: { operationId: string; lancer: boolean; ratiosOption?: Ratio[]; totalConfirme?: number }): Promise<{ mereVideoId: Id; videoIds: Id[]; travailId?: Id; enAttente?: string }> {
  await exigerSession();
  const deja = await lireParametre<{ mereVideoId: Id; videoIds: Id[]; travailId?: Id; lance?: boolean; enAttente?: string } | null>(cleOperation(options.operationId), null);
  if (deja && (deja.lance || !options.lancer)) return deja;
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
  if (!m || m.archiveLe) throw new ErreurStudio("INTROUVABLE", "Ce sujet n'existe plus.");
  if (m.exception && m.exception.source === "proposition-machine" && !m.exception.valideeParWill) throw new ErreurStudio("LIMITE_A_VALIDER", "Validez d'abord la limite proposée (un toucher).");
  // CORRECTEUR 1 — B6 : la confirmation est celle du TOTAL que Will a vu sur la feuille (lot compris), envoyé par
  // l'écran. Un total confirmé plus bas que le prix d'aujourd'hui ne vaut pas confirmation.
  // Seconde relecture (R2) : c'est le MONTANT confirmé qui suit (la mère et chaque version), plus un simple `true`.
  const montant: AccordPrix = typeof options.totalConfirme === "number" ? accordPropre(options.totalConfirme) : false;
  let prixConfirme: AccordPrix = false;
  // Rien n'est créé si le budget du mois ou un crédit ne suffit pas pour ce qui est annoncé.
  if (options.lancer && !deja) prixConfirme = await verifierAvantDeFabriquerLesN(scriptMaitreId, { ratiosOption: options.ratiosOption, totalConfirme: options.totalConfirme });
  else if (deja) prixConfirme = montant;
  const resultat = await sousVerrou(async () => {
    const encore = await lireParametre<{ mereVideoId: Id; videoIds: Id[] } | null>(cleOperation(options.operationId), null);
    if (encore) return encore;
    const vs = await versionsAvatar(m);
    if (!vs.length) throw new ErreurStudio("RIEN_A_FABRIQUER", "Aucune version validée à fabriquer.");
    const mere = choisirMere(vs.map((v) => ({ ...v, dureeSec: v.dureeEstimeeSec })))!;
    const base = { scriptMaitreId: m.id, operationId: options.operationId };
    const surMere = await declinable(mere.formatId);
    // E2E-1 n° 5 : Vertical toujours, plus les formats cochés, pour la mère ET pour chacune des autres versions.
    // T5 : plus le 4:5 de LinkedIn pour la mère (LinkedIn dans le sujet) et pour la version LinkedIn (même règle que le prix) (sauf formats exclus de T5 : l'avocat).
    const formats = await ratiosDuSujet(m, mere.formatId, await moteurDuFormat(mere.formatId), options.ratiosOption, { versions: vs, mere, surMere });
    const mereVideoId = mere.videoId ?? (await videoDeVersion(mere, m, { ratios: formats.mere }, { ...base, role: "mere" }));
    const videoIds = [mereVideoId];
    for (const v of vs) {
      if (v.id === mere.id || v.videoId) continue;
      const ratios = formats.version(v.reseau);
      // Moteur sans reprise du corps (simulation du format) : la version est une vidéo complète, lancée tout de suite.
      if (!surMere) videoIds.push(await videoDeVersion(v, m, { ratios }, { ...base, role: "complete" }));
      else videoIds.push(await videoDeVersion(v, m, { ratios, typeDerive: "variante-reseau", sourceVideoId: mereVideoId }, { ...base, role: "variante", mereVideoId, attendMere: true }));
    }
    const r = { mereVideoId, videoIds };
    await ecrireParametre(cleOperation(options.operationId), r);
    return r;
  });
  if (!options.lancer) return resultat;
  // Correcteur R8 n° 1 : les versions qui suivront leur mère gardent le moteur confirmé maintenant.
  for (const vid of resultat.videoIds.slice(1)) {
    const v = await d.videos.obtenir(vid);
    const decl = declinaisonDe(v);
    if (v?.statut === "brouillon" && decl?.attendMere) await d.videos.modifier(vid, { entrees: { ...v.entrees, [CLE]: { ...decl, moteurConfirme: await moteurDuFormat(v.formatId), prixConfirme } } });
  }
  const mereVideo = await d.videos.obtenir(resultat.mereVideoId);
  let travailId: Id | undefined;
  let enAttente: string | undefined;
  if (mereVideo?.statut === "brouillon") {
    const r = await lancerVideoDeVersion(resultat.mereVideoId, prixConfirme);
    travailId = r.travailId;
    enAttente = r.enAttente;
  } else if (mereVideo?.statut === "prete") await lancerVariantesEnAttente(resultat.mereVideoId);
  // Versions complètes (moteur sans reprise du corps) : lancées avec la mère, dans le même geste confirmé.
  for (const vid of resultat.videoIds.slice(1)) {
    const v = await d.videos.obtenir(vid);
    if (v?.statut === "brouillon" && !v.lancementEnAttente && declinaisonDe(v)?.role === "complete" && !declinaisonDe(v)?.attendConfirmation) {
      enAttente ??= (await lancerVideoDeVersion(vid, prixConfirme)).enAttente;
    }
  }
  await journaliser("fabrication", enAttente ? `Fabriquer les ${resultat.videoIds.length} : en attente (${enAttente})` : `Fabriquer les ${resultat.videoIds.length} : la mère part, ${resultat.videoIds.length - 1} version(s) suivront`, { type: "video", id: resultat.mereVideoId });
  const fin = { ...resultat, travailId, lance: true, ...(enAttente ? { enAttente } : {}) };
  await ecrireParametre(cleOperation(options.operationId), fin);
  return fin;
}

/**
 * « 2e ouverture Reels » (B.8.10, ≈ 0,70 €) : la vidéo Instagram avec la 2e accroche finaliste (même version, même
 * réseau, `variante-accroche`, fichier `-A2`), son corps et sa fin repris de la vidéo Instagram. Publiée à la main.
 */
export async function fabriquerSecondeOuverture(varianteId: Id, options: { operationId: string; lancer: boolean; prixConfirme?: AccordPrix }): Promise<{ videoId: Id; travailId?: Id }> {
  await exigerSession();
  const cle = `generateur.secondeOuverture.${options.operationId}`;
  const deja = await lireParametre<{ videoId: Id; travailId?: Id } | null>(cle, null);
  if (deja && (deja.travailId || !options.lancer)) return deja;
  const d = depots();
  const v = await d.variantes.obtenir(varianteId);
  if (!v || v.archiveLe) throw new ErreurStudio("INTROUVABLE", "Cette version n'existe plus.");
  if (v.reseau !== "instagram") throw new ErreurStudio("RESEAU", "La 2e ouverture se teste sur Reels.");
  const source = v.videoId ? await d.videos.obtenir(v.videoId) : null;
  if (!source || source.statut !== "prete") throw new ErreurStudio("SANS_VIDEO", "Fabriquez d'abord la vidéo Reels.");
  const m = (await d.scriptsMaitres.obtenir(v.scriptMaitreId))!;
  const autre = (m.accrochesFinalistes ?? []).find((a) => a.id !== v.accrocheId && a.dit.trim());
  if (!autre) throw new ErreurStudio("SANS_ACCROCHE", "Aucune autre accroche finaliste pour ce sujet.");
  const deuxieme = await sousVerrou(async () => {
    const encore = await lireParametre<{ videoId: Id } | null>(cle, null);
    if (encore) return encore;
    // L'ouverture de la version, accroche remplacée par la 2e finaliste (nouveaux identifiants : un nouveau son).
    const ouverture: BlocScript[] = v.ouverture.map((b, i) => ({ ...b, id: `${b.id}-a2`, segments: b.segments.map((s, k) => ({ ...s, id: `${s.id}-a2`, ...(i === 0 && k === 0 ? { texte: autre.dit, emphase: undefined } : {}) })) }));
    const videoId = await videoDeVersion(v, m, { ratios: ["9:16"], typeDerive: "variante-accroche", sourceVideoId: source.id }, { role: "seconde-ouverture", scriptMaitreId: m.id, operationId: options.operationId, mereVideoId: source.id, essaiAccroche: 2, accrocheId: autre.id, ouverture }, false);
    const r = { videoId };
    await ecrireParametre(cle, r);
    return r;
  });
  if (!options.lancer) return deuxieme;
  const { lancerFabrication } = await import("./fabrication");
  // CORRECTEUR 1 — B6 : la confirmation du prix vient de l'écran.
  const t = await lancerFabrication(deuxieme.videoId, { confirme: accordPropre(options.prixConfirme) });
  const fin = { ...deuxieme, travailId: t.travailId };
  await ecrireParametre(cle, fin);
  return fin;
}

/** « Fabriquer en entier » (raccord visible) : Will a vu le coût, la version part. */
export async function confirmerFabricationComplete(videoId: Id, options: { confirme?: AccordPrix } = {}): Promise<{ travailId: Id }> {
  await exigerSession();
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const decl = declinaisonDe(video);
  if (!video || decl?.role !== "complete") throw new ErreurStudio("INTROUVABLE", "Rien à confirmer pour cette vidéo.");
  const { lancerFabrication } = await import("./fabrication");
  const r = await lancerFabrication(videoId, { confirme: accordPropre(options.confirme) });
  await d.videos.modifier(videoId, { entrees: { ...video.entrees, [CLE]: { ...decl, attendConfirmation: false } } });
  return { travailId: r.travailId };
}

/* ------------------------------------------------------------------ */
/* Après une fabrication (boucle de fond, hors verrou)                  */
/* ------------------------------------------------------------------ */

const CODES_ATTENTE_CREDIT = CODES_ATTENTE;

/** Lance les versions qui attendaient leur mère ; un raccord visible bascule la version en fabrication complète à confirmer. */
async function lancerVariantesEnAttente(mereVideoId: Id): Promise<number> {
  const d = depots();
  const mere = await mereDe(mereVideoId);
  if (!mere) return 0;
  const enAttente = await d.videos.lister((x) => x.statut === "brouillon" && declinaisonDe(x)?.mereVideoId === mereVideoId && !!declinaisonDe(x)?.attendMere);
  const { lancerFabricationConfirmee } = await import("./fabrication");
  let n = 0;
  for (const video of enAttente) {
    const decl = declinaisonDe(video)!;
    const v = video.varianteId ? await d.variantes.obtenir(video.varianteId) : null;
    if (!v) continue;
    const { ouverture, corps, fin } = await blocsDeLaVersion(v, decl, undefined, video.distribution[0]?.voixId);
    const ordre = segmentsDesBlocs([...ouverture, ...corps, ...fin]);
    const refaits = new Set([...segmentsDesBlocs(ouverture), ...segmentsDesBlocs(fin)]);
    const r = raccordsSurMere({ nom: "mere", dureeSec: mere.dureeSec, segments: mere.segments, motsPrononces: mere.motsPrononces, plans: mere.plans }, etapesVariante({ ordreVersion: ordre, refaits, ordreMere: mere.segments.map((s) => s.segmentId) }));
    if (r.visible) {
      // Le raccord se verrait : la version sera fabriquée en entier, coût affiché, sur confirmation de Will.
      await d.videos.modifier(video.id, { typeDerive: undefined, sourceVideoId: undefined, entrees: { ...video.entrees, [CLE]: { ...decl, role: "complete", attendMere: false, attendConfirmation: true } } });
      await d.variantes.modifier(v.id, { corpsDistinct: { raison: r.raisons[0] ?? "aucune coupe de la mère au raccord", le: maintenant() } });
      await creerNotification({ type: "video-prete", titre: `${v.code} : raccord visible`, message: "Cette version doit être fabriquée en entier. Le coût est affiché sur la fiche du sujet.", lien: `/ecrire/sujets/${v.scriptMaitreId}`, estDemo: video.estDemo });
      continue;
    }
    // CORRECTEUR 1 — B6 : l'accord est celui donné par Will sur le total de « Fabriquer les N », gardé avec la version.
    const confirme = decl.prixConfirme ?? !!decl.moteurConfirme;
    try {
      await lancerFabricationConfirmee(video.id, { confirme, confirmationDifferee: { moteurId: decl.moteurConfirme } });
      await d.videos.modifier(video.id, { entrees: { ...((await d.videos.obtenir(video.id))?.entrees ?? {}), [CLE]: { ...decl, attendMere: false } } });
      n++;
    } catch (e) {
      if (!(e instanceof ErreurStudio)) throw e;
      if (CODES_ATTENTE_CREDIT.includes(e.code)) {
        // E2E-1 n° 2 (03/10) : crédit ou budget insuffisant = la version n'attend plus sa mère mais du crédit. Elle
        // devient un brouillon « lancer dès que possible » (geste déjà confirmé par « Fabriquer les N ») : prévenue
        // quand le crédit revient, relancée comme les autres vidéos en attente (`lancerVideosEnAttente`).
        const { fournisseurDeLErreur } = await import("./credits");
        const actuelle = (await d.videos.obtenir(video.id)) ?? video;
        await d.videos.modifier(video.id, {
          lancementEnAttente: { depuis: actuelle.lancementEnAttente?.depuis ?? maintenant(), fournisseur: e.code === "BUDGET_DEPASSE" ? "budget" : fournisseurDeLErreur(e, "heygen"), confirme, ...(decl.moteurConfirme ? { moteurId: decl.moteurConfirme } : {}) },
          entrees: { ...actuelle.entrees, [CLE]: { ...decl, attendMere: false } },
        });
        await creerNotification({ type: "credit", titre: `${v.code} attend du crédit`, message: `${e.message} Elle partira dès que le crédit le permettra.`, lien: `/ecrire/sujets/${v.scriptMaitreId}`, estDemo: video.estDemo });
        continue;
      }
      if (e.code === "CONFIRMATION_REQUISE") {
        // Correcteur R8 n° 1 : le prix a changé depuis l'accord (montage réel allumé entre-temps) : la version n'attend
        // plus sa mère, elle reste en brouillon jusqu'à ce que Will voie son prix et confirme.
        const actuelle = (await d.videos.obtenir(video.id)) ?? video;
        await d.videos.modifier(video.id, { entrees: { ...actuelle.entrees, [CLE]: { ...decl, attendMere: false } } });
      }
      await creerNotification({ type: "credit", titre: `${v.code} n'a pas pu partir`, message: e.message, lien: `/ecrire/sujets/${v.scriptMaitreId}`, estDemo: video.estDemo });
    }
  }
  return n;
}

/** Entrée des contrôles d'une version, sur ses blocs (corps assemblé pour SON réseau). */
async function entreeControleVersion(v: VarianteReseau, m: ScriptMaitre, decl: DeclinaisonVideo | undefined, voixId: Id | undefined): Promise<{ entree: EntreeControle; ordre: Id[] }> {
  const { ouverture, corps, fin } = await blocsDeLaVersion(v, decl, undefined, voixId);
  const entree = await entreeControleDeBlocs(v, m, { ouverture, corps, fin }, { mode: "avatar", adresse: "vous" });
  // Même ordre que l'horloge des contrôles : tous les segments des blocs, ouverture, corps, fin.
  const ordre = [...ouverture, ...corps, ...fin].flatMap((b) => b.segments.map((s) => s.id));
  return { entree, ordre };
}

/**
 * Après la fabrication d'une vidéo de version : contrôles sur l'horodatage RÉEL, durée réelle, fiche `image` ; pour une
 * mère, relevé du débit réel (recalage B.4.2) puis départ des versions qui l'attendaient.
 */
export async function apresFabricationGenerateur(videoId: Id): Promise<void> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video?.varianteId || video.statut !== "prete") return;
  const decl = declinaisonDe(video);
  const v = await d.variantes.obtenir(video.varianteId);
  const m = v ? await d.scriptsMaitres.obtenir(v.scriptMaitreId) : null;
  const mere = await mereDe(videoId);
  if (v && m && mere && decl?.role !== "seconde-ouverture") {
    const { entree, ordre } = await entreeControleVersion(v, m, decl, video.distribution[0]?.voixId);
    // Relecture du script : une phrase écrite ou modifiée par Will est jugée au barème « will », jamais « machine ».
    const reel = horodatageDesSegments(ordre, mere.segments);
    const r = controlerSelonAuteurs(entree, (e) => recontrolerSurHorodatageReel(e, reel));
    const version = video.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
    const c = version?.commande;
    const image = v.caracteristiques && !v.caracteristiques.image && c ? { doubleId: c.distribution[0]?.visageId ?? c.distribution[0]?.personnageId, fond: c.styles.decor?.id, cadrage: "large · poitrine", encadreStyle: c.styles.habillage?.id, musique: c.styles.musique?.id ?? "aucune" } : undefined;
    await d.variantes.modifier(v.id, {
      dureeReelleSec: +mere.dureeSec.toFixed(1),
      controlesReels: { le: maintenant(), videoId, dureeSec: +mere.dureeSec.toFixed(2), debit: debitMesure(mere.motsPrononces) ?? 0, violations: r.violations },
      ...(image ? { caracteristiques: { ...v.caracteristiques!, image } } : {}),
    });
  }
  if (decl?.role === "mere" && mere) {
    // Recalage du débit (B.4.2) : audio maître des MÈRES seulement, après la coupe des blancs.
    const releve = debitMesure(mere.motsPrononces);
    if (releve) {
      const avant = await lireParametre<{ releves: number[]; valeur: number | null }>(cleDebit(video.formatId), { releves: [], valeur: null });
      await ecrireParametre(cleDebit(video.formatId), recalerDebit(avant.releves, releve));
    }
    await lancerVariantesEnAttente(videoId);
  }
}

/** Débit recalé d'un format (mots par seconde) ; null tant que 5 mères n'ont pas été mesurées. */
export async function debitRecale(formatId: string): Promise<number | null> {
  return (await lireParametre<{ releves: number[]; valeur: number | null }>(cleDebit(formatId), { releves: [], valeur: null })).valeur;
}

/* ------------------------------------------------------------------ */
/* Lecture pour la fiche sujet                                          */
/* ------------------------------------------------------------------ */

export interface EtatFabricationVersion {
  varianteId: Id;
  videoId: Id;
  role: DeclinaisonVideo["role"];
  statut: Video["statut"];
  attendMere: boolean;
  attendConfirmation: boolean;
  /** E2E-1 n° 2 : la mère est prête, la version attend du crédit (« lancer dès que possible »). */
  attendCredit: boolean;
  /** E2E-2 parcours n° 1 : pourquoi elle attend et ce qui la fera partir (« Budget du mois atteint : … »). */
  raisonAttente?: string;
  coutComplet?: Montant;
  /** Lot R7e : part de l'avatar qui parle dans `coutComplet` (« Fabriquer en entier »). */
  avatarParle?: Montant;
  dureeReelleSec?: number;
  pointsSurVideo: string[];
}

/** État des vidéos de versions d'un sujet (fiche sujet) : qui attend sa mère, qui attend une confirmation, ce qui a été vu. */
export async function etatFabricationSujet(scriptMaitreId: Id): Promise<EtatFabricationVersion[]> {
  await exigerSession();
  const d = depots();
  const variantes = await d.variantes.lister((v) => v.scriptMaitreId === scriptMaitreId);
  const ids = new Set(variantes.map((v) => v.id));
  const videos = await d.videos.lister((x) => !!x.varianteId && ids.has(x.varianteId));
  const taux = await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
  const sortie: EtatFabricationVersion[] = [];
  for (const video of videos) {
    const decl = declinaisonDe(video);
    if (!decl) continue;
    const v = variantes.find((x) => x.id === video.varianteId)!;
    let coutComplet: Montant | undefined;
    let avatarParle: Montant | null = null;
    if (decl.attendConfirmation) {
      const { ouverture, corps, fin } = await blocsDeLaVersion(v, decl, undefined, video.distribution[0]?.voixId);
      const c = commandeEstimation(v, [...ouverture, ...corps, ...fin], null, taux, ["9:16"], await moteurDuFormat(v.formatId));
      const e = await moteurDeCommande(c).estimer(c);
      coutComplet = e.total;
      avatarParle = partDoubleReel(e.lignes);
    }
    sortie.push({
      varianteId: v.id,
      videoId: video.id,
      role: decl.role,
      statut: video.statut,
      attendMere: !!decl.attendMere,
      attendConfirmation: !!decl.attendConfirmation,
      attendCredit: video.statut === "brouillon" && !!video.lancementEnAttente,
      raisonAttente: video.statut === "brouillon" ? raisonAttente(video.lancementEnAttente) : undefined,
      coutComplet,
      ...(avatarParle ? { avatarParle } : {}),
      dureeReelleSec: v.dureeReelleSec,
      pointsSurVideo: decl.role === "seconde-ouverture" ? [] : (v.controlesReels?.videoId === video.id ? v.controlesReels.violations.map((x) => x.message) : []),
    });
  }
  return sortie;
}

/** Prix estimé d'une vidéo déjà créée, par le même chemin que son lancement (lecture seule ; 0 si elle ne peut pas encore partir). */
async function prixDeLaVideo(video: Video): Promise<Montant> {
  try {
    const script = video.scriptId ? await depots().scripts.obtenir(video.scriptId) : null;
    if (!script) return centimes(0);
    const { construireCommandeEstimation } = await import("./fabrication");
    const c = await construireCommandeEstimation(video, script);
    return (await moteurDeCommande(c).estimer(c)).total;
  } catch {
    return centimes(0);
  }
}

/**
 * Ce que la fiche sujet propose en plus (G6, G6b) : la 2e ouverture Reels (version Instagram fabriquée, une autre
 * accroche finaliste, prix estimé) et les versions « je lis » dont la prise est rangée (« Monter ma prise », 0 €).
 */
export async function propositionsFabrication(scriptMaitreId: Id): Promise<{ secondeOuverture: { varianteId: Id; prix: Montant; avatarParle?: Montant } | null; aMonter: Id[]; prixMonter: Record<Id, Montant> }> {
  await exigerSession();
  const d = depots();
  const m = await d.scriptsMaitres.obtenir(scriptMaitreId);
  if (!m || m.archiveLe) return { secondeOuverture: null, aMonter: [], prixMonter: {} };
  const vs = versionsCourantes(await d.variantes.lister((x) => x.scriptMaitreId === m.id));
  let secondeOuverture: { varianteId: Id; prix: Montant; avatarParle?: Montant } | null = null;
  const ig = vs.find((v) => v.reseau === "instagram" && v.videoId && !/-[LIV](-T)?$/.test(v.code));
  const source = ig?.videoId ? await d.videos.obtenir(ig.videoId) : null;
  const deja = ig ? await d.videos.trouver((x) => x.typeDerive === "variante-accroche" && x.varianteId === ig.id) : null;
  if (ig && source?.statut === "prete" && !deja && (m.accrochesFinalistes ?? []).some((a) => a.id !== ig.accrocheId && a.dit.trim())) {
    const taux = await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
    // Correcteur R8 n° 4 : estimée par le même chemin que le lancement (double, second angle…), comme « Fabriquer les N ».
    const { ouverture } = await blocsDeLaVersion(ig, undefined);
    const e = await estimerVersion(ig, m, segmentsDesBlocs(ouverture), taux, ["9:16"], await moteurDuFormat(ig.formatId));
    const avatarParle = partDoubleReel(e.lignes);
    secondeOuverture = { varianteId: ig.id, prix: e.total, ...(avatarParle ? { avatarParle } : {}) };
  }
  const aMonter: Id[] = [];
  const prixMonter: Record<Id, Montant> = {};
  for (const v of vs.filter((x) => x.prompteur && x.videoId)) {
    const video = await d.videos.obtenir(v.videoId!);
    if (video?.statut === "brouillon" && (video.entrees as Partial<PrisesVideo>).prises?.some((p) => !p.ratee)) {
      aMonter.push(v.id);
      // E2E-2 parcours n° 5 : le prix annoncé de « Monter ma prise » est celui que le lancement comptera (pas « 0 € » figé).
      prixMonter[v.id] = await prixDeLaVideo(video);
    }
  }
  return { secondeOuverture, aMonter, prixMonter };
}
