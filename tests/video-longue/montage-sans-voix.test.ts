/**
 * UI-4 : montage réel de la vidéo longue SANS VOIX. Dépôts mémoire, rendu factice : N plages + 1 collage sans voix,
 * 0 appel `branchementsReels` / HeyGen / ElevenLabs, coût 0. Réglage éteint : rien ne part.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.setConfig({ testTimeout: 120_000 });

const demandes: Record<string, unknown>[] = [];
const branchementsReels = vi.fn(async () => {
  throw new Error("branchementsReels interdit");
});
const interdit = vi.fn(() => {
  throw new Error("fournisseur de voix interdit");
});
const hotesInterdits: string[] = [];
vi.spyOn(globalThis, "fetch").mockImplementation(async (entree) => {
  const url = String(typeof entree === "object" && "url" in entree ? entree.url : entree);
  if (/heygen|elevenlabs/i.test(url)) {
    hotesInterdits.push(url);
    throw new Error(`appel réseau interdit : ${url}`);
  }
  throw new Error(`réseau interdit : ${url}`);
});
const rendu = {
  soumettre: async (d: { idRendu: string }) => (demandes.push(d as never), { idRendu: d.idRendu }),
  etat: async (id: string) => ({ statut: "termine" as const, sortieCle: ((demandes.find((d) => d.idRendu === id) as { sortie: { cle: string } }).sortie.cle) }),
};
const branchementsReelsSansVoix = vi.fn(async (videoId: string) => ({
  env: "dev" as const,
  montage: {
    rendu: () => rendu,
    signer: async (l: Record<string, string>, d: { cle: string }[]) => ({
      lectures: Object.fromEntries(Object.entries(l).map(([n, c]) => [n, `https://lire/${c}`])),
      depots: Object.fromEntries(d.map((x) => [x.cle, `https://deposer/${x.cle}`])),
    }),
    cle: (c: { videoId: string }, nom: string) => `studio/dev/videos/${c.videoId}/${nom}`,
    lisible: async () => true,
    garde: { delaiMs: 1 },
  },
  videoId,
}));
vi.mock("@/services/tableau-outils", () => ({ branchementsReels, branchementsReelsSansVoix }));
// Vrais modules de voix : toute construction ou lecture lève.
vi.mock("@/fournisseurs/heygen/voix", async (orig) => ({ ...(await orig<object>()), creerFournisseurVoixHeygen: interdit }));
vi.mock("@/fournisseurs/credits/elevenlabs", async (orig) => ({ ...(await orig<object>()), creerLecteurElevenLabs: interdit }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { construireCommande } = await import("@/services/fabrication");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { moteurMontageVideoLongue, ID_MOTEUR_VIDEO_LONGUE } = await import("@/moteurs/montage-video-longue");
await import("@/services/video-longue-branchements");
const { MOTS_PAR_SECONDE_LECTURE } = await import("@/moteurs/montage-video-longue/chaine");
const { cleParametrePlages } = await import("@/services/video-longue-montage");
const { reglageVuAllume, dependancesVideoLongue } = await import("@/services/video-longue-branchements");

import type { CommandeFabrication, Travail } from "@/domaine/types";

const MDP = "essai-ui-4-montage";
const T0 = Date.UTC(2026, 10, 21, 9, 0, 0);
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  demandes.length = 0;
  vi.clearAllMocks();
  await auth.seConnecter(MDP, false);
});

const chapitre = (n: number) => ({ id: `c${n}`, titre: `Chapitre ${n}`, texte: Array.from({ length: 30 }, (_, i) => `mot${n}x${i}`).join(" ") + "." });
async function commande(): Promise<CommandeFabrication> {
  const c = await construireCommande("v-03");
  return { ...c, formatId: "video-longue", moteurId: ID_MOTEUR_VIDEO_LONGUE, ratios: ["16:9"], entrees: { ...c.entrees, videoLongue: { chapitres: [chapitre(1), chapitre(2)], sansVoix: true } } };
}
let horloge = Date.now();
async function allumer(v: boolean, c?: CommandeFabrication) {
  await ecrireParametre("videoLongue.actif", v);
  // Le moteur n'est relié que si le réglage a été VU allumé (relecture au plus toutes les 5 s) : on avance l'horloge.
  horloge += 10_000;
  vi.setSystemTime(horloge);
  dependancesVideoLongue(c ?? ({ videoId: "x", entrees: {} } as CommandeFabrication));
  await vi.waitFor(() => expect(reglageVuAllume()).toBe(v), { timeout: 3000 });
}
async function mener(c: CommandeFabrication, travail: Travail) {
  let t = travail;
  let resultat;
  for (let ms = T0; ms < T0 + 120_000; ms += 500) {
    const r = await moteurMontageVideoLongue.avancer(t, c, ms);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (t.statut === "termine" || t.statut === "echec") break;
  }
  return { travail: t, resultat };
}
const lancer = async (c: CommandeFabrication) => moteurMontageVideoLongue.lancer(c, { travailId: "t-ui4", versionId: "v", titre: "Essai", maintenant: T0 });

describe("UI-4 : montage sans voix", () => {
  it("N plages + 1 collage SANS voix, sortie 16:9, aucun appel de voix, coût 0", async () => {
    await allumer(true);
    const c = await commande();
    const fin = await mener(c, await lancer(c));
    expect(fin.travail.statut).toBe("termine");
    const plages = demandes.filter((d) => d.operation === "composition");
    const collages = demandes.filter((d) => d.operation === "collage-chapitres");
    expect(plages.length).toBeGreaterThanOrEqual(2);
    expect(plages.every((d) => (d.parametres as { mode: string }).mode === "plage")).toBe(true);
    expect(collages).toHaveLength(1);
    const p = collages[0].parametres as { morceaux: string[]; voix?: string };
    expect(p.morceaux).toHaveLength(plages.length);
    expect(p).not.toHaveProperty("voix");
    expect(Object.keys(collages[0].entrees as object)).toEqual(p.morceaux);
    expect(fin.resultat!.sorties.map((s) => `${s.ratio} ${s.resolution} ${s.fichierCle}`)).toEqual([expect.stringMatching(/^16:9 1920x1080 .*video-longue-t-ui4-16x9\.mp4$/)]);
    expect(branchementsReels).not.toHaveBeenCalled();
    expect(interdit).not.toHaveBeenCalled();
    expect(hotesInterdits).toEqual([]);
    expect(fin.resultat!.lignesReelles.every((l) => l.total.centimes === 0)).toBe(true);
  });

  it("deux travaux d'une même vidéo : le travailId est dans le nom, les clés diffèrent (retouche n'écrase pas)", async () => {
    await allumer(true);
    const c = await commande();
    const m = (id: string) => moteurMontageVideoLongue.lancer(c, { travailId: id, versionId: "v", titre: "Essai", maintenant: T0 });
    const a = await mener(c, await m("t-a"));
    const b = await mener(c, await m("t-b"));
    const cleA = a.resultat!.sorties[0].fichierCle;
    const cleB = b.resultat!.sorties[0].fichierCle;
    expect(cleA).toContain("video-longue-t-a-16x9.mp4");
    expect(cleB).toContain("video-longue-t-b-16x9.mp4");
    expect(cleA).not.toBe(cleB);
  });

  it("durée dépassée (1201 s) : refus net, aucune demande de rendu", async () => {
    await allumer(true);
    const c = await commande();
    const mots = Array.from({ length: Math.ceil(1201 * MOTS_PAR_SECONDE_LECTURE) + 10 }, (_, i) => `m${i}`).join(" ") + ".";
    const longue = { ...c, entrees: { ...c.entrees, videoLongue: { chapitres: [{ id: "c1", titre: "Long", texte: mots }], sansVoix: true } } } as CommandeFabrication;
    const fin = await mener(longue, await lancer(longue));
    expect(fin.travail.statut).not.toBe("termine");
    expect(demandes).toHaveLength(0);
  });

  it("réglage allumé après le démarrage : premier lancement, rendus partis", async () => {
    await allumer(false);
    const c = await commande();
    // Le serveur a vu « éteint » ; l'utilisateur allume, SANS laisser le cache se rafraîchir en arrière-plan.
    await ecrireParametre("videoLongue.actif", true);
    const fin = await mener(c, await lancer(c));
    expect(fin.travail.statut).toBe("termine");
    expect(demandes.filter((d) => d.operation === "composition").length).toBeGreaterThanOrEqual(2);
  });

  it("réglage éteint : rien ne part", async () => {
    await allumer(false);
    const c = await commande();
    const fin = await mener(c, await lancer(c));
    expect(fin.travail.statut).not.toBe("termine");
    expect(demandes).toHaveLength(0);
    expect(branchementsReels).not.toHaveBeenCalled();
  });

  it("reprise : une plage notée n'est pas resoumise", async () => {
    await allumer(true);
    const c = await commande();
    await mener(c, await lancer(c));
    const premieres = demandes.filter((d) => d.operation === "composition").length;
    const notees = (await lireParametre<Record<string, unknown>>(cleParametrePlages(c.videoId), {})) as Record<string, unknown>;
    expect(Object.keys(notees)).toHaveLength(premieres);
    demandes.length = 0;
    const t2 = await moteurMontageVideoLongue.lancer(c, { travailId: "t-ui4", versionId: "v2", titre: "Reprise", maintenant: T0 });
    await mener(c, t2);
    expect(demandes.filter((d) => d.operation === "composition")).toHaveLength(0);
    expect(demandes.filter((d) => d.operation === "collage-chapitres")).toHaveLength(1);
  });
});
