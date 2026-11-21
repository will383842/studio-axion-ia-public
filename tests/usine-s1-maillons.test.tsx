/** PR S1 · maillons du plan : la semaine gardée côté serveur, le message partiel affiché, le sujet transmis par la grille, le bouton sans adresse « À valider ». Aucun réseau. */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reinitialiserDepots } from "@/donnees/memoire";

vi.mock("server-only", () => ({}));
vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("./aides/crochets-factices")).crochets }));

const { proposerSemaine, lireDerniereSemaine, PARAM_DERNIERE_SEMAINE } = await import("@/services/proposer-semaine");
const { BoutonProposerSemaine } = await import("@/components/calendrier/BoutonProposerSemaine");
const { GrilleSemaine } = await import("@/components/calendrier/GrilleSemaine");
const { monter, trouver, texteDe, attendre } = await import("./aides/crochets-factices");
const { lireParametre } = await import("@/services/_commun");
import type { IdeeUsine } from "@/domaine/usine";
import type { Resultat } from "@/services/_commun";
import type { SemaineProposee } from "@/services/proposer-semaine";

const ENV = { USINE_URL: "https://usine.test/", USINE_PORTE_SECRET: "s".repeat(40) };
const LUNDI = "2026-12-14";
const ligneSujet = {
  signature: "plombier|tpe|devis|d12|c01||tableau-anime|scène vécue",
  parts: { metier: "plombier", taille: "TPE", douleur: "d12", cas_usage: "c01", actualite: null, format: "tableau-anime", structure: "scène vécue" },
  metier: { code: "plombier", libelle: "Plombier" },
  taille: { code: "TPE", libelle: "TPE" },
  douleur: { code: "d12", dite: "Les devis traînent trois jours." },
  cas_usage: { code: "c01", titre: "Un devis envoyé dans l'heure." },
  format: { code: "tableau-anime", libelle: "Tableau animé" },
};
const ligne = (o: Record<string, unknown> = {}) => ({ cle: "u1", jour: "2026-12-15", reseau: "linkedin", type: "video", ...o });
const reponse = (corps: unknown) => new Response(JSON.stringify(corps), { status: 200, headers: { "content-type": "application/json" } });
const F = (f: unknown) => f as unknown as typeof fetch;
beforeEach(() => reinitialiserDepots());

describe("la dernière semaine est gardée côté serveur", () => {
  it("après une proposition : seulement debut et, pour chaque carte avec sujet, cle, jour, réseau et sujet", async () => {
    const f = vi.fn(async () => reponse({ propositions: [ligne({ sujet: ligneSujet }), ligne({ cle: "u2" })] }));
    await proposerSemaine({ debut: LUNDI }, { env: ENV, fetchImpl: F(f), maintenant: new Date("2026-12-10T10:00:00Z") });
    const gardee = await lireDerniereSemaine();
    expect(gardee?.debut).toBe(LUNDI);
    expect(gardee?.propositions.map((p) => p.cle)).toEqual(["u1"]);
    expect(gardee?.propositions[0]).toMatchObject({ jour: "2026-12-15", reseau: "linkedin", sujet: { signature: ligneSujet.signature } });
    expect(PARAM_DERNIERE_SEMAINE).toBe("calendrier.proposerSemaine.derniere");
  });
  it("une valeur gardée abîmée vaut « rien de gardé »", async () => {
    expect(await lireDerniereSemaine()).toBeNull();
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre(PARAM_DERNIERE_SEMAINE, { debut: 5 });
    expect(await lireDerniereSemaine()).toBeNull();
    await ecrireParametre(PARAM_DERNIERE_SEMAINE, { debut: LUNDI, propositions: [{ cle: "a" }, "x", null] });
    expect((await lireDerniereSemaine())?.propositions).toEqual([]);
    expect(await lireParametre(PARAM_DERNIERE_SEMAINE, null)).not.toBeNull();
  });
  it("la réponse partielle porte le message de l'Usine", async () => {
    const f = vi.fn(async () => reponse({ propositions: [ligne()], message: "TikTok n'est pas proposé : aucun compte actif." }));
    const r = await proposerSemaine({ debut: LUNDI }, { env: ENV, fetchImpl: F(f), maintenant: new Date("2026-12-10T10:00:00Z") });
    expect(r.message).toBe("TikTok n'est pas proposé : aucun compte actif.");
  });
});

