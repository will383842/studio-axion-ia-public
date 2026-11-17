/** Fiche d'un mot : raisons des envois refusés (affichage seul). Sans DOM ; valeurs fictives. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({
  ...(await o<typeof import("react")>()),
  ...(await import("../aides/crochets-factices")).crochets,
}));

const { FicheMot } = await import("@/components/mots/FicheMot");
const { monter, trouver } = await import("../aides/crochets-factices");
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
  it("T4a : fiche identique à avant : sans les nouveaux champs ou avec raisonsRefus vide et refusSansRaison à zéro, même HTML", () => {
    const sans = rendu(chiffres());
    const vide = rendu(
      chiffres({ raisonsRefus: [], refusSansRaison: f(0, 0, 0) }),
    );
    expect(vide).toBe(sans);
  });
  it("T4b : deux lignes du même libellé, avec et sans « d'après le message » : les deux s'affichent, sans alerte de clé en double", () => {
    const erreurs = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const libelle = "Limite d'envoi du réseau atteinte";
      const h = rendu(
        chiffres({
          raisonsRefus: [
            { libelle, dApresMessage: false, f: f(1, 2, 4) },
            { libelle, dApresMessage: true, f: f(0, 1, 3) },
          ],
        }),
      );
      expect(h.match(new RegExp(`dont : ${libelle}`, "g"))).toHaveLength(2);
      expect(h.match(/d'après le message du réseau/g)).toHaveLength(1);
      // Le rendu serveur ne signale pas les clés en double : on lit l'arbre d'éléments et on exige des clés distinctes entre sœurs.
      const resume: Resume = {
        mot: "DEVIS",
        etat: "brouillon",
        validations: { facebook: "valide", instagram: "absente" },
        comptes: [],
        cibleDiffere: false,
        chiffres: chiffres({
          raisonsRefus: [
            { libelle, dApresMessage: false, f: f(1, 2, 4) },
            { libelle, dApresMessage: true, f: f(0, 1, 3) },
          ],
        }),
      };
      const arbre = monter(FicheMot as never, {
        resume,
        catalogue: [],
        apercu: null,
        services: {} as never,
        onFermer: vi.fn(),
      }).rendre();
      const section = trouver(arbre, (e) => (e.type as { name?: string }).name === "SectionChiffres")[0];
      expect(section).toBeDefined();
      const contenu = (section.type as (p: unknown) => never)(section.props);
      const lignes = trouver(contenu, (e) => e.props.detail === true && String(e.props.libelle).includes(libelle));
      expect(lignes).toHaveLength(2);
      const cles = lignes.map((e) => e.key);
      expect(cles.every((k) => k !== null)).toBe(true);
      expect(new Set(cles).size).toBe(2);
      const alertes = erreurs.mock.calls.map((a) => a.map(String).join(" "));
      expect(alertes.filter((m) => /key/i.test(m))).toEqual([]);
    } finally {
      erreurs.mockRestore();
    }
  });
});
