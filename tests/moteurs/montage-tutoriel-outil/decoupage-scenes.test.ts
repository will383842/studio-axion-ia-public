/** T-EXT-14 : découpage du plan validé en morceaux de plan (pur, aucun appel, aucun FFmpeg). */
import { describe, expect, it } from "vitest";
import { CATALOGUE_BRIQUES } from "@/briques/plan-scenes/catalogue";
import { avecEmpreintes } from "@/briques/plan-scenes/empreinte";
import { schemaPlanStrict, type PlanDeScenes, type PlanValide } from "@/briques/plan-scenes/schema";
import type { EtapeCalee } from "@/moteurs/montage-tutoriel-outil/calage-scenario";
import { decouperEnMorceaux } from "@/moteurs/montage-tutoriel-outil/decoupage-scenes";

const TRANSITION = { entree: "fondu", sortie: "fondu", dureeMs: 400 } as const;
const MOTS = Array.from({ length: 15 }, (_, i) => ({ texte: `mot${i}`, debutMs: 1000 + i * 400, finMs: 1000 + i * 400 + 400 }));
const bornes = (i: number) => ({ mots: { premier: i * 3, dernier: i * 3 + 2 }, debutMs: MOTS[i * 3]!.debutMs, finMs: MOTS[i * 3 + 2]!.finMs });
const base = { version: 1, niveau: 1, position: "centre", transition: TRANSITION } as const;

function planFictif(): PlanValide {
  const plan = {
    version: "plan-scenes-1",
    format: { largeur: 1080, hauteur: 1350, fps: 25 },
    facecam: true,
    dureeMs: 8000,
    habillage: { fond: "ivoire", accent: "terracotta" },
    mots: MOTS,
    scenes: [
      { ...base, id: "s1", ...bornes(0), piece: "fenetre-app", parametres: CATALOGUE_BRIQUES["fenetre-app"].exemple },
      { ...base, id: "s2", ...bornes(1), piece: "legende", parametres: CATALOGUE_BRIQUES["legende"].exemple, texte: "Le devis part tout seul" },
      {
        ...base,
        id: "s3",
        ...bornes(2),
        niveau: 2,
        piece: "fenetre-app",
        parametres: CATALOGUE_BRIQUES["fenetre-app"].exemple,
        calques: [
          { piece: "curseur", parametres: CATALOGUE_BRIQUES["curseur"].exemple, debutMs: 100, zone: "plein" },
          { piece: "zoom-camera", parametres: CATALOGUE_BRIQUES["zoom-camera"].exemple, debutMs: 300, zone: "plein" },
        ],
      },
      { ...base, id: "s4", ...bornes(3), piece: "legende", parametres: CATALOGUE_BRIQUES["legende"].exemple },
      { ...base, id: "s5", ...bornes(4), piece: "fenetre-app", parametres: CATALOGUE_BRIQUES["fenetre-app"].exemple },
    ],
  } as unknown as PlanDeScenes;
  return avecEmpreintes(plan);
}

const etape = (id: string, role: EtapeCalee["role"], debutMs: number, finMs: number): EtapeCalee => ({ id, role, debutMs, finMs });
const ETAPES: EtapeCalee[] = [
  etape("e1", "accroche", 0, 2200),
  etape("e2", "probleme", 2200, 3500),
  etape("e3", "parcours", 3500, 4800),
  etape("e4", "parcours", 4800, 5000),
  etape("e5", "bonne-pratique", 5000, 6000),
  etape("e6", "appel", 6000, 7000),
];

function gelProfond<T>(v: T): T {
  if (v && typeof v === "object") {
    for (const x of Object.values(v)) gelProfond(x);
    Object.freeze(v);
  }
  return v;
}

