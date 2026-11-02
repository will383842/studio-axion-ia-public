/** Envoi de l'origine v3 par l'outbox : éteint par défaut (corps v1), allumé et valide (corps v3), allumé et invalide (v1 + journal sans valeur). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signatureZernio, type RunLu } from "@/domaine/guide-reseau/crochet-zernio";
import type { RequeteSignee } from "@/fournisseurs/site/types";

const { reinitialiserDepots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");

const T0 = 1_760_781_600_000;
const BASE = { PARCOURS_MOT_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: "secret-fictif-crochet-v3-test", SITE_VIDEOS_URL: "https://site.exemple", SITE_VIDEOS_SECRET: "secret-fictif-site-v3-test" };
const RUN: RunLu = {
  email: "lecteur@exemple.test", mot: "guide", reseau: "instagram", accord: "non_demande", guide: "guide-ia", versionTexteM1: "m1-v1",
  prefixesComptes: ["/compte-test/"],
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

async function envoyer(env: Record<string, string | undefined>, run: RunLu): Promise<string> {
  const corps = JSON.stringify({ id: "evt_v3_0001", event: "workflow.run.completed", timestamp: new Date(T0).toISOString(), execution: { id: "run_exemple_0001", status: "completed" }, contact: { id: "ct_1" }, trigger: { type: "keyword", text: "GUIDE" } });
  await pm.recevoirCrochetZernio({ corps, idEvenement: "evt_v3_0001", signature: signatureZernio(BASE.ZERNIO_WEBHOOK_SECRET, corps) }, { env, maintenantMs: T0 });
  let vu = "";
  pm.injecterLecteurRuns(async () => run);
  pm.injecterTransportSite(async (r: RequeteSignee) => {
    vu = r.corps;
    return { statut: 200, corps: { accord: "non_demande" } };
  });
  await pm.traiterOutboxZernio({ env, maintenantMs: T0 });
  return vu;
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
    const j = JSON.parse(await envoyer({ ...BASE, ORIGINE_V3_ENABLED: "1" }, { ...RUN, origine: { postRef: "x" } }));
    expect(j.schemaVersion).toBe(1);
    expect(sortie.join("\n")).not.toContain("lecteur@exemple.test");
  });
});
