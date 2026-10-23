/**
 * « Découper à nouveau » (une fiche existe), câblage de l'ÉCRAN (`NouvelleVideoTableau`) : le texte modifié dans le
 * grand champ « Le texte dit » ne part jamais tel quel au découpage payant. Le clic rouvre « Relire le script » sur ce
 * texte, sans prix ni appel. Texte inchangé : le prix est confirmé, puis le découpage part avec le repère du texte relu.
 * Sans DOM (crochets factices), actions serveur remplacées par des doubles : aucun réseau, rien de payé.
 */
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ficheErreurCorrigee } from "../regles/exemples/erreur-corrigee";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../../aides/crochets-factices")).crochets }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace() {}, push() {}, refresh() {} }) }));
const actions = vi.hoisted(() => ({
  cocherDejaVuTableauAction: vi.fn(),
  controlerFicheTableauAction: vi.fn(),
  controlerTexteTableauAction: vi.fn(),
  corrigerFicheTableauAction: vi.fn(),
  decouperScriptTableauAction: vi.fn(),
  fabriquerVideoTableauAction: vi.fn(),
}));
vi.mock("@/app/(studio)/tableau/nouvelle/actions", () => actions);
const confirmerPrix = vi.fn();
vi.mock("@/components/ui/ConfirmationPrix", async (o) => ({ ...(await o<typeof import("@/components/ui/ConfirmationPrix")>()), confirmerPrix: (...a: unknown[]) => confirmerPrix(...a) }));
vi.mock("@/components/ui/Toast", () => ({ notifier: { succes: () => undefined, erreur: () => undefined, info: () => undefined } }));

const { attendre, monter, texteDe, trouver } = await import("../../aides/crochets-factices");
const { NouvelleVideoTableau } = await import("@/components/formats/tableau-anime/NouvelleVideoTableau");
const { RelireScript } = await import("@/components/script/RelireScript");
const { ZoneTexte } = await import("@/components/ui/ZoneTexte");
const { repereTexte } = await import("@/domaine/relecture-tableau");
type Ecran = import("@/services/tableau-creation").EcranCreationTableau;

const TEXTE = ficheErreurCorrigee.scenes.map((s) => s.texteDit).join(" ");
const ecran: Ecran = {
  visible: true,
  series: [{ valeur: "formation", libelle: "Formation" }],
  structures: [{ valeur: "erreur-corrigee", libelle: "L'erreur corrigée" }],
  reseaux: [],
  fins: [],
  coutDecoupageCentimes: 89,
  ecriture: { series: [], reseaux: [], coutCentimes: 0 },
  recents: [],
  brouillon: {
    videoId: "v-fiche",
    donnees: { texte: TEXTE, serieCode: "formation", structure: "erreur-corrigee", douleur: "x", gesteMinute: "y", finId: null, reseaux: [] },
    generation: null,
    fiche: ficheErreurCorrigee,
    problemes: [],
    ficheACorriger: false,
    coutVoixCentimes: 120,
    voix: "neuve",
    versions: 1,
    tache: null,
    ecritureInterrompue: null,
    demandeConnue: null,
    repriseTrace: false,
    dejaVu: null,
    raisonFabriquer: null,
    raisonFabriquerCase: false,
  },
} as Ecran;

const bouton = (arbre: ReactNode, debut: string) => trouver(arbre, (e) => typeof e.props.onClick === "function" && texteDe(e).startsWith(debut))[0];
const grandChamp = (arbre: ReactNode) => trouver(arbre, (e) => e.type === ZoneTexte && e.props.libelle === "Le texte dit")[0];
const relecture = (arbre: ReactNode) => trouver(arbre, (e) => e.type === RelireScript && typeof e.props.libelleLancer === "string" && e.props.libelleLancer.startsWith("Découper en scènes"))[0];

beforeEach(() => {
  confirmerPrix.mockReset();
  actions.decouperScriptTableauAction.mockReset();
});

describe("« Découper à nouveau » : l'écran", () => {
  it("fiche existante, texte modifié dans le grand champ : aucun découpage, aucun prix, la relecture s'ouvre sur ce texte", async () => {
    // Prix accepté et serveur d'accord SI on le leur demandait : seul l'écran peut retenir ce texte non relu.
    confirmerPrix.mockResolvedValue(89);
    actions.decouperScriptTableauAction.mockResolvedValue({ ok: true, donnees: { statut: "lancee", videoId: "v-fiche" } });
    const e = monter(NouvelleVideoTableau as (p: { ecran: Ecran }) => ReactNode, { ecran });
    let arbre = e.rendre();
    expect(relecture(arbre)).toBeUndefined();
    const modifie = `${TEXTE} Une phrase ajoutée sans relecture.`;
    (grandChamp(arbre).props.onChange as (ev: unknown) => void)({ target: { value: modifie } });
    arbre = e.rendre();
    (bouton(arbre, "Découper à nouveau").props.onClick as () => void)();
    await attendre();
    arbre = e.rendre();

    expect(actions.decouperScriptTableauAction).not.toHaveBeenCalled();
    expect(confirmerPrix).not.toHaveBeenCalled();
    const ouverte = relecture(arbre);
    expect(ouverte).toBeDefined();
    expect((ouverte.props.lignes as { dit: string }[]).map((l) => l.dit).join(" ")).toBe(modifie);
    expect(bouton(arbre, "Découper à nouveau")).toBeUndefined();
    expect(grandChamp(arbre)).toBeUndefined();
  });

  it("texte inchangé : le prix est confirmé, puis le découpage part avec le repère du texte relu", async () => {
    confirmerPrix.mockResolvedValue(89);
    actions.decouperScriptTableauAction.mockResolvedValue({ ok: true, donnees: { statut: "lancee", videoId: "v-fiche" } });
    const e = monter(NouvelleVideoTableau as (p: { ecran: Ecran }) => ReactNode, { ecran });
    (bouton(e.rendre(), "Découper à nouveau").props.onClick as () => void)();
    await attendre();

    expect(confirmerPrix).toHaveBeenCalledWith(expect.objectContaining({ montant: 89 }));
    expect(actions.decouperScriptTableauAction).toHaveBeenCalledTimes(1);
    const [, videoId, accord, relu] = actions.decouperScriptTableauAction.mock.calls[0] as unknown[];
    expect([videoId, accord, relu]).toEqual(["v-fiche", 89, repereTexte(TEXTE)]);
  });
});
