/**
 * QUALL-9 (tour 3) : mouvement continu à toute image, marges, fin tenue, soulignement net, mots clés, formes, repère de bande.
 * Sur le story-board de l'essai construit par la vraie déduction (script d'essai, minuterie sans voix).
 */
import { describe, expect, it } from "vitest";
import { storyboardVideoLongue } from "../../../src/moteurs/montage-video-longue/storyboard";
import { motCle } from "../../../src/moteurs/montage-video-longue/deduction";
import { ORIGINE_ZOOM_Y, ZOOM_SCENE, formeDeListe, poserScene, poserSousTitre, repereChapitre, sousTitreRedondant } from "../../../src/moteurs/montage-video-longue/mise-en-page";
import { TEMPS_LONGUE, ZONES_LONGUE, type ElementPose, type MotLu, type SceneLongue, type StoryboardVideoLongue, type TempsStoryboard } from "../../../src/moteurs/montage-video-longue/storyboard-types";

const SCRIPT = `Le problème : compter à la main

Beaucoup de dirigeants suivent encore leur stock dans un tableur rempli à la main. Chaque fin de mois, quelqu'un passe une journée entière à compter les étagères. Les chiffres sont faux dès le lendemain. Une rupture se découvre quand un client appelle. On commande alors en urgence, plus cher. Et personne ne sait vraiment ce qui dort au fond de l'entrepôt.

La solution : un tableau de bord qui se met à jour seul

Le tableau de bord lit chaque vente et chaque livraison au moment où elles arrivent. En haut, trois chiffres : la valeur du stock, les articles bientôt épuisés, et les commandes en attente. Juste en dessous, la liste des articles à commander, triée par urgence. Un clic sur un article montre son historique sur douze mois. Plus besoin de compter : le stock est juste à chaque instant.

Les alertes : savoir avant de manquer

Pour chaque article, vous fixez un seuil minimum. Dès que le stock passe sous ce seuil, un message part automatiquement à la bonne personne. Le message dit quoi commander et en quelle quantité. Chaque lundi matin, un résumé de la semaine arrive dans votre boîte. Vous savez avant de manquer, et plus jamais par un client mécontent.

Par où commencer

Commencez petit. Choisissez les vingt articles qui se vendent le plus. Reliez le tableau de bord à votre outil de vente pour ces vingt articles. Vérifiez pendant deux semaines que les chiffres sont justes. Ajoutez ensuite le reste du catalogue, famille par famille. Pour en parler avec nous, prenez rendez-vous.`;
const QUESTION = "Comment suivre ses stocks sans y passer des heures ?";

function fabriquerTemps(script: string): TempsStoryboard {
  const blocs = script.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const mots: MotLu[] = [];
  const chapitres: TempsStoryboard["chapitres"] = [];
  let t = TEMPS_LONGUE.cartonTitreMs;
  for (let i = 0; i < blocs.length; i += 2) {
    const debut = i === 0 ? 0 : t;
    t += TEMPS_LONGUE.cartonChapitreMs;
    for (const phrase of blocs[i + 1].split(/(?<=[.!?…])\s+/)) {
      const ws = phrase.split(/\s+/);
      const dur = Math.max(TEMPS_LONGUE.phraseMinMs, (ws.length / TEMPS_LONGUE.motsParSeconde) * 1000);
      ws.forEach((mot, k) => mots.push({ mot, debutSec: Math.round(t + (k * dur) / ws.length) / 1000, finSec: Math.round(t + ((k + 1) * dur) / ws.length) / 1000 }));
      t += dur + TEMPS_LONGUE.respirationMs;
    }
    chapitres.push({ debutSec: debut / 1000, finSec: 0, libelle: blocs[i] });
  }
  t += TEMPS_LONGUE.finMs;
  chapitres.forEach((c, k) => (c.finSec = k + 1 < chapitres.length ? chapitres[k + 1].debutSec : t / 1000));
  return { mots, chapitres, dureeSec: t / 1000 };
}

