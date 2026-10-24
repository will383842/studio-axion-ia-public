import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { DepotMemoire } from "@/donnees/memoire";
import type { Porte } from "../../src/domaine/visuels/contrats";
import type { Visuel } from "../../src/domaine/visuels/visuel";
import { creerDepuisSujet, type DependancesCarrousels } from "@/visuels/services/carrousels";
import { creerFournisseurSimulation } from "../../src/visuels/texte/simulation";
import { TYPES_PAGE } from "../../src/briques/visuels/registre-pages";
import { dessinsDuCarrousel, ILLUSTRATIONS_FIXES, illustrationCouverture } from "../../src/briques/visuels/choix-illustration";
import { controlerCarrousel } from "../../src/domaine/controles-visuel/porte";
import { controlesStructure, controlesSurfaceOrange } from "../../src/domaine/controles-visuel/rythme";
import { controlesMemoire, empreinteCarrousel, recentsAEviter, repete, MEMOIRE_CARROUSELS } from "../../src/domaine/controles-visuel/memoire-carrousels";
import { FAMILLE_VARIETE, SURFACE_ORANGE } from "../../src/domaine/visuels/familles-pages";
import { CarrouselSpec } from "../../src/domaine/visuels/schema";
import type { ContextePorte } from "../../src/domaine/visuels/contrats";
import type { CarrouselSpecType } from "../../src/domaine/visuels/types";
import { FIXTURES_AXION } from "../../src/visuels/texte/fixtures";
import { ICONE_DU_MINI_PAGE, ICONES_NOEUDS_DEFAUT } from "../../src/briques/visuels/choix-illustration";

const ctx: ContextePorte = { interditsDans: () => [], faitsDisponibles: true };
const couverture = { type: "T01", titre: "Mieux organiser sa semaine", sousTitre: "Des gestes simples pour souffler" };
const grille = { type: "T02", titre: "Les bases", cartes: [{ titre: "Planifier", corps: "Poser ses priorités." }, { titre: "Déléguer", corps: "Confier ce qui peut l’être." }] };
const liste = (titre = "Votre routine") => ({ type: "T06", titre, points: [{ texte: "Un café avant de commencer" }, { texte: "Une liste courte et claire" }, { texte: "Une pause à midi" }] });
const avantApres = { type: "T08", titre: "Avant et après", avant: "Des journées qui débordent", apres: "Des journées plus calmes" };
const etapes = (titre = "Le parcours") => ({ type: "T20", titre, etapes: [{ titre: "Noter", corps: "Écrire ce qui compte." }, { titre: "Trier", corps: "Garder l’essentiel." }, { titre: "Agir", corps: "Avancer pas à pas." }] });
const checklist = { type: "T27", titre: "Où en êtes-vous", lignes: [{ texte: "Je range" }, { texte: "Je trie" }, { texte: "Je classe" }, { texte: "Je note" }] };
const message = { type: "T10", message: "Le calme se prépare" };
const fin = { type: "T21" };
const cas = (titre: string) => ({ type: "T26", titre, avant: ["Tout à la main", "Des oublis"], avec: ["Un rappel posé", "Rien d’oublié"], vous: "Vous gagnez en calme" });
const spec = (...pages: unknown[]) => ({ version: "carrousel/1", alt: "Carrousel exemple type sur l’organisation", pages });
const lu = (...pages: unknown[]) => CarrouselSpec.parse(spec(...pages)) as CarrouselSpecType;
const de = (code: string, s: CarrouselSpecType) => controlesStructure(s).filter((c) => c.code === code);

