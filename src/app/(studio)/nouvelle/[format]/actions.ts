"use server";

/**
 * Actions serveur de l'ASSISTANT (B.8 #4). Chaque action commence par exigerSession().
 * Écrans → actions → services. Aucune ne déclenche de nouveau rendu de la page :
 * l'assistant tient son état côté client et enregistre à chaque étape.
 */
import type { Adresse, BlocScript, ChoixBruitagePlan, NoteScript, Plan, Ratio, SegmentSousTitres } from "@/domaine/types";
import { choisirSonDuPlan, planDuStudio as depotsPlan } from "@/services/bruitages";
import { intensiteDeLApercu, type IntensiteApercu } from "@/services/intensite";
import type { ConsigneAmelioration, PastilleDistribution, ScriptGenere } from "@/fournisseurs";
import { exigerSession } from "@/services/auth";
import { depots, ErreurStudio, essayer, type Resultat } from "@/services/_commun";
import { enregistrerBrouillonExpress, memoriserDecor, pastillesDepuisPhrase, plansMaquette, type PlanMaquetteVue } from "@/services/express";
import { apercuFabrication, changerModeEconomiqueApercu, lancerFabrication, maquetteRapide, relectureExigee, type ApercuFabrication } from "@/services/fabrication";
import { trouverFormat } from "@/formats";
import { fichierEnvoye, urlFichier } from "@/services/fichiers";
import { ameliorerBloc, decouperTexteColle, exigerScriptReluDeLaVideo, exigerSecondOuiVoyantDeVersion, garderOuiVoyantDeVersion, genererScripts, noterScriptEssai, texteRetoucheDeLaVideo, travailDejaParti, varianteOrigineDeLaVideo } from "@/services/scripts";
import { choisirIllustrationPlan, creerBrouillon, type DonneesBrouillon } from "@/services/videos";
import type { FichierDepose } from "@/assistant/etapes/types";
import { accordPropre, type AccordPrix } from "@/domaine/accord";
import { lignesApres, lignesDesBlocs } from "@/domaine/relecture-assistant";
import { scriptReluDe, type DifferenceLigne, type PastilleControle } from "@/domaine/relecture-script";
import { controlerScriptAssistant } from "@/services/relecture-assistant";

export interface OrigineBrouillon {
  modeleId?: string;
  scriptId?: string;
  ideeId?: string;
}

/** Crée le brouillon en base (à la première étape validée). */
export async function creerBrouillonAction(formatId: string, origine: OrigineBrouillon): Promise<Resultat<string>> {
  await exigerSession();
  return essayer(() => creerBrouillon(formatId, origine));
}

/**
 * Enregistre l'état du brouillon (et son texte s'il a changé). Un script choisi dans « Mes scripts » devient
 * celui de la vidéo sans être réécrit (lot M3).
 */
export async function enregistrerBrouillonAction(videoId: string, donnees: DonneesBrouillon, blocs?: BlocScript[]): Promise<Resultat<{ scriptId?: string }>> {
  await exigerSession();
  return essayer(() => enregistrerBrouillonExpress(videoId, donnees, blocs));
}

/** Un texte collé → blocs de la recette du format, sans réécrire un mot (B.0 §16). */
export async function decouperTexteAction(formatId: string, texte: string): Promise<Resultat<BlocScript[]>> {
  await exigerSession();
  return essayer(() => decouperTexteColle(formatId, texte));
}

/** « bureau, costume bleu, debout » → pastilles à vérifier. Ne lance jamais rien (A.3). */
export async function pastillesPlateauAction(personnageId: string | undefined, phrase: string): Promise<Resultat<PastilleDistribution[]>> {
  await exigerSession();
  return essayer(() => pastillesDepuisPhrase(personnageId, phrase));
}

/** Correcteur réel 2 (F2) : ce que « Créer ce décor avec HeyGen » donnera (consigne, prix), sans rien lancer. */
export async function estimerDecorDecritAction(phrase: string, deuxAngles?: boolean): Promise<Resultat<import("@/services/decors").EstimationDecorDecrit>> {
  await exigerSession();
  const { estimerDecorDepuisDescription } = await import("@/services/decors");
  return essayer(() => estimerDecorDepuisDescription(String(phrase ?? ""), { deuxAngles: deuxAngles === true }));
}

/** Correcteur réel 2 (F2) : crée le décor HeyGen décrit, APRÈS l'accord sur le prix (`accord` vient de la feuille). */
export async function creerDecorDecritAction(phrase: string, deuxAngles: boolean, accord?: number | boolean): Promise<Resultat<{ decorId: string; crees: string[]; essai: boolean }>> {
  await exigerSession();
  const { creerDecorDepuisDescription } = await import("@/services/decors");
  return essayer(() => creerDecorDepuisDescription(String(phrase ?? ""), { confirme: typeof accord === "number" ? accord : accord === true, deuxAngles: deuxAngles === true }));
}

