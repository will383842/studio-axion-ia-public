/**
 * « DISCUTER AVEC MON MONTEUR » ET PARCOURS FACE CAMÉRA (plan facecam v4, lot D ; précision du 09/10). Serveur seulement.
 *
 * Le fil remplace « Une remarque ici » et « Vos demandes » sur « Votre vidéo » (format facecam). Chaque message :
 *  1. lit l'état de la version courante (`entrees.facecam` + `entrees.facecamMonteur`) et la transcription (R2) ;
 *  2. lance UN tour de l'agent monteur (module pur `moteurs/montage-facecam/monteur`) : un appel Claude par le chemin
 *     de dépense existant (`executerRolePourVideo` : plafond de la vidéo, limite du mois, réservation, coût réel), ou
 *     la VERSION SIMPLE sans aucun appel quand le plafond du mois est atteint ;
 *  3. dépose le code des cartes sur mesure sur R2 (le document Video ne garde que la clé) ;
 *  4. crée une NOUVELLE VERSION (`lancerRetouche` avec les entrées mises à jour, `parentVersionId`) : l'ancienne reste
 *     visible pendant le recalcul et accessible ensuite (« Revenir à la version d'avant ») ;
 *  5. s'applique SANS confirmation (format sans prix : aucun montant n'est montré).
 * Rien n'est effacé : le fil, les consignes annulées et les versions restent.
 */
import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import { optionsPayantesDemandees } from "@/briques/options-payantes/monteur";
import type { VueCarteConfirmation } from "@/briques/options-payantes/carte";
import { heurePrete } from "@/domaine/facecam-parcours";
import { priseDe } from "@/moteurs/montage-facecam/chaine";
import { carteDepuisTextesTous, CONVENTION_TEXTES_TOUS, type IdModeleMotionTous } from "@/briques/motion";
import { ajustementsAuMontage, carteAvecTextes, cartesAutoDeLaVideo, garderMarqueurs, idCarteAuto, sansMarqueurs, type AjustementCarteAuto, type CarteAutoVue } from "@/moteurs/montage-facecam/cartes-video";
export { lireInstant } from "@/moteurs/montage-facecam/cartes-video";
import { cartesDesPassages } from "@/moteurs/montage-facecam/raccords";
import { lireReprise } from "@/moteurs/montage-facecam/retouche";
import { lireLook, lookAGarder, lookAValider, lookMesure, type LookWill, type MesuresLook } from "@/moteurs/montage-facecam/look";
import { EtatFacecam, lireEntreesFacecam, type CranImage, type ImageFacecam } from "@/domaine/facecam";
import type { Id, Montant, MotHorodate } from "@/domaine/types";
import { usdVersEur } from "@/lib/montants";
import { nouvelId } from "@/lib/ids";
import {
  annulerConsigne,
  cartesAutoActives,
  coupesActives,
  estCarteAutoActive,
  effetDuPassage,
  exemplesDemandes,
  exemplesEffets,
  horloge,
  monteeVersPrise,
  motsPourMonteur,
  priseVersMontee,
  lireReglagesMonteur,
  piloterMonteur,
  recalerPassages,
  reessayerEffet,
  roleMonteurFacecam,
  roleRelectureFacecam,
  resumerCoupes,
  type CodeCarte,
  type EtatMonteur,
  type MessageFil,
  type PassageMonteur,
  type ReglagesMonteur,
  type SortieRelecture,
  couvertureSansTexte,
  codesInternes,
  demandeRenommage,
  type CouvertureMonteur,
} from "@/moteurs/montage-facecam/monteur";
import { depots, ecrireParametre, ErreurStudio, fournisseur, journaliser, lireParametre, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import { executerRolePourVideo } from "./depense-claude-video";
import { lancerRetouche } from "./fabrication";
import { engageClaudeDuMoisCentimes, PARAM_PLAFOND_MENSUEL, plafondMensuelClaudeUsd, taux } from "./generation-claude";
import { plafondClaudeDuMoisAtteint } from "./plafond-claude";
import { choisirMiniature, choisirVersion, renommerVideo } from "./videos";
import { appliquerDemandeFormats, arreterFormatsRepris, comprendreDemandeFormats, reprendreFormatsEnCours, vueFormatsFacecam, type VueFormatsFacecam } from "./formats-facecam";
import { decouperDemande, morceauxEt } from "@/moteurs/montage-facecam/monteur/regles-simples";
import { corrigerMots } from "@/moteurs/montage-facecam/habillage";

/* ------------------------------------------------------------------ */
/* Fil de discussion                                                   */
/* ------------------------------------------------------------------ */

export interface EchangeMonteur {
  id: Id;
  le: string;
  de: "will" | "monteur";
  texte: string;
  /** Message de Will dicté au micro (affiché avec un petit micro). */
  dicte?: boolean;
  /** Réponse du monteur : version créée, ce qui a été fait, état à montrer. */
  versionId?: Id;
  travailId?: Id;
  resumes?: { consigneId: string; resume: string; comprise: boolean }[];
  etat?: EtatFacecam;
  versionSimple?: boolean;
  /** Cartes sur mesure posées par cet échange (« Garder ce modèle »). */
  cartes?: { passageId: string; contenuCle: string; description: string }[];
  /** Lot J : option payante demandée, à confirmer (la carte « Option payante — environ X € … »). */
  confirmation?: VueCarteConfirmation;
}

export const ID_FORMAT_FACECAM = "facecam";

const CLE_FIL = (videoId: Id) => `facecam.fil.${videoId}`;
/** Le fil reste petit dans la table chargée en mémoire : 120 messages au plus (les plus récents). */
export const FIL_MAX = 120;

export async function filMonteur(videoId: Id): Promise<EchangeMonteur[]> {
  return lireParametre<EchangeMonteur[]>(CLE_FIL(videoId), []);
}

async function ajouterAuFil(videoId: Id, ...echanges: EchangeMonteur[]): Promise<void> {
  await ecrireParametre(CLE_FIL(videoId), [...(await filMonteur(videoId)), ...echanges].slice(-FIL_MAX));
}

/* ------------------------------------------------------------------ */
/* Stockage des données lourdes (json.gz sur R2)                       */
/* ------------------------------------------------------------------ */

/* Repli en mémoire quand le stockage n'a pas d'adresses signées (simulation, essais). */
const cleMemoire = Symbol.for("studio-axion-ia.facecam-json");
type AvecMemoire = typeof globalThis & { [cleMemoire]?: Map<string, Uint8Array> };
const memoire = () => ((globalThis as AvecMemoire)[cleMemoire] ??= new Map());

export async function deposerJsonGz(cle: string, objet: unknown): Promise<void> {
  const octets = gzipSync(Buffer.from(JSON.stringify(objet)));
  const s = await fournisseur("stockage");
  if (!s.urlDepotDuree) {
    memoire().set(cle, octets);
    return;
  }
  const url = await s.urlDepotDuree(cle, 600, "application/gzip");
  const r = await fetch(url, { method: "PUT", body: new Uint8Array(octets), headers: { "content-type": "application/gzip" } });
  if (!r.ok) throw new ErreurStudio("DEPOT_IMPOSSIBLE", "Le stockage n'a pas accepté l'animation. Réessayez dans un instant.");
}

export async function lireJsonGz<T>(cle: string): Promise<T | null> {
  const enMemoire = memoire().get(cle);
  if (enMemoire) return JSON.parse(gunzipSync(enMemoire).toString("utf8")) as T;
  const s = await fournisseur("stockage");
  if (!s.urlLectureDuree) return null;
  try {
    const r = await fetch(await s.urlLectureDuree(cle, 600));
    if (!r.ok) return null;
    const brut = Buffer.from(await r.arrayBuffer());
    const texte = brut[0] === 0x1f && brut[1] === 0x8b ? gunzipSync(brut).toString("utf8") : brut.toString("utf8");
    return JSON.parse(texte) as T;
  } catch {
    return null;
  }
}

/** Transcription au mot de la prise (clé posée par la chaîne vidéo, lot B). Absente : liste vide. */
async function transcription(cle: string | undefined): Promise<MotHorodate[]> {
  if (!cle) return [];
  const brut = await lireJsonGz<MotHorodate[] | { mots?: MotHorodate[] }>(cle);
  const mots = Array.isArray(brut) ? brut : (brut?.mots ?? []);
  return mots.filter((m) => typeof m?.mot === "string" && Number.isFinite(m.debutSec) && Number.isFinite(m.finSec));
}

/** Lot G : mots de la prise d'origine (transcription sur R2) et sa durée, pour convertir une correction en opérations. */
export async function motsDeLaPrise(entrees: Record<string, unknown>): Promise<{ mots: MotHorodate[]; dureePriseSec: number }> {
  const facecam = lireEntreesFacecam(entrees);
  const mots = await transcription(facecam.transcriptionCle);
  return { mots, dureePriseSec: mots.length ? mots[mots.length - 1].finSec : Math.max(0, ...facecam.coupes.auto.map((c) => c.finSec)) };
}

/* ------------------------------------------------------------------ */
/* Plafond, habitudes, look, animations                                */
/* ------------------------------------------------------------------ */

export interface HabitudeMonteur {
  id: Id;
  texte: string;
  le: string;
}
const CLE_HABITUDES = "facecam.habitudes";

/** « Mes habitudes » (Réglages) : les demandes « Appliquer aux prochaines vidéos ». */
export async function listerHabitudes(): Promise<HabitudeMonteur[]> {
  return lireParametre<HabitudeMonteur[]>(CLE_HABITUDES, []);
}

export async function ajouterHabitude(texte: string): Promise<HabitudeMonteur> {
  await exigerSession();
  const t = texte.trim().slice(0, 300);
  if (!t) throw new ErreurStudio("DEMANDE_VIDE", "Écrivez l'habitude à garder.");
  const h: HabitudeMonteur = { id: nouvelId("hab"), texte: t, le: maintenant() };
  const liste = await listerHabitudes();
  if (liste.some((x) => x.texte.toLowerCase() === t.toLowerCase())) return liste.find((x) => x.texte.toLowerCase() === t.toLowerCase())!;
  await ecrireParametre(CLE_HABITUDES, [...liste, h].slice(-50));
  return h;
}

export async function retirerHabitude(id: Id): Promise<void> {
  await exigerSession();
  await ecrireParametre(CLE_HABITUDES, (await listerHabitudes()).filter((h) => h.id !== id));
}

/**
 * Look Will gardé (« Garder pour les prochaines vidéos ») : crans, teinte et référence mesurée (peau, mur) appliqués à
 * toutes les vidéos suivantes (V6 P0 n° 4 : `moteurs/montage-facecam/look.ts`).
 */
export type LookGarde = LookWill;
const CLE_LOOK = "facecam.look";

export async function lookGarde(): Promise<LookGarde | null> {
  return lireLook(await lireParametre<unknown>(CLE_LOOK, null));
}

/**
 * Fin de fabrication d'une version face caméra : si c'est la version gardée « pour les prochaines vidéos », la peau et
 * le mur mesurés par la passe image deviennent la référence du look. Rend vrai si la référence a été écrite.
 */
export async function memoriserMesureLook(versionId: Id, projetMontage: Record<string, unknown> | undefined): Promise<boolean> {
  const suivant = lookMesure(await lookGarde(), versionId, (projetMontage as { lookMesure?: MesuresLook } | undefined)?.lookMesure, maintenant());
  if (!suivant) return false;
  await ecrireParametre(CLE_LOOK, suivant);
  return true;
}

/** « Mes animations » (Bibliothèque) : index léger ; le code HTML / CSS / GSAP reste sur R2. */
export interface AnimationGardee {
  id: Id;
  nom: string;
  description: string;
  contenuCle: string;
  le: string;
  videoId?: Id;
}
const CLE_ANIMATIONS = "motion.animations-gardees";

export async function listerAnimations(): Promise<AnimationGardee[]> {
  return lireParametre<AnimationGardee[]>(CLE_ANIMATIONS, []);
}

/** « Garder ce modèle » : une carte sur mesure réussie devient réutilisable dans toutes les vidéos et tous les formats. */
export async function garderAnimation(videoId: Id, contenuCle: string, description: string): Promise<AnimationGardee> {
  await exigerSession();
  const liste = await listerAnimations();
  const deja = liste.find((a) => a.contenuCle === contenuCle);
  if (deja) return deja;
  const a: AnimationGardee = { id: nouvelId("anim"), nom: nomCourt(description), description: description.slice(0, 200), contenuCle, le: maintenant(), videoId };
  await ecrireParametre(CLE_ANIMATIONS, [...liste, a]);
  await journaliser("bibliotheque", `Animation gardée : « ${a.nom} »`, { type: "video", id: videoId });
  return a;
}

export async function renommerAnimation(id: Id, nom: string): Promise<void> {
  await exigerSession();
  const n = nom.trim().slice(0, 60);
  if (!n) throw new ErreurStudio("NOM_VIDE", "Donnez un nom à l'animation.");
  await ecrireParametre(CLE_ANIMATIONS, (await listerAnimations()).map((a) => (a.id === id ? { ...a, nom: n } : a)));
}

export async function retirerAnimation(id: Id): Promise<void> {
  await exigerSession();
  await ecrireParametre(CLE_ANIMATIONS, (await listerAnimations()).filter((a) => a.id !== id));
}

function nomCourt(description: string): string {
  const d = description.replace(/^[a-zA-Z]+ : /, "").trim();
  const mots = d.split(/\s+/).slice(0, 6).join(" ");
  return (mots.charAt(0).toUpperCase() + mots.slice(1)).replace(/[.,;:]$/, "") || "Animation";
}

/* ------------------------------------------------------------------ */
/* Version courante                                                    */
/* ------------------------------------------------------------------ */

/**
 * Version sur laquelle le monteur travaille. Vérif V1 (10/10) : quand une version demandée au monteur est encore en
 * fabrication, le message suivant repart d'ELLE (et non de la version choisie) : sinon, deux messages envoyés pendant
 * le recalcul donnaient une version où le premier changement était perdu.
 */
async function versionCourante(videoId: Id) {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const choisie = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!video || !choisie) throw new ErreurStudio("INTROUVABLE", "Aucune version de cette vidéo.");
  if (choisie.commande.formatId !== ID_FORMAT_FACECAM) throw new ErreurStudio("FORMAT", "Le monteur ne travaille que sur les vidéos face caméra.");
  const enCours = (await d.versions.lister((v) => v.videoId === videoId && v.statut === "en_fabrication" && v.numero > choisie.numero && v.commande.formatId === ID_FORMAT_FACECAM)).sort((a, b) => b.numero - a.numero);
  for (const v of enCours) {
    const t = v.travailId ? await d.travaux.obtenir(v.travailId) : null;
    if (t && (t.statut === "en_cours" || t.statut === "en_file")) return { video, courante: v, choisie };
  }
  return { video, courante: choisie, choisie };
}

