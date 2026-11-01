import { describe, expect, it, vi } from "vitest";
import { enteteIdempotenceStudio, type RequeteZernio } from "@/fournisseurs/publication/zernio-client";
import { creerFauxClientZernio, MOT_INTERDIT, postExemple } from "./aides/faux-zernio";

const CLE = enteteIdempotenceStudio("c".repeat(64));
const BROUILLON = { content: "Bonjour", isDraft: true, platforms: [{ platform: "instagram", accountId: "exemple-compte-1" }] };

describe("z1c · interrupteur zernio.envoi_autorise", () => {
  const ecritures: [string, RequeteZernio][] = [
    ["POST /v1/posts", { methode: "POST", chemin: "/v1/posts", corps: BROUILLON, idempotence: CLE }],
    ["POST presign", { methode: "POST", chemin: "/v1/media/presign", corps: { filename: "a.png", contentType: "image/png" } }],
    ["PUT promotion", { methode: "PUT", chemin: "/v1/posts/exemple-post-1", corps: { isDraft: false, scheduledFor: "2026-11-03T10:00:00Z" } }],
    ["PUT mediaItems", { methode: "PUT", chemin: "/v1/posts/exemple-post-1", corps: { mediaItems: [{ type: "image", url: "https://media.exemple/a.jpg" }] } }],
    ["PUT <uploadUrl>", { methode: "PUT", urlTeleversement: "https://stockage.exemple/x", corps: new Uint8Array([1]), contentType: "image/png", contentLength: 1 }],
  ];
  it.each(ecritures)("faux : %s refusé, sans appel réseau", async (_nom, req) => {
    const { client, faux } = creerFauxClientZernio([], { envoiAutorise: () => false });
    await expect(client.requete(req)).rejects.toMatchObject({ code: "envoi-coupe" });
    expect(faux.appels).toHaveLength(0);
  });

  it("faux : les lectures passent", async () => {
    const { client, faux } = creerFauxClientZernio([{ statut: 200, corps: { accounts: [] } }, { statut: 200, corps: { post: postExemple() } }], { envoiAutorise: () => false });
    await client.listerComptes();
    await client.lirePost("exemple-post-1");
    expect(faux.appels).toHaveLength(2);
  });

  it("faux : la promotion est refusée avant même le GET", async () => {
    const { client, faux } = creerFauxClientZernio([], { envoiAutorise: async () => false });
    await expect(client.promouvoir({ postId: "exemple-post-1", cleJournal: "studio-x", dateJournal: "2026-11-03T10:00:00Z" })).rejects.toMatchObject({ code: "envoi-coupe" });
    expect(faux.appels).toHaveLength(0);
  });

  it("défaut vrai ; réglage relu à chaque requête (bascule sans recréer le client)", async () => {
    let autorise = true;
    const reglage = vi.fn(() => autorise);
    const { client, faux } = creerFauxClientZernio(() => ({ statut: 201, corps: { post: postExemple() } }), { envoiAutorise: reglage });
    await client.creerPost(BROUILLON, CLE);
    autorise = false;
    await expect(client.creerPost(BROUILLON, CLE)).rejects.toMatchObject({ code: "envoi-coupe" });
    expect(reglage).toHaveBeenCalledTimes(2);
    expect(faux.appels).toHaveLength(1);
    const { client: parDefaut, faux: f2 } = creerFauxClientZernio([{ statut: 201, corps: { post: postExemple() } }]);
    await parDefaut.creerPost(BROUILLON, CLE);
    expect(f2.appels).toHaveLength(1);
  });
});

describe("z1c · ordre des gardes : arrêt → filtre → chemin → débit → fetch", () => {
  it("arrêt avant tout : écriture interdite, porteuse d'un mot interdit → envoi-coupe, réglage lu en premier", async () => {
    const ordre: string[] = [];
    const { client } = creerFauxClientZernio([], {
      envoiAutorise: () => {
        ordre.push("arret");
        return false;
      },
    });
    await expect(client.requete({ methode: "DELETE", chemin: "/v1/posts/x", corps: { t: MOT_INTERDIT } })).rejects.toMatchObject({ code: "envoi-coupe" });
    expect(ordre).toEqual(["arret"]);
  });

  it("filtre avant chemin : chemin interdit porteur d'un mot interdit → mot-interdit", async () => {
    const { client, faux } = creerFauxClientZernio([]);
    await expect(client.requete({ methode: "POST", chemin: "/v1/api-keys", corps: { name: MOT_INTERDIT } })).rejects.toMatchObject({ code: "mot-interdit" });
    expect(faux.appels).toHaveLength(0);
  });

  it("chemin avant débit : débit épuisé, chemin interdit → chemin-refuse", async () => {
    const { client, faux } = creerFauxClientZernio(() => ({ statut: 200, corps: { posts: [] } }));
    for (let i = 0; i < 60; i++) await client.listerPosts();
    await expect(client.listerPosts()).rejects.toMatchObject({ code: "debit" });
    await expect(client.requete({ methode: "GET", chemin: "/v1/webhooks/settings" })).rejects.toMatchObject({ code: "chemin-refuse" });
    expect(faux.appels).toHaveLength(60);
  });

  it("débit avant fetch : refus de débit sans appel réseau", async () => {
    const { client, faux } = creerFauxClientZernio(() => ({ statut: 201, corps: { post: postExemple() } }), { nombreComptes: 5 });
    for (let i = 0; i < 25; i++) await client.creerPost(BROUILLON, CLE);
    const avant = faux.appels.length;
    const e = await client.creerPost(BROUILLON, CLE).catch((x: unknown) => x);
    expect(e).toMatchObject({ code: "debit", avantReseau: true });
    expect(faux.appels).toHaveLength(avant);
  });
});
