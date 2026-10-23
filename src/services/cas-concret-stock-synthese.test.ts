import { describe, expect, it } from "vitest";
import type { Video } from "@/domaine/types";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import type { CasConcret } from "@/formats/cas-concret/cas";
import type { Rangement } from "@/formats/cas-concret/stock-metiers/schema";
import type { ScriptValide } from "@/moteurs/montage-cas-concret/script-valide";
import { construireStockCas } from "./cas-concret-stock";
import { filtrerStock, syntheseStock } from "./cas-concret-stock-synthese";

const SECTEURS = ["IN", "CO", "SA"];
const TAILLES = ["TPE", "PME", "ETI"] as const;
const OFFRES = ["integration", "formation"] as const;

/** 30 cas fabriqués : secteur = i mod 3, taille = (i + 1) mod 3, offre = i mod 2. */
function jeu(n = 30): { catalogue: CasConcret[]; rangement: Record<string, Rangement> } {
  const base = CATALOGUE[0]!;
  const catalogue: CasConcret[] = [];
  const rangement: Record<string, Rangement> = {};
  for (let i = 0; i < n; i++) {
    const id = `cas-fab-${i}`;
    catalogue.push({ ...base, id, titre: `Cas ${i}`, offre: OFFRES[i % 2]! } as CasConcret);
    rangement[id] = { fiche: `${SECTEURS[i % 3]}-${String(i + 1).padStart(2, "0")}`, secteur: SECTEURS[i % 3]!, metier: "metier-test", metierNom: "Métier", taille: TAILLES[(i + 1) % 3]!, socle: "S01", inventaire: [], niveauPreuve: "lu-dans-le-code", douleur: "douleur-test", casUsage: null, voisinCatalogue: null, angle: null };
  }
  return { catalogue, rangement };
}

const script = (c: CasConcret): ScriptValide => ({ versionCas: c.version, ecrans: [], valideLe: "2026-10-01", numero: 1 }) as unknown as ScriptValide;

let compteur = 0;
function video(casId: string, extra: Partial<Video> = {}): Video {
  return { id: `v-${casId}-${compteur++}`, formatId: "cas-concret", statut: "prete", modifieLe: "2026-10-10T00:00:00Z", entrees: { casConcret: { casId } }, ...extra } as unknown as Video;
}

describe("synthèse du stock (K2)", () => {
  const { catalogue, rangement } = jeu();
  // Scripts validés : cas 0 à 9. Vidéos qui comptent : cas 0-4 (prête) et cas 5 (à la corbeille, prête avant). Cas 6 : brouillon, cas 7 : démonstration, ne comptent pas.
  const scripts = Object.fromEntries(catalogue.slice(0, 10).map((c) => [c.id, script(c)]));
  const videos = [
    ...catalogue.slice(0, 5).map((c) => video(c.id)),
    video("cas-fab-5", { statut: "archivee", statutAvantArchive: "prete", corbeilleLe: "2026-10-15T00:00:00Z" }),
    video("cas-fab-6", { statut: "brouillon" }),
    video("cas-fab-7", { statut: "prete", estDemo: true }),
  ];
  const lignes = construireStockCas({ scripts, videos, catalogue, rangement, catalogueScripts: () => undefined });

  it("compteurs justes sur 30 cas", () => {
    const s = syntheseStock(lignes);
    expect(s.total).toBe(30);
    expect(s.parSecteur).toEqual({ IN: 10, CO: 10, SA: 10 });
    expect(s.parTaille).toEqual({ PME: 10, ETI: 10, TPE: 10 });
    expect(s.parOffre).toEqual({ integration: 15, formation: 15 });
    expect(s.parEtat).toEqual({ restant: 24, traite: 6, valide: 10, "a-valider": 20 });
  });

  it("une vidéo à la corbeille compte encore ; brouillon et démonstration non", () => {
    const par = Object.fromEntries(lignes.map((l) => [l.casId, l.videos.comptees]));
    expect(par["cas-fab-5"]).toBe(1);
    expect(par["cas-fab-6"]).toBe(0);
    expect(par["cas-fab-7"]).toBe(0);
  });

  it("une pause « à valider » (échec marqué enAttenteValidation) compte ; un échec sans ce champ non", () => {
    const l = construireStockCas({ scripts: {}, videos: [video("cas-fab-0", { statut: "echec", enAttenteValidation: true } as Partial<Video>), video("cas-fab-1", { statut: "echec" })], catalogue, rangement, catalogueScripts: () => undefined });
    expect(l.find((x) => x.casId === "cas-fab-0")!.videos.comptees).toBe(1);
    expect(l.find((x) => x.casId === "cas-fab-1")!.videos.comptees).toBe(0);
  });

  it("sans rangement, un cas ne compte ni en secteur ni en taille", () => {
    expect(lignes[3]!.rangement?.secteur).toBe("IN");
    const sans = construireStockCas({ scripts: {}, videos: [], catalogue, rangement: {}, catalogueScripts: () => undefined });
    const s = syntheseStock(sans);
    expect(s.parSecteur).toEqual({});
    expect(s.parTaille).toEqual({});
    expect(s.total).toBe(30);
  });

  it("filtres combinés", () => {
    expect(filtrerStock(lignes, {})).toHaveLength(30);
    expect(filtrerStock(lignes, { secteur: "IN" })).toHaveLength(10);
    // IN : i multiple de 3 ; integration : i pair ; restant : ni 0-4 ni 5 -> i dans {6, 12, 18, 24}
    const f = filtrerStock(lignes, { secteur: "IN", offre: "integration", etat: "restant" });
    expect(f.map((l) => l.casId)).toEqual(["cas-fab-6", "cas-fab-12", "cas-fab-18", "cas-fab-24"]);
    expect(filtrerStock(lignes, { etat: "valide", taille: "PME" }).every((l) => l.script.valide && l.rangement?.taille === "PME")).toBe(true);
    expect(filtrerStock(lignes, { secteur: "ZZ" })).toEqual([]);
  });
});