describe("le bouton « Proposer la semaine »", () => {
  const donnees = (o: Partial<SemaineProposee> = {}): Resultat<SemaineProposee> => ({ ok: true, donnees: { propositions: [{ cle: "u1", jour: "2026-12-15", reseau: "linkedin", type: "video", etat: "propose" }], appelsRestants: 3, ...o } });
  it("affiche la phrase de l'Usine d'une réponse partielle, telle quelle", async () => {
    const proposer = vi.fn(async () => donnees({ message: "TikTok n'est pas proposé : aucun compte actif." }));
    const m = monter(BoutonProposerSemaine, { debutSemaine: LUNDI, proposer });
    await (trouver(m.rendre(), (e) => e.type === "button")[0]!.props.onClick as () => void)();
    await attendre();
    const texte = texteDe(m.rendre());
    expect(texte).toContain("TikTok n'est pas proposé : aucun compte actif.");
  });
  it("sans adresse « À valider » : la semaine s'affiche, sans lien « Voir dans À valider »", async () => {
    const proposer = vi.fn(async () => donnees());
    const m = monter(BoutonProposerSemaine, { debutSemaine: LUNDI, proposer });
    await (trouver(m.rendre(), (e) => e.type === "button")[0]!.props.onClick as () => void)();
    await attendre();
    expect(trouver(m.rendre(), (e) => e.type === "li")).toHaveLength(1);
  });
});

describe("la grille transmet le sujet à la carte", () => {
  const idee: IdeeUsine = { signature: "s", parts: { metier: "m" }, metier: "M", taille: "TPE", douleur: "d", casUsage: "c" };
  const entree = { cle: "p1", jour: "2026-12-15", reseau: "linkedin", type: "video", etat: "propose" } as const;
  const rendre = (sujet?: IdeeUsine) => renderToStaticMarkup(<GrilleSemaine semaineDu={LUNDI} aujourdhui={LUNDI} entrees={[]} propositions={[{ entree: { ...entree }, ...(sujet ? { sujet } : {}) }]} lienAValider="/a-valider" />);
  it("avec sujet : le bouton « Retenir ce sujet » apparaît ; sans sujet, non", () => {
    expect(rendre(idee)).toContain("Retenir ce sujet");
    expect(rendre()).not.toContain("Retenir ce sujet");
  });
});

describe("la grille montre les propositions sans adresse « À valider »", () => {
  const idee: IdeeUsine = { signature: "s", parts: { metier: "m" }, metier: "M", taille: "TPE", douleur: "d", casUsage: "c" };
  const entree = { cle: "p1", jour: "2026-12-15", reseau: "linkedin", type: "video", etat: "propose" } as const;
  it("sans lienAValider : la carte est montrée, le bouton « Retenir ce sujet » aussi, mais aucun lien « À valider »", () => {
    const html = renderToStaticMarkup(<GrilleSemaine semaineDu={LUNDI} aujourdhui={LUNDI} entrees={[]} propositions={[{ entree: { ...entree }, sujet: idee }]} />);
    expect(html).toContain("data-proposition");
    expect(html).toContain("Retenir ce sujet");
    expect(html).not.toContain("Voir dans À valider");
  });
});

describe("la page n'exige plus l'adresse « À valider »", () => {
  it("le bouton de la semaine ne dépend que de l'usine reliée ; l'adresse est facultative", () => {
    const page = readFileSync("src/app/(studio)/calendrier/page.tsx", "utf8");
    expect(page).toMatch(/usineActive\(\) && <div[^\n]*<BoutonProposerSemaine/);
    expect(page).not.toMatch(/usineActive\(\) && adresseAValiderUsine\(\) &&/);
  });
});
