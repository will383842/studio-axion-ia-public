import { describe, expect, it } from "vitest";
import { casTraites, type VideoCasTraite } from "./cas-traites";

const video = (id: string, casId: string, plus: Partial<VideoCasTraite> = {}): VideoCasTraite => ({
  id,
  titre: `Vidéo ${id}`,
  formatId: "cas-concret",
  statut: "prete",
  entrees: { casConcret: { casId } },
  terminee: "2026-10-10T10:00:00.000Z",
  modifieLe: "2026-10-10T10:05:00.000Z",
  ...plus,
});

describe("casTraites (règle pure)", () => {
  it("une vidéo prête rend son cas traité, daté de sa fin", () => {
    const m = casTraites({ videos: [video("v1", "c1")] });
    expect(m.get("c1")).toEqual({ videoId: "v1", titre: "Vidéo v1", le: "2026-10-10T10:00:00.000Z" });
  });

  it("sans date de fin, la date de modification sert", () => {
    const m = casTraites({ videos: [video("v1", "c1", { terminee: undefined })] });
    expect(m.get("c1")?.le).toBe("2026-10-10T10:05:00.000Z");
  });

  it("la corbeille compte (statut d'avant l'archivage)", () => {
    expect(casTraites({ videos: [video("v1", "c1", { statut: "archivee", statutAvantArchive: "prete" })] }).has("c1")).toBe(true);
    expect(casTraites({ videos: [video("v1", "c1", { statut: "archivee", statutAvantArchive: "echec" })] }).has("c1")).toBe(false);
  });

  it("supprimée pour de bon mais inscrite : le cas reste traité, sans lien de vidéo", () => {
    const m = casTraites({ videos: [], inscrits: { c1: { videoId: "v1", titre: "Ancienne", le: "2026-10-09T00:00:00.000Z" } } });
    expect(m.get("c1")).toEqual({ titre: "Ancienne", le: "2026-10-09T00:00:00.000Z" });
  });

  it("inscrite et vidéo encore là : le lien est gardé", () => {
    const m = casTraites({ videos: [video("v1", "c1")], inscrits: { c1: { videoId: "v1", titre: "X", le: "2026-10-10T10:00:00.000Z" } } });
    expect(m.get("c1")?.videoId).toBe("v1");
  });

  it.each(["en_file", "en_fabrication", "echec", "brouillon", "maquette"] as const)("%s : le cas n'est pas traité (dont la pause « à valider »)", (statut) => {
    expect(casTraites({ videos: [video("v1", "c1", { statut })] }).size).toBe(0);
  });

  it("l'avocat et les autres formats sont ignorés", () => {
    expect(casTraites({ videos: [video("v1", "c1", { formatId: "avocat" }), video("v2", "c2", { formatId: "facecam" })] }).size).toBe(0);
  });

  it("démonstration, vidéo dérivée et essai simulé ne comptent pas", () => {
    const m = casTraites({ videos: [video("v1", "c1", { estDemo: true }), video("v2", "c2", { sourceVideoId: "v9" }), video("v3", "c3", { typeDerive: "accroche" }), video("v4", "c4", { essaiSimule: true })] });
    expect(m.size).toBe(0);
  });

  it("remis en stock, aucune nouvelle vidéo : le cas n'est plus traité (vidéo et inscription anciennes)", () => {
    const m = casTraites({
      videos: [video("v1", "c1")],
      inscrits: { c1: { videoId: "v1", titre: "X", le: "2026-10-10T10:00:00.000Z" } },
      remis: { c1: { remisLe: "2026-10-20T00:00:00.000Z" } },
    });
    expect(m.size).toBe(0);
  });

  it("remis en stock puis une nouvelle vidéo finie : traité de nouveau", () => {
    const m = casTraites({
      videos: [video("v1", "c1"), video("v2", "c1", { terminee: "2026-10-21T08:00:00.000Z" })],
      remis: { c1: { remisLe: "2026-10-20T00:00:00.000Z" } },
    });
    expect(m.get("c1")?.videoId).toBe("v2");
  });

  it("remis en stock puis l'ancienne vidéo retouchée : le cas reste libre", () => {
    const m = casTraites({
      videos: [video("v1", "c1", { terminee: "2026-10-21T08:00:00.000Z" })],
      remis: { c1: { remisLe: "2026-10-20T00:00:00.000Z", videoIds: ["v1"] } },
    });
    expect(m.size).toBe(0);
  });

  it("la porte B (« porte-b » ou son alias « b ») ne rend jamais un cas traité", () => {
    const m = casTraites({ videos: [video("v1", "c1", { entrees: { casConcret: { casId: "c1", porte: "porte-b" } } }), video("v2", "c2", { entrees: { casConcret: { casId: "c2", porte: "b" } } })] });
    expect(m.size).toBe(0);
  });

  it("une remise ne touche que son cas", () => {
    const m = casTraites({ videos: [video("v1", "c1"), video("v2", "c2")], remis: { c1: { remisLe: "2026-10-20T00:00:00.000Z" } } });
    expect([...m.keys()]).toEqual(["c2"]);
  });
});
