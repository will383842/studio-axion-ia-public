/**
 * Idées de l'usine (Écrire > Idées) : client de la porte simulé (succès, 401, délai, porte éteinte), sujet pré-rempli,
 * aucun secret côté navigateur. Aucun réseau : `fetch` est une doublure injectée.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const porte = await import("@/services/usine-porte");
const { ecrireSujetDeLUsine } = await import("@/services/usine-sujet");
const { lireIdeesUsine } = await import("@/domaine/usine");
import type { IdeeUsine } from "@/domaine/usine";

const SECRET = "secret-porte-xyz-0123456789-abcdefghij";
const ENV = { USINE_URL: "https://usine.test/", USINE_PORTE_SECRET: SECRET };
/** Corps copiés de docs/CONTRAT-PORTE.md (usine-axion-ia). */
const PARTS = { metier: "compta.expert-comptable", taille: "PME", service: "audit", douleur: "compta.expert-comptable.d2", cas_usage: "compta.expert-comptable.audit.c01", actualite: null, format: "tableau-anime", structure: "scène vécue" };
const LIGNE = {
  rang: 1,
  signature: "compta.expert-comptable|pme|audit|compta.expert-comptable.d2|compta.expert-comptable.audit.c01|tableau-anime|scène vécue",
  parts: PARTS,
  type_contenu: "video",
  reseaux: ["instagram", "facebook"],
  metier: { code: "compta.expert-comptable", libelle: "Expert-comptable", secteur: "Finance" },
  taille: { code: "PME", libelle: "PME" },
  service: { code: "audit", libelle: "Audit" },
  douleur: { code: "compta.expert-comptable.d2", dite: "Les clients envoient leurs pièces en retard.", scene_avant: "…" },
  cas_usage: { code: "compta.expert-comptable.audit.c01", titre: "Relances automatiques", probleme: "…", ce_que_ca_change: "Les pièces arrivent à temps." },
  sujet: { code: "a.audit", titre: "L'audit sans stress" },
  actualite: null,
  format: { code: "tableau-anime", libelle: "Tableau animé" },
  accroche: { code: "accroche.x", famille: "scène vécue", modele: "…", exemple: "…" },
  fins: { instagram: { appel: "fin-if-question", type: "question", objectif: "QUESTION", dit: "Et vous, comment faites-vous ?", ecran: "…", mot: null } },
};
const NOUVEAUTE = {
  ...LIGNE,
  signature: "nouveaute-1",
  parts: { metier: null, taille: null, service: null, douleur: null, cas_usage: null, actualite: "act.1", format: "tableau-anime", structure: "Actualités" },
  metier: null, taille: null, service: null, douleur: null, cas_usage: null, sujet: null,
  actualite: { code: "act.1", titre: "Nouvelle loi de finances", ce_qui_change: "Le seuil change.", source: "…" },
  accroche: { code: "accroche.y", famille: "Actualités", modele: "…", exemple: "…" },
  fins: {},
};
const METIERS = { metiers: [{ code: "compta.expert-comptable", libelle: "Expert-comptable", secteur: { code: "finance", libelle: "Finance" }, allume: false, cas_sources: 12 }] };
const reponse = (statut: number, corps: unknown) => new Response(JSON.stringify(corps), { status: statut, headers: { "content-type": "application/json" } });
const FILTRES = { type: "video" as const, reseaux: ["tiktok"], metiers: [], tailles: ["TPE"] };

