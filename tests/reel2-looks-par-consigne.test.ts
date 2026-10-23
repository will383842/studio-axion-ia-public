/**
 * CORRECTEUR RÉEL 2 · F1-F3, F5 (04/10, décision de Will qui remplace celle du 03/10) : le studio peut CRÉER un look
 * HeyGen de l'avatar de Will à partir d'une description (tenue, décor, angle), si Will l'a allumé (éteint par défaut).
 *  - F1 : réglage « Créer vos décors avec HeyGen » ; éteint = aucun appel ; relu avant chaque création ;
 *  - F2 : « Décrivez » → consigne anglaise (tenue, décor, cadrage tête-taille, vertical 9:16), prix montré, accord exigé,
 *         décor rangé (lookIdParAngle), « à vérifier », aperçu en vignette quand le look est prêt ;
 *  - F3 : second angle « même pièce, caméra à 30° sur le côté, regard vers l'interlocuteur » ;
 *  - F5 : prix provisoire dit « à confirmer sur le premier essai ».
 * HeyGen et le stockage doublés : aucun appel réseau réel, aucune clé.
 */
import { readFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { ValeurDecor } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const F = JSON.parse(readFileSync("tests/fixtures/r7-heygen-doubles.json", "utf8")) as Record<string, { data: Record<string, unknown> }>;
const GROUPE = "1c22241239ce4e8591d4d63a463e5c28";
const FILME = { ...F.lookTermine.data, id: "2f38750fb4204a0ba05058e96b6fd56d", name: "Motion Look", group_id: GROUPE };

const heygen = vi.hoisted(() => ({ requetes: [] as { methode: string; url: string; corps?: Record<string, unknown>; cle?: string }[], looks: [] as Record<string, unknown>[], n: 0 }));
const reseau = async (url: string, init?: RequestInit) => {
  const u = new URL(String(url));
  const methode = init?.method ?? "GET";
  const entetes = (init?.headers ?? {}) as Record<string, string>;
  const corps = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  heygen.requetes.push({ methode, url: `${u.hostname}${u.pathname}${u.search}`, corps, cle: entetes["Idempotency-Key"] });
  const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200 });
  if (u.hostname === "api.heygen.com" && methode === "POST" && u.pathname === "/v3/avatars") {
    const item = { id: `look_genere_${++heygen.n}`, name: corps?.name, status: "processing", group_id: corps?.avatar_group_id, supported_api_engines: [] };
    heygen.looks.push(item);
    return json({ data: { avatar_item: item, avatar_group: { id: corps?.avatar_group_id } } });
  }
  if (u.hostname === "api.heygen.com" && u.pathname === "/v3/avatars/looks") return json({ data: heygen.looks, has_more: false });
  if (u.hostname === "api.heygen.com" && u.pathname.startsWith("/v3/avatars/looks/")) {
    const l = heygen.looks.find((x) => x.id === decodeURIComponent(u.pathname.split("/").pop()!));
    return l ? json({ data: l }) : new Response("{}", { status: 404 });
  }
  if (u.hostname === "files2.heygen.ai") return new Response(new Uint8Array(32), { status: 200, headers: { "content-length": "32" } });
  if (methode === "PUT") return (await new Response(init?.body).arrayBuffer(), new Response("", { status: 200 }));
  return new Response("{}", { status: 404 });
};
vi.mock("@/fournisseurs/heygen/inscription", async () => {
  const { creerFournisseurVisageHeygen } = await import("@/fournisseurs/heygen/visage");
  const { creerClientHeygen } = await import("@/fournisseurs/heygen/client");
  const { stockageSimulation } = await import("@/fournisseurs/simulation/autres");
  const stockage = async () => ({ ...stockageSimulation, urlLectureDuree: async (cle: string, s: number) => `https://r2.exemple/${cle}?lecture=${s}`, urlDepotDuree: async (cle: string) => `https://r2.exemple/${cle}?depot` });
  const f = reseau as unknown as typeof fetch;
  const looksAllumes = async () => (await import("@/services/rendu-double")).looksStudioAllumes();
  return { visagesHeygen: () => ({ heygen: creerFournisseurVisageHeygen(creerClientHeygen({ cle: "cle-essai-reel2-f", fetch: f }), { stockage, fetch: f, resoudre: async () => ["203.0.113.10"], renduAvatarAutorise: true, looksAllumes }) }), voixHeygen: () => ({}) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const decors = await import("@/services/decors");
const doublesHeygen = await import("@/services/doubles-heygen");
const renduDouble = await import("@/services/rendu-double");
const { ecrireParametre } = await import("@/services/_commun");
const { MESSAGE_PRIX_LOOK_A_CONFIRMER, CENTIMES_USD_PAR_LOOK } = await import("@/domaine/decors");
const { DECORS_DANS_HEYGEN } = await import("@/fournisseurs/heygen/rendus");

const MDP = "essai-reel2-looks";
beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  heygen.requetes = [];
  heygen.looks = [{ ...FILME }];
  heygen.n = 0;
  await auth.seConnecter(MDP, false);
  const moi = (await depots().personnages.trouver((p) => p.nature === "moi"))!;
  await doublesHeygen.choisirDoubleHeygen(moi.id, { idExterne: FILME.id as string, angle: "trois-quarts", tenue: "Chemise noire" });
  await ecrireParametre("fournisseur.visage", "heygen");
  heygen.requetes = [];
});

const creations = () => heygen.requetes.filter((r) => r.methode === "POST" && r.url === "api.heygen.com/v3/avatars");
const PHRASE = "bureau moderne, costume bleu, debout";

describe("RÉEL 2 · F1 — « Créer vos décors avec HeyGen » : éteint par défaut", () => {
  it("ROUGE — éteint : la description est refusée en phrase simple, AUCUN appel de création", async () => {
    expect(await renduDouble.looksStudioAllumes()).toBe(false);
    const est = await decors.estimerDecorDepuisDescription(PHRASE);
    expect(est.bloque).toBe(DECORS_DANS_HEYGEN);
    await expect(decors.creerDecorDepuisDescription(PHRASE, { confirme: true })).rejects.toMatchObject({ code: "DECOR_DANS_HEYGEN" });
    expect(creations()).toEqual([]);
  });
});

describe("RÉEL 2 · F2, F3, F5 — un décor HeyGen depuis « Décrivez »", () => {
  beforeEach(async () => {
    await renduDouble.definirLooksStudio(true);
    heygen.requetes = [];
  });

  it("estimation : consigne anglaise (tenue, décor, tête-taille, 9:16), prix provisoire « à confirmer », rien de lancé", async () => {
    const est = await decors.estimerDecorDepuisDescription(PHRASE);
    expect(est.bloque).toBeUndefined();
    expect(est.angles).toEqual(["trois-quarts"]);
    expect(est.consigne).toMatch(/suit/);
    expect(est.consigne).toMatch(/blue/);
    expect(est.consigne).toMatch(/Standing, framed from head to waist/);
    expect(est.consigne).toMatch(/vertical 9:16/);
    expect(est.consigne).not.toMatch(/same outfit/);
    expect(est.cout.centimes).toBeGreaterThan(0);
    expect(est.prixAConfirmer).toBe(MESSAGE_PRIX_LOOK_A_CONFIRMER);
    expect(creations()).toEqual([]);
    expect(CENTIMES_USD_PAR_LOOK).toBe(100);
  });

  it("ROUGE — sans accord : refus « Confirmez d'abord le coût affiché », aucune création", async () => {
    await expect(decors.creerDecorDepuisDescription(PHRASE, { confirme: false })).rejects.toMatchObject({ code: "CONFIRMATION" });
    expect(creations()).toEqual([]);
  });

  it("avec accord et second angle : 2 looks dans le GROUPE de Will (référence : son look filmé), décor rangé à vérifier, dépense notée ; aperçu en vignette une fois prêt", async () => {
    const avant = await depots().depenses.compter();
    const r = await decors.creerDecorDepuisDescription(PHRASE, { confirme: true, deuxAngles: true });
    expect(r.crees.sort()).toEqual(["face", "trois-quarts"]);
    expect(creations()).toHaveLength(2);
    for (const c of creations()) expect(c.corps).toMatchObject({ type: "prompt", avatar_group_id: GROUPE, avatar_id: FILME.id, aspect_ratio: "9:16" });
    const consignes = creations().map((c) => String(c.corps!.prompt));
    expect(consignes.some((p) => /30 degrees to the side.*interlocutor off-camera/.test(p))).toBe(true);
    expect(consignes.some((p) => /facing the camera, eyes on the lens/.test(p))).toBe(true);
    const e = (await depots().elements.obtenir(r.decorId))!;
    const v = e.valeur as ValeurDecor;
    expect(v).toMatchObject({ methode: "look-heygen", statut: "a_verifier" });
    expect(Object.keys(v.lookIdParAngle ?? {}).sort()).toEqual(["face", "trois-quarts"]);
    expect(await depots().depenses.compter()).toBe(avant + 1);
    // HeyGen termine les looks : à l'ouverture de « Mes décors », l'aperçu devient la vignette (lecture gratuite).
    for (const l of heygen.looks) if (String(l.id).startsWith("look_genere_")) Object.assign(l, { status: "completed", supported_api_engines: ["avatar_v"], preview_image_url: "https://files2.heygen.ai/apercus/genere.jpg" });
    const n = creations().length;
    await decors.ecranDecors();
    expect(((await depots().elements.obtenir(r.decorId))!.valeur as ValeurDecor).vignetteDoubleFichierId).toBeTruthy();
    expect(creations()).toHaveLength(n);
  });
});
