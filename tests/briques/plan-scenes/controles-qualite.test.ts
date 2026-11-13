/**
 * GV2-46 — contrôles de qualité du plan de scènes : littéralité, temps de lecture, débordement, sous-titres,
 * densité, répétition. Plans fabriqués à la main, faux exprès. Aucun fournisseur, aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { controlerDebordement, controlerDensite, controlerRepetition, BANDE_SOUS_TITRES_DEFAUT } from "../../../src/briques/plan-scenes/controles";
import { planDeRepli, validerPlan, type CodeRemarque } from "../../../src/briques/plan-scenes/validateur";
import type { MotMinute, ScenePlan } from "../../../src/briques/plan-scenes/schema";
import { seChevauchent, ZONES } from "../../../src/briques/plan-scenes/zones";
import { DIX_SCRIPTS, motsHorodates } from "../faits-script/dix-scripts";

const FORMAT = { largeur: 1080, hauteur: 1920, fps: 25 as const };
const SIX: CodeRemarque[] = ["LITTERALITE", "TEXTE_TROP_LONG", "TROP_COURT", "SOUS_TITRES", "DENSITE", "REPETITION"];
const TRANSITION = { entree: "fondu", sortie: "fondu", dureeMs: 400 };

const mots = (texte: string, pasMs = 350, decalageMs = 0): MotMinute[] =>
  texte.split(/\s+/).map((t, i) => ({ texte: t, debutMs: decalageMs + i * pasMs, finMs: decalageMs + (i + 1) * pasMs }));

function scene(id: string, piece: string, parametres: unknown, premier: number, dernier: number, position = "centre") {
  return { id, version: 1, mots: { premier, dernier }, debutMs: 0, finMs: 1, niveau: 1, position, transition: TRANSITION, piece, parametres };
}
function plan(scenes: unknown[], m: MotMinute[]) {
  return { version: "plan-scenes-1", format: FORMAT, facecam: false, dureeMs: m.at(-1)!.finMs, habillage: { fond: "ivoire", accent: "terracotta" }, mots: m, scenes };
}
const codes = (r: ReturnType<typeof validerPlan>) => r.remarques.map((x) => x.code);

describe("littéralité", () => {
  const m = mots("Nous avons gagné 40 % de clients en plus ce mois-ci grâce au rappel automatique");
  it("un compteur à 75 alors que seul « 40 % » est dit : remplacé par le stock ou retiré, LITTERALITE", () => {
    const r = validerPlan(plan([scene("a", "compteur", { valeur: 75, unite: "%", surMot: 3 }, 0, m.length - 1)], m), { mots: m, format: FORMAT });
    expect(codes(r)).toContain("LITTERALITE");
    expect(JSON.stringify(r.plan.scenes)).not.toContain("75");
    for (const s of r.plan.scenes) expect(JSON.stringify(s.parametres)).toContain("40");
  });
  it("un compteur à 40 dit dans la plage est gardé", () => {
    const r = validerPlan(plan([scene("a", "compteur", { valeur: 40, unite: "%", surMot: 3 }, 0, 5)], m), { mots: m, format: FORMAT });
    expect(codes(r)).not.toContain("LITTERALITE");
    expect(r.plan.scenes).toHaveLength(1);
  });
  it("une légende qui affiche un chiffre jamais dit (75 %) : LITTERALITE", () => {
    const r = validerPlan(plan([scene("a", "legende", { texte: "Plus 75 % de devis", sousTexte: "", style: "bandeau" }, 0, 8)], m), { mots: m, format: FORMAT });
    expect(codes(r)).toContain("LITTERALITE");
    expect(JSON.stringify(r.plan.scenes)).not.toContain("75");
  });
  it("une citation qui n'est pas une suite de mots dits : retirée ou remplacée, LITTERALITE", () => {
    const r = validerPlan(plan([scene("a", "citation", { texte: "Une promesse jamais prononcée", surMot: 0 }, 0, 8)], m), { mots: m, format: FORMAT });
    expect(codes(r)).toContain("LITTERALITE");
    expect(JSON.stringify(r.plan.scenes)).not.toContain("promesse");
  });
});

describe("débordement", () => {
  it("une citation de 30 mots (60 mots coupés pour tenir) : retirée, TEXTE_TROP_LONG", () => {
    const texte = Array.from({ length: 60 }, (_, i) => `mot${"x".repeat(i % 7)}`).join(" ");
    const s = { ...scene("c", "citation", { texte, surMot: 0 }, 0, 59), debutMs: 0, finMs: 5000 } as unknown as ScenePlan;
    const r = controlerDebordement(s, { mots: [], format: FORMAT, facecam: false, dureeMs: 20000 });
    expect(r.scene).toBeNull();
    expect(r.remarque?.code).toBe("TEXTE_TROP_LONG");
  });
  it("une citation de la longueur permise tient : gardée", () => {
    const texte = "Le temps ne se trouve pas, il se gagne chaque jour en répondant plus vite à ceux qui vous écrivent.";
    const s = scene("c", "citation", { texte, surMot: 0 }, 0, 17) as unknown as ScenePlan;
    expect(controlerDebordement(s, { mots: [], format: FORMAT, facecam: false, dureeMs: 20000 }).scene).not.toBeNull();
  });
});

describe("temps de lecture", () => {
  it("une scène de 300 ms avec 5 mots : retirée, TROP_COURT", () => {
    const m = mots("un deux trois quatre cinq six sept", 60);
    const r = validerPlan(plan([scene("a", "legende", { texte: "un deux trois quatre cinq", sousTexte: "", style: "bandeau" }, 0, 4)], m), { mots: m, format: FORMAT });
    expect(codes(r)).toContain("TROP_COURT");
    expect(r.plan.scenes).toHaveLength(0);
  });
  it("aucune scène ne finit plus de 1,2 s après son dernier mot", () => {
    const m = mots("Vous gagnez 40 % de temps en plus chaque semaine grâce à ce réglage simple", 350);
    const b = scene("a", "jauge", { valeur: 40, surMot: 2 }, 0, 3);
    b.finMs = 9000;
    const r = validerPlan(plan([b], m), { mots: m, format: FORMAT });
    expect(r.plan.scenes[0]!.finMs).toBeLessThanOrEqual(m[3]!.finMs + 1200);
  });
});

describe("sous-titres", () => {
  const m = mots("Vous avez trois étapes à suivre : trier, répondre, classer. Voilà tout le secret du réglage");
  const etapes = { elements: [{ texte: "trier", surMot: 7 }, { texte: "répondre", surMot: 8 }, { texte: "classer", surMot: 9 }] };
  it("une scène en « bas » sur la bande par défaut : déplacée (pas devant le visage) ou retirée, SOUS_TITRES", () => {
    const r = validerPlan(plan([scene("a", "etapes", etapes, 6, 9, "bas")], m), { mots: m, format: FORMAT });
    expect(codes(r)).toContain("SOUS_TITRES");
    for (const s of r.plan.scenes) {
      expect(s.position).not.toBe("bas");
      expect(["haut", "centre"]).toContain(s.position);
    }
  });
  it("en face caméra, la place sous le visage est gardée (jamais devant le visage)", () => {
    const r = validerPlan({ ...plan([scene("a", "etapes", etapes, 6, 9, "bas")], m), facecam: true }, { mots: m, format: FORMAT, facecam: true });
    for (const s of r.plan.scenes) expect(seChevauchent(ZONES[s.position], { x: 22, y: 14, largeur: 56, hauteur: 42 })).toBe(false);
  });
  it("la bande par défaut est celle de la fiche", () => {
    expect(BANDE_SOUS_TITRES_DEFAUT).toEqual({ x: 5, y: 66, largeur: 90, hauteur: 16 });
  });
});

describe("densité et répétition", () => {
  it("4 scènes en 10 s : 2 gardées, DENSITE", () => {
    const base = (id: string, debut: number, piece = "compteur") => ({ id, debutMs: debut, finMs: debut + 2500, piece }) as unknown as ScenePlan;
    const r = controlerDensite([base("a", 0), base("b", 2500, "jauge"), base("c", 5000, "etapes"), base("d", 7500, "repere")]);
    expect(r.scenes).toHaveLength(2);
    expect(r.remarques.every((x) => x.code === "DENSITE")).toBe(true);
  });
  it("4 scènes en 10 s dans un plan validé : 2 gardées", () => {
    const m = mots("Un deux trois quatre cinq six sept huit", 1250);
    const sc = [
      scene("s0", "citation", { texte: "Un deux", surMot: 0 }, 0, 1, "centre"),
      scene("s1", "repere", { genre: "lieu", texte: "trois quatre", surMot: 2 }, 2, 3, "centre"),
      scene("s2", "etapes", { elements: [{ texte: "cinq", surMot: 4 }, { texte: "six", surMot: 5 }] }, 4, 5, "centre"),
      scene("s3", "liste-au-mot", { elements: [{ texte: "sept", surMot: 6 }, { texte: "huit", surMot: 7 }] }, 6, 7, "centre"),
    ];
    const r = validerPlan(plan(sc, m), { mots: m, format: FORMAT });
    expect(r.plan.scenes).toHaveLength(2);
    expect(codes(r).filter((c) => c === "DENSITE")).toHaveLength(2);
  });
  it("deux compteur de suite : le second retiré, REPETITION ; au plus 3 fois la même pièce", () => {
    const s = (id: string, piece: string) => ({ id, debutMs: 0, finMs: 1, piece }) as unknown as ScenePlan;
    const r = controlerRepetition([s("a", "compteur"), s("b", "compteur"), s("c", "jauge")]);
    expect(r.scenes.map((x) => x.id)).toEqual(["a", "c"]);
    expect(r.remarques[0]).toMatchObject({ code: "REPETITION", sceneId: "b" });
    const huit = controlerRepetition(["compteur", "jauge", "compteur", "jauge", "compteur", "jauge", "compteur"].map((p, i) => s(`x${i}`, p)));
    expect(huit.scenes.filter((x) => x.piece === "compteur")).toHaveLength(3);
  });
  it("deux compteur de suite dans un plan validé : le second est retiré", () => {
    const m = mots("Vous gagnez 40 pour cent de temps. Ensuite vous gagnez encore 60 pour cent de clients en plus", 400);
    const r = validerPlan(plan([scene("a", "compteur", { valeur: 40, surMot: 2 }, 0, 5), scene("b", "compteur", { valeur: 60, surMot: 10 }, 7, 15)], m), { mots: m, format: FORMAT });
    expect(codes(r)).toContain("REPETITION");
    expect(r.plan.scenes.filter((s) => s.piece === "compteur")).toHaveLength(1);
  });
});

describe("plan juste et dix scripts", () => {
  it("un plan juste : aucune remarque des six codes, aucune scène retirée", () => {
    const m = mots("Résultat : 40 % de devis en plus. Cela se passe à Lyon, chaque lundi matin sans exception aucune", 350);
    const r = validerPlan(
      plan([scene("a", "jauge", { valeur: 40, surMot: 2 }, 0, 5, "centre"), scene("b", "repere", { genre: "lieu", texte: "Lyon", surMot: 12 }, 12, 12, "haut")], m),
      { mots: m, format: FORMAT },
    );
    expect(codes(r).filter((c) => SIX.includes(c))).toEqual([]);
    expect(r.plan.scenes).toHaveLength(2);
  });
  it("dix scripts : le plan du stock validé ne porte aucune remarque LITTERALITE", () => {
    const lignes: string[] = [];
    for (const script of DIX_SCRIPTS) {
      const m = motsHorodates(script);
      const avant = planDeRepli({ mots: m, format: FORMAT, facecam: true, dureeMs: m.at(-1)!.finMs + 1000 });
      const r = validerPlan(avant, { mots: m, format: FORMAT, facecam: true });
      expect(codes(r)).not.toContain("LITTERALITE");
      lignes.push(`${avant.scenes.length} -> ${r.plan.scenes.length} [${[...new Set(codes(r).filter((c) => SIX.includes(c)))].join(",")}]`);
    }
    console.log(lignes.join("\n"));
  });
});
