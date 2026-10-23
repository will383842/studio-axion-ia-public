/**
 * V4-3 · DÉFAUTS VISIBLES « BROUILLON », mesurés sur la mise en page réelle (`disposer`) des écrans tels que la chaîne
 * les rend : texte sur texte, téléphone vide, objet dans la bande des sous-titres, phrase écrite ET dite telle quelle.
 * La v4 (script validé) n'en a aucun ; les 7 cas du catalogue, simulés (gabarit, captures remplacées par leur repli),
 * n'ont aucun défaut de mise en page ; leurs phrases en double (gabarit sans Claude) sont relevées.
 */
import { describe, expect, it } from "vitest";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import type { EcranCale } from "@/briques/ecrans-motion";
import { FIN_APRES_DERNIER_MOT_SEC, ZONE_PLEINE_IMAGE_CAS_CONCRET } from "@/formats/cas-concret";
import { CATALOGUE, trouverCas } from "@/formats/cas-concret/catalogue";
import { calerFiche } from "@/moteurs/montage-cas-concret/calage";
import { appliquerCaptures } from "@/moteurs/montage-cas-concret/captures";
import { defautsEcran, defautsVisuels } from "@/moteurs/montage-cas-concret/defauts-visuels";
import { CONSIGNE_ECRITURE, ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { ecransCales, regrouperFins } from "@/moteurs/montage-cas-concret/etapes";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { motsLus } from "@/moteurs/montage-cas-concret/fiche";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";
import { scriptValideDuCatalogue } from "@/moteurs/montage-cas-concret/script-valide";
import { clesImagesDuCas, imagesDuCas } from "@/moteurs/montage-cas-concret/visuels-du-cas";
import { proprietesPleineImage } from "@/moteurs/montage-cas-concret/zone-objets";
import { doubles } from "../fabriquer/doubles";
import { ficheV4, finV4, proprietesV4 } from "../../../outils/v4-fidelite/fiche-v4";

/** Un cas du catalogue simulé : gabarit, captures en repli, fin Facebook, mots au débit de la recette. */
function simule(casId: string) {
  const cas = trouverCas(casId)!;
  const fiche = appliquerCaptures(ficheParGabarit(cas, { videoId: "v", versionId: "v", habillage: "charte-duo/1", origine: "porte-a" }), { demandes: [], resultats: {} }).fiche;
  const fin = regrouperFins(planDesFins({ reseaux: ["facebook"], offre: cas.offre, nature: cas.nature, mot: cas.mot, motDit: cas.motDit, avecMot: false, motSur: [], table: TABLE_FINS_DIAGNOSTIC })).fins[0];
  const mots = [...fiche.ecrans, ...fin.ecrans].flatMap((e) => motsLus(e.texteDit)).map((mot, i) => ({ mot, debutSec: i / 3.4, finSec: (i + 0.8) / 3.4 }));
  const c = calerFiche(fiche, fin, mots, { finApresDernierMotSec: FIN_APRES_DERNIER_MOT_SEC });
  if (!c.ok) throw new Error(c.problemes.join("\n"));
  const im = imagesDuCas(c.fiche, cas, new Set(clesImagesDuCas(cas)));
  const parEcran = Object.fromEntries(Object.entries(im.captures).map(([id, x]) => [id, { cle: x.cle }]));
  const captures = Object.fromEntries(Object.values(im.captures).map((x) => [x.cle, { ...x, src: "image.png" }]));
  const props = proprietesPleineImage({ ecrans: [...ecransCales(im.fiche.ecrans, c.evenements, null, parEcran, cas.faits), ...ecransCales(c.fin!.ecrans, c.evenements, c.fin!, {})], captures });
  return defautsVisuels(props, Object.fromEntries([...im.fiche.ecrans, ...c.fin!.ecrans].map((e) => [e.id, e.texteDit])));
}

describe("V4-3 · le contrôle relève ce qui se voit", () => {
  const base = { id: "e01", fond: "sombre", debutMs: 0, finMs: 3000, evenements: [] };
  const un = (c: object) => proprietesPleineImage({ ecrans: [{ ...base, ...c } as unknown as EcranCale], captures: {} })[0];
  it("un téléphone sans image est vide", () => {
    expect(defautsEcran(un({ type: "etape", numero: 1, nombreEtapes: 3, titre: "L'annonce", ligne: "Elle la voit.", visuel: { objet: "telephone-capture" }, puces: [] })).map((d) => d.sorte)).toEqual(["objet-vide"]);
  });
  it("une ligne écrite et dite telle quelle est une phrase en double ; reformulée, non", () => {
    const p = un({ type: "objet", titre: "Le *rappel*", ligne: "Le rappel part tout seul.", visuel: { objet: "telephone-notification" } });
    expect(defautsEcran(p, "Et si elle oublie, le rappel part tout seul.").map((d) => d.sorte)).toEqual([]);
    expect(defautsEcran(p, "Elle oublie. Le rappel part tout seul.").map((d) => d.sorte)).toEqual(["phrase-en-double"]);
  });
});

describe("V4-3 · relevé sur la v4 et les 7 cas du catalogue", () => {
  it("la consigne d'écriture interdit la phrase écrite et dite telle quelle", () => {
    expect(CONSIGNE_ECRITURE).toContain("il ne répète jamais mot pour mot la phrase dite");
  });

  it("la v4 (script validé, chaîne du format) : aucun défaut visible", () => {
    const props = proprietesV4(process.cwd(), { ...ZONE_PLEINE_IMAGE_CAS_CONCRET }, (f) => f, { avantCorrection: false, pleineImage: true });
    expect(defautsVisuels(props, Object.fromEntries([...ficheV4().ecrans, ...finV4().ecrans].map((e) => [e.id, e.texteDit])))).toEqual([]);
  });

  it("une fabrication avec le script validé ne remonte aucun défaut visible", async () => {
    const d = doubles();
    d.options.scriptValide = scriptValideDuCatalogue("recrutement-apporteurs")!;
    expect((await fabriquerCasConcret(d.options)).defautsVisuels.filter((x) => x.ecranId.startsWith("e"))).toEqual([]);
  });

  it.each(CATALOGUE.map((c) => [c.id] as const))("%s simulé : ni texte sur texte, ni objet vide, ni objet sous les sous-titres", (id) => {
    expect(simule(id).filter((d) => d.sorte !== "phrase-en-double")).toEqual([]);
  });
});
