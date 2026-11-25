import { describe, expect, it } from "vitest";
import { storyboardVideoLongue } from "../../../src/moteurs/montage-video-longue/storyboard";
import { nombresEcrits } from "../../../src/moteurs/montage-video-longue/nombres";
import {
  TAILLES_LONGUE,
  TEMPS_LONGUE,
  type SceneLongue,
  type StoryboardVideoLongue,
  type TempsStoryboard,
  type MotLu,
} from "../../../src/moteurs/montage-video-longue/storyboard-types";

// Script d'essai (recopié de studio-rendu/scripts/essai-video-longue.ts) : 4 parties → 4 chapitres aux vrais titres.
const SCRIPT_ESSAI = `Le problème : compter à la main

Beaucoup de dirigeants suivent encore leur stock dans un tableur rempli à la main. Chaque fin de mois, quelqu'un passe une journée entière à compter les étagères. Les chiffres sont faux dès le lendemain. Une rupture se découvre quand un client appelle. On commande alors en urgence, plus cher. Et personne ne sait vraiment ce qui dort au fond de l'entrepôt.

La solution : un tableau de bord qui se met à jour seul

Le tableau de bord lit chaque vente et chaque livraison au moment où elles arrivent. En haut, trois chiffres : la valeur du stock, les articles bientôt épuisés, et les commandes en attente. Juste en dessous, la liste des articles à commander, triée par urgence. Un clic sur un article montre son historique sur douze mois. Plus besoin de compter : le stock est juste à chaque instant.

Les alertes : savoir avant de manquer

Pour chaque article, vous fixez un seuil minimum. Dès que le stock passe sous ce seuil, un message part automatiquement à la bonne personne. Le message dit quoi commander et en quelle quantité. Chaque lundi matin, un résumé de la semaine arrive dans votre boîte. Vous savez avant de manquer, et plus jamais par un client mécontent.

Par où commencer

Commencez petit. Choisissez les vingt articles qui se vendent le plus. Reliez le tableau de bord à votre outil de vente pour ces vingt articles. Vérifiez pendant deux semaines que les chiffres sont justes. Ajoutez ensuite le reste du catalogue, famille par famille. Pour en parler avec nous, prenez rendez-vous.`;

const QUESTION = "Comment suivre ses stocks sans y passer des heures ?";

/** Temps conformes au § 3 du plan (minuterie sans voix) : trous pour les cartons, lecture à 2,6 mots/s, fin de 5 s. */
function fabriquerTemps(script: string, question: string | null, titres?: (string | undefined)[]): TempsStoryboard {
  const blocs = script.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const mots: MotLu[] = [];
  const chapitres: TempsStoryboard["chapitres"] = [];
  let t = question ? TEMPS_LONGUE.cartonTitreMs : 0;
  for (let i = 0; i < blocs.length; i += 2) {
    const rang = i / 2;
    const debut = rang === 0 ? 0 : t;
    t += TEMPS_LONGUE.cartonChapitreMs;
    for (const phrase of blocs[i + 1].split(/(?<=[.!?…])\s+/)) {
      const ws = phrase.split(/\s+/);
      const dur = Math.max(TEMPS_LONGUE.phraseMinMs, (ws.length / TEMPS_LONGUE.motsParSeconde) * 1000);
      ws.forEach((mot, k) => mots.push({ mot, debutSec: Math.round(t + (k * dur) / ws.length) / 1000, finSec: Math.round(t + ((k + 1) * dur) / ws.length) / 1000 }));
      t += dur + TEMPS_LONGUE.respirationMs;
    }
    chapitres.push({ debutSec: debut / 1000, finSec: 0, libelle: titres && rang in titres ? (titres[rang] ?? "") : blocs[i] });
  }
  t += TEMPS_LONGUE.finMs;
  chapitres.forEach((c, k) => (c.finSec = k + 1 < chapitres.length ? chapitres[k + 1].debutSec : t / 1000));
  return { mots, chapitres, dureeSec: t / 1000 };
}

