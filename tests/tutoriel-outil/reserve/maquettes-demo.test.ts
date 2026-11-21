/** RES-2 : les 7 maquettes de démo (zip en mémoire, garde réelle, dépôt unique au stockage). Aucun réseau, 0 €. */
import { inflateRawSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";

const magasin = new Map<string, unknown>();
vi.mock("@/services/_commun", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/services/_commun")>();
  return {
    ...reel,
    lireParametre: async (id: string, defaut: unknown) => (magasin.has(id) ? structuredClone(magasin.get(id)) : defaut),
    ecrireParametre: async (id: string, v: unknown) => void magasin.set(id, structuredClone(v)),
  };
});

import type { ElementReserve } from "@/domaine/tutoriel-reserve";
import type { Fichier } from "@/domaine/types";
import type { StockageFichiers } from "@/fournisseurs/types";
import { lireZip } from "@/lib/zip";
import { MAQUETTES_DEMO, fichierDeMaquetteDemo, zipDeMaquetteDemo } from "@/services/tutoriel-reserve-maquettes";
import { ajouterElementReserve, lireElementReserve } from "@/services/tutoriel-reserve";
import { extraireZipSur, type PortsZip } from "@/services/zip-tutoriel";

const PORTS_OUVERTS: PortsZip = { lireParametre: async () => true, inflate: (d, max) => inflateRawSync(d, { maxOutputLength: max }), journaliser: async () => {} };

beforeEach(() => magasin.clear());

describe("zipDeMaquetteDemo", () => {
  it("7 maquettes figées, ids demo-0N-…", () => {
    expect(MAQUETTES_DEMO.map((m) => m.id)).toEqual(["demo-01-courriels", "demo-02-projets", "demo-03-accueil-24h", "demo-04-clients", "demo-05-stocks", "demo-06-equipe", "demo-07-taches"]);
  });
  it("dossier hors liste (« ../x », chemin absolu, inconnu) : refus, aucune lecture", async () => {
    const lireDossier = vi.fn(async () => []);
    for (const d of ["../x", "../../etc", "/etc", "01-courriels/..", "99-inconnu", ""]) await expect(zipDeMaquetteDemo(d, { lireDossier })).rejects.toMatchObject({ code: "RESERVE_MAQUETTE" });
    expect(lireDossier).not.toHaveBeenCalled();
  });
  it("sans PROVENANCE.md, premier niveau de la maquette (seule la charte est sous charte/)", async () => {
    const z = await zipDeMaquetteDemo("05-stocks");
    const noms = lireZip(z).map((f) => f.nom);
    expect(noms).toContain("index.html");
    expect(noms).not.toContain("PROVENANCE.md");
    expect(noms.filter((n) => n.includes("/")).sort()).toEqual(["charte/charte.css", "charte/manrope-latin.woff2"]);
  });
  it("PROVENANCE.md rendu par la lecture est tout de même écarté", async () => {
    const z = await zipDeMaquetteDemo("01-courriels", { lireDossier: async () => [{ nom: "PROVENANCE.md", donnees: new Uint8Array([1]) }, { nom: "a.html", donnees: new Uint8Array([2]) }] });
    expect(lireZip(z).map((f) => f.nom)).toEqual(["a.html"]);
  });
});

describe("les 7 vrais dossiers face à la garde réelle (extraireZipSur, interrupteur simulé true)", () => {
  for (const m of MAQUETTES_DEMO) {
    it(`${m.dossier} : acceptée, aucun refus`, async () => {
      const r = await extraireZipSur(await zipDeMaquetteDemo(m.dossier), { attestationImages: false }, PORTS_OUVERTS);
      expect(r.rapport.refus, JSON.stringify(r.rapport.refus)).toEqual([]);
      expect(r.ok).toBe(true);
    });
    it(`${m.dossier} : charte et police dans le zip, aucun « ../ »`, async () => {
      const fichiers = lireZip(await zipDeMaquetteDemo(m.dossier));
      const noms = fichiers.map((f) => f.nom);
      expect(noms).toContain("charte/charte.css");
      expect(noms).toContain("charte/manrope-latin.woff2");
      expect(noms).not.toContain("charte/controle.ts");
      expect(noms).not.toContain("charte/noms-neutres.json");
      for (const f of fichiers.filter((x) => /\.(html|css)$/.test(x.nom))) expect(new TextDecoder().decode(f.donnees), f.nom).not.toContain("../");
    });
  }
  it("police absente des deux endroits : RESERVE_MAQUETTE, rien n'est zippé", async () => {
    const lireDossier = async (chemin: string) => {
      const { readdir, readFile } = await import("node:fs/promises");
      const noms = (await readdir(chemin, { withFileTypes: true })).filter((e) => e.isFile() && e.name !== "manrope-latin.woff2");
      return Promise.all(noms.map(async (e) => ({ nom: e.name, donnees: new Uint8Array(await readFile(`${chemin}/${e.name}`)) })));
    };
    await expect(zipDeMaquetteDemo("05-stocks", { lireDossier })).rejects.toMatchObject({ code: "RESERVE_MAQUETTE" });
  });
});

