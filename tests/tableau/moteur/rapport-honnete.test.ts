/**
 * FIX-CONTROLES-IMAGE-AVANT-PRET-a : le rapport de qualité du tableau animé ne dit plus « image vérifiée » ni une note
 * rassurante quand des contrôles n'ont pas été faits. Fonctions pures, aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { qualiteDe, verifieDe } from "../../../src/moteurs/montage-tableau/index";
import type { CompteRenduFabrication } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { LigneControleTableau } from "../../../src/moteurs/montage-tableau/controles";

type Controles = CompteRenduFabrication["controles"];
const nonFait = (famille: LigneControleTableau["famille"], libelle: string, raison = "pas fait."): LigneControleTableau => ({ famille, libelle, bloquant: false, etat: "non-fait", raison });
const controles = (nonFaits: LigneControleTableau[], indicatifs: LigneControleTableau[] = []): Controles => ({ nonFaits, indicatifs, bloquants: [], lignes: [...nonFaits, ...indicatifs], verdict: "livrable", resume: "", phrases: [] }) as unknown as Controles;

describe("rapport honnête du tableau animé", () => {
  it("(a) 2 non faits (images clés, images figées) : image non vérifiée, 2 alertes « attention », note 70", () => {
    const c = controles([nonFait("relecture", "Relecture des images clés", "aucun relecteur."), nonFait("fichier", "Image figée", "non mesurée.")]);
    expect(verifieDe(c)).toEqual({ image: false, son: true, sousTitres: true, mentionIA: false, droits: true });
    const q = qualiteDe(c, undefined, undefined);
    const att = q.alertes.filter((a) => a.gravite === "attention");
    expect(att).toHaveLength(2);
    for (const a of att) expect(a.message.startsWith("Non vérifié : ")).toBe(true);
    expect(q.note).toBe(70);
  });

  it("(b) rien de non fait ni d'indicatif : verifie identique à avant, note 90", () => {
    const c = controles([]);
    expect(verifieDe(c)).toEqual({ image: true, son: true, sousTitres: true, mentionIA: false, droits: true });
    expect(qualiteDe(c, undefined, undefined)).toEqual({ alertes: [], note: 90 });
  });

  it("(c) 6 non faits : note au plancher de 40", () => {
    const c = controles(Array.from({ length: 6 }, (_, i) => nonFait("fichier", `Contrôle ${i}`)));
    expect(qualiteDe(c, undefined, undefined).note).toBe(40);
  });

  it("un indicatif d'image garde 5 points et rend l'image non vérifiée ; un indicatif étranger à l'image non", () => {
    const ind = (famille: LigneControleTableau["famille"], libelle: string): LigneControleTableau => ({ famille, libelle, bloquant: false, etat: "echoue", raison: "x." });
    const c = controles([], [ind("mise-en-page", "Texte coupé")]);
    expect(verifieDe(c).image).toBe(false);
    expect(qualiteDe(c, undefined, undefined)).toMatchObject({ note: 85 });
    expect(qualiteDe(c, undefined, undefined).alertes[0]).toMatchObject({ gravite: "info", message: "Texte coupé : x." });
    expect(verifieDe(controles([], [ind("fichier", "Volume du son")])).image).toBe(true);
  });

  it("sous-titres non faits : sousTitres faux ; son et droits seulement sur ligne explicite", () => {
    expect(verifieDe(controles([nonFait("fichier", "Sous-titres", "non vérifiés.")])).sousTitres).toBe(false);
    const v = verifieDe(controles([nonFait("fichier", "Volume du son"), nonFait("fichier", "Droits des images")]));
    expect(v).toMatchObject({ son: false, droits: false, sousTitres: true, mentionIA: false });
  });
});
