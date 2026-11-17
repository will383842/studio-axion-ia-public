/**
 * L5-02e : l'avertissement d'un décalage dont le brouillon est déjà chez le diffuseur s'affiche tout de suite.
 * Sans DOM (crochets factices) ; `decalerEntree` est une doublure : aucun appel réel, données fictives.
 */
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../aides/crochets-factices")).crochets }));
vi.mock("@/app/(studio)/calendrier/actions/decaler", () => ({ decalerEntree: vi.fn() }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
vi.mock("@/services/publications", () => ({ listerCalendrier: async () => [], listerAProgrammer: async () => [] }));

const { attendre, monter, trouver, texteDe } = await import("../aides/crochets-factices");
const { decalerEntree } = await import("@/app/(studio)/calendrier/actions/decaler");
const { DecalerEntree } = await import("@/components/calendrier/DecalerEntree");
const { ApercuPublication, SemaineAvecApercu } = await import("@/components/calendrier/ApercuPublication");
const { GrilleSemaine } = await import("@/components/calendrier/GrilleSemaine");
type Entree = import("@/components/calendrier/apercu-reseau").EntreeApercu;
type Decaler = NonNullable<import("@/components/calendrier/ApercuPublication").ProprietesSemaineAvecApercu["decaler"]>;

const AVERT = "Son brouillon est déjà chez le diffuseur : l'ancien brouillon ne sera pas programmé et la publication ne partira pas seule.";
const CRENEAU = { id: "c1", jourVise: "2026-11-14", heuresParReseau: {}, compteCible: "compte-fictif-1", statut: "valide", decalages: 1 } as never;
const mock = decalerEntree as unknown as ReturnType<typeof vi.fn>;

const entree = (): Entree => ({
  cle: "creneau:c1|linkedin", jour: "2026-11-12", reseau: "linkedin", type: "video", etat: "a_valider", heure: "09:00",
  titre: "Titre fictif", texte: "Texte fictif", premierCommentaire: "", media: { genre: "video", url: "https://exemple.fr/v.mp4" },
});

describe("DecalerEntree : l'avertissement sous « Décalée au … »", () => {
  async function envoyer(reponse: unknown) {
    mock.mockResolvedValueOnce(reponse);
    const m = monter(DecalerEntree as (p: unknown) => ReactNode, { id: "c1", jourActuel: "2026-11-12" });
    const formulaire = trouver(m.rendre(), (e) => e.type === "form")[0];
    (formulaire.props.onSubmit as (e: unknown) => void)({ preventDefault: () => undefined });
    await attendre();
    const statuts = trouver(m.rendre(), (e) => e.props.role === "status").map((e) => texteDe(e));
    const alertes = trouver(m.rendre(), (e) => e.props.role === "alert").map((e) => texteDe(e));
    return { statuts, alertes };
  }
  it("avec avertissement : « Décalée au … » puis l'avertissement mot pour mot, chacun dans un role=status", async () => {
    const { statuts, alertes } = await envoyer({ ok: true, donnees: CRENEAU, avertissement: AVERT });
    expect(statuts).toEqual(["Décalée au 2026-11-14.", AVERT]);
    expect(alertes).toEqual([]);
  });
  it("sans avertissement : un seul status, comme avant", async () => {
    const { statuts, alertes } = await envoyer({ ok: true, donnees: CRENEAU });
    expect(statuts).toEqual(["Décalée au 2026-11-14."]);
    expect(alertes).toEqual([]);
  });
  it("refus : message tel quel (role=alert), aucun status", async () => {
    const { statuts, alertes } = await envoyer({ ok: false, message: "Refus fictif." });
    expect(alertes).toEqual(["Refus fictif."]);
    expect(statuts).toEqual([]);
  });
});

describe("Glisser-déposer (ApercuPublication) : le retour affiché", () => {
  function ecran(decaler: Decaler) {
    const m = monter(SemaineAvecApercu as (p: unknown) => ReactNode, { entrees: [entree()], semaineDu: "2026-11-09", aujourdhui: "2026-11-11", decaler });
    const grille = () => trouver(m.rendre(), (e) => e.type === GrilleSemaine)[0];
    const panneau = () => trouver(m.rendre(), (e) => e.type === ApercuPublication)[0];
    (grille().props.onOuvrirEntree as (e: Entree) => void)(entree());
    return { grille, panneau, changer: (j: string) => (panneau().props.onChangerDate as (j: string) => void)(j) };
  }
  const jourDe = (e: ReturnType<typeof ecran>) => (e.grille().props.entrees as Entree[])[0].jour;
  beforeEach(() => vi.clearAllMocks());

  it("avertissement, même semaine : le retour est l'avertissement, ton info, la carte reste au nouveau jour", async () => {
    const e = ecran(vi.fn(async () => ({ ok: true as const, donnees: CRENEAU, avertissement: AVERT })));
    e.changer("2026-11-13");
    await attendre();
    expect(e.panneau().props.message).toBe(AVERT);
    expect(e.panneau().props.tonMessage).toBe("info");
    expect(jourDe(e)).toBe("2026-11-13");
  });
  it("avertissement, autre semaine : la phrase « autre semaine » d'abord, puis l'avertissement, dans le même retour", async () => {
    const e = ecran(vi.fn(async () => ({ ok: true as const, donnees: CRENEAU, avertissement: AVERT })));
    e.changer("2026-11-20");
    await attendre();
    const msg = String(e.panneau().props.message);
    expect(msg).toMatch(/dans une autre semaine/);
    expect(msg.endsWith(AVERT)).toBe(true);
    expect(msg.indexOf("autre semaine")).toBeLessThan(msg.indexOf(AVERT));
    expect(e.panneau().props.tonMessage).toBe("info");
    expect(jourDe(e)).toBe("2026-11-20");
  });
  it("sans avertissement : inchangé (même semaine : aucun retour ; autre semaine : la phrase seule)", async () => {
    const e = ecran(vi.fn(async () => ({ ok: true as const, donnees: CRENEAU })));
    e.changer("2026-11-13");
    await attendre();
    expect(e.panneau().props.message).toBeNull();
    e.changer("2026-11-20");
    await attendre();
    expect(String(e.panneau().props.message)).toMatch(/^Déplacée au .*, dans une autre semaine : elle n'est plus dans cette grille\.$/);
  });
  it("refus : message tel quel (ton alerte) et la carte revient à sa place", async () => {
    const e = ecran(vi.fn(async () => ({ ok: false as const, message: "Refus fictif." })));
    e.changer("2026-11-13");
    await attendre();
    expect(e.panneau().props.message).toBe("Refus fictif.");
    expect(e.panneau().props.tonMessage).toBe("alerte");
    expect(jourDe(e)).toBe("2026-11-12");
  });
});