describe("L7 : familles de pages", () => {
  it("chaque type connu (variantes comprises) et T29 a sa famille", () => {
    for (const t of [...TYPES_PAGE, "T29"]) expect(FAMILLE_VARIETE[t as keyof typeof FAMILLE_VARIETE], t).toBeDefined();
    expect(new Set(Object.values(FAMILLE_VARIETE))).toEqual(new Set(["titre-seul", "rangees", "grille", "duo", "donnee", "appel"]));
    expect(FAMILLE_VARIETE.T29).toBe("appel");
  });
  it("deux pages de même famille à la suite (types différents) : rouge, avec les pages et la famille", () => {
    const r = de("FAMILLE", lu(couverture, liste(), checklist, grille, etapes(), message, fin));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ niveau: "rouge", page: 3 });
    expect(r[0].phrase).toMatch(/Pages 2 et 3 .*rangées/);
  });
  it("la couverture a son rôle : couverture puis message clé n'est pas une suite de famille", () => {
    expect(de("FAMILLE", lu(couverture, message, grille, liste(), avantApres, etapes(), fin))).toEqual([]);
  });
  it("même type à la suite reste un cas particulier (RYTHME), sans double alerte FAMILLE", () => {
    const s = lu(couverture, liste("Un"), liste("Deux"), grille, etapes(), message, fin);
    expect(de("RYTHME", s)).toHaveLength(1);
    expect(de("FAMILLE", s)).toHaveLength(0);
  });
  it("série T26 numérotée de 3 pages au plus : orange, pas rouge", () => {
    const s = lu(couverture, cas("Scénario 1 : la relance"), cas("Scénario 2 : le devis"), grille, etapes(), message, fin);
    const r = controlesStructure(s).filter((c) => ["RYTHME", "FAMILLE", "SERIE"].includes(c.code));
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((c) => c.niveau === "orange")).toBe(true);
  });
  it("série T26 non numérotée : rouge", () => {
    const s = lu(couverture, cas("La relance"), cas("Le devis"), grille, etapes(), message, fin);
    expect(de("RYTHME", s)[0]?.niveau).toBe("rouge");
  });
  it("les modèles du studio n'ont aucune suite de même famille", () => {
    for (const f of FIXTURES_AXION) expect(de("FAMILLE", f.spec), f.id).toEqual([]);
  });
});

describe("L7 : page sombre en page 2 ou en dernière page", () => {
  it("page 2 sombre : acceptée par le schéma", () => {
    expect(CarrouselSpec.safeParse(spec(couverture, fin, grille, liste(), avantApres, etapes(), message)).success).toBe(true);
  });
  it("page sombre ailleurs : rouge, phrase précise", () => {
    const { rapport } = controlerCarrousel(spec(couverture, grille, fin, liste(), avantApres, etapes(), message), ctx);
    expect(rapport.verdict).toBe("rouge");
    expect(rapport.controles.map((c) => c.phrase).join(" ")).toMatch(/Page 3 : la page sombre .*page 2 ou en dernière page/);
  });
  it("deux pages sombres : rouge", () => {
    const { rapport } = controlerCarrousel(spec(couverture, fin, grille, liste(), avantApres, etapes(), fin), ctx);
    expect(rapport.verdict).toBe("rouge");
    expect(rapport.controles.map((c) => c.phrase).join(" ")).toMatch(/une seule page sombre/);
  });
});

describe("L7 : une seule grande surface orange", () => {
  it("table des types à grand aplat orange", () => {
    expect(Object.keys(SURFACE_ORANGE).sort()).toEqual(["T01", "T01B", "T01C", "T08", "T10"]);
  });
  it("deux grandes surfaces orange : alerte qui nomme les pages", () => {
    const r = controlesSurfaceOrange(lu(couverture, grille, liste(), avantApres, etapes(), message, fin));
    expect(r).toHaveLength(1);
    expect(r[0].phrase).toMatch(/pages 1, 4 et 6/);
  });
  it("une seule : rien", () => {
    expect(controlesSurfaceOrange(lu(couverture, grille, liste(), checklist, etapes(), fin))).toEqual([]);
  });
  it("jamais vide : chaque couverture porte toujours une illustration", () => {
    for (const t of ["T01", "T01B", "T01C"] as const) expect(illustrationCouverture(t, "Rien de reconnu")).toMatch(/^I\d\d$/);
  });
});

