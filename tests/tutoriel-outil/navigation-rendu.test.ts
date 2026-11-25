/**
 * T-EXT-38 · Le film de navigation dans la commande et dans la demande de rendu. Doubles seulement (aucun rendu réel).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurTutorielOutil } from "@/moteurs/montage-tutoriel-outil";
import { lireEntreesTutoriel } from "@/moteurs/montage-tutoriel-outil/entrees";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";

const T0 = Date.UTC(2026, 10, 18, 9);

function film(plus: Record<string, unknown> = {}) {
  return {
    version: "navigation-filmee.v1",
    videoCle: "studio/test/film.mp4",
    maquette: "tableau",
    largeur: 1080,
    hauteur: 1350,
    debutFilmMs: 400,
    dureeVoixMs: 60000,
    cibles: [
      { etapeId: "e1", zonePct: { x: 10, y: 10, largeur: 30, hauteur: 12 }, instantMs: 3000, finMs: 5000 },
      { etapeId: "e2", zonePct: { x: 60, y: 50, largeur: 30, hauteur: 12 }, instantMs: 8000, finMs: 10000 },
    ],
    ...plus,
  };
}

const avecFilm = (navigationFilmee: unknown): CommandeFabrication => commandeTutoriel({ entrees: { tutorielOutil: { scriptColle: true, ...(navigationFilmee === undefined ? {} : { navigationFilmee }) } } });

async function fabriquer(c: CommandeFabrication) {
  const j: Journal = { voix: [], claude: [], rendus: [] };
  const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j)) });
  let t: Travail = await moteur.lancer(c, { travailId: "t-nav", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
  let resultat;
  for (let i = 0; i < 400; i++) {
    const r = await moteur.avancer(t, c, T0 + i * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (["termine", "echec", "annule"].includes(t.statut)) break;
  }
  const rendus = j.rendus.filter((d) => d.operation === "composition");
  return { travail: t, resultat, rendus };
}

const alertes = (r: Awaited<ReturnType<typeof fabriquer>>) => (r.resultat?.noteQualite.alertes ?? []).map((a) => a.message);

describe("sans film : identique à l'octet", () => {
  it("la demande et les propriétés n'ont ni `filmNavigation` ni `navigation`, aucune réserve Navigation", async () => {
    const r = await fabriquer(avecFilm(undefined));
    expect(r.travail.statut).toBe("termine");
    for (const d of r.rendus) {
      expect(Object.keys(d.entrees)).toEqual(["audio"]);
      const p = d.parametres.proprietes as Record<string, unknown>;
      expect(Object.keys(p).sort()).toEqual(["fin", "finMs", "plan", "sousTitres"]);
    }
    expect(alertes(r).some((m) => m.includes("Navigation"))).toBe(false);
  });

  it("entrée illisible : montée comme sans film, mais la réserve « film refusé » le dit (ESS-6)", async () => {
    const sans = await fabriquer(avecFilm(undefined));
    for (const illisible of [{ ...film(), version: "autre" }, "x", null, [], { ...film(), videoCle: "a.mov" }]) {
      const r = await fabriquer(avecFilm(illisible));
      expect(r.rendus.map((d) => d.entrees)).toEqual(sans.rendus.map((d) => d.entrees));
      expect(r.rendus.map((d) => d.parametres)).toEqual(sans.rendus.map((d) => d.parametres));
      // AUTORISATION PERMANENTE (b) : avant ESS-6, l'alerte attendue était celle du montage sans film (refus silencieux) ;
      // elle est désormais celle du montage sans film PLUS la réserve « À vérifier · Navigation : film refusé ». Le montage, lui, ne change pas (égalités ci-dessus).
      expect(alertes(r).filter((m) => !m.includes("film refusé"))).toEqual(alertes(sans));
      expect(alertes(r).filter((m) => m.startsWith("À vérifier · Navigation : film refusé"))).toHaveLength(1);
    }
    // AUTORISATION PERMANENTE (b) : l'attente exacte passe de `{}` à `{ navigationRefusee: [...] }` (le refus est exposé, plus avalé).
    expect(lireEntreesTutoriel({ tutorielOutil: { navigationFilmee: "x" } })).toEqual({ navigationRefusee: ["La navigation filmée n'est pas un objet."] });
  });
});

describe("avec film", () => {
  it("signe l'entrée `filmNavigation`, passe `navigation` sans `videoCle`, pose les réserves", async () => {
    const r = await fabriquer(avecFilm(film()));
    expect(r.travail.statut).toBe("termine");
    expect(r.rendus.length).toBeGreaterThan(0);
    for (const d of r.rendus) {
      expect(d.entrees.filmNavigation).toBe("https://stockage.test/studio/test/film.mp4");
      expect(d.entrees.audio).toBeDefined();
      const p = d.parametres.proprietes as { navigation?: Record<string, unknown> };
      expect(p.navigation).toBeDefined();
      expect(p.navigation).not.toHaveProperty("videoCle");
      expect(p.navigation!.cibles).toHaveLength(2);
    }
    const a = alertes(r);
    expect(a).toContain("À vérifier · Navigation : immobilité non mesurée");
    // (le validateur du plan déplace déjà les scènes « plein » qui couvrent les sous-titres : la réserve « cache le film »
    // est couverte sur le plan brut par `planCacheLeFilm`, test pur.)
    expect(a.filter((m) => m.includes("immobilité"))).toHaveLength(1);
  });

  it("écran immobile mesuré : la plage est signalée en secondes", async () => {
    // Calcul : le 1er mot est à 4 000 ms. La montée 1 → 1,6 vers la 1re zone dure 1 700 ms
    // (motion-film.ts : vitesse ≤ 1,2 écran/s, accélération ≤ 3 écrans/s², marge 10 %,
    // multiple de 20 ms). La caméra arrive 250 ms avant le mot (3 750 ms) : elle part donc
    // à 2 050 ms. L'écran n'est immobile que jusqu'au dernier pas de 20 ms avant ce départ,
    // soit 2 040 ms → « de 0,5 s à 2,0 s ». Tolérance de 1,5 s inchangée.
    const cibles = film().cibles;
    const r = await fabriquer(
      avecFilm(film({ figees: [{ debutMs: 500, finMs: 2300 }], cibles: [{ ...cibles[0], instantMs: 4000, finMs: 6000 }, cibles[1]] })),
    );
    expect(alertes(r)).toContain("À vérifier · Navigation : écran immobile de 0,5 s à 2,0 s");
  });

  it("film plus court que la voix : réserve, jamais un échec", async () => {
    const r = await fabriquer(avecFilm(film({ dureeVoixMs: 1000, cibles: [{ etapeId: "e1", instantMs: 100, finMs: 500 }] })));
    expect(r.travail.statut).toBe("termine");
    expect(alertes(r)).toContain("À vérifier · Navigation : film plus court que la voix");
  });
});

describe("lecture du texte des fichiers", () => {
  it("la branche sans film de TutorielOutil garde `PlanDeScenes`", () => {
    const t = readFileSync("studio-rendu/compositions/plan-scenes/TutorielOutil.tsx", "utf8");
    expect(t).toContain("<PlanDeScenes plan={p.plan} />");
    expect(t).toContain("<CalquePlanScenes plan={p.plan} />");
  });
  it("NavigationFilmee.tsx : couleurs de CHARTE_AXION seulement", () => {
    const t = readFileSync("studio-rendu/compositions/plan-scenes/NavigationFilmee.tsx", "utf8");
    expect(t).toContain("CHARTE_AXION");
    expect(t).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(t).not.toMatch(/blue|yellow|bleu|jaune/i);
    expect(t).not.toMatch(/from "@\//);
    expect(t).not.toMatch(/catalogue/);
  });
});
