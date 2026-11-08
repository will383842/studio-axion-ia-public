/**
 * CHAÎNE DE LA DÉMO FACECAM (lot J) — réception → transcription → calage → plan de scènes → montage 4:5 → autres formats.
 * Pilotée PAS À PAS (comme le tutoriel d'outil, lot I) : `avancerEtape` fait UN pas et rend le nouvel état, gardé dans le
 * travail. Rien n'est attendu longtemps : un travail soumis (transcription, calage, rendu) est suivi au tour suivant.
 *
 * C'est la VOIX RÉELLE de Williams (le son de sa facecam), jamais une voix de synthèse. Pièces réutilisées, sans rien
 * changer :
 *  - transcription au mot : route `transcrire` du `studio-aligneur` (client de la face caméra, `FournisseurFacecam`) ;
 *  - calage des mots : le service d'alignement existant (`demandeAlignement`, `appliquerAlignement`, garde-fous compris) ;
 *  - sous-titres : `fabriquerSousTitres` et `donneesCalque` (calés sur sa parole) ;
 *  - plan : `genererPlan` (lot C, niveaux 1 et 2 ; niveau 3 replié par le validateur), puis `planAutourDeLEcran` ;
 *  - rendu : la composition Remotion `DemoFacecam` (écran partagé + plan + sous-titres + carte de fin Axion).
 * La durée est celle de Williams : jamais coupée, jamais refusée. Une brique ratée n'empêche jamais la livraison : les
 * qualités à revoir deviennent des réserves « À vérifier · … ». Retouche : seules les scènes à l'empreinte changée sont
 * « touchées » ; la transcription et le calage d'une même prise sont repris sans être refaits.
 */
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import { genererPlan } from "@/briques/plan-scenes/generateur";
import { fnv1a64, jsonCanonique, scenesARerendre } from "@/briques/plan-scenes/empreinte";
import type { MotMinute, PlanValide, SceneValide } from "@/briques/plan-scenes/schema";
import { planDeRepli, validerPlan, type Remarque } from "@/briques/plan-scenes/validateur";
import { appliquerAlignement, demandeAlignement, ESSAIS_ALIGNEMENT } from "@/briques/calage/alignement";
import { baseRetenue, donneesCalque, fabriquerSousTitres } from "@/briques/sous-titres";
import { horodaterTexte } from "@/domaine/derivations";
import type { BaseSousTitres, CommandeFabrication, IntensiteSousTitres, MotHorodate, Ratio, SegmentSousTitres, ValeurStyleSousTitres } from "@/domaine/types";
import type { FournisseurFacecam } from "@/fournisseurs/facecam/client";
import { ErreurRendu, suivreRendu } from "@/fournisseurs/rendu/client";
import type { DemandeRendu, FournisseurAlignement, ServiceRendu } from "@/fournisseurs/types";
import { planAutourDeLEcran } from "./ecran";
import { lireSourcesDemo, type SourcesDemo } from "./entrees";
import { CARTE_FIN_DEMO, COMPOSITION_DEMO_FACECAM, DUREE_CARTE_FIN_DEMO_MS, formatDemo, formatPlanDemo, moitiesDemo, type ProprietesDemoFacecam, type RatioDemo, type ZoomEcran } from "./proprietes";

export const ETAPES_DEMO = ["reception", "transcription", "calage", "plan", "montage", "exports"] as const;
export type CleEtapeDemo = (typeof ETAPES_DEMO)[number];

/** Essais du studio-aligneur (transcription) et du rendu avant le repli ou l'échec réessayable. */
export const ESSAIS_TRANSCRIPTION = 3;
export const ESSAIS_RENDU_DEMO = 3;
/** Mots par seconde de la recette (estimation de repli seulement). */
export const MOTS_PAR_SECONDE_DEMO = 2.8;
/** Zone conseillée (s) : hors d'elle, une remarque, jamais un refus. */
export const ZONE_CONSEILLEE_SEC: [number, number] = [30, 150];

/* ------------------------------------------------------------------ */
/* Outils injectés (services réels, ou doubles des tests)               */
/* ------------------------------------------------------------------ */

