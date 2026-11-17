import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DECLARATIONS } from "../../src/generateurs/declaration";
import { inventaireArtefacts } from "../../src/services/inventaire-artefacts";

const plan = { ordre: 0 };
const etat = (liste: ReturnType<typeof inventaireArtefacts>) => Object.fromEntries(liste.map((p) => [p.artefact, p.etat]));

describe("inventaire des artefacts (G12-03)", () => {
  it("générateur inconnu : liste vide, sans planter", () => {
    expect(inventaireArtefacts({ formatId: "n-existe-pas" })).toEqual([]);
    expect(inventaireArtefacts({ formatId: "__proto__" })).toEqual([]);
    expect(inventaireArtefacts(null as never)).toEqual([]);
    expect(inventaireArtefacts({ formatId: "avocat" }, 42 as never)).toHaveLength(2);
  });

  it("une pièce par artefact de la déclaration, dans son ordre", () => {
    for (const [f, d] of Object.entries(DECLARATIONS)) {
      expect(inventaireArtefacts({ formatId: f }).map((p) => p.artefact), f).toEqual([...d.artefacts]);
    }
  });

  it("avocat : rien de prouvé, jamais « present » ; via le travail si les paramètres le portent", () => {
    expect(etat(inventaireArtefacts({ formatId: "avocat", projetMontage: {}, plans: [plan] as never }))).toEqual({ plan: "absent", voix: "absent" });
    const t = { parametres: { voix: { id: "v" }, planIds: ["p1"] } };
    expect(etat(inventaireArtefacts({ formatId: "avocat" }, t))).toEqual({ plan: "via-travail", voix: "via-travail" });
  });

  it("face caméra : plan seul, non vérifiable donc absent, signalé", () => {
    const r = inventaireArtefacts({ formatId: "facecam" });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ artefact: "plan", etat: "absent", verifiable: false });
    expect(r[0].raison?.length).toBeGreaterThan(5);
  });

  it("tableau animé : trois pièces ; le tableau du travail compte comme plan", () => {
    expect(etat(inventaireArtefacts({ formatId: "tableau-anime" }))).toEqual({ plan: "absent", voix: "absent", "rendus-scenes": "absent" });
    expect(etat(inventaireArtefacts({ formatId: "tableau-anime" }, { parametres: { tableau: {} } })).plan).toBe("via-travail");
  });

  it("image→vidéo : trois pièces, via le travail pour les rendus de scène", () => {
    expect(etat(inventaireArtefacts({ formatId: "image-video" }, { parametres: { rendusScenes: [1] } }))).toEqual({ plan: "absent", voix: "absent", "rendus-scenes": "via-travail" });
  });

  it("cas concret (lecteurs prouvés) : present ; « voix gardée oui, rendus non »", () => {
    const v = { formatId: "cas-concret", plans: [plan] as never, projetMontage: { casConcret: { voix: { f: 1 } } } };
    expect(etat(inventaireArtefacts(v))).toEqual({ plan: "present", voix: "present", "rendus-scenes": "absent" });
    expect(inventaireArtefacts(v)[0].verifiable).toBe(true);
  });

  it("le présent prime sur le travail ; un paramètre vide ou nul ne compte pas", () => {
    const v = { formatId: "cas-concret", plans: [plan] as never, projetMontage: {} };
    expect(etat(inventaireArtefacts(v, { parametres: { plan: {} } })).plan).toBe("present");
    expect(etat(inventaireArtefacts({ formatId: "cas-concret" }, { parametres: { voix: null, plan: [] } }))).toEqual({ plan: "absent", voix: "absent", "rendus-scenes": "absent" });
  });

  it("lecture seule : entrées intactes, aucun réseau ni service ni argent importé", () => {
    const v = Object.freeze({ formatId: "avocat", projetMontage: Object.freeze({}) });
    const t = Object.freeze({ parametres: Object.freeze({ voix: 1 }) });
    expect(() => inventaireArtefacts(v as never, t as never)).not.toThrow();
    const src = readFileSync(join(__dirname, "..", "..", "src/services/inventaire-artefacts.ts"), "utf8");
    const imports = src.split("\n").filter((l) => /^import /.test(l)).join("\n");
    expect(imports).not.toMatch(/services|studio-rendu|argent|reglages|depots|zernio/i);
    expect(src).not.toMatch(/\bfetch\(|XMLHttpRequest|node:http/);
  });
});
