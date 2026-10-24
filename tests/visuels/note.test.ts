import { describe, expect, it } from "vitest";
import { FIXTURES_AXION } from "../../src/visuels/texte/fixtures";
import { CHARTE_CARROUSEL } from "../../src/briques/visuels/charte-carrousel";
import { interditsDans, LISTE_INTERDITS } from "../../src/domaine/qualite-script/regles/interdits";
import { noterCarrousel, type MesuresPage, type MesuresRendu } from "../../src/domaine/controles-visuel/note";

const { encre, creme } = CHARTE_CARROUSEL.couleurs;
const specBon = FIXTURES_AXION[0].spec;

const pageSaine = (): MesuresPage => ({
  plusPetitTextePx: 28,
  signesParLigneMax: 40,
  zoneVidePct: 15,
  contrastes: [{ avantPlan: encre, fond: creme, px: 30 }],
  zoneInterdite: false,
  photos: 0,
  logosHorsListe: [],
  couleurs: [encre, creme],
  polices: ["Archivo Black", "Inter"],
});
const mesuresSaines = (n: number): MesuresRendu => ({ pages: Array.from({ length: n }, pageSaine) });
const critere = (r: ReturnType<typeof noterCarrousel>, id: number) => r.criteres.find((c) => c.id === id)!;
const avecPages = (pages: object[]) => ({ ...specBon, pages });

describe("note sur 100 : carrousel sain", () => {
  it("un modèle Axion aux mesures saines est présenté (≥ 90)", () => {
    const r = noterCarrousel(specBon, mesuresSaines(specBon.pages.length), { valeurHumaine: 8 });
    expect(r.criteres).toHaveLength(10);
    expect(r.total).toBeGreaterThanOrEqual(90);
    expect(r.bloquants).toEqual([]);
    expect(r.verdict).toBe("presente");
  });

  it("sans mesures : critères de rendu « non mesuré », verdict plafonné à « retouche », jamais bloqué pour cela", () => {
    const r = noterCarrousel(specBon, undefined, { valeurHumaine: 8 });
    expect(critere(r, 2).auto).toBe(true);
    expect(critere(r, 2).raison).toMatch(/non mesuré/i);
    expect(critere(r, 2).bloquant).toBe(false);
    expect(critere(r, 2).points).toBeGreaterThan(0);
    expect(critere(r, 2).points).toBeLessThan(12);
    expect(r.verdict).toBe("retouche");
  });
});

