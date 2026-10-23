/**
 * Deux faux refus du découpage en scènes (18/10/2026), rejoués sur les vraies réponses du modèle :
 *  A · v-693abee466e1 s08 : la voix dit « vingt-deux heures », l'écrit « 22 h » est juste, mais le contrôle ne lisait pas un nombre composé ;
 *  B · v-365dd2ae67ee s01 : l'accroche tenait, mais la fiche était jugée sans le style de la série (page « ivoire » jamais utilisée).
 * Aucune réécriture du modèle : le contrôle devient exact.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DESSINS } from "@/briques/dessins";
import { decouperEnScenes, jugerFiche, partiesDuDecoupage, type EntreeDecoupage } from "@/moteurs/montage-tableau/decoupage";
import { nombresDits, valeurEnLettres } from "@/moteurs/montage-tableau/fidelite-texte";

type Element = { type: string; preuveId?: string; texte?: string };
type Scene = { id: string; gabarit?: unknown; elements: Element[] };
type Cas = { texteScript: string; motsDouleur: string[] | null; parties: unknown; reponse: { scenes: Scene[]; [cle: string]: unknown } };
const charger = (id: string): Cas => JSON.parse(readFileSync(join(__dirname, "temoins", `decoupage-${id}.json`), "utf8"));

function entreeDe(cas: Cas): EntreeDecoupage {
  const b = cas.reponse as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const preuveIds = new Set<string>();
  for (const s of b.scenes) for (const e of s.elements) if (e.type === "preuve") preuveIds.add(e.preuveId);
  const parties = partiesDuDecoupage(cas.parties);
  return {
    texteScript: cas.texteScript,
    structure: b.structure,
    serie: b.serie,
    douleur: b.douleur,
    gesteMinute: b.gesteMinute,
    preuves: [...preuveIds].map((id) => ({ id, resume: "x" })),
    dessins: DESSINS.map((d) => ({ id: d.id, motsCles: d.motsCles })),
    videoId: b.videoId,
    versionId: b.versionId,
    habillage: b.habillage,
    stylo: b.stylo,
    ratio: b.ratio,
    controle: {
      aujourdhui: "2026-10-18",
      sourcesChiffres: [],
      preuves: [],
      matieres: [...preuveIds].map((id) => ({ id, type: "demonstration", statut: "validee" })),
      ...(cas.motsDouleur ? { motsDouleur: cas.motsDouleur } : {}),
    },
    ...(parties ? { parties } : {}),
  } as EntreeDecoupage;
}

const avecTexte = (cas: Cas, de: string, vers: string): Cas => {
  const c = structuredClone(cas);
  for (const s of c.reponse.scenes) for (const e of s.elements) if (typeof e.texte === "string") e.texte = e.texte.replace(de, vers);
  return c;
};

describe("A · « vingt-deux heures » dit, « 22 h » écrit (v-693abee466e1)", () => {
  const cas = charger("v-693abee466e1");
  it("la fiche du modèle est acceptée, sans réécriture", () => {
    const j = jugerFiche(cas.reponse, entreeDe(cas));
    expect(j.ok ? "ok" : j.refus).toBe("ok");
  });
  it("contre-épreuve : « 23 h » (que la voix ne dit pas) reste refusé, par la règle des chiffres sourcés", () => {
    const c = avecTexte(cas, "22 h", "23 h");
    const j = jugerFiche(c.reponse, entreeDe(c));
    expect(j.ok).toBe(false);
    if (!j.ok) expect(j.refus.some((r) => r.includes("chiffres sourcés") && r.includes("23"))).toBe(true);
  });
  it("contre-épreuve : sans la mention « Exemple illustratif », le chiffre « 22 h » reste refusé par la règle 7", () => {
    const c = structuredClone(cas);
    for (const s of c.reponse.scenes) s.elements = s.elements.filter((e) => e.type !== "mention");
    const j = jugerFiche(c.reponse, entreeDe(c));
    expect(j.ok).toBe(false);
    if (!j.ok) expect(j.refus.some((r) => r.includes("chiffres sourcés") && r.includes("22 h"))).toBe(true);
  });
});

describe("B · accroche de 10 mots jugée dans le style de la série (v-365dd2ae67ee)", () => {
  const cas = charger("v-365dd2ae67ee");
  it("la fiche du modèle est acceptée (le style de la série ne sert qu'à la juger)", () => {
    const j = jugerFiche(cas.reponse, entreeDe(cas));
    expect(j.ok ? "ok" : j.refus).toBe("ok");
    if (j.ok) expect(j.fiche.styleTableau).toBeUndefined();
  });
  it("de bout en bout : un seul appel, aucun refus", async () => {
    const r = await decouperEnScenes(entreeDe(cas), {
      appeler: async () => ({ ok: true, simule: false, donnees: JSON.stringify(cas.reponse), stopReason: "end_turn" }),
      budget: { reserver: async () => ({ ok: true }) },
    } as never);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.appels).toBe(1);
  });
  it("un style inconnu posé par le modèle reste refusé (il n'est pas remplacé en silence)", () => {
    const j = jugerFiche({ ...cas.reponse, styleTableau: "zzz" }, entreeDe(cas));
    expect(j.ok).toBe(false);
  });
  it("un style déjà posé n'est pas écrasé", () => {
    const j = jugerFiche({ ...cas.reponse, styleTableau: "ardoise" }, entreeDe(cas));
    expect(j.ok).toBe(true);
    if (j.ok) expect(j.fiche.styleTableau).toBe("ardoise");
  });
});

describe("nombres dits en lettres", () => {
  it.each([
    ["vingt-deux", 22],
    ["quatre-vingt-dix", 90],
    ["soixante et onze", 71],
    ["dix-sept", 17],
    ["deux cents", 200],
    ["deux mille vingt-six", 2026],
    ["quatre-vingts", 80],
  ])("« %s » = %i", (t, v) => expect(valeurEnLettres(t)).toBe(v));
  it("la fin d'un nombre composé n'est pas relue comme un autre nombre", () => {
    const n = nombresDits("deux cent trois euros");
    expect(n.has("203")).toBe(true);
    expect(n.has("103")).toBe(false);
    expect(nombresDits("quatre vingt dix").has("30")).toBe(false);
    expect(nombresDits("mille neuf cent quatre-vingt-dix").has("190")).toBe(false);
  });
  it("lectures trop larges refusées : « vingt et deux », « vingt-quatre vingt »", () => {
    expect(valeurEnLettres("vingt et deux")).toBeUndefined();
    expect(valeurEnLettres("vingt-quatre vingt")).toBeUndefined();
    expect(valeurEnLettres("vingt et un")).toBe(21);
  });
  it("une suite qui n'existe pas en français n'est pas un nombre", () => {
    expect(valeurEnLettres("deux trois")).toBeUndefined();
    expect(nombresDits("deux trois jours").has("5")).toBe(false);
  });
  it("« jusqu'à vingt-deux heures » donne 22 (et pas 2) ; « une heure » ne donne pas 1", () => {
    const n = nombresDits("Avant, il répondait à ses e-mails jusqu'à vingt-deux heures. Maintenant, vingt minutes.");
    expect(n.has("22")).toBe(true);
    expect(n.has("20")).toBe(true);
    expect(n.has("2")).toBe(false);
    expect(nombresDits("une heure").has("1")).toBe(false);
  });
});
