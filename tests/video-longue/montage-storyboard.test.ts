/**
 * QUALL-5 : le montage d'un coup et le montage pas à pas partent de la MÊME préparation pure (`preparerRenduVideoLongue`) :
 * composition « VideoLongue », mêmes propriétés (story-board), mêmes plages, mêmes identifiants. Et la note de qualité
 * n'est plus un 80 en dur : elle baisse quand un chapitre est cassé.
 */
import { describe, expect, it, vi } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import type { DemandeRendu } from "@/fournisseurs/types";

vi.mock("server-only", () => ({}));
const { monterVideoLongue, pasMontageVideoLongue, preparerRenduVideoLongue, ErreurMontageVideoLongue } = await import("@/services/video-longue-montage");
const { minuterSansVoix } = await import("@/moteurs/montage-video-longue/minutage");
const { chapitresDuScript, decouperEnPhrases } = await import("@/moteurs/montage-video-longue/decoupage");
const { lireEntreesVideoLongue } = await import("@/moteurs/montage-video-longue/entrees");
const { storyboardVideoLongue } = await import("@/moteurs/montage-video-longue/storyboard");
const { controlerStoryboard } = await import("@/moteurs/montage-video-longue/controle");
const { poserScene, poserSousTitre } = await import("@/moteurs/montage-video-longue/mise-en-page");
const { ID_COMPOSITION_VIDEO_LONGUE, VERSION_DESSIN_LONGUE } = await import("@/moteurs/montage-video-longue/storyboard-types");
const { SCRIPT_ESSAI } = await import("./../moteurs/montage-video-longue/script-essai");
const { definitionVideoLongue } = await import("@/moteurs/montage-video-longue");

const QUESTION = "Comment suivre ses stocks sans y passer des heures ?";
function fabriquer(script = SCRIPT_ESSAI) {
  const chapitres = chapitresDuScript(script).map((c) => ({ id: c.id, titre: c.titre, texte: decouperEnPhrases(c.texte).join(" ") }));
  const commande = { videoId: "v-sb", ratios: ["16:9"], entrees: { videoLongue: { chapitres, sansVoix: true, question: QUESTION } } } as unknown as CommandeFabrication;
  const entrees = lireEntreesVideoLongue(commande);
  const m = minuterSansVoix(entrees);
  return { commande, entrees, ctx: { chapitres: m.chapitres, mots: m.mots, dureeSec: m.dureeSec } as never, minutage: m };
}

function ports() {
  const demandes: DemandeRendu[] = [];
  const connus = new Map<string, string>();
  const notees: Record<string, { sortieCle: string; empreinte: string }> = {};
  return {
    demandes,
    ports: {
      rendu: {
        soumettre: async (d: DemandeRendu) => (demandes.push(d), connus.set(d.idRendu, d.sortie.cle), { idRendu: d.idRendu }),
        etat: async (id: string) => ({ statut: "termine" as const, sortieCle: connus.get(id)! }),
      },
      signer: async (l: Record<string, string>, d: { cle: string }[]) => ({ lectures: Object.fromEntries(Object.entries(l).map(([n, c]) => [n, `https://lire/${c}`])), depots: Object.fromEntries(d.map((x) => [x.cle, `https://deposer/${x.cle}`])) }),
      cle: (c: { videoId: string }, nom: string) => `studio/dev/videos/${c.videoId}/${nom}`,
      lirePlages: async () => ({ ...notees }),
      ecrirePlages: async (_v: string, p: typeof notees) => void Object.assign(notees, p),
      attendre: async () => {},
    } as never,
  };
}
const compositions = (d: DemandeRendu[]) => d.filter((x) => x.operation === "composition");

describe("QUALL-5 : une seule préparation pour les deux chemins", () => {
  it("monter et pas à pas soumettent la composition VideoLongue avec des propriétés, plages et identifiants identiques", async () => {
    const { commande, ctx } = fabriquer();
    const a = ports();
    await monterVideoLongue(commande, "t1", ctx, a.ports);
    const b = ports();
    let suivi;
    for (let i = 0; i < 400; i++) {
      const pas = await pasMontageVideoLongue(commande, "t1", ctx, b.ports, suivi);
      if ("fini" in pas) break;
      suivi = pas.enCours.suivi;
    }
    const ca = compositions(a.demandes);
    const cb = compositions(b.demandes);
    expect(ca.length).toBeGreaterThan(3);
    expect(cb.map((d) => d.idRendu)).toEqual(ca.map((d) => d.idRendu));
    for (const d of [...ca, ...cb]) expect((d.parametres as Record<string, unknown>).composition).toBe("VideoLongue");
    expect(ID_COMPOSITION_VIDEO_LONGUE).toBe("VideoLongue");
    expect(cb.map((d) => d.parametres)).toEqual(ca.map((d) => d.parametres));
    const prop = (ca[0].parametres as { proprietes: { storyboard: unknown } }).proprietes;
    expect(Object.keys(prop)).toEqual(["storyboard"]);
    expect(prop).toEqual(preparerRenduVideoLongue(commande, ctx).proprietes);
  });

  it("préparation pure : chapitres du story-board, empreinte stable, changée si le contenu ou le dessin change", () => {
    const x = fabriquer();
    const p1 = preparerRenduVideoLongue(x.commande, x.ctx);
    const p2 = preparerRenduVideoLongue(x.commande, x.ctx);
    expect(p2).toEqual(p1);
    expect(p1.chapitres.length).toBe(x.minutage.chapitres.length);
    expect(new Set(p1.chapitres.map((c) => c.empreinte)).size).toBe(p1.chapitres.length);
    expect(VERSION_DESSIN_LONGUE).toBeGreaterThan(0);
    const y = fabriquer(SCRIPT_ESSAI.replace("Les alertes : savoir avant de manquer", "Les alertes : savoir tout de suite"));
    const p3 = preparerRenduVideoLongue(y.commande, y.ctx);
    expect(p3.chapitres.map((c) => c.empreinte)).not.toEqual(p1.chapitres.map((c) => c.empreinte));
    expect(p3.chapitres[0].empreinte).toBe(p1.chapitres[0].empreinte);
  });

  it("refus net au-delà de 600 Ko de propriétés", () => {
    const { commande } = fabriquer();
    const mots = Array.from({ length: 4000 }, (_, i) => ({ mot: `mot${i}${i % 12 === 11 ? "." : ""}`, debutSec: i * 0.4, finSec: i * 0.4 + 0.35 }));
    // Texte énorme : le story-board dépasse la limite.
    const enorme = { chapitres: [{ debutSec: 0, finSec: 1600, libelle: "x".repeat(700_000), blocRecette: "chapitres" }], mots, dureeSec: 1600 } as never;
    expect(() => preparerRenduVideoLongue(commande, enorme)).toThrow(ErreurMontageVideoLongue);
  });
});

