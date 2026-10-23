/**
 * Fournisseurs SIMULÉS (visage, voix, montage, illustration, étalonnage, son, miniature,
 * publication, texte réseaux, notification, stockage). Aucun appel réseau, jamais.
 */
import { validerCube } from "@/lib/qc-lut";
import { centimes } from "@/lib/montants";
import { obtenirReseau } from "@/reseaux";
import { composerLegende, corpsTexteSimule, finDuTexte, motsDiesePour } from "@/domaine/textes-publication";
import { horodaterTexte } from "@/domaine/derivations";
import { analyserImageSimulee } from "./analyse-image";
import type {
  FournisseurEtalonnage,
  FournisseurIllustration,
  FournisseurMiniature,
  FournisseurMontage,
  FournisseurNotification,
  FournisseurPublication,
  FournisseurSon,
  FournisseurTexteReseaux,
  FournisseurVisage,
  FournisseurVoix,
  StockageFichiers,
} from "../types";

const base = { id: "simulation", mode: "simulation" as const };

function idExterne(prefixe: string): string {
  return `sim-${prefixe}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Prix simulés EN DOLLARS (centimes de dollar), convertis en euros par `taux.usdEur` (B.0 §9). */
export const TARIFS_USD = {
  /** Visage HeyGen Avatar V : ≈ 7 centimes de dollar par seconde rendue (45 s + ≈ 13 s de second angle ≈ 4 $). */
  visageParSeconde: 7,
  /** Voix : au caractère (prix HeyGen relevé à la première facture, lot M0b). */
  voixParCaractere: 0.02,
  /** Image générée (≈ 4 centimes) puis animée (≈ 7 centimes la seconde). */
  imageGeneree: 4,
  clipParSeconde: 7,
};

/** Rendus simulés en cours : identifiant → instant de fin (le rendu « réel » se suit par interrogation). */
const rendusSimules = new Map<string, { fin: number; dureeSec: number }>();

export const fournisseurVisageSimulation: FournisseurVisage = {
  ...base,
  type: "visage",
  nom: "Double (visage)",
  reelPrevu: "HeyGen",
  capacites: {
    asynchrone: true,
    accordExige: true,
    dureeMaxSec: 1800,
    retoucheParPlan: true,
    tarif: { unite: "seconde", prixUnitaire: centimes(TARIFS_USD.visageParSeconde * 0.9) },
    tarifUsd: { unite: "seconde", centimesUsd: TARIFS_USD.visageParSeconde },
    fondTransparent: true,
    resolutionMax: 1080,
    fpsSortie: 25,
  },
  async creerDouble(demande) {
    if (demande.nature === "reel" && !(demande.accord?.case && demande.accord.documentFichierId && demande.accord.date)) {
      throw new Error("ACCORD_MANQUANT");
    }
    return { idExterne: idExterne("visage"), statut: "en_preparation" };
  },
  async suivre() {
    return { statut: "pret", progression: 100 };
  },
  async tester() {
    return { fichierCle: "/demo/avocat-droits.mp4" };
  },
  async noterQualite(fichierIds) {
    const note = Math.min(96, 70 + fichierIds.length * 6);
    const conseils = note < 85 ? ["Ajoutez une vidéo plus lumineuse.", "Regardez la personne à côté de la caméra, sans bouger la tête."] : ["Très bon éclairage."];
    return { note, conseils, levres: Math.min(98, note + 2) };
  },
  async rendre(demande) {
    if (!demande.audioCle) throw new Error("AUDIO_MANQUANT");
    const id = `sim-rendu-${demande.cleIdempotence}`;
    // Même clé d'idempotence = même rendu (aucun double paiement).
    if (!rendusSimules.has(id)) rendusSimules.set(id, { fin: Date.now() + 2000, dureeSec: 30 });
    return { idTravailExterne: id };
  },
  async suivreRendu(idTravailExterne) {
    const r = rendusSimules.get(idTravailExterne);
    if (!r) return { statut: "echec", erreur: { code: "inconnu", reessayable: true, message: "Ce rendu est introuvable." } };
    const reste = r.fin - Date.now();
    return reste <= 0 ? { statut: "termine" } : { statut: "en_cours", progression: Math.max(1, Math.min(99, Math.round(100 - reste / 20))) };
  },
  async recuperer(idTravailExterne) {
    return { videoCle: "/demo/avocat-droits.mp4", dureeSec: rendusSimules.get(idTravailExterne)?.dureeSec ?? 30, fps: 25 };
  },
  async creerLook() {
    // Un look part d'une image : gestes non appris, à vérifier sur un essai (B.0 §9).
    return { idExterne: idExterne("look"), statut: "a_verifier" };
  },
};

export const fournisseurVoixSimulation: FournisseurVoix = {
  ...base,
  type: "voix",
  nom: "Voix",
  reelPrevu: "HeyGen (ElevenLabs en secours)",
  capacites: {
    asynchrone: false,
    accordExige: true,
    langues: ["fr-FR", "en-US"],
    tarif: { unite: "caractere", prixUnitaire: centimes(TARIFS_USD.voixParCaractere * 0.9) },
    tarifUsd: { unite: "caractere", centimesUsd: TARIFS_USD.voixParCaractere },
    audioSeul: true,
    horodatageMots: true,
  },
  async copierVoix(demande) {
    if (demande.nature === "reel" && !(demande.accord?.case && demande.accord.documentFichierId && demande.accord.date)) {
      throw new Error("ACCORD_MANQUANT");
    }
    return { idExterne: idExterne("voix"), statut: demande.minutes >= 1 ? "pret" : "brouillon" };
  },
  async lire(demande) {
    // Le texte envoyé porte les prononciations substituées (« PV » → « pé-vé ») : l'horodatage porte sur ce texte.
    let prononce = demande.texte;
    for (const p of demande.prononciations) prononce = prononce.replace(new RegExp(`(?<![\\p{L}\\p{N}])${p.mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "giu"), p.prononciation);
    const mots = horodaterTexte(prononce, demande.motsParSeconde ?? 4.4, demande.reglages.vitesse || 1);
    const dureeSec = Math.max(1, Math.round(mots.at(-1)?.finSec ?? 1));
    return { fichierCle: "/demo/essai-voix.mp3", dureeSec, cout: centimes(demande.texte.length * TARIFS_USD.voixParCaractere * 0.9), mots };
  },
  async listerVoixExistantes() {
    return [
      { idExterne: "sim-voix-heygen-will", nom: "Ma voix (essai)", langue: "fr-FR", typeClone: "instant", utilisable: true, apercuUrl: "/demo/essai-voix.mp3" },
      { idExterne: "sim-voix-heygen-pro", nom: "Voix professionnelle (anglais seulement)", langue: "en-US", typeClone: "pro", utilisable: false },
    ];
  },
};