function banc() {
  const compte = { preparer: 0, put: 0, confirmer: 0, enregistres: [] as Fichier[] };
  let simulation = false;
  const stockage = {
    preparerDepot: async (d: { fichierId: string }) => {
      compte.preparer++;
      return { cleStockage: `studio/dev/entree/tutoriel-reserve/${d.fichierId}.zip`, urlDepot: "" };
    },
    urlDepotDuree: async () => "https://depot.exemple/put",
    confirmerDepot: async () => (compte.confirmer++, { ok: true, sha256: "ab" }),
  } as unknown as StockageFichiers;
  const dep = {
    zip: async () => new Uint8Array([1, 2, 3]),
    stockage: async () => (simulation ? ({ ...stockage, urlDepotDuree: undefined } as unknown as StockageFichiers) : stockage),
    televerser: async () => void compte.put++,
    fichier: async (id: string) => compte.enregistres.find((f) => f.id === id) ?? null,
    enregistrer: async (f: Fichier) => (compte.enregistres.push(f), f),
  };
  return { compte, dep, simuler: () => (simulation = true) };
}
const nouvelElement = () => ajouterElementReserve({ id: "demo-05-stocks", titre: "Stocks", source: { type: "maquette-demo", dossier: "05-stocks" }, fin: "aucune", ajouteLe: "2026-11-01T00:00:00.000Z", ajoutePar: "amorcage" });

describe("fichierDeMaquetteDemo", () => {
  it("deux appels (séquentiels ou simultanés) : un seul dépôt, même fichier, noté sur l'élément", async () => {
    const e = await nouvelElement();
    const { compte, dep } = banc();
    const [a, b] = await Promise.all([fichierDeMaquetteDemo(e, dep), fichierDeMaquetteDemo(e, dep)]);
    const c = await fichierDeMaquetteDemo(e, dep); // `e` périmé : l'élément relu fait foi
    expect(a.fichierId).toBe(b.fichierId);
    expect(c.fichierId).toBe(a.fichierId);
    expect(compte).toMatchObject({ preparer: 1, put: 1, confirmer: 1 });
    const f = compte.enregistres[0]!;
    expect(f).toMatchObject({ origine: "depot", statut: "pret", mime: "application/zip", taille: 3 });
    expect(f.cleStockage?.split("/").slice(2, 4)).toEqual(["entree", "tutoriel-reserve"]);
    const lu = (await lireElementReserve("demo-05-stocks")) as ElementReserve;
    expect(lu.etat).toBe("en_reserve");
    expect(lu.source).toMatchObject({ type: "maquette-demo", fichierId: a.fichierId });
  });
  it("stockage sans dépôt signé (simulation) : RESERVE_STOCKAGE, rien n'est écrit", async () => {
    const e = await nouvelElement();
    const { compte, dep, simuler } = banc();
    simuler();
    await expect(fichierDeMaquetteDemo(e, dep)).rejects.toMatchObject({ code: "RESERVE_STOCKAGE" });
    expect(compte).toMatchObject({ preparer: 0, put: 0, enregistres: [] });
    expect(((await lireElementReserve("demo-05-stocks")) as ElementReserve).source).toEqual({ type: "maquette-demo", dossier: "05-stocks" });
  });
  it("élément qui n'est pas une démo : refus", async () => {
    const e = await ajouterElementReserve({ id: "res-ideeidee1", titre: "x", source: { type: "idee", phrase: "Une idée de tutoriel" }, fin: "aucune", ajouteLe: "2026-11-01T00:00:00.000Z", ajoutePar: "fondateur" });
    await expect(fichierDeMaquetteDemo(e, banc().dep)).rejects.toMatchObject({ code: "RESERVE_MAQUETTE" });
  });
});
