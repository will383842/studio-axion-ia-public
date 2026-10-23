/**
 * Écran commun « Relire le script » : le bouton principal. Une API pour tous les formats (tableau animé, cas concret,
 * assistant) : `libelleLancer` en phrase entière OU selon le nombre de phrases modifiées ; `prixCentimes` absent = rien
 * à payer à ce geste (`lancer(script, true)`, sans confirmation) ; 0 avec
 * `prixDejaPaye` (voix déjà payée reprise, tableau) = accord 0 sans feuille ; tout autre prix, 0 compris sans
 * l'option, passe TOUJOURS par la confirmation. Sans DOM (crochets factices), aucun réseau.
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

describe("RelireScript : un geste payant ne part jamais sans confirmation", () => {
  it("prix > 0 : la confirmation s'ouvre avec ce prix, puis le lancement porte le montant accepté", async () => {
    confirmerPrix.mockResolvedValue(89);
    await cliquer({ prixCentimes: 89 });
    expect(confirmerPrix).toHaveBeenCalledWith(expect.objectContaining({ montant: 89 }));
    expect(lancer).toHaveBeenCalledTimes(1);
    expect(lancer.mock.calls[0]).toEqual([expect.anything(), 89]);
  });

  it("prix > 0 avec un libellé en phrase entière (tableau) : toujours confirmé", async () => {
    confirmerPrix.mockResolvedValue(null);
    await cliquer({ prixCentimes: 89, libelleLancer: "Découper en scènes (≈ 0,89 € au plus)" });
    expect(confirmerPrix).toHaveBeenCalledTimes(1);
    expect(lancer).not.toHaveBeenCalled();
  });

  it("prix > 0, confirmation refusée : rien ne part", async () => {
    confirmerPrix.mockResolvedValue(null);
    await cliquer({ prixCentimes: 420, libelleLancer: (n) => (n ? "Valider le script modifié" : "Valider ce script") });
    expect(lancer).not.toHaveBeenCalled();
  });

  it("prix non nombre (NaN) ou négatif : confirmé quand même, jamais d'accord à 0", async () => {
    confirmerPrix.mockResolvedValue(null);
    await cliquer({ prixCentimes: Number.NaN });
    await cliquer({ prixCentimes: -1 });
    expect(confirmerPrix).toHaveBeenCalledTimes(2);
    expect(lancer).not.toHaveBeenCalled();
  });

  it("sans prix (rien à payer, ex. valider le script) : part sans confirmation, `lancer(script, true)`", async () => {
    await cliquer({ libelleLancer: (n) => (n ? "Valider le script modifié" : "Valider ce script") });
    expect(confirmerPrix).not.toHaveBeenCalled();
    expect(lancer.mock.calls[0]).toEqual([expect.anything(), true]);
  });

  it("prix 0 sans l'option : confirmerPrix appelé avec montant 0 (comme avant, cas concret et assistant)", async () => {
    confirmerPrix.mockResolvedValue(0);
    await cliquer({ prixCentimes: 0 });
    expect(confirmerPrix).toHaveBeenCalledWith(expect.objectContaining({ montant: 0 }));
    expect(lancer.mock.calls[0]).toEqual([expect.anything(), 0]);
  });

  it("prix 0 avec l'option `prixDejaPaye` (voix déjà payée reprise, tableau) : accord 0, sans feuille", async () => {
    await cliquer({ prixCentimes: 0, prixDejaPaye: true, libelleLancer: "Fabriquer la vidéo (voix déjà payée)" });
    expect(confirmerPrix).not.toHaveBeenCalled();
    expect(lancer.mock.calls[0]).toEqual([expect.anything(), 0]);
  });

  it("option `prixDejaPaye` avec un prix non nul : confirmé quand même", async () => {
    confirmerPrix.mockResolvedValue(null);
    await cliquer({ prixCentimes: 89, prixDejaPaye: true });
    expect(confirmerPrix).toHaveBeenCalledWith(expect.objectContaining({ montant: 89 }));
    expect(lancer).not.toHaveBeenCalled();
  });
});

describe("RelireScript : libellé du bouton, en phrase ou en fonction", () => {
  const libelle = (p: Partial<Proprietes>) => texteDe(boutonPrincipal(ecran(p).rendre())).replace(/\s/g, " ");

  it("phrase entière : telle quelle (le format y met son prix)", () => {
    expect(libelle({ prixCentimes: 89, libelleLancer: "Découper en scènes (≈ 0,89 € au plus)" })).toBe("Découper en scènes (≈ 0,89 € au plus)");
  });

  it("fonction : selon les phrases modifiées, le prix ajouté s'il y en a un", () => {
    const f = (n: number) => (n ? "Valider le script modifié" : "Valider ce script");
    expect(libelle({ libelleLancer: f })).toBe("Valider ce script");
    expect(libelle({ libelleLancer: f, prixCentimes: 420 })).toBe("Valider ce script (≈ 4,20 €)");
  });

  it("par défaut : « Lancer la vidéo (≈ prix) », et sans prix « Lancer la vidéo »", () => {
    expect(libelle({ prixCentimes: 420 })).toBe("Lancer la vidéo (≈ 4,20 €)");
    expect(libelle({})).toBe("Lancer la vidéo");
  });
});
