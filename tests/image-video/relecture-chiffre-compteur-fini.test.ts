/**
 * 11/11/2026 : l'image de contrôle d'un chiffre-choc est prise APRÈS la fin du compteur (finSec + 0,3 s), jamais pendant
 * qu'il défile (« chiffre affiché 44 au lieu de 45 »).
 */
import { describe, expect, it } from "vitest";
import { instantsClesIV } from "@/moteurs/montage-image-video/relecture-finale";

const ligne = (finSec: number, finPlan = 4): never => ({
  dureeSec: 8,
  plans: [{ id: "p1", debut: 0, fin: finPlan, sorte: "texte", scene: "chiffre", ecran: "e01", textes: ["45 %"] }, { id: "p2", debut: finPlan, fin: 8, sorte: "texte", scene: "phrase-choc", ecran: "e02", textes: [] }],
  evenements: [{ id: "c1", genre: "compteur", instantSec: 0.5, pas: 3, finSec, visible: true, chiffres: [] }],
  segmentFin: { debut: 8, muet: true },
  blocs: [],
}) as never;

const chiffre = (l: never) => instantsClesIV(l, { noeuds: [] }).filter((i) => i.sorte === "chiffre");

describe("instantsClesIV · image du chiffre après la fin du compteur", () => {
  it("compteur fini à début + 1,2 s : l'instant est au moins finSec + 0,3 s", () => {
    const r = chiffre(ligne(1.2));
    expect(r).toHaveLength(1);
    expect(r[0]!.instantSec).toBeGreaterThanOrEqual(1.5 - 1e-6);
  });
  it("compteur long (fini à 2,2 s) : l'instant n'est pas pris pendant le défilement", () => {
    const r = chiffre(ligne(2.2));
    expect(r).toHaveLength(1);
    expect(r[0]!.instantSec).toBeGreaterThanOrEqual(2.5 - 1e-6);
    expect(r[0]!.instantSec).toBeLessThanOrEqual(4 - 0.05 + 1e-6);
  });
  it("transition (caméra) juste après la fin du compteur : l'instant reste au moins finSec + 0,3 s", () => {
    const l = ligne(1.2) as unknown as { evenements: unknown[] };
    l.evenements.push({ id: "k1", genre: "camera", instantSec: 1.3, visible: true });
    const r = chiffre(l as never);
    expect(r).toHaveLength(1);
    expect(r[0]!.instantSec).toBeGreaterThanOrEqual(1.5 - 1e-6);
  });
  it("aucune place avant la fin du plan : pas d'image de chiffre", () => {
    expect(chiffre(ligne(3.9))).toHaveLength(0);
  });
});
