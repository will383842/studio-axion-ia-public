/**
 * U2b : la fiche vidéo montre « Vos fichiers » pour le Cas concret MD et coupe la publication pour lui seul.
 * Lecture du fichier de la page (instantané mot pour mot des lignes du tableau et de face caméra) et des fiches de format.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listerFormats } from "../../../src/formats";

const FORMATS = listerFormats({ inclureMasques: true });

const page = readFileSync(join(__dirname, "../../../src/app/(studio)/videos/[id]/page.tsx"), "utf8");
const lignes = page.split("\n").map((l) => l.trim());

describe("champ ecranVideo.publication", () => {
  // Publication Buffer coupée pour ces formats tant que ses défauts connus (fichier choisi par ratio,
  // premier commentaire non envoyé) ne sont pas corrigés. Accord de la session cas concret le 15/10.
  const SANS_PUBLICATION = ["cas-concret", "image-video"];

  it("seuls les formats autorisés posent « aucune » ; tous les autres restent sans le champ", () => {
    for (const f of FORMATS) {
      if (SANS_PUBLICATION.includes(f.id)) expect(f.ecranVideo?.publication, f.id).toBe("aucune");
      else expect(f.ecranVideo?.publication, f.id).toBeUndefined();
    }
    for (const id of SANS_PUBLICATION) expect(FORMATS.some((f) => f.id === id), id).toBe(true);
    expect(FORMATS.filter((f) => f.ecranVideo?.publication !== undefined)).toHaveLength(SANS_PUBLICATION.length);
  });
});

describe("page de la vidéo", () => {
  it("les 6 lignes du tableau et de face caméra sont toujours là, mot pour mot", () => {
    const attendues = [
      'const facecam = v.formatId === "facecam" ? await vueVotreVideo(v.id) : null;',
      "const tableau = ecranTableauVisible(format);",
      "const vueTab = tableau ? await vueTableau(v.id) : null;",
      "const histoTab = tableau ? await historiqueTableau(v.id) : null;",
      '{facecam && prete && <VotreVideoFacecam videoId={v.id} vue={facecam} possible={prete && !enFabrication} avecOngletSousTitres={aOnglet(onglets, "sous-titres")} />}',
      "{tableau && vueTab && <VotreFicheTableau videoId={v.id} vue={vueTab} possible={prete && !enFabrication} />}",
    ];
    for (const l of attendues) expect(lignes, l).toContain(l);
  });

  it("3 imports, une ligne de lecture, une ligne de rendu pour le format", () => {
    for (const l of [
      'import { ficheCasConcretVisible } from "@/components/formats/cas-concret/aiguillage";',
      'import { VosFichiers } from "@/components/formats/cas-concret/fiche-video/VosFichiers";',
      'import { vueCasConcret } from "@/services/cas-concret-vue";',
      "const vueCas = ficheCasConcretVisible(format) ? await vueCasConcret(v.id) : null;",
      "{vueCas && prete && <VosFichiers vue={vueCas} lienPrive={{ videoId: v.id, titre: v.titre, partages }} />}",
    ])
      expect(lignes, l).toContain(l);
  });

  it("P9 : document promis et relevés montés sous « Vos fichiers », sans le détail X9 (D4 : master ne le monte pas)", () => {
    for (const l of [
      'import { BlocDocument } from "@/components/formats/cas-concret/document/BlocDocument";',
      'import { BlocReleves } from "@/components/formats/cas-concret/releves/BlocReleves";',
      "{vueCas.documentAPreparer && <BlocDocument videoId={v.id} />}",
      "<BlocReleves videoId={v.id} />",
    ])
      expect(lignes, l).toContain(l);
    const i = (m: string) => lignes.findIndex((l) => l.startsWith(m));
    expect(i("{vueCas.documentAPreparer && <BlocDocument videoId={v.id} />}")).toBeGreaterThan(i("{vueCas && prete && <VosFichiers vue={vueCas}"));
    expect(i("<BlocReleves videoId={v.id} />")).toBeGreaterThan(i("{vueCas.documentAPreparer && <BlocDocument videoId={v.id} />}"));
    // Le bloc du document ne s'affiche que si la vidéo le promet (une fin au mot) : pas de « Brouillon » sans objet.
    expect(lignes).toContain("{vueCas.documentAPreparer && <BlocDocument videoId={v.id} />}");
    // Les lignes de master restent mot pour mot (lien privé L10) ; rien du détail technique X9.
    expect(page).toContain("{vueCas && prete && <VosFichiers vue={vueCas} lienPrive={{ videoId: v.id, titre: v.titre, partages }} />}");
    expect(page).not.toMatch(/EcritureCasConcret|ecritureCasConcret/);
    // Chaque bloc se garde lui-même (réglage éteint : il ne rend rien) : la page ne lit aucun réglage.
    expect(page).not.toContain("casConcret.documentPromis");
    expect(page).not.toContain("casConcret.releves");
  });

  it("l'onglet de publication et la barre d'actions ne se coupent que pour « aucune »", () => {
    expect(lignes).toContain('const sansPublication = format?.ecranVideo?.publication === "aucune";');
    expect(lignes).toContain("...(prete && kit && !sansPublication");
    expect(lignes).toContain('action={prete && kit && !sansPublication && (facecam ? <BarreActionsVideo libellePublier="Valider et publier" avecOngletPublier={aOnglet(onglets, "publier")} /> : <BarreActionsVideo avecOngletPublier={aOnglet(onglets, "publier")} />)}');
    // Aucune autre condition ne mentionne ce format dans la page.
    expect(page).not.toMatch(/formatId === "cas-concret"/);
  });
});