function etatDe(entrees: Record<string, unknown>): EtatMonteur {
  return { facecam: lireEntreesFacecam(entrees), reglages: lireReglagesMonteur(entrees) };
}

function entreesAvec(entrees: Record<string, unknown>, etat: EtatMonteur): Record<string, unknown> {
  return { ...entrees, facecam: etat.facecam, facecamMonteur: etat.reglages satisfies ReglagesMonteur };
}

/** Nouvelle version avec ces entrées (une retouche, sans confirmation : format sans prix). */
async function nouvelleVersion(videoId: Id, entrees: Record<string, unknown>, consigne: string): Promise<{ travailId: Id; versionId?: Id; pretVers?: string; formatsRepris?: string[] }> {
  // Un format ajouté en cours de fabrication est refait par la nouvelle version (constat prod 10/10).
  const repris = await reprendreFormatsEnCours(videoId, entrees);
  // Format sans prix : l'accord est donné d'office côté serveur (lot A), aucune confirmation n'est demandée.
  const r = await lancerRetouche(videoId, [], consigne, { entrees: repris.entrees });
  await arreterFormatsRepris(repris.travaux);
  const travail = await depots().travaux.obtenir(r.travailId);
  // Lot G : temps estimé en clair (seules les étapes touchées sont refaites) : « Prête vers 14 h 35 ».
  const pretVers = heurePrete(travail?.finEstimee) ?? undefined;
  return { travailId: r.travailId, versionId: travail?.versionId, ...(pretVers ? { pretVers } : {}), ...(repris.noms.length ? { formatsRepris: repris.noms } : {}) };
}

/**
 * Vérif V1 : la nouvelle version, ou la raison pour laquelle elle n'a pas pu partir (crédit, retouche indisponible…) :
 * le message et la raison restent dans le fil, rien n'est perdu ; Will peut renvoyer sa demande.
 */
async function nouvelleVersionOuRefus(videoId: Id, entrees: Record<string, unknown>, consigne: string): Promise<{ travailId?: Id; versionId?: Id; pretVers?: string; formatsRepris?: string[]; refus?: string }> {
  try {
    return await nouvelleVersion(videoId, entrees, consigne);
  } catch (e) {
    if (!(e instanceof ErreurStudio)) throw e;
    return { refus: `Je n'ai pas pu lancer la nouvelle version : ${e.message} Votre demande est gardée ici ; renvoyez-la quand c'est réglé.` };
  }
}

/* ------------------------------------------------------------------ */
/* Gestes de « Votre vidéo »                                           */
/* ------------------------------------------------------------------ */

export interface ReponseFil {
  will: EchangeMonteur;
  monteur: EchangeMonteur;
}

/**
 * Un message du fil (clavier ou micro). S'applique sans confirmation : une nouvelle version part, l'ancienne reste
 * visible pendant le recalcul.
 */
