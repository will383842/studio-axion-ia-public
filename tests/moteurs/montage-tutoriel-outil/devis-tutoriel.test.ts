/**
 * T-EXT-42 : le devis du tutoriel d'outil, en quantités. Pur : aucun appel, aucun montant.
 */
import { describe, expect, it } from "vitest";
import { accordValide, ENTREE_DEVIS_TUTORIEL, etablirDevis, lireAccordDevis, resteDuDevis, texteDevis, type EntreeDevis } from "@/moteurs/montage-tutoriel-outil/devis-tutoriel";
import { MOTS_PAR_SECONDE } from "@/moteurs/montage-tutoriel-outil/script";

const ROLES = ["analyste", "chef", "maquettiste", "plan", "relecture"].map((id) => ({ id, essaisMax: 2 }));
const PILOTE: EntreeDevis = { roles: ROLES, caracteresScript: 640, texteScript: "Voici le script d'exemple du pilote.", motsScript: 104, voixDejaPayee: false, ratios: ["4:5", "9:16", "1:1"], essai: true };
const MONTANT = /€|\$|EUR|USD|euro|dollar|prix|coût|cout/i;

describe("T-EXT-42 : devis en quantités", () => {
  it("pilote fictif : 10 appels, 640 caractères, secondes attendues, 4 rendus", () => {
    const d = etablirDevis(PILOTE);
    const q = (u: string) => d.lignes.filter((l) => l.unite === u).reduce((s, l) => s + l.quantite, 0);
    expect(q("appel")).toBe(10);
    expect(q("caractere")).toBe(640);
    expect(q("seconde")).toBe(Math.ceil(104 / MOTS_PAR_SECONDE));
    expect(q("rendu")).toBe(4);
    expect(d.version).toBe("devis-tutoriel.v1");
  });

  it("même entrée = même empreinte ; un mot du script, un rôle ou un format changé = autre empreinte", () => {
    const a = etablirDevis(PILOTE).empreinte;
    expect(etablirDevis({ ...PILOTE }).empreinte).toBe(a);
    expect(etablirDevis({ ...PILOTE, texteScript: "Voici le script d'exemple du pilote!" }).empreinte).not.toBe(a);
    expect(etablirDevis({ ...PILOTE, roles: [...ROLES, { id: "x", essaisMax: 0 }] }).empreinte).not.toBe(a);
    expect(etablirDevis({ ...PILOTE, ratios: ["4:5", "9:16"] }).empreinte).not.toBe(a);
  });

  it("voix déjà payée : 0 caractère et 0 seconde", () => {
    const d = etablirDevis({ ...PILOTE, voixDejaPayee: true });
    expect(d.lignes.filter((l) => l.poste === "voix").every((l) => l.quantite === 0)).toBe(true);
  });

  it("accordValide : vrai pour la bonne empreinte, faux sinon ou sans accord", () => {
    const d = etablirDevis(PILOTE);
    expect(accordValide(d, { empreinte: d.empreinte, le: "2026-11-18T10:00:00.000Z" })).toBe(true);
    expect(accordValide(d, { empreinte: "autre", le: "2026-11-18T10:00:00.000Z" })).toBe(false);
    expect(accordValide(d, null)).toBe(false);
  });

  it("lireAccordDevis : lecture tolérante", () => {
    expect(lireAccordDevis({ [ENTREE_DEVIS_TUTORIEL]: { empreinte: "ab", le: "2026-11-18" } })).toEqual({ empreinte: "ab", le: "2026-11-18" });
    for (const mauvais of [undefined, {}, { [ENTREE_DEVIS_TUTORIEL]: 3 }, { [ENTREE_DEVIS_TUTORIEL]: { empreinte: 4, le: "x" } }, { [ENTREE_DEVIS_TUTORIEL]: { empreinte: "", le: "x" } }]) expect(lireAccordDevis(mauvais as never)).toBeNull();
  });

  it("resteDuDevis : égal = ok, +1 = refus, poste nommé", () => {
    const d = etablirDevis(PILOTE);
    expect(resteDuDevis(d, { appelsClaude: 10, caracteresVoix: 640, rendus: 4 })).toEqual({ ok: true });
    const r1 = resteDuDevis(d, { appelsClaude: 11, caracteresVoix: 640, rendus: 4 });
    expect(r1).toMatchObject({ ok: false, poste: "claude" });
    expect(resteDuDevis(d, { appelsClaude: 0, caracteresVoix: 641, rendus: 0 })).toMatchObject({ ok: false, poste: "voix" });
    expect(resteDuDevis(d, { appelsClaude: 0, caracteresVoix: 0, rendus: 5 })).toMatchObject({ ok: false, poste: "rendu" });
  });

  it("aucune sortie ne contient un montant ni un mot d'argent", () => {
    const d = etablirDevis(PILOTE);
    const sorties = [...texteDevis(d), ...texteDevis(etablirDevis({ ...PILOTE, essai: false, voixDejaPayee: true })), ...d.lignes.map((l) => l.libelle)];
    for (const poste of ["claude", "voix", "rendu"] as const) {
      const r = resteDuDevis(etablirDevis({ ...PILOTE, roles: [], caracteresScript: 0, ratios: [] }), { appelsClaude: 1, caracteresVoix: 1, rendus: 1 });
      if (!r.ok) sorties.push(r.message);
      void poste;
    }
    expect(sorties.length).toBeGreaterThan(6);
    for (const s of sorties) expect(s).not.toMatch(MONTANT);
    expect(texteDevis(d)).toEqual(["Claude : 10 appels au plus", "Voix : 640 caractères (environ 40 s)", "Rendus : 1 essai et 3 formats"]);
  });
});
