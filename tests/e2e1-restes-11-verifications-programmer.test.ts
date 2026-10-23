/**
 * E2E-1 générateur n° 11 (MAJEUR, 03/10) — « Programmer les N » refusait avec « Cochez les 5 vérifications » sans dire
 * quelle version ni quoi, et il fallait ouvrir les 5 vidéos. Désormais la feuille montre, version par version, ce qui
 * manque (le BON nombre, 4 cases quand la mention est coupée) et permet de cocher sur place. Tout en simulation.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined, refresh: () => undefined }),
  usePathname: () => "/ecrire/sujets/s1",
  useSearchParams: () => new URLSearchParams(),
  redirect: () => undefined,
  notFound: () => undefined,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const boucle = await import("@/services/boucle");
const fr = await import("@/services/fabrication-reseaux");
const pub = await import("@/services/publications");
const actions = await import("@/app/(studio)/mesures/actions");
const { VerificationsDeLaVersion } = await import("@/components/generateur/FicheSujet");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");

const MDP = "e2e1-restes-verifs";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});

afterEach(() => {
  bg.arreterBoucleGeneration();
  vi.useRealTimers();
});

async function sujetFabrique() {
  vi.useFakeTimers({ toFake: ["Date"] });
  const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" });
  if (!r.ok) throw new Error("lancement");
  await bg.tourBoucleGeneration();
  const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
  if (m?.exception?.source === "proposition-machine") await bg.validerException(r.scriptMaitreId, "c-est-juste");
  await bg.validerVariantes((await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId)).map((v) => v.id));
  const f = await fr.fabriquerLesN(r.scriptMaitreId, { operationId: "op-verifs", lancer: true });
  for (let i = 0; i < 200; i++) {
    if ((await Promise.all(f.videoIds.map((v) => depots().videos.obtenir(v)))).every((v) => v?.statut === "prete")) return { id: r.scriptMaitreId, videoIds: f.videoIds };
    vi.setSystemTime(Date.now() + 5_000);
    await boucle.tourDeBoucle();
  }
  throw new Error("la fabrication n'avance pas");
}

describe("E2E-1 n° 11 · ce qui manque avant de programmer, version par version", () => {
  it("la feuille lit ce qui manque par version (4 cases, mention coupée) et une case se coche sur place", async () => {
    const { id, videoIds } = await sujetFabrique();
    const r = await actions.verificationsAvantProgrammerAction(id);
    if (!r.ok) throw new Error(r.message);
    expect(r.donnees).toHaveLength(videoIds.length);
    for (const v of r.donnees) {
      expect(v.pasPrete).toBe(false);
      expect(v.total).toBe(4);
      expect(v.manquantes.map((m) => m.cle)).not.toContain("mentionIA");
      expect(v.manquantes.length).toBeGreaterThan(0);
    }
    // Cocher sur place : toutes les cases d'UNE version → elle n'a plus rien qui manque, les autres si.
    const premiere = r.donnees[0];
    for (const m of premiere.manquantes) {
      const c = await actions.cocherVerificationAction(id, premiere.videoId, m.cle, true);
      expect(c.ok).toBe(true);
    }
    const apres = await pub.verificationsAvantProgrammer(id);
    expect(apres.find((x) => x.videoId === premiere.videoId)!.manquantes).toEqual([]);
    expect(apres.filter((x) => x.videoId !== premiere.videoId).every((x) => x.manquantes.length > 0)).toBe(true);
  });

  it("l'écran dit le bon nombre, nomme les cases et mène à la vidéo ; rien quand tout est coché", () => {
    const v = { varianteId: "v1", code: "0002-AV-TT", reseau: "tiktok" as const, videoId: "vid1", total: 4, manquantes: [{ cle: "droits" as const, libelle: "Droits" }], licenceBloque: false, pasPrete: false };
    const html = renderToStaticMarkup(createElement(VerificationsDeLaVersion, { v, onCocher: () => undefined }));
    expect(html).toContain("Il reste 1 vérification sur 4");
    expect(html).toContain("Droits");
    expect(html).toContain('role="checkbox"');
    expect(html).toContain('href="/videos/vid1"');
    expect(renderToStaticMarkup(createElement(VerificationsDeLaVersion, { v: { ...v, manquantes: [] }, onCocher: () => undefined }))).toBe("");
  });
});
