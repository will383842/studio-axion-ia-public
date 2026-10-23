/**
 * OPTION « ULTRA RÉALISTE » DE L'OBJET DANS LA MAIN (lot I2) — COUPÉE PAR DÉFAUT, PAYANTE, À LA DEMANDE SEULEMENT.
 *
 * Le rendu 3D local (Three.js) reste la voie normale. Quand Will le demande explicitement ET que l'option est activée,
 * un passage de 3 à 5 s de l'effet déjà rendu peut être envoyé au fournisseur Higgsfield existant (lot E1) :
 * modèle `kling_video_edit` (Kling Omni Edit), avec une IMAGE DE RÉFÉRENCE de l'objet (rendu fixe du téléphone ou du
 * logo), pour que l'objet soit retouché en photo réelle sans toucher au reste (main, visage, lèvres, lumière).
 *
 * Garde-fous : rien ne part si l'option est coupée, si la demande n'est pas explicite, si le passage sort de 3-5 s ou
 * si le solde ne couvre pas le devis ; aucun nouvel essai automatique (une dépense = une demande) ; ne lève jamais ;
 * en cas d'échec, l'effet 3D local est livré tel quel. Par défaut, le DOUBLE DE SIMULATION est utilisé
 * (`fournisseurHiggsfield()` sans `reel`) : aucun appel réel, aucun crédit dépensé.
 */
import type { ObjetMain, PoseObjet } from "@/briques/effets-speciaux";
import { creditsPourPassage, type FournisseurHiggsfield, type MediaAEnvoyer, type ModeleHiggsfield } from "@/fournisseurs/higgsfield";

export const MODELE_ULTRA_REALISTE: ModeleHiggsfield = "kling_video_edit";
export const DUREE_ULTRA_REALISTE = { minSec: 3, maxSec: 5 } as const;

export interface ReglageUltraRealiste {
  /** Interrupteur (coupé par défaut). */
  actif: boolean;
  /** Vrai fournisseur (sinon double de simulation) : jamais réglable depuis l'écran, comme « Décor IA ». */
  reel: boolean;
}

export const REGLAGE_ULTRA_REALISTE_DEFAUT: ReglageUltraRealiste = { actif: false, reel: false };

const NOMS_OBJETS: Record<ObjetMain, string> = {
  telephone: "smartphone",
  "logo-axion": "orange anodized-metal letter A logo standing on a small black stone base",
  cube: "orange cube",
  sphere: "orange sphere with a ring",
  piece: "orange metal coin",
  etoile: "orange star",
  coeur: "orange heart",
};

/** Consigne (anglais, comme les consignes du lot E1) : seul l'objet change, tout le reste est gardé à l'identique. */
export function consigneUltraRealiste(objet: ObjetMain): string {
  const nom = NOMS_OBJETS[objet];
  return [
    `Make the ${nom} resting on the open, palm-up hand look like a real photographed object, exactly like the reference image.`,
    "Keep its position, size, orientation and motion on the palm identical in every frame.",
    "Keep the person, face, lips, hands, fingers, clothes, background, lighting, white balance, camera motion and grain strictly unchanged.",
    "Physically correct contact shadow on the palm and reflections of the real room; no added objects, no text changes.",
  ].join(" ");
}

/**
 * Fenêtre de 3 à 5 s à envoyer : le cœur du passage où l'objet est pleinement visible (temps de l'effet, s).
 * Rend null si l'objet n'est pas visible au moins 3 s.
 */
export function fenetreUltraRealiste(poses: PoseObjet[], fps: number): { debutSec: number; finSec: number; dureeSec: number } | null {
  const visibles = poses.map((p, i) => (p.visible >= 0.95 ? i : -1)).filter((i) => i >= 0);
  if (!visibles.length) return null;
  const a = visibles[0] / fps;
  const b = (visibles[visibles.length - 1] + 1) / fps;
  if (b - a < DUREE_ULTRA_REALISTE.minSec - 1e-6) return null;
  const duree = Math.min(DUREE_ULTRA_REALISTE.maxSec, b - a);
  const milieu = (a + b) / 2;
  const debut = Math.max(a, milieu - duree / 2);
  return { debutSec: +debut.toFixed(3), finSec: +(debut + duree).toFixed(3), dureeSec: +duree.toFixed(3) };
}