export const fournisseurMontageSimulation: FournisseurMontage = {
  ...base,
  type: "montage",
  nom: "Montage",
  reelPrevu: "Remotion",
  capacites: { asynchrone: true, accordExige: false, dureeMaxSec: 1800, retoucheParPlan: true, tarif: { unite: "seconde", prixUnitaire: centimes(1) } },
  async assembler(commande) {
    return { projetMontage: { pistes: commande.plans.length, ratioMaitre: commande.ratios[0] }, dureeSec: commande.dureeCibleSec };
  },
};

export const fournisseurIllustrationSimulation: FournisseurIllustration = {
  ...base,
  type: "illustration",
  nom: "Images d'illustration",
  reelPrevu: "Pexels, Pixabay, fal.ai",
  capacites: { asynchrone: false, accordExige: false, tarif: { unite: "image", prixUnitaire: centimes(5) } },
  async choisir({ requete, candidats, nombre }) {
    const mots = requete.toLowerCase().split(/\s+/);
    const notes = candidats.map((c) => ({ id: c.id, score: c.motsCles.filter((m) => mots.some((x) => m.toLowerCase().includes(x) || x.includes(m.toLowerCase()))).length }));
    return notes.sort((a, b) => b.score - a.score).slice(0, nombre).map((n) => n.id);
  },
  async generer() {
    return { fichierCle: "/demo/illustrations/illu-01.jpg", cout: centimes(TARIFS_USD.imageGeneree * 0.9) };
  },
  async chercher({ requete, ratio, dureeMinSec, sources }) {
    // Simulation : un résultat vertical par banque demandée, toujours avec sa licence (jamais de 16:9 recadré).
    if (ratio !== "9:16" && ratio !== "4:5") return [];
    return sources.map((source, i) => ({
      idExterne: `sim-${source}-${i}`,
      source,
      fichierCle: "/demo/motion-chiffres.mp4",
      vignetteCle: `/demo/illustrations/illu-${String((i % 12) + 1).padStart(2, "0")}.jpg`,
      dureeSec: Math.max(dureeMinSec, 6),
      largeur: 1080,
      hauteur: 1920,
      licence: { type: "libre" as const, usageCommercial: true, reseaux: [], source: source === "pexels" ? "Pexels" : "Pixabay" },
      description: requete,
    }));
  },
  async animer({ dureeSec }) {
    return { fichierCle: "/demo/motion-chiffres.mp4", cout: centimes(dureeSec * TARIFS_USD.clipParSeconde * 0.9) };
  },
  // Lot A2 : classement d'une image de « Mes images » par RÈGLES (nom du fichier), tant qu'aucune clé Claude n'existe.
  analyserImage: analyserImageSimulee,
};