export async function discuterAvecMonteur(videoId: Id, texte: string, options: { dicte?: boolean; garderPourLesProchaines?: boolean } = {}): Promise<ReponseFil> {
  await exigerSession();
  const demande = texte.trim().slice(0, 1000);
  if (!demande) throw new ErreurStudio("DEMANDE_VIDE", "Écrivez ou dictez ce que vous voulez changer.");
  const { video, courante } = await versionCourante(videoId);
  const entrees = courante.commande.entrees ?? {};
  let etat = etatDe(entrees);
  const fil = await filMonteur(videoId);
  const [mots, plafondAtteint, habitudes, animations] = await Promise.all([transcription(etat.facecam.transcriptionCle), plafondClaudeDuMoisAtteint(courante.commande.origine), listerHabitudes(), listerAnimations()]);
  const will: EchangeMonteur = { id: nouvelId("fil"), le: maintenant(), de: "will", texte: demande, ...(options.dicte ? { dicte: true } : {}) };
  // Lot F1 : « fais-moi aussi une version carrée » : le format part tout de suite, sans appel Claude.
  const formats = comprendreDemandeFormats(demande);
  if (formats) {
    const f = await appliquerDemandeFormats(videoId, formats);
    const monteur: EchangeMonteur = { id: nouvelId("fil"), le: maintenant(), de: "monteur", texte: f.reponse, ...(f.travailId ? { travailId: f.travailId } : {}) };
    await ajouterAuFil(videoId, will, monteur);
    return { will, monteur };
  }

  // Test en prod du 11/10 : renommer la vidéo (son nom dans le studio) ou retirer un texte que Will voit sur la
  // COUVERTURE seulement : fait tout de suite, sans Claude et sans montage (aucune nouvelle version de la vidéo).
  const couverture = await couvertureDe(video.miniatureChoisieId);
  const direct = await demandeHorsMontage(videoId, demande, { couverture, nomVideo: video.titre, precedentWill: fil.filter((m) => m.de === "will").at(-1)?.texte, textesVideo: textesDeLaVideo(etat, mots) });
  if (direct) {
    const monteur: EchangeMonteur = { id: nouvelId("fil"), le: maintenant(), de: "monteur", texte: direct };
    await ajouterAuFil(videoId, will, monteur);
    return { will, monteur };
  }

  // Lot J : une option payante (décor IA, 3 caméras, ultra réaliste) n'est jamais exécutée sans « Confirmer » : le
  // monteur répond avec la carte de confirmation ; sans réponse, rien n'est fait et la version gratuite reste.
  // Lot K : « plutôt à 0:42 » pendant qu'un effet réaliste attend sa confirmation → la carte est refaite à ce moment.
  // Vérif V1 : une demande à plusieurs points garde ses points gratuits (la carte payante part, le reste est fait), et
  // les sous-titres se corrigent ici, sans Claude (recalque gratuit).
  const separe = separerDemande(demande);
  let message = separe.reste;
  const avant: { texte: string; confirmation?: VueCarteConfirmation }[] = [];
  const coupesVues = coupesActives(etat.facecam, etat.reglages.coupesDemandees);
  let corrections: ReglagesMonteur["correctionsSousTitres"] | undefined;
  if (separe.sousTitres.length) {
    const montes = mots.filter((m) => !coupesVues.some((c) => (m.debutSec + m.finSec) / 2 >= c.debutSec && (m.debutSec + m.finSec) / 2 < c.finSec));
    const st = sousTitresDepuisLeFil(separe.sousTitres, montes, etat.reglages);
    avant.push({ texte: st.texte });
    corrections = st.corrections;
  }
  if (corrections) etat = { ...etat, reglages: { ...etat.reglages, correctionsSousTitres: corrections } };
  const motsVus = motsPourMonteur(mots, coupesVues);
  const priseCle = priseDe(courante.commande)?.cle;
  const effets = await import("./effet-realiste-ia");
  if (message && effets.estChangementDeMoment(message)) {
    const c = await effets.changerMomentEffet({ videoId, versionId: courante.id, message, mots: motsVus, dureePriseSec: mots.length ? mots[mots.length - 1].finSec : video.dureeCibleSec, passages: etat.facecam.passages as PassageMonteur[], versMontee: (x) => priseVersMontee(x, coupesVues), ...(priseCle ? { priseCle } : {}) });
    if (c) {
      const monteur: EchangeMonteur = { id: nouvelId("fil"), le: maintenant(), de: "monteur", texte: c.texte, ...(c.confirmation ? { confirmation: c.confirmation } : {}) };
      await ajouterAuFil(videoId, will, monteur);
      return { will, monteur };
    }
  }

  // Lot K : l'effet réaliste par IA passe par le monteur (Claude choisit le bon endroit et écrit la consigne vidéo
  // dans son appel unique) ; il n'est pas posé : la carte de confirmation part avec l'aperçu (plus bas).
  const payantes = optionsPayantesDemandees(separe.payantes.length ? separe.payantes.join(". ") : message).filter((x) => x !== "effet-realiste-ia");
  if (payantes.length) {
    const { reponseMonteurOptionPayante } = await import("./options-payantes");
    const p = await reponseMonteurOptionPayante(payantes, { videoId, versionId: courante.id, dureeSec: mots.length ? mots[mots.length - 1].finSec : video.dureeCibleSec, message: separe.payantes.length ? separe.payantes.join(". ") : message });
    if (p) {
      avant.push(p);
      // Tout le message était l'option payante : rien d'autre à faire.
      if (!separe.payantes.length) message = "";
    }
  }
  if (!message) {
    const confirmation = avant.find((x) => x.confirmation)?.confirmation;
    const v = corrections ? await nouvelleVersionOuRefus(videoId, entreesAvec(entrees, etat), `Sous-titres corrigés : ${demande}`) : null;
    const texteMonteur = [...avant.map((x) => x.texte), v?.refus, v?.pretVers ? `Seuls les sous-titres sont refaits ; nouvelle version ${v.pretVers.charAt(0).toLowerCase()}${v.pretVers.slice(1)}.` : undefined, v?.formatsRepris ? `Le format ${v.formatsRepris.join(", ")} en cours sera refait avec elle.` : undefined].filter(Boolean).join(" ");
    const monteur: EchangeMonteur = { id: nouvelId("fil"), le: maintenant(), de: "monteur", texte: texteMonteur || "Rien à changer.", ...(confirmation ? { confirmation } : {}), ...(v?.versionId ? { versionId: v.versionId } : {}), ...(v?.travailId ? { travailId: v.travailId } : {}) };
    await ajouterAuFil(videoId, will, monteur);
    return { will, monteur };
  }

  const r = await piloterMonteur(
    {
      titre: video.titre,
      mots,
      dureePriseSec: mots.length ? mots[mots.length - 1].finSec : video.dureeCibleSec,
      etat,
      message,
      fil: fil.slice(-12).map((m): MessageFil => ({ de: m.de, texte: m.texte, le: m.le })),
      animations: animations.map((a) => ({ id: a.id, nom: a.nom, description: a.description })),
      habitudes: habitudes.map((h) => h.texte),
      plafondAtteint,
      couverture,
    },
    {
      // Lot G : plafond propre au monteur pour cette version (le tour commence avec ce message).
      appeler: (entree) => executerRolePourVideo(videoId, roleMonteurFacecam, entree, { etape: "Monteur · discussion", facecam: { depuis: will.le }, parWill: true }),
      nouvelId,
      cleCarte: (passageId) => `facecam/${videoId}/cartes/${passageId}.json.gz`,
      imageReference: await effets.resolveurImagesReference(),
    },
  );
  // Vidéo supprimée définitivement pendant l'appel : rien n'est déposé ni écrit (fil, journal, cartes).
  if (!(await depots().videos.obtenir(videoId))) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  for (const { cle, contenu } of r.aDeposer) await deposerJsonGz(cle, contenu satisfies CodeCarte);
  if (options.garderPourLesProchaines && r.comprises) await ajouterHabitude(message);

  const cartes = r.etat.facecam.passages
    .filter((p): p is PassageMonteur => !!(p as PassageMonteur).contenuCle && !etat.facecam.passages.some((x) => x.id === p.id))
    .map((p) => ({ passageId: p.id, contenuCle: p.contenuCle!, description: sansMarqueurs((p.operation as { description?: string }).description ?? p.texte ?? "Animation") }));
  let versionId: Id | undefined;
  let travailId: Id | undefined;
  let pretVers: string | undefined;
  let formatsRepris: string[] | undefined;
  // Lot K : un effet réaliste préparé seul ne change rien tant que Will n'a pas confirmé : pas de nouvelle version.
  // Test réel du 11/10 : une carte pas posée (elle effacerait la carte de fin) non plus : rien n'a changé.
  const changementLibre = JSON.stringify({ ...r.etat.facecam, consignes: [] }) !== JSON.stringify({ ...etat.facecam, consignes: [] }) || JSON.stringify(r.etat.reglages) !== JSON.stringify(etat.reglages);
  let refus: string | undefined;
  if ((r.comprises && changementLibre) || corrections) {
    const v = await nouvelleVersionOuRefus(videoId, entreesAvec(entrees, r.etat), `Monteur : ${demande}`);
    versionId = v.versionId;
    travailId = v.travailId;
    pretVers = v.pretVers;
    refus = v.refus;
    formatsRepris = v.formatsRepris;
  }
  // Test en prod du 11/10 : le titre de couverture se change sur l'image, sans montage ; la réponse dit ce qui est
  // VRAIMENT affiché (ou pourquoi rien n'a changé). Seule demande du message : c'est toute la réponse.
  const texteCouverture = r.titreCouverture ? await changerTitreCouverture(videoId, r.titreCouverture) : undefined;
  const reponseMonteur = texteCouverture && !changementLibre ? texteCouverture : [r.reponse, texteCouverture].filter(Boolean).join(" ");
  // Lot K : la carte « Effet réaliste par IA — option payante… » (aperçu du moment), sur la version la plus récente.
  const effet = r.aConfirmer[0] ? await effets.carteEffet({ videoId, versionId: versionId ?? courante.id, aConfirmer: r.aConfirmer[0], message, ...(priseCle ? { priseCle } : {}) }) : null;
  const confirmation = effet?.confirmation ?? avant.find((x) => x.confirmation)?.confirmation;
  const monteur: EchangeMonteur = {
    id: nouvelId("fil"),
    le: maintenant(),
    de: "monteur",
    ...(confirmation ? { confirmation } : {}),
    texte: [...avant.map((x) => x.texte), refus ?? reponseMonteur, effet?.texte, r.mention, pretVers ? `Nouvelle version ${pretVers.charAt(0).toLowerCase()}${pretVers.slice(1)} ; l'actuelle reste visible d'ici là.` : undefined, formatsRepris ? `Le format ${formatsRepris.join(", ")} en cours sera refait avec elle.` : undefined].filter(Boolean).join(" "),
    resumes: r.resumes,
    ...(versionId ? { versionId } : {}),
    ...(travailId ? { travailId } : {}),
    ...(r.etatFacecam ? { etat: r.etatFacecam } : {}),
    ...(r.version === "simple" ? { versionSimple: true } : {}),
    ...(cartes.length ? { cartes } : {}),
  };
  await ajouterAuFil(videoId, will, monteur);
  await journaliser("retouche", `Monteur : « ${demande.slice(0, 80)} »${r.comprises ? "" : " (non comprise)"}`, { type: "video", id: videoId });
  return { will, monteur };
}

