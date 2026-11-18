/**
 * CAL-22 (écrite EN AVANCE, avant RC-08a) : retirer une publication programmée.
 * AUCUN appel réel : le VRAI client du diffuseur (creerClientZernio, vrai constructeur de requêtes, vraie liste fermée) tourne sur un faux `fetch`
 * qui enregistre les appels. Interrupteurs d'essai uniquement ; rien n'est allumé.
 * Règles : un retrait est TOUJOURS confirmé par une relecture chez le diffuseur ; réponse incertaine = « à vérifier » ; rien n'est supprimé.
 */
import { describe, expect, it } from "vitest";
import type { LotEcritures } from "@/domaine/depots";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { creerClientZernio, type FetchZernio } from "@/fournisseurs/publication/zernio-client";
import { lireCleFiche } from "@/components/calendrier/FicheEntree";
import { annulerRetrait, CODES_RETRAIT, retirerProgrammation, SUFFIXE_REPRISE, type DepsRetrait } from "@/services/retirer-programmation";

const CLE = "a".repeat(64);
const CLE_B = "b".repeat(64);
const MAINTENANT = new Date("2026-12-10T10:00:00.000Z");
const DEMAIN = "2026-12-11T08:30:00.000Z";

interface Appel { methode: string; chemin: string }
type Reponse = { statut: number; corps?: unknown } | "coupure";

/** Faux diffuseur à état : un post par clé, un script de réponses par « METHODE chemin ». */
function fauxDiffuseur(posts: Record<string, { status: string; cle: string; origine?: string; programmeLe?: string; statutReseau?: string }>, scripts: Record<string, Reponse[]> = {}) {
  const appels: Appel[] = [];
  const fetchFaux: FetchZernio = async (url, init) => {
    const chemin = new URL(url).pathname.replace(/^\/api/, "");
    appels.push({ methode: init.method, chemin });
    const cle = `${init.method} ${chemin}`;
    const scripte = scripts[cle]?.shift();
    if (scripte === "coupure") throw Object.assign(new Error("coupure"), { name: "TimeoutError" });
    if (scripte) return new Response(JSON.stringify(scripte.corps ?? {}), { status: scripte.statut });
    const id = chemin.split("/")[3];
    const p = id ? posts[id] : undefined;
    const rendu = (id: string) => ({ post: { _id: id, status: posts[id].status, scheduledFor: posts[id].programmeLe ?? DEMAIN, platforms: [{ platform: "linkedin", status: posts[id].statutReseau ?? posts[id].status }], metadata: { origine: posts[id].origine ?? "studio", studioCle: posts[id].cle } } });
    if (init.method === "GET" && chemin === "/v1/posts") {
      const status = new URL(url).searchParams.get("status");
      return new Response(JSON.stringify({ posts: Object.keys(posts).filter((k) => posts[k].status === status).map((k) => rendu(k).post) }), { status: 200 });
    }
    if (init.method === "GET") return p ? new Response(JSON.stringify(rendu(id)), { status: 200 }) : new Response("{}", { status: 404 });
    if (init.method === "DELETE") {
      if (!p) return new Response("{}", { status: 404 });
      delete posts[id];
      return new Response("{}", { status: 200 });
    }
    return new Response("{}", { status: 500 });
  };
  return { appels, fetchFaux };
}

const clientReel = (fetchFaux: FetchZernio) =>
  creerClientZernio({ cle: "cle-d-essai", fetch: fetchFaux, maintenant: () => MAINTENANT.getTime(), attendre: async () => {} });

const envoi = (sur: Partial<EnvoiPlanifie> = {}): EnvoiPlanifie => ({
  id: "envoi:vis_1:linkedin:v0", cle: "envoi:vis_1:linkedin:v0", videoId: "vis_1", nature: "visuel", creneauId: "cre_1", cleDiffuseur: CLE,
  reseau: "linkedin", versionCreneau: 0, jour: "2026-12-11", heure: "09:30", statut: "programme", creeLe: "2026-12-01T00:00:00Z", modifieLe: "2026-12-01T00:00:00Z", ...sur,
});

