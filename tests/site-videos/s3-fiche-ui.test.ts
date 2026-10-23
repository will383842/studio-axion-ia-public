/** S3.4 — bloc et feuille « Sur le site » de la fiche vidéo (rendu serveur, comme les autres tests d'écran). */
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";
import { entreeOk } from "./helpers-controles";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined, back: () => undefined }), usePathname: () => "/videos/v-01", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/(studio)/videos/[id]/actions-site", () => {
  const ok = async () => ({ ok: true, donnees: undefined });
  return { chargerFeuilleAction: ok, cocherSurLeSiteAction: ok, cocherAucunClientAction: ok, modifierPasseportAction: ok, publierSurLeSiteAction: ok, retirerDuSiteAction: ok, reecrirePasseportAction: ok };
});

const site = await import("@/services/site-videos");
const { BlocSurLeSite } = await import("@/components/videos/fiche/BlocSurLeSite");
const { CarteSurLeSite } = await import("@/components/videos/fiche/CarteSurLeSite");
const { ContenuFeuille } = await import("@/components/videos/fiche/FeuilleSurLeSite");
const { depots } = await import("@/donnees/memoire");
const { trouverFormat } = await import("@/formats");
const { controlerAvantSite } = await import("@/domaine/site-videos/controles");
const { passeportOk } = await import("./helpers-controles");

beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});
beforeEach(preparerBase);

/** Balise ouvrante du bouton qui porte ce texte (le plus proche, jamais celle d'un autre bouton). */
const boutonDe = (h: string, texte: string) => new RegExp(`<button(?:(?!<button)[^>])*>(?:(?!<button)[\\s\\S])*?${texte}`).exec(h)?.[0].match(/<button[^>]*>/)?.[0] ?? "";
const html = (e: ReactElement | null) => (e ? renderToStaticMarkup(e) : "");
const vueBase = { visible: true as const, videoId: "v-01", choisie: false, etat: null, enLigne: false, versionPasseport: 1, aMettreAJour: false, simulation: true, aucunClient: false };

describe("S3.4 bloc dans la fiche", () => {
  it("générateur éteint : aucun bloc (la fiche d'aujourd'hui ne change pas)", async () => {
    expect(await BlocSurLeSite({ videoId: "v-01" })).toBeNull();
  });

  it("générateur allumé : le bloc est là, la case « Sur le site » décochée", async () => {
    await site.definirSiteGenerateur("avocat", true);
    const h = html(await BlocSurLeSite({ videoId: "v-01" }));
    expect(h).toContain("Sur le site");
    expect(h).toContain('aria-checked="false"');
  });

  it("présent pour le cas concret malgré ecranVideo.publication « aucune » (il ne dépend que de l'interrupteur)", async () => {
    expect(trouverFormat("cas-concret")?.ecranVideo?.publication).toBe("aucune");
    await depots().videos.modifier("v-01", { formatId: "cas-concret" });
    expect(await BlocSurLeSite({ videoId: "v-01" })).toBeNull();
    await site.definirSiteGenerateur("cas-concret", true);
    expect(html(await BlocSurLeSite({ videoId: "v-01" }))).toContain("Sur le site");
  });
});

