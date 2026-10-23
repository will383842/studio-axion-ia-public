/**
 * STOCK DES CAS (lecture seule) : pour chaque cas du catalogue, où il en est, combien de vidéos sont faites, ce qui reste.
 * Service pur : aucun accès au serveur, aucune écriture, aucun appel payant.
 */
import { describe, expect, it } from "vitest";
import { CATALOGUE, casVisibles, estCasStock } from "@/formats/cas-concret/catalogue";
import { CATALOGUE_TS } from "@/formats/cas-concret/catalogue/base";
import { IDEES_A_VENIR } from "@/formats/cas-concret/stock-idees";
import type { Video } from "@/domaine/types";
import type { ScriptValide } from "@/moteurs/montage-cas-concret/script-valide";
import { construireStockCas, synthese, phraseSynthese } from "@/services/cas-concret-stock";

const video = (id: string, casId: string | undefined, statut: Video["statut"], extra: Partial<Video> = {}): Video =>
  ({ id, formatId: "cas-concret", statut, creeLe: "2026-10-01T10:00:00.000Z", modifieLe: "2026-10-02T10:00:00.000Z", entrees: casId ? { casConcret: { casId } } : {}, ...extra }) as unknown as Video;

const script = (casId: string, numero = 2, valideLe = "2026-09-30"): ScriptValide => ({ casId, versionCas: 1, valideLe, source: "t", ecrans: [], numero });

