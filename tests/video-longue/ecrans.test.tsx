/**
 * VL-06 : écrans 1 à 4 et 6 du générateur « Vidéo longue » (vitrine). Rendu statique, données inventées, 0 €,
 * aucun appel payant ni à Claude. Les règles de texte sont vérifiées sur le HTML réel de chaque écran.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { modeleDescription } from "../../src/briques/geo";
import { AvantDeLancer } from "../../src/components/formats/video-longue/AvantDeLancer";
import { FormulaireVideoLongue } from "../../src/components/formats/video-longue/FormulaireVideoLongue";
import { KitGeo } from "../../src/components/formats/video-longue/KitGeo";
import { chapitresDuScript, chapitresMinutes, decouperEnPhrases, formaterDuree, PlanChapitres, planDepuisValide, remarquesDuPlan } from "../../src/components/formats/video-longue/PlanChapitres";
import { remarqueChapitre, TexteParChapitre } from "../../src/components/formats/video-longue/TexteParChapitre";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const noop = () => {};
// Chapitres d'au moins 10 s : sinon le découpage les fusionne (règle commune écran / serveur).
const REMPLISSAGE = " Encore une phrase ici. Et une autre phrase là. Puis une dernière phrase ci.";
const SCRIPT = `# Pourquoi\nPremière phrase. Deuxième phrase.${REMPLISSAGE}\n# Comment\nTroisième phrase.${REMPLISSAGE}`;
const rendre = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const texteVisible = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const FICHIERS = [
  "src/components/formats/video-longue/FormulaireVideoLongue.tsx",
  "src/components/formats/video-longue/PlanChapitres.tsx",
  "src/components/formats/video-longue/TexteParChapitre.tsx",
  "src/components/formats/video-longue/AvantDeLancer.tsx",
  "src/components/formats/video-longue/KitGeo.tsx",
  "src/app/(studio)/videos/longue/page.tsx",
];
const source = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

const ecrans = () => {
  const chapitres = chapitresDuScript(SCRIPT);
  return {
    sujet: rendre(createElement(FormulaireVideoLongue, { actif: true, depensesCoupees: false })),
    plan: rendre(createElement(PlanChapitres, { chapitres, onChange: noop, onSuivant: noop })),
    texte: rendre(createElement(TexteParChapitre, { chapitres: [{ id: "a", titre: "Pourquoi", versions: [{ cle: "colle", phrases: ["Une phrase."] }] }], onValiderTout: noop })),
    lancer: rendre(createElement(AvantDeLancer, { dureeSec: 400, chapitres: 6, courts: 4, peutLancer: true, onLancer: noop, onRetour: noop })),
    kit: rendre(createElement(KitGeo, { titre: "Ma question ?", description: modeleDescription({ chapitres: chapitresMinutes(chapitres) }), chapitres: chapitresMinutes(chapitres), texteComplet: "Texte.", courts: [{ id: "a", titre: "Pourquoi" }] })),
  };
};

describe("VL-06 écran 1 : votre sujet", () => {
  const t = texteVisible(ecrans().sujet);
  it("porte les textes exacts du rapport", () => {
    for (const phrase of [
      "Vidéo longue", "Une vidéo de 4 à 12 minutes, en format large pour YouTube, qui répond clairement à une question.",
      "La question à laquelle la vidéo répond", "Pour qui ?", "Ce que vous voulez dire (facultatif)",
      "Votre script complet (facultatif) : il fait foi, le Studio ne change aucun mot",
      "4 min", "6 min", "8 min", "10 min", "C'est une cible, pas une limite.", "Voix : votre double.", "Aucune", "Prendre rendez-vous",
      "Préparer aussi des vidéos courtes tirées de cette vidéo", "Préparer aussi la page pour mon site", "Proposer les chapitres", "Enregistrer pour plus tard",
      "Votre sujet", "Les chapitres", "Le texte", "Lancer",
    ]) expect(t).toContain(phrase);
  });
  it("6 minutes est choisi, les deux cases sont décochées", () => {
    const html = ecrans().sujet;
    expect(html).toMatch(/aria-checked="true"[^>]*>(?:(?!<button)[\s\S])*6 min/);
    expect(html).not.toMatch(/role="checkbox"[^>]*aria-checked="true"/);
  });
  it("éteint : bandeau et lien vers les réglages, aucun bouton qui écrive", () => {
    const html = rendre(createElement(FormulaireVideoLongue, { actif: false, depensesCoupees: false }));
    expect(texteVisible(html)).toContain("La vidéo longue est éteinte : rien ne sera écrit ni fabriqué.");
    expect(html).toContain('href="/reglages#video-longue"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Proposer les chapitres/);
  });
  it("allumé : pas de bandeau", () => expect(t).not.toContain("est éteinte"));
});

describe("VL-06 écran 2 : les chapitres", () => {
  const chapitres = chapitresDuScript(SCRIPT);
  const html = rendre(createElement(PlanChapitres, { chapitres, onChange: noop, onSuivant: noop }));
  const t = texteVisible(html);
  it("textes exacts, boutons et premier chapitre marqué", () => {
    for (const phrase of ["Voici le plan proposé. Rien n'est payé à cette étape.", "Ce que ce chapitre explique", "Monter", "Descendre", "Renommer", "Retirer", "Écrire le texte des chapitres", "Réponse courte : la réponse en deux phrases, tout au début", "2 chapitres"]) expect(t).toContain(phrase);
    expect(t.match(/Réponse courte/g)).toHaveLength(1);
  });
  it("les titres viennent du script de l'utilisateur", () => {
    expect(chapitres.map((c) => c.titre)).toEqual(["Pourquoi", "Comment"]);
    expect(chapitres[0].texte).toBe(`Première phrase. Deuxième phrase.${REMPLISSAGE}`);
  });
  it("sans script, aucun chapitre inventé", () => {
    expect(chapitresDuScript("")).toEqual([]);
    expect(chapitresDuScript("   \n ")).toEqual([]);
  });
  it("sans titre, un bloc = un chapitre sans titre", () => {
    const bloc = (n: string) => Array.from({ length: 6 }, (_, i) => `Phrase ${n} numéro ${i + 1} du texte.`).join(" ");
    expect(chapitresDuScript(`${bloc("A")}\n\n${bloc("B")}`).map((c) => c.titre)).toEqual(["", ""]);
  });
  it("l'aperçu 16:9 vise environ deux tiers de la largeur (leçon VL-00 : un tiers était trop petit)", () => {
    expect(html).toContain('data-apercu-plan="16:9"');
    expect(html).toMatch(/aspect-video[^"]*md:w-2\/3|md:w-2\/3[^"]*aspect-video/);
    expect(html).not.toMatch(/data-apercu-plan[^>]*w-1\/3/);
  });
  it("durée hors zone : une remarque, jamais un refus", () => {
    expect(remarquesDuPlan(chapitres).join(" ")).toContain("la zone conseillée va de 4 à 12 minutes");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Écrire le texte/);
  });
  it("les chapitres minutés commencent à 0:00", () => expect(chapitresMinutes(chapitres)[0].debutSec).toBe(0));
  it("durée lisible", () => {
    expect(formaterDuree(400)).toBe("6 min 40");
    expect(formaterDuree(45)).toBe("45 s");
  });
});

describe("VL-06 écran 3 : le texte, chapitre par chapitre", () => {
  const deux = rendre(createElement(TexteParChapitre, { chapitres: [{ id: "a", titre: "Pourquoi", versions: [{ cle: "A", phrases: ["Un. "] }, { cle: "B", phrases: ["Deux."] }] }], onValiderTout: noop, onEnregistrer: noop }));
  const colle = rendre(createElement(TexteParChapitre, { chapitres: [{ id: "a", titre: "Pourquoi", versions: [{ cle: "colle", phrases: ["Ma phrase."] }] }], onValiderTout: noop }));
  it("deux versions par chapitre : A et B à choisir", () => {
    const t = texteVisible(deux);
    for (const phrase of ["Aucune voix n'est payée tant que vous n'avez pas validé tous les chapitres.", "Choisir la version A", "Choisir la version B", "Valider ce chapitre", "Valider tout le texte", "Enregistrer sans lancer"]) expect(t).toContain(phrase);
  });
  it("script collé : une seule version, la vôtre, phrase par phrase", () => {
    const t = texteVisible(colle);
    expect(t).toContain("Votre texte : une seule version, la vôtre.");
    expect(t).toContain("Ma phrase.");
    for (const b of ["Garder", "Modifier", "Retirer"]) expect(t).toContain(b);
    expect(t).not.toContain("Choisir la version");
  });
  it("« Valider tout le texte » est inactif tant qu'un chapitre n'est pas validé", () => {
    expect(colle).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Valider tout le texte/);
  });
  it("aucune phrase n'est affichée avant le choix d'une version", () => expect(texteVisible(deux)).not.toMatch(/Un\.|Deux\./));
  it("remarque de longueur, jamais bloquante", () => {
    expect(remarqueChapitre(["mot ".repeat(300)])).toEqual(["Ce chapitre dépasse 1 min 30 : il sera peut-être long à suivre."]);
    expect(remarqueChapitre(["Court."])).toEqual([]);
  });
  it("le découpage garde chaque mot", () => expect(decouperEnPhrases("Un. Deux ! Trois ?").join(" ")).toBe("Un. Deux ! Trois ?"));
});

describe("VL-06 écran 4 : avant de lancer", () => {
  const t = texteVisible(ecrans().lancer);
  it("carte des crédits sans aucun montant", () => {
    for (const phrase of ["Cette vidéo utilise vos crédits", "Voix de votre double : environ 6 min 40", "6 chapitres", "Format large", "4 vidéos courtes en plus", "Rien n'est payé avant votre accord. Si le montant du jour change, le Studio s'arrête et vous redemande.", "Je donne mon accord et je lance la vidéo", "Pas maintenant"]) expect(t).toContain(phrase);
  });
  it("case des courts décochée : la ligne disparaît", () => {
    const sans = texteVisible(rendre(createElement(AvantDeLancer, { dureeSec: 400, chapitres: 1, courts: 0, peutLancer: true, onLancer: noop, onRetour: noop })));
    expect(sans).not.toContain("courte");
    expect(sans).toContain("1 chapitre");
  });
  it("dépenses coupées ou générateur éteint : pas de bouton de lancement, un lien vers les réglages", () => {
    const html = rendre(createElement(AvantDeLancer, { dureeSec: 400, chapitres: 6, courts: 0, peutLancer: false, onLancer: noop, onRetour: noop }));
    expect(texteVisible(html)).not.toContain("Je donne mon accord");
    expect(html).toContain('href="/reglages"');
  });
});

describe("VL-06 écran 6 : kit de publication", () => {
  const chapitres = chapitresMinutes(chapitresDuScript(SCRIPT));
  it("cartes du rapport ; À retenir et Questions absents si l'utilisateur ne les a pas remplis", () => {
    const t = texteVisible(ecrans().kit);
    for (const phrase of ["Titre", "Copier le titre", "Posez la question comme vos clients la cherchent.", "Chapitres pour YouTube", "Copier les chapitres", "Texte complet", "Copier le texte", "Étiquette IA (facultative)", "Éteinte", "Vidéos courtes tirées de cette vidéo", "Fabriquer ce court", "Fabriquer les courts choisis"]) expect(t).toContain(phrase);
    expect(t).not.toContain("À retenir");
    expect(t).not.toContain("Questions et réponses");
    expect(t).not.toContain("Sous-titres");
  });
  it("À retenir, questions, sous-titres .srt et vidéo : seulement quand ils existent", () => {
    const html = rendre(createElement(KitGeo, { urlVideo: "/v.mp4", titre: "T ?", description: [], chapitres, srt: "1\n00:00:00,000 --> 00:00:01,000\nBonjour\n", texteComplet: "x", aRetenir: ["Un point choisi."], questions: [{ question: "Q ?", reponse: "R." }], onMettreSurLeSite: noop }));
    const t = texteVisible(html);
    for (const phrase of ["Télécharger la vidéo", "Télécharger les sous-titres (.srt)", "À retenir", "Un point choisi.", "Questions et réponses", "Q ?", "Mettre sur le site"]) expect(t).toContain(phrase);
    expect(html).toContain('download="sous-titres.srt"');
    expect(html).not.toContain(".vtt");
  });
  it("l'étiquette IA est éteinte ; les courts sont décochés", () => {
    const html = ecrans().kit;
    expect(html).not.toMatch(/role="switch"[^>]*aria-checked="true"/);
    expect(html).not.toMatch(/role="checkbox"[^>]*aria-checked="true"/);
  });
  it("la description n'invente rien : sans réponse courte ni lien, seuls les chapitres validés comptent", () => {
    const description = modeleDescription({ chapitres, valides: ["chapitres"] });
    const t = texteVisible(rendre(createElement(KitGeo, { titre: "", description, chapitres, texteComplet: "" })));
    expect(t).toContain("0:00 Pourquoi");
    expect(t).not.toContain("Réponse courte");
  });
});

describe("VL-06 règles communes à tous les écrans", () => {
  const tous = Object.values(ecrans()).map(texteVisible);
  const toutHtml = Object.values(ecrans()).join(" ");
  it("aucun montant", () => {
    for (const t of tous) expect(t).not.toMatch(/€|\$|\beuros?\b|\bdollars?\b|\d\s?(EUR|USD)\b/i);
  });
  it("aucune étiquette interdite, aucun jargon", () => {
    for (const t of tous) {
      expect(t).not.toMatch(/Douleur|Solution|Exemple|À vous|GEO|JSON|rendu|prompt|Grenoble/);
    }
  });
  it("vouvoiement : aucun tutoiement", () => {
    for (const t of tous) expect(t).not.toMatch(/(?<![\p{L}])(tu|ton|ta|tes|toi|te)(?![\p{L}])/iu);
  });
  it("ni bleu ni jaune, aucune marque réelle", () => {
    expect(toutHtml).not.toMatch(/(blue|bleu|yellow|jaune|amber-|sky-|cyan)/i);
    for (const f of FICHIERS) {
      const s = source(f);
      expect(s).not.toMatch(/\b(blue|yellow|sky|cyan)-\d|#[0-9a-f]{6}/i);
      expect(s).not.toMatch(/Calendly|HeyGen|Zapier|Notion/);
    }
  });
  it("sous-titres : .srt seulement", () => {
    for (const f of FICHIERS) expect(source(f)).not.toMatch(/\.vtt|\.ass|\.sbv/i);
  });
  it("étiquette IA éteinte par défaut dans le code", () => expect(source(FICHIERS[4])).toContain("useState(false)"));
});

describe("VL-06 sécurité, argent et périmètre", () => {
  it("aucun appel payant ni à Claude, aucune écriture de réglage ou de crédits", () => {
    for (const f of FICHIERS) {
      const s = source(f);
      expect(s).not.toMatch(/@anthropic|fetch\(|reserverCredits|verifierEtReserver|ecrireParametre|definir[A-Z]\w+\(|\bpayer\b/);
      expect(s).not.toMatch(/services\/credits|services\/reglages/);
    }
  });
  it("la page lit les réglages, seul `true` exact allume", () => {
    const s = source(FICHIERS[5]);
    expect(s).toContain("actif === true");
    expect(s).toContain("coupees === true");
  });
  it("aucune carte ajoutée à la main ; aucune zone interdite touchée", () => {
    expect(source("src/app/(studio)/nouvelle/page.tsx")).not.toMatch(/videos\/longue/);
    expect(source("src/components/coquille/navigation.ts")).not.toMatch(/videos\/longue/);
    expect(source("src/formats/video-longue/index.ts")).toContain('statut: "masque"');
    // FIN-5 (demande du fondateur) remet l'adresse de création du format : la carte « Nouvelle vidéo » pointe
    // sur /videos/longue (valeur exacte). AUTORISATION PERMANENTE (b) : attente calculée, plus « absente ».
    expect(source("src/formats/video-longue/index.ts")).toContain('adresseCreation: "/videos/longue"');
  });
});

describe("VL-06 : écrans 4 et 6 calculés sur le texte validé", () => {
  const plan = chapitresDuScript(`# Un\nUne deux trois quatre cinq six. Sept huit neuf dix onze douze. Treize quatorze quinze seize.${REMPLISSAGE}\n# Deux\nAlpha bêta gamma delta.${REMPLISSAGE}`);
  const toutes = plan.map((c) => ({ id: c.id, titre: c.titre, phrases: decouperEnPhrases(c.texte) }));
  it("une phrase retirée fait baisser la durée et le finSec du chapitre", () => {
    const avant = chapitresMinutes(planDepuisValide(toutes, plan));
    const retiree = toutes.map((c, i) => (i === 0 ? { ...c, phrases: c.phrases.slice(0, -1) } : c));
    const apres = chapitresMinutes(planDepuisValide(retiree, plan));
    expect(apres[0].finSec).toBeLessThan(avant[0].finSec);
    expect(apres[1].debutSec).toBeLessThan(avant[1].debutSec);
    expect(apres[1].finSec).toBeLessThan(avant[1].finSec);
  });
  it("un chapitre sans aucune phrase validée disparaît du plan final", () => {
    const vide = toutes.map((c, i) => (i === 1 ? { ...c, phrases: [] } : c));
    expect(planDepuisValide(vide, plan)).toHaveLength(1);
  });
  it("le texte validé est repris tel quel, sans mot ajouté", () => {
    expect(planDepuisValide(toutes, plan).map((c) => c.texte)).toEqual(plan.map((c) => decouperEnPhrases(c.texte).join(" ")));
  });
  it("le formulaire calcule bien ses écrans 4 et 6 depuis le plan validé", () => {
    const src = source("src/components/formats/video-longue/FormulaireVideoLongue.tsx");
    expect(src).toMatch(/planDepuisValide\(valide/);
    expect(src).not.toMatch(/chapitresMinutes\(chapitres\)|dureeTotaleSec\(chapitres\)/);
  });
});

describe("VL-06 : petits points du verdict Opus (accessibilité, paragraphe vide)", () => {
  it("chaque champ « Ce que ce chapitre explique » porte le numéro de son chapitre", () => {
    const chapitres = chapitresDuScript(`# Un\nUne phrase ici.${REMPLISSAGE}\n# Deux\nAlpha bêta gamma.${REMPLISSAGE}`);
    const t = texteVisible(rendre(createElement(PlanChapitres, { chapitres, onChange: noop, onSuivant: noop })));
    expect(t).toContain("Ce que ce chapitre explique (chapitre 1)");
    expect(t).toContain("Ce que ce chapitre explique (chapitre 2)");
  });
  it("la coche du sommaire a un texte pour les lecteurs d'écran, et l'icône est décorative", () => {
    const src = source("src/components/formats/video-longue/TexteParChapitre.tsx");
    expect(src).toMatch(/sr-only[^>]*>Validé/);
    expect(src).not.toMatch(/nom="coche"[^>]*aria-label/);
  });
  it("un chapitre entièrement vidé ne laisse pas de paragraphe vide dans le texte complet", () => {
    const src = source("src/components/formats/video-longue/FormulaireVideoLongue.tsx");
    expect(src).toMatch(/\.filter\(\(t\) => t\.trim\(\) !== ""\)\.join\("\\n\\n"\)/);
  });
});

describe("VL-SV : choix « Sans voix » visible, avec voix par défaut", () => {
  it("l'écran 1 propose les deux modes et garde « Voix : votre double. » par défaut", () => {
    const t = texteVisible(ecrans().sujet);
    expect(t).toContain("Sans voix (sous-titres et texte à l'écran)");
    expect(t).toContain("Avec la voix de mon double");
    expect(t).toContain("Voix : votre double.");
  });
  it("l'écran « avant de lancer » sans voix : aucun coût, aucune voix ni musique", () => {
    const t = texteVisible(rendre(createElement(AvantDeLancer, { dureeSec: 400, chapitres: 2, courts: 0, sansVoix: true, peutLancer: true, onLancer: noop, onRetour: noop })));
    expect(t).toContain("aucun coût");
    expect(t).toContain("Aucune voix, aucune musique");
    expect(t).not.toContain("Voix de votre double");
  });
});

describe("FIN-7 : gardes et écrans honnêtes", () => {
  const lancerPossible = (dureeSec: number) => rendre(createElement(AvantDeLancer, { dureeSec, chapitres: 3, courts: 0, peutLancer: true, onLancer: noop, onRetour: noop }));
  it("au-delà de 20 min : alerte et bouton de lancement désactivé", () => {
    const html = lancerPossible(1260);
    expect(texteVisible(html)).toContain("Votre script dépasse 20 minutes de lecture : raccourcissez-le ou coupez-le en deux vidéos.");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Je donne mon accord et je lance la vidéo/);
  });
  it("à 20 min pile ou moins : pas d'alerte, bouton actif", () => {
    const html = lancerPossible(1200);
    expect(texteVisible(html)).not.toContain("dépasse 20 minutes");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Je donne mon accord/);
  });
  it("le lien « Ouvrir la vidéo longue » n'apparaît que si l'interrupteur est allumé", async () => {
    const { InterrupteurVideoLongue } = await import("../../src/components/reglages/InterrupteurVideoLongue");
    const allume = rendre(createElement(InterrupteurVideoLongue, { actif: true }));
    const eteint = rendre(createElement(InterrupteurVideoLongue, { actif: false }));
    expect(texteVisible(allume)).toContain("Ouvrir la vidéo longue");
    expect(allume).toContain('href="/videos/longue"');
    expect(texteVisible(eteint)).not.toContain("Ouvrir la vidéo longue");
    expect(eteint).not.toContain('href="/videos/longue"');
  }, 60_000);
  it("la page éteinte renvoie vers l'ancre des réglages", () => {
    const html = rendre(createElement(FormulaireVideoLongue, { actif: false, depensesCoupees: false }));
    expect(html).toContain('href="/reglages#video-longue"');
  });
  it("plus de bouton « Enregistrer pour plus tard » actif ; les choix non envoyés sont désactivés", () => {
    const html = ecrans().sujet;
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Enregistrer pour plus tard/);
    expect(html).not.toMatch(/<button(?![^>]*disabled)[^>]*>(?:(?!<\/button>)[\s\S])*Enregistrer pour plus tard/);
    expect(texteVisible(html)).toContain("Bientôt");
  });
  it("l'interrupteur et l'écran 4 ne parlent plus de prix ni de plafond", async () => {
    const { DETAIL_VIDEO_LONGUE } = await import("../../src/components/reglages/InterrupteurVideoLongue");
    expect(DETAIL_VIDEO_LONGUE).toContain("dans la limite prévue");
    expect(DETAIL_VIDEO_LONGUE).not.toMatch(/plafond|prix|gratuit|€/i);
    expect(texteVisible(ecrans().lancer)).not.toMatch(/\b(prix|plafond|budget|tarif|devis)\b/i);
  });
});
