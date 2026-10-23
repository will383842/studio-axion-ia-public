/**
 * Vérification de bout en bout n° 1 (console, 03/10) — corrections des ÉCRANS. Les tests tournent sans navigateur :
 * ils lisent le code des écrans (règles qui ne doivent plus revenir) et appellent les petites fonctions pures.
 * Les parcours eux-mêmes ont été refaits à l'écran en 390 px (captures dans _VERIFICATION-STUDIO-2026-10-03).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lire = (chemin: string) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");
const securite = lire("src/components/reglages/Securite.tsx");
const reglages = lire("src/app/(studio)/reglages/page.tsx");
const express = lire("src/assistant/etapes/Express.tsx");
const script = lire("src/assistant/etapes/Script.tsx");
const apercu = lire("src/assistant/etapes/Apercu.tsx");
const assistant = lire("src/assistant/Assistant.tsx");
const accueil = lire("src/app/(studio)/page.tsx");
const enCours = lire("src/app/(studio)/_accueil/EnCours.tsx");
const sons = lire("src/components/videos/fiche/SonsDesPlans.tsx");
const ongletsLecture = lire("src/components/videos/fiche/OngletsLecture.tsx");

/** Ce qui s'affiche : les chaînes entre guillemets et le texte entre balises (pas les commentaires). */
function texteAffiche(source: string): string {
  const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const chaines = [...sansCommentaires.matchAll(/"([^"\n]*)"|`([^`]*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? "");
  return chaines.join("\n");
}

describe("n° 1 — Réglages ne déborde plus à 390 px", () => {
  it("la ligne du mot de passe se resserre (min-w-0, truncate) et le bouton ne grossit pas", () => {
    expect(securite).toMatch(/min-w-0 flex-1 truncate font-mono/);
    expect(securite).toMatch(/variante="secondaire" className="shrink-0"/);
  });
});

