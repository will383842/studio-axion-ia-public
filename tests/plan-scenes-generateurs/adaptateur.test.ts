/**
 * Lot R2 — adaptateur « plan de scènes » des générateurs existants (Cas concret, Facecam, Facecam animée).
 * Doubles seulement : LLM simulé, aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { adapterPlan, GENERATEURS_PLAN, motsDesSegments, type SegmentCale } from "@/briques/plan-scenes-generateurs/adaptateur";
import { planScenesActif, CLES_REGLAGE_PLAN_SCENES } from "@/briques/plan-scenes-generateurs/reglage";
import { tranchePlan } from "@/briques/plan-scenes-generateurs/tranche";
import { scenesARerendre } from "@/briques/plan-scenes/empreinte";
import { schemaSceneStrict } from "@/briques/plan-scenes/schema";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";

const SEGMENTS: SegmentCale[] = [
  { texte: "Votre devis part en trois minutes sans aucune relance manuelle.", debutMs: 0, finMs: 3000 },
  { texte: "Le client signe sur son téléphone en 12 secondes.", debutMs: 3000, finMs: 6000 },
  { texte: "Un tableau de bord montre les 42 devis du mois.", debutMs: 6000, finMs: 9500 },
];
const FORMAT = { largeur: 1080, hauteur: 1350, fps: 25 as const };

function fausseReponse(texte: string): ReponseClaude {
  return { texte, stopReason: "end_turn" } as ReponseClaude;
}
/** LLM simulé : une scène « carte KPI » sur le 3e segment, une « fenêtre d'app » sur le 2e en niveau 3 (interdit). */
function llm(plan: (req: RequeteClaude) => unknown) {
  const appels: RequeteClaude[] = [];
  return { appels, appeler: async (req: RequeteClaude) => (appels.push(req), fausseReponse(JSON.stringify(plan(req)))) };
}
const planLlm = (req: RequeteClaude) => {
  const n = req.messages[0]!.contenu.split("Minutage des mots")[1]!.split("\n").filter((l) => /^\d+\t/.test(l)).length;
  void n;
  return {
    version: "plan-scenes-1",
    scenes: [
      { id: "a", version: 1, mots: { premier: 0, dernier: 5 }, debutMs: 0, finMs: 3000, niveau: 1, position: "centre", piece: "legende", parametres: { texte: "Devis en 3 min", sousTexte: "", style: "etiquette" } },
      { id: "b", version: 1, mots: { premier: 6, dernier: 11 }, debutMs: 3000, finMs: 6000, niveau: 3, code: "export default () => null", position: "centre", piece: "fenetre-app", parametres: {} },
      { id: "c", version: 1, mots: { premier: 12, dernier: 20 }, debutMs: 6000, finMs: 9500, niveau: 1, position: "centre", piece: "carte-kpi", parametres: { valeur: "42", etiquette: "devis" } },
    ],
  };
};

describe("réglage : désactivé par défaut", () => {
  // Depuis GV2-55, le cas concret et le face caméra sont allumés par défaut (reglage-allume-par-defaut.test.ts) : cette boucle ne garde que la face caméra animée.
  it("chaque générateur a sa clé et reste éteint sans la valeur exacte true", async () => {
    for (const g of GENERATEURS_PLAN.filter((x) => x === "facecam-animee")) {
      const cle = CLES_REGLAGE_PLAN_SCENES[g];
      expect(cle).toMatch(/^planScenes\./);
      expect(await planScenesActif(g, async (_id, defaut) => defaut)).toBe(false);
      expect(await planScenesActif(g, async () => "true")).toBe(false);
      expect(await planScenesActif(g, async () => 1)).toBe(false);
      expect(await planScenesActif(g, async () => true)).toBe(true);
      expect(await planScenesActif(g, async () => { throw new Error("base"); })).toBe(false);
    }
  });
});

