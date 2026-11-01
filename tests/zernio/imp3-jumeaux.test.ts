import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { promouvoirBrouillons } from "../../src/services/import-buffer/promotion";
import { formaterDelta, rapprocher } from "../../src/services/import-buffer/rapprochement";
import { ecartsJumeau, listeCsv, retirerJumeaux } from "../../src/services/import-buffer/retrait-jumeau";
import type { PostBuffer } from "../../src/services/import-buffer/types";
import type { PostZernio } from "../../src/fournisseurs/publication/zernio-client";
import { creerFauxClientZernio, postExemple, type AppelEnregistre, type ReponsePreparee } from "./aides/faux-zernio";

const MAINT = Date.parse("2026-11-01T08:00:00Z");
const buf = (n: number, p: Partial<PostBuffer> = {}): PostBuffer => ({ id: `post-exemple-${n}`, canalId: "canal-ig", texte: `Texte ${n}`, dateUtc: `2026-11-0${2 + (n % 5)}T1${n % 10}:00:00Z`, statut: "scheduled", medias: [], ...p });
const jumeau = (b: PostBuffer, p: Partial<PostZernio> = {}): PostZernio =>
  postExemple({ _id: `exemple-z-${b.id}`, content: b.texte, status: "draft", scheduledFor: b.dateUtc, platforms: [{ platform: "instagram", accountId: `exemple-compte-${1 + (Number(b.id.slice(-1)) % 3)}` }], metadata: { origine: "import-buffer", bufferId: b.id, studioCle: `imp-${b.id}` }, ...p });

/** Faux Zernio à état : liste (par page), lecture, PUT de promotion. Enregistre tout, refuse DELETE. */
function zernio(posts: PostZernio[], options: { putSansEffet?: boolean } = {}) {
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
      if (!options.putSansEffet && j.isDraft === false) Object.assign(base.get(m[1])!, { status: "scheduled", scheduledFor: j.scheduledFor });
      return { statut: 200, corps: { post: base.get(m[1]) } };
    }
    return { statut: 404, corps: {} };
  });
  return { ...t, base };
}

