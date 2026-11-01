import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { normaliserPost } from "../../src/services/import-buffer/lire-buffer";
import { construireRapport, formaterRapport, joursDe } from "../../src/services/import-buffer/rapport";
import { lireStatistiquesPassees, statistiquesEnCsv } from "../../src/services/import-buffer/statistiques-buffer";
import type { CanalBuffer, PostBuffer } from "../../src/services/import-buffer/types";

const FIX = JSON.parse(readFileSync(new URL("./fixtures/buffer-a-venir-fictif.json", import.meta.url), "utf8")).data;
const CANAUX: CanalBuffer[] = FIX.channels.map((c: Record<string, string>) => ({ id: c.id, nom: c.displayName, service: c.service }));
const POSTS: PostBuffer[] = FIX.posts.edges.map((e: { node: Record<string, unknown> }) => normaliserPost(e.node));
// Mots interdits jamais en clair : jetons concaténés.
const MOT_A = ["cert", "ifié"].join("");
const MOT_B = ["Quali", "opi"].join("");

describe("IMP-1 rapport", () => {
  it("jours de la période du 06 au 18/11 (13 jours)", () => {
    const j = joursDe("2026-11-06", "2026-11-18");
    expect(j).toHaveLength(13);
    expect(j[0]).toBe("2026-11-06");
    expect(j[12]).toBe("2026-11-18");
  });

  it("comptes × jours × premier commentaire", () => {
    const r = construireRapport(POSTS.slice(0, 2), CANAUX);
    const un = r.comptes.find((c) => c.canalId === "canal-exemple-1")!;
    const deux = r.comptes.find((c) => c.canalId === "canal-exemple-2")!;
    expect(un.jours["2026-11-06"]).toEqual({ total: 1, avecPremierCommentaire: 1, sansPremierCommentaire: 0 });
    expect(deux.jours["2026-11-07"]).toEqual({ total: 1, avecPremierCommentaire: 0, sansPremierCommentaire: 1 });
    expect(r.horsPeriode).toBe(0);
    expect(r.liensJoints).toEqual([{ postId: "post-exemple-02", canalId: "canal-exemple-2" }]);
  });

  it("mots interdits sur TOUS les champs, sans recopier le texte", () => {
    const p: PostBuffer = {
      id: "post-x", canalId: "canal-exemple-1", statut: "scheduled", dateUtc: "2026-11-08T09:00:00Z", texte: `Texte ${MOT_A}`,
      premierCommentaire: `Commentaire ${MOT_B}`, titre: `Titre ${MOT_A}`,
      lienJoint: { url: "https://exemple.invalid", titre: `Lien ${MOT_B}` },
      medias: [
        { type: "image", mime: "image/png", source: "", texteAlternatif: `Alt ${MOT_A}` },
        { type: "document", mime: "application/pdf", source: "", titre: `Document ${MOT_B} ${"x".repeat(70)}` },
      ],
    };
    const r = construireRapport([p], CANAUX);
    expect(r.motsInterdits.map((m) => m.champ).sort()).toEqual(["lien", "premier commentaire", "texte", "texte alternatif", "titre", "titre de document"].sort());
    expect(r.titresPdfLongs).toEqual([{ postId: "post-x", longueur: `Document ${MOT_B} ${"x".repeat(70)}`.length }]);
    const sortie = formaterRapport(r);
    expect(sortie).not.toContain("Texte ");
    expect(sortie).toContain("Titres de PDF de plus de 60 signes");
  });

  it("« certificat » reste autorisé, un titre de 60 signes pile n'est pas signalé", () => {
    const p: PostBuffer = { id: "p", canalId: "canal-exemple-1", statut: "scheduled", texte: "Un certificat exemple", medias: [{ type: "document", mime: "application/pdf", source: "", titre: "y".repeat(60) }] };
    const r = construireRapport([p], CANAUX);
    expect(r.motsInterdits).toEqual([]);
    expect(r.titresPdfLongs).toEqual([]);
    expect(r.horsPeriode).toBe(1);
  });
});

describe("IMP-1 statistiques passées", () => {
  it("lit les mesures par post (pages) et exporte en CSV, lecture seule", async () => {
    const requetes: string[] = [];
    const client = {
      async lire(q: string, v?: Record<string, unknown>) {
        requetes.push(q);
        const premiere = !v?.apres;
        return { posts: { edges: [{ node: { id: premiere ? "post-exemple-10" : "post-exemple-11", channelId: "canal-exemple-1", sentAt: "2026-10-01T09:00:00Z", metrics: [{ type: "likes", name: "Likes", value: 12 }, { type: "views", value: "bad" }] } }], pageInfo: { hasNextPage: premiere, endCursor: premiere ? "p2" : null } } };
      },
    };
    const stats = await lireStatistiquesPassees(client, "exemple-org");
    expect(stats.map((s) => s.postId)).toEqual(["post-exemple-10", "post-exemple-11"]);
    expect(stats[0].mesures).toEqual([{ type: "likes", nom: "Likes", valeur: 12 }]);
    expect(requetes.every((q) => !/mutation/i.test(q))).toBe(true);
    expect(statistiquesEnCsv(stats).split("\n")).toHaveLength(3);
    vi.restoreAllMocks();
  });
});
