/**
 * QUAL-5 : le tutoriel SANS VOIX est COMPOSÉ du script (0 appel Claude, aucune réserve « plan simple »), ses
 * sous-titres tiennent dans la bande réservée, le contrôle de composition passe et la note ne vaut 100 que là.
 * Chaîne réelle + doubles de `doubles.ts` (rendu simulé). Avec voix : propriétés inchangées (aucun champ nouveau).
 */
import { describe, expect, it } from "vitest";
import { avancerEtape, etatInitial, ETAPES_TUTORIEL, type EtatTutoriel } from "@/moteurs/montage-tutoriel-outil/chaine";
import { baseRetenue, donneesCalque } from "@/briques/sous-titres";
import { noteSansGrille } from "@/moteurs/montage-tutoriel-outil/index";
import { CARTE_FIN_AXION, DUREE_CARTE_FIN_MS, dureeImagesTutoriel, type ProprietesTutorielOutil } from "@/moteurs/montage-tutoriel-outil/proprietes";
import { PAS_MS_DEFAUT } from "@/briques/plan-scenes/tutoriel/controle-composition";
import { textesVisiblesCompose } from "@/moteurs/montage-tutoriel-outil/chaine";
import { creerMoteurTutorielOutil, moteurMontageTutorielOutil } from "@/moteurs/montage-tutoriel-outil";
import type { Travail } from "@/domaine/types";
import type { LectureRegard } from "@/briques/regardeur";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";

const SCRIPT = "Vous perdez du temps à compter vos stocks à la main ? Voici un tableau de bord qui le fait pour vous. En haut, trois chiffres : les articles en stock, ceux qui passent sous le seuil, et la valeur totale. Juste en dessous, la liste des articles à commander, triée par urgence. Un clic sur un article ouvre son historique : entrées, sorties, et date de la prochaine rupture prévue. Quand un article passe sous le seuil, une alerte part toute seule. Vous décidez en une minute au lieu d'une heure. Vous voulez le même pour votre entreprise ? Prenez rendez-vous.";

