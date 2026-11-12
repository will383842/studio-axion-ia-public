import { describe, expect, it } from "vitest";
import { televerserMedias, typeEtNom, type LecteurMedia } from "@/fournisseurs/publication/zernio-medias";
import { creerFauxClientZernio } from "./aides/faux-zernio";

const flux = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1, 2, 3])); c.close(); } });
const lire: LecteurMedia = async () => ({ corps: flux(), taille: 3 });
const reponses = (appel: { url: string; methode: string }) => {
  if (appel.url.endsWith("/v1/media/presign")) return { statut: 200, corps: { uploadUrl: "https://exemple-stockage.test/depot/x?sig=exemple", publicUrl: "https://exemple-cdn.test/m/x.mp4", expiresIn: 3600 } };
  return { statut: 200, corps: {} };
};

describe("z1p · téléversement", () => {
  it("presign puis PUT en flux avec Content-Length, sans Authorization, rend l'adresse publique", async () => {
    const { client, faux } = creerFauxClientZernio(reponses);
    const [m] = await televerserMedias(client, lire, [{ type: "video", url: "https://exemple-r2.test/a/video.mp4?signature=exemple" }]);
    expect(m.url).toBe("https://exemple-cdn.test/m/x.mp4");
    expect(faux.appels.map((a) => a.methode)).toEqual(["POST", "PUT"]);
    expect(faux.appels[0].json).toEqual({ filename: "video.mp4", contentType: "video/mp4", size: 3 });
    expect(faux.appels[1].entetes["Content-Length"]).toBe("3");
    expect(faux.appels[1].entetes.Authorization).toBeUndefined();
  });
  it("conserve titre et texte alternatif ; type refusé avant le réseau", async () => {
    const { client, faux } = creerFauxClientZernio(reponses);
    const [m] = await televerserMedias(client, lire, [{ type: "document", url: "https://exemple-r2.test/d.pdf", title: "Guide" }]);
    expect(m).toMatchObject({ type: "document", title: "Guide" });
    expect(() => typeEtNom("https://exemple-r2.test/f.exe")).toThrow(/pas accepté/);
    await expect(televerserMedias(client, async () => ({ corps: flux(), taille: 3 }), [{ type: "video", url: "https://exemple-r2.test/f.exe" }])).rejects.toThrow();
    expect(faux.appels).toHaveLength(2);
  });
});
