/**
 * DÉCLINAISONS DE FORMAT DU FACE CAMÉRA (lot F1) : 4:5, 1:1 et 16:9 en plus du 9:16, depuis la MÊME vidéo.
 *
 * Ce qui est partagé (fait une seule fois) : transcription, coupes, son monté, plans de la réalisation, passe image
 * 10 bits (sa bande couvre d'emblée toutes les fenêtres des formats demandés), cartes et sous-titres (mêmes textes,
 * mêmes instants). Ce qui change par format : la fenêtre de chaque plan (`briques/formats-facecam`, depuis la piste
 * du visage), la piste pré-cadrée (une étape « cadrage » de la route `/image` par format : un simple recadrage de la
 * passe déjà faite), la mise en page des écrans partagés, la place des sous-titres et la composition finale.
 *
 * Trois points d'entrée, tous FACULTATIFS (9:16 seul : rien n'est écrit, rien n'est soumis, rien ne change) :
 *  - dans la chaîne (`chaine.ts`) : `preparerDeclinaisons` (plans par format, après la réalisation),
 *    `bandeAvecDeclinaisons` (bande de la passe), `avancerDeclinaisons` (pistes pré-cadrées par format) et
 *    `declinaisonsFinies` ;
 *  - à la fin (`index.ts`) : `completerAvecDeclinaisons` ajoute une sortie par format et ce qu'il faut pour en ajouter
 *    un autre plus tard (`repriseFormats`) ;
 *  - « Ce format » ajouté après coup (pastilles de « Votre vidéo », « Monteur, fais-moi aussi une version carrée ») :
 *    `etatRepriseFormats` + `avancerReexportFacecam`. Si la passe déjà faite ne couvre pas le nouveau format, UNE
 *    passe élargie à tous les formats est faite, partagée par tous les formats ajoutés de la version (même
 *    identifiant de travail : le `studio-aligneur` ne la calcule qu'une fois).
 *  - pour la composition finale (intégration) : `habillageFacecamRatio(entree, ratio)`, même entrée que
 *    `habillageFacecam`, qui rend exactement `habillageFacecam(entree)` en 9:16.
 */
import type { AlerteQualite, CommandeFabrication, Travail } from "@/domaine/types";
import { lireEntreesFacecam } from "@/domaine/facecam";
import type { EntreeComposition } from "@/briques/composition";
import { avancerCompositions, type BaseComposition, type EtatMontage, type OutilsMontage } from "@/briques/composition/montage";
import { ErreurRendu, suivreRendu } from "@/fournisseurs/rendu/client";
import { dispositionQuiTient, GROUPEMENT_FACECAM, SOUS_TITRES_FACECAM, textesAffichesDesCartes } from "@/briques/habillage-facecam";
import { calerCarteTous, miseEnPage, preparerCarteTous } from "@/briques/motion";
import { grouperMots, recalerSurCoupes } from "@/briques/sous-titres/groupement";
import { recollerElisionsHorodatees } from "@/briques/sous-titres/recollage";
import type { PisteVisage, PlanCamera } from "@/briques/realisation";
import {
  bandeCouvre,
  bandeDesFenetres,
  CADRAGE_FORMATS,
  controlerFormat,
  declinaisonsDemandees,
  DIMENSIONS_FACECAM,
  dispositionEcranPartage,
  echelleTexteFormat,
  hauteurLettrePx,
  formatsDesConsignes,
  lireFormatsFacecam,
  ligneEcranPartage,
  nomRatio,
  placementPersonne,
  plansDuFormat,
  positionSousTitresFormat,
  RATIOS_DECLINAISON,
  renduCarteFormat,
  VERSION_FORMATS_FACECAM,
  visagePx,
  type ControleFormat,
  type PlacementPersonne,
  type PlanFormat,
  type RatioDeclinaison,
  type RatioFacecam,
} from "@/briques/formats-facecam";
import type { DemandeFacecam } from "@/fournisseurs/facecam/client";
import { ZERO } from "@/lib/montants";
import type { ResultatFabrication, SortieProduite } from "../types";
import { aSoumettre, apresSoumission, prochaineSoumission, sansReprise, suiviSansEssai } from "./reprise";
import { alertesControles, bandeDesPlans, cleResultat, dimensionsSource, ESSAIS_MAX, renduPassager, priseDe, type ContexteChaine, type ControlesMontage, type DependancesChaine, type EtatChaine, type EtatHabillage, type SuiviTravail } from "./chaine";
import { cartePosee, demandeRenduCarte, type CarteMonteur } from "./raccords";
import type { CodeCarte } from "./monteur/operations";
import type { AjustementCarteAutoMonte } from "./cartes-video";
import { cartesPosees, habillageFacecam, planUnique, type CartePosee, type EntreeHabillageFacecam, type HabillageFacecam, type RenduCarte } from "./habillage";


/** Ce que la chaîne garde pour les déclinaisons (petit : clés, plans, identifiants ; jamais d'image). */
export interface EtatDeclinaisons {
  version: string;
  /** Formats à fabriquer (sans le 9:16). */
  ratios: RatioDeclinaison[];
  /** Formats imposés (« Ce format » ajouté après coup) : seuls ceux-là, quoi que disent les entrées. */
  imposes?: RatioDeclinaison[];
  source: { largeur: number; hauteur: number };
  plans: Partial<Record<RatioDeclinaison, PlanFormat[]>>;
  /** Bande demandée à la passe image (union du 9:16 et des formats). */
  bande?: { x: number; largeur: number };
  /** Passe élargie à tous les formats, quand la passe faite ne couvre pas un format ajouté après coup. */
  passeLarge?: SuiviTravail;
  /** Bande demandée à la passe élargie. */
  bandeLarge?: { x: number; largeur: number };
  /** Format ajouté après coup : la vraie piste du visage a été relue (plans recalculés sur elle). */
  pisteLue?: boolean;
  cadrages: Partial<Record<RatioDeclinaison, SuiviTravail>>;
  /** Formats ratés (définitivement) : la vidéo et les autres formats sortent quand même. */
  rates?: { ratio: RatioDeclinaison; message: string }[];
  /** Habillage (cartes puis composition finale) de chaque format ; absent tant que le 9:16 n'est pas habillé. */
  habillages?: Partial<Record<RatioDeclinaison, HabillageDuFormat>>;
  /** Cartes rendues pour les formats, par clé (une carte identique d'un format à l'autre n'est rendue qu'une fois). */
  cartes?: Record<string, EtatHabillage["cartes"][number]>;
  /** Entrée de l'habillage (mots montés, raccords, cartes) : sert aussi à un format coché plus tard. */
  entreeHabillage?: Omit<EntreeHabillageFacecam, "pisteMonteeCle">;
  /** Format ajouté après coup : ce que la fabrication a gardé pour l'habiller. */
  repriseHabillage?: RepriseHabillage;
}

/* ------------------------------------------------------------------ */
/* Formats demandés                                                    */
/* ------------------------------------------------------------------ */

