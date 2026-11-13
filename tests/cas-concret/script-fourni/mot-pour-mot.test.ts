/** Script fourni : le texte du fondateur est gardé mot pour mot (tabulation, nombre de tête, capitales, points de suspension, remarques). Pur, aucun appel. */
import { describe, expect, it } from "vitest";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { sigleLu, sigleLuFourni } from "@/moteurs/montage-cas-concret/ecriture";
import { SIGLES_PERMIS } from "@/moteurs/montage-cas-concret/gardes-textes-cas";
import { ficheBruteDuTexteFourni, lireTexteFourni } from "@/moteurs/montage-cas-concret/script-fourni";

const cas = trouverCas("transporteur-demandes-de-cotation")!;

/** Un script de 7 lignes dont la ligne 3 (une étape) est celle qu'on étudie. */
const script = (ligne: string, suivante = "Deuxième étape faite.") =>
  ["[accroche] Une cotation en une minute.", "[bascule] Voici la méthode simple.", ligne, `[étape 2] ${suivante}`, "[étape 3] Troisième étape faite.", "[résultat] Le résultat est net.", "[question] Et chez vous ?"].join("\n");

const fiche = (texte: string) => {
  const r = ficheBruteDuTexteFourni(texte, cas);
  if (!r.ok) throw new Error(r.refus.map((x) => x.message).join(" | "));
  return { dits: r.brute.ecrans.map((e) => e.texteDit as string), remarques: r.remarques ?? [] };
};
const dit3 = (ligne: string) => fiche(script(ligne)).dits[2];

describe("tabulation", () => {
  it("une tabulation devient une espace, les autres caractères de contrôle sont retirés", () => {
    expect(dit3("[étape 1] Une alerte\tarrive.")).toBe("Une alerte arrive.");
    expect(dit3("[étape 1] Une\u0007 alerte\u0000 arrive.")).toBe("Une alerte arrive.");
  });
});

describe("nombre de tête", () => {
  it("« 60. » en tête d'une phrase seule est gardé, avec une remarque", () => {
    const r = fiche(script("60. C'est le nombre de secondes qu'il faut."));
    expect(r.dits[2]).toBe("60. C'est le nombre de secondes qu'il faut.");
    expect(r.remarques).toContain("Ligne 3 : le nombre de tête est gardé comme texte.");
  });

  it("« 1) » est une puce retirée ; une vraie liste numérotée (toutes les lignes) est retirée", () => {
    expect(dit3("1) Première étape faite.")).toBe("Première étape faite.");
    const liste = ["1. Une cotation en une minute.", "2. [bascule] Voici la méthode simple.", "3. [étape 1] A faite.", "4. [étape 2] B faite.", "5. [étape 3] C faite.", "6. [résultat] Le résultat est net.", "7. [question] Et chez vous ?"].join("\n");
    const l = lireTexteFourni(liste, cas);
    expect(l.ok && l.lignes.map((x) => x.texte)[0]).toBe("Une cotation en une minute.");
  });
});

describe("capitales", () => {
  it("« STOP », « OK », « GRATUIT », « URSSAF » sont dits comme écrits", () => {
    expect(dit3("[étape 1] STOP aux relances.")).toBe("STOP aux relances.");
    expect(dit3("[étape 1] C'est OK.")).toBe("C'est OK.");
    expect(dit3("[étape 1] C'est GRATUIT.")).toBe("C'est GRATUIT.");
    expect(dit3("[étape 1] L'URSSAF répond.")).toBe("L'URSSAF répond.");
  });

  it("« RGPD », « IA », « CRM » (sigles connus) et « PV » (sans voyelle) sont épelés, avec une remarque", () => {
    const r = fiche(script("[étape 1] Le RGPD, l'IA, le CRM et le PV."));
    expect(r.dits[2]).toBe("Le R.G.P.D., l'I.A., le C.R.M. et le P.V.");
    for (const m of ["RGPD", "IA", "CRM", "PV"]) expect(r.remarques).toContain(`Ligne 3 : « ${m} » sera épelé.`);
  });

  it("un sigle déjà épelé n'est pas touché, et aucune remarque", () => {
    const r = fiche(script("[étape 1] Le R.G.P.D. s'applique."));
    expect(r.dits[2]).toBe("Le R.G.P.D. s'applique.");
    expect(r.remarques.some((m) => m.includes("épelé"))).toBe(false);
  });

  it("l'écriture par l'IA garde son comportement : tout mot en capitales est épelé", () => {
    expect(sigleLu("STOP aux relances... OK.")).toBe("S.T.O.P. aux relances. O.K.");
    expect(sigleLu("Le CRM.")).toBe("Le C.R.M.");
  });

  it("sigleLuFourni : liste donnée en paramètre", () => {
    expect(sigleLuFourni("STOP, RGPD et PV", SIGLES_PERMIS)).toBe("STOP, R.G.P.D. et P.V.");
    expect(sigleLuFourni("STOP", new Set(["STOP"]))).toBe("S.T.O.P.");
  });
});

describe("points de suspension", () => {
  it("« ... » est gardé pour le script fourni", () => {
    expect(dit3("[étape 1] La suite...")).toBe("La suite...");
    expect(dit3("[étape 1] Alors... on y va.")).toBe("Alors... on y va.");
  });
  it("et reste remplacé pour l'écriture par l'IA", () => {
    expect(sigleLu("La suite...")).toBe("La suite.");
  });
});

describe("remarques", () => {
  it("une ligne qui ne finit pas une phrase et que suit une minuscule", () => {
    const r = fiche(script("[étape 1] Vous gagnez du temps,", "et de l'argent."));
    expect(r.remarques).toContain("Ligne 3 : cette ligne ne finit pas une phrase, la voix marquera un arrêt.");
    expect(r.remarques.some((m) => m.startsWith("Ligne 4"))).toBe(false);
  });

  it("une coupe à 8 mots du texte affiché (détail, résultat, question)", () => {
    const long = "un deux trois quatre cinq six sept huit neuf dix";
    const texte = ["[accroche] Une cotation en une minute.", "[bascule] Voici la méthode simple.", "[étape 1] A faite.", "[étape 2] B faite.", "[étape 3] C faite.", `[détail] ${long}.`, `[résultat] ${long}.`, `[question] ${long} ?`].join("\n");
    const r = fiche(texte);
    for (const n of [6, 7, 8]) expect(r.remarques).toContain(`Ligne ${n} : le texte affiché à l'écran sera raccourci à 8 mots (la voix dit tout).`);
    expect(r.dits[5]).toContain("neuf dix");
  });
});