export const fournisseurEtalonnageSimulation: FournisseurEtalonnage = {
  ...base,
  type: "etalonnage",
  nom: "Étalonnage (LUT)",
  reelPrevu: "ffmpeg",
  capacites: { asynchrone: false, accordExige: false, tarif: { unite: "seconde", prixUnitaire: centimes(0.2) } },
  // Contrôle `qc` (lot M4) : refus clair si la LUT est cassée, avertissement si la cassure dépasse 0,02.
  async validerCube(contenu) {
    const v = validerCube(contenu);
    return v.ok ? { ok: true, taille: v.taille, avertissement: v.avertissement } : v;
  },
  async appliquer(demande) {
    return { fichierCle: demande.fichierCle };
  },
};

export const fournisseurSonSimulation: FournisseurSon = {
  ...base,
  type: "son",
  nom: "Son et mixage",
  reelPrevu: "ffmpeg (loudnorm)",
  capacites: { asynchrone: false, accordExige: false, tarif: { unite: "seconde", prixUnitaire: centimes(0.3) } },
  async mixer(demande) {
    return { fichierCle: demande.voixCle, niveauLufs: demande.niveauCibleLufs };
  },
};

export const fournisseurMiniatureSimulation: FournisseurMiniature = {
  ...base,
  type: "miniature",
  nom: "Miniatures",
  reelPrevu: "Générateur d'images",
  capacites: { asynchrone: false, accordExige: false, tarif: { unite: "image", prixUnitaire: centimes(4) } },
  async proposer({ titre, nombre }) {
    const fonds = ["/demo/miniatures/mini-1.jpg", "/demo/miniatures/mini-2.jpg", "/demo/miniatures/mini-3.jpg"];
    const titres = [titre.toUpperCase(), titre, `${titre.split(" ").slice(0, 4).join(" ")}…`];
    return Array.from({ length: nombre }, (_, i) => ({ fichierCle: fonds[i % fonds.length], titre: titres[i % titres.length] }));
  },
};

export const fournisseurPublicationSimulation: FournisseurPublication = {
  ...base,
  type: "publication",
  nom: "Publication (Buffer)",
  reelPrevu: "Buffer",
  capacites: { asynchrone: false, accordExige: false },
  async envoyer() {
    // Essai : rien n'est envoyé à Buffer (AV2.4-4).
    return { idExterne: idExterne("publication"), via: "simulation" };
  },
};

export const fournisseurTexteReseauxSimulation: FournisseurTexteReseaux = {
  ...base,
  type: "texte-reseaux",
  nom: "Textes de publication",
  reelPrevu: "Claude",
  capacites: { asynchrone: false, accordExige: false, tarif: { unite: "appel", prixUnitaire: centimes(2) } },
  async ecrire({ reseau, titre, texteScript, mentionIA, credits, formatId, dureeSec, adresse }) {
    const def = obtenirReseau(reseau);
    const corps = corpsTexteSimule({ reseau, titre, texteScript, dureeSec, adresse });
    // La mention IA (si elle est activée) et les crédits ne sont jamais coupés : seul le corps est raccourci.
    const texte = composerLegende(corps, finDuTexte(mentionIA, credits), def.legende.longueurMax);
    const motsDiese = motsDiesePour(formatId, reseau, def.legende.motsDieseConseilles);
    return { texte, motsDiese, titre: reseau === "youtube" || reseau === "youtube-shorts" ? titre.slice(0, 100) : undefined };
  },
};

export const fournisseurNotificationSimulation: FournisseurNotification = {
  ...base,
  type: "notification",
  nom: "Notifications (téléphone, e-mail)",
  reelPrevu: "Notifications web + e-mail",
  capacites: { asynchrone: false, accordExige: false },
  async envoyer() {
    return { envoye: false };
  },
};

