/**
 * VOIX DU TABLEAU ANIMÉ : la brique `voix-maitre` lit la voix (payée UNE fois) et range le son ; à la place de son
 * nettoyage, la RECETTE du tableau (`recette-voix.ts`) est appliquée par `studio-rendu` (opération `nettoyage-audio`,
 * mode `recette`, file courte), et les mots sont recalés par le calcul pur `planRecetteVoix`.
 *
 * Repli : sans horodatage des mots (voix qui n'en donne pas, mots estimés), la voix BRUTE est gardée telle quelle et
 * l'audio le dit (`recette.appliquee: false` et sa raison, recopiés dans le journal de la fabrication).
 *
 * Tout est injecté (mêmes outils que la brique) ; rien n'est lu ailleurs.
 */
import { avancerVoixMaitre, ESSAIS_RENDU, type EtatVoixMaitre, type OutilsVoixMaitre } from "@/briques/voix-maitre/machine";
import { debitEtVitesseConseillee } from "@/briques/voix-maitre/nettoyage";
import type { AudioBrut, AudioMaitre } from "@/briques/voix-maitre/types";
import { ErreurRendu, suivreRendu } from "@/fournisseurs/rendu/client";
import type { DemandeRendu } from "@/fournisseurs/types";
import { parametresRaccord, parametresRecette, planRaccordVoix, planRecetteSansMots, planRecetteVoix, RECETTE_VOIX_TABLEAU, type PlanRaccordVoix, type PlanRecetteVoix, type RecetteVoixTableau } from "./recette-voix";

/** Ce que la recette a fait du son. */
export interface RecetteAppliquee {
  id: string;
  appliquee: boolean;
  /** Pourquoi la voix brute a été gardée (repli), ou (`partielle`) pourquoi la recette est réduite. */
  raison?: string;
  /** GV2-28 : recette réduite (sans horodatage des mots) : un seul morceau, niveau sonore et silence de fin, sans fondu. */
  partielle?: true;
}

export type AudioVoixTableau = AudioMaitre & { recette?: RecetteAppliquee };

export type EtatVoixTableau =
  | Exclude<EtatVoixMaitre, { phase: "faite" }>
  | { phase: "recette"; brut: AudioBrut; plan: PlanRecetteVoix; demande: DemandeRendu; essai?: number; repli?: string }
  | { phase: "faite"; audio: AudioVoixTableau };

export const REPLI_SANS_HORODATAGE = "Sous-titres approximatifs : la voix n'a pas donné l'horodatage de ses mots. Le son reçoit le niveau sonore et le silence de fin, mais ni resserrage des blancs ni fondu de sortie.";

/** GV2-28 : phrase du repli quand le plan des mots n'a pas pu être calculé. */
const raisonRepliPlan = (err: unknown) => `${err instanceof Error ? err.message : String(err)} Sous-titres approximatifs : le son reçoit le niveau sonore et le silence de fin, sans resserrage des blancs ni fondu de sortie.`;

/** Mots d'un audio : ceux du plan, ou (repli sans horodatage) les mots estimés de la voix, divisés par `atempo`. */
function motsFinaux(plan: PlanRecetteVoix, brut: AudioBrut, repli: string | undefined, recette: RecetteVoixTableau) {
  if (!repli) return plan.mots;
  const k = recette.filtres.atempo;
  return k === 1 ? brut.mots : brut.mots.map((m) => ({ ...m, debutSec: +(m.debutSec / k).toFixed(4), finSec: +(m.finSec / k).toFixed(4) }));
}

/** Recette de l'audio fini : appliquée ; `partielle` et sa raison quand c'est le repli sans horodatage. */
const recetteFinie = (recette: RecetteVoixTableau, repli: string | undefined): RecetteAppliquee => ({ id: recette.id, appliquee: true, ...(repli ? { partielle: true as const, raison: repli } : {}) });

