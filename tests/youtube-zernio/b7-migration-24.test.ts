import { beforeEach, describe, expect, it } from "vitest";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { etape24ReseauxSansYoutube } = await import("@/services/migrations/etape-24-reseaux-sans-youtube");
const { migrerDonnees } = await import("@/services/migrations");

const REPERE = "migrations.reseaux-sans-youtube";
const SAUVEGARDE = "reseaux.parDefaut.avantLotC";
const CLE = "reseaux.parDefaut";
const T1 = "2026-11-15T08:00:00.000Z";
const T2 = "2026-11-15T09:00:00.000Z";
const QUATRE = ["linkedin", "instagram", "tiktok", "youtube-shorts"];

beforeEach(() => reinitialiserDepots());

const poser = async (valeur: unknown, creeLe = "2026-01-01T00:00:00.000Z") => depots().parametres.enregistrer({ id: CLE, valeur, creeLe, modifieLe: creeLe });
const lire = async (id: string) => (await depots().parametres.obtenir(id)) ?? undefined;
const supprimerBase = async () => {
  await depots().parametres.supprimer(CLE);
  await depots().parametres.supprimer(SAUVEGARDE);
  await depots().parametres.supprimer(REPERE);
};

describe("b7 · migration 24 : YouTube Shorts retiré des réseaux par défaut", () => {
  it("valeur absente : repère seul, rapport null", async () => {
    await supprimerBase();
    expect(await etape24ReseauxSansYoutube(depots(), T1)).toBeNull();
    expect(await lire(REPERE)).toBeDefined();
    expect(await lire(CLE)).toBeUndefined();
    expect(await lire(SAUVEGARDE)).toBeUndefined();
  });

  it("quatre réseaux : sauvegarde exacte, valeur sans YouTube, ordre et creeLe gardés, {retire:1}", async () => {
    await supprimerBase();
    await poser(QUATRE, "2026-02-02T00:00:00.000Z");
    const avant = (await depots().parametres.lister()).length;
    expect(await etape24ReseauxSansYoutube(depots(), T1)).toEqual({ retire: 1 });
    expect((await lire(SAUVEGARDE))?.valeur).toEqual(QUATRE);
    const apres = await lire(CLE);
    expect(apres?.valeur).toEqual(["linkedin", "instagram", "tiktok"]);
    expect(apres?.creeLe).toBe("2026-02-02T00:00:00.000Z");
    expect((await depots().parametres.lister()).length).toBeGreaterThanOrEqual(avant);
    expect(await lire(REPERE)).toBeDefined();
  });

  it("ordre particulier gardé", async () => {
    await supprimerBase();
    await poser(["youtube-shorts", "tiktok", "linkedin"]);
    expect(await etape24ReseauxSansYoutube(depots(), T1)).toEqual({ retire: 1 });
    expect((await lire(CLE))?.valeur).toEqual(["tiktok", "linkedin"]);
    expect((await lire(SAUVEGARDE))?.valeur).toEqual(["youtube-shorts", "tiktok", "linkedin"]);
  });

  it("2e passage : null, rien ne bouge ; le fondateur remet YouTube : un 3e passage le garde", async () => {
    await supprimerBase();
    await poser(QUATRE);
    await etape24ReseauxSansYoutube(depots(), T1);
    const apresUn = JSON.stringify(await depots().parametres.lister());
    expect(await etape24ReseauxSansYoutube(depots(), T2)).toBeNull();
    expect(JSON.stringify(await depots().parametres.lister())).toBe(apresUn);
    await poser(QUATRE);
    expect(await etape24ReseauxSansYoutube(depots(), T2)).toBeNull();
    expect((await lire(CLE))?.valeur).toEqual(QUATRE);
  });

  it("[\"youtube-shorts\"] seul : intact, {seulYoutube:1}, repère posé", async () => {
    await supprimerBase();
    await poser(["youtube-shorts"]);
    expect(await etape24ReseauxSansYoutube(depots(), T1)).toEqual({ seulYoutube: 1 });
    expect((await lire(CLE))?.valeur).toEqual(["youtube-shorts"]);
    expect(await lire(SAUVEGARDE)).toBeUndefined();
    expect(await lire(REPERE)).toBeDefined();
  });

  it("valeur illisible (« x », objet) : intacte, {illisible:1}", async () => {
    for (const v of ["x", {}]) {
      await supprimerBase();
      await poser(v);
      expect(await etape24ReseauxSansYoutube(depots(), T1)).toEqual({ illisible: 1 });
      expect((await lire(CLE))?.valeur).toEqual(v);
      expect(await lire(SAUVEGARDE)).toBeUndefined();
    }
  });

  it("tableau sans youtube-shorts : intact, aucune sauvegarde", async () => {
    await supprimerBase();
    await poser(["linkedin", "tiktok"]);
    expect(await etape24ReseauxSansYoutube(depots(), T1)).toBeNull();
    expect((await lire(CLE))?.valeur).toEqual(["linkedin", "tiktok"]);
    expect(await lire(SAUVEGARDE)).toBeUndefined();
  });

  it("sauvegarde déjà présente : jamais écrasée", async () => {
    await supprimerBase();
    await poser(QUATRE);
    await depots().parametres.enregistrer({ id: SAUVEGARDE, valeur: ["instagram", "youtube-shorts"], creeLe: "x", modifieLe: "x" });
    expect(await etape24ReseauxSansYoutube(depots(), T1)).toEqual({ retire: 1 });
    expect((await lire(SAUVEGARDE))?.valeur).toEqual(["instagram", "youtube-shorts"]);
    expect((await lire(CLE))?.valeur).toEqual(["linkedin", "instagram", "tiktok"]);
  });

  it("DÉSORDRE : deux passages simultanés : même état final, sauvegarde = valeur d'avant", async () => {
    await supprimerBase();
    await poser(QUATRE);
    await Promise.all([etape24ReseauxSansYoutube(depots(), T1), etape24ReseauxSansYoutube(depots(), T2)]);
    expect((await lire(CLE))?.valeur).toEqual(["linkedin", "instagram", "tiktok"]);
    expect((await lire(SAUVEGARDE))?.valeur).toEqual(QUATRE);
    expect(await lire(REPERE)).toBeDefined();
  });

  it("migrerDonnees : lots[\"reseaux-sans-youtube\"] et un événement « migration »", async () => {
    await supprimerBase();
    await poser(QUATRE);
    const rapport = await migrerDonnees(depots(), T1);
    expect(rapport.lots?.["reseaux-sans-youtube"]).toEqual({ retire: 1 });
    const evenements = await depots().evenements.lister((e) => e.type === "migration" && e.id.includes("reseaux-sans-youtube"));
    expect(evenements).toHaveLength(1);
    expect(evenements[0].message).toMatch(/réseaux par défaut/);
    expect((await lire(CLE))?.valeur).toEqual(["linkedin", "instagram", "tiktok"]);
  });
});
