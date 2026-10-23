/**
 * G1b : LEXIQUE VÉRIFIÉ (plan v5 B.6.18). Les mots que Will voit pour le générateur viennent de `domaine/libelles.ts` ;
 * aucun mot interdit (job, prompt, avatar…) n'y figure, ni dans le texte des écrans du lot, et l'étiquette IA n'est
 * jamais un point ambre.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADRESSES,
  BUTS_SUJET,
  ETATS_RESEAU_GENERATEUR,
  ETATS_SUJET_GENERATEUR,
  FAMILLES_FORMAT,
  LEXIQUE_GENERATEUR,
  libelleLigneGrille,
  MANQUES_GENERATEUR,
  MOTIFS_REFUS,
  MOTS_INTERDITS_ECRAN,
  nomFormatGenerateur,
  QUI_PARLE,
} from "@/domaine/libelles";
import { VUES_RAPIDES } from "@/domaine/classement-generateur";

const RACINE = join(__dirname, "..", "src");

function motInterdit(texte: string): string | undefined {
  const t = texte.toLowerCase();
  return MOTS_INTERDITS_ECRAN.find((m) => new RegExp(`(^|[^\\p{L}])${m}s?([^\\p{L}]|$)`, "u").test(t));
}

function valeursAffichees(o: unknown): string[] {
  if (typeof o === "string") return [o];
  if (Array.isArray(o)) return o.flatMap(valeursAffichees);
  if (o && typeof o === "object") return Object.entries(o).flatMap(([k, v]) => (k === "icone" || k === "tonalite" || k === "signe" ? [] : valeursAffichees(v)));
  return [];
}

describe("lexique B.6.18", () => {
  it("chaque terme du plan a son mot à l'écran (ou « jamais affiché »)", () => {
    const attendus: [string, string | null][] = [
      ["variante", "version TikTok"],
      ["corps commun", "le milieu"],
      ["corps distinct", "vidéo refaite en entier"],
      ["mode", "Qui parle"],
      ["ScriptMaitre", "sujet"],
      ["ANCRAGE_MANQUANT", "il manque une matière"],
      ["a-reverifier", "milieu modifié, à revoir"],
      ["brouillon", "sujet sans numéro"],
      ["pilier", "thème"],
      ["-L", "je lis"],
      ["-T", "tu"],
      ["-A2", "2e accroche"],
      ["etiquette IA", "étiquette IA (facultative)"],
      ["marqueur", null],
      ["point de vue", null],
    ];
    for (const [terme, mot] of attendus) expect(LEXIQUE_GENERATEUR[terme], terme).toBe(mot);
  });

  it("aucun mot interdit dans les libellés du générateur", () => {
    const tous = [LEXIQUE_GENERATEUR, ETATS_RESEAU_GENERATEUR, ETATS_SUJET_GENERATEUR, MANQUES_GENERATEUR, BUTS_SUJET, QUI_PARLE, ADRESSES, MOTIFS_REFUS, FAMILLES_FORMAT, VUES_RAPIDES].flatMap(valeursAffichees);
    expect(tous.length).toBeGreaterThan(60);
    for (const t of tous) expect(motInterdit(t), t).toBeUndefined();
  });

  it("une case = une couleur ET un signe ; « Qui parle » et lettres du code", () => {
    for (const [e, d] of Object.entries(ETATS_RESEAU_GENERATEUR)) expect(d.signe, e).toBeTruthy();
    expect(new Set(Object.values(ETATS_RESEAU_GENERATEUR).filter((d) => d.signe !== "vide").map((d) => d.tonalite)).size).toBeGreaterThanOrEqual(4);
    expect(QUI_PARLE.avatar.libelle).toBe("Mon double");
    expect([QUI_PARLE.teleprompteur.lettre, QUI_PARLE.trame.lettre, QUI_PARLE["voix-off"].lettre, ADRESSES.tu.lettre]).toEqual(["L", "I", "V", "T"]);
    expect(libelleLigneGrille("Avocat", "teleprompteur", "tu")).toBe("Avocat · je lis · tu");
    expect(libelleLigneGrille("Avocat", "avatar", "vous")).toBe("Avocat");
    expect(nomFormatGenerateur("Type avocat")).toBe("Avocat");
    expect(BUTS_SUJET.notoriete.libelle).toBe("Faire partager");
  });

  it("le texte affiché par les écrans du lot ne contient aucun mot interdit, et l'étiquette IA n'est jamais un point ambre", () => {
    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.tsx$/.test(f)) fichiers.push(p);
      }
    };
    parcourir(join(RACINE, "components", "generateur"));
    parcourir(join(RACINE, "app", "(studio)", "ecrire"));
    fichiers.push(join(RACINE, "app", "(studio)", "videos", "a-ranger", "page.tsx"), join(RACINE, "app", "(studio)", "_accueil", "TuilesEcrire.tsx"));
    expect(fichiers.length).toBeGreaterThanOrEqual(10);
    for (const f of fichiers) {
      const src = readFileSync(f, "utf8");
      // Texte JSX (entre deux balises) et chaînes passées aux notifications et libellés.
      const textes = [...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]).concat([...src.matchAll(/(?:libelle|titre|phrase|description|placeholder|notifier\.\w+\()\s*[=:(]?\s*"([^"]+)"/g)].map((m) => m[1]));
      for (const t of textes) expect(motInterdit(t), `${f} : ${t}`).toBeUndefined();
    }
    // Code seulement (commentaires retirés) : aucune lecture de l'étiquette IA dans l'écran des versions.
    const fiche = readFileSync(join(RACINE, "components", "generateur", "FicheSujet.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(fiche).not.toMatch(/etiquetteIA|étiquette IA/i);
  });
});
