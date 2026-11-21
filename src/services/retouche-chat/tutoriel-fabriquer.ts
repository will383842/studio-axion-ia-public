/**
 * « FABRIQUER CETTE VERSION » DU TUTORIEL DEPUIS LE CHAT DE RETOUCHE (T-EXT-46b) — SENSIBLE ARGENT.
 * Le plan retouché (« plan-pret ») part au moteur du tutoriel par `lancerRetouche` (réservation comme un lancement,
 * garde du double envoi) avec l'opération `planScenes` (si le plan change) et l'opération `reglagesFilm` (si les réglages du film changent). Le moteur reprend la voix et le script de la version
 * d'avant : rien n'est réécrit, Claude n'est pas rappelé.
 * TOUS LES REFUS TOMBENT AVANT `lancerRetouche`, donc avant toute réservation :
 *  - réglage `retoucheChat.tutorielOutil` pas exactement `true` (absent, autre valeur, lecture en échec) ;
 *  - vidéo ou version choisie introuvable ; générateur autre que le tutoriel ; vidéo programmée ou publiée (N-22) ;
 *  - version d'avant sans plan, ou sans voix à reprendre (elle serait refaite) ;
 *  - plan reçu illisible ; mots ou format différents de la version choisie (le moteur garderait en silence le plan
 *    d'avant : on le dit au lieu de lancer un rendu identique) ; plan identique à la version choisie.
 * Aucun montant dans les phrases. Tout arrive par dépendance injectée (doubles dans les tests) ; `fabrication.ts`
 * n'est qu'appelé.
 */
import "server-only";
import { jsonCanonique } from "@/briques/plan-scenes/empreinte";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { OperationMontage } from "@/moteurs/types";
import { depots } from "../_commun";
import type { IdGenerateurRetouche } from "./generateurs";
import { retoucheChatActifServeur } from "./generateurs-studio";
import { etapeIdsDuFilm, lireReglagesFilm, operationsDeFabrication } from "./tutoriel-retouche-film";

const GENERATEUR: IdGenerateurRetouche = "tutoriel-outil";

/** Ce que le service lit de la vidéo et de sa version choisie. `plan` est le plan BRUT que le moteur comparera. */
export interface VersionTutorielLue {
  versionId: string;
  formatId?: string;
  etapeEditoriale?: string;
  plan: unknown;
  /** La version d'avant porte une voix à reprendre (sinon la retouche la referait). */
  voixGardee: boolean;
  /** Étapes du film de la version choisie (`etapeIdsDuFilm`) : les réglages du film sont relus sur elles. */
  etapeIds?: readonly string[];
  /** Réglages du film de la version choisie (brut), pour ne lancer que ce qui change. */
  reglagesAvant?: unknown;
}

export interface DepsFabriquerTutoriel {
  lancerRetouche: (videoId: string, planIds: string[], consigne: string, options: { operations: OperationMontage[] }) => Promise<{ travailId: string }>;
  lireVersionChoisie: (videoId: string) => Promise<VersionTutorielLue | null>;
  /** Seul `true` exact allume. */
  retoucheChatActif: () => Promise<boolean>;
}

export type MotifRefusFabriquer = "reglage" | "introuvable" | "generateur" | "diffusion" | "sans-plan" | "voix" | "demande" | "plan-illisible" | "reglages" | "mots" | "format" | "identique" | "echec";

export type IssueFabriquer = { statut: "lancee"; travailId: string } | { statut: "refusee"; motif: MotifRefusFabriquer; raison: string };

/** Phrases de refus : vouvoiement, aucun montant, aucun chiffre. */
export const RAISONS_REFUS_FABRIQUER: Record<MotifRefusFabriquer, string> = {
  reglage: "La retouche par chat n'est pas activée pour ce générateur.",
  introuvable: "Cette vidéo n'a pas de version à retoucher.",
  generateur: "Cette vidéo n'est pas un tutoriel : sa nouvelle version ne se fabrique pas ici.",
  diffusion: "Cette vidéo est programmée ou publiée : elle ne se retouche pas ici.",
  "sans-plan": "La version choisie n'a pas de plan à retoucher : rien n'est lancé.",
  voix: "La voix de la version choisie ne peut pas être reprise : rien n'est lancé.",
  demande: "Écrivez d'abord ce que vous voulez changer.",
  "plan-illisible": "Le plan retouché est illisible : rien n'est lancé. Refaites votre demande.",
  reglages: "Les réglages du film sont illisibles : rien n'est lancé. Refaites votre demande.",
  mots: "Le texte lu de ce plan n'est pas celui de la version choisie : rien n'est lancé. Refaites votre demande sur la version choisie.",
  format: "Le format de ce plan n'est pas celui de la version choisie : rien n'est lancé. Refaites votre demande sur la version choisie.",
  identique: "Ce plan est le même que celui de la version choisie : il n'y a rien à fabriquer.",
  echec: "La nouvelle version n'a pas pu partir. Réessayez dans un instant.",
};

