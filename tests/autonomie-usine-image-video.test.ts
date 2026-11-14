/**
 * AUT-D : frein image→vidéo sous plafond de l'Usine (plan USINE-AUTONOMIE-SOUS-PLAFOND, lot D).
 * L'accord de script absent ne refuse plus si `accordSansClicPour` (indicatif OU Usine avec autonomie allumée) ;
 * la réservation qui suit (`verifierEtReserverSelonOrigine`, plafond du lot C) est ici observée par un double.
 * Dépôts en mémoire, réservation simulée, zéro réseau, 0 €.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErreurStudio } from "@/services/_commun";

const reservations: Array<{ origine: unknown; accord: unknown }> = [];
let refus: ErreurStudio | null = null;

vi.mock("@/fournisseurs", async (orig) => {
  const m = await orig<typeof import("@/fournisseurs")>();
  return { ...m, resoudreFournisseur: ((nom: string, ...r: unknown[]) => (nom === "voix" ? { mode: "reel", capacites: {} } : (m.resoudreFournisseur as (...a: unknown[]) => unknown)(nom, ...r))) as typeof m.resoudreFournisseur };
});
vi.mock("@/services/credits", async (orig) => {
  const m = await orig<typeof import("@/services/credits")>();
  return {
    ...m,
    verifierEtReserverSelonOrigine: async (origine: unknown, _e: unknown, accord: unknown) => {
      reservations.push({ origine, accord });
      if (refus) throw refus;
    },
  };
});

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { depots } = await import("@/donnees/memoire");
const { outilsImageVideo, PHRASE_ACCORD_ABSENT_IV, PREFIXE_DECISIONS } = await import("@/services/image-video");

const VIDEO = "v-aut-d";
const DEPENSE = { videoId: VIDEO, appelId: "iv-voix-1-1", etape: "voix" as const, fournisseur: "heygen" as const, centimes: 40, caracteres: 900 };

async function outils(origine?: unknown) {
  await ecrireParametre(`${PREFIXE_DECISIONS}${VIDEO}`, { script: { proposition: "p", choixFormules: {} } }); // aucun accord de prix
  return outilsImageVideo({ videoId: VIDEO, travailId: "t-aut-d", production: false, accordDuScriptExige: true, lireImageSource: async () => null, ...(origine !== undefined ? { origine: origine as never } : {}) });
}
const allumer = (plafondCents: number) => ecrireParametre("usine.autonomie", { actif: true, plafondCents, le: "2026-11-14T08:00:00.000Z", version: 1 });

beforeEach(() => {
  reinitialiserDepots();
  reservations.length = 0;
  refus = null;
});

describe("AUT-D : accord de script absent, vidéo d'origine Usine", () => {
  it("autonomie éteinte (défaut) : refus inchangé PHRASE_ACCORD_ABSENT_IV, rien réservé, décision non avancée", async () => {
    const o = await outils("usine");
    expect(await o.budget.reserver(DEPENSE)).toEqual({ ok: false, message: PHRASE_ACCORD_ABSENT_IV });
    expect(await o.decisions!.script!()).toBeNull();
    expect(reservations).toEqual([]);
  });

  it("autonomie éteinte explicitement, à 0 ou illisible : même refus", async () => {
    for (const reglage of [{ actif: false, plafondCents: 5000, version: 1 }, { actif: true, plafondCents: 0, version: 1 }, "n'importe quoi"]) {
      await ecrireParametre("usine.autonomie", reglage);
      const o = await outils("usine");
      expect(await o.budget.reserver(DEPENSE)).toEqual({ ok: false, message: PHRASE_ACCORD_ABSENT_IV });
    }
    expect(reservations).toEqual([]);
  });

  it("allumée sous plafond : plus de refus d'accord, la voix est réservée (origine Usine) et la décision avance", async () => {
    await allumer(5000);
    const o = await outils("usine");
    expect(await o.budget.reserver(DEPENSE)).toEqual({ ok: true });
    expect(reservations).toEqual([{ origine: "usine", accord: 40 }]);
    expect(await o.decisions!.script!()).toMatchObject({ proposition: "p" });
  });

  it("allumée mais au plafond : la réservation (plafond) lève, l'erreur remonte, aucune voix partie", async () => {
    await allumer(5000);
    refus = new ErreurStudio("USINE_PLAFOND_ATTEINT", "Plafond du mois de l'Usine atteint.");
    const o = await outils("usine");
    await expect(o.budget.reserver(DEPENSE)).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
    expect(reservations).toHaveLength(1);
  });

  it("origine illisible (null, « Usine », objet, vide) : normaliserOrigine la tient pour Usine (échec fermé) : sans clic seulement si allumée", async () => {
    const { accordSansClicPour } = await import("@/services/autonomie-usine");
    for (const bizarre of [null, "Usine", {}, "", 7]) {
      expect(await accordSansClicPour(bizarre, VIDEO)).toBe(false);
      await allumer(5000);
      expect(await accordSansClicPour(bizarre, VIDEO)).toBe(true);
      await ecrireParametre("usine.autonomie", { actif: false, plafondCents: 5000, version: 1 });
    }
  });
});

describe("AUT-D : Studio inchangé", () => {
  it("Studio (ou origine absente, vidéo sans version) : autonomie allumée sans effet, le budget indicatif vaut accord comme avant", async () => {
    await allumer(5000);
    for (const o of [await outils("studio"), await outils()]) expect(await o.budget.reserver(DEPENSE)).toEqual({ ok: true });
    expect(reservations).toEqual([{ origine: "studio", accord: 40 }, { origine: undefined, accord: 40 }]);
  });

  it("Studio : la décision du script avance sans accord de prix (historique)", async () => {
    const o = await outils("studio");
    expect(await o.decisions!.script!()).toMatchObject({ proposition: "p" });
    expect(await lireParametre(`${PREFIXE_DECISIONS}${VIDEO}`, null)).not.toBeNull();
  });
});

/** Version la plus récente de la vidéo, commande d'origine donnée (lue par `origineDeLaVideo`). */
async function versionDeLaVideo(origine: string) {
  const d = new Date("2026-11-14T08:00:00.000Z");
  await depots().versions.enregistrer({ id: `ver-${VIDEO}`, videoId: VIDEO, numero: 1, commande: { origine, entrees: {} }, creeLe: d, modifieLe: d } as never);
}

