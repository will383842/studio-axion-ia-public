/**
 * STYLE « blocs/2 », DÉFAUTS VUS À LA RELECTURE DU 12/10/2026 (planches du moteur) : titres d'étape fixes, vertical
 * rempli (zone sûre du bas à 20 %), texte lisible sur l'orange, aucun cadre vide plus d'une seconde, titre de l'exemple
 * gardé, accroche calée sur les mots. Fiche témoin « Formation » et voix modèle, aucun appel.
 */
import { describe, expect, it } from "vitest";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { REGLAGES_ANIMATION_V2, planifierEcranV2 } from "../../../src/briques/tableau-scene/v2/animation";
import { COULEURS_V2, TEXTES_SUR_ORANGE, contraste, contrasteExige } from "../../../src/briques/tableau-scene/v2/charte";
import { cleMotV2 } from "../../../src/briques/tableau-scene/v2/disposition";
import type { EcranPlace, GeometrieV2 } from "../../../src/briques/tableau-scene/v2/types";
import { IDS_FORMATS_SORTIE, ZONE_VERTICAL_BLOCS_2, zoneSureBlocs2, zoneSureFormat, type IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { EXEMPLES } from "../regles/exemples";
import { ficheFormationCalee, motsFormation } from "./temoin-formation";

const calage = ficheFormationCalee();
const mots = motsFormation();
const mise = (f: IdFormatSortie) => mettreEnPage(calage.fiche, f === "vertical" ? {} : { format: f });

function plans(f: IdFormatSortie) {
  const vus = new Map<string, { ecran: EcranPlace; plan: ReturnType<typeof planifierEcranV2>; g: GeometrieV2 }>();
  for (const p of proprietesScenes({ miseEnPage: mise(f) as unknown as MiseBrique, scenes: calage.fiche.scenes as SceneCalee[], heures: calage.elements, stylo: calage.fiche.stylo, mots })) {
    const v = p.v2!;
    for (const e of v.ecrans) {
      if (vus.has(e.id)) continue;
      vus.set(e.id, { ecran: e, g: v.geometrie, plan: planifierEcranV2({ ecran: e, geometrie: v.geometrie, debutMs: v.temps[e.id].debutMs, finMs: v.temps[e.id].finMs, heures: v.heures, finVoixMs: v.finVoixMs, mots: v.mots, stylo: p.stylo }) });
    }
  }
  return [...vus.values()];
}
const tous = Object.fromEntries(IDS_FORMATS_SORTIE.map((f) => [f, plans(f)])) as Record<IdFormatSortie, ReturnType<typeof plans>>;
const motDit = (cle: string) => mots.find((m) => cleMotV2(m.mot) === cle)!.debutSec * 1000;

describe("1. titres d'étape", () => {
  for (const f of IDS_FORMATS_SORTIE) {
    it(`${f} : le titre principal reste à côté du numéro pendant toute l'étape, les autres lignes dessous et plus petites, rien ne défile`, () => {
      const etapes = tous[f].filter((x) => x.ecran.moment === "etape" && x.ecran.etape);
      expect(etapes.length).toBe(4);
      for (const { ecran, plan } of etapes) {
        expect(ecran.groupes, ecran.id).toBe(1);
        const titres = ecran.textes.filter((t) => /^e\d+#\d/.test(t.id));
        const principal = titres.filter((t) => t.desLArrivee);
        expect(principal.length, `${ecran.id} : titre principal`).toBeGreaterThan(0);
        for (const t of principal) {
          const a = plan.apparitions[t.id];
          expect(a.debutMs, `${ecran.id} « ${t.texte} » là dès l'arrivée`).toBeLessThanOrEqual(plan.debutMs);
          expect(a.sortieMs, `${ecran.id} « ${t.texte} » ne sort jamais`).toBeUndefined();
        }
        const autres = titres.filter((t) => !t.desLArrivee);
        const plusPetit = Math.min(...principal.map((t) => t.taille));
        for (const t of autres) {
          expect(plan.apparitions[t.id].sortieMs, `${ecran.id} « ${t.texte} »`).toBeUndefined();
          expect(t.taille, `${ecran.id} « ${t.texte} » plus petit que le titre`).toBeLessThanOrEqual(plusPetit + 0.5);
          expect(t.y, `${ecran.id} « ${t.texte} » sous le titre`).toBeGreaterThan(Math.min(...principal.map((x) => x.y)));
        }
      }
    });
  }
});

describe("2. vertical rempli", () => {
  it("zone sûre du bas à 20 % pour « blocs/2 » (notée dans la table), 30 % inchangés pour l'ancien style", () => {
    expect(ZONE_VERTICAL_BLOCS_2.bas).toBe(20);
    expect(zoneSureFormat("vertical").bas).toBe(30);
    expect(zoneSureBlocs2("vertical").bas).toBe(20);
    for (const f of ["portrait", "carre", "horizontal"] as const) expect(zoneSureBlocs2(f)).toEqual(zoneSureFormat(f));
    const m = mise("vertical");
    const bande = m.bandeSousTitres.px;
    expect(bande.y + bande.hauteur).toBe(1920 * 0.8);
    expect((bande.y + bande.hauteur / 2) / 1920).toBeGreaterThan(0.72);
    // L'ancien style garde sa bande (zone de la table).
    const ancien = mettreEnPage(Object.values(EXEMPLES)[0]);
    expect(ancien.bandeSousTitres.px.y + ancien.bandeSousTitres.px.hauteur).toBe(Math.round(1920 * 0.7));
  });

  it("vertical : le contenu descend jusqu'à la bande des sous-titres et les titres sont grands", () => {
    const { g } = tous.vertical[0];
    for (const { ecran } of tous.vertical) {
      const bas = Math.max(...ecran.formes.filter((x) => !x.horsZone).map((x) => x.y + x.hauteur), ...ecran.textes.filter((t) => !t.horsContenu).map((t) => t.y + t.hauteur));
      expect(bas, `${ecran.id} : contenu jusque vers la bande`).toBeGreaterThan(g.zoneSure.y + (g.bande.y - g.zoneSure.y) * 0.62);
    }
    const plusGrand = (id: string) => Math.max(...tous.vertical.find((x) => x.ecran.id === id)!.ecran.textes.filter((t) => /^e\d+#\d/.test(t.id)).map((t) => t.taille));
    for (const id of ["s01~e0", "s04~e0", "s05~e0", "s09~e0"]) expect(plusGrand(id), id).toBeGreaterThanOrEqual(100);
    // Constat : ses quatre lignes sont ensemble à l'écran (aucun titre ne défile, relecture 3), donc un peu plus petites.
    expect(plusGrand("s02~e0"), "s02~e0").toBeGreaterThanOrEqual(90);
  });
});

describe("3. lisibilité sur l'orange", () => {
  it("sur l'orange (fond ou bloc), le texte est ivoire franc ou encre, et assez contrasté pour sa taille", () => {
    expect(contraste(COULEURS_V2.ivoireFranc, COULEURS_V2.orange)).toBeGreaterThanOrEqual(4.5);
    let vus = 0;
    for (const f of IDS_FORMATS_SORTIE)
      for (const { ecran, g } of tous[f])
        for (const t of ecran.textes) {
          if (t.fond !== COULEURS_V2.orange) continue;
          vus++;
          expect(TEXTES_SUR_ORANGE, `${f} ${ecran.id} « ${t.texte} »`).toContain(t.couleur);
          expect(contraste(t.couleur, t.fond), `${f} ${ecran.id} « ${t.texte} »`).toBeGreaterThanOrEqual(contrasteExige(t.taille, g.k));
        }
    expect(vus).toBeGreaterThan(20);
  });
});

describe("4. aucun cadre vide plus d'une seconde", () => {
  for (const f of IDS_FORMATS_SORTIE) {
    it(`${f} : premier élément dès l'arrivée de l'écran, cadres d'attente au plus 0,9 s avant leur contenu`, () => {
      for (const { ecran, plan } of tous[f]) {
        const traits = new Map(plan.traits.map((t) => [t.id, t.debutMs]));
        for (const x of ecran.formes) {
          if (!x.attend) continue;
          const vise = plan.apparitions[x.attend]?.debutMs ?? traits.get(x.attend);
          expect(vise, `${ecran.id} ${x.id} attend ${x.attend}`).toBeDefined();
          expect(vise! - plan.apparitions[x.id].debutMs, `${f} ${ecran.id} ${x.id}`).toBeLessThanOrEqual(REGLAGES_ANIMATION_V2.attenteCadreMs + 1);
        }
        const premier: Record<string, string> = { etape: "#c0", liste: "#l0", semaine: "#j0", exemple: "#av" };
        const id = premier[ecran.gabarit];
        if (id && ecran.formes.some((x) => x.id === `${ecran.id}${id}`)) expect(plan.apparitions[`${ecran.id}${id}`].debutMs - plan.debutMs, `${f} ${ecran.id}${id}`).toBeLessThanOrEqual(300);
      }
    });
  }
});

describe("5. exemple", () => {
  for (const f of IDS_FORMATS_SORTIE) {
    it(`${f} : « UN ARTISAN » reste à l'écran avec « et ses relances de devis »`, () => {
      const { ecran, plan } = tous[f].find((x) => x.ecran.id === "s09~e0")!;
      expect(ecran.gabarit).toBe("exemple");
      const titre = ecran.textes.filter((t) => t.source === "e25");
      expect(titre.map((t) => t.texte).join(" ")).toBe("UN ARTISAN");
      for (const t of titre) expect(plan.apparitions[t.id].sortieMs).toBeUndefined();
      expect(ecran.textes.some((t) => t.source === "e26")).toBe(true);
    });
  }
});

describe("6. accroche calée sur les mots", () => {
  for (const f of IDS_FORMATS_SORTIE) {
    it(`${f} : « LAISSÉ TOMBER » claque en bloc orange plein sur « laissé », les trois croix sur « trois fois »`, () => {
      const { ecran, plan } = tous[f].find((x) => x.ecran.id === "s01~e0")!;
      const blocs = ecran.formes.filter((x) => x.sorte === "bloc" && x.source === "e04");
      expect(blocs.length).toBeGreaterThan(0);
      for (const b of blocs) {
        expect(b.remplissage).toBe(COULEURS_V2.orange);
        expect(Math.abs(plan.apparitions[b.id].debutMs - motDit("laisse"))).toBeLessThanOrEqual(80);
        expect(plan.apparitions[b.id].entree).toBe("claque");
      }
      const croix = plan.traits.filter((t) => t.id.includes("#croix"));
      expect(croix.length).toBe(3);
      const trois = motDit("trois");
      const finFois = mots.find((m) => cleMotV2(m.mot) === "fois")!.finSec * 1000;
      for (const c of croix) {
        expect(c.debutMs).toBeGreaterThanOrEqual(trois);
        expect(c.debutMs).toBeLessThanOrEqual(finFois + 300);
      }
      // Le bloc « 3 FOIS » n'est jamais coupé entre deux rangées.
      const trois3 = ecran.textes.find((t) => t.source === "e01" && t.texte === "3")!;
      const fois = ecran.textes.find((t) => t.source === "e01" && t.texte === "FOIS")!;
      expect(fois.y).toBe(trois3.y);
    });
  }
});
