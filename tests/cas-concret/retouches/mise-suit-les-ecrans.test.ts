/**
 * S-08 · la déclinaison d'animation (`fiche.mise.ecrans`, clé = identifiant d'écran) SUIT les écrans quand une retouche les
 * renumérote (retirer une étape ; déplacer : voir plus bas) : l'écran qui devient « e03 » garde SA mise, pas celle de l'ancien « e03 ».
 * Fiche sans mise : résultat inchangé. Pièce pure, aucun appel.
 */
import { describe, expect, it } from "vitest";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { dureesDesFins, ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { regrouperFins } from "@/moteurs/montage-cas-concret/etapes";
import type { EcranCorps, FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";
import { apercuRetoucheCasConcret, type ContexteRetoucheCasConcret } from "@/moteurs/montage-cas-concret/retouches";
import { ENTREES, MOUVEMENTS_CAMERA, SORTIES, mettre, tirer, type Mise, type TirageEcran } from "@/moteurs/montage-cas-concret/variete";

const cas = trouverCas("recrutement-apporteurs")!;
const reseaux = ["facebook", "instagram", "tiktok", "linkedin"] as const;
const motSur = ["facebook", "instagram"] as const;
const contexte: ContexteRetoucheCasConcret = { cas, reseaux: [...reseaux], motSur: [...motSur], mot: cas.mot, ...(cas.motDit ? { motDit: cas.motDit } : {}), avecMot: true, table: TABLE_FINS_DIAGNOSTIC };
const plan = regrouperFins(planDesFins({ reseaux: [...reseaux], offre: cas.offre, ...(cas.nature ? { nature: cas.nature } : {}), mot: cas.mot, ...(cas.motDit ? { motDit: cas.motDit } : {}), avecMot: true, motSur: [...motSur], table: TABLE_FINS_DIAGNOSTIC }));
const sansMise: FicheEcrans = ficheParGabarit(cas, { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" }, dureesDesFins(plan.fins));

/** Une mise réelle (tirée par `variete.ts`) dont CHAQUE écran porte une animation différente de celle de son voisin. */
function ficheAvecMise(): FicheEcrans {
  const tirage = tirer({ videoId: "video-cc", canaux: [...reseaux], historique: [] });
  const base = mettre(tirage, sansMise.ecrans.map((e) => ({ id: e.id, type: e.type, fond: e.fond })));
  const ecrans: Mise["ecrans"] = {};
  sansMise.ecrans.forEach((e, i) => {
    const t = base.ecrans[e.id] as TirageEcran;
    ecrans[e.id] = { ...t, entree: ENTREES[i % ENTREES.length], sortie: SORTIES[i % SORTIES.length], camera: MOUVEMENTS_CAMERA[(i * 2) % MOUVEMENTS_CAMERA.length] };
  });
  return { ...sansMise, mise: { ...base, ecrans } };
}

/** Le titre qui reconnaît un écran d'une fiche à l'autre (les ids changent, pas le contenu). */
const empreinteContenu = (e: EcranCorps) => `${e.type}|${e.texteDit}`;

describe("S-08 · la mise suit les écrans", () => {
  const fiche = ficheAvecMise();

  it("la fiche d'essai : au moins 6 écrans, une mise différente par écran", () => {
    expect(fiche.ecrans.length).toBeGreaterThanOrEqual(6);
    const vues = new Set(Object.values(fiche.mise!.ecrans).map((t) => JSON.stringify([t.entree, t.sortie, t.camera])));
    expect(vues.size).toBeGreaterThan(3);
  });

  it("retirer une étape : chaque écran gardé garde SA mise sous son nouvel identifiant ; celle de l'écran retiré disparaît", () => {
    // e06 est la 1re étape : elle part avec son écran « objet » (e07) ; tout ce qui suit change de numéro.
    const a = apercuRetoucheCasConcret(fiche, [{ type: "retirer-etape", ecranId: "e06" }], contexte);
    expect(a.refus).toEqual([]);
    const apres = a.fiche;
    const restants = fiche.ecrans.filter((e) => apres.ecrans.some((n) => empreinteContenu(n) === empreinteContenu(e)));
    expect(restants.length).toBe(apres.ecrans.length);
    expect(restants.length).toBeLessThan(fiche.ecrans.length);
    // Au moins un écran a vraiment changé de numéro (sinon le test ne prouverait rien).
    expect(restants.some((e) => apres.ecrans.find((n) => empreinteContenu(n) === empreinteContenu(e))!.id !== e.id)).toBe(true);
    for (const e of restants) {
      const nouveau = apres.ecrans.find((n) => empreinteContenu(n) === empreinteContenu(e))!;
      expect(apres.mise!.ecrans[nouveau.id]).toEqual(fiche.mise!.ecrans[e.id]);
    }
    expect(Object.keys(apres.mise!.ecrans).sort()).toEqual(apres.ecrans.map((e) => e.id).sort());
    // Le reste de la mise (tirage, version) ne bouge pas.
    expect({ ...apres.mise!, ecrans: {} }).toEqual({ ...fiche.mise!, ecrans: {} });
  });

  // Sur master la règle « ordre du fonctionnement » refuse tout échange d'étapes (aucun des cas du catalogue ne l'accepte) :
  // le remappage de `deplacer-etape` est le même code que celui de retirer ; ici on prouve que le refus ne touche pas la mise.
  it("déplacer une étape : refusé par la règle d'ordre, la fiche et sa mise ne changent pas", () => {
    const a = apercuRetoucheCasConcret(fiche, [{ type: "deplacer-etape", ecranId: "e09", vers: "avant" }], contexte);
    expect(a.ok).toBe(false);
    expect(a.fiche).toEqual(fiche);
  });

  it("fiche SANS mise : retirer ne crée aucune mise (résultat identique à avant)", () => {
    const a = apercuRetoucheCasConcret(sansMise, [{ type: "retirer-etape", ecranId: "e09" }], contexte);
    expect(a.refus).toEqual([]);
    expect("mise" in a.fiche).toBe(false);
    expect(a.fiche.ecrans.map((x) => x.id)).toEqual(a.fiche.ecrans.map((_, i) => `e${String(i + 1).padStart(2, "0")}`));
  });
});
