/**
 * T-EXT-50 · Schéma animé du flux : nœuds, couleurs, mots, caméra. Purs, 0 €.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { VERSION_FLUX, lireFluxAutomatisation, type FluxAutomatisation } from "@/moteurs/montage-tutoriel-outil/gabarit-flux";
import { ENTREE_BLOC_SEC, TRACE_FLECHE_SEC, planSchemaFlux, schemaDepuisFlux, type MotVoixFlux } from "@/moteurs/montage-tutoriel-outil/schema-flux";
import { mesurerTrajectoire } from "@/briques/schema-motion/camera";

/** Contenus complets du bureau exemple (T-EXT-49), lus dans `demo-data.js` : le lecteur refuse désormais des contenus partiels. */
function contenusComplets(): Record<string, unknown> {
  const source = readFileSync(join(process.cwd(), "outils/maquettes-tableaux-de-bord/ecrans-outils/demo-data.js"), "utf8");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- contexte de node:vm
  const ctx: Record<string, any> = {};
  vm.runInNewContext(source, { window: ctx });
  return JSON.parse(JSON.stringify(ctx.DONNEES_ECRANS.contenus));
}

function flux(): FluxAutomatisation {
  const r = lireFluxAutomatisation({
    version: VERSION_FLUX,
    avant: { vue: "boite", etat: "avant", surMot: "déborde" },
    declencheur: { vue: "boite", etat: "nouveau", surMot: "arrive" },
    etapes: [
      { id: "classement", vue: "boite", etat: "etiquete", acteur: "automatisation", libelleSchema: "Classement du message", surMot: "classe" },
      { id: "brouillon", vue: "boite", etat: "brouillon", acteur: "ia", libelleSchema: "Brouillon de réponse", surMot: "brouillon" },
      { id: "validation", vue: "boite", etat: "brouillon", acteur: "humain", libelleSchema: "Vous validez", surMot: "validez" },
      { id: "equipe", vue: "messagerie", etat: "notification", acteur: "automatisation", libelleSchema: "Équipe prévenue", surMot: "équipe" },
    ],
    moments: ["brouillon"],
    resultat: { vue: "crm", etat: "fiche-remplie", surMot: "fiche" },
    contenus: contenusComplets(),
  });
  if (!r.ok) throw new Error(r.erreurs.join(" | "));
  return r.flux;
}

/** Voix : un mot toutes les 0,9 s à partir de 30 s ; le schéma dure de 30 s à 36,5 s. */
const DEBUT = 30_000;
const FIN = 36_500;
const VOIX: MotVoixFlux[] = ["Le", "schéma", "classe", "puis", "rédige", "un", "brouillon", "que", "vous", "validez", "avant", "que", "l'équipe", "soit", "prévenue"].map((texte, i) => ({ texte, debutMs: DEBUT + i * 430 }));
// « équipe » est dit sous la forme « l'équipe » : on le dit seul pour que le mot corresponde.
const VOIX_OK: MotVoixFlux[] = VOIX.map((m) => (m.texte === "l'équipe" ? { ...m, texte: "équipe" } : m));

