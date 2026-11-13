/** ATR-D · crochet : dépôt d'un événement `zernio.commentaire_manuel` (LinkedIn/TikTok), SANS texte. Données fictives, aucun envoi réel. */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signatureZernio } from "@/domaine/guide-reseau/crochet-zernio";

const port = vi.hoisted(() => ({ appels: 0 }));
vi.mock("@/fournisseurs/zernio-inbox", () => {
  port.appels++;
  return { creerPortInboxZernio: () => { port.appels++; throw new Error("port interdit"); } };
});

const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { PARAM_RESEAUX_MANUELS } = await import("@/services/a-traiter-manuel");

const SECRET = "secret-fictif-atr-d-crochet";
const ENV = { MOTS_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET };
const T = Date.parse("2026-10-18T10:00:10.000Z");
const TEXTE = "GUIDE";
const PHRASE_LIBRE = "GUIDE texte-libre-fictif-xyz";
let n = 0;

const corpsDe = (plateforme: string, o: { id?: string; idCom?: string; texte?: string } = {}) => {
  const c = JSON.parse(readFileSync(new URL("./fixtures/comment-received-forme-reelle.json", import.meta.url), "utf8"));
  n++;
  c.id = o.id ?? `evt_fictif_atrd_${n}`;
  c.account.platform = plateforme;
  c.comment.id = o.idCom ?? `com-fictif-atrd-${n}`;
  c.comment.text = o.texte ?? TEXTE;
  return c;
};
const envoyer = (c: unknown, env: Record<string, string | undefined> = ENV, t = T) => {
  const corps = Buffer.from(JSON.stringify(c));
  return pm.recevoirCrochetZernio({ corps, signature: signatureZernio(SECRET, corps) }, { env, maintenantMs: t });
};
const deposes = () => depots().evenementsFournisseurs.lister(() => true);

