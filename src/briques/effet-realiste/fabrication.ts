/**
 * EFFET RÉALISTE PAR IA — FABRICATION D'UN PASSAGE (lot K). Tout ce qui touche au monde extérieur est INJECTÉ
 * (fournisseur Higgsfield déjà GARDÉ par la confirmation, extraction, dépôt, mesures) : testable sans réseau.
 *
 * Déroulé (un effet = un passage de 3 à 8 s, découpé à 15 s au plus par sécurité) :
 *  1. contrôle avant tout envoi (durée, consigne, modèle : Kling Omni Edit si une image de référence existe, sinon
 *     FLUX 3 Video Edit) — aucune dépense sur une demande invalide ;
 *  2. extraction de l'IMAGE SEULE du passage (passe image, fenêtre 9:16 ; routes studio-aligneur du lot G) ;
 *  3. envoi, lancement, suivi, téléchargement — UN essai (pas de nouvel essai automatique : « Réessayer » redemande
 *     une confirmation) ;
 *  4. dépôt : retour à 25 i/s sans changer la vitesse, couleurs ACCORDÉES au passage d'origine (le Look Will réappliqué),
 *     fondu de raccord court aux deux bouts ;
 *  5. contrôle du retour : durée, lèvres calées sur la voix d'origine, visage présent et ressemblant, raccords
 *     avant / après (écart de couleur aux bords).
 * Échec à n'importe quelle étape → « Effet non réussi — Réessayer » (repli gratuit posé par l'appelant). Ne lève jamais.
 */
import type { LigneCout } from "@/domaine/types";
import { centimes } from "@/lib/montants";
import { controlerRaccord, conversionVers25ips, SEUILS_RACCORD, type ConversionCadence, type MesuresRaccord, type SeuilsRaccord } from "@/briques/decor/raccord";
import { montantCredits, PRIX_CREDIT_HIGGSFIELD_CENTIMES } from "@/briques/decor/cout";
import { creditsPourPassage, DUREE_MAX_PASSAGE_SEC, type FournisseurHiggsfield, type MediaAEnvoyer, type ModeleHiggsfield } from "@/fournisseurs/higgsfield/types";
import { DUREE_EFFET_MAX_SEC, DUREE_EFFET_MIN_SEC, MESSAGE_EFFET_RATE, type EffetRealistePrepare, type RaisonEffetRate, type ResultatEffetRealiste } from "./types";

/** Fondu de raccord aux deux bouts du passage (s) : court, invisible, cache un léger écart de lumière. */
export const FONDU_RACCORD_SEC = 0.2;
/** Écart de couleur toléré au raccord avant / après, une fois les couleurs accordées (ΔE 2000 moyen). */
export const ECART_COULEUR_RACCORD_MAX = 6;
export const ETAPE_EFFET_REALISTE = "Effet réaliste par IA";

/** Modèle d'après l'image de référence : Kling Omni Edit avec elle, FLUX 3 Video Edit sans. */
export function modeleEffet(avecImageReference: boolean): ModeleHiggsfield {
  return avecImageReference ? "kling_video_edit" : "flux_3_video_edit";
}

/** Passages envoyés (≤ 15 s chacun). Un effet de 3 à 8 s n'en fait qu'un ; la règle reste écrite une fois. */
export function decouperEffet(debutSec: number, finSec: number, modele: ModeleHiggsfield): { debutSec: number; finSec: number }[] {
  const max = DUREE_MAX_PASSAGE_SEC[modele];
  const n = Math.max(1, Math.ceil((finSec - debutSec) / max - 1e-9));
  const pas = (finSec - debutSec) / n;
  return Array.from({ length: n }, (_, i) => ({ debutSec: +(debutSec + i * pas).toFixed(3), finSec: +(debutSec + (i + 1) * pas).toFixed(3) }));
}

/** Crédits annoncés (devis de la carte de confirmation). */
export function creditsEffet(e: Pick<EffetRealistePrepare, "debutPriseSec" | "finPriseSec" | "modele">): number {
  return decouperEffet(e.debutPriseSec, e.finPriseSec, e.modele).reduce((t, p) => t + creditsPourPassage(e.modele, p.finSec - p.debutSec), 0);
}

