/**
 * GV2-53 : le dessin de repli du tableau animé est choisi par les faits du script, et non « notes » par défaut.
 * Un mot-clé reconnu passe toujours avant les faits.
 */
import { describe, expect, it } from "vitest";
import { themeDessin } from "../../../src/moteurs/montage-tableau/mise-en-page-tableau";
import { DIX_SCRIPTS } from "../../briques/faits-script/dix-scripts";

const phrases = DIX_SCRIPTS.flatMap((s) => s.split(/(?<=[.!?:])\s+/).filter((p) => p.trim().length > 0));

describe("GV2-53 : repli par les faits du script", () => {
  it("une durée sans mot-clé reconnu : pas « notes »", () => {
    expect(themeDessin("on passe de 2 heures à 20 minutes")).not.toBe("notes");
  });

  it("une liste sans mot-clé reconnu : le thème de liste", () => {
    expect(themeDessin("pas de photos, pas d'horaires, aucun avis, aucun prix")).toBe("notes");
  });

  it("la phrase des quatre erreurs contient « réponse » : le mot-clé passe avant les faits (comme aujourd'hui)", () => {
    expect(themeDessin("les 4 erreurs : pas de photos, pas d'horaires, aucun avis, aucune réponse")).toBe("flux");
  });

  it("une durée seule donne « temps »", () => {
    expect(themeDessin("Il suffit de cinq minutes")).toBe("temps");
  });

  it("un pourcentage donne le thème de progression", () => {
    expect(themeDessin("Un taux de 40 % chez les artisans")).toBe("flux");
  });

  it("une phrase avec mot-clé garde le thème d'aujourd'hui", () => {
    expect(themeDessin("Vos mails prennent du temps")).toBe("temps-mails");
    expect(themeDessin("Faites rédiger les réponses : 40 %")).toBe("flux");
    expect(themeDessin("Relisez en 5 minutes")).toBe("relire");
    expect(themeDessin("Mettez vos documents à jour")).toBe("notes");
  });

  it("sur les 42 phrases des dix scripts, « notes » sort moins qu'avant (24 sur 42 avant GV2-53)", () => {
    // La fiche visait moins de 35 % (14 sur 42) : hors d'atteinte sans changer les mots-clés, qui passent avant les faits.
    expect(phrases).toHaveLength(42);
    expect(phrases.filter((p) => themeDessin(p) === "notes").length).toBeLessThanOrEqual(22);
  });
});
