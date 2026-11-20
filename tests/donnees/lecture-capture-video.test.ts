import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ETAPE_LECTURE_CAPTURE,
  MODELE_CLAUDE_VIDEO,
  PARAM_LECTURE_CAPTURE_CLAUDE,
  PLAFONDS_CLAUDE_VIDEO_EUR,
  PLAFOND_TOTAL_CLAUDE_VIDEO_EUR,
  PREFIXES_ETAPE_CLAUDE_VIDEO,
  jetonsImage,
  lectureCaptureClaudeActive,
  lireCaptureTableau,
  pireCasLectureCaptureUsd,
  type DepsLectureCapture,
} from "@/services/lecture-capture-claude";
import { requeteLectureCapture } from "@/briques/donnees-video/lecture-capture";
import { pireCasRequete, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";

const image = (largeur: number, hauteur: number) => ({ base64: "AAAA", type: "image/png" as const, largeur, hauteur });

const donnee = {
  version: "tableau-de-bord.v1",
  titre: "Tableau de bord",
  periode: { debut: "2026-10-01", fin: "2026-10-31", libelle: "Octobre" },
  source: "Capture",
  indicateurs: [
    { id: "visites", libelle: "Visites", valeur: 120, unite: "visites", precision: 0, sens: "hausse-bonne" },
    { id: "rebond", libelle: "Rebond", valeur: 40.5, unite: "%", precision: 1, sens: "baisse-bonne" },
  ],
  series: [{ id: "jour", libelle: "Par jour", unite: "visites", points: [{ x: "1", valeur: 10 }, { x: "2", valeur: 12 }] }],
  comparaisons: [],
  alertes: [],
  calculs: [],
};

type Appel = { videoId: string; role: DefinitionRole; entree: EntreeRole; options: Record<string, unknown> };

/** Faux client : compte les appels, accepte tout (comme un budget indicatif). */
function fabrique(reponse: unknown = { ok: true, simule: false, texte: JSON.stringify(donnee), coutUsd: 0, modele: "x" }, engages: Record<string, number> = {}, taux = 1) {
  const appels: Appel[] = [];
  const demandesEngage: string[] = [];
  const deps = {
    lire: async <T,>() => true as unknown as T,
    taux: async () => taux,
    engage: async (_v: string, p: { id: string }) => {
      demandesEngage.push(p.id);
      return engages[p.id] ?? 0;
    },
    executer: async (videoId: string, role: DefinitionRole, entree: EntreeRole, options: Record<string, unknown>) => {
      appels.push({ videoId, role, entree, options });
      if (reponse instanceof Error) throw reponse;
      return reponse;
    },
  };
  return { appels, demandesEngage, deps: deps as unknown as DepsLectureCapture };
}

describe("interrupteur tableau.lectureCaptureClaude", () => {
  it("seul true exact allume", async () => {
    const avec = (v: unknown) => lectureCaptureClaudeActive((async () => v) as never);
    expect(await avec(true)).toBe(true);
    for (const v of [undefined, false, "true", 1, null]) expect(await avec(v), String(v)).toBe(false);
    expect(await lectureCaptureClaudeActive((async () => { throw new Error("panne"); }) as never)).toBe(false);
  });
  it("éteint : repli, 0 appel, 0 lecture d'engagé", async () => {
    for (const v of [undefined, false, "true", 1]) {
      const f = fabrique();
      const r = await lireCaptureTableau("v1", image(882, 1568), "studio", { ...f.deps, lire: (async () => v) as never });
      expect(r).toMatchObject({ ok: false, repli: "saisie-manuelle" });
      expect(f.appels).toHaveLength(0);
      expect(f.demandesEngage).toHaveLength(0);
    }
    expect(PARAM_LECTURE_CAPTURE_CLAUDE).toBe("tableau.lectureCaptureClaude");
  });
});

describe("jetonsImage", () => {
  it("palier haute résolution, plafonné à 4 784", () => {
    expect(jetonsImage(882, 1568)).toBe(1792);
    expect(jetonsImage(1080, 1920)).toBe(2691);
    expect(jetonsImage(2576, 2576)).toBe(4784);
  });
});

describe("service avec faux client", () => {
  it("allumé : 1 appel, Sonnet, 8 000 jetons, medium, 1 image, étape de la lecture ; brouillon à relire", async () => {
    const f = fabrique();
    const r = await lireCaptureTableau("v1", image(882, 1568), "usine", f.deps);
    expect(f.appels).toHaveLength(1);
    const a = f.appels[0];
    expect(a.role.modele).toBe("claude-sonnet-5-5");
    expect(MODELE_CLAUDE_VIDEO).toBe("claude-sonnet-5-5");
    expect(a.role.maxTokens).toBe(8000);
    expect(a.role.effort).toBe("medium");
    expect(a.entree.images).toHaveLength(1);
    expect(a.entree.images?.[0].base64).toBe("AAAA");
    expect(a.options.etape).toBe(ETAPE_LECTURE_CAPTURE);
    expect(a.options.origine).toBe("usine");
    expect(a.options.plafondPropre).toMatchObject({ id: "tblec", prefixeEtape: "Tableau de bord · lecture capture", defautUsd: 0.25 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("claude");
      expect(r.aRelire).toHaveLength(4); // 2 indicateurs + 2 points, aucun validé d'office
    }
  });
  it("image au-delà de 1 568 px : repli sans appel ; 882 × 1 568 : appel", async () => {
    const f = fabrique();
    const refus = await lireCaptureTableau("v1", image(1080, 1920), "studio", f.deps);
    expect(refus).toMatchObject({ ok: false, repli: "saisie-manuelle" });
    expect(f.appels).toHaveLength(0);
    await lireCaptureTableau("v1", image(882, 1568), "studio", f.deps);
    expect(f.appels).toHaveLength(1);
  });
  it("échec, simulation, texte vide, exception, réponse illisible, schéma faux : repli", async () => {
    const cas: unknown[] = [
      { ok: false, arret: "plafond-video", message: "x" },
      { ok: true, simule: true, coutUsd: 0, modele: "simulation" },
      { ok: true, simule: false, texte: "  ", coutUsd: 0, modele: "x" },
      new Error("coupure"),
      { ok: true, simule: false, texte: "pas du json", coutUsd: 0, modele: "x" },
      { ok: true, simule: false, texte: JSON.stringify({ ...donnee, version: "autre" }), coutUsd: 0, modele: "x" },
    ];
    for (const c of cas) {
      const f = fabrique(c);
      const r = await lireCaptureTableau("v1", image(882, 1568), "studio", f.deps);
      expect(r, String(c)).toMatchObject({ ok: false, repli: "saisie-manuelle" });
      expect(f.appels).toHaveLength(1);
      if (!r.ok) expect(r.raison).not.toMatch(/\d\s?(€|\$|euros?|dollars?|centimes?)/i);
    }
  });
});

describe("pire cas", () => {
  const requete = requeteLectureCapture(image(1568, 1568), MODELE_CLAUDE_VIDEO);
  if ("refus" in requete) throw new Error(requete.refus);
  const role: DefinitionRole = { id: "t", version: 1, consigne: requete.systeme.map((b) => b.texte).join("\n\n"), modele: MODELE_CLAUDE_VIDEO, effort: "medium", maxTokens: requete.maxTokens, sansPhrasesFixes: true, simuler: () => "" };
  const entree: EntreeRole = { contexte: {}, variable: requete.messages[0].contenu, images: requete.messages[0].images };

  it("≥ le pire cas de la requête ; compte 4 784 jetons pour une image au plafond du palier", () => {
    const base = pireCasRequete(role, entree);
    expect(pireCasLectureCaptureUsd(role, entree, image(1568, 1568))).toBeGreaterThan(base);
    expect(pireCasLectureCaptureUsd(role, entree, image(882, 1568))).toBeGreaterThanOrEqual(base);
    const surplusMax = pireCasLectureCaptureUsd(role, entree, image(2576, 2576)) - base;
    const attendu = pireCasLectureCaptureUsd(role, entree, { largeur: 28 * 100, hauteur: 28 * 100 }) - base;
    expect(surplusMax).toBeCloseTo(attendu, 10); // plafonné à 4 784
    expect(surplusMax).toBeGreaterThan(0);
  });
  it("× 1,2 ≤ 0,25 € aux taux 0,9 et 1,1 (image de 882 × 1 568)", () => {
    const pire = pireCasLectureCaptureUsd(role, { ...entree }, image(882, 1568));
    for (const taux of [0.9, 1.1]) expect(pire * 1.2 * taux).toBeLessThanOrEqual(0.25);
  });
});

describe("plafond dur", () => {
  it("la table et le total", () => {
    expect(PLAFONDS_CLAUDE_VIDEO_EUR).toEqual({ dmpln: 0.85, tbnar: 0.15, tblec: 0.25 });
    expect(PLAFOND_TOTAL_CLAUDE_VIDEO_EUR).toBe(1.25);
    expect(PREFIXES_ETAPE_CLAUDE_VIDEO.tblec).toBe(ETAPE_LECTURE_CAPTURE);
    expect(Object.isFrozen(PLAFONDS_CLAUDE_VIDEO_EUR)).toBe(true);
  });
  it("plafond propre atteint par cette vidéo : 0 appel, même si l'exécuteur accepterait tout", async () => {
    for (const taux of [0.9, 1.1]) {
      const f = fabrique(undefined, { tblec: 20 }, taux);
      const r = await lireCaptureTableau("v1", image(882, 1568), "studio", f.deps);
      expect(r).toMatchObject({ ok: false, repli: "saisie-manuelle" });
      expect(f.appels).toHaveLength(0);
    }
  });
  it("total 1,25 € atteint par les autres usages : 0 appel", async () => {
    const f = fabrique(undefined, { dmpln: 90, tbnar: 20 }, 1.1);
    const r = await lireCaptureTableau("v1", image(882, 1568), "studio", f.deps);
    expect(r.ok).toBe(false);
    expect(f.appels).toHaveLength(0);
    expect(f.demandesEngage.sort()).toEqual(["dmpln", "tblec", "tbnar"].sort());
  });
  it("sous les plafonds : l'appel part ; juste au-dessus de la limite du total : refus", async () => {
    const ok = fabrique(undefined, { tblec: 0, dmpln: 50, tbnar: 10 }, 1);
    await lireCaptureTableau("v1", image(882, 1568), "studio", ok.deps);
    expect(ok.appels).toHaveLength(1);
    // taux 1 : plafond total = 125 centimes de $ ; avec une demande > 5, 120 engagés → refus.
    const pas = fabrique(undefined, { dmpln: 110, tbnar: 10 }, 1);
    await lireCaptureTableau("v1", image(882, 1568), "studio", pas.deps);
    expect(pas.appels).toHaveLength(0);
  });
  it("montant engagé invalide (NaN, négatif, infini) : 0 appel et repli gratuit", async () => {
    const cas: Array<Record<string, number>> = [
      { tblec: Number.NaN },
      { dmpln: Number.NaN },
      { tbnar: Number.NaN },
      { dmpln: -1000 },
      { tblec: -1000 },
      { tbnar: -1000 },
      { dmpln: Number.NEGATIVE_INFINITY },
      // Un engagé négatif ne doit pas compenser l'autre (total réel 200 c$ > 125, somme brute 0).
      { dmpln: -200, tbnar: 200 },
      { dmpln: 200, tbnar: -200 },
    ];
    for (const engages of cas) {
      const f = fabrique(undefined, engages, 1);
      const r = await lireCaptureTableau("v1", image(882, 1568), "studio", f.deps);
      expect(r, JSON.stringify(engages)).toMatchObject({ ok: false, repli: "saisie-manuelle" });
      expect(f.appels, JSON.stringify(engages)).toHaveLength(0);
    }
  });
  it("taux invalide (0, NaN, négatif, infini) : 0 appel et repli gratuit", async () => {
    for (const taux of [0, Number.NaN, -1.1, Number.POSITIVE_INFINITY]) {
      const f = fabrique(undefined, {}, taux);
      const r = await lireCaptureTableau("v1", image(882, 1568), "studio", f.deps);
      expect(r, String(taux)).toMatchObject({ ok: false, repli: "saisie-manuelle" });
      expect(f.appels, String(taux)).toHaveLength(0);
    }
  });
  it("réglage de plafond monté à 5 $ : l'exécuteur le verrait, le plafond dur refuse quand même", async () => {
    const f = fabrique(undefined, { tblec: 24 }, 1);
    const deps = { ...f.deps, lire: (async (id: string) => (id === "tableau.plafondLectureCaptureUsd" ? 5 : true)) as never } as DepsLectureCapture;
    const r = await lireCaptureTableau("v1", image(882, 1568), "studio", deps);
    expect(r.ok).toBe(false);
    expect(f.appels).toHaveLength(0);
  });
});

describe("gardes statiques", () => {
  const racine = join(__dirname, "..", "..");
  const fichier = join(racine, "src", "services", "lecture-capture-claude.ts");
  const source = readFileSync(fichier, "utf8");

  it("un seul modèle : sans haiku, fable ni opus", () => {
    expect(source).not.toMatch(/haiku|fable|opus/i);
    expect(source).toContain('MODELE_CLAUDE_VIDEO = "claude-sonnet-5-5"');
  });
  it("aucun fetch, aucun appel direct à Claude ; fournisseurs en lecture seule", () => {
    expect(source).not.toMatch(/fetch\(|appelerClaude/);
    const imports = source.split("\n").filter((l) => /^import\b/.test(l) && l.includes("@/fournisseurs/"));
    expect(imports.some((l) => l.includes("claude/client") && !l.startsWith("import type "))).toBe(false);
    expect(imports.filter((l) => !l.startsWith("import type ")).every((l) => l.includes("claude/tarifs"))).toBe(true);
    expect(source).toMatch(/import "server-only"/);
  });
  it("table d'argent littérale commune", () => {
    expect(source).toContain("export const PLAFONDS_CLAUDE_VIDEO_EUR = Object.freeze({ dmpln: 0.85, tbnar: 0.15, tblec: 0.25 } as const);");
    expect(source).toContain("export const PLAFOND_TOTAL_CLAUDE_VIDEO_EUR = 1.25;");
    expect(source).toContain(
      'export const PREFIXES_ETAPE_CLAUDE_VIDEO = Object.freeze({ dmpln: "Démo · plan de scènes", tbnar: "Tableau de bord · narration", tblec: "Tableau de bord · lecture capture" } as const);',
    );
  });
  it("aucun fichier de src/components n'importe le service (écran : G4-08-b)", () => {
    const trouves: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx|mjs|js)$/.test(n) && /lecture-capture-claude/.test(readFileSync(p, "utf8"))) trouves.push(p);
      }
    };
    parcourir(join(racine, "src", "components"));
    expect(trouves).toEqual([]);
  });
});