export interface OutilsDemoFacecam {
  /** Transcription au mot de la prise (route `transcrire` du studio-aligneur). */
  transcription: FournisseurFacecam;
  /** Calage des mots sur le son (service d'alignement) ; absent : la transcription seule. */
  alignement?: FournisseurAlignement;
  /** Claude (plan de scènes) : un double dans les tests. */
  claude: AppelClaude;
  /** Adresse de lecture signée d'un fichier (prise, enregistrement d'écran). */
  lire: (cle: string) => Promise<string>;
  rendu: {
    service: () => ServiceRendu;
    signer: (lectures: Record<string, string>, depot: { cle: string; mime: string }) => Promise<{ lectures: Record<string, string>; urlDepot: string }>;
    cle: (nom: string) => string;
  };
  sousTitres?: { style?: ValeurStyleSousTitres | null; base?: BaseSousTitres; intensite?: IntensiteSousTitres };
  /** Mots maison (noms d'outils) donnés à la transcription. */
  glossaire?: string[];
}

/* ------------------------------------------------------------------ */
/* État gardé dans le travail                                           */
/* ------------------------------------------------------------------ */

export interface SuiviDemo {
  id: string;
  essais: number;
}

/** Ce que Williams a dit, au mot, sur le son de sa prise. */
export interface ParoleDemo {
  mots: MotHorodate[];
  dureeSec: number;
  /** `aligneur` : calé par le service d'alignement ; `transcription` : horodatage de la transcription ; `estimation` : repli. */
  source: "aligneur" | "transcription" | "estimation";
}

export interface PlanRetenuDemo {
  plan: PlanValide;
  zooms: ZoomEcran[];
  remarques: Remarque[];
  source: "llm" | "repli" | "repris";
  empreinteEntree: string;
  scenesTouchees: string[];
}

export interface RenduDemo {
  ratio: Ratio;
  demande: DemandeRendu;
  essai: number;
  sortie?: { fichierCle: string; dureeSec: number; taille: number };
}

export interface EtatDemo {
  sources?: SourcesDemo;
  transcription?: SuiviDemo;
  /** Transcription faite (avant calage). */
  transcrit?: ParoleDemo;
  calage?: SuiviDemo;
  parole?: ParoleDemo;
  sousTitres?: SegmentSousTitres[];
  motsPlan?: MotMinute[];
  plan?: PlanRetenuDemo;
  ratios: Ratio[];
  rendus: RenduDemo[];
  /** « À vérifier · … » (gravité attention). */
  reserves: string[];
  /** Remarques d'information (jamais un refus). */
  remarques: string[];
  /** Version d'avant : ce qui peut être repris sans être refait. */
  parent?: { facecamCle?: string; parole?: ParoleDemo; plan?: PlanValide };
  echecSimuleFait?: boolean;
}

export function ratiosDemo(ratios: readonly Ratio[]): Ratio[] {
  const demandes = ratios.length ? ratios : (["4:5"] as Ratio[]);
  return demandes.includes("4:5") ? ["4:5", ...demandes.filter((r) => r !== "4:5")] : ["4:5", ...demandes];
}

export function etatInitialDemo(commande: Pick<CommandeFabrication, "ratios">): EtatDemo {
  return { ratios: ratiosDemo(commande.ratios), rendus: [], reserves: [], remarques: [] };
}

export type PasDemo = { statut: "faite"; etat: EtatDemo } | { statut: "en-cours"; etat: EtatDemo } | { statut: "pause"; etat: EtatDemo; code: string; message: string };

export class ErreurDemo extends Error {
  constructor(
    readonly code: string,
    readonly messagePourWill: string,
    readonly reessayable: boolean,
  ) {
    super(messagePourWill);
    this.name = "ErreurDemo";
  }
}

