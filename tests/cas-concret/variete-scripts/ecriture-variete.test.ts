/** Écriture du cas concret avec mémoire anti-copie, patrons et exemples de rythme : doubles, aucun appel réel. */
import { describe, expect, it } from "vitest";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { CATALOGUE, trouverCas } from "@/formats/cas-concret/catalogue";
import { recettePour } from "@/formats/cas-concret/recette";
import type { CasConcret } from "@/formats/cas-concret/cas";
import { MEMOIRE_MAX_CARACTERES } from "@/domaine/cas-concret-variete";
import {
  APPELS_ECRITURE_MAX,
  CONSIGNE_ECRITURE,
  EXEMPLE_TON_V4,
  ecrireFiche,
  roleEcritureCasConcret,
  variableEcriture,
  type EntreeEcriture,
} from "@/moteurs/montage-cas-concret/ecriture";
import { EXEMPLES_DE_RYTHME } from "@/moteurs/montage-cas-concret/exemples-ton";
import { texteDuCorps, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import type { OutilsEcriture, ReponseAppelEcriture } from "@/moteurs/montage-cas-concret/outils";
import { validerFicheEcrans } from "@/moteurs/montage-cas-concret/regles";

const FIXE = { videoId: "video-1", versionId: "version-1", habillage: "charte-duo/1", origine: "porte-a" } as const;
const cas: CasConcret = CATALOGUE.find((c) => c.id !== "recrutement-apporteurs") ?? trouverCas("recrutement-apporteurs")!;
const entree = (extra: Partial<EntreeEcriture> = {}): EntreeEcriture => ({ ...FIXE, cas, ...extra });

function ficheSimulee(c: CasConcret): FicheEcrans {
  const sortie = roleEcritureCasConcret.simuler({ contexte: {}, variable: variableEcriture(c, recettePour(c), FIXE) });
  if (typeof sortie === "string") throw new Error("aucune fiche simulée");
  return sortie;
}

interface Double extends OutilsEcriture {
  appels: EntreeRole[];
}
function double(reponses: (FicheEcrans | string)[]): Double {
  const d: Double = {
    appels: [],
    async appeler(_role: DefinitionRole, e: EntreeRole): Promise<ReponseAppelEcriture> {
      d.appels.push(e);
      const r = reponses[d.appels.length - 1];
      if (r === undefined) throw new Error("appel de trop");
      return { ok: true, simule: false, texte: typeof r === "string" ? r : JSON.stringify(r), stopReason: "end_turn" };
    },
    budget: { reserver: async () => ({ ok: true }) },
  };
  return d;
}

const base = ficheSimulee(cas);
const scriptBase = texteDuCorps(base);
const bascule = base.ecrans.find((e) => e.type === "titre")!;
const PHRASE_BASCULE = bascule.texteDit;

/** La même fiche, avec une bascule réécrite (aucun fait ni nombre de plus). */
function avecBascule(texte: string): FicheEcrans {
  const f = structuredClone(base);
  f.ecrans.find((e) => e.id === bascule.id)!.texteDit = texte;
  return f;
}
const NEUVE = "Voyons comment, pas à pas.";

describe("la consigne", () => {
  it("n'envoie plus l'exemple de la v4 seul, mais plusieurs exemples de rythme de sujets inventés", () => {
    expect(CONSIGNE_ECRITURE).not.toContain(EXEMPLE_TON_V4);
    for (const e of EXEMPLES_DE_RYTHME) expect(CONSIGNE_ECRITURE).toContain(e.texte);
    expect(CONSIGNE_ECRITURE).toMatch(/RYTHME/);
    expect(CONSIGNE_ECRITURE).toMatch(/ni leurs mots ni leurs faits/i);
    expect(CONSIGNE_ECRITURE).not.toContain("Oui, quinze minutes");
    expect(CONSIGNE_ECRITURE).not.toContain("Alors on a tout automatisé");
  });

  it("dit à Claude de ne pas reprendre ce qui a déjà servi", () => {
    expect(CONSIGNE_ECRITURE).toMatch(/<deja_dit>/);
    expect(CONSIGNE_ECRITURE).toMatch(/déjà servi dans d'autres vidéos/);
    expect(CONSIGNE_ECRITURE).toMatch(/variantes proches/);
  });
});

describe("la partie variable", () => {
  it("porte la mémoire (plafonnée) et les patrons de la vidéo", async () => {
    const d = double([base]);
    await ecrireFiche(entree({ scriptsAnterieurs: ["Avant, c'était ça : trier les candidatures, répondre à chacun, relancer."] }), d);
    const v = d.appels[0].variable;
    expect(v).toContain("<deja_dit>");
    expect(v).toContain("trier les candidatures");
    expect(v).toContain("<formes_de_la_video>");
    const memoire = /<deja_dit>([\s\S]*?)<\/deja_dit>/.exec(v)![1];
    expect(memoire.length).toBeLessThanOrEqual(MEMOIRE_MAX_CARACTERES + 600);
  });

  it("sans script antérieur : pas de bloc de mémoire", async () => {
    const d = double([base]);
    await ecrireFiche(entree(), d);
    expect(d.appels[0].variable).not.toContain("<deja_dit>");
    expect(d.appels[0].variable).toContain("<formes_de_la_video>");
  });

  it("les formes changent d'une vidéo à l'autre et restent les mêmes pour la même vidéo", async () => {
    const formes = async (videoId: string, reprise?: number) => {
      const d = double([base]);
      await ecrireFiche({ ...entree(), videoId, ...(reprise ? { reprise } : {}) }, d);
      return /<formes_de_la_video>([\s\S]*?)<\/formes_de_la_video>/.exec(d.appels[0].variable)![1];
    };
    expect(await formes("video-1")).toBe(await formes("video-1"));
    const toutes = new Set<string>();
    for (let i = 0; i < 8; i++) toutes.add(await formes(`video-${i}`));
    expect(toutes.size).toBeGreaterThan(5);
  });

  it("la promesse reste exigée dans l'accroche (R03) : la fiche écrite avec les formes passe toujours les règles", () => {
    const v = validerFicheEcrans(base, { cas, texteScript: scriptBase });
    expect(v.ok).toBe(true);
    expect(variableEcriture(cas, recettePour(cas), FIXE)).toContain(`<promesse>${cas.promesse}</promesse>`);
  });
});

describe("le contrôle de similarité", () => {
  it("refuse une reprise, relance UNE fois avec les séquences fautives, puis accepte", async () => {
    const d = double([base, avecBascule(NEUVE)]);
    const r = await ecrireFiche(entree({ scriptsAnterieurs: [PHRASE_BASCULE] }), d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(d.appels).toHaveLength(2);
    expect(r.appels).toBe(2);
    expect(r.relance).toBe(true);
    expect(d.appels[1].variable).toContain("<refus_fiche_precedente>");
    expect(d.appels[1].variable.toLowerCase()).toContain("étape par étape");
    expect(r.notes.join(" ")).not.toMatch(/ressemblance/i);
  });

  it("si la ressemblance reste après la relance : garde le script et le dit dans les notes (jamais d'échec, jamais de 3e appel)", async () => {
    const d = double([base, base]);
    const r = await ecrireFiche(entree({ scriptsAnterieurs: [PHRASE_BASCULE] }), d);
    expect(d.appels).toHaveLength(APPELS_ECRITURE_MAX);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.notes.join(" ")).toMatch(/ressemblance/i);
    expect(r.notes.join(" ").toLowerCase()).toContain("étape par étape");
  });

  it("si la relance est refusée par les règles : garde le premier script valide, avec la note", async () => {
    const d = double([base, "pas du JSON"]);
    const r = await ecrireFiche(entree({ scriptsAnterieurs: [PHRASE_BASCULE] }), d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.notes.join(" ")).toMatch(/ressemblance/i);
  });

  it("ne compte pas la promesse du cas ni ses faits (éléments obligatoires)", async () => {
    const d = double([base]);
    const r = await ecrireFiche(entree({ scriptsAnterieurs: [cas.promesse, ...cas.faits.map((f) => f.enonce)] }), d);
    expect(r.ok).toBe(true);
    expect(d.appels).toHaveLength(1);
  });

  it("sans mémoire, un seul appel, comme avant", async () => {
    const d = double([base]);
    const r = await ecrireFiche(entree(), d);
    expect(r.ok && r.appels).toBe(1);
  });

  it("la simulation d'écriture passe malgré une mémoire", async () => {
    const sim: OutilsEcriture = {
      appeler: async (role, e) => ({ ok: true, simule: true, donnees: role.simuler(e) }) as ReponseAppelEcriture,
      budget: { reserver: async () => ({ ok: true }) },
    };
    const r = await ecrireFiche(entree({ scriptsAnterieurs: [texteDuCorps(ficheSimulee(trouverCas("recrutement-apporteurs")!))] }), sim);
    expect(r.ok).toBe(true);
  });
});
