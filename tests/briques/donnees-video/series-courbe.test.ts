/**
 * Courbe à plusieurs séries tirée d'un tableau de bord (G4-11-SERIES-v19c). DONNÉE ENTIÈREMENT FICTIVE.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { nombresPermis } from "@/briques/donnees-video/garde-chiffres";
import { planDepuisDonnees } from "@/briques/donnees-video/plan-depuis-donnees";
import { courbeDesSeries } from "@/briques/donnees-video/series-courbe";
import type { SerieTableau, TableauDeBord } from "@/briques/donnees-video/types";
import { POINTS_MAX, POINTS_MIN, SERIES_MAX, SERIES_MIN, valider } from "@/briques/plan-scenes-donnees/courbe-series";

const XS = ["S1", "S2", "S3", "S4"];
const serie = (id: string, valeurs: number[], unite = "visites", xs = XS): SerieTableau => ({
  id,
  libelle: `Série ${id}`,
  unite,
  points: valeurs.map((valeur, i) => ({ x: xs[i]!, valeur })),
});

const tableau = (series: SerieTableau[]): TableauDeBord => ({
  version: "tableau-de-bord.v1",
  titre: "Exemple fictif",
  periode: { debut: "2026-01-01", fin: "2026-03-31", libelle: "Trimestre (exemple)" },
  source: "Outil exemple",
  indicateurs: [{ id: "ca-mars", libelle: "Mars", valeur: 1240, unite: "€", precision: 0, sens: "hausse-bonne" }],
  series,
  comparaisons: [],
  alertes: [],
  calculs: [],
});

const OPTIONS = { format: { largeur: 1080, hauteur: 1920, fps: 25 as const }, dureeMs: 20000 };
// Copie figée de ce que rend planDepuisDonnees (non touché) sur deux() avant cette fiche.
const PLAN_FIGE = "{\"resultat\":{\"plan\":{\"version\":\"plan-scenes-1\",\"format\":{\"largeur\":1080,\"hauteur\":1920,\"fps\":25},\"facecam\":false,\"dureeMs\":20000,\"habillage\":{\"fond\":\"ivoire\",\"accent\":\"terracotta\"},\"mots\":[],\"scenes\":[{\"id\":\"s1\",\"version\":1,\"mots\":{\"premier\":0,\"dernier\":0},\"debutMs\":0,\"finMs\":5000,\"niveau\":1,\"position\":\"centre\",\"transition\":{\"entree\":\"fondu\",\"sortie\":\"fondu\",\"dureeMs\":400},\"piece\":\"legende\",\"parametres\":{\"texte\":\"Exemple fictif\",\"sousTexte\":\"Trimestre (exemple)\",\"style\":\"bandeau\"},\"empreinte\":\"1b22194f73d4418f\"},{\"id\":\"s2\",\"version\":1,\"mots\":{\"premier\":0,\"dernier\":0},\"debutMs\":5000,\"finMs\":10000,\"niveau\":1,\"position\":\"centre\",\"transition\":{\"entree\":\"fondu\",\"sortie\":\"fondu\",\"dureeMs\":400},\"piece\":\"compteur\",\"parametres\":{\"valeur\":1240,\"unite\":\"\u20ac\",\"libelle\":\"Mars\",\"surMot\":0},\"empreinte\":\"fd20a82f1de26e6f\"},{\"id\":\"s3\",\"version\":1,\"mots\":{\"premier\":0,\"dernier\":0},\"debutMs\":10000,\"finMs\":15000,\"niveau\":1,\"position\":\"centre\",\"transition\":{\"entree\":\"fondu\",\"sortie\":\"fondu\",\"dureeMs\":400},\"piece\":\"graphique\",\"parametres\":{\"type\":\"courbe\",\"titre\":\"S\u00e9rie visites\",\"valeurs\":[{\"libelle\":\"S1\",\"valeur\":310},{\"libelle\":\"S2\",\"valeur\":355},{\"libelle\":\"S3\",\"valeur\":400},{\"libelle\":\"S4\",\"valeur\":380}],\"enAvant\":2},\"empreinte\":\"66fe449d271f2554\"},{\"id\":\"s4\",\"version\":1,\"mots\":{\"premier\":0,\"dernier\":0},\"debutMs\":15000,\"finMs\":20000,\"niveau\":1,\"position\":\"centre\",\"transition\":{\"entree\":\"fondu\",\"sortie\":\"fondu\",\"dureeMs\":400},\"piece\":\"graphique\",\"parametres\":{\"type\":\"courbe\",\"titre\":\"S\u00e9rie demandes\",\"valeurs\":[{\"libelle\":\"S1\",\"valeur\":20},{\"libelle\":\"S2\",\"valeur\":25},{\"libelle\":\"S3\",\"valeur\":40},{\"libelle\":\"S4\",\"valeur\":60}],\"enAvant\":3},\"empreinte\":\"c553a83b0f8385ba\"}]},\"remarques\":[{\"code\":\"VERSION\",\"message\":\"Version du plan mise \u00e0 plan-scenes-1.\"},{\"code\":\"TRANSITION_ADOUCIE\",\"message\":\"Transition remplac\u00e9e par une transition douce.\",\"sceneId\":\"s1\"},{\"code\":\"TRANSITION_ADOUCIE\",\"message\":\"Transition remplac\u00e9e par une transition douce.\",\"sceneId\":\"s2\"},{\"code\":\"TRANSITION_ADOUCIE\",\"message\":\"Transition remplac\u00e9e par une transition douce.\",\"sceneId\":\"s3\"},{\"code\":\"TRANSITION_ADOUCIE\",\"message\":\"Transition remplac\u00e9e par une transition douce.\",\"sceneId\":\"s4\"}]},\"remarques\":[]}";
const deux = () => tableau([serie("visites", [310, 355, 400, 380]), serie("demandes", [20, 25, 40, 60])]);

describe("courbeDesSeries", () => {
  it("2 séries comparables : paramètres valides, valeurs recopiées, enAvant = plus haute dernière valeur", () => {
    const r = courbeDesSeries(deux());
    expect(r.parametres).not.toBeNull();
    expect(valider(r.parametres!).ok).toBe(true);
    expect(r.parametres).toEqual({
      titre: "Exemple fictif",
      abscisses: XS,
      series: [
        { nom: "Série visites", valeurs: [310, 355, 400, 380] },
        { nom: "Série demandes", valeurs: [20, 25, 40, 60] },
      ],
      enAvant: 0,
    });
    expect(r.notes).toEqual([]);
  });

  it("bornes locales = bornes de la pièce (2 à 4 séries, 3 à 12 points)", () => {
    expect([SERIES_MIN, SERIES_MAX, POINTS_MIN, POINTS_MAX]).toEqual([2, 4, 3, 12]);
    const douze = Array.from({ length: 12 }, (_, i) => `S${i}`);
    const val = (k: number) => douze.map((_, i) => i + k);
    const r = courbeDesSeries(tableau([serie("a", val(0), "visites", douze), serie("b", val(1), "visites", douze)]));
    expect(r.parametres).not.toBeNull();
    expect(valider(r.parametres!).ok).toBe(true);
  });

  it("égalité des dernières valeurs : la première série", () => {
    const r = courbeDesSeries(tableau([serie("a", [1, 2, 3, 9]), serie("b", [4, 5, 6, 9])]));
    expect(r.parametres?.enAvant).toBe(0);
    const r2 = courbeDesSeries(tableau([serie("a", [1, 2, 3, 5]), serie("b", [4, 5, 6, 9])]));
    expect(r2.parametres?.enAvant).toBe(1);
  });

  it("unités différentes → null + note", () => {
    const r = courbeDesSeries(tableau([serie("a", [1, 2, 3, 4]), serie("b", [1, 2, 3, 4], "€")]));
    expect(r.parametres).toBeNull();
    expect(r.notes.length).toBeGreaterThan(0);
  });

  it("unités égales après trim", () => {
    const r = courbeDesSeries(tableau([serie("a", [1, 2, 3, 4], "visites"), serie("b", [1, 2, 3, 4], " visites ")]));
    expect(r.parametres).not.toBeNull();
  });

  it("abscisses différentes → null", () => {
    const r = courbeDesSeries(tableau([serie("a", [1, 2, 3, 4]), serie("b", [1, 2, 3, 4], "visites", ["S1", "S2", "S3", "S5"])]));
    expect(r.parametres).toBeNull();
  });

  it("1 seule série → null", () => {
    const r = courbeDesSeries(tableau([serie("a", [1, 2, 3, 4])]));
    expect(r.parametres).toBeNull();
    expect(r.notes.length).toBeGreaterThan(0);
  });

  it("garde le premier groupe d'au moins 2 séries", () => {
    const r = courbeDesSeries(tableau([serie("a", [1, 2, 3, 4], "€"), serie("b", [1, 2, 3, 4]), serie("c", [5, 6, 7, 8])]));
    expect(r.parametres?.series.map((s) => s.nom)).toEqual(["Série b", "Série c"]);
  });

  it("5 séries comparables → 4 gardées + note", () => {
    const cinq = ["a", "b", "c", "d", "e"].map((id, i) => serie(id, [i, i + 1, i + 2, i + 3]));
    const r = courbeDesSeries(tableau(cinq));
    expect(r.parametres?.series).toHaveLength(4);
    expect(r.parametres?.series.map((s) => s.nom)).toEqual(["Série a", "Série b", "Série c", "Série d"]);
    expect(r.notes).toEqual(["5 séries : les 4 premières montrées"]);
  });

  it("2 points → null + note", () => {
    const xs = ["S1", "S2"];
    const r = courbeDesSeries(tableau([serie("a", [1, 2], "visites", xs), serie("b", [3, 4], "visites", xs)]));
    expect(r.parametres).toBeNull();
    expect(r.notes.length).toBeGreaterThan(0);
  });

  it("valeur négative → null + note", () => {
    const r = courbeDesSeries(tableau([serie("a", [1, -2, 3, 4]), serie("b", [1, 2, 3, 4])]));
    expect(r.parametres).toBeNull();
    expect(r.notes.length).toBeGreaterThan(0);
  });

  it("aucun chiffre inventé : chaque valeur est permise par la donnée", () => {
    const d = deux();
    const permis = new Set(nombresPermis(d));
    for (const s of courbeDesSeries(d).parametres!.series) for (const v of s.valeurs) expect(permis.has(v)).toBe(true);
  });

  it("ne modifie pas la donnée ; entrée illisible → null sans lever", () => {
    const d = deux();
    const avant = JSON.stringify(d);
    courbeDesSeries(d);
    expect(JSON.stringify(d)).toBe(avant);
    expect(() => courbeDesSeries({} as never)).not.toThrow();
    expect(courbeDesSeries({} as never).parametres).toBeNull();
    expect(courbeDesSeries(null as never).parametres).toBeNull();
  });

  it("éteint = identique : personne dans src/ n'importe series-courbe, planDepuisDonnees inchangé", () => {
    const fichiers: string[] = [];
    const parcourir = (dos: string) => {
      for (const n of readdirSync(dos)) {
        const c = join(dos, n);
        if (statSync(c).isDirectory()) parcourir(c);
        else if (/\.(ts|tsx)$/.test(n) && n !== "series-courbe.ts") fichiers.push(c);
      }
    };
    parcourir(join(process.cwd(), "src"));
    expect(fichiers.filter((f) => readFileSync(f, "utf8").includes("series-courbe\""))).toEqual([]);
    expect(fichiers.some((f) => f.split(sep).join("/").endsWith("donnees-video/plan-depuis-donnees.ts"))).toBe(true);
    const lecture = readFileSync(join(process.cwd(), "src/briques/donnees-video/plan-depuis-donnees.ts"), "utf8");
    expect(lecture).not.toContain("series-courbe");
    const d = deux();
    expect(JSON.stringify(planDepuisDonnees(d, OPTIONS))).toBe(PLAN_FIGE);
  });
});
