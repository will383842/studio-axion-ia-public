import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { calculerCoupes, controlerCoupes, recalerCoupesDemandees } from "./index";
import { phrasesDuTexte } from "./texte";

/** Pose les mots d'une phrase régulièrement dans [debut, fin] (le dernier mot finit à `fin`). */
function dire(phrase: string, debut: number, fin: number): MotHorodate[] {
  const mots = phrase.split(/\s+/).filter(Boolean);
  const pas = (fin - debut) / mots.length;
  return mots.map((mot, i) => ({ mot, debutSec: +(debut + i * pas).toFixed(3), finSec: +(i === mots.length - 1 ? fin : debut + (i + 1) * pas - pas * 0.15).toFixed(3) }));
}

const P1 = "Bonjour à tous les amis.";
const P2 = "Nous aidons les artisans chaque jour.";
const P3 = "On le met en place pour vous.";
const SCRIPT = [P1, P2, P3].join(" ");

/** Prise de trois phrases ; le dernier mot (ou le premier) est entendu autrement ; mot dit de 0,6 s. */
function prise(options: { premier?: string; dernier?: string; apres?: boolean } = {}) {
  const p1 = options.premier ? P1.replace("Bonjour", options.premier) : P1;
  const p3 = options.dernier ? P3.replace("vous.", options.dernier) : P3;
  const mots = [...dire(p1, 2, 4.4), ...dire(P2, 5, 8.5), ...dire(p3, 9, 12)];
  const motsDernier = mots.filter((m) => /^(vous|nous|vous\.|nous\.)$/.test(m.mot));
  if (options.apres) mots.push(...dire("Voilà c'est tout.", 13, 14.2));
  return { mots, motDernier: motsDernier[motsDernier.length - 1] ?? mots[mots.length - 1] };
}

const coupeFin = (plan: ReturnType<typeof calculerCoupes>) => plan.coupes.find((c) => c.type === "fin");

describe("GV2-27 · fin et début mal entendus (garderBordsMalEntendus)", () => {
  it("SANS l'option : le dernier mot mal entendu est jeté, mais le contrôle le signale (motsApresLaFin = 1)", () => {
    const { mots, motDernier } = prise({ dernier: "nous." });
    const plan = calculerCoupes({ mots, dureeSec: 15, texteValide: SCRIPT });
    expect(coupeFin(plan)!.debutSec).toBeLessThan(motDernier.finSec);
    expect(controlerCoupes(plan, mots).motsApresLaFin).toBe(1);
  });

  it("AVEC l'option : la fin gardée dépasse la fin du mot mal entendu, plus rien après la fin", () => {
    const { mots, motDernier } = prise({ dernier: "nous." });
    const plan = calculerCoupes({ mots, dureeSec: 15, texteValide: SCRIPT, regles: { garderBordsMalEntendus: true } });
    expect(coupeFin(plan)!.debutSec).toBeGreaterThanOrEqual(motDernier.finSec);
    expect(controlerCoupes(plan, mots).motsApresLaFin).toBe(0);
  });

  it("AVEC l'option : le premier mot mal entendu est gardé", () => {
    const { mots } = prise({ premier: "Bonsoir" });
    const sans = calculerCoupes({ mots, dureeSec: 15, texteValide: SCRIPT });
    const avec = calculerCoupes({ mots, dureeSec: 15, texteValide: SCRIPT, regles: { garderBordsMalEntendus: true } });
    const premierMot = mots[0];
    const debutGarde = (p: typeof sans) => p.gardes[0].debutSec;
    expect(debutGarde(sans)).toBeGreaterThan(premierMot.debutSec);
    expect(debutGarde(avec)).toBeLessThanOrEqual(premierMot.debutSec);
    expect(controlerCoupes(avec, mots).motsApresLaFin).toBe(0);
  });

  it("une phrase ajoutée après le script, après un blanc de 1 s, reste coupée", () => {
    const { mots } = prise({ dernier: "nous.", apres: true });
    const plan = calculerCoupes({ mots, dureeSec: 15, texteValide: SCRIPT, regles: { garderBordsMalEntendus: true } });
    const dernierGarde = plan.gardes[plan.gardes.length - 1];
    expect(dernierGarde.finSec).toBeLessThan(13);
    expect(dernierGarde.finSec).toBeGreaterThanOrEqual(12);
  });

  it("SANS aucune option, la sortie est identique : un objet de réglages tout à faux ne change rien", () => {
    const { mots } = prise({ dernier: "nous.", apres: true });
    const defaut = calculerCoupes({ mots, dureeSec: 15, texteValide: SCRIPT });
    const faux = calculerCoupes({ mots, dureeSec: 15, texteValide: SCRIPT, regles: { garderBordsMalEntendus: false, phrasesParLigne: false, diteAutrementAuxBords: false, bavardageStrict: false } });
    expect(faux).toEqual(defaut);
    expect(phrasesDuTexte("Une phrase.\nUne autre phrase.")).toEqual(["Une phrase.", "Une autre phrase."]);
  });
});

