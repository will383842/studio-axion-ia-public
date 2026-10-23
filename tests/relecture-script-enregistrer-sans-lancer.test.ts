/**
 * Écran commun « Relire le script » : le bouton secondaire « Enregistrer sans lancer » (cas concret). Il garde les phrases
 * modifiées SANS lancer la vidéo : aucune confirmation de prix, aucun appel à `lancer`, aucune dépense. Sans DOM
 * (crochets factices), aucun réseau.
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
  { id: "p0", dit: "On recrute en quinze minutes." },
  { id: "p1", dit: "Une autre." },
];
const retouchees = [{ ...lignes[0], dit: "Nous recrutons en quinze minutes." }, lignes[1]];
const lancer = vi.fn(async () => ({ ok: true as const }));
const ecran = (p: Partial<Proprietes>) => monter(RelireScript as (p: Proprietes) => ReactNode, { lignes, controler: async () => [], lancer, prixCentimes: 120, ...p });
// Le bouton secondaire est passé dans la propriété `secondaire` de la barre collée : on la parcourt aussi.
const avecSecondaire = (arbre: ReactNode) => [arbre, ...trouver(arbre, (e) => "secondaire" in e.props).map((e) => e.props.secondaire as ReactNode)];
const trouverPartout = (arbre: ReactNode, test: Parameters<typeof trouver>[1]) => avecSecondaire(arbre).flatMap((n) => trouver(n, test));
const bouton = (arbre: ReactNode, re: RegExp) => trouverPartout(arbre, (e) => typeof e.props.onClick === "function" && re.test(texteDe(e)))[0];
const phrases = (arbre: ReactNode) => trouver(arbre, (e) => e.props.role === "alert" || e.props.role === "status").map((e) => texteDe(e));

beforeEach(() => {
  confirmerPrix.mockReset();
  lancer.mockClear();
});

describe("RelireScript : « Enregistrer sans lancer »", () => {
  it("sans la propriété : l'écran ne change pas (aucun bouton secondaire)", () => {
    expect(bouton(ecran({ saisie: retouchees }).rendre(), /Enregistrer sans lancer/)).toBeUndefined();
  });

  it("à côté de « Lancer la vidéo » ; inactif tant que rien n'est modifié", () => {
    const enregistrerSansLancer = vi.fn(async () => ({ ok: true as const, message: "Script enregistré (version 2)" }));
    const vide = trouverPartout(ecran({ enregistrerSansLancer }).rendre(), (e) => /Enregistrer sans lancer/.test(texteDe(e)) && "disabled" in e.props)[0];
    expect(vide.props.disabled).toBe(true);
    const arbre = ecran({ enregistrerSansLancer, saisie: retouchees }).rendre();
    expect(bouton(arbre, /Lancer la vidéo/)).toBeDefined();
    expect(bouton(arbre, /Enregistrer sans lancer/)).toBeDefined();
  });

  it("garde les phrases modifiées, affiche « Script enregistré (version N) », sans lancer ni confirmer aucun prix", async () => {
    const enregistrerSansLancer = vi.fn(async () => ({ ok: true as const, message: "Script enregistré (version 2)" }));
    const e = ecran({ enregistrerSansLancer, saisie: retouchees });
    (bouton(e.rendre(), /Enregistrer sans lancer/).props.onClick as () => void)();
    await attendre();
    expect(enregistrerSansLancer).toHaveBeenCalledTimes(1);
    expect((enregistrerSansLancer.mock.calls[0] as unknown[])[0]).toMatchObject({ modifications: [expect.objectContaining({ id: "p0" })] });
    expect(lancer).not.toHaveBeenCalled();
    expect(confirmerPrix).not.toHaveBeenCalled();
    expect(phrases(e.rendre())).toContain("Script enregistré (version 2)");
  });

  it("un script refusé : la phrase du refus s'affiche, rien n'est enregistré ni payé", async () => {
    const enregistrerSansLancer = vi.fn(async () => ({ ok: false as const, message: "Cette phrase est trop longue. Rien n'a été payé." }));
    const e = ecran({ enregistrerSansLancer, saisie: retouchees });
    (bouton(e.rendre(), /Enregistrer sans lancer/).props.onClick as () => void)();
    await attendre();
    expect(phrases(e.rendre())).toEqual(["Cette phrase est trop longue. Rien n'a été payé."]);
    expect(lancer).not.toHaveBeenCalled();
    expect(confirmerPrix).not.toHaveBeenCalled();
  });
});
