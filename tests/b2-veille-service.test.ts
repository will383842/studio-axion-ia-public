/**
 * Lot B2 — VEILLE DES OUTILS : le service, SANS réseau ni clé (données en mémoire, réponses enregistrées le 02/10).
 * Lecture quotidienne, carte grise, alerte rouge sur LICENSE.md, cloche, e-mail filtré, résumé du lundi,
 * « Essayer » / « Ignorer », ajout et rangement d'un outil, migration 15, tâche une fois par processus.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const veille = await import("@/services/veille");
const { canauxPour } = await import("@/services/notifications");
const { etape15Veille } = await import("@/services/migrations/etape-15-veille");
const { TUILES_PLUS, NAV_LATERALE } = await import("@/components/coquille/navigation");
const { fournisseurScriptSimulation } = await import("@/fournisseurs/simulation/script");

const MDP_TEST = "essai-lot-b2-veille";
const fixture = <T>(nom: string): T => JSON.parse(readFileSync(join(__dirname, "fixtures", nom), "utf8")) as T;
const LICENCE = fixture<{ texte: string }>("b2-remotion-license.json").texte;
const FAL = fixture<Record<string, unknown>>("b2-fal.json");

const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });
const page = (t: string) => new Response(`<html><body><main>${t}</main></body></html>`, { status: 200 });

/** Le « web public » rejoué : chaque test peut changer une réponse (licence, version, panne). */
function web(changements: { licence?: string; remotion?: string; panne?: RegExp } = {}) {
  const appels: string[] = [];
  const f = (async (u: string | URL | Request) => {
    const url = String(u);
    appels.push(url);
    if (changements.panne?.test(url)) throw new DOMException("délai", "TimeoutError");
    const remotion = changements.remotion ?? "4.0.532";
    if (url === "https://registry.npmjs.org/remotion") return json({ "dist-tags": { latest: remotion }, time: { [remotion]: "2026-10-01T07:37:10.000Z" } });
    if (url === "https://api.github.com/repos/remotion-dev/remotion/releases/latest") return json(fixture("b2-github-remotion.json"));
    if (url.endsWith("remotion-dev/remotion/HEAD/LICENSE.md")) return new Response(changements.licence ?? LICENCE);
    if (url === "https://api.github.com/repos/m-bain/whisperX/releases/latest") return json({ tag_name: "v3.8.6", published_at: "2026-09-20T00:00:00Z", html_url: "https://github.com/m-bain/whisperX/releases/tag/v3.8.6", body: "Bug fixes" });
    if (url === "https://api.github.com/repos/FFmpeg/FFmpeg/git/matching-refs/tags/") return json(fixture("b2-github-ffmpeg-refs.json"));
    if (url.startsWith("https://api.fal.ai/v1/models?category=")) return json(FAL[new URL(url).searchParams.get("category")!]);
    if (url === "https://developers.heygen.com/changelog") return page(fixture<{ texte: string }>("b2-page-heygen.json").texte);
    if (url === "https://elevenlabs.io/docs/changelog") return page(fixture<{ texte: string }>("b2-page-elevenlabs.json").texte);
    if (url.includes("tiktok.com") || url.includes("facebook.com")) return new Response("<html><div id=root></div></html>");
    if (url.includes("youtube") || url.includes("linkedin")) return page("Aide officielle. ".repeat(60));
    return new Response("introuvable", { status: 404 });
  }) as typeof fetch;
  return { f, appels };
}

function emails() {
  const envoyes: { titre: string }[] = [];
  const envoyerEmail = vi.fn(async (_c: unknown, n: { titre: string }) => {
    envoyes.push(n);
    return { envoye: true, simule: false };
  });
  return { envoyes, envoyerEmail };
}

const LE_02_10 = new Date("2026-10-02T09:00:00Z");
const outil = async (id: string) => (await depots().veilleOutils.obtenir(id))!;

beforeAll(async () => {
  process.env.SESSION_SECRET = "v".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP_TEST, false);
});

