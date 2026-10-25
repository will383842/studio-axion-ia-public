import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { choisirPlan, empreintePlan, ErreurPlanToile, type EntreePlan, type PlanToile } from "@/briques/visuels/continu/plan-toile";
import { construireSchemaToile } from "@/domaine/visuels/continu/schema-toile";
import { genererConsigneToile } from "@/visuels/continu/texte/consigne-toile";
import { construirePaquetToile, lirePaquetToile } from "@/visuels/continu/texte/session-toile";
import { ecrireToileSimulation } from "@/visuels/continu/texte/simulation-toile";
import { GABARITS_ESSAI, PARCOURS_ESSAI, REGISTRES_ESSAI, SUJETS_ESSAI } from "./continu-plan-essai";

const base: EntreePlan = { sujet: "Par où commencer avec l’IA", version: 1, recents: [], variete: "equilibre", format: "4:5" };
const plan = (e: Partial<EntreePlan> = {}) => choisirPlan({ ...base, ...e }, REGISTRES_ESSAI);
const parType = new Map(GABARITS_ESSAI.map((g) => [g.type, g]));
const parcoursDe = (p: PlanToile) => PARCOURS_ESSAI.find((x) => x.id === p.parcours)!;

/** Une page de parcours compte comme un seul bloc ; la relance précède l'appel de la même famille, par construction. */
function famillesALaSuite(p: PlanToile): string[] {
  const doublons: string[] = [];
  for (let i = 1; i < p.types.length; i++) {
    const a = parType.get(p.types[i - 1])!;
    const b = parType.get(p.types[i])!;
    if (a.famille === "parcours" && b.famille === "parcours") continue;
    if (a.role === "relance" && b.role === "appel") continue;
    if (a.famille === b.famille) doublons.push(`${a.type} ${b.type}`);
  }
  return doublons;
}

const sombres = (p: PlanToile) => p.types.filter((t) => parType.get(t)!.sombre).length;

const echantillon: PlanToile[] = [];
for (const sujet of SUJETS_ESSAI)
  for (const variete of ["sobre", "equilibre", "varie"] as const)
    for (const intention of [undefined, "eveil", "methode", "preuve"] as const)
      for (let version = 1; version <= 4; version++) echantillon.push(plan({ sujet, variete, intention, version }));

