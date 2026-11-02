/** PV-2 : crochet Zernio signé, outbox, appel signé au site. Aucun réseau, secrets FICTIFS. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { cleIdempotence } from "@/domaine/guide-reseau/cle-idempotence";
import { ATTENTE_EN_COURS_MS, ENTETE_HORODATAGE_ZERNIO, ENTETE_SIGNATURE_ZERNIO, signatureZernio, verifierSignatureZernio, type RunLu } from "@/domaine/guide-reseau/crochet-zernio";
import { signatureValide } from "@/fournisseurs/site/signature";
import type { RequeteSignee, ReponseSite } from "@/fournisseurs/site/types";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");

const SECRET_CROCHET = "secret-fictif-crochet-pv2";
const SECRET_SITE = "secret-fictif-site-pv2";
const EMAIL = "lecteur-fictif@example.com";
const T0 = 1_760_781_600_000;
const ENV_ALLUME = { PARCOURS_MOT_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET_CROCHET, SITE_VIDEOS_URL: "https://site.exemple", SITE_VIDEOS_SECRET: SECRET_SITE };
const RUN: RunLu = { email: EMAIL, mot: "guide", reseau: "instagram", accord: "non_demande", guide: "guide-ia", versionTexteM1: "m1-v1" };

function crochet(id: string, idRun = "run_exemple_0001", secret = SECRET_CROCHET, t = T0) {
  const corps = JSON.stringify({ id, event: "run.completed", data: { runId: idRun } });
  const horodatage = String(Math.floor(t / 1000));
  return { corps, horodatage, signature: signatureZernio(secret, horodatage, corps) };
}
const recevoir = (e: ReturnType<typeof crochet>, env: Record<string, string | undefined> = ENV_ALLUME, t = T0) => pm.recevoirCrochetZernio(e, { env, maintenantMs: t });
const outbox = () => depots().evenementsFournisseurs.lister((e) => e.fournisseur === "zernio");

let sortie: string[];
beforeEach(() => {
  reinitialiserDepots();
  pm.reinitialiserGardesParcours();
  sortie = [];
  for (const m of ["log", "error", "warn", "info"] as const) vi.spyOn(console, m).mockImplementation((...a) => void sortie.push(a.map(String).join(" ")));
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterLecteurRuns(null);
  pm.injecterTransportSite(null);
});

describe("signature du crochet", () => {
  it("valide / invalide / périmée", () => {
    const e = crochet("evt_1");
    const base = { secret: SECRET_CROCHET, corps: e.corps, horodatage: e.horodatage, signature: e.signature, maintenantMs: T0 };
    expect(verifierSignatureZernio(base)).toBe("ok");
    expect(verifierSignatureZernio({ ...base, signature: "sha256=" + e.signature })).toBe("ok");
    expect(verifierSignatureZernio({ ...base, secret: "autre-secret-fictif" })).toBe("invalide");
    expect(verifierSignatureZernio({ ...base, corps: e.corps + " " })).toBe("invalide");
    expect(verifierSignatureZernio({ ...base, signature: null })).toBe("invalide");
    expect(verifierSignatureZernio({ ...base, signature: "zz" })).toBe("invalide");
    expect(verifierSignatureZernio({ ...base, maintenantMs: T0 + 301_000 })).toBe("perimee");
    expect(verifierSignatureZernio({ ...base, maintenantMs: T0 - 301_000 })).toBe("perimee");
    expect(verifierSignatureZernio({ ...base, maintenantMs: T0 + 299_000 })).toBe("ok");
  });

  it("le service refuse (401) une signature invalide ou périmée et n'écrit rien", async () => {
    expect((await recevoir({ ...crochet("evt_1"), signature: "0".repeat(64) })).statut).toBe(401);
    expect((await recevoir(crochet("evt_2"), ENV_ALLUME, T0 + 600_000)).statut).toBe(401);
    expect(await outbox()).toHaveLength(0);
  });

  it("charge inconnue : 422 propre, rien d'écrit", async () => {
    const mauvais = (corps: string) => ({ corps, horodatage: String(T0 / 1000), signature: signatureZernio(SECRET_CROCHET, String(T0 / 1000), corps) });
    for (const c of ["pas du json", "[]", JSON.stringify({ id: "e1", event: "autre.chose", data: { runId: "r" } }), JSON.stringify({ id: "e1", event: "run.completed" })]) {
      expect((await recevoir(mauvais(c))).statut).toBe(422);
    }
    expect(await outbox()).toHaveLength(0);
  });

  it("l'entête exporté de la route est lu tel quel", () => {
    expect(ENTETE_SIGNATURE_ZERNIO).toBe("x-zernio-signature");
    expect(ENTETE_HORODATAGE_ZERNIO).toBe("x-zernio-timestamp");
  });
});

describe("rejeu et doublon", () => {
  it("un même événement reçu deux fois n'est déposé qu'une fois (réponse identique)", async () => {
    const e = crochet("evt_dup");
    const a = await recevoir(e);
    const b = await recevoir(e);
    expect(a).toEqual(b);
    expect(a.statut).toBe(200);
    expect(await outbox()).toHaveLength(1);
  });
  it("un vieux crochet rejoué hors fenêtre est refusé", async () => {
    expect((await recevoir(crochet("evt_vieux"), ENV_ALLUME, T0 + 3_600_000)).statut).toBe(401);
  });
});

describe("interrupteur éteint", () => {
  it("réponse neutre, rien déposé, aucun appel sortant (même avec un crochet signé)", async () => {
    const fetchEspion = vi.fn();
    vi.stubGlobal("fetch", fetchEspion);
    const transport = vi.fn();
    pm.injecterTransportSite(transport);
    const lecteur = vi.fn();
    pm.injecterLecteurRuns(lecteur);
    const eteint = { ...ENV_ALLUME, PARCOURS_MOT_ENABLED: undefined };
    const r1 = await recevoir(crochet("evt_1"), eteint);
    const r2 = await recevoir({ corps: "n'importe quoi", horodatage: null, signature: null }, eteint);
    expect(r1).toEqual({ statut: 200, corps: { recu: true } });
    expect(r2).toEqual(r1);
    expect(await outbox()).toHaveLength(0);
    // Même une entrée déjà présente n'est pas travaillée.
    await recevoir(crochet("evt_2"));
    const rapport = await pm.traiterOutboxZernio({ env: eteint, maintenantMs: T0 });
    expect(rapport.actif).toBe(false);
    expect(transport).not.toHaveBeenCalled();
    expect(lecteur).not.toHaveBeenCalled();
    expect(fetchEspion).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it("absent par défaut ; seuls 1/true/oui l'allument", () => {
    expect(pm.parcoursMotActif({})).toBe(false);
    expect(pm.parcoursMotActif({ PARCOURS_MOT_ENABLED: "0" })).toBe(false);
    expect(pm.parcoursMotActif({ PARCOURS_MOT_ENABLED: "true" })).toBe(true);
  });
});

/** Site factice : enregistre chaque requête, rend les réponses dans l'ordre. */
function siteFactice(reponses: (ReponseSite | "panne")[]) {
  const vues: RequeteSignee[] = [];
  const transport = async (r: RequeteSignee): Promise<ReponseSite> => {
    vues.push(r);
    const x = reponses[Math.min(vues.length - 1, reponses.length - 1)];
    if (x === "panne") throw new Error("réseau coupé " + EMAIL);
    return x;
  };
  return { vues, transport };
}

