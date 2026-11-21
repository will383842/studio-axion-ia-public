/**
 * RES-6 · réglages de la réserve (/reglages/tutoriel-outil). Dépôts en mémoire, aucun appel réel, aucun appel payant, 0 €.
 * Rendu serveur seulement (`renderToStaticMarkup`) : les clics ne sont pas rejoués ici.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, Redirection } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
const revalider = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: revalider }));
const session = vi.hoisted(() => ({ ouverte: true }));
vi.mock("@/services/auth", () => ({
  exigerSession: vi.fn(async () => {
    if (!session.ouverte) throw new (await import("../../helpers/next-mocks")).Redirection("/connexion");
    return {};
  }),
}));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { enregistrerReglagesReserveAction: action } = await import("@/app/(studio)/reglages/tutoriel-outil/actions-reserve");
const { ReglagesReserve, TEXTES_RESERVE } = await import("@/app/(studio)/reglages/tutoriel-outil/ReglagesReserve");
const { lireReglagesReserve } = await import("@/services/tutoriel-reserve");
const { PARAM_RESERVE_REGLAGES, REGLAGES_RESERVE_DEFAUT } = await import("@/domaine/tutoriel-reserve");

const envoi = (champ: string, valeur: unknown) => {
  const d = new FormData();
  d.set("champ", champ);
  d.set("valeur", String(valeur));
  return d;
};
const instantane = async () => JSON.stringify([await depots().parametres.lister()]);
const visible = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const rendre = (reglages = REGLAGES_RESERVE_DEFAUT, formulaireOuvert = true) =>
  renderToStaticMarkup(createElement(ReglagesReserve, { reglages, formulaireOuvert, enregistrer: async () => ({ ok: true as const }) }));

beforeEach(() => {
  reinitialiserDepots();
  session.ouverte = true;
  revalider.mockClear();
});

describe("session", () => {
  it("sans session : redirection, rien n'est écrit", async () => {
    session.ouverte = false;
    const avant = await instantane();
    await expect(action(envoi("actif", "oui"))).rejects.toBeInstanceOf(Redirection);
    expect(await instantane()).toBe(avant);
    expect((await lireReglagesReserve()).actif).toBe(false);
  });
});

describe("saisies refusées sans écriture", () => {
  it.each([
    ["parSemaine", "8"],
    ["parSemaine", "-1"],
    ["parSemaine", "1.5"],
    ["parSemaine", "abc"],
    ["parSemaine", ""],
    ["plafondVideo", "0"],
    ["plafondVideo", "0,00"],
    ["plafondVideo", "10,01"],
    ["plafondVideo", "11"],
    ["plafondVideo", "-1"],
    ["plafondVideo", "1e2"],
    ["plafondVideo", "1,255"],
    ["plafondVideo", "abc"],
    ["actif", "peut-etre"],
    ["voix", "1"],
    ["inconnu", "oui"],
    ["plafondClaudeUsd", "5"],
  ])("%s = %j", async (champ, valeur) => {
    const avant = await instantane();
    const r = await action(envoi(champ, valeur));
    expect(r.ok).toBe(false);
    expect(await instantane()).toBe(avant);
  });

  it("champ absent : refus", async () => {
    expect((await action(new FormData())).ok).toBe(false);
  });
});

describe("« true » en chaîne n'allume pas", () => {
  it("actif et voix refusent \"true\", \"1\", \"on\"", async () => {
    for (const champ of ["actif", "voix"]) for (const v of ["true", "1", "on", "OUI"]) expect((await action(envoi(champ, v))).ok).toBe(false);
    const r = await lireReglagesReserve();
    expect(r.actif).toBe(false);
    expect(r.voix).toBe(false);
  });

  it("un réglage stocké avec \"true\" en chaîne se lit éteint", async () => {
    await ecrireParametre(PARAM_RESERVE_REGLAGES, { ...REGLAGES_RESERVE_DEFAUT, actif: "true" });
    expect((await lireReglagesReserve()).actif).toBe(false);
  });
});

describe("saisies valides", () => {
  it("allume, éteint, règle le rythme, la voix et la limite en centimes", async () => {
    expect(await action(envoi("actif", "oui"))).toEqual({ ok: true });
    expect((await lireReglagesReserve()).actif).toBe(true);
    expect(await action(envoi("actif", "non"))).toEqual({ ok: true });
    expect((await lireReglagesReserve()).actif).toBe(false);
    await action(envoi("parSemaine", "0"));
    expect((await lireReglagesReserve()).parSemaine).toBe(0);
    await action(envoi("parSemaine", "7"));
    expect((await lireReglagesReserve()).parSemaine).toBe(7);
    await action(envoi("voix", "oui"));
    expect((await lireReglagesReserve()).voix).toBe(true);
    for (const [saisie, centimes] of [["1,25", 125], ["1.25", 125], ["0,01", 1], ["10,00", 1000], ["10", 1000], ["2,5", 250], [" 3 ", 300]] as const) {
      expect(await action(envoi("plafondVideo", saisie))).toEqual({ ok: true });
      expect((await lireReglagesReserve()).plafondVideoCentimes).toBe(centimes);
    }
    expect(revalider).toHaveBeenCalledWith("/reglages/tutoriel-outil");
  });

  it("un envoi ne change qu'un champ, même si le formulaire en porte d'autres", async () => {
    const d = envoi("parSemaine", "3");
    d.set("actif", "oui");
    d.set("voix", "oui");
    d.set("plafondVideo", "9,00");
    expect(await action(d)).toEqual({ ok: true });
    expect(await lireReglagesReserve()).toEqual({ ...REGLAGES_RESERVE_DEFAUT, parSemaine: 3 });
  });
});

describe("argent : la limite ne touche que la réserve", () => {
  it("n'écrit ni tutoriel.plafondClaudeUsd ni le plafond de l'usine", async () => {
    const cle = (p: unknown) => (p as { id?: string; cle?: string }).id ?? (p as { cle?: string }).cle;
    const avant = (await depots().parametres.lister()).map(cle);
    await action(envoi("plafondVideo", "9,99"));
    await action(envoi("actif", "oui"));
    const apres = (await depots().parametres.lister()).map(cle);
    expect(apres.filter((c) => !avant.includes(c))).toEqual([PARAM_RESERVE_REGLAGES]);
    expect(apres.filter((c) => avant.includes(c))).toEqual(avant);
    expect(await lireParametre("tutoriel.plafondClaudeUsd", "absent")).toBe("absent");
    expect(await lireParametre("usine.autonomie", "absent")).toBe("absent");
  });
});

describe("écran", () => {
  it("défaut : tout éteint, limite 1,25, aides et lien de la réserve", () => {
    const t = visible(rendre());
    expect(t).toContain(TEXTES_RESERVE.prendreSeul);
    expect(t).toMatch(/Prendre seul dans la réserve Éteint/);
    expect(t).toMatch(/Avec voix Éteint/);
    expect(t).toContain("0 : seulement quand l'usine le demande");
    expect(t).toContain("Éteint : vidéos sans voix, aucune dépense de voix. Allumé : le devis avant dépense doit être allumé.");
    expect(t).not.toContain("Allumé Éteindre");
    const html = rendre();
    expect(html).toContain('value="1,25"');
    expect(html).toContain('value="1"');
    expect(html).toContain('href="/tutoriel-outil/reserve"');
    expect(visible(html)).not.toContain(TEXTES_RESERVE.avertissementFerme);
  });

  it("allumé avec le tutoriel fermé : l'avertissement s'affiche ; tutoriel ouvert : non", () => {
    const allume = { ...REGLAGES_RESERVE_DEFAUT, actif: true };
    expect(visible(rendre(allume, false))).toContain("Le tutoriel est fermé : rien ne sera pris tant qu'il l'est.");
    expect(visible(rendre(allume, true))).not.toContain("Le tutoriel est fermé");
    expect(visible(rendre(REGLAGES_RESERVE_DEFAUT, false))).not.toContain("Le tutoriel est fermé");
  });
});

describe("envois simultanés et lecture illisible", () => {
  it("trois envois simultanés (actif, voix, rythme) sont tous gardés", async () => {
    const res = await Promise.all([action(envoi("actif", "oui")), action(envoi("voix", "oui")), action(envoi("parSemaine", 5))]);
    expect(res).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(await lireReglagesReserve()).toMatchObject({ actif: true, voix: true, parSemaine: 5 });
  });

  it("lecture qui lève : envoi refusé, rien n'est écrit, la limite stockée reste inchangée", async () => {
    await action(envoi("plafondVideo", "3,50"));
    const avant = await instantane();
    const parametres = depots().parametres;
    const spy = vi.spyOn(parametres, "obtenir").mockRejectedValue(new Error("base indisponible"));
    const r = await action(envoi("voix", "oui"));
    spy.mockRestore();
    expect(r).toEqual({ ok: false, raison: "Réglages illisibles, réessayez." });
    expect(await instantane()).toBe(avant);
    expect((await lireReglagesReserve()).plafondVideoCentimes).toBe(350);
  });
});
