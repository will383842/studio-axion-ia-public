/**
 * RES-4 : porte de l'usine /api/usine/tutoriels (+ /[cle]). Dépôts en mémoire, secrets d'essai, aucun réseau. Le tirage (RES-3)
 * est remplacé par un double qui rejoue par clé ; le stockage de la réserve (RES-1) est le vrai, sur un magasin local.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const magasin = new Map<string, unknown>();
vi.mock("@/services/_commun", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/services/_commun")>();
  return {
    ...reel,
    lireParametre: async (id: string, defaut: unknown) => (magasin.has(id) ? structuredClone(magasin.get(id)) : defaut),
    ecrireParametre: async (id: string, v: unknown) => void magasin.set(id, structuredClone(v)),
  };
});

import type { IssueTirage } from "@/domaine/tutoriel-reserve";
const tirage = vi.hoisted(() => ({ tirer: vi.fn() }));
vi.mock("@/services/tutoriel-reserve-tirage", () => ({ tirerSuivantReserve: tirage.tirer }));

const { reinitialiserGardePourEssai } = await import("@/usine/garde-porte");
const prise = await import("@/app/api/usine/tutoriels/route");
const suivi = await import("@/app/api/usine/tutoriels/[cle]/route");
const { ajouterElementReserve, prendreSuivantReserve, noterVideoDuTirage, changerEtatReserve } = await import("@/services/tutoriel-reserve");

const SECRET = "s".repeat(24) + "SECRET-ESSAI-porte-1234567";
const CLE = "usine-essai-0001";
function envoyer(corps: unknown, secret: string | null = SECRET): Promise<Response> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) h.authorization = `Bearer ${secret}`;
  return prise.POST(new NextRequest("http://studio.test/api/usine/tutoriels", { method: "POST", headers: h, body: JSON.stringify(corps) }));
}
function lire(cle: string, corps: unknown = { contrat: 2 }): Promise<Response> {
  const requete = new NextRequest(`http://studio.test/api/usine/tutoriels/${cle}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` }, body: JSON.stringify(corps) });
  return suivi.POST(requete, { params: Promise.resolve({ cle }) });
}
const demande = (extra: Record<string, unknown> = {}) => ({ contrat: 2, cle: CLE, source: "reserve", ...extra });
const nouveau = (id: string) => ({ id, titre: "TITRE-SECRET", source: { type: "dossier", fichierId: "f-1", nomFichier: "NOM-SECRET.zip", attestationImages: true } as const, fin: "aucune" as const, ajouteLe: "2026-11-01T00:00:00.000Z", ajoutePar: "fondateur" as const });

beforeEach(() => {
  magasin.clear();
  tirage.tirer.mockReset();
  reinitialiserGardePourEssai();
  vi.unstubAllEnvs();
  vi.stubEnv("STUDIO_PORTE_SECRET", SECRET);
  vi.stubEnv("USINE_PORTE_SECRET", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A", "");
  vi.stubEnv("USINE_TOUT_ARRETER", "");
});

describe("garde de la porte", () => {
  it("sans jeton 401 ; porte éteinte 404 ; rien n'est tiré", async () => {
    expect((await envoyer(demande(), null)).status).toBe(401);
    vi.stubEnv("STUDIO_PORTE_SECRET", "");
    expect((await envoyer(demande())).status).toBe(404);
    expect(tirage.tirer).not.toHaveBeenCalled();
  });
  it("champ inconnu 400 ; cle invalide 400 ; cle trop longue pour « usine-<cle> » 400", async () => {
    expect((await envoyer(demande({ extra: 1 }))).status).toBe(400);
    expect((await envoyer(demande({ cle: "court" }))).status).toBe(400);
    expect((await envoyer(demande({ cle: "a".repeat(95) }))).status).toBe(400);
    tirage.tirer.mockResolvedValue({ etat: "eteint" });
    expect((await envoyer(demande({ cle: "a".repeat(94) }))).status).toBe(200);
  });
  it("les deux sources, ou aucune, ou un id mal formé : 400", async () => {
    expect((await envoyer(demande({ reserveTutorielId: "res-abcdef12" }))).status).toBe(400);
    expect((await envoyer({ contrat: 2, cle: CLE })).status).toBe(400);
    expect((await envoyer({ contrat: 2, cle: CLE, reserveTutorielId: "../x" })).status).toBe(400);
    expect((await envoyer(demande({ source: "autre" }))).status).toBe(400);
    expect((await envoyer(demande({ jour: "2026-13-40" }))).status).toBe(400);
    expect((await envoyer(demande({ jour: "2026-02-30" }))).status).toBe(400);
    expect(tirage.tirer).not.toHaveBeenCalled();
  });
  it("tout arrêter : 423, rien n'est tiré", async () => {
    vi.stubEnv("USINE_TOUT_ARRETER", "1");
    const r = await envoyer(demande());
    expect(r.status).toBe(423);
    expect((await r.json()).code).toBe("tout_arrete");
    expect(tirage.tirer).not.toHaveBeenCalled();
  });
});

describe("prise", () => {
  it("le suivant : déclencheur usine, clé préfixée, aucun titre ni nom de fichier ni phrase dans la réponse", async () => {
    tirage.tirer.mockResolvedValue({ etat: "pris", deja: false, elementId: "res-abcdef12", videoId: "v-1", titre: "TITRE-SECRET" } satisfies IssueTirage);
    const r = await envoyer(demande());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ etat: "pris", deja: false, elementId: "res-abcdef12", videoId: "v-1" });
    expect(tirage.tirer).toHaveBeenCalledWith({ declencheur: "usine", cle: `usine-${CLE}` });
  });
  it("celui-ci : l'identifiant demandé est transmis", async () => {
    tirage.tirer.mockResolvedValue({ etat: "reserve_vide" });
    await envoyer({ contrat: 2, cle: CLE, reserveTutorielId: "demo-01-courriels" });
    expect(tirage.tirer).toHaveBeenCalledWith({ declencheur: "usine", cle: `usine-${CLE}`, elementId: "demo-01-courriels" });
  });
  it("rejeu de la même cle : deja true, même vidéo, un seul lancement", async () => {
    const lancements = vi.fn();
    const rendus = new Map<string, IssueTirage>();
    tirage.tirer.mockImplementation(async (d: { cle: string }) => {
      const connu = rendus.get(d.cle);
      if (connu && connu.etat === "pris") return { ...connu, deja: true };
      lancements();
      const issue: IssueTirage = { etat: "pris", deja: false, elementId: "res-abcdef12", videoId: "v-1", titre: "T" };
      rendus.set(d.cle, issue);
      return issue;
    });
    const a = await (await envoyer(demande())).json();
    const b = await (await envoyer(demande())).json();
    expect(a).toMatchObject({ deja: false, videoId: "v-1" });
    expect(b).toEqual({ etat: "pris", deja: true, elementId: "res-abcdef12", videoId: "v-1" });
    expect(lancements).toHaveBeenCalledTimes(1);
  });
  it("réserve vide : 200 reserve_vide, rien d'écrit (un rejeu plus tard peut prendre un élément)", async () => {
    tirage.tirer.mockResolvedValueOnce({ etat: "reserve_vide" });
    const r = await envoyer(demande());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ etat: "reserve_vide" });
    expect([...magasin.keys()].filter((k) => k.startsWith("tutoriel.reserve."))).toEqual([]);
    tirage.tirer.mockResolvedValueOnce({ etat: "pris", deja: false, elementId: "res-abcdef12", videoId: "v-2", titre: "T" });
    expect(await (await envoyer(demande())).json()).toMatchObject({ etat: "pris", videoId: "v-2" });
  });
  it("interrupteur éteint : 200 eteint", async () => {
    tirage.tirer.mockResolvedValue({ etat: "eteint" });
    const r = await envoyer(demande());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ etat: "eteint" });
  });
  it("attente : la raison seulement, sans la phrase ; échec rejoué : sans phrase", async () => {
    tirage.tirer.mockResolvedValueOnce({ etat: "attente", raison: "plafond_video", phrase: "PHRASE-SECRETE" });
    expect(await (await envoyer(demande())).json()).toEqual({ etat: "attente", raison: "plafond_video" });
    tirage.tirer.mockResolvedValueOnce({ etat: "echec", elementId: "res-abcdef12", phrase: "PHRASE-SECRETE", retourEnReserve: true });
    expect(await (await envoyer(demande())).json()).toEqual({ etat: "echec", elementId: "res-abcdef12", retourEnReserve: true });
  });
  it("panne du tirage : 500 sans détail", async () => {
    tirage.tirer.mockRejectedValue(new Error("DETAIL-SECRET"));
    const r = await envoyer(demande());
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("DETAIL-SECRET");
  });
});

describe("état d'un tirage", () => {
  it("clé inconnue : 404 ; sans jeton 401", async () => {
    expect((await lire("inconnue-0001")).status).toBe(404);
    expect((await lire("court")).status).toBe(404);
  });
  it("pris puis fait : aValider seulement quand la vidéo est prête ; ni titre ni nom de fichier", async () => {
    await ajouterElementReserve(nouveau("res-abcdef12"));
    const p = await prendreSuivantReserve({ cle: `usine-${CLE}`, declencheur: "usine" });
    expect(p && p !== "bail_occupe" && p !== "deja_en_cours").toBe(true);
    await noterVideoDuTirage(`usine-${CLE}`, "res-abcdef12", "v-9");
    const a = await lire(CLE);
    expect(a.status).toBe(200);
    expect(await a.json()).toEqual({ etat: "pris", elementId: "res-abcdef12", videoId: "v-9", aValider: false });
    await changerEtatReserve("res-abcdef12", "fait");
    const b = await (await lire(CLE)).text();
    expect(JSON.parse(b)).toEqual({ etat: "fait", elementId: "res-abcdef12", videoId: "v-9", aValider: true });
    expect(b).not.toContain("SECRET");
  });
  it("élément remis en réserve : en_reserve ; à revoir : a_revoir", async () => {
    await ajouterElementReserve(nouveau("res-abcdef12"));
    await prendreSuivantReserve({ cle: `usine-${CLE}`, declencheur: "usine" });
    await changerEtatReserve("res-abcdef12", "en_reserve");
    expect(await (await lire(CLE)).json()).toMatchObject({ etat: "en_reserve", aValider: false });
    await prendreSuivantReserve({ cle: `usine-${CLE}-bis`, declencheur: "usine" });
    await changerEtatReserve("res-abcdef12", "a_revoir");
    expect(await (await lire(CLE)).json()).toMatchObject({ etat: "a_revoir", aValider: false });
  });
});
