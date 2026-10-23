/**
 * 23/10/2026 : v-6e4a06b9c718, « Refaire cette partie » après une correction de l'affichage seul aurait repris les anciens rendus
 * (même refus à 0 €). L'identifiant de rendu contient donc la version des compositions : elle change à chaque correction.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VERSION_COMPOSITIONS_IV } from "@/moteurs/montage-image-video/fabrication";

describe("version des compositions de rendu", () => {
  it("existe, est versionnée, et n'est plus la première version (corrections du 23/10)", () => {
    expect(VERSION_COMPOSITIONS_IV).toMatch(/^compositions-iv\/\d+$/);
    expect(Number(VERSION_COMPOSITIONS_IV.split("/")[1])).toBeGreaterThanOrEqual(2);
  });

  it("entre dans l'identifiant de rendu (sinon une correction d'affichage n'est jamais rendue de nouveau)", () => {
    const code = readFileSync(join(__dirname, "../../src/moteurs/montage-image-video/fabrication.ts"), "utf8");
    expect(code).toMatch(/iv-rendu-\$\{empreinteDe\(\[v\.id, empreinteDe\(ligne\), mixage\.id, VERSION_COMPOSITIONS_IV\]\)\}/);
  });

  it("entre aussi dans la clé de chaque scène de toile (sinon l'ancienne scène, dessinée avant la correction, est réutilisée)", () => {
    const code = readFileSync(join(__dirname, "../../src/services/image-video-rendu.ts"), "utf8");
    expect(code).toMatch(/empreinte\(\["scene-iv\/2", VERSION_COMPOSITIONS_IV, parametres\]\)/);
  });
});