describe("client de la porte", () => {
  const F = (f: unknown) => f as unknown as typeof fetch;
  const erreurDe = (statut: number, corps: unknown) => porte.proposerIdeesUsine(FILTRES, { env: ENV, fetchImpl: F(vi.fn(async () => reponse(statut, corps))) }).catch((x: Error) => x) as Promise<Error>;

  it("succès : bon appel, secret en en-tête, ligne du contrat lue", async () => {
    const f = vi.fn(async () => reponse(200, { demandees: 5, pourquoi: [], lignes: [LIGNE] }));
    const r = await porte.proposerIdeesUsine(FILTRES, { env: ENV, fetchImpl: F(f) });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://usine.test/api/porte/sujets");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${SECRET}`);
    expect(JSON.parse(init.body as string)).toEqual({ n: 5, type_contenu: "video", reseaux: ["tiktok"], tailles: ["TPE"] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      signature: LIGNE.signature, metier: "Expert-comptable", taille: "PME", service: "Audit",
      douleur: "Les clients envoient leurs pièces en retard.", casUsage: "Relances automatiques · Les pièces arrivent à temps.",
      sujet: "L'audit sans stress", format: "Tableau animé", famille: "scène vécue", fin: "Et vous, comment faites-vous ?",
    });
  });

  it("nouveauté : douleur et cas à null, le texte vient de l'actualité", () => {
    const [i] = lireIdeesUsine({ demandees: 1, pourquoi: [], lignes: [NOUVEAUTE] });
    expect(i).toMatchObject({ douleur: "Nouvelle loi de finances", casUsage: "Le seuil change.", metier: "", famille: "Actualités" });
  });

  it("cas d'usage sans douleur reliée (Usine #23) : montré, texte de tête = titre du cas, sinon le sujet", () => {
    const sansDouleur = { ...LIGNE, signature: "sans-douleur", parts: { ...PARTS, douleur: null }, douleur: null };
    const [i] = lireIdeesUsine({ lignes: [sansDouleur] });
    expect(i).toMatchObject({ signature: "sans-douleur", douleur: "Relances automatiques", casUsage: "Les pièces arrivent à temps.", sujet: "L'audit sans stress" });
    expect(i.parts).toEqual({ ...PARTS, douleur: null });
    expect(i.parts.douleur).toBeNull();
    const sansTitre = { ...sansDouleur, cas_usage: { code: "c", titre: null, ce_que_ca_change: "Les pièces arrivent à temps." } };
    expect(lireIdeesUsine({ lignes: [sansTitre] })[0]).toMatchObject({ douleur: "L'audit sans stress", casUsage: "Les pièces arrivent à temps." });
    // Ni douleur, ni cas d'usage, ni nouveauté : jetée.
    expect(lireIdeesUsine({ lignes: [{ ...LIGNE, douleur: null, cas_usage: null, actualite: null }] })).toEqual([]);
  });

  it("parts gardées telles quelles (null compris), de la lecture jusqu'à `retenir`", async () => {
    const [i] = lireIdeesUsine({ lignes: [LIGNE, NOUVEAUTE] });
    expect(i.parts).toEqual(PARTS);
    expect(i.parts.actualite).toBeNull();
    expect(lireIdeesUsine({ lignes: [NOUVEAUTE] })[0].parts).toEqual(NOUVEAUTE.parts);
    const f = vi.fn(async () => reponse(200, { signature: i.signature, deja: false }));
    const ok = await porte.retenirSujetUsine({ signature: i.signature, parts: i.parts, typeContenu: "video" }, "suj-abc123def456", { env: ENV, fetchImpl: F(f) });
    expect(ok).toBe(true);
    const corps = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(corps).toEqual({ signature: LIGNE.signature, parts: PARTS, type_contenu: "video", reference_studio: "suj-abc123def456" });
    expect(JSON.stringify(corps)).not.toContain('"null"');
  });

  it("401 : erreur claire en français, sans le secret", async () => {
    const e = await erreurDe(401, {});
    expect(e.message).toMatch(/refuse la clé/);
    expect(e.message).not.toContain(SECRET);
  });

  it("erreurs du contrat {erreur, code} : 409, 400, 404, 413, 415", async () => {
    expect((await erreurDe(409, { erreur: "Aucun métier allumé : choisissez un métier.", code: "aucun_metier_allume" })).message).toBe("Aucun métier allumé : choisissez un métier.");
    expect((await erreurDe(400, { erreur: "Métier inconnu ou retiré.", code: "metier_inconnu" })).message).toBe("Métier inconnu ou retiré.");
    expect((await erreurDe(404, { erreur: "Introuvable", code: "porte_eteinte" })).message).toMatch(/éteinte côté usine/);
    expect((await erreurDe(413, { erreur: "x", code: "trop_gros" })).message).toMatch(/trop volumineuse/);
    expect((await erreurDe(415, { erreur: "x", code: "format" })).message).toMatch(/format/);
    expect((await erreurDe(500, "pas du json")).message).toMatch(/répondu par une erreur/);
  });

  it("délai dépassé : erreur claire", async () => {
    const f = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_, rejeter) => init.signal!.addEventListener("abort", () => rejeter(Object.assign(new Error("a"), { name: "AbortError" })))));
    const e = await porte.proposerIdeesUsine(FILTRES, { env: ENV, fetchImpl: F(f), delaiMs: 20 }).catch((x: Error) => x);
    expect((e as Error).message).toMatch(/ne répond pas/);
  });

  it("porte éteinte : inactive (clé absente ou de moins de 32 caractères) et aucun appel", async () => {
    expect(porte.usineActive({})).toBe(false);
    expect(porte.usineActive({ USINE_URL: "https://x" })).toBe(false);
    expect(porte.usineActive({ USINE_PORTE_SECRET: SECRET })).toBe(false);
    expect(porte.usineActive({ USINE_URL: "https://x", USINE_PORTE_SECRET: "a".repeat(31) })).toBe(false);
    expect(porte.usineActive({ USINE_URL: "https://x", USINE_PORTE_SECRET: "a".repeat(32) })).toBe(true);
    expect(porte.usineActive(ENV)).toBe(true);
    const f = vi.fn();
    await expect(porte.proposerIdeesUsine(FILTRES, { env: {}, fetchImpl: F(f) })).rejects.toThrow(/pas reliée/);
    expect(f).not.toHaveBeenCalled();
  });

  it("métiers : corps du contrat, secteur objet, cas_sources, métiers non allumés gardés", async () => {
    const f = vi.fn(async () => reponse(200, METIERS));
    expect(await porte.listerMetiersUsine({ env: ENV, fetchImpl: F(f) })).toEqual([{ code: "compta.expert-comptable", libelle: "Expert-comptable", secteur: "Finance", allume: false, nbCas: 12 }]);
    expect(lireIdeesUsine({ lignes: [{ ...LIGNE, douleur: null, cas_usage: null, actualite: null }] })).toEqual([]);
  });

  it("retenir : false (sans lever) si l'appel échoue", async () => {
    const o = { signature: "s", parts: { a: "1", b: null }, typeContenu: "video" as const };
    expect(await porte.retenirSujetUsine(o, "suj-1", { env: ENV, fetchImpl: F(async () => reponse(500, {})) })).toBe(false);
  });
});