async function fabriquer(modeVoix?: "sans-voix", sup?: { avantMontage?: (e: EtatTutoriel) => EtatTutoriel; regarder?: boolean; ratios?: ("4:5" | "9:16")[]; navigation?: boolean; idee?: string }) {
  const c = commandeTutoriel({
    ratios: sup?.ratios ?? ["4:5"], dureeCibleSec: 45, ...(modeVoix ? { distribution: [] } : {}),
    script: { blocs: [], texteComplet: SCRIPT } as never,
    entrees: { tutorielOutil: { scriptColle: true, ...(modeVoix ? { modeVoix } : {}), fin: "prendre-rendez-vous", idee: sup?.idee ?? "Suivre ses stocks avec un tableau de bord simple" } },
  });
  const journal: Journal = { voix: [], claude: [], rendus: [] };
  const o = outilsDoubles(journal);
  if (sup?.regarder) o.regarder = async (x) => ({ images: x.instants.map((i) => ({ nom: i.nom, textes: [], sousTitre: null, pageVide: false, noire: false, illisible: false })) }) as LectureRegard;
  (o as unknown as Record<string, unknown>).fin = { actif: true };
  let etat: EtatTutoriel = etatInitial(c);
  for (const cle of ETAPES_TUTORIEL) {
    if (cle === "montage" && sup?.avantMontage) etat = sup.avantMontage(etat);
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

  it("tour 7 : cartes par proposition (≥ 1,5 s) ; la carte déjà affichée en grand (appel, titre) est vidée, la bande reste", async () => {
    const { props, etat } = await fabriquer("sans-voix", { idee: "Vous perdez du temps à compter vos stocks à la main ?" });
    const segs = props[0].sousTitres!.segments;
    const pleines = segs.filter((g) => g.mots.length);
    for (const g of pleines.slice(0, -1)) expect(g.mots.length).toBeGreaterThanOrEqual(3);
    for (const g of segs.slice(0, -1)) expect(g.finSec - g.debutSec).toBeGreaterThanOrEqual(1.5 - 1e-9);
    segs.slice(1).forEach((g, i) => expect(g.debutSec).toBeGreaterThanOrEqual(segs[i].finSec - 1e-9));
    const textes = pleines.map((g) => g.mots.map((m) => m.mot).join(" "));
    // la question de l'appel est dessinée en grand : pas de carte pour elle ; la dernière phrase reste sous-titrée
    expect(textes.some((t) => t.includes("même pour votre entreprise"))).toBe(false);
    expect(textes.at(-1)).toBe("Prenez rendez-vous.");
    expect(segs.some((g) => g.mots.length === 0)).toBe(true);
    // les cartes vidées gardent leurs horaires : les mots du plan (calage) ne bougent pas
    expect(etat.motsPlan!.length).toBe(etat.sousTitres!.flatMap((g) => g.mots).length);
    expect(props[0].fin).toBeUndefined();
    expect(props[0].finMs).toBe(0);
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

describe("durée : la parole ET la fin dans le plan composé (tour 5)", () => {
  it("plan nu et plan composé ont la même durée (parole + 2,5 s), finMs = 0, pas de carte de fin", async () => {
    const { etat, props } = await fabriquer("sans-voix");
    const p = props[0];
    const finParole = etat.motsPlan!.at(-1)!.finMs;
    expect(p.compositionSansVoix!.dureeMs).toBe(finParole + DUREE_CARTE_FIN_MS);
    expect(p.plan.dureeMs).toBe(p.compositionSansVoix!.dureeMs);
    expect(p.finMs).toBe(0);
    expect(p.fin).toBeUndefined();
    expect(dureeImagesTutoriel(p)).toBe(Math.ceil(((finParole + DUREE_CARTE_FIN_MS) * 25) / 1000));
    // la scène « appel » dure jusqu'à la dernière image
    expect(p.compositionSansVoix!.scenes.at(-1)!.finMs).toBe(p.compositionSansVoix!.dureeMs);
  });
  it("fin « rendez-vous » : la scène « appel » porte le libellé de la carte de fin Axion (« axion-ia.com »)", async () => {
    const { props } = await fabriquer("sans-voix");
    const appel = props[0].compositionSansVoix!.scenes.find((sc) => sc.genre === "appel");
    expect(appel && "site" in appel ? appel.site : undefined).toBe(CARTE_FIN_AXION.sousTitre);
    expect(appel && "marque" in appel ? appel.marque : undefined).toBe(CARTE_FIN_AXION.titre);
  });

  it("le contrôle de composition juge TOUTE la durée montrée", async () => {
    const { etat, props } = await fabriquer("sans-voix");
    const d = props[0].compositionSansVoix!.dureeMs;
    expect(etat.composition!.mesures.echantillons).toBe(Math.ceil(d / PAS_MS_DEFAUT));
    expect(etat.composition!.ok).toBe(true);
  });

  it("la bande grise reste jusqu'à la dernière image : le dernier groupe de sous-titres dure jusqu'à la fin du plan", async () => {
    const { props } = await fabriquer("sans-voix");
    const st = props[0].sousTitres!;
    expect(st.segments.at(-1)!.finSec).toBeGreaterThanOrEqual(props[0].compositionSansVoix!.dureeMs / 1000);
  });

  it("avec voix : carte de fin séparée comme avant (finMs 2 500, fin Axion, plan = durée de la voix)", async () => {
    const { props } = await fabriquer();
    expect(props[0].finMs).toBe(DUREE_CARTE_FIN_MS);
    expect(props[0].fin).toBeDefined();
  });

  it("la carte de fin Axion est bien la source du texte de fin (sous-titre « axion-ia.com »)", () => {
    expect(CARTE_FIN_AXION.sousTitre).toBe("axion-ia.com");
  });
});

describe("grille : le critère de composition est réussi quand le contrôle est propre", () => {
  it("avec `controleImage` et `controleur` présents et un regard, la grille existe et « composition » est réussi", async () => {
    const { etat } = await fabriquer("sans-voix", {
      regarder: true,
      avantMontage: (e) => ({ ...e, controleImage: { controles: [], verdict: "livrable", nonFaits: 0, resume: "" }, controleur: { controles: [] } }) as unknown as EtatTutoriel,
    });
    const grille = (etat as EtatTutoriel & { grille?: { criteres: { id: string; etat: string }[] } }).grille;
    expect(grille).toBeDefined();
    expect(grille!.criteres.find((c) => c.id === "composition")).toMatchObject({ etat: "reussi" });
  });
});

describe("textes visibles du plan composé (regard)", () => {
  it("collecte les textes affichés, jamais les ids, genres ni cibles", async () => {
    const { props } = await fabriquer("sans-voix");
    const compo = props[0].compositionSansVoix!;
    const t = textesVisiblesCompose(compo.scenes);
    expect(t.length).toBeGreaterThan(3);
    const bruts = JSON.stringify(compo.scenes);
    for (const interdit of ["titre", "ecran", "repere", "appel", "bouton-appel", "ligne-1", "ensemble", "cartes", "s1-titre"]) expect(t).not.toContain(interdit);
    expect(textesVisiblesCompose([{ id: "s1", genre: "ecran", titreFenetre: "Tableau", evenements: [{ genre: "alerte", texte: "Alerte stock", cible: "liste", cartes: [{ libelle: "Stock", aMs: 1 }] }] }])).toEqual(["Tableau", "Alerte stock", "Stock"]);
    void bruts;
  });
});

describe("estimation sans voix composé", () => {
  it("aucune ligne « Plan de scènes » (0 appel Claude) ; avec voix, elle reste", async () => {
    const sans = commandeTutoriel({ script: { blocs: [], texteComplet: SCRIPT } as never, entrees: { tutorielOutil: { scriptColle: true, modeVoix: "sans-voix", idee: "x" } } });
    const avec = commandeTutoriel({ script: { blocs: [], texteComplet: SCRIPT } as never, entrees: { tutorielOutil: { scriptColle: true, idee: "x" } } });
    const lignes = async (c: typeof sans) => (await moteurMontageTutorielOutil.estimer(c)).lignes.map((l) => l.etape);
    expect(await lignes(sans)).not.toContain("Plan de scènes");
    expect(await lignes(avec)).toContain("Plan de scènes");
  });
});

describe("sans voix AVEC film de navigation : comportement de master (pas de plan composé, sous-titres du studio)", () => {
  it("aucune composition, aucune bande de fond grise, plan non composé", async () => {
    const film = { version: "navigation-filmee.v1", videoCle: "studio/test/film.mp4", maquette: "tableau", largeur: 1080, hauteur: 1350, debutFilmMs: 400, dureeVoixMs: 30000, cibles: [{ etapeId: "e1", zonePct: { x: 10, y: 10, largeur: 30, hauteur: 12 }, instantMs: 3000, finMs: 5000 }] };
    const c = commandeTutoriel({ distribution: [], script: { blocs: [], texteComplet: SCRIPT } as never, entrees: { tutorielOutil: { scriptColle: true, modeVoix: "sans-voix", idee: "x", navigationFilmee: film } } });
    const j: Journal = { voix: [], claude: [], rendus: [] };
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j)) });
    const T0 = Date.UTC(2026, 10, 25, 9);
    let t: Travail = await moteur.lancer(c, { travailId: "t-q5-film", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
    for (let i = 0; i < 400; i++) {
      t = (await moteur.avancer(t, c, T0 + i * 1000)).travail;
      if (["termine", "echec", "annule"].includes(t.statut)) break;
    }
    const e = t.parametres?.tutoriel as EtatTutoriel;
    expect(e.compose).toBeUndefined();
    expect(e.plan?.source).not.toBe("compose");
    for (const d of j.rendus.filter((x) => x.operation === "composition")) {
      const p = d.parametres.proprietes as unknown as ProprietesTutorielOutil;
      expect(p.compositionSansVoix).toBeUndefined();
      expect(p.sousTitres?.bandeFond).toBeUndefined();
    }
  });

});
