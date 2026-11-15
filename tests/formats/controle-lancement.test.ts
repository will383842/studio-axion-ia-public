/** UO-09 : contrôle des formats à chaque lancement (pur, aucun appel réel). */
import { describe, expect, it } from "vitest";
import { controlerFormatsAuLancement } from "@/domaine/formats/controle-lancement";
import { obtenirFormat } from "@/formats";

describe("controlerFormatsAuLancement", () => {
  it("face caméra 9:16 vers TikTok, Instagram et LinkedIn : aucune alerte", () => {
    const f = obtenirFormat("facecam");
    expect(f.ratios).toEqual(["9:16"]);
    expect(controlerFormatsAuLancement({ ratios: f.ratios, reseaux: ["tiktok", "instagram", "linkedin"] })).toEqual([]);
  });

  it("un format 16:9 seul vers TikTok : une alerte en français avec son niveau de preuve", () => {
    const alertes = controlerFormatsAuLancement({ ratios: ["16:9"], reseaux: ["tiktok", "linkedin"] });
    expect(alertes).toHaveLength(1);
    expect(alertes[0].reseau).toBe("tiktok");
    expect(alertes[0].niveauPreuve).toBe("table-registre");
    expect(alertes[0].message).toMatch(/TikTok|tiktok/i);
    expect(alertes[0].message).toMatch(/format/i);
  });

  it("un profil « décision en attente » ou « hypothèse » donne « à vérifier », jamais un refus", () => {
    const fb = controlerFormatsAuLancement({ ratios: ["16:9"], reseaux: ["facebook"], type: "carrousel" });
    const hyp = controlerFormatsAuLancement({ ratios: ["1:1"], reseaux: ["tiktok"], type: "carrousel" });
    expect(hyp).toHaveLength(1);
    expect(hyp[0].niveauPreuve).toBe("hypothese");
    expect(hyp[0].message).toMatch(/à vérifier/i);
    expect(hyp[0].message).not.toMatch(/refus/i);
    for (const a of fb) expect(a.message).toMatch(/format/i);
  });

  it("aucun réseau ou aucun ratio : pas d'alerte inventée, pas d'erreur", () => {
    expect(controlerFormatsAuLancement({ ratios: ["9:16"], reseaux: [] })).toEqual([]);
  });

  it("les formats réels : chaque format actif donne au plus une alerte par réseau, sans exception", () => {
    for (const nom of ["facecam", "avocat", "podcast", "tutoriel-outil"]) {
      const f = obtenirFormat(nom);
      const a = controlerFormatsAuLancement({ ratios: f.ratios, reseaux: f.reseauxConseilles });
      expect(new Set(a.map((x) => x.reseau)).size).toBe(a.length);
    }
  });
});
