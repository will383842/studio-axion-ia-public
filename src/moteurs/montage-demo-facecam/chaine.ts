/**
 * CHAÎNE RÉELLE DE LA DÉMO FACECAM (lot J). Un tour = interroger ce qui a été soumis, calculer ce qui peut l'être,
 * soumettre la suite. L'état est sérialisable (gardé dans `travail.parametres.demo`) ; l'ancien n'est jamais modifié.
 *
 * Réutilise la chaîne face caméra existante, brique par brique :
 *  1. transcription au mot de la VRAIE voix de Williams : `studio-aligneur` `/transcrire` (même fournisseur que
 *     `montage-facecam`), sur la facecam ; et sur l'enregistrement d'écran quand il est à part (synchronisation) ;
 *  2. calage des mots sur sa voix : service d'alignement existant (`studio-aligneur` `/alignements`) ; aucune voix de
 *     synthèse ; sous-titres groupés par `briques/sous-titres/groupement` ;
 *  3. synchronisation des deux fichiers par l'audio (mots communs), par le début, ou par le décalage donné ;
 *  4. plan de scènes du lot C (`genererPlan`, LLM injecté ; niveau 3 replié par le validateur), puis pistes écran ;
 *  5. rendu `studio-rendu` (opération `composition`, composition `DemoFacecam`) : 4:5 d'abord, puis les autres
 *     formats demandés (exports réseaux).
 * Règle d'or : rien n'est refusé. Une brique ratée devient une réserve « À vérifier · … » et la vidéo sort quand même ;
 * seul l'échec définitif du rendu 4:5 (aucune vidéo possible) met le travail en échec réessayable.
 */
import type { FournisseurAlignement, ServiceRendu } from "@/fournisseurs/types";
import type { FournisseurFacecam } from "@/fournisseurs/facecam";
import type { CommandeFabrication, MotHorodate, Ratio } from "@/domaine/types";
import { baseRetenue, donneesCalque, fabriquerSousTitres } from "@/briques/sous-titres";
import type { DonneesCalque } from "@/briques/sous-titres/scene";
import { genererPlan, type AppelClaude } from "@/briques/plan-scenes/generateur";
import { planDeRepli, validerPlan } from "@/briques/plan-scenes/validateur";
import { scenesARerendre } from "@/briques/plan-scenes/empreinte";
import type { MotMinute, PlanValide } from "@/briques/plan-scenes/schema";
import { grouperMots } from "@/briques/sous-titres/groupement";
import { lireEntreesDemo, type EntreesDemo } from "./entrees";
import { decalageParLesMots, DUREE_CARTE_FIN_MS, FPS_DEMO, miseEnPageDemo, RATIO_MAITRE_DEMO, recadrage, type RatioDemo } from "./mise-en-page";
import { pistesEcran, planPourCalque } from "./pistes";
import { ID_COMPOSITION_DEMO_FACECAM, type GroupeSousTitre, type ProprietesDemoFacecam } from "./proprietes";

export const ESSAIS_MAX_DEMO = 3;

export interface DependancesDemo {
  facecam: FournisseurFacecam;
  /** Calage des mots (service d'alignement existant). Absent : les mots de la transcription sont gardés. */
  alignement?: FournisseurAlignement;
  rendu: ServiceRendu;
  /** Composition du plan par le LLM (lot C). Absent : plan simple de repli, avec une remarque. */
  appelerPlan?: AppelClaude;
  urlLecture: (cle: string) => Promise<string>;
  urlDepot: (cle: string, mime: string) => Promise<string>;
  maintenant?: () => number;
}

export interface TravailDistant {
  id: string;
  statut: "soumis" | "termine" | "echec";
  essais: number;
  resultat?: unknown;
  message?: string;
}

export interface Remarque {
  code: string;
  message: string;
}

