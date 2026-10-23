/**
 * Test en prod du 11/10 : ce que le monteur lit SANS Claude autour de la couverture (fonctions pures). Les échanges
 * de bout en bout sont rejoués dans `v1-chat-monteur.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { codesInternes, couvertureSansTexte, demandeRenommage, DIT_INVISIBLE, sansCodeInterne } from "@/moteurs/montage-facecam/monteur/couverture";

const PROD = { titre: "0005-FC-TT-L · LE DIAGNOSTIC FUITE — V5", ecrite: true };

describe("couverture : codes internes", () => {
  it("le code de projet et la version sont retirés, les séparateurs orphelins aussi", () => {
    expect(codesInternes(PROD.titre)).toEqual(["0005-FC-TT-L", "V5"]);
    expect(sansCodeInterne(PROD.titre)).toBe("LE DIAGNOSTIC FUITE");
  });

  it("un nombre utile n'est jamais un code (« 3 erreurs », « 2026 », « 135 € »)", () => {
    expect(codesInternes("3 erreurs à éviter en 2026")).toEqual([]);
    expect(sansCodeInterne("135 € perdus par mois")).toBe("135 € perdus par mois");
  });
});

describe("couverture : demandes lues sans Claude", () => {
  it("échange 1 : « ENLEVER LE numéro dans le titre de la vidéo » → titre de couverture sans le code", () => {
    expect(couvertureSansTexte("ENLEVER LE numéro dans le titre de la vidéo", undefined, PROD, "Le diagnostic fuite")).toBe("LE DIAGNOSTIC FUITE");
  });

  it("échange 2 : « alors modifier le titre pour que ca ne paraisse plus » renvoie au numéro du message d'avant", () => {
    expect(couvertureSansTexte("alors modifier le titre pour que ca ne paraisse plus", "ENLEVER LE numéro dans le titre de la vidéo", PROD, "")).toBe("LE DIAGNOSTIC FUITE");
    expect(couvertureSansTexte("alors modifier le titre pour que ca ne paraisse plus", "plus lumineux", PROD, "")).toBeNull();
  });

  it("texte cité présent sur la couverture seulement → retiré ; aussi dans la vidéo → doute, laissé à Claude", () => {
    const c = { titre: "Votre temps fuit — VRAIMENT", ecrite: true };
    expect(couvertureSansTexte("enlève « VRAIMENT » du titre", undefined, c, "Votre temps fuit")).toBe("Votre temps fuit");
    expect(couvertureSansTexte("enlève « VRAIMENT » du titre", undefined, c, "vraiment")).toBeNull();
  });

  it("le code est AUSSI dans la vidéo, pas de couverture, ou demande de montage → rien (Claude décide)", () => {
    expect(couvertureSansTexte("enlève le numéro", undefined, PROD, "carte 0005-FC-TT-L")).toBeNull();
    expect(couvertureSansTexte("enlève le numéro", undefined, null, "")).toBeNull();
    expect(couvertureSansTexte("change la couleur du chiffre", undefined, PROD, "")).toBeNull();
    expect(couvertureSansTexte("dans les sous-titres enlève le numéro", undefined, PROD, "")).toBeNull();
    expect(couvertureSansTexte("a 0:32 montre les 3 etapes", undefined, PROD, "")).toBeNull();
  });
});

describe("renommer la vidéo (nom dans le studio)", () => {
  it("avec ou sans le nouveau nom", () => {
    expect(demandeRenommage("renomme la vidéo en « Le diagnostic fuite »")).toEqual({ nom: "Le diagnostic fuite" });
    expect(demandeRenommage("renomme la video en Le diagnostic fuite")).toEqual({ nom: "Le diagnostic fuite" });
    expect(demandeRenommage("je veux changer le nom de la vidéo")).toEqual({ nom: null });
  });

  it("jamais pour la couverture, un montage ou les sous-titres", () => {
    expect(demandeRenommage("ENLEVER LE numéro dans le titre de la vidéo")).toBeNull();
    expect(demandeRenommage("renomme le titre de la couverture")).toBeNull();
    expect(demandeRenommage("rajoute un titre au tout debut")).toBeNull();
  });
});

it("« invisible à l'écran » est reconnu ; une phrase honnête sur les sous-titres ne l'est pas", () => {
  expect(DIT_INVISIBLE.test("n'est que le nom du projet, invisible à l'écran")).toBe(true);
  expect(DIT_INVISIBLE.test("Je n'ai pas trouvé « Calliopi » dans ce que vous dites")).toBe(false);
});