function monde(opts: { creneau?: Record<string, unknown>; envois?: EnvoiPlanifie[]; posts?: Record<string, { status: string; cle: string; origine?: string; programmeLe?: string; statutReseau?: string }>; scripts?: Record<string, Reponse[]>; reglages?: boolean; marques?: Record<string, string> } = {}) {
  const creneaux = new Map<string, Record<string, unknown>>([["cre_1", {
    id: "cre_1", jourVise: "2026-12-11", heuresParReseau: { linkedin: DEMAIN }, compteCible: "c1", visuelId: "vis_1", statut: "programme", decalages: 0,
    valideeLe: "2026-12-01T00:00:00Z", valideePar: "fondateur", textes: { linkedin: { texte: "Le texte", premierCommentaire: "Et vous ?" } }, ...opts.creneau,
  }]]);
  const envois = new Map((opts.envois ?? [envoi()]).map((e) => [e.id, e]));
  const visuels = new Map<string, Record<string, unknown>>([["vis_1", { id: "vis_1", statut: "programme", titre: "Carrousel", modifieLe: "x" }]]);
  const marques = new Map<string, string>(Object.entries(opts.marques ?? {}));
  const supprime: { collection: string; id: string }[] = [];
  const posts = opts.posts ?? { post_1: { status: "scheduled", cle: CLE } };
  const faux = fauxDiffuseur(posts, opts.scripts);
  const ouvert = opts.reglages ?? true;
  const deps: DepsRetrait = {
    client: clientReel(faux.fetchFaux),
    reglages: { envoiAutorise: async () => ouvert, envoiCalendrierAutorise: async () => ouvert, editorialeActive: async () => ouvert },
    creneau: async (id) => (creneaux.get(id) as never) ?? null,
    envois: async (id) => [...envois.values()].filter((e) => e.creneauId === id),
    visuel: async (id) => (visuels.get(id) as never) ?? null,
    appliquer: async (lot: LotEcritures) => {
      supprime.push(...lot.supprimer);
      for (const { collection, entite } of lot.enregistrer) {
        if (collection === "creneauxEditoriaux") creneaux.set(entite.id, entite as never);
        if (collection === "envoisPlanifies") envois.set(entite.id, entite as EnvoiPlanifie);
        if (collection === "visuels") visuels.set(entite.id, entite as never);
      }
    },
    etats: { lire: async (c) => marques.get(c), noter: async (c, v) => { marques.set(c, v); } },
    maintenant: () => MAINTENANT,
  };
  return { deps, faux, creneaux, envois, visuels, marques, supprime, posts };
}

const INTERDITS = [/Zernio|Buffer/i, /€|\beuros?\b|\bprix\b|\btarif/i, /Supprim|supprim/, /\b(tu|ton|tes|toi)\b/i];

