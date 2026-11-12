/** INSTA-B · décision pure « suivre le compte puis répondre OK » (Instagram). Données 100 % fictives, aucun envoi. */
import { describe, expect, it } from "vitest";
import {
  ATTENTES_SUIVI_MS,
  ETATS_IG,
  REPONSES_IG_MAX_PAR_MESSAGE,
  choisirParcoursPourOk,
  deciderReponseInstagram,
  suiviDepuisPort,
  type EtatSuivi,
} from "@/domaine/guide-reseau/suivi-instagram";

type Entree = Parameters<typeof deciderReponseInstagram>[0];
const FIN = 1_000_000;
const base: Entree = {
  etat: "ig_attente_ok",
  suivi: "suit",
  essaisSuivi: 0,
  pasEncoreDejaEnvoye: false,
  douteOpposition: false,
  maintenantMs: 0,
  finFenetreMs: FIN,
};
const d = (o: Partial<Entree>) => deciderReponseInstagram({ ...base, ...o });

describe("constantes", () => {
  it("valeurs figées", () => {
    expect(ETATS_IG).toEqual(["ig_attente_ok", "ig_pas_encore", "ig_envoi_en_vol", "ig_a_verifier"]);
    expect(ATTENTES_SUIVI_MS).toEqual([60_000, 300_000]);
    expect(REPONSES_IG_MAX_PAR_MESSAGE).toBe(3);
  });
});

describe("table des décisions", () => {
  it("suit, pas encore jamais envoyé => lien deja_suivi", () =>
    expect(d({})).toEqual({ action: "lien", issue: "deja_suivi" }));
  it("suit après un « pas encore » => lien gagne", () =>
    expect(d({ pasEncoreDejaEnvoye: true, etat: "ig_pas_encore" })).toEqual({ action: "lien", issue: "gagne" }));
  it("suit en ig_attente_ok avec pas encore déjà envoyé => gagne", () =>
    expect(d({ pasEncoreDejaEnvoye: true })).toEqual({ action: "lien", issue: "gagne" }));
  it("ne suit pas, ig_attente_ok, premier => pas_encore", () =>
    expect(d({ suivi: "ne_suit_pas" })).toEqual({ action: "pas_encore" }));
  it("ne suit pas, ig_attente_ok, déjà envoyé => lien sans_suivre", () =>
    expect(d({ suivi: "ne_suit_pas", pasEncoreDejaEnvoye: true })).toEqual({ action: "lien", issue: "sans_suivre" }));
  it("ne suit pas, ig_pas_encore => lien sans_suivre", () =>
    expect(d({ suivi: "ne_suit_pas", etat: "ig_pas_encore" })).toEqual({ action: "lien", issue: "sans_suivre" }));
  it("ne suit pas, ig_pas_encore, déjà envoyé => lien sans_suivre", () =>
    expect(d({ suivi: "ne_suit_pas", etat: "ig_pas_encore", pasEncoreDejaEnvoye: true })).toEqual({ action: "lien", issue: "sans_suivre" }));
  it("inconnu => lien inconnu", () =>
    expect(d({ suivi: "inconnu" })).toEqual({ action: "lien", issue: "inconnu" }));
  it("panne définitive => lien inconnu", () =>
    expect(d({ suivi: "panne_definitive" })).toEqual({ action: "lien", issue: "inconnu" }));
  it("panne passagère, 0 essai => réessayer dans 60 s", () =>
    expect(d({ suivi: "panne_passagere", essaisSuivi: 0 })).toEqual({ action: "reessayer_suivi", apresMs: 60_000 }));
  it("panne passagère, 1 essai => réessayer dans 300 s", () =>
    expect(d({ suivi: "panne_passagere", essaisSuivi: 1 })).toEqual({ action: "reessayer_suivi", apresMs: 300_000 }));
  it("panne passagère, 2 essais => lien inconnu", () =>
    expect(d({ suivi: "panne_passagere", essaisSuivi: 2 })).toEqual({ action: "lien", issue: "inconnu" }));
  it("panne passagère, 5 essais => lien inconnu", () =>
    expect(d({ suivi: "panne_passagere", essaisSuivi: 5 })).toEqual({ action: "lien", issue: "inconnu" }));
  it("panne passagère : le réessai doit tenir dans la fenêtre", () => {
    expect(d({ suivi: "panne_passagere", maintenantMs: FIN - 60_001 })).toEqual({ action: "reessayer_suivi", apresMs: 60_000 });
    expect(d({ suivi: "panne_passagere", maintenantMs: FIN - 60_000 })).toEqual({ action: "lien", issue: "inconnu" });
    expect(d({ suivi: "panne_passagere", essaisSuivi: 1, maintenantMs: FIN - 300_001 })).toEqual({ action: "reessayer_suivi", apresMs: 300_000 });
    expect(d({ suivi: "panne_passagere", essaisSuivi: 1, maintenantMs: FIN - 300_000 })).toEqual({ action: "lien", issue: "inconnu" });
  });
});