describe("IMP-3 · retrait du jumeau (règle absolue : jamais de suppression)", () => {
  it("par défaut : AUCUNE action Buffer, seulement la liste à retirer à la main", async () => {
    const posts = [buf(2), buf(1)];
    const z = zernio(posts.map((p) => jumeau(p)));
    let appels = 0;
    const r = await retirerJumeaux({ client: z.client, posts, passerEnBrouillon: async () => { appels++; return { ok: true }; } });
    expect(appels).toBe(0);
    expect(r.liste).toHaveLength(2);
    expect(r.lignes.every((l) => l.etat === "a-retirer-a-la-main")).toBe(true);
    expect(listeCsv(r.liste).split("\n")).toHaveLength(3);
    expect(z.faux.appels.every((a) => a.methode === "GET")).toBe(true);
  });

  it("sans jumeau, jumeau différent ou illisible : le post Buffer n'est pas touché", async () => {
    const posts = [buf(1), buf(2), buf(3)];
    const z = zernio([jumeau(posts[1], { content: "Autre texte" })]);
    let appels = 0;
    const r = await retirerJumeaux({ client: z.client, posts, confirmerRetrait: true, passerEnBrouillon: async () => { appels++; return { ok: true }; } });
    expect(r.lignes.map((l) => l.etat).sort()).toEqual(["jumeau-different", "sans-jumeau", "sans-jumeau"]);
    expect(appels).toBe(0);
  });

  it("avec --confirmer-retrait : un seul à la fois, dans l'ordre des dates, journalisé, arrêt au premier échec", async () => {
    const posts = [buf(3, { dateUtc: "2026-11-04T10:00:00Z" }), buf(1, { dateUtc: "2026-11-02T10:00:00Z" }), buf(2, { dateUtc: "2026-11-03T10:00:00Z" })];
    const z = zernio(posts.map((p) => jumeau(p)));
    const ordre: string[] = [];
    let enCours = 0;
    let maxEnCours = 0;
    const journal: string[] = [];
    const r = await retirerJumeaux({
      client: z.client, posts, confirmerRetrait: true,
      passerEnBrouillon: async (id) => {
        enCours++;
        maxEnCours = Math.max(maxEnCours, enCours);
        await Promise.resolve();
        ordre.push(id);
        enCours--;
        return id === "post-exemple-2" ? { ok: false, raison: "refusé" } : { ok: true };
      },
      journaliser: (l) => void journal.push(`${l.bufferId}:${l.etat}`),
    });
    expect(maxEnCours).toBe(1);
    expect(ordre).toEqual(["post-exemple-1", "post-exemple-2"]);
    expect(r.lignes.map((l) => l.etat)).toEqual(["retire", "echec", "arret"]);
    expect(journal).toHaveLength(3);
    // Reprise : le déjà retiré est sauté.
    const r2 = await retirerJumeaux({ client: z.client, posts, confirmerRetrait: true, dejaRetires: new Set(["post-exemple-1"]), passerEnBrouillon: async () => ({ ok: true }) });
    expect(r2.lignes.map((l) => l.etat)).toEqual(["deja-retire", "retire", "retire"]);
  });

  it("rien n'est supprimé : aucun DELETE chez Zernio, aucune mutation ni suppression dans les modules et l'outil", () => {
    for (const f of ["src/services/import-buffer/retrait-jumeau.ts", "src/services/import-buffer/promotion.ts", "src/services/import-buffer/rapprochement.ts", "outils/import-buffer/jumeaux.mts"]) {
      const s = readFileSync(new URL(`../../${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(s).not.toMatch(/\bfetch\(|DELETE|publishNow|deletePost|mutation/i);
    }
  });
});

describe("IMP-3 · promotion D5", () => {
  const retire = (n: number) => buf(n, { statut: "draft", dateUtc: `2026-11-0${2 + n}T10:00:00Z` });

  it("à blanc par défaut : aucune écriture", async () => {
    const posts = [retire(1), retire(2)];
    const z = zernio(posts.map((p) => jumeau(p)));
    const r = await promouvoirBrouillons({ client: z.client, postsBuffer: posts, maintenant: z.horloge.maintenant });
    expect(r.lignes.map((l) => l.etat)).toEqual(["a-blanc", "a-blanc"]);
    expect(z.faux.appels.every((a) => a.methode === "GET")).toBe(true);
  });

  it("ORDRE : un brouillon dont le jumeau Buffer est encore programmé n'est pas promu", async () => {
    const posts = [retire(1), buf(2, { dateUtc: "2026-11-04T10:00:00Z" })];
    const z = zernio(posts.map((p) => jumeau(p)));
    const r = await promouvoirBrouillons({ client: z.client, postsBuffer: posts, aBlanc: false, maintenant: z.horloge.maintenant });
    expect(Object.fromEntries(r.lignes.map((l) => [l.bufferId, l.etat]))).toEqual({ "post-exemple-1": "programme", "post-exemple-2": "buffer-actif" });
    expect(z.faux.appels.filter((a) => a.methode === "PUT")).toHaveLength(1);
  });

  it("promotion réelle : PUT { isDraft:false, scheduledFor } entouré d'un GET avant et d'un GET après, un à la fois, dans l'ordre des dates", async () => {
    const posts = [retire(2), retire(1)];
    const z = zernio(posts.map((p) => jumeau(p)));
    const journal: string[] = [];
    const r = await promouvoirBrouillons({ client: z.client, postsBuffer: posts, aBlanc: false, maintenant: z.horloge.maintenant, attendre: z.horloge.attendre, journaliser: (l) => void journal.push(`${l.bufferId}:${l.etat}`) });
    expect(r.lignes.map((l) => l.etat)).toEqual(["programme", "programme"]);
    expect(journal).toEqual(["post-exemple-1:programme", "post-exemple-2:programme"]);
    const seq = z.faux.appels.filter((a) => /\/v1\/posts\/exemple-z-/.test(a.url)).map((a) => `${a.methode}:${a.url.split("/").pop()}`);
    expect(seq).toEqual(["GET:exemple-z-post-exemple-1", "PUT:exemple-z-post-exemple-1", "GET:exemple-z-post-exemple-1", "GET:exemple-z-post-exemple-2", "PUT:exemple-z-post-exemple-2", "GET:exemple-z-post-exemple-2"]);
    const put = z.faux.appels.find((a) => a.methode === "PUT")!;
    expect(put.json).toEqual({ isDraft: false, scheduledFor: "2026-11-03T10:00:00Z" });
    expect(z.faux.appels.some((a) => a.methode === "DELETE" || /publishNow/.test(a.corps ?? ""))).toBe(false);
  });

  it("date à moins de 30 min, jumeau différent, déjà fait : aucun PUT", async () => {
    const proche = retire(1);
    proche.dateUtc = new Date(MAINT + 10 * 60_000).toISOString();
    const diff = retire(2);
    const fait = retire(3);
    const z = zernio([jumeau(proche), jumeau(diff, { content: "Autre" }), jumeau(fait)]);
    const r = await promouvoirBrouillons({ client: z.client, postsBuffer: [proche, diff, fait], aBlanc: false, maintenant: z.horloge.maintenant, dejaPromus: new Set([`exemple-z-${fait.id}`]) });
    expect(Object.fromEntries(r.lignes.map((l) => [l.bufferId, l.etat]))).toEqual({ "post-exemple-1": "a-reprogrammer", "post-exemple-2": "jumeau-different", "post-exemple-3": "deja-fait" });
    expect(z.faux.appels.filter((a) => a.methode === "PUT")).toHaveLength(0);
  });

  it("GET après non conforme : « à vérifier », le lot s'arrête, aucun nouvel essai", async () => {
    const posts = [retire(1), retire(2)];
    const z = zernio(posts.map((p) => jumeau(p)), { putSansEffet: true });
    const r = await promouvoirBrouillons({ client: z.client, postsBuffer: posts, aBlanc: false, maintenant: z.horloge.maintenant });
    expect(r.lignes.map((l) => l.etat)).toEqual(["a-verifier", "arret"]);
    expect(z.faux.appels.filter((a) => a.methode === "PUT")).toHaveLength(1);
  });

  it("grille hors plafond (plus de 20 dans la même heure sur un compte) : rien n'est promu", async () => {
    const posts = Array.from({ length: 21 }, (_, i) => buf(i + 1, { statut: "draft", dateUtc: `2026-11-05T10:${String(i).padStart(2, "0")}:00Z` }));
    const z = zernio(posts.map((p) => jumeau(p, { platforms: [{ platform: "instagram", accountId: "exemple-compte-1" }] })));
    const r = await promouvoirBrouillons({ client: z.client, postsBuffer: posts, aBlanc: false, maintenant: z.horloge.maintenant });
    expect(r.violations.length).toBeGreaterThan(0);
    expect(z.faux.appels.filter((a) => a.methode === "PUT")).toHaveLength(0);
  });
});

describe("IMP-3 · rapprochement", () => {
  const posts = Array.from({ length: 4 }, (_, i) => buf(i + 1, { statut: "draft" }));
  const prog = (b: PostBuffer) => jumeau(b, { status: "scheduled" });

  it("zéro écart quand tout concorde", () => {
    const d = rapprocher(posts, posts.map(prog), 4);
    expect(d.zeroEcart).toBe(true);
    expect(formaterDelta(d)).toMatch(/^ZÉRO ÉCART/);
  });

  it("delta lisible : manquant, en trop, divergent, double, double publication, mauvais total", () => {
    const d = rapprocher([...posts.slice(0, 3), buf(3, { statut: "scheduled" })].map((p, i) => (i === 3 ? { ...p, id: "post-exemple-9" } : p)), [prog(posts[0]), { ...prog(posts[1]), content: "Autre" }, prog(posts[0]), prog(buf(7))], 92);
    expect(d.manquants).toEqual(["post-exemple-3", "post-exemple-9"]);
    expect(d.enTrop).toEqual(["post-exemple-7"]);
    expect(d.divergents).toEqual([{ bufferId: "post-exemple-2", champs: ["texte"] }]);
    expect(d.doubles).toEqual(["post-exemple-1"]);
    expect(d.zeroEcart).toBe(false);
    const t = formaterDelta(d);
    expect(t).toMatch(/MANQUANT chez Zernio : post-exemple-3/);
    expect(t).toMatch(/EN TROP/);
    expect(t).toMatch(/au lieu de 92 attendus/);
  });

  it("jumeau Buffer encore programmé alors que Zernio l'est aussi : double publication signalée", () => {
    const b = buf(1, { statut: "scheduled" });
    const d = rapprocher([b], [prog(b)], 1);
    expect(d.doublePublication).toEqual(["post-exemple-1"]);
    expect(d.zeroEcart).toBe(false);
  });

  it("ecartsJumeau : nombre de médias et date", () => {
    const b = buf(1, { medias: [{ type: "image", mime: "image/png", source: "" }] });
    expect(ecartsJumeau(b, jumeau(b, { scheduledFor: "2026-12-01T00:00:00Z" })).sort()).toEqual(["date", "nombre de médias"]);
  });
});
