/**
 * L5-07 · la lecture du réglage « premier commentaire coupé » ne retarde plus l'envoi dans le cas normal :
 * lancée dès l'entrée, attendue seulement avant la création du post (second corpsPostZernio). Faux client, aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cleEnvoiPublication } from "@/domaine/outil-publication";
import { creerPublicationZernio } from "@/fournisseurs/publication/zernio";
import type { DemandeZernio } from "@/fournisseurs/publication/zernio-corps";
import type { LecteurMedia } from "@/fournisseurs/publication/zernio-medias";
import { creerFauxClientZernio, CLE_FICTIVE, postExemple, type AppelEnregistre, type ReponsePreparee } from "../zernio/aides/faux-zernio";

const CLE = cleEnvoiPublication("video-exemple", "facebook", "2026-11-05T10:00:00Z", "exemple-compte-1:fb:111");
const demande = (r: Partial<DemandeZernio> = {}): DemandeZernio => ({ reseau: "facebook", texte: "Texte d'exemple", date: "2026-11-05T10:00:00Z", fichierCle: "https://exemple-r2.test/v.mp4", cible: "exemple-compte-1:fb:111", cleEnvoi: CLE, premierCommentaire: "Commentaire d'exemple", ...r });
const flux = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1])); c.close(); } });
const lire: LecteurMedia = async () => ({ corps: flux(), taille: 1 });
const serveur = (a: AppelEnregistre): ReponsePreparee => {
  if (a.url.endsWith("/v1/media/presign")) return { statut: 200, corps: { uploadUrl: "https://exemple-stockage.test/depot/x", publicUrl: "https://exemple-cdn.test/m/x.mp4" } };
  if (a.url.startsWith("https://exemple-stockage.test")) return { statut: 200, corps: {} };
  if (a.methode === "POST" && a.url.endsWith("/v1/posts")) return { statut: 201, corps: { post: postExemple({ _id: "exemple-post-9" }) } };
  return { statut: 404, corps: {} };
};
const premier = (c: unknown) => (c as { platforms: { platformSpecificData?: { firstComment?: string } }[] }).platforms[0].platformSpecificData?.firstComment;
const lancer = async (lecture: () => Promise<unknown>, r: Partial<DemandeZernio> = {}) => {
  const t = creerFauxClientZernio(serveur);
  const f = creerPublicationZernio(CLE_FICTIVE, { clientPret: t.client, lire, maintenant: t.horloge.maintenant, lirePremierCommentaireCoupe: lecture });
  const debut = Date.now();
  const res = await f.envoyer(demande({ date: new Date(t.horloge.maintenant() + 3 * 3600_000).toISOString(), ...r }));
  const envoi = t.faux.appels.find((a) => a.methode === "POST" && a.url.endsWith("/v1/posts"));
  return { res, duree: Date.now() - debut, commentaire: premier(envoi?.json), appels: t.faux.appels };
};

describe("lecture du réglage : lancée tout de suite, attendue au plus tard avant la création", () => {
  it("cas normal : lecture rapide, aucun retard ajouté", async () => {
    const e = await lancer(async () => false);
    expect(e.duree).toBeLessThan(300);
    expect(e.commentaire).toBe("Commentaire d'exemple");
  });
  it("lecture un peu lente mais qui répond : sa valeur est bien attendue avant la création (coupé = rien d'envoyé)", async () => {
    const e = await lancer(() => new Promise((r) => setTimeout(() => r(true), 100)));
    expect(e.commentaire).toBeUndefined();
    expect(e.res.premierCommentaire).toBeUndefined();
  });
  it("lecture qui ne répond jamais : attente bornée à 500 ms, le premier commentaire part", async () => {
    const e = await lancer(() => new Promise(() => undefined));
    expect(e.duree).toBeLessThan(1200);
    expect(e.commentaire).toBe("Commentaire d'exemple");
  });
  it("la lecture est lancée avant le premier appel réseau", async () => {
    let appelsAuLancement = -1;
    const t = creerFauxClientZernio(serveur);
    const f = creerPublicationZernio(CLE_FICTIVE, { clientPret: t.client, lire, maintenant: t.horloge.maintenant, lirePremierCommentaireCoupe: async () => { appelsAuLancement = t.faux.appels.length; return false; } });
    await f.envoyer(demande({ date: new Date(t.horloge.maintenant() + 3 * 3600_000).toISOString() }));
    expect(appelsAuLancement).toBe(0);
  });
  it("refus pur (étape 1) : jamais retardé par une lecture qui ne répond pas, aucun appel réseau", async () => {
    const t = creerFauxClientZernio(serveur);
    const f = creerPublicationZernio(CLE_FICTIVE, { clientPret: t.client, lire, maintenant: t.horloge.maintenant, lirePremierCommentaireCoupe: () => new Promise(() => undefined) });
    const debut = Date.now();
    await expect(f.envoyer(demande({ date: new Date(t.horloge.maintenant() - 3600_000).toISOString() }))).rejects.toBeTruthy();
    expect(Date.now() - debut).toBeLessThan(300);
    expect(t.faux.appels).toHaveLength(0);
  });
  it("mutation prouvée : le premier corpsPostZernio n'a pas l'option, le second l'a ; délai de 500 ms", () => {
    const src = readFileSync("src/fournisseurs/publication/zernio.ts", "utf8");
    expect(src.match(/premierCommentaireCoupe: coupe/g)?.length).toBe(1);
    expect(src).toMatch(/DELAI_LECTURE_COUPE_MS = 500;/);
    expect(src.indexOf("const coupe = await coupeP")).toBeGreaterThan(src.indexOf("televerserMedias(client"));
  });
});