describe("n° 2 — texte du mot de passe juste", () => {
  it("plus de « Coolify » ni de pastille ESSAI sur « Changer »", () => {
    expect(securite).not.toMatch(/Coolify/);
    expect(securite).not.toMatch(/<Bouton[^>]*\bessai\b[^>]*>\s*Changer/);
  });
  it("la mise en garde n'apparaît qu'avec des données non gardées", () => {
    expect(securite).toMatch(/\{enMemoire && <p/);
    expect(securite).not.toMatch(/redémarrage du serveur/);
    expect(reglages).toMatch(/<ChangerMotDePasse enMemoire=\{infos\.enMemoire\} \/>/);
  });
});

describe("n° 3 et 4 — le chemin « idée »", () => {
  it("« Une idée » ouvre l'onglet « Une idée », « Mes scripts » le sien", () => {
    expect(express).toMatch(/ouvrirScript\("idee"\)/);
    expect(express).toMatch(/ouvrirScript\("mes-scripts"\)/);
    expect(express).toMatch(/ongletDepart=\{ongletScript\}/);
    expect(script).toMatch(/const ongletInitial: OngletScript = ongletDepart \?\?/);
  });
  it("l'idée est rappelée sur « Votre vidéo », avec « Écrire le texte »", () => {
    expect(express).toMatch(/Votre idée/);
    expect(express).toMatch(/Écrire le texte/);
    expect(express).toMatch(/const ideeAuDepart = !brouillon\.videoId && !!idee/);
  });
  it("en compact, aucune écriture ne part sans un toucher", () => {
    // Correcteur 3 (B1) : plus aucune écriture lancée d'elle-même (l'ancienne génération automatique simulée est
    // retirée) ; seul le toucher « Écrire le texte » ouvre le vrai générateur.
    expect(script).not.toMatch(/lance\.current/);
    expect(script).toMatch(/onSubmit=\{\(e\) => \{\s+e\.preventDefault\(\);\s+void ecrireAvecGenerateur\(idee\);/);
  });
});

describe("n° 5 — « Corriger » dans Coût ouvre la bonne feuille", () => {
  it("en compact, Corriger passe par ouvrirFeuille (l'étape « script » n'existe pas en Rapide)", () => {
    expect(apercu).toMatch(/ouvrirFeuille \? ouvrirFeuille\(FEUILLE_DE_L_ETAPE\[cible\] \?\? "script"\) : allerA\(cible\)/);
    expect(apercu).toMatch(/script: "script", distribution: "plateau", reglages: "style"/);
    expect(express).toMatch(/<EtapeApercu \{\.\.\.props\} compacte ouvrirFeuille=\{ouvrirFeuille\} \/>/);
  });
});

describe("n° 6 — aucun brouillon fantôme", () => {
  it("Coût sans texte : rien n'est enregistré", () => {
    expect(apercu).toMatch(/const sansTexte = !brouillon\.videoId && !brouillon\.blocs\.some/);
    expect(apercu).toMatch(/if \(charge\.current \|\| sansTexte\) return;/);
  });
  it("script ouvert sans rien toucher : le coût n'enregistre pas de lui-même", () => {
    expect(express).toMatch(/if \(!aTexte \|\| !saisi\) return;/);
    expect(assistant).toMatch(/aSaisi: \(\) => saisie\.current \|\| !!reference\.current\.videoId/);
    expect(assistant).toMatch(/const saisie = useRef\(!!initial\.videoId\)/);
  });
});

describe("n° 8 — Accueil : deux compteurs, deux noms", () => {
  it("« Aujourd'hui » parle de vidéos", () => {
    expect(accueil).toMatch(/libelle: "Vidéos à relire"/);
    expect(accueil).toMatch(/libelle: "Vidéos à programmer"/);
  });
  it("les tuiles d'Écrire parlent de scripts : aucun libellé commun avec « Aujourd'hui »", () => {
    const tuiles = lire("src/app/(studio)/_accueil/TuilesEcrire.tsx");
    expect(tuiles).toMatch(/libelle: "Scripts à relire"/);
    expect(tuiles).toMatch(/libelle: "Scripts à programmer"/);
    const noms = (src: string) => [...src.matchAll(/\{ libelle: "([^"]+)", nombre:/g)].map((m) => m[1]);
    const communs = noms(tuiles).filter((n) => noms(accueil).includes(n));
    expect(communs).toEqual([]);
  });
});

describe("n° 11 — Kit de publication : rien n'est perdu sans prévenir", () => {
  const kit = lire("src/components/publication/KitPublication.tsx");
  it("le texte, les mots-dièse et le titre s'enregistrent tout seuls", () => {
    expect(kit).toMatch(/setTimeout\(\(\) => enregistrerMaintenant\(\), ENREGISTREMENT_AUTO_MS\)/);
    expect(kit).toMatch(/useEffect\(\(\) => \(\) => auDepart\(\), \[\]\)/);
    // La clé de l'éditeur ne dépend plus du texte : un enregistrement ne le remonte pas (pas de curseur perdu).
    expect(kit).toMatch(/<EditeurReseau key=\{courant\.reseau\}/);
  });
  it("quitter pendant une saisie non enregistrée demande confirmation", () => {
    expect(kit).toMatch(/addEventListener\("beforeunload", retenir\)/);
  });
  it("la clé de saisie couvre texte, mots-dièse et titre", async () => {
    const { cleSaisie } = await import("@/components/publication/KitPublication");
    const a = { texte: "Bonjour", mots: ["#droit"], titre: "" };
    expect(cleSaisie(a)).toBe(cleSaisie({ ...a, mots: ["#droit"] }));
    expect(cleSaisie(a)).not.toBe(cleSaisie({ ...a, mots: ["#droit", "#travail"] }));
    expect(cleSaisie(a)).not.toBe(cleSaisie({ ...a, titre: "Titre" }));
    expect(cleSaisie(a)).not.toBe(cleSaisie({ ...a, texte: "Bonjour !" }));
  }, 30_000);
});

describe("n° 9 — son plan par plan", () => {
  it("pas de choix ni d'« Appliquer » quand la vidéo ne peut pas changer de son", () => {
    expect(ongletsLecture).toMatch(/refaisable=\{typeof moteurDeCommande\(commande\)\.recalquer === "function"\}/);
    expect(sons).toMatch(/const choixPossible = modifiable && refaisable/);
    expect(sons).toMatch(/\{etat\.enAttente && choixPossible && \(/);
    expect(sons).toMatch(/il faut refaire la vidéo/);
  });
  it("le plan montre ce que la vidéo contient vraiment", async () => {
    const { libelleSonPlan } = await import("@/components/videos/fiche/SonsDesPlans");
    const plan = { id: "p1", ordre: 1, debutSec: 0, finSec: 2, texte: "x", choix: { mode: "retire" as const }, pose: "impact" as const };
    expect(libelleSonPlan(plan as never, false, true)).toBe("Son");
    expect(libelleSonPlan(plan as never, true, true)).toBe("Aucun son · à appliquer");
    expect(libelleSonPlan(plan as never, true, false)).toBe("Aucun son");
  }, 30_000);
});

describe("n° 10 — sous-titres corrigés, vidéo inchangée : on le dit", () => {
  it("phrase affichée quand le moteur ne sait pas refaire l'image", () => {
    const s = lire("src/components/videos/fiche/OngletSousTitres.tsx");
    expect(s).toMatch(/!recalquePossible && \(corriges > 0 \|\| correctionEnAttente\)/);
    expect(s).toMatch(/La vidéo garde l&apos;ancien mot\. Les fichiers de sous-titres/);
  });
});

describe("n° 13 — Retouches : vouvoiement", () => {
  it("plus d'impératif tutoyé dans les exemples", () => {
    const s = texteAffiche(lire("src/components/videos/fiche/DemanderModification.tsx"));
    expect(s).not.toMatch(/\b[Ee]nlève\b|hôpital/);
  });
});

describe("n° 15 — Mes scripts : la référence et sa copie se distinguent", () => {
  it("une ligne « Référence » / « Copie du … » quand deux scripts ont le même sujet", () => {
    expect(script).toMatch(/return s\.reference \? "Référence" : `Copie du \$\{dateCourte\(s\.modifieLe\)\}`/);
    expect(script).toMatch(/\(parSujet\.get\(s\.sujet\) \?\? 0\) > 1 &&/);
  });
});

describe("n° 16 — Calendrier : « Semaine libre » seulement si rien n'est listé", () => {
  it("les essais comptent", () => {
    expect(lire("src/app/(studio)/calendrier/page.tsx")).toMatch(/\{semaine\.length === 0 && !jours\.some/);
  });
});

describe("n° 18 — personnage inventé : un guide de création, pas de tournage", () => {
  it("variante « invente » choisie selon la nature", () => {
    expect(lire("src/components/personnages/OngletVisages.tsx")).toMatch(/<GuideTournage variante=\{invente \? "invente" : "avocat"\} \/>/);
    expect(lire("src/components/personnages/GuideTournage.tsx")).toMatch(/if \(variante === "invente"\) return <GuideCreation/);
  });
});

describe("n° 19 — Personnages : le même chiffre partout", () => {
  it("« 0 prêt · 1 en attente » quand un visage n'est pas prêt", async () => {
    const { libelleVisages } = await import("@/components/ui/CartePersonnage");
    expect(libelleVisages(0, 1)).toBe("0 prêt · 1 en attente");
    expect(libelleVisages(2, 2)).toBe("2 visages");
    expect(libelleVisages(1, 1)).toBe("1 visage");
    expect(lire("src/app/(studio)/personnages/page.tsx")).toMatch(/visagesTotal: p\.visages\.length/);
  }, 30_000);
});

describe("n° 21 — Réglages : pastilles et titres portent les mêmes noms", () => {
  it("chaque pastille porte le titre de sa carte", () => {
    const pastilles = [...reglages.matchAll(/\{ id: "([^"]+)", libelle: "([^"]+)"/g)].map((m) => ({ id: m[1], libelle: m[2] }));
    expect(pastilles.length).toBeGreaterThan(5);
    for (const p of pastilles) {
      const carte = new RegExp(`id="${p.id}" icone="[^"]+" titre="([^"]+)"`).exec(reglages);
      expect(carte?.[1], p.id).toBe(p.libelle);
    }
  });
});

describe("n° 22 — vocabulaire simple à l'écran", () => {
  const ecrans = [
    "src/components/reglages/Connexions.tsx",
    "src/components/bibliotheque/EcranLut.tsx",
    "src/components/personnages/OngletVoix.tsx",
    "src/components/personnages/GuideTournage.tsx",
    "src/app/(studio)/veille/_composants/EcranVeille.tsx",
    "src/components/ui/ListeAvecFiltres.tsx",
  ];
  it.each(ecrans)("%s : ni jargon, ni « (s) »", (chemin) => {
    const s = texteAffiche(lire(chemin));
    expect(s).not.toMatch(/ffmpeg|loudnorm|WhisperX|paquet npm|dépôt GitHub|Cube \d|LUT \(\.cube\)|i\/s|ne sait pas lire un texte seul|[a-zé]\(s\)/);
  });
  it("journal et veille : accords au nombre, plus de « banc d'essai »", () => {
    const veille = lire("src/services/veille.ts");
    expect(veille).not.toMatch(/lu\(s\)|nouveauté\(s\)|banc d'essai/);
    expect(lire("src/services/videos.ts")).not.toMatch(/vidéo\(s\) archivée\(s\)/);
    expect(lire("src/formats/autres.ts")).not.toMatch(/nom: "Vidéo UGC"/);
  });
  it("langue des voix en clair", async () => {
    const { langueLisible } = await import("@/components/personnages/OngletVoix");
    expect(langueLisible("fr-FR")).toBe("Français");
    expect(langueLisible("en-US")).toMatch(/^Anglais/);
  }, 30_000);
});

describe("n° 23 — 404 avec le bon code", () => {
  it("le proxy demande si la fiche existe et répond 404 sinon", () => {
    const proxy = lire("src/proxy.ts");
    expect(proxy).toMatch(/\/\^\\\/\(videos\|personnages\|scripts\|formats\|bibliotheque[|)]/); // E2E-2 parcours n° 26 : « ecrire/sujets » s'ajoute
    expect(proxy).toMatch(/\/api\/fiches\//);
    expect(proxy).toMatch(/status: 404/);
    expect(proxy).toMatch(/PAGES_FIXES = new Set\(\["videos\/a-ranger", "bibliotheque\/animations"\]\)/);
  });
});

describe("n° 24 — la vitrine des composants est réservée au développement", () => {
  it("notFound() en production", () => {
    expect(lire("src/app/(studio)/styleguide/page.tsx")).toMatch(/if \(process\.env\.NODE_ENV === "production"\) notFound\(\);/);
  });
});

describe("n° 25 — cibles tactiles et clavier", () => {
  it("Bibliothèque : le nom d'un élément est une cible d'au moins 44 px", () => {
    expect(lire("src/components/ui/ListeElements.tsx")).toMatch(/<button type="button" \{\.\.\.action\} className="flex min-h-11/);
  });
  it("un logo de réseau porte son nom complet (filtres d'Écrire : « TikTok », plus « TT »)", () => {
    const logo = lire("src/components/ui/LogoReseau.tsx");
    // Chaque aria-label du logo est posé sur un role="img" (un aria-label sur un simple <span> est ignoré).
    const spans = [...logo.matchAll(/<span\s([^>]*aria-label=[^>]*)>/g)].map((m) => m[1]);
    expect(spans.length).toBeGreaterThanOrEqual(2);
    for (const s of spans) expect(s).toMatch(/role="img"/);
  });
  it("la bande « Bien filmer » s'atteint au clavier", () => {
    expect(lire("src/components/personnages/GuideTournage.tsx")).toMatch(/<ul aria-label=\{titre\} tabIndex=\{0\}/);
  });
});

describe("n° 26 et 28 — Accueil › En cours", () => {
  it("le compteur suit la liste en direct", () => {
    expect(enCours).toMatch(/<EnTeteSection titre="En cours" compteur=\{travaux\.length\} \/>/);
    expect(accueil).not.toMatch(/<EnTeteSection titre="En cours" compteur=\{r\.enCours\.length\}/);
  });
  it("« Reprendre » répond tout de suite", () => {
    expect(enCours).toMatch(/notifier\.succes\("C'est reparti"\)/);
    expect(enCours).toMatch(/C'est reparti…/);
  });
});

describe("n° 27 — Mes images : un seul envoi à la fois", () => {
  it("un second dépôt pendant un envoi est ignoré", () => {
    const s = lire("src/components/bibliotheque/mes-images/FeuilleImport.tsx");
    expect(s).toMatch(/if \(occupe\.current\) return;/);
    expect(s).toMatch(/occupe\.current = false;/);
  });
});

describe("n° 29 — lien privé : confirmation avant de couper", () => {
  it("« Révoquer » demande « Couper » ou « Garder »", () => {
    const s = lire("src/components/partage/PartagerVideo.tsx");
    expect(s).toMatch(/onClick=\{\(\) => setConfirmer\(true\)\}/);
    expect(s).toMatch(/onClick=\{onRevoquer\}[^>]*>\s*Couper/);
  });
});

describe("n° 30 — lien jamais créé : 404 « Lien introuvable »", () => {
  it("le proxy distingue introuvable (404) et inactif (410)", () => {
    const proxy = lire("src/proxy.ts");
    expect(proxy).toMatch(/status: introuvable \? 404 : 410/);
    expect(lire("src/app/v/[code]/page.tsx")).toMatch(/Lien introuvable/);
  });
  it("la page publique n'impose aucune mention « IA »", () => {
    expect(texteAffiche(lire("src/app/v/[code]/page.tsx"))).not.toMatch(/\bIA\b/);
  });
});

describe("n° 31 — Formats : une seule galerie « Vidéos », pas de doublon avec les chiffres", () => {
  it("les chiffres du haut ne répètent pas le nombre de vidéos et la page n'a qu'une section « Vidéos »", () => {
    const s = lire("src/app/(studio)/formats/[id]/page.tsx");
    expect(s).not.toMatch(/libelle: "Vidéos/);
    expect(s.match(/<EnTeteSection titre="Vidéos"/g)).toHaveLength(1);
    expect(s.match(/<GalerieVideos/g)).toHaveLength(1);
    expect(s).not.toMatch(/Vidéos prêtes/);
  });
});