const idTravail = (travailId: string, nom: string, essai: number) => `${travailId}-df-${nom}${essai ? `-e${essai}` : ""}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 200);

/* ------------------------------------------------------------------ */
/* Réception                                                            */
/* ------------------------------------------------------------------ */

function pasReception(etat: EtatDemo, commande: CommandeFabrication): PasDemo {
  if (etat.sources) return { statut: "faite", etat };
  const sources = lireSourcesDemo(commande);
  if (!sources) return { statut: "pause", etat, code: "DF_VIDEO_ABSENTE", message: "Déposez votre vidéo facecam (et, si vous voulez, votre enregistrement d'écran) : la démo se fabrique ensuite. Rien n'a échoué." };
  const remarques = [...etat.remarques];
  if (sources.synchro === "debut") remarques.push("Les deux vidéos sont calées par leur début : lancez-les ensemble au tournage.");
  if (sources.mode === "unique") remarques.push("Une seule vidéo : elle est gardée telle quelle en écran partagé.");
  return { statut: "faite", etat: { ...etat, sources, remarques } };
}

/* ------------------------------------------------------------------ */
/* Transcription (la parole réelle)                                     */
/* ------------------------------------------------------------------ */

function dureeDeRepli(commande: CommandeFabrication): number {
  const prise = (commande.prises ?? []).find((p) => p.partie === "version") ?? commande.prises?.[0];
  return prise?.dureeSec && prise.dureeSec > 0 ? prise.dureeSec : Math.max(1, commande.dureeCibleSec);
}

/** La transcription n'a rien donné : le script (s'il existe) estimé sur la durée, sinon sans sous-titres. */
function repliTranscription(etat: EtatDemo, commande: CommandeFabrication): PasDemo {
  const script = (commande.script.texteComplet ?? "").trim();
  const dureeSec = dureeDeRepli(commande);
  const mots = script ? horodaterTexte(script, MOTS_PAR_SECONDE_DEMO) : [];
  const reserve = script ? "À vérifier · Sous-titres : votre parole n'a pas pu être transcrite, ils suivent votre script au rythme moyen." : "À vérifier · Sous-titres : votre parole n'a pas pu être transcrite, la vidéo sort sans sous-titres.";
  return { statut: "faite", etat: { ...etat, transcription: undefined, transcrit: { mots: mots.filter((m) => m.debutSec < dureeSec), dureeSec, source: "estimation" }, reserves: [...etat.reserves, reserve] } };
}

async function soumettreTranscription(etat: EtatDemo, commande: CommandeFabrication, outils: OutilsDemoFacecam, travailId: string, essai: number): Promise<EtatDemo> {
  const id = idTravail(travailId, "transcrire", essai);
  const script = (commande.script.texteComplet ?? "").trim();
  await outils.transcription.soumettre("transcrire", {
    idTravail: id,
    source: await outils.lire(etat.sources!.facecamCle),
    parametres: { glossaire: outils.glossaire ?? [], ...(script ? { texteAttendu: script } : {}) },
  });
  return { ...etat, transcription: { id, essais: essai } };
}

async function pasTranscription(etat: EtatDemo, commande: CommandeFabrication, outils: OutilsDemoFacecam, travailId: string): Promise<PasDemo> {
  if (etat.transcrit) return { statut: "faite", etat };
  // Retouche ou nouveau format, même prise : la parole calée d'avant, sans rien refaire.
  const p = etat.parent;
  if (p?.parole && p.facecamCle === etat.sources!.facecamCle) return { statut: "faite", etat: { ...etat, transcrit: p.parole, parole: p.parole } };
  const t = etat.transcription;
  if (!t) return { statut: "en-cours", etat: await soumettreTranscription(etat, commande, outils, travailId, 0) };
  const e = await outils.transcription.suivre("transcrire", t.id);
  if (e.statut === "en_file" || e.statut === "en_cours") return { statut: "en-cours", etat };
  if (e.statut === "echec") {
    if (e.erreur.injoignable) return { statut: "en-cours", etat };
    if (e.erreur.travailInconnu) return { statut: "en-cours", etat: await soumettreTranscription(etat, commande, outils, travailId, t.essais) };
    if (e.erreur.reessayable && t.essais + 1 < ESSAIS_TRANSCRIPTION) return { statut: "en-cours", etat: await soumettreTranscription(etat, commande, outils, travailId, t.essais + 1) };
    return repliTranscription(etat, commande);
  }
  const mots = (e.resultat.mots ?? []).filter((m) => typeof m?.mot === "string" && Number.isFinite(m.debutSec) && Number.isFinite(m.finSec));
  const dureeSec = e.resultat.dureeSec > 0 ? e.resultat.dureeSec : dureeDeRepli(commande);
  const reserves = mots.length ? etat.reserves : [...etat.reserves, "À vérifier · Sous-titres : aucune parole reconnue dans la facecam."];
  return { statut: "faite", etat: { ...etat, transcription: undefined, transcrit: { mots, dureeSec, source: "transcription" }, reserves } };
}

/* ------------------------------------------------------------------ */
/* Calage (service d'alignement) et sous-titres                         */
/* ------------------------------------------------------------------ */

async function soumettreCalage(etat: EtatDemo, outils: OutilsDemoFacecam, travailId: string, essai: number): Promise<EtatDemo> {
  const t = etat.transcrit!;
  const d = demandeAlignement({ idBase: `${travailId}-df`, essai, audio: await outils.lire(etat.sources!.facecamCle), texte: t.mots.map((m) => m.mot).join(" "), reference: t.mots });
  await outils.alignement!.soumettre(d);
  return { ...etat, calage: { id: d.idAlignement, essais: essai } };
}

function avecSousTitres(etat: EtatDemo, parole: ParoleDemo, commande: CommandeFabrication, outils: OutilsDemoFacecam): EtatDemo {
  const st = outils.sousTitres;
  const texte = parole.mots.map((m) => m.mot).join(" ");
  const sousTitres = texte
    ? fabriquerSousTitres({
        texte,
        dureeSec: parole.dureeSec,
        mots: parole.mots,
        prononciations: commande.prononciations,
        ratio: etat.ratios[0],
        ...(st?.style !== undefined ? { style: st.style } : {}),
        ...(st?.base ? { base: st.base } : {}),
        ...(st?.intensite ? { intensite: st.intensite } : {}),
      })
    : [];
  const motsPlan: MotMinute[] = sousTitres.flatMap((s) => s.mots).map((m) => ({ texte: m.mot, debutMs: Math.round(m.debutSec * 1000), finMs: Math.max(Math.round(m.debutSec * 1000), Math.round(m.finSec * 1000)) }));
  const [min, max] = ZONE_CONSEILLEE_SEC;
  const sec = Math.round(parole.dureeSec);
  const remarques = [...etat.remarques];
  if (sec < min) remarques.push(`Démo courte (${sec} s) : elle est gardée telle quelle.`);
  if (sec > max) remarques.push(`Démo longue (${sec} s) : elle est gardée telle quelle ; au-delà de ${max} s l'attention baisse.`);
  return { ...etat, calage: undefined, parole, sousTitres, motsPlan, remarques };
}

