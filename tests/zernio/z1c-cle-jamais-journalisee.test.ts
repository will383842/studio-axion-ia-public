import { describe, expect, it } from "vitest";
import { creerClientZernio, enteteIdempotenceStudio } from "@/fournisseurs/publication/zernio-client";
import { ErreurZernio, masquerSecret } from "@/fournisseurs/publication/zernio-erreurs";
import { CLE_FICTIVE, creerFauxClientZernio, MOT_INTERDIT, postExemple, type ReponsePreparee } from "./aides/faux-zernio";

const CLE = enteteIdempotenceStudio("a".repeat(64));
const BROUILLON = { content: "Bonjour", isDraft: true, platforms: [{ platform: "instagram", accountId: "exemple-compte-1" }] };

/** Tout ce qu'une erreur peut laisser voir (message, détail, sérialisation, pile). */
function traces(e: unknown): string {
  const x = e as ErreurZernio;
  return [x.message, x.detailTechnique ?? "", JSON.stringify(x), String(x.stack ?? "")].join("\n");
}

describe("z1c · la clé ZERNIO_API_KEY n'apparaît dans aucune erreur ni aucun journal", () => {
  const scenarios: [string, ReponsePreparee[]][] = [
    ["401 qui renvoie la clé", [{ statut: 401, corps: { error: `Invalid key ${CLE_FICTIVE}` } }]],
    ["400 qui renvoie l'en-tête", [{ statut: 400, corps: { error: `bad header Authorization: Bearer ${CLE_FICTIVE}` } }]],
    ["500 qui renvoie la clé", [{ statut: 500, corps: { error: `boom ${CLE_FICTIVE}` } }]],
    ["erreur réseau qui cite la clé", [{ erreur: "reseau", message: `connect failed Bearer ${CLE_FICTIVE}` }]],
    ["délai dépassé", [{ erreur: "delai" }]],
    ["429 deux fois", [{ statut: 429, corps: { error: CLE_FICTIVE }, entetes: { "Retry-After": "1" } }, { statut: 429, corps: { error: CLE_FICTIVE } }]],
    ["409 doublon", [{ statut: 409, corps: { error: CLE_FICTIVE, details: { existingPostId: "exemple-post-1" } } }]],
    ["207 en échec", [{ statut: 207, corps: { post: postExemple({ platforms: [{ platform: "instagram", accountId: "x", status: "failed", errorMessage: CLE_FICTIVE }] }) } }]],
  ];

  it.each(scenarios)("%s", async (_nom, reponses) => {
    const { client, journal } = creerFauxClientZernio(reponses);
    const resultat = await client.creerPost(BROUILLON, CLE).then(
      (r) => JSON.stringify(r),
      (e: unknown) => traces(e),
    );
    expect(resultat).not.toContain(CLE_FICTIVE);
    expect(journal.lignes.join("\n")).not.toContain(CLE_FICTIVE);
    expect(journal.lignes.length).toBeGreaterThan(0);
  });

  it("les refus avant le réseau ne la citent pas non plus", async () => {
    const { client, journal } = creerFauxClientZernio([]);
    for (const p of [
      client.requete({ methode: "DELETE", chemin: "/v1/posts/exemple-post-1" }),
      client.creerPost({ ...BROUILLON, content: MOT_INTERDIT }, CLE),
    ]) {
      const e = await p.catch((x: unknown) => x);
      expect(traces(e)).not.toContain(CLE_FICTIVE);
    }
    expect(journal.lignes.join("\n")).not.toContain(CLE_FICTIVE);
  });

  it("l'objet client ne porte pas la clé (sérialisation, propriétés)", () => {
    const { client } = creerFauxClientZernio([]);
    expect(JSON.stringify(client) ?? "").not.toContain(CLE_FICTIVE);
    expect(Object.values(client).some((v) => typeof v === "string" && v.includes(CLE_FICTIVE))).toBe(false);
  });

  it("la clé part seulement en Authorization vers l'API, jamais dans l'adresse ni vers le stockage", async () => {
    const { client, faux } = creerFauxClientZernio([
      { statut: 200, corps: { uploadUrl: "https://stockage.exemple/televersement/exemple-1", publicUrl: "https://media.exemple/1.mp4" } },
      { statut: 200 },
    ]);
    const p = await client.preparerTeleversement({ filename: "exemple.mp4", contentType: "video/mp4" });
    await client.televerser({ uploadUrl: p.uploadUrl, corps: new Uint8Array([1]), contentType: "video/mp4", contentLength: 1 });
    expect(faux.appels[0].entetes.Authorization).toBe(`Bearer ${CLE_FICTIVE}`);
    expect(faux.appels[0].url).not.toContain(CLE_FICTIVE);
    expect(JSON.stringify(faux.appels[1])).not.toContain(CLE_FICTIVE);
  });

  it("clé absente : refus clair qui ne cite rien", () => {
    expect(() => creerClientZernio({ cle: "" })).toThrow(/Clé Zernio absente/);
  });

  it("masquerSecret retire la clé et tout jeton porteur", () => {
    expect(masquerSecret(`x ${CLE_FICTIVE} y`, [CLE_FICTIVE])).not.toContain(CLE_FICTIVE);
    expect(masquerSecret("Authorization: Bearer abc.def")).not.toContain("abc.def");
  });
});
