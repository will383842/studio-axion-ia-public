/** Lot C : la légende relue par la personne est reportée sur le créneau ; le texte automatique n'est jamais copié. Doublures, aucun appel réel. */
import { describe, expect, it, vi } from "vitest";
import type { Depot, JournalDecalage } from "@/domaine/depots";
import type { Publication } from "@/domaine/types";
import type { Visuel } from "@/domaine/visuels/visuel";
import type { CreneauPlan } from "@/services/plan-editorial";
import type { DepotsPasserelle } from "@/services/plan-vers-publication";
import { programmerEnUnClic } from "@/components/visuels/BoutonProgrammerVisuel";
import { legendesEnregistrees, phraseDuCodeReport, PHRASE_REPORT_REFUSE, reporterLegendeSurCreneau, reseauxACompleter } from "@/services/legende-vers-creneau";

function faux<T extends { id: string }>(): Depot<T> {
  const m = new Map<string, T>();
  return {
    async lister(f) { return [...m.values()].filter((e) => !f || f(e)).map((e) => structuredClone(e)); },
    async obtenir(id) { const e = m.get(id); return e ? structuredClone(e) : null; },
    async trouver(f) { const e = [...m.values()].find(f); return e ? structuredClone(e) : null; },
    async enregistrer(e) { m.set(e.id, structuredClone(e)); return structuredClone(e); },
    async modifier(id, p) { const e = m.get(id); if (!e) throw new Error("absent"); const n = { ...e, ...p }; m.set(id, n); return structuredClone(n); },
  } as Depot<T>;
}
const T0 = "2026-11-20T10:00:00.000Z";
const T1 = "2026-11-20T11:00:00.000Z";

async function programme() {
  const d: DepotsPasserelle = { creneaux: faux<CreneauPlan>(), journal: faux<JournalDecalage>(), publications: faux<Publication>(), visuels: faux<Visuel>() };
  await d.visuels.enregistrer({ id: "vis_1", titre: "Visuel fictif", statut: "valide", reseaux: ["linkedin"] } as unknown as Visuel);
  const { creneauId } = await programmerEnUnClic(d, "vis_1", "2026-11-25", T0);
  return { d, creneauId };
}
/** Doublure de `modifierTexteProgramme` : écrit le texte, version +1, créneau « à valider » (comme le geste réel). */
function modifierDoublure(d: DepotsPasserelle, refus?: string) {
  return vi.fn(async (dem: { creneauId: string; reseau: string; texte: string }) => {
    if (refus) return { ok: false as const, etat: "reste" as const, message: refus };
    const c = (await d.creneaux.obtenir(dem.creneauId))!;
    await d.creneaux.enregistrer({ ...c, statut: "a_valider", valideeLe: undefined, decalages: (c.decalages ?? 0) + 1, textes: { ...(c.textes ?? {}), [dem.reseau]: { texte: dem.texte, premierCommentaire: "" } } } as CreneauPlan);
    return { ok: true as const, etat: "modifie" as const, message: "ok", creneauId: dem.creneauId };
  });
}

describe("legendesEnregistrees", () => {
  it("n'écarte que le texte automatique (simulation) et le vide", async () => {
    const lire = async (r: string) => ({
      linkedin: { texte: "Relue.", le: T0 },
      instagram: { texte: "Auto.", le: T0, simulation: true },
      facebook: { texte: "  ", le: T0 },
    })[r as "linkedin"];
    const t = await legendesEnregistrees(["linkedin", "instagram", "facebook"], lire);
    expect(Object.keys(t)).toEqual(["linkedin"]);
    expect(t.linkedin?.texte).toBe("Relue.");
  });
});

