/**
 * FIX-OBJETS-CC-PLACE-v21u (C9-42) : les petits objets du cas concret ne recouvrent JAMAIS un texte de l'écran. Le titre se pose dans
 * la moitié haute de la zone utile, l'objet dans la moitié basse ; sinon l'objet n'est pas posé. Aucun rendu réel, 0 € : plans par
 * règles fixes (`adapterPlan` sans `appeler`), boîtes calculées par `disposer`, HTML par `renderToStaticMarkup`.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { disposer, proprietesEcrans, type EcranCale, type ProprietesEcran } from "@/briques/ecrans-motion";
import { adapterPlan } from "@/briques/plan-scenes-generateurs/adaptateur";
import { enMillisecondes, segmenterEnPhrases } from "@/briques/plan-scenes-generateurs/video";
import { ImagePlan, type PlanZoneObjets } from "@/briques/plan-scenes/rendu";
import type { MotMinute, PlanValide } from "@/briques/plan-scenes/schema";
import { seChevauchent, type Rectangle } from "@/briques/plan-scenes/zones";
import { FORMAT_PLAN_CAS_CONCRET } from "@/moteurs/montage-cas-concret/plan-scenes";
import { boiteDessinee, HAUTEUR_MIN_OBJETS, MARGE_OBJETS, reserverZoneObjets } from "@/moteurs/montage-cas-concret/reserve-objets";

// Les 3 textes et les 4 objets du témoin (recopiés de studio-rendu/scripts/temoin-objets-cas-concret.ts:20-27), mots de 400 ms.
const TEXTES = [
  "Ce mois-ci, nous avons envoyé 38 devis. Résultat : 12 clients de plus qu'en septembre.",
  "Bonjour à tous. Je voudrais vous parler de notre façon de travailler avec les artisans de la région. Première étape. Nous écoutons chaque client avec attention avant de proposer quoi que ce soit. Le chantier est terminé, c'est fait.",
  "Bonjour à tous. Voilà ce que nous faisons pour vous : d'abord écouter, puis ensuite proposer, enfin livrer. Le chantier est terminé, c'est fait. Merci.",
];
const OBJETS = ["objet-gros-chiffre", "objet-etape", "objet-cartes-coche", "objet-coche"];
const LIGNES = [["Ce mois-ci,", "*38 devis.*"], ["Notre façon", "de *travailler.*"], ["Ce que nous", "*faisons.*"]];
// Recopiés de studio-rendu/compositions/cas-concret/exemples.ts:9,12 (aucun import de studio-rendu : chemin et Remotion évités).
const ZONE_QUATRE_RESEAUX = { haut: 14, droite: 18, bas: 30, gauche: 6 };
const BANDE = 0.08;
const HAUTEUR_IMAGE = 1920;

const mots = (t: string): MotMinute[] =>
  enMillisecondes(t.split(/\s+/).filter(Boolean).map((x, i) => ({ texte: x, debutSec: (i * 400) / 1000, finSec: ((i + 1) * 400) / 1000 })));
async function plan(texte: string, objetsPermis: string[]): Promise<PlanValide> {
  const r = await adapterPlan({ generateur: "cas-concret", script: texte, segments: segmenterEnPhrases(mots(texte)), format: FORMAT_PLAN_CAS_CONCRET, facecam: false, ...(objetsPermis.length ? { objetsPermis } : {}) });
  if (!r.plan) throw new Error("plan vide");
  return r.plan;
}
function ecran(contenu: Record<string, unknown>, planScenes?: PlanValide, extra: Record<string, unknown> = {}): ProprietesEcran {
  const e = proprietesEcrans({ ecrans: [{ id: "e01", fond: "ivoire", debutMs: 0, finMs: planScenes?.dureeMs ?? 6000, evenements: [], ...contenu } as unknown as EcranCale], captures: {}, zoneProtegee: ZONE_QUATRE_RESEAUX, bandeSousTitres: BANDE })[0];
  return { ...e, ...(planScenes ? { planScenes } : {}), ...extra } as ProprietesEcran;
}
const titre = (i: number, p: PlanValide) => ecran({ type: "titre", lignes: LIGNES[i] }, p);
const scenesObjets = (p: ProprietesEcran) => (p.planScenes?.scenes ?? []).filter((s) => s.niveau === 1 && s.piece.startsWith("objet-"));
const zoneObjetsDe = (p: ProprietesEcran) => (p.planScenes as PlanZoneObjets).zoneObjets!;

describe("FIX-OBJETS-CC-PLACE-v21u · les objets ne recouvrent jamais un texte", () => {
  it("(a) garde par MESURE DES BOÎTES : sur les 3 textes du témoin, chaque objet dessiné a une intersection VIDE avec chaque texte (marque, titre-1, titre-2)", async () => {
    let objets = 0;
    for (const [i, texte] of TEXTES.entries()) {
      const r = reserverZoneObjets(titre(i, await plan(texte, OBJETS)));
      const textes = disposer(r).textes;
      expect(textes.map((t) => t.nom)).toEqual(["marque", "titre-1", "titre-2"]);
      for (const s of scenesObjets(r)) {
        const dessinee = boiteDessinee(s.piece, zoneObjetsDe(r));
        objets += 1;
        for (const t of textes) {
          expect(seChevauchent(dessinee, t.boite), `texte ${i + 1} · ${s.piece} × ${t.nom}`).toBe(false);
          expect(dessinee.y - (t.boite.y + t.boite.hauteur), `texte ${i + 1} · ${s.piece} × ${t.nom}`).toBeGreaterThanOrEqual(MARGE_OBJETS * HAUTEUR_IMAGE - 1);
        }
      }
    }
    expect(objets).toBe(5); // gros chiffre ; étape, coche ; cartes à coche, coche (le compteur n'est pas un objet : constat hors fiche)
  });

  it("(b) les 4 objets restent posés sur les 3 textes (aucun retrait) : 1 + 2 + 2 scènes objet-*", async () => {
    const comptes: string[][] = [];
    for (const [i, texte] of TEXTES.entries()) {
      const avant = titre(i, await plan(texte, OBJETS));
      const apres = reserverZoneObjets(avant);
      expect(scenesObjets(apres).length, `texte ${i + 1}`).toBe(scenesObjets(avant).length);
      comptes.push(scenesObjets(apres).map((s) => s.piece));
    }
    expect(comptes.map((c) => c.length)).toEqual([1, 2, 2]);
    expect(new Set(comptes.flat())).toEqual(new Set(OBJETS));
  });

  it("(c) l'objet reste dans la zone utile d'ORIGINE : la bande des sous-titres reste libre", async () => {
    for (const [i, texte] of TEXTES.entries()) {
      const avant = titre(i, await plan(texte, OBJETS));
      const r = reserverZoneObjets(avant);
      const bas = avant.zone.y + avant.zone.hauteur;
      expect(bas).toBeCloseTo(1190.4, 1);
      for (const s of scenesObjets(r)) {
        const d = boiteDessinee(s.piece, zoneObjetsDe(r));
        expect(d.y + d.hauteur, `texte ${i + 1} · ${s.piece}`).toBeLessThanOrEqual(bas + 0.01);
        expect(d.x).toBeGreaterThanOrEqual(avant.zone.x - 0.01);
        expect(d.x + d.largeur).toBeLessThanOrEqual(avant.zone.x + avant.zone.largeur + 0.01);
      }
    }
  });

  it("(d) l'objet reste lisible : gros chiffre et cartes à coche ≥ 0,15 × 1920 de haut ; titre-2 ≥ 0,6 × sa taille d'avant", async () => {
    for (const [i, texte] of TEXTES.entries()) {
      const avant = titre(i, await plan(texte, OBJETS));
      const r = reserverZoneObjets(avant);
      for (const s of scenesObjets(r).filter((x) => x.piece === "objet-gros-chiffre" || x.piece === "objet-cartes-coche")) {
        expect(boiteDessinee(s.piece, zoneObjetsDe(r)).hauteur, `texte ${i + 1} · ${s.piece}`).toBeGreaterThanOrEqual(HAUTEUR_MIN_OBJETS * HAUTEUR_IMAGE - 0.01);
      }
      const t2 = (e: ProprietesEcran) => disposer(e).textes.find((t) => t.nom === "titre-2")!.tailleRendue;
      expect(t2(r), `texte ${i + 1}`).toBeGreaterThanOrEqual(0.6 * t2(avant));
    }
  });

  it("(e) le rendu suit la zone réservée ; sans zoneObjets, HTML identique à celui d'un plan sans le champ", async () => {
    const r = reserverZoneObjets(titre(0, await plan(TEXTES[0], OBJETS)));
    const zone = zoneObjetsDe(r);
    const tranche = r.planScenes as PlanZoneObjets;
    const objet = scenesObjets(r)[0];
    const image = Math.round((((objet.debutMs + objet.finMs) / 2) * tranche.format.fps) / 1000);
    const html = renderToStaticMarkup(ImagePlan({ plan: { ...tranche, facecam: true } as PlanValide, image }) as never);
    const style = `left:${zone.x}px;top:${zone.y}px;width:${zone.largeur}px;height:${zone.hauteur}px`;
    expect(html).toContain(style);
    const { zoneObjets: _z, ...sansChamp } = tranche;
    void _z;
    const sans = renderToStaticMarkup(ImagePlan({ plan: { ...sansChamp, facecam: true } as PlanValide, image }) as never);
    expect(sans).not.toContain(style);
    expect(renderToStaticMarkup(ImagePlan({ plan: { ...sansChamp, facecam: true, zoneObjets: undefined } as PlanValide, image }) as never)).toBe(sans);
  });

  it("(f) sans objet, rien ne change : même référence pour un écran sans tranche et pour une tranche sans scène objet-*", async () => {
    const sansTranche = ecran({ type: "titre", lignes: LIGNES[0] });
    expect(reserverZoneObjets(sansTranche)).toBe(sansTranche);
    const sansObjet = titre(0, await plan(TEXTES[0], []));
    expect(scenesObjets(sansObjet)).toHaveLength(0);
    expect(reserverZoneObjets(sansObjet)).toBe(sansObjet);
  });

  it("(g) jamais d'objet sur un texte, sinon pas d'objet : un écran de CHAQUE type, puis une mise en page L6 retire les objets", async () => {
    // Recopiés de studio-rendu/compositions/cas-concret/exemples.ts:14-28.
    const CONTENUS: Record<string, unknown>[] = [
      { type: "accroche", etiquette: "Recrutement · cas réel", lignes: ["On recrute", "nos collaborateurs", "*en…*"] },
      { type: "chiffre", nombre: 15, unite: "minutes.", pastilles: ["0 CV à trier", "0 relance", "0 papier"], compteur: false },
      { type: "liste-avant", etiquette: "Avant", titre: "C'était *ça.*", taches: ["Trier les candidatures", "Répondre à chacun", "Relancer", "Caler un rendez-vous"], total: { valeur: "+1 H", ligne: "pour chaque personne" } },
      { type: "titre", lignes: ["Alors on a", "tout *automatisé.*"] },
      { type: "etape", numero: 2, nombreEtapes: 6, titre: "L'*inscription*", ligne: "Toute seule. En vingt secondes.", visuel: { objet: "telephone-capture" }, puces: ["Inscrite"] },
      { type: "objet", titre: "Elle *oublie ?*", ligne: "Le rappel part tout seul.", visuel: { objet: "telephone-notification", textes: ["Rappel : notre échange demain à 14:00"] } },
      { type: "preuve", etiquette: "Et les données ?", titre: "Conforme *RGPD.*", puces: ["100 % automatique", "0 intervention manuelle"] },
      { type: "resultat", etiquette: "Résultat", titre: "Des heures *gagnées.*", avant: "+1 H", maintenant: "15 MIN", ligne: "à chaque recrutement" },
      { type: "question", lignes: ["Et dans votre", "*entreprise ?*"], question: "Quelle tâche pourrait tourner toute seule ?" },
      { type: "appel-mot", etiquette: "Pour la recevoir", invite: "Écrivez", mot: "IA", suite: "en *commentaire.*" },
      { type: "promesse", invite: "On vous envoie", cadeau: "*toute la structure*", ligne: "de cette automatisation, à mettre en place chez vous" },
      { type: "lien", titre: "Le lien est en commentaire", lien: "Diagnostic gratuit · lien en commentaire", signature: "Axion-*IA*" },
    ];
    expect(CONTENUS.map((c) => c.type)).toHaveLength(12);
    const p = await plan(TEXTES[0], OBJETS);
    let poses = 0;
    for (const c of CONTENUS) {
      const r = reserverZoneObjets(ecran(c, p));
      if (scenesObjets(r).length === 0) continue;
      poses += 1;
      const textes = disposer(r).textes;
      for (const s of scenesObjets(r)) for (const t of textes) expect(seChevauchent(boiteDessinee(s.piece, zoneObjetsDe(r)), t.boite), `${String(c.type)} · ${s.piece} × ${t.nom}`).toBe(false);
    }
    expect(poses).toBeGreaterThanOrEqual(1);
    for (const c of CONTENUS) {
      const r = reserverZoneObjets(ecran(c, p, { jeu: { miseEnPage: "l6-a" } }));
      expect(scenesObjets(r), `L6 · ${String(c.type)}`).toHaveLength(0);
      expect((r.planScenes as PlanZoneObjets | undefined)?.zoneObjets).toBeUndefined();
    }
  });

  it("(h) une zone utile réduite : objets retirés OU zone réservée d'au moins 0,15 × 1920 (jamais d'objet sur un texte)", async () => {
    const e = titre(0, await plan(TEXTES[0], OBJETS));
    const petite = { ...e, zone: { ...e.zone, hauteur: e.zone.hauteur * 0.7 } } as ProprietesEcran;
    const r = reserverZoneObjets(petite);
    expect(scenesObjets(r).length === 0 || zoneObjetsDe(r) !== undefined).toBe(true);
    if (scenesObjets(r).length > 0) {
      const z: Rectangle = zoneObjetsDe(r);
      expect(z.hauteur).toBeGreaterThanOrEqual(HAUTEUR_MIN_OBJETS * HAUTEUR_IMAGE);
    }
  });

  it("(i) se charge hors serveur : ni server-only, ni module de src/moteurs autre que lui-même, ni src/services", () => {
    const source = readFileSync("src/moteurs/montage-cas-concret/reserve-objets.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const importes = [...source.matchAll(/^import[^"]*"([^"]+)"/gm)].map((m) => m[1]);
    expect(importes.length).toBeGreaterThan(0);
    expect(source).not.toMatch(/server-only/);
    expect(importes.filter((i) => /^@\/moteurs\//.test(i) || /^@\/services\//.test(i) || /^\.\.?\//.test(i))).toEqual([]);
    expect(importes.every((i) => /^@\/briques\/(ecrans-motion|plan-scenes)/.test(i))).toBe(true);
  });
});
