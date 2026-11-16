import { describe, it, expect } from "vitest";
import { PLAGES_MAX_PAR_FICHE } from "@/domaine/archive-extraits";
import type { MotHorodate } from "@/domaine/types";
import { decouperPlages, motsDepuisSegments, plafonner, phrases } from "@/briques/archive-extraits/plages";
import { motsClesDe } from "@/briques/archive-extraits/mots-cles";

/** Suite de mots de 0,4 s, contigus, à partir de `debut`, avec un trou optionnel après chaque mot. */
function mots(texte: string, debut = 0, trou: Record<number, number> = {}): MotHorodate[] {
  let t = debut;
  return texte.split(" ").map((mot, i) => {
    const m = { mot, debutSec: t, finSec: t + 0.4 };
    t += 0.4 + (trou[i] ?? 0.05);
    return m;
  });
}

describe("découpe en plages", () => {
  it("coupe en phrases sur la ponctuation", () => {
    const m = mots("Bonjour à tous les amis. Voici le premier conseil utile ?");
    const p = decouperPlages(m, { dureeSourceSec: 100, appelAuMot: false });
    expect(p.map((x) => x.texte)).toEqual(["Bonjour à tous les amis.", "Voici le premier conseil utile ?"]);
  });

  it("coupe sur un silence de 0,5 s sans ponctuation", () => {
    const m = mots("un deux trois quatre cinq six sept huit", 0, { 3: 0.5 });
    const g = phrases(m);
    expect(g.length).toBe(2);
    expect(g[0].length).toBe(4);
  });

  it("coupe une phrase de 9 s au plus grand silence intérieur", () => {
    const m = mots("a1 a2 a3 a4 a5 a6 a7 a8 a9 a10 a11 a12 a13 a14 a15 a16 a17 a18 a19 a20", 0, { 7: 0.3, 12: 0.1 });
    const g = phrases(m);
    expect(g.length).toBeGreaterThanOrEqual(2);
    expect(g[0].length).toBe(8);
    for (const x of g) expect(x[x.length - 1].finSec - x[0].debutSec).toBeLessThanOrEqual(6 + 1e-6);
  });

  it("exclut un montant", () => {
    const p = decouperPlages(mots("Cela coûte seulement 49 € par mois."), { dureeSourceSec: 100, appelAuMot: false });
    expect(p[0].etat).toBe("exclue");
    expect(p[0].raisonExclusion).toBe("montant");
  });

  it("exclut la fin d'appel si appelAuMot vrai ou absent, la garde avec false", () => {
    const m = mots("Un propos assez long pour durer. Écrivez GUIDE pour le recevoir ici.");
    const fin = m[m.length - 1].finSec;
    for (const appel of [true, undefined]) {
      const p = decouperPlages(m, { dureeSourceSec: fin, appelAuMot: appel });
      expect(p[0].etat).toBe("utilisable");
      expect(p[1].etat).toBe("exclue");
      expect(p[1].raisonExclusion).toBe("fin-appel");
    }
    const q = decouperPlages(m, { dureeSourceSec: fin, appelAuMot: false });
    expect(q.every((x) => x.etat === "utilisable")).toBe(true);
  });

  it("exclut une plage qui chevauche un intervalle interdit, avec sa raison", () => {
    const m = mots("Première phrase tout à fait normale. Seconde phrase en plein visage.");
    const p = decouperPlages(m, {
      dureeSourceSec: 100,
      appelAuMot: false,
      interdits: [{ debutSec: 3.5, finSec: 5, raison: "visage-interdit" }],
    });
    expect(p[0].etat).toBe("utilisable");
    expect(p[1].etat).toBe("exclue");
    expect(p[1].raisonExclusion).toBe("visage-interdit");
  });

  it("exclut texte vide et trop courte", () => {
    const p = decouperPlages([{ mot: "Oui.", debutSec: 0, finSec: 0.4 }, { mot: " ", debutSec: 5, finSec: 7 }], {
      dureeSourceSec: 100,
      appelAuMot: false,
    });
    expect(p.map((x) => x.raisonExclusion)).toEqual(["trop-courte", "texte-vide"]);
  });

  it("identifiants stables et résultat identique sur deux appels", () => {
    const m = mots("Bonjour à tous les amis. Voici le premier conseil utile.");
    const ctx = { dureeSourceSec: 100, appelAuMot: false };
    const a = decouperPlages(m, ctx);
    expect(decouperPlages(m, ctx)).toEqual(a);
    expect(a[0].id).toBe(`p-0-${Math.round(a[0].finSec * 100)}`);
    expect(a[0].avecVisage).toBe(false);
    expect(a[0].texteIncruste).toBe(false);
  });

  it("60 s de mots donnent entre 8 et 20 plages, sans montant utilisable", () => {
    const phrasesTxt = [
      "Voici une idée simple pour gagner du temps.",
      "Ça coûte 49 € par mois seulement.",
      "Regardez bien cette méthode pas à pas.",
      "Le tarif reste très abordable ici.",
    ];
    let m: MotHorodate[] = [];
    let t = 0;
    while (t < 58) {
      const bloc = mots(phrasesTxt[m.length % 4 === 0 ? 0 : (Math.floor(t / 4) % 4)], t);
      m = m.concat(bloc);
      t = bloc[bloc.length - 1].finSec + 0.1;
    }
    const p = decouperPlages(m, { dureeSourceSec: 60, appelAuMot: false });
    expect(p.length).toBeGreaterThanOrEqual(8);
    expect(p.length).toBeLessThanOrEqual(20);
    expect(p.filter((x) => x.etat === "utilisable" && /€|tarif|coûte/i.test(x.texte))).toEqual([]);
    expect(p.some((x) => x.etat === "utilisable")).toBe(true);
  });

  it("plafonne à 30, utilisables d'abord, ordre par début", () => {
    const m: MotHorodate[] = [];
    for (let i = 0; i < 50; i++) m.push(...mots("Une phrase assez longue ici.", i * 10));
    const p = decouperPlages(m, { dureeSourceSec: 1000, appelAuMot: false });
    expect(p.length).toBe(PLAGES_MAX_PAR_FICHE);
    expect(p.map((x) => x.debutSec)).toEqual([...p.map((x) => x.debutSec)].sort((a, b) => a - b));
    const mixtes = plafonner(
      [
        { ...p[0], id: "x1", etat: "exclue" },
        { ...p[1], id: "x2", etat: "utilisable" },
      ],
      1,
    );
    expect(mixtes.map((x) => x.id)).toEqual(["x2"]);
  });

  it("aplatit et trie les segments, sans doublon d'instant", () => {
    const a = { mot: "a", debutSec: 1, finSec: 1.4 };
    const b = { mot: "b", debutSec: 0, finSec: 0.4 };
    expect(motsDepuisSegments([{ mots: [a, b] }, { mots: [a] }]).map((x) => x.mot)).toEqual(["b", "a"]);
  });
});

describe("mots-clés", () => {
  it("sans accents ni mots vides", () => {
    expect(motsClesDe("L'Été à Paris, c'est 3 clients")).toEqual(["paris", "3", "clients"]);
  });
  it("sans doublon, vide accepté", () => {
    expect(motsClesDe("Client client CLIENT")).toEqual(["client"]);
    expect(motsClesDe("")).toEqual([]);
  });
});
