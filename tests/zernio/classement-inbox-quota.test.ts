/** Classement des refus « module de messagerie absent » et « quota de messages épuisé » (jamais « accès »). Données FICTIVES. */
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import type { Depot } from "@/domaine/depots";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { creerEnvoi, validerEnvoi } from "@/services/envois-planifies";
import { promouvoirEnvoisPlanifies, type OptionsPromotionEnvois } from "@/services/promotion-envois";
import { creerFauxClientZernio, postExemple } from "./aides/faux-zernio";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const TEXTE = rendreTexteMp("mp-recu-v2", { titre: "Guide d'exemple" })!;
const PRIVE = { methode: "POST", chemin: "/v1/inbox/comments/exemple-post-1/exemple-com-1/private-reply", corps: { accountId: "exemple-compte-1", message: TEXTE }, comptesPermis: ["exemple-compte-1"], titresGuidesPermis: ["Guide d'exemple"] } as const;
const brut = (corps: unknown, status: number) => creerFauxClientZernio([], { fetch: async () => new Response(JSON.stringify(corps), { status }) });
const echoue = async (p: Promise<unknown>): Promise<ErreurZernio> => {
  try {
    await p;
  } catch (e) {
    return e as ErreurZernio;
  }
  throw new Error("une erreur était attendue");
};

const LIBELLE_INBOX = "Le module de messagerie du diffuseur n'est pas activé";
const LIBELLE_QUOTA = "Le quota de messages du diffuseur est épuisé";

describe("classement du corps d'erreur 403", () => {
  it.each([
    ["error.code", { error: { code: "INBOX_REQUIRED" } }, "inbox-requis", LIBELLE_INBOX],
    ["error.type", { error: { type: "INBOX_REQUIRED" } }, "inbox-requis", LIBELLE_INBOX],
    ["error.code", { error: { code: "message_allowance_exceeded" } }, "quota-messages", LIBELLE_QUOTA],
    ["error.type", { error: { type: "message_allowance_exceeded" } }, "quota-messages", LIBELLE_QUOTA],
    ["forme ancienne code", { code: "INBOX_REQUIRED" }, "inbox-requis", LIBELLE_INBOX],
    ["forme ancienne error court", { error: "message_allowance_exceeded" }, "quota-messages", LIBELLE_QUOTA],
    ["forme ancienne details.code", { details: { code: "INBOX_REQUIRED" } }, "inbox-requis", LIBELLE_INBOX],
  ])("%s → %s", async (_forme, corps, code, libelle) => {
    const e = await echoue(brut(corps, 403).client.requete(PRIVE));
    expect(e.code).toBe(code);
    expect(e.message).toContain(libelle);
    expect(e.message).not.toMatch(/clé/i);
  });

  it.each([
    ["403 sans code", 403, { error: "forbidden" }],
    ["403 error objet autre code", 403, { error: { code: "forbidden", type: "auth_error" } }],
    ["401 clé invalide", 401, { error: "invalid_api_key" }],
    ["401 même avec code inbox (hors 403)", 401, { error: { code: "INBOX_REQUIRED" } }],
    ["403 corps vide", 403, {}],
  ])("vraie erreur d'accès : %s reste « acces »", async (_n, statut, corps) => {
    const e = await echoue(brut(corps, statut).client.requete(PRIVE));
    expect(e.code).toBe("acces");
    expect(e.message).toContain("Vérifiez la clé");
  });

  it("non-régression : autres classements inchangés", async () => {
    const table: [number, unknown, string][] = [
      [404, { error: "introuvable" }, "introuvable"],
      [400, { error: "bad" }, "refuse"],
      [409, { code: "idempotency_conflict" }, "conflit-idempotence"],
      [409, {}, "doublon"],
      [400, { privateReplyConsumed: true }, "reponse-privee-consommee"],
    ];
    for (const [statut, corps, attendu] of table) {
      const e = await echoue(brut(corps, statut).client.requete(PRIVE));
      expect(e.code, `${statut} ${JSON.stringify(corps)}`).toBe(attendu);
    }
  });
});

describe("le lot d'envois s'arrête pour ces deux cas", () => {
  function doublure(): Depot<EnvoiPlanifie> {
    const t = new Map<string, EnvoiPlanifie>();
    return {
      async lister(f) { return structuredClone([...t.values()].filter((e) => !f || f(e))); },
      async obtenir(id) { const e = t.get(id); return e ? structuredClone(e) : null; },
      async trouver(f) { const e = [...t.values()].find(f); return e ? structuredClone(e) : null; },
      async enregistrer(e) { t.set(e.id, structuredClone(e)); return structuredClone(e); },
      async modifier(id, p) { const a = t.get(id); if (!a) throw new Error("introuvable"); const s = { ...a, ...structuredClone(p) }; t.set(id, s); return structuredClone(s); },
      async supprimer(id) { return t.delete(id); },
      async compter(f) { return [...t.values()].filter((e) => !f || f(e)).length; },
    };
  }
  const NOW0 = Date.parse("2026-11-20T08:00:00Z");
  const H = 3_600_000;
  const quand = (ms: number) => {
    const d = new Date(ms + H);
    return { jour: d.toISOString().slice(0, 10), heure: d.toISOString().slice(11, 16) };
  };

  it.each([
    ["INBOX_REQUIRED", { error: { code: "INBOX_REQUIRED" } }],
    ["message_allowance_exceeded", { error: { type: "message_allowance_exceeded" } }],
  ])("%s : 2e envoi non tenté", async (_c, corps) => {
    const depot = doublure();
    const posts: ReturnType<typeof postExemple>[] = [];
    for (const dec of [2 * H, 2 * H + 5 * 60_000]) {
      const env = await creerEnvoi(depot, { videoId: `vid-${dec}`, reseau: "linkedin" as never, versionCreneau: 1, ...quand(NOW0 + dec) }, "2026-01-01T00:00:00.000Z");
      await validerEnvoi(depot, env.id, "le fondateur", "2026-01-02T00:00:00.000Z");
      posts.push(postExemple({ _id: `exemple-post-${posts.length + 1}`, metadata: { origine: "studio", studioCle: env.id } }));
    }
    // Le listage des brouillons réussit ; la lecture / promotion d'un post est refusée par le diffuseur.
    const { client, faux, horloge } = creerFauxClientZernio((a) => (new URL(a.url).pathname.endsWith("/v1/posts") ? { statut: 200, corps: { posts: posts.filter((p) => p.status === new URL(a.url).searchParams.get("status")) } } : { statut: 403, corps }));
    horloge.avancer(NOW0 - horloge.maintenant());
    const options: OptionsPromotionEnvois = {
      depot,
      client,
      reglages: { envoiAutorise: async () => true, envoiCalendrierAutorise: async () => true, editorialeActive: async () => true },
      maintenant: horloge.maintenant,
      attendre: horloge.attendre,
      etats: { async lire() { return undefined; }, async noter() {} },
      notifier: async () => {},
    };
    const r = await promouvoirEnvoisPlanifies(options);
    expect(r.lignes.map((l) => l.etat)).toEqual(["refuse", "arret"]);
    expect(faux.appels.length).toBeGreaterThan(0);
  });
});
