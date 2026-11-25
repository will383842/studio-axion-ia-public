/** Studio déployé avant studio-rendu : la composition « VideoLongue » inconnue du service donne un échec CLAIR et RÉESSAYABLE. */
import { describe, expect, it } from "vitest";
import { erreurEchecPlage, ErreurMontageVideoLongue } from "@/services/video-longue-montage";

describe("échec d'une plage", () => {
  it("composition introuvable (message de studio-rendu) : phrase claire, réessayable, sans anglais", () => {
    const e = erreurEchecPlage("Composition « VideoLongue » introuvable : Could not find composition with ID VideoLongue. The following compositions are available: PlanDeScenes");
    expect(e).toBeInstanceOf(ErreurMontageVideoLongue);
    expect(e.reessayable).toBe(true);
    expect(e.message).toContain("pas encore à jour");
    expect(e.message).toContain("rien n'est payé");
    expect(e.message).not.toMatch(/could not find/i);
  });
  it("autre échec : définitif, message d'origine gardé", () => {
    const e = erreurEchecPlage("ffmpeg a planté");
    expect(e.reessayable).toBe(false);
    expect(e.message).toContain("ffmpeg a planté");
  });
});
