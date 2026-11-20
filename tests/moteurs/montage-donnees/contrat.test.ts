/**
 * G4-09b : le moteur « tableau de bord » est inscrit, son format est MASQUÉ, et sans dépendances il reste en pause
 * sans aucun appel ni dépense. DONNÉE ENTIÈREMENT FICTIVE.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { preparerMotDePasse } from "../../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.setConfig({ testTimeout: 120_000 });

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { construireCommande } = await import("@/services/fabrication");
const { testerMoteurVideo } = await import("@/moteurs/contrat");
const { creerMoteurDonnees, moteurMontageDonnees, ID_MOTEUR_DONNEES, COMPOSITION_DONNEES } = await import("@/moteurs/montage-donnees");
const { IDS_MOTEURS, moteurExiste } = await import("@/moteurs/ids");
const { obtenirMoteur, listerMoteurs } = await import("@/moteurs");
const { listerFormats, listerFormatsNavigation, trouverFormat } = await import("@/formats");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { MoteurVideo } from "@/moteurs/types";
import type { DependancesDonnees } from "@/moteurs/montage-donnees";

const MDP = "essai-g4-09b-moteur";
const T0 = Date.UTC(2026, 10, 20, 9, 0, 0);

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

const donnee = {
  version: "tableau-de-bord.v1",
  titre: "Tableau exemple",
  periode: { debut: "2026-01-01", fin: "2026-03-31", libelle: "premier trimestre exemple" },
  source: "Outil exemple",
  indicateurs: [
    { id: "ca-fevrier", libelle: "Chiffre d'affaires de février", valeur: 10200, unite: "€", precision: 0, sens: "hausse-bonne" },
    { id: "ca-mars", libelle: "Chiffre d'affaires de mars", valeur: 12480, unite: "€", precision: 0, sens: "hausse-bonne" },
    { id: "visites", libelle: "Visites du site", valeur: 3450, unite: "visites", precision: 0, sens: "hausse-bonne" },
  ],
  series: [],
  comparaisons: [{ avant: "ca-fevrier", apres: "ca-mars" }],
  alertes: [],
  calculs: [],
};

async function commande(montageDonnees: unknown = { donnee, muette: true }): Promise<CommandeFabrication> {
  const c = await construireCommande("v-03");
  return { ...c, formatId: "tableau-de-bord", moteurId: ID_MOTEUR_DONNEES, ratios: ["4:5", "9:16", "1:1", "16:9"], entrees: { ...c.entrees, montageDonnees } };
}

function doubles() {
  const appels = { voix: 0, calage: 0, montages: 0 };
  const deps: DependancesDonnees = {
    voix: {
      lire: async (texte: string) => {
        appels.voix += 1;
        const mots = texte.split(/\s+/).filter(Boolean).map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: (i + 1) * 0.4 }));
        return { audio: "https://exemple.invalide/voix.mp3", dureeSec: mots.length * 0.4, mots };
      },
    },
    calage: { caler: (e) => ((appels.calage += 1), e.mots) },
    monter: async (ratio: string) => ((appels.montages += 1), { fichierCle: `essai/donnees/${ratio.replace(":", "x")}.mp4` }),
  };
  return { appels, deps };
}

const d = doubles();
testerMoteurVideo(creerMoteurDonnees(() => d.deps), () => commande(), { sansPrix: true });

async function mener(moteur: MoteurVideo, c: CommandeFabrication, travail: Travail) {
  let t = travail;
  let resultat;
  for (let ms = T0; ms < T0 + 60_000; ms += 500) {
    const r = await moteur.avancer(t, c, ms);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (t.statut === "termine" || t.statut === "echec") break;
  }
  return { travail: t, resultat };
}

describe("G4-09b · a) inscription : moteur inscrit, format masqué, absent de la navigation", () => {
  it("le moteur est inscrit une seule fois, avec ses quatre formats et sa composition", () => {
    expect(IDS_MOTEURS.filter((i) => i === "montage-donnees")).toHaveLength(1);
    expect(moteurExiste("montage-donnees")).toBe(true);
    expect(obtenirMoteur("montage-donnees")).toBe(moteurMontageDonnees);
    expect(listerMoteurs()).toContain(moteurMontageDonnees);
    expect([...moteurMontageDonnees.capacites.ratios].sort()).toEqual(["16:9", "1:1", "4:5", "9:16"]);
    expect(COMPOSITION_DONNEES).toBe("MontageDonnees");
  });

  it("le format tableau-de-bord est masqué, sans adresse de saisie, absent des listes et de la navigation", () => {
    const f = trouverFormat("tableau-de-bord")!;
    expect(f.statut).toBe("masque");
    expect(f.moteur).toBe("montage-donnees");
    expect(f.ouvertDansLaNavigation).toBeUndefined();
    expect(f.adresseCreation).toBeUndefined();
    expect(f.ratios.every((r) => moteurMontageDonnees.capacites.ratios.includes(r))).toBe(true);
    expect(listerFormats({ inclureMasques: true }).some((x) => x.id === "tableau-de-bord")).toBe(true);
    expect(listerFormats().some((x) => x.id === "tableau-de-bord")).toBe(false);
    expect(listerFormatsNavigation().some((x) => x.id === "tableau-de-bord")).toBe(false);
  });
});

describe("G4-09b · b) dépendances absentes : pause, 0 appel à tout port", () => {
  it("en file, sans échec, sans résultat, 0 €, aucun port touché", async () => {
    const { appels, deps } = doubles();
    let demandes = 0;
    const moteur = creerMoteurDonnees(() => ((demandes += 1), null));
    const c = await commande({ donnee });
    const t = await moteur.lancer(c, { travailId: "t-pause", versionId: "v", titre: "Essai", maintenant: T0 });
    expect(t.statut).toBe("en_file");
    expect(t.etapes.every((e) => e.statut === "en_attente")).toBe(true);
    const r = await moteur.avancer(t, c, T0 + 5000);
    expect(r.travail).toEqual(t);
    expect(r.resultat).toBeUndefined();
    expect((await moteur.estimer(c)).total.centimes).toBe(0);
    expect(demandes).toBeGreaterThan(0);
    expect(appels).toEqual({ voix: 0, calage: 0, montages: 0 });
    void deps;
    // Le moteur inscrit n'a aucune dépendance : même pause.
    const t2 = await moteurMontageDonnees.lancer(c, { travailId: "t-pause-2", versionId: "v", titre: "Essai", maintenant: T0 });
    expect(t2.statut).toBe("en_file");
    expect((await moteurMontageDonnees.avancer(t2, c, T0 + 5000)).travail).toEqual(t2);
  });

  it("branché sur des doubles muets : la vidéo se fait sans voix (0 appel voix), 0 €", async () => {
    const { appels, deps } = doubles();
    const moteur = creerMoteurDonnees(() => deps);
    const c = await commande();
    const fin = await mener(moteur, c, await moteur.lancer(c, { travailId: "t-ok", versionId: "v", titre: "Essai", maintenant: T0 }));
    expect(fin.travail.statut).toBe("termine");
    expect(appels.voix).toBe(0);
    expect(appels.montages).toBe(4);
    expect(fin.resultat!.lignesReelles.every((l) => l.total.centimes === 0)).toBe(true);
  });

  it("donnée absente : échec clair non réessayable, aucun port touché", async () => {
    const { appels, deps } = doubles();
    const moteur = creerMoteurDonnees(() => deps);
    const c = await commande(null);
    const fin = await mener(moteur, c, await moteur.lancer(c, { travailId: "t-vide", versionId: "v", titre: "Essai", maintenant: T0 }));
    expect(fin.travail.statut).toBe("echec");
    expect(fin.travail.erreur?.reessayable).toBe(false);
    expect(appels).toEqual({ voix: 0, calage: 0, montages: 0 });
  });
});

describe("G4-09b · c) garde texte : aucun fournisseur, aucune dépense, aucune IA", () => {
  const source = readFileSync(join(process.cwd(), "src/moteurs/montage-donnees/index.ts"), "utf8");
  const imports = source.split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l)).join("\n");
  it("n'importe ni fournisseurs/, ni credits|budget|depense|plafond, ni narration-tableau-claude, ni lecture-capture-claude", () => {
    expect(imports).not.toMatch(/fournisseurs\//);
    expect(imports).not.toMatch(/credits|budget|depense|plafond/i);
    expect(imports).not.toMatch(/narration-tableau-claude|lecture-capture-claude|narration-claude/);
    expect(source).not.toMatch(/portNarrationClaude/);
  });
});
