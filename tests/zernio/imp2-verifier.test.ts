import { describe, expect, it } from "vitest";
import { comparerBrouillon, formaterVerification, tirer, verifierBrouillons } from "../../src/services/import-buffer/verifier";
import type { CorpsPostZernio } from "../../src/fournisseurs/publication/zernio-client";
import { creerFauxClientZernio, postExemple } from "./aides/faux-zernio";

const corps: CorpsPostZernio = {
  content: "Texte d'exemple", isDraft: true, scheduledFor: "2026-11-05T10:00:00Z", timezone: "Europe/Paris",
  platforms: [{ platform: "linkedin", accountId: "exemple-compte-3", platformSpecificData: { organizationUrn: "urn:li:organization:123", documentTitle: "Guide d'exemple", firstComment: "Commentaire" } }],
  mediaItems: [{ type: "document", url: "https://exemple-cdn.test/m/x.pdf", title: "Guide d'exemple" }],
  metadata: { origine: "import-buffer", bufferId: "post-exemple-1", studioCle: "imp-x" },
};
const attendu = { bufferId: "post-exemple-1", zernioId: "exemple-post-1", corps };
const conforme = () => postExemple({
  content: "Texte d'exemple", status: "draft", scheduledFor: "2026-11-05T10:00:00.000Z",
  platforms: [{ platform: "linkedin", accountId: { _id: "exemple-compte-3" }, platformSpecificData: { organizationUrn: "urn:li:organization:123", documentTitle: "Guide d'exemple", firstComment: "Commentaire" } }],
  mediaItems: [{ type: "document", url: "https://exemple-cdn.test/m/x.pdf", title: "Guide d'exemple" }],
  metadata: { origine: "import-buffer", bufferId: "post-exemple-1" },
});

describe("IMP-2 vérification", () => {
  it("post conforme : aucun écart", () => {
    expect(comparerBrouillon(attendu, conforme())).toEqual([]);
  });
  it("écarts nommés : texte, médias, date, cible, commentaire, titre", () => {
    const lu = conforme();
    lu.content = "Autre texte";
    lu.mediaItems = [];
    lu.scheduledFor = "2026-11-06T10:00:00Z";
    lu.platforms[0].accountId = "exemple-compte-9";
    lu.platforms[0].platformSpecificData = { organizationUrn: "urn:li:organization:999" };
    const champs = comparerBrouillon(attendu, lu).map((e) => e.champ);
    for (const c of ["texte", "nombre de médias", "types de médias", "date", "compte", "page LinkedIn", "premier commentaire", "titre du document"]) expect(champs).toContain(c);
  });
  it("rapport : seuls les écarts, 5 posts au hasard, illisibles à part, lecture seule", async () => {
    const t = creerFauxClientZernio((a) => (a.url.endsWith("/v1/posts/exemple-post-0") ? { statut: 404, corps: {} } : { statut: 200, corps: { post: conforme() } }));
    const attendus = Array.from({ length: 8 }, (_, i) => ({ ...attendu, bufferId: `post-exemple-${i}`, zernioId: `exemple-post-${i}` }));
    const r = await verifierBrouillons(t.client, attendus, () => 0.5);
    expect(r.illisibles).toHaveLength(1);
    expect(r.verifies).toBe(7);
    expect(r.echantillon).toHaveLength(5);
    expect(r.ecarts.every((e) => e.champ === "bufferId")).toBe(true);
    expect(t.faux.appels.every((a) => a.methode === "GET")).toBe(true);
    expect(formaterVerification(r)).toContain("Échantillon de 5");
  });
  it("tirer : sans remise", () => {
    expect(new Set(tirer([1, 2, 3, 4, 5, 6], 5)).size).toBe(5);
  });
});
