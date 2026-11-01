import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { promouvoirBrouillons } from "../../src/services/import-buffer/promotion";
import { rapprocher } from "../../src/services/import-buffer/rapprochement";
import { retirerJumeaux } from "../../src/services/import-buffer/retrait-jumeau";
import type { PostBuffer } from "../../src/services/import-buffer/types";
import type { PostZernio } from "../../src/fournisseurs/publication/zernio-client";
import { creerFauxClientZernio, postExemple, type AppelEnregistre, type ReponsePreparee } from "./aides/faux-zernio";

const buf = (n: number, p: Partial<PostBuffer> = {}): PostBuffer => ({ id: `post-exemple-${n}`, canalId: "canal-ig", texte: `Texte ${n}`, dateUtc: `2026-11-0${2 + (n % 5)}T1${n % 10}:00:00Z`, statut: "draft", medias: [], ...p });
const jumeau = (b: PostBuffer, p: Partial<PostZernio> = {}): PostZernio =>
  postExemple({ _id: `exemple-z-${b.id}`, content: b.texte, status: "draft", scheduledFor: b.dateUtc, platforms: [{ platform: "instagram", accountId: "exemple-compte-1" }], metadata: { origine: "import-buffer", bufferId: b.id, studioCle: `imp-${b.id}` }, ...p });

function zernio(posts: PostZernio[]) {
  const base = new Map(posts.map((p) => [p._id, structuredClone(p)]));
  const t = creerFauxClientZernio((a: AppelEnregistre): ReponsePreparee => {
    const u = new URL(a.url);
    const m = u.pathname.match(/\/v1\/posts\/([^/]+)$/);
    if (a.methode === "GET" && u.pathname.endsWith("/v1/posts")) {
      const statut = u.searchParams.get("status");
      const tous = [...base.values()].filter((p) => !statut || p.status === statut);
      const page = Number(u.searchParams.get("page") ?? 1);
      const lim = Number(u.searchParams.get("limit") ?? 100);
      return { statut: 200, corps: { posts: tous.slice((page - 1) * lim, page * lim) } };
    }
    if (a.methode === "GET" && m) return base.has(m[1]) ? { statut: 200, corps: { post: base.get(m[1]) } } : { statut: 404, corps: {} };
    if (a.methode === "PUT" && m && base.has(m[1])) {
      const j = a.json as { isDraft?: boolean; scheduledFor?: string };
      if (j.isDraft === false) Object.assign(base.get(m[1])!, { status: "scheduled", scheduledFor: j.scheduledFor });
      return { statut: 200, corps: { post: base.get(m[1]) } };
    }
    return { statut: 404, corps: {} };
  });
  return { ...t, base };
}
const puts = (z: ReturnType<typeof zernio>) => z.faux.appels.filter((a) => a.methode === "PUT").length;

describe("IMP-3 relecture · garde positive (promotion)", () => {
  it.each(["needs_approval", "error", "scheduled", "sent"])("jumeau Buffer au statut %s : buffer-actif, aucun PUT", async (statut) => {
    const b = buf(1, { statut });
    const z = zernio([jumeau(b)]);
    const r = await promouvoirBrouillons({ client: z.client, postsBuffer: [b], aBlanc: false, maintenant: z.horloge.maintenant });
    expect(r.lignes[0].etat).toBe("buffer-actif");
    expect(r.lignes[0].raison).toContain(statut);
    expect(puts(z)).toBe(0);
  });

  it("brouillon avec une date d'envoi (envoyeLe) : buffer-actif", async () => {
    const b = buf(1, { envoyeLe: "2026-10-01T10:00:00Z" });
    const z = zernio([jumeau(b)]);
    const r = await promouvoirBrouillons({ client: z.client, postsBuffer: [b], aBlanc: false, maintenant: z.horloge.maintenant });
    expect(r.lignes[0].etat).toBe("buffer-actif");
    expect(puts(z)).toBe(0);
  });

  it("vrai brouillon sans envoyeLe : promu", async () => {
    const b = buf(1, { dateUtc: "2026-11-05T10:00:00Z" });
    const z = zernio([jumeau(b)]);
    const r = await promouvoirBrouillons({ client: z.client, postsBuffer: [b], aBlanc: false, maintenant: z.horloge.maintenant, attendre: z.horloge.attendre });
    expect(r.lignes[0].etat).toBe("programme");
  });
});