describe("doute et fenêtre", () => {
  const SUIVIS: EtatSuivi[] = ["suit", "ne_suit_pas", "inconnu", "panne_passagere", "panne_definitive"];
  it.each(SUIVIS)("doute prioritaire même si %s", (suivi) =>
    expect(d({ suivi, douteOpposition: true })).toEqual({ action: "silence", raison: "doute" }));
  it("doute prioritaire sur hors fenêtre", () =>
    expect(d({ douteOpposition: true, finFenetreMs: null })).toEqual({ action: "silence", raison: "doute" }));
  it("fin de fenêtre inconnue => silence hors_fenetre, même si suit", () =>
    expect(d({ finFenetreMs: null })).toEqual({ action: "silence", raison: "hors_fenetre" }));
  it("bornes : une milliseconde avant la fin => répond ; à la fin => silence", () => {
    expect(d({ maintenantMs: FIN - 1 })).toEqual({ action: "lien", issue: "deja_suivi" });
    expect(d({ maintenantMs: FIN })).toEqual({ action: "silence", raison: "hors_fenetre" });
    expect(d({ maintenantMs: FIN + 1 })).toEqual({ action: "silence", raison: "hors_fenetre" });
  });
  it.each(SUIVIS)("hors fenêtre => silence pour %s", (suivi) =>
    expect(d({ suivi, maintenantMs: FIN })).toEqual({ action: "silence", raison: "hors_fenetre" }));
});

describe("jamais deux « pas encore »", () => {
  const etats = ["ig_attente_ok", "ig_pas_encore"] as const;
  for (const etat of etats)
    for (const deja of [true, false])
      it(`${etat}, déjà envoyé=${deja} : pas_encore seulement au premier en attente`, () => {
        const r = d({ etat, suivi: "ne_suit_pas", pasEncoreDejaEnvoye: deja });
        expect(r.action === "pas_encore").toBe(etat === "ig_attente_ok" && !deja);
      });
  it("aucune autre entrée ne donne pas_encore", () => {
    for (const suivi of ["suit", "inconnu", "panne_passagere", "panne_definitive"] as const)
      for (const etat of etats)
        for (const deja of [true, false])
          for (const essaisSuivi of [0, 1, 2, 3])
            expect(d({ suivi, etat, pasEncoreDejaEnvoye: deja, essaisSuivi }).action).not.toBe("pas_encore");
  });
});

