/**
 * Empreintes des fichiers d'entrée (anti-doublon de sujets, PR A). Dépôts en mémoire, stockage doublé : aucun réseau.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Fichier } from "@/domaine/types";
import type { StockageFichiers } from "@/fournisseurs/types";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const emp = await import("@/services/empreintes-fichiers");

const CLE_IV = "studio/dev/entree/image-video/f-a.jpg";
const CLE_FC = "studio/prod/entree/facecam-animee/f-b.mp4";

function fichier(id: string, cle: string, patch: Partial<Fichier> = {}): Fichier {
  const t = new Date().toISOString();
  return { id, cleStockage: cle, nom: `${id}.bin`, mime: "image/jpeg", taille: 10, origine: "depot", statut: "pret", creeLe: t, modifieLe: t, ...patch } as Fichier;
}

/** Faux stockage : compte ses lectures ; `attente` permet de tenir une lecture ouverte. */
function fauxStockage(opts: { attente?: Promise<void>; erreurs?: Record<string, unknown> } = {}) {
  const lectures: string[] = [];
  const stockage = {
    id: "faux",
    type: "stockage",
    nom: "faux",
    reelPrevu: "faux",
    mode: "reel",
    capacites: { asynchrone: false, accordExige: false },
    async empreinteSha256(cle: string, taille: number) {
      lectures.push(cle);
      if (opts.attente) await opts.attente;
      if (opts.erreurs?.[cle]) throw opts.erreurs[cle];
      return { sha256: `h-${cle}`, taille };
    },
  } as unknown as StockageFichiers;
  return { stockage, lectures };
}

