import { describe, it, expect } from "vitest";
import { TAILLE_MAX_FICHE_CARACTERES, PLAGES_MAX_PAR_FICHE } from "@/domaine/archive-extraits";
import type { PlageExtrait } from "@/domaine/archive-extraits";
import type { Fenetres } from "@/briques/archive-extraits/fenetres";
import { fenetresInconnues } from "@/briques/archive-extraits/fenetres";
import {
  POLITIQUE_SOURCES_PAR_DEFAUT,
  videoEligible,
  sourcePreferee,
  qualifierPlages,
  reporterGestes,
} from "@/briques/archive-extraits/inscription";

const ctx = { politique: "publiees" as const, versionEnEssai: false, sortieDemo: false, aSousTitres: true };
const publiee = { estDemo: false, statut: "prete" as const, corbeilleLe: undefined, etapeEditoriale: "publiee" as const };
const nonPubliee = { ...publiee, etapeEditoriale: "validee" as const };

describe("vidéo éligible", () => {
  it("défaut : publiees", () => expect(POLITIQUE_SOURCES_PAR_DEFAUT).toBe("publiees"));
  it("publiée → éligible", () => expect(videoEligible(publiee, ctx).eligible).toBe(true));
  it("prête non publiée : refusée sous publiees, éligible sous pretes", () => {
    const r = videoEligible(nonPubliee, ctx);
    expect(r.eligible).toBe(false);
    expect(r.raison).toBeTruthy();
    expect(videoEligible(nonPubliee, { ...ctx, politique: "pretes" }).eligible).toBe(true);
  });
  it("cochees sans coche refusée, avec coche acceptée", () => {
    expect(videoEligible(nonPubliee, { ...ctx, politique: "cochees" }).eligible).toBe(false);
    expect(videoEligible(nonPubliee, { ...ctx, politique: "cochees", cochee: true }).eligible).toBe(true);
  });
  it("refus : démo, essai, sortie démo, sans sous-titres, corbeille, pas prête", () => {
    expect(videoEligible({ ...publiee, estDemo: true }, ctx).eligible).toBe(false);
    expect(videoEligible(publiee, { ...ctx, versionEnEssai: true }).eligible).toBe(false);
    expect(videoEligible(publiee, { ...ctx, sortieDemo: true }).eligible).toBe(false);
    expect(videoEligible(publiee, { ...ctx, aSousTitres: false }).eligible).toBe(false);
    expect(videoEligible({ ...publiee, corbeilleLe: "2026-11-01T00:00:00Z" }, ctx).eligible).toBe(false);
    expect(videoEligible({ ...publiee, statut: "en_fabrication" }, ctx).eligible).toBe(false);
  });
});

describe("source préférée", () => {
  it("master sans texte 9:16 préféré", () => {
    const r = sourcePreferee(
      [{ type: "master-sans-texte", fichierId: "m1", ratio: "9:16" }],
      [{ id: "s1", ratio: "9:16", fichierId: "f1" }],
    );
    expect(r).toEqual({ sortieId: "s1", fichierId: "m1", ratio: "9:16", origine: "master-sans-texte", texteIncruste: false });
  });
  it("sortie 9:16 seule → texte incrusté", () => {
    const r = sourcePreferee([], [{ id: "s1", ratio: "9:16", fichierId: "f1" }]);
    expect(r).toEqual({ sortieId: "s1", fichierId: "f1", ratio: "9:16", origine: "sortie", texteIncruste: true });
  });
  it("4:5 en repli, 9:16 prioritaire", () => {
    const r = sourcePreferee([], [{ id: "a", ratio: "4:5", fichierId: "fa" }, { id: "b", ratio: "9:16", fichierId: "fb" }]);
    expect(r?.sortieId).toBe("b");
    expect(sourcePreferee([], [{ id: "a", ratio: "4:5", fichierId: "fa" }])?.ratio).toBe("4:5");
  });
  it("seulement 16:9 → null", () => {
    expect(sourcePreferee([], [{ id: "s", ratio: "16:9", fichierId: "f" }])).toBeNull();
  });
  it("piste d'un autre ratio ou sans fichier ignorée", () => {
    const r = sourcePreferee(
      [{ type: "master-sans-texte", fichierId: undefined, ratio: "9:16" }, { type: "master-sans-texte", fichierId: "x", ratio: "4:5" }],
      [{ id: "s1", ratio: "9:16", fichierId: "f1" }],
    );
    expect(r?.origine).toBe("sortie");
  });
});

