/**
 * LOT M3 du moteur avocat (plan v3.2, PARTIE A §2-3, B.0 §2 et §16, B.9 ; catalogue des décors) :
 * écran « Votre vidéo », décors, aperçu du plateau (LUT 3D), enregistrement différé, états du tableau A.3,
 * « Demander une modification », sous-titres synchronisés. Tout tourne sans aucune clé.
 */
import { readFileSync, existsSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots, DepotMemoire } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const express = await import("@/services/express");
const modifications = await import("@/services/modifications");
const { migrerDonnees } = await import("@/services/migrations");
const { decorsCatalogue, fichiersDecorsCatalogue, DECOR_DEFAUT_AVOCAT } = await import("@/donnees/decors-catalogue");
const decors = await import("@/domaine/decors");
const lut3d = await import("@/lib/lut3d");
const logique = await import("@/assistant/express/logique");
const { creerPlanificateur, DELAI_ENREGISTREMENT_MS } = await import("@/assistant/express/useEnregistrementDiffere");
const { groupeA } = await import("@/components/videos/tempsLecture");
const { formatAvocat } = await import("@/formats/avocat");
const { MENTION_IA_PAR_DEFAUT } = await import("@/domaine/derivations");
const { ETAPES } = await import("@/assistant/etapes/registre");
const { ecrireParametre } = await import("@/services/_commun");

import type { BlocScript, ElementBibliotheque, ValeurDecor, Visage, Voix } from "@/domaine/types";

const MDP_TEST = "essai-moteur-avocat-m3";

beforeAll(async () => {
  process.env.SESSION_SECRET = "m".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP_TEST, false);
});

const valeur = (e: ElementBibliotheque) => e.valeur as ValeurDecor;
const bloc = (id: string, recette: string, ...textes: string[]): BlocScript => ({ id, blocRecette: recette, segments: textes.map((t, i) => ({ id: `${id}-${i}`, texte: t })) });

/* ------------------------------------------------------------------ */
describe("format avocat : bascule sur l'écran « Votre vidéo »", () => {
  it("les étapes de l'avocat sont express puis fabrication", () => {
    expect(formatAvocat.etapes).toEqual(["express", "fabrication"]);
  });

  it("l'écran est valide dès qu'il y a du texte et un format d'image ; le sujet est facultatif", () => {
    const b = { formatId: "avocat", titre: "", sujet: "", dureeCibleSec: 30, ratios: ["9:16" as const], blocs: [bloc("a", "accroche", "Votre patron lit vos mails ?")], distribution: [], entrees: {}, reglages: {}, styles: {}, briquesCoupees: [], briquesAllumees: [], mentionIA: MENTION_IA_PAR_DEFAUT, adresse: "vous" as const };
    expect(ETAPES.express.estValide(b)).toBe(true);
    expect(ETAPES.express.estValide({ ...b, blocs: [] })).toBe(false);
    expect(ETAPES.express.estValide({ ...b, ratios: [] })).toBe(false);
  });

  it("le titre vient de l'accroche (80 caractères au plus, sans ponctuation finale)", () => {
    expect(logique.sujetDepuisScript([bloc("a", "accroche", "Votre patron lit vos mails ?"), bloc("b", "promesse", "Je vous explique.")])).toBe("Votre patron lit vos mails ?");
    expect(logique.sujetDepuisScript([bloc("a", "accroche", "Une accroche simple.")])).toBe("Une accroche simple");
    const long = logique.sujetDepuisScript([bloc("a", "accroche", "mot ".repeat(40))]);
    expect(long.length).toBeLessThanOrEqual(81);
    expect(long.endsWith("…")).toBe(true);
  });

  it("le mode pas à pas enchaîne les 5 blocs dans l'ordre Script · Plateau · Voix · Style · Coût", () => {
    const ordre: string[] = ["script"];
    let b = logique.blocSuivant("script");
    while (b) {
      ordre.push(b);
      b = logique.blocSuivant(b);
    }
    expect(ordre).toEqual(["script", "plateau", "voix", "style", "cout"]);
  });
});

