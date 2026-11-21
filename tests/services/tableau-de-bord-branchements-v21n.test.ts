/**
 * Raccords réels du tableau de bord (G4-09c-b-1). DOUBLES partout : aucun appel réel, 0 €. DONNÉE ENTIÈREMENT FICTIVE.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { chaineMontageDonnees } from "@/moteurs/montage-donnees/chaine";
import { definitionDonnees } from "@/moteurs/montage-donnees";
import { brancherTableauDeBord, dependancesDonnees, type BranchementsTdb, type PortsTableauDeBord } from "@/services/tableau-de-bord-branchements";

const donnee = {
  version: "tableau-de-bord.v1",
  titre: "Tableau exemple",
  periode: { debut: "2026-01-01", fin: "2026-03-31", libelle: "premier trimestre exemple" },
  source: "Outil exemple",
  indicateurs: [
    { id: "ca-fevrier", libelle: "Chiffre d'affaires de février", valeur: 10200, unite: "€", precision: 0, sens: "hausse-bonne" },
    { id: "ca-mars", libelle: "Chiffre d'affaires de mars", valeur: 12480, unite: "€", precision: 0, sens: "hausse-bonne" },
  ],
  series: [],
  comparaisons: [{ avant: "ca-fevrier", apres: "ca-mars" }],
  alertes: [],
  calculs: [{ id: "evolution", formule: "ca-mars / ca-fevrier * 100 - 100", resultat: (12480 / 10200) * 100 - 100 }],
};

const commande = (surcharge: Record<string, unknown> = {}): CommandeFabrication =>
  ({ videoId: "v-test", origine: "studio", ratios: ["4:5"], distribution: [{ personnageId: "p-1", role: "voix" }], entrees: { montageDonnees: { donnee } }, ...surcharge }) as unknown as CommandeFabrication;

function double(etats: ({ statut: string; sortieCle?: string; erreur?: { message: string } })[] = [{ statut: "en_cours" }, { statut: "termine", sortieCle: "cle/sortie.mp4" }]) {
  const lire = vi.fn(async (e: { texte: string }) => ({ fichierCle: "cle/voix.mp3", dureeSec: 5, mots: e.texte.split(/\s+/).filter(Boolean).map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: (i + 1) * 0.4 })) }));
  const soumettre = vi.fn(async (d: { idRendu: string }) => ({ idRendu: d.idRendu }));
  const suite = [...etats];
  const etat = vi.fn(async () => (suite.length > 1 ? suite.shift()! : suite[0]!));
  const signer = vi.fn(async (lectures: Record<string, string>, depots: { cle: string }[]) => ({
    lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://signe.invalide/${c}`])),
    depots: Object.fromEntries(depots.map((d) => [d.cle, `https://depot.invalide/${d.cle}`])),
  }));
  const b = {
    env: "dev",
    voix: { voix: () => ({ lire }), idVoix: "id-ext", reglages: undefined, tauxUsdEur: 1, fournisseurVoix: "heygen" },
    montage: { rendu: () => ({ soumettre, etat }), signer, cle: (c: { videoId: string }, nom: string) => `studio/dev/videos/${c.videoId}/${nom}`, garde: { delaiMs: 60_000 } },
  } as unknown as BranchementsTdb;
  const branchements = vi.fn(async () => b);
  const reserverCredits = vi.fn(async () => {});
  const engage = vi.fn(async () => 0);
  const narration = vi.fn(async () => null);
  const ports: PortsTableauDeBord = { branchements, reserverCredits, engage, narration: narration as never, lecturesMax: async () => 2, attendre: async () => {}, tarifCentimesParCaractere: 0.03 };
  return { lire, soumettre, etat, signer, branchements, reserverCredits, engage, narration, ports };
}

const ancien = process.env.STUDIO_RENDU_URL;
beforeEach(() => {
  process.env.STUDIO_RENDU_URL = "http://studio-rendu.invalide";
});
afterEach(() => {
  if (ancien === undefined) delete process.env.STUDIO_RENDU_URL;
  else process.env.STUDIO_RENDU_URL = ancien;
});

describe("dépendances : pause et refus", () => {
  it("entrées absentes ou STUDIO_RENDU_URL vide : null (pause, rien n'est payé)", () => {
    const d = double();
    expect(dependancesDonnees(commande({ entrees: {} }), { voixActive: true }, d.ports)).toBeNull();
    process.env.STUDIO_RENDU_URL = "";
    expect(dependancesDonnees(commande(), { voixActive: true }, d.ports)).toBeNull();
    expect(d.branchements).not.toHaveBeenCalled();
  });

  it("personnage absent : refus de l'étape (voix), 0 réservation, 0 lecture", async () => {
    const d = double();
    const deps = dependancesDonnees(commande({ distribution: [] }), { voixActive: true }, d.ports)!;
    expect(deps).not.toBeNull();
    await expect(deps.voix!.lire("Bonjour à tous")).rejects.toThrow(/personnage/);
    expect(d.reserverCredits).not.toHaveBeenCalled();
    expect(d.lire).not.toHaveBeenCalled();
  });

  it("voix non résolue (lève) : refus de l'étape, 0 réservation", async () => {
    const d = double();
    d.ports.branchements = async () => {
      throw new Error("La voix n'est pas reliée.");
    };
    const deps = dependancesDonnees(commande(), { voixActive: true }, d.ports)!;
    await expect(deps.voix!.lire("Bonjour")).rejects.toThrow(/reliée/);
    expect(d.reserverCredits).not.toHaveBeenCalled();
  });

  it("voixActive false : vidéo muette, aucune voix proposée, 0 réservation", async () => {
    const d = double();
    const deps = dependancesDonnees(commande(), { voixActive: false }, d.ports)!;
    expect(deps.voix).toBeUndefined();
    const r = await chaineMontageDonnees(commande().entrees as Record<string, unknown>, { ...(deps.voix ? { voix: deps.voix } : {}) });
    expect(r.ok && r.muette).toBe(true);
    expect(d.reserverCredits).not.toHaveBeenCalled();
  });
});

describe("voix : réservation, plafond par appel et CUMULÉ par vidéo", () => {
  it("réservée UNE fois, AVANT la lecture, plafond cumulé lu avant", async () => {
    const d = double();
    const ordre: string[] = [];
    d.engage.mockImplementation(async () => (ordre.push("engage"), 0));
    d.reserverCredits.mockImplementation(async () => void ordre.push("reserver"));
    d.lire.mockImplementation(async () => (ordre.push("lire"), { fichierCle: "k", dureeSec: 1, mots: [] }));
    const deps = dependancesDonnees(commande(), { voixActive: true }, d.ports)!;
    await deps.voix!.lire("a".repeat(500));
    await deps.voix!.lire("a".repeat(500));
    expect(d.reserverCredits).toHaveBeenCalledTimes(1);
    expect(ordre.slice(0, 3)).toEqual(["engage", "reserver", "lire"]);
    const [origine, e, demande] = d.reserverCredits.mock.calls[0] as unknown as [string, { total: number; fournisseur: string }, { videoId: string; travailId: string }];
    expect(origine).toBe("studio");
    expect(e.total).toBe(30); // ⌈500 × 0,03⌉ × 2 lectures
    expect(demande.travailId.startsWith("tbvoix-")).toBe(true);
  });

  it("au-dessus de 100 ¢ : refus avant toute réservation et toute lecture", async () => {
    const d = double();
    const deps = dependancesDonnees(commande(), { voixActive: true }, d.ports)!;
    await expect(deps.voix!.lire("a".repeat(2000))).rejects.toThrow(/plafond/);
    expect(d.reserverCredits).not.toHaveBeenCalled();
    expect(d.lire).not.toHaveBeenCalled();
  });

  it("2e fabrication au-delà de 100 ¢ cumulés (50 ¢ engagés : passe ; 80 ¢ engagés : refus avant lecture)", async () => {
    for (const engage of [50, 80]) {
      const d = double();
      d.engage.mockImplementation(async () => engage);
      const deps = dependancesDonnees(commande(), { voixActive: true }, d.ports)!;
      // 800 caractères × 0,03 = 24 ¢ × 2 lectures = 48 ¢ : 50 + 48 = 98 passe ; 80 + 48 = 128 > 100 est refusé.
      const texte = "a".repeat(800);
      if (engage === 50) {
        await deps.voix!.lire(texte);
        expect(d.lire).toHaveBeenCalledTimes(1);
      } else {
        await expect(deps.voix!.lire(texte)).rejects.toThrow(/plafond/);
        expect(d.reserverCredits).not.toHaveBeenCalled();
        expect(d.lire).not.toHaveBeenCalled();
      }
    }
  });

  it("déjà engagé illisible : refus sans rien payer", async () => {
    const d = double();
    d.engage.mockImplementation(async () => Number.NaN);
    const deps = dependancesDonnees(commande(), { voixActive: true }, d.ports)!;
    await expect(deps.voix!.lire("Bonjour")).rejects.toThrow(/engagé/);
    expect(d.reserverCredits).not.toHaveBeenCalled();
    expect(d.lire).not.toHaveBeenCalled();
  });
});

describe("narration et chaîne", () => {
  it("narration appelée une fois ; null ⇒ texte gratuit, la chaîne réussit avec la voix réservée une fois", async () => {
    const d = double();
    const deps = dependancesDonnees(commande(), { voixActive: true }, d.ports)!;
    const r = await chaineMontageDonnees(commande().entrees as Record<string, unknown>, { voix: deps.voix, narration: deps.narration as never });
    expect(r.ok).toBe(true);
    expect(d.narration).toHaveBeenCalledTimes(1);
    expect(d.reserverCredits).toHaveBeenCalledTimes(1);
    expect(d.lire).toHaveBeenCalledTimes(1);
  });

  it("retouche : l'état repart après « plan », ni voix ni narration rappelées", () => {
    const d = double();
    dependancesDonnees(commande(), { voixActive: true }, d.ports);
    const def = definitionDonnees(() => null);
    const reprise = { plan: { plan: {} } as never, proprietes: { plan: {} } as never };
    expect(def.reprise!.etatPourRetouche(reprise, {} as never, []).faites).toEqual(["reception", "plan"]);
    expect(d.lire).not.toHaveBeenCalled();
    expect(d.narration).not.toHaveBeenCalled();
    expect(d.reserverCredits).not.toHaveBeenCalled();
  });
});

describe("rendu", () => {
  it("soumis sous un idRendu stable, adresse de la voix SIGNÉE dans les propriétés, entrees vide, suivi en_cours puis termine", async () => {
    const d = double();
    const deps = dependancesDonnees(commande(), { voixActive: true }, d.ports)!;
    const sortie = await deps.monter("4:5", { plan: {} as never, audio: "studio/dev/audio/v-test/voix.mp3" });
    expect(sortie).toEqual({ fichierCle: "cle/sortie.mp4" });
    expect(d.soumettre).toHaveBeenCalledTimes(1);
    const demande = d.soumettre.mock.calls[0]![0] as unknown as { idRendu: string; entrees: unknown; operation: string; parametres: { composition: string; proprietes: { audio?: string } } };
    expect(demande.idRendu).toMatch(/^tdb-tbvoix-v-test-[a-z0-9]+-45-0$/);
    expect(demande.entrees).toEqual({});
    expect(demande.operation).toBe("composition");
    expect(demande.parametres.composition).toBe("MontageDonnees");
    expect(demande.parametres.proprietes.audio).toBe("https://signe.invalide/studio/dev/audio/v-test/voix.mp3");
    expect(d.etat).toHaveBeenCalledTimes(2);
    expect(d.reserverCredits).not.toHaveBeenCalled(); // le rendu ne coûte rien
  });

  it("échec du rendu : refus de l'étape avec une phrase", async () => {
    const d = double([{ statut: "echec", erreur: { message: "Rendu refusé." } }]);
    const deps = dependancesDonnees(commande(), { voixActive: false }, d.ports)!;
    await expect(deps.monter("4:5", { plan: {} as never })).rejects.toThrow(/Rendu refusé/);
  });
});

describe("éteint : personne ne charge le service", () => {
  it("aucun importeur de tableau-de-bord-branchements dans src/ ; brancherTableauDeBord n'est appelée nulle part", () => {
    const racine = join(process.cwd(), "src");
    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const f = join(d, n);
        if (statSync(f).isDirectory()) parcourir(f);
        else if (/\.(ts|tsx)$/.test(n)) fichiers.push(f);
      }
    };
    parcourir(racine);
    const propre = (f: string) => f.endsWith("tableau-de-bord-branchements.ts");
    expect(fichiers.filter((f) => !propre(f) && /tableau-de-bord-branchements/.test(readFileSync(f, "utf8")))).toEqual([]);
    expect(fichiers.filter((f) => !propre(f) && /brancherTableauDeBord\s*\(/.test(readFileSync(f, "utf8")))).toEqual([]);
    expect(typeof brancherTableauDeBord).toBe("function");
  });
});