describe("lecture quotidienne", () => {
  it("pose les 11 outils, Remotion « 4.0.532 utilisée » à jour, Claude gris (pas de clé), TikTok gris (page illisible)", async () => {
    const { f } = web();
    const m = emails();
    const r = await veille.verifierVeille({ appeler: f, env: {}, maintenant: () => LE_02_10, email: null, envoyerEmail: m.envoyerEmail });
    expect(await depots().veilleOutils.compter()).toBe(11);
    expect(await outil("veille-remotion")).toMatchObject({ versionUtilisee: "4.0.532", derniereVersion: "4.0.532", etat: "a-jour" });
    expect((await outil("veille-claude")).etat).toBe("injoignable");
    expect((await outil("veille-tiktok")).etat).toBe("injoignable");
    expect(r.muets.sort()).toEqual(["Claude", "Instagram", "TikTok"]);
    // FFmpeg 9.0.2 contre 5.1 utilisée : une nouveauté d'intérêt moyen → cloche, PAS d'e-mail.
    expect(r.nouveautes).toEqual([{ outil: "FFmpeg", versionVue: "9.0.2", rouge: false, interet: "moyen" }]);
    expect((await outil("veille-ffmpeg")).etat).toBe("nouveaute");
    expect(await depots().notifications.compter((n) => n.type === "veille")).toBe(1);
    expect(m.envoyerEmail).not.toHaveBeenCalled();
    expect((await depots().parametres.obtenir("veille.derniereLecture"))?.valeur).toBe(LE_02_10.toISOString());
  });

  it("LICENSE.md de Remotion change (lecture suivante) : alerte ROUGE, carte « attention », cloche ET e-mail", async () => {
    await veille.verifierVeille({ appeler: web().f, env: {}, maintenant: () => LE_02_10, email: null, envoyerEmail: emails().envoyerEmail });
    const m = emails();
    const licence = LICENCE.replace("Individuals and small companies are allowed", "Only individuals are allowed");
    const r = await veille.verifierVeille({ appeler: web({ licence }).f, env: {}, maintenant: () => new Date("2026-10-03T09:00:00Z"), email: null, envoyerEmail: m.envoyerEmail });
    expect(r.nouveautes).toEqual([{ outil: "Remotion", versionVue: "LICENSE.md modifié le 03/10", rouge: true, interet: "faible" }]);
    expect((await outil("veille-remotion")).etat).toBe("attention");
    const n = (await depots().veilleNouveautes.lister((x) => x.outilId === "veille-remotion"))[0];
    expect(n.resume.risque).toContain("licence");
    expect(m.envoyes.map((e) => e.titre)).toEqual(["Veille : alerte sur Remotion"]);
    const cloche = await depots().notifications.lister((x) => x.type === "veille" && x.titre.startsWith("Remotion"));
    expect(cloche[0]).toMatchObject({ titre: "Remotion : alerte à lire", lien: `/veille?nouveaute=${n.id}` });
  });

  it("nouvelle version de Remotion : nouveauté orange, jamais appliquée (version utilisée inchangée)", async () => {
    await veille.verifierVeille({ appeler: web().f, env: {}, maintenant: () => LE_02_10, email: null, envoyerEmail: emails().envoyerEmail });
    await veille.verifierVeille({ appeler: web({ remotion: "4.0.540" }).f, env: {}, maintenant: () => new Date("2026-10-03T09:00:00Z"), email: null, envoyerEmail: emails().envoyerEmail });
    expect(await outil("veille-remotion")).toMatchObject({ versionUtilisee: "4.0.532", derniereVersion: "4.0.540", etat: "nouveaute" });
  });

  it("une source qui tombe en panne : carte grise (jamais « à jour »), la dernière version connue reste affichée", async () => {
    await veille.verifierVeille({ appeler: web().f, env: {}, maintenant: () => LE_02_10, email: null, envoyerEmail: emails().envoyerEmail });
    expect((await outil("veille-whisperx")).etat).toBe("a-jour");
    await veille.verifierVeille({ appeler: web({ panne: /whisperX/ }).f, env: {}, maintenant: () => new Date("2026-10-03T09:00:00Z"), email: null, envoyerEmail: emails().envoyerEmail });
    expect(await outil("veille-whisperx")).toMatchObject({ etat: "injoignable", derniereVersion: "3.8.6" });
  });

  it("relire la même chose ne recrée ni nouveauté ni notification", async () => {
    const dep = { appeler: web().f, env: {}, email: null, envoyerEmail: emails().envoyerEmail };
    await veille.verifierVeille({ ...dep, maintenant: () => LE_02_10 });
    await veille.verifierVeille({ ...dep, maintenant: () => new Date("2026-10-03T09:00:00Z") });
    expect(await depots().veilleNouveautes.compter()).toBe(1);
    expect(await depots().notifications.compter((n) => n.type === "veille")).toBe(1);
  });

  it("intérêt fort (voix) : e-mail ; le résumé passe par le fournisseur de scripts (simulé)", async () => {
    expect(fournisseurScriptSimulation.resumerNouveaute).toBeDefined();
    await veille.verifierVeille({ appeler: web().f, env: {}, maintenant: () => LE_02_10, email: null, envoyerEmail: emails().envoyerEmail });
    const m = emails();
    const avecVoix = (async (u: string | URL | Request) =>
      String(u) === "https://elevenlabs.io/docs/changelog" ? page(`October 1, 2026 Eleven v4: new French voices, more natural speech. ${"Détails. ".repeat(80)}`) : web().f(u)) as typeof fetch;
    const r = await veille.verifierVeille({ appeler: avecVoix, env: {}, maintenant: () => new Date("2026-10-03T09:00:00Z"), email: null, envoyerEmail: m.envoyerEmail });
    expect(r.nouveautes).toEqual([{ outil: "ElevenLabs", versionVue: "2026-10-01", rouge: false, interet: "fort" }]);
    expect(m.envoyes.map((e) => e.titre)).toEqual(["Veille : ElevenLabs 2026-10-01"]);
  });

  it("une seule lecture à la fois : la seconde, lancée pendant la première, est sautée", async () => {
    const lent = (async (u: string | URL | Request) => {
      await new Promise((ok) => setTimeout(ok, 20));
      return web().f(u);
    }) as typeof fetch;
    const dep = { appeler: lent, env: {}, maintenant: () => LE_02_10, email: null, envoyerEmail: emails().envoyerEmail };
    const [a, b] = await Promise.all([veille.verifierVeille(dep), veille.verifierVeille(dep)]);
    expect([a.saute, b.saute].filter(Boolean)).toHaveLength(1);
  });
});

