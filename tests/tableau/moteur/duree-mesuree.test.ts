/**
 * FIX-RENDU-DUREE : la durée d'une sortie du tableau est celle MESURÉE sur le fichier (ffprobe), les sous-titres qui
 * finissent après la vidéo sont signalés, et l'estimation du lancement laissée à l'écran est dite. Doubles seulement.
 */
import { describe, expect, it } from "vitest";
import { ECART_SOUS_TITRES_FIN_SEC, fabriquerTableau, type CompteRenduFabrication } from "../../../src/moteurs/montage-tableau/fabriquer";
import { qualiteDe, resultatDe } from "../../../src/moteurs/montage-tableau/index";
import type { ServiceRendu } from "../../../src/fournisseurs/types";
import { ficheDemonstration } from "../regles/exemples";
import { doubles } from "../fabriquer/doubles";

type Mesure = (calculee: number) => number | undefined;

/** Fabrique avec un rendu dont la composition complète rend la durée `mesure(calculée)` (undefined : mesure absente). */
async function fabriquer(mesure: Mesure) {
  const d = doubles(ficheDemonstration);
  const rendu = d.outils.montage.rendu();
  const enveloppe: ServiceRendu = {
    soumettre: (dem) => rendu.soumettre(dem),
    async etat(id) {
      const e = await rendu.etat(id);
      if (e.statut !== "termine" || !e.mesures) return e;
      const { dureeSec, ...reste } = e.mesures as Record<string, number>;
      const m = mesure(dureeSec);
      return { ...e, mesures: m === undefined ? reste : { ...reste, dureeSec: m } };
    },
  };
  d.outils.montage.rendu = () => enveloppe;
  return fabriquerTableau(d.outils);
}

const finST = (r: CompteRenduFabrication) => r.sorties[0].sousTitres!.at(-1)!.finSec;
const alertesSync = (r: CompteRenduFabrication) => (r.sorties[0].alertes ?? []).filter((a) => a.code === "synchronisation" && a.message.startsWith("Les sous-titres continuent"));

describe("FIX-RENDU-DUREE", () => {
  it("(a) la durée de la sortie est la mesure du fichier ; mesure absente : la durée calculée d'avant", async () => {
    const ref = await fabriquer(() => undefined);
    const calculee = ref.sorties[0].dureeSec;
    expect(calculee).toBeGreaterThan(0);
    const mesuree = await fabriquer((c) => +(c + 0.4).toFixed(3));
    expect(mesuree.sorties[0].dureeSec).toBe(+(calculee + 0.4).toFixed(3));
    expect(mesuree.dureeSec).toBe(mesuree.sorties[0].dureeSec);
    for (const invalide of [0, -3, Number.NaN]) expect((await fabriquer(() => invalide)).sorties[0].dureeSec).toBe(calculee);
  });

  it("(b) sous-titres qui finissent bien après la mesure : une alerte « synchronisation » / « attention » avec les deux durées", async () => {
    const ref = await fabriquer(() => undefined);
    const fin = finST(ref);
    const mesure = +(fin - 11).toFixed(3);
    const r = await fabriquer(() => mesure);
    const a = alertesSync(r);
    expect(a).toHaveLength(1);
    expect(a[0].gravite).toBe("attention");
    expect(a[0].message).toContain(String(Math.round(fin)));
    expect(a[0].message).toContain(String(Math.round(mesure)));
    expect(r.sorties[0].dureeSec).toBe(mesure);
    expect(r.sorties[0].cles.video).toBeTruthy();
  });

  it("(b) écart dans la tolérance : aucune alerte, rapport identique", async () => {
    expect(ECART_SOUS_TITRES_FIN_SEC).toBe(0.5);
    const ref = await fabriquer(() => undefined);
    const r = await fabriquer(() => +(finST(ref) - 0.3).toFixed(3));
    expect(alertesSync(r)).toHaveLength(0);
    expect(r.sorties[0].alertes ?? []).toEqual(ref.sorties[0].alertes ?? []);
  });

  it("(c) resultatDe : sans sous-titres, alerte « info » ; avec, absente ; (d) note et verifie identiques", async () => {
    const r = await fabriquer(() => undefined);
    const etat = { journal: { etapes: {} } } as unknown as Parameters<typeof resultatDe>[2];
    const commande = { entrees: {} } as never;
    const avec = resultatDe(commande, r, etat);
    const sansSt = resultatDe(commande, { ...r, sorties: r.sorties.map((s) => ({ ...s, sousTitres: undefined })) }, etat);
    const MOT = "Les sous-titres affichés sont l'estimation du lancement";
    expect(avec.sousTitres?.length).toBeGreaterThan(0);
    expect(avec.noteQualite.alertes.some((a) => a.message.includes(MOT))).toBe(false);
    const info = sansSt.noteQualite.alertes.filter((a) => a.message.includes(MOT));
    expect(info).toHaveLength(1);
    expect(info[0].gravite).toBe("info");
    expect(sansSt.noteQualite.globale).toBe(avec.noteQualite.globale);
    expect(sansSt.noteQualite.globale).toBe(qualiteDe(r.controles, r.fin, r.recetteVoix, r.alertes).note);
    expect(sansSt.sorties.map((s) => s.rapportQualite.verifie)).toEqual(avec.sorties.map((s) => s.rapportQualite.verifie));
    expect(sansSt.sorties.map((s) => s.rapportQualite.note)).toEqual(avec.sorties.map((s) => s.rapportQualite.note));
  });
});
