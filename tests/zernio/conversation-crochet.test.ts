/**
 * Lot 3a · crochet : garde isOwnAccount, platformPostId, dépôt des messages sans texte. Données 100 % fictives.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signatureZernio } from "@/domaine/guide-reseau/crochet-zernio";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");

const SECRET = "secret-fictif-crochet-conversation";
const T0 = Date.parse("2026-10-18T10:00:10.000Z");
const ENV = { MOTS_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET };
const fixture = (): Record<string, any> => JSON.parse(readFileSync(new URL("./fixtures/comment-received-forme-reelle.json", import.meta.url), "utf8"));

async function envoyer(o: unknown) {
  const corps = Buffer.from(JSON.stringify(o));
  return pm.recevoirCrochetZernio({ corps, signature: signatureZernio(SECRET, corps) }, { env: ENV, maintenantMs: T0 });
}
const deposes = () => depots().evenementsFournisseurs.lister(() => true);

beforeEach(() => reinitialiserDepots());

describe("crochet · commentaire", () => {
  it("1 · isOwnAccount=true avec author.id différent du compte : 200 sans dépôt", async () => {
    const o = fixture();
    o.comment.author.isOwnAccount = true;
    expect(o.comment.author.id).not.toBe(o.account.accountId);
    expect((await envoyer(o)).statut).toBe(200);
    expect(await deposes()).toHaveLength(0);
  });
  it("forme réelle autorisée : dépôt, avec proprio=false", async () => {
    expect((await envoyer(fixture())).statut).toBe(200);
    const l = await deposes();
    expect(l).toHaveLength(1);
    expect(l[0].charge).toMatchObject({ proprio: false, motSeul: "GUIDE", idCommentaire: "com-fictif-300", idAuteur: "auteur-fictif-400", etat: "a_faire" });
  });
  it("3 · commentaire qui n'est ni GUIDE ni opposition : aucun dépôt", async () => {
    const o = fixture();
    o.comment.text = "super vidéo, merci beaucoup";
    expect((await envoyer(o)).statut).toBe(200);
    expect(await deposes()).toHaveLength(0);
  });
  it("4 · l'identifiant du post est platformPostId (postId est vide)", async () => {
    await envoyer(fixture());
    const l = await deposes();
    expect(l[0].charge.idPostPlateforme).toBe("post-plateforme-fictif-200");
  });
  it("4 bis · platformPostId prime sur un postId non vide", async () => {
    const o = fixture();
    o.comment.postId = "post-interne-ne-pas-utiliser";
    await envoyer(o);
    expect((await deposes())[0].charge.idPostPlateforme).toBe("post-plateforme-fictif-200");
  });
});

describe("crochet · message sans bouton", () => {
  const message = (extra: Record<string, unknown> = {}, expediteur = "personne-fictive-500") => ({
    id: "evt_fictif_msg_0001",
    event: "message.received",
    timestamp: "2026-10-18T10:00:00.000Z",
    account: { accountId: "compte-fictif-100", platform: "instagram" },
    message: { id: "msg-fictif-600", conversationId: "conv-fictive-700", text: "ceci est un texte brut de test", sender: { id: expediteur }, ...extra },
  });
  it("déposé avec identifiants seulement, jamais le texte", async () => {
    await envoyer(message({ createdAt: "2026-10-18T09:59:59.000Z" }));
    const l = await deposes();
    expect(l).toHaveLength(1);
    expect(l[0].type).toBe("zernio.message");
    expect(l[0].charge).toMatchObject({ idMessage: "msg-fictif-600", idConversation: "conv-fictive-700", idCompte: "compte-fictif-100", idExpediteur: "personne-fictive-500", occurredAt: "2026-10-18T09:59:59.000Z", etat: "a_faire" });
    expect(JSON.stringify(l)).not.toContain("texte brut");
  });
  it("écho de notre compte (expéditeur = compte) : aucun dépôt", async () => {
    await envoyer(message({}, "compte-fictif-100"));
    expect(await deposes()).toHaveLength(0);
  });
  it("horodatage hors bornes ou illisible : champ absent, message quand même déposé", async () => {
    await envoyer(message({ createdAt: "pas une date" }));
    const c = (await deposes())[0].charge;
    expect(c.occurredAt).toBeUndefined();
  });
});