/** Formats à fabriquer avec cette vidéo : commande, `entrees.facecamFormats`, consignes dites (« version carrée »). */
export function formatsDeLaFabrication(c: Pick<CommandeFabrication, "ratios" | "entrees">, etat: Pick<EtatChaine, "coupes" | "declinaisons">): RatioDeclinaison[] {
  if (etat.declinaisons?.imposes) return etat.declinaisons.imposes;
  return declinaisonsDemandees(c.ratios, lireFormatsFacecam(c.entrees).ratios, formatsDesConsignes(etat.coupes?.consignes ?? []));
}

/**
 * Après la réalisation (plans du 9:16 posés) : plans de chaque format demandé, depuis la piste du visage. Aucun
 * format demandé : rien n'est écrit (l'état reste celui du 9:16 seul).
 */
export function preparerDeclinaisons(etat: EtatChaine, c: Pick<CommandeFabrication, "ratios" | "entrees">, o: { piste?: PisteVisage | null; source: { largeur: number; hauteur: number } }): void {
  if (!etat.plans?.length) return;
  const ratios = formatsDeLaFabrication(c, etat);
  if (!ratios.length) return;
  const d: EtatDeclinaisons = etat.declinaisons ?? { version: VERSION_FORMATS_FACECAM, ratios, source: o.source, plans: {}, cadrages: {} };
  d.ratios = ratios;
  for (const r of ratios) if (!d.plans[r]) d.plans[r] = plansDuFormat(r, etat.plans, o.source, o.piste);
  etat.declinaisons = d;
}

/** Bande de la passe image couvrant le 9:16 ET les formats demandés (null : 9:16 seul, la bande d'avant). */
export function bandeAvecDeclinaisons(etat: EtatChaine, source: { largeur: number; hauteur: number }): { x: number; largeur: number } | null {
  const d = etat.declinaisons;
  if (!d || !etat.plans) return null;
  const cadres = d.ratios.flatMap((r) => (d.plans[r] ?? []).map((p) => p.cadre));
  if (!cadres.length) return null;
  const b916 = bandeDesPlans(etat.plans, source);
  const bf = bandeDesFenetres(cadres, source)!;
  const x = Math.min(b916.x, bf.x);
  const bande = { x, largeur: 2 * Math.floor((Math.max(b916.x + b916.largeur, bf.x + bf.largeur) - x) / 2) };
  d.bande = bande;
  return bande;
}

/** Tous les formats demandés sont-ils faits (ou définitivement ratés) ? Vrai sans déclinaison. */
export function declinaisonsFinies(etat: Pick<EtatChaine, "declinaisons">): boolean {
  const d = etat.declinaisons;
  if (!d) return true;
  return d.ratios.every((r) => d.cadrages[r]?.statut === "termine" || d.rates?.some((x) => x.ratio === r));
}

/* ------------------------------------------------------------------ */
/* Pistes pré-cadrées par format                                       */
/* ------------------------------------------------------------------ */