describe("CAL-22 · le vrai client : DELETE réservé, garde avant, relecture après", () => {
  it("la porte publique refuse toujours DELETE, avant tout réseau", async () => {
    const f = fauxDiffuseur({ post_1: { status: "scheduled", cle: CLE } });
    await expect(clientReel(f.fetchFaux).requete({ methode: "DELETE", chemin: "/v1/posts/post_1" })).rejects.toMatchObject({ code: "chemin-refuse" });
    expect(f.appels).toEqual([]);
  });
  it("retirer() : lit, retire, relit (404) → « retire » ; un seul DELETE", async () => {
    const f = fauxDiffuseur({ post_1: { status: "scheduled", cle: CLE } });
    const r = await clientReel(f.fetchFaux).retirer({ postId: "post_1", cleJournal: CLE });
    expect(r.etat).toBe("retire");
    expect(f.appels.map((a) => `${a.methode} ${a.chemin}`)).toEqual(["GET /v1/posts/post_1", "DELETE /v1/posts/post_1", "GET /v1/posts/post_1"]);
  });
  it.each([
    ["autre clé", { status: "scheduled", cle: CLE_B }, /clé du post ne correspond pas/],
    ["pas à nous", { status: "scheduled", cle: CLE, origine: "autre" }, /pas à nous/],
    ["déjà publié", { status: "published", cle: CLE }, /statut published/],
    ["en cours de publication", { status: "publishing", cle: CLE }, /statut publishing/],
  ])("garde avant : %s → « refuse » pour la bonne raison, AUCUN DELETE", async (_n, post, raison) => {
    const f = fauxDiffuseur({ post_1: post });
    const r = await clientReel(f.fetchFaux).retirer({ postId: "post_1", cleJournal: CLE });
    expect(r).toMatchObject({ etat: "refuse", raison: expect.stringMatching(raison) });
    expect(f.appels.some((a) => a.methode === "DELETE")).toBe(false);
  });
  it("garde avant : un réseau déjà en ligne → « refuse », AUCUN DELETE", async () => {
    const f = fauxDiffuseur({ post_1: { status: "scheduled", cle: CLE, statutReseau: "published" } });
    const r = await clientReel(f.fetchFaux).retirer({ postId: "post_1", cleJournal: CLE });
    expect(r).toMatchObject({ etat: "refuse", raison: expect.stringMatching(/déjà en ligne/) });
    expect(f.appels.some((a) => a.methode === "DELETE")).toBe(false);
  });
  it("garde avant : programmé à moins de 30 minutes → « a-verifier », AUCUN DELETE", async () => {
    const f = fauxDiffuseur({ post_1: { status: "scheduled", cle: CLE, programmeLe: "2026-12-10T10:20:00.000Z" } });
    const r = await clientReel(f.fetchFaux).retirer({ postId: "post_1", cleJournal: CLE });
    expect(r).toMatchObject({ etat: "a-verifier", raison: expect.stringMatching(/moins de 30 min/) });
    expect(f.appels.some((a) => a.methode === "DELETE")).toBe(false);
  });
  it("200 au DELETE mais le post est encore là à la relecture → « a-verifier » (jamais « retire » sur le seul code)", async () => {
    const f = fauxDiffuseur({ post_1: { status: "scheduled", cle: CLE } }, { "DELETE /v1/posts/post_1": [{ statut: 200 }] });
    const r = await clientReel(f.fetchFaux).retirer({ postId: "post_1", cleJournal: CLE });
    expect(r.etat).toBe("a-verifier");
  });
  it("coupure pendant le DELETE puis relecture : post parti → « retire » ; post encore là → « a-verifier »", async () => {
    const parti = fauxDiffuseur({}, { "GET /v1/posts/post_1": [{ statut: 200, corps: { post: { _id: "post_1", status: "draft", platforms: [{ platform: "linkedin", status: "scheduled" }], scheduledFor: DEMAIN, metadata: { origine: "studio", studioCle: CLE } } } }], "DELETE /v1/posts/post_1": ["coupure"] });
    expect((await clientReel(parti.fetchFaux).retirer({ postId: "post_1", cleJournal: CLE })).etat).toBe("retire");
    const la = fauxDiffuseur({ post_1: { status: "draft", cle: CLE } }, { "DELETE /v1/posts/post_1": ["coupure"] });
    expect((await clientReel(la.fetchFaux).retirer({ postId: "post_1", cleJournal: CLE })).etat).toBe("a-verifier");
  });
  it("DELETE en 404 puis relecture en 404 → « retire » ; relecture « cancelled » → « retire »", async () => {
    const avant = { statut: 200, corps: { post: { _id: "post_1", status: "scheduled", platforms: [{ platform: "linkedin", status: "scheduled" }], scheduledFor: DEMAIN, metadata: { origine: "studio", studioCle: CLE } } } };
    const a = fauxDiffuseur({}, { "GET /v1/posts/post_1": [avant], "DELETE /v1/posts/post_1": [{ statut: 404 }] });
    expect((await clientReel(a.fetchFaux).retirer({ postId: "post_1", cleJournal: CLE })).etat).toBe("retire");
    const annule = { statut: 200, corps: { post: { _id: "post_1", status: "cancelled", platforms: [{ platform: "linkedin", status: "scheduled" }], scheduledFor: DEMAIN, metadata: { origine: "studio", studioCle: CLE } } } };
    const b = fauxDiffuseur({ post_1: { status: "scheduled", cle: CLE } }, { "GET /v1/posts/post_1": [avant, annule] });
    expect((await clientReel(b.fetchFaux).retirer({ postId: "post_1", cleJournal: CLE })).etat).toBe("retire");
  });
  it("interrupteur d'arrêt : rien n'est envoyé", async () => {
    const f = fauxDiffuseur({ post_1: { status: "scheduled", cle: CLE } });
    const c = creerClientZernio({ cle: "cle-d-essai", fetch: f.fetchFaux, envoiAutorise: () => false });
    await expect(c.retirer({ postId: "post_1", cleJournal: CLE })).rejects.toMatchObject({ code: "envoi-coupe" });
    expect(f.appels).toEqual([]);
  });
});