const temps = fabriquerTemps(SCRIPT_ESSAI, QUESTION);
const sb: StoryboardVideoLongue = storyboardVideoLongue({ question: QUESTION }, temps);
const contenu = (s: SceneLongue) => !["carton-titre", "carton-chapitre", "fin"].includes(s.type);
const norm = (t: string) => t.toLocaleLowerCase("fr").replace(/\s+/g, " ");
const scriptNorm = norm(SCRIPT_ESSAI);

describe("storyboard de l'essai : structure", () => {
  it("version, format, durée et question", () => {
    expect(sb.version).toBe("storyboard-longue-1");
    expect(sb.dureeMs).toBe(Math.round(temps.dureeSec * 1000));
    expect(sb.question).toBe(QUESTION);
  });

  it("scènes contiguës de 0 à dureeMs, sans trou ni chevauchement", () => {
    expect(sb.scenes[0].debutMs).toBe(0);
    expect(sb.scenes[sb.scenes.length - 1].finMs).toBe(sb.dureeMs);
    sb.scenes.forEach((s, i) => {
      expect(s.finMs).toBeGreaterThan(s.debutMs);
      if (i + 1 < sb.scenes.length) expect(s.finMs).toBe(sb.scenes[i + 1].debutMs);
    });
  });

  it("identifiants de scène uniques, chapitres existants", () => {
    expect(new Set(sb.scenes.map((s) => s.id)).size).toBe(sb.scenes.length);
    const ids = new Set(sb.chapitres.map((c) => c.id));
    for (const s of sb.scenes) expect(ids.has(s.chapitreId)).toBe(true);
  });

  it("carton-titre au début : la question, 3 s, fond ivoire", () => {
    const [s] = sb.scenes;
    expect(s.type).toBe("carton-titre");
    if (s.type === "carton-titre") expect(s.question).toBe(QUESTION);
    expect(s.finMs).toBe(3000);
    expect(s.fond).toBe("ivoire");
  });

  it("4 cartons de chapitre aux vrais titres (jamais « Chapitre n »)", () => {
    const cartons = sb.scenes.filter((s) => s.type === "carton-chapitre");
    expect(cartons.map((c) => (c.type === "carton-chapitre" ? c.titre : ""))).toEqual([
      "Le problème : compter à la main",
      "La solution : un tableau de bord qui se met à jour seul",
      "Les alertes : savoir avant de manquer",
      "Par où commencer",
    ]);
    cartons.forEach((c, i) => {
      if (c.type !== "carton-chapitre") return;
      expect(c.rang).toBe(i + 1);
      expect(c.total).toBe(4);
      expect(c.fond).toBe("noir");
      expect(c.entree).toBe("volet");
      expect(c.finMs - c.debutMs).toBe(TEMPS_LONGUE.cartonChapitreMs);
    });
    expect(sb.chapitres.map((c) => c.titre)).toEqual(cartons.map((c) => (c.type === "carton-chapitre" ? c.titre : "")));
    expect(sb.alertes.filter((a) => a.code === "titre-deduit")).toEqual([]);
  });

  it("chapitres contigus de 0 à dureeMs", () => {
    expect(sb.chapitres[0].debutMs).toBe(0);
    expect(sb.chapitres[3].finMs).toBe(sb.dureeMs);
    sb.chapitres.forEach((c, i) => {
      expect(c.rang).toBe(i + 1);
      if (i > 0) expect(c.debutMs).toBe(sb.chapitres[i - 1].finMs);
    });
  });

  it("fin « Prendre rendez-vous » sur noir, la dernière, 5 s", () => {
    const f = sb.scenes[sb.scenes.length - 1];
    expect(f.type).toBe("fin");
    if (f.type === "fin") {
      expect(f.appel).toBe("Prendre rendez-vous");
      expect(f.adresse).toBe("axion-ia.com");
      expect(f.question).toBe(QUESTION);
    }
    expect(f.fond).toBe("noir");
    expect(f.finMs - f.debutMs).toBe(5000);
    expect(sb.scenes.filter((s) => s.type === "fin")).toHaveLength(1);
  });

  it("adresse personnalisée", () => {
    const r = storyboardVideoLongue({ question: QUESTION, adresse: "exemple.fr" }, temps);
    const f = r.scenes[r.scenes.length - 1];
    if (f.type === "fin") expect(f.adresse).toBe("exemple.fr");
  });
});