async function preparer(reponses: (ReponseSite | "panne")[], idRun = "run_exemple_0001") {
  await recevoir(crochet("evt_1", idRun));
  const s = siteFactice(reponses);
  pm.injecterTransportSite(s.transport);
  pm.injecterLecteurRuns(async () => ({ ...RUN }));
  return s;
}
const passer = (t: number) => pm.traiterOutboxZernio({ env: ENV_ALLUME, maintenantMs: t });

describe("appel signé au site", () => {
  it("succès : signature v1 valide, clé = identifiant du run, e-mail transmis mais jamais stocké", async () => {
    const s = await preparer([{ statut: 200, corps: { accord: "oui_en_attente_de_clic" } }]);
    const rap = await passer(T0);
    expect(rap).toMatchObject({ envoyes: 1, definitifs: 0 });
    const q = s.vues[0];
    expect(q.chemin).toBe("/api/interne/demandes-guide-reseau");
    expect(q.methode).toBe("POST");
    const corps = JSON.parse(q.corps);
    expect(corps).toMatchObject({ schemaVersion: 1, cleIdempotence: "run_exemple_0001", mot: "GUIDE", email: EMAIL });
    expect(signatureValide(SECRET_SITE, { methode: "POST", chemin: q.chemin, corps: q.corps, horodatage: q.entetes["x-axion-horodatage"], nonce: q.entetes["x-axion-nonce"], signature: q.entetes["x-axion-signature"] })).toBe(true);
    const [ev] = await outbox();
    expect(ev.traite).toBe(true);
    expect(ev.charge.accord).toBe("oui_en_attente_de_clic");
  });

  it("identifiant de run hors forme : la clé est son sha256", async () => {
    const s = await preparer([{ statut: 200, corps: {} }], "run:avec/caractères");
    await passer(T0);
    expect(JSON.parse(s.vues[0].corps).cleIdempotence).toBe(cleIdempotence("run:avec/caractères"));
  });

  it("panne du site : réessais espacés, même clé, mêmes octets, nonce neuf, puis succès", async () => {
    const s = await preparer(["panne", { statut: 503, corps: null }, { statut: 200, corps: { accord: "non_demande" } }]);
    expect((await passer(T0)).aReessayer).toBe(1);
    expect((await passer(T0 + 1000)).traites).toBe(0); // pas encore l'heure
    expect((await passer(T0 + 61_000)).aReessayer).toBe(1);
    expect((await passer(T0 + 61_000 + 5 * 60_000 + 1000)).envoyes).toBe(1);
    expect(s.vues).toHaveLength(3);
    expect(new Set(s.vues.map((v) => v.corps)).size).toBe(1);
    expect(new Set(s.vues.map((v) => JSON.parse(v.corps).cleIdempotence)).size).toBe(1);
    expect(new Set(s.vues.map((v) => v.entetes["x-axion-nonce"])).size).toBe(3);
  });

  it("panne durable : abandon après le nombre maximal d'essais, rien n'est supprimé", async () => {
    await preparer([{ statut: 500, corps: null }]);
    let t = T0;
    for (let i = 0; i < 10; i++) {
      await passer(t);
      t += 7 * 3600_000;
    }
    const [ev] = await outbox();
    expect(ev.charge.etat).toBe("abandonne");
    expect(ev.traite).toBe(true);
  });

  it("409 en_cours : réessai avec les mêmes octets après une attente nettement supérieure à 2 minutes", async () => {
    const s = await preparer([{ statut: 409, corps: { erreur: "en_cours" } }, { statut: 200, corps: { accord: "non_demande" } }]);
    await passer(T0);
    const [ev] = await outbox();
    expect(ATTENTE_EN_COURS_MS).toBeGreaterThanOrEqual(4 * 60_000);
    expect(Number(ev.charge.prochainEssaiLe) - T0).toBe(ATTENTE_EN_COURS_MS);
    expect((await passer(T0 + 2 * 60_000)).traites).toBe(0);
    expect((await passer(T0 + ATTENTE_EN_COURS_MS)).envoyes).toBe(1);
    expect(s.vues[0].corps).toBe(s.vues[1].corps);
  });

  it("409 nonce_reutilise : nouveau nonce immédiat, même corps", async () => {
    const s = await preparer([{ statut: 409, corps: { erreur: "nonce_reutilise" } }, { statut: 200, corps: {} }]);
    expect((await passer(T0)).envoyes).toBe(1);
    expect(s.vues[0].corps).toBe(s.vues[1].corps);
    expect(s.vues[0].entetes["x-axion-nonce"]).not.toBe(s.vues[1].entetes["x-axion-nonce"]);
  });

  it("409 cle_reutilisee : définitif, un seul appel", async () => {
    const s = await preparer([{ statut: 409, corps: { erreur: "cle_reutilisee" } }]);
    expect((await passer(T0)).definitifs).toBe(1);
    expect((await passer(T0 + 86_400_000)).traites).toBe(0);
    expect(s.vues).toHaveLength(1);
    expect((await outbox())[0].charge.dernierCode).toBe("409_cle_reutilisee");
  });

  it("422 : définitif, aucun réessai", async () => {
    const s = await preparer([{ statut: 422, corps: { erreur: "mot_invalide" } }]);
    expect((await passer(T0)).definitifs).toBe(1);
    await passer(T0 + 86_400_000);
    expect(s.vues).toHaveLength(1);
  });

  it("run introuvable ou invalide : définitif, aucun appel au site", async () => {
    await recevoir(crochet("evt_1"));
    const s = siteFactice([{ statut: 200, corps: {} }]);
    pm.injecterTransportSite(s.transport);
    pm.injecterLecteurRuns(async () => ({ ...RUN, mot: "x" }));
    expect((await passer(T0)).definitifs).toBe(1);
    expect(s.vues).toHaveLength(0);
  });
});

