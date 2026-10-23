/**
 * E2E-1 générateur, points mineurs restés ouverts (03/10) :
 *  - n° 10 : « Avant de publier » ne rappelle plus l'étiquette IA quand la mention est coupée ;
 *  - n° 23 : la feuille Buffer d'une version ne propose qu'un réseau, le sien ;
 *  - n° 24 : ESSAI sur les montants de « Fabriquer les N » quand le double est simulé ;
 *  - n° 28 : « Mes thèmes » ne propose que les activités réelles d'Axion-IA (plus les 5 anciens en doublon) ;
 *  - n° 29 : une publication notée à la main à une date passée se mesure tout de suite (J+3, J+7) ;
 *  - n° 30 : les données de démonstration restent dans le domaine d'Axion-IA (plus de sujets de droit du travail).
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined, refresh: () => undefined }),
  usePathname: () => "/ecrire/sujets/s1",
  useSearchParams: () => new URLSearchParams(),
  redirect: () => undefined,
  notFound: () => undefined,
}));
vi.mock("@/app/(studio)/ecrire/sujets/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: null })) }));

const { CarteFabriquerLesN } = await import("@/components/generateur/FabricationReseaux");
const { reinitialiserDepots } = await import("@/donnees/memoire");
const { creerDonneesDemo } = await import("@/donnees/memoire/demo");
const { rattacherAuDomaine, PILIERS_ACTIVITES_AXION, lectureDuSens } = await import("@/donnees/generateur/domaine-axion");
const auth = await import("@/services/auth");
const ctx = await import("@/services/contexte-axion");

const lire = (chemin: string) => readFileSync(chemin, "utf8");

describe("E2E-1 n° 10 et 23 · écrans de publication", () => {
  it("n° 10 : aucun rappel de l'étiquette IA dans « Avant de publier »", () => {
    expect(lire("src/components/publication/AvantDePublier.tsx")).not.toMatch(/Pensez à l&apos;étiquette|étiquette IA de chaque réseau/);
  });

  it("n° 23 : la feuille Buffer d'une version ne propose jamais un autre réseau", () => {
    const f = lire("src/components/publication/FeuilleEnvoyerBuffer.tsx");
    expect(f).not.toMatch(/Publier aussi sur un autre réseau/);
    expect(f).toMatch(/const autreReseau = false;/);
    // Pas de mode sombre forcé sur le choix de la date (ordre de Will).
    expect(f).not.toMatch(/color-scheme:dark/);
  });
});

describe("E2E-1 n° 24 · ESSAI sur les prix de « Fabriquer les N »", () => {
  const plan = {
    mere: { code: "0002-AV-FB", reseau: "facebook" as const, dureeSec: 50 },
    versions: [
      { varianteId: "v1", code: "0002-AV-FB", reseau: "facebook" as const, role: "mere" as const, prix: "1,12 €", dejaVideo: false },
      { varianteId: "v2", code: "0002-AV-TT", reseau: "tiktok" as const, role: "variante" as const, prix: "1,10 €", dejaVideo: false },
    ],
    total: "2,22 €",
    totalCentimes: 222,
    sansDeclinaison: "2,24 €",
    surMere: false,
  };
  it("double simulé : pastille Essai sur le bouton chiffré ; double réel : pas de pastille", () => {
    expect(renderToStaticMarkup(createElement(CarteFabriquerLesN, { sujetId: "s1", plan: { ...plan, essai: true } }))).toMatch(/Essai/);
    expect(renderToStaticMarkup(createElement(CarteFabriquerLesN, { sujetId: "s1", plan: { ...plan, essai: false } }))).not.toMatch(/Essai/);
  });
  it("la fiche vidéo marque ESSAI le coût d'une fabrication simulée", () => {
    const page = lire("src/app/(studio)/videos/[id]/page.tsx");
    // E2E-2 argent n° 6 et 7 : la règle vit dans `domaine/cout-video.ts` (payé sans ESSAI, part simulée avec ESSAI ;
    // estimation marquée ESSAI si la fabrication est simulée), testée dans e2e2-console-mineurs.
    expect(page).toMatch(/chiffresCoutVideo\(\{ \.\.\.couts, coutEstime: v\.coutEstime, fabricationSimulee, estDemo: v\.estDemo \}\)/);
    expect(lire("src/domaine/cout-video.ts")).toMatch(/essai: p\.fabricationSimulee && !p\.estDemo/);
    expect(page).toMatch(/c\.essai && <PastilleEssai/);
  });
});

describe("E2E-1 n° 28 · thèmes proposés", () => {
  beforeAll(async () => {
    await preparerMotDePasse("e2e1-restes-mineurs");
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter("e2e1-restes-mineurs", false);
  });

  it("seules les 12 activités réelles sont proposées ; plus « L'IA au quotidien » ni « Former les équipes »", async () => {
    const c = await ctx.lireContexte();
    const ids = (c.piliersProposes ?? []).map((p) => p.id).sort();
    expect(ids).toEqual(PILIERS_ACTIVITES_AXION.map((p) => p.id).sort());
    expect((c.piliersProposes ?? []).map((p) => p.nom)).not.toContain("L'IA au quotidien");
    expect((c.piliersProposes ?? []).map((p) => p.nom)).not.toContain("Former les équipes");
    // Rien n'est effacé dans la donnée : un thème ancien déjà validé par Will reste le sien.
    const v = await ctx.validerPilier("automatisation");
    expect(v.piliers.map((p) => p.id)).toContain("automatisation");
    expect((await ctx.lireContexte()).piliers.map((p) => p.id)).toContain("automatisation");
  });

  // n° 29, côté service : une publication notée à la main à une date passée attend sa mesure (couvert par g7a-mesures).
  it("n° 29 : l'écran dit comment mesurer une vidéo publiée à la main", () => {
    expect(lire("src/components/generateur/SaisieMesures.tsx")).toMatch(/« Choisir » le jour de publication/);
    expect(lire("src/components/publication/FeuilleEnvoyerBuffer.tsx")).toMatch(/Date passée : touchez « Je l&apos;ai publiée moi-même »/);
  });
});

describe("E2E-1 n° 30 · données de démonstration dans le domaine", () => {
  const demo = creerDonneesDemo(Date.parse("2026-10-03T08:00:00Z"));
  const JURIDIQUE = /licenci|rupture conventionnelle|g[ée]olocalis|prime de partage|heures sup|arr[êe]t maladie|non-concurrence|patron|cour de cassation|droit du travail/i;

  it("aucun sujet de droit du travail dans les idées, les vidéos, les scripts ni les séries", () => {
    const textes = [...demo.idees.map((i) => i.texte), ...demo.videos.map((v) => v.titre), ...demo.scripts.map((s) => `${s.sujet} ${s.blocs.flatMap((b) => b.segments.map((g) => g.texte)).join(" ")}`), ...demo.series.map((s) => `${s.nom} ${s.description ?? ""}`)];
    for (const t of textes) expect(t, t).not.toMatch(JURIDIQUE);
  });

  it("les idées « avocat » de la démonstration passent le contrôle du domaine d'Axion-IA", () => {
    for (const i of demo.idees.filter((x) => x.formatSuggere === "avocat")) {
      expect(rattacherAuDomaine(i.texte, { valides: [] }).ok, `${i.texte} ${JSON.stringify(lectureDuSens(i.texte))}`).toBe(true);
    }
  });
});