describe("storyboard de l'essai : scènes déduites du texte", () => {
  it("liste « trois chiffres » : 3 éléments, compte 3, ils arrivent à leur lecture", () => {
    const l = sb.scenes.find((s) => s.type === "liste" && s.titre?.includes("trois chiffres"));
    expect(l?.type).toBe("liste");
    if (l?.type !== "liste") return;
    expect(l.titre).toBe("En haut, trois chiffres");
    expect(l.elements.map((e) => e.texte)).toEqual(["La valeur du stock", "Les articles bientôt épuisés", "Les commandes en attente"]);
    expect(l.compte).toBe(3);
    const t = l.elements.map((e) => e.apparitionMs);
    expect([...t].sort((a, b) => a - b)).toEqual(t);
    expect(new Set(t).size).toBe(3);
    expect(t[0]).toBeGreaterThanOrEqual(l.debutMs);
    expect(t[2]).toBeLessThan(l.finMs);
  });

  it("chiffre 12 « mois » (écrit « douze »)", () => {
    const c = sb.scenes.find((s) => s.type === "chiffre");
    expect(c?.type).toBe("chiffre");
    if (c?.type !== "chiffre") return;
    expect(c.chiffres).toHaveLength(1);
    expect(c.chiffres[0]).toMatchObject({ valeur: 12, ecrit: "douze", affiche: "12", unite: "mois" });
    expect(c.chiffres[0].apparitionMs).toBeGreaterThanOrEqual(c.debutMs);
    expect(c.chiffres[0].apparitionMs).toBeLessThan(c.finMs);
    expect(c.contexte.split(/\s+/).length).toBeLessThanOrEqual(12);
  });

  it("avant/après « compter » → « le stock est juste à chaque instant »", () => {
    const a = sb.scenes.find((s) => s.type === "avant-apres" && norm(s.avant) === "compter");
    expect(a?.type).toBe("avant-apres");
    if (a?.type !== "avant-apres") return;
    expect(norm(a.apres)).toBe("le stock est juste à chaque instant");
    expect(a.apparitionApresMs).toBeGreaterThan(a.debutMs);
    expect(a.apparitionApresMs).toBeLessThan(a.finMs);
  });

  it("avant/après « par un client mécontent » → « Vous savez avant de manquer »", () => {
    const a = sb.scenes.find((s) => s.type === "avant-apres" && norm(s.avant).includes("client mécontent"));
    expect(a?.type).toBe("avant-apres");
    if (a?.type !== "avant-apres") return;
    expect(a.avant).toBe("Par un client mécontent");
    expect(a.apres).toBe("Vous savez avant de manquer");
  });

  it("5 étapes en 2 scènes (1 à 3, puis 4 à 5)", () => {
    const e = sb.scenes.filter((s) => s.type === "etapes");
    expect(e).toHaveLength(2);
    if (e[0].type !== "etapes" || e[1].type !== "etapes") throw new Error("types");
    expect([e[0].numeroDepart, e[0].elements.length, e[1].numeroDepart, e[1].elements.length]).toEqual([1, 3, 4, 2]);
    expect(e[0].elements[0].texte).toBe("Commencez petit");
    expect(e[0].elements[1].accent).toBe("vingt");
    expect(e[1].elements[0].texte).toMatch(/^Vérifiez pendant deux semaines/);
    expect(e[1].elements[0].accent).toBe("deux");
  });

  it("aucun chiffre dans une phrase sans nombre ; tout chiffre vient du texte", () => {
    for (const s of sb.scenes) {
      if (s.type !== "chiffre") continue;
      expect(nombresEcrits(s.contexte).length).toBeGreaterThan(0);
      expect(s.chiffres.length).toBeLessThanOrEqual(2);
      for (const c of s.chiffres) expect(scriptNorm).toContain(norm(c.ecrit));
    }
    // « une journée entière » et « un clic » : jamais de chiffre 1.
    expect(sb.scenes.some((s) => s.type === "chiffre" && s.chiffres.some((c) => c.valeur === 1))).toBe(false);
  });

  it("phrase clé : phrase ≤ 12 mots, mot clé exact, forme présente, jamais deux formes pareilles de suite", () => {
    const pc = sb.scenes.filter((s) => s.type === "phrase-cle");
    expect(pc.length).toBeGreaterThan(0);
    for (const s of pc) {
      if (s.type !== "phrase-cle") continue;
      expect(s.phrase.split(/\s+/).length).toBeLessThanOrEqual(12);
      if (s.motCle) expect(s.phrase).toContain(s.motCle);
      expect(s.forme).toBeTruthy();
    }
    for (let i = 1; i < pc.length; i++) {
      const a = pc[i - 1];
      const b = pc[i];
      if (a.type === "phrase-cle" && b.type === "phrase-cle" && sb.scenes.indexOf(b) === sb.scenes.indexOf(a) + 1) expect(b.forme).not.toBe(a.forme);
    }
  });

  it("chaque texte affiché est une sous-chaîne du script (hors « … » et majuscule initiale)", () => {
    const verifier = (t: string) => {
      const net = norm(t.replace(/…$/, "").trim());
      expect(scriptNorm, `« ${t} »`).toContain(net);
    };
    for (const s of sb.scenes) {
      if (s.type === "carton-chapitre") verifier(s.titre);
      if (s.type === "liste") {
        if (s.titre) verifier(s.titre);
        s.elements.forEach((e) => verifier(e.texte));
      }
      if (s.type === "etapes") s.elements.forEach((e) => verifier(e.texte));
      if (s.type === "chiffre") verifier(s.contexte);
      if (s.type === "avant-apres") {
        verifier(s.avant);
        verifier(s.apres);
      }
      if (s.type === "phrase-cle") verifier(s.phrase);
    }
    sb.sousTitres.forEach((l) => verifier(l.texte));
  });

  it("les accents sont des sous-chaînes exactes de leur texte", () => {
    for (const s of sb.scenes) {
      if (s.type === "liste" || s.type === "etapes") for (const e of s.elements) if (e.accent) expect(e.texte).toContain(e.accent);
    }
  });
});

