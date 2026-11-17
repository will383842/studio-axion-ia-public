/**
 * G11-09b · opération de rendu v4 : dépôt facultatif du rendu brut (« master »), ÉTEINT par défaut.
 * Sans `parametres.master` : mêmes paramètres lus, mêmes dépôts, mêmes mesures qu'avant.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { filtreMontageV4, lireParametresFacecamV4, PRISE_MONTEE_V4 } from "../../studio-rendu/src/operations/facecam-v4";

const SOURCE = readFileSync(join(__dirname, "..", "..", "studio-rendu/src/operations/facecam-v4.ts"), "utf8");

const base = (): Record<string, unknown> => ({
  plan: { elementsV4: [{ type: "texte" }], duree: 10, fps: 30, prise: { src: PRISE_MONTEE_V4 } },
  gardes: [{ debutSec: 0, finSec: 5 }],
});

describe("G11-09b · lecture du paramètre master", () => {
  it("sans master : aucune clé master, résultat identique à celui d'aujourd'hui", () => {
    const r = lireParametresFacecamV4(base());
    expect("master" in r).toBe(false);
    expect(lireParametresFacecamV4(base())).toEqual(r);
  });

  it("master valide : présent tel quel", () => {
    const r = lireParametresFacecamV4({ ...base(), master: { urlDepot: "https://depot.exemple/m", cle: "k/master.mp4" } });
    expect(r.master).toEqual({ urlDepot: "https://depot.exemple/m", cle: "k/master.mp4" });
  });

  it("master incomplet ou mal typé : ignoré", () => {
    expect("master" in lireParametresFacecamV4({ ...base(), master: { urlDepot: "https://depot.exemple/m" } })).toBe(false);
    expect("master" in lireParametresFacecamV4({ ...base(), master: { urlDepot: 42, cle: "k" } })).toBe(false);
    expect("master" in lireParametresFacecamV4({ ...base(), master: "texte" })).toBe(false);
  });
});

describe("G11-09b · dépôt du master (lecture statique)", () => {
  const iFinale = SOURCE.indexOf("await deposer(demande.sortie.urlDepot, finale");
  const iMaster = SOURCE.indexOf("await deposer(p.master.urlDepot, rendu");
  it("dépose `rendu` (pas `finale`), après le dépôt de `finale`", () => {
    expect(iFinale).toBeGreaterThan(-1);
    expect(iMaster).toBeGreaterThan(iFinale);
  });
  it("est conditionné par p.master", () => {
    expect(/if \(p\.master\) \{\s*await deposer\(p\.master\.urlDepot, rendu, "video\/mp4"/.test(SOURCE)).toBe(true);
  });
  it("la taille n'entre dans les mesures que si le master est déposé", () => {
    expect(SOURCE).toContain("...(tailleMaster !== undefined ? { tailleMaster } : {})");
  });
  it("vidéo puis vignette puis master : ordre des dépôts existants inchangé", () => {
    expect(SOURCE.indexOf("await deposer(p.vignette.urlDepot")).toBeGreaterThan(iFinale);
    expect(iMaster).toBeGreaterThan(SOURCE.indexOf("await deposer(p.vignette.urlDepot"));
  });
});

describe("G11-09b · filtre de montage inchangé", () => {
  it("même chaîne qu'avant pour deux intervalles", () => {
    const g = [{ debutSec: 1, finSec: 2 }, { debutSec: 3, finSec: 4 }];
    const attendu = g.map((x, i) => `[0:v]trim=start=${x.debutSec}:end=${x.finSec},setpts=PTS-STARTPTS,fps=30[v${i}];[0:a]atrim=start=${x.debutSec}:end=${x.finSec},asetpts=PTS-STARTPTS[a${i}];`).join("") + g.map((_, i) => `[v${i}][a${i}]`).join("") + `concat=n=${g.length}:v=1:a=1[v][a]`;
    expect(filtreMontageV4(g)).toBe(attendu);
  });
});
