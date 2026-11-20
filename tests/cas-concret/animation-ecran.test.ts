/**
 * S-08 · tests directs de `animation-ecran.ts` : `appliquerAnimationEcran` et `decrireAnimationEcran`,
 * entrées construites à la main (aucun réglage lu, aucun réseau).
 */
import { describe, expect, it } from "vitest";
import {
  ENTREES_S07,
  INTENSITES_S07,
  PHRASE_SANS_MISE,
  PHRASE_VITESSE_ECRAN,
  VITESSES_S07,
  appliquerAnimationEcran,
  decrireAnimationEcran,
} from "@/moteurs/montage-cas-concret/animation-ecran";
import { mettre, schemaTirageEcran, tirer, type Mise, type TirageEcran } from "@/moteurs/montage-cas-concret/variete";

const ecran: TirageEcran = { miseEnPage: schemaTirageEcran.shape.miseEnPage.options[0], entree: "rideau", sortie: "poussee", motParMot: "v4", camera: "derive-laterale" };

function miseAvecCamera(style: Mise["tirage"]["camera"]["style"]): Mise {
  const base = mettre(tirer({ videoId: "video-animation-ecran", canaux: ["facebook"], historique: [] }), [{ id: "e01", type: "titre", fond: "sombre" }]);
  return { ...base, tirage: { ...base.tirage, camera: { style, part: style === "aucune-v4" ? 0 : 0.5 } } };
}
const miseCamera = miseAvecCamera("aucune-v4");
const miseSansCamera = miseAvecCamera("aucune-v4");
const miseAvecMouvement = miseAvecCamera("douce");