/* ------------------------------------------------------------------ */
/* Couverture et nom de la vidéo (test en prod du 11/10)               */
/* ------------------------------------------------------------------ */

/** La couverture que Will voit : titre de la miniature choisie, écrit ou non sur l'image ; null : aucune. */
async function couvertureDe(miniatureId: Id | undefined): Promise<CouvertureMonteur | null> {
  const m = miniatureId ? await depots().miniatures.obtenir(miniatureId) : null;
  return m ? { titre: m.titre, ecrite: !!m.incrustee } : null;
}

/** Tout ce que la vidéo montée affiche ou dit (éléments posés, cartes automatiques, mots) : pour savoir où est un texte. */
function textesDeLaVideo(etat: EtatMonteur, mots: MotHorodate[]): string {
  return [JSON.stringify(etat.facecam.passages), JSON.stringify(cartesAutoActives(etat)), mots.map((m) => m.mot).join(" ")].join(" ");
}

/**
 * Change le titre de la couverture : l'image de la miniature choisie est refaite (service miniatures existant,
 * l'ancienne image reste), SANS montage. Rend la phrase pour Will : ce qui est affiché, ou pourquoi rien n'a changé.
 */
async function changerTitreCouverture(videoId: Id, texte: string): Promise<string> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const m = video?.miniatureChoisieId ? await d.miniatures.obtenir(video.miniatureChoisieId) : null;
  if (!m) return "Cette vidéo n'a pas encore d'image de couverture : rien à changer. Elle se choisit dans l'onglet Miniature.";
  try {
    await choisirMiniature(videoId, m.id, texte);
  } catch (e) {
    // Par son nom : l'erreur vient du service miniatures (chargé à part, par import dynamique dans `videos.ts`).
    if (!(e instanceof ErreurStudio || (e instanceof Error && e.name === "ErreurStudio"))) throw e;
    return `Je n'ai pas changé la couverture : ${e.message.charAt(0).toLowerCase()}${e.message.slice(1)} Vous la retrouvez dans l'onglet Miniature.`;
  }
  const apres = await d.miniatures.obtenir(m.id);
  return `La couverture affiche maintenant « ${apres?.titre ?? texte} ».`;
}

/**
 * Demandes faites sans Claude et sans montage : renommer la vidéo dans le studio ; retirer un texte (code interne,
 * texte cité) que Will voit sur la couverture et qui n'est pas dans la vidéo montée. Null : le monteur s'en occupe.
 */
async function demandeHorsMontage(videoId: Id, demande: string, ctx: { couverture: CouvertureMonteur | null; nomVideo: string; precedentWill?: string; textesVideo: string }): Promise<string | null> {
  const renommage = demandeRenommage(demande);
  if (renommage) {
    if (!renommage.nom) return "Le nom de la vidéo dans le studio se change dans sa fiche : menu en haut, « Renommer ». Ou dites « renomme la vidéo en … ». La couverture et la vidéo montée ne changent pas.";
    await renommerVideo(videoId, renommage.nom);
    return `La vidéo s'appelle maintenant « ${renommage.nom} » dans le studio. La couverture et la vidéo montée ne changent pas.`;
  }
  const nouveau = couvertureSansTexte(demande, ctx.precedentWill, ctx.couverture, ctx.textesVideo);
  if (!nouveau) return null;
  const texte = await changerTitreCouverture(videoId, nouveau);
  // Le nom dans le studio garde le code : Will sait comment le changer (jamais fait à sa place).
  const nomAvecCode = codesInternes(ctx.couverture!.titre).some((c) => ctx.nomVideo.includes(c));
  return [`Ce texte est sur la couverture (l'image affichée avant la lecture), pas dans la vidéo montée.`, texte, nomAvecCode ? `Le nom de la vidéo dans le studio reste « ${ctx.nomVideo} » : dites « renomme la vidéo en … » pour le changer.` : undefined].filter(Boolean).join(" ");
}

/**
 * Vérif V1 : les points d'une demande qui ne vont PAS au monteur (Claude) — options payantes (carte de confirmation)
 * et sous-titres (correction directe) — et le reste du message. Une demande d'un seul point payant garde son ancien
 * chemin (`payantes` vide, tout le message est lu comme avant).
 */
export function separerDemande(message: string): { reste: string; payantes: string[]; sousTitres: string[] } {
  const points = decouperDemande(message).flatMap((p) => (morceauxEt(p).length > 1 && morceauxEt(p).some((m) => optionsPayantesDemandees(m).some((x) => x !== "effet-realiste-ia")) ? morceauxEt(p) : [p]));
  const sousTitres = points.filter(estDemandeSousTitres);
  const payantes = points.filter((p) => !estDemandeSousTitres(p) && optionsPayantesDemandees(p).some((x) => x !== "effet-realiste-ia"));
  const autres = points.filter((p) => !sousTitres.includes(p) && !payantes.includes(p));
  if (!sousTitres.length && (!payantes.length || !autres.length)) return { reste: message, payantes: [], sousTitres: [] };
  // Sans autre point, les points payants restent le message (lus comme avant : carte de confirmation).
  return { reste: (autres.length ? autres : payantes).join(". "), payantes: autres.length ? payantes : [], sousTitres };
}

/* ------------------------------------------------------------------ */
/* Sous-titres depuis le fil (vérif V1)                                */
/* ------------------------------------------------------------------ */

const sansAccents = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const estDemandeSousTitres = (t: string) => /\bsous[- ]?titres?\b|\bsous[- ]?titrage\b/.test(sansAccents(t));
const motNu = (m: string) => sansAccents(m).replace(/[^a-z0-9]/g, "");

/** « écris Certifexemple et pas Calliopi », « remplace Calliopi par Certifexemple » → { ancien, nouveau } ; null sinon. */
export function remplacementSousTitres(point: string): { ancien: string; nouveau: string } | null {
  const t = point.replace(/\b(?:dans|sur|pour)\s+(?:les|le|mes|tes)\s+sous[- ]?titr\w*\s*,?/gi, " ").replace(/\bsous[- ]?titr\w*\s*:?/gi, " ");
  const g = "[«“\"']?\\s*([^«»“”\"]+?)\\s*[»”\"']?";
  const ecris = new RegExp(`(?:^|\\s)(?:[ée]cris|[ée]crit|[ée]crire|mets|met|marque)\\s+${g}\\s+(?:et pas|et non|au lieu de|[àa] la place de|pas)\\s+${g}\\s*(?:[.,;!?]|$)`, "i").exec(t);
  if (ecris) return { nouveau: ecris[1].trim(), ancien: ecris[2].trim() };
  const remplace = new RegExp(`(?:^|\\s)(?:remplace[rz]?|corrige[rz]?|change[rz]?)\\s+${g}\\s+(?:par|en)\\s+${g}\\s*(?:[.,;!?]|$)`, "i").exec(t);
  if (remplace) return { ancien: remplace[1].trim(), nouveau: remplace[2].trim() };
  return null;
}

