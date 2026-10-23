/**
 * Vérification finale B — gênes « mobile 375 px » relevées par VERIF-E2E-2 (n° 5, 6, 8, 9, 10, 11).
 * Sans navigateur : on lit le code des écrans (règles qui ne doivent plus revenir).
 * Mesure réelle : tests/e2e-verif2-pages.mjs en 375 px.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lire = (chemin: string) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");
const veille = lire("src/app/(studio)/veille/_composants/EcranVeille.tsx");
const fiche = lire("src/components/generateur/FicheSujet.tsx");
const liste = lire("src/components/generateur/ListeSujets.tsx");
const coquille = lire("src/components/coquille/Coquille.tsx");
const video = lire("src/app/(studio)/videos/[id]/page.tsx");
const apercu = lire("src/assistant/etapes/Apercu.tsx");
const calendrier = lire("src/app/(studio)/calendrier/page.tsx");
const css = lire("src/app/globals.css");
const bandeau = lire("src/components/coquille/BandeauHorsLigne.tsx");

describe("n° 5 — /veille ne déborde plus", () => {
  it("la grille des outils a une colonne qui rétrécit, et chaque carte peut rétrécir", () => {
    expect(veille).toMatch(/<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">/);
    expect(veille).toMatch(/<li key=\{o\.id\} className="min-w-0">\s*<CarteOutil/);
  });
});

describe("n° 6 — fiche sujet : la raison du bouton désactivé reste visible", () => {
  it("« Validez la limite ci-dessus. » est placé AVANT la barre collée", () => {
    const texte = fiche.indexOf("Validez la limite ci-dessus.");
    const barre = fiche.indexOf("<BarreActionCollee>");
    expect(texte).toBeGreaterThan(-1);
    expect(barre).toBeGreaterThan(-1);
    expect(texte).toBeLessThan(barre);
  });
});

describe("n° 8 et 9 — rangée des réseaux de la liste des sujets", () => {
  it("le bouton Format est borné à 6rem et tronqué", () => {
    expect(liste).toMatch(/max-w-\[6rem\] shrink-0/);
    expect(liste).not.toMatch(/max-w-\[7\.5rem\]/);
    expect(liste).toMatch(/<span className="truncate">\{formatActif\?\.nom \?\? "Format"\}<\/span>/);
  });
  it("collée sous l'en-tête en tenant compte de la zone sûre (même hauteur que l'en-tête de la coquille)", () => {
    expect(coquille).toMatch(/flex h-16 /);
    expect(coquille).toMatch(/pt-\[env\(safe-area-inset-top\)\]/);
    expect(liste).toMatch(/sticky top-\[calc\(4rem\+env\(safe-area-inset-top\)\)\]/);
    expect(liste).not.toMatch(/sticky top-16 /);
  });
});

describe("n° 10 — textes longs dans des éléments étroits", () => {
  it("fiche vidéo : libellé + pastille Essai passent à la ligne dans les 3 colonnes", () => {
    expect(video).toMatch(/<li key=\{c\.libelle\} className="min-w-0">/);
    expect(video).toMatch(/<p className="flex flex-wrap items-center gap-x-1\.5 gap-y-1 text-xs/);
  });
  it("aperçu : « Conseillé » et « Droits » sont dans un même conteneur qui se replie (plus de chevauchement)", () => {
    expect(apercu).toMatch(/absolute inset-x-1 top-1 flex flex-wrap items-start justify-between gap-1/);
    expect(apercu).not.toMatch(/<span className="absolute left-1 top-1">\s*<Pastille/);
    expect(apercu).not.toMatch(/<span className="absolute right-1 top-1">\s*<Pastille/);
  });
  it("calendrier : le nom du compte se tronque au lieu de pousser la ligne", () => {
    expect(calendrier).toMatch(/<span className="flex min-w-0 items-center gap-1\.5 text-xs text-texte-faible">/);
    expect(calendrier).toMatch(/<span className="min-w-0 truncate">· \{p\.canalNom\}<\/span>/);
  });
  it("une adresse collée passe à la ligne (body + blocs de texte libre), sans toucher pastilles et boutons", () => {
    const body = css.match(/ body \{[^}]*\}/)?.[0] ?? "";
    expect(body).toMatch(/overflow-wrap: break-word;/);
    expect(css).toMatch(/:where\(p, dd, blockquote, h1, h2, h3\) \{\s*overflow-wrap: anywhere;/);
    expect(css).not.toMatch(/:where\([^)]*\b(button|span)\b[^)]*\) \{\s*overflow-wrap: anywhere/);
  });
});

describe("n° 11 — bandeau hors ligne", () => {
  it("une seule ligne, texte court sur mobile, phrase complète à partir de sm:", () => {
    expect(bandeau).toMatch(/whitespace-nowrap/);
    expect(bandeau).toMatch(/<span className="sm:hidden">Hors ligne<\/span>/);
    expect(bandeau).toMatch(/<span className="hidden truncate sm:inline">Vous êtes hors ligne\./);
  });
  it("posé sous l'en-tête (ne recouvre ni logo, ni recherche, ni cloche)", () => {
    expect(bandeau).toMatch(/fixed inset-x-0 top-\[calc\(4rem\+env\(safe-area-inset-top\)\+8px\)\]/);
    expect(bandeau).not.toMatch(/fixed inset-x-0 top-0 /);
  });
});