describe("storyboard de l'essai : rythme", () => {
  it("une scène de contenu dure au moins 1,6 s", () => {
    for (const s of sb.scenes.filter(contenu)) expect(s.finMs - s.debutMs).toBeGreaterThanOrEqual(TEMPS_LONGUE.sceneMinMs);
  });

  it("jamais 4 scènes du même type de suite", () => {
    for (let i = 3; i < sb.scenes.length; i++) {
      const t = sb.scenes[i].type;
      expect(sb.scenes.slice(i - 3, i).every((s) => s.type === t)).toBe(false);
    }
  });

  it("le story-board mêle au moins 5 types de scènes", () => {
    expect(new Set(sb.scenes.map((s) => s.type)).size).toBeGreaterThanOrEqual(7);
  });

  it("une scène longue (> 8 s) a des apparitions échelonnées", () => {
    for (const s of sb.scenes) {
      if (s.finMs - s.debutMs <= 8000) continue;
      const t = s.type === "liste" || s.type === "etapes" ? s.elements.map((e) => e.apparitionMs) : s.type === "chiffre" ? s.chiffres.map((c) => c.apparitionMs) : s.type === "avant-apres" ? [s.debutMs, s.apparitionApresMs] : [];
      expect(new Set(t).size, `${s.id} ${s.type}`).toBeGreaterThanOrEqual(2);
      expect(s.finMs - Math.max(...t)).toBeLessThanOrEqual(8000);
    }
  });

  it("transitions : volet avant un carton de chapitre, glisse entre types différents, fondu sinon", () => {
    sb.scenes.forEach((s, i) => {
      if (i === 0) return expect(s.entree).toBe("aucune");
      if (s.type === "carton-chapitre") return expect(s.entree).toBe("volet");
      if (s.type === "fin") return expect(s.entree).toBe("fondu");
      expect(s.entree).toBe(sb.scenes[i - 1].type !== s.type ? "glisse" : "fondu");
    });
  });

  it("fonds : noir pour les cartons de chapitre et la fin, ivoire ailleurs", () => {
    for (const s of sb.scenes) expect(s.fond).toBe(s.type === "carton-chapitre" || s.type === "fin" ? "noir" : "ivoire");
  });
});