const identifiant = (base: string, nom: string, essai: number) => `${base}-${nom}${essai ? `-e${essai}` : ""}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 200);

/**
 * Un tour des déclinaisons (appelé par la chaîne après la piste 9:16) : suit les travaux soumis, soumet la piste
 * pré-cadrée de chaque format dès que le son et la passe image sont prêts. Ne lève jamais : une panne d'un format
 * devient un format raté (la vidéo 9:16 et les autres formats sortent quand même).
 */
export async function avancerDeclinaisons(etat: EtatChaine, c: CommandeFabrication, ctx: ContexteChaine, deps: DependancesChaine): Promise<void> {
  // Format coché pendant la fabrication, après la réalisation : ses plans sont faits ici (depuis les plans du 9:16).
  if (!etat.declinaisons && etat.plans?.length && !etat.fini && formatsDeLaFabrication(c, etat).length) {
    preparerDeclinaisons(etat, c, { source: dimensionsSource(etat) });
  }
  const d = etat.declinaisons;
  // Formats ajoutés en cours de route : leurs plans s'ajoutent (ceux déjà faits ne bougent pas).
  if (d && !d.imposes) {
    const voulus = formatsDeLaFabrication(c, etat);
    for (const r of voulus) if (!d.ratios.includes(r)) {
      d.ratios.push(r);
      d.plans[r] ??= plansDuFormat(r, etat.plans ?? [], d.source);
    }
  }
  if (!d || !d.ratios.length || !etat.plans) return;
  const prise = priseDe(c);
  if (!prise) return;
  const simule = deps.facecam.mode === "simulation";
  const lire = async (cle: string) => (simule || !deps.urlLecture ? `https://simulation.invalid/${cle}` : deps.urlLecture(cle));
  const deposer = async (cle: string, mime: string) => (simule || !deps.urlDepot ? `https://simulation.invalid/${cle}` : deps.urlDepot(cle, mime));
  const cle = (nom: string) => cleResultat(c, ctx.versionId, nom);
  const t = etat.travaux;
  const fini = (s?: SuiviTravail) => s?.statut === "termine";
  const aRelancer = (s?: SuiviTravail) => aSoumettre(s, ESSAIS_MAX);
  const rate = (s?: SuiviTravail) => s?.statut === "echec" && !aRelancer(s);
  const maintenant = () => deps.maintenant?.() ?? Date.now();

  async function suivre(s: SuiviTravail | undefined, route: "image"): Promise<SuiviTravail | undefined> {
    if (!s || s.statut !== "soumis") return s;
    const r = await deps.facecam.suivre(route, s.id);
    // Vérif V5 : conteneur qui redémarre ou recréé pendant la passe « formats » → aucun essai consommé.
    const repris = suiviSansEssai(s, r, maintenant());
    if (repris) return repris;
    if (r.statut === "termine") return { ...sansReprise(s), statut: "termine", progression: 100, resultat: r.resultat as unknown as Record<string, unknown> };
    if (r.statut === "en_cours") return { ...sansReprise(s), progression: r.progression };
    if (r.statut === "echec") return { ...sansReprise(s), statut: "echec", erreur: { code: r.erreur.code, message: r.erreur.message, reessayable: r.erreur.reessayable && s.essais < ESSAIS_MAX } };
    return sansReprise(s);
  }
  async function soumettre(precedent: SuiviTravail | undefined, id: (essai: number) => string, demande: Omit<DemandeFacecam, "idTravail">): Promise<SuiviTravail> {
    const s = prochaineSoumission(precedent, id);
    const r = await deps.facecam.soumettre("image", { ...demande, idTravail: s.id });
    return apresSoumission(s, precedent, r, maintenant());
  }

  d.passeLarge = await suivre(d.passeLarge, "image");
  for (const r of d.ratios) d.cadrages[r] = await suivre(d.cadrages[r], "image");

  // Prérequis communs, comme la piste 9:16 : le son monté, et l'image (passe faite, ratée ou coupée).
  const avecPasse = c.briques.etalonnage !== false;
  const imagePrete = !avecPasse || fini(t.passe) || rate(t.passe);
  if (!fini(t.son) || !imagePrete) return;
  const visages = t.visages?.resultat as { pisteVisageCle?: string; pointsCle?: string } | undefined;
  const passe = t.passe?.resultat as { fichierCle?: string; bande?: { x: number; largeur: number } } | undefined;
  const sonCle = (t.son?.resultat as { fichierCle?: string } | undefined)?.fichierCle ?? cle("son.flac");

  // La passe faite couvre-t-elle tous les formats ? Sinon (format ajouté après coup) : UNE passe élargie, partagée.
  const bandeFaite = passe?.bande ?? d.bande ?? bandeDesPlans(etat.plans, d.source);
  const cadres = (r: RatioDeclinaison) => (d.plans[r] ?? []).map((p) => p.cadre);
  const avecImage = fini(t.passe) && !!passe?.fichierCle;
  const aElargir = avecImage && d.ratios.some((r) => !bandeCouvre(bandeFaite, cadres(r)));
  if (aElargir && aRelancer(d.passeLarge)) {
    const tous = RATIOS_DECLINAISON.flatMap((r) => (d.plans[r] ?? plansDuFormat(r, etat.plans!, d.source)).map((p) => p.cadre));
    const b916 = bandeDesPlans(etat.plans, d.source);
    const bf = bandeDesFenetres(tous, d.source)!;
    const x = Math.min(b916.x, bf.x);
    const bande = { x, largeur: 2 * Math.floor((Math.max(b916.x + b916.largeur, bf.x + bf.largeur) - x) / 2) };
    d.bandeLarge = bande;
    const entrees = lireEntreesFacecam(c.entrees);
    const lut = c.styles.lut && c.styles.lut.id !== "aucune" ? c.medias?.[c.styles.lut.id] : undefined;
    const look = (c.entrees as { facecamLookWill?: { peauLab?: number[]; murLab?: number[] } } | undefined)?.facecamLookWill;
    // Mêmes réglages que la passe du 9:16 (chaîne, étape 5), seule la bande change.
    d.passeLarge = await soumettre(d.passeLarge, (e) => identifiant(ctx.versionId, "passe-formats", e), {
      source: await lire(prise.cle),
      depots: { image: await deposer(cle("image-10bits-formats.mp4"), "video/mp4") },
      parametres: {
        etape: "passe",
        bande,
        image: entrees.image,
        ...(fini(t.visages) && visages?.pointsCle ? { points: await lire(visages.pointsCle), ...(visages.pisteVisageCle ? { piste: await lire(visages.pisteVisageCle) } : {}) } : {}),
        ...(lut ? { lut: { adresse: await lire(lut.cle), intensite: c.styles.lut?.intensite ?? 60 } } : {}),
        ...(look?.peauLab ? { lookWill: look } : {}),
        cles: { image: cle("image-10bits-formats.mp4") },
      },
    });
  }
  const large = d.passeLarge?.resultat as { fichierCle?: string; bande?: { x: number; largeur: number } } | undefined;
  if (aElargir && !fini(d.passeLarge) && !rate(d.passeLarge)) return;

  for (const r of d.ratios) {
    const plans = d.plans[r];
    if (!plans?.length || d.rates?.some((x) => x.ratio === r)) continue;
    if (rate(d.cadrages[r])) {
      (d.rates ??= []).push({ ratio: r, message: d.cadrages[r]?.erreur?.message ?? `Le format ${r} n'a pas abouti.` });
      continue;
    }
    if (!aRelancer(d.cadrages[r])) continue;
    const nom = nomRatio(r);
    const depuisLarge = aElargir && fini(d.passeLarge) && !!large?.fichierCle;
    // Passe élargie ratée : la prise est recadrée telle quelle (préparée), comme la piste 9:16 quand la passe rate.
    const imageSource = depuisLarge ? large!.fichierCle! : avecImage && !aElargir ? passe!.fichierCle! : null;
    const { largeur, hauteur } = DIMENSIONS_FACECAM[r];
    d.cadrages[r] = await soumettre(d.cadrages[r], (e) => identifiant(ctx.travailId, `cadrage-${nom}`, e), {
      source: imageSource ? await lire(imageSource) : await lire(prise.cle),
      depots: { montage: await deposer(cle(`montage-${nom}.mov`), "video/quicktime"), vignette: await deposer(cle(`vignette-${nom}.jpg`), "image/jpeg") },
      parametres: {
        etape: "cadrage",
        ...(imageSource ? { bande: (depuisLarge ? (large!.bande ?? d.bandeLarge) : (passe!.bande ?? bandeFaite)) ?? { x: 0 } } : { preparer: true, bande: { x: 0 } }),
        plans: plans.map((p) => ({ debutSec: p.debutSec, finSec: p.finSec, priseDebutSec: p.priseDebutSec, priseFinSec: p.priseFinSec, cadre: p.cadre })),
        son: await lire(sonCle),
        prise: await lire(prise.cle),
        ...(fini(t.visages) && visages?.pisteVisageCle ? { piste: await lire(visages.pisteVisageCle) } : {}),
        sortie: { largeur, hauteur },
        cles: { montage: cle(`montage-${nom}.mov`), vignette: cle(`vignette-${nom}.jpg`) },
      },
    });
  }
}

/* ------------------------------------------------------------------ */
/* Résultat : une sortie par format                                    */
/* ------------------------------------------------------------------ */

/** Ce qu'il faut garder (petit) pour ajouter un format plus tard sans rien refaire d'autre. */
export interface RepriseFormats {
  version: string;
  travaux: Pick<EtatChaine["travaux"], "son" | "passe" | "visages" | "cadrage">;
  plans: PlanCamera[];
  bande?: { x: number; largeur: number };
  source?: { largeur: number; hauteur: number };
  /** Formats déjà faits avec cette version. */
  faits: RatioDeclinaison[];
  passeLarge?: SuiviTravail;
  /** De quoi habiller un format ajouté (mêmes mots montés, mêmes raccords, mêmes cartes du monteur). */
  habillage?: RepriseHabillage;
}

export interface RepriseHabillage {
  dureeSec: number;
  mots: EntreeHabillageFacecam["mots"];
  coupesSec: number[];
  cartesMonteur?: CarteMonteur[];
  /** 10/10 : gestes de Will sur les cartes automatiques (temps du montage) : mêmes cartes dans le format ajouté. */
  cartesAuto?: AjustementCarteAutoMonte[];
  /** Vérif V1 : cartes automatiques retirées depuis le chat : elles ne reviennent pas dans le format ajouté. */
  cartesAutoRetirees?: string[];
}

/** Contrôle machine d'un format sur ses plans seuls (visage et ligne des sous-titres par défaut). */
export function controlePlans(ratio: RatioDeclinaison, plans: PlanFormat[]): ControleFormat {
  return controlerFormat({ ratio, plans, sousTitres: { centrePct: positionSousTitresFormat(ratio, bouchePctDesPlans(plans)) } });
}

