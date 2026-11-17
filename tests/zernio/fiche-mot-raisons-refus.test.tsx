/** Fiche d'un mot : raisons des envois refusés (affichage seul). Sans DOM ; valeurs fictives. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({
  ...(await o<typeof import("react")>()),
  ...(await import("../aides/crochets-factices")).crochets,
}));

const { FicheMot } = await import("@/components/mots/FicheMot");
type Resume = import("@/domaine/guide-reseau/vue-mots-cibles").ResumeMot;
type Chiffres = import("@/domaine/guide-reseau/vue-mots-cibles").ChiffresMot;

const f = (j7: number, j30: number, total: number) => ({ j7, j30, total });
const chiffres = (sur: Partial<Chiffres> = {}): Chiffres => ({
  ecrits: f(4, 10, 25),
  envoyes: f(3, 8, 20),
  incertains: f(0, 0, 0),
  suivent: f(2, 5, 12),
  commentairesBloques: f(0, 0, 0),
  envoisRefuses: f(2, 5, 9),
  ...sur,
});
const rendu = (c: Chiffres | null) => {
  const resume: Resume = {
    mot: "DEVIS",
    etat: "brouillon",
    validations: { facebook: "valide", instagram: "absente" },
    comptes: [],
    cibleDiffere: false,
    chiffres: c,
  };
  return renderToStaticMarkup(
    <FicheMot
      resume={resume}
      catalogue={[]}
      apercu={null}
      services={{} as never}
      onFermer={vi.fn()}
    />,
  ).replace(/<!-- -->/g, "").replace(/&#x27;/g, "'");
};

describe("fiche : raisons de refus", () => {
  it("une sous-ligne « dont : … » par raison, avec ses chiffres", () => {
    const h = rendu(
      chiffres({
        raisonsRefus: [
          {
            libelle:
              "La messagerie de la page est désactivée dans ses réglages",
            dApresMessage: false,
            f: f(1, 3, 6),
          },
          {
            libelle: "Limite d'envoi du réseau atteinte",
            dApresMessage: true,
            f: f(1, 2, 3),
          },
        ],
      }),
    );
    expect(h).toContain(
      "dont : La messagerie de la page est désactivée dans ses réglages",
    );
    expect(h).toContain("dont : Limite d'envoi du réseau atteinte");
    expect(h).toMatch(/dont : La messagerie[^]*?>1<[^]*?>3<[^]*?>6</);
    expect(h).toContain("(d'après le message du réseau)");
    expect(h.match(/d'après le message du réseau/g)).toHaveLength(1);
    expect(h).not.toContain("raison non enregistrée");
  });
  it("ligne « raison non enregistrée » seulement si des refus n'ont pas de raison", () => {
    expect(
      rendu(chiffres({ raisonsRefus: [], refusSansRaison: f(0, 0, 0) })),
    ).not.toContain("raison non enregistrée");
    expect(
      rendu(chiffres({ raisonsRefus: [], refusSansRaison: f(1, 2, 9) })),
    ).toContain("dont : raison non enregistrée");
  });
  it("aucun refus, ou champs absents : fiche identique à avant", () => {
    const sans = rendu(chiffres());
    expect(sans).not.toContain("dont :");
    const zero = rendu(
      chiffres({
        envoisRefuses: f(0, 0, 0),
        raisonsRefus: [{ libelle: "X", dApresMessage: false, f: f(0, 0, 0) }],
        refusSansRaison: f(0, 0, 0),
      }),
    );
    expect(zero).not.toContain("dont :");
  });
  it("le rendu ne montre ni statut, ni code Meta, ni identifiant", () => {
    const h = rendu(
      chiffres({
        raisonsRefus: [
          {
            libelle: "Limite d'envoi du réseau atteinte",
            dApresMessage: true,
            f: f(1, 2, 9),
          },
        ],
        refusSansRaison: f(1, 1, 1),
      }),
    );
    expect(h).not.toMatch(/HTTP|meta|INBOX|\d{6,}/);
  });
});
