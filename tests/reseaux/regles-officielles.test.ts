/**
 * L8-01 : forme du relevé des règles officielles (docs/reseaux/regles-officielles.json). Aucun appel réel.
 * Chaque cellule : valeur + niveau de preuve ; hors « inconnu », une URL https et une date ; une source de plus de
 * 6 mois porte « à revérifier ».
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface Cellule {
  valeur: string;
  preuve: "officiel" | "secondaire" | "inconnu";
  url: string | null;
  date: string | null;
  copie_depot: string | null;
  a_reverifier?: boolean;
}
interface Constante {
  nom: string;
  valeur_code: string;
  statut: "conforme" | "écart" | "inconnu";
  cellule: string;
  note: string;
}
interface Releve {
  version: number;
  consulte_le: string;
  reseaux: Record<string, { statut?: string; reseau?: Record<string, Cellule>; zernio?: Record<string, Cellule> }>;
  constantes: Constante[];
}

const releve = JSON.parse(readFileSync("docs/reseaux/regles-officielles.json", "utf8")) as Releve;
const RUBRIQUES = [
  "premier_commentaire", "reponses_commentaires", "messages_prives", "duplication", "statistiques",
  "plafond_posts", "plafond_texte", "plafond_mots_dieses", "format_video", "format_carrousel_document", "texte_alternatif",
];
const ACTIFS = ["linkedin", "instagram", "facebook", "tiktok"];

function cellules(): { chemin: string; c: Cellule }[] {
  const out: { chemin: string; c: Cellule }[] = [];
  for (const [r, v] of Object.entries(releve.reseaux)) {
    for (const couche of ["reseau", "zernio"] as const) {
      for (const [k, c] of Object.entries(v[couche] ?? {})) out.push({ chemin: `${r}.${couche}.${k}`, c });
    }
  }
  return out;
}

describe("relevé des règles officielles (L8-01)", () => {
  it("a la bonne forme : 4 réseaux actifs, deux couches séparées, YouTube éteint", () => {
    expect(releve.version).toBe(1);
    expect(releve.consulte_le).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const r of ACTIFS) {
      for (const couche of ["reseau", "zernio"] as const) {
        expect(Object.keys(releve.reseaux[r]?.[couche] ?? {}).sort(), `${r}.${couche}`).toEqual([...RUBRIQUES].sort());
      }
    }
    expect(releve.reseaux.youtube?.statut).toBe("éteint");
    expect(Object.keys(releve.reseaux).sort()).toEqual([...ACTIFS, "youtube"].sort());
  });

  it("chaque cellule a un niveau de preuve, une URL et une date, ou vaut « inconnu »", () => {
    const toutes = cellules();
    expect(toutes.length).toBe(ACTIFS.length * 2 * RUBRIQUES.length);
    for (const { chemin, c } of toutes) {
      expect(["officiel", "secondaire", "inconnu"], chemin).toContain(c.preuve);
      expect(typeof c.valeur, chemin).toBe("string");
      if (c.preuve === "inconnu") {
        expect(c.valeur, chemin).toBe("inconnu");
        expect(c.url, chemin).toBeNull();
        expect(c.date, chemin).toBeNull();
        expect(c.copie_depot, chemin).toBeNull();
      } else {
        expect(c.copie_depot ?? "", chemin).toMatch(/^docs\/[^#\s]+\.json#\/\S+$/);
        const [fichier, pointeur] = (c.copie_depot ?? "#").split("#");
        expect(existsSync(fichier), `${chemin} → ${fichier}`).toBe(true);
        let noeud: unknown = JSON.parse(readFileSync(fichier, "utf8"));
        for (const partie of pointeur.slice(1).split("/")) {
          noeud = (noeud as Record<string, unknown> | undefined)?.[partie.replace(/~1/g, "/").replace(/~0/g, "~")];
        }
        expect(noeud, `${chemin} → ${c.copie_depot}`).toBeDefined();
        expect(c.valeur.trim().length, chemin).toBeGreaterThan(0);
        expect(c.valeur, chemin).not.toBe("inconnu");
        expect(c.url ?? "", chemin).toMatch(/^https:\/\/[^\s]+$/);
        expect(c.date ?? "", chemin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number.isFinite(Date.parse(c.date ?? "")), chemin).toBe(true);
      }
    }
  });

  it("aucune source de plus de 6 mois n'est sans « à revérifier »", () => {
    const limite = Date.now() - 183 * 24 * 3600 * 1000;
    for (const { chemin, c } of cellules()) {
      if (c.preuve === "inconnu" || !c.date) continue;
      if (Date.parse(c.date) < limite) expect(c.a_reverifier, chemin).toBe(true);
    }
  });

  it("confronte les constantes de zernio-corps.ts à leur source", () => {
    const noms = releve.constantes.map((k) => k.nom);
    for (const n of ["REEL_FACEBOOK_DUREE_SEC", "ALT_MAX", "TITRE_DOCUMENT_MAX"]) expect(noms).toContain(n);
    const toutes = new Set(cellules().map((x) => x.chemin));
    for (const k of releve.constantes) {
      expect(["conforme", "écart", "inconnu"], k.nom).toContain(k.statut);
      expect(toutes.has(k.cellule), `${k.nom} → ${k.cellule}`).toBe(true);
      expect(k.note.length, k.nom).toBeGreaterThan(0);
    }
  });

  it("ne contient ni identifiant réel, ni prix", () => {
    for (const f of ["docs/reseaux/regles-officielles.json", "docs/reseaux/REGLES-OFFICIELLES.md"]) {
      const t = readFileSync(f, "utf8");
      expect(t, f).not.toMatch(/[€$]\s?\d|\d\s?(€|euros?|dollars?)\b/i);
      expect(t, f).not.toMatch(/urn:li:(organization|person):\d{5,}/);
    }
  });

  const motsFondateur = (process.env.MOTS_FONDATEUR ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  it.skipIf(motsFondateur.length === 0)("ne contient aucun mot de la liste MOTS_FONDATEUR (variable d'environnement)", () => {
    for (const f of ["docs/reseaux/regles-officielles.json", "docs/reseaux/REGLES-OFFICIELLES.md"]) {
      const t = readFileSync(f, "utf8").toLowerCase();
      for (const m of motsFondateur) expect(t.includes(m.toLowerCase()), f).toBe(false);
    }
  });

  it("le document garde « À valider par le fondateur » en dernière section, au plus 10 lignes", () => {
    const t = readFileSync("docs/reseaux/REGLES-OFFICIELLES.md", "utf8");
    const i = t.lastIndexOf("## À valider par le fondateur");
    expect(i).toBeGreaterThan(0);
    const lignes = t.slice(i).split("\n").slice(1).filter((l) => l.trim());
    expect(lignes.length).toBeGreaterThan(0);
    expect(lignes.length).toBeLessThanOrEqual(10);
  });

  it("le document reprend exactement le relevé : chaque ligne de chaque couche et des constantes", () => {
    const md = readFileSync("docs/reseaux/REGLES-OFFICIELLES.md", "utf8");
    const NOMS: Record<string, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" };
    const LIBELLES = [
      "Premier commentaire", "Réponses aux commentaires", "Messages privés", "Duplication de contenu", "Statistiques",
      "Plafond de posts", "Longueur de texte", "Mots-dièse", "Vidéo (durée, taille)", "Carrousel / document PDF", "Texte alternatif",
    ];
    for (const r of ACTIFS) {
      for (const [couche, titre] of [["reseau", "Couche 1 : règles du réseau"], ["zernio", "Couche 2 : règles de Zernio"]] as const) {
        const entete = `### ${titre} (${NOMS[r]})\n`;
        const debut = md.indexOf(entete);
        expect(debut, entete).toBeGreaterThan(-1);
        const fin = md.indexOf("\n\n##", debut + entete.length);
        const lignes = md.slice(debut + entete.length, fin).split("\n");
        RUBRIQUES.forEach((rub, i) => {
          const c = releve.reseaux[r][couche]![rub];
          const attendue = `| ${LIBELLES[i]} | ${c.valeur} | ${c.preuve} | ${c.url ? `[source](${c.url})` : "—"} | ${c.copie_depot ? `\`${c.copie_depot}\`` : "—"} | ${c.date ?? "—"} |`;
          expect(lignes, `${r}.${couche}.${rub}`).toContain(attendue);
        });
      }
    }
    for (const k of releve.constantes) {
      const attendue = `| \`${k.nom}\` | ${k.valeur_code} | **${k.statut}** | \`${k.cellule}\` | ${k.note} |`;
      expect(md.split("\n"), k.nom).toContain(attendue);
    }
  });
});
