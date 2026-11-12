import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { estMotFort, marquerMotsImportants, motsImportants } from "./mots-importants";

const seg = (...mots: string[]) => ({ mots: mots.map((mot): MotHorodate => ({ mot, debutSec: 0, finSec: 1 })) });

describe("mots importants : ordre de repli", () => {
  const mots = ["vous", "avez", "trois", "devis", "ouverts"];
  it("l'emphase du script passe en premier", () => {
    const r = motsImportants({ emphaseScript: ["ouverts"], motsOrange: ["avez"], mots });
    expect(r.source).toBe("script");
    expect([...r.mots]).toEqual(["ouverts"]);
  });
  it("script vide : les mots orange de la fiche", () => {
    const r = motsImportants({ emphaseScript: [], motsOrange: ["Avez"], mots });
    expect(r.source).toBe("fiche");
    expect([...r.mots]).toEqual(["avez"]);
  });
  it("rien : les chiffres et le lexique de la transcription", () => {
    const r = motsImportants({ mots });
    expect(r.source).toBe("transcription");
    expect([...r.mots].sort()).toEqual(["devis", "trois"]);
  });
});

describe("mots importants : plafonds", () => {
  it("40 % des groupes au plus sur 20 groupes", () => {
    const segments = Array.from({ length: 20 }, () => seg("le", "devis"));
    const { segments: sortie } = marquerMotsImportants(segments, {});
    expect(sortie.filter((s) => s.mots.some((m) => m.enValeur)).length).toBe(8);
  });
  it("2 mots au plus par groupe, texte inchangé (5 groupes : plafond de 2 groupes)", () => {
    const { segments } = marquerMotsImportants([seg("trois", "devis", "clients", "hier"), seg("a"), seg("b"), seg("c"), seg("d")], {});
    expect(segments[0].mots.filter((m) => m.enValeur).map((m) => m.mot)).toEqual(["trois", "devis"]);
    expect(segments[0].mots.map((m) => m.mot)).toEqual(["trois", "devis", "clients", "hier"]);
  });
  it("toujours actif : au moins 1 groupe marqué pour 1 ou 2 groupes", () => {
    const un = marquerMotsImportants([seg("trois", "devis")], {}).segments;
    expect(un[0].mots.filter((m) => m.enValeur).length).toBe(2);
    const deux = marquerMotsImportants([seg("trois"), seg("devis")], {}).segments;
    expect(deux.map((s) => s.mots.some((m) => m.enValeur))).toEqual([true, false]);
  });
});

describe("estMotFort", () => {
  it("garde les réponses de la face caméra animée sur 30 mots", () => {
    const attendu: Record<string, boolean> = {
      "trois": true, "Devis,": true, "clients": true, "45": true, "quarante-cinq": true, "un": false, "une": false, "l'IA": true,
      "bonjour": false, "alors": false, "je": false, "vous": false, "temps": true, "argent.": true, "facture": true, "relances": true,
      "maison": false, "chat": false, "deuxième": true, "2,5": true, "rendez-vous": true, "automatisez": true, "mais": false, "voiture": false,
      "": false, "?": false, "Diagnostic": true, "gratuit": true, "et": false, "pour": false,
    };
    for (const [mot, fort] of Object.entries(attendu)) expect(estMotFort(mot), mot).toBe(fort);
    expect(estMotFort("maison", new Set(["maison"]))).toBe(true);
  });
});
