/** CAL-28 · Panneau « Mes textes » : glisser un texte sur un jour, ou cliquer dessus. Données fictives, aucun appel réel, rien n'est enregistré ici. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PanneauMesTextes, TYPE_GLISSER_TEXTE, debutGlisser, demandeDepuisClic, demandeDepuisDepot, demandeDepuisTransfert, textesAPlacer } from "@/components/calendrier/PanneauMesTextes";
import type { MessageStock } from "@/domaine/stock-messages";

const AUJ = "2026-11-11";
const t = (id: string, o: Partial<MessageStock> = {}): MessageStock => ({ id, texte: `Texte ${id}`, reseaux: ["linkedin"], creeLe: "2026-11-01T08:00:00Z", ...o });
const a = t("a");

describe("CAL-28 · glisser sur un jour", () => {
  it("le dépôt demande l'ajout avec ce texte, cette date et le réseau de la case", () => {
    expect(demandeDepuisDepot(a, { jour: "2026-11-14", reseau: "instagram" }, AUJ)).toEqual({ ok: true, demande: { texteId: "a", texte: "Texte a", jour: "2026-11-14", reseau: "instagram" } });
  });
  it("un jour passé est refusé", () => expect(demandeDepuisDepot(a, { jour: "2026-11-10", reseau: "linkedin" }, AUJ).ok).toBe(false));
  it("début du glisser : seul l'identifiant du texte est transporté, en copie", () => {
    const poser = vi.fn();
    const transfert = { setData: poser, effectAllowed: "" };
    debutGlisser(a, transfert);
    expect(poser).toHaveBeenCalledWith(TYPE_GLISSER_TEXTE, "a");
    expect(transfert.effectAllowed).toBe("copy");
  });
  it("glisser puis déposer : on retrouve texte, jour et réseau de la case", () => {
    let transporte = "";
    debutGlisser(a, { setData: (_t, v) => { transporte = v; }, effectAllowed: "" });
    expect(demandeDepuisTransfert(transporte, [a, t("b")], { jour: "2026-11-14", reseau: "tiktok" }, AUJ)).toEqual({ ok: true, demande: { texteId: "a", texte: "Texte a", jour: "2026-11-14", reseau: "tiktok" } });
  });
  it("identifiant inconnu, vide ou déjà sorti de « Mes textes » : refusé", () => {
    const cible = { jour: "2026-11-14", reseau: "linkedin" as const };
    expect(demandeDepuisTransfert("zzz", [a], cible, AUJ).ok).toBe(false);
    expect(demandeDepuisTransfert("", [a], cible, AUJ).ok).toBe(false);
    expect(demandeDepuisTransfert("p", [t("p", { etat: "planifie" })], cible, AUJ).ok).toBe(false);
  });
  it("dépôt sur un jour passé : refusé, rien n'est demandé", () => expect(demandeDepuisTransfert("a", [a], { jour: "2026-11-01", reseau: "linkedin" }, AUJ).ok).toBe(false));
});

describe("CAL-28 · clic sur un texte", () => {
  it("ouvre l'ajout daté d'aujourd'hui avec ce texte et son réseau", () => {
    expect(demandeDepuisClic(a, AUJ)).toEqual({ texteId: "a", texte: "Texte a", jour: AUJ, reseau: "linkedin" });
  });
  it("sans réseau connu, le réseau reste à choisir", () => expect(demandeDepuisClic(t("b", { reseaux: undefined }), AUJ).reseau).toBeUndefined());
});

describe("CAL-28 · le texte reste tant que la publication n'est pas validée", () => {
  it("un texte en stock reste listé ; planifié, publié ou archivé en sort", () => {
    const liste = textesAPlacer([a, t("p", { etat: "planifie" }), t("q", { etat: "publie" }), t("r", { archiveLe: "2026-11-05T00:00:00Z" }), t("s", { etat: "en-stock" })]);
    expect(liste.map((m) => m.id)).toEqual(["a", "s"]);
  });
  it("cliquer ne retire rien de la liste", () => {
    const entrees = [a];
    demandeDepuisClic(a, AUJ);
    expect(textesAPlacer(entrees)).toHaveLength(1);
  });
});

describe("CAL-28 · le panneau", () => {
  const html = renderToStaticMarkup(<PanneauMesTextes textes={[a, t("p", { etat: "planifie" })]} aujourdhui={AUJ} onAjouter={() => {}} />);
  it("porte le libellé « Mes textes » et chaque texte à placer", () => {
    expect(html).toContain('aria-label="Mes textes"');
    expect(html).toContain("Texte a");
    expect(html).not.toContain("Texte p");
  });
  it("chaque texte est glissable ET cliquable (le clic remplace le glisser sur téléphone)", () => {
    expect(html).toMatch(/<button[^>]*draggable="true"/);
  });
  it("rien d'affiché quand il n'y a aucun texte à placer", () => {
    expect(renderToStaticMarkup(<PanneauMesTextes textes={[]} aujourdhui={AUJ} onAjouter={() => {}} />)).toBe("");
  });
});