describe("adaptateur", () => {
  it("niveau 1 (stock) sans LLM : plan valide, scènes d'interface et de chiffres seulement, ordre et mots du script", async () => {
    const r = await adapterPlan({ generateur: "cas-concret", script: SEGMENTS.map((s) => s.texte).join(" "), segments: SEGMENTS, format: FORMAT, facecam: false });
    expect(r.source).toBe("stock");
    expect(r.plan).not.toBeNull();
    for (const s of r.plan!.scenes) {
      expect(s.niveau).toBe(1);
      expect(schemaSceneStrict.safeParse(s).success).toBe(true);
      expect(s.empreinte).toMatch(/^[0-9a-f]{16}$/);
    }
    // Une scène seulement là où le script donne un fait (durée, nombre) : plus de légende faite d'un bout de phrase.
    expect(r.plan!.scenes.map((s) => s.piece)).toEqual(["repere", "repere", "compteur"]);
    expect(r.plan!.scenes.some((s) => s.piece === "legende")).toBe(false);
    expect(r.laissees).toEqual([]);
    // Le script fait foi : les mots du plan sont ceux des segments, dans l'ordre.
    expect(r.plan!.mots.map((m) => m.texte).join(" ")).toBe(SEGMENTS.map((s) => s.texte).join(" "));
  });

  it("niveau 2 par le LLM injecté ; niveau 3 interdit : la scène est repliée, jamais d'erreur", async () => {
    const f = llm(planLlm);
    const r = await adapterPlan({ generateur: "facecam-animee", script: "x", segments: SEGMENTS, format: FORMAT, facecam: true }, { appeler: f.appeler });
    expect(f.appels).toHaveLength(1);
    expect(r.source).toBe("llm");
    expect(r.plan!.scenes.every((s) => s.niveau !== 3)).toBe(true);
    expect(JSON.stringify(r.plan)).not.toContain("export default");
    expect(r.remarques.some((x) => x.code === "CODE_LIBRE_DESACTIVE")).toBe(true);
    // Face caméra : jamais devant le visage.
    expect(r.plan!.scenes.every((s) => ["bas", "haut"].includes(s.position))).toBe(true);
  });

  it("LLM en panne : repli sur le stock (niveau 1), avec une remarque, sans exception", async () => {
    const r = await adapterPlan({ generateur: "facecam", script: "x", segments: SEGMENTS, format: FORMAT, facecam: true }, { appeler: async () => { throw new Error("panne"); } });
    expect(r.source).toBe("stock");
    expect(r.remarques.some((x) => x.code === "LLM_INDISPONIBLE")).toBe(true);
    expect(r.plan!.scenes.every((s) => s.niveau === 1)).toBe(true);
  });

  it("repli d'un niveau par scène : un niveau 2 sans calque valide devient niveau 1, les autres scènes restent", async () => {
    const f = llm(() => ({
      version: "plan-scenes-1",
      scenes: [
        { id: "a", version: 1, mots: { premier: 0, dernier: 5 }, debutMs: 0, finMs: 3000, niveau: 2, position: "centre", piece: "carte-kpi", parametres: { valeur: "3", etiquette: "min" }, calques: [{ piece: "inconnue", parametres: {}, debutMs: 0, zone: "plein" }] },
        { id: "c", version: 1, mots: { premier: 12, dernier: 20 }, debutMs: 6000, finMs: 9500, niveau: 2, position: "centre", piece: "carte-kpi", parametres: { valeur: "42", etiquette: "devis" }, calques: [{ piece: "carte-kpi", parametres: { valeur: "42", etiquette: "devis" }, debutMs: 200, zone: "plein" }] },
      ],
    }));
    const r = await adapterPlan({ generateur: "cas-concret", script: "x", segments: SEGMENTS, format: FORMAT, facecam: false }, { appeler: f.appeler });
    const niveaux = r.plan!.scenes.map((s) => s.niveau);
    expect(niveaux).toContain(2);
    expect(niveaux).toContain(1);
  });

  it("aucune scène d'interface ni de chiffre : plan nul (l'existant garde tout)", async () => {
    const r = await adapterPlan({ generateur: "cas-concret", script: "Bonjour à tous et bienvenue sur la chaîne de ce studio.", segments: [{ texte: "Bonjour à tous et bienvenue sur la chaîne de ce studio.", debutMs: 0, finMs: 4000 }], format: FORMAT, facecam: false });
    expect(r.plan).toBeNull();
  });

  it("segments sans fait mais un seul mot de liaison en fin : aucune légende-fragment n'est retenue", async () => {
    const r = await adapterPlan({ generateur: "cas-concret", script: "x", segments: [{ texte: "Je vais vous montrer comment faire de", debutMs: 0, finMs: 4000 }], format: FORMAT, facecam: false });
    expect(r.plan).toBeNull();
  });

  it("LLM : une légende en fragment (2 à 5 mots finissant par une liaison, ou d'un seul mot) est laissée à l'existant", async () => {
    const f = llm(() => ({
      version: "plan-scenes-1",
      scenes: [
        { id: "a", version: 1, mots: { premier: 0, dernier: 2 }, debutMs: 0, finMs: 1500, niveau: 1, position: "centre", piece: "legende", parametres: { texte: "Devis en trois de", sousTexte: "", style: "etiquette" } },
        { id: "b", version: 1, mots: { premier: 3, dernier: 5 }, debutMs: 1500, finMs: 3000, niveau: 1, position: "centre", piece: "legende", parametres: { texte: "minutes.", sousTexte: "", style: "etiquette" } },
        { id: "c", version: 1, mots: { premier: 6, dernier: 11 }, debutMs: 3000, finMs: 6000, niveau: 1, position: "centre", piece: "legende", parametres: { texte: "Signature en douze secondes", sousTexte: "", style: "etiquette" } },
      ],
    }));
    const r = await adapterPlan({ generateur: "cas-concret", script: "x", segments: SEGMENTS, format: FORMAT, facecam: false }, { appeler: f.appeler });
    expect(r.plan!.scenes.map((s) => (s.parametres as { texte: string }).texte)).toEqual(["Signature en douze secondes"]);
    expect(r.laissees).toEqual(["a", "b"]);
  });

  it("mots des segments : ceux fournis (calés) sont gardés, sinon répartis dans le segment", () => {
    const mots = motsDesSegments([{ texte: "un deux", debutMs: 0, finMs: 1000 }, { texte: "trois", debutMs: 1000, finMs: 2000, mots: [{ texte: "trois", debutMs: 1100, finMs: 1500 }] }]);
    expect(mots).toEqual([
      { texte: "un", debutMs: 0, finMs: 500 },
      { texte: "deux", debutMs: 500, finMs: 1000 },
      { texte: "trois", debutMs: 1100, finMs: 1500 },
    ]);
  });
});