/* ------------------------------------------------------------------ */
describe("catalogue des décors (décision de Will)", () => {
  const catalogue = decorsCatalogue("2026-10-02T00:00:00.000Z");

  it("6 fonds neutres incrustés par le studio et 8 décors réalistes (Looks), à vérifier", () => {
    const neutres = catalogue.filter((e) => decors.methodeDecor(valeur(e)) === "neutre-incruste");
    const looks = catalogue.filter((e) => decors.methodeDecor(valeur(e)) === "look-heygen");
    expect(neutres.map((e) => valeur(e).catalogue?.code).sort()).toEqual(["N1", "N2", "N3", "N4", "N5", "N6"]);
    expect(looks.map((e) => valeur(e).catalogue?.code).sort()).toEqual(["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"]);
    expect(looks.every((e) => decors.decorAVerifier(valeur(e)))).toBe(true);
    expect(neutres.some((e) => decors.decorAVerifier(valeur(e)))).toBe(false);
  });

  it("N1 Halo orange est le défaut de l'avocat ; N1, N5, N3 mis en avant dans cet ordre ; N2, N4, N6 en réserve, jamais en premier", () => {
    expect(DECOR_DEFAUT_AVOCAT).toBe("decor-n1-halo-orange");
    const { proposes, reserve } = decors.ordonnerDecors(catalogue);
    expect(proposes.slice(0, 3).map((e) => valeur(e).catalogue?.code)).toEqual(["N1", "N5", "N3"]);
    expect(reserve.map((e) => valeur(e).catalogue?.code)).toEqual(["N2", "N4", "N6"]);
    expect(proposes.some((e) => valeur(e).catalogue?.reserve)).toBe(false);
  });

  it("le décor par défaut : N1 pour l'avocat s'il est dans la Bibliothèque, sinon le défaut du format ; un choix fait prime", () => {
    expect(decors.decorParDefaut("avocat", catalogue, "fond-noir-chaud")).toBe(DECOR_DEFAUT_AVOCAT);
    expect(decors.decorParDefaut("avocat", [], "fond-noir-chaud")).toBe("fond-noir-chaud");
    expect(decors.decorParDefaut("podcast", catalogue, "decor-studio")).toBe("decor-studio");
    expect(logique.decorInitial("avocat", "decor-n5-creme-chaud", catalogue, "fond-noir-chaud")).toBe("decor-n5-creme-chaud");
    expect(logique.decorInitial("avocat", undefined, catalogue, "fond-noir-chaud")).toBe(DECOR_DEFAUT_AVOCAT);
  });

  it("sur fond clair, l'ombre des sous-titres crème est renforcée (contraste vérifié), sinon Bandeau", () => {
    const n1 = valeur(catalogue.find((e) => e.id === "decor-n1-halo-orange")!);
    const n5 = valeur(catalogue.find((e) => e.id === "decor-n5-creme-chaud")!);
    expect(decors.sousTitresSurDecor(n1).mode).toBe("normal");
    expect(decors.sousTitresSurDecor(n1).contrasteTexte).toBeGreaterThan(4.5);
    const clair = decors.sousTitresSurDecor(n5);
    expect(clair.mode).toBe("ombre-renforcee");
    expect(clair.contrasteTexte).toBeLessThan(4.5);
    expect(clair.contrasteContour).toBeGreaterThanOrEqual(7);
    expect(clair.facteurOmbre).toBeGreaterThan(1);
    // Gris moyen : ni le crème ni le contour noir ne se détachent assez → Bandeau.
    expect(decors.sousTitresSurDecor({ ...n1, teinte: "#7A7A7A", clair: undefined }).mode).toBe("bandeau");
  });

  it("LUT conseillées sur un fond clair : Doux ou Naturel", () => {
    const n5 = valeur(catalogue.find((e) => e.id === "decor-n5-creme-chaud")!);
    const luts = [
      { id: "lut-doux", nom: "Axion Doux", type: "lut" as const },
      { id: "lut-nuit", nom: "Axion Nuit", type: "lut" as const },
      { id: "lut-naturel", nom: "Axion Naturel", type: "lut" as const },
    ];
    expect(decors.lutsConseilleesPour(n5, luts).map((l) => l.id)).toEqual(["lut-doux", "lut-naturel"]);
    expect(decors.lutsConseilleesPour(valeur(catalogue[0]), luts)).toEqual([]);
  });

  it("contraste WCAG : noir sur blanc = 21, une couleur contre elle-même = 1", () => {
    expect(decors.contraste("#000000", "#FFFFFF")).toBe(21);
    expect(decors.contraste("#C65A2E", "#C65A2E")).toBe(1);
  });

  it("chaque fond neutre a son image et sa vignette dans public/demo/decors", () => {
    for (const f of fichiersDecorsCatalogue("2026-10-02T00:00:00.000Z")) expect(existsSync(`public${f.cleStockage}`)).toBe(true);
  });
});