describe("suiviDepuisPort : entrées absurdes", () => {
  it.each<[unknown, EtatSuivi]>([
    [{ statut: "suit" }, "suit"],
    [{ statut: "ne_suit_pas" }, "ne_suit_pas"],
    [{ statut: "inconnu" }, "inconnu"],
    [{ statut: "panne", definitive: false }, "panne_passagere"],
    [{ statut: "panne", definitive: true }, "panne_definitive"],
    [{ statut: "panne" }, "panne_definitive"],
    [{ statut: "panne", definitive: "false" }, "panne_definitive"],
    [{ statut: "panne", definitive: 0 }, "panne_definitive"],
    [{ statut: "panne", definitive: null }, "panne_definitive"],
    [{ statut: "SUIT" }, "panne_definitive"],
    [{ statut: "suit " }, "panne_definitive"],
    [{ statut: "autre" }, "panne_definitive"],
    [{ statut: 1 }, "panne_definitive"],
    [{ statut: null }, "panne_definitive"],
    [{}, "panne_definitive"],
    [[], "panne_definitive"],
    [["suit"], "panne_definitive"],
    ["suit", "panne_definitive"],
    [true, "panne_definitive"],
    [42, "panne_definitive"],
    [null, "panne_definitive"],
    [undefined, "panne_definitive"],
  ])("%j => %s", (lu, attendu) => expect(suiviDepuisPort(lu)).toBe(attendu));
  it("ne lève jamais, même sur un objet piégé", () => {
    const piege = new Proxy({}, { get: () => { throw new Error("piège"); } });
    expect(() => suiviDepuisPort(piege)).not.toThrow();
  });
});

describe("choisirParcoursPourOk", () => {
  const p = (cle: string, etat: string, creeLe: string, idCompte = "compte-a") => ({ cle, etat, creeLe, idCompte });
  it("plafond par défaut : 3", () => {
    const l = [1, 2, 3, 4, 5].map((i) => p(`k${i}`, "ig_attente_ok", `2026-01-0${i}T00:00:00Z`));
    expect(choisirParcoursPourOk(l, "compte-a").map((x) => x.cle)).toEqual(["k1", "k2", "k3"]);
  });
  it("plafond explicite", () => {
    const l = [1, 2, 3].map((i) => p(`k${i}`, "ig_pas_encore", `2026-01-0${i}T00:00:00Z`));
    expect(choisirParcoursPourOk(l, "compte-a", 2)).toHaveLength(2);
    expect(choisirParcoursPourOk(l, "compte-a", 0)).toHaveLength(0);
  });
  it("autre compte exclu", () => {
    const l = [p("a", "ig_attente_ok", "2026-01-01T00:00:00Z", "compte-b"), p("b", "ig_attente_ok", "2026-01-02T00:00:00Z")];
    expect(choisirParcoursPourOk(l, "compte-a").map((x) => x.cle)).toEqual(["b"]);
  });
  it("autres états exclus", () => {
    const l = ["ig_envoi_en_vol", "ig_a_verifier", "autre", "", "IG_ATTENTE_OK"].map((e, i) => p(`k${i}`, e, "2026-01-01T00:00:00Z"));
    expect(choisirParcoursPourOk(l, "compte-a")).toEqual([]);
  });
  it("plus anciens d'abord ; date illisible en dernier", () => {
    const l = [
      p("recent", "ig_attente_ok", "2026-03-01T00:00:00Z"),
      p("illisible", "ig_pas_encore", "pas une date"),
      p("ancien", "ig_pas_encore", "2026-01-01T00:00:00Z"),
      p("vide", "ig_attente_ok", ""),
      p("milieu", "ig_attente_ok", "2026-02-01T00:00:00Z"),
    ];
    const r = choisirParcoursPourOk(l, "compte-a", 10).map((x) => x.cle);
    expect(r.slice(0, 3)).toEqual(["ancien", "milieu", "recent"]);
    expect(r.slice(3).sort()).toEqual(["illisible", "vide"]);
  });
  it("une date illisible n'évince pas une date lisible sous le plafond", () => {
    const l = [p("x", "ig_attente_ok", "n/a"), p("y", "ig_attente_ok", "2026-01-01T00:00:00Z")];
    expect(choisirParcoursPourOk(l, "compte-a", 1).map((e) => e.cle)).toEqual(["y"]);
  });
  it("ne modifie pas la liste reçue", () => {
    const l = [p("b", "ig_attente_ok", "2026-02-01T00:00:00Z"), p("a", "ig_attente_ok", "2026-01-01T00:00:00Z")];
    const copie = structuredClone(l);
    choisirParcoursPourOk(l, "compte-a");
    expect(l).toEqual(copie);
  });
  it("liste vide => vide", () => expect(choisirParcoursPourOk([], "compte-a")).toEqual([]));
});