describe("P4b : choisirPlan", () => {
  it("est déterministe : même entrée, même plan", () => {
    for (const sujet of SUJETS_ESSAI) expect(plan({ sujet })).toEqual(plan({ sujet }));
  });

  it("change de plan quand la version avance d'un cran", () => {
    for (const sujet of SUJETS_ESSAI) for (let v = 1; v <= 5; v++) expect(plan({ sujet, version: v + 1 }).types, `${sujet} v${v}`).not.toEqual(plan({ sujet, version: v }).types);
  });

  it("ne met jamais deux familles identiques à la suite", () => {
    for (const p of echantillon) expect(famillesALaSuite(p), p.types.join(" ")).toEqual([]);
  });

  it("ne pose jamais deux pages sombres, ni deux pages orange fort, ni plus de deux cas", () => {
    for (const p of echantillon) {
      expect(sombres(p), p.types.join(" ")).toBeLessThanOrEqual(1);
      expect(p.types.filter((t) => parType.get(t)!.orangeFort).length).toBeLessThanOrEqual(1);
      expect(p.types.filter((t) => parType.get(t)!.famille === "cas").length).toBeLessThanOrEqual(2);
    }
  });

  it("compose 3 à 6 pages, sans plaquette inactive ni d'essai, une seule fois chacune", () => {
    for (const p of echantillon) {
      expect(p.types.length).toBeGreaterThanOrEqual(3);
      expect(p.types.length).toBeLessThanOrEqual(6);
      expect(new Set(p.types).size).toBe(p.types.length);
      for (const t of p.types) expect(["D01", "D02", "X09"]).not.toContain(t);
    }
  });

  it("respecte le minimum de familles du curseur Variété", () => {
    const min = { sobre: 2, equilibre: 3, varie: 4 } as const;
    for (const variete of ["sobre", "equilibre", "varie"] as const)
      for (const sujet of SUJETS_ESSAI) {
        const p = plan({ sujet, variete });
        expect(new Set(p.types.map((t) => parType.get(t)!.famille)).size, `${variete} ${p.types.join(" ")}`).toBeGreaterThanOrEqual(min[variete]);
      }
  });

  it("PA et PH : exactement 4 pages de parcours, d'un seul tenant, et leur page sombre reste la seule", () => {
    const vus = new Set<string>();
    for (const sujet of SUJETS_ESSAI)
      for (let version = 1; version <= 12; version++) {
        const p = plan({ sujet, version, intention: "methode" });
        if (p.parcours === "PA" || p.parcours === "PH") {
          vus.add(p.parcours);
          const pages = p.types.filter((t) => t.startsWith(p.parcours));
          expect(pages).toEqual(parcoursDe(p).pagesTypes);
          expect(pages).toHaveLength(4);
          const debut = p.types.indexOf(pages[0]);
          expect(p.types.slice(debut, debut + 4)).toEqual(pages);
          expect(sombres(p)).toBe(1);
        }
      }
    expect([...vus].sort()).toEqual(["PA", "PH"]);
  });

  it("préfère les parcours de l'intention", () => {
    const attendus = { eveil: ["PC", "PD", "PB"], methode: ["PA", "PG", "PH", "PF"], preuve: ["PB", "PE", "PF"] } as const;
    for (const intention of ["eveil", "methode", "preuve"] as const) for (const sujet of SUJETS_ESSAI) expect(attendus[intention]).toContain(plan({ sujet, intention, variete: "sobre" }).parcours);
  });

  it("couverture décochée et parcours qui ne commence pas : prend un autre parcours", () => {
    const familles = ["liste", "comparaison", "cas", "appel"] as const;
    for (const sujet of SUJETS_ESSAI) {
      const p = plan({ sujet, familles: [...familles], intention: "eveil", variete: "sobre" });
      expect(parcoursDe(p).commence, p.parcours).toBe(true);
      expect(p.types[0]).toBe(parcoursDe(p).pagesTypes[0]);
    }
  });

  it("avec des récents : pas la même suite", () => {
    for (const sujet of SUJETS_ESSAI) {
      const sans = plan({ sujet });
      const avec = plan({ sujet, recents: [empreintePlan(sans.types)] });
      expect(avec.types.join(" ")).not.toBe(sans.types.join(" "));
    }
  });

  it("pose un raccord sur la couture 1/2 quand le parcours ne commence pas, au milieu des bords libres", () => {
    let vus = 0;
    for (const p of echantillon) {
      if (parcoursDe(p).commence) continue;
      vus++;
      const r = p.raccords.find((x) => x.couture === 1);
      expect(r, p.types.join(" ")).toBeDefined();
      if (p.types[0] === "C01" && p.types[1] !== "L01") expect(r!.y).toBe(600);
      // C01 (droite 300-900) → L01 (gauche 500-1300) : intersection 500-900, milieu 700.
      if (p.types[0] === "C01" && p.types[1] === "L01") expect(r!.y).toBe(700);
    }
    expect(vus).toBeGreaterThan(0);
  });

  it("ne pose aucun raccord sur une couture interne au parcours, au plus un par couture, et toujours un R01-R03", () => {
    for (const p of echantillon) {
      const pa = parcoursDe(p);
      const debut = p.types.indexOf(pa.pagesTypes[0]);
      const internes = new Set(pa.pagesTypes.slice(1).map((_, j) => debut + j + 1));
      const coutures = p.raccords.map((r) => r.couture);
      expect(new Set(coutures).size).toBe(coutures.length);
      for (const r of p.raccords) {
        expect(internes.has(r.couture)).toBe(false);
        expect(["R01", "R02", "R03"]).toContain(r.type);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeLessThanOrEqual(1350);
      }
      for (let c = 1; c < p.types.length; c++) if (!internes.has(c)) expect(coutures, `${p.types.join(" ")} couture ${c}`).toContain(c);
    }
  });

  it("vise le nombre de pages demandé (10 au plus)", () => {
    for (const pagesCible of [7, 8, 9, 10]) {
      const p = plan({ pagesCible, sujet: "Préparer la semaine" });
      expect(p.types.length).toBe(pagesCible);
    }
  });

  it("dit en une phrase claire quand les familles cochées rendent le plan impossible", () => {
    expect(() => plan({ familles: ["appel"], variete: "varie" })).toThrow(ErreurPlanToile);
    expect(() => plan({ familles: ["appel"], variete: "varie" })).toThrow(/familles cochées/u);
    expect(() => plan({ pagesCible: 11 })).toThrow(/de 3 à 10 pages/u);
    expect(() => plan({ pagesCible: 2 })).toThrow(/de 3 à 10 pages/u);
  });

  it("refuse une version qui n'est pas un entier d'au moins 1", () => {
    for (const version of [1.5, Number.NaN, 0, -2, Number.POSITIVE_INFINITY])
      expect(() => plan({ version }), String(version)).toThrow(/version.*entier.*1/u);
  });

  it("écarte tout plan dont une couture externe n'a pas de raccord possible (bords libres disjoints)", () => {
    let vus = 0;
    for (const p of echantillon) {
      vus += p.types.includes("L03") || p.types.includes("K03") ? 1 : 0;
      for (let i = 1; i < p.types.length; i++) {
        expect(`${p.types[i - 1]} ${p.types[i]}`, p.types.join(" ")).not.toBe("C01 L03");
        expect(`${p.types[i - 1]} ${p.types[i]}`, p.types.join(" ")).not.toBe("L03 K03");
      }
    }
    expect(vus).toBeGreaterThan(0);
  });

  it("avec un seul plan possible, avancer la version le dit en une phrase", () => {
    const reglages = { sujet: "Préparer la semaine", familles: ["appel"], variete: "sobre", intention: "eveil" } as const;
    expect(plan({ ...reglages, version: 1 }).types.length).toBeGreaterThan(0);
    expect(() => plan({ ...reglages, version: 2 })).toThrow("Un seul plan possible avec ces réglages : cochez une famille de plus ou changez la variété pour en voir un autre.");
  });

  it("repère à la main deux contenus de même famille à la suite", () => {
    expect(famillesALaSuite({ parcours: "PB", types: ["C01", "L01", "L02", "A01"], raccords: [] })).toEqual(["L01 L02"]);
    expect(famillesALaSuite({ parcours: "PB", types: ["C01", "L01", "K01", "A02", "A01"], raccords: [] })).toEqual([]);
  });

  it("n'utilise par défaut que les registres de production (vides tant que les lots P3 ne sont pas fusionnés)", () => {
    expect(() => choisirPlan(base)).toThrow(ErreurPlanToile);
  });
});

