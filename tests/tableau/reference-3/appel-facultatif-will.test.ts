/** Texte de Williams : la page d'appel finale est facultative (si la fiche n'en a pas) ; un texte de Claude reste strict. */
import { describe, expect, it } from "vitest";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { validerFicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { trouverAppel } from "../../../src/moteurs/montage-tableau/variantes-fin";
import { regleGabarit } from "../../../src/moteurs/montage-tableau/gabarit";
import { contexteTemoin3, ficheTemoin3 } from "./fiches";

function sansAppelFiche(): FicheTableau {
  const f = structuredClone(ficheTemoin3());
  f.scenes = f.scenes.filter((s) => s.gabarit?.role !== "appel");
  return f;
}
const textes = (m: { detail: string }[]) => m.map((x) => x.detail);

describe("page d'appel facultative (texte de Williams)", () => {
  it("texte de Claude : sans page d'appel, refusé", () => {
    expect(textes(regleGabarit(sansAppelFiche())).join("\n")).toMatch(/dernière page est la page d'APPEL/);
  });
  it("texte de Williams : sans page d'appel, aucun refus lié à l'appel", () => {
    expect(textes(regleGabarit(sansAppelFiche(), { texteDeWill: true })).join("\n")).not.toMatch(/APPEL|page d'appel/);
  });
  it("validerFicheTableau avec texteDeWill : pas de refus de la règle 18 lié à l'appel", () => {
    const f = sansAppelFiche();
    const r = validerFicheTableau(f, { ...contexteTemoin3(f), texteDeWill: true });
    // On n'exige pas ok : une autre règle peut tomber sur la fiche raccourcie ; seul l'appel compte ici.
    const refus = r.ok ? "" : JSON.stringify(r);
    expect(refus).not.toMatch(/dernière page est la page d'APPEL/);
  });
  it("texte de Williams AVEC page d'appel mais sans ligne bloc appel : toujours refusé", () => {
    const f = structuredClone(ficheTemoin3());
    for (const s of f.scenes) if (s.gabarit?.role === "appel") s.elements = (s.elements ?? []).filter((e) => !("bloc" in e && e.bloc === "appel"));
    expect(textes(regleGabarit(f, { texteDeWill: true })).join("\n")).toMatch(/une ligne « bloc » « appel »/);
  });
  it("texte de Williams sans page d'appel mais ligne bloc appel sur une page retenir : toujours refusé", () => {
    const f = sansAppelFiche();
    const retenir = f.scenes.find((s) => s.gabarit?.role === "retenir")!;
    retenir.elements = [...(retenir.elements ?? []), { id: "e-appel-x", type: "ligne", texte: "Réservez un appel de diagnostic", niveau: "texte", role: "regle", bloc: "appel", ancre: 0 } as never];
    // Une page « retenir » n'est pas la dernière si une autre scène la suit : on garde une scène après elle.
    const apres = structuredClone(f.scenes[f.scenes.length - 2]);
    apres.id = "s-apres";
    f.scenes.push(apres);
    expect(textes(regleGabarit(f, { texteDeWill: true })).join("\n")).toMatch(/s'écrit sur la page d'appel/);
  });
  it("texte de Williams qui DIT un appel (sans scène appel) : règle 18 toujours refusée ; sans appel dit : passe", () => {
    const f = sansAppelFiche();
    const derniere = f.scenes[f.scenes.length - 1];
    const avant = derniere.texteDit;
    derniere.texteDit = `${avant} Abonnez-vous pour recevoir la suite.`;
    expect(trouverAppel(f)).not.toBeNull();
    expect(textes(regleGabarit(f, { texteDeWill: true })).join(" | ")).toMatch(/dernière page est la page d'APPEL/);
    derniere.texteDit = avant;
    expect(trouverAppel(f)).toBeNull();
    expect(textes(regleGabarit(f, { texteDeWill: true })).join(" | ")).not.toMatch(/APPEL|page d'appel/);
  });
});
