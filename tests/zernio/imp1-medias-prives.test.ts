import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ajouterEntree, dejaCopies, entreeDepuisCopie, entreeExclue, nouveauJournal, resumeJournal } from "../../src/services/import-buffer/journal";
import { cleMediaPrive, copierMediasDuPost, type StockagePrive } from "../../src/services/import-buffer/medias-prives";
import type { PostBuffer } from "../../src/services/import-buffer/types";

const OCTETS = new Uint8Array([1, 2, 3, 4, 5]);
const SHA = createHash("sha256").update(OCTETS).digest("hex");

function post(): PostBuffer {
  return {
    id: "post-exemple-01", canalId: "c", texte: "t", statut: "scheduled",
    medias: [
      { type: "image", mime: "image/jpeg", source: "https://exemple.invalid/a.jpg", texteAlternatif: "Alt exemple" },
      { type: "document", mime: "application/pdf", source: "https://exemple.invalid/b.pdf", titre: "Titre exemple" },
    ],
  };
}

describe("IMP-1 médias trop gros", () => {
  const stockage: StockagePrive = { urlDepotDuree: async () => "https://prive.invalid/x" };
  it("refuse sur la taille annoncée avant tout téléchargement", async () => {
    const appeler = vi.fn(async () => new Response(OCTETS));
    const p = post();
    p.medias = [{ ...p.medias[0], tailleAnnoncee: 600 * 1024 * 1024 }];
    const r = await copierMediasDuPost(p, stockage, appeler as unknown as typeof fetch);
    expect(r.echecs[0].raison).toContain("volumineux");
    expect(appeler).not.toHaveBeenCalled();
  });
  it("refuse sur content-length sans lire le corps ni déposer", async () => {
    const appeler = vi.fn(async (_u: string, _i?: RequestInit) => new Response(OCTETS, { headers: { "content-length": String(600 * 1024 * 1024) } }));
    const r = await copierMediasDuPost(post(), stockage, appeler as unknown as typeof fetch);
    expect(r.copies).toEqual([]);
    expect(r.echecs.every((e) => e.raison.includes("volumineux"))).toBe(true);
    expect(appeler.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.method !== "PUT")).toBe(true);
  });
});

describe("IMP-1 médias privés", () => {
  it("copie sous import-buffer/<id>/ avec type, taille et sha256, sans adresse en retour", async () => {
    const depots: { url: string; taille: number }[] = [];
    const appeler = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        depots.push({ url, taille: (init.body as Uint8Array).byteLength });
        return new Response(null, { status: 200 });
      }
      return new Response(OCTETS, { status: 200 });
    });
    const stockage: StockagePrive = { urlDepotDuree: async (cle) => `https://prive.invalid/${cle}?X-Amz-Signature=zzz` };
    const r = await copierMediasDuPost(post(), stockage, appeler as unknown as typeof fetch);
    expect(r.echecs).toEqual([]);
    expect(r.copies.map((c) => c.cleStockage)).toEqual(["import-buffer/post-exemple-01/0.jpg", "import-buffer/post-exemple-01/1.pdf"]);
    expect(r.copies[0]).toMatchObject({ type: "image", mime: "image/jpeg", taille: 5, sha256: SHA, texteAlternatif: "Alt exemple" });
    expect(depots).toHaveLength(2);
    const sortie = JSON.stringify(r);
    expect(sortie).not.toMatch(/https?:\/\//);
    expect(sortie).not.toContain("X-Amz");
  });

  it("un échec n'arrête pas les autres et n'expose aucune adresse", async () => {
    let n = 0;
    const appeler = vi.fn(async (_u: string, init?: RequestInit) => {
      if (init?.method === "PUT") return new Response(null, { status: 200 });
      return n++ === 0 ? new Response("non", { status: 403 }) : new Response(OCTETS, { status: 200 });
    });
    const r = await copierMediasDuPost(post(), { urlDepotDuree: async (c) => `https://prive.invalid/${c}` }, appeler as unknown as typeof fetch);
    expect(r.copies).toHaveLength(1);
    expect(r.echecs).toHaveLength(1);
    expect(JSON.stringify(r.echecs)).not.toMatch(/https?:\/\//);
  });

  it("refuse un identifiant qui sortirait du dossier, et un stockage absent", async () => {
    expect(() => cleMediaPrive("../x", 0, "image/png")).toThrow();
    expect(cleMediaPrive("ok_1", 2, "video/mp4")).toBe("import-buffer/ok_1/2.mp4");
    const r = await copierMediasDuPost(post(), {}, vi.fn() as unknown as typeof fetch);
    expect(r.copies).toHaveLength(0);
    expect(r.echecs).toHaveLength(2);
  });
});

describe("IMP-1 journal (pur, sans base)", () => {
  it("construit, remplace par identifiant et résume", () => {
    let j = nouveauJournal(new Date("2026-11-01T08:00:00Z"), true);
    expect(j).toMatchObject({ type: "import-buffer", aBlanc: true, posts: [] });
    j = ajouterEntree(j, entreeExclue({ id: "post-exemple-03", raison: "video-test-31-10" }));
    j = ajouterEntree(j, entreeDepuisCopie({ postId: "post-exemple-01", copies: [{ rang: 0, type: "image", mime: "image/jpeg", taille: 5, sha256: SHA, cleStockage: "import-buffer/post-exemple-01/0.jpg" }], echecs: [] }));
    j = ajouterEntree(j, entreeDepuisCopie({ postId: "post-exemple-01", copies: [], echecs: [{ rang: 0, raison: "x" }] }));
    expect(resumeJournal(j)).toMatchObject({ exclu: 1, echec: 1, total: 2 });
    expect(dejaCopies(j).size).toBe(0);
    expect(() => ajouterEntree(j, { bufferId: "../x", etat: "lu", medias: [], echecsMedias: 0 })).toThrow();
  });
});