describe("migration au démarrage, étape 9 : catalogue des décors", () => {
  it("une base neuve (démonstration) a déjà le catalogue : rien à ajouter", async () => {
    const r = await migrerDonnees(depots(), "2026-10-02T08:00:00.000Z");
    expect(r.decorsAjoutes ?? []).toHaveLength(0);
    expect(await depots().elements.obtenir(DECOR_DEFAUT_AVOCAT)).toBeTruthy();
  });

  it("base en ligne sans catalogue : ajoute les 14 décors et leurs images, sans jamais réécrire un décor existant ; rejouable sans effet", async () => {
    const d = depots();
    // Une base d'avant le lot M3 : la Bibliothèque sans les décors du catalogue.
    (d as unknown as Record<string, unknown>).elements = new DepotMemoire<ElementBibliotheque>((await d.elements.lister()).filter((e) => !e.id.startsWith("decor-n") && !e.id.startsWith("decor-r")));
    const r1 = await migrerDonnees(d, "2026-10-02T08:00:00.000Z");
    expect(r1.decorsAjoutes).toHaveLength(14);
    expect(await d.fichiers.obtenir("f-decors-fond-1-halo-orange-jpg")).toBeTruthy();
    // Will renomme N1 : la migration suivante ne touche à rien.
    await d.elements.modifier(DECOR_DEFAUT_AVOCAT, { nom: "Mon halo" });
    const r2 = await migrerDonnees(d, "2026-10-02T09:00:00.000Z");
    expect(r2.decorsAjoutes ?? []).toHaveLength(0);
    expect((await d.elements.obtenir(DECOR_DEFAUT_AVOCAT))!.nom).toBe("Mon halo");
    // Aucun défaut de format n'est posé sur les décors du catalogue (l'étape 3 ne les retire donc jamais).
    expect((await d.elements.obtenir(DECOR_DEFAUT_AVOCAT))!.formatsParDefaut).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
describe("LUT 3D (.cube) de l'aperçu du plateau", () => {
  const cubeIdentite = (n: number) => {
    const lignes = [`TITLE "Essai"`, `LUT_3D_SIZE ${n}`, "DOMAIN_MIN 0.0 0.0 0.0", "DOMAIN_MAX 1.0 1.0 1.0"];
    for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) lignes.push(`${r / (n - 1)} ${g / (n - 1)} ${b / (n - 1)}`);
    return lignes.join("\n");
  };

  it("lit la taille dans l'en-tête et les couleurs dans l'ordre rouge, vert, bleu", () => {
    const lut = lut3d.lireCube(cubeIdentite(5));
    expect(lut.taille).toBe(5);
    expect(lut.titre).toBe("Essai");
    expect(lut.donnees).toHaveLength(5 ** 3 * 3);
    const [r, g, b] = lut3d.echantillonner(lut, 0.3, 0.6, 0.9);
    expect(r).toBeCloseTo(0.3, 5);
    expect(g).toBeCloseTo(0.6, 5);
    expect(b).toBeCloseTo(0.9, 5);
  });

  it("refuse clairement un fichier cassé (taille absente, nombre de couleurs faux, LUT 1D)", () => {
    expect(() => lut3d.lireCube("0 0 0\n1 1 1")).toThrow(/taille/i);
    expect(() => lut3d.lireCube("LUT_3D_SIZE 2\n0 0 0\n1 1 1")).toThrow(/annonce 8 couleurs mais en contient 2/);
    expect(() => lut3d.lireCube("LUT_1D_SIZE 16\n0 0 0")).toThrow(/trois dimensions/);
  });

  it("réduit une LUT 65³ à 33³ pour le navigateur, sans changer les couleurs", () => {
    // LUT « chaude » synthétique : r + 0,05, b − 0,05.
    const n = 65;
    const lignes = [`LUT_3D_SIZE ${n}`];
    for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) lignes.push(`${Math.min(1, r / (n - 1) + 0.05)} ${g / (n - 1)} ${Math.max(0, b / (n - 1) - 0.05)}`);
    const grande = lut3d.lireCube(lignes.join("\n"));
    const petite = lut3d.reduireLut(grande);
    expect(petite.taille).toBe(lut3d.TAILLE_LUT_NAVIGATEUR);
    for (const [r, g, b] of [
      [0.2, 0.4, 0.6],
      [0.5, 0.5, 0.5],
      [0.9, 0.1, 0.3],
    ]) {
      const a = lut3d.echantillonner(grande, r, g, b);
      const c = lut3d.echantillonner(petite, r, g, b);
      for (let i = 0; i < 3; i++) expect(Math.abs(a[i] - c[i])).toBeLessThan(0.002);
    }
  });

  it("applique la LUT aux pixels avec l'intensité : 0 % ne change rien, 100 % donne la LUT", () => {
    const inverse = lut3d.lutIdentite(2);
    for (let i = 0; i < inverse.donnees.length; i++) inverse.donnees[i] = 1 - inverse.donnees[i];
    const pixels = new Uint8ClampedArray([200, 100, 50, 255]);
    lut3d.appliquerLutPixels(pixels, inverse, 0);
    expect([...pixels]).toEqual([200, 100, 50, 255]);
    lut3d.appliquerLutPixels(pixels, inverse, 1);
    expect([...pixels]).toEqual([55, 155, 205, 255]);
    expect(lut3d.donneesTexture3D(inverse)).toHaveLength(2 ** 3 * 4);
  });

  const reelle = "../Axion-IA/<dossier-de-plan-prive>/luts/Axion-Buffer-Clair-obscur.cube";
  it.skipIf(!existsSync(reelle))("lit la vraie LUT Axion Clair-obscur (65³) et la réduit à 33³", () => {
    const lut = lut3d.lireCube(readFileSync(reelle, "utf8"));
    expect(lut.taille).toBe(65);
    expect(lut3d.reduireLut(lut).taille).toBe(33);
  });
});

/* ------------------------------------------------------------------ */
describe("enregistrement différé (≈ 800 ms)", () => {
  function horloge() {
    let maintenant = 0;
    const minuteries = new Map<number, { quand: number; f: () => void }>();
    let n = 0;
    return {
      setTimeout: (f: () => void, ms: number) => {
        minuteries.set(++n, { quand: maintenant + ms, f });
        return n;
      },
      clearTimeout: (id: unknown) => void minuteries.delete(id as number),
      async avancer(ms: number) {
        maintenant += ms;
        for (const [id, m] of [...minuteries]) {
          if (m.quand <= maintenant) {
            minuteries.delete(id);
            m.f();
          }
        }
        await new Promise((r) => setTimeout(r, 0));
      },
    };
  }

  it("plusieurs changements rapprochés = un seul enregistrement, 800 ms après le dernier", async () => {
    const h = horloge();
    let n = 0;
    const p = creerPlanificateur(async () => void n++, DELAI_ENREGISTREMENT_MS, h);
    p.planifier();
    await h.avancer(300);
    p.planifier();
    await h.avancer(300);
    p.planifier();
    await h.avancer(799);
    expect(n).toBe(0);
    await h.avancer(1);
    expect(n).toBe(1);
  });

  it("un changement pendant un enregistrement en relance un seul après lui, jamais deux à la fois", async () => {
    const h = horloge();
    let enCours = 0;
    let max = 0;
    let n = 0;
    let liberer: () => void = () => {};
    const p = creerPlanificateur(async () => {
      enCours++;
      max = Math.max(max, enCours);
      n++;
      await new Promise<void>((r) => (liberer = r));
      enCours--;
    }, 800, h);
    p.planifier();
    await h.avancer(800);
    expect(n).toBe(1);
    p.planifier();
    await h.avancer(800);
    p.planifier();
    await h.avancer(800);
    expect(n).toBe(1);
    liberer();
    await new Promise((r) => setTimeout(r, 0));
    expect(n).toBe(2);
    liberer();
    await new Promise((r) => setTimeout(r, 0));
    expect(max).toBe(1);
  });

  it("« vider » enregistre tout de suite ce qui attend (avant « Fabriquer ») ; « arrêter » l'abandonne", async () => {
    const h = horloge();
    let n = 0;
    const p = creerPlanificateur(async () => void n++, 800, h);
    p.planifier();
    await p.vider();
    expect(n).toBe(1);
    await h.avancer(1000);
    expect(n).toBe(1);
    await p.vider();
    expect(n).toBe(1);
    p.planifier();
    p.arreter();
    await h.avancer(1000);
    expect(n).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
describe("tableau A.3 : les cas où il faut vous aider", () => {
  const base = { personnageId: "p", fondTournage: "", fichierIds: [], fournisseur: "simulation", creeLe: "", modifieLe: "", origine: "filme" as const };
  const visages: Visage[] = [
    { ...base, id: "v34", nom: "Trois-quarts, veste", angle: "trois-quarts", tenue: "Veste sombre", tenueId: "veste-sombre", posture: "assis", statut: "pret" },
    { ...base, id: "vface", nom: "Face, veste", angle: "face", tenue: "Veste sombre", tenueId: "veste-sombre", posture: "assis", statut: "pret" },
    { ...base, id: "vchem", nom: "Face, chemise", angle: "face", tenue: "Chemise noire", tenueId: "chemise-noire", posture: "assis", statut: "pret" },
    { ...base, id: "vgen", nom: "Costume bleu", angle: "trois-quarts", tenue: "Costume bleu", tenueId: "costume-bleu", posture: "assis", statut: "a_verifier", origine: "genere" },
  ];
  const voix: Voix[] = [{ id: "voix", personnageId: "p", nom: "Ma voix", langue: "fr-FR", minutesEnregistrees: 1, statut: "pret", reglages: { vitesse: 1, stabilite: 50, emotion: 50 }, fichierIds: [], fournisseur: "simulation", creeLe: "", modifieLe: "" }];

  it("une posture pas encore filmée est grisée, avec son repli (Debout → Assis)", () => {
    const p = logique.posturesDisponibles(visages, "veste-sombre");
    expect(p.find((x) => x.posture === "assis")).toMatchObject({ filmee: true });
    expect(p.find((x) => x.posture === "debout")).toMatchObject({ filmee: false, repli: "assis" });
  });

  it("tenues : une vignette par tenue ; une tenue fabriquée depuis une image est signalée", () => {
    const t = logique.tenuesDisponibles(visages);
    expect(t.map((x) => x.id)).toEqual(["veste-sombre", "chemise-noire", "costume-bleu"]);
    expect(t.find((x) => x.id === "costume-bleu")!.generee).toBe(true);
    // Le visage principal : l'angle trois-quarts prêt de la tenue et de la posture choisies.
    expect(logique.visagePour(visages, "veste-sombre", "assis")!.id).toBe("v34");
    expect(logique.visagePour(visages, "chemise-noire", "assis")!.id).toBe("vchem");
    expect(logique.visagePour(visages, "veste-sombre", "debout")).toBeUndefined();
  });

  it("un seul angle prêt dans la tenue : « 1 angle · effet 2 caméras par recadrage » ; deux angles sinon", () => {
    const deux = logique.etatAngles(visages, visages[0], {});
    expect(deux.mode).toBe("deux-angles");
    expect(deux.mention).toBeNull();
    const un = logique.etatAngles(visages, visages[2], {});
    expect(un.mode).toBe("un-angle");
    expect(un.mention).toBe("1 angle · effet 2 caméras par recadrage");
    // Un seul angle VOULU : pas de mention.
    expect(logique.etatAngles(visages, visages[2], { repartitionAngles: "un-angle" }).mention).toBeNull();
  });

  it("toute première fois : la carte à 3 cases (Voix · Double presque de face · Trois-quarts) tant que rien n'est prêt", () => {
    const cases = logique.premiereFois([], []);
    expect(cases!.map((c) => c.libelle)).toEqual(["Voix", "Double presque de face", "Trois-quarts"]);
    expect(cases!.every((c) => !c.pret)).toBe(true);
    expect(logique.premiereFois(visages, [])!.find((c) => c.cle === "voix")!.pret).toBe(false);
    expect(logique.premiereFois(visages, voix)).toBeNull();
  });

  it("brouillon repris : un double supprimé entre-temps fait passer le bloc Plateau en orange", () => {
    const entree = { blocs: [], visages, voix, decor: null, distribution: [{ role: "Face caméra", source: "double" as const, personnageId: "p", visageId: "v34", voixId: "voix" }] };
    expect(logique.etatPlateau(entree).ton).toBe("pret");
    expect(logique.etatPlateau({ ...entree, distribution: [{ ...entree.distribution[0], visageId: "v-disparu" }] }).ton).toBe("orange");
    expect(logique.etatPlateau({ ...entree, visages: visages.map((v) => (v.id === "v34" ? { ...v, statut: "echec" as const } : v)) }).ton).toBe("orange");
    expect(logique.etatVoix(entree).ton).toBe("pret");
    expect(logique.etatVoix({ ...entree, voix: [] }).ton).toBe("orange");
  });

  it("un décor ou un double à vérifier : jamais lancé sans confirmation", () => {
    const r1 = decorsCatalogue("x").find((e) => e.id === "decor-r1-bureau-bois")!;
    const aVerifier = logique.elementsAVerifier({ decor: r1, visages, visageIds: ["vgen", "v34"] });
    expect(aVerifier).toEqual(["Décor « Bureau bois clair-obscur »", "Double « Costume bleu »"]);
    expect(logique.decisionLancement({ coutCentimes: 350, seuilCentimes: 2000, resteCentimes: 10000, aVerifier: [] })).toEqual({ genre: "direct" });
    expect(logique.decisionLancement({ coutCentimes: 350, seuilCentimes: 2000, resteCentimes: 10000, aVerifier })).toEqual({ genre: "confirmer", raisons: aVerifier });
    expect(logique.decisionLancement({ coutCentimes: 2500, seuilCentimes: 2000, resteCentimes: 10000, aVerifier: [] })).toEqual({ genre: "confirmer", raisons: ["Plus cher que d'habitude"] });
  });

  it("budget du mois presque atteint : la carte « Version économique · Relever le plafond »", () => {
    expect(logique.decisionLancement({ coutCentimes: 530, seuilCentimes: 2000, resteCentimes: 350, aVerifier: [] })).toEqual({ genre: "budget", resteCentimes: 350, coutCentimes: 530 });
  });

  it("« Décrivez » : libellés des pastilles (trouvé, à créer avec son prix, pas encore filmé avec son repli)", () => {
    expect(logique.libellePastille({ genre: "decor", etat: "trouve", id: "x", libelle: "Bureau" })).toBe("Bureau ✓");
    expect(logique.libellePastille({ genre: "tenue", etat: "a-creer", libelle: "costume bleu", coutEstime: { centimes: 25, devise: "EUR" }, dureeEstimeeSec: 180 })).toMatch(/costume bleu · à créer \(≈ 0,25/);
    expect(logique.libellePastille({ genre: "posture", etat: "non-filme", libelle: "Debout", repli: "assis" })).toBe("Debout · pas encore filmé → Assis");
  });

  it("« Mes scripts » : ceux du format, triés par note puis par date", () => {
    const s = [
      { id: "a", formatId: "avocat", notes: { globale: 80 }, modifieLe: "2026-09-01" },
      { id: "b", formatId: "avocat", notes: { globale: 92 }, modifieLe: "2026-08-01" },
      { id: "c", formatId: "podcast", notes: { globale: 99 }, modifieLe: "2026-10-01" },
      { id: "d", formatId: "avocat", notes: { globale: 80 }, modifieLe: "2026-09-20" },
      { id: "e", formatId: "avocat", modifieLe: "2026-10-01" },
    ];
    expect(logique.trierMesScripts(s, "avocat").map((x) => x.id)).toEqual(["b", "d", "a", "e"]);
  });
});

/* ------------------------------------------------------------------ */
describe("services de l'écran « Votre vidéo »", () => {
  it("Mes scripts du format avocat, les mieux notés d'abord", async () => {
    const scripts = await express.mesScripts("avocat");
    expect(scripts.length).toBeGreaterThan(0);
    const notes = scripts.map((s) => s.note ?? -1);
    expect([...notes].sort((a, b) => b - a)).toEqual(notes);
    expect(scripts.every((s) => s.blocs.length > 0)).toBe(true);
  });

  it("« bureau, costume bleu, debout » → Bureau trouvé, costume bleu à créer (prix, durée), debout pas encore filmé → assis ; rien n'est lancé", async () => {
    await migrerDonnees(depots(), "2026-10-02T08:00:00.000Z");
    const avant = (await depots().travaux.lister()).length;
    const p = await express.pastillesDepuisPhrase("p-will", "bureau, costume bleu, debout");
    expect(p[0]).toMatchObject({ genre: "decor", etat: "trouve" });
    expect(p[1]).toMatchObject({ genre: "tenue", etat: "a-creer" });
    expect(p[1].etat === "a-creer" && p[1].coutEstime.centimes).toBeGreaterThan(0);
    expect(p[2]).toMatchObject({ genre: "posture", etat: "non-filme", repli: "assis" });
    expect((await depots().travaux.lister()).length).toBe(avant);
  });

  it("un script choisi dans « Mes scripts » devient celui de la vidéo SANS être réécrit ; une référence n'est jamais modifiée", async () => {
    const d = depots();
    const { creerBrouillon } = await import("@/services/videos");
    const id = await creerBrouillon("avocat");
    const ref = (await d.scripts.obtenir("script-ref-avocat-1"))!;
    const versionAvant = ref.version;
    await express.enregistrerBrouillonExpress(id, { scriptId: ref.id }, ref.blocs);
    expect((await d.videos.obtenir(id))!.scriptId).toBe(ref.id);
    expect((await d.scripts.obtenir(ref.id))!.version).toBe(versionAvant);
    // Will retouche le texte : une copie est créée, la référence reste intacte.
    const retouche = [...ref.blocs.slice(0, -1), { ...ref.blocs.at(-1)!, segments: [{ id: "n", texte: "Abonnez-vous pour la suite." }] }];
    const r = await express.enregistrerBrouillonExpress(id, { scriptId: ref.id }, retouche);
    expect(r.scriptId).not.toBe(ref.id);
    expect(JSON.stringify((await d.scripts.obtenir(ref.id))!.blocs)).toBe(JSON.stringify(ref.blocs));
    expect((await d.videos.obtenir(id))!.scriptId).toBe(r.scriptId);
  });

  it("les plans de la maquette (moteur avocat) sont lus pour être composés dans le navigateur, avec la voix", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const m = await fabrication.maquetteRapide("v-03");
    expect(m.audioUrl).toBeTruthy();
    const p = await express.plansMaquette(m.versionId);
    expect(p.plans.length).toBeGreaterThan(3);
    expect(p.plans[0].debutSec).toBe(0);
    expect(p.sousTitres.length).toBeGreaterThan(0);
    await expect(express.plansMaquette("ver-inconnue")).rejects.toThrow(/n'existe plus/);
  });

  it("images du plateau : les décors du catalogue ont leur image", async () => {
    await migrerDonnees(depots(), "2026-10-02T08:00:00.000Z");
    const p = await express.donneesPlateau();
    expect(p.decors[DECOR_DEFAUT_AVOCAT]).toContain("fond-1-halo-orange.jpg");
    expect(p.decors["decor-r1-bureau-bois"]).toBeUndefined();
  });

  it("le décor fabriqué devient l'habitude du format ; un décor rangé n'est plus proposé", async () => {
    expect(await express.decorHabituel("avocat")).toBeUndefined();
    await depots().videos.modifier("v-03", { styles: { decorId: "decor-n5-creme-chaud" } });
    await express.memoriserDecor("v-03");
    expect(await express.decorHabituel("avocat")).toBe("decor-n5-creme-chaud");
    await depots().elements.modifier("decor-n5-creme-chaud", { archiveLe: "2026-10-02T10:00:00.000Z" });
    expect(await express.decorHabituel("avocat")).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
describe("« Demander une modification » : rien sans confirmation", () => {
  it("plans touchés par les opérations (le titre touche les 3 premières secondes, un mot corrigé est gratuit)", () => {
    const plans = [
      { id: "p1", debutSec: 0, finSec: 2, sourceImage: "double" },
      { id: "p2", debutSec: 2, finSec: 5, sourceImage: "illustration" },
      { id: "p3", debutSec: 5, finSec: 8, sourceImage: "double" },
    ];
    expect(modifications.plansTouchesPar([{ type: "modifierTitre", texte: "X" }], plans)).toEqual(["p1", "p2"]);
    expect(modifications.plansTouchesPar([{ type: "remplacerIllustration", planId: "p2" }], plans)).toEqual(["p2"]);
    expect(modifications.plansTouchesPar([{ type: "corrigerMot", segmentSousTitresId: "s", indexMot: 0, mot: "x" }], plans)).toEqual([]);
    expect(modifications.plansTouchesPar([{ type: "ajusterRythme", sens: "plus-rapide", depuisSec: 4 }], plans)).toEqual(["p2", "p3"]);
  });

  it("une demande est traduite (résumé, plans, prix) sans rien lancer ; la confirmation lance la retouche une seule fois", async () => {
    const d = depots();
    const travauxAvant = (await d.travaux.lister()).length;
    const p = await modifications.proposerModification("v-03", "plus de plans serrés au début");
    expect(p.statut).toBe("proposee");
    expect(p.operations.length).toBeGreaterThan(0);
    expect(p.planIds.length).toBeGreaterThan(0);
    expect(p.cout.centimes).toBeGreaterThan(0);
    expect(p.plansTouches.every((n) => n >= 1)).toBe(true);
    expect((await d.travaux.lister()).length).toBe(travauxAvant);

    const r = await modifications.confirmerModification("v-03", p.id);
    expect(r.travailId).toBeTruthy();
    expect((await d.travaux.lister()).length).toBe(travauxAvant + 1);
    const h = await modifications.historiqueModifications("v-03");
    expect(h.find((x) => x.id === p.id)!.statut).toBe("confirmee");
    await expect(modifications.confirmerModification("v-03", p.id)).rejects.toThrow(/déjà été traitée/);
  });

  it("hors capacités (« change la tenue ») : réponse claire avec le prix de la vidéo à refaire, aucune opération", async () => {
    const p = await modifications.proposerModification("v-03", "change la tenue pour un costume bleu");
    expect(p.statut).toBe("hors-capacite");
    expect(p.operations).toEqual([]);
    expect(p.horsCapacite!.prixVideo.centimes).toBeGreaterThan(0);
    await expect(modifications.confirmerModification("v-03", p.id)).rejects.toThrow();
  });

  it("une proposition laissée reste dans la conversation (rien n'est effacé)", async () => {
    const p = await modifications.proposerModification("v-03", "plus de plans serrés");
    await modifications.abandonnerModification("v-03", p.id);
    const h = await modifications.historiqueModifications("v-03");
    expect(h).toHaveLength(1);
    expect(h[0].statut).toBe("abandonnee");
    await expect(modifications.proposerModification("v-03", "   ")).rejects.toThrow(/Écrivez/);
  });
});

describe("sous-titres synchronisés au lecteur", () => {
  it("le groupe en cours est celui qui contient l'instant ; aucun pendant un blanc", () => {
    const g = [
      { debutSec: 0, finSec: 0.6 },
      { debutSec: 0.6, finSec: 1.2 },
      { debutSec: 2, finSec: 2.5 },
    ];
    expect(groupeA(g, 0)).toBe(0);
    expect(groupeA(g, 0.7)).toBe(1);
    expect(groupeA(g, 1.6)).toBe(-1);
    expect(groupeA(g, 2.4)).toBe(2);
  });
});