beforeEach(() => {
  reinitialiserDepots();
  emp.oublierRattrapageEmpreintes();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("estEntreeControlee", () => {
  it("vrai seulement pour les dossiers image-video et facecam-animee de l'entrée", () => {
    expect(emp.estEntreeControlee(CLE_IV)).toBe(true);
    expect(emp.estEntreeControlee(CLE_FC)).toBe(true);
    for (const c of ["studio/dev/entree/autre/f.jpg", "studio/test/entree/image-video/f.jpg", "studio/dev/rush/image-video/f.jpg", "/demo/x.mp4", "x/studio/dev/entree/image-video/f.jpg"]) expect(emp.estEntreeControlee(c), c).toBe(false);
  });
});

describe("assurerEmpreinte", () => {
  it("calcule, enregistre sur la fiche et rend le fichier modifié", async () => {
    const f = await depots().fichiers.enregistrer(fichier("f-a", CLE_IV));
    const { stockage, lectures } = fauxStockage();
    const r = await emp.assurerEmpreinte(f, { stockage });
    expect(r.sha256).toBe(`h-${CLE_IV}`);
    expect((await depots().fichiers.obtenir("f-a"))?.sha256).toBe(`h-${CLE_IV}`);
    expect(lectures).toHaveLength(1);
  });

  it("deux appels simultanés : une seule lecture, même résultat ; l'entrée est retirée ensuite", async () => {
    const f = await depots().fichiers.enregistrer(fichier("f-a", CLE_IV));
    let ouvrir!: () => void;
    const { stockage, lectures } = fauxStockage({ attente: new Promise<void>((r) => (ouvrir = r)) });
    const a = emp.assurerEmpreinte(f, { stockage });
    const b = emp.assurerEmpreinte(f, { stockage });
    await new Promise((r) => setTimeout(r, 5));
    ouvrir();
    const [ra, rb] = await Promise.all([a, b]);
    expect(lectures).toHaveLength(1);
    expect(ra.sha256).toBe(rb.sha256);
    // Une fiche relue sans empreinte peut être recalculée : l'entrée n'est pas restée dans la table.
    await depots().fichiers.modifier("f-a", { sha256: undefined });
    await emp.assurerEmpreinte(f, { stockage });
    expect(lectures).toHaveLength(2);
  });

  it("après un échec, l'entrée est retirée : un nouvel essai relit", async () => {
    const f = await depots().fichiers.enregistrer(fichier("f-a", CLE_IV));
    const { stockage, lectures } = fauxStockage({ erreurs: { [CLE_IV]: new Error("coupure") } });
    await expect(emp.assurerEmpreinte(f, { stockage })).rejects.toThrow("coupure");
    await expect(emp.assurerEmpreinte(f, { stockage })).rejects.toThrow("coupure");
    expect(lectures).toHaveLength(2);
  });

  it("empreinte déjà présente : aucune lecture, fichier rendu tel quel", async () => {
    const f = await depots().fichiers.enregistrer(fichier("f-a", CLE_IV, { sha256: "deja" }));
    const { stockage, lectures } = fauxStockage();
    expect(await emp.assurerEmpreinte(f, { stockage })).toBe(f);
    expect(lectures).toHaveLength(0);
  });

  it("simulation (pas d'empreinteSha256) : fichier inchangé", async () => {
    const f = await depots().fichiers.enregistrer(fichier("f-a", CLE_IV));
    const stockage = { id: "simulation", mode: "simulation" } as unknown as StockageFichiers;
    expect(await emp.assurerEmpreinte(f, { stockage })).toBe(f);
    expect((await depots().fichiers.obtenir("f-a"))?.sha256).toBeUndefined();
  });
});

describe("rattraperEmpreintesEntrees", () => {
  it("ne traite que les cibles, ignore un 404 (consigné), ne refait rien au 2e appel", async () => {
    const d = depots().fichiers;
    const GONE = "studio/dev/entree/image-video/f-gone.jpg";
    await d.enregistrer(fichier("f-a", CLE_IV));
    await d.enregistrer(fichier("f-b", CLE_FC));
    await d.enregistrer(fichier("f-gone", GONE));
    await d.enregistrer(fichier("f-deja", "studio/dev/entree/image-video/f-deja.jpg", { sha256: "x" }));
    await d.enregistrer(fichier("f-autre", "studio/dev/rush/s1/f-autre.mp4"));
    await d.enregistrer(fichier("f-attente", "studio/dev/entree/image-video/f-attente.jpg", { statut: "en_attente" }));
    await d.enregistrer(fichier("f-demo", "studio/dev/entree/image-video/f-demo.jpg", { origine: "demo" as Fichier["origine"] }));
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { stockage, lectures } = fauxStockage({ erreurs: { [GONE]: Object.assign(new Error("R2 GET 404"), { statut: 404 }) } });
    await emp.rattraperEmpreintesEntrees({ stockage });
    expect([...lectures].sort()).toEqual([CLE_IV, CLE_FC, GONE].sort());
    expect((await d.obtenir("f-a"))?.sha256).toBe(`h-${CLE_IV}`);
    expect((await d.obtenir("f-gone"))?.sha256).toBeUndefined();
    expect(journal).toHaveBeenCalled();
    journal.mockRestore();
    await emp.rattraperEmpreintesEntrees({ stockage });
    expect(lectures).toHaveLength(3);
  });

  it("une autre erreur est relancée et le rattrapage n'est pas retenu comme fait", async () => {
    await depots().fichiers.enregistrer(fichier("f-a", CLE_IV));
    const { stockage, lectures } = fauxStockage({ erreurs: { [CLE_IV]: Object.assign(new Error("R2 GET 500"), { statut: 500 }) } });
    await expect(emp.rattraperEmpreintesEntrees({ stockage })).rejects.toThrow("500");
    await expect(emp.rattraperEmpreintesEntrees({ stockage })).rejects.toThrow("500");
    expect(lectures).toHaveLength(2);
  });
});

describe("rattrapage : échecs, bornes, simultanéité", () => {
  const cle = (n: number) => `studio/dev/entree/image-video/f-${n}.jpg`;
  const erreur = (statut: number) => Object.assign(new Error(`R2 GET ${statut}`), { statut });

  it("une erreur inconnue (panne de base) est réessayable : relancée, jamais classée définitive", async () => {
    await depots().fichiers.enregistrer(fichier("f-1", cle(1)));
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { stockage, lectures } = fauxStockage({ erreurs: { [cle(1)]: new Error("connexion Postgres perdue") } });
    await expect(emp.rattraperEmpreintesEntrees({ stockage })).rejects.toThrow("Postgres");
    await expect(emp.rattraperEmpreintesEntrees({ stockage })).rejects.toThrow("Postgres");
    expect(lectures).toHaveLength(2);
    journal.mockRestore();
  });

  it("un écart de taille (marqueur définitif) n'est pas relu ; un 429 et un 408 restent réessayables", async () => {
    const d = depots().fichiers;
    for (const n of [1, 2, 3]) await d.enregistrer(fichier(`f-${n}`, cle(n)));
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { stockage, lectures } = fauxStockage({ erreurs: { [cle(1)]: Object.assign(new Error("taille"), { definitif: true }), [cle(2)]: erreur(429), [cle(3)]: erreur(408) } });
    await expect(emp.rattraperEmpreintesEntrees({ stockage })).rejects.toThrow("429");
    await expect(emp.rattraperEmpreintesEntrees({ stockage })).rejects.toThrow("429");
    expect(lectures.filter((c) => c === cle(1))).toHaveLength(1);
    expect(lectures.filter((c) => c === cle(2))).toHaveLength(2);
    expect(lectures.filter((c) => c === cle(3))).toHaveLength(2);
    journal.mockRestore();
  });

  it("signalerEmpreinteManquante remet le rattrapage « à refaire »", async () => {
    await depots().fichiers.enregistrer(fichier("f-1", cle(1)));
    const { stockage, lectures } = fauxStockage();
    await emp.rattraperEmpreintesEntrees({ stockage });
    await emp.rattraperEmpreintesEntrees({ stockage });
    expect(lectures).toHaveLength(1);
    await depots().fichiers.enregistrer(fichier("f-2", cle(2)));
    emp.signalerEmpreinteManquante();
    await emp.rattraperEmpreintesEntrees({ stockage });
    expect(lectures).toHaveLength(2);
  });

  it("un échec au milieu ne bloque pas les suivants ; l'échec définitif (403) est consigné, jamais relancé, et n'est pas relu ensuite", async () => {
    const d = depots().fichiers;
    for (const n of [1, 2, 3]) await d.enregistrer(fichier(`f-${n}`, cle(n)));
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { stockage, lectures } = fauxStockage({ erreurs: { [cle(2)]: erreur(403) } });
    await emp.rattraperEmpreintesEntrees({ stockage });
    expect((await d.obtenir("f-1"))?.sha256).toBeDefined();
    expect((await d.obtenir("f-3"))?.sha256).toBeDefined();
    expect(lectures).toHaveLength(3);
    journal.mockRestore();
  });

  it("un échec réessayable (503) au milieu : les suivants sont faits, l'erreur est relancée à la fin", async () => {
    const d = depots().fichiers;
    for (const n of [1, 2, 3]) await d.enregistrer(fichier(`f-${n}`, cle(n)));
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { stockage } = fauxStockage({ erreurs: { [cle(1)]: erreur(503) } });
    await expect(emp.rattraperEmpreintesEntrees({ stockage })).rejects.toThrow("503");
    expect((await d.obtenir("f-2"))?.sha256).toBeDefined();
    expect((await d.obtenir("f-3"))?.sha256).toBeDefined();
    journal.mockRestore();
  });

  it("un échec définitif (403) n'est pas relu au 2e appel, même quand un échec réessayable force un nouvel appel", async () => {
    const d = depots().fichiers;
    for (const n of [1, 2]) await d.enregistrer(fichier(`f-${n}`, cle(n)));
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { stockage, lectures } = fauxStockage({ erreurs: { [cle(1)]: erreur(403), [cle(2)]: erreur(503) } });
    await expect(emp.rattraperEmpreintesEntrees({ stockage })).rejects.toThrow("503");
    await expect(emp.rattraperEmpreintesEntrees({ stockage })).rejects.toThrow("503");
    expect(lectures.filter((c) => c === cle(1))).toHaveLength(1);
    expect(lectures.filter((c) => c === cle(2))).toHaveLength(2);
    journal.mockRestore();
  });

  it("deux rattrapages simultanés partagent le même travail ; au plus 50 fichiers par appel, le reste au suivant", async () => {
    const d = depots().fichiers;
    for (let n = 0; n < emp.RATTRAPAGE_MAX + 5; n++) await d.enregistrer(fichier(`f-${n}`, cle(n)));
    const { stockage, lectures } = fauxStockage();
    const a = emp.rattraperEmpreintesEntrees({ stockage });
    const b = emp.rattraperEmpreintesEntrees({ stockage });
    expect(a).toBe(b);
    await a;
    expect(lectures).toHaveLength(emp.RATTRAPAGE_MAX);
    await emp.rattraperEmpreintesEntrees({ stockage });
    expect(lectures).toHaveLength(emp.RATTRAPAGE_MAX + 5);
  });
});

describe("file de lectures et écriture finale", () => {
  it("3 calculs, le 1er échoue : les 2 autres aboutissent et le créneau est rendu (2 nouveaux calculs passent ensuite)", async () => {
    const d = depots().fichiers;
    const cle = (n: number) => `studio/dev/entree/image-video/f-${n}.jpg`;
    const fs: Fichier[] = [];
    for (let n = 1; n <= 5; n++) fs.push(await d.enregistrer(fichier(`f-${n}`, cle(n))));
    let actives = 0;
    let max = 0;
    const stockage = {
      id: "faux",
      mode: "reel",
      async empreinteSha256(c: string, taille: number) {
        actives++;
        max = Math.max(max, actives);
        await new Promise((r) => setTimeout(r, 10));
        actives--;
        if (c === cle(1)) throw new Error("coupure");
        return { sha256: `h-${c}`, taille };
      },
    } as unknown as StockageFichiers;
    const res = await Promise.allSettled(fs.slice(0, 3).map((f) => emp.assurerEmpreinte(f, { stockage })));
    expect(res.map((r) => r.status)).toEqual(["rejected", "fulfilled", "fulfilled"]);
    expect((await d.obtenir("f-2"))?.sha256).toBe(`h-${cle(2)}`);
    expect((await d.obtenir("f-3"))?.sha256).toBe(`h-${cle(3)}`);
    await Promise.all(fs.slice(3).map((f) => emp.assurerEmpreinte(f, { stockage })));
    expect((await d.obtenir("f-5"))?.sha256).toBe(`h-${cle(5)}`);
    expect(max).toBe(2);
  });

  it("un dépôt qui trouve SON fichier en attente en fond le promeut : il démarre tout de suite, sans attendre la lecture lente de fond", async () => {
    const d = depots().fichiers;
    const cle = (n: string) => `studio/dev/entree/image-video/${n}.jpg`;
    const lourd = await d.enregistrer(fichier("lourd", cle("lourd")));
    const petit = await d.enregistrer(fichier("petit", cle("petit")));
    let ouvrir!: () => void;
    const porte = new Promise<void>((r) => (ouvrir = r));
    const debuts: string[] = [];
    const stockage = {
      id: "faux",
      mode: "reel",
      async empreinteSha256(c: string, taille: number) {
        debuts.push(c);
        if (c === cle("lourd")) await porte; // la prise de 15 Go : tient la place de fond
        return { sha256: `h-${c}`, taille };
      },
    } as unknown as StockageFichiers;
    const pLourd = emp.assurerEmpreinte(lourd, { stockage, fond: true });
    const pPetitFond = emp.assurerEmpreinte(petit, { stockage, fond: true }); // en attente derrière le lourd (une seule place de fond)
    await new Promise((r) => setTimeout(r, 5));
    expect(debuts).toEqual([cle("lourd")]);
    const pPetitDepot = emp.assurerEmpreinte(petit, { stockage }); // le dépôt de la même image
    expect((await pPetitDepot).sha256).toBe(`h-${cle("petit")}`); // fini SANS que « lourd » soit terminé
    expect(debuts).toEqual([cle("lourd"), cle("petit")]);
    ouvrir();
    await Promise.all([pLourd, pPetitFond]);
  });

  it("fiche déjà munie d'une empreinte ou disparue depuis la liste du rattrapage : aucune lecture", async () => {
    const d = depots().fichiers;
    const a = await d.enregistrer(fichier("f-a", CLE_IV));
    const b = await d.enregistrer(fichier("f-b", "studio/dev/entree/image-video/f-b.jpg"));
    await d.modifier("f-a", { sha256: "deja-la" });
    await d.supprimer("f-b");
    const { stockage, lectures } = fauxStockage();
    expect((await emp.assurerEmpreinte(a, { stockage })).sha256).toBe("deja-la");
    expect(await emp.assurerEmpreinte(b, { stockage })).toBe(b);
    expect(lectures).toHaveLength(0);
  });

  it("le travail de fond n'affame pas un dépôt : une seule lecture de fond à la fois, et le dépôt passe avant les fonds en attente", async () => {
    const d = depots().fichiers;
    const debuts: string[] = [];
    let fondActifs = 0;
    let fondMax = 0;
    const stockage = {
      id: "faux",
      mode: "reel",
      async empreinteSha256(c: string, taille: number) {
        debuts.push(c);
        const fond = c.includes("fond");
        if (fond) fondMax = Math.max(fondMax, ++fondActifs);
        await new Promise((r) => setTimeout(r, 60));
        if (fond) fondActifs--;
        return { sha256: "h", taille };
      },
    } as unknown as StockageFichiers;
    const fonds: Fichier[] = [];
    for (let n = 0; n < 3; n++) fonds.push(await d.enregistrer(fichier(`fond-${n}`, `studio/dev/entree/image-video/fond-${n}.jpg`)));
    const depot = await d.enregistrer(fichier("depot-1", "studio/dev/entree/image-video/depot-1.jpg"));
    const pf = fonds.map((f) => emp.assurerEmpreinte(f, { stockage, fond: true }));
    await new Promise((r) => setTimeout(r, 10));
    const pd = emp.assurerEmpreinte(depot, { stockage });
    await Promise.all([...pf, pd]);
    expect(fondMax).toBe(1);
    // Le dépôt démarre tout de suite (place réservée) : avant le 2e fond, qui attend la fin du 1er.
    expect(debuts.indexOf("studio/dev/entree/image-video/depot-1.jpg")).toBeLessThan(debuts.indexOf("studio/dev/entree/image-video/fond-1.jpg"));
  });

  it("au plus 2 lectures R2 à la fois dans le processus", async () => {
    let actives = 0;
    let max = 0;
    const stockage = {
      id: "faux",
      mode: "reel",
      async empreinteSha256(_c: string, taille: number) {
        actives++;
        max = Math.max(max, actives);
        await new Promise((r) => setTimeout(r, 10));
        actives--;
        return { sha256: "h", taille };
      },
    } as unknown as StockageFichiers;
    const fs: Fichier[] = [];
    for (let n = 0; n < 6; n++) fs.push(await depots().fichiers.enregistrer(fichier(`f-${n}`, `studio/dev/entree/image-video/f-${n}.jpg`)));
    await Promise.all(fs.map((f) => emp.assurerEmpreinte(f, { stockage })));
    expect(max).toBe(2);
    for (const f of fs) expect((await depots().fichiers.obtenir(f.id))?.sha256).toBe("h");
  });

  it("n'écrit rien si la fiche a disparu, a déjà une empreinte, ou a changé de clé pendant la lecture", async () => {
    const d = depots().fichiers;
    const a = await d.enregistrer(fichier("f-a", CLE_IV));
    const b = await d.enregistrer(fichier("f-b", "studio/dev/entree/image-video/f-b.jpg"));
    const c = await d.enregistrer(fichier("f-c", "studio/dev/entree/image-video/f-c.jpg"));
    let ouvrir!: () => void;
    const { stockage } = fauxStockage({ attente: new Promise<void>((r) => (ouvrir = r)) });
    const ps = [emp.assurerEmpreinte(a, { stockage }), emp.assurerEmpreinte(b, { stockage }), emp.assurerEmpreinte(c, { stockage })];
    await new Promise((r) => setTimeout(r, 5));
    await d.supprimer("f-a");
    await d.modifier("f-b", { sha256: "autre" });
    await d.modifier("f-c", { cleStockage: "studio/dev/entree/image-video/f-c-bis.jpg" });
    ouvrir();
    await Promise.all(ps);
    expect(await d.obtenir("f-a")).toBeNull();
    expect((await d.obtenir("f-b"))?.sha256).toBe("autre");
    expect((await d.obtenir("f-c"))?.sha256).toBeUndefined();
  });
});

describe("terminerEnvoi n'attend pas le calcul", () => {
  it("rend le fichier « prêt » alors que la lecture du contenu n'est pas finie, puis l'empreinte arrive", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "compte-essai");
    vi.stubEnv("R2_ACCESS_KEY_ID", "ACCES-ESSAI");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret-essai");
    vi.stubEnv("R2_BUCKET", "seau-essai");
    vi.stubEnv("FOURNISSEUR_STOCKAGE", "r2");
    const octets = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    let finir!: () => void;
    const fin = new Promise<void>((r) => (finir = r));
    vi.stubGlobal("fetch", (async (_u: string, init?: RequestInit) => {
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-length": "10" } });
      return new Response(
        new ReadableStream<Uint8Array>({
          async start(c) {
            c.enqueue(octets.subarray(0, 4));
            await fin;
            c.enqueue(octets.subarray(4));
            c.close();
          },
        }),
      );
    }) as unknown as typeof fetch);
    // Les fournisseurs sont inscrits à l'import selon l'environnement : on réimporte les modules avec R2 configuré.
    vi.resetModules();
    const envois = await import("@/services/envois");
    const r = await envois.terminerEnvoi({ nom: "a.jpg", mime: "image/jpeg", taille: 10, typeEntite: "entree", entiteId: "image-video", fichierId: "f-envoi", cle: "studio/dev/entree/image-video/f-envoi.jpg" });
    expect(r.statut).toBe("pret");
    expect((await depots().fichiers.obtenir("f-envoi"))?.sha256).toBeUndefined();
    finir();
    const attendu = createHash("sha256").update(octets).digest("hex");
    await vi.waitFor(async () => expect((await depots().fichiers.obtenir("f-envoi"))?.sha256).toBe(attendu));
  });
});