async function pasCalage(etat: EtatDemo, commande: CommandeFabrication, outils: OutilsDemoFacecam, travailId: string): Promise<PasDemo> {
  if (etat.sousTitres && etat.motsPlan) return { statut: "faite", etat };
  const t = etat.transcrit!;
  if (etat.parole) return { statut: "faite", etat: avecSousTitres(etat, etat.parole, commande, outils) };
  if (!outils.alignement || !t.mots.length || t.source === "estimation") return { statut: "faite", etat: avecSousTitres(etat, t, commande, outils) };
  const c = etat.calage;
  if (!c) return { statut: "en-cours", etat: await soumettreCalage(etat, outils, travailId, 0) };
  const e = await outils.alignement.suivre(c.id);
  if (e.statut === "en_file" || e.statut === "en_cours") return { statut: "en-cours", etat };
  if (e.statut === "echec") {
    if (e.erreur.reessayable && c.essais + 1 < ESSAIS_ALIGNEMENT) return { statut: "en-cours", etat: await soumettreCalage(etat, outils, travailId, c.essais + 1) };
    // Le calage n'a pas abouti : l'horodatage de la transcription (déjà sur sa voix) est gardé.
    return { statut: "faite", etat: avecSousTitres({ ...etat, remarques: [...etat.remarques, "Calage fin des sous-titres indisponible : ils suivent la transcription de votre voix."] }, t, commande, outils) };
  }
  const { mots, rapport } = appliquerAlignement(t.mots, e.resultat, t.dureeSec);
  const parole: ParoleDemo = { mots, dureeSec: t.dureeSec, source: rapport.source === "aligneur" ? "aligneur" : "transcription" };
  return { statut: "faite", etat: avecSousTitres(etat, parole, commande, outils) };
}

/* ------------------------------------------------------------------ */
/* Plan de scènes autour de l'écran                                     */
/* ------------------------------------------------------------------ */

function motsDeScene(s: Pick<SceneValide, "mots">, mots: readonly MotMinute[]): string {
  return mots
    .slice(s.mots.premier, s.mots.dernier + 1)
    .map((m) => m.texte.toLowerCase())
    .join(" ");
}

/** Garde le contenu des scènes d'avant dont les mots n'ont pas changé (nouveau minutage), puis revalide. */
function fusionnerAvecParent(nouveau: PlanValide, parent: PlanValide): PlanValide {
  const avant = new Map(parent.scenes.map((s) => [motsDeScene(s, parent.mots), s]));
  const scenes = nouveau.scenes.map((s) => {
    const p = avant.get(motsDeScene(s, nouveau.mots));
    if (!p) return s;
    const { empreinte: _e, ...contenu } = p;
    void _e;
    return { ...contenu, id: s.id, version: p.version, mots: s.mots, debutMs: s.debutMs, finMs: s.finMs };
  });
  return validerPlan({ ...nouveau, scenes }, { mots: nouveau.mots, format: nouveau.format, facecam: nouveau.facecam, dureeMs: nouveau.dureeMs }).plan;
}

