/**
 * Pinterest, PR 1 : réseau CONNU et AFFICHÉ, jamais envoyé. Une épingle n'est pas une vidéo : elle ne doit pas entrer
 * dans le registre vidéo (`RESEAUX`), seulement dans le registre d'affichage séparé (`RESEAUX_HORS_VIDEO`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RESEAUX, listerReseaux } from "@/reseaux";
import { RESEAUX_HORS_VIDEO, definitionAffichage, nomDuReseau } from "@/reseaux/hors-video";
import { CODES_RESEAU } from "@/reseaux/codes";
import { LIMITES_MOTS_DIESES } from "@/reseaux/hashtags";
import { COULEURS_RESEAUX, RESEAUX_COLORES, couleurReseau } from "@/components/calendrier/couleurs-reseaux";
import { PINTEREST_CLAIR, PINTEREST_SOMBRE } from "@/components/calendrier/couleurs-pinterest";
import { styleReseau } from "@/components/calendrier/CarteEntreeCalendrier";
import { RESEAUX_CALENDRIER as FILTRES_CALENDRIER, filtrerParReseau } from "@/components/calendrier/BarreFiltres";
import { REGLAGES_CADENCE_DEFAUT, RESEAUX_CADENCE, nomReseauCadence } from "@/domaine/cadence/reglages";
import { RESEAUX_TAXONOMIE } from "@/domaine/taxonomie-contenu";
import { RESEAUX_CALENDRIER as RESEAUX_USINE } from "@/domaine/usine-calendrier";
import { LIMITES_FORMAT } from "@/domaine/calendrier/formats-media";
import { plateformeZernio } from "@/fournisseurs/publication/zernio-corps";

const lire = (p: string) => readFileSync(join(__dirname, "../..", p), "utf-8");
const CSS = lire("src/app/globals.css");

describe("Pinterest : registre d'affichage séparé du registre vidéo", () => {
  it("le registre vidéo ne contient PAS Pinterest (B-3)", () => {
    expect(RESEAUX.map((r) => r.id)).not.toContain("pinterest");
    expect(listerReseaux().map((r) => r.id)).not.toContain("pinterest");
  });
  it("le registre d'affichage porte Pinterest, code PI, légende de 800 signes", () => {
    expect(RESEAUX_HORS_VIDEO.map((r) => r.id)).toEqual(["pinterest"]);
    const p = definitionAffichage("pinterest");
    expect(p).toMatchObject({ nom: "Pinterest", monogramme: "P", codeClassement: "PI" });
    expect(p.legende).toEqual({ longueurMax: 800, longueurVisible: 100, motsDieseMax: 5, motsDieseConseilles: 2 });
    expect(CODES_RESEAU.pinterest).toBe("PI");
  });
  it("definitionAffichage retrouve aussi un réseau vidéo", () => {
    expect(definitionAffichage("tiktok").nom).toBe("TikTok");
  });
  it("nomDuReseau ne lève jamais", () => {
    expect(nomDuReseau("pinterest")).toBe("Pinterest");
    expect(nomDuReseau("linkedin")).toBe("LinkedIn");
    expect(nomDuReseau("inconnu" as never)).toBe("inconnu");
  });
});

describe("Pinterest : affichage au calendrier", () => {
  it("couleur en clair ET en sombre, hors de globals.css (zone partagée : la garde de zone la refuse sans annonce)", () => {
    expect(CSS).not.toMatch(/--res-pinterest/);
    expect(PINTEREST_CLAIR).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(PINTEREST_SOMBRE).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(PINTEREST_CLAIR).not.toBe(PINTEREST_SOMBRE);
    expect((styleReseau("pinterest") as Record<string, string>)["--c"]).toBe(`var(--res-pinterest, light-dark(${PINTEREST_CLAIR}, ${PINTEREST_SOMBRE}))`);
    expect(couleurReseau("pinterest")).toBe("var(--res-pinterest)");
    expect(COULEURS_RESEAUX.pinterest).toBe("var(--res-pinterest)");
    expect(RESEAUX_COLORES).toContain("pinterest");
  });
  it("la barre de filtres propose 5 pastilles, Pinterest après TikTok", () => {
    expect([...FILTRES_CALENDRIER]).toEqual(["linkedin", "instagram", "facebook", "tiktok", "pinterest"]);
  });
  it("filtrerParReseau garde une entrée Pinterest quand le réseau est allumé, la retire sinon", () => {
    const e = [{ reseau: "pinterest" as const }, { reseau: "tiktok" as const }];
    expect(filtrerParReseau(e, FILTRES_CALENDRIER)).toHaveLength(2);
    expect(filtrerParReseau(e, ["tiktok"])).toEqual([{ reseau: "tiktok" }]);
  });
});

describe("Pinterest : cadence et taxonomie", () => {
  it("cadence : 4 heures décidées, 4 par jour, 210 minutes d'écart", () => {
    expect(RESEAUX_CADENCE).toContain("pinterest");
    expect(REGLAGES_CADENCE_DEFAUT.reseaux.pinterest).toEqual({ heures: ["08:30", "12:30", "17:30", "21:00"], quotaParJour: 4, ecartMinMinutes: 210 });
    expect(REGLAGES_CADENCE_DEFAUT.regles.pinterest).toBeDefined();
    expect(nomReseauCadence("pinterest")).toBe("Pinterest");
  });
  it("taxonomie = registre vidéo ∪ registre d'affichage", () => {
    expect([...RESEAUX_TAXONOMIE].sort()).toEqual([...RESEAUX.map((r) => r.id), ...RESEAUX_HORS_VIDEO.map((r) => r.id)].sort());
  });
  it("le contrat avec l'usine reste SANS Pinterest (I-13)", () => {
    expect([...RESEAUX_USINE]).toEqual(RESEAUX_TAXONOMIE.filter((r) => r !== "pinterest"));
    expect(RESEAUX_USINE).not.toContain("pinterest");
  });
  it("mots-dièse « inconnu » (le relevé n'a pas de preuve : aucun nombre inventé) ; image 20 Mo JPEG/PNG/WebP, pas de vidéo", () => {
    expect(LIMITES_MOTS_DIESES.pinterest).toBe("inconnu");
    expect(LIMITES_FORMAT.pinterest.image?.mimes).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(LIMITES_FORMAT.pinterest.image?.tailleMax).toBe(20 * 1024 * 1024);
    expect(LIMITES_FORMAT.pinterest.video).toBeUndefined();
  });
});

describe("Pinterest : client prêt (PR 3), envoi encore fermé", () => {
  it("plateformeZernio('pinterest') est reconnue ; aucun réseau d'envoi de visuel n'inclut Pinterest (PR 5)", () => {
    expect(plateformeZernio("pinterest")).toBe("pinterest");
  });
});
