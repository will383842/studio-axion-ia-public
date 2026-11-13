/**
 * GV2-22 : surveiller la fabrication. Faux dépôts en mémoire, aucun réseau.
 *  - l'entrée en attente d'un outil prévient le fondateur UNE fois (pas de rafale) ;
 *  - la sonde de santé voit les travaux figés (deux nombres, sans effet sur `ok`) ;
 *  - une erreur de programmation échoue tout de suite ; une coupure réseau reste passagère ;
 *  - les dossiers temporaires de plus de 24 h sont purgés, jamais hors du dossier donné.
 */
import { mkdir, mkdtemp, readdir, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Travail } from "@/domaine/types";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const travaux = await import("@/services/travaux");
const { etatSante } = await import("@/services/sante");
const { purgerTemporaires } = await import("@/services/nettoyage-temporaires");

beforeEach(() => {
  reinitialiserDepots();
});

function unTravail(id: string, modifieLe: string, statut: Travail["statut"] = "en_cours"): Travail {
  return { id, type: "fabrication", cibleId: "v-03", versionId: `ver-${id}`, titre: "Essai", etapes: [], statut, progression: 10, tentatives: 0, cleIdempotence: `k-${id}`, fournisseurUtilise: "heygen", creeLe: modifieLe, modifieLe };
}

async function panne(t: Travail, erreur: unknown, instant: number) {
  const actuel = (await depots().travaux.obtenir(t.id))!;
  await travaux.ecrirePanne({ travail: actuel, commande: undefined as never, moteur: {} as never }, erreur, instant);
  return (await depots().travaux.obtenir(t.id))!;
}

const notifsInfo = async () => (await depots().notifications.lister()).filter((n) => n.type === "info" && /attend un outil/.test(n.message ?? ""));

describe("GV2-22 · entrée en attente d'un outil", () => {
  it("la quatrième panne de suite crée UNE notification info, les suivantes aucune", async () => {
    const t = unTravail("trav-attente", new Date().toISOString());
    await depots().travaux.enregistrer(t);
    let instant = Date.now();
    for (let i = 1; i <= 3; i++) {
      await panne(t, new Error("indisponible"), (instant += 60_000));
      expect(await notifsInfo()).toHaveLength(0);
    }
    const apres = await panne(t, new Error("indisponible"), (instant += 600_000));
    expect(apres.reprise?.attenteDepuis).toBeTruthy();
    const n = await notifsInfo();
    expect(n).toHaveLength(1);
    expect(n[0].message).toMatch(/^Votre vidéo « .+ » attend un outil \(.+\) : elle reprendra seule\.$/);
    await panne(t, new Error("indisponible"), (instant += 600_000));
    await panne(t, new Error("indisponible"), (instant += 600_000));
    expect(await notifsInfo()).toHaveLength(1);
  });
});

describe("GV2-22 · santé des travaux", () => {
  it("rend travauxFiges et plusVieuxEnCoursMin sans changer ok", async () => {
    const vide = await etatSante();
    expect(vide).toMatchObject({ ok: true, travauxFiges: 0, plusVieuxEnCoursMin: 0 });
    const il = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    await depots().travaux.enregistrer(unTravail("t-vieux", il(180)));
    await depots().travaux.enregistrer(unTravail("t-recent", il(10)));
    await depots().travaux.enregistrer(unTravail("t-fini", il(600), "termine"));
    const s = await etatSante();
    expect(s.travauxFiges).toBe(1);
    expect(s.plusVieuxEnCoursMin).toBeGreaterThanOrEqual(179);
    expect(s.plusVieuxEnCoursMin).toBeLessThan(185);
    expect(s.ok).toBe(true);
  });
});

describe("GV2-22 · erreurs de programmation et pannes réseau", () => {
  async function lancer(erreur: unknown) {
    const t = unTravail("trav-prog", new Date().toISOString());
    await depots().travaux.enregistrer(t);
    return panne(t, erreur, Date.now());
  }
  it("une RangeError échoue au premier tour, avec notification d'échec", async () => {
    const avant = (await depots().notifications.lister()).filter((n) => n.type === "echec").length;
    const apres = await lancer(new RangeError("Invalid array length"));
    expect(apres.statut).toBe("echec");
    expect((await depots().notifications.lister()).filter((n) => n.type === "echec")).toHaveLength(avant + 1);
  });
  it("une TypeError de code échoue au premier tour", async () => {
    expect((await lancer(new TypeError("x is not a function"))).statut).toBe("echec");
  });
  it.each([
    ["fetch failed", undefined],
    ["coupure du réseau", undefined],
    ["network error", undefined],
    ["socket hang up", undefined],
    ["connect ECONNREFUSED", undefined],
    ["read ETIMEDOUT", undefined],
    ["boum", Object.assign(new Error("connect"), { code: "ECONNRESET" })],
  ])("TypeError(%s) reste une panne passagère", async (message, cause) => {
    const apres = await lancer(new TypeError(message, cause ? { cause } : undefined));
    expect(apres.statut).toBe("en_cours");
    expect(apres.reprise?.echecs).toBe(1);
  });
  it("une erreur simple (Error) reste passagère", async () => {
    expect((await lancer(new Error("indisponible"))).statut).toBe("en_cours");
  });
});

describe("GV2-22 · purge des dossiers temporaires", () => {
  it("efface un iv-son- de 25 h, garde un récent et un dossier sans préfixe, nettoie mini-videos", async () => {
    const racine = await mkdtemp(join(tmpdir(), "gv222-"));
    try {
      const vieux = new Date(Date.now() - 25 * 3600_000);
      const faire = async (chemin: string, date?: Date) => {
        await mkdir(join(racine, chemin), { recursive: true });
        if (date) await utimes(join(racine, chemin), date, date);
      };
      await faire("iv-son-vieux", vieux);
      await faire("iv-image-vieux", vieux);
      await faire("iv-final-vieux", vieux);
      await faire("iv-son-recent");
      await faire("autre-vieux", vieux);
      await faire("mini-videos/ancien", vieux);
      await faire("mini-videos/recent");
      await purgerTemporaires(Date.now(), racine);
      expect((await readdir(racine)).sort()).toEqual(["autre-vieux", "iv-son-recent", "mini-videos"]);
      expect(await readdir(join(racine, "mini-videos"))).toEqual(["recent"]);
    } finally {
      await rm(racine, { recursive: true, force: true });
    }
  });
  it("ne lève jamais (dossier absent)", async () => {
    await expect(purgerTemporaires(Date.now(), join(tmpdir(), "gv222-absent-xyz"))).resolves.toBeUndefined();
  });
});
