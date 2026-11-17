/**
 * FIX-SOUS-TITRES-TABLEAU, correction du relecteur (598de81) : PAR LE CHEMIN RÉEL. La commande est construite comme
 * `services/fabrication.ts:481-484` (`reglageIntensite(video.styles, format.profilRendu).niveau`, sans passer l'intensité à
 * la main), puis la ligne réelle de `montage-tableau/index.ts` (lue dans la source et évaluée) donne l'intensité reçue par
 * `fabriquerTableau`, puis la chaîne des sous-titres du tableau.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { reglageIntensite } from "../../../src/briques/intensite/reglage";
import { formatGenerateur, listerFormats } from "../../../src/formats";
import { intensiteSousTitresTableau } from "../../../src/moteurs/montage-tableau/dosage";
import { INTENSITE_SOUS_TITRES_TABLEAU, intensiteEstLeRepli } from "../../../src/moteurs/montage-tableau/sous-titres-tableau";
import { sortieV6616 } from "../sous-titres-dynamiques/chaine";

const INDEX = readFileSync("src/moteurs/montage-tableau/index.ts", "utf8").split("\n");
const LIGNE_DOSAGE = INDEX.find((l) => l.includes("intensiteSousTitresTableau(commande"))!;
const LIGNE_REPLI = INDEX.find((l) => l.includes("intensiteEstLeRepli(commande)"))!;
const evaluer = (ligne: string) => ligne.trim().replace(/^\.\.\./, "").replace(/,$/, "");

type Styles = Parameters<typeof reglageIntensite>[0];
type Commande = { sousTitres: { intensite: "sobre" | "equilibre" | "tres-dynamique" }; dosageMotion?: { cran: "sobre" | "equilibre" | "dynamique"; choisiPar: "video" | "generateur" | "code" }; profilRendu?: unknown };

/** Commande construite comme la fabrication, puis intensité reçue par fabriquerTableau (ligne réelle d'index.ts). */
function intensiteRecue(formatId: string, styles: Styles, dosageMotion?: Commande["dosageMotion"], reste?: "sobre"): string | undefined {
  const format = formatGenerateur(formatId);
  const commande = { sousTitres: { intensite: reglageIntensite(styles, format.profilRendu).niveau }, dosageMotion, profilRendu: format.profilRendu } as Commande;
  const noyau = (r: { intensiteSousTitres?: string }, c: Commande) => ({
    ...(new Function("reste", "commande", "intensiteSousTitresTableau", `return ${evaluer(LIGNE_DOSAGE)};`)(r, c, intensiteSousTitresTableau) as object),
    ...(new Function("reste", "commande", "intensiteEstLeRepli", "INTENSITE_SOUS_TITRES_TABLEAU", `return ${evaluer(LIGNE_REPLI)};`)(r, c, intensiteEstLeRepli, INTENSITE_SOUS_TITRES_TABLEAU) as object),
  }) as { intensiteSousTitres?: string };
  return noyau({ intensiteSousTitres: reste }, commande).intensiteSousTitres;
}

const nu: Styles = {};

describe("tableau-anime : sans choix de la vidéo, un seul style (chemin réel)", () => {
  it("le format existe et n'a pas d'intensité dans son profil ; la fabrication retombe sur « equilibre »", () => {
    expect(listerFormats({ inclureMasques: true }).some((f) => f.id === "tableau-anime")).toBe(true);
    expect(reglageIntensite(nu, formatGenerateur("tableau-anime").profilRendu).niveau).toBe("equilibre");
  });
  it("les deux lignes d'index.ts sont bien là, dans l'ordre (la 2e l'emporte)", () => {
    expect(LIGNE_DOSAGE).toBeTruthy();
    expect(LIGNE_REPLI).toContain("reste.intensiteSousTitres === undefined");
    expect(INDEX.indexOf(LIGNE_REPLI)).toBeGreaterThan(INDEX.indexOf(LIGNE_DOSAGE));
  });
  it("aucun choix : « sobre » (le repli n'est pas un choix)", () => {
    expect(intensiteRecue("tableau-anime", nu)).toBe("sobre");
    expect(intensiteRecue("tableau-anime", nu, { cran: "equilibre", choisiPar: "generateur" })).toBe("sobre");
  });
  it("aucun choix : par la chaîne, ni Impact ni Bandeau, 3 fonds × 4 formats", { timeout: 120_000 }, async () => {
    const { STYLES_TABLEAU } = await import("../../../src/briques/tableau-scene/trois-styles/styles");
    const { IDS_FORMATS_SORTIE } = await import("../../../src/moteurs/montage-tableau/formats-sortie");
    const niveau = intensiteRecue("tableau-anime", nu) as "sobre";
    for (const fond of STYLES_TABLEAU)
      for (const format of IDS_FORMATS_SORTIE) {
        const segs = sortieV6616(fond, format, { intensite: niveau }).calque.segments;
        expect(segs.filter((s) => s.style === "impact" || s.style === "bandeau").map((s) => s.id)).toEqual([]);
      }
  });
  it("choix explicites respectés : sobre, très dynamique, cran de la vidéo, « equilibre » choisi par le cran de la vidéo", () => {
    expect(intensiteRecue("tableau-anime", { intensite: "tres-dynamique" })).toBe("tres-dynamique");
    expect(intensiteRecue("tableau-anime", { intensite: "sobre" })).toBe("sobre");
    expect(intensiteRecue("tableau-anime", { sousTitresIntensite: "tres-dynamique" })).toBe("tres-dynamique");
    expect(intensiteRecue("tableau-anime", nu, { cran: "dynamique", choisiPar: "video" })).toBe("tres-dynamique");
    expect(intensiteRecue("tableau-anime", nu, { cran: "equilibre", choisiPar: "video" })).toBe("equilibre");
  });
  it("des outils qui fixent l'intensité l'emportent", () => {
    expect(intensiteRecue("tableau-anime", nu, undefined, "sobre")).toBeUndefined();
  });
});

describe("intensiteEstLeRepli : fonction pure", () => {
  it("« equilibre » du profil du format n'est pas le repli", () => {
    expect(intensiteEstLeRepli({ sousTitres: { intensite: "equilibre" }, profilRendu: { intensite: "equilibre" } })).toBe(false);
    expect(intensiteEstLeRepli({ sousTitres: { intensite: "equilibre" } })).toBe(true);
    expect(intensiteEstLeRepli({})).toBe(false);
  });
});

describe("autres générateurs inchangés", () => {
  it("seul le moteur du tableau lit la fonction et la constante", () => {
    const sortie = execSync("grep -rlE 'intensiteEstLeRepli|INTENSITE_SOUS_TITRES_TABLEAU' src", { encoding: "utf8" }).trim().split("\n").sort();
    for (const f of sortie) expect(f.startsWith("src/moteurs/montage-tableau/"), f).toBe(true);
  });
  it("les autres formats gardent « equilibre » par défaut (reglageIntensite inchangé)", () => {
    for (const f of listerFormats({ inclureMasques: true })) {
      if (f.id === "tableau-anime" || f.profilRendu?.intensite || f.profilRendu?.sousTitresIntensite) continue;
      expect(reglageIntensite(nu, f.profilRendu).niveau, f.id).toBe("equilibre");
    }
  });
});