describe("tâche quotidienne et résumé du lundi", () => {
  it("le tour ne relit pas avant 24 h", async () => {
    const { f, appels } = web();
    const dep = { appeler: f, env: {}, email: null, envoyerEmail: emails().envoyerEmail };
    await veille.tourVeille({ ...dep, maintenant: () => LE_02_10 });
    const n = appels.length;
    await veille.tourVeille({ ...dep, maintenant: () => new Date("2026-10-02T15:00:00Z") });
    expect(appels.length).toBe(n);
    await veille.tourVeille({ ...dep, maintenant: () => new Date("2026-10-03T09:00:00Z") });
    expect(appels.length).toBeGreaterThan(n);
  });

  it("lundi 8 h : un résumé (cloche + e-mail), une seule fois dans la semaine", async () => {
    await veille.verifierVeille({ appeler: web().f, env: {}, maintenant: () => LE_02_10, email: null, envoyerEmail: emails().envoyerEmail });
    const m = emails();
    const lundi = () => new Date("2026-10-05T06:10:00Z");
    expect(await veille.envoyerResumeHebdo({ maintenant: lundi, email: null, envoyerEmail: m.envoyerEmail })).toBe(true);
    expect(await veille.envoyerResumeHebdo({ maintenant: lundi, email: null, envoyerEmail: m.envoyerEmail })).toBe(false);
    expect(m.envoyes.map((e) => e.titre)).toEqual(["Veille de la semaine"]);
    expect(await depots().notifications.compter((n) => n.titre === "Veille de la semaine")).toBe(1);
  });

  it("la cloche reçoit la veille, le téléphone et l'e-mail génériques non (filtrés par la veille elle-même)", () => {
    expect(canauxPour({ type: "veille" }, { videoPrete: true, echec: true, budget: true, canal: "email" }, { push: true })).toEqual({ push: false, email: false, emailSiPushEchoue: false });
  });

  it("une fois par processus", () => {
    vi.useFakeTimers();
    try {
      expect(veille.demarrerVeille()).toBe(true);
      expect(veille.demarrerVeille()).toBe(false);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});

describe("gestes de Will", () => {
  async function avecNouveaute() {
    await veille.verifierVeille({ appeler: web().f, env: {}, maintenant: () => LE_02_10, email: null, envoyerEmail: emails().envoyerEmail });
    return (await depots().veilleNouveautes.lister())[0];
  }

  it("« Essayer » : statut à essayer, une tâche (notification + journal), rien n'est mis à jour", async () => {
    const n = await avecNouveaute();
    await veille.essayerNouveaute(n.id);
    expect(await depots().veilleNouveautes.obtenir(n.id)).toMatchObject({ statut: "essayer" });
    expect((await depots().veilleNouveautes.obtenir(n.id))!.tacheCreeeLe).toBeTruthy();
    expect(await depots().notifications.compter((x) => x.titre === "À faire : essayer FFmpeg 9.0.2")).toBe(1);
    expect(await depots().evenements.compter((e) => e.type === "veille" && e.message === "À essayer : FFmpeg 9.0.2")).toBe(1);
    expect((await outil("veille-ffmpeg")).versionUtilisee).toBe("5.1");
  });

  it("« Ignorer » : rangée (jamais supprimée), la carte se recalcule ; « Remettre » la rouvre", async () => {
    const n = await avecNouveaute();
    await veille.ignorerNouveaute(n.id);
    expect(await depots().veilleNouveautes.obtenir(n.id)).toMatchObject({ statut: "ignoree" });
    // FFmpeg reste orange : la dernière version dépasse toujours celle qu'on utilise.
    expect((await outil("veille-ffmpeg")).etat).toBe("nouveaute");
    expect(await veille.compterNouveautesOuvertes()).toBe(0);
    await veille.reprendreNouveaute(n.id);
    expect(await veille.compterNouveautesOuvertes()).toBe(1);
  });

  it("ajouter un outil (nom + adresse) puis le ranger : gardé en base, plus surveillé", async () => {
    const o = await veille.ajouterOutil("Kling", "https://github.com/Kling-AI/kling");
    expect(o).toMatchObject({ nom: "Kling", source: { type: "github", depot: "Kling-AI/kling" }, etat: "injoignable", ajoutePar: "will" });
    await expect(veille.ajouterOutil("X", "localhost")).rejects.toThrow("Adresse web invalide");
    await veille.rangerOutil(o.id);
    expect((await depots().veilleOutils.obtenir(o.id))!.archiveLe).toBeTruthy();
    const vue = await veille.lireVeille();
    expect(vue.outils.some((x) => x.id === o.id)).toBe(false);
  });

  it("page : outils triés (attention, nouveauté, gris, à jour), bilan pour Réglages > Outils", async () => {
    await avecNouveaute();
    const vue = await veille.lireVeille();
    expect(vue.outils[0].etat).toBe("nouveaute");
    expect(vue.outils.at(-1)!.etat).toBe("a-jour");
    expect(await veille.bilanVeille()).toMatchObject({ nouveaute: 1, injoignable: 3, ouvertes: 1 });
  });

  it("sans session : refusé", async () => {
    reinitialiserRequete();
    await expect(veille.ignorerNouveaute("x")).rejects.toThrow();
  });
});

describe("migration 15 et menu", () => {
  it("idempotente, sans suppression ; recale la version utilisée après une mise à jour décidée", async () => {
    const d = depots();
    const r1 = await etape15Veille(d, "2026-10-02T00:00:00.000Z");
    expect((r1?.ajoutes as string[]).length).toBe(11);
    expect(await etape15Veille(d, "2026-10-02T00:00:01.000Z")).toBeNull();
    await d.veilleOutils.modifier("veille-remotion", { versionUtilisee: "4.0.400" });
    expect(await etape15Veille(d, "2026-10-02T00:00:02.000Z")).toEqual({ ajoutes: [], versionsMisesAJour: ["Remotion 4.0.400 → 4.0.532"] });
    expect(await d.veilleOutils.compter()).toBe(11);
  });

  it("tuile « Veille » dans le menu Plus et la barre latérale", () => {
    expect(TUILES_PLUS.some((t) => t.href === "/veille" && t.libelle === "Veille")).toBe(true);
    expect(NAV_LATERALE.some((t) => t.href === "/veille")).toBe(true);
  });
});