describe("confidentialité", () => {
  it("aucune adresse e-mail ni secret dans la base, le journal, la console ni les réponses", async () => {
    const reponses: unknown[] = [];
    reponses.push(await recevoir(crochet("evt_1")));
    await preparer([{ statut: 200, corps: { accord: "non_demande" } }]);
    reponses.push(await passer(T0));
    await preparer([{ statut: 500, corps: null }]).catch(() => undefined);
    const tout = JSON.stringify({ outbox: await outbox(), journal: await depots().evenements.lister(), reponses, sortie, parametres: await depots().parametres.lister(), notifs: await depots().notifications.lister() });
    expect(tout).not.toContain(EMAIL);
    expect(tout).not.toContain("example.com");
    expect(tout).not.toContain(SECRET_CROCHET);
    expect(tout).not.toContain(SECRET_SITE);
    expect(tout).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  it("le dossier du crochet ne contient aucun secret ni adresse en dur", () => {
    const lire = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? lire(join(d, f)) : [readFileSync(join(d, f), "utf8")]));
    const sources = [...lire("src/app/api/crochets/zernio"), readFileSync("src/services/parcours-mot.ts", "utf8"), readFileSync("src/domaine/guide-reseau/crochet-zernio.ts", "utf8")].join("\n");
    expect(sources).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    expect(sources).not.toMatch(/ZERNIO_WEBHOOK_SECRET\s*=\s*["'`]/);
  });
});
