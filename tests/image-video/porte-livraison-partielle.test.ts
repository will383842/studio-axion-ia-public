/**
 * GV2-26 · Livraison partielle : un contrôle bloquant propre à UNE version ne refuse plus toute la vidéo ; les réseaux
 * dont les versions sont bonnes sont livrés, les autres sortent « non livrés » avec la phrase du contrôle. Une faute
 * commune à toutes les versions refuse toujours la vidéo entière. Outils simulés, aucun appel payant.
 */
import { describe, expect, it, vi } from "vitest";
import { cartesReseaux } from "@/components/formats/image-video/vue";
import { avancerJusquAArretIV, etatInitialIV, validerCarteIV, validerScriptIV, attendWillIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

async function jusquAuBout(e0: EtatFabricationIV, o: OutilsFabricationIV): Promise<EtatFabricationIV> {
  let e = await avancerJusquAArretIV(e0, o);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
    else if (attendWillIV(e) === "script") {
      const choixFormules = Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const]));
      e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules }), o);
    } else break;
  }
  return e;
}

/** Les mesures du rendu de la version choisie rapportent une image noire de 5 s (faute propre à cette version). */
function avecNoirSur(o: OutilsFabricationIV, choisie: (version: string) => boolean): OutilsFabricationIV {
  return { ...o, rendre: async (d) => { const r = await o.rendre(d); return choisie(d.version) ? { ...r, mesures: { ...r.mesures!, noirMaxSec: 5 } } : r; } };
}

const est45 = (v: string) => v.endsWith("-4x5");

describe("livraison partielle (étape contrôles)", () => {
  it("une faute propre à la version 4:5 (LinkedIn seul) : étape prête, 3 réseaux livrés, LinkedIn « aucune » avec la phrase du contrôle", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const fini = await jusquAuBout(etatInitialIV(demandeEssai(carte)), avecNoirSur(outilsSimules(carte, m), est45));
    expect(fini.etape).toBe("prete");
    expect(fini.refus).toBeUndefined();
    const parReseau = Object.fromEntries((fini.livraison ?? []).map((l) => [l.reseau, l]));
    expect(["youtube-shorts", "instagram", "facebook"].map((r) => parReseau[r]!.version)).toEqual(["longue", "longue", "longue"]);
    for (const r of ["youtube-shorts", "instagram", "facebook"]) expect(parReseau[r]!.fichierCle).toBeTruthy();
    expect(parReseau.linkedin).toMatchObject({ version: "aucune" });
    expect(parReseau.linkedin!.fichierCle).toBeUndefined();
    expect(parReseau.linkedin!.refusControle).toMatch(/noir/i);
    // Facebook garde son Reel 9:16, sans le fil 4:5 refusé.
    expect(parReseau.facebook!.fichierCleFil).toBeUndefined();
    expect(parReseau.facebook!.texteFil).toBeUndefined();
    expect(parReseau.facebook!.mention).toMatch(/fil 4:5/);
    // L'écran dit pourquoi.
    const carteLi = cartesReseaux(fini.livraison!).find((c) => c.reseau === "linkedin")!;
    expect(carteLi.ton).toBe("rouge");
    expect(carteLi.phrase).toMatch(/^Ce réseau n'a pas été livré : .*noir/i);
  });

  it("une faute commune à toutes les versions : refus global IV_CONTROLES comme avant", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const fini = await jusquAuBout(etatInitialIV(demandeEssai(carte)), avecNoirSur(outilsSimules(carte, m), () => true));
    expect(fini.etape).toBe("refusee");
    expect(fini.refus).toMatchObject({ etape: "controles", code: "IV_CONTROLES", reessayable: false });
    expect(fini.livraison).toBeUndefined();
  });

  it("une faute sur toutes les versions d'un seul réseau n'est pas livrée, mais ne refuse pas les autres", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const fini = await jusquAuBout(etatInitialIV(demandeEssai(carte)), avecNoirSur(outilsSimules(carte, m), (v) => v === "fin-instagram"));
    expect(fini.etape).toBe("prete");
    const l = Object.fromEntries((fini.livraison ?? []).map((x) => [x.reseau, x.version]));
    expect(l).toEqual({ "youtube-shorts": "longue", linkedin: "longue", instagram: "aucune", facebook: "longue" });
  });
});