describe("CAL-22 · retirerProgrammation", () => {
  it("critère 1 : retiré chez le diffuseur, confirmé par relecture, puis « À placer » ; rien n'est supprimé", async () => {
    const m = monde();
    const r = await retirerProgrammation(m.deps, "cre_1");
    expect(r.ok).toBe(true);
    expect(m.faux.appels.filter((a) => a.methode === "DELETE")).toHaveLength(1);
    expect(m.faux.appels.at(-1)).toEqual({ methode: "GET", chemin: "/v1/posts/post_1" });
    expect(m.supprime).toEqual([]);
    expect(m.creneaux.get("cre_1")).toMatchObject({ statut: "archive", retireLe: MAINTENANT.toISOString(), textes: { linkedin: { texte: "Le texte" } }, visuelId: "vis_1" });
    expect(m.visuels.get("vis_1")).toMatchObject({ statut: "valide" });
    expect([...m.envois.values()].every((e) => e.statut === "annule")).toBe(true);
  });
  it("critère 2 : le diffuseur ne répond pas → reste « Programmé », phrase claire, aucune écriture", async () => {
    const m = monde({ scripts: { "GET /v1/posts": ["coupure"] } });
    const r = await retirerProgrammation(m.deps, "cre_1");
    expect(r.ok).toBe(false);
    expect(m.creneaux.get("cre_1")).toMatchObject({ statut: "programme" });
    expect([...m.envois.values()][0].statut).toBe("programme");
    expect(m.faux.appels.some((a) => a.methode === "DELETE")).toBe(false);
    if (!r.ok) for (const i of INTERDITS) expect(r.message).not.toMatch(i);
  });
  it("réponse incertaine (DELETE sans réponse, post encore là) → « à vérifier », reste programmé, marque posée", async () => {
    const m = monde({ scripts: { "DELETE /v1/posts/post_1": ["coupure"] } });
    const r = await retirerProgrammation(m.deps, "cre_1");
    expect(r).toMatchObject({ ok: false, etat: "a-verifier" });
    expect(m.marques.get("a-verifier:envoi:vis_1:linkedin:v0")).toBe("a-verifier");
    expect(m.creneaux.get("cre_1")).toMatchObject({ statut: "programme" });
    expect(m.supprime).toEqual([]);
  });
  it("un réseau déjà en ligne chez le diffuseur : « à retirer à la main », reste programmé, aucun DELETE", async () => {
    const m = monde({ posts: { post_1: { status: "scheduled", cle: CLE, statutReseau: "published" } } });
    const r = await retirerProgrammation(m.deps, "cre_1");
    expect(r).toMatchObject({ ok: false, etat: "a-retirer-a-la-main" });
    expect(m.faux.appels.some((a) => a.methode === "DELETE")).toBe(false);
    expect(m.creneaux.get("cre_1")).toMatchObject({ statut: "programme" });
    expect(m.supprime).toEqual([]);
  });
  it("programmé chez le diffuseur à moins de 30 minutes : « à vérifier », reste programmé, aucun DELETE", async () => {
    const m = monde({ posts: { post_1: { status: "scheduled", cle: CLE, programmeLe: "2026-12-10T10:20:00.000Z" } } });
    const r = await retirerProgrammation(m.deps, "cre_1");
    expect(r).toMatchObject({ ok: false, etat: "a-verifier" });
    expect(m.marques.get("a-verifier:envoi:vis_1:linkedin:v0")).toBe("a-verifier");
    expect(m.faux.appels.some((a) => a.methode === "DELETE")).toBe(false);
    expect(m.creneaux.get("cre_1")).toMatchObject({ statut: "programme" });
  });
  it("critère 4 : annulation impossible chez le diffuseur → « à retirer à la main », reste programmé", async () => {
    const m = monde({ scripts: { "DELETE /v1/posts/post_1": [{ statut: 400, corps: { error: "non annulable" } }] } });
    const r = await retirerProgrammation(m.deps, "cre_1");
    expect(r).toMatchObject({ ok: false, etat: "a-retirer-a-la-main" });
    expect(m.marques.get("retrait:envoi:vis_1:linkedin:v0")).toBe("a-retirer-a-la-main");
    expect(m.creneaux.get("cre_1")).toMatchObject({ statut: "programme" });
  });
  it("critère 3 : une publication déjà partie ne se retire pas, aucun appel", async () => {
    const m = monde({ envois: [envoi({ statut: "envoye" })] });
    const r = await retirerProgrammation(m.deps, "cre_1");
    expect(r).toMatchObject({ ok: false, etat: "refuse" });
    expect(m.faux.appels).toEqual([]);
  });
  it("critère 3 : l'heure est passée → refus, aucun appel", async () => {
    const m = monde({ creneau: { heuresParReseau: { linkedin: "2026-12-10T09:00:00.000Z" } } });
    const r = await retirerProgrammation(m.deps, "cre_1");
    expect(r).toMatchObject({ ok: false, etat: "refuse" });
    expect(m.faux.appels).toEqual([]);
  });
  it("avant la promotion (brouillon jamais créé) : annuler = ne jamais promouvoir, sans aucun appel", async () => {
    const m = monde({ creneau: { statut: "valide" }, envois: [envoi({ statut: "valide", cleDiffuseur: undefined })], posts: {}, reglages: false });
    const r = await retirerProgrammation(m.deps, "cre_1");
    expect(r.ok).toBe(true);
    expect(m.faux.appels).toEqual([]);
    expect([...m.envois.values()][0].statut).toBe("annule");
    expect(m.creneaux.get("cre_1")).toMatchObject({ statut: "archive" });
  });
  it("interrupteurs éteints alors qu'un post existe : aucun appel, reste programmé, phrase claire", async () => {
    const m = monde({ reglages: false });
    const r = await retirerProgrammation(m.deps, "cre_1");
    expect(r.ok).toBe(false);
    expect(m.faux.appels).toEqual([]);
    expect(m.creneaux.get("cre_1")).toMatchObject({ statut: "programme" });
  });
  it("deux réseaux : l'un retiré, l'autre refusé → le créneau reste programmé, l'envoi retiré est noté « annule », rien n'est supprimé", async () => {
    const b = envoi({ id: "envoi:vis_1:facebook:v0", cle: "envoi:vis_1:facebook:v0", reseau: "facebook", cleDiffuseur: CLE_B });
    const m = monde({ envois: [envoi(), b], posts: { post_1: { status: "scheduled", cle: CLE }, post_2: { status: "scheduled", cle: CLE_B } }, scripts: { "DELETE /v1/posts/post_2": [{ statut: 400 }] } });
    const r = await retirerProgrammation(m.deps, "cre_1");
    expect(r).toMatchObject({ ok: false, etat: "a-retirer-a-la-main", ecritures: true });
    if (!r.ok) expect(r.message).toMatch(/Retiré chez le diffuseur : LinkedIn\. Reste programmé : Facebook\./);
    expect(m.marques.get("retrait:envoi:vis_1:facebook:v0")).toBe("a-retirer-a-la-main");
    expect(m.faux.appels.filter((a) => a.methode === "DELETE").map((a) => a.chemin)).toContain("/v1/posts/post_2");
    expect(m.envois.get("envoi:vis_1:linkedin:v0")?.statut).toBe("annule");
    expect(m.envois.get("envoi:vis_1:facebook:v0")?.statut).toBe("programme");
    expect(m.creneaux.get("cre_1")).toMatchObject({ statut: "programme" });
    expect(m.supprime).toEqual([]);
  });
  it("post introuvable chez le diffuseur alors qu'un envoi en porte la clé : « à vérifier », aucun DELETE, reste programmé", async () => {
    const m = monde({ posts: {} });
    const r = await retirerProgrammation(m.deps, "cre_1");
    expect(r).toMatchObject({ ok: false, etat: "a-verifier" });
    expect(m.faux.appels.some((a) => a.methode === "DELETE")).toBe(false);
    expect(m.marques.get("a-verifier:envoi:vis_1:linkedin:v0")).toBe("a-verifier");
    expect(m.creneaux.get("cre_1")).toMatchObject({ statut: "programme" });
  });
  it("un rejeu après succès ne rappelle rien (déjà retiré)", async () => {
    const m = monde();
    await retirerProgrammation(m.deps, "cre_1");
    const n = m.faux.appels.length;
    const r = await retirerProgrammation(m.deps, "cre_1");
    expect(m.faux.appels).toHaveLength(n);
    expect(r.ok).toBe(true);
  });
  it("les phrases n'ont ni nom d'outil, ni prix, ni « supprimer », ni tutoiement", async () => {
    const cas = [monde({ scripts: { "GET /v1/posts": ["coupure"] } }), monde({ scripts: { "DELETE /v1/posts/post_1": ["coupure"] } }), monde({ envois: [envoi({ statut: "envoye" })] }), monde(), monde({ reglages: false })];
    for (const m of cas) {
      const r = await retirerProgrammation(m.deps, "cre_1");
      for (const i of INTERDITS) expect(r.message).not.toMatch(i);
    }
  });
});