describe("empreintes par scène et tranches", () => {
  it("changer un mot du script ne rend à nouveau que la scène touchée", async () => {
    const avant = await adapterPlan({ generateur: "cas-concret", script: "x", segments: SEGMENTS, format: FORMAT, facecam: false });
    const seg2 = SEGMENTS.map((s, i) => (i === 2 ? { ...s, texte: "Un tableau de bord montre les 57 devis du mois." } : s));
    const apres = await adapterPlan({ generateur: "cas-concret", script: "x", segments: seg2, format: FORMAT, facecam: false });
    const touchees = scenesARerendre(avant.plan!, apres.plan!);
    expect(touchees.length).toBeGreaterThan(0);
    expect(touchees.length).toBeLessThan(apres.plan!.scenes.length + 1);
    const intactes = apres.plan!.scenes.filter((s) => !touchees.includes(s.id));
    expect(intactes.length).toBeGreaterThan(0);
  });

  it("tranchePlan : scènes d'un écran décalées à 0, empreinte stable si rien ne change autour", async () => {
    const r = await adapterPlan({ generateur: "cas-concret", script: "x", segments: SEGMENTS, format: FORMAT, facecam: false });
    const t1 = tranchePlan(r.plan!, 6000, 9500);
    expect(t1).not.toBeNull();
    expect(t1!.scenes[0]!.debutMs).toBe(0);
    expect(t1!.dureeMs).toBe(3500);
    // Les mêmes mots plus tôt dans la vidéo : même tranche, même empreinte.
    // (Les pièces « de données » portent l'indice absolu du mot : le même texte décalé dans le temps, sans mot ajouté avant.)
    const decale = await adapterPlan({ generateur: "cas-concret", script: "x", segments: SEGMENTS.map((s) => ({ ...s, debutMs: s.debutMs + 1000, finMs: s.finMs + 1000 })), format: FORMAT, facecam: false });
    const t2 = tranchePlan(decale.plan!, 7000, 10500);
    expect(t2!.scenes.map((s) => s.empreinte)).toEqual(t1!.scenes.map((s) => s.empreinte));
    expect(tranchePlan(r.plan!, 20000, 21000)).toBeNull();
  });
});
