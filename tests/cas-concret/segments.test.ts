/** G13-06 : les écrans du cas concret exposés comme segments, lus dans le journal (lecture seule). */
import { describe, expect, it } from "vitest";
import { cleSceneParEmpreinte, type CarteEnRendu } from "@/briques/motion/rendu-cartes";
import { fabriquerCasConcret, type JournalCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { segmentsCasConcret } from "@/moteurs/montage-cas-concret/segments";
import { doubles } from "./fabriquer/doubles";

const carte = (id: string, statut: CarteEnRendu["statut"], debutSec: number, finSec: number): CarteEnRendu =>
  ({ id, ratio: "9:16", debutSec, finSec, modele: "m", cle: `cle-${id}`, statut, essais: 0, demande: {}, empreinte: `emp-${id}` }) as unknown as CarteEnRendu;
const journalDe = (cartes: CarteEnRendu[]) => ({ ecrans: { empreinte: "x", etat: { version: 1, cartes }, rendues: [] } }) as unknown as Pick<JournalCasConcret, "ecrans">;

describe("segmentsCasConcret", () => {
  it("journal absent ou sans écrans : aucun segment", () => {
    expect(segmentsCasConcret(null)).toEqual([]);
    expect(segmentsCasConcret(undefined)).toEqual([]);
    expect(segmentsCasConcret({})).toEqual([]);
  });

  it("seules les cartes faites, dans l'ordre, temps en ms entiers", () => {
    const s = segmentsCasConcret(journalDe([carte("a", "faite", 0.1, 1.234), carte("b", "echec", 1, 2), carte("c", "a-soumettre", 2, 3), carte("d", "faite", 1.234, 2.5)]));
    expect(s).toEqual([
      { id: "a", debutMs: 100, finMs: 1234, empreinte: "emp-a", cle: "cle-a" },
      { id: "d", debutMs: 1234, finMs: 2500, empreinte: "emp-d", cle: "cle-d" },
    ]);
    for (const x of s) expect(Number.isInteger(x.debutMs) && Number.isInteger(x.finMs)).toBe(true);
  });

  it("fabrication doublée : une entrée par écran rendu, clé par empreinte", async () => {
    const d = doubles();
    await fabriquerCasConcret(d.options);
    const journal = d.partage.journal.valeur!;
    const segments = segmentsCasConcret(journal);
    expect(segments.length).toBe(journal.ecrans!.etat.cartes.filter((c) => c.statut === "faite").length);
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.length).toBe(d.ecransSoumis().length);
    for (const s of segments) {
      expect(s.empreinte).toBeTruthy();
      expect(s.cle).toBe(cleSceneParEmpreinte(d.options.env, d.options.videoId, s.empreinte));
    }
  });
});
