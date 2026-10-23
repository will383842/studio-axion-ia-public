/**
 * L11 · Écrans v4 tenus À LA SOURCE (décision de la direction) : la mise en scène ne produit plus d'écran que la
 * composition v4 ne sait pas montrer (titre de 3 lignes alors qu'il en montre 2, texte qui ne tient pas). Une ligne
 * de trop ouvre un nouvel écran ; un morceau dit trop long est raccourci aux mots ENTIERS, jamais sur un mot de liaison.
 * Vérifié sur les 7 images du jeu d'essai × les 5 réseaux, par le filet même du rendu (`ecransIrrendables`, `IV_RENDU`).
 * Tout est SIMULÉ : aucun appel payant.
 */
import { describe, expect, it, vi } from "vitest";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { avancerJusquAArretIV, attendWillIV, etatInitialIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { FINS_INTERDITES, type LigneDeTempsIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { ecransIrrendables, scenesDeLaLigne } from "@/services/image-video-rendu";
import { carteFixe, demandeEssai, IMAGES, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

/** Les lignes de temps envoyées au rendu, carte et script validés tels quels. */
async function lignesRendues(nom: (typeof IMAGES)[number]): Promise<LigneDeTempsIV[]> {
  const carte = carteFixe(nom);
  const m = monde();
  const base = outilsSimules(carte, m);
  const lignes: LigneDeTempsIV[] = [];
  const o: OutilsFabricationIV = { ...base, rendre: async (d) => (lignes.push(d.ligne), base.rendre(d)) };
  let e: EtatFabricationIV = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { reseaux: [...RESEAUX_IV] })), o);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
    else if (attendWillIV(e) === "script")
      e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) }), o);
    else break;
  }
  expect(e.refus?.code).not.toBe("IV_RENDU");
  return lignes;
}

/** Dernier mot d'une ligne (coupée aux espaces), balises et ponctuation finale ôtées. */
const dernierMot = (t: string) => (t.replace(/\*/g, "").trim().split(/\s+/).pop() ?? "").replace(/[.,!?:;…]+$/u, "");
/** Mot interdit en fin de ligne : le dernier mot entier (« qu'il », « l' ») ou, après découpe à l'apostrophe, son dernier morceau. */
function finInterdite(t: string): boolean {
  const m = dernierMot(t);
  const morceaux = m.split(/['’]/u).filter(Boolean);
  return FINS_INTERDITES.test(m) || (morceaux.length > 1 || /['’]$/u.test(m)) && FINS_INTERDITES.test(morceaux[morceaux.length - 1] ?? "");
}

describe("fin de ligne interdite (même liste que le moteur)", () => {
  it.each(["Regardez ce que vous", "Il faut penser à", "Tout ce qu'il", "Ce sont les clients aux", "Voici ce que j'", "Elle sait que tu"])("« %s » est refusée", (t) => expect(finInterdite(t)).toBe(true));
  it.each(["Regardez ce que vous faites", "Il faut penser à demain", "Les clients du sud"])("« %s » est admise", (t) => expect(finInterdite(t)).toBe(false));
});

describe("écrans v4 de la mise en scène : jamais plus que ce que la composition sait montrer", () => {
  for (const nom of IMAGES) {
    it(`${nom} × 5 réseaux : aucun écran v4 refusé par le rendu (IV_RENDU), aucune ligne arrêtée sur un mot de liaison`, async () => {
      const lignes = await lignesRendues(nom);
      expect(lignes.length).toBeGreaterThan(0);
      // Toutes les versions des 5 réseaux sont passées au rendu.
      expect([...new Set(lignes.flatMap((l) => l.reseaux))].sort()).toEqual([...RESEAUX_IV].sort());
      for (const ligne of lignes) {
        const scenes = scenesDeLaLigne(ligne, { env: "essai", videoId: "v-essai" });
        expect(ecransIrrendables(scenes)).toEqual([]);
        for (const b of ligne.blocs) {
          if (b.sorte !== "ecran" || !("lignes" in b.ecran)) continue;
          for (const t of b.ecran.lignes) expect(finInterdite(t), `écran ${b.ecran.id} : « ${t} »`).toBe(false);
        }
      }
    });
  }
});
