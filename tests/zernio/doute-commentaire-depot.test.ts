/**
 * PR B · B1/B13 : le crochet DÉPOSE un commentaire en doute d'opposition (charge sans texte), y compris en réponse ; rien sans auteur ;
 * rejeu = un seul événement. Données 100 % fictives, aucun réseau.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signatureZernio, lireEvenementCommentaire, type EnveloppeZernio } from "@/domaine/guide-reseau/crochet-zernio";
import { lireCommentaireManuel } from "@/domaine/guide-reseau/commentaire-manuel";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const { PARAM_RESEAUX_MANUELS } = await import("@/services/a-traiter-manuel");

const SECRET = "secret-fictif-crochet-doute";
const T = Date.parse("2026-10-18T10:00:10.000Z");
const ENV = { MOTS_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET };
const fixture = (): Record<string, any> => JSON.parse(readFileSync(new URL("./fixtures/comment-received-forme-reelle.json", import.meta.url), "utf8"));
const envoyer = (o: unknown) => {
  const corps = Buffer.from(JSON.stringify(o));
  return pm.recevoirCrochetZernio({ corps, signature: signatureZernio(SECRET, corps) }, { env: ENV, maintenantMs: T });
};
const deposes = () => depots().evenementsFournisseurs.lister(() => true);
const doute = (o: Record<string, any> = {}, texte = "stop pls") => {
  const x = fixture();
  x.comment.text = texte;
  return Object.assign(x, o);
};

beforeEach(() => reinitialiserDepots());

describe("B1 · dépôt d'un doute (Facebook / Instagram)", () => {
  it("« stop pls » : un événement, doute: true, motSeul null, aucun texte", async () => {
    await envoyer(doute());
    const l = await deposes();
    expect(l).toHaveLength(1);
    expect(l[0].type).toBe("zernio.commentaire");
    expect(l[0].charge).toMatchObject({ doute: true, motSeul: null, etat: "a_faire", idAuteur: "auteur-fictif-400" });
    const brut = JSON.stringify(l[0]).toLowerCase();
    expect(brut).not.toContain("pls");
    expect(brut).not.toContain("stop");
  });
  it("écrit EN RÉPONSE à un autre commentaire : déposé aussi", async () => {
    const x = doute();
    x.comment.parentId = "com-parent-fictif";
    await envoyer(x);
    const l = await deposes();
    expect(l).toHaveLength(1);
    expect(l[0].charge).toMatchObject({ doute: true, motSeul: null, estReponse: true });
  });
  it("sans auteur : rien déposé", async () => {
    const x = doute();
    delete x.comment.author;
    await envoyer(x);
    expect(await deposes()).toHaveLength(0);
  });
  it("auteur = notre compte : rien déposé", async () => {
    const x = doute();
    x.comment.author.id = x.account.accountId;
    await envoyer(x);
    expect(await deposes()).toHaveLength(0);
  });
  it("rejeu (même id d'événement) : un seul événement", async () => {
    const x = doute();
    await envoyer(x);
    await envoyer(x);
    expect(await deposes()).toHaveLength(1);
  });
  it("même idCommentaire sous un autre id d'événement : un seul événement", async () => {
    await envoyer(doute({ id: "evt_a" }));
    await envoyer(doute({ id: "evt_b" }));
    expect(await deposes()).toHaveLength(1);
  });
  it("un texte sans doute ni mot seul : toujours rien", async () => {
    await envoyer(doute({}, "super vidéo, merci"));
    expect(await deposes()).toHaveLength(0);
  });
  it("un mot seul clair : la charge n'a PAS de champ doute", async () => {
    await envoyer(doute({}, "GUIDE"));
    expect("doute" in (await deposes())[0].charge).toBe(false);
  });
});

describe("B1 · dépôt d'un doute (LinkedIn / TikTok)", () => {
  beforeEach(async () => { await Com.ecrireParametre(PARAM_RESEAUX_MANUELS, true); });
  const manuel = (plateforme: string, texte = "stop pls", c: object = {}) => ({
    id: `evt_m_${plateforme}`, event: "comment.received", timestamp: "2026-10-18T10:00:00.000Z",
    account: { accountId: "compte-fictif-100", platform: plateforme },
    comment: { id: "com-man-1", platformPostId: "post-plateforme-fictif-200", text: texte, author: { id: "auteur-fictif-400" }, ...c },
  });
  it.each(["linkedin", "tiktok"])("%s : doute déposé, sans texte", async (p) => {
    await envoyer(manuel(p));
    const l = await deposes();
    expect(l).toHaveLength(1);
    expect(l[0].type).toBe("zernio.commentaire_manuel");
    expect(l[0].charge).toMatchObject({ doute: true, motSeul: null, etat: "a_faire" });
    expect(JSON.stringify(l[0]).toLowerCase()).not.toContain("pls");
  });
  it.each(["linkedin", "tiktok"])("%s : doute en réponse déposé aussi", async (p) => {
    await envoyer(manuel(p, "stop pls", { parentId: "parent" }));
    expect(await deposes()).toHaveLength(1);
  });
  it.each(["linkedin", "tiktok"])("%s : doute SANS auteur → rien déposé", async (p) => {
    await envoyer(manuel(p, "stop pls", { author: undefined }));
    expect(await deposes()).toHaveLength(0);
  });
});

describe("B13 · texte long classé « opposition » : doute posé (lecteurs purs)", () => {
  const env = (plateforme: string, text: string): EnveloppeZernio => ({
    id: "evt_1", event: "comment.received", timestampSec: 1_760_781_600,
    racine: { account: { accountId: "acc_1", platform: plateforme }, comment: { id: "com_1", platformPostId: "post_1", text, author: { id: "auteur_1" } } },
  });
  const LONG_STOP = "STOP " + "😀".repeat(210);
  it.each(["facebook", "instagram"])("%s : STOP + plus de 200 émojis → doute", (p) => {
    const ev = lireEvenementCommentaire(env(p, LONG_STOP), ["GUIDE"])!;
    expect(ev.motSeul).toBeNull();
    expect((ev as { doute?: true }).doute).toBe(true);
  });
  it.each(["linkedin", "tiktok"])("%s : STOP + plus de 200 émojis → doute", (p) => {
    const ev = lireCommentaireManuel(env(p, LONG_STOP), ["GUIDE"])!;
    expect(ev.motSeul).toBeNull();
    expect((ev as { doute?: true }).doute).toBe(true);
  });
  it("notre propre compte : jamais de doute", () => {
    const e = env("facebook", LONG_STOP);
    (e.racine.comment as any).author = { id: "acc_1" };
    expect("doute" in lireEvenementCommentaire(e, ["GUIDE"])!).toBe(false);
  });
});