/**
 * Points « sous-titres » du fil : « écris Certifexemple et pas Calliopi » devient une correction rangée dans la version
 * (`facecamMonteur.correctionsSousTitres`) : chaque habillage la réapplique, une retouche suivante ne la perd pas, et
 * seul l'habillage est refait. Le style des sous-titres face caméra n'est pas réglable ici : réponse claire.
 */
function sousTitresDepuisLeFil(points: string[], mots: MotHorodate[], reglages: ReglagesMonteur): { texte: string; corrections?: ReglagesMonteur["correctionsSousTitres"] } {
  const remplacements = points.map(remplacementSousTitres).filter((x): x is { ancien: string; nouveau: string } => !!x);
  if (!remplacements.length) {
    return { texte: "Le style des sous-titres (taille, couleur, place) reste celui du face caméra, réglé pour rester lisible sous votre bouche. Pour corriger un mot, dites par exemple « dans les sous-titres, écris Certifexemple et pas Calliopi », ou touchez le mot dans « Sous-titres »." };
  }
  const trouves = remplacements.filter((r) => corrigerMots(mots, [r]).remplaces > 0);
  const absents = remplacements.filter((r) => !trouves.includes(r));
  const pasTrouve = absents.length ? `Je n'ai pas trouvé « ${absents.map((r) => r.ancien).join(" », « ")} » dans ce que vous dites : touchez le mot dans « Sous-titres » pour le corriger.` : "";
  if (!trouves.length) return { texte: pasTrouve };
  const n = corrigerMots(mots, trouves).remplaces;
  const autres = reglages.correctionsSousTitres.filter((c) => !trouves.some((t) => motNu(t.ancien) === motNu(c.ancien)));
  return {
    texte: [`Dans les sous-titres : ${trouves.map((r) => `« ${r.nouveau} »`).join(", ")} (${n} fois).`, pasTrouve].filter(Boolean).join(" "),
    corrections: [...autres, ...trouves],
  };
}

/** « Annuler » une consigne comprise (« J'ai compris N consignes ») : nouvelle version sans elle. */
export async function annulerConsigneMonteur(videoId: Id, consigneId: string): Promise<{ travailId: Id }> {
  await exigerSession();
  const { courante } = await versionCourante(videoId);
  const entrees = courante.commande.entrees ?? {};
  const etat = etatDe(entrees);
  const c = etat.facecam.consignes.find((x) => x.id === consigneId);
  if (!c) throw new ErreurStudio("INTROUVABLE", "Cette consigne n'existe plus.");
  if (c.etat === "annulee") throw new ErreurStudio("DEJA_TRAITEE", "Cette consigne est déjà annulée.");
  const v = await nouvelleVersion(videoId, entreesAvec(entrees, annulerConsigne(etat, consigneId)), `Consigne annulée : ${c.texte}`);
  return { travailId: v.travailId };
}

/** Feuille « Coupes » : rétablir ou retirer de nouveau un passage coupé par le studio. */
export async function basculerCoupe(videoId: Id, coupeId: string, retablir: boolean): Promise<{ travailId: Id }> {
  await exigerSession();
  const { courante } = await versionCourante(videoId);
  const entrees = courante.commande.entrees ?? {};
  const etat = etatDe(entrees);
  const coupe = etat.facecam.coupes.auto.find((c) => c.id === coupeId);
  if (!coupe) throw new ErreurStudio("INTROUVABLE", "Ce passage n'existe plus.");
  const retablies = new Set(etat.facecam.coupes.retablies);
  if (retablir) retablies.add(coupeId);
  else retablies.delete(coupeId);
  const suivant = recalerPassages({ ...etat, facecam: { ...etat.facecam, coupes: { ...etat.facecam.coupes, retablies: [...retablies] } } });
  const v = await nouvelleVersion(videoId, entreesAvec(entrees, suivant), `${retablir ? "Passage rétabli" : "Passage retiré"} : ${coupe.libelle ?? coupe.type}`);
  return { travailId: v.travailId };
}

/** Feuille « Retoucher l'image » : 3 crans, « Garder pour les prochaines vidéos » en option. */
export async function retoucherImage(videoId: Id, image: Partial<ImageFacecam>, options: { garder?: boolean } = {}): Promise<{ travailId: Id }> {
  await exigerSession();
  const { courante } = await versionCourante(videoId);
  const entrees = courante.commande.entrees ?? {};
  const etat = etatDe(entrees);
  const crans: CranImage[] = ["moins", "juste", "plus"];
  const nouvelle: ImageFacecam = { ...etat.facecam.image };
  for (const k of ["lumiere", "couleurs", "mine", "dents"] as const) if (image[k] && crans.includes(image[k]!)) nouvelle[k] = image[k]!;
  const v = await nouvelleVersion(videoId, entreesAvec(entrees, { ...etat, facecam: { ...etat.facecam, image: nouvelle } }), "Image retouchée");
  // V6 : crans ET teinte gardés ; la version qui part sera mesurée (référence de la peau et du mur, `facecamLookWill`).
  if (options.garder) await ecrireParametre(CLE_LOOK, lookAGarder(await lookGarde(), nouvelle, etat.reglages.teinte, { videoId, versionId: v.versionId }, maintenant()));
  return { travailId: v.travailId };
}

/**
 * V6 P0 n° 5 « C'est mon look » (premier usage) : le look de la version affichée (crans, teinte) est gardé pour toutes
 * les vidéos suivantes, SANS nouvelle version ; sa peau et son mur déjà mesurés deviennent la référence tout de suite
 * (sinon à la prochaine fabrication de cette version). Rend vrai si la référence est posée.
 */
export async function validerMonLook(videoId: Id): Promise<{ reference: boolean }> {
  await exigerSession();
  const { courante } = await versionCourante(videoId);
  const etat = etatDe(courante.commande.entrees ?? {});
  await ecrireParametre(CLE_LOOK, lookAGarder(await lookGarde(), etat.facecam.image, etat.reglages.teinte, { videoId, versionId: courante.id }, maintenant()));
  const reference = await memoriserMesureLook(courante.id, courante.projetMontage as Record<string, unknown> | undefined);
  await journaliser("facecam", reference ? "Look validé : référence de la peau et du mur posée" : "Look validé : référence mesurée à la prochaine fabrication", { type: "video", id: videoId }).catch(() => undefined);
  return { reference };
}

/** Feuille « Cartes » : retirer un élément posé (carte, zoom, écran partagé, titre…), sans appel Claude. */
export async function retirerPassage(videoId: Id, passageId: string): Promise<{ travailId: Id }> {
  await exigerSession();
  const { courante } = await versionCourante(videoId);
  const entrees = courante.commande.entrees ?? {};
  const etat = etatDe(entrees);
  const p = etat.facecam.passages.find((x) => x.id === passageId);
  // Vérif V1 : une carte automatique (posée d'après le texte) se retire aussi, sans appel Claude.
  const auto = !p && estCarteAutoActive(etat.facecam, etat.reglages, passageId) ? etat.facecam.cartesAuto!.find((c) => c.id === passageId)! : null;
  if (!p && !auto) throw new ErreurStudio("INTROUVABLE", "Cet élément n'est plus dans la vidéo.");
  const suivant: EtatMonteur = auto
    ? { ...etat, reglages: { ...etat.reglages, cartesAutoRetirees: [...etat.reglages.cartesAutoRetirees, passageId] } }
    : { ...etat, facecam: { ...etat.facecam, passages: etat.facecam.passages.filter((x) => x.id !== passageId) } };
  const v = await nouvelleVersion(videoId, entreesAvec(entrees, suivant), `Élément retiré : ${sansMarqueurs(p ? (p.texte ?? p.type) : auto!.texte)}`);
  return { travailId: v.travailId };
}

/* ------------------------------------------------------------------ */
/* Feuille « Cartes et effets » : TOUTES les cartes (10/10)            */
/* ------------------------------------------------------------------ */

/** Une carte (ou un effet) de la vidéo, telle que la feuille la montre, avec ce qu'on peut y faire. */
export interface VueCarteVideo {
  /** Identifiant du passage (monteur) ou clé stable de la carte automatique. */
  id: string;
  origine: "auto" | "monteur";
  /** Type de passage (carte, écran partagé, zoom, titre…) ; « carte » pour une carte automatique. */
  type: string;
  modele?: string;
  textes: string[];
  debutSec: number;
  finSec: number;
  /** Carte automatique : retirée par Will (« Remettre »), ou masquée par une carte du monteur au même moment. */
  etat: "posee" | "retiree" | "masquee";
  deplacable: boolean;
  /** Le texte se change sur place (carte d'un modèle) ; une carte sur mesure se redemande au monteur. */
  texteModifiable: boolean;
  effetRate?: boolean;
  effetRealiste?: boolean;
}

type ProjetFacecam = { cartesAuto?: CarteAutoVue[]; motsMontesCle?: string; reprise?: unknown };

