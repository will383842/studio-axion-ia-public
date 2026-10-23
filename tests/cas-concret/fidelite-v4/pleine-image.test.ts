/**
 * V4-2 · mission D : le format rend ses écrans à l'échelle et avec la géométrie de la v4 (décision de Will du 14/10,
 * « option 1 comme la v4 ») : TOUT l'écran, pas la zone sûre commune des réseaux. Valeurs visées, lues dans
 * `docs/formats/v4-reference/INVENTAIRE.md` : étiquette d'étape à 250 px, titre d'étape 190 px, téléphone 920 px
 * (≈ 49 % de la hauteur), objets au-dessus des sous-titres (≈ 83 %), fil à 1 764 px (≈ 92 %), centre horizontal exact
 * (texte sur 40–1 040 px). Rouge avant `proprietesPleineImage` et la zone pleine image du format.
 * La brique commune ne change pas pour un écran qui ne demande pas le fil bas (`basFil` absent).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { boites, charteDuoPour, disposer, proprietesEcrans, zonesEcran, type EcranCale, type ProprietesEcran, type TypeEcran } from "@/briques/ecrans-motion";
import { BANDE_SOUS_TITRES_CAS_CONCRET, BAS_FIL_CAS_CONCRET, ZONE_PLEINE_IMAGE_CAS_CONCRET } from "@/formats/cas-concret";
import { centreSousTitresPleineImagePct, proprietesPleineImage } from "@/moteurs/montage-cas-concret/zone-objets";
import { zoneProtegeeCombinee } from "@/reseaux";
import { proprietesV4 } from "../../../outils/v4-fidelite/fiche-v4";
import { boiteVisuel } from "../../../studio-rendu/compositions/cas-concret/plans/Objet";

const RACINE = join(__dirname, "../../..");
const H = 1920;
const v4 = proprietesV4(RACINE, ZONE_PLEINE_IMAGE_CAS_CONCRET, (f) => f, { avantCorrection: false, pleineImage: true });
const etapes = v4.filter((p): p is Extract<ProprietesEcran, { type: "etape" }> => p.type === "etape");
const zones = zonesEcran(ZONE_PLEINE_IMAGE_CAS_CONCRET, 1080, H, BANDE_SOUS_TITRES_CAS_CONCRET);

describe("V4-2 · zone pleine image du format", () => {
  it("centre horizontal exact et texte sur 40–1 040 px, comme la v4 (plus de décalage de 65 px vers la gauche)", () => {
    expect(ZONE_PLEINE_IMAGE_CAS_CONCRET.gauche).toBeCloseTo(ZONE_PLEINE_IMAGE_CAS_CONCRET.droite, 9);
    expect(zones.utile.x).toBeCloseTo(40, 0);
    expect(zones.utile.x + zones.utile.largeur).toBeCloseTo(1040, 0);
    for (const p of v4) expect(p.zone.x + p.zone.largeur / 2, p.id).toBeCloseTo(540, 6);
  });

  it("les sous-titres sont à ≈ 85 % de la hauteur (v4 : 83 à 86 %), sous tous les objets", () => {
    const centre = centreSousTitresPleineImagePct();
    expect(centre).toBeGreaterThanOrEqual(83);
    expect(centre).toBeLessThanOrEqual(87);
    // Une ligne de 60 px (style du format) ne remonte pas au-dessus de la bande : jamais sur un objet.
    expect((centre / 100) * H - 36).toBeGreaterThanOrEqual(zones.sousTitres.y - 0.5);
  });
});

describe("V4-2 · échelle 1,0 sur la fiche de la v4", () => {
  it("aucun écran réduit : rapport 1 partout (le format était à 0,61)", () => {
    for (const p of v4) expect(disposer(p).boites.reduction.textes, `${p.id} (${p.type})`).toBeGreaterThanOrEqual(0.99);
  });

  it("gabarit d'étape : téléphone à 640 px et ≈ 49 % de la hauteur, titre ≈ 190 px, étiquette près de 250 px", () => {
    expect(etapes.length).toBe(6);
    for (const p of etapes) {
      const m = disposer(p);
      const etiquette = m.textes.find((t) => t.nom === "etiquette")!;
      const titre = m.textes.find((t) => t.nom === "titre")!;
      const visuel = m.boites.objets.find((o) => o.nom === "visuel")!;
      // Téléphone à 640–1 560 px comme la v4 ; l'étiquette, au-dessus, garde les écarts du gabarit (≈ 220 px, v4 250).
      expect(Math.abs(visuel.boite.y - 640), p.id).toBeLessThanOrEqual(15);
      expect(Math.abs(etiquette.boite.y - 250), p.id).toBeLessThanOrEqual(35);
      // « Le rendez-vous » est réduit à la largeur dans la v4 aussi (166 px).
      if (p.numero !== 4) expect(titre.tailleRendue, p.id).toBeGreaterThanOrEqual(185);
      expect(visuel.boite.hauteur / H, p.id).toBeGreaterThanOrEqual(0.47);
    }
  });

  it("fil des étapes à ≈ 92 % (1 764 px), sous les sous-titres, comme la v4", () => {
    expect(BAS_FIL_CAS_CONCRET * H).toBeCloseTo(1770, 0);
    for (const p of etapes) {
      const fil = disposer(p).boites.fil!;
      expect(Math.abs(fil.y - 1764), p.id).toBeLessThanOrEqual(2);
      expect(fil.y, p.id).toBeGreaterThanOrEqual(zones.sousTitres.y + zones.sousTitres.hauteur);
    }
  });

  it("objets au-dessus des sous-titres, jamais dessous (ordre de la v4 aussi)", () => {
    for (const p of v4) for (const o of disposer(p).boites.objets) expect(o.boite.y + o.boite.hauteur, `${p.id} · ${o.nom}`).toBeLessThanOrEqual(zones.sousTitres.y + 0.5);
  });

  it("proprietesPleineImage = la zone pleine image, le dessin borné au-dessus des sous-titres, le fil bas", () => {
    const ecran = { id: "e01", fond: "ivoire", debutMs: 0, finMs: 2000, evenements: [], type: "etape", numero: 1, nombreEtapes: 6, titre: "L'*annonce*", ligne: "Elle la voit.", visuel: { objet: "telephone-capture" }, puces: [] } as EcranCale;
    const [p] = proprietesPleineImage({ ecrans: [ecran], captures: {} });
    expect(p.zone).toEqual(zones.utile);
    expect(p.dessin!.y + p.dessin!.hauteur).toBeCloseTo(zones.utile.y + zones.utile.hauteur, 6);
    expect(p.basFil).toBeCloseTo(BAS_FIL_CAS_CONCRET * H, 6);
  });
});

describe("V4-2 · chaque objet à sa taille et à sa place de la v4", () => {
  /** Boîte du visuel rendue (avant le biais) de l'écran qui montre `objet`. */
  const boiteDe = (objet: string) => {
    // Le téléphone de l'annonce (étape 1) montre un vrai écran : son visuel est une capture.
    const p = v4.find((e) => (objet === "telephone-capture" ? e.type === "etape" && e.numero === 1 : (e.type === "etape" || e.type === "objet") && "objet" in e.visuel && e.visuel.objet === objet)) as Extract<ProprietesEcran, { type: "etape" | "objet" }>;
    const geometrie = disposer(p).boites.objets.find((o) => o.nom === "visuel")!.boite;
    return boiteVisuel(p.visuel, geometrie, p.zone, p.dessin, p.type);
  };
  // v4 (INVENTAIRE.md, DOM de `v4.html`) : haut et taille de chaque objet.
  it.each([
    ["pile-notifications", 694, 900],
    ["chrono", 690, 740],
    ["contrat-signature", 656, 620],
    // Le dossier dessiné commence 260 px sous le haut de sa boîte (la feuille descend dedans) : 759 − 260.
    ["dossier-classe", 499, 600],
  ] as const)("%s : haut de la boîte ≈ %i px, largeur ≈ %i px", (objet, haut, largeur) => {
    const b = boiteDe(objet);
    expect(Math.abs(b.y - haut)).toBeLessThanOrEqual(20);
    expect(Math.abs(b.largeur - largeur)).toBeLessThanOrEqual(40);
  });

  it("le téléphone garde la boîte du gabarit (470 × 920 à 640 px)", () => {
    const b = boiteDe("telephone-capture");
    expect(Math.abs(b.y - 640)).toBeLessThanOrEqual(15);
    expect(Math.abs(b.hauteur - 920)).toBeLessThanOrEqual(10);
  });

  it("sans type d'écran, la boîte reste celle d'avant (toute la largeur, centrée)", () => {
    const p = v4.find((e) => e.type === "etape" && "objet" in e.visuel && e.visuel.objet === "chrono") as Extract<ProprietesEcran, { type: "etape" }>;
    const geometrie = disposer(p).boites.objets.find((o) => o.nom === "visuel")!.boite;
    const b = boiteVisuel(p.visuel, geometrie, p.zone, p.dessin);
    expect(b.largeur).toBeCloseTo(geometrie.hauteur, 6);
  });
});