/** Plans exacts et sous-titres d'une maquette, composée ensuite dans le navigateur (B.1). */
export async function plansMaquetteAction(versionId: string): Promise<Resultat<{ plans: PlanMaquetteVue[]; sousTitres: SegmentSousTitres[] }>> {
  await exigerSession();
  return essayer(() => plansMaquette(versionId));
}

/** Le tu / vous de la vidéo est transmis au générateur (B.0 §15) ; la durée n'est qu'une cible. */
export async function genererScriptsAction(demande: { formatId: string; sujet: string; dureeSec: number; cible?: string; ton?: string; adresse?: Adresse }): Promise<Resultat<ScriptGenere[]>> {
  await exigerSession();
  return essayer(() => genererScripts({ ...demande, nombre: 3 }));
}

export async function ameliorerBlocAction(formatId: string, bloc: BlocScript, consigne: ConsigneAmelioration, adresse?: Adresse): Promise<Resultat<BlocScript>> {
  await exigerSession();
  return essayer(() => ameliorerBloc(formatId, bloc, consigne, adresse));
}

export async function noterScriptAction(formatId: string, blocs: BlocScript[], dureeCibleSec: number, adresse?: Adresse): Promise<Resultat<NoteScript>> {
  await exigerSession();
  return essayer(() => noterScriptEssai(formatId, blocs, dureeCibleSec, adresse));
}

export async function apercuAction(videoId: string): Promise<Resultat<ApercuFabrication>> {
  await exigerSession();
  return essayer(() => apercuFabrication(videoId));
}

/** Lot M5 : mode « économique » (banques seulement, rien n'est fabriqué), puis l'Aperçu recalculé. */
export async function modeEconomiqueAction(videoId: string, actif: boolean): Promise<Resultat<ApercuFabrication>> {
  await exigerSession();
  return essayer(async () => {
    await changerModeEconomiqueApercu(videoId, !!actif);
    return apercuFabrication(videoId);
  });
}

/** « Remplacer » l'illustration d'un plan : le choix est verrouillé (le moteur ne l'écrase jamais). */
export async function choisirIllustrationAction(planId: string, elementId: string | null): Promise<Resultat<Plan>> {
  await exigerSession();
  return essayer(() => choisirIllustrationPlan(planId, elementId));
}

/** CORRECTEUR 1 — B6 : `confirme` vient de l'écran (maquette plus chère que d'habitude). */
export async function maquetteAction(videoId: string, confirme?: AccordPrix): Promise<Resultat<{ url: string; vignette: string; dureeSec: number; ratio: Ratio; versionId: string; audioUrl: string }>> {
  await exigerSession();
  return essayer(() => maquetteRapide(videoId, { confirme: accordPropre(confirme) }));
}

/**
 * Relire le script (brique 6) : contrôles en direct du script relu. GRATUIT (du code, aucun appel payant). Le script
 * relu est refait ici depuis le texte écrit et les seules différences ; chaque phrase est lue au barème de son auteur.
 */
export async function controlerScriptReluAction(formatId: string, blocs: BlocScript[], modifications: DifferenceLigne[], adresse: Adresse): Promise<Resultat<PastilleControle[]>> {
  await exigerSession();
  return essayer(() => {
    const avant = lignesDesBlocs(blocs);
    return controlerScriptAssistant({ formatId: String(formatId), blocs, script: scriptReluDe(avant, lignesApres(avant, modifications ?? [])), adresse: adresse === "tu" ? "tu" : "vous" });
  });
}

/**
 * Lance la fabrication. Codes possibles : VOYANT_ROUGE, BUDGET_DEPASSE, CONFIRMATION_REQUISE, ACCORD_MANQUANT, SCRIPT_NON_RELU,
 * SIMULATION_EN_PRODUCTION (essai en production : passe avant la question du voyant).
 * `scriptRelu` : empreinte du texte relu (brique 6), exigée pour les formats de l'écran « Votre vidéo ».
 */
