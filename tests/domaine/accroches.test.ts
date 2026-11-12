import { describe, expect, it } from "vitest";
import { classeurAccroches } from "@/domaine/mesures/accroches";
import type { RangVideo, VideoMesuree } from "@/domaine/mesures-rangs";

function rang(code: string, ouverture: string | undefined, position: number): RangVideo {
  const video = { publicationId: code, varianteId: code, code, titre: `Vidéo ${code}`, date: "2026-01-01", reseau: "instagram", formatId: "f", ouverture, resultats: {} } as unknown as VideoMesuree;
  return { video, rang: 1, sur: 10, position, parIndicateur: {} };
}

describe("classeur d'accroches et fiabilité", () => {
  it("un groupe de moins de 3 vidéos est « trop tôt »", () => {
    const c = classeurAccroches([rang("a", "question", 0.9), rang("b", "question", 0.8)]);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ famille: "question", nombre: 2, fiabilite: "trop tôt" });
    expect(c[0].positionMediane).toBeUndefined();
  });

  it("à partir de 3 vidéos, le groupe est lu (position médiane)", () => {
    const c = classeurAccroches([rang("a", "chiffre-choc", 0.2), rang("b", "chiffre-choc", 0.6), rang("c", "chiffre-choc", 1)]);
    expect(c[0]).toMatchObject({ famille: "chiffre-choc", nombre: 3, fiabilite: "lisible", positionMediane: 0.6 });
  });

  it("les groupes lisibles passent devant, les « trop tôt » ferment la liste", () => {
    const c = classeurAccroches([rang("a", "question", 1), rang("b", "promesse", 0.1), rang("c", "promesse", 0.2), rang("d", "promesse", 0.3)]);
    expect(c.map((g) => g.famille)).toEqual(["promesse", "question"]);
  });

  it("ignore les vidéos sans type d'ouverture et accepte une liste vide", () => {
    expect(classeurAccroches([rang("a", undefined, 0.5)])).toEqual([]);
    expect(classeurAccroches([])).toEqual([]);
  });
});
