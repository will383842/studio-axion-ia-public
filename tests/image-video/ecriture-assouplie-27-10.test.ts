/** Écriture plus souple (27/10/2026) : animation sur un mot non dit retirée, unité de l'image redite dans la relance. */
import { describe, expect, it } from "vitest";
import { variableRelanceIV } from "@/moteurs/montage-image-video/ecriture";

describe("relance : nombre cité seul alors que l'image donne une unité", () => {
  const carte = { chiffres: [{ valeur: 12, unite: "jour" }, { valeur: 45, unite: "nombre" }] };
  const base = `<carte>${JSON.stringify(carte)}</carte>`;

  it("« 12 » seul refusé : la relance redit « 12 jour » avec son unité", () => {
    const r = variableRelanceIV(base, "{}", ["Accroche A : « 12 » n'est pas sur l'image."]);
    expect(r).toContain("N'écris jamais 12 seul");
    expect(r).toContain("« 12 jour »");
  });
  it("un nombre inconnu de la carte : aucune précision ajoutée", () => {
    expect(variableRelanceIV(base, "{}", ["Accroche A : « 99 » n'est pas sur l'image."])).not.toContain("N'écris jamais");
  });
});
