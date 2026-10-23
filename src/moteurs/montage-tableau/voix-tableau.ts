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
import { parametresRaccord, parametresRecette, planRaccordVoix, planRecetteVoix, RECETTE_VOIX_TABLEAU, type PlanRaccordVoix, type PlanRecetteVoix, type RecetteVoixTableau } from "./recette-voix";

/** Ce que la recette a fait du son. */
export interface RecetteAppliquee {
  id: string;
  appliquee: boolean;
  /** Pourquoi la voix brute a été gardée (repli). */
  raison?: string;
}

export type AudioVoixTableau = AudioMaitre & { recette?: RecetteAppliquee };

export type EtatVoixTableau =
  | Exclude<EtatVoixMaitre, { phase: "faite" }>
  | { phase: "recette"; brut: AudioBrut; plan: PlanRecetteVoix; demande: DemandeRendu; essai?: number }
  | { phase: "faite"; audio: AudioVoixTableau };

export const REPLI_SANS_HORODATAGE = "La voix n'a pas donné l'horodatage de ses mots : la voix brute est gardée, sans la recette.";

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

async function soumettreRecette(o: OutilsVoixMaitre, brut: AudioBrut, plan: PlanRecetteVoix, recette: RecetteVoixTableau, essai = 0): Promise<DemandeRendu> {
  const s = o.stockage();
  const sortieCle = o.cle("audio-maitre.wav");
  const entree = s.urlLectureDuree ? await s.urlLectureDuree(brut.fichierCle, 3600) : await s.urlLecture(brut.fichierCle);
  const depot = s.urlDepotDuree ? await s.urlDepotDuree(sortieCle, 3600, "audio/wav") : "";
  if (!o.renduEstSimule() && (!/^https?:\/\//.test(entree) || !depot)) {
    const message = "Le stockage des fichiers n'est pas relié : le son ne peut pas être préparé. Vérifiez Réglages > Connexions.";
    throw o.erreurStockage ? o.erreurStockage(message) : new Error(message);
  }
  const audio = /^https?:\/\//.test(entree) ? entree : `https://simulation.invalid${entree.startsWith("/") ? "" : "/"}${entree}`;
  const demande: DemandeRendu = { idRendu: essai ? `${o.idBase}-recette-e${essai}` : `${o.idBase}-recette`, operation: "nettoyage-audio", file: "courte", entrees: { audio }, sortie: { urlDepot: depot, cle: sortieCle }, parametres: parametresRecette(plan, recette) };
  await o.rendu().soumettre(demande);
  return demande;
}

/**
 * Une phase de la voix du tableau. `o.caler` doit rendre `false` (la recette suit l'horodatage de la voix) ; l'appelant
 * le pose (`fabriquer.ts`).
 */
export async function avancerVoixTableau(etat: EtatVoixTableau, o: OutilsVoixMaitre, recette: RecetteVoixTableau = RECETTE_VOIX_TABLEAU): Promise<EtatVoixTableau> {
  if (etat.phase === "a-analyser") {
    const brut = etat.brut;
    if (brut.approximatif) return voixBrute(brut, o, recette, REPLI_SANS_HORODATAGE);
    let plan: PlanRecetteVoix;
    try {
      plan = planRecetteVoix(brut.mots, brut.dureeSec, recette);
    } catch (err) {
      return voixBrute(brut, o, recette, `${err instanceof Error ? err.message : String(err)} La voix brute est gardée.`);
    }
    return { phase: "recette", brut, plan, demande: await soumettreRecette(o, brut, plan, recette) };
  }
  if (etat.phase === "recette") {
    const e = await suivreRendu(o.rendu(), etat.demande);
    if (e.statut === "echec") {
      const essai = (etat.essai ?? 0) + 1;
      if (!e.erreur.reessayable || essai > ESSAIS_RENDU) throw new ErreurRendu(e.erreur);
      return { ...etat, essai, demande: await soumettreRecette(o, etat.brut, etat.plan, recette, essai) };
    }
    if (e.statut !== "termine") return etat;
    const brut = etat.brut;
    return {
      phase: "faite",
      audio: {
        // Rendu simulé : aucun fichier n'est produit, le son brut sert d'audio (horodatages recalés quand même).
        fichierCle: o.renduEstSimule() ? brut.fichierCle : e.sortieCle,
        dureeSec: +(e.mesures?.dureeSec ?? etat.plan.dureeSec).toFixed(3),
        mots: etat.plan.mots,
        empreinte: o.empreinte(),
        reutilise: false,
        coutCentimes: brut.coutCentimes,
        fournisseur: brut.fournisseur,
        caracteres: brut.caracteres,
        coupures: Math.max(0, etat.plan.morceaux.length - 1),
        respirations: 0,
        ...debitEtVitesseConseillee(etat.plan.mots, o.reglages?.vitesse ?? 1),
        ...(brut.ressemblance ? { ressemblance: brut.ressemblance } : {}),
        recette: { id: recette.id, appliquee: true },
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
  | { phase: "recette"; plan: PlanRaccordVoix; demande: DemandeRendu; essai?: number }
  | { phase: "faite"; audio: AudioVoixTableau };

/** Coût et caractères des lectures dont la variante est faite (le corps est compté UNE fois, par la variante principale). */
export interface CompteVariante {
  coutCentimes: number;
  caracteres: number;
}

async function soumettreRaccord(o: OutilsVoixMaitre, corps: AudioBrut, fin: AudioBrut | undefined, plan: PlanRaccordVoix, recette: RecetteVoixTableau, essai = 0): Promise<DemandeRendu> {
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
  const demande: DemandeRendu = { idRendu: essai ? `${o.idBase}-recette-e${essai}` : `${o.idBase}-recette`, operation: "nettoyage-audio", file: "courte", entrees, sortie: { urlDepot: depot, cle: sortieCle }, parametres: parametresRaccord(plan, recette) };
  await o.rendu().soumettre(demande);
  return demande;
}

/**
 * Une phase de la recette d'une variante : le corps (et la phrase de fin, raccordée par `planRaccordVoix`) passe par
 * le traitement final commun de `studio-rendu`. Sans phrase de fin, c'est la recette du corps seul. Repli sans
 * horodatage des mots : la voix brute du corps est gardée (et le dit), comme la voix unique.
 */
export async function avancerRecetteVariante(etat: EtatRecetteVariante, sources: { corps: AudioBrut; fin?: AudioBrut }, compte: CompteVariante, o: OutilsVoixMaitre, recette: RecetteVoixTableau = RECETTE_VOIX_TABLEAU): Promise<EtatRecetteVariante> {
  const { corps, fin } = sources;
  if (etat.phase === "a-soumettre") {
    if (!fin && corps.approximatif) {
      const brute = voixBrute(corps, o, recette, REPLI_SANS_HORODATAGE) as Extract<EtatVoixTableau, { phase: "faite" }>;
      return { phase: "faite", audio: { ...brute.audio, coutCentimes: compte.coutCentimes, caracteres: compte.caracteres } };
    }
    const plan = planRaccordVoix(corps, fin, recette);
    return { phase: "recette", plan, demande: await soumettreRaccord(o, corps, fin, plan, recette) };
  }
  if (etat.phase === "recette") {
    const e = await suivreRendu(o.rendu(), etat.demande);
    if (e.statut === "echec") {
      const essai = (etat.essai ?? 0) + 1;
      if (!e.erreur.reessayable || essai > ESSAIS_RENDU) throw new ErreurRendu(e.erreur);
      return { ...etat, essai, demande: await soumettreRaccord(o, corps, fin, etat.plan, recette, essai) };
    }
    if (e.statut !== "termine") return etat;
    return {
      phase: "faite",
      audio: {
        // Rendu simulé : aucun fichier n'est produit, le son brut du corps sert d'audio (horodatages recalés quand même).
        fichierCle: o.renduEstSimule() ? corps.fichierCle : e.sortieCle,
        dureeSec: +(e.mesures?.dureeSec ?? etat.plan.dureeSec).toFixed(3),
        mots: etat.plan.mots,
        empreinte: o.empreinte(),
        reutilise: false,
        coutCentimes: compte.coutCentimes,
        fournisseur: corps.fournisseur,
        caracteres: compte.caracteres,
        coupures: Math.max(0, etat.plan.morceaux.length - 1),
        respirations: 0,
        ...debitEtVitesseConseillee(etat.plan.mots, o.reglages?.vitesse ?? 1),
        recette: { id: recette.id, appliquee: true },
      },
    };
  }
  return etat;
}
