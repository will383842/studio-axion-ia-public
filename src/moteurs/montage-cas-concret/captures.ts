/**
 * CAPTURES DU VRAI SITE DU CAS CONCRET (tâche M6, plan cas concret § 6.2 et règle R19).
 *
 *  - `planCaptures(fiche, cas)` : une demande par écran « étape » dont le visuel est un écran réel. L'adresse et le mouvement
 *    viennent du cas (jamais de la fiche) ; les valeurs de frappe sont les valeurs fictives du cas ; la visite n'est jamais comptée.
 *  - `avancerCaptures(etat, outils)` : soumet chaque demande (une capture déjà déposée n'est pas redemandée), un nouvel essai
 *    au plus quand l'échec est réessayable. Ne lève jamais d'erreur.
 *  - `appliquerCaptures(fiche, etat)` : une capture ratée, refusée, presque uniforme, ou une frappe qui n'a pas tapé, remplace le
 *    visuel par son objet de repli et ajoute une ligne au journal.
 *
 *  - P2S · écran fourni : quand l'écran à filmer est derrière une connexion, Will dépose une image (zones masquées, case
 *    « aucune donnée personnelle visible » cochée). `ecransUtilisables` ne garde que les images attestées ; `planCaptures`
 *    ne demande pas de capture pour ces étapes, `appliquerCaptures` les garde avec l'image masquée. `refusEcransFournis`
 *    est le refus sans appel payant à brancher dans `refusAvantPrix`.
 *
 * Le type des paramètres de l'opération `capture-site` est redéclaré dans `outils.ts` : aucun import de `studio-rendu/`.
 */
import { jsonCanonique } from "@/briques/fiche-scenes";
import { ADRESSE_SITE, type CasConcret } from "@/formats/cas-concret/cas";
import type { EcranCorps, FicheEcrans } from "./fiche";
import type { DemandeCapture, OutilsCaptures, ParametresCaptureSite, ResultatCapture } from "./outils";

export const ESSAIS_CAPTURE_MAX = 2;
/** Code de la mesure `mouvement` rendue par `capture-site` pour une frappe. */
export const MOUVEMENT_FRAPPE = 2;
/** Part de pixels identiques au-delà de laquelle une capture est vide (mesure `uniformite`, quand le rendu la donne). */
export const SEUIL_UNIFORMITE = 0.98;
export const DUREE_CAPTURE_SEC = 6;

type EcranEtape = Extract<EcranCorps, { type: "etape" }>;

const estEtapeReelle = (e: EcranCorps): e is EcranEtape => e.type === "etape" && e.visuel.sorte === "ecran";

/** FNV-1a deux passes + longueur, comme les autres empreintes du format. */
function empreinte(valeur: unknown): string {
  const t = jsonCanonique(valeur);
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x0100019d) >>> 0;
  }
  return `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}-${t.length.toString(36)}`;
}

/** Adresse du site : https, axion-ia.com (ou www), sans identifiants ni port. */
export function adresseDuSite(adresse: string): boolean {
  let u: URL;
  try {
    u = new URL(adresse);
  } catch {
    return false;
  }
  return adresse.startsWith(ADRESSE_SITE) && u.protocol === "https:" && ["axion-ia.com", "www.axion-ia.com"].includes(u.hostname) && !u.port && !u.username && !u.password;
}

type VisuelReel = Extract<CasConcret["etapes"][number]["visuel"], { sorte: "ecran" }>;

function parametresDe(v: VisuelReel): ParametresCaptureSite {
  const commun = { format: "9:16" as const, dureeSec: DUREE_CAPTURE_SEC, sansMesure: true as const };
  switch (v.mouvement) {
    case "image":
      return { ...commun, type: "image", mouvement: "defilement" };
    case "page-entiere":
      return { ...commun, type: "page-entiere", mouvement: "defilement" };
    case "frappe":
      return { ...commun, type: "video", mouvement: "frappe", saisies: (v.saisies ?? []).map((s) => ({ champ: s.champ, texte: s.texte })), ...(v.cocher?.length ? { cocher: [...v.cocher] } : {}), ...(v.survoler ? { survoler: v.survoler } : {}) };
    default:
      return { ...commun, type: "video", mouvement: v.mouvement };
  }
}

const extension = (p: ParametresCaptureSite): "mp4" | "jpg" => (p.type === "video" ? "mp4" : "jpg");
const mimeDe = (p: ParametresCaptureSite): string => (p.type === "video" ? "video/mp4" : "image/jpeg");

/* ------------------------------------------------------------------ */
/* Écran fourni (P2S)                                                    */
/* ------------------------------------------------------------------ */

