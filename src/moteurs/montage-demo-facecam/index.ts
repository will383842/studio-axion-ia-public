/**
 * MOTEUR « DÉMO FACECAM » (lot J) — la vraie chaîne remplace la vitrine « pas encore branchée » du lot G : la facecam de
 * Williams et son écran réel (ou une seule vidéo déjà en écran partagé) → transcription de SA voix → calage des mots
 * (service d'alignement) et sous-titres → plan de scènes autour de l'écran (lot C, niveaux 1 et 2) → rendu Remotion
 * `DemoFacecam` en 4:5 (moitié / moitié, fond ivoire, carte de fin Axion) → autres formats. Chaîne : `chaine.ts`.
 *
 * Le moteur n'importe aucun service ni fournisseur réel : les outils sont INJECTÉS (tests) ou posés par les services
 * (`services/demo-facecam-branchements.ts`). Sans outils reliés, le travail reste en PAUSE claire (en file, sans échec,
 * sans coût). Format sans prix : tous les montants sont nuls. Aucun refus : remarques et réserves « À vérifier · … ».
 */
import type { AlerteQualite, CommandeFabrication, ErreurTravail, LigneCout, Ratio, Travail } from "@/domaine/types";
import { ZERO } from "@/lib/montants";
import { obtenirReseau } from "@/reseaux";
import { reseauxDeCommande } from "@/briques/declinaison";
import { ErreurRendu } from "@/fournisseurs/rendu/client";
import type { ContexteLancement, DefinitionEtapeMoteur, Estimation, MoteurVideo, ParentRetouche, ResultatFabrication } from "../types";
import { avancerEtapeDemo, ErreurDemo, ETAPES_DEMO, etatInitialDemo, ratiosDemo, type CleEtapeDemo, type EtatDemo, type OutilsDemoFacecam, type ParoleDemo } from "./chaine";
import type { PlanValide } from "@/briques/plan-scenes/schema";

export { ENTREE_DEMO_FACECAM, lireSourcesDemo, type SourcesDemo } from "./entrees";
export type { EtatDemo, OutilsDemoFacecam } from "./chaine";

export const ID_MOTEUR_DEMO_FACECAM = "montage-demo-facecam";
export const CODE_OUTILS_DEMO_NON_RELIES = "DF_OUTILS_NON_RELIES";
export const PHRASE_OUTILS_DEMO_NON_RELIES = "La démo facecam attend ses outils de fabrication (transcription, rendu) : vos vidéos sont gardées, rien n'a échoué.";
const RESEAUX_CONSEILLES = ["linkedin", "instagram", "youtube-shorts"] as const;

/* ------------------------------------------------------------------ */
/* Raccords des services                                                */
/* ------------------------------------------------------------------ */

export type FabriqueOutilsDemo = (commande: CommandeFabrication, travailId: string) => Promise<OutilsDemoFacecam | null>;

export interface ServicesDemoFacecam {
  outils?: FabriqueOutilsDemo;
}

const cleServices = Symbol.for("studio-axion-ia.demo-facecam-services");
type AvecServices = typeof globalThis & { [cleServices]?: ServicesDemoFacecam };

export function brancherServicesDemoFacecam(s: ServicesDemoFacecam): void {
  (globalThis as AvecServices)[cleServices] = { ...((globalThis as AvecServices)[cleServices] ?? {}), ...s };
}

export function servicesDemoFacecam(): ServicesDemoFacecam {
  return (globalThis as AvecServices)[cleServices] ?? {};
}

/* ------------------------------------------------------------------ */
/* Étapes                                                               */
/* ------------------------------------------------------------------ */

