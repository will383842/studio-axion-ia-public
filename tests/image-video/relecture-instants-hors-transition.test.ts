/**
 * 26/10/2026 : un instant clé ne tombe jamais dans la fenêtre d'une transition TRA-C (sortie : les 0,4 dernières secondes du bloc
 * A ; entrée : les 0,4 premières du bloc B). Au milieu du balayage orange le surtitre est masqué et la relecture le juge absent.
 * L'image d'ouverture (fin de l'accroche − 0,3 s) tombait dans la sortie du bloc d'ouverture.
 */
import { describe, expect, it } from "vitest";
import { instantsClesIV } from "@/moteurs/montage-image-video/relecture-finale";

const DUREE = 0.4;
const trans = (t: object) => ({ recette: {}, format: "9:16", donnees: { transitions: { duree: DUREE, ...t } } });
const ligne = (): never => ({
  dureeSec: 12,
  plans: [
    { id: "p1", debut: 0, fin: 4, sorte: "texte", scene: "accroche", ecran: "e01", textes: [] },
    { id: "p2", debut: 4, fin: 8, sorte: "ensemble", scene: "ensemble", ecran: "e02", textes: [] },
    { id: "p3", debut: 8, fin: 12, sorte: "recap", scene: "recap", ecran: "e03", textes: [] },
  ],
  evenements: [],
  segmentFin: { debut: 12, muet: true },
  blocs: [
    { id: "b1", sorte: "variete", axe: "ouverture", code: "OUV-D", donnees: {}, debut: 0, fin: 4, variete: trans({ sortie: { code: "TRA-C" } }) },
    { id: "b2", sorte: "moments", moments: [], debut: 4, fin: 8, variete: trans({ entree: { code: "TRA-C" }, sortie: { code: "TRA-C" } }) },
    { id: "b3", sorte: "moments", moments: [], debut: 8, fin: 12, variete: trans({ entree: { code: "TRA-C" } }) },
  ],
}) as never;

const fenetres = (l: ReturnType<typeof ligne>) =>
  (l as { blocs: { debut: number; fin: number; variete?: { donnees?: { transitions?: { duree: number; sortie?: unknown; entree?: unknown } } } }[] }).blocs.flatMap((b) => {
    const t = b.variete?.donnees?.transitions;
    if (!t) return [];
    return [...(t.sortie ? [{ de: b.fin - t.duree, a: b.fin }] : []), ...(t.entree ? [{ de: b.debut, a: b.debut + t.duree }] : [])];
  });

describe("instantsClesIV · hors des fenêtres de transition", () => {
  it("l'image d'ouverture n'est pas dans la sortie du bloc d'ouverture", () => {
    const l = ligne();
    const ouv = instantsClesIV(l, { noeuds: [] }).find((i) => i.legende.startsWith("Ouverture : l'accroche"));
    expect(ouv).toBeDefined();
    expect(ouv!.instantSec).toBeLessThan(4 - DUREE);
  });

  it("aucun instant clé (vue d'ensemble, récapitulatif, fin) ne tombe dans une fenêtre de transition", () => {
    const l = ligne();
    const instants = instantsClesIV(l, { noeuds: [] });
    expect(instants.length).toBeGreaterThan(2);
    for (const i of instants) for (const w of fenetres(l)) expect(i.instantSec >= w.de - 1e-9 && i.instantSec < w.a - 1e-9, `${i.nom} (${i.legende}) à ${i.instantSec} s dans [${w.de}, ${w.a}[`).toBe(false);
  });

  it("sans transition, les instants ne bougent pas", () => {
    const l = ligne() as unknown as { blocs: { variete?: unknown }[] };
    for (const b of l.blocs) delete b.variete;
    const ouv = instantsClesIV(l as never, { noeuds: [] }).find((i) => i.legende.startsWith("Ouverture : l'accroche"));
    expect(ouv!.instantSec).toBe(3.7);
  });
});