describe("S-08 · appliquerAnimationEcran", () => {
  it("entrée « fondu » → fondu-recul-v4, le reste du tirage est inchangé", () => {
    const r = appliquerAnimationEcran(ecran, { entree: "fondu" }, miseCamera);
    expect(r).toEqual({ ok: true, tirage: { ...ecran, entree: "fondu-recul-v4" } });
  });
  it("entrée « glisse » → glissement ; « zoom » → zoom-avant", () => {
    expect(appliquerAnimationEcran(ecran, { entree: "glisse" }, miseCamera)).toEqual({ ok: true, tirage: { ...ecran, entree: "glissement" } });
    expect(appliquerAnimationEcran(ecran, { entree: "zoom" }, miseCamera)).toEqual({ ok: true, tirage: { ...ecran, entree: "zoom-avant" } });
  });
  it("entrée « ecrit » → titre mot par mot en cascade, l'entrée visuelle reste", () => {
    expect(appliquerAnimationEcran(ecran, { entree: "ecrit" }, miseCamera)).toEqual({ ok: true, tirage: { ...ecran, motParMot: "cascade" } });
  });
  it("entrée « pop » → refusée en une phrase qui la nomme", () => {
    expect(appliquerAnimationEcran(ecran, { entree: "pop" }, miseCamera)).toEqual({ ok: false, raison: "L'entrée « pop » n'existe pas encore sur un écran du cas concret." });
  });
  it("une demande de vitesse est refusée avec PHRASE_VITESSE_ECRAN, même accompagnée d'une entrée valide", () => {
    expect(appliquerAnimationEcran(ecran, { vitesse: "rapide" }, miseCamera)).toEqual({ ok: false, raison: PHRASE_VITESSE_ECRAN });
    expect(appliquerAnimationEcran(ecran, { entree: "fondu", vitesse: "lent" }, miseCamera)).toEqual({ ok: false, raison: PHRASE_VITESSE_ECRAN });
  });
  it("demande vide → refus demandant ce qui change", () => {
    const r = appliquerAnimationEcran(ecran, {}, miseCamera);
    expect(r).toEqual({ ok: false, raison: "Dites ce qui change dans l'animation de cet écran : l'entrée, l'intensité ou la sortie." });
  });
  it("intensité douce → caméra « aucun » ; forte → « punch-in »", () => {
    const douce = appliquerAnimationEcran(ecran, { intensite: "douce" }, miseCamera);
    const forte = appliquerAnimationEcran(ecran, { intensite: "forte" }, miseCamera);
    expect(douce).toEqual({ ok: true, tirage: { ...ecran, camera: "aucun" } });
    expect(forte).toEqual({ ok: true, tirage: { ...ecran, camera: "punch-in" } });
  });
  it("intensité normale : « aucun » si la vidéo n'a pas de caméra, « zoom-lent » sinon", () => {
    expect(appliquerAnimationEcran(ecran, { intensite: "normale" }, miseSansCamera)).toEqual({ ok: true, tirage: { ...ecran, camera: "aucun" } });
    expect(appliquerAnimationEcran(ecran, { intensite: "normale" }, miseAvecMouvement)).toEqual({ ok: true, tirage: { ...ecran, camera: "zoom-lent" } });
  });
  it("sortie posée telle quelle ; plusieurs champs se cumulent sans toucher aux autres", () => {
    expect(appliquerAnimationEcran(ecran, { sortie: "flou" }, miseCamera)).toEqual({ ok: true, tirage: { ...ecran, sortie: "flou" } });
    expect(appliquerAnimationEcran(ecran, { entree: "zoom", intensite: "forte", sortie: "aucune-v4" }, miseCamera)).toEqual({
      ok: true,
      tirage: { ...ecran, entree: "zoom-avant", camera: "punch-in", sortie: "aucune-v4" },
    });
  });
  it("l'entrée n'est pas modifiée (ni l'objet reçu, ni la mise)", () => {
    const avant = JSON.stringify(ecran);
    const miseAvant = JSON.stringify(miseCamera);
    const r = appliquerAnimationEcran(ecran, { entree: "glisse", intensite: "forte", sortie: "flou" }, miseCamera);
    expect(r.ok).toBe(true);
    expect(JSON.stringify(ecran)).toBe(avant);
    expect(JSON.stringify(miseCamera)).toBe(miseAvant);
  });
  it("tirage résultat conforme au schéma ; tirage actuel illisible → refus « pas possible »", () => {
    const ok = appliquerAnimationEcran(ecran, { entree: "fondu" }, miseCamera);
    expect(ok.ok && schemaTirageEcran.safeParse(ok.tirage).success).toBe(true);
    const casse = { ...ecran, entree: "inconnue" } as unknown as TirageEcran;
    expect(appliquerAnimationEcran(casse, { sortie: "flou" }, miseCamera)).toEqual({ ok: false, raison: "Cette animation n'est pas possible sur cet écran." });
  });
  it("PHRASE_SANS_MISE est la phrase attendue et les listes S-07 sont réexportées", () => {
    expect(PHRASE_SANS_MISE).toBe("L'animation de cette vidéo ne se règle pas écran par écran.");
    expect([...ENTREES_S07]).toEqual(["fondu", "glisse", "zoom", "pop", "ecrit"]);
    expect([...INTENSITES_S07]).toEqual(["douce", "normale", "forte"]);
    expect([...VITESSES_S07]).toEqual(["lent", "normal", "rapide"]);
  });
});

describe("S-08 · decrireAnimationEcran", () => {
  it("entrée équivalente : la nomme en vocabulaire S-07, intensité selon la caméra, sans sortie si aucune", () => {
    expect(decrireAnimationEcran({ ...ecran, entree: "glissement", camera: "punch-in", sortie: "aucune-v4" })).toBe("entrée glisse, intensité forte");
    expect(decrireAnimationEcran({ ...ecran, entree: "zoom-avant", camera: "aucun", sortie: "aucune-v4" })).toBe("entrée zoom, intensité douce");
    expect(decrireAnimationEcran({ ...ecran, entree: "fondu-recul-v4", camera: "zoom-lent", sortie: "aucune-v4" })).toBe("entrée fondu, intensité normale");
  });
  it("entrée sans équivalent : nommée telle quelle ; sortie ajoutée quand elle existe", () => {
    expect(decrireAnimationEcran({ ...ecran, entree: "rideau", camera: "derive-laterale", sortie: "poussee" })).toBe("intensité normale, entrée rideau, sortie poussee");
    expect(decrireAnimationEcran({ ...ecran, entree: "volet-masque", camera: "aucun", sortie: "flou" })).toBe("intensité douce, entrée volet-masque, sortie flou");
  });
  it("ne contient aucun montant", () => {
    expect(decrireAnimationEcran(ecran)).not.toMatch(/€|euro/i);
  });
});