describe("schemaDepuisFlux", () => {
  it("un nœud par étape, dans l'ordre, libellés du dossier, court ≤ 3 mots", () => {
    const f = flux();
    const s = schemaDepuisFlux(f);
    expect(s.noeuds.map((n) => n.id)).toEqual(f.etapes.map((e) => e.id));
    expect(s.noeuds.map((n) => n.libelle)).toEqual(f.etapes.map((e) => e.libelleSchema));
    expect(s.noeuds.map((n) => n.ordre)).toEqual([0, 1, 2, 3]);
    for (const n of s.noeuds) expect((n.court ?? "").split(" ").length).toBeLessThanOrEqual(3);
    expect(s.noeuds[0]!.court).toBe("Classement du message");
    expect(s.liens.map((l) => [l.de, l.vers])).toEqual([["classement", "brouillon"], ["brouillon", "validation"], ["validation", "equipe"]]);
    expect(s.groupes).toEqual([]);
  });

  it("couleurs ⊆ { noir, neutre } ; l'étape humaine est noire ; lien pointillé vers l'humain", () => {
    const s = schemaDepuisFlux(flux());
    for (const c of [...s.noeuds.map((n) => n.couleur), ...s.liens.map((l) => l.couleur)]) expect(["noir", "neutre"]).toContain(c);
    expect(s.noeuds.find((n) => n.id === "validation")!.couleur).toBe("noir");
    expect(s.noeuds.filter((n) => n.couleur === "noir")).toHaveLength(1);
    expect(s.liens.find((l) => l.vers === "validation")!.style).toBe("pointille");
    expect(s.liens.find((l) => l.vers === "equipe")!.style).toBe("plein");
  });
});

describe("planSchemaFlux", () => {
  it("chaque nœud est allumé au plus tard à son mot, dans l'ordre", () => {
    const p = planSchemaFlux(flux(), VOIX_OK, DEBUT, FIN);
    expect(p.alertes).toEqual([]);
    expect(p.blocs.map((b) => b.id)).toEqual(["classement", "brouillon", "validation", "equipe"]);
    expect(p.blocs.map((b) => b.motSec)).toEqual([2 * 0.43, 6 * 0.43, 9 * 0.43, 12 * 0.43].map((x) => Math.round(x * 1000) / 1000));
    for (const b of p.blocs) {
      expect(b.allumageSec).toBeLessThanOrEqual(b.motSec);
      expect(b.allumageSec).toBeGreaterThanOrEqual(0);
    }
    for (let i = 1; i < p.blocs.length; i++) {
      expect(p.blocs[i]!.motSec).toBeGreaterThanOrEqual(p.blocs[i - 1]!.motSec);
      // La flèche se trace avant l'entrée du bloc qu'elle atteint.
      expect(p.blocs[i]!.traceSec!).toBeLessThanOrEqual(p.blocs[i]!.allumageSec);
    }
    expect(p.blocs[0]!.traceSec).toBeUndefined();
    expect(p.entreeSec).toBe(ENTREE_BLOC_SEC);
    expect(p.traceDureeSec).toBe(TRACE_FLECHE_SEC);
    expect(ENTREE_BLOC_SEC).toBe(0.3);
  });

  it("vitesse de caméra mesurée ≤ 1,2 écran/s", () => {
    const p = planSchemaFlux(flux(), VOIX_OK, DEBUT, FIN, { largeur: 1080, hauteur: 1350 });
    expect(p.trajectoire.images.length).toBeGreaterThan(0);
    expect(mesurerTrajectoire(p.trajectoire).vitesseMax).toBeLessThanOrEqual(1.2 + 1e-9);
  });

  it("un mot introuvable devient une alerte, jamais une exception ni un libellé inventé", () => {
    const p = planSchemaFlux(flux(), [], DEBUT, FIN);
    expect(p.alertes.length).toBeGreaterThanOrEqual(4);
    expect(p.alertes.join(" ")).toMatch(/n'est pas dit/);
    expect(p.blocs.map((b) => b.libelle)).toEqual(flux().etapes.map((e) => e.libelleSchema));
  });

  it("même entrée, même sortie", () => {
    const a = planSchemaFlux(flux(), VOIX_OK, DEBUT, FIN, { largeur: 1080, hauteur: 1350 });
    const b = planSchemaFlux(flux(), VOIX_OK, DEBUT, FIN, { largeur: 1080, hauteur: 1350 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("ne lève jamais, même avec une entrée absurde", () => {
    expect(() => planSchemaFlux(flux(), VOIX_OK, FIN, DEBUT)).not.toThrow();
    expect(() => planSchemaFlux({ etapes: [] } as unknown as FluxAutomatisation, VOIX_OK, DEBUT, FIN)).not.toThrow();
  });
});