describe("L7 : même dessin jamais deux fois", () => {
  it("la couverture n'emprunte jamais une scène fixe d'un autre gabarit (T26 : sablier, cible)", () => {
    expect(illustrationCouverture("T01", "Atteindre son objectif")).not.toBe("I09");
    expect(illustrationCouverture("T01", "Le sablier de l'attente")).not.toBe("I10");
    expect(ILLUSTRATIONS_FIXES.T26).toEqual(["I10", "I09"]);
    const t26 = readFileSync(new URL("../../studio-rendu/compositions/visuels/pages/T26.tsx", import.meta.url), "utf8");
    for (const id of ILLUSTRATIONS_FIXES.T26) expect(t26).toContain(`<Scene id="${id}"`);
  });
  it("les tables d'icônes suivent les gabarits", () => {
    const t02 = readFileSync(new URL("../../studio-rendu/compositions/visuels/pages/T02.tsx", import.meta.url), "utf8");
    const table = Object.entries(ICONE_DU_MINI_PAGE).map(([m, n]) => `${m}: "${n}"`).join(", ");
    expect(t02).toContain(`export const ICONE_DU_MINI: Record<Exclude<TypeMini, "W01">, NomIcone> = { ${table} };`);
    const t28 = readFileSync(new URL("../../studio-rendu/compositions/visuels/pages/T28.tsx", import.meta.url), "utf8");
    expect(t28).toContain(`const ICONES_DEFAUT: readonly NomIcone[] = ${JSON.stringify(ICONES_NOEUDS_DEFAUT).replace(/,/g, ", ")};`);
  });
  it("dessins listés page par page", () => {
    const s = lu(couverture, grille, { type: "T28", titre: "Le flux", noeuds: [{ texte: "Recevoir" }, { texte: "Traiter", icone: "horloge" }, { texte: "Envoyer" }] }, fin);
    expect(dessinsDuCarrousel(s)).toEqual([
      { page: 1, dessin: "I01" },
      { page: 3, dessin: "icone-document" },
      { page: 3, dessin: "icone-horloge" },
      { page: 3, dessin: "icone-loupe" },
    ]);
  });
  it("une icône répétée sur deux pages : rouge", () => {
    const questions = { type: "T23", titre: "Avant de commencer", questions: [{ question: "Quel délai ?", aide: "Une date." }, { question: "Quel objectif ?", aide: "Un but." }], annotation: "À vous de voir" };
    const flux = { type: "T28", titre: "Le flux", noeuds: [{ texte: "Recevoir", icone: "horloge" }, { texte: "Traiter", icone: "engrenage" }, { texte: "Envoyer", icone: "envoyer" }] };
    const r = de("DESSIN_DOUBLE", lu(couverture, questions, grille, flux, etapes(), fin));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ niveau: "rouge", page: 4 });
  });
  it("les modèles du studio n'ont aucun dessin en double", () => {
    for (const f of FIXTURES_AXION) expect(de("DESSIN_DOUBLE", f.spec), f.id).toEqual([]);
  });
});

describe("L7 : mémoire entre carrousels", () => {
  const a = lu(couverture, grille, liste(), avantApres, etapes(), message, fin);
  const b = lu({ ...couverture, type: "T01B" }, liste(), grille, avantApres, etapes(), message, fin);
  it("empreinte : suite des types et couverture (type + dessin)", () => {
    expect(empreinteCarrousel(a)).toEqual({ suite: "T01 T02 T06 T08 T20 T10 T21", couverture: "T01:I01" });
  });
  it("garde les 5 plus récents seulement", () => {
    const fiches = Array.from({ length: 7 }, (_, i) => ({ creeLe: `2026-01-0${i + 1}`, spec: i === 0 ? a : b }));
    const r = recentsAEviter(fiches);
    expect(r).toHaveLength(MEMOIRE_CARROUSELS);
    expect(r.some((e) => e.suite === empreinteCarrousel(a).suite)).toBe(false);
  });
  it("même suite ou même couverture qu'un récent : alerte orange", () => {
    expect(controlesMemoire(a, [empreinteCarrousel(a)]).map((c) => c.code)).toEqual(["REPETITION", "REPETITION"]);
    expect(controlesMemoire(a, [empreinteCarrousel(b)])).toEqual([]);
    expect(controlesMemoire(a, []).length).toBe(0);
  });
  it("branchée dans la porte par le contexte", () => {
    const { rapport } = controlerCarrousel(a, { ...ctx, recents: [empreinteCarrousel(a)] });
    expect(rapport.controles.filter((c) => c.code === "REPETITION")).toHaveLength(2);
  });
});

