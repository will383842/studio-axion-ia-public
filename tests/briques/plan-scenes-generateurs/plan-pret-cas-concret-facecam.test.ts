/**
 * GV-MD-04 — Preuve que le plan de scènes calé au mot est PRÊT pour le cas concret et la face caméra (animée ou non),
 * sans rien allumer : le réglage est simulé à `true` ici seulement, aucune base lue, aucun défaut changé.
 * Niveau 1 (pièces du stock), sans IA : aucun fournisseur n'est passé, donc aucun appel payant possible.
 * Entrées : les phrases de l'essai existant `tests/plan-scenes-generateurs/adaptateur.test.ts`.
 *
 * OÙ LE RÉGLAGE EST LU (relevé dans le code, rien de corrigé ici) :
 *  - cas concret : une fois par exécution de `fabriquerCasConcret` côté service (`montage-cas-concret/index.ts`,
 *    `lirePlanScenes()` avant la fabrication) ; une valeur changée entre deux exécutions (une reprise) peut donc faire
 *    basculer la vidéo, mais pas au milieu d'une exécution ;
 *  - face caméra : à chaque passage dans l'étape d'habillage (`montage-facecam/chaine.ts`, `deps.planScenes()`), donc à
 *    chaque tour qui atteint cette étape ; un plan déjà composé reste gardé dans l'état (mémo) même si le réglage est
 *    éteint ensuite ;
 *  - face caméra animée : à la construction du service (`services/facecam-animee.ts`), donc au lancement de chaque tour
 *    de travail ; le plan est composé une seule fois avant le rendu puis gardé dans l'état.
 */
import { describe, expect, it } from "vitest";
import { planScenesCasConcret } from "@/moteurs/montage-cas-concret/plan-scenes";
import { adapterPlan, type SegmentCale } from "@/briques/plan-scenes-generateurs/adaptateur";
import { planScenesActif } from "@/briques/plan-scenes-generateurs/reglage";
import { tranchePlan } from "@/briques/plan-scenes-generateurs/tranche";
import { planPourVideo, type MotEnSecondes } from "@/briques/plan-scenes-generateurs/video";
import { schemaPlanStrict, schemaSceneStrict, type PlanValide } from "@/briques/plan-scenes/schema";

const SEGMENTS: SegmentCale[] = [
  { texte: "Votre devis part en trois minutes sans aucune relance manuelle.", debutMs: 0, finMs: 3000 },
  { texte: "Le client signe sur son téléphone en 12 secondes.", debutMs: 3000, finMs: 6000 },
  { texte: "Un tableau de bord montre les 42 devis du mois.", debutMs: 6000, finMs: 9500 },
];
const FORMAT = { largeur: 1080, hauteur: 1920, fps: 25 as const };

/**
 * Mots des trois phrases (10, 9 et 10 mots : indices 0 à 28), un mot toutes les 0,3 s, chacun durant 0,25 s.
 * Les phrases finissent par un point : le plan de repli coupe donc aux indices 9 et 18.
 */
const MOTS_SECONDES: MotEnSecondes[] = SEGMENTS.flatMap((s) => s.texte.split(/\s+/)).map((texte, i) => ({ texte, debutSec: i * 0.3, finSec: i * 0.3 + 0.25 }));

/** Preuve commune : plan non vide, chaque scène calée sur un mot existant, dans l'ordre, sans chevauchement, en niveau 1. */
function verifierPlanPret(plan: PlanValide | null, facecam: boolean): PlanValide {
  expect(plan).not.toBeNull();
  const p = plan!;
  expect(schemaPlanStrict.safeParse(p).success).toBe(true);
  expect(p.facecam).toBe(facecam);
  expect(p.mots).toHaveLength(29);
  expect(p.scenes.length).toBeGreaterThan(0);
  let finPrecedente = 0;
  for (const s of p.scenes) {
    expect(schemaSceneStrict.safeParse(s).success).toBe(true);
    // Sans IA : jamais de niveau 2 ni 3.
    expect(s.niveau).toBe(1);
    // Indices de mots existants et dans l'ordre.
    expect(Number.isInteger(s.mots.premier)).toBe(true);
    expect(Number.isInteger(s.mots.dernier)).toBe(true);
    expect(s.mots.premier).toBeGreaterThanOrEqual(0);
    expect(s.mots.dernier).toBeGreaterThanOrEqual(s.mots.premier);
    expect(s.mots.dernier).toBeLessThan(p.mots.length);
    // Calée au mot : le début est celui du premier mot, la fin couvre le dernier.
    expect(s.debutMs).toBe(p.mots[s.mots.premier]!.debutMs);
    expect(s.finMs).toBeGreaterThanOrEqual(p.mots[s.mots.dernier]!.finMs);
    // Sans chevauchement avec la scène d'avant, et dans la durée du plan.
    expect(s.debutMs).toBeGreaterThanOrEqual(finPrecedente);
    expect(s.finMs).toBeGreaterThan(s.debutMs);
    expect(s.finMs).toBeLessThanOrEqual(p.dureeMs);
    finPrecedente = s.finMs;
    expect(s.empreinte).toMatch(/^[0-9a-f]{16}$/);
    // Face caméra : jamais devant le visage.
    if (facecam) expect(s.position).toBe("bas");
  }
  // Les phrases 2 et 3 portent un chiffre : scènes aux indices 10 à 18 et 19 à 28 (la phrase 1, longue et sans chiffre, reste à l'existant).
  expect(p.scenes.map((s) => s.mots.premier)).toEqual([10, 19]);
  expect(p.scenes.map((s) => s.mots.dernier)).toEqual([18, 28]);
  return p;
}

