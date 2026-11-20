import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GENERATEURS_RECETTE, ligneRecette, recetteEnMarkdown, type ReleveDepots } from "../../../outils/recette-retouche-chat/recette";

const C = { generateur: "demo-facecam", videoId: "vid", versionAvant: "v1" };
const LANCEE = { statut: "lancee", travailId: "t1" };
const releve = (sur: Partial<ReleveDepots> = {}): ReleveDepots => ({
  reservations: [{ travailId: "t1", centimes: 0, devise: "EUR", statut: "consommee" }],
  engagements: { t1: 0 },
  depenses: [],
  versions: [{ id: "v2", videoId: "vid", parentVersionId: "v1" }],
  ...sur,
});

describe("C7-25-a · recette du chat de retouche", () => {
  it("a) démo lancée, tout à zéro, une version : gratuit-prouve", () => {
    const l = ligneRecette(releve(), { ...C, issue: LANCEE });
    expect(l.verdict).toBe("gratuit-prouve");
    expect(l.raisons).toEqual([]);
    expect(l.versionsEcrites).toBe(1);
  });

  it("a bis) engagement absent compte pour zéro", () => {
    expect(ligneRecette(releve({ engagements: {} }), { ...C, issue: LANCEE }).verdict).toBe("gratuit-prouve");
    expect(ligneRecette(releve({ engagements: { t1: null } }), { ...C, issue: LANCEE }).verdict).toBe("gratuit-prouve");
  });

  it("b) réservation de 1 centime : écart", () => {
    const l = ligneRecette(releve({ reservations: [{ travailId: "t1", centimes: 1, devise: "EUR", statut: "active" }] }), { ...C, issue: LANCEE });
    expect(l.verdict).toBe("ecart");
    expect(l.raisons).toContain("réservé 1 centime");
  });

  it("b bis) engagement, coût réel et devise autre : chacun est un écart", () => {
    expect(ligneRecette(releve({ engagements: { t1: 5 } }), { ...C, issue: LANCEE }).verdict).toBe("ecart");
    expect(ligneRecette(releve({ depenses: [{ travailId: "t1", total: { centimes: 3, devise: "EUR" } }] }), { ...C, issue: LANCEE }).verdict).toBe("ecart");
    const usd = ligneRecette(releve({ reservations: [{ travailId: "t1", centimes: 2, devise: "USD", statut: "active" }] }), { ...C, issue: LANCEE });
    expect(usd.verdict).toBe("ecart");
    expect(usd.raisons).toContain("devise autre que EUR non nulle");
  });

  it("c) deux versions nées du même parent : écart (double version)", () => {
    const l = ligneRecette(releve({ versions: [{ id: "v2", videoId: "vid", parentVersionId: "v1" }, { id: "v3", videoId: "vid", parentVersionId: "v1" }] }), { ...C, issue: LANCEE });
    expect(l.verdict).toBe("ecart");
    expect(l.raisons.join()).toContain("2 versions écrites");
  });

  it("c bis) lancée mais aucune version : écart", () => {
    expect(ligneRecette(releve({ versions: [] }), { ...C, issue: LANCEE }).verdict).toBe("ecart");
  });

  it("d) dépense avec appelId : écart « 1 appel Claude »", () => {
    const l = ligneRecette(releve({ depenses: [{ travailId: "t1", total: { centimes: 0, devise: "EUR" }, appelId: "a1" }] }), { ...C, issue: LANCEE });
    expect(l.verdict).toBe("ecart");
    expect(l.raisons).toContain("1 appel Claude");
    expect(l.appelsClaude).toBe(1);
  });

  it("e) plan-pret sans rien : non-branche ; avec réservation ou version : écart", () => {
    const vide: ReleveDepots = { reservations: [], engagements: {}, depenses: [], versions: [] };
    expect(ligneRecette(vide, { ...C, issue: { statut: "plan-pret" } }).verdict).toBe("non-branche");
    expect(ligneRecette(vide, { ...C, issue: { statut: "inchangee" } }).verdict).toBe("non-branche");
    const avec = ligneRecette({ ...vide, reservations: [{ travailId: "t9", centimes: 4, devise: "EUR", statut: "active" }] }, { ...C, issue: { statut: "plan-pret", travailId: "t9" } });
    expect(avec.verdict).toBe("ecart");
    expect(ligneRecette({ ...vide, versions: [{ id: "v2", videoId: "vid", parentVersionId: "v1" }] }, { ...C, issue: { statut: "plan-pret" } }).verdict).toBe("ecart");
  });

  it("e bis) issue inconnue : écart", () => {
    expect(ligneRecette(releve(), { ...C, issue: { statut: "rendue", travailId: "t1" } }).verdict).toBe("ecart");
  });

  it("f) les réservations d'un autre travail sont ignorées", () => {
    const l = ligneRecette(releve({ reservations: [{ travailId: "t1", centimes: 0, devise: "EUR", statut: "consommee" }, { travailId: "autre", centimes: 99, devise: "EUR", statut: "active" }], engagements: { t1: 0, autre: 50 } }), { ...C, issue: LANCEE });
    expect(l.verdict).toBe("gratuit-prouve");
    expect(l.reserveCentimes).toBe(0);
  });

  it("f bis) les versions d'une autre vidéo ou d'un autre parent sont ignorées", () => {
    const l = ligneRecette(releve({ versions: [{ id: "v2", videoId: "vid", parentVersionId: "v1" }, { id: "x", videoId: "autre", parentVersionId: "v1" }, { id: "y", videoId: "vid", parentVersionId: "v0" }] }), { ...C, issue: LANCEE });
    expect(l.versionsEcrites).toBe(1);
  });

  it("g) GENERATEURS_RECETTE : les 5 + demo-facecam, sans doublon, gelé", () => {
    expect([...GENERATEURS_RECETTE]).toEqual(["avocat", "image-video", "facecam-animee", "tutoriel-outil", "video-longue", "demo-facecam"]);
    expect(new Set(GENERATEURS_RECETTE).size).toBe(GENERATEURS_RECETTE.length);
    expect(Object.isFrozen(GENERATEURS_RECETTE)).toBe(true);
  });

  it("h) Markdown : une ligne par générateur, en-têtes exacts, aucun symbole monétaire", () => {
    const lignes = GENERATEURS_RECETTE.map((g) => ligneRecette(releve(), { ...C, generateur: g, issue: LANCEE }));
    const md = recetteEnMarkdown(lignes);
    expect(md.split("\n")[0]).toBe("| Générateur | Issue | Réservé (centimes) | Engagé | Coût réel | Versions écrites | Appels Claude | Verdict |");
    expect(md.split("\n").filter((x) => /^\| (avocat|image-video|facecam-animee|tutoriel-outil|video-longue|demo-facecam) /.test(x)).length).toBe(6);
    expect(md).not.toMatch(/€|\$|EUR\b/);
    const ecart = recetteEnMarkdown([ligneRecette(releve({ engagements: { t1: 7 } }), { ...C, issue: LANCEE })]);
    expect(ecart).toContain("engagé 7 centimes");
    expect(ecart).not.toMatch(/€|\$|EUR\b/);
  });

  it("i) garde statique : aucun import d'argent, de fabrication ou de fournisseur", () => {
    const src = readFileSync(join(process.cwd(), "outils/recette-retouche-chat/recette.ts"), "utf8");
    expect(src).not.toMatch(/from "[^"]*(_commun|credits|couts|fabrication|travaux|fournisseurs)[^"]*"/);
    expect(src).not.toMatch(/node:fs|fetch\(/);
  });
});