async function pasPlan(etat: EtatDemo, outils: OutilsDemoFacecam): Promise<PasDemo> {
  if (etat.plan) return { statut: "faite", etat };
  const mots = etat.motsPlan!;
  const texte = mots.map((m) => m.texte).join(" ");
  const mode = etat.sources!.mode;
  const format = formatPlanDemo(etat.ratios[0] as RatioDemo, mode);
  const dureeMs = Math.max(1, Math.round(etat.parole!.dureeSec * 1000));
  // Le format n'y entre pas : un nouveau format reprend le même plan (positions en %, revalidé au rendu).
  const empreinteEntree = fnv1a64(jsonCanonique({ texte, mots, mode }));
  const parent = etat.parent?.plan;
  // Le plan est TOUJOURS « face caméra » : fond transparent (la vidéo passe dessous), rien sur la zone du visage.
  const contexte = { mots, format, facecam: true, dureeMs };
  if (parent && fnv1a64(jsonCanonique({ texte, mots: parent.mots, mode })) === empreinteEntree) {
    const e = planAutourDeLEcran(parent, mode === "deux");
    return { statut: "faite", etat: { ...etat, plan: { plan: e.plan, zooms: e.zooms, remarques: [], source: "repris", empreinteEntree, scenesTouchees: [] } } };
  }
  const r = mots.length ? await genererPlan({ script: texte, mots, format, facecam: true }, outils.claude) : { plan: validerPlan(planDeRepli(contexte), contexte).plan, remarques: [] as Remarque[], source: "repli" as const };
  const fusionne = parent ? fusionnerAvecParent(r.plan, parent) : r.plan;
  const e = planAutourDeLEcran(fusionne, mode === "deux");
  const scenesTouchees = parent ? scenesARerendre(parent, e.plan) : e.plan.scenes.map((s) => s.id);
  const reserves = r.source === "repli" && mots.length ? [...etat.reserves, `À vérifier · Plan de scènes : ${r.remarques[0]?.message ?? "plan simple."}`] : etat.reserves;
  return { statut: "faite", etat: { ...etat, plan: { plan: e.plan, zooms: e.zooms, remarques: r.remarques, source: r.source, empreinteEntree, scenesTouchees }, reserves, remarques: [...etat.remarques, ...e.remarques] } };
}

/* ------------------------------------------------------------------ */
/* Rendu                                                                */
/* ------------------------------------------------------------------ */

/** Le plan au format d'un ratio (positions en %, revalidé : empreintes du format). */
export function planDemoPourRatio(plan: PlanValide, ratio: Ratio, mode: SourcesDemo["mode"]): PlanValide {
  const format = formatPlanDemo(ratio as RatioDemo, mode);
  if (format.largeur === plan.format.largeur && format.hauteur === plan.format.hauteur) return plan;
  return validerPlan({ ...plan, format }, { mots: plan.mots, format, facecam: true, dureeMs: plan.dureeMs }).plan;
}

type ProprietesSansSources = Omit<ProprietesDemoFacecam, "videoFacecam" | "videoEcran" | "videoUnique">;

export function proprietesDemo(etat: EtatDemo, ratio: Ratio, avecSousTitres: boolean, outils: Pick<OutilsDemoFacecam, "sousTitres">): ProprietesSansSources {
  const st = outils.sousTitres;
  const r = ratio as RatioDemo;
  const sources = etat.sources!;
  const { disposition, ecran, facecam } = moitiesDemo(r);
  const sousTitres =
    avecSousTitres && etat.sousTitres?.length ? donneesCalque({ segments: etat.sousTitres, base: baseRetenue(st?.base, st?.style ?? null), ratio, ...(st?.style ? { style: st.style } : {}) }) : undefined;
  return {
    mode: sources.mode,
    format: formatDemo(r),
    disposition,
    ecran,
    facecam,
    decalageEcranMs: sources.decalageEcranMs,
    dureeMs: Math.max(1, Math.round(etat.parole!.dureeSec * 1000)),
    plan: planDemoPourRatio(etat.plan!.plan, ratio, sources.mode),
    zooms: etat.plan!.zooms,
    ...(sousTitres ? { sousTitres } : {}),
    fin: { ...CARTE_FIN_DEMO },
    finMs: DUREE_CARTE_FIN_DEMO_MS,
  };
}

