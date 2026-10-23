/**
 * STYLE « blocs/2 », DÉFAUTS RESTANTS DE LA RELECTURE DU 12/10/2026 (passe 3) : écran d'appel plein dès son arrivée,
 * exemple sans moitié de carte vide, aucun titre qui défile (quatre formats, tous gabarits), titres du haut du vertical
 * plus larges sans toucher la colonne de boutons des réseaux. Fiche témoin « Formation » et voix modèle, aucun appel.
 */
import { describe, expect, it } from "vitest";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { REGLAGES_ANIMATION_V2, planifierEcranV2 } from "../../../src/briques/tableau-scene/v2/animation";
import { TAILLES_V2 } from "../../../src/briques/tableau-scene/v2/charte";
import { largeurTenue } from "../../../src/briques/tableau-scene/v2/disposition";
import { REGLAGES_GEOMETRIE_V2 } from "../../../src/briques/tableau-scene/v2/geometrie";
import type { EcranPlace, GeometrieV2 } from "../../../src/briques/tableau-scene/v2/types";
import { controlerVideoTableau } from "../../../src/moteurs/montage-tableau/controles";
import { IDS_FORMATS_SORTIE, type IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { contexteFormation, ficheFormation, ficheFormationCalee, motsFormation } from "./temoin-formation";

const calage = ficheFormationCalee();
const mots = motsFormation();
const mise = (f: IdFormatSortie) => mettreEnPage(calage.fiche, f === "vertical" ? {} : { format: f });

function plans(f: IdFormatSortie) {
  const vus = new Map<string, { ecran: EcranPlace; plan: ReturnType<typeof planifierEcranV2>; g: GeometrieV2; finVoixMs: number }>();
  for (const p of proprietesScenes({ miseEnPage: mise(f) as unknown as MiseBrique, scenes: calage.fiche.scenes as SceneCalee[], heures: calage.elements, stylo: calage.fiche.stylo, mots })) {
    const v = p.v2!;
    for (const e of v.ecrans) {
      if (vus.has(e.id)) continue;
      vus.set(e.id, { ecran: e, g: v.geometrie, finVoixMs: v.finVoixMs, plan: planifierEcranV2({ ecran: e, geometrie: v.geometrie, debutMs: v.temps[e.id].debutMs, finMs: v.temps[e.id].finMs, heures: v.heures, finVoixMs: v.finVoixMs, mots: v.mots, stylo: p.stylo }) });
    }
  }
  return [...vus.values()];
}
const tous = Object.fromEntries(IDS_FORMATS_SORTIE.map((f) => [f, plans(f)])) as Record<IdFormatSortie, ReturnType<typeof plans>>;

describe("1. écran d'appel plein dès son arrivée", () => {
  for (const f of IDS_FORMATS_SORTIE) {
    it(`${f} : grand titre et bloc du mot tout de suite, bulle ensuite (juste avant la frappe), axion-ia.com en grand jusqu'au bout`, () => {
      const { ecran, plan, g, finVoixMs } = tous[f].find((x) => x.ecran.gabarit === "appel-commentaire")!;
      const titres = ecran.textes.filter((t) => /^e3[12](~\w+)?#\d/.test(t.id));
      expect(titres.map((t) => t.texte)).toEqual(expect.arrayContaining(["ÉCRIVEZ", "CINQ", "COMMENTAIRE"]));
      for (const t of titres) expect(plan.apparitions[t.id].debutMs, `« ${t.texte} »`).toBe(plan.debutMs);
      const bloc = ecran.formes.find((x) => x.sorte === "bloc" && x.source.endsWith("~mot"))!;
      expect(plan.apparitions[bloc.id].debutMs).toBe(plan.debutMs);
      // La bulle arrive après, au plus `attenteCadreMs` avant la frappe du mot ; la frappe suit le mot dit.
      const frappe = plan.apparitions[`${ecran.id}#frappe`].debutMs;
      const bulle = plan.apparitions[`${ecran.id}#bulle`].debutMs;
      expect(bulle).toBeGreaterThan(plan.debutMs);
      expect(frappe - bulle).toBeLessThanOrEqual(REGLAGES_ANIMATION_V2.attenteCadreMs);
      expect(frappe).toBeGreaterThan(bulle);
      // Aucun titre ne sort.
      for (const t of titres) expect(plan.apparitions[t.id].sortieMs).toBeUndefined();
      // Signature en grand après la voix, tenue jusqu'au fondu (aucune sortie).
      const sig = ecran.textes.find((t) => t.id === "signature-fin")!;
      expect(sig.taille).toBeGreaterThanOrEqual(90 * g.k);
      const a = plan.apparitions[sig.id];
      expect(a.debutMs).toBeGreaterThanOrEqual(finVoixMs);
      expect(a.debutMs).toBeLessThan(plan.finMs - 2000);
      expect(a.sortieMs).toBeUndefined();
      expect(TAILLES_V2.signatureFin).toBeGreaterThanOrEqual(100);
    });
  }
});

describe("2. exemple : la carte n'a jamais une moitié vide", () => {
  for (const f of IDS_FORMATS_SORTIE) {
    it(`${f} : « avant » là dès l'arrivée et plus grand, « après » annoncé dès l'arrivée (pointillés, étiquette, texte estompé), carte réduite à ses panneaux`, () => {
      const { ecran, plan } = tous[f].find((x) => x.ecran.gabarit === "exemple")!;
      const id = (s: string) => `${ecran.id}#${s}`;
      const av = ecran.formes.find((x) => x.id === id("av"))!;
      const ap = ecran.formes.find((x) => x.id === id("ap"))!;
      // Plus grand quand la carte est haute (vertical, horizontal) ; parts égales sur une carte basse (portrait, carré).
      if (f === "vertical" || f === "horizontal") expect(av.hauteur).toBeGreaterThan(ap.hauteur);
      else expect(av.hauteur).toBeGreaterThanOrEqual(ap.hauteur - 0.5);
      expect(plan.apparitions[id("avt.0")].debutMs).toBe(plan.debutMs);
      // Relecture du 12/10/2026 (première vidéo fabriquée) : l'emplacement de l'« après » n'est jamais un cadre vide —
      // il est là dès l'arrivée de l'écran avec son étiquette et son texte estompé, écrit en plein quand il est dit.
      for (const annonce of ["app", "ape", "apef"]) expect(plan.apparitions[id(annonce)].debutMs, annonce).toBe(plan.debutMs);
      const apres = ecran.textes.filter((t) => t.id.startsWith(id("apt")));
      expect(apres.length).toBeGreaterThan(0);
      for (const t of apres) expect(t.avant, t.id).toBe("estompe");
      // La carte s'arrête à ses panneaux : elle ne descend plus, vide, jusqu'en bas de l'image.
      const carte = ecran.formes.find((x) => x.id === id("carte"))!;
      expect(carte.horsZone).toBeFalsy();
      expect(carte.y + carte.hauteur).toBeGreaterThanOrEqual(ap.y + ap.hauteur);
      expect(carte.y + carte.hauteur).toBeLessThanOrEqual(ecran.zoneCorps.y + ecran.zoneCorps.hauteur + 0.5);
    });
  }
});

describe("3. aucun titre ne défile, quel que soit le gabarit", () => {
  for (const f of IDS_FORMATS_SORTIE) {
    it(`${f} : un seul groupe de titres par écran, rien ne sort avant la fin de l'écran`, () => {
      for (const { ecran, plan } of tous[f]) {
        expect(ecran.groupes, `${ecran.gabarit} ${ecran.id}`).toBe(1);
        for (const x of [...ecran.textes, ...ecran.formes]) expect(plan.apparitions[x.id].sortieMs, `${ecran.id} ${x.id}`).toBeUndefined();
      }
    });
  }
  it("le constat et l'idée reçue gardent tous leurs titres, en carré comme en horizontal", () => {
    for (const f of ["carre", "horizontal"] as const)
      for (const g of ["constat", "idee-recue"]) {
        const { ecran } = tous[f].find((x) => x.ecran.gabarit === g)!;
        const sources = new Set(ecran.textes.filter((t) => /^e\d+#\d/.test(t.id)).map((t) => t.source));
        expect(sources.size, `${f} ${g}`).toBeGreaterThanOrEqual(3);
      }
  });
});

describe("4. vertical : marge droite des boutons", () => {
  const { g } = tous.vertical[0];
  it("les titres du haut prennent plus de largeur, jamais sous 45 % de la hauteur (valeur prudente)", () => {
    expect(REGLAGES_GEOMETRIE_V2.hautLarge).toEqual({ droite: 6, jusqua: 0.45 });
    expect(g.titresLarges).toEqual({ droite: 1080 - Math.round(0.06 * 1080) - Math.round(16 * g.k), basMax: Math.round(0.45 * 1920) });
    const droite = g.contenu.x + g.contenu.largeur;
    const larges = tous.vertical.filter(({ ecran }) => ecran.textes.some((t) => !t.horsContenu && t.x + t.largeur > droite + 1));
    expect(larges.length).toBeGreaterThanOrEqual(3);
    for (const { ecran } of tous.vertical) expect(largeurTenue(ecran, g), ecran.id).toBe(true);
    // Les autres formats ne changent pas.
    for (const f of ["portrait", "carre", "horizontal"] as const) expect(tous[f][0].g.titresLarges).toBeUndefined();
  });
  it("le contrôle de zone sûre accepte les titres du haut et reste « réussi »", async () => {
    const r = await controlerVideoTableau({ fiche: ficheFormation(), contexte: contexteFormation(), historique: [], dejaVu: { coche: true, le: "2026-10-10" } });
    expect(r.lignes.find((l) => l.libelle === "Zone sûre")?.etat).toBe("reussi");
    expect(r.lignes.filter((l) => l.famille === "mise-en-page" && l.etat === "echoue")).toEqual([]);
  });
});