export interface DemandeUltraRealiste {
  passageId: string;
  objet: ObjetMain;
  /** La demande vient-elle explicitement de Will (« Monteur, rends le téléphone ultra réaliste ») ? */
  demandeExplicite: boolean;
  /** Extrait (3-5 s) de l'effet déjà rendu, en MP4. */
  video: MediaAEnvoyer;
  dureeSec: number;
  /** Image de référence de l'objet (rendu fixe local, PNG). */
  imageReference: MediaAEnvoyer;
}

export type ResultatUltraRealiste =
  | { ok: true; octets: Uint8Array; credits: number; mode: "reel" | "simulation" }
  | { ok: false; raison: "coupe" | "non-demande" | "duree" | "solde" | "echec"; message: string; credits: number };

/** Attente entre deux suivis (injectée : instantanée dans les essais). */
export type Attendre = (ms: number) => Promise<void>;

/**
 * Envoie un passage à Higgsfield (Kling Omni Edit + image de référence) et rend la vidéo retouchée. Ne lève jamais.
 * `credits` = crédits réellement débités (0 si rien n'est parti) : à enregistrer en dépense par l'appelant.
 */
export async function lancerUltraRealiste(f: FournisseurHiggsfield, d: DemandeUltraRealiste, reglage: ReglageUltraRealiste = REGLAGE_ULTRA_REALISTE_DEFAUT, opts: { attendre?: Attendre; suivisMax?: number } = {}): Promise<ResultatUltraRealiste> {
  if (!reglage.actif) return { ok: false, raison: "coupe", message: "Option « ultra réaliste » coupée : l'effet 3D est livré tel quel.", credits: 0 };
  if (!d.demandeExplicite) return { ok: false, raison: "non-demande", message: "L'option « ultra réaliste » ne part que sur votre demande.", credits: 0 };
  if (d.dureeSec < DUREE_ULTRA_REALISTE.minSec - 1e-6 || d.dureeSec > DUREE_ULTRA_REALISTE.maxSec + 1e-6) {
    return { ok: false, raison: "duree", message: `Passage de ${DUREE_ULTRA_REALISTE.minSec} à ${DUREE_ULTRA_REALISTE.maxSec} s seulement.`, credits: 0 };
  }
  const attendre = opts.attendre ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const echec = (message: string, credits = 0): ResultatUltraRealiste => ({ ok: false, raison: "echec", message, credits });
  try {
    const devis = creditsPourPassage(MODELE_ULTRA_REALISTE, d.dureeSec);
    const solde = await f.lireSolde();
    if (!solde.ok) return echec(solde.erreur.message);
    if (solde.credits < devis) return { ok: false, raison: "solde", message: "Crédits insuffisants pour l'option « ultra réaliste ».", credits: 0 };
    const video = await f.envoyerMedia(d.video);
    if (!video.ok) return echec(video.erreur.message);
    const image = await f.envoyerMedia(d.imageReference);
    if (!image.ok) return echec(image.erreur.message);
    const lance = await f.lancer({
      modele: MODELE_ULTRA_REALISTE,
      videoMediaId: video.mediaId,
      imageReferenceMediaId: image.mediaId,
      consigne: consigneUltraRealiste(d.objet),
      dureeSec: d.dureeSec,
      idempotence: `ultra-realiste:${d.passageId}`,
    });
    if (!lance.ok) return echec(lance.erreur.message);
    const suivisMax = opts.suivisMax ?? 120;
    for (let k = 0; k < suivisMax; k++) {
      const etat = await f.suivre(lance.idTravail);
      if (etat.statut === "termine") {
        const credits = etat.resultat.creditsDebites ?? devis;
        const fichier = await f.telecharger(etat.resultat.url);
        if (!fichier.ok) return echec(fichier.erreur.message, credits);
        return { ok: true, octets: fichier.octets, credits, mode: f.mode };
      }
      if (etat.statut === "echec") return echec(etat.erreur.message, etat.creditsDebites ?? 0);
      await attendre(5000);
    }
    return echec("Retouche « ultra réaliste » trop longue : l'effet 3D est livré tel quel.", devis);
  } catch {
    return echec("Retouche « ultra réaliste » impossible : l'effet 3D est livré tel quel.");
  }
}
