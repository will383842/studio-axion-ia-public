/**
 * Relecture finale A09 (PR #254) : le parcours n° 8 de E2E-2 (`e2e2-gen-tu.test.ts`), rejoué sur la CHAÎNE COURTE (le
 * réglage de production `generateur.chaine = "courte"`). La courte reprenait les accroches et les finalistes au « vous »
 * de l'écriture d'origine : la version « + Tu » commençait par « Vous pensez gagner du temps… ». Après correction, quand
 * l'adresse change, le script réécrit les finalistes dans la bonne adresse (les déclinaisons les reçoivent ainsi), et un
 * contrôle par code refuse une accroche ou une 1re ligne à la mauvaise adresse.
 * Parcours de l'écran, Claude simulé, 0 €.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.setConfig({ testTimeout: 60_000 });

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const mat = await import("@/services/matieres");
const { proposerTypeMatiere, assemblerBlocs, texteDesBlocs, versionsCourantes } = await import("@/domaine/derivations-generateur");
const { vousVersTu } = await import("@/generateur/adresse-tu");

const MDP = "essai-e2e2-gen-tu-courte";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  const { migrerDonnees } = await import("@/services/migrations");
  await migrerDonnees(depots());
  // Le réglage de production : la chaîne courte écrit.
  const { ecrireParametre } = await import("@/services/_commun");
  await ecrireParametre(bg.PARAM_CHAINE, "courte");
});
afterEach(() => bg.arreterBoucleGeneration());

const VRAC = "Dans une PME, une personne passe 35 heures par semaine à exporter, copier, coller et vérifier des données dans des dizaines de tableurs.\nUne seule erreur de formule dans un tableur, et tous les chiffres qui en dépendent sont faux.\nExcel, ça paraît gratuit.\nUn tableur ne vérifie rien tout seul, donc chaque copier-coller est une occasion d'erreur que personne ne voit.\nEst-ce qu'on peut se passer de nos Excel sans tout casser ?";
const COMPLEMENTS = ["Un client nous a dit : on perd deux jours par mois à recopier les mêmes chiffres.", "J'ai vu une équipe passer de 10 heures à 2 heures de saisie par semaine.", "Le pourquoi : personne ne vérifie les copies, donc les erreurs restent.", "La conséquence : des décisions prises sur des chiffres faux.", "Je pense qu'un tableur sans contrôle coûte plus cher qu'un outil."];
const IDEE = "Une personne qui passe ses semaines à recopier des données dans des tableurs, et ce que ça coûte vraiment";
const LIMITE = "Sauf si vos tableaux changent de forme chaque mois : là, gardez votre tableur et vérifiez-le à la main.";

async function sujetEcritEtValide(): Promise<string> {
  const morceaux = await mat.proposerDecoupe(VRAC);
  await mat.enregistrerEnVrac(VRAC, morceaux.map((m) => ({ texte: m.texte, type: m.type })));
  const { ajouterPreuve } = await import("@/services/preuves");
  await ajouterPreuve({ enonce: "La saisie de cette équipe est passée de 6 heures à 1 heure par semaine." });
  let r = await bg.lancerGeneration({ idee: IDEE, reseaux: ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"], formatId: "avocat", mode: "avatar" } as never);
  const id = r.scriptMaitreId;
  for (const c of COMPLEMENTS) {
    if (r.ok) break;
    r = (await bg.completerSujet(id, { matiere: { type: proposerTypeMatiere(c), texte: c, source: { origine: "dictee", date: new Date().toISOString() }, motsCles: [] } })) as typeof r;
  }
  expect(r.ok).toBe(true);
  await bg.tourBoucleGeneration();
  await bg.validerException(id, { texte: LIMITE });
  const v0 = await depots().variantes.lister((v) => v.scriptMaitreId === id && !v.archiveLe);
  await bg.validerVariantes(v0.map((v) => v.id));
  return id;
}

/** Formes du « vous » qui ne doivent plus rester dans une version au « tu ». */
const VOUS = /\b(vous|votre|vos|Vous|Votre|Vos)\b|\b\w+ez\b(?=[\s,.!?:;-]|$)/;

describe("E2E-2 parcours n° 8 · « + Tu » entièrement au « tu » (chaîne courte)", () => {
  it("accroche, 1re ligne, corps, limite et fin des versions « Tu » : aucun « vous » ; la limite y est, au « tu »", async () => {
    const id = await sujetEcritEtValide();
    const r = await bg.ajouterDeclinaison(id, { adresse: "tu" });
    expect(r.ok).toBe(true);
    await bg.tourBoucleGeneration();
    const gens = await depots().generations.lister((g) => g.scriptMaitreId === id);
    expect(gens.every((g) => g.etapes.every((e) => e.role.startsWith("court-") || e.role === "declinaison")), "écrit par la chaîne courte").toBe(true);
    const vs = versionsCourantes(await depots().variantes.lister((v) => v.scriptMaitreId === id && !v.archiveLe)).filter((v) => /-T$/.test(v.code));
    expect(vs.length).toBe(5);
    for (const v of vs) {
      const s = await depots().scripts.obtenir(v.scriptId);
      const texte = texteDesBlocs(assemblerBlocs(s!, v));
      const fautif = texte.split(/\n+/).filter((l) => VOUS.test(l));
      expect(fautif, `${v.code} :\n${texte}`).toEqual([]);
      expect(v.publication.premiereLigne, `${v.code} : 1re ligne`).not.toMatch(VOUS);
      expect(texte).toContain(vousVersTu(LIMITE));
    }
    const vous = versionsCourantes(await depots().variantes.lister((v) => v.scriptMaitreId === id && !v.archiveLe)).filter((v) => !/-T$/.test(v.code));
    expect(vous.length).toBeGreaterThan(0);
    for (const v of vous) {
      const s = await depots().scripts.obtenir(v.scriptId);
      expect(texteDesBlocs(assemblerBlocs(s!, v))).toContain(LIMITE);
    }
  });
});
