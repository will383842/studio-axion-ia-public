/**
 * FILET GUIDE · 3 — corps envoyé au site : schemaVersion 1, champs exacts (figés par instantané nommé), jamais d'adresse stockée.
 * Tests de caractérisation. Données fictives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SchemaDemandeGuideReseau } from "../aides/contrat-site-guides-reseau";
import { deposerCommentaire, deposerMessage } from "../aides/conversation";
import { ADRESSE, banc, C, crochetCommentaire, depots, nettoyer, pm, passer, preparer, T0, toutesLesConversations, toutLeStockage, lireTexteDe } from "./_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

beforeEach(preparer);
afterEach(nettoyer);

async function parcoursJusquAuSite(): Promise<void> {
  await crochetCommentaire("GUIDE", { reseau: "facebook" });
  await passer();
  lireTexteDe(`Voici mon adresse : ${ADRESSE}`);
  await deposerMessage(depots, { occurredAt: "2026-10-18T10:00:20.000Z" });
  await passer(T0 + 1000);
}

describe("3 · corps de la demande de guide envoyée au site", () => {
  it("un seul appel, POST sur la route des demandes de guide, signé", async () => {
    await parcoursJusquAuSite();
    expect(banc.site.vus).toHaveLength(1);
    const r = banc.site.vus[0];
    expect(r.methode).toBe("POST");
    expect(r.chemin).toBe(pm.CHEMIN_DEMANDES_GUIDE);
    expect(r.chemin).toBe("/api/interne/demandes-guide-reseau");
    expect(Object.keys(r.entetes).sort()).toEqual(["x-axion-horodatage", "x-axion-nonce", "x-axion-signature"].sort());
  });

  it("schemaVersion 1 et liste EXACTE des champs, dans cet ordre", async () => {
    await parcoursJusquAuSite();
    const corps = JSON.parse(banc.site.vus[0].corps);
    expect(corps.schemaVersion).toBe(1);
    expect(Object.keys(corps)).toEqual(["schemaVersion", "cleIdempotence", "email", "mot", "reseau", "guide", "versionTexteM1", "locale", "occurredAt"]);
    expect(corps).toMatchObject({ email: ADRESSE, mot: "GUIDE", reseau: "facebook", guide: "guide-ia", versionTexteM1: "mp-m1-v2", locale: "fr", occurredAt: "2026-10-18T10:00:20.000Z" });
    expect(corps).not.toHaveProperty("accord");
    expect(corps).not.toHaveProperty("versionTexteM2");
  });

  it("INSTANTANÉ NOMMÉ « corps-demande-guide-v1 » : forme complète du corps (clé d'idempotence déterministe sous le secret fictif)", async () => {
    await parcoursJusquAuSite();
    expect(JSON.parse(banc.site.vus[0].corps)).toMatchSnapshot("corps-demande-guide-v1");
  });

  it("le corps est accepté par la copie du schéma strict du site", async () => {
    await parcoursJusquAuSite();
    expect(SchemaDemandeGuideReseau.safeParse(JSON.parse(banc.site.vus[0].corps)).success).toBe(true);
  });

  it("la clé d'idempotence envoyée est celle stockée dans l'état (64 hexadécimaux), jamais recalculée", async () => {
    await parcoursJusquAuSite();
    const e: any = Object.values(await toutesLesConversations())[0];
    expect(e.cleIdempotenceGuide).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(banc.site.vus[0].corps).cleIdempotence).toBe(e.cleIdempotenceGuide);
  });

  it("l'adresse n'est JAMAIS stockée : ni dans l'état, ni dans les événements, ni dans le journal, ni dans aucun dépôt", async () => {
    await parcoursJusquAuSite();
    expect(banc.site.vus).toHaveLength(1);
    const stock = await toutLeStockage();
    expect(stock).not.toContain(ADRESSE);
    expect(stock).not.toContain("exemple.test");
    expect(stock).not.toContain("@");
    expect(JSON.stringify(await toutesLesConversations())).not.toContain("@");
  });

  it("l'état ne porte que des champs opaques : aucun champ « email » / « adresse » / « texte »", async () => {
    await parcoursJusquAuSite();
    const e: any = Object.values(await toutesLesConversations())[0];
    for (const k of Object.keys(e)) expect(k).not.toMatch(/mail|texte(?!M)|pseudo|nom|^adresse/i);
  });

  it("(contrôle) un commentaire déposé directement (hors crochet) donne le même corps pour le même parcours", async () => {
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { occurredAt: "2026-10-18T10:00:20.000Z" });
    await passer(T0 + 1000);
    expect(JSON.parse(banc.site.vus[0].corps)).toMatchObject({ schemaVersion: 1, email: ADRESSE, reseau: "facebook", guide: "guide-ia" });
    expect(C.PARAM_CONVERSATIONS).toBe("parcours.conversations");
  });
});