/** Mots de la vidéo montée (déposés sur R2 par la chaîne) : liste vide s'ils sont absents. */
async function motsMontes(cle: string | undefined): Promise<MotHorodate[]> {
  if (!cle) return [];
  const brut = await lireJsonGz<MotHorodate[] | { mots?: MotHorodate[] }>(cle).catch(() => null);
  const mots = Array.isArray(brut) ? brut : (brut?.mots ?? []);
  return mots.filter((m) => typeof m?.mot === "string" && Number.isFinite(m.debutSec) && Number.isFinite(m.finSec));
}

/**
 * Cartes automatiques de la version : celles que la chaîne a posées (rangées dans le projet de montage), sinon
 * replanifiées comme elle le fait (mots montés sur R2, gestes de Will, cartes du monteur) — versions d'avant le 10/10.
 */
async function cartesAutoDeLaVersion(projet: ProjetFacecam | undefined, etat: EtatMonteur): Promise<CarteAutoVue[]> {
  if (Array.isArray(projet?.cartesAuto)) return projet.cartesAuto;
  const mots = await motsMontes(projet?.motsMontesCle);
  const reprise = lireReprise(projet as Record<string, unknown> | undefined);
  const dureeSec = reprise?.dureeSec || (mots.length ? mots[mots.length - 1].finSec + 1 : 0);
  if (!mots.length || !dureeSec) return [];
  const coupes = coupesActives(etat.facecam, etat.reglages.coupesDemandees);
  const ajustements = ajustementsAuMontage(etat.reglages.cartesAuto, (x) => priseVersMontee(x, coupes));
  return cartesAutoDeLaVideo(mots, dureeSec, ajustements, cartesDesPassages(etat.facecam.passages as PassageMonteur[]), etat.reglages.cartesAutoRetirees).vues;
}

const TYPES_CARTE = new Set(["ajouterCarte", "ecranPartage"]);

/** Toutes les cartes et tous les effets de la vidéo, par ordre d'apparition (temps de la vidéo montée). */
function vueCartes(etat: EtatMonteur, auto: CarteAutoVue[], effetsRates: Set<string>): VueCarteVideo[] {
  const monteur: VueCarteVideo[] = etat.facecam.passages.map((p) => {
    const op = (p as PassageMonteur).operation as { type?: string; textes?: string[]; modele?: string | null } | undefined;
    const carte = !!op?.type && TYPES_CARTE.has(op.type);
    return {
      id: p.id,
      origine: "monteur",
      type: p.type,
      ...(p.modele ? { modele: p.modele } : {}),
      // Test réel du 11/10 : jamais de `*mot*` montré à Will (la carte rendue garde le mot en couleur).
      textes: (carte && op?.textes?.length ? op.textes : p.texte ? [p.texte] : []).map(sansMarqueurs),
      debutSec: p.debutSec,
      finSec: p.finSec,
      etat: "posee",
      deplacable: !!(p as PassageMonteur).ancre && !effetDuPassage(p),
      texteModifiable: carte && (op?.type === "ecranPartage" || !!op?.modele),
      // Lot K : un effet réaliste par IA raté (« Effet non réussi — Réessayer » : nouvelle confirmation).
      ...((p as PassageMonteur).sansDetourage === true || effetsRates.has(p.id) ? { effetRate: true } : {}),
      ...(effetDuPassage(p) ? { effetRealiste: true } : {}),
    };
  });
  const autos: VueCarteVideo[] = auto.map((c) => ({ id: c.cle, origine: "auto", type: "carte", modele: c.modele, textes: c.textes, debutSec: c.debutSec, finSec: c.finSec, etat: c.etat, deplacable: c.etat !== "retiree", texteModifiable: c.etat !== "retiree" }));
  return [...monteur, ...autos].sort((a, b) => a.debutSec - b.debutSec);
}

/** Retouche d'une carte automatique : les autres gestes sur elle sont gardés, rien n'est appelé chez Claude. */
function avecAjustement(etat: EtatMonteur, cle: string, change: (a: AjustementCarteAuto) => AjustementCarteAuto): EtatMonteur {
  const avant = etat.reglages.cartesAuto.find((a) => a.cle === cle) ?? { cle };
  const apres = change({ ...avant });
  const garde = apres.retiree || apres.debutPriseSec !== undefined || apres.textes?.length;
  const cartesAuto = [...etat.reglages.cartesAuto.filter((a) => a.cle !== cle), ...(garde ? [apres] : [])];
  return { ...etat, reglages: { ...etat.reglages, cartesAuto } };
}

async function carteAuto(videoId: Id, cle: string): Promise<{ courante: Awaited<ReturnType<typeof versionCourante>>["courante"]; etat: EtatMonteur; carte: CarteAutoVue }> {
  const { courante } = await versionCourante(videoId);
  const etat = etatDe(courante.commande.entrees ?? {});
  const carte = (await cartesAutoDeLaVersion(courante.projetMontage as ProjetFacecam | undefined, etat)).find((c) => c.cle === cle);
  if (!carte) throw new ErreurStudio("INTROUVABLE", "Cette carte n'est plus dans la vidéo.");
  return { courante, etat, carte };
}

const resumeCarte = (textes: string[]) => sansMarqueurs(textes[0] ?? "carte").slice(0, 60);

/** Retirer une carte AUTOMATIQUE (elle ne revient pas aux retouches suivantes) ; seule la piste habillée est refaite. */
export async function retirerCarteAuto(videoId: Id, cle: string): Promise<{ travailId: Id }> {
  await exigerSession();
  const { courante, etat, carte } = await carteAuto(videoId, cle);
  const v = await nouvelleVersion(videoId, entreesAvec(courante.commande.entrees ?? {}, avecAjustement(etat, cle, (a) => ({ ...a, retiree: true }))), `Carte retirée : ${resumeCarte(carte.textes)}`);
  return { travailId: v.travailId };
}

/** Remettre une carte automatique retirée. */
export async function remettreCarteAuto(videoId: Id, cle: string): Promise<{ travailId: Id }> {
  await exigerSession();
  const { courante, etat, carte } = await carteAuto(videoId, cle);
  if (carte.etat !== "retiree") throw new ErreurStudio("DEJA_TRAITEE", "Cette carte est déjà dans la vidéo.");
  const remise = avecAjustement(etat, cle, (a) => ({ ...a, retiree: undefined }));
  // Vérif V1 : une carte retirée depuis le chat (identifiant stable) revient aussi.
  const idStable = carte.idStable ?? (carte.carte ? idCarteAuto(carte.carte) : undefined);
  const suivant: EtatMonteur = idStable ? { ...remise, reglages: { ...remise.reglages, cartesAutoRetirees: remise.reglages.cartesAutoRetirees.filter((id) => id !== idStable) } } : remise;
  const v = await nouvelleVersion(videoId, entreesAvec(courante.commande.entrees ?? {}, suivant), `Carte remise : ${resumeCarte(carte.textes)}`);
  return { travailId: v.travailId };
}

/**
 * « Déplacer à 0:32 » (temps de la vidéo montée) une carte automatique ou un élément du monteur : même durée, ancré dans
 * la prise (il suit les coupes rétablies ensuite). Seule la piste habillée est refaite.
 */
export async function deplacerCarte(videoId: Id, origine: "auto" | "monteur", id: string, monteeSec: number): Promise<{ travailId: Id }> {
  await exigerSession();
  if (!Number.isFinite(monteeSec) || monteeSec < 0) throw new ErreurStudio("INSTANT", "Indiquez un moment de la vidéo, par exemple 0:32.");
  if (origine === "auto") {
    const { courante, etat, carte } = await carteAuto(videoId, id);
    const coupes = coupesActives(etat.facecam, etat.reglages.coupesDemandees);
    const v = await nouvelleVersion(videoId, entreesAvec(courante.commande.entrees ?? {}, avecAjustement(etat, id, (a) => ({ ...a, retiree: undefined, debutPriseSec: +monteeVersPrise(monteeSec, coupes).toFixed(3) }))), `Carte déplacée à ${horloge(monteeSec)} : ${resumeCarte(carte.textes)}`);
    return { travailId: v.travailId };
  }
  const { courante } = await versionCourante(videoId);
  const entrees = courante.commande.entrees ?? {};
  const etat = etatDe(entrees);
  const p = etat.facecam.passages.find((x) => x.id === id) as PassageMonteur | undefined;
  if (!p?.ancre) throw new ErreurStudio("INTROUVABLE", "Cet élément n'est plus dans la vidéo.");
  const coupes = coupesActives(etat.facecam, etat.reglages.coupesDemandees);
  const ecart = monteeVersPrise(monteeSec, coupes) - p.ancre.debutPriseSec;
  const deplace: PassageMonteur = { ...p, ancre: { debutPriseSec: +(p.ancre.debutPriseSec + ecart).toFixed(3), finPriseSec: +(p.ancre.finPriseSec + ecart).toFixed(3) } };
  const suivant = recalerPassages({ ...etat, facecam: { ...etat.facecam, passages: etat.facecam.passages.map((x) => (x.id === id ? deplace : x)) } });
  const v = await nouvelleVersion(videoId, entreesAvec(entrees, suivant), `Élément déplacé à ${horloge(monteeSec)} : ${sansMarqueurs(p.texte ?? p.type)}`);
  return { travailId: v.travailId };
}

