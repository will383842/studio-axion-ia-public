/** L0-09 · annexe « promotion et heure H » : horloge simulée, aucun appel réel. */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { depots, ecrireParametre } = await import("@/services/_commun");
const S = await import("@/services/surveillance-heure-h");
const Z = await import("@/services/zernio");
const { TEXTE_ALERTE_HEURE_H } = await import("@/domaine/notifications-textes");
const { instantParis } = await import("@/lib/horloge-paris");

const JOUR = "2027-03-10";
const HEURE = "10:00";
const H = Date.parse(instantParis(JOUR, HEURE));
const MIN = 60_000;

async function poser(statut: "brouillon" | "valide" | "programme" = "brouillon", cle = "envoi:v1:instagram:v1") {
  const m = new Date(0).toISOString();
  await depots().envoisPlanifies.enregistrer({ id: cle, cle, videoId: "v1", reseau: "instagram", versionCreneau: 1, jour: JOUR, heure: HEURE, statut, creeLe: m, modifieLe: m } as never);
}
const notifs = () => depots().notifications.lister((n) => n.titre === TEXTE_ALERTE_HEURE_H.titre);
async function ouvrir() {
  await ecrireParametre(Z.PARAM_EDITORIALE_ACTIVE, true);
  await ecrireParametre(Z.PARAM_ENVOI_CALENDRIER, true);
}

beforeEach(() => reinitialiserDepots());

describe("L0-09 · annexe heure H", () => {
  it("constantes recopiées de L7-08 : le test échoue si elles diffèrent", () => {
    expect(S.REGLAGE_ENVOI_CALENDRIER).toBe(Z.PARAM_ENVOI_CALENDRIER);
    expect(S.REGLAGE_EDITORIALE_ACTIVE).toBe(Z.PARAM_EDITORIALE_ACTIVE);
  });
  it("seuil de 40 minutes", () => {
    expect(S.SEUIL_ALERTE_HEURE_H_MS).toBe(40 * MIN);
  });
  it("interrupteur éteint (défaut) : aucune annexe, rien d'écrit", async () => {
    await poser();
    expect(await S.surveillerHeureH({ maintenant: () => H - 20 * MIN })).toBe(0);
    expect(await notifs()).toHaveLength(0);
  });
  it("un seul réglage ouvert sur deux : fermé", async () => {
    await poser();
    await ecrireParametre(Z.PARAM_EDITORIALE_ACTIVE, true);
    expect(await S.surveillerHeureH({ maintenant: () => H - 20 * MIN })).toBe(0);
  });
  it("à H-1 h : rien ; à H-40 min : exactement une alerte, cloche + e-mail forcé, pas de push ; ensuite aucune autre", async () => {
    await ouvrir();
    await poser();
    expect(await S.surveillerHeureH({ maintenant: () => H - 60 * MIN })).toBe(0);
    expect(await S.surveillerHeureH({ maintenant: () => H - 40 * MIN })).toBe(1);
    expect(await S.surveillerHeureH({ maintenant: () => H - 30 * MIN })).toBe(0);
    expect(await S.surveillerHeureH({ maintenant: () => H - 20 * MIN })).toBe(0);
    const l = await notifs();
    expect(l).toHaveLength(1);
    expect(l[0]!.envoi?.emailForce).toBe(true);
    expect(l[0]!.titre).not.toMatch(/zernio|publication\./i);
  });
  it("le marqueur persiste : une alerte par créneau et par cause", async () => {
    await ouvrir();
    await poser();
    await poser("valide", "envoi:v2:tiktok:v1");
    expect(await S.surveillerHeureH({ maintenant: () => H - 39 * MIN })).toBe(2);
    expect(await S.surveillerHeureH({ maintenant: () => H - 10 * MIN })).toBe(0);
    expect(await notifs()).toHaveLength(2);
  });
  it("auto-limite de 5 minutes", async () => {
    await ouvrir();
    await S.surveillerHeureH({ maintenant: () => H - 80 * MIN });
    await poser();
    expect(await S.surveillerHeureH({ maintenant: () => H - 78 * MIN })).toBe(0);
    expect(await S.surveillerHeureH({ maintenant: () => H - 39 * MIN })).toBe(1);
  });
  it("déjà programmé ou heure passée : aucune alerte", async () => {
    await ouvrir();
    await poser("programme");
    await poser("brouillon", "envoi:v3:x:v1");
    expect(await S.surveillerHeureH({ maintenant: () => H + 1 * MIN })).toBe(0);
    expect(await notifs()).toHaveLength(0);
  });
  it("une annexe en échec ne casse pas le tour", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(S.surveillerHeureH({ autorisee: async () => { throw new Error("panne"); } })).resolves.toBe(0);
    err.mockRestore();
  });
  it("boucle.ts : diff d'une ligne, hors parcours-mot et branchements-zernio", () => {
    const src = readFileSync("src/services/boucle.ts", "utf8");
    expect(src.match(/surveillance-heure-h/g)).toHaveLength(1);
  });
});