describe("L7 : nombre écrit dans un titre", () => {
  it("égal au nombre d'éléments : permis", () => {
    expect(de("NOMBRE_TITRE", lu(couverture, grille, liste("Trois gestes"), avantApres, etapes("3 étapes"), fin))).toEqual([]);
  });
  it("différent : rouge", () => {
    const r = de("NOMBRE_TITRE", lu(couverture, grille, liste("4 gestes simples"), avantApres, etapes("Cinq étapes"), fin));
    expect(r.map((c) => [c.niveau, c.page])).toEqual([["rouge", 3], ["rouge", 5]]);
    expect(r[0].phrase).toMatch(/« 4 ».*3 éléments/);
  });
  it("une durée n'est pas un compte", () => {
    expect(de("NOMBRE_TITRE", lu(couverture, grille, liste("En 5 minutes"), avantApres, etapes(), fin))).toEqual([]);
  });
  it("couverture et message : aucun élément à compter, rien n'est contrôlé", () => {
    expect(de("NOMBRE_TITRE", lu({ ...couverture, titre: "Sept bons réflexes" }, grille, liste(), avantApres, etapes(), message, fin))).toEqual([]);
  });
});

describe("L7 : mémoire branchée à la fabrication", () => {
  it("la simulation ne reprend pas la suite ni la couverture d'un carrousel récent", async () => {
    const f = creerFournisseurSimulation();
    const premier = await f.ecrire({ type: "sujet", sujet: "Ranger son bureau" });
    const recents = [empreinteCarrousel(premier.spec as CarrouselSpecType)];
    const second = await f.ecrire({ type: "sujet", sujet: "Ranger son bureau", eviter: recents });
    expect(repete(empreinteCarrousel(second.spec as CarrouselSpecType), recents)).toBe(false);
    // Sans mémoire : même sujet, même modèle (reproductible).
    expect((await f.ecrire({ type: "sujet", sujet: "Ranger son bureau" })).spec).toEqual(premier.spec);
  });
  it("le service passe les 5 derniers carrousels à l'écriture et à la porte", async () => {
    const depot = new DepotMemoire<Visuel>();
    const a = lu(couverture, grille, liste(), avantApres, etapes(), message, fin);
    for (let i = 0; i < 7; i++) {
      await depot.enregistrer({ id: `vis_${i}`, famille: "carrousel", titre: "T", entree: { type: "sujet", sujet: `sujet ${i}` }, statut: "ecrit", modeTexte: "simulation", spec: a, versionSpec: 1, coutCentimes: 0, creeLe: `2026-10-0${i + 1}T00:00:00.000Z`, modifieLe: "x" });
    }
    const ecrire = vi.fn(async () => ({ titre: "Titre", spec: a, pourquoi: [], mode: "simulation" as const }));
    const porte = vi.fn(((s: unknown, c: ContextePorte) => controlerCarrousel(s, c)) as Porte);
    const deps: DependancesCarrousels = {
      depot,
      texte: () => ({ mode: "simulation", ecrire }) as never,
      porte,
      contextePorte: async () => ({ interditsDans: () => [], faitsDisponibles: true }),
      allume: async () => true,
      rendre: async () => ({}) as never,
      urlLecture: async (c) => c,
      verrou: (f) => f(),
      maintenant: () => "2026-10-20T00:00:00.000Z",
      lireParametre: async <T>(_: string, d: T) => d,
      ecrireParametre: async () => undefined,
    };
    await creerDepuisSujet("Un sujet exemple type", deps);
    const eviter = (ecrire.mock.calls[0] as unknown as [{ eviter?: unknown[] }])[0].eviter;
    expect(eviter).toHaveLength(MEMOIRE_CARROUSELS);
    expect(porte.mock.calls[0][1].recents).toHaveLength(MEMOIRE_CARROUSELS);
  });
});