describe("P4b : simulation des textes", () => {
  const schema = construireSchemaToile(GABARITS_ESSAI, PARCOURS_ESSAI, REGISTRES_ESSAI.raccords);

  it("remplit le plan avec les exemples du registre : la toile passe le schéma", () => {
    for (const sujet of SUJETS_ESSAI)
      for (let version = 1; version <= 3; version++) {
        const r = ecrireToileSimulation({ ...base, sujet, version }, REGISTRES_ESSAI);
        const lu = schema.safeParse(r.toile);
        expect(lu.success, JSON.stringify(lu.error?.issues)).toBe(true);
        expect(r.pourquoi).toHaveLength(r.toile.pages.length);
        expect(r.toile.pages.map((page) => page.type)).toEqual(r.plan.types);
        expect(r.mode).toBe("simulation");
      }
  });

  it("reprend le sujet en titre de couverture s'il tient dans son budget", () => {
    const r = ecrireToileSimulation({ ...base, sujet: "Gagner du temps sur les devis" }, REGISTRES_ESSAI);
    expect(r.toile.pages[0].titre).toBe("Gagner du temps sur les devis");
    expect(r.note).toBeUndefined();
  });

  it("applique au titre du paquet les mêmes contrôles : sujet vide, nombre, mot banni, lien ou trop long", () => {
    for (const sujet of ["   ", "10 astuces pour gagner du temps", "Je t’explique comment faire", "Voir https://exemple.fr/devis", "x".repeat(121)]) {
      const r = ecrireToileSimulation({ ...base, sujet }, REGISTRES_ESSAI);
      expect(r.titre.length, sujet).toBeGreaterThan(0);
      expect(r.titre, sujet).toBe(String(r.toile.pages[0].titre));
    }
    expect(ecrireToileSimulation({ ...base, sujet: "  Gagner du temps  " }, REGISTRES_ESSAI).titre).toBe("Gagner du temps");
  });

  it("sinon garde l'exemple et le dit dans une note", () => {
    const sujet = "Gagner du temps sur les devis, les relances et toutes les tâches répétitives";
    const r = ecrireToileSimulation({ ...base, sujet }, REGISTRES_ESSAI);
    expect(r.toile.pages[0].titre).not.toBe(sujet);
    expect(r.note).toBe("sujet non repris : trop long pour la couverture");
    expect(schema.safeParse(r.toile).success).toBe(true);
  });

  it("la version décale les choix", () => {
    const a = ecrireToileSimulation({ ...base, version: 1 }, REGISTRES_ESSAI);
    const b = ecrireToileSimulation({ ...base, version: 2 }, REGISTRES_ESSAI);
    expect(b.plan.types).not.toEqual(a.plan.types);
  });
});