describe("QUALL-5 : la note n'est plus un 80 en dur", () => {
  const noteDe = (): number => {
    const { commande, entrees, minutage } = fabriquer();
    const chapitres = minutage.chapitres;
    const def = definitionVideoLongue(() => null);
    const etat = { faites: [], voix: { mots: minutage.mots, dureeSec: minutage.dureeSec, morceaux: 0 }, chapitres, remarques: [], sorties: { "16:9": "k.mp4" } };
    const r = def.resultat(commande, etat as never, entrees as never);
    expect(r.sorties[0].rapportQualite.note).toBe(r.noteQualite.globale);
    return r.noteQualite.globale;
  };

  it("story-board d'essai : note >= 80 et recalculée par le contrôle", () => {
    const { commande, minutage } = fabriquer();
    const sb = storyboardVideoLongue({ question: QUESTION }, { mots: minutage.mots, chapitres: minutage.chapitres, dureeSec: minutage.dureeSec });
    const direct = controlerStoryboard(sb, { scene: poserScene, sousTitre: poserSousTitre }).note;
    expect(direct).toBeGreaterThanOrEqual(80);
    expect(noteDe()).toBe(direct);
    expect(commande).toBeTruthy();
  });

  it("un chapitre cassé (titre « Chapitre 2 » dans le story-board) : note plus basse que celle de l'essai, et pas 80", () => {
    const { minutage } = fabriquer();
    const sb = storyboardVideoLongue({ question: QUESTION }, { mots: minutage.mots, chapitres: minutage.chapitres, dureeSec: minutage.dureeSec });
    const bon = controlerStoryboard(sb, { scene: poserScene, sousTitre: poserSousTitre });
    sb.chapitres[1].titre = "Chapitre 2";
    const casse = controlerStoryboard(sb, { scene: poserScene, sousTitre: poserSousTitre });
    expect(casse.alertes.map((a) => a.code)).toContain("titre-generique");
    expect(casse.note).toBeLessThan(bon.note);
    expect(bon.note).not.toBe(80);
  });

  it("AVEC voix : note 80 et aucune alerte du contrôle (le contrôle ne regarde que le story-board sans voix)", () => {
    const { commande, minutage } = fabriquer();
    const avecVoix = { ...commande, entrees: { videoLongue: { ...(commande.entrees as never as { videoLongue: object }).videoLongue, sansVoix: false } } } as unknown as CommandeFabrication;
    const etat = { faites: [], voix: { mots: minutage.mots, dureeSec: minutage.dureeSec, morceaux: 0 }, chapitres: minutage.chapitres, remarques: [], sorties: { "16:9": "k.mp4" } };
    const r = definitionVideoLongue(() => null).resultat(avecVoix, etat as never, lireEntreesVideoLongue(avecVoix));
    expect(r.noteQualite.globale).toBe(80);
    // Seule l'alerte de son de master (« niveau non mesuré ») reste : aucune alerte du contrôle du story-board.
    expect(r.noteQualite.alertes.filter((a) => a.code !== "niveau-sonore")).toEqual([]);
    expect(r.sorties[0].rapportQualite.alertes.filter((a) => a.code !== "niveau-sonore")).toEqual([]);
  });

  it("avec voix et sans chapitres dans l'état : comportement d'avant (80)", () => {
    const { commande: c0 } = fabriquer();
    const commande = { ...c0, entrees: { videoLongue: { ...(c0.entrees as never as { videoLongue: object }).videoLongue, sansVoix: false } } } as unknown as CommandeFabrication;
    const r = definitionVideoLongue(() => null).resultat(commande, { faites: [], remarques: [], sorties: { "16:9": "k.mp4" } } as never, lireEntreesVideoLongue(commande));
    expect(r.noteQualite.globale).toBe(80);
  });
});