const DEFINITIONS: Record<CleEtapeDemo, Omit<DefinitionEtapeMoteur, "dependDe">> = {
  reception: { cle: "reception", nom: "Vos vidéos reçues", icone: "camera", dureeEstimeeSec: 2 },
  transcription: { cle: "transcription", nom: "Ce que vous dites", icone: "micro", dureeEstimeeSec: 60 },
  calage: { cle: "calage", nom: "Les sous-titres", icone: "sous-titres", dureeEstimeeSec: 20 },
  plan: { cle: "plan", nom: "Le motion autour de l'écran", icone: "baguette", dureeEstimeeSec: 40 },
  montage: { cle: "montage", nom: "L'écran partagé 4:5", icone: "ecran-partage", dureeEstimeeSec: 180 },
  exports: { cle: "exports", nom: "Les autres formats", icone: "film", dureeEstimeeSec: 180 },
};

function etapesDe(commande: CommandeFabrication, ratios: Ratio[] = ratiosDemo(commande.ratios), seulementRendu = false): DefinitionEtapeMoteur[] {
  const cles = ETAPES_DEMO.filter((c) => (seulementRendu ? c === "montage" : c === "exports" ? ratios.length > 1 : true));
  return cles.map((c, i) => ({ ...DEFINITIONS[c], ...(c === "montage" ? { nom: `L'écran partagé ${ratios[0]}` } : {}), dependDe: i ? [cles[i - 1]] : [] }));
}

/* ------------------------------------------------------------------ */
/* Estimation (format sans prix : quantités visibles, montants nuls)   */
/* ------------------------------------------------------------------ */

function ligne(etape: string, fournisseur: string, unite: LigneCout["unite"], quantite: number, nature: LigneCout["nature"]): LigneCout {
  return { etape, fournisseur, unite, quantite, prixUnitaire: ZERO, total: ZERO, nature };
}

function estimation(lignes: LigneCout[], dureeFabricationSec: number): Estimation {
  return { dureeFabricationSec, lignes, total: ZERO };
}

function lignesEstimees(): LigneCout[] {
  return [ligne("Transcription", "studio-aligneur", "appel", 1, "estime"), ligne("Plan de scènes", "claude", "appel", 1, "estime"), ligne("Montage démo facecam", "studio", "forfait", 1, "estime")];
}

/* ------------------------------------------------------------------ */
/* Travaux                                                              */
/* ------------------------------------------------------------------ */

function lireEtat(travail: Travail): EtatDemo {
  const e = travail.parametres?.demoFacecam as EtatDemo | undefined;
  return e && typeof e === "object" && Array.isArray(e.rendus) ? e : { ratios: ["4:5"], rendus: [], reserves: [], remarques: [] };
}

function avecEtat(travail: Travail, etat: EtatDemo): Travail {
  return { ...travail, parametres: { ...travail.parametres, demoFacecam: etat } };
}

function sansPause(travail: Travail): Travail {
  if (!travail.parametres?.pause) return travail;
  const { pause: _p, ...parametres } = travail.parametres;
  void _p;
  return { ...travail, parametres };
}

function nouveauTravail(defs: DefinitionEtapeMoteur[], ctx: ContexteLancement, commande: CommandeFabrication, etat: EtatDemo): Travail {
  const maintenant = ctx.maintenant ?? Date.now();
  const iso = new Date(maintenant).toISOString();
  const type = ctx.type ?? "fabrication";
  return {
    id: ctx.travailId,
    type,
    cibleId: commande.videoId,
    versionId: ctx.versionId,
    titre: ctx.titre,
    etapes: defs.map((d) => ({ cle: d.cle, nom: d.nom, icone: d.icone, dependDe: d.dependDe, statut: "en_attente" as const, progression: 0, sortieFichierIds: [] })),
    statut: "en_file",
    progression: 0,
    tentatives: 1,
    cleIdempotence: `${commande.videoId}:${ctx.versionId}:${type}`,
    fournisseurUtilise: ID_MOTEUR_DEMO_FACECAM,
    creeLe: iso,
    modifieLe: iso,
    debuteLe: iso,
    finEstimee: new Date(maintenant + defs.reduce((s, d) => s + d.dureeEstimeeSec, 0) * 1000).toISOString(),
    parametres: { demoFacecam: etat },
  };
}