export function ligneEffet(credits: number, simule: boolean): LigneCout {
  return { etape: ETAPE_EFFET_REALISTE, fournisseur: simule ? "simulation" : "higgsfield", unite: "seconde", quantite: credits, prixUnitaire: centimes(PRIX_CREDIT_HIGGSFIELD_CENTIMES), total: montantCredits(credits), nature: "reel" };
}

/** Mesures du retour : celles du Décor IA + l'écart de couleur aux deux raccords. */
export interface MesuresEffet extends MesuresRaccord {
  /** ΔE moyen entre la dernière image d'avant et la première du passage reposé ; absent : non mesuré. */
  ecartRaccordAvant?: number;
  ecartRaccordApres?: number;
}

export interface ReglagesDepot {
  conversion: ConversionCadence;
  /** Fondu de raccord avec l'image d'origine, aux deux bouts. */
  fonduSec: number;
  /** Couleurs accordées sur le passage d'origine (Look Will réappliqué). */
  accorderCouleurs: true;
}

export interface DependancesEffet {
  /** Fournisseur Higgsfield GARDÉ (réel : la confirmation est consommée au lancement) ou double de simulation. */
  higgsfield: FournisseurHiggsfield;
  extrairePassage(p: { index: number; debutSec: number; finSec: number }): Promise<Uint8Array | null>;
  deposerPassage(p: { index: number; debutSec: number; finSec: number }, octets: Uint8Array, reglages: ReglagesDepot): Promise<string | null>;
  mesurer(p: { index: number; debutSec: number; finSec: number }, fichierCle: string): Promise<MesuresEffet | null>;
  imageReference?: () => Promise<MediaAEnvoyer | null>;
  attendre?(ms: number): Promise<void>;
  suivisMax?: number;
  intervalleSuiviMs?: number;
}

export interface VerdictEffet {
  ok: boolean;
  raison?: RaisonEffetRate;
}

/** Contrôle du retour (durée, lèvres, visage, raccords). */
export function controlerRetourEffet(e: { dureeSourceSec: number; dureeSortieSec: number; mesures: MesuresEffet | null }, seuils: SeuilsRaccord = SEUILS_RACCORD): VerdictEffet {
  const v = controlerRaccord({ dureeSourceSec: e.dureeSourceSec, dureeSortieSec: e.dureeSortieSec, mesures: e.mesures }, seuils);
  if (!v.ok) {
    const r = v.raisons[0];
    return { ok: false, raison: r === "duree" ? "duree" : r === "levres" ? "levres" : r === "mesure-impossible" ? "raccord" : "visage" };
  }
  const m = e.mesures!;
  if ([m.ecartRaccordAvant, m.ecartRaccordApres].some((x) => typeof x === "number" && x > ECART_COULEUR_RACCORD_MAX)) return { ok: false, raison: "raccord" };
  return { ok: true };
}

const attendreParDefaut = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface ResultatFabrication {
  resultat: ResultatEffetRealiste;
  lignes: LigneCout[];
  /** Ce qui est réellement parti chez Higgsfield (journal). */
  consigneEnvoyee?: string;
}

