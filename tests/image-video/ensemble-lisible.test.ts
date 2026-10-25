/**
 * Vue d'ensemble LISIBLE · défaut D3 de la vidéo v-0339175a9f88 (25/10/2026, compositions-iv/11) : 12 blocs + la rangée des
 * chiffres-clés faisaient 8 rangées à ~13 px d'écart ; avec l'ombre et le halo, les blocs se mordaient. Règle : au moins 16 px
 * entre deux rangées de blocs (les chiffres-clés qui ne tiennent pas avec cet écart sont retirés, avec une alerte), tous les
 * libellés au plancher, aucune boîte hors de la zone, et le plan renvoie l'écart posé (`ecart`) pour que le rendu dose
 * ombre, halo et grossissement.
 */
import { describe, expect, it } from "vitest";
import type { SchemaEntree } from "@/briques/schema-motion";
import { PLANCHER_PX, planEnsemble, ZONE_OBJETS_IV } from "../../studio-rendu/compositions/image-video/plan-objets";

const noeud = (id: string, libelle: string, ordre: number, groupe?: string): SchemaEntree["noeuds"][number] => ({ id, libelle, role: "etape", couleur: groupe === "gb" ? "noir" : "orange", ordre, groupe });
const LIB_A = ["Demande reçue", "Tri fait", "Devis prêt", "Réponse envoyée", "Dossier classé"];
const LIB_B = ["Cas repéré", "Alerte envoyée", "Humain prévenu", "Réponse relue", "Dossier suivi"];
const schemaDense = (): SchemaEntree => {
  const noeuds = [
    noeud("t1", "Message client", 0),
    noeud("t2", "Chatbot IA", 1),
    ...LIB_A.map((l, i) => noeud(`a${i}`, l, 2 + i, "ga")),
    ...LIB_B.map((l, i) => noeud(`b${i}`, l, 7 + i, "gb")),
  ];
  const liens: SchemaEntree["liens"] = [
    { id: "l0", de: "t1", vers: "t2", couleur: "neutre" },
    { id: "la", de: "t2", vers: "a0", couleur: "orange" },
    { id: "lb", de: "t2", vers: "b0", couleur: "noir" },
    ...[1, 2, 3, 4].map((i) => ({ id: `la${i}`, de: `a${i - 1}`, vers: `a${i}`, couleur: "orange" as const })),
    ...[1, 2, 3, 4].map((i) => ({ id: `lb${i}`, de: `b${i - 1}`, vers: `b${i}`, couleur: "noir" as const })),
  ];
  return {
    noeuds,
    liens,
    groupes: [
      { id: "ga", sorte: "branche", noeuds: LIB_A.map((_, i) => `a${i}`), majoritaire: true },
      { id: "gb", sorte: "branche", noeuds: LIB_B.map((_, i) => `b${i}`) },
    ],
  };
};

describe("vue d'ensemble · 12 blocs + chiffres-clés (D3)", () => {
  const p = planEnsemble(schemaDense(), { chiffresCles: ["23h14", "80 %", "4 sec"] });

  it("les 12 blocs sont présents, libellés au plancher ou au-dessus, aucune boîte hors de la zone", () => {
    expect(p.blocs).toHaveLength(12);
    for (const b of p.blocs) {
      expect(b.libelle.taille, b.id).toBeGreaterThanOrEqual(PLANCHER_PX - 1e-6);
      expect(b.y, b.id).toBeGreaterThanOrEqual(ZONE_OBJETS_IV.y - 1e-6);
      expect(b.y + b.hauteur, b.id).toBeLessThanOrEqual(ZONE_OBJETS_IV.y + ZONE_OBJETS_IV.hauteur + 1e-6);
    }
    for (const c of p.chiffres) {
      expect(c.y).toBeGreaterThanOrEqual(ZONE_OBJETS_IV.y - 1e-6);
      expect(c.y + c.hauteur).toBeLessThanOrEqual(ZONE_OBJETS_IV.y + ZONE_OBJETS_IV.hauteur + 1e-6);
    }
  });

  it("au moins 16 px entre deux rangées de blocs, et le plan renvoie cet écart", () => {
    const lignes = [...new Set(p.blocs.map((b) => b.y))].sort((a, b) => a - b);
    expect(lignes.length).toBeGreaterThan(4);
    lignes.slice(1).forEach((y, k) => {
      const dessus = Math.max(...p.blocs.filter((b) => b.y === lignes[k]).map((b) => b.y + b.hauteur));
      expect(y - dessus, `entre les rangées ${k} et ${k + 1}`).toBeGreaterThanOrEqual(16 - 1e-6);
    });
    expect(p.ecart).toBeGreaterThanOrEqual(16);
  });
});