/** Ce que la version d'avant offre (projet de montage) : sa prise, sa parole calée et son plan. */
export interface ProjetDemoFacecam {
  facecamCle?: string;
  parole?: ParoleDemo;
  plan?: PlanValide;
  scenesTouchees?: string[];
}

export function lireProjetDemo(projetMontage: Record<string, unknown> | undefined): ProjetDemoFacecam | null {
  const p = projetMontage?.demoFacecam as ProjetDemoFacecam | undefined;
  return p && typeof p === "object" ? p : null;
}

function erreurLisible(err: unknown): ErreurTravail {
  if (err instanceof ErreurDemo) return { code: err.code, reessayable: err.reessayable, messagePourWill: err.messagePourWill };
  if (err instanceof ErreurRendu) return { code: "DF_RENDU", reessayable: true, messagePourWill: `Le rendu de la vidéo n'a pas abouti (${err.message}) : « Réessayer » ne refait que le rendu.` };
  const message = err instanceof Error ? err.message : "erreur inattendue";
  return { code: "DF_ETAPE", reessayable: true, messagePourWill: `Une étape s'est arrêtée (${message}) : « Réessayer » ne refait que cette étape et la suite.` };
}

function alertesDe(etat: EtatDemo): AlerteQualite[] {
  const reserves = etat.reserves.map((message) => ({ code: (message.includes("Sous-titres") ? "synchronisation" : "defaut-visuel") as AlerteQualite["code"], gravite: "attention" as const, message }));
  const remarques = etat.remarques.map((message) => ({ code: "defaut-visuel" as const, gravite: "info" as const, message: `Remarque · ${message}` }));
  const plan = (etat.plan?.remarques ?? []).filter((r) => r.code !== "LLM_INDISPONIBLE" && r.code !== "LLM_ILLISIBLE").map((r) => ({ code: "defaut-visuel" as const, gravite: "info" as const, message: `Plan · ${r.message}` }));
  return [...reserves, ...remarques, ...plan];
}

function resultatDe(etat: EtatDemo, commande: CommandeFabrication): ResultatFabrication {
  const alertes = alertesDe(etat);
  const attention = alertes.filter((a) => a.gravite === "attention").length;
  const reseaux = reseauxDeCommande(commande, [...RESEAUX_CONSEILLES]);
  const avecSousTitres = commande.briques["sous-titres"] !== false && !!etat.sousTitres?.length;
  const sorties = etat.ratios.map((ratio) => {
    const r = etat.rendus.find((x) => x.ratio === ratio)!;
    const { largeur, hauteur } = (r.demande.parametres.proprietes as { format: { largeur: number; hauteur: number } }).format;
    const servis = reseaux.filter((id) => {
      try {
        return obtenirReseau(id).ratioPrefere === ratio;
      } catch {
        return false;
      }
    });
    return {
      ratio,
      fichierCle: r.sortie!.fichierCle,
      vignetteCle: r.sortie!.fichierCle.replace(/\.mp4$/, ".jpg"),
      resolution: `${largeur}x${hauteur}`,
      dureeSec: r.sortie!.dureeSec,
      taille: r.sortie!.taille,
      rapportQualite: { note: Math.max(50, 100 - 10 * attention), verifie: { image: true, son: true, sousTitres: avecSousTitres, mentionIA: false, droits: true }, alertes, niveauSonoreLufs: -14 },
      ...(servis.length ? { reseaux: servis } : {}),
    };
  });
  const lignesReelles: LigneCout[] = [];
  if (etat.parole && etat.parole.source !== "estimation") lignesReelles.push(ligne("Transcription", "studio-aligneur", "appel", 1, "reel"));
  if (etat.plan && etat.plan.source !== "repris") lignesReelles.push(ligne("Plan de scènes", "claude", "appel", 1, "reel"));
  lignesReelles.push(ligne("Montage démo facecam", "studio", "forfait", 1, "reel"));
  const projet: ProjetDemoFacecam = { facecamCle: etat.sources?.facecamCle, parole: etat.parole, plan: etat.plan?.plan, scenesTouchees: etat.plan?.scenesTouchees ?? [] };
  return {
    sorties,
    noteQualite: { globale: Math.max(50, 100 - 10 * attention), alertes },
    lignesReelles,
    ...(avecSousTitres ? { sousTitres: etat.sousTitres } : {}),
    projetMontage: { moteur: ID_MOTEUR_DEMO_FACECAM, demoFacecam: projet },
  };
}

