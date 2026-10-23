import { describe, expect, it } from "vitest";
import { STATUTS_PREPARATION, STATUTS_TRAVAIL, STATUTS_VIDEO } from "../src/domaine/libelles";

describe("vocabulaire des états : l'échec s'appelle « À corriger »", () => {
  it("la valeur echec des trois tables vaut « À corriger »", () => {
    expect(STATUTS_VIDEO.echec.libelle).toBe("À corriger");
    expect(STATUTS_TRAVAIL.echec.libelle).toBe("À corriger");
    expect(STATUTS_PREPARATION.echec.libelle).toBe("À corriger");
  });

  it("aucun libellé « À reprendre » dans les trois tables", () => {
    for (const table of [STATUTS_VIDEO, STATUTS_TRAVAIL, STATUTS_PREPARATION]) {
      for (const v of Object.values(table)) expect(v.libelle).not.toBe("À reprendre");
    }
  });
});
