/**
 * QUALL-9 (tour 3) : mouvement continu à toute image, marges, fin tenue, soulignement net, mots clés, formes, repère de bande.
 * Sur le story-board de l'essai construit par la vraie déduction (script d'essai, minuterie sans voix).
 */
import { describe, expect, it } from "vitest";
import { storyboardVideoLongue } from "../../../src/moteurs/montage-video-longue/storyboard";
import { motCle } from "../../../src/moteurs/montage-video-longue/deduction";
import { ZOOM_SCENE, formeDeListe, opacitesTransition, poserScene, zoomScene, poserSousTitre, repereChapitre, sousTitreRedondant } from "../../../src/moteurs/montage-video-longue/mise-en-page";
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
          const z = zoomScene(s, t);
          expect(z.y - (z.y - e.rect.y) * z.echelle, `${e.id} à ${t} ms (après zoom réel)`).toBeGreaterThanOrEqual(78);
          if (s.type !== "carton-titre" && s.type !== "carton-chapitre" && s.type !== "fin") expect(e.rect.y + e.rect.hauteur, `${e.id} à ${t} ms`).toBeLessThanOrEqual(BARRE - 40);
        }
      }
    }
  });
});

describe("étapes : trois au plus par scène (3 + 2), texte ≥ 64 px", () => {
  it("5 étapes = deux scènes (1 à 3, puis 4 à 5) ; une fois lue, une étape ne disparaît plus", () => {
    const es = sb.scenes.filter((s) => s.type === "etapes");
    expect(es.map((s) => (s.type === "etapes" ? [s.numeroDepart, s.elements.length] : []))).toEqual([[1, 3], [4, 2]]);
    for (const e of es) {
      expect(poserScene(e, e.finMs - 100).filter((x) => /:carte\d$/.test(x.id))).toHaveLength(e.type === "etapes" ? e.elements.length : 0);
      let vues = 0;
      for (let t = e.debutMs; t < e.finMs; t += 100) {
        const n = poserScene(e, t).filter((x) => /:carte\d$/.test(x.id) && x.opacite > 0).length;
        expect(n).toBeGreaterThanOrEqual(vues);
        vues = n;
      }
    }
  });
  it("étapes : toujours toute la largeur, jamais d'icône, texte ≥ 64 px sur 2 lignes au plus, 32 px de marge intérieure ; listes : même taille partout", () => {
    const taillesListes = new Set<number>();
    for (const s of sb.scenes) {
      if (s.type !== "etapes" && !(s.type === "liste" && s.compte === null)) continue;
      const els = poserScene(s, s.finMs - 200);
      const n = s.elements.length;
      const f = els.find((x) => x.nature === "forme");
      const textes = els.filter((x) => /:texte\d$/.test(x.id));
      expect(textes, s.id).toHaveLength(n);
      for (const x of textes) {
        expect(x.lignes!.length, `${x.id}`).toBeLessThanOrEqual(2);
        if (s.type === "etapes") expect(x.taillePx!, `${x.id}`).toBeGreaterThanOrEqual(64);
        else taillesListes.add(Math.round(x.taillePx! / 1.0));
      }
      if (s.type === "etapes") {
        expect(f, `${s.id} : pas d'icône`).toBeUndefined();
        expect(Math.max(...els.filter((x) => /:carte\d$/.test(x.id)).map((x) => x.rect.x + x.rect.largeur)), s.id).toBeGreaterThan(1700);
        for (let i = 0; i < n; i++) {
          const c = els.find((x) => x.id === `${s.id}:carte${i}`)!;
          const t = els.find((x) => x.id === `${s.id}:texte${i}`)!;
          expect(t.rect.x - c.rect.x, `${s.id} marge gauche`).toBeGreaterThanOrEqual(32);
          expect(c.rect.x + c.rect.largeur - (t.rect.x + t.rect.largeur), `${s.id} marge droite`).toBeGreaterThanOrEqual(32);
        }
      }
    }
    // Toutes les listes ont le même corps (à la pulsation de la carte active près : 4 % au plus).
    const lt = [...taillesListes];
    expect(Math.max(...lt) / Math.min(...lt), "même taille dans toutes les listes").toBeLessThanOrEqual(1.05);
    expect(Math.min(...lt)).toBeGreaterThanOrEqual(56);
  });
  it("étapes : un trait terracotta avance en continu le long du connecteur vers l'étape suivante", () => {
    const e = sb.scenes.find((s) => s.type === "etapes")!;
    const hauteurs: number[] = [];
    for (let t = e.debutMs + 3000; t < e.debutMs + 3900; t += 100) {
      const a = poserScene(e, t).find((x) => /:avance\d$/.test(x.id));
      if (a) hauteurs.push(a.rect.hauteur);
    }
    expect(hauteurs.length).toBeGreaterThan(5);
    expect(Math.max(...hauteurs) - Math.min(...hauteurs)).toBeGreaterThan(20);
  });
  it("repère : la bande ne répète pas une phrase dont tous les mots sont à l'écran (titre + éléments)", () => {
    const l = sb.scenes.find((s) => s.type === "liste" && s.compte !== null)!;
    const ligne = sb.sousTitres.find((x) => x.debutMs >= l.debutMs - 50 && x.debutMs < l.finMs)!;
    expect(sousTitreRedondant(l, ligne)).toBe(true);
    expect(ligne.texte).toContain(" et ");
    expect(sousTitreRedondant(l, { ...ligne, texte: ligne.texte + " Une phrase de plus qui n'est pas à l'écran." })).toBe(false);
  });
  it("étapes : numéros ≥ 72 px dans des disques ≥ 96 px, marge haute ≥ 120 px, ≥ 24 px entre le disque et le cadre de la carte active", () => {
    for (const e of sb.scenes.filter((s) => s.type === "etapes")) {
      const els = poserScene(e, e.debutMs + 1500);
      for (const x of els.filter((y) => /:num\d$/.test(y.id))) expect(x.taillePx!).toBeGreaterThanOrEqual(72);
      for (const x of els.filter((y) => /:disque\d$/.test(y.id))) expect(x.rect.largeur).toBeGreaterThanOrEqual(96);
      for (let t = e.debutMs + 1500; t < e.finMs; t += 100) {
        const tout = poserScene(e, t);
        for (const x of tout) if (!/:progres/.test(x.id)) expect(x.rect.y, x.id).toBeGreaterThanOrEqual(120);
        const act = tout.find((x) => /:carte\d$/.test(x.id) && x.bordure === "terracotta");
        if (act) {
          const i = /(\d+)$/.exec(act.id)![1];
          const d = tout.find((x) => x.id === `${e.id}:disque${i}`)!;
          expect(act.rect.x - (d.rect.x + d.rect.largeur), `disque ${i} à ${t} ms`).toBeGreaterThanOrEqual(24);
        }
      }
    }
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
  it("tuiles : en cascade avant +1,5 s, une seule à bord terracotta (celle qu'on lit), pastille accolée au titre avec le compte final", () => {
    const l = sb.scenes.find((s) => s.type === "liste" && s.compte !== null && s.elements.length <= 4)!;
    if (l.type !== "liste") throw new Error("type");
    const els = poserScene(l, l.debutMs + 1500);
    const tuiles = els.filter((x) => /:tuile\d$/.test(x.id));
    expect(tuiles).toHaveLength(l.elements.length);
    expect(tuiles.filter((x) => x.bordure === "terracotta")).toHaveLength(1);
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

describe("zoom de scène calculé dans la mise en page (tour 6)", () => {
  it("après zoom, aucun élément à moins de 100 px des bords gauche et droit ni de 80 px du haut ; rien ne gêne la bande", () => {
    let zoomMax = 1;
    for (const s of sb.scenes) {
      const bas = s.type !== "carton-titre" && s.type !== "carton-chapitre" && s.type !== "fin" ? 892 : 1002;
      for (let t = s.debutMs; t < s.finMs; t += 100) {
        const z = zoomScene(s, t);
        zoomMax = Math.max(zoomMax, z.echelle);
        expect(z.echelle).toBeLessThanOrEqual(ZOOM_SCENE + 1e-9);
        for (const e of poserScene(s, t)) {
          if (e.opacite <= 0) continue;
          const px = (x: number) => z.x - (z.x - x) * z.echelle;
          const py = (y: number) => z.y - (z.y - y) * z.echelle;
          if (!estProgres(e)) {
            expect(px(e.rect.x), `${e.id} à ${t} ms (gauche)`).toBeGreaterThanOrEqual(98);
            expect(px(e.rect.x + e.rect.largeur), `${e.id} à ${t} ms (droite)`).toBeLessThanOrEqual(1822);
          }
          expect(py(e.rect.y), `${e.id} à ${t} ms (haut)`).toBeGreaterThanOrEqual(78);
          expect(py(e.rect.y + e.rect.hauteur), `${e.id} à ${t} ms (bas)`).toBeLessThanOrEqual(bas);
        }
      }
    }
    expect(zoomMax).toBeGreaterThan(1.01);
  });
});

describe("bande : repère vu par le contrôle, deux lignes au plus, jamais d'ellipse", () => {
  it("poserSousTitreDe applique le repère ; le contrôle reste propre avec ce poseur", async () => {
    const { controlerStoryboard } = await import("../../../src/moteurs/montage-video-longue/controle");
    const { poserSousTitreDe } = await import("../../../src/moteurs/montage-video-longue/mise-en-page");
    const poseur = poserSousTitreDe(sb);
    const s = sb.scenes.find((x) => x.type === "phrase-cle")!;
    const l = sb.sousTitres.find((x) => x.debutMs >= s.debutMs - 50 && x.debutMs < s.finMs)!;
    const e = poseur(l, l.debutMs + 600)!;
    expect(e.lignes!.map((x) => x.map((m) => m.texte).join("")).join(" ")).toMatch(/^01 · /);
    const c = controlerStoryboard(sb, { scene: poserScene, sousTitre: poseur });
    expect(c.alertes.filter((a) => a.critere === "lisibilite" || a.code === "hors-cadre")).toEqual([]);
  });
  it("repère toujours sur UNE ligne : « 02 · titre complet » trop long → « 02 · » + partie avant « : », puis dernier mot entier, sans ellipse", () => {
    const l = { texte: "x", debutMs: 0, finMs: 3000 };
    const long = "02 · " + Array.from({ length: 40 }, (_, i) => `mot${i}`).join(" ");
    const e = poserSousTitre(l, 1000, long)!;
    expect(e.lignes!.length).toBe(1);
    const texte = e.lignes!.map((x) => x.map((m) => m.texte).join("")).join(" ");
    expect(texte).not.toContain("…");
    expect(long.startsWith(texte)).toBe(true);
    expect(e.taillePx!).toBeGreaterThanOrEqual(52);
    const titre = "02 · La solution : un tableau de bord qui se met à jour seul avec des mots en plus pour dépasser la ligne unique de la bande";
    const e2 = poserSousTitre(l, 1000, titre)!;
    expect(e2.lignes!.length).toBe(1);
    expect(e2.lignes!.map((x) => x.map((m) => m.texte).join("")).join("")).toBe("02 · La solution");
  });
});

describe("tour 8 : transitions sans superposition, carton de titre, frise du chiffre, pulsation", () => {
  it("à aucun instant deux scènes n'ont chacune une opacité > 0 (fondu par l'ivoire, fondu au noir vers un carton)", () => {
    for (const type of ["fondu", "glisse", "volet"] as const) {
      for (let tl = 0; tl <= 600; tl += 5) {
        const o = opacitesTransition(type, tl);
        expect(o.sortie > 0 && o.entree > 0, `${type} à +${tl} ms`).toBe(false);
        expect(o.sortie).toBeGreaterThanOrEqual(0);
        expect(o.entree).toBeLessThanOrEqual(1);
      }
      expect(opacitesTransition(type, opacitesTransition(type, 0).duree).entree).toBe(1);
    }
    // Un seul trou : l'image intermédiaire (ivoire) dure un instant, jamais plus de 40 ms entre deux contenus.
    expect([0, 200, 400].map((tl) => opacitesTransition("fondu", tl).entree)).toEqual([0, 0, 1]);
  });
  it("carton de titre : question ≥ 96 px, bloc centré verticalement dans le plein cadre", () => {
    const c = sb.scenes.find((s) => s.type === "carton-titre")!;
    const els = poserScene(c, c.debutMs + 3000).filter((e) => e.opacite > 0 && !/:progres|:forme|:barre/.test(e.id));
    const q = els.find((e) => e.id.endsWith(":question"))!;
    expect(q.taillePx!).toBeGreaterThanOrEqual(96);
    const haut = Math.min(...els.map((e) => e.rect.y));
    const bas = Math.max(...els.map((e) => e.rect.y + e.rect.hauteur));
    expect(Math.abs((haut + bas) / 2 - 540)).toBeLessThanOrEqual(20);
  });
  it("chiffre : blocs au repos gris de la charte, un seul bloc terracotta plein, cadre centré sur lui (bloc + 8 px), 16 px entre blocs", () => {
    const c = sb.scenes.find((s) => s.type === "chiffre" && s.chiffres.length === 1 && s.chiffres[0].valeur === 12)!;
    for (const dt of [2500, 3200, 4100, 5000]) {
      const els = poserScene(c, c.debutMs + dt);
      const blocs = els.filter((e) => /:bloc\d+$/.test(e.id));
      expect(blocs).toHaveLength(12);
      expect(new Set(blocs.map((e) => e.fond)), "gris de la charte").toEqual(new Set(["gris"]));
      const pleins = els.filter((e) => /:bloc\d+-plein$/.test(e.id));
      expect(pleins).toHaveLength(1);
      expect(pleins[0].fond).toBe("terracotta");
      expect(pleins[0].opacite).toBe(1);
      const i = /bloc(\d+)-plein/.exec(pleins[0].id)![1];
      const b = blocs.find((e) => e.id.endsWith(`:bloc${i}`))!;
      const cur = els.find((e) => e.id.endsWith(":curseur"))!;
      expect(cur.rect.largeur).toBeCloseTo(b.rect.largeur + 8, 0);
      expect(cur.rect.x + cur.rect.largeur / 2).toBeCloseTo(b.rect.x + b.rect.largeur / 2, 0);
      expect(cur.rect.y + cur.rect.hauteur / 2).toBeCloseTo(b.rect.y + b.rect.hauteur / 2, 0);
      const tries = [...blocs].sort((x, y) => x.rect.x - y.rect.x);
      for (let k = 1; k < tries.length; k++) expect(tries[k].rect.x - (tries[k - 1].rect.x + tries[k - 1].rect.largeur), "écart entre blocs").toBeGreaterThanOrEqual(16);
      // Le cadre ne touche jamais le voisin.
      for (const v of blocs) if (v !== b) expect(cur.rect.x + cur.rect.largeur <= v.rect.x || v.rect.x + v.rect.largeur <= cur.rect.x || cur.rect.y + cur.rect.hauteur <= v.rect.y || v.rect.y + v.rect.hauteur <= cur.rect.y, `cadre / ${v.id}`).toBe(true);
      expect(blocs[0].rect.largeur).toBeGreaterThanOrEqual(90);
    }
  });
  it("carte active : le groupe grossit jusqu'à 1,04 (jamais sous sa taille de base) et le filet respire vers l'extérieur", () => {
    const e = sb.scenes.find((s) => s.type === "etapes")!;
    const larg: number[] = [];
    const halo: number[] = [];
    let base = Infinity;
    for (let t = e.debutMs + 4000; t < e.debutMs + 5300; t += 50) {
      const els = poserScene(e, t);
      const act = els.find((x) => /:carte\d$/.test(x.id) && x.bordure === "terracotta");
      const h = els.find((x) => x.id.endsWith(":halo"));
      if (act && h) {
        larg.push(act.rect.largeur);
        halo.push(h.rect.largeur - act.rect.largeur);
        expect(h.rect.largeur, "le filet est plus large que la carte").toBeGreaterThan(act.rect.largeur);
        expect(h.rect.x, "le filet est à l'extérieur").toBeLessThan(act.rect.x);
      }
      const calme = els.filter((x) => /:carte\d$/.test(x.id) && x.bordure !== "terracotta");
      for (const c of calme) base = Math.min(base, c.rect.largeur);
    }
    expect(Math.max(...larg) / Math.min(...larg)).toBeGreaterThanOrEqual(1.035);
    expect(Math.max(...larg) / Math.min(...larg)).toBeLessThanOrEqual(1.045);
    expect(Math.min(...larg)).toBeGreaterThanOrEqual(base - 1);
    expect(Math.max(...halo) - Math.min(...halo)).toBeGreaterThanOrEqual(6);
  });
  it("listes et étapes : à chaque instant, le texte (et le numéro) est dans sa carte avec au moins 20 px d'air de chaque côté", () => {
    for (const s of sb.scenes) {
      if (s.type !== "etapes" && !(s.type === "liste" && s.compte === null)) continue;
      for (let t = s.debutMs + 1500; t < s.finMs; t += 100) {
        const els = poserScene(s, t);
        for (const c of els.filter((x) => /:carte\d$/.test(x.id) && x.opacite >= 0.99)) {
          const i = /(\d+)$/.exec(c.id)![1];
          for (const suffixe of ["texte", s.type === "liste" && !s.titre ? "num" : ""]) {
            if (!suffixe) continue;
            const x = els.find((y) => y.id === `${s.id}:${suffixe}${i}`)!;
            expect(x.rect.x - c.rect.x, `${x.id} (gauche) à ${t} ms`).toBeGreaterThanOrEqual(20);
            expect(c.rect.x + c.rect.largeur - (x.rect.x + x.rect.largeur), `${x.id} (droite) à ${t} ms`).toBeGreaterThanOrEqual(20);
            expect(x.rect.y - c.rect.y, `${x.id} (haut) à ${t} ms`).toBeGreaterThanOrEqual(20);
            expect(c.rect.y + c.rect.hauteur - (x.rect.y + x.rect.hauteur), `${x.id} (bas) à ${t} ms`).toBeGreaterThanOrEqual(20);
          }
        }
      }
    }
  });
});

describe("sous-titres de 56 px (52 px au plus bas), dans la bande, 2 lignes au plus", () => {
  it("chaque ligne du story-board d'essai tient en 2 lignes de 56 px dans la bande ; le repère aussi", () => {
    const bande = { y0: 900, y1: 1080 };
    for (const l of sb.sousTitres) {
      for (const repere of [undefined, "01 · Le problème : compter à la main"]) {
        const e = poserSousTitre(l, (l.debutMs + l.finMs) / 2, repere)!;
        expect(e.taillePx!, l.texte).toBeGreaterThanOrEqual(52);
        expect(e.lignes!.length).toBeLessThanOrEqual(2);
        expect(e.rect.y).toBeGreaterThanOrEqual(bande.y0);
        expect(e.rect.y + e.rect.hauteur).toBeLessThanOrEqual(bande.y1);
        if (!repere) expect(e.taillePx!, "les lignes du story-board tiennent à 56 px").toBe(56);
      }
    }
  });
});

describe("tour 10 : cartons de chapitre, tuiles, fin", () => {
  it("carton de chapitre : titre ≥ 110 px, numéro + titre + barres en un bloc centré, icône qui se dessine puis respire", () => {
    for (const c of sb.scenes.filter((s) => s.type === "carton-chapitre")) {
      const els = poserScene(c, c.debutMs + 2200).filter((e) => e.opacite > 0 && !/:forme/.test(e.id));
      expect(els.find((e) => e.id.endsWith(":titre"))!.taillePx!, c.id).toBeGreaterThanOrEqual(110);
      const haut = Math.min(...els.map((e) => e.rect.y));
      const bas = Math.max(...els.map((e) => e.rect.y + e.rect.hauteur));
      expect(Math.abs((haut + bas) / 2 - 540), `${c.id} centré`).toBeLessThanOrEqual(25);
      const titre = els.find((e) => e.id.endsWith(":titre"))!;
      const seg = els.find((e) => /:seg\d/.test(e.id))!;
      expect(seg.rect.y - (titre.rect.y + titre.rect.hauteur), "barres sous le titre").toBeLessThanOrEqual(80);
      const tailles = [1600, 2800, 3400, 3700].map((dt) => poserScene(c, c.debutMs + dt).find((e) => e.id.endsWith(":forme"))!.rect.largeur);
      expect(Math.max(...tailles) - Math.min(...tailles), "l'icône respire").toBeGreaterThan(5);
    }
  });
  it("tuiles : icône 180 px, libellé ≥ 60 px, bloc icône + libellé centré dans la tuile", () => {
    const l = sb.scenes.find((s) => s.type === "liste" && s.compte !== null && s.elements.length <= 4)!;
    const els = poserScene(l, l.finMs - 200);
    for (let i = 0; i < 3; i++) {
      const tuile = els.find((e) => e.id.endsWith(`:tuile${i}`))!;
      const ic = els.find((e) => e.id.endsWith(`:icone${i}`))!;
      const tx = els.find((e) => e.id.endsWith(`:texte${i}`))!;
      expect(ic.rect.largeur).toBeGreaterThanOrEqual(180);
      expect(tx.taillePx!).toBeGreaterThanOrEqual(60);
      const haut = ic.rect.y - tuile.rect.y;
      const bas = tuile.rect.y + tuile.rect.hauteur - (tx.rect.y + tx.rect.hauteur);
      expect(Math.abs(haut - bas), `tuile ${i} centrée verticalement`).toBeLessThanOrEqual(12);
      expect(Math.abs(ic.rect.x + ic.rect.largeur / 2 - (tuile.rect.x + tuile.rect.largeur / 2))).toBeLessThanOrEqual(6);
    }
  });
  it("fin : question ≥ 64 px, bloc centré verticalement", () => {
    const f = sb.scenes.find((s) => s.type === "fin")!;
    const els = poserScene(f, f.debutMs + 2000).filter((e) => !/:progres|:onde|:trait|:reflet/.test(e.id));
    expect(els.find((e) => e.id.endsWith(":question"))!.taillePx!).toBeGreaterThanOrEqual(64);
    const haut = Math.min(...els.map((e) => e.rect.y), 115);
    const bas = Math.max(...els.map((e) => e.rect.y + e.rect.hauteur));
    expect(Math.abs((haut + bas) / 2 - 540)).toBeLessThanOrEqual(40);
  });
});

describe("tour 11 : fin", () => {
  it("le soulignement sous la question se redessine en boucle (2,5 s)", () => {
    const f = sb.scenes.find((s) => s.type === "fin")!;
    const larg = (dt: number) => poserScene(f, f.debutMs + dt).find((e) => e.id.endsWith(":souligne"))!.rect.largeur;
    expect(larg(1000)).toBeGreaterThan(300);
    expect(larg(2500 + 100)).toBeLessThan(150);
    expect(larg(2500 + 1500)).toBeGreaterThan(300);
  });
});
