/**
 * Écran commun « Relire le script » : le bouton principal. Une API pour tous les formats (tableau animé, cas concret,
 * assistant) : `libelleLancer` en phrase entière OU selon le nombre de phrases modifiées ; aucun prix affiché ni
 * confirmation (décision du 08/11/2026) : `prixCentimes` absent = `lancer(script, true)`, sinon l'accord part avec
 * le montant déclaré. Sans DOM (crochets factices), aucun réseau.
 */
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("./aides/crochets-factices")).crochets }));
const confirmerPrix = vi.fn();
vi.mock("@/components/ui/ConfirmationPrix", async (o) => ({ ...(await o<typeof import("@/components/ui/ConfirmationPrix")>()), confirmerPrix: (...a: unknown[]) => confirmerPrix(...a) }));

const { attendre, monter, texteDe, trouver } = await import("./aides/crochets-factices");
const { RelireScript } = await import("@/components/script/RelireScript");
type Proprietes = import("@/components/script/RelireScript").ProprietesRelireScript;

const lignes = [
  { id: "p0", dit: "Une phrase." },
  { id: "p1", dit: "Une autre." },
];
const lancer = vi.fn(async () => ({ ok: true as const }));
const ecran = (p: Partial<Proprietes>) => monter(RelireScript as (p: Proprietes) => ReactNode, { lignes, controler: async () => [], lancer, ...p });
const boutonPrincipal = (arbre: ReactNode) => trouver(arbre, (e) => typeof e.props.onClick === "function" && /Lancer|Découper|Valider|Fabriquer/.test(texteDe(e)))[0];

async function cliquer(p: Partial<Proprietes>) {
  const b = boutonPrincipal(ecran(p).rendre());
  (b.props.onClick as () => void)();
  await attendre();
}

beforeEach(() => {
  confirmerPrix.mockReset();
  lancer.mockClear();
});

describe("RelireScript : un geste avec montant part directement, sans confirmation ni prix affiché", () => {
  it("montant > 0 : aucune confirmation, le lancement porte le montant", async () => {
    await cliquer({ prixCentimes: 89 });
    expect(confirmerPrix).not.toHaveBeenCalled();
    expect(lancer).toHaveBeenCalledTimes(1);
    expect(lancer.mock.calls[0]).toEqual([expect.anything(), 89]);
  });

  it("montant > 0 avec un libellé en phrase entière (tableau) : part directement", async () => {
    await cliquer({ prixCentimes: 89, libelleLancer: "Découper en scènes" });
    expect(confirmerPrix).not.toHaveBeenCalled();
    expect(lancer.mock.calls[0]).toEqual([expect.anything(), 89]);
  });

  it("sans montant (ex. valider le script) : part sans confirmation, `lancer(script, true)`", async () => {
    await cliquer({ libelleLancer: (n) => (n ? "Valider le script modifié" : "Valider ce script") });
    expect(confirmerPrix).not.toHaveBeenCalled();
    expect(lancer.mock.calls[0]).toEqual([expect.anything(), true]);
  });

  it("montant 0 : accord 0, sans confirmation (avec ou sans `prixDejaPaye`)", async () => {
    await cliquer({ prixCentimes: 0 });
    await cliquer({ prixCentimes: 0, prixDejaPaye: true, libelleLancer: "Fabriquer la vidéo" });
    expect(confirmerPrix).not.toHaveBeenCalled();
    expect(lancer.mock.calls.map((c) => c[1])).toEqual([0, 0]);
  });
});

describe("RelireScript : libellé du bouton, en phrase ou en fonction", () => {
  const libelle = (p: Partial<Proprietes>) => texteDe(boutonPrincipal(ecran(p).rendre())).replace(/\s/g, " ");

  it("phrase entière : telle quelle", () => {
    expect(libelle({ prixCentimes: 89, libelleLancer: "Découper en scènes" })).toBe("Découper en scènes");
  });

  it("fonction : selon les phrases modifiées, jamais de prix ajouté", () => {
    const f = (n: number) => (n ? "Valider le script modifié" : "Valider ce script");
    expect(libelle({ libelleLancer: f })).toBe("Valider ce script");
    expect(libelle({ libelleLancer: f, prixCentimes: 420 })).toBe("Valider ce script");
  });

  it("par défaut : « Lancer la vidéo », avec ou sans montant", () => {
    expect(libelle({ prixCentimes: 420 })).toBe("Lancer la vidéo");
    expect(libelle({})).toBe("Lancer la vidéo");
  });
});
