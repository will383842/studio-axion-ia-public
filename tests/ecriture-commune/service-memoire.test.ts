/** C1.4 : service de mémoire commune (base en mémoire) : sources, fenêtre de 60 partagée, tirages communs sur 200 lignes. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const svc = await import("@/services/memoire-ecriture");
const { FENETRE_VERSIONS_MEMOIRE } = await import("@/domaine/ecriture-commune/memoire");

beforeEach(() => reinitialiserDepots());

const trace = (id: string, date: string, issue: string, texteDit: string, videoId?: string) => ({
  id, date, issue, videoId, creeLe: date, modifieLe: date,
  versions: [{ passe: "ecriture", defauts: [], ecriture: { script: { accroche: [{ dit: texteDit, ecran: "" }], douleur: [], promesse: [], etapes: [], exemple: {}, aRetenir: [], appel: [] } } }],
});

// Précharge le service du cas concret (import lourd) : sans cela le premier test dépasse son délai, et l'import raté serait avalé.
await import("@/services/cas-concret-scripts");

describe("entreesMemoire", () => {
  it("lit les traces du tableau livrées seulement, hors la vidéo qui s'écrit", async () => {
    const d = depots();
    await d.tracesScriptsTableau.enregistrer(trace("a", "2026-10-01T00:00:00Z", "livre", "Le planning se range seul chaque soir.", "v1") as never);
    await d.tracesScriptsTableau.enregistrer(trace("b", "2026-10-02T00:00:00Z", "refuse", "Texte refusé jamais gardé.", "v2") as never);
    await d.tracesScriptsTableau.enregistrer(trace("c", "2026-10-03T00:00:00Z", "livre", "Le devis part en deux minutes.", "v3") as never);
    const tous = (await svc.entreesMemoire()).filter((e) => e.formatId === "tableau-anime").map((e) => e.texte);
    expect(tous.join(" ")).toContain("planning");
    expect(tous.join(" ")).toContain("devis");
    expect(tous.join(" ")).not.toContain("refusé");
    const sans = (await svc.entreesMemoire({ sauf: "v3" })).filter((e) => e.formatId === "tableau-anime").map((e) => e.texte);
    expect(sans.join(" ")).not.toContain("devis");
  });

  it("lit les variantes non archivées (ouverture et fin), pas les archivées", async () => {
    const d = depots();
    const seg = (texte: string) => [{ id: "b", blocRecette: "x", segments: [{ id: "s", texte }] }];
    const v = (id: string, code: string, version: number, texte: string, archiveLe?: string, formatId = "facecam") => ({ id, code, version, ouverture: seg(texte), fin: seg("Fin."), archiveLe, creeLe: `2026-10-0${version}T00:00:00Z`, modifieLe: "x", formatId });
    await d.variantes.enregistrer(v("1", "0042-AV-TT", 1, "Ancienne ouverture écrite.") as never);
    await d.variantes.enregistrer(v("2", "0042-AV-TT", 2, "Ouverture courante du code.") as never);
    await d.variantes.enregistrer(v("3", "0043-AV-TT", 1, "Ouverture archivée.", "2026-10-05T00:00:00Z") as never);
    const t = (await svc.entreesMemoire()).map((e) => e.texte).join(" | ");
    expect(t).toContain("Ouverture courante du code.");
    expect(t).not.toContain("Ancienne ouverture");
    expect(t).not.toContain("archivée");
  });

  it("un formatId inventé n'entre pas dans la mémoire commune", async () => {
    const d = depots();
    const seg = (texte: string) => [{ id: "b", blocRecette: "x", segments: [{ id: "s", texte }] }];
    await d.variantes.enregistrer({ id: "1", code: "0009-XY-TT", version: 1, ouverture: seg("Ouverture d'un format inventé."), fin: seg("Fin."), creeLe: "2026-10-01T00:00:00Z", modifieLe: "x", formatId: "xyz" } as never);
    await d.variantes.enregistrer({ id: "2", code: "0010-IV-TT", version: 1, ouverture: seg("Ouverture image vidéo masquée gardée."), fin: seg("Fin."), creeLe: "2026-10-01T00:00:00Z", modifieLe: "x", formatId: "image-video" } as never);
    const t = (await svc.entreesMemoire()).map((x) => x.texte).join(" | ");
    expect(t).not.toContain("inventé");
    expect(t).toContain("image vidéo masquée");
  });

  it("dit sur la console quand les traces du tableau ou les variantes sont illisibles", async () => {
    const d = depots();
    const espion = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const l1 = vi.spyOn(d.tracesScriptsTableau, "lister").mockRejectedValue(new Error("panne traces"));
    const l2 = vi.spyOn(d.variantes, "lister").mockRejectedValue(new Error("panne variantes"));
    await expect(svc.entreesMemoire()).resolves.toBeDefined();
    const messages = espion.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes("traces du tableau illisibles"))).toBe(true);
    expect(messages.some((m) => m.includes("variantes illisibles"))).toBe(true);
    espion.mockRestore(); l1.mockRestore(); l2.mockRestore();
  });

  it("une seule trace illisible reste muette", async () => {
    const d = depots();
    const espion = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await d.tracesScriptsTableau.enregistrer({ id: "casse", issue: "livre", date: "x", versions: null } as never);
    await svc.entreesMemoire();
    expect(espion.mock.calls.map((c) => String(c[0])).some((m) => m.includes("tableau"))).toBe(false);
    espion.mockRestore();
  });

  it("les textes de l'avocat n'entrent jamais dans la mémoire commune, ni sans format connu", async () => {
    const d = depots();
    const seg = (texte: string) => [{ id: "b", blocRecette: "x", segments: [{ id: "s", texte }] }];
    const v = (id: string, code: string, texte: string, formatId?: string) => ({ id, code, version: 1, ouverture: seg(texte), fin: seg("Fin."), creeLe: "2026-10-01T00:00:00Z", modifieLe: "x", formatId });
    await d.variantes.enregistrer(v("1", "0001-AV-TT", "Ouverture de l'avocat à garder dehors.", "avocat") as never);
    await d.variantes.enregistrer(v("2", "0002-FC-TT", "Ouverture du face caméra gardée.", "facecam") as never);
    await d.variantes.enregistrer(v("3", "0003-XX-TT", "Ouverture sans format connu.", undefined) as never);
    const e = await svc.entreesMemoire();
    const t = e.map((x) => x.texte).join(" | ");
    expect(t).not.toContain("avocat");
    expect(t).not.toContain("sans format connu");
    expect(e.find((x) => x.texte.includes("face caméra"))?.formatId).toBe("facecam");
    expect(e.some((x) => x.formatId === "avocat")).toBe(false);
  });

  it("garde UNE fenêtre de 60 versions, toutes sources confondues, les plus récentes", async () => {
    const d = depots();
    for (let i = 0; i < 70; i++) {
      await d.tracesScriptsTableau.enregistrer(trace(`t${i}`, new Date(Date.UTC(2026, 8, 1, 0, 0, i)).toISOString(), "livre", `Script numéro ${i} unique ici.`, `v${i}`) as never);
    }
    const d2 = depots();
    const version = (id: string, travailId: string, creeLe: string) => ({ id, videoId: `cc-${id}`, travailId, creeLe, numero: 1, commande: { moteurId: "montage-cas-concret" } });
    await d2.travaux.enregistrer({ id: "tcc", parametres: { casConcret: { journal: { etapes: { ecriture: { sortie: { fiche: { casId: "x", ecrans: [{ texteDit: "Le colis du cas concret part avant la nuit." }] } } } } } } } } as never);
    await d2.versions.enregistrer(version("cc1", "tcc", "2026-10-10T00:00:00Z") as never);
    const tout = await svc.entreesMemoire();
    const e = tout.filter((x) => x.formatId === "tableau-anime");
    expect(e.length).toBeLessThanOrEqual(FENETRE_VERSIONS_MEMOIRE);
    expect(tout.length).toBeLessThanOrEqual(FENETRE_VERSIONS_MEMOIRE);
    const textes = tout.map((x) => x.texte).join(" | ");
    expect(textes).toContain("Script numéro 69 unique ici.");
    expect(textes).not.toContain("Script numéro 0 unique ici.");
    expect(tout.some((x) => x.formatId === "cas-concret" && x.texte.includes("colis du cas concret"))).toBe(true);
  });

  it("lit bien le cas concret : au moins une entrée a le format « cas-concret » (le catalogue y est toujours)", async () => {
    expect((await svc.entreesMemoire()).some((e) => e.formatId === "cas-concret")).toBe(true);
  });

  it("journalise l'erreur quand le cas concret est illisible, sans lever", async () => {
    const cc = await import("@/services/cas-concret-scripts");
    const spy = vi.spyOn(cc, "scriptsDejaEcritsDates").mockRejectedValueOnce(new Error("casse"));
    const erreur = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(svc.entreesMemoire()).resolves.toBeDefined();
    expect(erreur).toHaveBeenCalled();
    spy.mockRestore();
    erreur.mockRestore();
  });

  it("ne lève jamais, même si une source est illisible", async () => {
    const d = depots();
    await d.tracesScriptsTableau.enregistrer({ id: "casse", issue: "livre", date: "x", versions: null } as never);
    await expect(svc.entreesMemoire()).resolves.toBeDefined();
  });
});

describe("memoireEcriture", () => {
  it("rend séquences et bloc depuis les scripts lus", async () => {
    const d = depots();
    for (const [i, t] of ["Avant, on triait vos factures à la main chaque lundi matin.", "Avant, on triait vos factures à la main chaque semaine."].entries()) {
      await d.tracesScriptsTableau.enregistrer(trace(`m${i}`, `2026-10-0${i + 1}T00:00:00Z`, "livre", t, `v${i}`) as never);
    }
    const m = await svc.memoireEcriture();
    expect(m.scripts.length).toBeGreaterThanOrEqual(2);
    expect(m.bloc.length).toBeGreaterThan(0);
  });
});

describe("memoireEcriture : anonymisation", () => {
  it("masque les noms sensibles avant de fabriquer séquences et bloc", async () => {
    const d = depots();
    for (const [i, t] of ["Chez Dupont SARL, on triait vos factures à la main chaque lundi matin.", "Chez Dupont SARL, on triait vos factures à la main chaque semaine."].entries()) {
      await d.tracesScriptsTableau.enregistrer(trace(`a${i}`, `2026-10-0${i + 1}T00:00:00Z`, "livre", t, `v${i}`) as never);
    }
    const sans = await svc.memoireEcriture();
    expect(sans.bloc + sans.scripts.join(" ")).toContain("Dupont");
    const m = await svc.memoireEcriture({ nomsSensibles: ["Dupont SARL"] });
    expect(m.scripts.join(" ")).not.toContain("Dupont");
    expect(m.sequences.map((x) => x.texte).join(" ")).not.toContain("Dupont");
    expect(m.bloc).not.toContain("Dupont");
    expect(m.bloc.length).toBeGreaterThan(0);
  });
});

describe("memoireEcriture : passages tolérés", () => {
  it("un passage à redire contenant un nom sensible reste toléré", async () => {
    const d = depots();
    const phrase = "Chez Dupont SARL, on triait vos factures à la main chaque lundi matin.";
    for (const i of [0, 1]) await d.tracesScriptsTableau.enregistrer(trace(`p${i}`, `2026-10-0${i + 1}T00:00:00Z`, "livre", phrase, `v${i}`) as never);
    const sans = await svc.memoireEcriture({ nomsSensibles: ["Dupont SARL"] });
    expect(sans.sequences.some((x) => x.texte.includes("factures"))).toBe(true);
    const avec = await svc.memoireEcriture({ nomsSensibles: ["Dupont SARL"], tolere: [phrase] });
    expect(avec.sequences.some((x) => x.texte.includes("factures"))).toBe(false);
  });
});

describe("tirages communs", () => {
  it("gardent 200 lignes au plus, les plus récentes", async () => {
    for (let i = 0; i < 205; i++) await svc.noterTirageCommun({ role: "accroche", formeId: `accroche-${i}`, formatId: "tableau-anime" });
    const t = await svc.tiragesCommuns();
    expect(t).toHaveLength(200);
    expect(t[t.length - 1].formeId).toBe("accroche-204");
  });
  it("recentsPour rend les formes récentes du rôle, du plus ancien au plus récent, tous formats confondus", async () => {
    await svc.noterTirageCommun({ role: "accroche", formeId: "accroche-chiffre", formatId: "cas-concret" });
    await svc.noterTirageCommun({ role: "douleur", formeId: "douleur-geste", formatId: "cas-concret" });
    await svc.noterTirageCommun({ role: "accroche", formeId: "accroche-scene", formatId: "tableau-anime" });
    expect(await svc.recentsPour("accroche")).toEqual(["accroche-chiffre", "accroche-scene"]);
  });
  it("tirerFormeCommune tire hors des récents et note le tirage", async () => {
    const f1 = await svc.tirerFormeCommune({ role: "appel", reseau: "linkedin", formatId: "cas-concret", graine: "g1" });
    const f2 = await svc.tirerFormeCommune({ role: "appel", reseau: "linkedin", formatId: "cas-concret", graine: "g1" });
    expect(f2.id).not.toBe(f1.id);
    expect(await svc.recentsPour("appel")).toEqual([f1.id, f2.id]);
  });
  it("tirerFormeCommune ne reste jamais sans forme : les récents sont limités à n−1 formes du rôle", async () => {
    const { formesDuRole } = await import("@/domaine/ecriture-commune/banque-formes");
    const n = formesDuRole("appel", "linkedin").length;
    const tirees: string[] = [];
    for (let i = 0; i < n * 2 + 1; i++) tirees.push((await svc.tirerFormeCommune({ role: "appel", reseau: "linkedin", formatId: "cas-concret", graine: `g${i}` })).id);
    for (let i = n - 1; i < tirees.length; i++) expect(tirees.slice(i - (n - 1), i)).not.toContain(tirees[i]);
  });
});