describe("S3.4 carte : les états", () => {
  it("cochée, pas encore en ligne : « Relire et publier »", () => {
    const h = html(createElement(CarteSurLeSite, { vue: { ...vueBase, choisie: true, etat: "hors-ligne" } }));
    expect(h).toContain("Relire et publier");
    expect(h).not.toContain("En ligne sur le site");
    expect(h).toContain('aria-checked="true"');
  });

  it("en ligne : « En ligne sur le site ↗ » avec son lien, « Retirer du site », la pastille Essai en simulation", () => {
    const h = html(createElement(CarteSurLeSite, { vue: { ...vueBase, choisie: true, etat: "en-ligne", enLigne: true, url: "https://site-factice.invalid/fr/videos/mon-sujet", versionEnLigne: 1 } }));
    expect(h).toContain("En ligne sur le site ↗");
    expect(h).toContain('href="https://site-factice.invalid/fr/videos/mon-sujet"');
    expect(h).toContain("Retirer du site");
    expect(h).toContain("Essai");
    expect(h).not.toContain("Mettre à jour");
  });

  it("en ligne mais retouchée depuis : « Mettre à jour »", () => {
    const h = html(createElement(CarteSurLeSite, { vue: { ...vueBase, choisie: true, etat: "en-ligne", enLigne: true, url: "https://x.invalid/fr/videos/a", versionEnLigne: 1, versionPasseport: 2, aMettreAJour: true } }));
    expect(h).toContain("Mettre à jour");
  });

  it("échec : la phrase d'erreur est lisible, rien d'autre ne casse", () => {
    const h = html(createElement(CarteSurLeSite, { vue: { ...vueBase, choisie: true, etat: "echec", derniereErreur: "Le site ne répond pas : réessayez dans quelques minutes." } }));
    expect(h).toContain("Le site ne répond pas");
    expect(h).toContain("Relire et publier");
  });

  it("textes courts, vouvoiement, aucun jargon", () => {
    const h = html(createElement(CarteSurLeSite, { vue: { ...vueBase, choisie: true, etat: "en-ligne", enLigne: true, url: "https://x.invalid/a", versionEnLigne: 1 } })).replace(/<[^>]+>/g, " ");
    expect(h).not.toMatch(/\b(API|JSON|HMAC|webhook|slug|passeport)\b/i);
    expect(h).not.toMatch(/\btu\b|\bton\b/i);
  });
});

describe("S3.4 feuille de relecture", () => {
  const rendre = (entree = entreeOk(), extra: { prix?: { centimes: number; devise: "EUR" } | null; aucunClient?: boolean } = {}) =>
    html(createElement(ContenuFeuille, { feuille: { videoId: "v-01", passeport: entree.passeport, controles: controlerAvantSite(entree), aucunClient: entree.caseAucunClient, prixClaude: extra.prix ?? null, simulation: true, enLigne: false } }));

  it("tout est en règle : « Publier sur le site » est actif, sans raison au-dessus", () => {
    const h = rendre();
    expect(h).toContain("Publier sur le site");
    expect(boutonDe(h, "Publier sur le site")).not.toContain('disabled=""');
    expect(h).not.toContain("data-raison");
  });

  it("un contrôle bloquant en échec : le bouton est désactivé et la raison est écrite au-dessus", () => {
    const entree = entreeOk({ passeport: passeportOk({ aRetenir: ["un", "deux"] }) });
    const h = rendre(entree);
    expect(h).toContain("Ajoutez 3 points");
    const iRaison = h.indexOf("Ajoutez 3 points");
    const iBouton = h.indexOf("Publier sur le site");
    expect(iRaison).toBeGreaterThan(-1);
    expect(iRaison).toBeLessThan(iBouton);
    expect(boutonDe(h, "Publier sur le site")).toContain('disabled=""');
    expect(h).toContain("data-raison");
  });

  it("les pastilles des contrôles : un avertissement ne bloque pas", () => {
    const h = rendre(entreeOk({ dureeSec: 25, passeport: passeportOk({ chapitres: [] }) }));
    expect(h).toContain("courte pour une page");
    expect(boutonDe(h, "Publier sur le site")).not.toContain('disabled=""');
  });

  it("la case « Aucun client nommé, aucun logo » est dans la feuille", () => {
    expect(rendre()).toContain("Aucun client nommé, aucun logo");
  });

  it("« Réécrire avec Claude (≈ x €) » seulement si le réglage est allumé (un prix est donné)", () => {
    expect(rendre()).not.toContain("Réécrire avec Claude");
    const h = rendre(entreeOk(), { prix: { centimes: 12, devise: "EUR" } });
    expect(h).toContain("Réécrire avec Claude (≈");
    expect(h).toContain("0,12");
  });

  it("montre les champs retouchables : titre, résumé, À retenir, questions, rubrique, chapitres, version", () => {
    const h = rendre();
    for (const t of ["Titre", "Résumé", "À retenir", "Questions", "Rubrique", "Chapitres", "Version"]) expect(h, t).toContain(t);
  });
});
