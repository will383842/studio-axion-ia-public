/** Carte « YouTube Shorts » de Réglages : tout éteint, suggestions jamais appliquées, avertissement « public », textes sans jargon. */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));

const { CarteYoutubeShorts, TEXTES_YOUTUBE } = await import("@/components/reglages/CarteYoutubeShorts");
const { PROPOSITION_YOUTUBE } = await import("@/fournisseurs/publication/zernio-youtube");

type Vue = import("@/domaine/chaine-youtube").VueYoutube;
const VIDE: Vue = { actif: false, reglages: null, chaine: { etat: "inconnu" } };
const rendre = (vue: Vue) => renderToStaticMarkup(createElement(CarteYoutubeShorts, { vue }));
const texte = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("état par défaut : tout éteint", () => {
  const h = rendre(VIDE);
  it("aucune pastille choisie : rien n'est appliqué sans clic", () => {
    expect((h.match(/role="radio"[^>]*aria-checked="true"|aria-checked="true"[^>]*role="radio"/g) ?? []).length).toBe(0);
  });
  it("l'interrupteur d'envoi est éteint et grisé tant que rien n'est enregistré", () => {
    expect(h).toMatch(/role="switch"[^>]*aria-checked="false"/);
    expect(h).toMatch(/role="switch"[^>]*disabled/);
  });
  it("les suggestions sont affichées comme suggestions", () => {
    expect(texte(h)).toContain(TEXTES_YOUTUBE.suggestion);
    expect(texte(h)).toContain("Éducation");
  });
  it("le rappel des limites est visible", () => {
    expect(texte(h)).toContain("Seuls les Shorts verticaux de 3 minutes au plus, 10 par jour et par compte.");
  });
  it("pas d'avertissement « public » tant que public n'est pas choisi", () => {
    expect(texte(h)).not.toContain(TEXTES_YOUTUBE.avertissementPublic);
  });
  it("chaîne inconnue : invite à tester les comptes", () => {
    expect(texte(h)).toContain(TEXTES_YOUTUBE.chaineInconnue);
  });
});

describe("réglages enregistrés", () => {
  it("public : avertissement visible", () => {
    const h = rendre({ actif: false, reglages: { ...PROPOSITION_YOUTUBE }, chaine: { etat: "absent" } });
    expect(texte(h)).toContain(TEXTES_YOUTUBE.avertissementPublic);
    expect(h).toContain('role="alert"');
    expect(texte(h)).toContain(TEXTES_YOUTUBE.chaineAbsente);
  });
  it("privé : pas d'avertissement ; interrupteur actif possible ; allumé s'affiche allumé", () => {
    const h = rendre({ actif: true, reglages: { ...PROPOSITION_YOUTUBE, visibilite: "private" }, chaine: { etat: "relie", nom: "Ma chaîne" } });
    expect(texte(h)).not.toContain(TEXTES_YOUTUBE.avertissementPublic);
    expect(h).toMatch(/role="switch"[^>]*aria-checked="true"/);
    expect(texte(h)).toContain("Ma chaîne");
  });
  it("réglages enregistrés : exactement une pastille choisie par groupe de choix", () => {
    const h = rendre({ actif: false, reglages: { ...PROPOSITION_YOUTUBE, visibilite: "unlisted" }, chaine: { etat: "inconnu" } });
    expect((h.match(/aria-checked="true"/g) ?? []).length).toBe(4); // visibilité, IA, enfants, titre
  });
});

describe("suggestion de visibilité, ligne d'état, détail de l'interrupteur", () => {
  it("la suggestion de visibilité invite à choisir « Privé » pour le premier essai, jamais Public", () => {
    const t = texte(rendre(VIDE));
    expect(t).toContain("Suggestion : Pour un premier essai, choisissez « Privé ».");
    expect(t).not.toContain("Suggestion : Public");
  });
  it("formulaire identique aux réglages enregistrés : pas de ligne « pas encore enregistrés »", () => {
    const h = rendre({ actif: true, reglages: { ...PROPOSITION_YOUTUBE, visibilite: "private" }, chaine: { etat: "inconnu" } });
    expect(texte(h)).not.toContain("pas encore enregistrés");
  });
  it("le détail de l'interrupteur dit la visibilité enregistrée", () => {
    const h = rendre({ actif: true, reglages: { ...PROPOSITION_YOUTUBE, visibilite: "private" }, chaine: { etat: "inconnu" } });
    expect(texte(h)).toContain("Allumé : les Shorts partent en Privé");
  });
});

describe("textes et conventions", () => {
  const source = readFileSync("src/components/reglages/CarteYoutubeShorts.tsx", "utf8");
  it("aucun jargon ni identifiant brut affiché", () => {
    const h = texte(rendre(VIDE));
    for (const mot of ["containsSyntheticMedia", "madeForKids", "categoryId", "unlisted", "private", "OAuth", "API", "Zernio"]) expect(h).not.toContain(mot);
  });
  it("dépôt public : vocabulaire interdit absent", () => {
    expect(source.toLowerCase()).not.toMatch(new RegExp("abon" + "n"));
  });
  it("aucun appel réseau dans la carte", () => {
    expect(source).not.toMatch(/\bfetch\(|zernio-client|clientZernio/);
  });
});

describe("page Réglages et routage inchangés", () => {
  it("la carte est branchée dans la page, repliée, rubrique Publication", () => {
    const page = readFileSync("src/app/(studio)/reglages/page.tsx", "utf8");
    expect(page).toContain("CarteYoutubeShorts");
    expect(page).toMatch(/id="youtube-shorts"/);
    expect(page).not.toMatch(/id="youtube-shorts"[^>]*\bouverte\b/);
  });
  it("RESEAUX_CONNUS de la liste des comptes ne contient pas YouTube (routage inchangé)", () => {
    const src = readFileSync("src/app/(studio)/reglages/actions-zernio.ts", "utf8");
    expect(src).toMatch(/RESEAUX_CONNUS: readonly IdReseau\[\] = \["instagram", "facebook", "linkedin", "tiktok"\];/);
  });
});
