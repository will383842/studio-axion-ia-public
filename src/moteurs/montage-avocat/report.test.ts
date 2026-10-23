import { describe, expect, it } from "vitest";
import { horodaterTexte } from "@/domaine/derivations";
import { ecartMoyenMs, horodaterMotsPrononces, preparerTexteVoix, reporterHorodatages } from "./report";

const SEGMENTS = [
  { id: "s1", texte: "Vous recevez un PV de 135 € ?" },
  { id: "s2", texte: "Surtout, ne le payez pas." },
];
const PRONONCIATIONS = [
  { mot: "PV", prononciation: "pé vé" },
  { mot: "135 €", prononciation: "cent trente-cinq euros" },
];

describe("report des horodatages du texte prononcé sur le texte validé (B.4, B.5)", () => {
  it("la voix entend les prononciations substituées, le texte de Will n'est jamais modifié", () => {
    const t = preparerTexteVoix(SEGMENTS, PRONONCIATIONS);
    expect(t.texte).toBe("Vous recevez un pé vé de cent trente-cinq euros ? Surtout, ne le payez pas.");
    expect(t.motsValides.map((m) => m.mot).join(" ")).toBe("Vous recevez un PV de 135 € ? Surtout, ne le payez pas.");
    expect(t.motsValides.filter((m) => m.segmentId === "s2").map((m) => m.mot)).toEqual(["Surtout,", "ne", "le", "payez", "pas."]);
  });

  it("texte substitué ≠ texte affiché : chaque mot affiché reçoit le temps de ce qui a été DIT pour lui", () => {
    const t = preparerTexteVoix(SEGMENTS, PRONONCIATIONS);
    const dits = horodaterTexte(t.texte, 4.4);
    const reportes = reporterHorodatages(t, dits);
    expect(reportes.map((m) => m.mot)).toEqual(t.motsValides.map((m) => m.mot));
    const dit = (mot: string) => dits.find((d) => d.mot.startsWith(mot))!;
    const pv = reportes.find((m) => m.mot === "PV")!;
    expect(pv.debutSec).toBeCloseTo(dit("pé").debutSec, 2);
    expect(pv.finSec).toBeCloseTo(dit("vé").finSec, 2);
    // « 135 € » (2 mots affichés) couvre « cent trente-cinq euros » (3 mots dits), partagé entre les deux mots.
    const n135 = reportes.find((m) => m.mot === "135")!;
    const euro = reportes.find((m) => m.mot.startsWith("€"))!;
    expect(n135.debutSec).toBeCloseTo(dit("cent").debutSec, 2);
    expect(euro.finSec).toBeCloseTo(dit("euros").finSec, 2);
    expect(n135.finSec).toBeCloseTo(euro.debutSec, 3);
    // Toujours dans l'ordre, sans chevauchement, et chaque mot garde son segment.
    for (let i = 1; i < reportes.length; i++) expect(reportes[i].debutSec).toBeGreaterThanOrEqual(reportes[i - 1].finSec - 1e-6);
    expect(reportes.find((m) => m.mot === "payez")?.segmentId).toBe("s2");
  });

  it("le fournisseur découpe ses mots autrement (élision coupée, nombres collés) : l'alignement lettre à lettre retombe juste", () => {
    const t = preparerTexteVoix([{ id: "s", texte: "L'erreur coûte cher, très cher." }], []);
    // Le fournisseur renvoie « L' » et « erreur » séparément, et fusionne « très cher. ».
    const renvoyes = [
      { mot: "L'", debutSec: 0, finSec: 0.1 },
      { mot: "erreur", debutSec: 0.1, finSec: 0.5 },
      { mot: "coûte", debutSec: 0.55, finSec: 0.9 },
      { mot: "cher,", debutSec: 0.95, finSec: 1.2 },
      { mot: "très cher.", debutSec: 1.4, finSec: 2.0 },
    ];
    const r = reporterHorodatages(t, renvoyes);
    expect(r.map((m) => m.mot)).toEqual(["L'erreur", "coûte", "cher,", "très", "cher."]);
    expect(r[0]).toMatchObject({ debutSec: 0, finSec: 0.5 });
    expect(r[3].debutSec).toBeCloseTo(1.4, 2);
    expect(r[4].finSec).toBeCloseTo(2.0, 2);
    expect(r[3].finSec).toBeLessThanOrEqual(r[4].debutSec + 1e-6);
  });

  it("un mot dont aucune lettre n'est retrouvée prend le temps entre ses voisins", () => {
    const h = horodaterMotsPrononces(["un", "€", "deux"], [
      { mot: "un", debutSec: 0, finSec: 0.3 },
      { mot: "deux", debutSec: 0.8, finSec: 1.1 },
    ]);
    expect(h[1]).toEqual({ mot: "€", debutSec: 0.3, finSec: 0.8 });
  });

  it("écart moyen entre deux horodatages (contrôle B.5 : HeyGen contre un alignement forcé)", () => {
    const a = [{ mot: "Bonjour", debutSec: 0, finSec: 0.4 }, { mot: "Will", debutSec: 0.5, finSec: 0.8 }];
    const b = [{ mot: "Bonjour", debutSec: 0.04, finSec: 0.44 }, { mot: "Will", debutSec: 0.54, finSec: 0.84 }];
    expect(ecartMoyenMs(a, b)).toBe(40);
    expect(ecartMoyenMs(a, a)).toBe(0);
  });
});
