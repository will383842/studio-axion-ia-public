/**
 * Lot D · étape 1 : règles DATÉES ET SOURCÉES pour Shorts / Reels jusqu'à 3 min ; hypothèses non sourcées à part.
 */
import { describe, expect, it } from "vitest";
import { REGLES_DATEES_SEMEES } from "@/donnees/generateur/regles-datees";
import { ecritureReseau, regleIdsEcriture } from "@/reseaux/ecriture";

const regle = (id: string) => REGLES_DATEES_SEMEES.find((r) => r.id === id);

describe("lot D · règles 3 minutes", () => {
  it("Shorts : règle sourcée, datée, avec lien", () => {
    const r = regle("ys-shorts-3min-2024");
    expect(r?.reseau).toBe("youtube-shorts");
    expect(r?.niveau).not.toBe("hypothese");
    expect(r?.source.url).toMatch(/^https:\/\//);
    expect(r?.source.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r?.texte).toMatch(/3 minutes/);
  });
  it("Reels : jour exact de l'annonce incertain (sources divergentes), date de l'article gardée", () => {
    const r = regle("ig-reels-3min-2025");
    expect(r?.reseau).toBe("instagram");
    expect(r?.niveau).not.toBe("hypothese");
    expect(r?.source.url).toMatch(/^https:\/\//);
    expect(r?.source.date).toBe("2025-01-21");
    expect(r?.texte).toContain("janvier 2025 (annonce vers le 20/01, sources secondaires divergentes)");
    expect(r?.texte).not.toMatch(/21\/01\/2025/);
  });
  it("Shorts : pas de lien court (?p=), adresse complète de l'article ou page d'aide officielle", () => {
    const u = regle("ys-shorts-3min-2024")?.source.url ?? "";
    expect(u).not.toMatch(/\?p=\d+/);
    expect(new URL(u).pathname.length).toBeGreaterThan(1);
  });
  it("le plafond de durée de chaque réseau cite sa règle", () => {
    expect(ecritureReseau("youtube-shorts").dureeMaxSec).toEqual({ valeur: 180, regleId: "ys-shorts-3min-2024" });
    expect(ecritureReseau("instagram").dureeMaxSec).toEqual({ valeur: 180, regleId: "ig-reels-3min-2025" });
  });
  it("Shorts : la règle ys-duree-histoire est citée dans les particularités", () => {
    const p = ecritureReseau("youtube-shorts").particularites.find((x) => x.regleId === "ys-duree-histoire");
    expect(p?.valeur).toBe("Durée = le temps de raconter l'histoire.");
  });
  it("tous les identifiants cités par la table existent dans les règles semées", () => {
    for (const id of regleIdsEcriture()) expect(regle(id), id).toBeDefined();
  });
});

describe("lot D · hypothèses non sourcées (restent OFF)", () => {
  it("voix accélérée TikTok et résultat d'abord : niveau hypothèse", () => {
    expect(regle("hyp-voix-acceleree-tiktok")?.niveau).toBe("hypothese");
    expect(regle("hyp-resultat-d-abord")?.niveau).toBe("hypothese");
  });
});