/* ------------------------------------------------------------------ */
/* Moteur                                                               */
/* ------------------------------------------------------------------ */

export interface DependancesMoteurDemo {
  /** Outils injectés (tests) ; absents : ceux des services. */
  outils?: FabriqueOutilsDemo;
}

const RATIOS_DEMO: Ratio[] = ["4:5", "9:16", "1:1", "16:9"];

export function creerMoteurDemoFacecam(deps: DependancesMoteurDemo = {}): MoteurVideo {
  const fabriqueOutils = (): FabriqueOutilsDemo | undefined => deps.outils ?? servicesDemoFacecam().outils;

  async function avancer(travail: Travail, commande: CommandeFabrication, maintenant = Date.now()): Promise<{ travail: Travail; resultat?: ResultatFabrication }> {
    if (["termine", "echec", "annule"].includes(travail.statut)) return { travail };
    const iso = new Date(maintenant).toISOString();
    const fabrique = fabriqueOutils();
    const outils = fabrique ? await fabrique(commande, travail.id) : null;
    if (!outils) return { travail: { ...travail, statut: "en_file", modifieLe: iso, parametres: { ...travail.parametres, pause: { code: CODE_OUTILS_DEMO_NON_RELIES, message: PHRASE_OUTILS_DEMO_NON_RELIES } } } };

    let etat = lireEtat(travail);
    const etape = travail.etapes.find((e) => e.statut !== "terminee" && e.statut !== "ignoree");
    if (!etape) return { travail };
    const cle = etape.cle as CleEtapeDemo;
    const base = sansPause(travail);

    if (commande.simulerEchecEtape === cle && !etat.echecSimuleFait) {
      etat = { ...etat, echecSimuleFait: true };
      const erreur: ErreurTravail = { code: "DF_ECHEC_SIMULE", reessayable: true, messagePourWill: `Échec simulé de l'étape « ${etape.nom} » : « Réessayer » la reprend.` };
      return { travail: avecEtat({ ...base, statut: "echec", erreur, modifieLe: iso, etapes: base.etapes.map((e) => (e.cle === cle ? { ...e, statut: "echec" as const, erreur } : e)) }, etat) };
    }

    let pas;
    try {
      pas = await avancerEtapeDemo(cle, etat, commande, outils, travail.id);
    } catch (err) {
      const erreur = erreurLisible(err);
      return { travail: { ...base, statut: "echec", erreur, modifieLe: iso, etapes: base.etapes.map((e) => (e.cle === cle ? { ...e, statut: "echec" as const, erreur } : e)) } };
    }
    if (pas.statut === "pause") return { travail: avecEtat({ ...base, statut: "en_file", modifieLe: iso, parametres: { ...base.parametres, pause: { code: pas.code, message: pas.message } } }, pas.etat) };
    const faite = pas.statut === "faite";
    const etapes = base.etapes.map((e) => (e.cle === cle ? { ...e, statut: faite ? ("terminee" as const) : ("en_cours" as const), progression: faite ? 100 : 50, ...(faite ? { coutReel: ZERO } : {}) } : e));
    const finies = etapes.filter((e) => e.statut === "terminee" || e.statut === "ignoree").length;
    const tout = finies === etapes.length;
    const suivant = avecEtat({ ...base, etapes, statut: tout ? "termine" : "en_cours", progression: tout ? 100 : Math.round((finies / etapes.length) * 100), modifieLe: iso, ...(tout ? { termineLe: iso } : {}) }, pas.etat);
    return tout ? { travail: suivant, resultat: resultatDe(pas.etat, commande) } : { travail: suivant };
  }

  /** Travail repris d'une version d'avant : sa parole calée (même prise) et son plan, jamais refaits sans raison. */
  function etatDepuisParent(commande: CommandeFabrication, parent: ParentRetouche | undefined): EtatDemo {
    const p = lireProjetDemo(parent?.projetMontage);
    const e = etatInitialDemo(commande);
    return { ...e, ...(p ? { parent: { ...(p.facecamCle ? { facecamCle: p.facecamCle } : {}), ...(p.parole ? { parole: p.parole } : {}), ...(p.plan ? { plan: p.plan } : {}) } } : {}) };
  }

  return {
    id: ID_MOTEUR_DEMO_FACECAM,
    nom: "Montage démo facecam",
    // La durée est celle de Williams : aucune borne bloquante (`refusAuLancement` ne refuse jamais).
    capacites: { dureeMaxSec: 3600, ratios: RATIOS_DEMO, langues: ["fr"], retoucheParPlan: true, asynchrone: true, accordExige: false, maquette: false },
    estimer: async (c) => estimation(lignesEstimees(), etapesDe(c).reduce((s, d) => s + d.dureeEstimeeSec, 0)),
    estimerRetouche: async () => estimation([ligne("Retouche démo facecam", "studio", "forfait", 1, "estime")], 180),
    estimerReexport: async (_c, ratio) => estimation([ligne(`Format ${ratio}`, "studio", "forfait", 1, "estime")], 180),
    etapes: (c) => etapesDe(c),
    lancer: async (commande, contexte) => nouveauTravail(etapesDe(commande), contexte, commande, etatInitialDemo(commande)),
    refusAuLancement: () => null,
    avancer,
    reessayer: async (travail, maintenant = Date.now()) => {
      const iso = new Date(maintenant).toISOString();
      const enEchec = new Set(travail.etapes.filter((e) => e.statut === "echec").map((e) => e.cle));
      let ajoute = true;
      while (ajoute) {
        ajoute = false;
        for (const e of travail.etapes) if (!enEchec.has(e.cle) && e.statut !== "terminee" && e.dependDe.some((d) => enEchec.has(d))) ajoute = !!enEchec.add(e.cle);
      }
      const { erreur: _e, ...reste } = travail;
      void _e;
      return { ...reste, statut: "en_cours", tentatives: travail.tentatives + 1, modifieLe: iso, etapes: travail.etapes.map((e) => (enEchec.has(e.cle) ? { ...e, statut: "en_attente" as const, progression: 0, erreur: undefined } : e)) };
    },
    retoucher: async ({ commande, contexte, parent }) => nouveauTravail(etapesDe(commande), { ...contexte, type: "retouche" }, commande, etatDepuisParent(commande, parent)),
    reexporter: async ({ commande, contexte, cible, parent }) => {
      const ratio = "ratio" in cible ? cible.ratio : obtenirReseau(cible.reseau).ratioPrefere;
      const ctx = { ...contexte, type: "reexport" as const };
      const etat = { ...etatDepuisParent(commande, parent), ratios: [ratio] };
      return nouveauTravail(etapesDe(commande, [ratio]), ctx, commande, etat);
    },
    // Pas de maquette : la durée attendue est celle de la prise.
    maquette: async (commande) => ({ dureeSec: commande.dureeCibleSec }),
    annuler: async (travail, maintenant = Date.now()) => {
      if (travail.statut === "annule") return travail;
      const iso = new Date(maintenant).toISOString();
      return { ...travail, statut: "annule", modifieLe: iso, etapes: travail.etapes.map((e) => (e.statut === "en_cours" ? { ...e, statut: "ignoree" as const } : e)) };
    },
  };
}

export const moteurMontageDemoFacecam = creerMoteurDemoFacecam();
