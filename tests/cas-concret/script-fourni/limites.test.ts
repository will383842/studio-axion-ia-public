/** Script fourni : cas limites de la lecture et de la durée (R21), pur, aucun appel. */
import { describe, expect, it } from "vitest";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { dureesDesFins, ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { DEBIT_RECETTE, dureeFinMs, dureeFinParDefautMs, tempsEcrans } from "@/moteurs/montage-cas-concret/regles";
import { bornesDesFins, controlerTexteFourni, limiteCaracteresDuCorps, lireTexteFourni, texteFourniDesEcrans } from "@/moteurs/montage-cas-concret/script-fourni";

const FIXE = { videoId: "v", versionId: "v", habillage: "charte-duo/1", origine: "porte-a" } as const;
const LT02 = trouverCas("transporteur-demandes-de-cotation")!;
const bornes = bornesDesFins(LT02);
const gabarit = ficheParGabarit(LT02, FIXE, dureesDesFins([bornes.courte, bornes.longue]));
const BASE = texteFourniDesEcrans(gabarit.ecrans, LT02);

describe("lecture : l'« avant » et la bascule", () => {
  it("« Avant le rendez-vous, … » au milieu des étapes n'est PAS une liste « avant » (seules comptent les lignes qui suivent l'accroche)", () => {
    const r = lireTexteFourni(
      ["Vos demandes de prix arrivent sans le poids.", "Avant : un client écrit.", "Voici ce que devient cette demande.", "La demande arrive.", "Avant le rendez-vous, le client reçoit un rappel.", "La demande est classée.", "Résultat : fini.", "Et vous ?"].join("\n"),
      LT02,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lignes.map((l) => l.forme)).toEqual(["accroche", "avant", "bascule", "etape", "etape", "etape", "resultat", "question"]);
  });

  it("des étapes étiquetées sans aucune bascule : « ajoutez une ligne [bascule] avant la première étape »", () => {
    const r = lireTexteFourni(["[accroche] Bonjour ici.", "[étape 1] Une étape.", "[étape 2] Deux.", "[question] Et vous ?"].join("\n"), LT02);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refus).toEqual([{ ligne: 2, message: "Ligne 2 : ajoutez une ligne [bascule] avant la première étape." }]);
  });
});

describe("durée : R21", () => {
  it("le min et le max suivent la règle : le corps au débit de la recette, plus la fin la plus courte (min) ou la plus longue par défaut (max), sur trois cas", () => {
    for (const id of ["transporteur-demandes-de-cotation", "recrutement-apporteurs", "garage-rendez-vous-rappeles"]) {
      const cas = trouverCas(id)!;
      const b = bornesDesFins(cas);
      const g = ficheParGabarit(cas, FIXE, dureesDesFins([b.courte, b.longue]));
      const r = controlerTexteFourni(texteFourniDesEcrans(g.ecrans, cas), cas);
      expect(r.ok, id).toBe(true);
      const t = tempsEcrans(g.ecrans, DEBIT_RECETTE);
      const corps = t[t.length - 1].finMs - t[0].debutMs;
      if (r.ok) {
        expect(r.dureeMs.min).toBe(corps + dureeFinMs(b.courte));
        expect(r.dureeMs.max).toBe(corps + dureeFinParDefautMs(cas));
        expect(r.dureeMs.max).toBeGreaterThanOrEqual(r.dureeMs.min);
      }
    }
  });

  it("juste sous 35 s avec la fin la plus courte : refusé, avec un nombre qui ne dépasse pas la borne (jamais « 35 s, il en faut 35 »)", () => {
    const l = BASE.split("\n");
    let vu = false;
    // On raccourcit toutes les étapes d'un mot à la fois jusqu'à passer sous la borne : le premier texte refusé pour la durée est jugé.
    for (let k = 14; k >= 4 && !vu; k--) {
      const essai = l.map((x) => {
        const e = /^(\[étape \d\])\s*(.*)$/.exec(x);
        return e ? `${e[1]} ${e[2].split(" ").slice(0, k).join(" ")}` : x;
      });
      const r = controlerTexteFourni(essai.join("\n"), LT02);
      if (!r.ok && r.dureeMs && r.dureeMs.min < 35_000) {
        vu = true;
        const m = r.refus.find((x) => x.message.startsWith("Durée : avec la fin la plus courte"))!;
        expect(m.message).toMatch(/^Durée : avec la fin la plus courte la vidéo ferait environ [\d,]+ s, il en faut au moins 35 : ajoutez une phrase\.$/);
        const dit = Number(/environ ([\d,]+) s/.exec(m.message)![1].replace(",", "."));
        expect(dit).toBeLessThan(35);
        expect(dit).toBeLessThanOrEqual(r.dureeMs.min / 1000);
      }
    }
    expect(vu).toBe(true);
  });
});

describe("la limite du prix (tant que le prix exact d'un script de Will n'existe pas)", () => {
  it("la limite est le nombre de caractères du corps que l'estimation utilise : le gabarit lui-même y tient pile", () => {
    const limite = limiteCaracteresDuCorps(LT02);
    expect(limite).toBe(gabarit.ecrans.map((e) => e.texteDit.trim()).join(" ").length);
    expect(limite).toBeGreaterThan(300);
  });
});