describe("storyboard de l'essai : sous-titres", () => {
  it("une ligne par phrase entière quand elle tient (13 phrases lues + chapitres)", () => {
    expect(sb.sousTitres.length).toBeGreaterThanOrEqual(20);
    const phrases = SCRIPT_ESSAI.split(/\n\s*\n/).filter((_, i) => i % 2 === 1).join(" ").split(/(?<=[.!?…])\s+/);
    const jointes = sb.sousTitres.map((l) => l.texte).join(" ");
    expect(norm(jointes)).toBe(norm(phrases.join(" ")));
  });

  it("aucun sous-titre pendant les cartons et la fin", () => {
    const interdits = sb.scenes.filter((s) => ["carton-titre", "carton-chapitre", "fin"].includes(s.type));
    for (const l of sb.sousTitres) for (const c of interdits) expect(l.debutMs < c.finMs && l.finMs > c.debutMs, `${l.texte} / ${c.id}`).toBe(false);
  });

  it("chaque ligne dure au moins 1,2 s, dans l'ordre, sans chevauchement", () => {
    sb.sousTitres.forEach((l, i) => {
      expect(l.finMs - l.debutMs).toBeGreaterThanOrEqual(TEMPS_LONGUE.sousTitreMinMs);
      if (i > 0) expect(l.debutMs).toBeGreaterThanOrEqual(sb.sousTitres[i - 1].finMs);
    });
  });

  it("une phrase trop longue pour 2 lignes de 46 px est coupée en demi-phrases", () => {
    const longue = "Chaque matin, quelqu'un ouvre le tableur, recopie à la main toutes les lignes de toutes les familles du catalogue, vérifie une à une les quantités en rayon avec le responsable de l'entrepôt, puis envoie un message récapitulatif à toute l'équipe commerciale.";
    const t = fabriquerTemps(`Titre\n\n${longue}`, null);
    const r = storyboardVideoLongue({ question: null }, t);
    expect(r.sousTitres.length).toBeGreaterThanOrEqual(2);
    expect(r.sousTitres.map((l) => l.texte).join(" ")).toBe(longue);
    expect(r.sousTitres.length).toBeLessThanOrEqual(3);
    expect(TAILLES_LONGUE.sousTitreLignesMax).toBe(2);
  });
});