describe("GV2-27 · lignes sans ponctuation (phrasesParLigne, sonde J)", () => {
  const SCRIPT_LIGNES = "Bonjour à tous les amis\nNous aidons les artisans chaque jour\nOn le met en place pour vous";
  const mots = [...dire("Bonjour à tous les amis", 1, 3.5), ...dire("Nous aidons les artisans", 4, 5.4), ...dire("Nous aidons les artisans chaque jour", 6, 9), ...dire("On le met en place pour vous", 9.6, 12.5)];

  it("sans l'option, le script est une seule phrase ; avec l'option, trois phrases sont entendues", () => {
    expect(phrasesDuTexte(SCRIPT_LIGNES)).toHaveLength(1);
    expect(phrasesDuTexte(SCRIPT_LIGNES, { parLigne: true })).toHaveLength(3);
    const plan = calculerCoupes({ mots, dureeSec: 14, texteValide: SCRIPT_LIGNES, regles: { phrasesParLigne: true } });
    expect(plan.phrases).toHaveLength(3);
    expect(plan.phrases.every((p) => p.debutSec !== undefined)).toBe(true);
    // La reprise « Nous aidons les » est coupée, la phrase 2 est gardée en entier.
    expect(plan.phrases[1].debutSec).toBeCloseTo(6, 1);
    expect(plan.coupes.some((c) => c.type === "reprise")).toBe(true);
  });

  it("une ligne qui commence par une minuscule continue la précédente (PDF)", () => {
    expect(phrasesDuTexte("Nous aidons les artisans\nchaque jour\nOn le met en place", { parLigne: true })).toEqual(["Nous aidons les artisans chaque jour", "On le met en place"]);
  });
});

describe("GV2-27 · bavardage strict (sonde A3 G1, vidéo libre)", () => {
  const prise = (extra: MotHorodate[] = []) => [
    ...dire("Top trois des erreurs sur vos devis.", 1, 4),
    ...dire("Vous perdez des clients faute de relance.", 4.3, 7),
    ...dire("Vous perdez des devis chaque semaine sans le savoir.", 7.3, 11),
    ...dire("Voilà, écrivez diagnostic en commentaire.", 11.3, 14),
    ...dire("Stop aux devis perdus.", 14.3, 16),
    ...extra,
  ];
  const texte = (mots: MotHorodate[], regles: Record<string, boolean> = {}) => {
    return { plan: calculerCoupes({ mots, dureeSec: 18, regles }) };
  };
  const gardeLeMot = (plan: ReturnType<typeof calculerCoupes>, t: number) => plan.gardes.some((g) => t >= g.debutSec && t <= g.finSec);

  it("par défaut les phrases réellement dites sont retirées (état d'aujourd'hui)", () => {
    const { plan } = texte(prise());
    expect(gardeLeMot(plan, 2.5)).toBe(false);
    expect(gardeLeMot(plan, 15)).toBe(false);
    expect(gardeLeMot(plan, 12.5)).toBe(false);
    expect(gardeLeMot(plan, 5.5)).toBe(false);
  });

  it("avec bavardageStrict les quatre phrases sont gardées", () => {
    const { plan } = texte(prise(), { bavardageStrict: true });
    expect(gardeLeMot(plan, 2.5)).toBe(true); // « Top trois des erreurs sur vos devis. »
    expect(gardeLeMot(plan, 5.5)).toBe(true); // première des deux phrases à début commun, achevée
    expect(gardeLeMot(plan, 12.5)).toBe(true); // « Voilà, écrivez diagnostic en commentaire. »
    expect(gardeLeMot(plan, 15)).toBe(true); // « Stop aux devis perdus. »
  });

  it("« Ok c'est bon. » suivi d'un blanc reste coupé", () => {
    const mots = [...dire("Ok c'est bon.", 0.5, 1.7), ...dire("Vous perdez des clients faute de relance.", 3, 6), ...dire("Il suffit de nous écrire dès maintenant.", 6.3, 9)];
    const plan = calculerCoupes({ mots, dureeSec: 10, regles: { bavardageStrict: true } });
    expect(gardeLeMot(plan, 1)).toBe(false);
    expect(gardeLeMot(plan, 4)).toBe(true);
  });

  it("« Si vous sentez que… / Si vous sentez que du temps vous échappe. » reste coupé", () => {
    const mots = [...dire("Bonjour à tous les amis.", 1, 3.5), ...dire("Si vous sentez que…", 4, 5.5), ...dire("Si vous sentez que du temps vous échappe.", 5.8, 9), ...dire("Appelez-nous dès demain.", 9.3, 11)];
    const plan = calculerCoupes({ mots, dureeSec: 12, regles: { bavardageStrict: true } });
    expect(gardeLeMot(plan, 4.8)).toBe(false);
    expect(gardeLeMot(plan, 7)).toBe(true);
  });
});

describe("GV2-27 · recalerCoupesDemandees", () => {
  const mots: MotHorodate[] = [
    { mot: "Bonjour", debutSec: 0, finSec: 0.5 },
    { mot: "à", debutSec: 0.6, finSec: 0.8 },
    { mot: "tous", debutSec: 0.9, finSec: 1.3 },
    { mot: "les", debutSec: 3, finSec: 3.3 },
    { mot: "amis", debutSec: 3.5, finSec: 3.9 },
  ];

  it("place une borne tombée dans un mot au milieu du blanc le plus proche", () => {
    const [c] = recalerCoupesDemandees([{ debutSec: 0.7, finSec: 3.15 }], mots);
    expect(c.debutSec).toBeCloseTo(0.55, 3);
    expect(c.finSec).toBeCloseTo(3.4, 3);
  });

  it("laisse une borne sans blanc à 0,4 s ou moins, ne modifie pas l'entrée", () => {
    const entree = [{ debutSec: 1.95, finSec: 3.1, id: "x" }];
    const [c] = recalerCoupesDemandees(entree, mots);
    expect(c.debutSec).toBeCloseTo(2.15, 3);
    expect(entree[0].debutSec).toBe(1.95);
    expect(c.id).toBe("x");
    const [loin] = recalerCoupesDemandees([{ debutSec: 1.6, finSec: 1.7 }], mots);
    expect(loin).toEqual({ debutSec: 1.6, finSec: 1.7 });
  });
});