export interface EtatDemo {
  version: 1;
  travaux: Record<string, TravailDistant>;
  /** Mots calés de la voix de Williams (temps de la facecam). */
  mots?: MotHorodate[];
  calage?: "aligneur" | "transcription" | "aucun";
  dureeSec?: number;
  synchro?: { mode: "audio" | "debut" | "fourni" | "aucune"; decalageSec: number };
  plan?: PlanValide;
  sourcePlan?: "llm" | "repli" | "reprise" | "retouche";
  /** Retouche : scènes dont l'empreinte a changé (seules parties refaites). */
  scenesTouchees?: string[];
  remarques: Remarque[];
  /** Réserves « À vérifier · … » (la vidéo sort quand même). */
  reserves: string[];
  sorties: Partial<Record<Ratio, { fichierCle: string }>>;
  fini?: boolean;
  echec?: { message: string; reessayable: boolean };
}

export function etatDemoInitial(): EtatDemo {
  return { version: 1, travaux: {}, remarques: [], reserves: [], sorties: {} };
}

/** Formats rendus : le 4:5 d'abord (maître), puis les autres demandés, sans doublon. */
export function ratiosDemo(commande: Pick<CommandeFabrication, "ratios">): RatioDemo[] {
  const connus: RatioDemo[] = ["4:5", "9:16", "1:1", "16:9"];
  return [RATIO_MAITRE_DEMO, ...(commande.ratios ?? []).filter((r): r is RatioDemo => connus.includes(r as RatioDemo) && r !== RATIO_MAITRE_DEMO)].filter((r, i, t) => t.indexOf(r) === i);
}

export function cleDemo(c: Pick<CommandeFabrication, "videoId">, versionId: string, nom: string): string {
  return `demo-facecam/${c.videoId}/${versionId}/${nom}`;
}

