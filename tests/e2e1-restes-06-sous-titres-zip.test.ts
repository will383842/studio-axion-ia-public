/**
 * E2E-1 générateur n° 6 (MAJEUR, 03/10) — « Tout le sujet » (zip) : les .srt faisaient 0 octet et les .vtt n'avaient
 * que l'en-tête. Attendu : des sous-titres complets, tirés du texte affiché (critère G6), dans le zip ET dans le
 * téléchargement de la fiche vidéo. Fabrication simulée (aucun appel payant).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const boucle = await import("@/services/boucle");
const fr = await import("@/services/fabrication-reseaux");
const tel = await import("@/services/telechargements");
const { texteScript } = await import("@/domaine/derivations");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");

const MDP = "e2e1-restes-sous-titres";

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
  const f = await fr.fabriquerLesN(r.scriptMaitreId, { operationId: "op-st", lancer: true });
  for (let i = 0; i < 200; i++) {
    if ((await Promise.all(f.videoIds.map((v) => depots().videos.obtenir(v)))).every((v) => v?.statut === "prete")) return { id: r.scriptMaitreId, videoIds: f.videoIds };
    vi.setSystemTime(Date.now() + 5_000);
    await boucle.tourDeBoucle();
  }
  throw new Error("la fabrication n'avance pas");
}

const motsDe = (t: string) => t.toLowerCase().match(/[\p{L}\p{N}'’-]+/gu) ?? [];

describe("E2E-1 n° 6 · sous-titres du zip", () => {
  it("chaque .srt et .vtt du zip est rempli, mot pour mot depuis le texte affiché", async () => {
    const { id, videoIds } = await sujetFabrique();
    const contenu = await tel.contenuArchiveSujet(id);
    const srt = contenu.entrees.filter((e) => e.nom.endsWith(".srt"));
    const vtt = contenu.entrees.filter((e) => e.nom.endsWith(".vtt"));
    expect(srt).toHaveLength(videoIds.length);
    expect(vtt).toHaveLength(videoIds.length);
    for (const e of [...srt, ...vtt]) {
      if (!("contenu" in e)) throw new Error("sous-titres sans contenu");
      expect(e.contenu.length, e.nom).toBeGreaterThan(40);
      expect(e.contenu).toMatch(/\d\d:\d\d:\d\d[,.]\d{3} --> \d\d:\d\d:\d\d[,.]\d{3}/);
    }
    // Les mots des sous-titres d'une vidéo sont ceux de son texte, dans l'ordre.
    const video = (await depots().videos.obtenir(videoIds[0]))!;
    const script = (await depots().scripts.obtenir(video.scriptId!))!;
    const premier = srt.find((e) => e.nom.startsWith(video.titre.split(" ")[0]))! as { contenu: string };
    const lus = motsDe(premier.contenu.split(/\r?\n/).filter((l) => l && !/^\d+$/.test(l) && !/-->/.test(l)).join(" "));
    expect(lus.join(" ")).toBe(motsDe(texteScript(script.blocs)).join(" "));
  });

  it("la fiche vidéo propose et sert aussi des sous-titres remplis", async () => {
    const { videoIds } = await sujetFabrique();
    const pub = await import("@/services/publications");
    const liens = await pub.telechargementsVideo(videoIds[0]);
    expect(liens?.sousTitres?.srt).toBeTruthy();
    const { GET } = await import("@/app/api/sous-titres/[id]/route");
    const rep = await GET({ nextUrl: new URL(`http://x/api/sous-titres/${videoIds[0]}?format=srt`) } as never, { params: Promise.resolve({ id: videoIds[0] }) } as never);
    expect(rep.status).toBe(200);
    expect((await rep.text()).length).toBeGreaterThan(40);
  });
});