describe("note sur 100 : défauts bloquants", () => {
  it("un code couleur hors charte (#2B5CE0) fait chuter la cohérence sous 9 : bloqué", () => {
    const m = mesuresSaines(specBon.pages.length);
    m.pages[1].couleurs = [encre, creme, "#2B5CE0"];
    const r = noterCarrousel(specBon, m);
    expect(critere(r, 6).points).toBeLessThan(9);
    expect(critere(r, 6).bloquant).toBe(true);
    expect(r.verdict).toBe("bloque");
  });

  it("un code couleur littéral dans le texte du spec est aussi refusé", () => {
    const r = noterCarrousel({ ...specBon, alt: "Carrousel bleu #2B5CE0 sur les freins au démarrage" }, mesuresSaines(specBon.pages.length));
    expect(critere(r, 6).points).toBeLessThan(9);
    expect(r.verdict).toBe("bloque");
  });

  it("8 pages sur 3 types : diversité rouge", () => {
    const t = (titre: string) => ({ type: "T10", message: titre });
    const pages = [
      { type: "T01", titre: "Bien démarrer" },
      t("Un premier pas"),
      { type: "T06", titre: "Les freins", points: [{ texte: "Le temps" }, { texte: "Le doute" }] },
      t("Un deuxième pas"),
      { type: "T06", titre: "Les appuis", points: [{ texte: "L'équipe" }, { texte: "Les outils" }] },
      t("Un troisième pas"),
      { type: "T06", titre: "Les suites", points: [{ texte: "Un point" }, { texte: "Un bilan" }] },
      { type: "T21" },
    ];
    const r = noterCarrousel(avecPages(pages), mesuresSaines(8));
    expect(critere(r, 7).niveau).toBe("rouge");
    expect(critere(r, 7).points).toBeLessThan(10);
  });

  it("deux pages de même famille à la suite : diversité rouge", () => {
    const pages = [
      { type: "T01", titre: "Bien démarrer" },
      { type: "T01B", titre: "Un autre départ" },
      { type: "T06", titre: "Les freins", points: [{ texte: "Le temps" }, { texte: "Le doute" }] },
      { type: "T08", titre: "Idée reçue", avant: "Trop technique", apres: "Simple" },
      { type: "T10", message: "Un cas simple suffit" },
      { type: "T21" },
    ];
    expect(critere(noterCarrousel(avecPages(pages), mesuresSaines(6)), 7).niveau).toBe("rouge");
  });

  it("un texte de 22 px : lisibilité bloquée", () => {
    const m = mesuresSaines(specBon.pages.length);
    m.pages[2].plusPetitTextePx = 22;
    const r = noterCarrousel(specBon, m);
    expect(critere(r, 2).points).toBeLessThan(12);
    expect(critere(r, 2).bloquant).toBe(true);
    expect(r.verdict).toBe("bloque");
  });

  it("une ligne de corps de plus de 45 signes : lisibilité bloquée", () => {
    const m = mesuresSaines(specBon.pages.length);
    m.pages[0].signesParLigneMax = 52;
    expect(critere(noterCarrousel(specBon, m), 2).bloquant).toBe(true);
  });

  it("l'orange en texte courant sur crème (3,24:1) : contraste bloqué", () => {
    const m = mesuresSaines(specBon.pages.length);
    m.pages[0].contrastes = [{ avantPlan: CHARTE_CARROUSEL.couleurs.orange, fond: creme, px: 30 }];
    const r = noterCarrousel(specBon, m);
    expect(critere(r, 3).bloquant).toBe(true);
    expect(r.verdict).toBe("bloque");
  });

  it("« Grenoble » : conformité sous 15, bloqué", () => {
    const pages = [{ type: "T01", titre: "Formation à Grenoble" }, ...specBon.pages.slice(1)];
    const r = noterCarrousel(avecPages(pages), mesuresSaines(pages.length));
    expect(critere(r, 1).points).toBeLessThan(15);
    expect(critere(r, 1).bloquant).toBe(true);
    expect(r.verdict).toBe("bloque");
    expect(r.bloquants.join(" ")).toMatch(/Conformité/);
  });

  it("une photo ou une intrusion dans les zones réseau : conformité bloquée", () => {
    const m = mesuresSaines(specBon.pages.length);
    m.pages[3].zoneInterdite = true;
    expect(critere(noterCarrousel(specBon, m), 1).bloquant).toBe(true);
  });

  it("la dernière page (T21) avec un lien : appel à l'action rouge", () => {
    const t21 = specBon.pages[specBon.pages.length - 1] as Record<string, unknown>;
    const pages = [...specBon.pages.slice(0, -1), { ...t21, type: "T21", titre: "Écrivez sur https://axion-ia.com/offre" }];
    const r = noterCarrousel(avecPages(pages), mesuresSaines(pages.length));
    expect(critere(r, 10).niveau).toBe("rouge");
    expect(critere(r, 10).points).toBeLessThan(7);
  });

  it("une accroche de plus de 9 mots perd des points, au-delà de 11 mots elle bloque", () => {
    const long = "Comment bien démarrer sans se tromper dans les premiers pas de votre projet interne";
    const pages = [{ type: "T01", titre: long }, ...specBon.pages.slice(1)];
    const r = noterCarrousel(avecPages(pages), mesuresSaines(pages.length));
    expect(critere(r, 8).points).toBeLessThan(6);
    expect(critere(r, 8).bloquant).toBe(true);
  });
});

describe("note sur 100 : verdicts", () => {
  it("la note est la somme des critères", () => {
    const r = noterCarrousel(specBon, mesuresSaines(specBon.pages.length));
    expect(r.total).toBe(r.criteres.reduce((s, c) => s + c.points, 0));
  });
  it("sous 85 : refait", () => {
    const m = mesuresSaines(specBon.pages.length);
    m.pages.forEach((p) => (p.zoneVidePct = 45));
    const r = noterCarrousel(specBon, m, { valeurHumaine: 0 });
    expect(critere(r, 5).niveau).toBe("orange");
    expect(r.bloquants).toEqual([]);
    expect(r.total).toBeLessThan(85);
    expect(r.verdict).toBe("refait");
  });
});