const sb: StoryboardVideoLongue = storyboardVideoLongue({ question: QUESTION }, fabriquerTemps(SCRIPT));
const sceneA = (t: number): SceneLongue | undefined => sb.scenes.find((s) => t >= s.debutMs && t < s.finMs);
const estProgres = (e: ElementPose) => /:progres|:seg\d/.test(e.id);

/** Vrai si un élément (hors barre de progression) a bougé d'au moins 6 px, ou changé d'échelle d'au moins 1 %. */
function aBouge(a: ElementPose[], b: ElementPose[]): boolean {
  const ids = new Map(b.filter((e) => !estProgres(e)).map((e) => [e.id, e]));
  return a
    .filter((e) => !estProgres(e))
    .some((e) => {
      const f = ids.get(e.id);
      if (!f || e.rect.largeur < 1 || e.rect.hauteur < 1) return false;
      const echelle = Math.max(Math.abs(f.rect.largeur - e.rect.largeur) / e.rect.largeur, Math.abs(f.rect.hauteur - e.rect.hauteur) / e.rect.hauteur);
      return Math.hypot(f.rect.x - e.rect.x, f.rect.y - e.rect.y) >= 6 || echelle >= 0.01;
    });
}

describe("mouvement : à toute image, autre chose que la barre de progression bouge", () => {
  it("à t et t + 300 ms, un élément de contenu a bougé (≥ 6 px) ou changé d'échelle (≥ 1 %), toutes les 100 ms de la vidéo (donc aussi toutes les 500 ms)", () => {
    const rates: string[] = [];
    for (let t = 0; t + 300 < sb.dureeMs; t += 100) {
      const s = sceneA(t);
      if (!s || t + 300 >= s.finMs) continue;
      if (!aBouge(poserScene(s, t), poserScene(s, t + 300))) rates.push(`${s.id} (${s.type}) à ${t} ms`);
    }
    expect(rates).toEqual([]);
  });
});

describe("marges", () => {
  it("rien à moins de 80 px du haut, et au moins 40 px entre le contenu et la barre de progression", () => {
    const BARRE = ZONES_LONGUE.scene.y + ZONES_LONGUE.scene.hauteur - 14;
    for (const s of sb.scenes) {
      for (let t = s.debutMs; t < s.finMs; t += 100) {
        for (const e of poserScene(s, t)) {
          if (e.opacite <= 0 || estProgres(e)) continue;
          expect(e.rect.y, `${e.id} à ${t} ms`).toBeGreaterThanOrEqual(80);
          if (s.type !== "carton-titre" && s.type !== "carton-chapitre" && s.type !== "fin") expect(ORIGINE_ZOOM_Y - (ORIGINE_ZOOM_Y - e.rect.y) * ZOOM_SCENE, `${e.id} à ${t} ms (après zoom)`).toBeGreaterThanOrEqual(100);
          if (s.type !== "carton-titre" && s.type !== "carton-chapitre" && s.type !== "fin") expect(e.rect.y + e.rect.hauteur, `${e.id} à ${t} ms`).toBeLessThanOrEqual(BARRE - 40);
        }
      }
    }
  });
});

