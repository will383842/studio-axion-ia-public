/**
 * IMAGE → VIDÉO · Contrat de la « carte de l'image » (`carte-image/1`, plan § 2). PUR, importable côté client et par
 * `studio-rendu` (aucun alias « @/ », aucun accès au serveur).
 *
 * La carte décrit ce que montre une infographie d'Axion-IA : nœuds, liens, groupes, chiffres, phrase-choc. Deux lectures
 * Claude la proposent (lot L5) ; le CODE en recalcule tout ce qui se calcule (chiffres, formules absolues, cohérence,
 * types) et la contrôle avant de la montrer à Will, qui la corrige puis la valide. Un changement de forme = nouvelle
 * version, jamais une retouche.
 */
import { z } from "zod";
import { OFFRES, type Offre } from "../../formats/cas-concret/cas";
import { chiffresDe, cleChiffre, UNITES_CHIFFRE } from "./chiffres";
import { typesDeLaCarte } from "./complexite";
import { formulesAbsoluesDe } from "./formules";
import { iconeDe } from "./icones";

export const VERSION_CARTE_IMAGE = "carte-image/1";

/** Types reconnus. Une image peut en combiner deux (ex. `avant-apres` dont un côté converge). */
export const TYPES_IMAGE = [
  "benefices",
  "chaine",
  "embranchement",
  "entonnoir",
  "avant-apres",
  "convergence",
  "tableau-de-bord",
  "chronologie",
] as const;
export type TypeImage = (typeof TYPES_IMAGE)[number];

export const ROLES_NOEUD = ["declencheur", "etape", "decision", "sortie", "resultat", "benefice", "source", "moteur", "indicateur"] as const;
export type RoleNoeud = (typeof ROLES_NOEUD)[number];
export const COULEURS_IMAGE = ["orange", "noir", "vert", "neutre"] as const;
export type CouleurImage = (typeof COULEURS_IMAGE)[number];
export const ACTEURS = ["auto", "humain", "inconnu"] as const;
export const SORTES_GROUPE = ["branche", "avant", "apres", "colonne", "sources", "sorties"] as const;

const id = z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "Identifiant : minuscules, chiffres et tirets.");
const texte = z.string().trim().min(1).max(300);

export const schemaChiffreCarte = z.strictObject({
  id,
  brut: z.string().trim().min(1).max(60),
  valeur: z.number().finite().nullable(),
  unite: z.enum(UNITES_CHIFFRE),
  dansNoeud: id.optional(),
  dansLien: id.optional(),
  dansBandeau: z.boolean().optional(),
  /** Faux = affiché seulement (choix de Will). */
  aDire: z.boolean(),
  /** Concordance des deux lectures. */
  lu: z.enum(["les-deux", "une-seule"]),
});

export const schemaNoeudCarte = z.strictObject({
  id,
  /** Texte EXACT de l'image. */
  libelle: texte,
  detail: texte.optional(),
  role: z.enum(ROLES_NOEUD),
  /** Ce que Claude voit (« enveloppe », « horloge ») ; traduit par la table d'icônes. */
  icone: z.string().trim().min(1).max(40).optional(),
  couleur: z.enum(COULEURS_IMAGE),
  acteur: z.enum(ACTEURS),
  groupe: id.optional(),
  /** Ordre de lecture (flèches, sinon haut → bas, gauche → droite). */
  ordre: z.number().int().min(0).max(999),
  /** Objets dessinés en nombre (20 enveloppes) → nuée ou entonnoir. */
  quantite: z.number().int().min(1).max(99).optional(),
  sousElements: z.array(texte).max(12).optional(),
  /** Nom d'illustration (« Martin ») : toujours dit « par exemple ». */
  exemple: z.boolean().optional(),
  /** Photo de vraies personnes : JAMAIS reprise, seul le contenu utile est redessiné (M3). */
  photoPersonnes: z.boolean().optional(),
  /** Ajouté ou corrigé par Will : devient une source (I9). */
  ajoutWill: z.boolean().optional(),
});

