import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import type { CoupeFacecam } from "@/domaine/facecam";
import { complement, coupesAppliquees, recalerCoupesDemandees, resumeCoupes, texteSousTitresGardes, versPrise } from "@/briques/coupes";

const coupe = (id: string, type: CoupeFacecam["type"], debutSec: number, finSec: number): CoupeFacecam => ({ id, type, debutSec, finSec });
const m = (mot: string, debutSec: number, finSec: number): MotHorodate => ({ mot, debutSec, finSec });

describe("complement", () => {
  it("rend les passages gardés entre les coupes, dans l'ordre", () => {
    expect(complement([{ debutSec: 1, finSec: 2 }, { debutSec: 4, finSec: 5 }], 10)).toEqual([
      { debutSec: 0, finSec: 1 },
      { debutSec: 2, finSec: 4 },
      { debutSec: 5, finSec: 10 },
    ]);
  });
  it("trie les coupes sans modifier le tableau reçu", () => {
    const coupes = [{ debutSec: 4, finSec: 5 }, { debutSec: 1, finSec: 2 }];
    const copie = structuredClone(coupes);
    expect(complement(coupes, 10)).toHaveLength(3);
    expect(coupes).toEqual(copie);
  });
  it("sans coupe : toute la prise ; durée nulle : rien", () => {
    expect(complement([], 10)).toEqual([{ debutSec: 0, finSec: 10 }]);
    expect(complement([], 0)).toEqual([]);
  });
  it("coupes aux bords et coupes qui se recouvrent", () => {
    expect(complement([{ debutSec: 0, finSec: 2 }], 10)).toEqual([{ debutSec: 2, finSec: 10 }]);
    expect(complement([{ debutSec: 8, finSec: 10 }], 10)).toEqual([{ debutSec: 0, finSec: 8 }]);
    expect(complement([{ debutSec: 1, finSec: 5 }, { debutSec: 2, finSec: 3 }], 10)).toEqual([
      { debutSec: 0, finSec: 1 },
      { debutSec: 5, finSec: 10 },
    ]);
  });
});

describe("coupesAppliquees", () => {
  const coupes = [coupe("a", "reprise", 1, 2), coupe("b", "silence", 3, 4), coupe("c", "fin", 8, 10)];
  it("retire les coupes rétablies, garde l'ordre", () => {
    expect(coupesAppliquees(coupes, ["b"]).map((c) => c.id)).toEqual(["a", "c"]);
    expect(coupesAppliquees(coupes, ["a", "c"]).map((c) => c.id)).toEqual(["b"]);
  });
  it("sans rétablissement ou avec un id inconnu : tout est gardé, entrée intacte", () => {
    const copie = structuredClone(coupes);
    expect(coupesAppliquees(coupes)).toEqual(coupes);
    expect(coupesAppliquees(coupes, ["zzz"])).toHaveLength(3);
    expect(coupesAppliquees([], ["a"])).toEqual([]);
    expect(coupes).toEqual(copie);
  });
});

describe("versPrise", () => {
  const gardes = [{ debutSec: 0, finSec: 2 }, { debutSec: 5, finSec: 8 }];
  it("convertit un instant du montage en instant de la prise", () => {
    expect(versPrise(1, gardes)).toBe(1);
    expect(versPrise(2, gardes)).toBe(2);
    expect(versPrise(3, gardes)).toBe(6);
    expect(versPrise(5, gardes)).toBe(8);
  });
  it("bords : au-delà de la fin, négatif, aucun passage gardé", () => {
    expect(versPrise(99, gardes)).toBe(8);
    expect(versPrise(-4, [{ debutSec: 3, finSec: 5 }])).toBe(3);
    expect(versPrise(4, [])).toBe(0);
  });
});