const refus = (motif: MotifRefusFabriquer): IssueFabriquer => ({ statut: "refusee", motif, raison: RAISONS_REFUS_FABRIQUER[motif] });

const TAILLE_MAX_PLAN = 600_000;
const TAILLE_MAX_CONSIGNE = 500;

type PlanBrut = { mots?: unknown; format?: unknown; dureeMs?: unknown; scenes: unknown[] };
const estPlanBrut = (p: unknown): p is PlanBrut => !!p && typeof p === "object" && !Array.isArray(p) && Array.isArray((p as { scenes?: unknown }).scenes) && (p as PlanBrut).scenes.length > 0;

/** Le plan tel que le moteur le retiendra (mots et format de la version d'avant, sans face caméra) ; `null` s'il est illisible. */
function planRetenu(plan: unknown, avant: PlanBrut) {
  try {
    const contexte = { mots: avant.mots, format: avant.format, facecam: false, dureeMs: avant.dureeMs } as Parameters<typeof validerPlan>[1];
    const r = validerPlan(plan, contexte);
    return r.remarques.some((x) => x.code === "PLAN_ILLISIBLE") ? null : r.plan;
  } catch {
    return null;
  }
}

/** Scènes sans leur empreinte ni leur version (recalculées à chaque validation). */
const scenesNues = (scenes: readonly unknown[]): string => jsonCanonique(scenes.map((s) => (s && typeof s === "object" ? { ...(s as Record<string, unknown>), empreinte: undefined, version: undefined } : s)));

export async function fabriquerVersionTutoriel(videoId: string, plan: unknown, demande: string, dep: DepsFabriquerTutoriel = depsFabriquerStudio(), reglagesFilm?: unknown): Promise<IssueFabriquer> {
  // 1. Réglage : éteint tant que la valeur n'est pas `true` exactement ; rien d'autre n'est lu avant.
  let actif: unknown = false;
  try {
    actif = await dep.retoucheChatActif();
  } catch {
    actif = false;
  }
  if (actif !== true) return refus("reglage");

  // 2. La vidéo et sa version choisie.
  let lue: VersionTutorielLue | null = null;
  try {
    lue = await dep.lireVersionChoisie(videoId);
  } catch {
    lue = null;
  }
  if (!lue) return refus("introuvable");
  if (lue.formatId !== GENERATEUR) return refus("generateur");
  if (lue.etapeEditoriale === "programmee" || lue.etapeEditoriale === "publiee") return refus("diffusion");
  const avant = lue.plan;
  if (!estPlanBrut(avant)) return refus("sans-plan");
  if (lue.voixGardee !== true) return refus("voix");

  // 3. La demande et le plan reçus du navigateur.
  const consigne = typeof demande === "string" ? demande.replace(/\s+/g, " ").trim().slice(0, TAILLE_MAX_CONSIGNE) : "";
  if (!consigne) return refus("demande");
  if (!estPlanBrut(plan)) return refus("plan-illisible");
  let taille = Infinity;
  try {
    taille = JSON.stringify(plan).length;
  } catch {
    taille = Infinity;
  }
  if (taille > TAILLE_MAX_PLAN) return refus("plan-illisible");
  // Mêmes comparaisons que le moteur (`planRetouche`) : sinon il garderait le plan d'avant sans le dire.
  if (plan.mots !== undefined && jsonCanonique(plan.mots) !== jsonCanonique(avant.mots)) return refus("mots");
  if (plan.format !== undefined && jsonCanonique(plan.format) !== jsonCanonique(avant.format)) return refus("format");
  const retenu = planRetenu(plan, avant);
  if (!retenu) return refus("plan-illisible");
  const dAvant = planRetenu(avant, avant);
  if (!dAvant) return refus("sans-plan");
  const planIdentique = scenesNues(retenu.scenes) === scenesNues(dAvant.scenes) && jsonCanonique(retenu.habillage) === jsonCanonique(dAvant.habillage);

  // Les réglages du film demandés : relus sur les étapes du film de la version choisie ; illisibles → refus AVANT le lancement.
  const etapeIds = lue.etapeIds ?? [];
  let operationsFilm: OperationMontage[] = [];
  if (reglagesFilm !== undefined && reglagesFilm !== null) {
    const recu = lireReglagesFilm(reglagesFilm, etapeIds);
    if (!recu) return refus("reglages");
    const avantFilm = (lue.reglagesAvant === undefined || lue.reglagesAvant === null ? null : lireReglagesFilm(lue.reglagesAvant, etapeIds)) ?? { parEtape: {} };
    if (jsonCanonique(recu) !== jsonCanonique(avantFilm)) operationsFilm = operationsDeFabrication(recu, etapeIds);
  }
  if (planIdentique && !operationsFilm.length) return refus("identique");

  // 4. Lancement : la réservation et la garde du double envoi sont celles de `lancerRetouche`.
  try {
    const r = await dep.lancerRetouche(videoId, [], consigne, { operations: [...(planIdentique ? [] : [{ type: "planScenes" as const, plan }]), ...operationsFilm] });
    if (!r || typeof r.travailId !== "string" || !r.travailId) return refus("echec");
    return { statut: "lancee", travailId: r.travailId };
  } catch {
    // Le message d'origine peut porter un montant : il n'est jamais renvoyé à l'écran.
    return refus("echec");
  }
}