describe("étapes : jusqu'à cinq sur une même scène, toutes lues restent affichées", () => {
  it("à la fin, les cinq cartes sont posées dans la zone", () => {
    const e = sb.scenes.find((s) => s.type === "etapes")!;
    const els = poserScene(e, e.finMs - 100);
    expect(els.filter((x) => /:carte\d$/.test(x.id))).toHaveLength(5);
    // Une fois lue, une étape ne disparaît plus.
    let vues = 0;
    for (let t = e.debutMs; t < e.finMs; t += 100) {
      const n = poserScene(e, t).filter((x) => /:carte\d$/.test(x.id) && x.opacite > 0).length;
      expect(n).toBeGreaterThanOrEqual(vues);
      vues = n;
    }
  });
  it("1 ou 2 éléments : icône à droite et texte ≥ 60 px ; 3 ou plus : pas d'icône, pleine largeur, texte ≥ 56 px (≥ 52 px avec 5 étapes)", () => {
    for (const s of sb.scenes) {
      if (s.type !== "etapes" && !(s.type === "liste" && s.compte === null)) continue;
      const els = poserScene(s, s.finMs - 200);
      const n = s.elements.length;
      const f = els.find((x) => x.nature === "forme");
      const textes = els.filter((x) => /:texte\d$/.test(x.id));
      expect(textes, s.id).toHaveLength(n);
      for (const x of textes) {
        expect(x.lignes!.length, `${x.id}`).toBeLessThanOrEqual(2);
        expect(x.taillePx!, `${x.id}`).toBeGreaterThanOrEqual(n <= 2 ? 60 : s.type === "etapes" && n >= 5 ? 52 : 56);
      }
      if (n <= 2) {
        expect(f, s.id).toBeDefined();
        expect(f!.rect.largeur).toBeGreaterThanOrEqual(400);
      } else {
        expect(f, s.id).toBeUndefined();
        expect(Math.max(...els.filter((x) => /:carte\d$/.test(x.id)).map((x) => x.rect.x + x.rect.largeur))).toBeGreaterThan(1700);
      }
    }
  });
  it("5 étapes : marge haute ≥ 100 px, étapes à venir en filigrane dès le début, numéros visibles", () => {
    const e = sb.scenes.find((s) => s.type === "etapes")!;
    const els = poserScene(e, e.debutMs + 1000);
    expect(els.filter((x) => /:num\d$/.test(x.id))).toHaveLength(5);
    expect(els.filter((x) => /:carte\d$/.test(x.id)).length).toBeLessThanOrEqual(2);
    // Après le zoom 1,08 autour de y = 440, le haut du bloc reste à 100 px de l'écran au moins.
    for (const x of poserScene(e, e.debutMs + 3000)) if (!/:progres/.test(x.id)) expect(ORIGINE_ZOOM_Y - (ORIGINE_ZOOM_Y - x.rect.y) * ZOOM_SCENE, x.id).toBeGreaterThanOrEqual(100);
  });
  it("deux scènes voisines n'ont jamais la même icône de liste ou d'étapes", () => {
    const formes = (s: SceneLongue) => poserScene(s, s.debutMs + 1000).find((x) => x.nature === "forme" && /:forme$/.test(x.id))?.forme;
    sb.scenes.forEach((s, i) => {
      const p = sb.scenes[i - 1];
      if (i === 0 || (s.type !== "liste" && s.type !== "etapes") || (p.type !== "liste" && p.type !== "etapes")) return;
      const a = formes(s);
      if (a) expect(a, s.id).not.toBe(formes(p));
    });
    expect(formeDeListe(["Un message part"], "etapes", "s09")).not.toBe(formeDeListe(["Un message part"], "etapes", "s10"));
  });
  it("tuiles : posées dès le début en contour terracotta, pastille accolée au titre avec le compte final", () => {
    const l = sb.scenes.find((s) => s.type === "liste" && s.compte !== null && s.elements.length <= 4)!;
    const els = poserScene(l, l.debutMs + 700);
    const tuiles = els.filter((x) => /:tuile\d$/.test(x.id));
    expect(tuiles).toHaveLength(l.elements.length);
    expect(tuiles.every((x) => x.bordure === "terracotta")).toBe(true);
    const titre = els.find((x) => x.id.endsWith(":titre"))!;
    const pastille = els.find((x) => x.id.endsWith(":pastille"))!;
    expect(pastille.rect.x - (titre.rect.x + titre.rect.largeur)).toBeLessThanOrEqual(80);
    expect(els.find((x) => x.id.endsWith(":compte"))!.lignes![0][0].texte).toBe(String(l.compte));
  });
  it("formeDeListe : sens juste", () => {
    expect(formeDeListe(["Un message part"], "etapes")).toBe("cloche");
    expect(formeDeListe(["Commencez petit"], "etapes")).toBe("liste");
  });
});