export async function lancerFabricationAction(
  videoId: string,
  confirme: AccordPrix,
  scriptRelu?: string,
  voyant?: { malgreVoyant?: boolean },
): Promise<Resultat<{ travailId: string; versionId: string }>> {
  await exigerSession();
  return essayer(async () => {
    // Texte venu d'une version du générateur : second oui si son voyant est rouge (VOYANT_ROUGE, rien créé ni payé).
    // La version d'origine vient de la vidéo (enregistrée avec le brouillon) : un rechargement ne la perd pas, l'écran ne l'impose pas.
    // Un travail déjà en cours ou en file pour cette vidéo : le lancement rend ce travail sans rien dépenser, aucune question.
    // Une vidéo sans relecture exigée (réellement filmée) n'a pas de texte à faire dire par la voix payante : aucune question.
    // Fenêtre connue, de quelques ms : entre ce contrôle « travail déjà parti » et `lancerFabrication`, un autre lancement peut
    // démarrer ce travail ; la question du voyant aurait alors été posée pour rien (aucun double paiement : `lancerFabrication`
    // rend le travail existant). Impossible à fermer d'ici sans toucher fabrication.ts (verrou par vidéo).
    const dejaParti = await travailDejaParti(videoId);
    const exigerScriptRelu = await relectureExigee(videoId);
    // « Sans voix de synthèse » = format express réellement filmé. Un format sans étape « express » (selfie, ugc…) a
    // `relectureExigee` faux sans être filmé : sa voix de synthèse parle, le voyant doit être posé.
    const video = await depots().videos.obtenir(videoId);
    const format = video ? trouverFormat(video.formatId) : undefined;
    const sansVoix = !!format?.etapes.includes("express") && !exigerScriptRelu;
    const origine = dejaParti || sansVoix ? undefined : await varianteOrigineDeLaVideo(videoId);
    const relu = typeof scriptRelu === "string" ? scriptRelu : undefined;
    // La question ne vient qu'APRÈS les refus du lancement : texte non relu, puis accord manquant / distribution incomplète
    // (l'Aperçu gratuit refait la commande, sans rien créer ni payer).
    // Will a pu retoucher le texte depuis la version reprise (comparé à elle, pas à la plus récente du code) : la note reste celle de la version d'origine, et le dit.
    const versionOrigine = origine ? await depots().variantes.obtenir(origine) : null;
    const texteRetouche = versionOrigine ? await texteRetoucheDeLaVideo(videoId, versionOrigine) : false;
    await exigerSecondOuiVoyantDeVersion(origine, voyant?.malgreVoyant === true, async () => {
      if (exigerScriptRelu) await exigerScriptReluDeLaVideo(videoId, relu);
      const a = await apercuFabrication(videoId);
      // Une vidéo qui ne peut pas partir (essai en production) ne pose pas la question : même refus que le lancement.
      if (a.refus) throw new ErreurStudio("SIMULATION_EN_PRODUCTION", a.refus);
    }, { texteRetouche });
    const r = await lancerFabrication(videoId, { confirme, scriptRelu: relu, exigerScriptRelu });
    // Le décor choisi devient l'habitude du format (catalogue des décors : « mémorisé par format et par modèle »).
    await memoriserDecor(videoId);
    // Le oui est gardé sur la version d'origine (comme « relire puis lancer »), seulement une fois la fabrication partie.
    // Départ déjà fait : une erreur d'écriture de la trace est journalisée, jamais renvoyée (« Rien n'a été créé ni payé » serait faux).
    if (origine && voyant?.malgreVoyant === true) {
      try {
        await garderOuiVoyantDeVersion(origine, { texteRetouche });
      } catch (erreur) {
        console.error("[studio] trace du oui voyant non écrite", erreur);
      }
    }
    return r;
  });
}

/**
 * B5 (audit A) : un fichier de l'assistant VRAIMENT envoyé par le navigateur (`envoyerFichier` → `/api/depots`),
 * contrôlé ici (arrivé, pour cette destination) ; renvoie sa fiche et son adresse de lecture.
 */
export async function deposerFichierAction(demande: { fichierId: string; typeEntite: string; entiteId: string }): Promise<Resultat<FichierDepose>> {
  await exigerSession();
  return essayer(async () => {
    const f = await fichierEnvoye(demande.fichierId, String(demande.typeEntite), String(demande.entiteId));
    return { id: f.id, nom: f.nom, mime: f.mime, url: await urlFichier(f.id) };
  });
}

/** Lot « intensité » (02/10) : petite courbe d'intensité et sons prévus, sous la bande de plans de l'Aperçu. */
export async function intensiteApercuAction(videoId: string): Promise<Resultat<IntensiteApercu | null>> {
  await exigerSession();
  return essayer(() => intensiteDeLApercu(videoId));
}

/** Lot « bruitages » (02/10) : « Automatique », « Aucun son » ou un son choisi, sur UN plan (gratuit). */
export async function sonDuPlanAction(planId: string, choix: ChoixBruitagePlan | null): Promise<Resultat<IntensiteApercu | null>> {
  await exigerSession();
  return essayer(async () => {
    await choisirSonDuPlan(planId, choix);
    const plan = await depotsPlan(planId);
    return plan ? intensiteDeLApercu(plan.videoId) : null;
  });
}
