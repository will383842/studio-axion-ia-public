/** b5 · seconde porte : le fournisseur lui-même refuse YouTube Shorts sans interrupteur et sans réglages. */
import { describe, expect, it, vi } from "vitest";
import { cleEnvoiPublication } from "@/domaine/outil-publication";
import { creerPublicationZernio } from "@/fournisseurs/publication/zernio";
import type { DemandeZernio } from "@/fournisseurs/publication/zernio-corps";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import type { LecteurMedia } from "@/fournisseurs/publication/zernio-medias";
import { PROPOSITION_YOUTUBE } from "@/fournisseurs/publication/zernio-youtube";
import type { ClientZernio } from "@/fournisseurs/publication/zernio-client";
import { CLE_FICTIVE, creerFauxClientZernio, type AppelEnregistre } from "../zernio/aides/faux-zernio";
import { serveurSimule } from "../zernio/aides/serveur-simule";

const MAINT = Date.parse("2026-11-01T08:00:00Z");
const DATE = "2026-11-05T10:00:00Z";
const flux = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1])); c.close(); } });
const lire: LecteurMedia = async () => ({ corps: flux(), taille: 1 });
const cleN = (n: number, reseau = "youtube-shorts") => cleEnvoiPublication(`video-exemple-${n}`, reseau, DATE, "exemple-compte-yt");
const demande = (p: Partial<DemandeZernio> = {}): DemandeZernio => ({ reseau: "youtube-shorts", texte: "Texte d'exemple", titre: "Titre d'exemple", date: DATE, fichierCle: "https://exemple-r2.test/v.mp4", cible: "exemple-compte-yt", cleEnvoi: cleN(1), format: "9:16", dureeSec: 30, mode: "brouillon", ...p });
const PRET = { actif: true, reglages: { ...PROPOSITION_YOUTUBE, visibilite: "private" } };
const creations = (faux: { appels: AppelEnregistre[] }) => faux.appels.filter((a) => a.methode === "POST" && a.url.endsWith("/v1/posts"));

/** Client espion : tout appel est noté ET fait échouer le test. */
function clientEspion() {
  const appels: string[] = [];
  const client = new Proxy({}, { get: (_t, nom) => (...args: unknown[]) => { appels.push(String(nom)); void args; throw new Error(`appel client interdit : ${String(nom)}`); } }) as unknown as ClientZernio;
  return { client, appels };
}

describe("b5 · porte du fournisseur", () => {
  const refus: [string, () => Promise<unknown>, RegExp][] = [
    ["actif faux", async () => ({ actif: false, reglages: PRET.reglages }), /éteint/],
    ["actif absent", async () => ({ actif: undefined, reglages: PRET.reglages }), /éteint/],
    ["actif « true » en texte", async () => ({ actif: "true", reglages: PRET.reglages }), /éteint/],
    ["lecture qui lève", async () => { throw new Error("panne"); }, /éteint/],
    ["lecture de 2 s", () => new Promise((r) => setTimeout(() => r(PRET), 2000)), /éteint/],
    ["réglages absents", async () => ({ actif: true, reglages: null }), /réglages pas encore choisis/],
    ["réglages invalides", async () => ({ actif: true, reglages: { ...PRET.reglages, visibilite: "PUBLIC" } }), /réglages pas encore choisis/],
  ];
  it.each(refus)("%s : ErreurZernio(refuse), 0 appel client", async (_nom, lireYoutube, motif) => {
    const { client, appels } = clientEspion();
    const f = creerPublicationZernio(CLE_FICTIVE, { clientPret: client, lire, maintenant: () => MAINT, lireYoutube: lireYoutube as never });
    const e = await f.envoyer(demande()).then(() => undefined, (x: unknown) => x);
    expect(e).toBeInstanceOf(ErreurZernio);
    expect((e as ErreurZernio).code).toBe("refuse");
    expect((e as ErreurZernio).message).toMatch(motif);
    expect((e as ErreurZernio).message).toMatch(/Rien n'a été envoyé/);
    expect(appels).toEqual([]);
  });

  it("Instagram n'appelle JAMAIS lireYoutube", async () => {
    const serveur = serveurSimule();
    const { client } = creerFauxClientZernio(serveur.repondre);
    const lireYoutube = vi.fn(async () => PRET);
    const f = creerPublicationZernio(CLE_FICTIVE, { clientPret: client, lire, maintenant: () => MAINT, lireYoutube });
    await f.envoyer({ reseau: "instagram", texte: "Texte d'exemple", date: DATE, fichierCle: "https://exemple-r2.test/v.mp4", cible: "exemple-compte-1", cleEnvoi: cleN(2, "instagram") });
    expect(lireYoutube).not.toHaveBeenCalled();
  });

  it("TikTok n'appelle JAMAIS lireYoutube : corps sans aucune clé YouTube, identique interrupteur allumé ou non", async () => {
    const corpsPour = async (actif: boolean) => {
      const serveur = serveurSimule();
      const { client, faux } = creerFauxClientZernio(serveur.repondre);
      const lireYoutube = vi.fn(async () => ({ actif, reglages: PRET.reglages }));
      const f = creerPublicationZernio(CLE_FICTIVE, { clientPret: client, lire, maintenant: () => MAINT, lireYoutube });
      await f.envoyer({ reseau: "tiktok", texte: "Texte d'exemple", date: DATE, fichierCle: "https://exemple-r2.test/v.mp4", cible: "exemple-compte-tt", cleEnvoi: cleN(3, "tiktok"), consentementTiktok: true, niveauConfidentialiteTiktok: "SELF_ONLY" });
      expect(lireYoutube).not.toHaveBeenCalled();
      return JSON.stringify(creations(faux)[0].json);
    };
    const eteint = await corpsPour(false);
    expect(await corpsPour(true)).toBe(eteint);
    expect(eteint).not.toMatch(/youtube|categoryId|madeForKids|containsSyntheticMedia/);
  });

  it("tout prêt : 1 POST, plateforme youtube, réglages lus en base (pas la proposition)", async () => {
    const serveur = serveurSimule();
    const { client, faux } = creerFauxClientZernio(serveur.repondre);
    const f = creerPublicationZernio(CLE_FICTIVE, { clientPret: client, lire, maintenant: () => MAINT, lireYoutube: async () => PRET });
    const r = await f.envoyer(demande());
    expect(r.statut).toBe("brouillon");
    expect(creations(faux)).toHaveLength(1);
    const c = creations(faux)[0].json as { platforms: { platform: string; platformSpecificData: Record<string, unknown> }[] };
    expect(c.platforms[0].platform).toBe("youtube");
    expect(c.platforms[0].platformSpecificData.visibility).toBe("private");
  });

  it("plafond local : la 11e création YouTube du jour sur un compte : debit, 0 POST de plus", async () => {
    const serveur = serveurSimule();
    const { client, faux } = creerFauxClientZernio(serveur.repondre);
    const f = creerPublicationZernio(CLE_FICTIVE, { clientPret: client, lire, maintenant: () => MAINT, lireYoutube: async () => PRET });
    for (let n = 1; n <= 10; n++) await f.envoyer(demande({ cleEnvoi: cleN(100 + n) }));
    expect(creations(faux)).toHaveLength(10);
    const e = await f.envoyer(demande({ cleEnvoi: cleN(111) })).then(() => undefined, (x: unknown) => x);
    expect(e).toBeInstanceOf(ErreurZernio);
    expect((e as ErreurZernio).code).toBe("debit");
    expect(creations(faux)).toHaveLength(10);
  });
});