export const schemaLienCarte = z.strictObject({
  id,
  de: id,
  vers: id,
  etiquette: texte.optional(),
  /** Part portée par la flèche (80 pour « 80 % »). */
  part: z.number().min(0).max(100).optional(),
  couleur: z.enum(COULEURS_IMAGE),
  style: z.enum(["plein", "pointille"]),
  /** Vrai → flèche NON dessinée sur l'image, déduite par le code de la mise en page (bloc suivant dans sa branche) : à vérifier. */
  deduit: z.boolean().optional(),
});

export const schemaGroupeCarte = z.strictObject({
  id,
  sorte: z.enum(SORTES_GROUPE),
  titre: texte.optional(),
  noeuds: z.array(id).min(1).max(40),
  /** Branche orange / plus grosse part : racontée en premier. */
  majoritaire: z.boolean().optional(),
});

export const schemaCoherenceCarte = z.strictObject({
  /** « 8 + 6 + 5 = 19 », « 19 × 20 = 6 h 20 ≠ 6 h ». */
  calcul: z.string().trim().min(1).max(120),
  /** Faux = SIGNALÉ à Will, JAMAIS corrigé : le script dit ce qui est écrit. */
  ok: z.boolean(),
});

export const schemaFormuleAbsolue = z.strictObject({
  texte: texte,
  ou: z.string().trim().min(1).max(80),
  proposition: texte,
  choixWill: z.enum(["garder", "reformuler"]).optional(),
});

export const schemaCarteImage = z.strictObject({
  version: z.literal(VERSION_CARTE_IMAGE),
  image: z.strictObject({
    cle: z.string().trim().min(1).max(300),
    empreinte: z.string().trim().min(1).max(128),
    largeur: z.number().int().positive(),
    hauteur: z.number().int().positive(),
    orientation: z.enum(["portrait", "paysage", "carre"]),
  }),
  /** Principal, secondaire éventuel. */
  types: z.union([z.tuple([z.enum(TYPES_IMAGE)]), z.tuple([z.enum(TYPES_IMAGE), z.enum(TYPES_IMAGE)])]),
  /** Déduite du type, corrigeable à l'écran Déposer (B1). */
  offre: z.enum(OFFRES),
  /** Vrai → annonce « situation type » obligatoire (I7). */
  automatisation: z.boolean(),
  titre: texte,
  sousTitre: texte.optional(),
  /** Texte EXACT du bas de l'image. */
  phraseChoc: texte,
  /** Version retenue par Will si la phrase-choc porte un interdit ou une formule absolue (I9). */
  phraseChocValidee: texte.optional(),
  formulesAbsolues: z.array(schemaFormuleAbsolue).max(40),
  signature: texte.optional(),
  noeuds: z.array(schemaNoeudCarte).min(1).max(40),
  liens: z.array(schemaLienCarte).max(60),
  groupes: z.array(schemaGroupeCarte).max(20),
  /** Textes exacts du bandeau de chiffres (« 19 min économisées »), dans l'ordre de l'image. */
  bandeau: z.array(texte).max(6),
  /** Ids des chiffres du bandeau. */
  bandeauChiffres: z.array(id).max(12),
  /** Inventaire COMPLET, ré-extrait par le code (`chiffresDeLaCarte`). */
  chiffres: z.array(schemaChiffreCarte).max(80),
  /** Mentions de bas d'image (« Cas concrets · Ateliers pratiques… »). */
  pied: z.array(texte).max(10),
  coherence: z.array(schemaCoherenceCarte).max(20),
  lecture: z.strictObject({
    ecarts: z.array(z.strictObject({ champ: z.string().min(1).max(80), lectureA: z.string().max(300), lectureB: z.string().max(300) })).max(60),
    alertes: z.array(z.string().min(1).max(300)).max(60),
  }),
  validation: z.strictObject({ par: z.enum(["will", "reglage"]), le: z.string().min(1).max(40), empreinteCarte: z.string().min(1).max(128) }).optional(),
});

export type CarteImage = z.infer<typeof schemaCarteImage>;
export type NoeudCarte = CarteImage["noeuds"][number];
export type LienCarte = CarteImage["liens"][number];
export type GroupeCarte = CarteImage["groupes"][number];
export type ChiffreCarte = CarteImage["chiffres"][number];
export type CoherenceCarte = CarteImage["coherence"][number];
export type FormuleAbsolue = CarteImage["formulesAbsolues"][number];

// ─── Offre et automatisation déduites du type ────────────────────────────────────────────────────────────────────────