const nomRatio = (r: Ratio) => r.replace(":", "x");

async function demandeRendu(etat: EtatDemo, ratio: Ratio, essai: number, commande: CommandeFabrication, outils: OutilsDemoFacecam, travailId: string): Promise<DemandeRendu> {
  const cle = outils.rendu.cle(`demo-facecam-${nomRatio(ratio)}.mp4`);
  const s = etat.sources!;
  const lectures: Record<string, string> = s.mode === "deux" ? { videoFacecam: s.facecamCle, videoEcran: s.ecranCle! } : { videoUnique: s.facecamCle };
  const signe = await outils.rendu.signer(lectures, { cle, mime: "video/mp4" });
  return {
    idRendu: `${travailId}-df-${nomRatio(ratio)}-${essai}`,
    operation: "composition",
    file: "longue",
    entrees: signe.lectures,
    sortie: { urlDepot: signe.urlDepot, cle },
    parametres: { composition: COMPOSITION_DEMO_FACECAM, proprietes: proprietesDemo(etat, ratio, commande.briques["sous-titres"] !== false, outils) },
  };
}

async function pasRendu(etat: EtatDemo, ratio: Ratio, commande: CommandeFabrication, outils: OutilsDemoFacecam, travailId: string): Promise<EtatDemo> {
  const service = outils.rendu.service();
  const courant = etat.rendus.find((r) => r.ratio === ratio);
  const remplacer = (r: RenduDemo) => ({ ...etat, rendus: [...etat.rendus.filter((x) => x.ratio !== ratio), r] });
  if (!courant) {
    const demande = await demandeRendu(etat, ratio, 0, commande, outils, travailId);
    await service.soumettre(demande);
    return remplacer({ ratio, demande, essai: 0 });
  }
  if (courant.sortie) return etat;
  const e = await suivreRendu(service, courant.demande);
  if (e.statut === "echec") {
    const essai = courant.essai + 1;
    if (!e.erreur.reessayable || essai >= ESSAIS_RENDU_DEMO) throw new ErreurRendu(e.erreur);
    const demande = await demandeRendu(etat, ratio, essai, commande, outils, travailId);
    await service.soumettre(demande);
    return remplacer({ ratio, demande, essai });
  }
  if (e.statut !== "termine") return etat;
  const dureeAttendue = etat.parole!.dureeSec + DUREE_CARTE_FIN_DEMO_MS / 1000;
  const dureeSec = typeof e.mesures?.dureeSec === "number" ? e.mesures.dureeSec : dureeAttendue;
  return remplacer({ ...courant, sortie: { fichierCle: e.sortieCle, dureeSec, taille: typeof e.mesures?.taille === "number" ? e.mesures.taille : 0 } });
}

async function pasMontage(etat: EtatDemo, ratios: Ratio[], commande: CommandeFabrication, outils: OutilsDemoFacecam, travailId: string): Promise<PasDemo> {
  let e = etat;
  for (const ratio of ratios) {
    if (e.rendus.find((r) => r.ratio === ratio)?.sortie) continue;
    e = await pasRendu(e, ratio, commande, outils, travailId);
  }
  const fait = ratios.every((r) => e.rendus.find((x) => x.ratio === r)?.sortie);
  return { statut: fait ? "faite" : "en-cours", etat: e };
}

/** Un pas de l'étape `cle`. Lève `ErreurDemo` ou une erreur du rendu : le moteur la rend lisible. */
export async function avancerEtapeDemo(cle: CleEtapeDemo, etat: EtatDemo, commande: CommandeFabrication, outils: OutilsDemoFacecam, travailId: string): Promise<PasDemo> {
  switch (cle) {
    case "reception":
      return pasReception(etat, commande);
    case "transcription":
      return pasTranscription(etat, commande, outils, travailId);
    case "calage":
      return pasCalage(etat, commande, outils, travailId);
    case "plan":
      return pasPlan(etat, outils);
    case "montage":
      return pasMontage(etat, etat.ratios.slice(0, 1), commande, outils, travailId);
    case "exports":
      return pasMontage(etat, etat.ratios.slice(1), commande, outils, travailId);
  }
}
