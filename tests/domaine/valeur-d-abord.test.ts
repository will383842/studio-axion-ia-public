import { describe, expect, it } from "vitest";
import {
  verifierValeurDAbord,
  HYPOTHESE_D4,
  type PublicationValeur,
} from "@/domaine/calendrier/valeur-d-abord";

const pub = (id: string, jour: string, nature: "offre" | "valeur", compte = "LW", famille: PublicationValeur["famille"] = "fondateur"): PublicationValeur => ({
  id, compte, famille, jour, nature,
});
const valeurs = (n: number, debut = 1, compte = "LW", famille: PublicationValeur["famille"] = "fondateur") =>
  Array.from({ length: n }, (_, i) => pub(`v${compte}${i}`, `2026-12-${String(debut + i).padStart(2, "0")}`, "valeur", compte, famille));

describe("RC-25 · valeur d'abord (avertissement)", () => {
  it("les valeurs sont des hypothèses nommées, modifiables", () => {
    expect(HYPOTHESE_D4.fondateurMaxOffres).toBe(1);
    expect(HYPOTHESE_D4.pageMaxOffres).toBe(3);
    expect(HYPOTHESE_D4.fenetrePublications).toBe(20);
  });

  it("aucune offre : aucun avertissement", () => {
    const r = verifierValeurDAbord(valeurs(5), pub("n", "2026-12-10", "valeur"));
    expect(r.avertissements).toEqual([]);
    expect(r.journal).toEqual([]);
  });

  it("une première offre passe", () => {
    const r = verifierValeurDAbord(valeurs(5), pub("o", "2026-12-10", "offre"));
    expect(r.avertissements).toEqual([]);
  });

  it("2e offre sur 20 pour un compte du fondateur : avertissement, non bloquant", () => {
    const hist = [...valeurs(5), pub("o1", "2026-12-06", "offre"), ...valeurs(3, 7)];
    const r = verifierValeurDAbord(hist, pub("o2", "2026-12-12", "offre"));
    expect(r.avertissements.map((a) => a.code)).toContain("trop-d-offres");
    expect(r.bloquant).toBe(false);
  });

  it("deux offres de suite sur un compte du fondateur : avertissement", () => {
    const hist = [...valeurs(3), pub("o1", "2026-12-04", "offre")];
    const r = verifierValeurDAbord(hist, pub("o2", "2026-12-05", "offre"));
    expect(r.avertissements.map((a) => a.code)).toContain("offres-de-suite");
  });

  it("page : 3 offres tolérées, la 4e avertit", () => {
    const h3 = [pub("a", "2026-12-01", "offre", "FA", "page"), ...valeurs(1, 2, "FA", "page"), pub("b", "2026-12-03", "offre", "FA", "page"), ...valeurs(1, 4, "FA", "page"), pub("c", "2026-12-05", "offre", "FA", "page")];
    expect(verifierValeurDAbord(h3.slice(0, 4), pub("c", "2026-12-05", "offre", "FA", "page")).avertissements).toEqual([]);
    const r = verifierValeurDAbord(h3, pub("d", "2026-12-07", "offre", "FA", "page"));
    expect(r.avertissements.map((a) => a.code)).toContain("trop-d-offres");
  });

  it("groupe, lettre, podcast : aucune offre", () => {
    const r = verifierValeurDAbord([], pub("x", "2026-12-01", "offre", "GR", "autre"));
    expect(r.avertissements.map((a) => a.code)).toContain("trop-d-offres");
  });

  it("les autres comptes ne comptent pas", () => {
    const hist = [pub("o1", "2026-12-01", "offre", "IG"), ...valeurs(3, 2)];
    const r = verifierValeurDAbord(hist, pub("o2", "2026-12-08", "offre", "LW"));
    expect(r.avertissements).toEqual([]);
  });

  it("fenêtre de 30 jours : une offre ancienne n'est plus comptée", () => {
    const hist = [pub("o1", "2026-10-01", "offre"), pub("v1", "2026-10-02", "valeur")];
    const r = verifierValeurDAbord(hist, pub("o2", "2026-12-12", "offre"));
    expect(r.avertissements).toEqual([]);
  });

  it("exception motivée : avertissement levé et journalisée", () => {
    const hist = [...valeurs(3), pub("o1", "2026-12-04", "offre")];
    const r = verifierValeurDAbord(hist, pub("o2", "2026-12-05", "offre"), {
      motif: "Lancement de la session de janvier",
      par: "le fondateur",
      date: "2026-12-05",
    });
    expect(r.avertissements.every((a) => a.leveeParException)).toBe(true);
    expect(r.avertissements.length).toBeGreaterThan(0);
    expect(r.journal).toHaveLength(1);
    expect(r.journal[0]).toMatchObject({ publicationId: "o2", motif: "Lancement de la session de janvier", compte: "LW" });
    expect(r.journal[0].codes.length).toBeGreaterThan(0);
  });

  it("exception sans motif : refusée, l'avertissement reste, rien de journalisé", () => {
    const hist = [pub("o1", "2026-12-04", "offre")];
    const r = verifierValeurDAbord(hist, pub("o2", "2026-12-05", "offre"), { motif: "   ", par: "x", date: "2026-12-05" });
    expect(r.avertissements.some((a) => !a.leveeParException)).toBe(true);
    expect(r.journal).toEqual([]);
    expect(r.exceptionRefusee).toBe(true);
  });

  it("exception sans avertissement : rien à journaliser", () => {
    const r = verifierValeurDAbord(valeurs(3), pub("o", "2026-12-10", "offre"), { motif: "test", par: "x", date: "2026-12-10" });
    expect(r.journal).toEqual([]);
  });

  it("ne modifie pas l'historique reçu", () => {
    const hist = Object.freeze([...valeurs(3)]);
    expect(() => verifierValeurDAbord(hist, pub("o", "2026-12-10", "offre"))).not.toThrow();
  });

  it("point 1 : une offre datée après la candidate n'est pas comptée", () => {
    const r = verifierValeurDAbord([pub("futur", "2026-12-20", "offre")], pub("o", "2026-12-01", "offre"));
    expect(r.avertissements).toEqual([]);
  });

  it("point 2 : exception sans auteur ou sans date : refusée, rien de journalisé", () => {
    const hist = [pub("o1", "2026-12-04", "offre")];
    for (const exc of [
      { motif: "ok", par: "", date: "2026-12-05" },
      { motif: "ok", par: "le fondateur", date: "" },
      { motif: "ok", par: "le fondateur", date: "pas-une-date" },
    ]) {
      const r = verifierValeurDAbord(hist, pub("o2", "2026-12-05", "offre"), exc);
      expect(r.exceptionRefusee).toBe(true);
      expect(r.journal).toEqual([]);
      expect(r.avertissements.every((a) => !a.leveeParException)).toBe(true);
    }
  });

  it("point 3 : la fenêtre de 30 jours inclut J-30 exactement, pas J-31", () => {
    const pile = verifierValeurDAbord([pub("o1", "2026-11-01", "offre")], pub("o2", "2026-12-01", "offre"));
    expect(pile.avertissements.map((a) => a.code)).toContain("trop-d-offres");
    const hors = verifierValeurDAbord([pub("o1", "2026-10-31", "offre"), pub("v", "2026-11-15", "valeur")], pub("o2", "2026-12-01", "offre"));
    expect(hors.avertissements).toEqual([]);
  });

  it("point 4 : un jour invalide donne un avertissement explicite", () => {
    const hist = ["a", "b", "c"].map((id) => pub(id, "xx", "offre", "FA", "page"));
    const r = verifierValeurDAbord(hist, pub("d", "2026-12-07", "offre", "FA", "page"));
    expect(r.avertissements.map((a) => a.code)).toContain("jour-invalide");
    const c = verifierValeurDAbord([], pub("e", "xx", "offre"));
    expect(c.avertissements.map((a) => a.code)).toEqual(["jour-invalide"]);
  });

  it("point 5 : la candidate déjà dans l'historique n'est pas comptée deux fois", () => {
    const o = pub("o", "2026-12-05", "offre");
    const r = verifierValeurDAbord([...valeurs(3), o], o);
    expect(r.avertissements).toEqual([]);
  });

  it("point 6 : le message de la valeur D-4 précise l'hypothèse", () => {
    const r = verifierValeurDAbord([pub("o1", "2026-12-04", "offre")], pub("o2", "2026-12-08", "offre"));
    const m = r.avertissements.find((a) => a.code === "trop-d-offres")?.message ?? "";
    expect(m).toContain("hypothèse en attente de D-4");
  });
});