/** Types qui décrivent une automatisation (annonce « situation type » obligatoire). */
const TYPES_AUTOMATISATION: ReadonlySet<TypeImage> = new Set(["chaine", "embranchement", "entonnoir", "avant-apres", "convergence"]);

export function estAutomatisation(types: readonly TypeImage[]): boolean {
  return TYPES_AUTOMATISATION.has(types[0]);
}

/** Offre par défaut : une image d'automatisation vend l'intégration, les autres la formation (corrigeable par Will). */
export function offreDeduite(types: readonly TypeImage[]): Offre {
  return estAutomatisation(types) ? "integration" : "formation";
}

// ─── Textes de la carte, chiffres et formules recalculés par le code ────────────────────────────────────────────────

/** Un texte de la carte et l'endroit où il est écrit, dans un ordre FIXE (champ, puis ordre des listes). */
export interface TexteDeCarte {
  ou: string;
  texte: string;
  dansNoeud?: string;
  dansLien?: string;
  dansBandeau?: boolean;
}

export function textesDeLaCarte(carte: Pick<CarteImage, "titre" | "sousTitre" | "phraseChoc" | "signature" | "noeuds" | "liens" | "bandeau" | "pied">): TexteDeCarte[] {
  const res: TexteDeCarte[] = [{ ou: "titre", texte: carte.titre }];
  if (carte.sousTitre) res.push({ ou: "sousTitre", texte: carte.sousTitre });
  for (const n of carte.noeuds) {
    res.push({ ou: `noeuds.${n.id}.libelle`, texte: n.libelle, dansNoeud: n.id });
    if (n.detail) res.push({ ou: `noeuds.${n.id}.detail`, texte: n.detail, dansNoeud: n.id });
    (n.sousElements ?? []).forEach((s, i) => res.push({ ou: `noeuds.${n.id}.sousElements.${i}`, texte: s, dansNoeud: n.id }));
  }
  for (const l of carte.liens) if (l.etiquette) res.push({ ou: `liens.${l.id}.etiquette`, texte: l.etiquette, dansLien: l.id });
  carte.bandeau.forEach((b, i) => res.push({ ou: `bandeau.${i}`, texte: b, dansBandeau: true }));
  res.push({ ou: "phraseChoc", texte: carte.phraseChoc });
  if (carte.signature) res.push({ ou: "signature", texte: carte.signature });
  carte.pied.forEach((p, i) => res.push({ ou: `pied.${i}`, texte: p }));
  return res;
}

/**
 * Inventaire des chiffres recalculé par le code : un chiffre par occurrence, ids « c01 », « c02 »… dans l'ordre des
 * textes. `aDire` et `lu` sont repris de l'inventaire précédent quand le même chiffre (même écriture, même endroit) y
 * était (choix de Will, concordance des lectures) ; sinon `aDire: true`, `lu: "les-deux"`.
 */
export function chiffresDeLaCarte(carte: Pick<CarteImage, "titre" | "sousTitre" | "phraseChoc" | "signature" | "noeuds" | "liens" | "bandeau" | "pied"> & { chiffres?: ChiffreCarte[] }): ChiffreCarte[] {
  const precedents = carte.chiffres ?? [];
  const res: ChiffreCarte[] = [];
  for (const t of textesDeLaCarte(carte)) {
    if (t.ou === "signature" || t.ou.startsWith("pied.")) continue;
    for (const c of chiffresDe(t.texte)) {
      const avant = precedents.find(
        (p) => cleChiffre(p.brut) === cleChiffre(c.brut) && p.dansNoeud === t.dansNoeud && p.dansLien === t.dansLien && !!p.dansBandeau === !!t.dansBandeau,
      );
      const chiffre: ChiffreCarte = { id: `c${String(res.length + 1).padStart(2, "0")}`, brut: c.brut, valeur: c.valeur, unite: c.unite, aDire: avant?.aDire ?? true, lu: avant?.lu ?? "les-deux" };
      if (t.dansNoeud) chiffre.dansNoeud = t.dansNoeud;
      if (t.dansLien) chiffre.dansLien = t.dansLien;
      if (t.dansBandeau) chiffre.dansBandeau = true;
      res.push(chiffre);
    }
  }
  return res;
}

