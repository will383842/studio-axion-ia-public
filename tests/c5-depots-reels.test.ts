/**
 * CORRECTEUR 5 — B5 de l'audit A : les fichiers ajoutés depuis la Bibliothèque, Personnages et l'assistant sont
 * VRAIMENT envoyés (`envoyerFichier` → services de `/api/depots` → seau), jamais une simple fiche (nom, type, taille).
 * Faux seau R2 en mémoire (adresses `*.r2.cloudflarestorage.com` interceptées) : aucun envoi sur Internet, aucune clé
 * réelle. ROUGE prouvé sur d186500 (les actions créaient un fichier « refusé », sans octets, et acceptaient une fiche).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { envoyerFichier } from "@/lib/envoi-multipart";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

/* ---------------- Faux seau R2 (multipart compris) ---------------- */
const seau = new Map<string, Uint8Array>();
const envoisEnCours = new Map<string, Map<number, Uint8Array>>();
const fetchReel = globalThis.fetch;
const cleDe = (url: URL) => decodeURIComponent(url.pathname.replace(/^\/studio-essai\//, ""));
vi.stubGlobal("fetch", async (entree: string | URL | Request, init?: RequestInit) => {
  const brut = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
  if (!/\.r2\.cloudflarestorage\.com\//.test(brut)) return fetchReel(entree, init);
  const url = new URL(brut);
  const cle = cleDe(url);
  const methode = (init?.method ?? "GET").toUpperCase();
  const idEnvoi = url.searchParams.get("uploadId");
  if (methode === "POST" && url.searchParams.has("uploads")) {
    const id = `envoi-${envoisEnCours.size + 1}`;
    envoisEnCours.set(id, new Map());
    return new Response(`<InitiateMultipartUploadResult><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`, { status: 200 });
  }
  if (methode === "PUT" && idEnvoi) {
    const corps = init?.body instanceof Blob ? new Uint8Array(await init.body.arrayBuffer()) : new Uint8Array(init?.body as ArrayBuffer);
    envoisEnCours.get(idEnvoi)!.set(Number(url.searchParams.get("partNumber")), corps);
    return new Response(null, { status: 200, headers: { etag: `"m${url.searchParams.get("partNumber")}"` } });
  }
  if (methode === "POST" && idEnvoi) {
    const morceaux = [...envoisEnCours.get(idEnvoi)!.entries()].sort((a, b) => a[0] - b[0]).map(([, o]) => o);
    const tout = new Uint8Array(morceaux.reduce((s, m) => s + m.byteLength, 0));
    let i = 0;
    for (const m of morceaux) {
      tout.set(m, i);
      i += m.byteLength;
    }
    seau.set(cle, tout);
    return new Response("<CompleteMultipartUploadResult/>", { status: 200 });
  }
  if (!seau.has(cle)) return new Response(null, { status: 404 });
  const o = seau.get(cle)!;
  return new Response(methode === "HEAD" ? null : (o as unknown as BodyInit), { status: 200, headers: { "content-length": String(o.byteLength) } });
});

const ENV_AVANT = { ...process.env };
const VARIABLES = { FOURNISSEUR_STOCKAGE: "r2", R2_ACCOUNT_ID: "compte-essai", R2_ACCESS_KEY_ID: "cle-essai", R2_SECRET_ACCESS_KEY: "secret-essai", R2_BUCKET: "studio-essai" };
Object.assign(process.env, VARIABLES);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const envois = await import("@/services/envois");
const biblio = await import("@/app/(studio)/bibliotheque/actions");
const perso = await import("@/app/(studio)/personnages/actions");
const assistant = await import("@/app/(studio)/nouvelle/[format]/actions");

const MDP = "c5-depots-reels";

afterAll(() => {
  vi.unstubAllGlobals();
  for (const k of Object.keys(VARIABLES)) {
    if (ENV_AVANT[k] === undefined) delete process.env[k];
    else process.env[k] = ENV_AVANT[k];
  }
});
beforeAll(async () => preparerMotDePasse(MDP));
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  seau.clear();
  envoisEnCours.clear();
  await auth.seConnecter(MDP, false);
});

/** Le navigateur : le VRAI `envoyerFichier`, branché sur les services de `/api/depots` et sur le faux seau. */
async function envoyer(nom: string, mime: string, octets: Uint8Array, cible: { typeEntite: string; entiteId: string }): Promise<string> {
  const api = async (corps: Record<string, unknown>) => {
    const d = { nom: String(corps.nom), mime: String(corps.mime), taille: Number(corps.taille), typeEntite: String(corps.typeEntite), entiteId: String(corps.entiteId) };
    if (corps.action === "commencer") return { ...(await envois.commencerEnvoi(d)) };
    if (corps.action === "signer") return { adresses: await envois.signerMorceaux(corps.cle, corps.idEnvoi, corps.numeros) };
    if (corps.action === "terminer") {
      const f = await envois.terminerEnvoi({ ...d, fichierId: String(corps.fichierId), cle: corps.cle, idEnvoi: corps.idEnvoi, morceaux: corps.morceaux });
      return { fichierId: f.id, statut: f.statut };
    }
    throw new Error(`action inattendue ${String(corps.action)}`);
  };
  const r = await envoyerFichier(new File([octets as BlobPart], nom, { type: mime, lastModified: 1 }), cible, { api, stockage: undefined });
  expect(r.simulation).toBe(false);
  return r.fichierId;
}

const octets = (n: number, v: number) => new Uint8Array(n).fill(v);

async function octetsStockes(fichierId: string): Promise<Uint8Array | undefined> {
  const f = await depots().fichiers.obtenir(fichierId);
  return f ? seau.get(f.cleStockage) : undefined;
}

describe("B5 · Bibliothèque : une musique ajoutée part pour de vrai", () => {
  it("ROUGE (d186500) : l'élément pointe sur le fichier envoyé, prêt, octet pour octet dans le seau", async () => {
    const musique = octets(3000, 7);
    const fichierId = await envoyer("generique.mp3", "audio/mpeg", musique, { typeEntite: "element", entiteId: "musique" });
    const r = await biblio.creerElementAction({ type: "musique", nom: "Générique", valeur: { type: "musique", dureeSec: 30 } as never, fichier: { fichierId } });
    expect(r.ok, r.ok ? "" : r.message).toBe(true);
    if (!r.ok) return;
    const e = (await depots().elements.obtenir(r.donnees.id))!;
    expect(e.fichierId).toBe(fichierId);
    expect((await depots().fichiers.obtenir(fichierId))!.statut).toBe("pret");
    expect(await octetsStockes(fichierId)).toEqual(musique);
    // Aucun autre fichier « fantôme » n'a été créé.
    expect((await depots().fichiers.lister()).filter((f) => f.origine === "depot")).toHaveLength(1);
  });

  it("ROUGE (d186500) : une simple fiche (nom, type, taille) sans octets est refusée", async () => {
    const r = await biblio.creerElementAction({ type: "musique", nom: "Fantôme", valeur: { type: "musique", dureeSec: 30 } as never, fichier: { nom: "x.mp3", mime: "audio/mpeg", taille: 999 } as never });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/pas arrivé/);
    expect((await depots().fichiers.lister()).filter((f) => f.origine === "depot")).toHaveLength(0);
  });

  it("illustrations, rushs et preuve de licence : les fichiers envoyés sont repris tels quels", async () => {
    const img = await envoyer("plage.jpg", "image/jpeg", octets(1200, 1), { typeEntite: "element", entiteId: "illustration" });
    const vid = await envoyer("vague.mp4", "video/mp4", octets(1500, 2), { typeEntite: "element", entiteId: "illustration" });
    const ill = await biblio.ajouterIllustrationsAction([{ fichierId: img }, { fichierId: vid }], ["mer"]);
    expect(ill.ok).toBe(true);
    if (!ill.ok) return;
    const [a, b] = await Promise.all(ill.donnees.ids.map((id) => depots().elements.obtenir(id)));
    expect([a!.type, a!.fichierId, a!.nom]).toEqual(["illustration-image", img, "Plage"]);
    expect([b!.type, b!.fichierId]).toEqual(["illustration-video", vid]);

    const rush = await envoyer("prise-1.mp4", "video/mp4", octets(2000, 3), { typeEntite: "element", entiteId: "rush" });
    const rr = await biblio.ajouterRushsAction([{ fichier: { fichierId: rush }, dureeSec: 12 }], []);
    expect(rr.ok).toBe(true);
    if (rr.ok) expect((await depots().rushs.obtenir(rr.donnees.ids[0]))!.fichierId).toBe(rush);

    const preuve = await envoyer("facture.pdf", "application/pdf", octets(800, 4), { typeEntite: "element", entiteId: `preuve-${a!.id}` });
    const rp = await biblio.deposerPreuveLicenceAction(a!.id, "illustration-image", { fichierId: preuve });
    expect(rp.ok, rp.ok ? "" : rp.message).toBe(true);
    expect((await depots().elements.obtenir(a!.id))!.licence.preuveFichierId).toBe(preuve);
    expect(await octetsStockes(preuve)).toEqual(octets(800, 4));
  });

  it("un fichier pas encore arrivé (« en attente ») ou envoyé ailleurs est refusé", async () => {
    await depots().fichiers.enregistrer({ id: "f-attente", cleStockage: "studio/dev/element/musique/f-attente.mp3", nom: "a.mp3", mime: "audio/mpeg", taille: 1, origine: "depot", statut: "en_attente", creeLe: "2026-10-03T10:00:00.000Z", modifieLe: "2026-10-03T10:00:00.000Z" });
    const r1 = await biblio.creerElementAction({ type: "musique", nom: "A", valeur: { type: "musique", dureeSec: 30 } as never, fichier: { fichierId: "f-attente" } });
    expect(r1.ok).toBe(false);
    const voix = await envoyer("voix.webm", "audio/webm", octets(500, 5), { typeEntite: "voix", entiteId: "per-autre" });
    const r2 = await biblio.creerElementAction({ type: "musique", nom: "B", valeur: { type: "musique", dureeSec: 30 } as never, fichier: { fichierId: voix } });
    expect(r2.ok).toBe(false);
  });
});