/** « Changer le texte » d'une carte (convention du modèle : une ligne par texte). Seule la piste habillée est refaite. */
export async function changerTexteCarte(videoId: Id, origine: "auto" | "monteur", id: string, textes: string[]): Promise<{ travailId: Id }> {
  await exigerSession();
  if (origine === "auto") {
    const { courante, etat, carte } = await carteAuto(videoId, id);
    // Contrôlé sur la carte posée : un texte qui ne tient pas est refusé tout de suite, rien n'est lancé.
    const r = carte.carte ? carteAvecTextes(carte.carte, textes) : null;
    if (r && "message" in r) throw new ErreurStudio("TEXTE_CARTE", r.message);
    const v = await nouvelleVersion(videoId, entreesAvec(courante.commande.entrees ?? {}, avecAjustement(etat, id, (a) => ({ ...a, textes: textes.map((t) => t.trim()).slice(0, 8) }))), `Texte de carte changé : ${resumeCarte(textes)}`);
    return { travailId: v.travailId };
  }
  const { courante } = await versionCourante(videoId);
  const entrees = courante.commande.entrees ?? {};
  const etat = etatDe(entrees);
  const p = etat.facecam.passages.find((x) => x.id === id) as PassageMonteur | undefined;
  const op = p?.operation;
  if (!p || !op || (op.type !== "ajouterCarte" && op.type !== "ecranPartage")) throw new ErreurStudio("INTROUVABLE", "Cette carte n'est plus dans la vidéo.");
  // La fiche montre les textes sans `*mot*` : une ligne gardée telle quelle garde son mot en couleur.
  const propres = garderMarqueurs(op.textes, textes.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 8));
  if (!propres.length) throw new ErreurStudio("TEXTE_CARTE", "Écrivez le texte de la carte.");
  if (op.type === "ajouterCarte") {
    if (!op.modele) throw new ErreurStudio("TEXTE_CARTE", "Cette carte est faite sur mesure : demandez le changement au monteur.");
    if (!carteDepuisTextesTous(op.modele as IdModeleMotionTous, propres)) throw new ErreurStudio("TEXTE_CARTE", `Ce texte ne tient pas dans cette carte. Elle attend : ${CONVENTION_TEXTES_TOUS[op.modele as IdModeleMotionTous]}.`);
  }
  const change: PassageMonteur = { ...p, texte: propres.join(" · "), operation: { ...op, textes: propres } };
  const suivant: EtatMonteur = { ...etat, facecam: { ...etat.facecam, passages: etat.facecam.passages.map((x) => (x.id === id ? change : x)) } };
  const v = await nouvelleVersion(videoId, entreesAvec(entrees, suivant), `Texte de carte changé : ${resumeCarte(propres)}`);
  return { travailId: v.travailId };
}

/** « Effet non réussi — Réessayer » : l'effet à détourage est redemandé (nouvelle segmentation, nouvelle version). */
export async function reessayerEffetPassage(videoId: Id, passageId: string): Promise<{ travailId?: Id; aConfirmer?: boolean }> {
  await exigerSession();
  const { courante } = await versionCourante(videoId);
  const entrees = courante.commande.entrees ?? {};
  const etat = etatDe(entrees);
  // Lot K : un effet réaliste par IA raté se réessaie avec une NOUVELLE confirmation (la carte part dans le fil).
  const { reessayerEffetRealiste } = await import("./effet-realiste-ia");
  const priseCle = priseDe(courante.commande)?.cle;
  const carte = await reessayerEffetRealiste({ videoId, versionId: courante.id, passages: etat.facecam.passages as PassageMonteur[], passageId, ...(priseCle ? { priseCle } : {}) });
  if (carte) {
    await ajouterAuFil(videoId, { id: nouvelId("fil"), le: maintenant(), de: "monteur", texte: `On réessaie l'effet ? ${carte.texte}`, ...(carte.confirmation ? { confirmation: carte.confirmation } : {}) });
    return { aConfirmer: true };
  }
  const p = etat.facecam.passages.find((x) => x.id === passageId) as PassageMonteur | undefined;
  if (!p?.detourage) throw new ErreurStudio("INTROUVABLE", "Cet effet n'est plus dans la vidéo.");
  const suivant: EtatMonteur = { ...etat, facecam: { ...etat.facecam, passages: reessayerEffet(etat.facecam.passages as PassageMonteur[], passageId) } };
  const v = await nouvelleVersion(videoId, entreesAvec(entrees, suivant), "Effet réessayé");
  return { travailId: v.travailId };
}

/** « Revenir à la version d'avant » (`parentVersionId`) : rien n'est effacé, la version quittée reste dans l'historique. */
export async function revenirVersionAvant(videoId: Id): Promise<{ versionId: Id }> {
  await exigerSession();
  const { courante } = await versionCourante(videoId);
  if (!courante.parentVersionId) throw new ErreurStudio("PAS_DE_VERSION", "C'est la première version : il n'y a rien avant.");
  await choisirVersion(videoId, courante.parentVersionId);
  return { versionId: courante.parentVersionId };
}

/* ------------------------------------------------------------------ */
/* Lecture pour l'écran « Votre vidéo »                                */
/* ------------------------------------------------------------------ */

export interface VueVotreVideo {
  resumeCoupes: ReturnType<typeof resumerCoupes>;
  coupes: { id: string; type: string; libelle: string; debutSec: number; finSec: number; retablie: boolean }[];
  consignes: { id: string; texte: string; origine: "voix" | "ecrite"; etat: string; resume?: string }[];
  image: ImageFacecam;
  /** Vérif V1 : `type` « carte-auto » = carte posée d'office d'après le texte (retirable comme les autres). */
  passages: { id: string; type: string; debutSec: number; finSec: number; texte?: string; modele?: string; contenuCle?: string; effetRate?: boolean; /** Lot K */ effetRealiste?: boolean }[];
  /** 10/10 : TOUTES les cartes et tous les effets (cartes automatiques comprises), par ordre d'apparition. */
  cartes: VueCarteVideo[];
  fil: EchangeMonteur[];
  exemples: string[];
  /** Lot K : exemples d'effets avec leur mention (« réaliste, payant » / « en 3D, gratuit »). */
  exemplesEffets: { texte: string; mention: string }[];
  avecVersionAvant: boolean;
  look: LookGarde | null;
  /** V6 P0 n° 5 : premier usage — le look n'a encore jamais été validé (écran « Votre look »). */
  lookAValider: boolean;
  /** Lot F1 : la ligne de pastilles des formats (9:16, 4:5, carré, horizontal). */
  formats?: VueFormatsFacecam;
}

const LIBELLES_COUPE: Record<string, string> = { debut: "Début à jeter", fin: "Fin à jeter", reprise: "Phrase reprise", silence: "Silence", hesitation: "Hésitation", consigne: "Consigne au monteur" };

export async function vueVotreVideo(videoId: Id): Promise<VueVotreVideo | null> {
  await exigerSession();
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const courante = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!video || !courante || courante.commande.formatId !== ID_FORMAT_FACECAM) return null;
  const etat = etatDe(courante.commande.entrees ?? {});
  const fil = await filMonteur(videoId);
  const retablies = new Set(etat.facecam.coupes.retablies);
  const resumes = new Map(fil.flatMap((e) => e.resumes ?? []).map((r) => [r.consigneId, r.resume]));
  const mots = await transcription(etat.facecam.transcriptionCle);
  const effetsRates = await (await import("./effet-realiste-ia")).effetsRealistesRates(videoId).catch(() => new Set<string>());
  const dureePrise = mots.length ? mots[mots.length - 1].finSec : Math.max(video.dureeCibleSec, ...etat.facecam.coupes.auto.map((c) => c.finSec));
  return {
    resumeCoupes: resumerCoupes(etat.facecam, dureePrise, etat.reglages.coupesDemandees),
    coupes: etat.facecam.coupes.auto.map((c) => ({ id: c.id, type: c.type, libelle: c.libelle ?? LIBELLES_COUPE[c.type] ?? "Passage", debutSec: c.debutSec, finSec: c.finSec, retablie: retablies.has(c.id) })),
    consignes: etat.facecam.consignes.map((c) => ({ id: c.id, texte: c.texte, origine: c.origine, etat: c.etat, resume: resumes.get(c.id) })),
    image: etat.facecam.image,
    passages: etat.facecam.passages.map((p): VueVotreVideo["passages"][number] => ({
      id: p.id,
      type: p.type,
      debutSec: p.debutSec,
      finSec: p.finSec,
      ...(p.texte !== undefined ? { texte: sansMarqueurs(p.texte) } : {}),
      modele: p.modele,
      contenuCle: p.contenuCle,
      // Lot K : un effet réaliste par IA raté (« Effet non réussi — Réessayer » : nouvelle confirmation).
      effetRate: (p as PassageMonteur).sansDetourage === true || effetsRates.has(p.id),
      ...(effetDuPassage(p) ? { effetRealiste: true } : {}),
    })).concat(
      // Vérif V1 : les cartes automatiques de la version, retirables depuis la feuille « Cartes ».
      cartesAutoActives(etat).map((c) => ({ id: c.id, type: "carte-auto", debutSec: c.debutSec, finSec: c.finSec, texte: c.texte, modele: c.modele, effetRate: false })),
    ),
    cartes: vueCartes(etat, await cartesAutoDeLaVersion(courante.projetMontage as ProjetFacecam | undefined, etat).catch(() => []), effetsRates),
    fil,
    exemples: exemplesDemandes(),
    exemplesEffets: exemplesEffets(),
    avecVersionAvant: !!courante.parentVersionId,
    ...(await (async () => {
      const look = await lookGarde();
      return { look, lookAValider: lookAValider(look) };
    })()),
    formats: await vueFormatsFacecam(videoId).catch(() => undefined),
  };
}