describe("IMP-3 relecture · retrait et rapprochement alignés", () => {
  it("la liste à retirer à la main contient needs_approval et error, pas les brouillons", async () => {
    const posts = [buf(1, { statut: "scheduled" }), buf(2, { statut: "needs_approval" }), buf(3, { statut: "error" }), buf(4, { statut: "draft" })];
    const z = zernio(posts.map((p) => jumeau(p)));
    const r = await retirerJumeaux({ client: z.client, posts });
    expect(r.liste.map((l) => l.bufferId).sort()).toEqual(["post-exemple-1", "post-exemple-2", "post-exemple-3"]);
  });

  it("rapprochement : un jumeau needs_approval ou error est une double publication possible (pas de ZÉRO ÉCART)", () => {
    for (const statut of ["needs_approval", "error"]) {
      const b = buf(1, { statut });
      const d = rapprocher([b], [jumeau(b, { status: "scheduled" })], 1);
      expect(d.doublePublication).toEqual(["post-exemple-1"]);
      expect(d.zeroEcart).toBe(false);
    }
  });
});

describe("IMP-3 relecture · plafonds de la promotion", () => {
  it("posts déjà programmés chez Zernio comptés : le plafond horaire d'un compte est respecté d'un passage à l'autre", async () => {
    const deja = Array.from({ length: 20 }, (_, i) => jumeau(buf(100 + i), { status: "scheduled", scheduledFor: `2026-11-05T10:${String(i).padStart(2, "0")}:00Z`, metadata: { origine: "studio" } }));
    const b = buf(1, { dateUtc: "2026-11-05T10:30:00Z" });
    const z = zernio([...deja, jumeau(b)]);
    const r = await promouvoirBrouillons({ client: z.client, postsBuffer: [b], aBlanc: false, maintenant: z.horloge.maintenant });
    expect(r.violations.length).toBeGreaterThan(0);
    expect(r.lignes[0].etat).toBe("arret");
    expect(puts(z)).toBe(0);
  });

  it("un excès sans rapport avec le lot ne le bloque pas", async () => {
    const deja = Array.from({ length: 22 }, (_, i) => jumeau(buf(100 + i), { status: "scheduled", scheduledFor: `2026-11-05T10:${String(i).padStart(2, "0")}:00Z`, metadata: { origine: "studio" } }));
    const b = buf(1, { dateUtc: "2026-11-09T10:00:00Z" });
    const z = zernio([...deja, jumeau(b)]);
    const r = await promouvoirBrouillons({ client: z.client, postsBuffer: [b], aBlanc: true, maintenant: z.horloge.maintenant });
    expect(r.violations).toHaveLength(0);
    expect(r.lignes[0].etat).toBe("a-blanc");
  });

  it("plafond de promotions par lot : au-delà, rien n'est promu", async () => {
    const posts = [buf(1, { dateUtc: "2026-11-05T10:00:00Z" }), buf(2, { dateUtc: "2026-11-06T10:00:00Z" }), buf(3, { dateUtc: "2026-11-07T10:00:00Z" })];
    const z = zernio(posts.map((p) => jumeau(p)));
    const r = await promouvoirBrouillons({ client: z.client, postsBuffer: posts, aBlanc: false, maintenant: z.horloge.maintenant, plafondLot: 2 });
    expect(r.refusLot).toMatch(/plafond du lot 2/);
    expect(r.lignes.every((l) => l.etat === "arret")).toBe(true);
    expect(puts(z)).toBe(0);
  });
});

describe("IMP-3 relecture · outil et dépôt public", () => {
  const lire = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

  it("jumeaux.mts : --liste exigé (pas de fichier par défaut à la racine), --confirmer-retrait sort en code ≠ 0", () => {
    const s = lire("outils/import-buffer/jumeaux.mts");
    expect(s).not.toContain("retraits-buffer-a-la-main.csv");
    expect(s).toMatch(/if \(!sortie\) throw/);
    expect(s).toMatch(/--confirmer-retrait[\s\S]{0,400}process\.exitCode = 3/);
  });

  it(".gitignore couvre listes de retrait, journaux et clés de l'import", () => {
    const g = lire(".gitignore").split("\n");
    for (const m of ["retraits-buffer-*.csv", "*.jsonl", "cles-imp*.json"]) expect(g).toContain(m);
  });

  it("brouillons.mts : journal des clés écrit au fil de l'eau, atomique (temporaire puis rename)", () => {
    const s = lire("outils/import-buffer/brouillons.mts");
    expect(s).toContain("apresChaque");
    expect(s).toMatch(/renameSync\(tmp, fichierCles\)/);
  });

  it("aucun prénom en clair dans le code neuf du retrait", () => {
    expect(lire("src/services/import-buffer/retrait-jumeau.ts")).not.toMatch(new RegExp(["Wi", "ll"].join("")));
  });
});
