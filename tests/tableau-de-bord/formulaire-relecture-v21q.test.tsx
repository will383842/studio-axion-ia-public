/** G4-08-b3-b-v21q : le formulaire monte l'écran de relecture après « Préparer » (doubles, 0 €, aucun navigateur). */
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { attendre, monter, trouver } from "../aides/crochets-factices";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../aides/crochets-factices")).crochets }));
const actions = vi.hoisted(() => ({ creer: vi.fn(), ouvrir: vi.fn(), valider: vi.fn() }));
vi.mock("@/app/(studio)/tableau-de-bord/actions", () => ({ creerTableauDeBord: actions.creer, ouvrirRelectureTableauDeBord: actions.ouvrir, validerRelectureTableauDeBord: actions.valider }));

const { FormulaireTableauDeBord } = await import("@/components/formats/vitrines/FormulaireTableauDeBord");
const { EcranRelectureTableau, LIEN_AIDE_SAISIE } = await import("@/components/formats/tableau-de-bord/EcranRelectureTableau");
const aRelire = [{ cle: "indicateur:a", libelle: "Visites", valeur: 120, unite: "visites" }];

type Props = Record<string, (...a: unknown[]) => unknown> & { etat: { valide: boolean; ouverture: { etape: string } | null; erreurs: string[] } };
type El = ReactElement<Record<string, unknown>>;

async function preparer(reponse: unknown) {
  actions.creer.mockResolvedValue(reponse);
  const m = monter(FormulaireTableauDeBord as never, { personnages: [] } as never);
  const form = trouver(m.rendre() as never, (e) => e.type === "form")[0];
  await (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
  await attendre();
  return m.rendre() as never;
}
const ecranDe = (arbre: never): El | undefined => trouver(arbre, (e) => e.type === EcranRelectureTableau)[0];

function monterEcran(el: El) {
  (globalThis as Record<string, unknown>).createImageBitmap = async () => ({ width: 100, height: 50 });
  (globalThis as Record<string, unknown>).document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/png;base64,AAAA" }) };
  const m = monter(EcranRelectureTableau as never, el.props as never);
  return () => (m.rendre() as unknown as { props: Props }).props;
}
async function deposer(props: () => Props) {
  await props().onChoisir(new File(["x"], "c.png", { type: "image/png" }));
  await attendre();
}

describe("G4-08-b3-b · formulaire", () => {
  it("a) avant « Préparer » aucun écran ; après un brouillon réussi, l'écran de relecture est rendu à la place du formulaire", async () => {
    const avant = monter(FormulaireTableauDeBord as never, { personnages: [] } as never).rendre() as never;
    expect(ecranDe(avant)).toBeUndefined();
    const apres = await preparer({ ok: true, donnees: { videoId: "v-tdb" } });
    expect(ecranDe(apres)).toBeDefined();
    expect(trouver(apres, (e) => e.type === "form")).toEqual([]);
  });

  it("b) un dépôt appelle ouvrirRelectureTableauDeBord 1 fois avec (v-tdb, image) ; un double clic reste à 1 appel", async () => {
    actions.ouvrir.mockReset().mockResolvedValue({ ok: true, donnees: { etape: "relecture", brouillon: { id: "b" }, aRelire } });
    const props = monterEcran(ecranDe(await preparer({ ok: true, donnees: { videoId: "v-tdb" } }))!);
    await deposer(props);
    const envoi = props().onEnvoyer;
    await Promise.all([envoi(), envoi()]);
    await attendre();
    expect(actions.ouvrir).toHaveBeenCalledTimes(1);
    expect(actions.ouvrir).toHaveBeenCalledWith("v-tdb", { base64: "AAAA", type: "image/png", largeur: 100, hauteur: 50 });
  });

  it("c) relecture puis valider : validerRelectureTableauDeBord 1 fois avec (v-tdb, brouillon, décisions) ; ok → « validé »", async () => {
    const brouillon = { id: "b" };
    actions.ouvrir.mockReset().mockResolvedValue({ ok: true, donnees: { etape: "relecture", brouillon, aRelire } });
    actions.valider.mockReset().mockResolvedValue({ ok: true, donnees: { ok: true } });
    const props = monterEcran(ecranDe(await preparer({ ok: true, donnees: { videoId: "v-tdb" } }))!);
    await deposer(props);
    await props().onEnvoyer();
    await attendre();
    expect(props().etat.ouverture?.etape).toBe("relecture");
    props().onDecider("indicateur:a", { type: "valide" });
    await props().onValider();
    await attendre();
    expect(actions.valider).toHaveBeenCalledTimes(1);
    expect(actions.valider).toHaveBeenCalledWith("v-tdb", brouillon, { "indicateur:a": { type: "valide" } });
    expect(props().etat.valide).toBe(true);
  });

  it("c) validation refusée par l'action : message d'erreur, jamais « validé »", async () => {
    actions.ouvrir.mockReset().mockResolvedValue({ ok: true, donnees: { etape: "relecture", brouillon: { id: "b" }, aRelire } });
    actions.valider.mockReset().mockResolvedValue({ ok: false, message: "Cette page n'est pas encore ouverte.", code: "TDB_FERME" });
    const props = monterEcran(ecranDe(await preparer({ ok: true, donnees: { videoId: "v-tdb" } }))!);
    await deposer(props);
    await props().onEnvoyer();
    await attendre();
    props().onDecider("indicateur:a", { type: "valide" });
    await props().onValider();
    await attendre();
    expect(props().etat.valide).toBe(false);
    expect(props().etat.erreurs.length).toBe(1);
  });

  it("d) repli saisie-manuelle : le lien d'aide existe et valider n'est jamais appelé", async () => {
    actions.ouvrir.mockReset().mockResolvedValue({ ok: true, donnees: { etape: "saisie-manuelle", raison: "Saisis à la main." } });
    actions.valider.mockReset();
    const props = monterEcran(ecranDe(await preparer({ ok: true, donnees: { videoId: "v-tdb" } }))!);
    await deposer(props);
    await props().onEnvoyer();
    await attendre();
    expect(props().etat.ouverture?.etape).toBe("saisie-manuelle");
    expect(LIEN_AIDE_SAISIE).toBe("/aide-chat");
    expect(actions.valider).not.toHaveBeenCalled();
  });

  it("e) ouverture refusée : message d'erreur, aucune relecture, une seule lecture, aucune validation", async () => {
    actions.ouvrir.mockReset().mockResolvedValue({ ok: false, message: "Cette page n'est pas encore ouverte.", code: "TDB_FERME" });
    actions.valider.mockReset();
    const props = monterEcran(ecranDe(await preparer({ ok: true, donnees: { videoId: "v-tdb" } }))!);
    await deposer(props);
    await props().onEnvoyer();
    await attendre();
    expect(actions.ouvrir).toHaveBeenCalledTimes(1);
    expect(props().etat.ouverture).toBeNull();
    expect(props().etat.erreurs.length).toBe(1);
    expect(actions.valider).not.toHaveBeenCalled();
  });

  it("f) creerTableauDeBord refusé (TDB_FERME) : phrase affichée, aucun écran, aucun appel de relecture", async () => {
    actions.ouvrir.mockReset();
    const arbre = await preparer({ ok: false, message: "Cette page n'est pas encore ouverte.", code: "TDB_FERME" });
    expect(ecranDe(arbre)).toBeUndefined();
    expect(trouver(arbre, (e) => e.type === "p" && String(e.props.children) === "Cette page n'est pas encore ouverte.")).toHaveLength(1);
    expect(actions.ouvrir).not.toHaveBeenCalled();
  });
});