beforeEach(() => {
  reinitialiserDepots();
  for (const m of ["log", "error", "warn", "info"] as const) vi.spyOn(console, m).mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("constantes", () => {
  it("copies du crochet = constantes d'a-traiter-manuel", async () => {
    const m = await import("@/services/a-traiter-manuel");
    expect(pm.PARAM_RESEAUX_MANUELS_CROCHET).toBe(m.PARAM_RESEAUX_MANUELS);
    expect(pm.TYPE_COMMENTAIRE_MANUEL_CROCHET).toBe(m.TYPE_COMMENTAIRE_MANUEL);
  });
});

describe("réglage éteint (défaut) : aucun dépôt", () => {
  for (const reseau of ["linkedin", "tiktok"]) it(`${reseau} : réglage absent`, async () => {
    const r = await envoyer(corpsDe(reseau));
    expect(r).toEqual({ statut: 200, corps: { recu: true } });
    expect(await deposes()).toEqual([]);
  });
  for (const v of ["true", 1, "1", {}, null, false]) it(`linkedin : réglage ${JSON.stringify(v)} = éteint`, async () => {
    await Com.ecrireParametre(PARAM_RESEAUX_MANUELS, v);
    await envoyer(corpsDe("linkedin"));
    expect(await deposes()).toEqual([]);
  });
  it("réglage illisible (panne de lecture) : éteint", async () => {
    vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("base"));
    await envoyer(corpsDe("tiktok"));
    expect(await deposes()).toEqual([]);
  });
});

describe("réglage vrai", () => {
  beforeEach(async () => { await Com.ecrireParametre(PARAM_RESEAUX_MANUELS, true); });

  for (const [plateforme, reseau] of [["linkedin", "linkedin_page"], ["tiktok", "tiktok"]] as const) it(`${plateforme} : un événement déposé, charge sans texte`, async () => {
    const r = await envoyer(corpsDe(plateforme, { texte: PHRASE_LIBRE.replace(" texte-libre-fictif-xyz", "") }));
    expect(r).toEqual({ statut: 200, corps: { recu: true } });
    const l = await deposes();
    expect(l).toHaveLength(1);
    expect(l[0].type).toBe("zernio.commentaire_manuel");
    expect(l[0].traite).toBe(false);
    expect(l[0].charge).toMatchObject({ etat: "a_faire", reseau, motSeul: "GUIDE", proprio: false });
    expect(Object.keys(l[0].charge)).not.toContain("texte");
    expect(JSON.stringify(l[0])).not.toContain("texte-libre");
  });

  it("la charge ne contient pas le texte du commentaire (même long ou libre)", async () => {
    await envoyer(corpsDe("linkedin", { texte: "stop, merci beaucoup texte-libre-fictif-xyz" }));
    await envoyer(corpsDe("tiktok", { texte: "GUIDE" }));
    const brut = JSON.stringify(await deposes());
    expect(brut).not.toContain("texte-libre-fictif-xyz");
    expect(brut).not.toContain("merci beaucoup");
    for (const e of await deposes()) for (const v of Object.values(e.charge)) if (typeof v === "string") expect(v.length).toBeLessThanOrEqual(128 + 4);
  });

  it("même commentaire reçu deux fois (id d'événement différent) : un seul événement", async () => {
    await envoyer(corpsDe("linkedin", { id: "evt_a", idCom: "com-meme" }));
    await envoyer(corpsDe("linkedin", { id: "evt_b", idCom: "com-meme" }));
    expect(await deposes()).toHaveLength(1);
  });
  it("même id d'événement rejoué : un seul événement", async () => {
    const c = corpsDe("tiktok", { id: "evt_rejeu" });
    await envoyer(c);
    await envoyer(c);
    expect(await deposes()).toHaveLength(1);
  });
  it("sans mot seul : rien déposé", async () => {
    await envoyer(corpsDe("linkedin", { texte: "super article, bravo à toute l'équipe" }));
    expect(await deposes()).toEqual([]);
  });
  it("MOTS éteint : rien déposé même réglage vrai", async () => {
    await envoyer(corpsDe("linkedin"), { ...ENV, MOTS_ENABLED: "0" });
    expect(await deposes()).toEqual([]);
  });
});

describe("signature et rejeu inchangés", () => {
  beforeEach(async () => { await Com.ecrireParametre(PARAM_RESEAUX_MANUELS, true); });
  it("signature fausse : 401, rien déposé", async () => {
    const corps = Buffer.from(JSON.stringify(corpsDe("linkedin")));
    const r = await pm.recevoirCrochetZernio({ corps, signature: "sha256=faux" }, { env: ENV, maintenantMs: T });
    expect(r).toEqual({ statut: 401, corps: { erreur: "signature_refusee" } });
    expect(await deposes()).toEqual([]);
  });
  it("hors fenêtre anti-rejeu : 401, rien déposé", async () => {
    const r = await envoyer(corpsDe("tiktok"), ENV, T + 10 * 24 * 3600_000);
    expect(r).toEqual({ statut: 401, corps: { erreur: "signature_refusee" } });
    expect(await deposes()).toEqual([]);
  });
  it("en-tête d'id différent de l'id signé : 401", async () => {
    const corps = Buffer.from(JSON.stringify(corpsDe("linkedin")));
    const r = await pm.recevoirCrochetZernio({ corps, signature: signatureZernio(SECRET, corps), idEvenement: "autre" }, { env: ENV, maintenantMs: T });
    expect(r.statut).toBe(401);
    expect(await deposes()).toEqual([]);
  });
});

describe("Facebook et Instagram strictement identiques", () => {
  for (const allume of [false, true]) for (const plateforme of ["facebook", "instagram"]) it(`${plateforme}, réglage ${allume ? "vrai" : "absent"} : événement zernio.commentaire habituel`, async () => {
    if (allume) await Com.ecrireParametre(PARAM_RESEAUX_MANUELS, true);
    await envoyer(corpsDe(plateforme));
    const l = await deposes();
    expect(l).toHaveLength(1);
    expect(l[0].type).toBe("zernio.commentaire");
    expect(l[0].charge).toMatchObject({ etat: "a_faire", motSeul: "GUIDE" });
  });
  it("Facebook : la charge est la même réglage éteint ou vrai", async () => {
    const c = corpsDe("facebook", { id: "evt_fb", idCom: "com-fb" });
    await envoyer(c);
    const a = (await deposes())[0].charge;
    reinitialiserDepots();
    await Com.ecrireParametre(PARAM_RESEAUX_MANUELS, true);
    await envoyer(c);
    expect((await deposes())[0].charge).toEqual(a);
  });
});

describe("aucun appel au port d'envoi", () => {
  it("jamais, quel que soit le réseau", async () => {
    await Com.ecrireParametre(PARAM_RESEAUX_MANUELS, true);
    for (const p of ["linkedin", "tiktok", "facebook", "instagram"]) await envoyer(corpsDe(p));
    expect(port.appels).toBe(0);
  });
});
