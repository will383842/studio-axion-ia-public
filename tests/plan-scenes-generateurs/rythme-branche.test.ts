/**
 * C10-15-b2 : la mesure du rythme est branchée à la fin de `adapterPlan`, ÉTEINTE par défaut (seul `true` allume).
 * Aucun appel réel : `appeler` est un faux injecté ou absent.
 */
import { describe, expect, it } from "vitest";
import { adapterPlan, type EntreeAdaptateur } from "@/briques/plan-scenes-generateurs/adaptateur";
import { RYTHME_MESURE_ACTIF } from "@/briques/composition/rythme-mesure";

const FORMAT = { largeur: 1080, hauteur: 1920, fps: 25 as const };
const PHRASE = "Bonjour à tous. On gagne 3 heures par semaine avec cet outil. Le devis part tout seul chaque matin. Et voilà c'est fait.";
const motsDe = (texte: string, pas = 0.4) => texte.split(/\s+/).map((t, i) => ({ texte: t, debutMs: Math.round(i * pas * 1000), finMs: Math.round((i * pas + 0.35) * 1000) }));
const segmentsDe = (texte: string) => {
  const m = motsDe(texte);
  return [{ texte, debutMs: 0, finMs: m.at(-1)!.finMs, mots: m }];
};
const entree = (plus: Partial<EntreeAdaptateur> = {}): EntreeAdaptateur => ({ generateur: "cas-concret", script: PHRASE, segments: segmentsDe(PHRASE), format: FORMAT, facecam: false, ...plus });
/** Scène calée sur les mots du script (0,4 s par mot) : le texte affiché est dit, donc conservé par le validateur. */
const scene = (id: string, premier: number, dernier: number, texte = "Devis en 3 min") => ({ id, version: 1, mots: { premier, dernier }, debutMs: premier * 400, finMs: dernier * 400 + 350, niveau: 1, position: "centre", piece: "legende", parametres: { texte, sousTexte: "", style: "etiquette" } });
/** Faux Claude : rend les scènes données (jamais un appel réel). */
const faux = (scenes: unknown[]) => ({ appeler: (async () => ({ texte: JSON.stringify({ version: "plan-scenes-1", scenes }), stopReason: "end_turn" })) as never });
const UNE_SCENE = [scene("a", 0, 2, "Bonjour à tous")];
const VIVANT = [scene("a", 0, 2, "Bonjour à tous"), scene("b", 3, 6, "On gagne 3 heures"), scene("c", 7, 11, "par semaine avec cet outil"), scene("d", 12, 16, "Le devis part tout seul"), scene("e", 17, 22, "chaque matin")];
const rythmes = (r: { remarques: { code: string }[] }) => r.remarques.filter((x) => x.code === "RYTHME");

describe("C10-15-b2 · rythme au plan (éteint par défaut)", () => {
  it("(f) la constante est éteinte", () => {
    expect(RYTHME_MESURE_ACTIF).toBe(false);
  });

  it("(a) éteint = identique, aucune remarque RYTHME (absent, false, « true » texte)", async () => {
    const cas: [EntreeAdaptateur, { appeler: never } | undefined][] = [
      [entree({ dureeMs: 10000 }), faux(UNE_SCENE)],
      [entree({ dureeMs: 10000, objetsPermis: ["objet-gros-chiffre", "objet-coche"] }), faux(UNE_SCENE)],
      [entree(), undefined],
    ];
    for (const [e, d] of cas) {
      const base = await adapterPlan(e, d);
      expect(await adapterPlan({ ...e, rythme: false }, d)).toEqual(base);
      expect(await adapterPlan({ ...e, rythme: "true" as unknown as boolean }, d)).toEqual(base);
      expect(rythmes(base)).toEqual([]);
    }
  });

  it("(b) allumé, plage calme > 4 s : remarque RYTHME en fin de liste, plan identique à l'éteint", async () => {
    const e = entree({ dureeMs: 10000 });
    const eteint = await adapterPlan(e, faux(UNE_SCENE));
    const allume = await adapterPlan({ ...e, rythme: true }, faux(UNE_SCENE));
    expect(allume.plan).toEqual(eteint.plan);
    const r = rythmes(allume) as { code: string; sceneId?: string; message: string }[];
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]!.message).toMatch(/^À vérifier : plage sans changement de /);
    expect(r[0]!.sceneId).toBeUndefined();
    expect(allume.remarques.slice(0, eteint.remarques.length)).toEqual(eteint.remarques);
    expect(allume.remarques.slice(eteint.remarques.length).every((x) => x.code === "RYTHME")).toBe(true);
  });

  it("(b bis) allumé avec objets permis : même remarque par l'autre retour", async () => {
    const e = entree({ dureeMs: 10000, objetsPermis: ["objet-gros-chiffre", "objet-coche"], rythme: true });
    const allume = await adapterPlan(e, faux(UNE_SCENE));
    const eteint = await adapterPlan({ ...e, rythme: false }, faux(UNE_SCENE));
    expect(allume.plan).toEqual(eteint.plan);
    expect(allume.remarques.length).toBeGreaterThanOrEqual(eteint.remarques.length);
    expect(allume.remarques.slice(0, eteint.remarques.length)).toEqual(eteint.remarques);
  });

  it("(c) allumé, plan nul : aucune remarque RYTHME", async () => {
    const r = await adapterPlan({ generateur: "cas-concret", script: "", segments: [], format: FORMAT, facecam: false, rythme: true });
    expect(r.plan).toBeNull();
    expect(rythmes(r)).toEqual([]);
  });

  it("(d) allumé, plan vivant (une scène toutes les 2 s) : aucune remarque RYTHME", async () => {
    const r = await adapterPlan(entree({ dureeMs: 10000, rythme: true }), faux(VIVANT));
    expect(r.plan?.scenes).toHaveLength(5);
    expect(rythmes(r)).toEqual([]);
  });

  it("(e) allumé : jamais d'exception, même avec des durées illisibles", async () => {
    for (const dureeMs of [0, -5, Number.NaN]) {
      await expect(adapterPlan(entree({ dureeMs, rythme: true }), faux(UNE_SCENE))).resolves.toBeDefined();
    }
  });
});
