/**
 * FABRICATION PAYANTE DES ILLUSTRATIONS, AU MOTEUR (plan du moteur avocat B.6 étape 2, lot A2 = M5).
 *
 * Seuls les plans que la cascade de l'Aperçu a laissés « à fabriquer » (`illustration.source === "generee-ia"`,
 * sans élément) sont fabriqués : une image (Nano Banana) puis un clip de 5 s animé à partir d'elle (Seedance),
 * jamais de personne, de logo ni d'uniforme, jamais de zoom lent sur une image fixe. Le nombre fabriqué ne dépasse
 * JAMAIS celui de l'estimation montrée à Will. Mode « économique » : rien n'est fabriqué.
 *
 * Par étapes, sans attente longue : l'état de chaque plan est gardé dans `Travail.parametres.illustrations`
 * (demande en cours chez fal.ai comprise) ; un redémarrage reprend la même demande, rien n'est repayé.
 * Un plan qui échoue revient au double (alerte), il ne fait jamais échouer la vidéo.
 * Le résultat devient un élément de la Bibliothèque (`elementsCrees`, `origine: fabriquee`, licence, pastille « IA »).
 */
import { motsSignificatifs, prixFabricationUsd, requeteDuPlan, requeteFabrication, CONSIGNE_CLIP, motsAnglais, TARIFS_FABRICATION_USD } from "@/domaine/illustrations";
import type { CommandeFabrication, LigneCout, MediaCommande, PlanCommande, Ratio } from "@/domaine/types";
import type { FournisseurIllustration } from "@/fournisseurs/types";
import type { EtatFabrication, FournisseurIllustrationEtendu } from "@/fournisseurs/illustration/types";
import { centimes, TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import type { ElementCree, PlanProduit } from "../types";

/** Préfixe de l'identifiant provisoire d'une illustration fabriquée (remplacé par l'élément créé, `travaux.ts`). */
export const PREFIXE_FABRIQUEE = "fab-";

interface Fait {
  fichierCle: string;
  urlSource: string;
  coutCentimes: number;
  coutUsdCentimes: number;
  modele: string;
}

export type EtatPlanIllustration =
  | { phase: "image"; requete: string; idDemande?: string; essais?: number; pannesSuivi?: number }
  | { phase: "clip"; requete: string; image: Fait; idDemande?: string; essais?: number; pannesSuivi?: number }
  | { phase: "faite"; requete: string; image: Fait; clip: Fait }
  /**
   * `incertaine` (CORRECTEUR 1 — B3) : une soumission partie sans confirmation (coupure, délai, 5xx APRÈS l'envoi) a pu
   * être facturée par fal.ai, qui ne permet pas de la retrouver : jamais resoumise, son prix est compté comme payé.
   */
  | { phase: "abandon"; raison: string; image?: Fait; incertaine?: { coutCentimes: number; coutUsdCentimes: number } };

export interface EtatIllustrations {
  /** Clé : ordre du plan PRODUIT. */
  plans: Record<string, EtatPlanIllustration>;
}

const ESSAIS_MAX = 3;
/**
 * E2E-2 argent n° 8 : une demande DÉJÀ SOUMISE (donc payée) dont le suivi tombe en panne (délai, 5xx) garde son
 * identifiant et son suivi est réessayé, jusqu'à ce nombre de pannes de suivi d'affilée. Seul un échec de la demande
 * elle-même (statut « échec » chez fal.ai) la fait soumettre de nouveau.
 */
const PANNES_SUIVI_MAX = 360;

/** Panne pendant le SUIVI d'une demande déjà soumise (la demande, elle, vit toujours chez le fournisseur). */
class PanneDeSuivi {
  constructor(readonly cause: unknown) {}
}

/** La commande demande-t-elle le mode économique ? */
export const economique = (c: Pick<CommandeFabrication, "entrees">) => c.entrees?.illustrationsEconomique === true;

/** Plans INDICATIFS à fabriquer (estimation) : illustration « à fabriquer », sans élément, brique allumée. */
export function plansAFabriquer(c: Pick<CommandeFabrication, "plans" | "briques" | "entrees">): PlanCommande[] {
  if (!c.briques.illustrations || economique(c)) return [];
  return c.plans.filter((p) => p.sourceImage === "illustration" && p.illustration?.source === "generee-ia" && !p.illustration.elementId && !p.illustration.verrouille);
}

/** Ligne estimée « Illustrations à fabriquer » (tarifs fal.ai en dollars, convertis au taux de la commande). */
export function ligneEstimeeFabrication(c: Pick<CommandeFabrication, "plans" | "briques" | "entrees" | "tauxUsdEur">): LigneCout | null {
  const n = plansAFabriquer(c).length;
  if (!n) return null;
  const prix = centimes(prixFabricationUsd() * (c.tauxUsdEur ?? TAUX_USD_EUR_PAR_DEFAUT));
  return { etape: "Illustrations à fabriquer", fournisseur: "fal.ai", unite: "image", quantite: n, prixUnitaire: prix, total: centimes(prix.centimes * n), nature: "estime" };
}

/** Plans PRODUITS (après découpage) à fabriquer, plafonnés au nombre estimé. */
export function plansProduitsAFabriquer(c: Pick<CommandeFabrication, "plans" | "briques" | "entrees">, plans: PlanProduit[]): PlanProduit[] {
  const plafond = plansAFabriquer(c).length;
  return plans.filter((p) => p.sourceImage === "illustration" && p.illustration?.source === "generee-ia" && !p.illustration.elementId && !p.illustration.verrouille).slice(0, plafond);
}

/** État de départ : une requête SÛRE par plan, ou l'abandon si elle ne montrerait rien de concret. */
export function etatInitial(c: Pick<CommandeFabrication, "plans" | "briques" | "entrees">, plans: PlanProduit[]): EtatIllustrations {
  const etat: EtatIllustrations = { plans: {} };
  for (const p of plansProduitsAFabriquer(c, plans)) {
    const req = requeteDuPlan({ id: String(p.ordre), ordre: p.ordre, texte: p.texte, requete: p.illustration?.requete });
    const sure = requeteFabrication(req.requeteEn);
    etat.plans[String(p.ordre)] = sure ? { phase: "image", requete: sure } : { phase: "abandon", raison: "Aucun objet concret à montrer sans personne : votre double garde ce plan." };
  }
  return etat;
}

export const fini = (e: EtatIllustrations) => Object.values(e.plans).every((p) => p.phase === "faite" || p.phase === "abandon");

/** Fait avancer UN tour : chaque plan d'une phase au plus. Ne lève jamais : un plan en échec est abandonné. */
export async function avancerIllustrations(etat: EtatIllustrations, fournisseur: FournisseurIllustration, ratio: Ratio, idBase: string, tauxUsdEur = TAUX_USD_EUR_PAR_DEFAUT): Promise<EtatIllustrations> {
  const f = fournisseur as FournisseurIllustrationEtendu;
  const suivant: EtatIllustrations = { plans: { ...etat.plans } };
  for (const [ordre, e] of Object.entries(etat.plans)) {
    try {
      suivant.plans[ordre] = await avancerUnPlan(e, f, ratio, `${idBase}-p${ordre}`, tauxUsdEur);
    } catch (brute) {
      // CORRECTEUR 1 — B3 : soumission incertaine (la demande a pu partir) : jamais resoumise à l'aveugle. fal.ai ne
      // permet pas de la retrouver par notre clé : le plan garde le double et son prix est compté comme payé.
      if ((brute as { soumissionIncertaine?: boolean } | null)?.soumissionIncertaine && (e.phase === "image" || e.phase === "clip") && !e.idDemande) {
        const usd = prixSoumissionUsd(e.phase);
        suivant.plans[ordre] = { phase: "abandon", raison: "fal.ai n'a pas confirmé la demande : votre double garde ce plan.", image: e.phase === "clip" ? e.image : undefined, incertaine: { coutUsdCentimes: usd, coutCentimes: Math.round(usd * tauxUsdEur) } };
        continue;
      }
      const suivi = brute instanceof PanneDeSuivi;
      const err = suivi ? brute.cause : brute;
      const message = (err as { erreur?: { message?: string; reessayable?: boolean } }).erreur?.message ?? (err as Error).message;
      const reessayable = (err as { erreur?: { reessayable?: boolean } }).erreur?.reessayable ?? true;
      if (suivi && reessayable && (e.phase === "image" || e.phase === "clip") && e.idDemande) {
        // La demande payée est gardée : seul son suivi est réessayé au tour suivant (jamais une 2e soumission).
        const pannes = (e.pannesSuivi ?? 0) + 1;
        suivant.plans[ordre] = pannes < PANNES_SUIVI_MAX ? { ...e, pannesSuivi: pannes } : { phase: "abandon", raison: message, image: e.phase === "clip" ? e.image : undefined };
        continue;
      }
      const essais = ("essais" in e ? (e.essais ?? 0) : 0) + 1;
      if (e.phase === "image" || e.phase === "clip") {
        suivant.plans[ordre] = reessayable && essais < ESSAIS_MAX ? { ...e, idDemande: undefined, essais } : { phase: "abandon", raison: message, image: e.phase === "clip" ? e.image : undefined };
      }
    }
  }
  return suivant;
}

/** Prix d'UNE soumission chez fal.ai (image, ou clip de 5 s), en centimes de dollar. */
export function prixSoumissionUsd(genre: "image" | "clip"): number {
  return genre === "image" ? TARIFS_FABRICATION_USD.image : TARIFS_FABRICATION_USD.clipParSeconde * 5;
}

/**
 * CORRECTEUR 1 — B3 : ce que cet état a déjà engagé chez fal.ai, en centimes de dollar (fait, soumis en cours de
 * suivi, soumission incertaine), et les identifiants des demandes qu'il garde. Sert au plafond calculé en base.
 */
export function engagementFal(e: EtatIllustrations | undefined): { usdCentimes: number; demandes: string[] } {
  let usd = 0;
  const demandes: string[] = [];
  for (const p of Object.values(e?.plans ?? {})) {
    if ("image" in p && p.image) usd += p.image.coutUsdCentimes;
    if (p.phase === "faite") usd += p.clip.coutUsdCentimes;
    if (p.phase === "abandon" && p.incertaine) usd += p.incertaine.coutUsdCentimes;
    if ((p.phase === "image" || p.phase === "clip") && p.idDemande) {
      usd += prixSoumissionUsd(p.phase);
      demandes.push(p.idDemande);
    }
  }
  return { usdCentimes: usd, demandes };
}

/** Suivi d'une demande soumise : une panne (réseau, délai, 5xx) devient une `PanneDeSuivi` (la demande est gardée). */
async function suivre(fabrication: NonNullable<FournisseurIllustrationEtendu["fabrication"]>, idDemande: string): Promise<EtatFabrication> {
  try {
    return await fabrication.suivre(idDemande);
  } catch (e) {
    throw new PanneDeSuivi(e);
  }
}

function versFait(r: Extract<EtatFabrication, { statut: "fait" }>): Fait {
  return { fichierCle: r.fichierCle, urlSource: r.urlSource, coutCentimes: r.cout.centimes, coutUsdCentimes: r.coutUsdCentimes, modele: r.modele };
}

async function avancerUnPlan(e: EtatPlanIllustration, f: FournisseurIllustrationEtendu, ratio: Ratio, cle: string, taux: number): Promise<EtatPlanIllustration> {
  if (e.phase === "faite" || e.phase === "abandon") return e;
  // Sans fabrication par étapes (simulation) : le contrat bloquant, instantané.
  if (!f.fabrication) {
    if (e.phase === "image") {
      const r = await f.generer({ requete: e.requete, ratio });
      return { phase: "clip", requete: e.requete, image: { fichierCle: r.fichierCle, urlSource: r.fichierCle, coutCentimes: r.cout.centimes, coutUsdCentimes: r.cout.centimes / taux, modele: f.id } };
    }
    const r = await f.animer({ imageCle: e.image.fichierCle, dureeSec: 5 });
    return { phase: "faite", requete: e.requete, image: e.image, clip: { fichierCle: r.fichierCle, urlSource: r.fichierCle, coutCentimes: r.cout.centimes, coutUsdCentimes: r.cout.centimes / taux, modele: f.id } };
  }
  // INTÉGRATION FINALE : la clé d'une soumission est stable d'un tour à l'autre (le fournisseur la retrouve après un
  // redémarrage, rien n'est renvoyé) ; seule une nouvelle tentative après un échec chez fal.ai prend une clé neuve.
  const essai = e.essais ? `-r${e.essais}` : "";
  if (e.phase === "image") {
    if (!e.idDemande) return { ...e, idDemande: (await f.fabrication.soumettre({ genre: "image", requete: e.requete, ratio, cleIdempotence: `${cle}-image${essai}` })).idDemande };
    const r = await suivre(f.fabrication, e.idDemande);
    if (r.statut === "en_cours") return e.pannesSuivi ? { ...e, pannesSuivi: 0 } : e;
    if (r.statut === "echec") throw { erreur: r.erreur };
    return { phase: "clip", requete: e.requete, image: versFait(r) };
  }
  if (!e.idDemande) return { ...e, idDemande: (await f.fabrication.soumettre({ genre: "clip", imageUrl: e.image.urlSource, requete: CONSIGNE_CLIP, dureeSec: 5, ratio, cleIdempotence: `${cle}-clip${essai}` })).idDemande };
  const r = await suivre(f.fabrication, e.idDemande);
  if (r.statut === "en_cours") return e.pannesSuivi ? { ...e, pannesSuivi: 0 } : e;
  if (r.statut === "echec") throw { erreur: r.erreur };
  return { phase: "faite", requete: e.requete, image: e.image, clip: versFait(r) };
}

/** Progression de l'étape (0-100). */
export function progressionIllustrations(e: EtatIllustrations): number {
  const p = Object.values(e.plans);
  if (!p.length) return 100;
  const n = p.reduce((t, x) => t + (x.phase === "faite" || x.phase === "abandon" ? 100 : x.phase === "clip" ? (x.idDemande ? 70 : 50) : x.idDemande ? 20 : 0), 0);
  return Math.round(n / p.length);
}

/** Coût réel déjà engagé (image et clip faits ; une image faite puis abandonnée reste payée). */
export function coutReelCentimes(e: EtatIllustrations): number {
  return Object.values(e.plans).reduce((t, p) => t + ("image" in p && p.image ? p.image.coutCentimes : 0) + (p.phase === "faite" ? p.clip.coutCentimes : 0) + (p.phase === "abandon" && p.incertaine ? p.incertaine.coutCentimes : 0), 0);
}

/** Ligne réelle de la dépense. */
export function ligneReelle(e: EtatIllustrations): LigneCout[] {
  const faites = Object.values(e.plans).filter((p) => p.phase === "faite").length;
  const total = coutReelCentimes(e);
  if (!total) return [];
  return [{ etape: "Illustrations fabriquées", fournisseur: "fal.ai", unite: "image", quantite: Math.max(1, faites), prixUnitaire: centimes(total / Math.max(1, faites)), total: centimes(total), nature: "reel" }];
}

/** Plans et médias de la composition : un plan fabriqué pointe vers son clip (identifiant provisoire `fab-N`). */
export function avecIllustrationsFabriquees(c: CommandeFabrication, plans: PlanProduit[], e: EtatIllustrations | undefined): { commande: CommandeFabrication; plans: PlanProduit[] } {
  if (!e) return { commande: c, plans };
  const medias: Record<string, MediaCommande> = { ...(c.medias ?? {}) };
  const sortie = plans.map((p) => {
    const x = e.plans[String(p.ordre)];
    if (x?.phase !== "faite" || !p.illustration) return p;
    const id = `${PREFIXE_FABRIQUEE}${p.ordre}`;
    medias[id] = { cle: x.clip.fichierCle, mime: "video/mp4", dureeSec: 5 };
    return { ...p, illustration: { ...p.illustration, source: "generee-ia" as const, elementId: id } };
  });
  return { commande: { ...c, medias }, plans: sortie };
}

/** Éléments à créer dans la Bibliothèque : clip (vignette = l'image), licence « créée par l'IA », mots-clés. */
export function elementsCrees(plans: PlanProduit[], e: EtatIllustrations | undefined): ElementCree[] {
  if (!e) return [];
  const sortie: ElementCree[] = [];
  for (const p of plans) {
    const x = e.plans[String(p.ordre)];
    if (x?.phase !== "faite") continue;
    const intention = p.illustration?.requete?.trim() || p.texte;
    const motsCles = motsSignificatifs(intention).slice(0, 12);
    sortie.push({
      type: "illustration-video",
      nom: (intention.charAt(0).toUpperCase() + intention.slice(1)).slice(0, 80),
      motsCles,
      motsClesEn: motsAnglais(motsCles.join(" ")),
      description: intention,
      valeur: { type: "illustration-video" },
      licence: { type: "generee-ia", usageCommercial: true, reseaux: [], source: `fal.ai — ${x.image.modele} puis ${x.clip.modele}` },
      formatsParDefaut: [],
      fabrique: true,
      origine: "fabriquee",
      fichierCle: x.clip.fichierCle,
      vignetteCle: x.image.fichierCle,
      planOrdre: p.ordre,
    });
  }
  return sortie;
}
