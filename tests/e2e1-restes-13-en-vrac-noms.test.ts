/**
 * E2E-1 générateur n° 13 (MAJEUR, 03/10) — dictée « Plusieurs » : le service calculait les noms à masquer, mais l'écran
 * les ignorait (rien proposé, accord jamais demandé), et la VILLE n'était jamais proposée (« Lyon »). Attendu : noms,
 * société et ville proposés dès le rangement (addendum §2 quinquies 4, critère G2), l'accord demandé quand il le faut,
 * et ce choix enregistré avec la matière.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { proposerNomsSensibles } = await import("@/domaine/matieres");
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const mat = await import("@/services/matieres");
const { LigneMorceau } = await import("@/components/matieres/FeuilleEnVrac");

const PHRASE = "Jean-Marc Dupont, de la société Transports Dupont à Lyon, nous a dit qu'il passait 6 heures par semaine sur Excel.";

describe("E2E-1 n° 13 · noms et ville proposés", () => {
  it("la ville d'un client est proposée, pas les pays ni les mots courants", () => {
    const noms = proposerNomsSensibles(PHRASE);
    expect(noms).toEqual(expect.arrayContaining(["Jean-Marc Dupont", "Lyon"]));
    expect(noms.some((n) => /Transports Dupont|Dupont/.test(n))).toBe(true);
    expect(proposerNomsSensibles("Une PME de Villeexemple ressaisit ses devis.")).toEqual(["Villeexemple"]);
    expect(proposerNomsSensibles("On travaille en France et en Europe.")).toEqual([]);
    expect(proposerNomsSensibles("Dans presque toutes les PME, ChatGPT et Excel cohabitent.")).toEqual([]);
  });

  it("la ligne d'un morceau montre les noms à masquer et demande l'accord quand il le faut", () => {
    const html = renderToStaticMarkup(
      createElement(LigneMorceau, {
        morceau: { texte: PHRASE, type: "parole-dirigeant", garde: true, noms: ["Jean-Marc Dupont", "Lyon"], masques: ["Jean-Marc Dupont", "Lyon"], accord: false },
        ouvert: false,
        onOuvrir: () => undefined,
        onChange: () => undefined,
      }),
    );
    expect(html).toContain("Masquer ces noms ?");
    expect(html).toContain("Lyon");
    expect(html).toContain("J&#x27;ai son accord");
    // Un avis de Will sans nom : ni masquage ni accord.
    const simple = renderToStaticMarkup(
      createElement(LigneMorceau, { morceau: { texte: "Les devis prennent trop de temps.", type: "avis-will", garde: true, noms: [], masques: [], accord: false }, ouvert: false, onOuvrir: () => undefined, onChange: () => undefined }),
    );
    expect(simple).not.toContain("Masquer ces noms ?");
    expect(simple).not.toContain("accord");
  });
});

describe("E2E-1 n° 13 · enregistrement en vrac", () => {
  const MDP = "e2e1-restes-vrac";
  beforeAll(async () => {
    await preparerMotDePasse(MDP);
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);
  });

  it("le découpage propose les noms ; le rangement garde les noms masqués et l'accord choisis", async () => {
    const dictee = `${PHRASE}\nLes devis prennent trop de temps.`;
    const morceaux = await mat.proposerDecoupe(dictee);
    const premier = morceaux.find((m) => m.texte.includes("Dupont"))!;
    expect(premier.nomsProposes).toEqual(expect.arrayContaining(["Jean-Marc Dupont", "Lyon"]));
    const { enregistrerEnVracAction } = await import("@/app/(studio)/ecrire/matieres/actions");
    const r = await enregistrerEnVracAction(dictee, morceaux.map((m) => ({ texte: m.texte, type: m.type, nomsSensibles: m.nomsProposes, accord: m === premier })), "code");
    expect(r.ok).toBe(true);
    const range = (await depots().matieres.lister()).find((m) => m.texte.includes("Dupont"))!;
    expect(range.nomsSensibles).toEqual(expect.arrayContaining(["Jean-Marc Dupont", "Lyon"]));
    if (range.accord) expect(range.accord.obtenu).toBe(true);
  });
});
