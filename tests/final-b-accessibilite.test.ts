/**
 * Contrôle de bout en bout n° 2 (VERIF-E2E-2), gênes d'accessibilité n° 12 à 16 (+ deux débordements mobiles, n° 10).
 * Sans navigateur : les petits composants sont rendus en HTML, les autres sont vérifiés à la lecture de leur code.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProgressionEtapes } from "@/components/ui/ProgressionEtapes";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import type { EtapeTravail } from "@/domaine/types";

const lire = (chemin: string) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");
/** Le code sans ses commentaires (une règle ne passe pas grâce à un commentaire). */
const code = (chemin: string) =>
  lire(chemin)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("n° 12-13 — feuilles du bas au clavier", () => {
  const feuille = code("src/components/ui/FeuilleBas.tsx");
  it("le focus entre dans la feuille à l'ouverture (vaul : autoFocus)", () => {
    expect(feuille).toMatch(/<Drawer\.Root[^>]*\bautoFocus\b/);
  });
  it("à la fermeture, le focus revient au bouton qui l'a ouverte", () => {
    expect(feuille).toMatch(/onCloseAutoFocus=/);
    expect(feuille).toMatch(/document\.activeElement/);
    expect(feuille).toMatch(/\.focus\(\)/);
  });
  it("un bouton « Fermer » discret (icône)", () => {
    expect(feuille).toMatch(/<Drawer\.Close[^>]*aria-label="Fermer"/);
    expect(feuille).toMatch(/<Icone nom="fermer"/);
  });
});

describe("n° 14 — enregistreur plein écran", () => {
  const enreg = code("src/components/tournage/Enregistreur.tsx");
  it("vraie fenêtre (Radix) : focus piégé, Échap, titre", () => {
    expect(enreg).toMatch(/<Dialog\.Root/);
    expect(enreg).toMatch(/<Dialog\.Content/);
    expect(enreg).toMatch(/<Dialog\.Title/);
    expect(enreg).toMatch(/onEscapeKeyDown=/);
    expect(enreg).not.toMatch(/<div role="dialog"/);
  });
  it("pause / reprise par un vrai bouton, plus par un div cliquable", () => {
    expect(enreg).not.toMatch(/<div[^>]*\n?\s*onClick=\{\(\) => filme && envoyer/);
    expect(enreg).toMatch(/<button[\s\S]{0,80}aria-label=\{phase === "pause" \? "Reprendre" : "Pause"\}/);
  });
  it("le réglage de vitesse ne chevauche plus « Filmer » (largeur libre, groupe nommé)", () => {
    expect(enreg).toMatch(/role="group" aria-label="Vitesse du texte"/);
    expect(enreg).not.toMatch(/flex w-24 items-center gap-1/);
  });
});

describe("n° 15 — focus visible", () => {
  it("écran Sujet : les champs sans contour propre ont un anneau quand on y écrit au clavier", () => {
    const sujet = code("src/components/generateur/EcranSujet.tsx");
    expect(sujet.match(/has-\[textarea:focus-visible\]:outline-orange-vif/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
  it("aperçu de LUT : focus visible du curseur invisible, et la page défile au doigt", () => {
    const lut = code("src/components/bibliotheque/EcranLut.tsx");
    expect(lut).toMatch(/peer[^"]*touch-pan-y/);
    expect(lut).toMatch(/peer-focus-visible:outline/);
  });
});

describe("n° 16 — annonces", () => {
  it("plus d'aria-label sur un span/div sans rôle", () => {
    expect(code("src/components/notifications/ClocheNotifications.tsx")).not.toMatch(/<span aria-label="Nouvelle"/);
    expect(code("src/components/publication/KitPublication.tsx")).not.toMatch(/<span aria-label="Avertissement"/);
    expect(code("src/components/bibliotheque/DetailsValeur.tsx")).toMatch(/role="img"[^>]*aria-label=\{`Plans de/);
  });

  it("l'état des étapes se lit autrement qu'à la couleur", () => {
    const etape = (cle: string, statut: EtapeTravail["statut"]): EtapeTravail => ({ cle, nom: cle, icone: "film", dependDe: [], statut, progression: 40, sortieFichierIds: [] });
    const html = renderToStaticMarkup(createElement(ProgressionEtapes, { etapes: [etape("Voix", "terminee"), etape("Images", "en_cours"), etape("Montage", "en_attente")], progression: 40 }));
    expect(html).toContain("terminée");
    expect(html).toContain("en cours");
    expect(html).toMatch(/aria-current="step"/);
  });

  it("tableau des mesures : chaque chiffre porte son nom pour les lecteurs d'écran", () => {
    const mesures = code("src/components/generateur/SaisieMesures.tsx");
    expect(mesures).toMatch(/<span className="sr-only">Partis avant 3 s/);
    expect(mesures).toMatch(/<span className="sr-only">Durée moyenne/);
  });

  it("sélecteur en pastilles : groupe radio en choix unique, raison d'une option grisée reliée au bouton", () => {
    const html = renderToStaticMarkup(
      createElement(SelecteurPastilles<string>, {
        libelle: "Durée",
        valeur: "a",
        onChange: () => undefined,
        options: [
          { valeur: "a", libelle: "30 s" },
          { valeur: "b", libelle: "60 s", desactive: true, raison: "Pas encore possible" },
        ],
      }),
    );
    expect(html).toMatch(/role="radiogroup"/);
    expect(html).toMatch(/aria-checked="true"/);
    const idRaison = html.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(idRaison).toBeTruthy();
    expect(html).toContain(`id="${idRaison}"`);
    expect(html).toMatch(/Pas encore possible<\/span>/);
  });

  it("boutons répétés : le nom de l'élément est dans le libellé", () => {
    expect(code("src/components/ecrire/OngletIdees.tsx")).not.toMatch(/libelle="Plus d'actions"/);
    expect(code("src/components/creation/ListeModeles.tsx")).not.toMatch(/libelle="Plus d'actions"/);
    expect(code("src/components/voix/MaVoix.tsx")).not.toMatch(/aria-label="Ranger"/);
  });

  it("sous-titres : un seul mot atteignable par Tab, flèches pour passer d'un mot à l'autre", () => {
    const st = code("src/components/videos/fiche/OngletSousTitres.tsx");
    expect(st).toMatch(/tabIndex=\{[^}]*\? 0 : -1\}/);
    expect(st).toMatch(/ArrowRight/);
    expect(st).toMatch(/ArrowLeft/);
  });

  it("zone de texte : l'erreur est reliée au champ", () => {
    const html = renderToStaticMarkup(createElement(ZoneTexte, { libelle: "Texte", id: "z", value: "", onChange: () => undefined, erreur: "Trop long" }));
    expect(html).toMatch(/aria-describedby="z-message"/);
    expect(html).toMatch(/<p id="z-message"[^>]*>Trop long<\/p>/);
  });
});

describe("n° 10 (partiel) — débordements à 375 px", () => {
  it("avertissement long du kit de publication : retour à la ligne permis", () => {
    expect(code("src/components/publication/KitPublication.tsx")).toMatch(/<Pastille key=\{a\.code\}[^>]*whitespace-normal/);
  });
  it("chiffres en grande police : coupure des mots dans une case qui peut rétrécir", () => {
    const dv = code("src/components/bibliotheque/DetailsValeur.tsx");
    expect(dv).toMatch(/className="min-w-0 rounded-2xl bg-surface-2 p-3 text-center"/);
    expect(dv).toMatch(/break-words font-titre text-2xl/);
  });
});
