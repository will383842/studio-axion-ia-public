/**
 * Vérification GRATUITE du double HeyGen avant toute dépense (11/11/2026). Doublures `fetch`, aucun réseau réel.
 */
import { readFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { CommandeFabrication } from "@/domaine/types";
import type { ServiceRendu, StockageFichiers } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const F = JSON.parse(readFileSync("tests/fixtures/r7-heygen-doubles.json", "utf8")) as Record<string, { data: Record<string, unknown> }>;
const data = (k: string) => F[k].data;

/** HeyGen doublé : chaque requête est notée ; `panne` : 503 pour tout api.heygen.com. */
const heygen = vi.hoisted(() => ({ requetes: [] as { methode: string; url: string }[], looks: [] as unknown[], voix: [] as unknown[], panne: false as boolean, bloque: false as boolean }));
const reseau = async (url: string, init?: RequestInit) => {
  const u = new URL(String(url));
  const methode = init?.method ?? "GET";
  heygen.requetes.push({ methode, url: `${u.hostname}${u.pathname}${u.search}` });
  if (heygen.bloque) return new Promise<Response>(() => undefined);
  if (heygen.panne && u.hostname === "api.heygen.com") return new Response("{}", { status: 503 });
  const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200 });
  if (u.hostname === "api.heygen.com" && u.pathname === "/v3/voices") return json({ data: heygen.voix, has_more: false });
  if (u.hostname === "api.heygen.com" && u.pathname === "/v3/avatars/looks") return json({ data: heygen.looks, has_more: false });
  return new Response("{}", { status: 404 });
};
vi.mock("@/fournisseurs/heygen/inscription", async () => {
  const { creerFournisseurVisageHeygen } = await import("@/fournisseurs/heygen/visage");
  const { creerClientHeygen } = await import("@/fournisseurs/heygen/client");
  const { stockageSimulation } = await import("@/fournisseurs/simulation/autres");
  const stockage = async () => ({ ...stockageSimulation, urlLectureDuree: async (cle: string, s: number) => `https://r2.exemple/${cle}?lecture=${s}`, urlDepotDuree: async (cle: string) => `https://r2.exemple/${cle}?depot` });
  const f = reseau as unknown as typeof fetch;
  return { visagesHeygen: () => ({ heygen: creerFournisseurVisageHeygen(creerClientHeygen({ cle: "cle-essai-r7", fetch: f }), { stockage, fetch: f, resoudre: async () => ["203.0.113.10"], renduAvatarAutorise: true }) }), voixHeygen: () => ({}) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const commun = await import("@/services/_commun");
const { verifierHeygenAvantPaiement, oublierCacheVerificationHeygen, DUREE_CACHE_HEYGEN_MS } = await import("@/services/verification-heygen");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");

const MDP = "essai-verif-double";
beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
});
beforeEach(async () => {
  vi.restoreAllMocks();
  reinitialiserDepots();
  reinitialiserRequete();
  heygen.requetes = [];
  heygen.looks = [data("lookTermine"), { ...data("lookAccordAttendu"), id: "look_en_attente", name: "Face, en attente" }];
  heygen.voix = [];
  heygen.panne = false;
  heygen.bloque = false;
  oublierCacheVerificationHeygen();
  delete process.env.STUDIO_RENDU_URL;
  await auth.seConnecter(MDP, false);
});

const { enregistrerRessource, horodatage } = commun;
const visage = (id: string, personnageId: string, extra: Record<string, unknown> = {}) => ({ id, personnageId, nom: `Visage ${id}`, angle: "trois-quarts", tenue: "", fondTournage: "x", posture: "assis", origine: "filme", statut: "pret", fichierIds: [], fournisseur: "heygen", versionFournisseur: "avatar_v", ...horodatage(), ...extra }) as never;
async function installer(idExterneAncien: string) {
  const moi = (await depots().personnages.trouver((p) => p.nature === "moi"))!;
  await depots().visages.enregistrer(visage("vis_A", moi.id));
  await enregistrerRessource({ id: "rf_A", entite: "visage", entiteId: "vis_A", fournisseur: "heygen", idExterne: idExterneAncien, versionModele: "avatar_v", statut: "pret", ...horodatage() } as never);
  await depots().visages.enregistrer(visage("vis_G", moi.id, { origine: "genere", fournisseur: "freepik", statut: "pret" }));
  await depots().personnages.modifier(moi.id, { visageParDefautId: "vis_A", visageParFormat: { avocat: "vis_A", autre: "vis_G" } });
  return moi;
}
const aVerifier = (personnageId: string, idExterne: string) => ({ personnageId, doubles: [{ angle: "trois-quarts" as const, visageId: "vis_A", idExterne }], looksDecor: [] as string[] });
const lectures = () => heygen.requetes.filter((r) => r.url.startsWith("api.heygen.com/v3/avatars/looks"));
const journal = async () => (await depots().evenements.lister(() => true)).map((e) => e.message);

describe("vérification gratuite du double HeyGen avant toute dépense", () => {
  it("double présent et prêt : on laisse passer, une seule lecture, que des GET", async () => {
    const moi = await installer("look_essai_tq_001");
    await expect(verifierHeygenAvantPaiement(aVerifier(moi.id, "look_essai_tq_001"))).resolves.toBeUndefined();
    expect(lectures()).toHaveLength(1);
    expect(heygen.requetes.every((r) => r.methode === "GET")).toBe(true);
  });

  it("cache de 60 s : deux appels = une lecture ; relu après 61 s", async () => {
    const moi = await installer("look_essai_tq_001");
    const t = Date.now();
    const spy = vi.spyOn(Date, "now").mockReturnValue(t);
    await verifierHeygenAvantPaiement(aVerifier(moi.id, "look_essai_tq_001"));
    await verifierHeygenAvantPaiement(aVerifier(moi.id, "look_essai_tq_001"));
    expect(lectures()).toHaveLength(1);
    spy.mockReturnValue(t + DUREE_CACHE_HEYGEN_MS + 1000);
    await verifierHeygenAvantPaiement(aVerifier(moi.id, "look_essai_tq_001"));
    expect(lectures()).toHaveLength(2);
  });

  it("absent, sans autre double : DOUBLE_DISPARU, rien rangé, aucune dépense", async () => {
    const moi = await installer("look_ancien_disparu");
    const depensesAvant = await depots().depenses.compter();
    await expect(verifierHeygenAvantPaiement(aVerifier(moi.id, "look_ancien_disparu"))).rejects.toMatchObject({ code: "DOUBLE_DISPARU", message: expect.stringContaining("n'existe plus") });
    expect((await depots().visages.obtenir("vis_A"))!.statut).toBe("pret");
    expect((await depots().ressourcesFournisseurs.obtenir("rf_A"))!.remplaceeLe).toBeUndefined();
    expect(await depots().depenses.compter()).toBe(depensesAvant);
    expect(heygen.requetes.every((r) => r.methode === "GET")).toBe(true);
  });

  it("absent avec remplaçant prêt du même angle : rangé, « le remplace désormais »", async () => {
    const moi = await installer("look_ancien_disparu");
    await depots().visages.enregistrer(visage("vis_B", moi.id, { nom: "Nouveau double" }));
    await enregistrerRessource({ id: "rf_B", entite: "visage", entiteId: "vis_B", fournisseur: "heygen", idExterne: "look_essai_tq_001", versionModele: "avatar_v", statut: "pret", ...horodatage() } as never);
    await expect(verifierHeygenAvantPaiement(aVerifier(moi.id, "look_ancien_disparu"))).rejects.toMatchObject({ code: "DOUBLE_DISPARU", message: expect.stringContaining("le remplace désormais") });
    expect((await depots().visages.obtenir("vis_A"))!.statut).toBe("brouillon");
    expect((await depots().ressourcesFournisseurs.obtenir("rf_A"))!.remplaceeLe).toBeTruthy();
    const p = (await depots().personnages.obtenir(moi.id))!;
    expect(p.visageParDefautId).toBe("vis_B");
    expect(p.visageParFormat).toEqual({ avocat: "vis_B", autre: "vis_G" });
    expect((await depots().visages.obtenir("vis_G"))!.statut).toBe("pret");
  });

  it("liste vide : on laisse passer (journal)", async () => {
    const moi = await installer("look_ancien_disparu");
    heygen.looks = [];
    await expect(verifierHeygenAvantPaiement(aVerifier(moi.id, "look_ancien_disparu"))).resolves.toBeUndefined();
    expect((await journal()).some((m) => m.includes("non concluante"))).toBe(true);
    expect((await depots().visages.obtenir("vis_A"))!.statut).toBe("pret");
  });

  it("HeyGen injoignable (503) : on laisse passer (journal)", async () => {
    const moi = await installer("look_ancien_disparu");
    heygen.panne = true;
    await expect(verifierHeygenAvantPaiement(aVerifier(moi.id, "look_ancien_disparu"))).resolves.toBeUndefined();
    expect((await journal()).some((m) => m.includes("non concluante"))).toBe(true);
  });

  it("double présent mais pas prêt : DOUBLE_PAS_PRET", async () => {
    const moi = await installer("look_en_attente");
    await expect(verifierHeygenAvantPaiement(aVerifier(moi.id, "look_en_attente"))).rejects.toMatchObject({ code: "DOUBLE_PAS_PRET", message: expect.stringContaining("Rien n'a été dépensé") });
  });

  it("une liste en cache ne dit jamais « absent » : relue à neuf", async () => {
    const moi = await installer("look_essai_tq_001");
    await verifierHeygenAvantPaiement(aVerifier(moi.id, "look_essai_tq_001"));
    expect(lectures()).toHaveLength(1);
    heygen.looks = [...heygen.looks, { ...data("lookTermine"), id: "look_nouveau", name: "Nouveau" }];
    await expect(verifierHeygenAvantPaiement(aVerifier(moi.id, "look_nouveau"))).resolves.toBeUndefined();
    expect(lectures()).toHaveLength(2);
  });

  it("look de décor absent : DECOR_DISPARU ; présent : passe", async () => {
    const moi = await installer("look_essai_tq_001");
    await expect(verifierHeygenAvantPaiement({ ...aVerifier(moi.id, "look_essai_tq_001"), looksDecor: ["look_decor_disparu"] })).rejects.toMatchObject({ code: "DECOR_DISPARU", message: expect.stringContaining("Rien n'a été dépensé") });
    await expect(verifierHeygenAvantPaiement({ ...aVerifier(moi.id, "look_essai_tq_001"), looksDecor: ["look_essai_tq_001"] })).resolves.toBeUndefined();
  });

  it("rien à vérifier : aucune lecture", async () => {
    await verifierHeygenAvantPaiement({ doubles: [], looksDecor: [] });
    expect(heygen.requetes).toEqual([]);
  });
});

describe("heygenAVerifier du moteur avocat (pur)", () => {
  const rendu = { soumettre: async () => ({ idRendu: "x" }), etat: async () => ({ statut: "inconnu" as const }) } as unknown as ServiceRendu;
  const stockage = (() => ({}) as unknown as StockageFichiers) as () => StockageFichiers;
  const env = { STUDIO_RENDU_URL: "http://studio-rendu.invalid" };
  async function commande(audioMaitre?: unknown) {
    const c = { ...(await fabrication.construireCommande("v-03")), ratios: ["9:16" as const] };
    const d = c.distribution[0];
    const reel = (id: string) => ({ visageId: `vis-${id}`, idExterne: id, fournisseur: "heygen", origine: "filme", statut: "pret" as const });
    return { ...c, ...(audioMaitre ? { audioMaitre } : {}), distribution: [{ ...d, source: "double", modeAngles: "deux-angles", fournisseurVoix: "heygen", idVoixFournisseur: "voix_x", visagesResolus: { "trois-quarts": reel("look_tq"), face: reel("look_face") } }] } as unknown as CommandeFabrication;
  }
  it("null si rendu éteint ou simulé ; rempli si réel ; voix absente avec audio maître", async () => {
    const c = await commande();
    expect(creerMoteurMontageAvocat({ rendu, stockage, environnement: env, renduDoubleAutorise: false }).heygenAVerifier!(c)).toBeNull();
    expect(creerMoteurMontageAvocat({ stockage, renduDoubleAutorise: true }).heygenAVerifier!(c)).toBeNull();
    const reel = creerMoteurMontageAvocat({ rendu, stockage, environnement: env, renduDoubleAutorise: true });
    const v = reel.heygenAVerifier!(c)!;
    expect(v.doubles.map((x) => x.idExterne).sort()).toEqual(["look_face", "look_tq"]);
    expect(v.voix).toBe("voix_x");
    expect(v.looksDecor).toEqual([]);
    const avecAudio = reel.heygenAVerifier!(await commande({ empreinte: "e", fichierCle: "k", dureeSec: 30 }))!;
    expect(avecAudio.voix).toBeUndefined();
  });
  it("un visage « genere » (look de décor) n'est pas vérifié contre la liste des doubles", async () => {
    const c = await commande();
    const d = c.distribution[0] as unknown as { visagesResolus: Record<string, Record<string, unknown>> };
    const genere = { ...c, distribution: [{ ...d, visagesResolus: { ...d.visagesResolus, face: { ...d.visagesResolus.face, origine: "genere" } } }] } as unknown as CommandeFabrication;
    const reel = creerMoteurMontageAvocat({ rendu, stockage, environnement: env, renduDoubleAutorise: true });
    expect(reel.heygenAVerifier!(genere)!.doubles.map((x) => x.idExterne)).toEqual(["look_tq"]);
  });

  it("principal déjà rendu : seul le second angle est vérifié", async () => {
    const c = await commande({ empreinte: "e", fichierCle: "k", dureeSec: 30 });
    const rendu1 = { ...c, doubleDejaRendu: { empreinteAudio: "e", audioCle: "k", fond: "sans-fond", lookIds: { "trois-quarts": "look_tq" }, pieces: [{ angle: "trois-quarts", tranche: false, debutSec: 0, finSec: 30, videoCle: "v" }] } } as unknown as CommandeFabrication;
    const reel = creerMoteurMontageAvocat({ rendu, stockage, environnement: env, renduDoubleAutorise: true });
    expect(reel.heygenAVerifier!(rendu1)!.doubles.map((x) => x.idExterne)).toEqual(["look_face"]);
  });
});

describe("délai de la vérification", () => {
  it("fetch qui ne répond jamais : résout au bout de 15 s et journalise", async () => {
    vi.useFakeTimers();
    try {
      const moi = await installer("look_essai_tq_001");
      heygen.bloque = true;
      const mod = await import("@/services/verification-heygen");
      const p = mod.verifierHeygenAvantPaiement({ ...aVerifier(moi.id, "look_essai_tq_001"), voix: "voix_x" });
      await vi.advanceTimersByTimeAsync(mod.DELAI_VERIFICATION_HEYGEN_MS + 100);
      await expect(p).resolves.toBeUndefined();
      expect((await journal()).some((m) => m.includes("délai dépassé"))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
