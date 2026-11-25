/**
 * BOUCLE-EFFET-b-v21o (X1-18) : le cas concret sort SANS fin propre quand la commande porte `boucleEffet: true` ET que la décision
 * pure (fiche a) dit « boucle ». Doubles seulement : aucun rendu, aucune dépense.
 * « recrutement-apporteurs » : même fond au premier et au dernier écran (boucle) ; « rappels-rendez-vous » : fonds différents.
 */
import { describe, expect, it } from "vitest";
import { lireEntreesCasConcret } from "@/moteurs/montage-cas-concret/etapes";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { VOIX_AVANT_FIN_MIN_SEC } from "@/moteurs/montage-cas-concret/controles";
import { doubles, type OptionsDoubles } from "./fabriquer/doubles";

type Complet = { dureeSec: number; export: { finPropre?: unknown } };
const BOUCLE = "recrutement-apporteurs";
const FONDS_DIFFERENTS = "rappels-rendez-vous";

async function lancer(opt: OptionsDoubles, boucleEffet?: unknown, extra: Record<string, unknown> = {}) {
  const d = doubles(opt);
  if (Object.keys(extra).length) d.options.entrees = { ...d.options.entrees, ...extra } as typeof d.options.entrees;
  if (boucleEffet !== undefined) d.options.entrees = { ...d.options.entrees, boucleEffet } as typeof d.options.entrees;
  await fabriquerCasConcret(d.options);
  const complets = d.soumises.filter((s) => (s.parametres as { mode?: string }).mode === "complet");
  return { d, complets, params: complets.map((s) => s.parametres as unknown as Complet), cles: complets.map((s) => s.idRendu) };
}

describe("BOUCLE-EFFET-b : porte entrees.boucleEffet", () => {
  it("(a) sans boucleEffet, « true » (texte), 1 ou {} : fin propre habituelle, rendus identiques à une fabrication sans le champ", async () => {
    const ref = await lancer({ casId: BOUCLE });
    expect(ref.params.length).toBeGreaterThan(0);
    for (const p of ref.params) expect(p.export.finPropre).toMatchObject({ fonduSec: 0.45, tenueSec: 0.6, couleur: "0xF2EEE4" });
    for (const v of ["true", 1, {}, false]) {
      const x = await lancer({ casId: BOUCLE }, v);
      expect(x.cles).toEqual(ref.cles);
      expect(x.params).toEqual(ref.params);
    }
  });

  it("(b) boucleEffet: true et même fond au début et à la fin : export SANS finPropre, durée, voix et mots inchangés", async () => {
    const ref = await lancer({ casId: BOUCLE });
    const b = await lancer({ casId: BOUCLE }, true);
    expect(b.params.length).toBe(ref.params.length);
    for (const p of b.params) expect("finPropre" in p.export).toBe(false);
    expect(b.params.map((p) => p.dureeSec)).toEqual(ref.params.map((p) => p.dureeSec));
    expect(b.d.lus).toEqual(ref.d.lus);
    expect(b.d.assemblages).toEqual(ref.d.assemblages);
    const sans = (p: Complet) => ({ ...p, depots: undefined, export: { ...p.export, finPropre: undefined } });
    expect(b.params.map(sans)).toEqual(ref.params.map(sans));
    expect(b.cles).not.toEqual(ref.cles);
  });

  it("(c) boucleEffet: true mais fonds différents (fond-different) : identique à (a)", async () => {
    const ref = await lancer({ casId: FONDS_DIFFERENTS });
    const b = await lancer({ casId: FONDS_DIFFERENTS }, true);
    expect(b.params).toEqual(ref.params);
    expect(b.cles).toEqual(ref.cles);
    for (const p of b.params) expect(p.export.finPropre).toBeDefined();
  });

  it("(d) fin vide : le fichier est décidé sur les écrans du corps (aucun fichier ne garde la fin propre si tous bouclent)", async () => {
    const b = await lancer({ casId: BOUCLE, reseaux: ["facebook", "linkedin"] }, true);
    expect(b.params.length).toBeGreaterThan(0);
    for (const p of b.params) expect("finPropre" in p.export).toBe(false);
    const c = await lancer({ casId: FONDS_DIFFERENTS, reseaux: ["facebook", "linkedin"] }, true);
    for (const p of c.params) expect(p.export.finPropre).toBeDefined();
  });

  it("(d2) plusieurs fins qui diffèrent : chaque fichier est décidé avec SES écrans de fin (l'un boucle, les autres gardent la fin propre)", async () => {
    // motSur facebook + rendez-vous : 3 fichiers ; le 1er finit sombre (boucle avec le corps), les 2 autres finissent sur l'ivoire.
    const opt: OptionsDoubles = { casId: BOUCLE, motSur: ["facebook"] };
    const ref = await lancer(opt, undefined, { finDemandee: "rendez-vous" });
    const b = await lancer(opt, true, { finDemandee: "rendez-vous" });
    expect(b.params.length).toBe(3);
    expect(ref.params.length).toBe(3);
    expect(b.params.map((p) => "finPropre" in p.export)).toEqual([false, true, true]);
    expect(b.params.slice(1)).toEqual(ref.params.slice(1));
    expect(b.cles.slice(1)).toEqual(ref.cles.slice(1));
    expect(b.cles[0]).not.toBe(ref.cles[0]);
  });

  it("(e) phrase jamais coupée : la voix finit au même instant avant la fin qu'à master, aucun mot retiré", async () => {
    const ref = await lancer({ casId: BOUCLE });
    const b = await lancer({ casId: BOUCLE }, true);
    expect(VOIX_AVANT_FIN_MIN_SEC).toBe(2);
    const finVoix = (x: typeof b) => Math.max(...x.d.assemblages.map((a) => a.morceaux.reduce((s, m) => s + (m.aSec - m.deSec), 0)));
    expect(finVoix(b)).toBe(finVoix(ref));
    // la tenue après la voix est celle de master : le contrôle bloquant (≥ 2 s) passe donc comme avant
    expect(b.params.map((p) => p.dureeSec - finVoix(b))).toEqual(ref.params.map((p) => p.dureeSec - finVoix(ref)));
    expect(b.d.lus).toEqual(ref.d.lus);
  });

  it("(f) lireEntreesCasConcret : seul `true` exact porte boucleEffet", () => {
    const lire = (v: unknown) => lireEntreesCasConcret({ casConcret: { boucleEffet: v } } as never);
    expect(lire(true).boucleEffet).toBe(true);
    for (const v of ["true", 1, undefined, false, {}]) expect("boucleEffet" in lire(v)).toBe(false);
  });
});
