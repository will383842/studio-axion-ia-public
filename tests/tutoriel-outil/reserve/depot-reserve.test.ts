/** RES-2 : dépôt dans la réserve (garde du zip réelle, interrupteurs, attestation, amorçage). Doubles, 0 €. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
const session = vi.hoisted(() => ({ ouverte: true }));
vi.mock("@/services/auth", () => ({
  exigerSession: vi.fn(async () => {
    if (!session.ouverte) throw new Error("session exigée");
    return {};
  }),
}));
const magasin = new Map<string, unknown>();
vi.mock("@/services/_commun", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/services/_commun")>();
  return {
    ...reel,
    lireParametre: async (id: string, defaut: unknown) => (magasin.has(id) ? structuredClone(magasin.get(id)) : defaut),
    ecrireParametre: async (id: string, v: unknown) => void magasin.set(id, structuredClone(v)),
  };
});

import { inflateRawSync } from "node:zlib";
import { TAILLE_ZIP_MAX } from "@/moteurs/montage-tutoriel-outil/securite-entrees";
import { creerZip } from "@/lib/zip";
import { ErreurStudio } from "@/services/_commun";
import { ajouterDossierReserve, ajouterIdeeReserve, amorcerMaquettesDemo, remettreEnReserve, retirerDeLaReserve, type DependancesAjoutReserve } from "@/services/tutoriel-reserve-depot";
import { changerEtatReserve, lireElementReserve, listerReserve, prendreSuivantReserve } from "@/services/tutoriel-reserve";
import { extraireZipSur, type PortsZip } from "@/services/zip-tutoriel";

const TOUT = { formulaire: true, dossier: true, phrase: true };
const PORTS: PortsZip = { lireParametre: async () => true, inflate: (d, m) => inflateRawSync(d, { maxOutputLength: m }), journaliser: async () => {} };
const enc = (s: string) => new TextEncoder().encode(s);
const zipSain = () => creerZip([{ nom: "index.html", donnees: enc("<html><body>Bonjour</body></html>") }]);
let n = 0;

function banc(o: { sw?: typeof TOUT; zip?: Uint8Array; taille?: number } = {}) {
  const c = { octets: 0, attestations: [] as boolean[] };
  const dep: DependancesAjoutReserve = {
    interrupteurs: async () => o.sw ?? TOUT,
    fichier: async (id) => ({ id, nom: "Mon-dossier_ventes.zip", taille: o.taille ?? 1000, cleStockage: `studio/dev/entree/e1/${id}.zip` }),
    octets: async () => (c.octets++, o.zip ?? zipSain()),
    extraire: async (z, opts) => (c.attestations.push(opts.attestationImages), extraireZipSur(z, opts, PORTS)),
    nouvelId: () => `res-t${String(++n).padStart(6, "0")}`,
  };
  return { c, dep };
}
const rien = () => expect(magasin.size).toBe(0);

beforeEach(() => {
  magasin.clear();
  session.ouverte = true;
});

describe("ajouterDossierReserve", () => {
  it("interrupteurs éteints : refus, rien n'est écrit ni lu", async () => {
    for (const sw of [{ ...TOUT, formulaire: false }, { ...TOUT, dossier: false }]) {
      const { c, dep } = banc({ sw });
      expect(await ajouterDossierReserve({ fichierId: "f-abc", attestationImages: true }, dep)).toMatchObject({ statut: "refuse" });
      expect(c.octets).toBe(0);
    }
    rien();
  });
  it("session exigée", async () => {
    session.ouverte = false;
    await expect(ajouterDossierReserve({ fichierId: "f-abc", attestationImages: true }, banc().dep)).rejects.toThrow("session");
    rien();
  });
  it("dossier sain : rangé (référence et attestation seulement), titre du nom, fondateur", async () => {
    const { dep } = banc();
    const r = await ajouterDossierReserve({ fichierId: "f-abc", attestationImages: true, script: "  Mon script  ", fin: "prendre-rendez-vous" }, dep);
    expect(r.statut).toBe("ok");
    if (r.statut !== "ok") return;
    expect(r.element).toMatchObject({ etat: "en_reserve", titre: "Mon dossier ventes", ajoutePar: "fondateur", script: "Mon script", fin: "prendre-rendez-vous", source: { type: "dossier", fichierId: "f-abc", nomFichier: "Mon-dossier_ventes.zip", attestationImages: true } });
    expect(JSON.stringify([...magasin.values()])).not.toContain("Bonjour");
  });
  it("attestation « true » (chaîne), 1, absente : vaut faux", async () => {
    for (const a of ["true", 1, undefined, null]) {
      const { c, dep } = banc();
      const r = await ajouterDossierReserve({ fichierId: "f-abc", attestationImages: a }, dep);
      expect(c.attestations).toEqual([false]);
      expect(r.statut === "ok" && r.element.source.type === "dossier" && r.element.source.attestationImages).toBe(false);
    }
  });
  it("zip-slip : refus avec rapport, rien n'est rangé", async () => {
    const { dep } = banc({ zip: creerZip([{ nom: "../evil.html", donnees: enc("<html></html>") }]) });
    const r = await ajouterDossierReserve({ fichierId: "f-abc", attestationImages: true }, dep);
    expect(r).toMatchObject({ statut: "refuse", rapport: { refus: expect.any(Array) } });
    expect(r.statut === "refuse" && r.rapport!.refus.length).toBeGreaterThan(0);
    rien();
  });
  it("trop gros : refus, octets jamais lus ; archive trop grosse lue : refus, rien rangé", async () => {
    const a = banc({ taille: TAILLE_ZIP_MAX + 1 });
    expect(await ajouterDossierReserve({ fichierId: "f-abc", attestationImages: true }, a.dep)).toMatchObject({ statut: "refuse" });
    expect(a.c.octets).toBe(0);
    const b = banc();
    b.dep.octets = async () => {
      throw new ErreurStudio("FICHIER_TROP_GROS", "Trop gros.");
    };
    expect(await ajouterDossierReserve({ fichierId: "f-abc", attestationImages: true }, b.dep)).toMatchObject({ statut: "refuse", phrase: "Trop gros." });
    rien();
  });
  it("script trop long, fin inconnue, fichier absent : refus, rien n'est rangé", async () => {
    const { dep } = banc();
    expect((await ajouterDossierReserve({ fichierId: "f-abc", attestationImages: true, script: "x".repeat(8001) }, dep)).statut).toBe("refuse");
    expect((await ajouterDossierReserve({ fichierId: "f-abc", attestationImages: true, fin: "autre" }, dep)).statut).toBe("refuse");
    expect((await ajouterDossierReserve({ fichierId: 12, attestationImages: true }, dep)).statut).toBe("refuse");
    rien();
  });
  it("script vide = absent", async () => {
    const r = await ajouterDossierReserve({ fichierId: "f-abc", attestationImages: true, script: "   " }, banc().dep);
    expect(r.statut === "ok" && "script" in r.element).toBe(false);
  });
});

describe("ajouterIdeeReserve", () => {
  it("interrupteurs éteints : refus, rien n'est écrit", async () => {
    for (const sw of [{ ...TOUT, formulaire: false }, { ...TOUT, phrase: false }]) {
      expect((await ajouterIdeeReserve({ phrase: "Un tableau de bord pour un atelier" }, { interrupteurs: async () => sw })).statut).toBe("refuse");
    }
    rien();
  });
  it("bornes de la phrase", async () => {
    const dep = { interrupteurs: async () => TOUT };
    for (const p of ["court", "x".repeat(301), 42, undefined]) expect((await ajouterIdeeReserve({ phrase: p }, dep)).statut).toBe("refuse");
    rien();
    expect((await ajouterIdeeReserve({ phrase: "x".repeat(300) }, dep)).statut).toBe("ok");
  });
  it("idée rangée", async () => {
    const r = await ajouterIdeeReserve({ phrase: "  Un tableau de bord pour un atelier ", script: "S" }, { interrupteurs: async () => TOUT });
    expect(r).toMatchObject({ statut: "ok", element: { source: { type: "idee", phrase: "Un tableau de bord pour un atelier" }, titre: "Un tableau de bord pour un atelier", script: "S", fin: "aucune", ajoutePar: "fondateur" } });
  });
});

describe("amorçage, retrait, remise", () => {
  it("amorçage deux fois : 7 éléments, puis 0 ajouté ; session exigée", async () => {
    expect(await amorcerMaquettesDemo()).toEqual({ ajoutes: 7 });
    expect(await amorcerMaquettesDemo()).toEqual({ ajoutes: 0 });
    const l = await listerReserve();
    expect(l).toHaveLength(7);
    expect(l.every((e) => e.ajoutePar === "amorcage" && e.etat === "en_reserve" && e.source.type === "maquette-demo" && !("fichierId" in e.source))).toBe(true);
    session.ouverte = false;
    await expect(amorcerMaquettesDemo()).rejects.toThrow("session");
  });
  it("démo retirée puis amorçage : elle reste retirée ; remise possible", async () => {
    await amorcerMaquettesDemo();
    expect((await retirerDeLaReserve("demo-02-projets")).statut).toBe("ok");
    expect(await amorcerMaquettesDemo()).toEqual({ ajoutes: 0 });
    expect((await lireElementReserve("demo-02-projets"))?.etat).toBe("retire");
    expect((await remettreEnReserve("demo-02-projets")).statut).toBe("ok");
    expect((await lireElementReserve("demo-02-projets"))?.etat).toBe("en_reserve");
  });
  it("session exigée pour ajouterIdeeReserve, retirerDeLaReserve, remettreEnReserve : rien n'est écrit", async () => {
    session.ouverte = false;
    await expect(ajouterIdeeReserve({ phrase: "Un tableau de bord pour un atelier" }, { interrupteurs: async () => TOUT })).rejects.toThrow("session");
    await expect(retirerDeLaReserve("demo-01-courriels")).rejects.toThrow("session");
    await expect(remettreEnReserve("demo-01-courriels")).rejects.toThrow("session");
    rien();
  });
  it("transitions interdites et ids inconnus : refus lisible", async () => {
    await amorcerMaquettesDemo();
    expect((await remettreEnReserve("demo-01-courriels")).statut).toBe("refuse"); // déjà en réserve
    for (const x of ["../x", 12, null, "res-inconnu1"]) expect((await retirerDeLaReserve(x)).statut).toBe("refuse");
    await prendreSuivantReserve({ cle: "cle-de-test-1", declencheur: "essai" });
    expect((await retirerDeLaReserve("demo-01-courriels")).statut).toBe("refuse"); // pris
    await changerEtatReserve("demo-01-courriels", "a_revoir");
    expect((await retirerDeLaReserve("demo-01-courriels")).statut).toBe("ok");
  });
});