const idDistant = (travailId: string, nom: string, essai: number) => `${travailId}-${nom}${essai > 1 ? `-e${essai}` : ""}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 200);

/** Format de dessin du plan : la moitié écran du format maître. */
export function formatPlanDemo() {
  const m = miseEnPageDemo(RATIO_MAITRE_DEMO);
  return { largeur: m.ecran.largeur, hauteur: m.ecran.hauteur, fps: 25 as const };
}

const versMinute = (mots: MotHorodate[]): MotMinute[] => mots.map((m) => ({ texte: m.mot, debutMs: Math.round(m.debutSec * 1000), finMs: Math.round(Math.max(m.finSec, m.debutSec) * 1000) }));

export function groupesSousTitres(mots: MotHorodate[]): GroupeSousTitre[] {
  if (!mots.length) return [];
  return grouperMots(mots).map((g) => ({
    debutMs: Math.round(g.debutSec * 1000),
    finMs: Math.round(g.finSec * 1000),
    mots: g.mots.map((m) => ({ texte: m.mot, debutMs: Math.round(m.debutSec * 1000), finMs: Math.round(m.finSec * 1000) })),
  }));
}

export type StyleSousTitresDemo = Pick<CommandeFabrication, "prononciations"> & {
  style?: NonNullable<NonNullable<CommandeFabrication["styles"]["sousTitres"]>["valeur"]>;
  base?: NonNullable<CommandeFabrication["sousTitres"]>["base"];
  intensite?: NonNullable<CommandeFabrication["sousTitres"]>["intensite"];
};

/** Style de la commande (Bibliothèque) ; sans style ni réglage : `null`, l'ancienne pastille reste. */
export function styleSousTitresDemo(commande: CommandeFabrication): StyleSousTitresDemo | null {
  const style = commande.styles?.sousTitres?.valeur;
  if (!style && !commande.sousTitres) return null;
  return { prononciations: commande.prononciations ?? [], ...(style ? { style } : {}), ...(commande.sousTitres?.base ? { base: commande.sousTitres.base } : {}), ...(commande.sousTitres?.intensite ? { intensite: commande.sousTitres.intensite } : {}) };
}

/**
 * Calque de sous-titres du style choisi (brique centrale, comme le tutoriel). La position du style est ramenée dans la
 * zone prévue par la mise en page quand elle couvrirait la moitié facecam (le visage) : `deplace` le dit.
 */
export function calqueSousTitresDemo(mots: MotHorodate[], ratio: RatioDemo, st: StyleSousTitresDemo): { calque: DonneesCalque; deplace: boolean } | null {
  if (!mots.length) return null;
  const segments = fabriquerSousTitres({
    texte: mots.map((m) => m.mot).join(" "),
    dureeSec: Math.max(...mots.map((m) => m.finSec), 1),
    mots,
    prononciations: st.prononciations,
    ratio,
    ...(st.style !== undefined ? { style: st.style } : {}),
    ...(st.base ? { base: st.base } : {}),
    ...(st.intensite ? { intensite: st.intensite } : {}),
  });
  if (!segments.length) return null;
  const calque = donneesCalque({ segments, base: baseRetenue(st.base, st.style ?? null), ratio, ...(st.style ? { style: st.style } : {}) });
  const m = miseEnPageDemo(ratio);
  const zonePct = ((m.sousTitres.y + m.sousTitres.hauteur / 2) / calque.hauteur) * 100;
  let deplace = false;
  const ramener = (pct: number): number => {
    const y = (pct / 100) * calque.hauteur;
    // Côte à côte (16:9) : la position verticale ne dit rien du visage (moitié droite sur toute la hauteur) ; on ne touche à rien.
    if (m.disposition === "cote-a-cote" || y < m.facecam.y || y > m.facecam.y + m.facecam.hauteur) return pct;
    deplace = true;
    return zonePct;
  };
  const p = calque.positions;
  const positions = { milieuPct: ramener(p.milieuPct), hautPct: ramener(p.hautPct), basPct: ramener(p.basPct), ...(p.poitrinePct !== undefined ? { poitrinePct: ramener(p.poitrinePct) } : {}) };
  return { calque: deplace ? { ...calque, positions } : calque, deplace };
}

/** Propriétés de la composition pour un format (pures, sans adresse : elles arrivent par les entrées du rendu). */
export function proprietesDemo(etat: EtatDemo, entrees: EntreesDemo, ratio: RatioDemo, styleSousTitres?: StyleSousTitresDemo | null): ProprietesDemoFacecam {
  const miseEnPage = miseEnPageDemo(ratio);
  const dureeParoleMs = Math.max(1000, Math.round((etat.dureeSec ?? 0) * 1000));
  const facecam = entrees.facecam!;
  const ecranSrc = entrees.ecran ?? facecam;
  const plan = etat.plan!;
  const pistes = pistesEcran(plan, entrees.consignes);
  const calque = styleSousTitres ? calqueSousTitresDemo(etat.mots ?? [], ratio, styleSousTitres) : null;
  return {
    largeur: miseEnPage.largeur,
    hauteur: miseEnPage.hauteur,
    fps: FPS_DEMO,
    images: Math.ceil(((dureeParoleMs + DUREE_CARTE_FIN_MS) * FPS_DEMO) / 1000),
    dureeParoleMs,
    miseEnPage,
    recadrageFacecam: recadrage(facecam, entrees.partieFacecam, miseEnPage.facecam, entrees.cadrageVisage),
    recadrageEcran: recadrage(ecranSrc, entrees.partieEcran, miseEnPage.ecran),
    sourceFacecam: { largeur: facecam.largeur, hauteur: facecam.hauteur },
    sourceEcran: { largeur: ecranSrc.largeur, hauteur: ecranSrc.hauteur },
    decalageEcranSec: etat.synchro?.decalageSec ?? 0,
    ...pistes,
    plan: planPourCalque(plan),
    sousTitres: groupesSousTitres(etat.mots ?? []),
    ...(calque ? { calqueSousTitres: calque.calque } : {}),
    carteFin: entrees.carteFin,
  };
}

const ajouterReserve = (etat: EtatDemo, texte: string) => {
  const r = `À vérifier · ${texte}`;
  if (!etat.reserves.includes(r)) etat.reserves.push(r);
};
const ajouterRemarque = (etat: EtatDemo, code: string, message: string) => {
  if (!etat.remarques.some((r) => r.code === code && r.message === message)) etat.remarques.push({ code, message });
};

export interface ContexteChaineDemo {
  travailId: string;
  versionId: string;
}

export async function avancerChaineDemo(precedent: EtatDemo, commande: CommandeFabrication, ctx: ContexteChaineDemo, deps: DependancesDemo): Promise<EtatDemo> {
  const etat: EtatDemo = structuredClone(precedent);
  if (etat.fini || etat.echec) return etat;
  const entrees = lireEntreesDemo(commande);
  for (const r of entrees.remarques) ajouterRemarque(etat, "ENTREES", r);
  if (!entrees.facecam) {
    etat.echec = { message: "Aucune vidéo reçue pour cette démo.", reessayable: false };
    return etat;
  }
  const t = etat.travaux;
  const termine = (nom: string) => t[nom]?.statut === "termine";
  const rate = (nom: string) => t[nom]?.statut === "echec" && t[nom].essais >= ESSAIS_MAX_DEMO;
  const aSoumettre = (nom: string) => !t[nom] || (t[nom].statut === "echec" && t[nom].essais < ESSAIS_MAX_DEMO);
  const prochain = (nom: string) => ({ id: idDistant(ctx.travailId, nom, (t[nom]?.essais ?? 0) + 1), essais: (t[nom]?.essais ?? 0) + 1 });
  const echecDistant = (nom: string, message: string, reessayable: boolean) => {
    t[nom] = { ...t[nom], statut: "echec", message, essais: reessayable ? t[nom].essais : ESSAIS_MAX_DEMO };
  };

  // --- Suivi de ce qui a été soumis -------------------------------------------------------------------------------
  for (const nom of ["transcrire-facecam", "transcrire-ecran"]) {
    if (t[nom]?.statut !== "soumis") continue;
    const r = await deps.facecam.suivre("transcrire", t[nom].id);
    if (r.statut === "termine") t[nom] = { ...t[nom], statut: "termine", resultat: r.resultat };
    else if (r.statut === "echec") {
      // Conteneur qui redémarre ou recréé : même identifiant, aucun essai consommé.
      if (r.erreur.injoignable) continue;
      if (r.erreur.travailInconnu) t[nom] = { ...t[nom], statut: "echec", essais: t[nom].essais - 1 };
      else echecDistant(nom, r.erreur.message, r.erreur.reessayable);
    }
  }
  if (t.alignement?.statut === "soumis" && deps.alignement) {
    const r = await deps.alignement.suivre(t.alignement.id);
    if (r.statut === "termine") t.alignement = { ...t.alignement, statut: "termine", resultat: r.resultat };
    else if (r.statut === "echec") echecDistant("alignement", r.erreur.message || "Calage impossible.", r.erreur.reessayable);
  }
  for (const nom of Object.keys(t).filter((n) => n.startsWith("rendu-"))) {
    if (t[nom].statut !== "soumis") continue;
    const r = await deps.rendu.etat(t[nom].id);
    if (r.statut === "termine") t[nom] = { ...t[nom], statut: "termine", resultat: { sortieCle: r.sortieCle } };
    // Conteneur redémarré : la même demande est soumise à nouveau, sans consommer d'essai.
    else if (r.statut === "inconnu") t[nom] = { ...t[nom], statut: "echec", essais: t[nom].essais - 1 };
    else if (r.statut === "echec") echecDistant(nom, r.erreur.message, r.erreur.reessayable);
  }

  // --- 1. Transcriptions (voix réelle) --------------------------------------------------------------------------
  if (!etat.mots) {
    const source = await deps.urlLecture(entrees.facecam.cle);
    if (aSoumettre("transcrire-facecam")) {
      const p = prochain("transcrire-facecam");
      const cleTr = cleDemo(commande, ctx.versionId, "transcription-facecam.json.gz");
      const r = await deps.facecam.soumettre("transcrire", { idTravail: p.id, source, depots: { transcription: await deps.urlDepot(cleTr, "application/gzip") }, parametres: { cles: { transcription: cleTr } } });
      t["transcrire-facecam"] = { id: p.id, essais: p.essais, statut: r.statut === "echec" ? "echec" : "soumis", ...(r.statut === "echec" ? { message: r.erreur.message } : {}) };
    }
    if (entrees.ecran && entrees.synchro.mode === "audio" && aSoumettre("transcrire-ecran")) {
      const p = prochain("transcrire-ecran");
      const cleTr = cleDemo(commande, ctx.versionId, "transcription-ecran.json.gz");
      const r = await deps.facecam.soumettre("transcrire", { idTravail: p.id, source: await deps.urlLecture(entrees.ecran.cle), depots: { transcription: await deps.urlDepot(cleTr, "application/gzip") }, parametres: { cles: { transcription: cleTr } } });
      t["transcrire-ecran"] = { id: p.id, essais: p.essais, statut: r.statut === "echec" ? "echec" : "soumis" };
    }

    // 2. Calage des mots sur la voix réelle.
    const tr = t["transcrire-facecam"]?.resultat as { mots?: MotHorodate[]; dureeSec?: number } | undefined;
    if (termine("transcrire-facecam") || rate("transcrire-facecam")) {
      const bruts = Array.isArray(tr?.mots) ? tr.mots : [];
      etat.dureeSec = Math.max(entrees.facecam.dureeSec ?? 0, tr?.dureeSec ?? 0, bruts.at(-1)?.finSec ?? 0, 1);
      if (!bruts.length) {
        ajouterReserve(etat, "Sous-titres : votre parole n'a pas pu être transcrite, la vidéo sort sans sous-titres.");
        etat.mots = [];
        etat.calage = "aucun";
      } else if (!deps.alignement) {
        etat.mots = bruts;
        etat.calage = "transcription";
      } else if (aSoumettre("alignement")) {
        const p = prochain("alignement");
        await deps.alignement.soumettre({ idAlignement: p.id, audio: source, texte: bruts.map((m) => m.mot).join(" "), langue: "fr", reference: bruts });
        t.alignement = { id: p.id, essais: p.essais, statut: "soumis" };
      } else if (termine("alignement")) {
        const r = t.alignement.resultat as { mots?: MotHorodate[]; motsNonAlignes?: number };
        const cales = Array.isArray(r.mots) && r.mots.length === bruts.length ? r.mots : null;
        etat.mots = cales ?? bruts;
        etat.calage = cales ? "aligneur" : "transcription";
        if (!cales) ajouterReserve(etat, "Calage des sous-titres : mots de la transcription gardés tels quels.");
        else if ((r.motsNonAlignes ?? 0) > bruts.length * 0.1) ajouterReserve(etat, `Calage des sous-titres : ${r.motsNonAlignes} mots mal calés.`);
      } else if (rate("alignement")) {
        etat.mots = bruts;
        etat.calage = "transcription";
        ajouterReserve(etat, "Calage des sous-titres : le calage fin n'a pas abouti, mots de la transcription gardés.");
      }
    }
  }

  // --- 3. Synchronisation des deux fichiers -------------------------------------------------------------------------
  if (!etat.synchro) {
    const s = entrees.synchro;
    if (s.mode === "aucune") etat.synchro = { mode: "aucune", decalageSec: 0 };
    else if (s.mode === "fourni") etat.synchro = { mode: "fourni", decalageSec: s.decalageSec };
    else if (s.mode === "debut") etat.synchro = { mode: "debut", decalageSec: 0 };
    else if (etat.mots && (termine("transcrire-ecran") || rate("transcrire-ecran"))) {
      const motsEcran = (t["transcrire-ecran"]?.resultat as { mots?: MotHorodate[] } | undefined)?.mots ?? [];
      // Mots BRUTS des deux côtés (même transcription, même biais), pas les mots calés.
      const motsFacecam = (t["transcrire-facecam"]?.resultat as { mots?: MotHorodate[] } | undefined)?.mots ?? etat.mots;
      const d = decalageParLesMots(motsFacecam, motsEcran);
      if (d) etat.synchro = { mode: "audio", decalageSec: d.decalageSec };
      else {
        etat.synchro = { mode: "debut", decalageSec: 0 };
        ajouterReserve(etat, "Synchronisation : votre voix n'a pas été retrouvée dans l'enregistrement d'écran, les deux vidéos sont calées sur leur début.");
      }
    }
  }

  // --- 4. Plan de scènes (lot C) puis pistes écran ------------------------------------------------------------------
  if (etat.mots && etat.synchro && !etat.plan) {
    const mots = versMinute(etat.mots);
    const contexte = { mots, format: formatPlanDemo(), facecam: false, dureeMs: Math.round((etat.dureeSec ?? 1) * 1000) };
    if (entrees.plan !== undefined) {
      const r = validerPlan(entrees.plan, contexte);
      etat.plan = r.plan;
      etat.sourcePlan = "retouche";
      for (const x of r.remarques) ajouterRemarque(etat, x.code, x.message);
    } else if (deps.appelerPlan && mots.length) {
      const r = await genererPlan({ script: mots.map((m) => m.texte).join(" "), mots, format: contexte.format, facecam: false }, deps.appelerPlan);
      // Le plan suit la durée de Williams (validé de nouveau avec sa durée, jamais raccourci).
      const v = validerPlan(r.plan, contexte);
      etat.plan = v.plan;
      etat.sourcePlan = r.source;
      for (const x of [...r.remarques, ...v.remarques]) ajouterRemarque(etat, x.code, x.message);
    } else {
      const v = validerPlan(planDeRepli(contexte), contexte);
      etat.plan = v.plan;
      etat.sourcePlan = "repli";
      ajouterRemarque(etat, "PLAN_SIMPLE", "Motion design simple (légendes) : la composition par l'IA n'est pas branchée.");
    }
  }

  // --- 5. Rendu : 4:5 d'abord, puis les exports réseaux ------------------------------------------------------------
  if (etat.plan) {
    const ratios = ratiosDemo(commande);
    const styleDemo = styleSousTitresDemo(commande);
    for (const ratio of ratios) {
      const nom = `rendu-${ratio}`;
      if (ratio !== RATIO_MAITRE_DEMO && !termine(`rendu-${RATIO_MAITRE_DEMO}`)) break;
      if (termine(nom) && !etat.sorties[ratio]) etat.sorties[ratio] = { fichierCle: (t[nom].resultat as { sortieCle: string }).sortieCle };
      if (!aSoumettre(nom)) continue;
      if (styleDemo && etat.mots && calqueSousTitresDemo(etat.mots, ratio, styleDemo)?.deplace) ajouterRemarque(etat, "SOUS_TITRES_DEPLACES", "Sous-titres déplacés pour ne pas cacher le visage.");
      const p = prochain(nom);
      const cle = cleDemo(commande, ctx.versionId, `demo-${ratio.replace(":", "x")}.mp4`);
      const entreesRendu: Record<string, string> = { facecam: await deps.urlLecture(entrees.facecam.cle) };
      entreesRendu.ecran = entrees.ecran ? await deps.urlLecture(entrees.ecran.cle) : entreesRendu.facecam;
      await deps.rendu.soumettre({
        idRendu: p.id,
        operation: "composition",
        file: "longue",
        entrees: entreesRendu,
        sortie: { urlDepot: await deps.urlDepot(cle, "video/mp4"), cle },
        parametres: { composition: ID_COMPOSITION_DEMO_FACECAM, proprietes: proprietesDemo(etat, entrees, ratio, styleDemo) },
      });
      t[nom] = { id: p.id, essais: p.essais, statut: "soumis" };
    }
    if (rate(`rendu-${RATIO_MAITRE_DEMO}`)) {
      etat.echec = { message: "Le montage de l'écran partagé n'a pas abouti. Vous pouvez réessayer : vos vidéos sont gardées.", reessayable: true };
      return etat;
    }
    for (const ratio of ratios.slice(1)) if (rate(`rendu-${ratio}`)) ajouterReserve(etat, `Format ${ratio} : l'export n'a pas abouti, le 4:5 est livré.`);
    etat.fini = ratios.every((r) => termine(`rendu-${r}`) || rate(`rendu-${r}`));
  }
  return etat;
}

/* --- Retouche : seules les parties touchées, par empreinte de scène ------------------------------------------------ */

export interface RepriseDemo {
  mots: MotHorodate[];
  calage: EtatDemo["calage"];
  dureeSec: number;
  synchro: NonNullable<EtatDemo["synchro"]>;
  plan: PlanValide;
  sorties: EtatDemo["sorties"];
  /** Empreinte des consignes de la version (zooms, clics, légendes, carte de fin). */
  signatureConsignes: string;
}

export function signatureConsignes(entrees: EntreesDemo): string {
  return JSON.stringify({ c: entrees.consignes, f: entrees.carteFin, v: entrees.cadrageVisage });
}

export function lireRepriseDemo(projetMontage: Record<string, unknown> | undefined): RepriseDemo | null {
  const r = (projetMontage?.reprise ?? null) as RepriseDemo | null;
  return r && Array.isArray(r.mots) && r.plan && Array.isArray(r.plan.scenes) && r.synchro ? r : null;
}

/**
 * État de départ d'une retouche : transcription, calage, synchronisation repris tels quels ; le plan corrigé est
 * revalidé ; seules les scènes dont l'empreinte change sont « touchées ». Rien de touché et mêmes formats : les
 * vidéos de la version d'avant sont reprises sans aucun rendu.
 */
export function etatPourRetoucheDemo(reprise: RepriseDemo, commande: CommandeFabrication): EtatDemo {
  const entrees = lireEntreesDemo(commande);
  const contexte = { mots: versMinute(reprise.mots), format: formatPlanDemo(), facecam: false, dureeMs: Math.round(reprise.dureeSec * 1000) };
  const etat: EtatDemo = { ...etatDemoInitial(), mots: reprise.mots, calage: reprise.calage, dureeSec: reprise.dureeSec, synchro: reprise.synchro };
  if (entrees.plan !== undefined) {
    const r = validerPlan(entrees.plan, contexte);
    etat.plan = r.plan;
    for (const x of r.remarques) ajouterRemarque(etat, x.code, x.message);
  } else etat.plan = reprise.plan;
  etat.sourcePlan = entrees.plan !== undefined ? "retouche" : "reprise";
  etat.scenesTouchees = scenesARerendre(reprise.plan, etat.plan);
  const consignesChangees = signatureConsignes(entrees) !== reprise.signatureConsignes;
  const memesFormats = ratiosDemo(commande).every((r) => reprise.sorties[r]);
  if (!etat.scenesTouchees.length && !consignesChangees && memesFormats) {
    etat.sorties = Object.fromEntries(ratiosDemo(commande).map((r) => [r, reprise.sorties[r]!]));
    etat.fini = true;
    ajouterRemarque(etat, "RIEN_A_REFAIRE", "Aucune scène touchée : la vidéo d'avant est reprise telle quelle.");
  }
  return etat;
}