/* ------------------------------------------------------------------ */
/* Réglages › Mon monteur : total du mois et plafond (seuls montants)  */
/* ------------------------------------------------------------------ */

export interface VueReglagesMonteur {
  /** Dépensé chez Claude ce mois-ci (tout le studio), en euros. */
  totalMois: Montant;
  /** Plafond de sécurité du mois, en euros. */
  plafond: Montant;
  plafondUsd: number;
  atteint: boolean;
  habitudes: HabitudeMonteur[];
  look: LookGarde | null;
}

export async function vueReglagesMonteur(): Promise<VueReglagesMonteur> {
  await exigerSession();
  const [plafondUsd, engage, t, habitudes, look] = await Promise.all([plafondMensuelClaudeUsd(), engageClaudeDuMoisCentimes(), taux(), listerHabitudes(), lookGarde()]);
  const engageCentimes = engage.depense + engage.reserve;
  return {
    totalMois: usdVersEur(engage.depense, t),
    plafond: usdVersEur(Math.round(plafondUsd * 100), t),
    plafondUsd,
    atteint: engageCentimes >= Math.round(plafondUsd * 100),
    habitudes,
    look,
  };
}

/** « Relever le plafond » : nouveau plafond du mois (dollars, comme le réglage Claude existant), jamais sous 1 $. */
export async function releverPlafond(nouveauUsd: number): Promise<void> {
  await exigerSession();
  if (!Number.isFinite(nouveauUsd) || nouveauUsd < 1 || nouveauUsd > 10_000) throw new ErreurStudio("PLAFOND_INVALIDE", "Choisissez un plafond entre 1 et 10 000.");
  await ecrireParametre(PARAM_PLAFOND_MENSUEL, Math.round(nouveauUsd));
  await journaliser("budget", `Plafond Claude du mois porté à ${Math.round(nouveauUsd)} $`);
}

/* ------------------------------------------------------------------ */
/* Points de branchement de la chaîne vidéo (lot B) : fabrication       */
/* ------------------------------------------------------------------ */

/** Image de contrôle rendue par la chaîne (chaque coupe, carte, écran partagé, 3 premières secondes, dernière image). */
export interface ImageControle {
  /** Élément contrôlé (passage), ou null pour une coupe, le début ou la fin. */
  elementId: string | null;
  legende: string;
  type: "image/jpeg" | "image/png";
  base64: string;
}

/**
 * Relecture des images de contrôle par Claude (UN appel, par le chemin de dépense existant). Ne lève jamais : une
 * relecture impossible rend null et la vidéo est livrée (règle de panne, B.24). À brancher dans
 * `creerMoteurMontageFacecam({ relire })` par la chaîne vidéo, et dans `piloterMonteur({ relire })`.
 */
export async function relireImagesControle(videoId: Id, etat: EtatMonteur, images: ImageControle[], options: { depuis?: string; origine?: "studio" | "usine" } = {}): Promise<SortieRelecture | null> {
  if (!images.length) return null;
  try {
    const variable = [
      `<elements>\n${etat.facecam.passages.map((p) => `${p.id} · ${p.type}${(p as PassageMonteur).detourage ? " · détourage" : ""} · ${p.texte ?? ""}`).join("\n")}\n</elements>`,
      "Les images suivent, chacune précédée de sa légende (élément et instant).",
    ].join("\n");
    const r = await executerRolePourVideo(videoId, roleRelectureFacecam, { contexte: {}, variable, images: images.slice(0, 40).map((i) => ({ type: i.type, base64: i.base64, legende: `${i.elementId ? `[${i.elementId}] ` : ""}${i.legende}` })) }, { etape: "Monteur · relecture des images", facecam: { depuis: options.depuis ?? maintenant() }, ...(options.origine ? { origine: options.origine } : {}) });
    // Panne du 10/10 : les corrections illisibles sont écartées (motif exact au journal du serveur), le reste sert.
    if (r.ok && (r.ecartees?.length || r.invalide)) console.warn(`[studio] relecture des images : ${[...(r.ecartees ?? []), r.invalide].filter(Boolean).join(" | ").slice(0, 500)}`);
    return r.ok && r.donnees ? r.donnees : null;
  } catch {
    return null;
  }
}

/** Lot K : cartes d'effets réalistes préparés à la fabrication, posées dans le fil (sur la version choisie). */
async function proposerEffetsDansLeFil(videoId: Id, aConfirmer: Awaited<ReturnType<typeof piloterMonteur>>["aConfirmer"]): Promise<void> {
  const video = await depots().videos.obtenir(videoId);
  if (!video?.versionChoisieId) return;
  const { carteEffet } = await import("./effet-realiste-ia");
  for (const a of aConfirmer.slice(0, 1)) {
    const c = await carteEffet({ videoId, versionId: video.versionChoisieId, aConfirmer: a, message: a.effet.consigne });
    await ajouterAuFil(videoId, { id: nouvelId("fil"), le: maintenant(), de: "monteur", texte: `Vous m'avez demandé au tournage : « ${a.effet.consigne.slice(0, 120)} ». ${c.texte}`, ...(c.confirmation ? { confirmation: c.confirmation } : {}) });
  }
}

/**
 * UN tour du monteur au MONTAGE (consignes « Monteur, … » repérées par la chaîne et demandes écrites à l'envoi,
 * habitudes de Will) : rend les entrées à jour (et dépose les cartes sur mesure). Plafond atteint (lu dans la commande)
 * → version simple, aucun appel Claude. À appeler par la chaîne vidéo (lot B) une fois la transcription posée.
 */
export async function monteurPourFabrication(
  videoId: Id,
  commande: { entrees: Record<string, unknown>; plafondClaudeAtteint?: boolean; origine?: "studio" | "usine" },
  options: { titre: string; mots: MotHorodate[]; dureePriseSec: number; images?: (etat: EtatMonteur) => Promise<ImageControle[]>; depuis?: string },
): Promise<{ entrees: Record<string, unknown>; resultat: Awaited<ReturnType<typeof piloterMonteur>> }> {
  const etat = etatDe(commande.entrees ?? {});
  const [habitudes, animations, look] = await Promise.all([listerHabitudes(), listerAnimations(), lookGarde()]);
  // Look gardé : appliqué à une vidéo qui n'a encore aucun réglage d'image propre.
  const depart: EtatMonteur = look && Object.values(etat.facecam.image).every((v) => v === "juste") ? { ...etat, facecam: { ...etat.facecam, image: { ...look.image } } } : etat;
  const resultat = await piloterMonteur(
    {
      titre: options.titre,
      mots: options.mots,
      dureePriseSec: options.dureePriseSec,
      etat: depart,
      consignes: depart.facecam.consignes,
      habitudes: habitudes.map((h) => h.texte),
      animations: animations.map((a) => ({ id: a.id, nom: a.nom, description: a.description })),
      plafondAtteint: !!commande.plafondClaudeAtteint,
    },
    {
      // Lot G : plafond propre au monteur pour cette version (depuis le début de la fabrication).
      appeler: (entree) => executerRolePourVideo(videoId, roleMonteurFacecam, entree, { etape: "Monteur · consignes", facecam: { depuis: options.depuis ?? maintenant() }, ...(commande.origine ? { origine: commande.origine } : {}) }),
      relire: options.images ? async (e) => relireImagesControle(videoId, e, await options.images!(e), { depuis: options.depuis, ...(commande.origine ? { origine: commande.origine } : {}) }) : undefined,
      nouvelId,
      cleCarte: (passageId) => `facecam/${videoId}/cartes/${passageId}.json.gz`,
      imageReference: await (await import("./effet-realiste-ia")).resolveurImagesReference(),
    },
  );
  for (const { cle, contenu } of resultat.aDeposer) await deposerJsonGz(cle, contenu);
  // Lot K : un effet réaliste dit au tournage (« Monteur, mets un téléphone dans ma main… ») n'est jamais fait sans
  // accord : la carte de confirmation attend dans le fil (la vidéo sort dans sa version gratuite).
  if (resultat.aConfirmer.length) await proposerEffetsDansLeFil(videoId, resultat.aConfirmer).catch(() => undefined);
  return { entrees: entreesAvec(commande.entrees ?? {}, resultat.etat), resultat };
}