/** Dépendances du studio. La version choisie est lue telle que le moteur la reprendra (`projetMontage.tutoriel`). */
export function depsFabriquerStudio(): DepsFabriquerTutoriel {
  return {
    lancerRetouche: (videoId, planIds, consigne, options) => import("../fabrication").then((f) => f.lancerRetouche(videoId, planIds, consigne, options)),
    retoucheChatActif: () => retoucheChatActifServeur(GENERATEUR),
    lireVersionChoisie: async (videoId) => {
      const d = depots();
      const video = await d.videos.obtenir(videoId);
      const version = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
      if (!video || !version || version.videoId !== videoId) return null;
      const tutoriel = (version.projetMontage as { tutoriel?: { plan?: { plan?: unknown }; audio?: unknown; reglagesFilm?: unknown } } | undefined)?.tutoriel;
      return {
        versionId: version.id,
        formatId: version.commande?.formatId,
        ...(video.etapeEditoriale ? { etapeEditoriale: video.etapeEditoriale } : {}),
        plan: tutoriel?.plan?.plan ?? null,
        voixGardee: !!tutoriel?.audio && typeof tutoriel.audio === "object",
        etapeIds: etapeIdsDuFilm(version.commande?.entrees),
        reglagesAvant: tutoriel?.reglagesFilm,
      };
    },
  };
}

export type Fabricant = (videoId: string, plan: unknown, demande: string, reglagesFilm?: unknown) => Promise<IssueFabriquer>;

/**
 * TABLE FERMÉE des générateurs qui savent fabriquer une version depuis le chat : le tutoriel SEUL. Les autres
 * générateurs ne sont pas branchés par ce chantier (décision du fondateur, après le gel du couloir vidéo).
 */
export const FABRIQUER_PAR_GENERATEUR: Readonly<Partial<Record<IdGenerateurRetouche, Fabricant>>> = Object.freeze({
  "tutoriel-outil": (videoId: string, plan: unknown, demande: string, reglagesFilm?: unknown) => fabriquerVersionTutoriel(videoId, plan, demande, undefined, reglagesFilm),
});

/** Statut HTTP de chaque refus, pour la route commune. */
export const STATUT_REFUS_FABRIQUER: Record<MotifRefusFabriquer, number> = {
  reglage: 403,
  introuvable: 404,
  generateur: 409,
  diffusion: 409,
  "sans-plan": 409,
  voix: 409,
  demande: 400,
  "plan-illisible": 400,
  reglages: 400,
  mots: 409,
  format: 409,
  identique: 409,
  echec: 503,
};