describe("fin : carte entière à +1 s, tenue jusqu'à la fin", () => {
  it("logo, question, bouton, adresse pleins de +1 s à la dernière image", () => {
    const f = sb.scenes.find((s) => s.type === "fin")!;
    expect(f.finMs - f.debutMs).toBeGreaterThanOrEqual(4000);
    for (let tl = 1000; tl < f.finMs - f.debutMs; tl += 40) {
      const els = poserScene(f, f.debutMs + tl);
      for (const suffixe of [":question", ":bouton", ":appel", ":adresse"]) expect(els.find((e) => e.id.endsWith(suffixe))!.opacite, `${suffixe} à +${tl} ms`).toBe(1);
    }
  });
});

describe("soulignement et mot clé", () => {
  it("jamais de ponctuation dans la partie en accent d'une phrase clé", () => {
    for (const s of sb.scenes) {
      if (s.type !== "phrase-cle") continue;
      for (const e of poserScene(s, s.finMs - 100)) for (const l of e.lignes ?? []) for (const m of l) if (m.accent) expect(m.texte, `${s.id}`).not.toMatch(/[.,;:!?…]/);
    }
    // « manquer, » : le mot clé est « manquer », la virgule reste hors du trait.
    const p = sb.scenes.find((s) => s.type === "phrase-cle" && /client mécontent/.test(s.phrase));
    if (p?.type !== "phrase-cle") throw new Error("scène");
    expect(p.motCle).not.toMatch(/[,.]/);
    const t = poserScene(p, p.finMs - 100).find((e) => e.id.endsWith(":phrase"))!;
    const morceaux = t.lignes!.flat();
    expect(morceaux.map((m) => m.texte).join("")).toContain("manquer, ");
    expect(morceaux.filter((m) => m.accent).every((m) => !/[,]/.test(m.texte))).toBe(true);
  });
  it("préfère un mot du titre, le comparatif « plus + adjectif », jamais un verbe banal", () => {
    const ctx = (titre: string, texteChapitre = "") => ({ titre, texteChapitre });
    expect(motCle("On commande alors en urgence, plus cher", ctx("Le problème : compter à la main"))).toBe("plus cher");
    expect(motCle("Vous savez avant de manquer, et plus jamais par un client mécontent", ctx("Les alertes : savoir avant de manquer"))).toMatch(/^(avant|manquer)$/);
    expect(motCle("Beaucoup de dirigeants suivent encore leur stock dans un tableur rempli à la main", ctx("Le problème : compter à la main"))).toBe("main");
    expect(motCle("On commande", ctx("Autre titre"))).not.toBe("commande");
  });
  it("jamais deux fois la même forme dans un chapitre (phrases clés)", () => {
    for (const c of sb.chapitres) {
      const formes = sb.scenes.filter((s) => s.chapitreId === c.id && s.type === "phrase-cle").map((s) => (s.type === "phrase-cle" ? s.forme : ""));
      expect(new Set(formes).size, c.titre).toBe(formes.length);
    }
  });
});

describe("bande de sous-titres : repère du chapitre quand la scène répète la phrase", () => {
  it("phrase clé entière → repère ; sous-titre normal sinon", () => {
    const s = sb.scenes.find((x) => x.type === "phrase-cle")!;
    const l = sb.sousTitres.find((x) => x.debutMs >= s.debutMs - 50 && x.debutMs < s.finMs)!;
    expect(sousTitreRedondant(s, l)).toBe(true);
    const chap = sb.chapitres.find((c) => c.id === s.chapitreId)!;
    const repere = repereChapitre(chap.rang, chap.titre);
    expect(repere).toBe("01 · Le problème : compter à la main");
    const e = poserSousTitre(l, l.debutMs + 600, repere)!;
    expect(e.lignes!.flat().map((m) => m.texte).join("")).toBe(repere);
    expect(e.taillePx).toBeGreaterThanOrEqual(44);
    expect(e.opacite).toBeLessThan(1);
    const avantApres = sb.scenes.find((x) => x.type === "avant-apres");
    if (avantApres) expect(sousTitreRedondant(avantApres, l)).toBe(false);
    expect(poserSousTitre(l, l.debutMs + 600)!.lignes!.map((x) => x.map((m) => m.texte).join("")).join(" ")).toBe(l.texte.replace(/\s+/g, " "));
  });
});
