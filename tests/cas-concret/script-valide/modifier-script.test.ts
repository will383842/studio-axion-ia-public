/**
 * Modifier le script avant de le valider (demande de Will du 14/10) : seuls les textes changent, le chiffre tiré d'un
 * fait ne se modifie pas, rien n'est appliqué en cas de refus.
 */
import { describe, expect, it } from "vitest";
import { appliquerModifications, ecritsDe, ecritsModifiables } from "@/moteurs/montage-cas-concret/modifier-script";
import { ficheDuScriptValide, scriptValideDuCatalogue } from "@/moteurs/montage-cas-concret/script-valide";
import { trouverCas } from "@/formats/cas-concret/catalogue";

const cas = trouverCas("recrutement-apporteurs")!;
const fiche = ficheDuScriptValide(scriptValideDuCatalogue("recrutement-apporteurs")!, { videoId: "v", versionId: "v1", habillage: "charte-duo/1", origine: "A" } as never, cas);

describe("modifier le script", () => {
  it("phrase dite et textes affichés modifiés, le reste intact", () => {
    const i = fiche.ecrans.findIndex((e) => e.type === "titre");
    const avant = ecritsDe(fiche.ecrans[i]);
    const r = appliquerModifications(fiche, [{ rang: i + 1, texteDit: "Alors on a tout  automatisé.", ecrits: avant.map((t, k) => (k === 0 ? "ALORS ON A" : null)) }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fiche.ecrans[i].texteDit).toBe("Alors on a tout automatisé.");
    expect(ecritsDe(r.fiche.ecrans[i])[0]).toBe("ALORS ON A");
    expect(r.fiche.ecrans.filter((_, k) => k !== i)).toEqual(fiche.ecrans.filter((_, k) => k !== i));
    expect(fiche.ecrans[i].texteDit).not.toBe("Alors on a tout automatisé.");
  });

  it("phrase raccourcie : les apparitions suivent la phrase, à la même place relative, sans dépasser son dernier mot", () => {
    const i = fiche.ecrans.findIndex((e) => e.evenements.some((ev) => ev.surMot >= 4));
    const r = appliquerModifications(fiche, [{ rang: i + 1, texteDit: "Trois mots seulement." }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fiche.ecrans[i].evenements.every((ev) => ev.surMot <= 2)).toBe(true);
  });

  it("le chiffre d'un écran « chiffre » ne se modifie pas ; un texte vide est refusé ; rien n'est appliqué", () => {
    const i = fiche.ecrans.findIndex((e) => e.type === "chiffre");
    expect(ecritsModifiables(fiche.ecrans[i])[0]).toBe(false);
    const ecrits = ecritsDe(fiche.ecrans[i]).map((t, k) => (k === 0 ? "99 minutes" : null));
    const r = appliquerModifications(fiche, [{ rang: i + 1, ecrits }, { rang: 1, texteDit: " " }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.raisons.join(" ")).toMatch(/ne se modifie pas/);
      expect(r.raisons.join(" ")).toMatch(/ne peut pas être vide/);
    }
  });

  it("chaque type d'écran du script de la v4 se relit puis se réécrit à l'identique", () => {
    for (let i = 0; i < fiche.ecrans.length; i++) {
      const r = appliquerModifications(fiche, [{ rang: i + 1, ecrits: ecritsDe(fiche.ecrans[i]).map(() => null) }]);
      expect(r.ok && r.fiche.ecrans[i]).toEqual(fiche.ecrans[i]);
    }
  });
});