const EXTENSION_PAR_FAMILLE: Record<string, string> = { image: "jpg", video: "mp4", audio: "mp3" };
const IMAGE_DEMO = "/demo/illustrations/illu-05.jpg";
// Vidéo neutre « déposée (essai) » : jamais une vidéo d'exemple titrée « Réalisé avec l'IA ».
const VIDEO_DEMO = "/demo/rushs/depot.mp4";
const AUDIO_DEMO = "/demo/essai-voix.mp3";
const MEDIA_PAR_EXTENSION: Record<string, string> = {
  jpg: IMAGE_DEMO,
  jpeg: IMAGE_DEMO,
  png: IMAGE_DEMO,
  webp: IMAGE_DEMO,
  avif: IMAGE_DEMO,
  gif: IMAGE_DEMO,
  heic: IMAGE_DEMO,
  mp4: VIDEO_DEMO,
  mov: VIDEO_DEMO,
  webm: VIDEO_DEMO,
  m4v: VIDEO_DEMO,
  mp3: AUDIO_DEMO,
  wav: AUDIO_DEMO,
  m4a: AUDIO_DEMO,
  ogg: AUDIO_DEMO,
  aac: AUDIO_DEMO,
};

/** Objets du stockage simulé : vide en usage normal (aucun octet n'est envoyé) ; rempli seulement par les tests. */
const objetsSimules = new Set<string>();
/** RÉSERVÉ AUX TESTS : range un objet dans le stockage simulé (pour vérifier qu'une suppression l'efface). */
export function deposerObjetSimule(cle: string): void {
  objetsSimules.add(cle);
}
/** RÉSERVÉ AUX TESTS : les objets encore rangés dans le stockage simulé. */
export function objetsSimulesRestants(): string[] {
  return [...objetsSimules].sort();
}
export function viderObjetsSimules(): void {
  objetsSimules.clear();
}

export const stockageSimulation: StockageFichiers = {
  ...base,
  type: "stockage",
  nom: "Stockage des fichiers",
  reelPrevu: "Cloudflare R2",
  capacites: { asynchrone: false, accordExige: false },
  async preparerDepot({ fichierId, nom, mime, typeEntite, entiteId }) {
    const ext = (nom.includes(".") ? nom.split(".").pop() : EXTENSION_PAR_FAMILLE[mime.split("/")[0]]) ?? "bin";
    const env = process.env.NODE_ENV === "production" ? "prod" : "dev";
    const cleStockage = `studio/${env}/${typeEntite}/${entiteId}/${fichierId}.${ext.toLowerCase()}`;
    // Simulation : aucun octet n'est envoyé, il n'y a donc pas d'adresse de dépôt (R2 en donnera une signée).
    return { cleStockage, urlDepot: "" };
  },
  async confirmerDepot() {
    return { ok: true };
  },
  async urlLecture(cleStockage) {
    // V1 : les fichiers de démonstration sont servis depuis public/. Une clé de dépôt simulé
    // (studio/…) est lue comme un média de démonstration du même type ; sinon rien (jamais une image sans rapport).
    if (cleStockage.startsWith("/")) return cleStockage;
    const ext = cleStockage.split(".").pop()?.toLowerCase() ?? "";
    return MEDIA_PAR_EXTENSION[ext] ?? "";
  },
  /** Simulation : aucun octet réel ; n'efface que les objets déposés par les tests (R2 : DELETE signé, `r2/stockage.ts`). */
  async supprimer(cleStockage) {
    objetsSimules.delete(cleStockage);
  },
  async listerPrefixe(prefixe) {
    if (!prefixe.startsWith("studio/") || prefixe.split("/").includes("..")) throw new Error(`Préfixe refusé ${JSON.stringify(prefixe)}`);
    return [...objetsSimules].filter((c) => c.startsWith(prefixe)).sort();
  },
};

/* --- Lot B1 : photos de décor simulées (aucun appel) ----------------- */

/**
 * Photos de décor SANS personne utilisées par l'essai (aucune clé fal.ai) : les trois vraies photos fabriquées au lot B1
 * pour « un bureau en bois avec une bibliothèque » (`docs/captures/b1-decors/`), recopiées sous `public/demo/`.
 * Une demande simulée reçoit ces trois photos, dans l'ordre des ambiances (dorée, jour, soir).
 */
export const PHOTOS_DECOR_SIMULEES = ["/demo/decors/propositions/bureau-doree.jpg", "/demo/decors/propositions/bureau-jour.jpg", "/demo/decors/propositions/bureau-soir.jpg"] as const;

export function photoDecorSimulee(rang: number): { fichierCle: string; mime: string; largeur: number; hauteur: number } {
  return { fichierCle: PHOTOS_DECOR_SIMULEES[Math.abs(rang) % PHOTOS_DECOR_SIMULEES.length], mime: "image/jpeg", largeur: 768, hauteur: 1344 };
}
