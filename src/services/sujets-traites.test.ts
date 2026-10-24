import { describe, expect, it } from "vitest";
import { cleCas, contientMotInterdit, normaliser, type VideoRegistre } from "@/domaine/sujets-traites";
import { CATALOGUE, estCasPhase2 } from "@/formats/cas-concret/catalogue";
import { banqueUsine, lireGardeSujets, registreSujets, sujetLisible, suggestionsSujets, verifierSujet, videoLisible, type SourcesSujets } from "./sujets-traites";

// Expressions bannies, écrites en morceaux pour ne pas les avoir en clair dans le dépôt.
const INTERDIT_A = "Gren" + "oble";

const MAINTENANT = "2026-10-19T10:00:00.000Z";

function video(id: string, formatId: string, extra: Partial<VideoRegistre> = {}): VideoRegistre {
  return { id, titre: `Vidéo ${id}`, formatId, statut: "prete", creeLe: "2026-10-10T08:00:00.000Z", ...extra };
}

/** Faux dépôts : tout est en mémoire, rien ne passe par la base. */
function sources(videos: VideoRegistre[], extra: Partial<SourcesSujets> = {}): SourcesSujets {
  return {
    videos: async () => videos,
    sujets: async () => ({ sujets: [], sujetDuScript: {} }),
    fichiers: async () => [],
    garde: async () => "bloquant",
    catalogueEtendu: async () => false,
    banque: () => [],
    maintenant: () => MAINTENANT,
    ...extra,
  };
}

const casRecrutement = video("v1", "cas-concret", { entrees: { casConcret: { casId: "recrutement-apporteurs" } } });
const candidatCas = { generateur: "cas-concret", cles: [cleCas("recrutement-apporteurs")] };

describe("service sujets traités : vérification", () => {
  it("refuse puis accepte avec le bon jeton", async () => {
    const src = sources([casRecrutement]);
    const refus = await verifierSujet(candidatCas, undefined, src);
    expect(refus.ok).toBe(false);
    if (refus.ok) return;
    expect(refus.niveau).toBe("identique");
    expect(await verifierSujet(candidatCas, { choix: "refaire", jeton: refus.jeton }, src)).toEqual({ ok: true, confirme: "refaire" });
  });

  it("un jeton périmé est refusé (une autre vidéo est apparue entre-temps)", async () => {
    const refus = await verifierSujet(candidatCas, undefined, sources([casRecrutement]));
    if (refus.ok) throw new Error("refus attendu");
    const apres = sources([casRecrutement, video("v2", "cas-concret", { entrees: { casConcret: { casId: "recrutement-apporteurs" } } })]);
    const r = await verifierSujet(candidatCas, { choix: "nouvel-angle", jeton: refus.jeton }, apres);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.jetonPerime).toBe(true);
      expect(r.precedents).toHaveLength(2);
    }
  });

  it("l'interrupteur « eteint » répond toujours ok, sans lire les vidéos", async () => {
    let lectures = 0;
    const src = sources([casRecrutement], { garde: async () => "eteint", videos: async () => { lectures++; return [casRecrutement]; } });
    expect(await verifierSujet(candidatCas, undefined, src)).toEqual({ ok: true });
    expect(lectures).toBe(0);
  });

  it("« avertissement » prévient sans bloquer", async () => {
    const r = await verifierSujet(candidatCas, undefined, sources([casRecrutement], { garde: async () => "avertissement" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.avertissement?.precedents.map((p) => p.videoId)).toEqual(["v1"]);
  });

  it("réglage absent ou inconnu : « bloquant »", async () => {
    expect(await lireGardeSujets(sources([], { garde: async () => undefined }))).toBe("bloquant");
    expect(await lireGardeSujets(sources([], { garde: async () => "peut-être" }))).toBe("bloquant");
    expect((await verifierSujet(candidatCas, undefined, sources([casRecrutement], { garde: async () => 42 }))).ok).toBe(false);
  });

  it("une reprise n'est pas contrôlée", async () => {
    expect(await verifierSujet({ ...candidatCas, estReprise: true }, undefined, sources([casRecrutement]))).toEqual({ ok: true });
    expect(await verifierSujet({ ...candidatCas, ignorerVideoId: "v1" }, undefined, sources([casRecrutement]))).toEqual({ ok: true });
  });

  it("le refus porte trois suggestions au plus : les cas visibles du catalogue sans vidéo comptée", async () => {
    const r = await verifierSujet(candidatCas, undefined, sources([casRecrutement]));
    if (r.ok) throw new Error("refus attendu");
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.suggestions.length).toBeLessThanOrEqual(3);
    expect(r.suggestions.every((s) => s.source === "catalogue" && s.casId !== "recrutement-apporteurs")).toBe(true);
  });

  it("le registre vient des vidéos et des sujets lus (sujet central numéroté sans vidéo)", async () => {
    const src = sources([], { sujets: async () => ({ sujets: [{ id: "m1", numero: 1, creeLe: "2026-10-05T08:00:00.000Z", idee: "Le diagnostic fuite", formatId: "avocat" }], sujetDuScript: {} }) });
    const registre = await registreSujets(src);
    expect(registre.map((e) => e.sujetId)).toEqual(["m1"]);
    const r = await verifierSujet({ generateur: "avocat", texte: "Le diagnostic fuite" }, undefined, src);
    expect(r.ok).toBe(false);
  });
});