/** Rectangle masqué, en fractions de l'image (0 à 1) : coin haut gauche, largeur, hauteur. */
export interface ZoneMasquee {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Image déposée par Will pour une étape à écran réel. La clé désigne l'image DÉJÀ masquée : l'original ne quitte pas son navigateur. */
export interface EcranFourni {
  /** Numéro de l'étape du cas (à partir de 1). */
  etapeCas: number;
  cle: string;
  mime: string;
  masques: ZoneMasquee[];
  /** Date de l'attestation « aucune donnée personnelle visible » ; absente : l'image n'est pas utilisée. */
  attesteLe?: string;
}

export const PHRASES_ECRAN_FOURNI = Object.freeze({
  sansAttestation: "Cochez « Je confirme qu'aucune donnée personnelle n'est visible » pour utiliser cette image.",
  etapeInconnue: "Cette image ne correspond à aucune étape à écran réel de ce cas.",
  imageInvalide: "Cette image n'est pas utilisable : déposez une image PNG ou JPEG.",
});

const MIMES_IMAGE = new Set(["image/png", "image/jpeg"]);
const fraction = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;

/** Zones valides, ramenées dans l'image ; une zone vide ou hors de l'image disparaît. */
export function zonesMasqueesValides(brut: unknown): ZoneMasquee[] {
  if (!Array.isArray(brut)) return [];
  const zones: ZoneMasquee[] = [];
  for (const z of brut.slice(0, 20)) {
    if (!z || typeof z !== "object") continue;
    const { x, y, largeur, hauteur } = z as Record<string, unknown>;
    if (!fraction(x) || !fraction(y) || !fraction(largeur) || !fraction(hauteur)) continue;
    const l = Math.min(largeur, 1 - x);
    const h = Math.min(hauteur, 1 - y);
    if (l > 0.001 && h > 0.001) zones.push({ x, y, largeur: l, hauteur: h });
  }
  return zones;
}

/** Lecture tolérante d'une liste d'écrans fournis (réglage stocké) ; ce qui n'est pas lisible est ignoré. */
export function lireEcransFournis(brut: unknown): EcranFourni[] {
  if (!Array.isArray(brut)) return [];
  const res: EcranFourni[] = [];
  for (const b of brut) {
    if (!b || typeof b !== "object") continue;
    const { etapeCas, cle, mime, masques, attesteLe } = b as Record<string, unknown>;
    if (typeof etapeCas !== "number" || !Number.isInteger(etapeCas) || etapeCas < 1 || typeof cle !== "string" || !cle.trim() || typeof mime !== "string" || !MIMES_IMAGE.has(mime)) continue;
    if (res.some((r) => r.etapeCas === etapeCas)) continue;
    res.push({ etapeCas, cle, mime, masques: zonesMasqueesValides(masques), ...(typeof attesteLe === "string" && attesteLe.trim() ? { attesteLe } : {}) });
  }
  return res;
}

/** Les images que la fabrication a le droit d'utiliser : attestées, sur une étape à écran réel du cas. */
export function ecransUtilisables(fournis: readonly EcranFourni[] | undefined, cas: Pick<CasConcret, "etapes">): EcranFourni[] {
  return (fournis ?? []).filter((f) => !!f.attesteLe && !!cas.etapes[f.etapeCas - 1] && cas.etapes[f.etapeCas - 1].visuel.sorte === "ecran");
}

/**
 * Refus SANS appel payant (à brancher dans `refusAvantPrix`, même phrase à l'écran et au lancement) : une image déposée
 * sans l'attestation, ou pour une étape qui n'est pas un écran réel. `null` : rien ne s'y oppose.
 */
export function refusEcransFournis(fournis: readonly EcranFourni[] | undefined, cas: Pick<CasConcret, "etapes">): string | null {
  for (const f of fournis ?? []) {
    if (!f.attesteLe) return PHRASES_ECRAN_FOURNI.sansAttestation;
    if (!MIMES_IMAGE.has(f.mime)) return PHRASES_ECRAN_FOURNI.imageInvalide;
    if (!cas.etapes[f.etapeCas - 1] || cas.etapes[f.etapeCas - 1].visuel.sorte !== "ecran") return PHRASES_ECRAN_FOURNI.etapeInconnue;
  }
  return null;
}

/** Demandes de capture de la fiche : `id` = identifiant de l'écran, `cle` = empreinte de la page et des paramètres. */
export function planCaptures(fiche: Pick<FicheEcrans, "ecrans">, cas: Pick<CasConcret, "etapes">, fournis?: readonly EcranFourni[]): DemandeCapture[] {
  const demandes: DemandeCapture[] = [];
  const deposees = new Set(ecransUtilisables(fournis, cas).map((f) => f.etapeCas));
  for (const ecran of fiche.ecrans) {
    if (!estEtapeReelle(ecran) || ecran.visuel.sorte !== "ecran") continue;
    if (deposees.has(ecran.visuel.etapeCas)) continue;
    const etape = cas.etapes[ecran.visuel.etapeCas - 1];
    if (!etape || etape.visuel.sorte !== "ecran" || !adresseDuSite(etape.visuel.adresse)) continue;
    const parametres = parametresDe(etape.visuel);
    demandes.push({ id: ecran.id, page: etape.visuel.adresse, parametres, cle: `captures-cas-concret/${empreinte({ page: etape.visuel.adresse, parametres })}.${extension(parametres)}` });
  }
  return demandes;
}

/* ------------------------------------------------------------------ */
/* Exécution                                                             */
/* ------------------------------------------------------------------ */

export interface EtatCaptures {
  demandes: DemandeCapture[];
  /** Résultat de chaque demande terminée, par identifiant de demande. */
  resultats: Record<string, ResultatCapture>;
  /** Nombre d'essais déjà faits, par identifiant de demande. */
  essais: Record<string, number>;
  termine: boolean;
}

export function etatInitialCaptures(demandes: readonly DemandeCapture[]): EtatCaptures {
  return { demandes: [...demandes], resultats: {}, essais: {}, termine: false };
}

async function tenter(outils: OutilsCaptures, d: DemandeCapture): Promise<ResultatCapture> {
  try {
    return await outils.capturer(d);
  } catch {
    return { ok: false, raison: "le rendu n'a pas répondu", reessayable: true };
  }
}

/** Soumet les demandes restantes. Une capture déjà déposée n'est pas redemandée ; un échec réessayable est retenté une fois. */
export async function avancerCaptures(etat: EtatCaptures, outils: OutilsCaptures): Promise<EtatCaptures> {
  const resultats = { ...etat.resultats };
  const essais = { ...etat.essais };
  const faites = new Map<string, ResultatCapture>();
  for (const d of etat.demandes) {
    if (resultats[d.id]) continue;
    const memeCle = faites.get(d.cle);
    if (memeCle) {
      resultats[d.id] = memeCle;
      continue;
    }
    let deposee = false;
    try {
      deposee = await outils.existe(d.cle);
    } catch {
      deposee = false;
    }
    if (deposee) {
      resultats[d.id] = { ok: true, cle: d.cle, mime: mimeDe(d.parametres), mesures: {} };
    } else {
      let r: ResultatCapture = { ok: false, raison: "aucun essai", reessayable: true };
      while ((essais[d.id] ?? 0) < ESSAIS_CAPTURE_MAX) {
        essais[d.id] = (essais[d.id] ?? 0) + 1;
        r = await tenter(outils, d);
        if (r.ok || !r.reessayable) break;
      }
      resultats[d.id] = r;
    }
    faites.set(d.cle, resultats[d.id]);
  }
  return { ...etat, resultats, essais, termine: etat.demandes.every((d) => resultats[d.id]) };
}

/* ------------------------------------------------------------------ */
/* Application à la fiche                                                */
/* ------------------------------------------------------------------ */

export interface CaptureRetenue {
  cle: string;
  mime: string;
}

export interface FicheAvecCaptures {
  fiche: FicheEcrans;
  /** Captures gardées, par identifiant d'écran. */
  captures: Record<string, CaptureRetenue>;
  /** Une ligne par écran réel remplacé. */
  journal: string[];
}

/** Pourquoi une capture n'est pas utilisable (phrase courte, sans identifiant technique), ou `null` si elle l'est. */
export function raisonDeRepli(d: DemandeCapture, r: ResultatCapture | undefined): string | null {
  if (!r) return "la capture n'a pas été faite";
  if (!r.ok) return r.reessayable ? "la capture a échoué" : "la capture a été refusée";
  if (d.parametres.mouvement === "frappe" && r.mesures.mouvement !== undefined && r.mesures.mouvement !== MOUVEMENT_FRAPPE) return "la saisie n'a pas été filmée";
  if ((r.mesures.uniformite ?? 0) >= SEUIL_UNIFORMITE) return "la capture est vide";
  return null;
}

/** Remplace par son objet de repli le visuel de chaque écran réel dont la capture est inutilisable. Ne lève jamais d'erreur. */
export function appliquerCaptures(fiche: FicheEcrans, etat: Pick<EtatCaptures, "demandes" | "resultats">, fournis?: readonly EcranFourni[], cas?: Pick<CasConcret, "etapes">): FicheAvecCaptures {
  const captures: Record<string, CaptureRetenue> = {};
  const journal: string[] = [];
  const deposees = cas ? ecransUtilisables(fournis, cas) : [];
  const ecrans = fiche.ecrans.map((e): EcranCorps => {
    if (!estEtapeReelle(e) || e.visuel.sorte !== "ecran") return e;
    // L'image masquée de Will remplace la capture de l'étape ; aucune visite du site n'est faite.
    const fourni = deposees.find((f) => f.etapeCas === (e.visuel as { etapeCas: number }).etapeCas);
    if (fourni) {
      captures[e.id] = { cle: fourni.cle, mime: fourni.mime };
      return e;
    }
    const demande = etat.demandes.find((d) => d.id === e.id);
    const resultat = etat.resultats[e.id];
    const raison = demande ? raisonDeRepli(demande, resultat) : "aucune capture n'a été demandée pour cette étape";
    if (raison === null && resultat?.ok) {
      captures[e.id] = { cle: resultat.cle, mime: resultat.mime };
      return e;
    }
    journal.push(`Écran réel remplacé par un dessin : ${raison} (étape ${e.numero}).`);
    return { ...e, visuel: { sorte: "objet", objet: e.visuel.repli } };
  });
  return { fiche: { ...fiche, ecrans: ecrans as FicheEcrans["ecrans"] }, captures, journal };
}
