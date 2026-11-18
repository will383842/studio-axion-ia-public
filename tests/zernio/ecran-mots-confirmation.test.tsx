/**
 * Écran /mots : la confirmation des gestes est affichée DANS la page (plus de fenêtre du navigateur).
 * Sans DOM (crochets factices) : on lit l'arbre rendu et on appelle nous-mêmes les `onClick`.
 * Valeurs FICTIVES, aucun réseau. Sans « Confirmer », aucun service n'est appelé.
 */
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({
  ...(await o<typeof import("react")>()),
  ...(await import("../aides/crochets-factices")).crochets,
}));
vi.mock("@/components/ui/Toast", () => ({
  notifier: { succes: vi.fn(), erreur: vi.fn(), essai: vi.fn(), info: vi.fn() },
}));

const { monter, trouver, texteDe, attendre } = await import("../aides/crochets-factices");
const { EcranMots } = await import("@/components/mots/EcranMots");
const { Dialogue } = await import("@/components/ui/Dialogue");
const { PHRASE_ACTIVER, PHRASE_PAUSE, PHRASE_VALIDER_GUIDE } = await import("@/components/mots/gestes-mot-local");
type VueMots = import("@/services/mots-service").VueMots;
type Resultat = import("@/services/mots-service").Resultat;
type ResultatReglage = import("@/services/parcours-reglages").ResultatReglage;
type EtatReglagesParcours = import("@/services/parcours-reglages").EtatReglagesParcours;
type Proprietes = Parameters<typeof EcranMots>[0];
type Elt = ReturnType<typeof trouver>[number];

const COMPTE = "compte_fictif";
const PHRASE_FORMULATION = "Valider cette formulation ? Rien n’est envoyé.";
const PHRASE_MOTS_MULTIPLES = "Allumer le mode plusieurs mots ? Les personnes pourront recevoir plusieurs mots et des renvois avec un lien neuf. Vous pouvez l’éteindre en un clic.";
const PHRASE_INSTAGRAM = "Allumer « Instagram : suivre le compte puis OK » ? Les commentaires Instagram recevront une réponse privée qui demande de suivre le compte puis d’écrire OK. Vous pouvez l’éteindre en un clic.";

const VUE: VueMots = {
  interrupteurAllume: false,
  toutArrete: false,
  disjoncteur: { ouvert: false, raison: null, ouvertLe: null },
  plafonds: { heureCompte: 600, jourMot: 1000 },
  lignes: [],
  oppositions: 0,
  guideValide: false,
  guidePerime: false,
  parcoursAllume: false,
  oppositionsNonTransmises: 0,
  formulations: [{ groupe: "m1-lien", version: "mp-m1-v4-2", texte: "Texte fictif de la formulation.", valide: false }],
};
const LIGNE_LOCALE_ACTIVE: VueMots["lignes"][number] = { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "" };

const RESULTAT: Resultat = { issue: "execute", raison: "ok" };
const faux = () => ({
  mettreEnPause: vi.fn(async () => RESULTAT),
  reactiver: vi.fn(async () => RESULTAT),
  activerLocal: vi.fn(async () => RESULTAT),
  mettreEnPauseLocal: vi.fn(async () => RESULTAT),
  validerGuide: vi.fn(async () => ({ ok: true, raison: "valide" })),
  validerFormulation: vi.fn(async () => ({ ok: true, raison: "valide" })),
  reglerParcours: vi.fn(async (): Promise<ResultatReglage> => ({ ok: true, etat: { motsMultiples: true, instagramSuivre: false } })),
  refermerDisjoncteur: vi.fn(async () => ({ ok: true })),
  reglerPlafonds: vi.fn(async () => undefined),
});
type Faux = ReturnType<typeof faux>;

const ouvrir = (s: Faux, sur: { lignes?: VueMots["lignes"]; comptes?: string[]; reglages?: EtatReglagesParcours }) => {
  const props: Proprietes = {
    vue: { ...VUE, lignes: sur.lignes ?? [] },
    services: s,
    comptes: sur.comptes,
    reglages: sur.reglages,
    onChange: vi.fn(),
  };
  return monter(EcranMots, props);
};

const boutonNomme = (arbre: ReactNode, nom: string): Elt | undefined =>
  trouver(arbre, (e) => typeof e.props.onClick === "function" && texteDe(e) === nom)[0];
const reglage = (arbre: ReactNode, nom: string): ReactNode => trouver(arbre, (e) => e.props["data-reglage"] === nom)[0];
const cliquer = (e: Elt | undefined) => {
  if (!e) throw new Error("bouton introuvable");
  (e.props.onClick as () => void)();
};
const dialogues = (arbre: ReactNode) => trouver(arbre, (e) => e.type === Dialogue);
const pied = (d: Elt) => d.props.pied as ReactNode;