describe("service sujets traités : suggestions", () => {
  it("cas concret : un cas traité (vidéo allée au bout, même supprimée) n'est jamais suggéré", async () => {
    const tous = await suggestionsSujets("cas-concret", undefined, sources([], { catalogueEtendu: async () => true }));
    expect(tous.length).toBeGreaterThan(0);
    const ids = new Set(tous.map((x) => x.casId!));
    const sans = await suggestionsSujets("cas-concret", undefined, sources([], { catalogueEtendu: async () => true, casTraites: async () => ids }));
    expect(sans.every((x) => !ids.has(x.casId!))).toBe(true);
  });

  it("les cas retirés par Will ne sont jamais suggérés", async () => {
    const tous = await suggestionsSujets("cas-concret", undefined, sources([], { catalogueEtendu: async () => true }));
    const ids = new Set(tous.flatMap((x) => (x.casId ? [x.casId] : [])).slice(0, 2));
    expect(ids.size).toBeGreaterThan(0);
    const sans = await suggestionsSujets("cas-concret", undefined, sources([], { catalogueEtendu: async () => true, casRetires: async () => ids }));
    expect(sans.some((x) => x.casId && ids.has(x.casId))).toBe(false);
  });

  it("cas concret : jamais un cas déjà pris, jamais un cas de la phase 2 si le catalogue étendu est éteint", async () => {
    const s = await suggestionsSujets("cas-concret", undefined, sources([casRecrutement]));
    expect(s.length).toBeGreaterThan(0);
    const etendu = await suggestionsSujets("cas-concret", undefined, sources([], { catalogueEtendu: async () => true }));
    expect(etendu.length).toBeGreaterThan(0);
    expect(etendu.length).toBeLessThanOrEqual(3);
    expect(s.some((x) => x.casId === "recrutement-apporteurs")).toBe(false);
    expect(s.every((x) => CATALOGUE.some((c) => c.id === x.casId))).toBe(true);
    expect(s.every((x) => !estCasPhase2(x.casId!))).toBe(true);
  });

  it("autres générateurs : sans doublon de titre, sans mot interdit, sans sujet déjà traité", async () => {
    const banque = [
      { titre: "Relancer les devis", code: "u1", source: "usine" as const },
      { titre: "relancer  les devis !", code: "u2", source: "usine" as const },
      { titre: `Une équipe à ${INTERDIT_A}`, code: "u3", source: "usine" as const },
      { titre: "Trier les CV", code: "u4", source: "usine" as const, textes: [`${"Aucun gain "}${"garanti"}`] },
      { titre: "Planifier les rappels", code: "u5", source: "usine" as const },
      { titre: "Compte rendu de visio", code: "u6", source: "usine" as const },
      { titre: "Facturer les formateurs", code: "u7", source: "usine" as const },
    ];
    const traitee = video("t1", "avocat", { titre: "Planifier les rappels", sujet: "Planifier les rappels" });
    const s = await suggestionsSujets("avocat", undefined, sources([traitee], { banque: () => banque }));
    expect(s.map((x) => x.titre)).toEqual(["Relancer les devis", "Compte rendu de visio", "Facturer les formateurs"]);
    expect(new Set(s.map((x) => normaliser(x.titre))).size).toBe(s.length);
    expect(s.some((x) => contientMotInterdit(x.titre))).toBe(false);
  });

  it("la vraie banque de l'Usine : propose et valide seulement, propre, sans doublon de titre", { timeout: 60_000 }, async () => {
    const lignes = await banqueUsine();
    expect(lignes.length).toBeGreaterThan(0);
    const s = await suggestionsSujets("avocat", undefined, sources([], { banque: banqueUsine }));
    expect(s.length).toBeGreaterThan(0);
    expect(s.length).toBeLessThanOrEqual(3);
    expect(new Set(s.map((x) => normaliser(x.titre))).size).toBe(s.length);
    expect(s.some((x) => contientMotInterdit(x.titre))).toBe(false);
    const cible = lignes[0]!.cible;
    const parCible = await suggestionsSujets("avocat", cible, sources([], { banque: banqueUsine }));
    expect(parCible.length).toBeGreaterThan(0);
  });
});