describe("construireStockCas", () => {
  it("donne une ligne par cas du catalogue, dans l'ordre, avec titre, offre, nature, posture, thème", () => {
    const lignes = construireStockCas({ scripts: {}, videos: [] });
    // Sans catalogue fourni : les cas d'avant le stock SEULEMENT (aucun cas du stock par métier).
    expect(lignes.map((l) => l.casId)).toEqual(CATALOGUE_TS.map((c) => c.id));
    expect(lignes.some((l) => estCasStock(l.casId))).toBe(false);
    expect(construireStockCas({ scripts: {}, videos: [], catalogue: CATALOGUE })).toHaveLength(CATALOGUE.length);
    const premier = lignes[0]!;
    expect(premier.titre).toBe(CATALOGUE[0]!.titre);
    expect(premier.offre).toBe(CATALOGUE[0]!.offre);
    expect(premier.posture).toBe(CATALOGUE[0]!.posture);
  });

  it("script « validé (version N, date) » si un script existe, sinon « à valider »", () => {
    const [a, b] = CATALOGUE;
    const lignes = construireStockCas({ scripts: { [a!.id]: { ...script(a!.id, 3, "2026-09-30"), versionCas: a!.version }, [b!.id]: null }, videos: [], catalogueScripts: () => undefined });
    expect(lignes[0]!.script).toEqual({ valide: true, version: 3, date: "2026-09-30" });
    expect(lignes[1]!.script).toEqual({ valide: false });
  });

  it("un script d'une autre version du cas n'est pas compté « validé »", () => {
    const a = CATALOGUE[0]!;
    const perime = { ...script(a.id), versionCas: a.version + 1 };
    const lignes = construireStockCas({ scripts: { [a.id]: perime }, videos: [], catalogueScripts: () => undefined });
    expect(lignes[0]!.script).toEqual({ valide: false });
  });

  it("catalogue étendu éteint : le stock ne montre pas les cas de la phase 2 (même filtre que la page)", () => {
    const visibles = casVisibles(CATALOGUE.map((cas) => ({ cas })), { catalogueEtendu: false }).map((x) => x.cas);
    expect(visibles.length).toBe(8);
    expect(visibles.some((c) => estCasStock(c.id))).toBe(false);
    const lignes = construireStockCas({ scripts: {}, videos: [], catalogue: visibles });
    expect(lignes).toHaveLength(8);
    expect(construireStockCas({ scripts: {}, videos: [], catalogue: casVisibles(CATALOGUE.map((cas) => ({ cas })), { catalogueEtendu: true }).map((x) => x.cas) })).toHaveLength(CATALOGUE_TS.length);
  });

  it("à défaut de script du studio, prend le script validé du code", () => {
    const lignes = construireStockCas({ scripts: {}, videos: [] });
    const recrutement = lignes.find((l) => l.casId === "recrutement-apporteurs")!;
    expect(recrutement.script.valide).toBe(true);
  });

  it("compte les vidéos faites par cas, avec leur état et la date de la dernière", () => {
    const id = CATALOGUE[1]!.id;
    const lignes = construireStockCas({
      scripts: {},
      videos: [
        video("a", id, "brouillon"),
        video("b", id, "en_fabrication"),
        video("c", id, "prete", { etapeEditoriale: "a_relire", modifieLe: "2026-10-05T08:00:00.000Z" }),
        video("d", id, "prete", { etapeEditoriale: "validee", modifieLe: "2026-10-09T08:00:00.000Z" }),
        video("e", id, "echec"),
        video("f", "autre-cas", "prete"),
        video("g", undefined, "prete"),
        video("h", id, "prete", { formatId: "avocat" }),
      ],
    });
    const l = lignes.find((x) => x.casId === id)!;
    expect(l.videos.total).toBe(5);
    expect(l.videos.faites).toBe(2);
    expect(l.videos.parEtat).toEqual({ brouillon: 1, "en-fabrication": 1, "a-relire": 1, validee: 1, "a-reprendre": 1 });
    expect(l.videos.derniere).toBe("2026-10-09T08:00:00.000Z");
  });

  it("ne compte ni les vidéos archivées, ni celles arrêtées", () => {
    const id = CATALOGUE[1]!.id;
    const l = construireStockCas({ scripts: {}, videos: [video("a", id, "archivee"), video("b", id, "annulee"), video("c", id, "prete")] }).find((x) => x.casId === id)!;
    expect(l.videos.total).toBe(1);
    expect(l.videos.derniere).toBe("2026-10-02T10:00:00.000Z");
  });

  it("sans vidéo : zéro et pas de date", () => {
    const l = construireStockCas({ scripts: {}, videos: [] })[2]!;
    expect(l.videos).toMatchObject({ total: 0, faites: 0, derniere: undefined });
  });

  it("prix « au plus » seulement s'il est fourni", () => {
    const [a, b] = CATALOGUE;
    const lignes = construireStockCas({ scripts: {}, videos: [], montants: { [a!.id]: 61 } });
    expect(lignes[0]!.prixAuPlusCentimes).toBe(61);
    expect(lignes.find((l) => l.casId === b!.id)!.prixAuPlusCentimes).toBeUndefined();
  });

  it("faits : compte ceux qui ont une preuve et signale ceux dont la source n'est pas « code »", () => {
    for (const l of construireStockCas({ scripts: {}, videos: [] })) {
      const cas = CATALOGUE.find((c) => c.id === l.casId)!;
      expect(l.faits.total).toBe(cas.faits.length);
      expect(l.faits.avecPreuve).toBe(cas.faits.filter((f) => f.preuve.trim() !== "").length);
      const attendus = cas.faits.filter((f) => f.source !== "code" || f.preuve.trim() === "").map((f) => f.id);
      expect(l.faits.aSignaler.map((f) => f.id)).toEqual(attendus);
    }
  });

  it("signale un fait sans preuve", () => {
    const cas = { ...CATALOGUE[0]!, faits: [{ id: "f1", enonce: "x", valeurs: [1], source: "code", preuve: " " }] } as unknown as (typeof CATALOGUE)[number];
    const l = construireStockCas({ catalogue: [cas], scripts: {}, videos: [] })[0]!;
    expect(l.faits).toMatchObject({ total: 1, avecPreuve: 0 });
    expect(l.faits.aSignaler[0]).toMatchObject({ id: "f1", raison: "sans-preuve" });
  });
});

describe("synthèse", () => {
  it("« 8 cas · 1 script prêt · 7 à valider · N vidéos faites »", () => {
    const lignes = construireStockCas({ scripts: {}, videos: [video("a", CATALOGUE[0]!.id, "prete")] });
    const s = synthese(lignes);
    expect(s.cas).toBe(CATALOGUE_TS.length);
    expect(s.prets + s.aValider).toBe(s.cas);
    expect(s.videosFaites).toBe(1);
    expect(phraseSynthese({ cas: 8, prets: 1, aValider: 7, videosFaites: 0 })).toBe("8 cas · 1 script prêt · 7 à valider · 0 vidéo faite");
    expect(phraseSynthese({ cas: 8, prets: 2, aValider: 6, videosFaites: 3 })).toBe("8 cas · 2 scripts prêts · 6 à valider · 3 vidéos faites");
  });
});

describe("idées à venir", () => {
  it("la liste est vide aujourd'hui (une autre tâche la remplira)", () => {
    expect(IDEES_A_VENIR).toEqual([]);
  });
});