/** Bouche la plus basse dans l'image d'un format (% de la hauteur), d'après les plans. */
export function bouchePctDesPlans(plans: PlanFormat[]): number | undefined {
  if (!plans.length) return undefined;
  const H = DIMENSIONS_FACECAM[plans[0].ratio].hauteur;
  return Math.max(...plans.map((p) => {
    const v = visagePx(p);
    return ((v.yeuxY + CADRAGE_FORMATS.boucheSousYeux * v.hauteur) / H) * 100;
  }));
}

function sortieDuFormat(r: RatioDeclinaison, d: EtatDeclinaisons, simple: boolean): SortieProduite | null {
  const t = d.cadrages[r];
  if (t?.statut !== "termine") return null;
  const res = t.resultat as { fichierCle?: string; vignetteCle?: string; dureeSec?: number; controles?: ControlesMontage } | undefined;
  if (!res?.fichierCle) return null;
  const hab = d.habillages?.[r];
  // Contrôle machine : celui de l'habillage (visage, sous-titres, cartes) s'il a été fait, sinon celui des plans.
  const ctrl = hab ? hab.alertesControle : d.plans[r] ? controlePlans(r, d.plans[r]!).alertes : [];
  const alertes: AlerteQualite[] = [...alertesControles(res.controles, undefined, undefined, 0), ...ctrl, ...(hab?.sortie?.alertes ?? [])];
  const bloquantes = alertes.filter((a) => a.gravite === "bloquant").length;
  const note = Math.max(40, (simple ? 80 : 88) - 10 * bloquantes - 3 * (alertes.length - bloquantes));
  const { largeur, hauteur } = DIMENSIONS_FACECAM[r];
  return {
    ratio: r,
    fichierCle: hab?.sortie?.fichierCle ?? res.fichierCle,
    vignetteCle: hab?.sortie?.vignetteCle ?? res.vignetteCle ?? "",
    resolution: `${largeur}x${hauteur}`,
    dureeSec: Number(res.dureeSec) || 0,
    taille: 0,
    rapportQualite: {
      note,
      verifie: { image: true, son: true, sousTitres: !!hab?.sortie, mentionIA: false, droits: false },
      alertes,
      niveauSonoreLufs: Number(res.controles?.niveauLufs ?? -14),
    },
  };
}

/**
 * Résultat de la fabrication avec les déclinaisons : une sortie par format fait, une alerte par format raté, et la
 * reprise pour ajouter un format plus tard. Les sorties et la note du 9:16 ne changent pas.
 */
export function completerAvecDeclinaisons(resultat: ResultatFabrication, etat: EtatChaine): ResultatFabrication {
  const d = etat.declinaisons;
  const reprise: RepriseFormats = {
    version: VERSION_FORMATS_FACECAM,
    travaux: { son: etat.travaux.son, passe: etat.travaux.passe, visages: etat.travaux.visages, cadrage: etat.travaux.cadrage },
    plans: etat.plans ?? [],
    ...(d?.bande ? { bande: d.bande } : {}),
    ...(d?.source ? { source: d.source } : {}),
    faits: d ? d.ratios.filter((r) => d.cadrages[r]?.statut === "termine") : [],
    ...(d?.passeLarge?.statut === "termine" ? { passeLarge: d.passeLarge } : {}),
    ...(etat.habillage && !etat.habillage.abandonne && etat.habillage.base.mots
      ? { habillage: { dureeSec: etat.habillage.base.dureeSec, mots: etat.habillage.base.mots, coupesSec: raccordsDesGardes(etat.coupes?.gardes ?? []), ...(etat.monteur?.cartes.length ? { cartesMonteur: etat.monteur.cartes } : {}), ...(etat.habillage.cartesAutoFiche?.ajustements.length ? { cartesAuto: etat.habillage.cartesAutoFiche.ajustements } : {}), ...(etat.habillage.cartesAutoFiche?.retirees?.length ? { cartesAutoRetirees: etat.habillage.cartesAutoFiche.retirees } : {}) } }
      : {}),
  };
  const projetMontage = { ...resultat.projetMontage, repriseFormats: reprise };
  if (!d) return { ...resultat, projetMontage };
  const simple = (resultat.projetMontage as { version?: string }).version === "simple";
  const sorties = d.ratios.map((r) => sortieDuFormat(r, d, simple)).filter((s): s is SortieProduite => !!s);
  const autresMasters = d.ratios.flatMap((r) => {
    const masterCle = sorties.some((x) => x.ratio === r) ? d.habillages?.[r]?.sortie?.masterCle : undefined;
    return masterCle ? [{ type: "master-sans-texte" as const, fournisseur: "studio-rendu", fichierCle: masterCle, ratio: r, cout: ZERO }] : [];
  });
  const rates: AlerteQualite[] = (d.rates ?? []).map((x) => ({ code: "export", gravite: "attention", message: `1 élément non fait — le format ${x.ratio} : ${x.message}` }));
  return {
    ...resultat,
    sorties: [...resultat.sorties, ...sorties],
    // Vidéo sans texte de chaque format habillé (miniatures et recalque).
    ...(autresMasters.length ? { pistes: [...(resultat.pistes ?? []), ...autresMasters] } : {}),
    noteQualite: rates.length ? { ...resultat.noteQualite, alertes: [...resultat.noteQualite.alertes, ...rates] } : resultat.noteQualite,
    projetMontage: { ...projetMontage, formats: { ratios: d.ratios, faits: reprise.faits, montages: Object.fromEntries(sorties.map((s) => [s.ratio, s.fichierCle])) } },
  };
}

/* ------------------------------------------------------------------ */
/* « Ce format » ajouté après coup                                     */
/* ------------------------------------------------------------------ */

/** État de chaîne d'un format ajouté après coup, depuis ce que la fabrication a gardé (rien n'est refait). */
export function etatRepriseFormats(projetMontage: Record<string, unknown> | undefined, ratios: RatioFacecam[]): EtatChaine | null {
  const reprise = projetMontage?.repriseFormats as RepriseFormats | undefined;
  if (!reprise?.plans?.length || !reprise.travaux.son || reprise.travaux.son.statut !== "termine") return null;
  const voulus = ratios.filter((r): r is RatioDeclinaison => r !== "9:16");
  if (!voulus.length) return null;
  const visages = reprise.travaux.visages?.resultat as { largeurSource?: number; hauteurSource?: number } | undefined;
  const source = reprise.source ?? { largeur: visages?.largeurSource ?? 3840, hauteur: visages?.hauteurSource ?? 2160 };
  return {
    version: "reprise-formats-1",
    travaux: { ...reprise.travaux },
    plans: reprise.plans,
    sauts: [],
    mots: { statut: "fait", essais: 0 },
    declinaisons: {
      version: VERSION_FORMATS_FACECAM,
      ratios: voulus,
      imposes: voulus,
      source,
      plans: Object.fromEntries(voulus.map((r) => [r, plansDuFormat(r, reprise.plans, source)])),
      ...(reprise.bande ? { bande: reprise.bande } : {}),
      ...(reprise.passeLarge ? { passeLarge: reprise.passeLarge } : {}),
      ...(reprise.habillage ? { repriseHabillage: reprise.habillage } : {}),
      cadrages: {},
    },
  };
}