/** La voix brute sert d'audio final (repli), et l'audio le dit. */
function voixBrute(brut: AudioBrut, o: OutilsVoixMaitre, recette: RecetteVoixTableau, raison: string): EtatVoixTableau {
  return {
    phase: "faite",
    audio: {
      fichierCle: brut.fichierCle,
      dureeSec: brut.dureeSec,
      mots: brut.mots,
      empreinte: o.empreinte(),
      reutilise: false,
      coutCentimes: brut.coutCentimes,
      fournisseur: brut.fournisseur,
      caracteres: brut.caracteres,
      coupures: 0,
      respirations: 0,
      ...debitEtVitesseConseillee(brut.mots, o.reglages?.vitesse ?? 1),
      ...(brut.approximatif ? { sousTitresApproximatifs: brut.approximatif } : {}),
      ...(brut.ressemblance ? { ressemblance: brut.ressemblance } : {}),
      recette: { id: recette.id, appliquee: false, raison },
    },
  };
}

/** Identifiant d'une demande de son : `-recette`, `-recette-e<essai>`, et `-r<relance>` après un « Relancer » (le premier passage garde le sien). */
const idRecette = (idBase: string, essai: number, relance: number) => `${essai ? `${idBase}-recette-e${essai}` : `${idBase}-recette`}${relance > 0 ? `-r${relance}` : ""}`;