describe("storyboard : titres génériques et cas limites", () => {
  it("un libellé vide ou « Chapitre n » est remplacé par un titre tiré de la première phrase", () => {
    const t = fabriquerTemps(SCRIPT_ESSAI, QUESTION, ["", "Chapitre 2", "chapitre   3", undefined]);
    const r = storyboardVideoLongue({ question: QUESTION }, t);
    const titres = r.chapitres.map((c) => c.titre);
    expect(titres).toHaveLength(4);
    for (const x of titres) expect(x).not.toMatch(/^chapitre\s*\d*$/i);
    expect(titres[0]).toBe("Beaucoup de dirigeants suivent encore leur stock");
    expect(titres[1]).toBe("Le tableau de bord lit chaque vente");
    expect(r.alertes.filter((a) => a.code === "titre-deduit")).toHaveLength(4);
    for (const s of r.scenes) if (s.type === "carton-chapitre") expect(s.titre).not.toMatch(/^chapitre/i);
  });

  it("sans question : pas de carton de titre, le chapitre 1 commence par son carton", () => {
    const t = fabriquerTemps(SCRIPT_ESSAI, null);
    const r = storyboardVideoLongue({ question: null }, t);
    expect(r.question).toBeNull();
    expect(r.scenes[0].type).toBe("carton-chapitre");
    expect(r.scenes.some((s) => s.type === "carton-titre")).toBe(false);
    const f = r.scenes[r.scenes.length - 1];
    if (f.type === "fin") expect(f.question).toBeNull();
    expect(r.scenes[0].debutMs).toBe(0);
    expect(r.scenes[r.scenes.length - 1].finMs).toBe(r.dureeMs);
  });

  it("question blanche = pas de question", () => {
    const r = storyboardVideoLongue({ question: "   " }, fabriquerTemps(SCRIPT_ESSAI, null));
    expect(r.question).toBeNull();
  });

  it("avec voix (aucun trou) : pas de carton, alerte, rien ne casse, scènes contiguës", () => {
    const mots: MotLu[] = [];
    let t = 0;
    for (const w of "Bonjour à tous. Voici le plan du jour. Merci de votre attention.".split(" ")) {
      mots.push({ mot: w, debutSec: t, finSec: t + 0.4 });
      t += 0.4;
    }
    const r = storyboardVideoLongue({ question: "Une question ?" }, { mots, chapitres: [{ debutSec: 0, finSec: t, libelle: "Intro" }], dureeSec: t });
    expect(r.alertes.some((a) => a.code === "carton-sans-place")).toBe(true);
    expect(r.scenes.some((s) => s.type === "carton-titre" || s.type === "carton-chapitre" || s.type === "fin")).toBe(false);
    expect(r.scenes.length).toBeGreaterThan(0);
    expect(r.scenes[0].debutMs).toBe(0);
    expect(r.scenes[r.scenes.length - 1].finMs).toBe(r.dureeMs);
    r.scenes.forEach((s, i) => i + 1 < r.scenes.length && expect(s.finMs).toBe(r.scenes[i + 1].debutMs));
  });

  it("sans aucun mot : cartons et fin seulement, toujours contigus", () => {
    const r = storyboardVideoLongue({ question: "Q ?" }, { mots: [], chapitres: [{ debutSec: 0, finSec: 12, libelle: "Un titre" }], dureeSec: 12 });
    expect(r.scenes.length).toBeGreaterThan(0);
    expect(r.scenes[0].debutMs).toBe(0);
    expect(r.scenes[r.scenes.length - 1].finMs).toBe(12_000);
  });

  it("une phrase de plus de 8 s sans arrivées échelonnées est coupée en deux scènes", () => {
    const longue = "Le tableau de bord vous montre en temps réel ce qui se passe dans l'entrepôt, de la réception des colis jusqu'à la préparation des commandes, sans que personne ait à ouvrir un tableur ni à recopier quoi que ce soit.";
    const t = fabriquerTemps(`Titre\n\n${longue}`, null);
    const r = storyboardVideoLongue({ question: null }, t);
    const cont = r.scenes.filter(contenu);
    expect(cont.length).toBeGreaterThanOrEqual(2);
    for (const s of cont) expect(s.finMs - s.debutMs).toBeLessThanOrEqual(8000);
  });

  it("déterministe : même entrée, même story-board", () => {
    expect(storyboardVideoLongue({ question: QUESTION }, temps)).toEqual(sb);
  });
});