describe("reporterLegendeSurCreneau", () => {
  it("visuel programmé, créneau sans texte : texte écrit, version +1, créneau reprogrammé et revalidé", async () => {
    const { d, creneauId } = await programme();
    const avant = (await d.creneaux.obtenir(creneauId))!;
    const modifier = modifierDoublure(d);
    const r = await reporterLegendeSurCreneau({ passerelle: d, modifierTexte: modifier }, "vis_1", "linkedin", "Ma légende.", T1);
    expect(r).toEqual({ ok: true });
    const c = (await d.creneaux.obtenir(creneauId))!;
    expect(c.textes?.linkedin?.texte).toBe("Ma légende.");
    expect(c.decalages).toBe((avant.decalages ?? 0) + 1);
    expect(c.statut).toBe("programme");
    expect(c.valideeLe).toBe(T1);
    expect(modifier).toHaveBeenCalledTimes(1);
  });
  it("garde refusée : rien n'est changé, la phrase de la garde est rendue", async () => {
    const { d, creneauId } = await programme();
    const avant = await d.creneaux.obtenir(creneauId);
    const r = await reporterLegendeSurCreneau({ passerelle: d, modifierTexte: modifierDoublure(d, "Un brouillon est déjà préparé chez le diffuseur.") }, "vis_1", "linkedin", "Ma légende.", T1);
    expect(r).toEqual({ ok: false, message: "Un brouillon est déjà préparé chez le diffuseur." });
    expect(await d.creneaux.obtenir(creneauId)).toEqual(avant);
  });
  it("rejeu du même texte : aucune écriture", async () => {
    const { d, creneauId } = await programme();
    await reporterLegendeSurCreneau({ passerelle: d, modifierTexte: modifierDoublure(d) }, "vis_1", "linkedin", "Ma légende.", T1);
    const apres = await d.creneaux.obtenir(creneauId);
    const modifier = modifierDoublure(d);
    const r = await reporterLegendeSurCreneau({ passerelle: d, modifierTexte: modifier }, "vis_1", "linkedin", "Ma légende.", T1);
    expect(r).toEqual({ ok: true });
    expect(modifier).not.toHaveBeenCalled();
    expect(await d.creneaux.obtenir(creneauId)).toEqual(apres);
  });
  it("visuel non programmé : rien à reporter, aucune écriture", async () => {
    const d: DepotsPasserelle = { creneaux: faux<CreneauPlan>(), journal: faux<JournalDecalage>(), publications: faux<Publication>(), visuels: faux<Visuel>() };
    await d.visuels.enregistrer({ id: "vis_1", titre: "T", statut: "valide", reseaux: ["linkedin"] } as unknown as Visuel);
    const modifier = vi.fn();
    const r = await reporterLegendeSurCreneau({ passerelle: d, modifierTexte: modifier }, "vis_1", "linkedin", "Texte.", T1);
    expect(r).toEqual({ ok: true });
    expect(modifier).not.toHaveBeenCalled();
  });
});

describe("reprise après une panne", () => {
  it("texte déjà écrit (créneau « a_valider ») mais jamais reprogrammé : le clic suivant termine le travail", async () => {
    const { d, creneauId } = await programme();
    const modifier = modifierDoublure(d);
    // État laissé par la panne : le texte est écrit (version +1, « a_valider »), `programmerEnUnClic` n'a pas abouti.
    await modifier({ creneauId, reseau: "linkedin", texte: "Ma légende." });
    expect((await d.creneaux.obtenir(creneauId))!.statut).toBe("a_valider");
    modifier.mockClear();
    const r = await reporterLegendeSurCreneau({ passerelle: d, modifierTexte: modifier }, "vis_1", "linkedin", "Ma légende.", T1);
    expect(r).toEqual({ ok: true });
    const c = (await d.creneaux.obtenir(creneauId))!;
    expect(c.statut).toBe("programme");
    expect(c.textes?.linkedin?.texte).toBe("Ma légende.");
    expect(modifier).not.toHaveBeenCalled();
  });
});

describe("« à compléter » d'après le créneau vivant", () => {
  it("légende du visuel enregistrée mais créneau sans texte : le réseau reste à compléter", async () => {
    const { d } = await programme();
    const r = await reseauxACompleter(d.creneaux, "vis_1", ["linkedin"], { linkedin: { texte: "Enregistrée mais jamais reportée." } });
    expect(r).toEqual(["linkedin"]);
  });
  it("texte présent sur le créneau : rien à compléter", async () => {
    const { d } = await programme();
    await reporterLegendeSurCreneau({ passerelle: d, modifierTexte: modifierDoublure(d) }, "vis_1", "linkedin", "Ma légende.", T1);
    expect(await reseauxACompleter(d.creneaux, "vis_1", ["linkedin"], {})).toEqual([]);
  });
  it("sans créneau : d'après la légende enregistrée", async () => {
    const d: DepotsPasserelle = { creneaux: faux<CreneauPlan>(), journal: faux<JournalDecalage>(), publications: faux<Publication>(), visuels: faux<Visuel>() };
    expect(await reseauxACompleter(d.creneaux, "vis_1", ["linkedin", "facebook"], { linkedin: { texte: "Ok." } })).toEqual(["facebook"]);
  });
});

describe("code `?report=`", () => {
  it("un code connu rend la phrase du serveur ; un code inconnu ou une phrase forgée ne rend rien", () => {
    expect(phraseDuCodeReport("refus")).toBe(PHRASE_REPORT_REFUSE);
    expect(phraseDuCodeReport("Faux message")).toBeUndefined();
    expect(phraseDuCodeReport(undefined)).toBeUndefined();
  });
});