describe("V4-2 · la brique commune ne change pas sans fil bas", () => {
  const QUATRE = zoneProtegeeCombinee("9:16", ["facebook", "instagram", "tiktok", "linkedin"])!;
  const z = zonesEcran(QUATRE, 1080, H, 0.08);
  const TYPES: TypeEcran[] = ["accroche", "chiffre", "liste-avant", "titre", "etape", "objet", "preuve", "resultat", "question", "appel-mot", "promesse", "lien"];

  it.each(TYPES)("%s : boîtes identiques avec ou sans le champ `basFil` absent", (type) => {
    const sans = boites(type, z.utile, charteDuoPour(H), {}, { dessin: z.dessin });
    expect(boites(type, z.utile, charteDuoPour(H), {}, { dessin: z.dessin, basFil: undefined })).toEqual(sans);
  });

  it("étape sans `basFil` : le fil reste au bas de la zone de dessin, les objets au-dessus de lui (règle d'origine)", () => {
    const b = boites("etape", z.utile, charteDuoPour(H), { puces: 1 }, { dessin: z.dessin });
    expect(b.fil!.y + b.fil!.hauteur).toBeCloseTo(z.dessin.y + z.dessin.hauteur, 2);
    for (const o of b.objets) expect(o.boite.y + o.boite.hauteur).toBeLessThanOrEqual(b.fil!.y);
  });

  it("un `basFil` plus haut que la zone de dessin n'y change rien (le fil ne remonte jamais)", () => {
    const sans = boites("etape", z.utile, charteDuoPour(H), {}, { dessin: z.dessin });
    expect(boites("etape", z.utile, charteDuoPour(H), {}, { dessin: z.dessin, basFil: 10 })).toEqual(sans);
  });

  it("proprietesEcrans ne pose jamais `basFil` de lui-même", () => {
    const ecran = { id: "e01", fond: "ivoire", debutMs: 0, finMs: 2000, evenements: [], type: "titre", lignes: ["Un", "deux"] } as EcranCale;
    expect("basFil" in proprietesEcrans({ ecrans: [ecran], captures: {}, zoneProtegee: QUATRE })[0]).toBe(false);
  });

  it("seul le cas concret utilise la brique `ecrans-motion` (aucun autre format ne peut changer)", () => {
    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const f of readdirSync(d)) {
        const c = join(d, f);
        if (f === "node_modules" || f.startsWith(".")) continue;
        if (statSync(c).isDirectory()) parcourir(c);
        else if (/\.tsx?$/.test(f)) fichiers.push(c);
      }
    };
    parcourir(join(RACINE, "src"));
    parcourir(join(RACINE, "studio-rendu/compositions"));
    const utilisateurs = fichiers
      .filter((f) => !f.includes(join("briques", "ecrans-motion")) && !/\.test\.tsx?$/.test(f))
      .filter((f) => /ecrans-motion["']/.test(readFileSync(f, "utf8")))
      .map((f) => relative(RACINE, f));
    // « Image → vidéo » réutilise les écrans v4 tels quels (50-PLAN-ARCHITECTE, « Écrans v4 émotion ») : seul autre lecteur admis,
    // le plan des objets de `schema-motion` (découpe des mots balisés, lecture seule) — ce fichier-là, pas le dossier.
    expect(utilisateurs.filter((f) => !/cas-concret|image-video/.test(f) && f !== join("src", "briques", "schema-motion", "plan-objets.ts"))).toEqual([]);
  });
});