describe("recalerCoupesDemandees", () => {
  const mots = [m("un", 0, 1), m("deux", 1.2, 2), m("trois", 2.5, 3)];
  it("déplace chaque borne vers le milieu du blanc le plus proche (≤ 0,4 s) et garde les autres champs", () => {
    const sortie = recalerCoupesDemandees([{ id: "x", debutSec: 1.0, finSec: 2.3 }], mots);
    expect(sortie).toEqual([{ id: "x", debutSec: 1.1, finSec: 2.25 }]);
  });
  it("laisse une borne sans blanc assez près, et n'altère pas l'entrée", () => {
    const entree = [{ debutSec: 5, finSec: 6 }];
    const copie = structuredClone(entree);
    expect(recalerCoupesDemandees(entree, mots)).toEqual([{ debutSec: 5, finSec: 6 }]);
    expect(entree).toEqual(copie);
  });
  it("une coupe qui deviendrait vide est laissée telle quelle ; sans mot, rien ne bouge", () => {
    const c = { debutSec: 1.0, finSec: 1.15 };
    expect(recalerCoupesDemandees([c], mots)).toEqual([{ debutSec: 1.0, finSec: 1.15 }]);
    expect(recalerCoupesDemandees([c], [])).toEqual([c]);
    expect(recalerCoupesDemandees([], mots)).toEqual([]);
  });
  it("les mots reçus dans le désordre donnent le même résultat", () => {
    const desordre = [mots[2], mots[0], mots[1]];
    expect(recalerCoupesDemandees([{ debutSec: 1.0, finSec: 2.3 }], desordre)).toEqual([{ debutSec: 1.1, finSec: 2.25 }]);
  });
});

describe("resumeCoupes", () => {
  const plan = {
    dureeSourceSec: 131,
    coupes: [coupe("a", "reprise", 10, 20), coupe("b", "consigne", 40, 50), coupe("c", "hesitation", 60, 61)],
  };
  it("compte les passages (hésitations et silences à part) et les durées avant/après", () => {
    expect(resumeCoupes(plan)).toBe("2 passages retirés, 2:11 devient 1:50");
  });
  it("une coupe rétablie ne compte plus ; singulier à 1 et à 0", () => {
    expect(resumeCoupes(plan, ["b"])).toBe("1 passage retiré, 2:11 devient 2:00");
    expect(resumeCoupes({ dureeSourceSec: 120, coupes: [coupe("s", "silence", 30, 32)] })).toBe("0 passage retiré, 2:00 devient 1:58");
  });
  it("secondes arrondies à 60 : affichées 59", () => {
    expect(resumeCoupes({ dureeSourceSec: 59.6, coupes: [] })).toBe("0 passage retiré, 0:59 devient 0:59");
  });
});

describe("texteSousTitresGardes", () => {
  const mots = [m("bonjour", 0, 0.5), m("à", 0.5, 1), m("tous", 1, 2)];
  const plan = () => ({
    phrases: [{ index: 0, texte: "Bonjour à tous.", debutSec: 0, finSec: 2 }],
    gardes: [{ debutSec: 0, finSec: 2 }],
  });
  it("phrase entièrement gardée : le texte du fondateur tel quel", () => {
    expect(texteSousTitresGardes(plan(), mots)).toBe("Bonjour à tous.");
  });
  it("phrase entamée par une coupe : seulement les mots encore gardés ; gardes passés en argument prioritaires", () => {
    expect(texteSousTitresGardes(plan(), mots, [{ debutSec: 0, finSec: 1 }])).toBe("bonjour à");
  });
  it("aucun passage gardé : texte vide", () => {
    expect(texteSousTitresGardes(plan(), mots, [])).toBe("");
    expect(texteSousTitresGardes({ phrases: [], gardes: [] }, [])).toBe("");
  });
  it("mot gardé hors phrase repris de la transcription, hésitation ignorée, entrée non modifiée", () => {
    const p = { phrases: [{ index: 0, texte: "Bonjour à tous.", debutSec: 0, finSec: 2 }], gardes: [{ debutSec: 0, finSec: 10 }] };
    const tous = [...mots, m("euh", 5, 5.5), m("super", 6, 6.5)];
    const copieP = structuredClone(p);
    const copieM = structuredClone(tous);
    expect(texteSousTitresGardes(p, tous)).toBe("Bonjour à tous. super");
    expect(p).toEqual(copieP);
    expect(tous).toEqual(copieM);
  });
});
