/**
 * VL-10 : 3 pièces 16:9 de la vidéo longue (intercalaire de chapitre, schéma de flux ramifié, cadre de capture).
 * (a) éteint = identique (consigne, retouche, validation) ; (b) permis : gardées si valides, retirées (jamais l'exemple) sinon ;
 * (c) schémas stricts et disposition du flux ; (d) rendu pur, sans navigateur, ni bleu ni jaune, aucun montant.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CATALOGUE_BRIQUES, IDS_PIECES, pieceLaPlusProche, poserInstantsSurMot } from "@/briques/plan-scenes/catalogue";
import { consignePlan } from "@/briques/plan-scenes/generateur";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { RENDUS_BRIQUES } from "@/briques/plan-scenes/briques";
import { BOITE_FLUX, CAPTURE_16_9, EXEMPLES_LONGUES, IDS_PIECES_LONGUES, TOILES_LONGUES, disposerFluxLarge, fluxTientDansLeCadre, profondeurs, schemaFluxRamifie } from "@/briques/plan-scenes/pieces-longues";
import { estGardee } from "@/briques/plan-scenes/pieces-gardees";
import { TOILES } from "@/briques/plan-scenes/toiles";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { MONTRE_PAR_PIECE } from "@/briques/note-extraits/moments-ecran";
import { consigneRetouche } from "@/services/retouche-chat/comprendre";

const AVANT = readFileSync(new URL("./__fixtures__/consigne-avant-porte.txt", import.meta.url), "utf8");
const RETOUCHE = readFileSync(new URL("./__fixtures__/consigne-retouche-avant-objets.txt", import.meta.url), "utf8");
const MOTS = "Chapitre deux le suivi des stocks".split(" ").map((texte, i) => ({ texte, debutMs: i * 400, finMs: i * 400 + 350 }));
const planAvec = (piece: string, parametres: unknown) => {
  const p = structuredClone(PLAN_DEMO) as unknown as { scenes: Record<string, unknown>[] };
  p.scenes = [{ id: "o", version: 1, mots: { premier: 0, dernier: 5 }, debutMs: 0, finMs: 4000, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, piece, parametres }];
  return p;
};
const FLUX = EXEMPLES_LONGUES["flux-ramifie"];
const rendre = (id: (typeof IDS_PIECES_LONGUES)[number], image: number, parametres: unknown = EXEMPLES_LONGUES[id]) =>
  renderToStaticMarkup(createElement(RENDUS_BRIQUES[id] as never, { image, fps: 25, dureeImages: 250, fond: "ivoire", parametres } as never));

describe("VL-10 : éteint = identique", () => {
  it("les 3 pièces sont inscrites, gardées (PIECES_GARDEES)", () => {
    for (const id of IDS_PIECES_LONGUES) {
      expect(IDS_PIECES).toContain(id);
      expect(estGardee(CATALOGUE_BRIQUES[id] as { id: string; famille: string })).toBe(true);
      expect((CATALOGUE_BRIQUES[id] as { famille: string }).famille).not.toBe("objet");
      expect(TOILES[id]).toEqual(TOILES_LONGUES[id]);
      expect(MONTRE_PAR_PIECE[id]).toBeTruthy();
    }
  });
  it("consigne du plan et consigne de retouche inchangées, sans les 3 pièces", () => {
    expect(consignePlan()).toBe(AVANT);
    expect(consignePlan([])).toBe(AVANT);
    expect(consigneRetouche()).toBe(RETOUCHE);
    for (const id of IDS_PIECES_LONGUES) expect(consignePlan()).not.toContain(id);
    expect(consignePlan(["flux-ramifie"])).toContain("- flux-ramifie (Schéma de flux ramifié)");
  });
  it("sans permission, la pièce demandée par son nom devient une pièce ouverte", () => {
    for (const id of IDS_PIECES_LONGUES) expect(pieceLaPlusProche(id)).not.toBe(id);
    expect(pieceLaPlusProche("cadre-capture", undefined, ["cadre-capture"])).toBe("cadre-capture");
  });
  it("une scène qui les demande sans permission est remplacée, avec remarque", () => {
    for (const id of IDS_PIECES_LONGUES) {
      const r = validerPlan(planAvec(id, EXEMPLES_LONGUES[id]));
      expect(r.plan.scenes[0]!.piece).not.toBe(id);
      expect(r.remarques.some((m) => /objet non permis/i.test(m.message))).toBe(true);
    }
  });
});

describe("VL-10 : permises", () => {
  it("l'exemple de chaque pièce est valide, gardé et jamais réparé", () => {
    for (const id of IDS_PIECES_LONGUES) {
      const ok = validerPlan(planAvec(id, EXEMPLES_LONGUES[id]), { objetsPermis: [id] });
      expect(ok.plan.scenes[0]!.piece).toBe(id);
      const faux = validerPlan(planAvec(id, { faux: true }), { objetsPermis: [id] });
      expect(faux.plan.scenes.some((s) => (s.piece as string) === id)).toBe(false);
    }
  });
  it("les instants des mots sont posés par le code, y compris dans le schéma de flux", () => {
    const sans = { ...FLUX, noeuds: FLUX.noeuds.map((n) => ({ id: n.id, texte: n.texte, humain: n.humain, surMot: n.surMot })) } as unknown;
    const pose = poserInstantsSurMot("flux-ramifie", sans, MOTS, 0) as { noeuds: { surMot: number; aMs?: number }[] };
    expect(pose.noeuds.map((n) => n.aMs)).toEqual([0, 800, 1600, undefined]);
    const chap = poserInstantsSurMot("intercalaire-chapitre", { numero: 2, titre: "Stocks", surMot: 1 }, MOTS, 0) as { aMs?: number };
    expect(chap.aMs).toBe(400);
  });
});

describe("VL-10 : schémas stricts", () => {
  it("intercalaire : numéro de 1 à 99, titre non vide, champ inconnu refusé", () => {
    const s = CATALOGUE_BRIQUES["intercalaire-chapitre"].schema;
    expect(s.safeParse({ numero: 0, titre: "A", surMot: 0 }).success).toBe(false);
    expect(s.safeParse({ numero: 100, titre: "A", surMot: 0 }).success).toBe(false);
    expect(s.safeParse({ numero: 3, titre: " ", surMot: 0 }).success).toBe(false);
    expect(s.safeParse({ numero: 3, titre: "A", surMot: 0, couleur: "x" }).success).toBe(false);
  });
  it("flux : au moins une étape qui se sépare, ni boucle, ni étape inconnue, ni identifiant en double", () => {
    const base = structuredClone(FLUX);
    expect(schemaFluxRamifie.safeParse(base).success).toBe(true);
    expect(schemaFluxRamifie.safeParse({ ...base, liens: base.liens.slice(0, 2) }).success).toBe(false);
    expect(schemaFluxRamifie.safeParse({ ...base, liens: [...base.liens, { de: "z", vers: "a", pointille: false }] }).success).toBe(false);
    expect(schemaFluxRamifie.safeParse({ ...base, liens: [...base.liens, { de: "d", vers: "a", pointille: false }] }).success).toBe(false);
    expect(schemaFluxRamifie.safeParse({ ...base, noeuds: base.noeuds.map((n) => ({ ...n, id: "a" })) }).success).toBe(false);
    expect(schemaFluxRamifie.safeParse({ ...base, noeuds: base.noeuds.slice(0, 2) }).success).toBe(false);
  });
});

describe("VL-10 : disposition du flux ramifié", () => {
  it("l'exemple tient dans le cadre 16:9, de gauche à droite, sans recouvrement", () => {
    const boites = disposerFluxLarge(FLUX.noeuds, FLUX.liens);
    expect(boites).toHaveLength(4);
    expect(fluxTientDansLeCadre(boites)).toBe(true);
    const col = (id: string) => boites.find((b) => b.id === id)!.colonne;
    expect(col("a")).toBe(0);
    expect(col("b")).toBe(1);
    expect(col("c")).toBe(2);
    expect(col("d")).toBe(2);
    expect(boites.find((b) => b.id === "c")!.y).not.toBe(boites.find((b) => b.id === "d")!.y);
  });
  it("8 étapes sur 4 niveaux tiennent aussi", () => {
    const noeuds = "abcdefgh".split("").map((id, i) => ({ id, texte: id, humain: false, surMot: i }));
    const liens = [["a", "b"], ["a", "c"], ["b", "d"], ["c", "e"], ["c", "f"], ["e", "g"], ["f", "h"]].map(([de, vers]) => ({ de: de!, vers: vers!, pointille: false }));
    expect(schemaFluxRamifie.safeParse({ noeuds, liens }).success).toBe(true);
    expect(fluxTientDansLeCadre(disposerFluxLarge(noeuds, liens))).toBe(true);
  });
  it("VERDICT OPUS : chaîne de 7 colonnes et éventail de 7 étapes, valides pour le schéma, ne se chevauchent jamais (refusés)", () => {
    const mk = (ids: string[]) => ids.map((id, i) => ({ id, texte: id, humain: false, surMot: i }));
    const lien = (de: string, vers: string) => ({ de, vers, pointille: false });
    // Chaîne n0→…→n6 plus n0→n7 : 7 colonnes, pas = (1600 − 120 − 300) / 6 < 300 sur 5 colonnes et plus.
    const idsChaine = ["n0", "n1", "n2", "n3", "n4", "n5", "n6", "n7"];
    const chaine = { noeuds: mk(idsChaine), liens: [lien("n0", "n1"), lien("n1", "n2"), lien("n2", "n3"), lien("n3", "n4"), lien("n4", "n5"), lien("n5", "n6"), lien("n0", "n7")] };
    expect(fluxTientDansLeCadre(disposerFluxLarge(chaine.noeuds, chaine.liens))).toBe(false);
    expect(schemaFluxRamifie.safeParse(chaine).success).toBe(false);
    // Éventail n0 → 7 étapes : casier 780 / 7 ≈ 111 < hauteur de boîte 128.
    const idsEv = ["n0", "n1", "n2", "n3", "n4", "n5", "n6", "n7"];
    const eventail = { noeuds: mk(idsEv), liens: idsEv.slice(1).map((id) => lien("n0", id)) };
    expect(fluxTientDansLeCadre(disposerFluxLarge(eventail.noeuds, eventail.liens))).toBe(false);
    expect(schemaFluxRamifie.safeParse(eventail).success).toBe(false);
    // Posé en plan permis : la pièce est retirée, jamais remplacée par l'exemple.
    const retire = validerPlan(planAvec("flux-ramifie", chaine), { objetsPermis: ["flux-ramifie"] });
    expect(retire.plan.scenes[0]!.piece).not.toBe("flux-ramifie");
    // Tout plan accepté tient dans le cadre.
    const quatre = { noeuds: mk(["n0", "n1", "n2", "n3", "n4"]), liens: [lien("n0", "n1"), lien("n0", "n2"), lien("n1", "n3"), lien("n3", "n4")] };
    expect(schemaFluxRamifie.safeParse(quatre).success).toBe(true);
    expect(fluxTientDansLeCadre(disposerFluxLarge(quatre.noeuds, quatre.liens))).toBe(true);
  });
  it("une boucle est détectée, jamais de blocage", () => {
    expect(profondeurs([{ id: "a" }, { id: "b" }], [{ de: "a", vers: "b" }, { de: "b", vers: "a" }])).toBeNull();
    expect(disposerFluxLarge([{ id: "a" }, { id: "b" }], [{ de: "a", vers: "b" }, { de: "b", vers: "a" }])).toHaveLength(2);
  });
  it("la zone de capture est exactement en 16:9", () => {
    expect(CAPTURE_16_9.largeur * 9).toBe(CAPTURE_16_9.hauteur * 16);
    expect(TOILES_LONGUES["cadre-capture"].largeur).toBe(CAPTURE_16_9.largeur + 2 * CAPTURE_16_9.marge);
    expect(TOILES_LONGUES["cadre-capture"].hauteur).toBe(CAPTURE_16_9.hauteur + CAPTURE_16_9.barre + 2 * CAPTURE_16_9.marge);
    expect(BOITE_FLUX.largeur).toBeGreaterThan(0);
  });
});

describe("VL-10 : rendu pur, sans navigateur", () => {
  it("même entrée, même image ; texte seulement celui des paramètres", () => {
    const a = rendre("intercalaire-chapitre", 40);
    expect(a).toBe(rendre("intercalaire-chapitre", 40));
    expect(a).toContain("Le suivi des stocks");
    const f = rendre("flux-ramifie", 200);
    for (const n of FLUX.noeuds) expect(f).toContain(n.texte);
    expect(rendre("cadre-capture", 40)).toContain("Mon logiciel");
  });
  it("le schéma se construit : une étape n'est pas là avant son mot, la flèche la précède", () => {
    expect(rendre("flux-ramifie", 0)).not.toContain("Vous validez");
    const tot = rendre("flux-ramifie", 20);
    expect(tot).toContain("Une demande arrive");
    expect(tot).not.toContain("Le Studio la trie");
    expect(rendre("flux-ramifie", 250)).toContain("data-bloc=\"d\"");
  });
  it("le cadre de capture accueille une capture et marque sa zone 16:9", () => {
    const html = renderToStaticMarkup(createElement(RENDUS_BRIQUES["cadre-capture"] as never, { image: 40, fps: 25, dureeImages: 250, fond: "ivoire", parametres: EXEMPLES_LONGUES["cadre-capture"], enfants: createElement("i", { id: "capture" }) } as never));
    expect(html).toContain('data-zone-capture="16:9"');
    expect(html).toContain('id="capture"');
  });
  it("jamais bleu ni jaune, aucune coche, aucun montant, aucune étiquette interdite", () => {
    for (const id of IDS_PIECES_LONGUES) {
      for (const fond of ["ivoire", "noir"] as const) {
        const html = renderToStaticMarkup(createElement(RENDUS_BRIQUES[id] as never, { image: 250, fps: 25, dureeImages: 250, fond, parametres: EXEMPLES_LONGUES[id] } as never));
        for (const [, r, g, b] of html.matchAll(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})\b/gi).map((m) => m.map((x, i) => (i ? parseInt(x, 16) : x)))) {
          const [R, G, B] = [r, g, b] as number[];
          expect(B! > R! + 40 && B! >= G!, "teinte bleue").toBe(false);
          expect(R! > 200 && G! > 180 && B! < 100, "teinte jaune").toBe(false);
        }
        expect(html).not.toMatch(/[✓✔☑€$]|Douleur|Solution|Exemple|À vous/);
      }
    }
  });
});
