/** S2.6 — générateur, vidéo prête, variante, durée, chapitres, mention IA (SITE-12 à SITE-17). */
import { describe, expect, it } from "vitest";
import { controlerAvantSite, type EntreeControlesSite } from "@/domaine/site-videos/controles";
import { entreeOk, passeportOk } from "./helpers-controles";

const tous = (e: EntreeControlesSite, code: string) => controlerAvantSite(e).controles.filter((c) => c.code === code);
const echecs = (e: EntreeControlesSite, code: string) => tous(e, code).filter((c) => !c.ok);

describe("S2.6 SITE-12 et SITE-13", () => {
  it("générateur éteint → bloqué, le message nomme le type de vidéo", () => {
    const e = echecs(entreeOk({ formatId: "tableau-anime", ecrivain: "tableau", generateurAllume: false }), "SITE-12");
    expect(e).toHaveLength(1);
    expect(e[0].message).toBe("Les vidéos « Tableau animé » ne vont pas sur le site (Réglages › Sur le site).");
    expect(controlerAvantSite(entreeOk({ generateurAllume: false })).publiable).toBe(false);
  });
  it("vidéo non prête → bloqué", () => {
    expect(echecs(entreeOk({ videoPrete: false }), "SITE-13")[0].message).toBe("La vidéo n'est pas prête.");
    expect(controlerAvantSite(entreeOk({ videoPrete: false })).publiable).toBe(false);
  });
});

describe("S2.6 SITE-14 : pas une variante", () => {
  it.each(["variante-accroche", "variante-reseau", "autre-ratio"] as const)("%s → bloqué", (typeDerive) => {
    expect(echecs(entreeOk({ typeDerive }), "SITE-14")).toHaveLength(1);
  });
  it("un extrait ou une traduction n'est pas une variante de ce contrôle", () => {
    expect(echecs(entreeOk({ typeDerive: "extrait" }), "SITE-14")).toEqual([]);
  });
  it("une autre version du même sujet est déjà en ligne → bloqué", () => {
    const e = echecs(entreeOk({ autreVersionEnLigne: true }), "SITE-14");
    expect(e[0].message).toBe("Une autre version de cette vidéo est déjà sur le site.");
  });
});

describe("S2.6 SITE-15 : durée (avertissement seul)", () => {
  it("25 s → avertissement, la vidéo reste publiable si le reste passe", () => {
    const e = entreeOk({ dureeSec: 25, passeport: passeportOk({ chapitres: [] }) });
    const c = tous(e, "SITE-15");
    expect(c).toHaveLength(1);
    expect(c[0].ok).toBe(false);
    expect(c[0].gravite).toBe("avertissement");
    expect(c[0].message).toBe("Vidéo de 25 s : courte pour une page. Vous décidez.");
    expect(controlerAvantSite(e).publiable).toBe(true);
  });
  it("30 s et plus → vert", () => expect(tous(entreeOk({ dureeSec: 30 }), "SITE-15")[0].ok).toBe(true));
});

describe("S2.6 SITE-16 : chapitres", () => {
  const ch = (debutSec: number, finSec: number, libelle = "Partie") => ({ debutSec, finSec, libelle, blocRecette: "coeur" });
  it("chapitres en double (même début) → bloqué", () => {
    const e = echecs(entreeOk({ passeport: passeportOk({ chapitres: [ch(0, 10), ch(10, 20), ch(10, 30)] }) }), "SITE-16");
    expect(e[0].message).toBe("Deux chapitres commencent au même moment.");
  });
  it("le premier ne commence pas à 0 → bloqué", () => {
    expect(echecs(entreeOk({ passeport: passeportOk({ chapitres: [ch(2, 10), ch(10, 30)] }) }), "SITE-16")[0].message).toContain("0");
  });
  it("des chapitres sur une vidéo de moins de 30 s → bloqué", () => {
    expect(echecs(entreeOk({ dureeSec: 25 }), "SITE-16")).toHaveLength(1);
  });
  it("aucun chapitre → vert ; chapitres propres → vert", () => {
    expect(echecs(entreeOk({ passeport: passeportOk({ chapitres: [] }) }), "SITE-16")).toEqual([]);
    expect(echecs(entreeOk(), "SITE-16")).toEqual([]);
  });
  it("un seul chapitre → bloqué (il en faut au moins 2 ou aucun)", () => {
    expect(echecs(entreeOk({ passeport: passeportOk({ chapitres: [ch(0, 40)] }) }), "SITE-16")).toHaveLength(1);
  });
});

describe("S2.6 SITE-17 : mention IA (avertissement)", () => {
  it("contenu généré → avertissement qui dit ce que le site affichera", () => {
    const c = tous(entreeOk({ passeport: passeportOk({ contenuGenere: true }) }), "SITE-17")[0];
    expect(c.gravite).toBe("avertissement");
    expect(c.ok).toBe(false);
    expect(c.message).toBe("Le site affichera « Vidéo réalisée avec un double numérique ».");
  });
  it("sans contenu généré → rien à dire (vert)", () => {
    expect(tous(entreeOk(), "SITE-17")[0].ok).toBe(true);
  });
  it("un avertissement ne bloque jamais", () => {
    expect(controlerAvantSite(entreeOk({ passeport: passeportOk({ contenuGenere: true }) })).publiable).toBe(true);
  });
});

describe("S2.6 ensemble", () => {
  it("les 17 contrôles du plan sont présents, dans l'ordre", () => {
    const codes = [...new Set(controlerAvantSite(entreeOk()).controles.map((c) => c.code))];
    expect(codes).toEqual(Array.from({ length: 17 }, (_, i) => `SITE-${String(i + 1).padStart(2, "0")}`));
  });
});
