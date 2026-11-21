/**
 * RAP · une publication reprise du diffuseur s'ouvre au clic dans les trois vues (jour, semaine, mois), en lecture seule.
 * Sans DOM : crochets factices, rendu serveur. Données fictives.
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../aides/crochets-factices")).crochets }));
vi.mock("@/app/(studio)/calendrier/actions/decaler", () => ({ decalerEntree: vi.fn(async () => ({ ok: false, message: "doublure" })) }));
vi.mock("@/app/(studio)/calendrier/actions/retirer-rapatriee", () => ({ retirerRapatrieeAction: vi.fn() }));

const { monter, trouver } = await import("../aides/crochets-factices");
const { entreeDepuisPublication, adresseDiffuseurSure } = await import("@/components/calendrier/apercu-reseau");
const { CarteEntreeCalendrier } = await import("@/components/calendrier/CarteEntreeCalendrier");
const { ApercuPublication, SemaineAvecApercu } = await import("@/components/calendrier/ApercuPublication");
const { VueJourAvecFiche, RapatrieesDuMois } = await import("@/components/calendrier/FicheRapatriees");
const { VueJour } = await import("@/components/calendrier/VueJour");
const { GrilleSemaine } = await import("@/components/calendrier/GrilleSemaine");
type Entree = import("@/components/calendrier/apercu-reseau").EntreeApercu;

const TEXTE = `${"Un long texte fictif. ".repeat(12)}FIN-DU-TEXTE`;
const rapatriee = entreeDepuisPublication({
  id: "zr_p1_c1", reseau: "instagram", statut: "programmee", via: "zernio", date: "2026-11-25T08:30:00.000Z", texte: TEXTE, canalNom: "Page",
  rapatrieeLe: "2026-11-20T10:00:00.000Z", mediaDiffuseur: { type: "image", nombre: 1, miniature: "https://medias.exemple.test/a.jpg" },
} as Parameters<typeof entreeDepuisPublication>[0]);
const AUJOURDHUI = "2026-11-20";
const html = (el: ReactElement) => renderToStaticMarkup(el).replace(/&#x27;/g, "'");
const cartes = (arbre: ReturnType<typeof trouver>) => arbre.filter((e) => e.type === CarteEntreeCalendrier);

function verifierFiche(entree: Entree) {
  const m = html(<ApercuPublication entree={entree} aujourdhui={AUJOURDHUI} onPrecedente={() => 0} onSuivante={() => 0} onFermer={() => 0} onChangerDate={() => 0} />);
  expect(m).toContain("FIN-DU-TEXTE");
  expect(m).toContain("Cette publication vient du diffuseur : elle se modifie et se déplace chez lui.");
  expect(m).toContain("/api/calendrier/miniature/zr_p1_c1");
  expect(m).not.toContain("medias.exemple.test");
  expect(m).toContain("Compte : Page");
  expect(m).toContain("Programmée chez le diffuseur");
  expect(m).not.toContain('type="date"');
  expect(m).not.toContain("Déplacer");
  expect(m).not.toMatch(/Prêt à partir/);
  expect(m).not.toContain("Ouvrir chez le diffuseur"); // aucune adresse sûre connue
  expect(m).toContain("Retirer du calendrier");
}

describe("RAP · carte rapatriée cliquable", () => {
  it("vue jour : la carte est un bouton, son clic ouvre la fiche", () => {
    const m = monter(VueJourAvecFiche, { jour: "2026-11-25", aujourdhui: AUJOURDHUI, entrees: [rapatriee], liens: {} });
    const racine = m.rendre();
    const vue = trouver(racine, (e) => e.type === VueJour)[0];
    expect(vue.props.onOuvrirRapatriee).toBeTypeOf("function");
    const rendu = VueJour(vue.props as never) as ReactElement;
    const carte = cartes(trouver(rendu, () => true))[0];
    const marque = renderToStaticMarkup(carte);
    expect(marque).toMatch(/^<button type="button"/);
    expect(marque).not.toContain('role="group"');
    (carte.props.onOuvrir as (e: Entree) => void)(rapatriee);
    const ouverte = trouver(m.rendre(), (e) => e.type === ApercuPublication);
    expect(ouverte).toHaveLength(1);
    verifierFiche(ouverte[0].props.entree as Entree);
  });

  it("vue jour : une carte du Studio sans lien reste un groupe (rien ne change pour elle)", () => {
    const studio: Entree = { cle: "creneau:c1|linkedin", jour: "2026-11-25", reseau: "linkedin", type: "video", etat: "a_valider", heure: "09:00", titre: "T", texte: "t" };
    const rendu = VueJour({ jour: "2026-11-25", aujourdhui: AUJOURDHUI, entrees: [studio], onOuvrirRapatriee: () => 0 }) as ReactElement;
    expect(renderToStaticMarkup(cartes(trouver(rendu, () => true))[0])).toContain('role="group"');
  });

  it("vue semaine : la carte est un bouton, son clic ouvre la fiche", () => {
    const m = monter(SemaineAvecApercu, { entrees: [rapatriee], semaineDu: "2026-11-23", aujourdhui: AUJOURDHUI });
    const grille = trouver(m.rendre(), (e) => e.type === GrilleSemaine)[0];
    expect(grille.props.onOuvrirEntree).toBeTypeOf("function");
    const marque = html(<CarteEntreeCalendrier entree={rapatriee} onOuvrir={() => 0} />);
    expect(marque).toMatch(/^<button type="button"/);
    (grille.props.onOuvrirEntree as (e: Entree) => void)(rapatriee);
    const ouverte = trouver(m.rendre(), (e) => e.type === ApercuPublication);
    expect(ouverte).toHaveLength(1);
    verifierFiche(ouverte[0].props.entree as Entree);
  });

  it("vue mois : la liste des reprises donne un bouton par publication, son clic ouvre la fiche", () => {
    const m = monter(RapatrieesDuMois, { aujourdhui: AUJOURDHUI, entrees: [rapatriee] });
    const racine = m.rendre();
    const carte = cartes(trouver(racine, () => true))[0];
    expect(carte).toBeDefined();
    expect(renderToStaticMarkup(carte)).toMatch(/^<button type="button"/);
    (carte.props.onOuvrir as (e: Entree) => void)(rapatriee);
    const ouverte = trouver(m.rendre(), (e) => e.type === ApercuPublication);
    expect(ouverte).toHaveLength(1);
    verifierFiche(ouverte[0].props.entree as Entree);
  });

  it("vue jour : les flèches de la fiche d'une reprise ne parcourent que les reprises", () => {
    const studio: Entree = { cle: "creneau:c1|linkedin", jour: "2026-11-25", reseau: "linkedin", type: "video", etat: "a_valider", heure: "09:00", titre: "T", texte: "t" };
    const autre = { ...rapatriee, cle: `${rapatriee.cle}-bis`, heure: "10:30" } as Entree;
    const m = monter(VueJourAvecFiche, { jour: "2026-11-25", aujourdhui: AUJOURDHUI, entrees: [studio, rapatriee, autre], liens: {} });
    const vue = trouver(m.rendre(), (e) => e.type === VueJour)[0];
    (vue.props.onOuvrirRapatriee as (e: Entree) => void)(rapatriee);
    const cle = () => (trouver(m.rendre(), (e) => e.type === ApercuPublication)[0].props.entree as Entree).cle;
    const props = () => trouver(m.rendre(), (e) => e.type === ApercuPublication)[0].props;
    for (const sens of ["onSuivante", "onPrecedente", "onSuivante", "onSuivante"]) {
      (props()[sens] as () => void)();
      expect(cle()).not.toBe(studio.cle);
    }
  });

  it("fiche : une adresse « javascript: » ne rend aucun lien, et le texte est échappé", () => {
    const piege = { ...rapatriee, lienDiffuseur: "javascript:alert(1)", texte: "<script>alert(1)</script> \"x\"" } as Entree;
    const m = html(<ApercuPublication entree={piege} aujourdhui={AUJOURDHUI} onPrecedente={() => 0} onSuivante={() => 0} onFermer={() => 0} onChangerDate={() => 0} />);
    expect(m).not.toContain("Ouvrir chez le diffuseur");
    expect(m).not.toContain("javascript:");
    expect(m).not.toContain("<script>");
    expect(m).toContain("&lt;script&gt;");
  });

  it("aucune reprise : rien n'est ajouté sous le mois", () => {
    expect(monter(RapatrieesDuMois, { aujourdhui: AUJOURDHUI, entrees: [] }).rendre()).toBeNull();
  });
});

describe("RAP · lien « Ouvrir chez le diffuseur »", () => {
  it("seulement https sur l'hôte du diffuseur", () => {
    expect(adresseDiffuseurSure("https://zernio.com/p/abc")).toBe("https://zernio.com/p/abc");
    expect(adresseDiffuseurSure("https://app.zernio.com/p/abc")).toContain("app.zernio.com");
    for (const mauvais of ["http://zernio.com/x", "https://zernio.com.autre.test/x", "https://exemple.test/x", "javascript:alert(1)", "https://u:p@zernio.com/x", "https://zernio.com:8443/p", "", null, undefined]) expect(adresseDiffuseurSure(mauvais)).toBeNull();
  });
  it("adresse sûre : lien en nouvel onglet, rel sûr ; sinon aucun lien", () => {
    const avec = html(<ApercuPublication entree={{ ...rapatriee, lienDiffuseur: "https://zernio.com/p/abc" }} aujourdhui={AUJOURDHUI} onPrecedente={() => 0} onSuivante={() => 0} onFermer={() => 0} onChangerDate={() => 0} />);
    expect(avec).toMatch(/<a href="https:\/\/zernio\.com\/p\/abc" target="_blank" rel="noopener noreferrer"[^>]*>Ouvrir chez le diffuseur<\/a>/);
    const sans = html(<ApercuPublication entree={{ ...rapatriee, lienDiffuseur: "http://evil.test/x" }} aujourdhui={AUJOURDHUI} onPrecedente={() => 0} onSuivante={() => 0} onFermer={() => 0} onChangerDate={() => 0} />);
    expect(sans).not.toContain("Ouvrir chez le diffuseur");
  });
});