describe("service sujets traités : données abîmées", () => {
  it("une vidéo sans entrées, sans id ou sans statut est ignorée, sans erreur", () => {
    expect(videoLisible({ id: "v1", formatId: "avocat", statut: "prete", entrees: null, creeLe: "2026-10-01T00:00:00.000Z" })).toMatchObject({ id: "v1", entrees: {} });
    expect(videoLisible({ id: "v1" })).toBeUndefined();
    expect(videoLisible(null)).toBeUndefined();
    expect(videoLisible("n'importe quoi")).toBeUndefined();
  });

  it("un sujet sans brief, sans idée ou sans numéro est ignoré, sans erreur", () => {
    expect(sujetLisible({ id: "m1", numero: 1 })).toBeUndefined();
    expect(sujetLisible({ id: "m1", numero: 1, brief: null })).toBeUndefined();
    expect(sujetLisible({ id: "m1", brief: { idee: "x", formatId: "avocat" } })).toBeUndefined();
    expect(sujetLisible({ id: "m1", numero: 1, version: 2, creeLe: "2026-10-01T00:00:00.000Z", brief: { idee: "x", formatId: "avocat" }, origineUsine: { parts: { cas_usage: " c1 " } } })).toMatchObject({ idee: "x", version: 2, codeCasUsage: "c1" });
    expect(() => sujetLisible(undefined)).not.toThrow();
  });
});

describe("service sujets traités : relance", () => {
  it("la relance d'une vidéo en échec n'est pas bloquée par son propre sujet numéroté", async () => {
    const src = sources([video("v1", "avocat", { statut: "echec", scriptId: "s1" })], {
      sujets: async () => ({ sujets: [{ id: "m1", numero: 4, version: 1, creeLe: "2026-10-05T08:00:00.000Z", idee: "Le diagnostic fuite", formatId: "avocat" }], sujetDuScript: { s1: "m1" } }),
    });
    expect((await verifierSujet({ generateur: "avocat", texte: "Le diagnostic fuite" }, undefined, src)).ok).toBe(false);
    expect(await verifierSujet({ generateur: "avocat", texte: "Le diagnostic fuite", ignorerVideoId: "v1" }, undefined, src)).toEqual({ ok: true });
  });
});

describe("service sujets traités : relance et autres vidéos du même sujet", () => {
  it("v1 en échec et v2 prête sur le même numéro : la relance de v1 est REFUSÉE", async () => {
    const src = sources([video("v1", "avocat", { statut: "echec", scriptId: "s1" }), video("v2", "avocat", { scriptId: "s2" })], {
      sujets: async () => ({ sujets: [{ id: "m1", numero: 4, version: 1, creeLe: "2026-10-05T08:00:00.000Z", idee: "Le diagnostic fuite", formatId: "avocat" }], sujetDuScript: { s1: "m1", s2: "m1" } }),
    });
    const r = await verifierSujet({ generateur: "avocat", texte: "Le diagnostic fuite", ignorerVideoId: "v1" }, undefined, src);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.precedents.map((p) => p.videoId)).toEqual(["v2"]);
  });

  it("plusieurs vidéos ignorées : le brouillon repris (premier de la liste) décide du numéro de sujet écarté", async () => {
    const sujet = (id: string, numero: number) => ({ id, numero, version: 1, creeLe: "2026-10-05T08:00:00.000Z", idee: "Le diagnostic fuite", formatId: "avocat" });
    const src = sources([video("vA", "avocat", { statut: "echec", scriptId: "sA" }), video("vB", "avocat", { statut: "echec", scriptId: "sB" })], {
      sujets: async () => ({ sujets: [sujet("mA", 4), sujet("mB", 9)], sujetDuScript: { sA: "mA", sB: "mB" } }),
    });
    const candidat = { generateur: "avocat", texte: "Le diagnostic fuite" };
    // Contrôle : sans rien ignorer, refus ; avec [vA, vB], seul le numéro de vA (4) est ignoré, celui de vB (9) reste bloquant.
    expect((await verifierSujet(candidat, undefined, src)).ok).toBe(false);
    const r = await verifierSujet({ ...candidat, ignorerVideoIds: ["vA", "vB"] }, undefined, src);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.precedents.map((p) => p.sujetId)).toEqual(["mB"]);
    const inverse = await verifierSujet({ ...candidat, ignorerVideoIds: ["vB", "vA"] }, undefined, src);
    expect(inverse.ok).toBe(false);
    if (!inverse.ok) expect(inverse.precedents.map((p) => p.sujetId)).toEqual(["mA"]);
  });

  it("date de création absente : remplacée par maintenant, le « proche » joue", async () => {
    const lue = videoLisible({ id: "v1", formatId: "avocat", statut: "prete", titre: "T", sujet: "Relancer les devis non signés" });
    expect(Number.isFinite(Date.parse(lue!.creeLe))).toBe(true);
    const r = await verifierSujet({ generateur: "avocat", texte: "Relancer les devis non signés" }, undefined, sources([lue!]));
    expect(r.ok).toBe(false);
  });
});
