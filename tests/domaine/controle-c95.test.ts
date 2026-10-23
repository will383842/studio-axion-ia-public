import { describe, expect, it } from "vitest";
import { codesLeves, controlerVersion, GARDE_FOUS, NIVEAUX, type EntreeControle } from "@/domaine/controles-script";
import { phrasesDe } from "@/domaine/lecture";
import { bloc, seg } from "../helpers/g3";
import { versionV4 } from "../helpers/v4";

const finale = (texte: string) => (e: EntreeControle) => {
  e.fin[0].segments[e.fin[0].segments.length - 1].texte = texte;
};

describe("C95 : positionnement partout", () => {
  it("niveaux : bloquant machine, information pour Will, garde-fou", () => {
    expect(NIVEAUX.C95).toEqual({ machine: "bloquant", will: "info" });
    expect(GARDE_FOUS).toContain("C95");
  });
  it("la v4 de Will ne lève rien", () => {
    expect(codesLeves(controlerVersion(versionV4("machine")))).not.toContain("C95");
  });
  it("« faites-le vous-même » en conclusion : bloquant pour la machine, information pour Will", () => {
    const m = controlerVersion(versionV4("machine", finale("Faites-le vous-même en dix minutes.")));
    expect(m.violations.find((v) => v.controle === "C95")?.bloquant).toBe(true);
    expect(m.passe).toBe(false);
    const w = controlerVersion(versionV4("will", finale("Faites-le vous-même en dix minutes.")));
    expect(w.violations.find((v) => v.controle === "C95")?.bloquant).toBe(false);
  });
  it("une annonce d'outil dans le corps est repérée ; « Réservez un appel » non", () => {
    const e = (t: string) => (x: EntreeControle) => {
      x.corps[0].segments[2].texte = t;
    };
    expect(codesLeves(controlerVersion(versionV4("machine", e("Cet outil vient de sortir."))))).toContain("C95");
    expect(codesLeves(controlerVersion(versionV4("machine", finale("Réservez un appel."))))).not.toContain("C95");
  });
});

/** Relecture Opus : C95 ne bloque jamais un script valide (questions, inversions, faux amis, « vous-même » seul, tutoiement). */
describe("C95 : faux positifs interdits", () => {
  const corps = (texte: string, adresse: "vous" | "tu" = "vous") =>
    versionV4("machine", (e: EntreeControle) => {
      e.adresse = adresse;
      const ph = phrasesDe(texte);
      e.ouverture = [bloc("accroche", seg("t0", ph[0], { nature: "fait", marqueurs: [] }))];
      e.corps = [bloc("coeur", ...ph.slice(1, -1).map((t, i) => seg(`t${i + 1}`, t, { nature: "fait", marqueurs: [] })))];
      e.fin = [bloc("appel", seg("tf", ph.at(-1)!, { nature: "fait", marqueurs: [] }))];
      e.horodatageReel = undefined;
      e.debit = 2.75;
    });
  const leveC95 = (e: EntreeControle) => codesLeves(controlerVersion(e)).includes("C95");

  it.each([
    "Savez-vous combien de devis dorment ? Avez-vous déjà perdu un client ? Réservez un appel.",
    "Imaginez lundi matin. Votre assistante est absente. Envoyez-la à votre DAF. Réservez un appel.",
    "Pouvez-vous répondre en deux minutes ? Voulez-vous le voir ? Commentez ROUGE.",
    "Faites le calcul : dix heures par semaine. On s'en occupe pour vous. Réservez un appel.",
    "Faites-le tester par votre équipe. On s'en occupe pour vous. Réservez un appel.",
    "Testez-le avec votre équipe. On s'en occupe pour vous. Réservez un appel.",
    "Avant, vous relanciez vous-même chaque client. On s'en occupe pour vous. Réservez un appel.",
    "Chez vous, qui répond la nuit ? Assez de relances à la main. On s'en occupe pour vous. Réservez un appel.",
  ])("ne lève pas C95 : %s", (t) => expect(leveC95(corps(`Un client attend sa réponse. ${t}`))).toBe(false));

  it("« vous-même » seul ne bloque pas non plus dans la conclusion", () => {
    expect(leveC95(corps("Un client attend. On s'en occupe pour vous. Avant, vous relanciez vous-même chaque client."))).toBe(false);
  });
  it("« Faites-le vous-même avec notre guide » reste signalé", () => {
    expect(leveC95(corps("Un client attend. On le voit. Faites-le vous-même avec notre guide."))).toBe(true);
  });
  it("en « tu » : « fais-le toi-même » bloque, une question en « tu » ne bloque pas", () => {
    expect(leveC95(corps("Un client attend. On le voit. Fais-le toi-même ce soir.", "tu"))).toBe(true);
    expect(leveC95(corps("Un client attend. Sais-tu combien de devis dorment ? Veux-tu le voir ? Réserve un appel.", "tu"))).toBe(false);
  });

  it.each([
    "Testez par vous-même.",
    "Faites-le par vous-même.",
    "Fais-le par toi-même.",
    "Faites-le vous-même sans attendre.",
    "Faites-le vous-même, c'est simple pour vous.",
    "Vous-même, faites-le en dix minutes.",
    "Faites le vous-même.",
  ])("lève C95 (vrai positif) : %s", (t) => {
    expect(leveC95(corps(`Un client attend. ${t} On s'en occupe pour vous. Réservez un appel.`, /toi/.test(t) ? "tu" : "vous"))).toBe(true);
  });
});
