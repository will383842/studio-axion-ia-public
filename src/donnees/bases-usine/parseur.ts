/**
 * PARSEUR DES BASES DE L'USINE (`le dépôt privé des bases/usine/bases/pour-la-machine/*.md`). PUR, sans alias « @/ », sans
 * accès fichier : il reçoit le texte d'un fichier et rend ses tables. Forme lue (CONTRATS-ECHANGE § 2) : chaque table est
 * annoncée par `## table: <nom>`, suivie d'un tableau markdown dont les en-têtes sont les noms de champs. Le texte qui
 * sépare le titre du tableau (explications) est ignoré. Un « | » dans une cellule s'écrit `\|`.
 *
 * Refus du fichier entier (comme l'import de l'Usine) : ligne au mauvais nombre de colonnes, colonne `code` vide ou en
 * double dans une table, deux tables du même nom. Les cellules restent du TEXTE brut (rien n'est interprété ici).
 */

export type LigneBrute = Record<string, string>;

export interface TableBrute {
  colonnes: string[];
  lignes: LigneBrute[];
}

export type TablesBrutes = Record<string, TableBrute>;

/** Découpe une ligne de tableau en cellules : `\|` reste une barre dans la cellule, les bords « | » sont retirés. */
export function decouperLigne(ligne: string): string[] {
  const s = ligne.trim();
  const cellules: string[] = [];
  let courante = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && s[i + 1] === "|") {
      courante += "|";
      i++;
    } else if (c === "|") {
      cellules.push(courante);
      courante = "";
    } else {
      courante += c;
    }
  }
  cellules.push(courante);
  // Le tableau commence et finit par « | » : la première et la dernière pièce sont vides.
  if (s.startsWith("|")) cellules.shift();
  if (s.endsWith("|") && !s.endsWith("\\|")) cellules.pop();
  return cellules.map((c) => c.trim());
}

function estSeparateur(cellules: string[]): boolean {
  return cellules.length > 0 && cellules.every((c) => /^:?-{1,}:?$/.test(c));
}

/** Lit toutes les tables d'un fichier. `fichier` ne sert qu'aux messages d'erreur. */
export function parserTables(texte: string, fichier = "(texte)"): TablesBrutes {
  const lignes = texte.replace(/\r\n/g, "\n").split("\n");
  const tables: TablesBrutes = {};
  let nom: string | null = null;
  let table: TableBrute | null = null;
  let tableFermee = false;

  for (let i = 0; i < lignes.length; i++) {
    const brute = lignes[i];
    const numero = i + 1;
    const titre = /^##\s*table\s*:\s*(\S+)\s*$/.exec(brute);
    if (titre) {
      nom = titre[1];
      if (tables[nom]) throw new Error(`${fichier}, ligne ${numero} : la table « ${nom} » est déjà définie.`);
      table = null;
      tableFermee = false;
      continue;
    }
    if (nom === null || tableFermee) continue;

    if (!brute.trim().startsWith("|")) {
      // Une ligne sans « | » après les lignes du tableau le ferme ; avant l'en-tête, c'est du texte d'explication.
      if (table) tableFermee = true;
      continue;
    }

    const cellules = decouperLigne(brute);
    if (!table) {
      if (new Set(cellules).size !== cellules.length) throw new Error(`${fichier}, ligne ${numero} : en-tête de « ${nom} » avec une colonne en double.`);
      table = { colonnes: cellules, lignes: [] };
      tables[nom] = table;
      continue;
    }
    if (table.lignes.length === 0 && estSeparateur(cellules)) continue;
    if (cellules.length !== table.colonnes.length) {
      throw new Error(`${fichier}, ligne ${numero} : « ${nom} » attend ${table.colonnes.length} colonnes, la ligne en a ${cellules.length}.`);
    }
    const ligne: LigneBrute = {};
    table.colonnes.forEach((col, k) => {
      ligne[col] = cellules[k];
    });
    table.lignes.push(ligne);
  }

  for (const [n, t] of Object.entries(tables)) {
    if (!t.colonnes.includes("code")) continue;
    const vus = new Set<string>();
    for (const l of t.lignes) {
      if (l.code === "") throw new Error(`${fichier} : la table « ${n} » a une ligne sans code.`);
      if (vus.has(l.code)) throw new Error(`${fichier} : code en double dans « ${n} » : ${l.code}.`);
      vus.add(l.code);
    }
  }
  return tables;
}

/** Liste séparée par « ; » (règle de lecture du contrat) : cellules vides retirées. */
export function listeDe(cellule: string): string[] {
  return cellule
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}