describe("CAL-22 · annulerRetrait (10 secondes)", () => {
  it("reprogramme à la même date, sans doublon : une nouvelle version, un seul rejeu", async () => {
    const m = monde();
    await retirerProgrammation(m.deps, "cre_1");
    const depsT = { ...m.deps, maintenant: () => new Date(MAINTENANT.getTime() + 8_000) };
    const a = await annulerRetrait(depsT, "cre_1");
    expect(a.ok).toBe(true);
    const b = await annulerRetrait(depsT, "cre_1");
    expect(b.ok).toBe(true);
    const nouveaux = [...m.creneaux.values()].filter((c) => c.id !== "cre_1");
    expect(nouveaux).toHaveLength(1);
    expect(nouveaux[0]).toMatchObject({ statut: "valide", heuresParReseau: { linkedin: DEMAIN }, decalages: 1, visuelId: "vis_1", valideePar: "fondateur" });
    expect(nouveaux[0].retireLe).toBeUndefined();
    expect(m.creneaux.get("cre_1")).toMatchObject({ statut: "archive" });
  });
  it("au-delà de 10 secondes : refus avec une phrase claire, rien n'est écrit", async () => {
    const m = monde();
    await retirerProgrammation(m.deps, "cre_1");
    const a = await annulerRetrait({ ...m.deps, maintenant: () => new Date(MAINTENANT.getTime() + 11_000) }, "cre_1");
    expect(a.ok).toBe(false);
    expect(m.creneaux.size).toBe(1);
  });
  it("heure trop proche (moins de 30 minutes) : refus, rien n'est écrit", async () => {
    const m = monde({ creneau: { heuresParReseau: { linkedin: "2026-12-10T10:20:00.000Z" } } });
    // le créneau est archivé « à la main » dans le test : l'heure était valable au moment du retrait
    m.creneaux.set("cre_1", { ...m.creneaux.get("cre_1")!, statut: "archive", retireLe: MAINTENANT.toISOString() });
    const a = await annulerRetrait(m.deps, "cre_1");
    expect(a).toMatchObject({ ok: false, message: expect.stringMatching(/trop proche/) });
    expect(m.creneaux.size).toBe(1);
  });
  it("la reprise retirée à son tour : un nouvel « Annuler » ne répond pas « remise »", async () => {
    const m = monde();
    await retirerProgrammation(m.deps, "cre_1");
    const t = { ...m.deps, maintenant: () => new Date(MAINTENANT.getTime() + 5_000) };
    await annulerRetrait(t, "cre_1");
    m.creneaux.set("cre_1" + SUFFIXE_REPRISE, { ...m.creneaux.get("cre_1" + SUFFIXE_REPRISE)!, statut: "archive", retireLe: MAINTENANT.toISOString() });
    const a = await annulerRetrait(t, "cre_1");
    expect(a.ok).toBe(false);
  });
  it("un créneau qui n'a pas été retiré ne se « reprogramme » pas", async () => {
    const m = monde();
    const a = await annulerRetrait(m.deps, "cre_1");
    expect(a.ok).toBe(false);
    expect(m.creneaux.size).toBe(1);
  });
});