/** Raccords du montage (temps monté) d'après les passages gardés : les groupes de sous-titres s'y calent. */
export function raccordsDesGardes(gardes: { debutSec: number; finSec: number }[]): number[] {
  const coupes: number[] = [];
  let t = 0;
  for (const g of gardes.slice(0, -1)) coupes.push(+(t += g.finSec - g.debutSec).toFixed(3));
  return coupes;
}

/**
 * 10/10 : durées d'un format ajouté après coup, calées sur la production (studio-aligneur 2 cœurs, prise 4K) : la passe
 * image élargie relit TOUTE la prise (≈ 5 s de calcul par seconde filmée), le cadrage du format ≈ 1,5 s par seconde
 * montée, l'habillage (cartes puis composition) ≈ 1 min + 1 s par seconde montée. Une vidéo de 2 min avec passe :
 * ≈ 15 min ; sans passe : ≈ 5 min. Ce n'est qu'un point de départ : la progression réelle des travaux le corrige.
 */
export const DUREES_NOUVEAU_FORMAT = { passeParSecPrise: 5, cadrageParSecMontee: 1.5, habillageFixeSec: 60, habillageParSecMontee: 1 } as const;

export interface EstimationNouveauFormat {
  /** La passe image doit être refaite plus large (le format sort de la bande déjà traitée). */
  passeElargie: boolean;
  passeSec: number;
  cadrageSec: number;
  habillageSec: number;
  totalSec: number;
}

/** Ce que coûtera en temps un format ajouté après coup (état de reprise de `etatRepriseFormats`). */
export function estimationNouveauFormat(etat: EtatChaine): EstimationNouveauFormat {
  const d = etat.declinaisons;
  const plans = etat.plans ?? [];
  const dureeMontee = Math.max(d?.repriseHabillage?.dureeSec ?? 0, ...plans.map((p) => p.finSec), 0);
  const dureePrise = Math.max(dureeMontee, ...plans.map((p) => p.priseFinSec), 0);
  const passe = etat.travaux.passe;
  const resultat = passe?.resultat as { fichierCle?: string; bande?: { x: number; largeur: number } } | undefined;
  const avecImage = passe?.statut === "termine" && !!resultat?.fichierCle;
  const bande = resultat?.bande ?? d?.bande ?? (d && plans.length ? bandeDesPlans(plans, d.source) : undefined);
  const passeElargie = !!d && avecImage && d.passeLarge?.statut !== "termine" && d.ratios.some((r) => !bandeCouvre(bande, (d.plans[r] ?? []).map((p) => p.cadre)));
  const n = Math.max(1, d?.ratios.length ?? 1);
  const D = DUREES_NOUVEAU_FORMAT;
  const passeSec = passeElargie ? Math.round(D.passeParSecPrise * dureePrise) : 0;
  const cadrageSec = Math.round(D.cadrageParSecMontee * dureeMontee * n);
  const habillageSec = d?.repriseHabillage ? Math.round((D.habillageFixeSec + D.habillageParSecMontee * dureeMontee) * n) : 0;
  return { passeElargie, passeSec, cadrageSec, habillageSec, totalSec: Math.max(60, passeSec + cadrageSec + habillageSec) };
}

/** Avancement d'une partie (0-100) : celui du travail du studio-aligneur, 100 une fois fini. */
const avancement = (s?: SuiviTravail) => (s?.statut === "termine" ? 100 : (s?.progression ?? 0));

/**
 * Progression honnête d'un format ajouté après coup (0-100) et temps restant estimé (s) : chaque partie pèse sa durée
 * estimée ; la passe élargie suit la vraie progression du travail `/image` (avant : 1 % pendant toute la passe).
 */
export function progressionNouveauFormat(etat: EtatChaine, estimation: EstimationNouveauFormat): { progression: number; resteSec: number } {
  const d = etat.declinaisons!;
  const ratios = d.ratios.length ? d.ratios : [];
  const moyenne = (f: (r: RatioDeclinaison) => number) => (ratios.length ? ratios.reduce((s, r) => s + f(r), 0) / ratios.length : 100);
  const passe = estimation.passeElargie ? avancement(d.passeLarge) : 100;
  const cadrage = moyenne((r) => (d.rates?.some((x) => x.ratio === r) ? 100 : avancement(d.cadrages[r])));
  const habillage = moyenne((r) => {
    const h = d.habillages?.[r];
    if (!h) return 0;
    if (h.sortie || h.abandonne) return 100;
    const cartes = h.cartes.length ? h.cartes.filter((c) => d.cartes?.[c]?.statut !== "soumise").length / h.cartes.length : 1;
    return h.composition ? 60 : 50 * cartes;
  });
  const parties = [
    { poids: estimation.passeSec, fait: passe },
    { poids: estimation.cadrageSec, fait: cadrage },
    { poids: estimation.habillageSec, fait: habillage },
  ].filter((x) => x.poids > 0);
  const total = parties.reduce((s, x) => s + x.poids, 0) || 1;
  const progression = parties.reduce((s, x) => s + x.poids * x.fait, 0) / total;
  const resteSec = Math.round(parties.reduce((s, x) => s + x.poids * (1 - x.fait / 100), 0));
  return { progression: Math.round(progression), resteSec };
}

/**
 * Un tour d'un format ajouté après coup : pistes pré-cadrées du format (et la passe élargie si besoin). Ni coupes, ni
 * son, ni relecture : tout le reste est déjà fait. Rend le résultat (une sortie par format ajouté) à la fin.
 */