describe("B5 · Personnages : visage, voix et accord envoyés pour de vrai", () => {
  it("ROUGE (d186500) : les vidéos du visage, la voix et le document d'accord sont les fichiers envoyés", async () => {
    const p = await perso.creerPersonnageAction({ nom: "Léa", nature: "reel" });
    if (!p.ok) throw new Error(p.message);
    const id = p.donnees.id;
    const doc = await envoyer("accord.pdf", "application/pdf", octets(900, 6), { typeEntite: "accord", entiteId: id });
    const ra = await perso.enregistrerAccordAction(id, { case: true, document: { fichierId: doc }, date: "2026-10-01" });
    expect(ra.ok, ra.ok ? "" : ra.message).toBe(true);
    const fiche = (await depots().personnages.obtenir(id))!;
    expect(JSON.stringify(fiche)).toContain(doc);

    const voix = await envoyer("voix.webm", "audio/webm", octets(4000, 8), { typeEntite: "voix", entiteId: id });
    const rv = await perso.enregistrerVoixAction(id, { fichiers: [{ fichierId: voix }], minutes: 2 });
    expect(rv.ok, rv.ok ? "" : rv.message).toBe(true);
    if (rv.ok) expect((await depots().voix.obtenir(rv.donnees.id))!.fichierIds).toEqual([voix]);
    expect(await octetsStockes(voix)).toEqual(octets(4000, 8));
  });

  it("ROUGE (d186500) : une voix « déclarée » sans octets, ou envoyée pour un autre personnage, est refusée", async () => {
    const p = await perso.creerPersonnageAction({ nom: "Léa", nature: "reel" });
    if (!p.ok) throw new Error(p.message);
    const doc = await envoyer("accord.pdf", "application/pdf", octets(900, 6), { typeEntite: "accord", entiteId: p.donnees.id });
    expect((await perso.enregistrerAccordAction(p.donnees.id, { case: true, document: { fichierId: doc }, date: "2026-10-01" })).ok).toBe(true);
    const r1 = await perso.enregistrerVoixAction(p.donnees.id, { fichiers: [{ nom: "v.webm", mime: "audio/webm", taille: 10 } as never], minutes: 2 });
    expect(r1.ok).toBe(false);
    const ailleurs = await envoyer("voix.webm", "audio/webm", octets(400, 9), { typeEntite: "voix", entiteId: "per-autre" });
    const r2 = await perso.enregistrerVoixAction(p.donnees.id, { fichiers: [{ fichierId: ailleurs }], minutes: 2 });
    expect(r2.ok).toBe(false);
    expect(await depots().voix.lister((v) => v.personnageId === p.donnees.id)).toHaveLength(0);
  });
});

describe("B5 · assistant « Nouvelle vidéo » : captures et rushs envoyés pour de vrai", () => {
  it("ROUGE (d186500) : le fichier rendu est celui envoyé (même identifiant, prêt), une fiche seule est refusée", async () => {
    const capture = await envoyer("page.png", "image/png", octets(700, 10), { typeEntite: "entree", entiteId: "brouillon" });
    const r = await assistant.deposerFichierAction({ fichierId: capture, typeEntite: "entree", entiteId: "brouillon" });
    expect(r.ok, r.ok ? "" : r.message).toBe(true);
    if (r.ok) expect([r.donnees.id, r.donnees.nom, r.donnees.mime]).toEqual([capture, "page.png", "image/png"]);
    expect(await octetsStockes(capture)).toEqual(octets(700, 10));

    const fiche = await assistant.deposerFichierAction({ nom: "x.png", mime: "image/png", taille: 10, typeEntite: "entree", entiteId: "brouillon" } as never);
    expect(fiche.ok).toBe(false);
    expect((await depots().fichiers.lister()).filter((f) => f.origine === "depot")).toHaveLength(1);
  });
});
