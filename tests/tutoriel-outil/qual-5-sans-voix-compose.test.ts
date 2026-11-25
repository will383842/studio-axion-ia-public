/**
 * QUAL-5 : le tutoriel SANS VOIX est COMPOSÉ du script (0 appel Claude, aucune réserve « plan simple »), ses
 * sous-titres tiennent dans la bande réservée, le contrôle de composition passe et la note ne vaut 100 que là.
 * Chaîne réelle + doubles de `doubles.ts` (rendu simulé). Avec voix : propriétés inchangées (aucun champ nouveau).
 */
import { describe, expect, it } from "vitest";
import { avancerEtape, etatInitial, ETAPES_TUTORIEL, type EtatTutoriel } from "@/moteurs/montage-tutoriel-outil/chaine";
import { baseRetenue, donneesCalque } from "@/briques/sous-titres";
import { noteSansGrille } from "@/moteurs/montage-tutoriel-outil/index";
import type { ProprietesTutorielOutil } from "@/moteurs/montage-tutoriel-outil/proprietes";
import { commandeTutoriel, outilsDoubles, type Journal } from "./doubles";

const SCRIPT = "Vous perdez du temps à compter vos stocks à la main ? Voici un tableau de bord qui le fait pour vous. En haut, trois chiffres : les articles en stock, ceux qui passent sous le seuil, et la valeur totale. Juste en dessous, la liste des articles à commander, triée par urgence. Un clic sur un article ouvre son historique : entrées, sorties, et date de la prochaine rupture prévue. Quand un article passe sous le seuil, une alerte part toute seule. Vous décidez en une minute au lieu d'une heure. Vous voulez le même pour votre entreprise ? Prenez rendez-vous.";

async function fabriquer(modeVoix?: "sans-voix") {
  const c = commandeTutoriel({
    ratios: ["4:5"], dureeCibleSec: 45, ...(modeVoix ? { distribution: [] } : {}),
    script: { blocs: [], texteComplet: SCRIPT } as never,
    entrees: { tutorielOutil: { scriptColle: true, ...(modeVoix ? { modeVoix } : {}), fin: "prendre-rendez-vous", idee: "Suivre ses stocks avec un tableau de bord simple" } },
  });
  const journal: Journal = { voix: [], claude: [], rendus: [] };
  const o = outilsDoubles(journal);
  (o as unknown as Record<string, unknown>).fin = { actif: true };
  let etat: EtatTutoriel = etatInitial(c);
  for (const cle of ETAPES_TUTORIEL) {
    for (let i = 0; i < 10; i++) {
      const p = await avancerEtape(cle, etat, c, o, "t1");
      etat = p.etat;
      if (p.statut === "faite") break;
      if (p.statut !== "en-cours") throw new Error(`${cle} : ${p.statut}`);
    }
  }
  return { etat, journal, props: journal.rendus.filter((d) => d.operation === "composition").map((d) => d.parametres.proprietes as unknown as ProprietesTutorielOutil) };
}

describe("tutoriel sans voix composé", () => {
  it("0 appel Claude, un rendu, plan composé titre → écran → repère → appel", async () => {
    const { etat, journal, props } = await fabriquer("sans-voix");
    expect(journal.claude).toHaveLength(0);
    expect(journal.voix).toHaveLength(0);
    expect(etat.plan?.source).toBe("compose");
    expect(etat.reserves.filter((r) => /Plan de scènes|plan simple/i.test(r))).toEqual([]);
    expect(props).toHaveLength(1);
    const compo = props[0].compositionSansVoix!;
    expect(compo).toBeDefined();
    const genres = compo.scenes.map((s) => s.genre);
    expect(genres[0]).toBe("titre");
    expect(genres.indexOf("ecran")).toBeGreaterThan(0);
    expect(genres.indexOf("repere")).toBeGreaterThan(genres.indexOf("ecran"));
    expect(genres.indexOf("appel")).toBeGreaterThan(genres.indexOf("repere"));
  });

  it("sous-titres dans la bande, couleurs charte, bande de fond grise", async () => {
    const { props } = await fabriquer("sans-voix");
    const st = props[0].sousTitres!;
    expect(st.positions.milieuPct).toBeCloseTo(props[0].compositionSansVoix!.basPct, 1);
    expect(st.couleurs).toEqual({ texte: "#141413", accent: "#B23F16", contour: "#E8E6DC" });
    expect(st.bandeFond).toMatchObject({ couleur: "#E8E6DC", opacite: 1 });
    expect(st.segments.every((s) => s.position === "auto" && s.style === "base" && !s.inclinaison)).toBe(true);
  });

  it("contrôle de composition propre : 0 défaut, note 100", async () => {
    const { etat } = await fabriquer("sans-voix");
    expect(etat.composition?.defauts).toEqual([]);
    expect(etat.composition?.ok).toBe(true);
    expect(noteSansGrille({ bloquants: 0, aCorriger: 0, attention: 0 })).toBe(100);
  });

  it("avec voix : aucun champ du mode composé, plan Claude, sous-titres du studio", async () => {
    const { etat, journal, props } = await fabriquer();
    expect(etat.compose).toBeUndefined();
    expect(etat.plan?.source).not.toBe("compose");
    expect(journal.claude.length).toBeGreaterThan(0);
    expect(Object.keys(props[0]).filter((k) => !["plan", "sousTitres", "fin", "finMs", "navigation", "reglagesFilm", "audio", "filmNavigation"].includes(k))).toEqual([]);
    // sous-titres : exactement ceux du studio (aucune normalisation, aucune bande de fond, couleurs de la marque)
    expect(props[0].sousTitres).toEqual(JSON.parse(JSON.stringify(donneesCalque({ segments: etat.sousTitres!, base: baseRetenue(undefined, null), ratio: "4:5" }))));
    expect(props[0].sousTitres?.bandeFond).toBeUndefined();
  });
});
