/** COR-PV2 : corps validé contre une COPIE du schéma du site (sans champ « accord » depuis le 03/11/2026), octets bruts, secret dédié, plafonds, disjoncteur. Sans réseau, secrets FICTIFS. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { corpsDemandeGuide, runValide, signatureZernio, verifierSignatureZernio, ATTENTES_INTROUVABLE_MS, EN_COURS_MAX, ESSAIS_MAX, LOT_MAX_PAR_PASSAGE, DISJONCTEUR_SEUIL, DISJONCTEUR_PAUSE_MS, type RunLu } from "@/domaine/guide-reseau/crochet-zernio";
import type { RequeteSignee, ReponseSite } from "@/fournisseurs/site/types";
import { SchemaDemandeGuideReseau } from "./aides/contrat-site-guides-reseau";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");

const SECRET_CROCHET = "secret-fictif-crochet-cor";
const SECRET_SITE = "secret-fictif-site-cor-0123456789abcd";
const SECRET_REPLI = "secret-fictif-repli-cor-0123456789abc";
const T0 = 1_760_781_600_000;
const ENV = { PARCOURS_MOT_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET_CROCHET, SITE_VIDEOS_URL: "https://site.exemple", SITE_GUIDES_RESEAU_SECRET: SECRET_SITE };
const RUN: RunLu = { email: "lecteur-fictif@example.com", mot: "guide", reseau: "instagram", guide: "guide-ia", versionTexteM1: "m1-v1" };

function crochet(id: string, idRun: string) {
  const corps = Buffer.from(JSON.stringify({ id, event: "workflow.run.completed", timestamp: new Date(T0).toISOString(), execution: { id: idRun, status: "completed" }, contact: { id: "ct_1" }, trigger: { type: "keyword", text: "GUIDE" } }), "utf8");
  return { corps, idEvenement: id, signature: signatureZernio(SECRET_CROCHET, corps) };
}
const outbox = () => depots().evenementsFournisseurs.lister((e) => e.fournisseur === "zernio");
function site(reponses: (ReponseSite | "panne")[]) {
  const vues: RequeteSignee[] = [];
  pm.injecterTransportSite(async (r) => {
    vues.push(r);
    const x = reponses[Math.min(vues.length - 1, reponses.length - 1)];
    if (x === "panne") throw new Error("réseau coupé");
    return x;
  });
  return vues;
}
const passer = (t: number, env: Record<string, string | undefined> = ENV) => pm.traiterOutboxZernio({ env, maintenantMs: t });

beforeEach(() => {
  reinitialiserDepots();
  pm.reinitialiserGardesParcours();
  for (const m of ["log", "error", "warn", "info"] as const) vi.spyOn(console, m).mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterLecteurRuns(null);
  pm.injecterTransportSite(null);
});

describe("BLOQUANT 1 — corps sans champ « accord », accepté par le schéma strict du site (copie)", () => {
  it("le corps figé passe le schéma du site, sans accord ni versionTexteM2", () => {
    expect(runValide(RUN)).toBe(true);
    const o = JSON.parse(corpsDemandeGuide(RUN, "run_exemple_0001"));
    expect(o).not.toHaveProperty("accord");
    expect(o).not.toHaveProperty("versionTexteM2");
    expect(SchemaDemandeGuideReseau.safeParse(o).success).toBe(true);
  });
  it("position de clé fixe : occurredAt en dernier ; mêmes octets à chaque appel", () => {
    const run = { ...RUN, occurredAt: "2026-11-01T10:00:00Z" };
    const a = corpsDemandeGuide(run, "run_exemple_0001");
    expect(a).toBe(corpsDemandeGuide({ ...run }, "run_exemple_0001"));
    expect(Object.keys(JSON.parse(a))).toEqual(["schemaVersion", "cleIdempotence", "email", "mot", "reseau", "guide", "versionTexteM1", "locale", "occurredAt"]);
  });
  it("de bout en bout : la demande est envoyée sans accord et le site (copie) l'accepte", async () => {
    await pm.recevoirCrochetZernio(crochet("evt_o", "run_exemple_0001"), { env: ENV, maintenantMs: T0 });
    const vues = site([{ statut: 200, corps: {} }]);
    pm.injecterLecteurRuns(async () => ({ ...RUN, occurredAt: "2026-11-01T10:00:00Z" }));
    expect((await passer(T0)).envoyes).toBe(1);
    expect(SchemaDemandeGuideReseau.safeParse(JSON.parse(vues[0].corps)).success).toBe(true);
  });
});

describe("MINEUR (f) — runValide aligné sur le site", () => {
  it.each([
    ["guide hors forme", { guide: "Guide_IA" }],
    ["guide inconnu (liste fermée)", { guide: "guide-inconnu" }],
    ["guide trop long", { guide: "a".repeat(41) }],
    ["versionTexteM1 hors forme", { versionTexteM1: "m1 v1" }],
    ["versionTexteM1 trop courte", { versionTexteM1: "m1" }],
    ["occurredAt invalide", { occurredAt: "hier" }],
    ["locale inconnue", { locale: "de" }],
  ])("%s : refusé localement", (_n, patch) => {
    expect(runValide({ ...RUN, ...patch })).toBe(false);
  });
});

describe("MINEUR (a) — octets bruts", () => {
  const racine = (extra: Buffer = Buffer.alloc(0)) => Buffer.concat([Buffer.from(`{"id":"e","event":"workflow.run.completed","timestamp":"${new Date(T0).toISOString()}","execution":{"id":"r","status":"completed"}}`), extra]);
  it("la signature se calcule sur les octets : un corps non UTF-8 valide est vérifié sur le Buffer", () => {
    const corps = racine(Buffer.from([0xff, 0xfe]));
    const signature = signatureZernio(SECRET_CROCHET, corps);
    expect(verifierSignatureZernio({ secret: SECRET_CROCHET, corps, signature })).toBe("ok");
    // La même chose passée par un texte décodé (U+FFFD) ne signe pas pareil.
    expect(verifierSignatureZernio({ secret: SECRET_CROCHET, corps: corps.toString("utf8"), signature })).toBe("invalide");
  });
  it("un BOM en tête est signé octet pour octet", async () => {
    const corps = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), racine()]);
    const r = await pm.recevoirCrochetZernio({ corps, idEvenement: "e1", signature: signatureZernio(SECRET_CROCHET, corps) }, { env: ENV, maintenantMs: T0 });
    expect(r.statut).toBe(422); // signature valide (sinon 401) ; JSON avec BOM refusé comme charge inconnue
  });
  it("la route lit en octets plafonnés : corps trop gros sans content-length → 413", async () => {
    const { POST } = await import("@/app/api/crochets/zernio/route");
    vi.stubEnv("PARCOURS_MOT_ENABLED", "1");
    vi.stubEnv("ZERNIO_WEBHOOK_SECRET", SECRET_CROCHET);
    const flux = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(10 * 1024)); c.enqueue(new Uint8Array(10 * 1024)); c.close(); } });
    const req = new Request("http://localhost/api/crochets/zernio", { method: "POST", body: flux, duplex: "half" } as RequestInit);
    req.headers.delete("content-length");
    const rep = await POST(req as never);
    expect(rep.status).toBe(413);
    vi.unstubAllEnvs();
  });
});

describe("MINEUR (b) — secret dédié du site, sans repli", () => {
  const signeAvec = async (env: Record<string, string | undefined>) => {
    await pm.recevoirCrochetZernio(crochet("evt_s", "run_exemple_0001"), { env: ENV, maintenantMs: T0 });
    const vues = site([{ statut: 200, corps: {} }]);
    pm.injecterLecteurRuns(async () => ({ ...RUN }));
    await passer(T0, env);
    return vues[0];
  };
  it("la variable dédiée prime sur le repli", async () => {
    const { signatureValide } = await import("@/fournisseurs/site/signature");
    const q = await signeAvec({ ...ENV, SITE_VIDEOS_SECRET: SECRET_REPLI });
    const e = { methode: "POST" as const, chemin: q.chemin, corps: q.corps, horodatage: q.entetes["x-axion-horodatage"], nonce: q.entetes["x-axion-nonce"], signature: q.entetes["x-axion-signature"] };
    expect(signatureValide(SECRET_SITE, e)).toBe(true);
    expect(signatureValide(SECRET_REPLI, e)).toBe(false);
  });
  it("à défaut, AUCUN repli sur SITE_VIDEOS_SECRET : aucun appel (voir secret-site-sans-repli.test.ts)", async () => {
    await pm.recevoirCrochetZernio(crochet("evt_s2", "run_exemple_0001"), { env: ENV, maintenantMs: T0 });
    const vues = site([{ statut: 200, corps: {} }]);
    pm.injecterLecteurRuns(async () => ({ ...RUN }));
    await passer(T0, { ...ENV, SITE_GUIDES_RESEAU_SECRET: undefined, SITE_VIDEOS_SECRET: SECRET_REPLI });
    expect(vues).toHaveLength(0);
  });
});

describe("MINEUR (c) — 401 définitif avec alerte sans secret", () => {
  it("401 : définitif, alerte au journal, aucun secret ni adresse", async () => {
    await pm.recevoirCrochetZernio(crochet("evt_401", "run_exemple_0001"), { env: ENV, maintenantMs: T0 });
    site([{ statut: 401, corps: { erreur: "signature_invalide" } }]);
    pm.injecterLecteurRuns(async () => ({ ...RUN }));
    expect((await passer(T0)).definitifs).toBe(1);
    const journal = JSON.stringify(await depots().evenements.lister());
    expect(journal).toContain("ALERTE");
    expect(journal).toContain("SITE_GUIDES_RESEAU_SECRET");
    for (const interdit of [SECRET_SITE, SECRET_CROCHET, RUN.email]) expect(journal).not.toContain(interdit);
  });
});

describe("MINEUR (d) — run_introuvable : réessai court borné", () => {
  it("réessaie aux attentes courtes puis devient définitif ; ne consomme pas ESSAIS_MAX", async () => {
    await pm.recevoirCrochetZernio(crochet("evt_i", "run_exemple_0001"), { env: ENV, maintenantMs: T0 });
    const vues = site([{ statut: 200, corps: {} }]);
    const lecteur = vi.fn(async () => null);
    pm.injecterLecteurRuns(lecteur);
    let t = T0;
    for (let i = 0; i < ATTENTES_INTROUVABLE_MS.length; i++) {
      expect((await passer(t)).aReessayer).toBe(1);
      const [ev] = await outbox();
      expect(Number(ev.charge.prochainEssaiLe) - t).toBe(ATTENTES_INTROUVABLE_MS[i]);
      expect((await passer(t + 1)).traites).toBe(0);
      t = Number(ev.charge.prochainEssaiLe);
    }
    expect((await passer(t)).definitifs).toBe(1);
    const [ev] = await outbox();
    expect(ev.charge).toMatchObject({ etat: "definitif", dernierCode: "run_introuvable", essais: 0 });
    expect(lecteur).toHaveBeenCalledTimes(ATTENTES_INTROUVABLE_MS.length + 1);
    expect(vues).toHaveLength(0);
  });
  it("le run devient lisible au 2e passage : envoyé", async () => {
    await pm.recevoirCrochetZernio(crochet("evt_j", "run_exemple_0001"), { env: ENV, maintenantMs: T0 });
    site([{ statut: 200, corps: { accord: "non_demande" } }]);
    let n = 0;
    pm.injecterLecteurRuns(async () => (++n < 2 ? null : { ...RUN }));
    await passer(T0);
    expect((await passer(T0 + ATTENTES_INTROUVABLE_MS[0])).envoyes).toBe(1);
  });
});

describe("MINEUR (e) — 409 en_cours ne compte pas dans ESSAIS_MAX", () => {
  it("plus de ESSAIS_MAX × en_cours sans abandon ; l'échelle des pannes reste intacte ; borne propre", async () => {
    await pm.recevoirCrochetZernio(crochet("evt_e", "run_exemple_0001"), { env: ENV, maintenantMs: T0 });
    site([{ statut: 409, corps: { erreur: "en_cours" } }]);
    pm.injecterLecteurRuns(async () => ({ ...RUN }));
    let t = T0;
    for (let i = 0; i < ESSAIS_MAX + 2; i++) {
      await passer(t);
      t = Number((await outbox())[0].charge.prochainEssaiLe);
    }
    const [ev] = await outbox();
    expect(ev.charge).toMatchObject({ etat: "a_reessayer", essais: 0 });
    expect(ev.traite).toBe(false);
    // Borne : au-delà d'EN_COURS_MAX attentes, abandon (jamais de boucle sans fin), sans suppression.
    for (let i = 0; i < EN_COURS_MAX; i++) {
      await passer(t);
      const e = (await outbox())[0];
      if (e.traite) break;
      t = Number(e.charge.prochainEssaiLe);
    }
    const fin = (await outbox())[0];
    expect(fin.charge.etat).toBe("abandonne");
    expect(fin.traite).toBe(true);
  });
});

describe("MINEUR (g) — plafond par passage et disjoncteur", () => {
  it("lot : au plus LOT_MAX_PAR_PASSAGE événements par passage, le reste attend (rien de perdu)", async () => {
    for (let i = 0; i < LOT_MAX_PAR_PASSAGE + 5; i++) await pm.recevoirCrochetZernio(crochet(`evt_${i}`, `run_exemple_${String(i).padStart(4, "0")}`), { env: ENV, maintenantMs: T0 });
    const vues = site([{ statut: 200, corps: { accord: "non_demande" } }]);
    pm.injecterLecteurRuns(async () => ({ ...RUN }));
    const r1 = await passer(T0);
    expect(r1).toMatchObject({ traites: LOT_MAX_PAR_PASSAGE, plafonne: true });
    expect(vues).toHaveLength(LOT_MAX_PAR_PASSAGE);
    const r2 = await passer(T0 + 1000);
    expect(r2.traites).toBe(5);
    expect(await outbox()).toHaveLength(LOT_MAX_PAR_PASSAGE + 5);
  });
  it("disjoncteur : DISJONCTEUR_SEUIL pannes consécutives ouvrent le circuit, aucun appel pendant la pause, puis reprise", async () => {
    for (let i = 0; i < DISJONCTEUR_SEUIL + 3; i++) await pm.recevoirCrochetZernio(crochet(`evt_d${i}`, `run_exemple_${String(i).padStart(4, "0")}`), { env: ENV, maintenantMs: T0 });
    const vues = site([{ statut: 503, corps: null }]);
    pm.injecterLecteurRuns(async () => ({ ...RUN }));
    const r = await passer(T0);
    expect(r.disjoncteurOuvert).toBe(true);
    expect(vues).toHaveLength(DISJONCTEUR_SEUIL);
    const pendant = await passer(T0 + DISJONCTEUR_PAUSE_MS - 1000);
    expect(pendant).toMatchObject({ traites: 0, disjoncteurOuvert: true });
    expect(vues).toHaveLength(DISJONCTEUR_SEUIL);
    expect(JSON.stringify(await depots().evenements.lister())).toContain("disjoncteur");
    const apres = await passer(T0 + DISJONCTEUR_PAUSE_MS + 1000);
    expect(apres.traites).toBeGreaterThan(0);
  });
});

describe("MINEUR (i) — secret du webhook lu dans l'environnement", () => {
  it("sans ZERNIO_WEBHOOK_SECRET dans l'environnement : réponse neutre, rien déposé", async () => {
    const r = await pm.recevoirCrochetZernio(crochet("evt_x", "run_exemple_0001"), { env: { ...ENV, ZERNIO_WEBHOOK_SECRET: undefined }, maintenantMs: T0 });
    expect(r).toEqual({ statut: 200, corps: { recu: true } });
    expect(await outbox()).toHaveLength(0);
  });
});
