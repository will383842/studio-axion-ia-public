import { describe, expect, it } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { moteurDeCommande, moteurExiste } from "@/moteurs";
import { codeDuFormat } from "@/formats/registre-codes";
import { formatGenerateur, trouverFormat } from "@/formats";
import { moteurMontageDemoFacecam } from "../montage-demo-facecam";
import { moteurMontageTutorielOutil } from "../montage-tutoriel-outil";

const commande = { videoId: "v1", formatId: "tutoriel-outil", ratios: ["9:16"], briques: {}, distribution: [] } as unknown as CommandeFabrication;
const ctx = { travailId: "t1", versionId: "ver1", titre: "Essai", maintenant: Date.UTC(2026, 10, 8) };

describe("vitrines branchées plus tard", () => {
  it("les deux formats sont inscrits (codes TO et DF), masqués, sans prix, avec leur moteur", () => {
    for (const [id, code, moteur] of [["tutoriel-outil", "TO", "montage-tutoriel-outil"], ["demo-facecam", "DF", "montage-demo-facecam"]] as const) {
      expect(codeDuFormat(id)).toBe(code);
      expect(trouverFormat(id)?.statut).toBe("masque");
      expect(trouverFormat(id)?.sansPrix).toBe(true);
      expect(trouverFormat(id)?.moteur).toBe(moteur);
      expect(moteurExiste(moteur)).toBe(true);
      expect(formatGenerateur(id).codeClassement).toBe(code);
    }
  });
  it("le tutoriel : voix HeyGen épinglée, pas de visage", () => {
    const f = trouverFormat("tutoriel-outil")!;
    expect(f.capacitesRequises).not.toContain("visage");
    expect(f.pieces?.voix).toBe("voix-maitre");
  });
  it("la démo : deux vidéos acceptées, la voix reste celle de la prise", () => {
    const f = trouverFormat("demo-facecam")!;
    expect(f.entrees.map((e) => e.cle)).toEqual(["rushs", "capture-ecran"]);
    expect(f.entrees[1].obligatoire).toBe(false);
    expect(f.pieces?.voix).toBe("prise-filmee");
  });
  // Lot I : le tutoriel est branché ; sans ses outils (voix, rendu) reliés, il reste en pause claire « outils non reliés ».
  for (const [moteur, codePause] of [[moteurMontageTutorielOutil, "TO_OUTILS_NON_RELIES"], [moteurMontageDemoFacecam, "PAS_ENCORE_BRANCHE"]] as const) {
    it(`${moteur.id} : le lancement met en pause claire, sans échec, sans coût`, async () => {
      const t = await moteur.lancer(commande, ctx);
      expect(t.statut).toBe("en_file");
      expect(t.erreur).toBeUndefined();
      const apres = await moteur.avancer(t, commande, ctx.maintenant + 60_000);
      expect(apres.travail.parametres?.pause).toMatchObject({ code: codePause });
      expect(apres.travail.statut).toBe("en_file");
      expect(apres.travail.etapes.some((e) => e.statut === "echec")).toBe(false);
      expect(apres.resultat).toBeUndefined();
      expect((await moteur.estimer(commande)).total.centimes).toBe(0);
      expect(moteur.refusAuLancement?.(commande)).toBeNull();
    });
  }
  it("moteurDeCommande retrouve la vitrine par le format", () => {
    expect(moteurDeCommande({ formatId: "tutoriel-outil" }).id).toBe("montage-tutoriel-outil");
  });
});