describe("decouperEnMorceaux", () => {
  it("le plan fictif est lui-même un plan strict valide", () => {
    expect(schemaPlanStrict.safeParse(planFictif()).success).toBe(true);
  });

  it("5 scènes, 6 étapes : 5 morceaux aux bornes du plan, rôles attendus", () => {
    const plan = planFictif();
    const r = decouperEnMorceaux({ plan, etapes: ETAPES });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.morceaux.map((m) => m.sceneId)).toEqual(["s1", "s2", "s3", "s4", "s5"]);
    r.morceaux.forEach((m, i) => {
      expect(m.debutMs).toBe(plan.scenes[i]!.debutMs);
      expect(m.finMs).toBe(plan.scenes[i]!.finMs);
      expect(m.dureeMs).toBe(m.finMs - m.debutMs);
      expect(m.empreinteScene).toBe(plan.scenes[i]!.empreinte);
      expect(m.empreinteMorceau).toMatch(/^[0-9a-f]{16}$/);
    });
    // s1 [1000,2200] → accroche ; s2 [2200,3400] → probleme ; s3 [3400,4600] → parcours (e3 1100 > e2 100) ;
    // s4 [4600,5800] → e4 200, e5 800 : bonne-pratique ; s5 [5800,7000] → e5 200, e6 1000 : appel.
    expect(r.morceaux.map((m) => m.role)).toEqual(["accroche", "probleme", "parcours", "bonne-pratique", "appel"]);
  });

  it("chaque morceau.plan passe schemaPlanStrict, sans face caméra, une seule scène à 0", () => {
    const r = decouperEnMorceaux({ plan: planFictif(), etapes: ETAPES });
    if (!r.ok) throw new Error("refus inattendu");
    for (const m of r.morceaux) {
      expect(schemaPlanStrict.safeParse(m.plan).success).toBe(true);
      expect(m.plan.facecam).toBe(false);
      expect(m.plan.scenes).toHaveLength(1);
      expect(m.plan.scenes[0]!.debutMs).toBe(0);
      expect(m.plan.scenes[0]!.finMs).toBe(m.dureeMs);
      expect(m.plan.dureeMs).toBe(m.dureeMs);
      expect(m.plan.scenes[0]!.mots).toEqual({ premier: 0, dernier: 2 });
    }
    expect(r.morceaux[2]!.plan.scenes[0]!.calques).toHaveLength(2);
  });

  it("mots décalés : le premier mot à 0 ms, texteDit = les mots couverts", () => {
    const r = decouperEnMorceaux({ plan: planFictif() });
    if (!r.ok) throw new Error("refus inattendu");
    r.morceaux.forEach((m, i) => {
      expect(m.plan.mots).toHaveLength(3);
      expect(m.plan.mots[0]!.debutMs).toBe(0);
      expect(m.plan.mots[2]!.finMs).toBe(m.dureeMs);
      expect(m.texteDit).toBe(`mot${i * 3} mot${i * 3 + 1} mot${i * 3 + 2}`);
    });
  });

  it("scène sans étape (ou sans recouvrement) : sans-role", () => {
    const sans = decouperEnMorceaux({ plan: planFictif() });
    if (!sans.ok) throw new Error("refus inattendu");
    expect(sans.morceaux.every((m) => m.role === "sans-role")).toBe(true);
    const loin = decouperEnMorceaux({ plan: planFictif(), etapes: [etape("x", "appel", 20_000, 21_000)] });
    if (!loin.ok) throw new Error("refus inattendu");
    expect(loin.morceaux.every((m) => m.role === "sans-role")).toBe(true);
  });

  it("égalité de recouvrement : la première étape l'emporte", () => {
    const r = decouperEnMorceaux({ plan: planFictif(), etapes: [etape("a", "probleme", 1000, 1600), etape("b", "appel", 1600, 2200)] });
    if (!r.ok) throw new Error("refus inattendu");
    expect(r.morceaux[0]!.role).toBe("probleme");
  });

  it("scènes qui se chevauchent : refus", () => {
    const plan = planFictif();
    plan.scenes[1]!.debutMs = plan.scenes[0]!.finMs - 300;
    const r = decouperEnMorceaux({ plan });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.some((e) => e.includes("s2") && e.includes("chevauche"))).toBe(true);
  });

  it("scènes dans le désordre : refus", () => {
    const plan = planFictif();
    plan.scenes.reverse();
    expect(decouperEnMorceaux({ plan }).ok).toBe(false);
  });

  it("niveau 3 : refus, sans citer le texte", () => {
    const plan = planFictif();
    plan.scenes[3]!.niveau = 3;
    const r = decouperEnMorceaux({ plan });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erreurs).toContain("Scène s4 : niveau 3, jamais réutilisée.");
      expect(r.erreurs.join(" ")).not.toContain("mot");
    }
  });

  it("plan sans scène : refus", () => {
    const plan = { ...planFictif(), scenes: [] };
    expect(decouperEnMorceaux({ plan })).toEqual({ ok: false, erreurs: ["Plan sans scène."] });
  });

  it("indices de mots hors plan : refus", () => {
    const plan = planFictif();
    plan.scenes[4]!.mots = { premier: 12, dernier: 40 };
    const r = decouperEnMorceaux({ plan });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.some((e) => e.startsWith("Scène s5"))).toBe(true);
  });

  it("scène que le validateur changerait (paramètres invalides) : « non rendable seule », jamais réparée", () => {
    const plan = planFictif();
    (plan.scenes[1] as { parametres: unknown }).parametres = { texte: 42 };
    const r = decouperEnMorceaux({ plan });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs).toContain("Scène s2 : non rendable seule.");
  });

  it("déterministe : mêmes entrées, mêmes sorties et mêmes empreintes", () => {
    const a = decouperEnMorceaux({ plan: planFictif(), etapes: ETAPES });
    const b = decouperEnMorceaux({ plan: planFictif(), etapes: ETAPES });
    expect(a).toEqual(b);
    if (!a.ok) throw new Error("refus inattendu");
    expect(new Set(a.morceaux.map((m) => m.empreinteMorceau)).size).toBe(5);
  });

  it("l'entrée n'est pas modifiée (gel profond) et le morceau n'en partage rien", () => {
    const plan = gelProfond(planFictif());
    const etapes = gelProfond(structuredClone(ETAPES));
    const r = decouperEnMorceaux({ plan, etapes });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.morceaux[2]!.plan.scenes[0]!.calques).not.toBe(plan.scenes[2]!.calques);
    expect(r.morceaux[0]!.plan.format).not.toBe(plan.format);
  });

  it("aucun sous-titre, aucun argument FFmpeg, aucun chemin de fichier dans la sortie", () => {
    const r = decouperEnMorceaux({ plan: planFictif(), etapes: ETAPES });
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/sousTitres/);
    expect(json).not.toMatch(/"-ss"|"-an"|ffmpeg/i);
    expect(json).not.toMatch(/\.(mp4|webm|mov|wav|png)\b/i);
    expect(json).not.toMatch(/(^|[\s"'])\/[\w.-]+\/|[A-Za-z]:\\|\\\\/);
  });
});
