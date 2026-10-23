/**
 * Suppression définitive · provenance du script (relecture PR #334, défaut bloquant n° 1).
 * Un script n'est effacé avec la vidéo QUE s'il porte la marque `creePourVideoId` de cette vidéo, posée à sa création
 * (copie assemblée d'une version, script écrit depuis le brouillon). Sans marque (script de « Mes scripts », ancien
 * script) : gardé, même s'il est plus récent que la vidéo. Simulation, 0 €.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const bg = await import("@/services/boucle-generation");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
import type { Rush } from "@/domaine/types";

const MDP = "essai-suppression-provenance";
const ID = "v-01";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
});
afterEach(() => bg.arreterBoucleGeneration());

/** Une version par réseau validée (générateur en simulation). */
async function versionValidee() {
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
  const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const });
  if (!r.ok) throw new Error("lancement");
  await bg.tourBoucleGeneration();
  const v = (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId))[0];
  await depots().variantes.modifier(v.id, { etat: "validee" });
  return { scriptMaitreId: r.scriptMaitreId, variante: (await depots().variantes.obtenir(v.id))! };
}

describe("suppression définitive · provenance du script", () => {
  it("un script de « Mes scripts » choisi APRÈS la création du brouillon est gardé (scénario de la sonde)", async () => {
    const d = depots();
    const v = (await d.videos.obtenir(ID))!;
    await d.videos.modifier(ID, { creeLe: "2026-10-01T00:00:00.000Z" });
    const base = (await d.scripts.obtenir(v.scriptId!))!;
    await d.scripts.enregistrer({ ...base, id: "script-mes", reference: false, favori: false, scriptMaitreId: undefined, creeLe: "2026-10-05T00:00:00.000Z" });
    await d.videos.modifier(ID, { scriptId: "script-mes" });
    await videos.supprimerVideoDefinitivement(ID);
    expect(await d.scripts.obtenir("script-mes")).not.toBeNull();
  });

  it("un script rattaché à un sujet, sans marque, est gardé", async () => {
    const d = depots();
    const v = (await d.videos.obtenir(ID))!;
    const base = (await d.scripts.obtenir(v.scriptId!))!;
    await d.scripts.enregistrer({ ...base, id: "script-corps", reference: false, favori: false, scriptMaitreId: "sm-x", creeLe: "2099-01-01T00:00:00.000Z" });
    await d.videos.modifier(ID, { scriptId: "script-corps" });
    await videos.supprimerVideoDefinitivement(ID);
    expect(await d.scripts.obtenir("script-corps")).not.toBeNull();
  });

  it("un script marqué pour UNE AUTRE vidéo n'est pas effacé avec celle-ci", async () => {
    const d = depots();
    const v = (await d.videos.obtenir(ID))!;
    const base = (await d.scripts.obtenir(v.scriptId!))!;
    await d.scripts.enregistrer({ ...base, id: "script-autre", reference: false, favori: false, creePourVideoId: "v-03" });
    await d.videos.modifier(ID, { scriptId: "script-autre" });
    await videos.supprimerVideoDefinitivement(ID);
    expect(await d.scripts.obtenir("script-autre")).not.toBeNull();
  });

  it("le script écrit depuis le brouillon porte la marque et part avec la vidéo", async () => {
    const d = depots();
    const v = (await d.videos.obtenir(ID))!;
    await d.scripts.modifier(v.scriptId!, { reference: true });
    const ecrit = await videos.enregistrerScriptDuBrouillon(ID, (await d.scripts.obtenir(v.scriptId!))!.blocs);
    expect(ecrit.id).not.toBe(v.scriptId);
    expect(ecrit.creePourVideoId).toBe(ID);
    await videos.supprimerVideoDefinitivement(ID);
    expect(await d.scripts.obtenir(ecrit.id)).toBeNull();
    expect(await d.scripts.obtenir(v.scriptId!)).not.toBeNull();
  });

  it("copie assemblée de « Fabriquer cette version » : marquée, effacée avec la vidéo ; le corps commun reste", async () => {
    const { variante } = await versionValidee();
    const { videoId } = await bg.fabriquerVariante(variante.id, { operationId: "op-prov", lancer: false });
    const d = depots();
    const copies = await d.scripts.lister((s) => s.creePourVideoId === videoId);
    expect(copies).toHaveLength(1);
    expect(copies[0].id).not.toBe(variante.scriptId);
    await videos.supprimerVideoDefinitivement(videoId);
    expect(await d.scripts.obtenir(copies[0].id)).toBeNull();
    expect(await d.scripts.obtenir(variante.scriptId)).not.toBeNull();
  });

  it("copies assemblées de « Fabriquer les N » et du tournage : marquées pour leur vidéo", async () => {
    const { scriptMaitreId } = await versionValidee();
    const fr = await import("@/services/fabrication-reseaux");
    const n = await fr.fabriquerLesN(scriptMaitreId, { operationId: "op-n", lancer: false });
    for (const id of [n.mereVideoId, ...n.videoIds]) expect(await depots().scripts.compter((s) => s.creePourVideoId === id), id).toBe(1);

    reinitialiserDepots();
    await auth.seConnecter(MDP, false);
    const { variante } = await versionValidee();
    const { ajouterPriseAVideo } = await import("@/services/tournage");
    const videoId = await ajouterPriseAVideo(variante, { id: "rush-x", fichierId: "fic-x", dureeSec: 3 } as Rush);
    expect(await depots().scripts.compter((s) => s.creePourVideoId === videoId)).toBe(1);
  });
});