export async function avancerReexportFacecam(travail: Travail, commande: CommandeFabrication, deps: DependancesChaine, maintenant: number): Promise<{ travail: Travail; resultat?: ResultatFabrication }> {
  const etat = structuredClone(travail.parametres?.chaine as EtatChaine);
  const ctx: ContexteChaine = { travailId: travail.id, versionId: travail.versionId ?? commande.videoId };
  // Plans du format recalculés depuis la vraie piste du visage quand elle est lisible (sinon depuis les plans 9:16).
  const d = etat.declinaisons!;
  const pisteCle = (etat.travaux.visages?.resultat as { pisteVisageCle?: string } | undefined)?.pisteVisageCle;
  if (!d.pisteLue && pisteCle && deps.lireJsonGz && deps.facecam.mode !== "simulation") {
    const piste = ((await deps.lireJsonGz(pisteCle).catch(() => null)) as PisteVisage | null) ?? null;
    if (piste) for (const r of d.ratios) d.plans[r] = plansDuFormat(r, etat.plans!, d.source, piste);
    d.pisteLue = true;
  }
  try {
    await avancerDeclinaisons(etat, commande, ctx, deps);
    // Puis l'habillage du format (mêmes sous-titres, mêmes cartes, composition finale), comme à la fabrication.
    if (declinaisonsFinies(etat) && deps.habillage && d.repriseHabillage) {
      if (!d.habillages) {
        const h = d.repriseHabillage;
        const simule = deps.facecam.mode === "simulation";
        const cartes: CartePosee[] = [];
        for (const m of h.cartesMonteur ?? []) {
          const code = m.codeCle && deps.lireJsonGz && !simule ? ((await deps.lireJsonGz(m.codeCle).catch(() => null)) as CodeCarte | null) : null;
          const posee = cartePosee(m, code, commande.intensite?.niveau);
          if (posee) cartes.push(posee);
        }
        const lut = commande.styles.lut && commande.styles.lut.id !== "aucune" ? commande.medias?.[commande.styles.lut.id] : undefined;
        await preparerHabillagesFormats(
          etat,
          { dureeSec: h.dureeSec, mots: h.mots, coupesSec: h.coupesSec, ...(h.cartesMonteur?.length ? { cartes } : {}), ...(h.cartesAuto?.length ? { cartesAuto: h.cartesAuto } : {}), ...(h.cartesAutoRetirees?.length ? { cartesAutoRetirees: h.cartesAutoRetirees } : {}), versionSimple: !!commande.plafondClaudeAtteint, ...(lut ? { lookLutCle: lut.cle } : {}), prefixeCartes: cleResultat(commande, ctx.versionId, "cartes") },
          deps.habillage,
        );
      }
      await avancerHabillagesFormats(etat, commande, ctx, deps.habillage);
    }
  } catch (e) {
    // Panne imprévue (stockage, réseau) : on retentera au tour suivant, sans rien perdre.
    void e;
  }
  const fini = declinaisonsFinies(etat) && (!deps.habillage || !d.repriseHabillage || habillagesFormatsRegles(etat));
  const faits = d.ratios.filter((r) => d.cadrages[r]?.statut === "termine");
  const iso = new Date(maintenant).toISOString();
  const tousRates = fini && !faits.length;
  // 10/10 : progression et fin estimée suivent la vraie passe image (et le cadrage, l'habillage), pondérées par leur durée.
  const estimation = (travail.parametres?.estimation as EstimationNouveauFormat | undefined) ?? estimationNouveauFormat(etat);
  const suivi = progressionNouveauFormat(etat, estimation);
  const progression = suivi.progression;
  const debut = Date.parse(travail.debuteLe ?? travail.creeLe);
  const ecoule = Number.isFinite(debut) ? Math.max(0, (maintenant - debut) / 1000) : 0;
  // Au-delà de 5 %, le rythme réel compte pour moitié (une passe plus lente que prévu repousse l'heure de fin).
  const resteSec = progression >= 5 && ecoule > 0 ? Math.round((suivi.resteSec + (ecoule * (100 - progression)) / progression) / 2) : suivi.resteSec;
  const etapes = travail.etapes.map((e) => ({
    ...e,
    statut: tousRates ? ("echec" as const) : fini ? ("terminee" as const) : ("en_cours" as const),
    progression: fini ? 100 : Math.max(1, Math.min(99, progression)),
    ...(fini && !tousRates ? { coutReel: ZERO } : {}),
    ...(tousRates ? { erreur: { code: "FACECAM_ECHEC", reessayable: true, messagePourWill: "Le nouveau format n'a pas abouti. Vous pouvez réessayer.", detailTechnique: d.rates?.map((x) => x.message).join(" ") ?? "" } } : {}),
  }));
  const suivant: Travail = {
    ...travail,
    etapes,
    progression: fini ? 100 : Math.max(1, Math.min(99, progression)),
    statut: tousRates ? "echec" : fini ? "termine" : "en_cours",
    erreur: tousRates ? etapes[0]?.erreur : undefined,
    modifieLe: iso,
    ...(fini ? {} : { finEstimee: new Date(maintenant + Math.max(5, resteSec) * 1000).toISOString() }),
    termineLe: fini && !tousRates ? iso : undefined,
    parametres: { ...travail.parametres, chaine: etat, estimation },
  };
  if (!fini || tousRates) return { travail: suivant };
  const simple = commande.plafondClaudeAtteint === true;
  const sorties = d.ratios.map((r) => sortieDuFormat(r, d, simple)).filter((s): s is SortieProduite => !!s);
  const alertes = sorties.flatMap((s) => s.rapportQualite.alertes);
  const note = sorties.length ? Math.min(...sorties.map((s) => s.rapportQualite.note)) : 0;
  return {
    travail: suivant,
    resultat: {
      sorties,
      noteQualite: { globale: note, alertes },
      lignesReelles: [{ etape: "Nouveau format", fournisseur: "studio", unite: "forfait", quantite: 1, prixUnitaire: ZERO, total: ZERO, nature: "reel" }],
      projetMontage: { moteur: "montage-facecam", formats: { ratios: d.ratios, faits, montages: Object.fromEntries(sorties.map((s) => [s.ratio, s.fichierCle])) } },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Habillage par format (composition finale)                           */
/* ------------------------------------------------------------------ */

export interface HabillageFormat extends HabillageFacecam {
  ratio: RatioFacecam;
  /** Contrôle machine du format (visage, sous-titres, cartes) ; absent en 9:16 (rien n'y change). */
  controle?: ControleFormat;
}

/**
 * L'habillage d'un format : MÊME entrée que `habillageFacecam` (la piste montée DU format en `pisteMonteeCle`), plus
 * les plans du format (`plansFormat`) pour placer la personne et les sous-titres d'après le visage. En 9:16 :
 * exactement `habillageFacecam(entree)`.
 *  - mêmes cartes, mêmes instants (celles du monteur, sinon les mêmes écrans partagés choisis d'après le texte) ;
 *  - cartes mises en page pour le format (4:5 et 1:1 : moitié haute à 45 % ; 16:9 : carte 4:5 dans la colonne de
 *    gauche, plein écran compris) ;
 *  - personne placée d'après ses yeux sur le passage (haut / bas : yeux à 37,5 % de sa partie ; côte à côte : visage
 *    à 40 % de sa colonne depuis le bord extérieur) ;
 *  - sous-titres : mêmes groupes, ligne sous la bouche du format, à la jonction (haut / bas) ou dans la colonne de
 *    Will (côte à côte).
 */
export function habillageFacecamRatio(e: EntreeHabillageFacecam & { plansFormat?: PlanFormat[] }, ratio: RatioFacecam): HabillageFormat {
  if (ratio === "9:16") {
    const { plansFormat: _p, ...entree } = e;
    void _p;
    return { ...habillageFacecam(entree), ratio };
  }
  const { largeur: W, hauteur: H } = DIMENSIONS_FACECAM[ratio];
  const disposition = dispositionEcranPartage(ratio);
  const plans = e.plansFormat?.filter((p) => p.ratio === ratio) ?? [];
  const { posees: brutes, auto: cartesAuto, vues: cartesAutoVues } = cartesPosees(e);
  const posees: CartePosee[] = brutes.map((c) => (ratio === "16:9" ? c : { ...c, disposition: dispositionQuiTient(c.carte, c.disposition, ratio) }));
  // Sous-titres : ligne sous la bouche la plus basse du format.
  const bouche = plans.length ? bouchePctDesPlans(plans) : undefined;
  const position = positionSousTitresFormat(ratio, bouche ?? (e.visage ? e.visage.bouchePct : undefined));
  // Yeux sur un passage (px de l'image du format) : médiane des plans qui le recouvrent, sinon le visage médian ;
  // et la tête la plus grande du passage (cheveux compris), pour ne jamais la poser sous la ligne de la jonction.
  const yeuxSur = (debut: number, fin: number): { yeux: { yeuxX: number; yeuxY: number }; tete?: { haut: number; bas: number } } => {
    const sur = plans.filter((p) => Math.min(p.finSec, fin) - Math.max(p.debutSec, debut) > 1e-3).map(visagePx);
    if (sur.length) {
      const med = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
      return { yeux: { yeuxX: med(sur.map((v) => v.yeuxX)), yeuxY: med(sur.map((v) => v.yeuxY)) }, tete: { haut: Math.min(...sur.map((v) => v.y - 0.12 * v.hauteur)), bas: Math.max(...sur.map((v) => v.y + v.hauteur)) } };
    }
    return { yeux: { yeuxX: W / 2, yeuxY: ((e.visage?.yeuxPct ?? CADRAGE_FORMATS.yeux.vise * 100) / 100) * H } };
  };
  const cartes: RenduCarte[] = [];
  const ecransPartages: NonNullable<EntreeComposition["ecransPartages"]> = [];
  const cartesPleinEcran: NonNullable<EntreeComposition["cartesPleinEcran"]> = [];
  const passagesControle: { debutSec: number; finSec: number; placement: PlacementPersonne }[] = [];
  for (const c of posees) {
    const rendu = renduCarteFormat(ratio, c.disposition);
    // Même style de carte que le 9:16 (lot C2 : Sobre ou Spectaculaire).
    const mp = { ...miseEnPage(rendu.ratioMotion, rendu.dispositionMotion, c.finSec - c.debutSec), ...(c.style ? { style: c.style } : {}) };
    const carte = c.carte ? calerCarteTous(c.carte, e.mots, c.debutSec, mp.images / mp.fps) : undefined;
    const r = preparerCarteTous({ carte, code: e.versionSimple ? undefined : c.code, repli: c.repli ? calerCarteTous(c.repli, e.mots, c.debutSec, mp.images / mp.fps) : undefined }, mp);
    if (!r.parametres) continue;
    // Clé d'après le rendu : une carte identique (4:5 plein écran en 4:5 et en 16:9) n'est rendue qu'une fois.
    const suffixe = `${nomRatio(rendu.ratioMotion)}${rendu.dispositionMotion === "moitie-haute" ? "-haut" : ""}`;
    const cle = `${e.prefixeCartes}/${c.id}-${suffixe}.mp4`;
    const fin = Math.min(e.dureeSec, +(c.debutSec + mp.images / mp.fps).toFixed(3));
    cartes.push({ id: `${c.id}-${suffixe}`, cle, parametres: r.parametres, repli: r.repli, erreurs: r.erreurs });
    if (rendu.posee === "plein-ecran") {
      cartesPleinEcran.push({ debutSec: c.debutSec, finSec: fin, carteCle: cle });
      continue;
    }
    const sur = yeuxSur(c.debutSec, fin);
    const placement = placementPersonne(ratio, sur.yeux, sur.tete, 0.6 * hauteurLettrePx(ratio));
    passagesControle.push({ debutSec: c.debutSec, finSec: fin, placement });
    const ligne = ligneEcranPartage(ratio, position);
    if (disposition.type === "gauche" && "sourceX" in placement) ecransPartages.push({ debutSec: c.debutSec, finSec: fin, carteCle: cle, sourceY: 0, cote: "gauche", largeurCarte: disposition.largeurCarte, sourceX: placement.sourceX, ligne });
    else if ("sourceY" in placement) ecransPartages.push({ debutSec: c.debutSec, finSec: fin, carteCle: cle, sourceY: placement.sourceY, ligne });
  }
  const groupes = grouperMots(recollerElisionsHorodatees(e.mots), GROUPEMENT_FACECAM);
  const segments = e.coupesSec?.length ? recalerSurCoupes(groupes, e.coupesSec, { fenetreSec: SOUS_TITRES_FACECAM.fenetreCoupeSec }) : groupes;
  const echelle = echelleTexteFormat(ratio);
  // Finitions du 10/10 : un titre affiché n'est pas répété en sous-titre (comme en 9:16).
  const textesAffiches = textesAffichesDesCartes(posees.map((c) => ({ ...c, disposition: renduCarteFormat(ratio, c.disposition).posee === "plein-ecran" ? ("plein-ecran" as const) : ("moitie-haute" as const) })));
  const entree: EntreeComposition = {
    ratio,
    plans: planUnique(e.dureeSec),
    segments,
    dureeSec: e.dureeSec,
    mots: e.mots,
    audioCle: e.pisteMonteeCle,
    pistesDouble: { face: e.pisteMonteeCle },
    pistesDepuisLook: true,
    sourcePreCadree: true,
    source10bits: true,
    positionSousTitresPct: position,
    ...(ecransPartages.length ? { ecransPartages } : {}),
    ...(cartesPleinEcran.length ? { cartesPleinEcran } : {}),
    ...(e.lookLutCle ? { lookBroll: { lutCle: e.lookLutCle } } : {}),
    ...(echelle !== undefined ? { echelleSousTitres: echelle } : {}),
    ...(textesAffiches.length ? { textesAffiches } : {}),
  };
  const controle = plans.length
    ? controlerFormat({
        ratio,
        plans,
        sousTitres: { centrePct: position, jonctions: ecransPartages.map((x) => ({ debutSec: x.debutSec, finSec: x.finSec, centrePct: x.ligne!.centrePct, ...(x.ligne?.colonne ? { colonne: x.ligne.colonne } : {}) })) },
        ecransPartages: passagesControle,
        cartesPleinEcran,
      })
    : undefined;
  return { cartes, entree, segments, cartesAuto, cartesAutoVues, ratio, ...(controle ? { controle } : {}) };
}

/* ------------------------------------------------------------------ */
/* Composition finale de chaque format (cartes puis composition)        */
/* ------------------------------------------------------------------ */

/** Habillage d'un format dans la chaîne : sa base de composition, sa composition et sa sortie. */
export interface HabillageDuFormat {
  /** Clés des cartes dont il a besoin (rendues une fois pour tous les formats : `EtatDeclinaisons.cartes`). */
  cartes: string[];
  base: BaseComposition;
  composition?: EtatMontage;
  sortie?: NonNullable<EtatHabillage["sortie"]>;
  abandonne?: boolean;
  /** Alertes du contrôle machine du format (visage, sous-titres, cartes). */
  alertesControle: AlerteQualite[];
}

/**
 * Pendant l'habillage du 9:16 (mêmes mots montés, mêmes raccords, mêmes cartes du monteur) : l'habillage de chaque
 * format fait, ses cartes soumises (une carte identique d'un format à l'autre n'est rendue qu'une fois).
 */
export async function preparerHabillagesFormats(etat: EtatChaine, entree: Omit<EntreeHabillageFacecam, "pisteMonteeCle">, outils: OutilsMontage): Promise<void> {
  const d = etat.declinaisons;
  if (!d) return;
  d.habillages ??= {};
  d.cartes ??= {};
  d.entreeHabillage = entree;
  for (const r of d.ratios) {
    const montage = d.cadrages[r]?.statut === "termine" ? (d.cadrages[r]!.resultat as { fichierCle?: string } | undefined)?.fichierCle : undefined;
    if (!montage || d.habillages[r]) continue;
    const h = habillageFacecamRatio({ ...entree, pisteMonteeCle: montage, plansFormat: d.plans[r] }, r);
    try {
      for (const carte of h.cartes) {
        if (d.cartes[carte.cle]) continue;
        const signe = await outils.signer({}, [{ cle: carte.cle, mime: "video/mp4" }]);
        const demande = demandeRenduCarte(carte, signe.depots[carte.cle] ?? "");
        await outils.rendu().soumettre(demande);
        d.cartes[carte.cle] = { id: carte.id, demande, statut: "soumise", essais: 0 };
      }
    } catch (e) {
      // Un format qui ne peut pas être habillé n'empêche jamais l'habillage du 9:16 : il sort en piste pré-cadrée.
      if (!(e instanceof ErreurRendu)) throw e;
      // Vérif V2 : studio-rendu qui redémarre → ce format est repris au tour suivant (ses cartes soumises sont gardées).
      if (renduPassager(etat, e)) continue;
      d.habillages[r] = { cartes: [], base: { plans: [], segments: [], dureeSec: 0 }, abandonne: true, alertesControle: h.controle?.alertes ?? [] };
      (d.rates ??= []).push({ ratio: r, message: "L'habillage de ce format n'a pas abouti : il est livré sans sous-titres ni cartes." });
      continue;
    }
    const e = h.entree;
    d.habillages[r] = {
      cartes: h.cartes.map((x) => x.cle),
      base: {
        plans: e.plans,
        segments: e.segments,
        dureeSec: e.dureeSec,
        mots: e.mots,
        audioCle: e.audioCle,
        pistesDouble: e.pistesDouble,
        pistesDepuisLook: true,
        supplements: { sourcePreCadree: e.sourcePreCadree, source10bits: e.source10bits, positionSousTitresPct: e.positionSousTitresPct, ecransPartages: e.ecransPartages, cartesPleinEcran: e.cartesPleinEcran, lookBroll: e.lookBroll, ...(e.echelleSousTitres !== undefined ? { echelleSousTitres: e.echelleSousTitres } : {}), ...(e.textesAffiches?.length ? { textesAffiches: e.textesAffiches } : {}) },
      },
      alertesControle: h.controle?.alertes ?? [],
    };
  }
}

/**
 * Un tour des compositions des formats : cartes suivies (une nouvelle demande au plus ; une carte ratée est retirée
 * de tous les formats), puis la composition de chaque format dont les cartes sont prêtes. Un format dont la
 * composition échoue pour de bon est livré sans habillage (sa piste pré-cadrée), les autres continuent.
 */
export async function avancerHabillagesFormats(etat: EtatChaine, c: CommandeFabrication, ctx: ContexteChaine, outils: OutilsMontage): Promise<void> {
  const d = etat.declinaisons;
  if (!d?.habillages) return;
  // Un format coché après l'habillage du 9:16 est habillé à son tour, avec la même entrée.
  if (d.entreeHabillage) await preparerHabillagesFormats(etat, d.entreeHabillage, outils);
  for (const carte of Object.values(d.cartes ?? {})) {
    if (carte.statut !== "soumise") continue;
    let s: Awaited<ReturnType<typeof suivreRendu>>;
    try {
      s = await suivreRendu(outils.rendu(), carte.demande);
    } catch (e) {
      // Vérif V2 : studio-rendu injoignable → on attend le tour suivant (avant : l'erreur sortait de la chaîne).
      if (!(e instanceof ErreurRendu)) throw e;
      if (renduPassager(etat, e)) return;
      s = { statut: "echec", erreur: { ...e.erreur, reessayable: false } };
    }
    if (s.statut === "termine") carte.statut = "faite";
    else if (s.statut === "echec") {
      if (s.erreur.reessayable && carte.essais < 1) {
        const signe = await outils.signer({}, [{ cle: carte.demande.sortie.cle, mime: "video/mp4" }]);
        carte.essais += 1;
        carte.demande = { ...carte.demande, idRendu: `${carte.demande.idRendu.replace(/-e\d+$/, "")}-e${carte.essais}`, sortie: { ...carte.demande.sortie, urlDepot: signe.depots[carte.demande.sortie.cle] ?? carte.demande.sortie.urlDepot } };
        await outils.rendu().soumettre(carte.demande);
      } else {
        carte.statut = "echec";
        const cle = carte.demande.sortie.cle;
        for (const h of Object.values(d.habillages)) {
          const sup = h!.base.supplements ?? {};
          h!.base.supplements = { ...sup, ecransPartages: sup.ecransPartages?.filter((x) => x.carteCle !== cle), cartesPleinEcran: sup.cartesPleinEcran?.filter((x) => x.carteCle !== cle) };
        }
      }
    }
  }
  for (const r of d.ratios) {
    const h = d.habillages[r];
    if (!h || h.sortie || h.abandonne) continue;
    if (h.cartes.some((k) => d.cartes?.[k]?.statut === "soumise")) continue;
    try {
      h.composition = await avancerCompositions(h.composition ?? {}, c, [r], h.base, "complet", `${ctx.travailId}-facecam`, outils);
    } catch (e) {
      if (!(e instanceof ErreurRendu)) throw e;
      if (renduPassager(etat, e)) continue;
      h.abandonne = true;
      (d.rates ??= []).push({ ratio: r, message: "L'habillage de ce format n'a pas abouti : il est livré sans sous-titres ni cartes." });
      continue;
    }
    const faite = h.composition[r];
    if (faite?.phase === "faite") h.sortie = { fichierCle: faite.sortieCle, ...(faite.masterCle ? { masterCle: faite.masterCle } : {}), vignetteCle: faite.vignetteCle, alertes: faite.alertes, ...(faite.mesures ? { mesures: faite.mesures } : {}) };
  }
}

/** Les compositions des formats sont-elles réglées (faites ou abandonnées) ? Vrai sans déclinaison ni habillage. */
export function habillagesFormatsRegles(etat: Pick<EtatChaine, "declinaisons">): boolean {
  const d = etat.declinaisons;
  if (!d) return true;
  return d.ratios.every((r) => {
    if (d.rates?.some((x) => x.ratio === r)) return true;
    const h = d.habillages?.[r];
    // Sans habillage préparé et sans piste, rien n'est attendu pour lui.
    if (!h) return !(d.cadrages[r]?.statut === "termine" && d.entreeHabillage);
    return !!h.sortie || !!h.abandonne;
  });
}