const plage = (o: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id: "p-0-300", debutSec: 0, finSec: 3, texte: "Bonjour à tous", motsCles: [], avecVisage: false, texteIncruste: false, etat: "utilisable", ...o,
});
const fen = (o: Partial<Fenetres> = {}): Fenetres => ({ interdits: [], avecVisage: [], inconnues: false, ...o });

describe("qualifier les plages", () => {
  it("recopie texteIncruste et pose le visage par chevauchement", () => {
    const entree = [plage({ id: "a", debutSec: 0, finSec: 3 }), plage({ id: "b", debutSec: 10, finSec: 13 })];
    const sortie = qualifierPlages(entree, fen({ avecVisage: [{ debutSec: 2, finSec: 5, raison: "visage" }] }), true);
    expect(sortie.map((p) => p.avecVisage)).toEqual([true, false]);
    expect(sortie.every((p) => p.texteIncruste)).toBe(true);
    expect(entree[0].avecVisage).toBe(false);
    expect(entree[0].texteIncruste).toBe(false);
  });
  it("fenêtres inconnues → a_verifier, exclue reste exclue", () => {
    const sortie = qualifierPlages([plage({ id: "a" }), plage({ id: "b", etat: "exclue", raisonExclusion: "montant" })], fenetresInconnues(), false);
    expect(sortie[0].etat).toBe("a_verifier");
    expect(sortie[0].raisonExclusion).toBe("fenetres-inconnues");
    expect(sortie[1].etat).toBe("exclue");
    expect(sortie[1].raisonExclusion).toBe("montant");
  });
});

describe("report des gestes", () => {
  it("écartée gardée écartée (même id)", () => {
    const anc = [plage({ etat: "ecartee", ecarteeLe: "2026-11-10" })];
    const r = reporterGestes(anc, [plage()]);
    expect(r[0].etat).toBe("ecartee");
    expect(r[0].ecarteeLe).toBe("2026-11-10");
  });
  it("écartée gardée avec id décalé à 80 % et même texte", () => {
    const anc = [plage({ id: "p-0-300", debutSec: 0, finSec: 3, etat: "ecartee", ecarteeLe: "2026-11-10" })];
    const nouv = [plage({ id: "p-30-330", debutSec: 0.3, finSec: 3.3, texte: " Bonjour à tous " })];
    expect(reporterGestes(anc, nouv)[0].etat).toBe("ecartee");
  });
  it("pas de report si texte différent ou recouvrement faible", () => {
    const anc = [plage({ etat: "ecartee", ecarteeLe: "x" })];
    expect(reporterGestes(anc, [plage({ id: "n1", texte: "Autre" })])[0].etat).toBe("utilisable");
    expect(reporterGestes(anc, [plage({ id: "n2", debutSec: 2, finSec: 5 })])[0].etat).toBe("utilisable");
  });
  it("validée gardée utilisable", () => {
    const anc = [plage({ etat: "utilisable", valideeLe: "2026-11-11" })];
    const r = reporterGestes(anc, [plage({ etat: "a_verifier", raisonExclusion: "fenetres-inconnues" })]);
    expect(r[0].etat).toBe("utilisable");
    expect(r[0].valideeLe).toBe("2026-11-11");
  });
  it("validation d'une exclue refusée ; écartée sur exclue garde exclue", () => {
    const r = reporterGestes([plage({ valideeLe: "v", ecarteeLe: "e", etat: "ecartee" })], [plage({ etat: "exclue", raisonExclusion: "montant" })]);
    expect(r[0].etat).toBe("exclue");
    expect(r[0].ecarteeLe).toBe("e");
    const r2 = reporterGestes([plage({ valideeLe: "v" })], [plage({ etat: "exclue", raisonExclusion: "montant" })]);
    expect(r2[0].etat).toBe("exclue");
  });
  it("entrées non mutées", () => {
    const anc = [plage({ etat: "ecartee", ecarteeLe: "e" })];
    const nouv = [plage()];
    const a = JSON.stringify(anc), n = JSON.stringify(nouv);
    reporterGestes(anc, nouv);
    expect(JSON.stringify(anc)).toBe(a);
    expect(JSON.stringify(nouv)).toBe(n);
  });
  it("30 plages avec les deux champs restent sous la taille max", () => {
    const l = Array.from({ length: PLAGES_MAX_PAR_FICHE }, (_, i) =>
      plage({ id: `p-${i}`, debutSec: i * 4, finSec: i * 4 + 3, texte: "x".repeat(200), ecarteeLe: "2026-11-10T10:00:00.000Z", valideeLe: "2026-11-10T10:00:00.000Z" }),
    );
    expect(JSON.stringify(l).length).toBeLessThan(TAILLE_MAX_FICHE_CARACTERES);
  });
});
