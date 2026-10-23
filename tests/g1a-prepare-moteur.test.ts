/**
 * G1a, branche `generateur/prepare-moteur` (non fusionnée, sur accord de Will) : les fichiers de la session du moteur
 * reçoivent les ajouts préparés (plan v5 B.1) et restent d'accord avec les registres du générateur.
 */
import { describe, expect, it } from "vitest";
import { listerFormats, obtenirFormat } from "@/formats";
import { codeDuFormat } from "@/formats/registre-codes";
import { CODES_RESEAU } from "@/reseaux/codes";
import { listerReseaux, obtenirReseau } from "@/reseaux";

describe("formats et réseaux préparés pour le générateur", () => {
  it("chaque format porte son code (identique au registre) et sa déclinaison", () => {
    for (const f of listerFormats({ inclureMasques: true })) {
      expect(f.codeClassement, f.id).toBe(codeDuFormat(f.id));
      expect(["ouverture-fin", "corps-distinct", "aucune"]).toContain(f.declinaison);
    }
  });

  it("avocat : Facebook conseillé, 2 segments facultatifs au plus ; Créateur B en face caméra", () => {
    const avocat = obtenirFormat("avocat");
    expect(avocat.reseauxConseilles).toContain("facebook");
    expect(avocat.recetteScript.segmentsFacultatifsMax).toBe(2);
    expect(obtenirFormat("createur-b").famille).toBe("face-camera");
  });

  it("registre des réseaux : code lu dans reseaux/codes.ts, monogramme Shorts = YS, couverture Instagram 3:4", () => {
    for (const r of listerReseaux()) expect(r.codeClassement, r.id).toBe(CODES_RESEAU[r.id]);
    expect(obtenirReseau("youtube-shorts").monogramme).toBe("YS");
    expect(obtenirReseau("instagram").miniature.ratio).toBe("3:4");
  });
});