describe("CAL-22 · partiel, codes, clé de la reprise", () => {
  const deux = (scriptB: Reponse[], extra: Record<string, Reponse[]> = {}) => {
    const b = envoi({ id: "envoi:vis_1:facebook:v0", cle: "envoi:vis_1:facebook:v0", reseau: "facebook", cleDiffuseur: CLE_B });
    return monde({ envois: [envoi(), b], posts: { post_1: { status: "scheduled", cle: CLE }, post_2: { status: "scheduled", cle: CLE_B } }, scripts: { "DELETE /v1/posts/post_2": scriptB, ...extra } });
  };
  it.each([
    ["à retirer à la main", [{ statut: 400 }] as Reponse[], "a-retirer-a-la-main", /à retirer à la main/],
    ["à vérifier", ["coupure"] as Reponse[], "a-verifier", /à vérifier/],
    ["503 au retrait → à vérifier", [{ statut: 503 }] as Reponse[], "a-verifier", /à vérifier/],
  ])("retrait partiel (%s) : message vrai, écran à rafraîchir, aucun mot interdit", async (_n, script, etat, motif) => {
    const m = deux(script);
    const r = await retirerProgrammation(m.deps, "cre_1");
    expect(r).toMatchObject({ ok: false, etat, ecritures: true });
    if (r.ok) return;
    expect(r.message).toMatch(/Retiré chez le diffuseur : LinkedIn\. Reste programmé : Facebook\./);
    expect(r.message).toMatch(motif);
    expect(r.message).not.toMatch(/rien n'a été changé/i);
    for (const i of INTERDITS) expect(r.message).not.toMatch(i);
  });
  it("partiel sans réponse du diffuseur (lecture en 503) : « reste programmé », phrase « réessayez », envoi retiré noté « annule », aucun DELETE sur le second", async () => {
    const m = deux([], { "GET /v1/posts/post_2": [{ statut: 503 }] });
    const r = await retirerProgrammation(m.deps, "cre_1");
    expect(r).toMatchObject({ ok: false, etat: "reste-programme", ecritures: true });
    if (r.ok) return;
    expect(r.message).toMatch(/Retiré chez le diffuseur : LinkedIn\. Reste programmé : Facebook\./);
    expect(r.message).toMatch(/réessayez plus tard/);
    expect(r.message).not.toMatch(/rien n'a été changé/i);
    for (const i of INTERDITS) expect(r.message).not.toMatch(i);
    expect(m.envois.get("envoi:vis_1:linkedin:v0")?.statut).toBe("annule");
    expect(m.faux.appels.some((a) => a.methode === "DELETE" && a.chemin === "/v1/posts/post_2")).toBe(false);
  });
  it("chaque état a son propre code ; sans écriture, pas de rafraîchissement demandé", async () => {
    expect(new Set(Object.values(CODES_RETRAIT)).size).toBe(4);
    expect(CODES_RETRAIT).toMatchObject({ "a-verifier": "RETRAIT_A_VERIFIER", "a-retirer-a-la-main": "RETRAIT_A_LA_MAIN", "reste-programme": "RETRAIT_RESTE_PROGRAMME", refuse: "RETRAIT_REFUSE" });
    const m = monde({ scripts: { "GET /v1/posts": ["coupure"] } });
    const r = await retirerProgrammation(m.deps, "cre_1");
    expect(r).toMatchObject({ ok: false, etat: "reste-programme" });
    expect((r as { ecritures?: true }).ecritures).toBeUndefined();
  });
  it("la reprise a une clé de carte lisible (elle peut être retirée à son tour)", async () => {
    const m = monde();
    await retirerProgrammation(m.deps, "cre_1");
    const a = await annulerRetrait({ ...m.deps, maintenant: () => new Date(MAINTENANT.getTime() + 3_000) }, "cre_1");
    expect(a.ok && lireCleFiche(`creneau:${a.creneauId}|linkedin`)).toMatchObject({ origine: "creneau", id: "cre_1" + SUFFIXE_REPRISE });
  });
});