const GROUPES = [{ id: "corps", ecrans: SEGMENTS.map((s, i) => ({ id: `e${i + 1}`, texteDit: s.texte, debutMs: s.debutMs, finMs: s.finMs })) }];

describe("plan de scènes prêt : cas concret (réglage simulé à true)", () => {
  it("le réglage simulé allume bien le cas concret", async () => {
    expect(await planScenesActif("cas-concret", async () => true)).toBe(true);
  });

  it("adaptateur : plan du stock non vide, calé sur des mots existants, sans chevauchement, sans IA", async () => {
    const r = await adapterPlan({ generateur: "cas-concret", script: SEGMENTS.map((s) => s.texte).join(" "), segments: SEGMENTS, format: FORMAT, facecam: false });
    expect(r.source).toBe("stock");
    // La phrase 1 (légende de 10 mots) est laissée à l'existant.
    expect(r.laissees).toEqual(["s1"]);
    verifierPlanPret(r.plan, false);
    // Les mots du plan sont ceux du script, dans l'ordre.
    expect(r.plan!.mots.map((m) => m.texte).join(" ")).toBe(SEGMENTS.map((s) => s.texte).join(" "));
  });

  it("chaîne du cas concret : une tranche par écran qui porte une scène, décalée à 0, sans IA", async () => {
    const r = await planScenesCasConcret({ groupes: GROUPES });
    // Écran 1 : aucune scène retenue ; écrans 2 et 3 : une scène chacun.
    expect(Object.keys(r.tranches).sort()).toEqual(["corps/e2", "corps/e3"]);
    expect(r.memo.corps!.plan).not.toBeNull();
    for (const t of Object.values(r.tranches)) {
      expect(schemaPlanStrict.safeParse(t).success).toBe(true);
      expect(t.scenes).toHaveLength(1);
      expect(t.scenes[0]!.debutMs).toBe(0);
      expect(t.scenes[0]!.niveau).toBe(1);
    }
    expect(r.tranches["corps/e2"]!.dureeMs).toBe(3000);
    expect(r.tranches["corps/e3"]!.dureeMs).toBe(3500);
    // Mémo : même entrée, le plan gardé est réutilisé tel quel.
    const encore = await planScenesCasConcret({ groupes: GROUPES, memo: r.memo });
    expect(encore.memo.corps).toBe(r.memo.corps);
  });

  it("tranche d'un plan prêt : vide hors de la voix", async () => {
    const r = await adapterPlan({ generateur: "cas-concret", script: "x", segments: SEGMENTS, format: FORMAT, facecam: false });
    expect(tranchePlan(r.plan!, 20000, 21000)).toBeNull();
  });
});

describe("plan de scènes prêt : face caméra et face caméra animée (réglage simulé à true)", () => {
  for (const generateur of ["facecam", "facecam-animee"] as const) {
    it(`${generateur} : plan de la vidéo entière non vide, calé au mot, sans chevauchement, sans IA`, async () => {
      expect(await planScenesActif(generateur, async () => true)).toBe(true);
      const memo = await planPourVideo({ generateur, mots: MOTS_SECONDES, dureeSec: 9, facecam: true, format: FORMAT });
      verifierPlanPret(memo.plan, true);
      // Aucun fournisseur d'IA n'était branché : aucune remarque de panne ni de réponse illisible.
      expect(memo.remarques.some((x) => x.code === "LLM_INDISPONIBLE" || x.code === "LLM_ILLISIBLE")).toBe(false);
      // Mémo : même entrée, le même résultat est rendu sans rien recalculer.
      const reprise = await planPourVideo({ generateur, mots: MOTS_SECONDES, dureeSec: 9, facecam: true, format: FORMAT, memo });
      expect(reprise).toBe(memo);
    });
  }

  it("sans aucun mot : pas de plan (l'existant garde tout), sans exception", async () => {
    const memo = await planPourVideo({ generateur: "facecam", mots: [], dureeSec: 9, facecam: true, format: FORMAT });
    expect(memo.plan).toBeNull();
  });
});
