/**
 * LOT R1 — ÉCRANS (rendu serveur, sans clic) : bloc Buffer de Réglages et feuille « Envoyer vers Buffer ».
 *  - l'état dit la vérité (Relié / À relier / Simulation), le mode « Brouillon dans Buffer » est le défaut ;
 *  - un réseau sans compte ou avec deux comptes est signalé, avec le choix ; aucune valeur de clé, jamais ;
 *  - vouvoiement, mots simples, aucune mention « IA » imposée ;
 *  - le bouton d'envoi dit ce qui va VRAIMENT se passer.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }) }));
vi.mock("@/app/(studio)/videos/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: undefined })) }));

const { libelleEnvoi } = await import("@/components/publication/FeuilleEnvoyer");

describe("R1 — bloc Buffer (Réglages) retiré en L0-13c", () => {
  it("Réglages ne rend plus de bloc Buffer : fichiers retirés, page sans BlocBuffer ni vueBuffer", () => {
    const page = readFileSync("src/app/(studio)/reglages/page.tsx", "utf8");
    expect(page).not.toMatch(/BlocBuffer|vueBuffer/);
    expect(existsSync("src/components/reglages/BlocBuffer.tsx")).toBe(false);
  });

  it("la feuille d'envoi ne nomme plus Buffer à l'écran", () => {
    for (const mode of [undefined, "brouillon", "programmer"] as const) expect(libelleEnvoi(mode, false)).not.toMatch(/buffer/i);
  });

  it("le bouton d'envoi dit ce qui va vraiment se passer", () => {
    expect(libelleEnvoi(undefined, true)).toBe("Envoyer");
    expect(libelleEnvoi("brouillon", true)).toBe("Envoyer");
    expect(libelleEnvoi("brouillon", false)).toBe("Envoyer en brouillon");
    expect(libelleEnvoi("programmer", false)).toBe("Programmer dans Zernio");
  });
});