async function soumettreRecette(o: OutilsVoixMaitre, brut: AudioBrut, plan: PlanRecetteVoix, recette: RecetteVoixTableau, essai = 0, relance = 0): Promise<DemandeRendu> {
  const s = o.stockage();
  const sortieCle = o.cle("audio-maitre.wav");
  const entree = s.urlLectureDuree ? await s.urlLectureDuree(brut.fichierCle, 3600) : await s.urlLecture(brut.fichierCle);
  const depot = s.urlDepotDuree ? await s.urlDepotDuree(sortieCle, 3600, "audio/wav") : "";
  if (!o.renduEstSimule() && (!/^https?:\/\//.test(entree) || !depot)) {
    const message = "Le stockage des fichiers n'est pas relié : le son ne peut pas être préparé. Vérifiez Réglages > Connexions.";
    throw o.erreurStockage ? o.erreurStockage(message) : new Error(message);
  }
  const audio = /^https?:\/\//.test(entree) ? entree : `https://simulation.invalid${entree.startsWith("/") ? "" : "/"}${entree}`;
  const demande: DemandeRendu = { idRendu: idRecette(o.idBase, essai, relance), operation: "nettoyage-audio", file: "courte", entrees: { audio }, sortie: { urlDepot: depot, cle: sortieCle }, parametres: parametresRecette(plan, recette) };
  await o.rendu().soumettre(demande);
  return demande;
}

/**
 * Une phase de la voix du tableau. `o.caler` doit rendre `false` (la recette suit l'horodatage de la voix) ; l'appelant
 * le pose (`fabriquer.ts`).
 */
export async function avancerVoixTableau(etat: EtatVoixTableau, o: OutilsVoixMaitre, recette: RecetteVoixTableau = RECETTE_VOIX_TABLEAU, relance = 0): Promise<EtatVoixTableau> {
  if (etat.phase === "a-analyser") {
    const brut = etat.brut;
    // GV2-28 : sans horodatage fiable, la recette est quand même soumise (un seul morceau, sans fondu).
    let repli: string | undefined = brut.approximatif ? REPLI_SANS_HORODATAGE : undefined;
    let plan: PlanRecetteVoix;
    try {
      if (repli) plan = planRecetteSansMots(brut.dureeSec, recette);
      else plan = planRecetteVoix(brut.mots, brut.dureeSec, recette);
    } catch (err) {
      if (repli) return voixBrute(brut, o, recette, `${err instanceof Error ? err.message : String(err)} La voix brute est gardée.`);
      repli = raisonRepliPlan(err);
      try {
        plan = planRecetteSansMots(brut.dureeSec, recette);
      } catch (err2) {
        return voixBrute(brut, o, recette, `${err2 instanceof Error ? err2.message : String(err2)} La voix brute est gardée.`);
      }
    }
    return { phase: "recette", brut, plan, demande: await soumettreRecette(o, brut, plan, recette, 0, relance), ...(repli ? { repli } : {}) };
  }
  if (etat.phase === "recette") {
    const e = await suivreRendu(o.rendu(), etat.demande);
    if (e.statut === "echec") {
      const essai = (etat.essai ?? 0) + 1;
      if (!e.erreur.reessayable || essai > ESSAIS_RENDU) throw new ErreurRendu(e.erreur);
      return { ...etat, essai, demande: await soumettreRecette(o, etat.brut, etat.plan, recette, essai, relance) };
    }
    if (e.statut !== "termine") return etat;
    const brut = etat.brut;
    return {
      phase: "faite",
      audio: {
        // Rendu simulé : aucun fichier n'est produit, le son brut sert d'audio (horodatages recalés quand même).
        fichierCle: o.renduEstSimule() ? brut.fichierCle : e.sortieCle,
        dureeSec: +(e.mesures?.dureeSec ?? etat.plan.dureeSec).toFixed(3),
        mots: motsFinaux(etat.plan, brut, etat.repli, recette),
        empreinte: o.empreinte(),
        reutilise: false,
        coutCentimes: brut.coutCentimes,
        fournisseur: brut.fournisseur,
        caracteres: brut.caracteres,
        coupures: Math.max(0, etat.plan.morceaux.length - 1),
        respirations: 0,
        ...debitEtVitesseConseillee(motsFinaux(etat.plan, brut, etat.repli, recette), o.reglages?.vitesse ?? 1),
        ...(brut.approximatif ? { sousTitresApproximatifs: brut.approximatif } : {}),
        ...(brut.ressemblance ? { ressemblance: brut.ressemblance } : {}),
        recette: recetteFinie(recette, etat.repli),
      },
    };
  }
  // Lecture, copie du son (et, pour un journal d'avant, l'analyse et le nettoyage de la brique) : la brique elle-même.
  return (await avancerVoixMaitre(etat, o)) as EtatVoixTableau;
}

/* ------------------------------------------------------------------ */
/* Fins propres à chaque sortie : lectures brutes, puis raccord          */
/* ------------------------------------------------------------------ */

/**
 * Une LECTURE brute (le corps, ou une phrase de fin) : la brique `voix-maitre` lit et range le son, et s'arrête là
 * (phase `a-analyser` : le son brut et ses mots). Payée une fois ; jamais relue (l'état est gardé par l'appelant).
 */
export type EtatLectureBrute = Exclude<EtatVoixMaitre, { phase: "analyse" | "nettoyage" | "faite" }>;
// 14/10 : les phases du contrôle de ressemblance (`a-mesurer`, `mesure`, `a-relire`) en font partie : la lecture n'est
// faite qu'avec la prise gardée.

/** Vrai quand la lecture est faite (son brut rangé, mots horodatés). */
export const lectureFaite = (e: EtatLectureBrute): e is Extract<EtatLectureBrute, { phase: "a-analyser" }> => e.phase === "a-analyser";

/** Une phase d'une lecture brute (`o.caler` doit rendre `false` : la recette suit l'horodatage de la voix). */
export async function avancerLectureBrute(etat: EtatLectureBrute, o: OutilsVoixMaitre): Promise<EtatLectureBrute> {
  if (lectureFaite(etat)) return etat;
  const e = await avancerVoixMaitre(etat, o);
  if (e.phase === "analyse" || e.phase === "nettoyage" || e.phase === "faite") throw new Error("Lecture de la voix : étape inattendue après la lecture brute.");
  return e;
}

/** Recette d'une variante : son corps (et sa phrase de fin) raccordés, puis le traitement final commun. */
export type EtatRecetteVariante =
  | { phase: "a-soumettre" }
  | { phase: "recette"; plan: PlanRaccordVoix; demande: DemandeRendu; essai?: number; repli?: string }
  | { phase: "faite"; audio: AudioVoixTableau };

/** Coût et caractères des lectures dont la variante est faite (le corps est compté UNE fois, par la variante principale). */
export interface CompteVariante {
  coutCentimes: number;
  caracteres: number;
}

async function soumettreRaccord(o: OutilsVoixMaitre, corps: AudioBrut, fin: AudioBrut | undefined, plan: PlanRaccordVoix, recette: RecetteVoixTableau, essai = 0, relance = 0): Promise<DemandeRendu> {
  const s = o.stockage();
  const sortieCle = o.cle("audio-maitre.wav");
  const lire = async (cle: string) => (s.urlLectureDuree ? await s.urlLectureDuree(cle, 3600) : await s.urlLecture(cle));
  const adresse = (u: string) => (/^https?:\/\//.test(u) ? u : `https://simulation.invalid${u.startsWith("/") ? "" : "/"}${u}`);
  const entree = await lire(corps.fichierCle);
  const entree2 = fin ? await lire(fin.fichierCle) : null;
  const depot = s.urlDepotDuree ? await s.urlDepotDuree(sortieCle, 3600, "audio/wav") : "";
  if (!o.renduEstSimule() && (!/^https?:\/\//.test(entree) || (entree2 !== null && !/^https?:\/\//.test(entree2)) || !depot)) {
    const message = "Le stockage des fichiers n'est pas relié : le son ne peut pas être préparé. Vérifiez Réglages > Connexions.";
    throw o.erreurStockage ? o.erreurStockage(message) : new Error(message);
  }
  const entrees: Record<string, string> = { audio: adresse(entree), ...(entree2 !== null ? { audio2: adresse(entree2) } : {}) };
  const demande: DemandeRendu = { idRendu: idRecette(o.idBase, essai, relance), operation: "nettoyage-audio", file: "courte", entrees, sortie: { urlDepot: depot, cle: sortieCle }, parametres: parametresRaccord(plan, recette) };
  await o.rendu().soumettre(demande);
  return demande;
}

/**
 * Une phase de la recette d'une variante : le corps (et la phrase de fin, raccordée par `planRaccordVoix`) passe par
 * le traitement final commun de `studio-rendu`. Sans phrase de fin, c'est la recette du corps seul. Repli sans
 * horodatage des mots : la voix brute du corps est gardée (et le dit), comme la voix unique.
 */
export async function avancerRecetteVariante(etat: EtatRecetteVariante, sources: { corps: AudioBrut; fin?: AudioBrut }, compte: CompteVariante, o: OutilsVoixMaitre, recette: RecetteVoixTableau = RECETTE_VOIX_TABLEAU, relance = 0): Promise<EtatRecetteVariante> {
  const { corps, fin } = sources;
  if (etat.phase === "a-soumettre") {
    if (!fin && corps.approximatif) {
      // GV2-28 : sans horodatage, la recette est soumise quand même (un seul morceau, sans fondu).
      const plan: PlanRaccordVoix = { ...planRecetteSansMots(corps.dureeSec, recette), morceaux: [{ debutSec: 0, finSec: corps.dureeSec, source: 0 }], motsCorps: 0 };
      return { phase: "recette", plan, demande: await soumettreRaccord(o, corps, fin, plan, recette, 0, relance), repli: REPLI_SANS_HORODATAGE };
    }
    const plan = planRaccordVoix(corps, fin, recette);
    return { phase: "recette", plan, demande: await soumettreRaccord(o, corps, fin, plan, recette, 0, relance) };
  }
  if (etat.phase === "recette") {
    const e = await suivreRendu(o.rendu(), etat.demande);
    if (e.statut === "echec") {
      const essai = (etat.essai ?? 0) + 1;
      if (!e.erreur.reessayable || essai > ESSAIS_RENDU) throw new ErreurRendu(e.erreur);
      return { ...etat, essai, demande: await soumettreRaccord(o, corps, fin, etat.plan, recette, essai, relance) };
    }
    if (e.statut !== "termine") return etat;
    return {
      phase: "faite",
      audio: {
        // Rendu simulé : aucun fichier n'est produit, le son brut du corps sert d'audio (horodatages recalés quand même).
        fichierCle: o.renduEstSimule() ? corps.fichierCle : e.sortieCle,
        dureeSec: +(e.mesures?.dureeSec ?? etat.plan.dureeSec).toFixed(3),
        mots: motsFinaux(etat.plan, corps, etat.repli, recette),
        empreinte: o.empreinte(),
        reutilise: false,
        coutCentimes: compte.coutCentimes,
        fournisseur: corps.fournisseur,
        caracteres: compte.caracteres,
        coupures: Math.max(0, etat.plan.morceaux.length - 1),
        respirations: 0,
        ...debitEtVitesseConseillee(motsFinaux(etat.plan, corps, etat.repli, recette), o.reglages?.vitesse ?? 1),
        ...(corps.approximatif ? { sousTitresApproximatifs: corps.approximatif } : {}),
        recette: recetteFinie(recette, etat.repli),
      },
    };
  }
  return etat;
}