export async function fabriquerEffetRealiste(e: EffetRealistePrepare, d: DependancesEffet): Promise<ResultatFabrication> {
  let creditsDebites = 0;
  const simule = d.higgsfield.mode === "simulation";
  const rate = (statut: "rate" | "non-lance", raison: RaisonEffetRate): ResultatFabrication => ({
    resultat: { id: e.id, statut, raison, creditsDebites, message: MESSAGE_EFFET_RATE },
    lignes: creditsDebites > 0 ? [ligneEffet(creditsDebites, simule)] : [],
  });
  const duree = e.finPriseSec - e.debutPriseSec;
  // 1. Rien ne part sur une demande invalide.
  if (!(duree >= DUREE_EFFET_MIN_SEC - 0.05 && duree <= DUREE_EFFET_MAX_SEC + 0.05)) return rate("non-lance", "duree");
  if (!e.consigneVideo.trim()) return rate("non-lance", "consigne-vide");

  try {
    let image: MediaAEnvoyer | null = null;
    if (e.modele === "kling_video_edit") image = (await d.imageReference?.()) ?? null;
    // Kling sans image de référence lisible : FLUX (moins cher que le devis : jamais de dépassement).
    const modele: ModeleHiggsfield = e.modele === "kling_video_edit" && !image ? "flux_3_video_edit" : e.modele;
    let imageReferenceMediaId: string | undefined;
    if (image) {
      const envoi = await d.higgsfield.envoyerMedia(image);
      if (!envoi.ok) return rate("non-lance", "envoi");
      imageReferenceMediaId = envoi.mediaId;
    }
    const attendre = d.attendre ?? attendreParDefaut;
    const morceaux: string[] = [];
    const passages = decouperEffet(e.debutPriseSec, e.finPriseSec, modele);
    for (const [index, p] of passages.entries()) {
      // 2. Extraction.
      const octets = await d.extrairePassage({ index, ...p });
      if (!octets) return rate(creditsDebites ? "rate" : "non-lance", "extraction");
      const envoi = await d.higgsfield.envoyerMedia({ nom: `${e.id}-${index}.mp4`, type: "video/mp4", octets });
      if (!envoi.ok) return rate(creditsDebites ? "rate" : "non-lance", "envoi");
      // 3. Un seul essai (la garde consomme la confirmation au premier lancement).
      const dureeP = +(p.finSec - p.debutSec).toFixed(3);
      const lance = await d.higgsfield.lancer({ modele, videoMediaId: envoi.mediaId, consigne: e.consigneVideo, ...(imageReferenceMediaId ? { imageReferenceMediaId } : {}), dureeSec: dureeP, idempotence: `${e.id}-effet-${index}` });
      if (!lance.ok) return rate(creditsDebites ? "rate" : "non-lance", lance.erreur.code === "refuse" && /confirm/i.test(lance.erreur.message) ? "non-confirme" : lance.erreur.code === "refuse" ? "refus" : "panne");
      let fini: { url: string; dureeSec: number } | null = null;
      for (let i = 0; i < (d.suivisMax ?? 180) && !fini; i++) {
        const etat = await d.higgsfield.suivre(lance.idTravail);
        if (etat.statut === "termine") {
          creditsDebites += etat.resultat.creditsDebites ?? creditsPourPassage(modele, dureeP);
          fini = { url: etat.resultat.url, dureeSec: etat.resultat.dureeSec };
        } else if (etat.statut === "echec") {
          creditsDebites += etat.creditsDebites ?? 0;
          return rate("rate", etat.erreur.code === "refuse" ? "refus" : "panne");
        } else await attendre(d.intervalleSuiviMs ?? 5000);
      }
      if (!fini) return rate("rate", "panne");
      const telecharge = await d.higgsfield.telecharger(fini.url);
      // 4. Dépôt : 25 i/s, couleurs accordées, fondu de raccord.
      const reglages: ReglagesDepot = { conversion: conversionVers25ips(dureeP), fonduSec: FONDU_RACCORD_SEC, accorderCouleurs: true };
      const cle = telecharge.ok ? await d.deposerPassage({ index, ...p }, telecharge.octets, reglages) : null;
      if (!cle) return rate("rate", "depot");
      // 5. Contrôle du retour.
      const verdict = controlerRetourEffet({ dureeSourceSec: dureeP, dureeSortieSec: fini.dureeSec, mesures: await d.mesurer({ index, ...p }, cle) });
      if (!verdict.ok) return rate("rate", verdict.raison ?? "raccord");
      morceaux.push(cle);
    }
    // 3 à 8 s : toujours UN passage (≤ 15 s), donc un morceau.
    return {
      resultat: { id: e.id, statut: "reussi", morceau: { id: e.id, source: "effet", debutSec: e.debutPriseSec, finSec: e.finPriseSec, fichierCle: morceaux[0], fonduSec: FONDU_RACCORD_SEC }, creditsDebites, message: "Effet réaliste ajouté." },
      lignes: creditsDebites > 0 ? [ligneEffet(creditsDebites, simule)] : [],
      consigneEnvoyee: e.consigneVideo,
    };
  } catch {
    return rate(creditsDebites ? "rate" : "non-lance", "panne");
  }
}