describe("P4b : paquet de session", () => {
  const Paquet = construirePaquetToile(construireSchemaToile(GABARITS_ESSAI, PARCOURS_ESSAI, REGISTRES_ESSAI.raccords));
  const bon = () => {
    const r = ecrireToileSimulation(base, REGISTRES_ESSAI);
    return { version: "paquet-session-toile/1", sujet: base.sujet, titre: r.titre, pourquoi: r.pourquoi, toile: r.toile };
  };
  const lire = (o: unknown) => lirePaquetToile(typeof o === "string" ? o : JSON.stringify(o), Paquet);

  it("lit un paquet valide", () => {
    const r = lire(bon());
    expect(r.mode).toBe("session");
    expect(r.toile.pages.length).toBe(r.pourquoi.length);
  });

  it("refuse un JSON illisible, un paquet trop lourd et une mauvaise version, en phrases précises", () => {
    expect(() => lire("{ pas du json")).toThrow("Le paquet n'est pas un JSON lisible : vérifiez les accolades, les guillemets et les virgules.");
    expect(() => lire(" ".repeat(64 * 1024 + 1))).toThrow("Le paquet dépasse 64 Ko : il est refusé.");
    expect(() => lire({ ...bon(), version: "paquet-session-carrousel/1" })).toThrow(/Champ « version » : doit valoir « paquet-session-toile\/1 »/u);
  });

  it("exige une phrase de pourquoi par page", () => {
    const p = bon();
    expect(() => lire({ ...p, pourquoi: p.pourquoi.slice(1) })).toThrow(`Champ « pourquoi » : une phrase par page (${p.toile.pages.length} attendues, ${p.toile.pages.length - 1} reçues).`);
  });

  it("nomme la page fautive et la clé inconnue", () => {
    const p = bon();
    const pages = p.toile.pages.map((page, i) => (i === 1 ? { ...page, titre: "x".repeat(41) } : page));
    expect(() => lire({ ...p, toile: { ...p.toile, pages } })).toThrow(/Toile : la page 2 : titre : ne doit pas dépasser 40 caractères\./u);
    expect(() => lire({ ...p, couleur: "rouge" })).toThrow(/Champ « \(racine du paquet\) » : clé inconnue « couleur »\./u);
  });
});

describe("P4b : consigne de session", () => {
  it("consigne-session-toile.md est à jour (régénérée depuis les registres)", () => {
    const fichier = readFileSync(join(process.cwd(), "scripts/visuels/consigne-session-toile.md"), "utf8");
    expect(fichier).toBe(genererConsigneToile());
  });

  it("écrit, pour chaque type, ses champs et leurs budgets, et un plan proposé", () => {
    const md = genererConsigneToile(REGISTRES_ESSAI);
    expect(md).toContain("paquet-session-toile/1");
    expect(md).toMatch(/^\| L01 \| liste \| contenu \| titre 40, texte 90, rubrique 28 \(facultatif\) \|$/mu);
    expect(md).toContain("| PA | 4 | oui | non | PA1, PA2, PA3, PA4 |");
    expect(md).toMatch(/## Plan proposé\n\n.*Parcours P[A-H]/u);
    expect(md).not.toMatch(/\| (D01|D02|X09) \|/u);
  });
});