describe("AUT-D correction : une seule origine pour l'accord et la réservation", () => {
  it("cas B (commande sans origine, vidéo d'origine « usine »), allumée : la réservation reçoit « usine », jamais undefined", async () => {
    await versionDeLaVideo("usine");
    await allumer(1); // plafond 1 centime, voix 40 c : le plafond de l'Usine doit être celui qui s'applique
    refus = new ErreurStudio("USINE_PLAFOND_ATTEINT", "Plafond du mois de l'Usine atteint.");
    const o = await outils();
    await expect(o.budget.reserver(DEPENSE)).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
    expect(reservations).toEqual([{ origine: "usine", accord: 40 }]);
    expect(reservations.some((r) => r.origine === undefined)).toBe(false);
  });

  it("cas B, allumée sous plafond : réservée avec « usine » et la décision du script avance", async () => {
    await versionDeLaVideo("usine");
    await allumer(5000);
    const o = await outils();
    expect(await o.budget.reserver(DEPENSE)).toEqual({ ok: true });
    expect(reservations).toEqual([{ origine: "usine", accord: 40 }]);
    expect(await o.decisions!.script!()).toMatchObject({ proposition: "p" });
  });

  it("cas B, interrupteur éteint : PHRASE_ACCORD_ABSENT_IV, rien réservé", async () => {
    await versionDeLaVideo("usine");
    const o = await outils();
    expect(await o.budget.reserver(DEPENSE)).toEqual({ ok: false, message: PHRASE_ACCORD_ABSENT_IV });
    expect(await o.decisions!.script!()).toBeNull();
    expect(reservations).toEqual([]);
  });

  it("origine « Usine » (casse), allumée : accord sans clic ET réservation sous l'origine donnée (normalisée en Usine par la caisse)", async () => {
    await allumer(5000);
    const o = await outils("Usine");
    expect(await o.budget.reserver(DEPENSE)).toEqual({ ok: true });
    expect(reservations).toHaveLength(1);
    expect(reservations[0].origine).toBe("Usine");
  });

  it("« Usine » (casse), éteint : PHRASE_ACCORD_ABSENT_IV si l'indicatif ne couvre pas, rien réservé de plus", async () => {
    const o = await outils("Usine");
    const r = await o.budget.reserver(DEPENSE);
    if (r.ok === false) expect(r).toEqual({ ok: false, message: PHRASE_ACCORD_ABSENT_IV });
    expect(reservations.every((x) => x.origine === "Usine")).toBe(true);
  });

  it("Studio explicite, allumé, vidéo d'origine « usine » par ailleurs : inchangé, réservation « studio »", async () => {
    await versionDeLaVideo("usine");
    await allumer(5000);
    const o = await outils("studio");
    expect(await o.budget.reserver(DEPENSE)).toEqual({ ok: true });
    expect(reservations).toEqual([{ origine: "studio", accord: 40 }]);
  });
});