/** Formules absolues de toute la carte ; le choix de Will déjà fait sur une formule identique est gardé. */
export function formulesDeLaCarte(carte: Parameters<typeof textesDeLaCarte>[0] & { formulesAbsolues?: FormuleAbsolue[] }): FormuleAbsolue[] {
  const avant = carte.formulesAbsolues ?? [];
  return textesDeLaCarte(carte).flatMap((t) =>
    formulesAbsoluesDe(t.texte, t.ou).map((f) => {
      const choix = avant.find((a) => a.ou === f.ou && a.texte === f.texte)?.choixWill;
      return choix ? { ...f, choixWill: choix } : f;
    }),
  );
}

// ─── Cohérence : signalée, jamais corrigée ───────────────────────────────────────────────────────────────────────────

function enHeures(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

function nombreFr(n: number): string {
  return String(n).replace(".", ",");
}

/**
 * Calculs vérifiables d'après la carte, dans un ordre fixe :
 * 1. parts des flèches qui sortent d'un même nœud (« 80 % + 20 % = 100 % ») ;
 * 2. quantités : les sorties d'un nœud refont la quantité entrée (« 16 + 4 = 20 ») ;
 * 3. sommes d'un groupe : étapes chiffrées dans une même unité et leur résultat (« 8 + 6 + 5 = 19 ») ;
 * 4. produits annoncés au bandeau : gain unitaire × volume = total (« 19 × 20 = 6 h 20 ≠ 6 h »).
 * Un calcul faux est SIGNALÉ (`ok: false`) ; le texte de l'image n'est jamais touché.
 */
export function coherenceDe(carte: Pick<CarteImage, "noeuds" | "liens" | "groupes" | "bandeau">): CoherenceCarte[] {
  const res: CoherenceCarte[] = [];
  const parId = new Map(carte.noeuds.map((n) => [n.id, n]));
  const sources = [...new Set(carte.liens.map((l) => l.de))].sort();

  for (const de of sources) {
    const parts = carte.liens.filter((l) => l.de === de && l.part !== undefined).sort((a, b) => a.id.localeCompare(b.id));
    if (parts.length < 2) continue;
    const somme = parts.reduce((s, l) => s + (l.part ?? 0), 0);
    res.push({ calcul: `${parts.map((l) => `${nombreFr(l.part!)} %`).join(" + ")} ${somme === 100 ? "=" : "≠"} 100 %`, ok: somme === 100 });
  }

  for (const de of sources) {
    const entree = parId.get(de);
    const qEntree = carte.liens.filter((l) => l.vers === de).map((l) => parId.get(l.de)?.quantite).find((q) => q !== undefined) ?? entree?.quantite;
    const sorties = carte.liens.filter((l) => l.de === de).map((l) => parId.get(l.vers)).filter((n) => n?.quantite !== undefined);
    // Un seul objet entré ne se répartit pas en plusieurs sorties : « 1 + 1 ≠ 1 » serait un calcul inventé par une
    // lecture qui rend « quantité 1 » par défaut (panne du 15/10). Une sortie de 1 reste comptée (« 19 + 1 = 20 »).
    if (qEntree === undefined || qEntree < 2 || sorties.length < 2) continue;
    const somme = sorties.reduce((s, n) => s + (n!.quantite ?? 0), 0);
    res.push({ calcul: `${sorties.map((n) => n!.quantite).join(" + ")} ${somme === qEntree ? "=" : "≠"} ${qEntree}`, ok: somme === qEntree });
  }

  for (const g of [...carte.groupes].sort((a, b) => a.id.localeCompare(b.id))) {
    const noeuds = g.noeuds.map((i) => parId.get(i)).filter((n): n is NoeudCarte => !!n);
    const chiffresDuNoeud = (n: NoeudCarte) => [n.libelle, n.detail ?? ""].flatMap((t) => chiffresDe(t)).filter((c) => c.valeur !== null);
    const etapes = noeuds.filter((n) => n.role === "etape").map((n) => chiffresDuNoeud(n)[0]).filter((c) => c !== undefined);
    const resultat = noeuds.filter((n) => n.role === "resultat").map((n) => chiffresDuNoeud(n)[0]).find((c) => c !== undefined);
    if (!resultat || etapes.length < 2 || etapes.some((c) => c.unite !== resultat.unite)) continue;
    const somme = etapes.reduce((s, c) => s + (c.valeur ?? 0), 0);
    res.push({ calcul: `${etapes.map((c) => nombreFr(c.valeur!)).join(" + ")} ${somme === resultat.valeur ? "=" : "≠"} ${nombreFr(resultat.valeur!)}`, ok: somme === resultat.valeur });
  }

  // Produit annoncé : « Sur 20 cmd/jour = 6h récupérées » + un gain unitaire en minutes ailleurs dans le bandeau.
  carte.bandeau.forEach((b, i) => {
    const [gauche, droite] = b.split("=");
    if (droite === undefined) return;
    const volume = chiffresDe(gauche).find((c) => c.unite === "nombre" && c.valeur !== null);
    // « = 6 h 20 » se lit comme une heure écrite avec espaces (`chiffresDe`) : après « = », c'est une durée en minutes.
    const total = chiffresDe(droite).find((c) => (c.unite === "h" || c.unite === "min" || c.unite === "heure") && c.valeur !== null);
    const gain = carte.bandeau
      .filter((_, j) => j !== i)
      .flatMap((t) => chiffresDe(t))
      .find((c) => c.unite === "min" && c.valeur !== null);
    if (!volume || !total || !gain) return;
    const produitMin = gain.valeur! * volume.valeur!;
    const totalMin = total.unite === "h" ? total.valeur! * 60 : total.valeur!;
    const ok = produitMin === totalMin;
    const ecrit = total.unite === "min" ? `${nombreFr(totalMin)} min` : enHeures(totalMin);
    res.push({ calcul: `${nombreFr(gain.valeur!)} × ${nombreFr(volume.valeur!)} = ${enHeures(produitMin)}${ok ? "" : ` ≠ ${ecrit}`}`, ok });
  });
  return res;
}

// ─── Contrôles du code sur la carte (avant de la montrer à Will) ────────────────────────────────────────────────────

export interface ControleCarte {
  /** Vrai si aucune erreur bloquante. */
  ok: boolean;
  /** Erreurs bloquantes, une phrase chacune. */
  erreurs: string[];
  /** Points à montrer à Will, non bloquants. */
  alertes: string[];
}

/** Nombre de cycles indépendants trouvés par un parcours en profondeur (arêtes de retour). */
function cycles(noeuds: readonly string[], liens: readonly LienCarte[]): number {
  const suivants = new Map<string, string[]>(noeuds.map((n) => [n, []]));
  for (const l of liens) suivants.get(l.de)?.push(l.vers);
  for (const v of suivants.values()) v.sort();
  const etat = new Map<string, 1 | 2>();
  let retours = 0;
  const visiter = (n: string) => {
    etat.set(n, 1);
    for (const s of suivants.get(n) ?? []) {
      if (etat.get(s) === 1) retours++;
      else if (!etat.has(s)) visiter(s);
    }
    etat.set(n, 2);
  };
  for (const n of [...noeuds].sort()) if (!etat.has(n)) visiter(n);
  return retours;
}

/**
 * Contrôles du § 2, sans appel à Claude : graphe, exigences du type, chiffres recalculés, icônes connues, photos de
 * personnes, lectures discordantes, cohérence (signalée seulement).
 */
export function controlerCarte(carte: CarteImage): ControleCarte {
  const erreurs: string[] = [];
  const alertes: string[] = [];
  const ids = carte.noeuds.map((n) => n.id);
  const parId = new Map(carte.noeuds.map((n) => [n.id, n]));
  const doublons = (liste: string[]) => [...new Set(liste.filter((x, i) => liste.indexOf(x) !== i))].sort();

  for (const d of doublons(ids)) erreurs.push(`Le nœud ${d} est décrit deux fois.`);
  for (const d of doublons(carte.liens.map((l) => l.id))) erreurs.push(`La flèche ${d} est décrite deux fois.`);
  for (const l of carte.liens) {
    if (!parId.has(l.de) || !parId.has(l.vers)) erreurs.push(`La flèche ${l.id} relie un bloc qui n'existe pas.`);
  }
  for (const g of carte.groupes) for (const n of g.noeuds) if (!parId.has(n)) erreurs.push(`Le groupe ${g.id} cite un bloc qui n'existe pas (${n}).`);
  for (const n of carte.noeuds) if (n.groupe && !carte.groupes.some((g) => g.id === n.groupe)) erreurs.push(`Le bloc ${n.id} cite un groupe qui n'existe pas.`);

  const principal = carte.types[0];
  if (principal !== "benefices" && principal !== "tableau-de-bord") {
    const relies = new Set(carte.liens.flatMap((l) => [l.de, l.vers]));
    const isoles = carte.noeuds.filter((n) => !relies.has(n.id) && !n.photoPersonnes).map((n) => n.id).sort();
    for (const n of isoles) erreurs.push(`Le bloc ${n} n'est relié à rien.`);
  }
  if (cycles(ids, carte.liens) > 1) erreurs.push("Le schéma tourne en rond plus d'une fois.");

  // Un lien déduit (non dessiné sur l'image) ne satisfait jamais seul une exigence de forme.
  const sortants = (id: string) => carte.liens.filter((l) => l.de === id && !l.deduit).length;
  if (carte.types.includes("embranchement") && !carte.noeuds.some((n) => sortants(n.id) >= 2)) {
    erreurs.push("Un embranchement demande un bloc d'où partent au moins deux chemins.");
  }
  if (carte.types.includes("entonnoir")) {
    const entree = carte.noeuds.some((n) => (n.quantite ?? 0) >= 2 && sortants(n.id) >= 1);
    // Tout bloc d'où partent au moins deux chemins peut être le filtre : il suffit qu'UN d'eux ait deux sorties
    // chiffrées (jamais « le premier de la liste », qui ferait dépendre le verdict de l'ordre reçu).
    const sortiesChiffrees = (id: string) => carte.liens.filter((l) => l.de === id && !l.deduit && carte.chiffres.some((c) => c.dansNoeud === l.vers || c.dansLien === l.id)).length;
    const filtre = carte.noeuds.some((n) => sortiesChiffrees(n.id) >= 2);
    if (!entree || !filtre) erreurs.push("Un entonnoir demande des objets en nombre à l'entrée et deux sorties chiffrées.");
  }
  if (carte.types.includes("avant-apres") && !(carte.groupes.some((g) => g.sorte === "avant") && carte.groupes.some((g) => g.sorte === "apres"))) {
    erreurs.push("Un avant / après demande un groupe « avant » et un groupe « après ».");
  }

  const attendus = chiffresDeLaCarte(carte);
  const cle = (c: Pick<ChiffreCarte, "brut" | "dansNoeud" | "dansLien" | "dansBandeau">) => `${cleChiffre(c.brut)}|${c.dansNoeud ?? ""}|${c.dansLien ?? ""}|${c.dansBandeau ? 1 : 0}`;
  const donnes = carte.chiffres.map(cle).sort();
  const recalcules = attendus.map(cle).sort();
  if (donnes.join("\n") !== recalcules.join("\n")) erreurs.push("La liste des chiffres ne correspond pas aux textes de l'image.");
  for (const b of carte.bandeauChiffres) if (!carte.chiffres.some((c) => c.id === b)) erreurs.push(`Le bandeau cite un chiffre inconnu (${b}).`);
  for (const c of carte.chiffres) if (c.lu === "une-seule") alertes.push(`Le chiffre « ${c.brut} » n'a été lu qu'une fois : vérifiez-le.`);

  for (const n of carte.noeuds) {
    if (n.icone && iconeDe(n.icone) === null) alertes.push(`Icône inconnue pour « ${n.libelle} » : choisissez-en une.`);
    if (n.photoPersonnes) alertes.push(`« ${n.libelle} » est une photo de personnes : elle ne sera pas reprise, seul son contenu sera redessiné.`);
  }
  for (const l of carte.liens) {
    if (l.deduit) alertes.push(`Lien déduit de la mise en page, à vérifier : ${l.vers} suit ${l.de} dans sa branche (aucune flèche n'est dessinée sur l'image).`);
  }
  for (const c of coherenceDe(carte)) if (!c.ok) alertes.push(`Calcul à vérifier sur l'image : ${c.calcul}.`);
  for (const f of formulesDeLaCarte(carte)) if (!f.choixWill) alertes.push(`Formule très affirmative : « ${f.texte} ». Version prudente proposée.`);

  return { ok: erreurs.length === 0, erreurs, alertes };
}

// ─── Blocs sans flèche posés dans une branche ──────────────────────────────────────────────────────────────────────

/**
 * Un bloc sans aucune flèche (pastille sous une branche) que la carte range dans UNE branche est relié au bloc qui le
 * précède dans cette même branche (ordre de lecture), lien marqué `deduit`. Seulement si c'est sans ambiguïté : une seule
 * branche, un seul prédécesseur d'ordre strictement inférieur et déjà relié, aucun autre bloc de la branche au même ordre.
 * Sinon le bloc reste isolé (blocage de `controlerCarte`). Le lien n'a ni étiquette ni part : aucun texte ni chiffre ajouté.
 */
export function reparerOrphelinsDeBranche(carte: CarteImage): { carte: CarteImage; deduits: LienCarte[] } {
  if (carte.types[0] === "benefices" || carte.types[0] === "tableau-de-bord") return { carte, deduits: [] };
  const relies = new Set(carte.liens.flatMap((l) => [l.de, l.vers]));
  const parId = new Map(carte.noeuds.map((n) => [n.id, n]));
  const idsLiens = new Set(carte.liens.map((l) => l.id));
  const isoles = carte.noeuds.filter((n) => !relies.has(n.id) && !n.photoPersonnes).sort((a, b) => a.ordre - b.ordre || (a.id < b.id ? -1 : 1));
  const deduits: LienCarte[] = [];
  for (const o of isoles) {
    const groupes = carte.groupes.filter((g) => g.noeuds.includes(o.id));
    if (groupes.length !== 1 || groupes[0]!.sorte !== "branche" || (o.groupe && o.groupe !== groupes[0]!.id)) continue;
    const autres = groupes[0]!.noeuds.filter((id) => id !== o.id).map((id) => parId.get(id)).filter((n): n is NoeudCarte => !!n && !n.photoPersonnes);
    if (autres.some((n) => n.ordre === o.ordre)) continue;
    const avant = autres.filter((n) => n.ordre < o.ordre);
    if (avant.length === 0) continue;
    const dernierOrdre = Math.max(...avant.map((n) => n.ordre));
    const dernier = avant.filter((n) => n.ordre === dernierOrdre);
    if (dernier.length !== 1 || !relies.has(dernier[0]!.id)) continue;
    const idLien = `d-${dernier[0]!.id}-${o.id}`.slice(0, 40);
    if (idsLiens.has(idLien)) continue;
    const lien: LienCarte = { id: idLien, de: dernier[0]!.id, vers: o.id, couleur: "noir", style: "plein", deduit: true };
    idsLiens.add(idLien);
    relies.add(o.id);
    deduits.push(lien);
  }
  return deduits.length === 0 ? { carte, deduits } : { carte: { ...carte, liens: [...carte.liens, ...deduits] }, deduits };
}

// ─── Carte complétée par le code ─────────────────────────────────────────────────────────────────────────────────────

/** Ce que les lectures (ou Will) fournissent ; le reste est recalculé. */
type Calcule = "types" | "chiffres" | "bandeauChiffres" | "formulesAbsolues" | "coherence" | "offre" | "automatisation";
export type BrouillonCarte = Omit<CarteImage, Calcule> & Partial<Pick<CarteImage, Calcule>>;

/**
 * Recalcule tout ce que le code sait calculer : chiffres (et ceux du bandeau), formules absolues, cohérence, types ; offre et automatisation
 * sont déduites du type si elles manquent (sinon le choix de Will est gardé). Idempotent : completer(completer(x)) = completer(x).
 */
export function completerCarte(brouillon: BrouillonCarte): CarteImage {
  const chiffres = chiffresDeLaCarte(brouillon);
  const types = typesDeLaCarte({ ...brouillon, chiffres });
  return schemaCarteImage.parse({
    ...brouillon,
    types,
    offre: brouillon.offre ?? offreDeduite(types),
    automatisation: brouillon.automatisation ?? estAutomatisation(types),
    chiffres,
    bandeauChiffres: chiffres.filter((c) => c.dansBandeau).map((c) => c.id),
    formulesAbsolues: formulesDeLaCarte(brouillon),
    coherence: coherenceDe(brouillon),
  });
}
