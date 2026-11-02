/** Envoi de l'origine v3 par l'outbox : éteint par défaut (corps v1), allumé et valide (corps v3), allumé et invalide (v1 + journal sans valeur). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signatureZernio, type RunLu } from "@/domaine/guide-reseau/crochet-zernio";
import type { RequeteSignee } from "@/fournisseurs/site/types";

const { reinitialiserDepots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");

const T0 = 1_760_781_600_000;
const BASE = { ORIGINE_V3_PREFIXES_COMPTES: "/compte-test/", PARCOURS_MOT_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: "secret-fictif-crochet-v3-test", SITE_VIDEOS_URL: "https://site.exemple", SITE_VIDEOS_SECRET: "secret-fictif-site-v3-test" };
const RUN: RunLu = {
  email: "lecteur@exemple.test", mot: "guide", reseau: "instagram", accord: "non_demande", guide: "guide-ia", versionTexteM1: "m1-v1",
  origine: { postRef: "ref_post_0001", postUrl: "https://www.instagram.com/compte-test/p/abc123/", canal: "commentaire", compte: "page_principale" },
};
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

async function envoyer(env: Record<string, string | undefined>, run: RunLu, reponses: number[] = [200]): Promise<string> {
  return (await envoyerTout(env, run, reponses)).vus.at(-1) ?? "";
}
async function envoyerTout(env: Record<string, string | undefined>, run: RunLu, reponses: number[] = [200]): Promise<{ vus: string[]; rapport: Awaited<ReturnType<typeof pm.traiterOutboxZernio>>[] }> {
  const corps = JSON.stringify({ id: "evt_v3_0001", event: "workflow.run.completed", timestamp: new Date(T0).toISOString(), execution: { id: "run_exemple_0001", status: "completed" }, contact: { id: "ct_1" }, trigger: { type: "keyword", text: "GUIDE" } });
  await pm.recevoirCrochetZernio({ corps, idEvenement: "evt_v3_0001", signature: signatureZernio(BASE.ZERNIO_WEBHOOK_SECRET, corps) }, { env, maintenantMs: T0 });
  const vus: string[] = [];
  pm.injecterLecteurRuns(async () => run);
  pm.injecterTransportSite(async (r: RequeteSignee) => {
    vus.push(r.corps);
    const statut = reponses[Math.min(vus.length - 1, reponses.length - 1)];
    return statut === 200 ? { statut, corps: { accord: "non_demande" } } : { statut, corps: { erreur: "invalide" } };
  });
  const rapport = [await pm.traiterOutboxZernio({ env, maintenantMs: T0 }), await pm.traiterOutboxZernio({ env, maintenantMs: T0 + 1000 })];
  return { vus, rapport };
}

describe("origine v3 dans l'appel au site", () => {
  it("drapeau absent : corps v1 inchangé, aucun champ d'origine", async () => {
    const j = JSON.parse(await envoyer(BASE, RUN));
    expect(j.schemaVersion).toBe(1);
    expect(j.post_ref).toBeUndefined();
  });
  it("drapeau allumé et origine valide : corps v3", async () => {
    const j = JSON.parse(await envoyer({ ...BASE, ORIGINE_V3_ENABLED: "1" }, RUN));
    expect(j.schemaVersion).toBe(3);
    expect(j.post_ref).toBe("ref_post_0001");
    expect(j.canal).toBe("commentaire");
  });
  it("drapeau allumé, origine invalide : corps v1, journal avec le code et sans la valeur", async () => {
    const j = JSON.parse(await envoyer({ ...BASE, ORIGINE_V3_ENABLED: "1" }, { ...RUN, origine: { postRef: "valeur-refusee!" } }));
    expect(j.schemaVersion).toBe(1);
    const { depots } = await import("@/services/_commun");
    const journal = (await depots().evenements.lister(() => true)).map((e) => e.message).join("\n");
    expect(journal).toContain("post_ref_invalide");
    expect(journal).not.toContain("lecteur@exemple.test");
    expect(journal).not.toContain("valeur-refusee");
  });
  it("drapeau éteint : octets du corps identiques au corps v1 de référence", async () => {
    const { corpsDemandeGuide } = await import("@/domaine/guide-reseau/crochet-zernio");
    const { cleIdempotence } = await import("@/domaine/guide-reseau/cle-idempotence");
    const vu = await envoyer(BASE, RUN);
    const attendu = corpsDemandeGuide(RUN, cleIdempotence("run_exemple_0001"));
    expect(Buffer.from(vu, "utf8").equals(Buffer.from(attendu, "utf8"))).toBe(true);
  });
  it("préfixes de comptes : lus dans la configuration, jamais dans le run", async () => {
    const sansConfig = { ...BASE, ORIGINE_V3_ENABLED: "1", ORIGINE_V3_PREFIXES_COMPTES: undefined };
    const run = { ...RUN, prefixesComptes: ["/compte-test/"] } as RunLu;
    expect(JSON.parse(await envoyer(sansConfig, run)).schemaVersion).toBe(1);
  });
  it("un 422 du site sur le corps v3 ne fait pas abandonner : reprise en corps v1", async () => {
    const { vus } = await envoyerTout({ ...BASE, ORIGINE_V3_ENABLED: "1" }, RUN, [422, 200]);
    expect(vus).toHaveLength(2);
    expect(JSON.parse(vus[0]).schemaVersion).toBe(3);
    expect(JSON.parse(vus[1]).schemaVersion).toBe(1);
    const evts = await (await import("@/services/_commun")).depots().evenementsFournisseurs.lister(() => true);
    expect(evts[0].charge.etat).toBe("envoye");
  });
  it("un 422 en v3 au dernier essai (ESSAIS_MAX-1 déjà consommés) repart en reprise v1, sans abandon", async () => {
    const { ESSAIS_MAX } = await import("@/domaine/guide-reseau/crochet-zernio");
    const env = { ...BASE, ORIGINE_V3_ENABLED: "1" };
    const corps = JSON.stringify({ id: "evt_v3_0001", event: "workflow.run.completed", timestamp: new Date(T0).toISOString(), execution: { id: "run_exemple_0001", status: "completed" }, contact: { id: "ct_1" }, trigger: { type: "keyword", text: "GUIDE" } });
    await pm.recevoirCrochetZernio({ corps, idEvenement: "evt_v3_0001", signature: signatureZernio(BASE.ZERNIO_WEBHOOK_SECRET, corps) }, { env, maintenantMs: T0 });
    const { depots } = await import("@/services/_commun");
    const [ev] = await depots().evenementsFournisseurs.lister(() => true);
    await depots().evenementsFournisseurs.modifier(ev.id, { charge: { ...ev.charge, essais: ESSAIS_MAX - 1 } });
    const vus: string[] = [];
    pm.injecterLecteurRuns(async () => RUN);
    pm.injecterTransportSite(async (r: RequeteSignee) => {
      vus.push(r.corps);
      return vus.length === 1 ? { statut: 422, corps: { erreur: "invalide" } } : { statut: 200, corps: { accord: "non_demande" } };
    });
    await pm.traiterOutboxZernio({ env, maintenantMs: T0 });
    const [apres] = await depots().evenementsFournisseurs.lister(() => true);
    expect(apres.charge.etat).toBe("a_reessayer");
    expect(apres.charge.etat).not.toBe("abandonne");
    expect(apres.charge.sansOrigineV3).toBe(true);
    await pm.traiterOutboxZernio({ env, maintenantMs: T0 + 1000 });
    expect(JSON.parse(vus[1]).schemaVersion).toBe(1);
    const [fin] = await depots().evenementsFournisseurs.lister(() => true);
    expect(fin.charge.etat).toBe("envoye");
  });
});
