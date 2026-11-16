/**
 * Plan de scènes depuis un tableau de bord (G4-04). DONNÉE ENTIÈREMENT FICTIVE : aucun chiffre réel.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nombresAffirmes } from "../../../src/domaine/nombres-fr";
import { nombresPermis } from "../../../src/briques/donnees-video/garde-chiffres";
import { planDepuisDonnees } from "../../../src/briques/donnees-video/plan-depuis-donnees";
import type { TableauDeBord } from "../../../src/briques/donnees-video/types";
import { memeValeur } from "../../../src/domaine/nombres-fr";

const FORMAT = { largeur: 1080, hauteur: 1920, fps: 25 as const };
const OPT = { format: FORMAT, dureeMs: 30000 };

const donnee = (surcharge: Partial<TableauDeBord> = {}): TableauDeBord => ({
  version: "tableau-de-bord.v1",
  titre: "Bilan fictif du trimestre",
  periode: { debut: "2026-01-01", fin: "2026-03-31", libelle: "Premier trimestre (exemple)" },
  source: "Outil exemple",
  indicateurs: [
    { id: "visites-fev", libelle: "Visites février", valeur: 1000, unite: "visites", precision: 0, sens: "hausse-bonne" },
    { id: "visites-mars", libelle: "Visites mars", valeur: 1240, unite: "visites", precision: 0, sens: "hausse-bonne" },
    { id: "rebond", libelle: "Rebond", valeur: 12.345, unite: "%", precision: 1, sens: "baisse-bonne" },
  ],
  series: [
    {
      id: "visites",
      libelle: "Visites par semaine",
      unite: "visites",
      points: Array.from({ length: 12 }, (_, k) => ({ x: `S${k + 1}`, valeur: 300 + k * 10 })),
    },
  ],
  comparaisons: [{ avant: "visites-fev", apres: "visites-mars" }],
  alertes: [{ texte: "Le rebond reste à surveiller", indicateurId: "rebond" }],
  calculs: [],
  ...surcharge,
});

const pieces = (r: ReturnType<typeof planDepuisDonnees>) => r.resultat.plan.scenes.map((s) => s.piece);

describe("planDepuisDonnees", () => {
  it("donnée exemple : plan valide, ordre attendu, graphique à 8 valeurs et remarque dite", () => {
    const r = planDepuisDonnees(donnee(), OPT);
    expect(pieces(r), JSON.stringify(r.resultat.remarques.filter((x) => x.code !== "TRANSITION_ADOUCIE"))).toEqual(["legende", "compteur", "carte-kpi", "compteur", "graphique", "avant-apres", "legende"]);
    const g = r.resultat.plan.scenes.find((s) => s.piece === "graphique")!;
    expect((g.parametres as { valeurs: unknown[] }).valeurs).toHaveLength(8);
    expect((g.parametres as { valeurs: { libelle: string }[] }).valeurs[0]!.libelle).toBe("S5");
    expect(r.remarques.some((m) => m.includes("12 points") && m.includes("8 derniers"))).toBe(true);
    for (const s of r.resultat.plan.scenes) expect(s.empreinte).toBeTruthy();
  });

  it("série avec valeur négative : pas de graphique, légende qui dit la valeur, remarque", () => {
    const d = donnee({
      series: [{ id: "solde", libelle: "Solde", unite: "visites", points: [{ x: "S1", valeur: 5 }, { x: "S2", valeur: -3 }, { x: "S3", valeur: 4 }] }],
    });
    const r = planDepuisDonnees(d, OPT);
    expect(pieces(r)).not.toContain("graphique");
    const txt = JSON.stringify(r.resultat.plan.scenes.map((s) => s.parametres));
    expect(txt).toContain("-3".replace(".", ","));
    expect(r.remarques.some((m) => m.includes("négative"))).toBe(true);
  });

  it("tout nombre posé dans les paramètres appartient à nombresPermis", () => {
    for (const d of [donnee(), donnee({ series: [{ id: "s", libelle: "Petite série", unite: "visites", points: [{ x: "A", valeur: 310 }, { x: "B", valeur: 355 }] }] })]) {
      const permis = nombresPermis(d);
      const ok = (v: number) => permis.some((p) => memeValeur(p, v));
      const r = planDepuisDonnees(d, { ...OPT, synthese: true });
      for (const s of r.resultat.plan.scenes) {
        const p = s.parametres as unknown as {
          valeur?: number; valeurs?: { valeur: number }[]; serie?: number[];
          avant?: { valeur: number }; apres?: { valeur: number };
          texte?: string; sousTexte?: string; titre?: string; libelle?: string; kpis?: { valeur: string }[];
        };
        if (typeof p.valeur === "number") expect(ok(p.valeur), `${s.piece} valeur`).toBe(true);
        for (const v of p.valeurs ?? []) expect(ok(v.valeur)).toBe(true);
        for (const v of p.serie ?? []) expect(ok(v)).toBe(true);
        for (const k of ["avant", "apres"]) { const b = k === "avant" ? p.avant : p.apres; if (b) expect(ok(b.valeur)).toBe(true); }
        const textes: string[] = [p.texte, p.sousTexte, p.titre, p.libelle, ...(p.kpis ?? []).map((x) => x.valeur)].filter((t) => typeof t === "string");
        for (const t of textes) for (const n of nombresAffirmes(t)) expect(ok(n.valeur), `« ${t} »`).toBe(true);
      }
    }
  });

  it("synthèse éteinte par défaut ; seul true pose le tableau de bord, valeurs en texte ≤ 12 caractères", () => {
    expect(pieces(planDepuisDonnees(donnee(), OPT))).not.toContain("tableau-de-bord");
    expect(pieces(planDepuisDonnees(donnee(), { ...OPT, synthese: 1 as unknown as boolean }))).not.toContain("tableau-de-bord");
    const r = planDepuisDonnees(donnee(), { ...OPT, synthese: true });
    const t = r.resultat.plan.scenes.find((s) => s.piece === "tableau-de-bord")!;
    const kpis = (t.parametres as { kpis: { valeur: string }[] }).kpis;
    expect(kpis.map((k) => k.valeur)).toContain("12,3 %");
    for (const k of kpis) expect(k.valeur.length).toBeLessThanOrEqual(12);
  });

  it("KPI trop long omis avec remarque", () => {
    const d = donnee({ indicateurs: [
      { id: "a", libelle: "Grand", valeur: 123456789, unite: "visites", precision: 0, sens: "hausse-bonne" },
      { id: "b", libelle: "B", valeur: 5, unite: "%", precision: 0, sens: "hausse-bonne" },
      { id: "c", libelle: "C", valeur: 7, unite: "%", precision: 0, sens: "hausse-bonne" },
    ], comparaisons: [], alertes: [] });
    const r = planDepuisDonnees(d, { ...OPT, synthese: true });
    expect(r.remarques.some((m) => m.includes("12 caractères"))).toBe(true);
  });

  it("avec des mots : une plage par scène, et chaque scène retirée par le validateur est dite", () => {
    const mots = Array.from({ length: 30 }, (_, k) => ({ texte: "mot", debutMs: k * 800, finMs: k * 800 + 700 }));
    const r = planDepuisDonnees(donnee(), { ...OPT, mots, dureeMs: 24000 });
    const sc = r.resultat.plan.scenes;
    expect(sc[0]!.piece).toBe("legende");
    expect(sc[0]!.mots.premier).toBe(0);
    for (let k = 1; k < sc.length; k++) expect(sc[k]!.mots.premier).toBeGreaterThan(sc[k - 1]!.mots.premier);
    // Les mots « mot » ne disent aucun chiffre : le validateur retire les scènes chiffrées, et le dit.
    expect(sc.length).toBeLessThan(7);
    expect(r.remarques.some((m) => m.includes("retirée"))).toBe(true);
  });

  it("unités : « heures » (6 caractères) et unité vide ne sont jamais réparées en « % » inventé", () => {
    const ind = (id: string, valeur: number, unite: string) => ({ id, libelle: `Indicateur ${id}`, valeur, unite, precision: 0, sens: "hausse-bonne" as const });
    const cas = [
      // rang 0 compteur, rang 1 carte-kpi, rang 2 compteur
      donnee({ indicateurs: [ind("a", 20, ""), ind("b", 20, "heures"), ind("c", 20, "  ")], comparaisons: [], alertes: [] }),
      // unité vide en carte-kpi (rang 1) et en avant/après
      donnee({ indicateurs: [ind("a", 10, "heures"), ind("b", 20, ""), ind("c", 30, "h"), ind("d", 40, "")], comparaisons: [{ avant: "b", apres: "d" }], alertes: [] }),
    ];
    for (const d of cas) {
      const r = planDepuisDonnees(d, OPT);
      const reparees = r.resultat.remarques.filter((x) => x.code === "PARAMETRES_REPARES");
      expect(reparees, JSON.stringify(reparees)).toEqual([]);
      const txt = JSON.stringify(r.resultat.plan.scenes.map((s) => s.parametres));
      expect(txt).not.toContain("%");
      expect(txt).not.toContain('"suffixe":" "');
    }
    const kpi = planDepuisDonnees(cas[0]!, OPT).resultat.plan.scenes.find((s) => s.piece === "carte-kpi")!;
    expect(JSON.stringify(kpi.parametres)).toContain("heures");
  });

  it("jamais silencieux : une réparation du validateur est remontée dans remarques", () => {
    const d = donnee({ indicateurs: [{ id: "a", libelle: "Délai", valeur: 20, unite: "heures", precision: 0, sens: "hausse-bonne" }], comparaisons: [], alertes: [] });
    const r = planDepuisDonnees(d, OPT);
    for (const x of r.resultat.remarques.filter((m) => m.code === "PARAMETRES_REPARES")) {
      expect(r.remarques.some((m) => m.includes(x.message))).toBe(true);
    }
  });

  it("garde statique : rien dans src/ n'importe plan-depuis-donnees ; pas d'import @/", () => {
    const marche = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? marche(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
      });
    const src = join(process.cwd(), "src");
    for (const f of marche(src)) {
      if (f.endsWith("plan-depuis-donnees.ts")) continue;
      expect(readFileSync(f, "utf8"), f).not.toMatch(/plan-depuis-donnees/);
    }
    const propre = readFileSync(join(src, "briques/donnees-video/plan-depuis-donnees.ts"), "utf8");
    expect(propre).not.toMatch(/from\s+["']@\//);
  });
});