interface Cas {
  nom: string;
  phrase: string;
  sur: Parameters<typeof ouvrir>[1];
  declencheur: (arbre: ReactNode) => Elt | undefined;
  appels: (s: Faux) => unknown[][];
  attendus: unknown[][];
}
const CAS: Cas[] = [
  {
    nom: "activer le mot GUIDE (geste local)",
    phrase: PHRASE_ACTIVER,
    sur: { comptes: [COMPTE] },
    declencheur: (a) => boutonNomme(a, "Activer le mot GUIDE"),
    appels: (s) => s.activerLocal.mock.calls,
    attendus: [[COMPTE]],
  },
  {
    nom: "mettre le mot GUIDE en pause (geste local)",
    phrase: PHRASE_PAUSE,
    sur: { lignes: [LIGNE_LOCALE_ACTIVE] },
    declencheur: (a) => boutonNomme(a, "Mettre en pause"),
    appels: (s) => s.mettreEnPauseLocal.mock.calls,
    attendus: [["GUIDE", COMPTE]],
  },
  {
    nom: "valider les textes du mot GUIDE",
    phrase: PHRASE_VALIDER_GUIDE,
    sur: {},
    declencheur: (a) => boutonNomme(a, "Valider les textes du mot GUIDE"),
    appels: (s) => s.validerGuide.mock.calls,
    attendus: [[]],
  },
  {
    nom: "valider une formulation",
    phrase: PHRASE_FORMULATION,
    sur: {},
    declencheur: (a) => boutonNomme(a, "Valider cette formulation"),
    appels: (s) => s.validerFormulation.mock.calls,
    attendus: [["mp-m1-v4-2"]],
  },
  {
    nom: "allumer le mode plusieurs mots",
    phrase: PHRASE_MOTS_MULTIPLES,
    sur: { reglages: { motsMultiples: false, instagramSuivre: false } },
    declencheur: (a) => boutonNomme(reglage(a, "mots_multiples"), "Allumer"),
    appels: (s) => s.reglerParcours.mock.calls,
    attendus: [["mots_multiples", true]],
  },
  {
    nom: "allumer « Instagram : suivre le compte puis OK »",
    phrase: PHRASE_INSTAGRAM,
    sur: { reglages: { motsMultiples: true, instagramSuivre: false } },
    declencheur: (a) => boutonNomme(reglage(a, "instagram_suivre"), "Allumer"),
    appels: (s) => s.reglerParcours.mock.calls,
    attendus: [["instagram_suivre", true]],
  },
];

describe("écran /mots : confirmation dans la page", () => {
  it("la source n'appelle plus la fenêtre du navigateur", () => {
    const src = readFileSync(new URL("../../src/components/mots/EcranMots.tsx", import.meta.url), "utf8");
    expect(src).not.toContain("window.confirm");
  });

  it("au départ, aucune boîte n'est affichée", () => {
    const m = ouvrir(faux(), { comptes: [COMPTE] });
    expect(dialogues(m.rendre())).toHaveLength(0);
  });

  describe.each(CAS)("$nom", (cas) => {
    const poser = async () => {
      const s = faux();
      const m = ouvrir(s, cas.sur);
      cliquer(cas.declencheur(m.rendre()));
      await attendre();
      return { s, m };
    };

    it("(a) la phrase affichée est exactement la phrase du geste, avec Annuler puis Confirmer", async () => {
      const { s, m } = await poser();
      const d = dialogues(m.rendre());
      expect(d).toHaveLength(1);
      expect(d[0].props.description).toBe(cas.phrase);
      const boutons = trouver(pied(d[0]), (e) => typeof e.props.onClick === "function").map((e) => texteDe(e));
      expect(boutons).toEqual(["Annuler", "Confirmer"]);
      expect(cas.appels(s)).toHaveLength(0);
    });

    it("(b) Annuler : aucun appel de service, la boîte se ferme", async () => {
      const { s, m } = await poser();
      cliquer(boutonNomme(pied(dialogues(m.rendre())[0]), "Annuler"));
      await attendre();
      expect(cas.appels(s)).toHaveLength(0);
      expect(dialogues(m.rendre())).toHaveLength(0);
    });

    it("(b) fermeture (Échap, croix, clic hors de la boîte) : aucun appel de service", async () => {
      const { s, m } = await poser();
      (dialogues(m.rendre())[0].props.onOuvertChange as (v: boolean) => void)(false);
      await attendre();
      expect(cas.appels(s)).toHaveLength(0);
      expect(dialogues(m.rendre())).toHaveLength(0);
    });

    it("(c) Confirmer : un seul appel, avec les bons arguments", async () => {
      const { s, m } = await poser();
      cliquer(boutonNomme(pied(dialogues(m.rendre())[0]), "Confirmer"));
      await attendre();
      expect(cas.appels(s)).toEqual(cas.attendus);
      expect(dialogues(m.rendre())).toHaveLength(0);
    });

    it("(d) double clic sur Confirmer : un seul appel", async () => {
      const { s, m } = await poser();
      const confirmer = boutonNomme(pied(dialogues(m.rendre())[0]), "Confirmer");
      cliquer(confirmer);
      cliquer(confirmer);
      await attendre();
      expect(cas.appels(s)).toHaveLength(1);
    });
  });

  it("une nouvelle question abandonne la précédente : la première reste sans appel, la seconde demande son propre « oui »", async () => {
    const s = faux();
    const m = ouvrir(s, { comptes: [COMPTE] });
    cliquer(boutonNomme(m.rendre(), "Activer le mot GUIDE"));
    await attendre();
    expect(dialogues(m.rendre())[0].props.description).toBe(PHRASE_ACTIVER);
    cliquer(boutonNomme(m.rendre(), "Valider les textes du mot GUIDE"));
    await attendre();
    const d = dialogues(m.rendre());
    expect(d).toHaveLength(1);
    expect(d[0].props.description).toBe(PHRASE_VALIDER_GUIDE);
    cliquer(boutonNomme(pied(d[0]), "Confirmer"));
    await attendre();
    expect(s.activerLocal).not.toHaveBeenCalled();
    expect(s.validerGuide).toHaveBeenCalledTimes(1);
  });
});