describe("note sur 100 : jamais « présenté » si la porte refuse", () => {
  const sain = () => mesuresSaines(specBon.pages.length);
  const avecPage = (i: number, page: object) => avecPages(specBon.pages.map((p, k) => (k === i ? page : p)));

  it("ANGLAIS : un texte en anglais → bloqué", () => {
    const spec = avecPage(1, { type: "T10", message: "This is a great tool for you" });
    const r = noterCarrousel(spec, mesuresSaines(specBon.pages.length), { valeurHumaine: 8 });
    expect(r.verdict).toBe("bloque");
    expect(critere(r, 1).raison).toMatch(/anglais/i);
  });
  it("MOT_TROP_LONG : un mot trop long dans une carte → bloqué", () => {
    const carte = (titre: string) => ({ titre, corps: "Un texte court." });
    const pages = [
      { type: "T01", titre: "Bien démarrer" },
      { type: "T02", titre: "Les bases", cartes: ["Planifier", "accompagnement", "Ranger", "Choisir"].map(carte) },
      { type: "T06", titre: "Les freins", points: [{ texte: "Le temps" }, { texte: "Le doute" }, { texte: "Les outils" }] },
      { type: "T08", titre: "Idée reçue", avant: "Trop technique", apres: "Simple" },
      { type: "T10", message: "Un cas simple suffit" },
      { type: "T21" },
    ];
    const r = noterCarrousel(avecPages(pages), mesuresSaines(6), { valeurHumaine: 8 });
    expect(r.verdict).toBe("bloque");
    expect(critere(r, 1).raison).toMatch(/trop long/i);
  });
  it("RYTHME : deux T06 à la suite et valeurHumaine 8 → bloqué (pas « présenté »)", () => {
    const t06 = (titre: string) => ({ type: "T06", titre, points: [{ texte: "Le temps" }, { texte: "Le doute" }, { texte: "Les outils" }] });
    const pages = [{ type: "T01", titre: "Bien démarrer" }, t06("Les freins"), t06("Les appuis"), { type: "T08", titre: "Idée reçue", avant: "Trop technique", apres: "Simple" }, { type: "T10", message: "Un cas simple suffit" }, { type: "T21" }];
    const r = noterCarrousel(avecPages(pages), mesuresSaines(6), { valeurHumaine: 8 });
    expect(r.verdict).toBe("bloque");
    expect(critere(r, 1).raison).toMatch(/même type/i);
  });
  it("un mot de la liste partagée autre que la ville est refusé par défaut", () => {
    // Le mot est lu dans la liste publique (pas recopié) : la première entrée de « Écrire », hors ville, que son propre libellé déclenche.
    const expression = LISTE_INTERDITS.filter((i) => i.portee.includes("ecrire"))
      .map((i) => i.libelle.replace(/\(.*\)/g, "").replace(/[«»]/g, "").trim())
      .find((t) => !/villeexemple|grenoble/i.test(t) && interditsDans(t, "ecrire").length > 0);
    expect(expression).toBeDefined();
    const spec = avecPage(1, { type: "T10", message: `Une formation : ${expression}` });
    const r = noterCarrousel(spec, sain(), { valeurHumaine: 8 });
    expect(critere(r, 1).bloquant).toBe(true);
    expect(r.verdict).toBe("bloque");
  });
  it("option faitsDisponibles : un chiffre n'est plus refusé quand les faits sont validés", () => {
    const spec = avecPage(1, { type: "T10", message: "Un gain de 3 heures par semaine" });
    expect(critere(noterCarrousel(spec, sain()), 1).bloquant).toBe(true);
    expect(critere(noterCarrousel(spec, sain(), { faitsDisponibles: true }), 1).bloquant).toBe(false);
  });
});

describe("note sur 100 : liste vide = non mesuré", () => {
  it("contrastes, couleurs et polices vides sur chaque page → au mieux « retouche »", () => {
    const m: MesuresRendu = { pages: Array.from({ length: specBon.pages.length }, () => ({ ...pageSaine(), contrastes: [], couleurs: [], polices: [] })) };
    const r = noterCarrousel(specBon, m, { valeurHumaine: 8 });
    expect(critere(r, 3).nonMesure).toBe(true);
    expect(critere(r, 3).points).toBeLessThan(8);
    expect(critere(r, 6).nonMesure).toBe(true);
    expect(r.verdict).toBe("retouche");
  });
  it("logosHorsListe vide reste une mesure légitime", () => {
    const r = noterCarrousel(specBon, mesuresSaines(specBon.pages.length), { valeurHumaine: 8 });
    expect(critere(r, 1).nonMesure).toBe(false);
  });
});

describe("note sur 100 : faux positifs couleurs", () => {
  it.each(["#2026", "#face", "#MarketingDigital", "#12345", "#abcdefg"])("« %s » n'est pas une couleur hors charte", (jeton) => {
    const r = noterCarrousel({ ...specBon, alt: `Carrousel sur les freins ${jeton} au démarrage` }, mesuresSaines(specBon.pages.length));
    expect(critere(r, 6).bloquant).toBe(false);
  });
  it("#2B5CE0 et #F00 restent refusés", () => {
    for (const c of ["#2B5CE0", "#F00"]) {
      const r = noterCarrousel({ ...specBon, alt: `Carrousel ${c} sur les freins` }, mesuresSaines(specBon.pages.length));
      expect(critere(r, 6).bloquant).toBe(true);
    }
  });
});