describe("« Écrire ce sujet »", () => {
  const idee: IdeeUsine = { signature: "sig-1", parts: { metier: "plombier", douleur: "d12", actualite: null }, metier: "Plombier", taille: "TPE", douleur: "Les devis traînent trois jours.", casUsage: "Un devis envoyé dans l'heure.", format: "Facecam", fin: "Appel" };

  beforeAll(async () => {
    const { hash } = await import("@node-rs/argon2");
    process.env.SESSION_SECRET = "a".repeat(48);
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash("essai-usine", { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter("essai-usine", false);
    delete process.env.USINE_URL;
    delete process.env.USINE_PORTE_SECRET;
  });

  it("crée le sujet pré-rempli, garde les codes ; rappel si l'usine n'a pas été prévenue ; rien de payé", async () => {
    const r = await ecrireSujetDeLUsine(idee, { reseaux: ["tiktok", "linkedin"], typeContenu: "video" });
    expect(r.rappelUsine).toBe(true); // porte éteinte : retenir échoue, le sujet existe quand même
    const s = (await depots().scriptsMaitres.obtenir(r.id))!;
    expect(s.origineUsine).toEqual({ signature: "sig-1", parts: idee.parts, typeContenu: "video" });
    expect(s.brief.idee).toBe("Les devis traînent trois jours. Un devis envoyé dans l'heure.");
    expect(s.brief.cible).toBe("Plombier, TPE");
    expect(s.brief.reseaux).toEqual(["tiktok", "linkedin"]);
    expect(s.etat).toBe("brouillon");
    expect(s.numero).toBeUndefined();
    const mats = await depots().matieres.lister((m) => (s.brief.matiereIdsImposees ?? []).includes(m.id));
    expect(mats.map((m) => m.texte).sort()).toEqual([idee.casUsage, idee.douleur].sort());
    expect(mats.every((m) => m.source.detail === "Usine sig-1" && !m.accord)).toBe(true);
  });

  it("l'usine prévenue : pas de rappel", async () => {
    process.env.USINE_URL = ENV.USINE_URL;
    process.env.USINE_PORTE_SECRET = ENV.USINE_PORTE_SECRET;
    const f = vi.fn(async () => reponse(200, {}));
    vi.stubGlobal("fetch", f);
    try {
      const r = await ecrireSujetDeLUsine(idee, { reseaux: [], typeContenu: "video" });
      expect(r.rappelUsine).toBe(false);
      expect((f.mock.calls[0] as unknown as [string])[0]).toBe("https://usine.test/api/porte/sujets/retenir");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("aucun secret côté navigateur", () => {
  function fichiers(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? fichiers(p) : [p];
    });
  }
  it("les composants clients ne lisent ni USINE_PORTE_SECRET ni le service de la porte", () => {
    for (const p of fichiers("src/components").filter((f) => f.endsWith(".tsx"))) {
      const t = readFileSync(p, "utf8");
      expect(t, p).not.toContain("USINE_PORTE_SECRET");
      expect(t, p).not.toContain("services/usine-porte");
    }
    expect(readFileSync("src/services/usine-porte.ts", "utf8")).toContain('import "server-only"');
    expect(readFileSync("src/domaine/usine.ts", "utf8")).not.toContain("USINE_PORTE_SECRET");
  });
});
