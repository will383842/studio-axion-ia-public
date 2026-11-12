/**
 * LOT Z1 — corps v3 de la demande de guide (parcours conversation). Interrupteur ORIGINE_V3_ENABLED éteint par défaut :
 * corps v1 identique octet pour octet. Données 100 % fictives (adresse@exemple.test).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SchemaDemandeGuideReseau, SchemaDemandeGuideReseauV3 } from "../aides/contrat-site-guides-reseau";
import { deposerCommentaire, deposerMessage } from "../aides/conversation";
import { ADRESSE, banc, COMPTE, ENV, C, depots, nettoyer, pm, passer, preparer, T0, toutLeStockage, lireTexteDe } from "./_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
beforeEach(preparer);
afterEach(nettoyer);

const V3 = { ...ENV, ORIGINE_V3_ENABLED: "1", ORIGINE_V3_PREFIXES_COMPTES: "/compte-test/", ORIGINE_V3_COMPTES: COMPTE };

async function parcours(env: Record<string, string | undefined>, idPost?: string): Promise<void> {
  await deposerCommentaire(depots, { reseau: "facebook", idCommentaire: "com-fictif-z1", ...(idPost ? { idPost } : {}) });
  await passer(T0, { env });
  lireTexteDe(`Voici mon adresse : ${ADRESSE}`);
  await deposerMessage(depots, { occurredAt: "2026-10-18T10:00:20.000Z" });
  await passer(T0 + 1000, { env });
}
const journal = async (): Promise<string> => (await depots().evenements.lister(() => true)).map((e: any) => e.message).join("\n");

describe("Z1 · corps v3 de la demande de guide", () => {
  it("interrupteur éteint : corps v1, mêmes octets avec ou sans préfixes configurés", async () => {
    await parcours(ENV);
    const ref = banc.site.vus[0].corps;
    expect(JSON.parse(ref).schemaVersion).toBe(1);
    expect(SchemaDemandeGuideReseau.safeParse(JSON.parse(ref)).success).toBe(true);
    nettoyer();
    await preparer();
    await parcours({ ...ENV, ORIGINE_V3_PREFIXES_COMPTES: "/compte-test/" });
    expect(Buffer.from(banc.site.vus[0].corps).equals(Buffer.from(ref))).toBe(true);
  });

  it("interrupteur allumé et compte configuré : corps v3 complet, accepté par le schéma du site", async () => {
    await parcours(V3);
    expect(banc.site.vus).toHaveLength(1);
    const j = JSON.parse(banc.site.vus[0].corps);
    expect(j.schemaVersion).toBe(3);
    expect(Object.keys(j)).toEqual(["schemaVersion", "cleIdempotence", "email", "mot", "reseau", "guide", "versionTexteM1", "locale", "occurredAt", "post_ref", "canal"]);
    expect(j).toMatchObject({ mot: "GUIDE", reseau: "facebook", versionTexteM1: "mp-m1-v2", occurredAt: "2026-10-18T10:00:20.000Z", canal: "commentaire" });
    expect(j.post_ref).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
    expect(SchemaDemandeGuideReseauV3.safeParse(j).success).toBe(true);
  });

  it("interrupteur allumé mais aucun préfixe de compte : corps v1", async () => {
    await parcours({ ...V3, ORIGINE_V3_PREFIXES_COMPTES: undefined });
    expect(JSON.parse(banc.site.vus[0].corps).schemaVersion).toBe(1);
  });

  it("référence de publication invalide : corps v1, journal avec le code sans la valeur ni l'adresse", async () => {
    await parcours(V3, "valeur-refusee!");
    expect(JSON.parse(banc.site.vus[0].corps).schemaVersion).toBe(1);
    const j = await journal();
    expect(j).toContain("post_ref_invalide");
    expect(j).not.toContain("valeur-refusee");
    expect(j).not.toContain(ADRESSE);
  });

  it("aucune adresse dans le journal ni dans le stockage en v3", async () => {
    await parcours(V3);
    expect(await journal()).not.toContain(ADRESSE);
    expect(await toutLeStockage()).not.toContain(ADRESSE);
  });

  it("un 422 du site sur le corps v3 : reprise immédiate en corps v1, même clé, sans refus définitif", async () => {
    let n = 0;
    banc.site.reponses = () => (++n === 1 ? { statut: 422, corps: { erreur: "schema_invalide" } } : { statut: 200, corps: {} });
    await parcours(V3);
    expect(banc.site.vus).toHaveLength(2);
    const [a, b] = banc.site.vus.map((v) => JSON.parse(v.corps));
    expect([a.schemaVersion, b.schemaVersion]).toEqual([3, 1]);
    expect(b.cleIdempotence).toBe(a.cleIdempotence);
    expect(Object.keys(b)).toEqual(["schemaVersion", "cleIdempotence", "email", "mot", "reseau", "guide", "versionTexteM1", "locale", "occurredAt"]);
    expect(await journal()).not.toContain("site_refuse");
  });

  it("un 422 sur le corps v1 reste un refus définitif (comportement inchangé)", async () => {
    banc.site.reponses = () => ({ statut: 422, corps: { erreur: "schema_invalide" } });
    await parcours(ENV);
    expect(banc.site.vus).toHaveLength(1);
  });
});

describe("Z1 · version du corps figée (D1, D2, D3)", () => {
  it("D3 : compte de la conversation non listé : corps v1", async () => {
    await parcours({ ...V3, ORIGINE_V3_COMPTES: "autre-compte-fictif" });
    expect(JSON.parse(banc.site.vus[0].corps).schemaVersion).toBe(1);
  });
  it("D3 : liste des comptes absente : corps v1 (éteinte par défaut)", async () => {
    await parcours({ ...V3, ORIGINE_V3_COMPTES: undefined });
    expect(JSON.parse(banc.site.vus[0].corps).schemaVersion).toBe(1);
  });
  it("D3 : compte listé parmi d'autres (espaces tolérés) : corps v3", async () => {
    await parcours({ ...V3, ORIGINE_V3_COMPTES: ` autre-compte-fictif , ${COMPTE} ` });
    expect(JSON.parse(banc.site.vus[0].corps).schemaVersion).toBe(3);
  });
  it("D1 : interrupteur allumé entre deux essais : mêmes octets que le premier essai (v1 figé)", async () => {
    let n = 0;
    banc.site.reponses = () => (++n === 1 ? { statut: 503, corps: {} } : { statut: 200, corps: {} });
    await parcours(ENV);
    await passer(T0 + 3_600_000, { env: V3 });
    await passer(T0 + 7_200_000, { env: V3 });
    expect(banc.site.vus.length).toBeGreaterThanOrEqual(2);
    for (const v of banc.site.vus) expect(Buffer.from(v.corps).equals(Buffer.from(banc.site.vus[0].corps))).toBe(true);
    expect(JSON.parse(banc.site.vus[0].corps).schemaVersion).toBe(1);
  });
  it("D1 : v3 choisi au premier essai reste v3 si l'interrupteur s'éteint ensuite", async () => {
    let n = 0;
    banc.site.reponses = () => (++n === 1 ? { statut: 503, corps: {} } : { statut: 200, corps: {} });
    await parcours(V3);
    await passer(T0 + 3_600_000, { env: ENV });
    await passer(T0 + 7_200_000, { env: ENV });
    expect(banc.site.vus.length).toBeGreaterThanOrEqual(2);
    for (const v of banc.site.vus) expect(JSON.parse(v.corps).schemaVersion).toBe(3);
  });
  it("D2 : 422 au 3e essai du corps v3 : le corps v1 est quand même essayé", async () => {
    const statuts = [{ statut: 409, corps: { erreur: "nonce_reutilise" } }, { statut: 409, corps: { erreur: "nonce_reutilise" } }, { statut: 422, corps: { erreur: "schema_invalide" } }];
    let n = 0;
    banc.site.reponses = () => statuts[n++] ?? { statut: 200, corps: {} };
    await parcours(V3);
    const versions = banc.site.vus.map((v) => JSON.parse(v.corps).schemaVersion);
    expect(versions.at(-1)).toBe(1);
    expect(versions).toContain(3);
    expect(await journal()).not.toContain("site_refuse");
  });
  it("D2 : après le repli v1, les essais suivants restent en v1 même interrupteur allumé", async () => {
    let n = 0;
    banc.site.reponses = () => (++n === 1 ? { statut: 422, corps: {} } : n === 2 ? { statut: 503, corps: {} } : { statut: 200, corps: {} });
    await parcours(V3);
    await passer(T0 + 3_600_000, { env: V3 });
    await passer(T0 + 7_200_000, { env: V3 });
    expect(banc.site.vus.slice(1).every((v) => JSON.parse(v.corps).schemaVersion === 1)).toBe(true);
  });
});
void C; void pm;
