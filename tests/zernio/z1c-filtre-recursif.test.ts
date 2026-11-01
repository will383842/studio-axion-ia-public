import { describe, expect, it } from "vitest";
import { cleEnvoiPublication } from "@/domaine/outil-publication";
import { enteteIdempotenceStudio, type CorpsPostZernio } from "@/fournisseurs/publication/zernio-client";
import { CHEMIN_SERIALISATION, motsInterditsDuCorps } from "@/fournisseurs/publication/zernio-filtre";
import { creerFauxClientZernio, fetchInterdit, J, MOT_INTERDIT, NOM_LABEL } from "./aides/faux-zernio";
import { creerClientZernio } from "@/fournisseurs/publication/zernio-client";
import { CLE_FICTIVE } from "./aides/faux-zernio";

const CLE = enteteIdempotenceStudio(cleEnvoiPublication("exemple-visuel-1", "linkedin", "2026-11-03T10:00:00Z", null));

/** Corps propre de référence : LinkedIn avec document, premier commentaire, métadonnées. */
function corpsPropre(): CorpsPostZernio {
  return {
    content: "Texte propre",
    isDraft: true,
    firstComment: "Commentaire propre",
    platforms: [{ platform: "linkedin", accountId: "exemple-compte-1", customContent: "Variante propre", platformSpecificData: { documentTitle: "Titre propre" } }],
    mediaItems: [{ type: "image", url: "https://media.exemple/a.jpg", title: "Titre média", altText: "Texte alternatif", description: "Description" }],
    metadata: { origine: "studio", note: "propre" },
  };
}

type Mutation = [string, (c: CorpsPostZernio) => void];
const champs: Mutation[] = [
  ["content", (c) => (c.content = `Super ${MOT_INTERDIT}`)],
  ["customContent", (c) => (c.platforms[0].customContent = `Variante ${NOM_LABEL}`)],
  ["firstComment", (c) => (c.firstComment = `#${J("Cert", "ifiee")}`)],
  ["documentTitle (platformSpecificData)", (c) => ((c.platforms[0].platformSpecificData as Record<string, unknown>).documentTitle = MOT_INTERDIT)],
  ["title d'un média", (c) => (c.mediaItems![0].title = NOM_LABEL)],
  ["altText", (c) => (c.mediaItems![0].altText = `photo ${MOT_INTERDIT}`)],
  ["description", (c) => (c.mediaItems![0].description = MOT_INTERDIT)],
  ["valeur de metadata", (c) => (c.metadata = { origine: "studio", note: { profonde: [MOT_INTERDIT] } })],
  ["nom de clé de metadata", (c) => (c.metadata = { origine: "studio", [NOM_LABEL]: "x" })],
];

describe("z1c · filtre récursif D7 : chaque champ, refus avant le réseau", () => {
  it.each(champs)("mot interdit dans %s : refus, fetch jamais appelé", async (_nom, muter) => {
    const corps = corpsPropre();
    muter(corps);
    const faux = fetchInterdit();
    const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: faux.fetch });
    await expect(client.creerPost(corps, CLE)).rejects.toMatchObject({ code: "mot-interdit" });
    expect(faux.appels).toHaveLength(0);
  });

  it("le message de refus nomme le champ en cause", async () => {
    const corps = corpsPropre();
    corps.mediaItems![0].altText = MOT_INTERDIT;
    const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: fetchInterdit().fetch });
    await expect(client.creerPost(corps, CLE)).rejects.toThrow(/mediaItems\[0\]\.altText/);
  });

  it("invisibles, accents et échappements : vus dans la sérialisation", () => {
    expect(motsInterditsDuCorps({ a: J("cert", "­", "ifié") }).length).toBeGreaterThan(0);
    const trouves = motsInterditsDuCorps(JSON.parse(`{"a":"${J("cert", "\\u0069", "fi")}é"}`));
    expect(trouves.length).toBeGreaterThan(0);
    expect(motsInterditsDuCorps(J('{"x":"cert', "\\u0069", 'fié"}')).map((t) => t.chemin)).toContain(CHEMIN_SERIALISATION);
  });

  it("le corps propre et les mots voisins légitimes passent (certificat)", async () => {
    const corps = corpsPropre();
    corps.content = "Un certificat de formation, des certificats";
    expect(motsInterditsDuCorps(corps)).toEqual([]);
    const { client, faux } = creerFauxClientZernio([{ statut: 201, corps: { post: { _id: "exemple-post-1", status: "draft", platforms: [] } } }]);
    await client.creerPost(corps, CLE);
    expect(faux.appels).toHaveLength(1);
  });

  it("s'applique aussi aux deux formes de PUT et aux paramètres de lecture", async () => {
    const faux = fetchInterdit();
    const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: faux.fetch });
    await expect(client.requete({ methode: "PUT", chemin: "/v1/posts/exemple-post-1", corps: { mediaItems: [{ type: "image", url: "https://media.exemple/a.jpg", altText: MOT_INTERDIT }] } })).rejects.toMatchObject({ code: "mot-interdit" });
    await expect(client.listerPosts({ search: NOM_LABEL })).rejects.toMatchObject({ code: "mot-interdit" });
    await expect(client.preparerTeleversement({ filename: `${MOT_INTERDIT}.png`, contentType: "image/png" })).rejects.toMatchObject({ code: "mot-interdit" });
    expect(faux.appels).toHaveLength(0);
  });

  it("corps d'import (clé imp-) filtré de la même façon", async () => {
    const corps = corpsPropre();
    corps.metadata = { origine: "import-buffer", texteBuffer: MOT_INTERDIT };
    const faux = fetchInterdit();
    const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: faux.fetch });
    await expect(client.creerPost(corps, `imp-${"0".repeat(64)}`)).rejects.toMatchObject({ code: "mot-interdit" });
    expect(faux.appels).toHaveLength(0);
  });
});
