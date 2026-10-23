/**
 * LOT C1 — la page d'un format montre UNE galerie (toutes les vidéos non archivées, filtre d'état, sélection multiple)
 * et un lien vers les archivées de ce format ; plus de sections « En cours / Brouillons / Vidéos prêtes ».
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..");
const page = readFileSync(join(RACINE, "src/app/(studio)/formats/[id]/page.tsx"), "utf8");
const pageVideos = readFileSync(join(RACINE, "src/app/(studio)/videos/page.tsx"), "utf8");
const onglets = readFileSync(join(RACINE, "src/components/videos/OngletsMesVideos.tsx"), "utf8");

describe("page d'un format", () => {
  it("une seule GalerieVideos, plus de sections séparées", () => {
    expect(page.match(/<GalerieVideos/g)).toHaveLength(1);
    for (const t of ['titre="En cours"', 'titre="Brouillons"', 'titre="Vidéos prêtes"']) expect(page).not.toContain(t);
  });
  it("lien vers les archivées du format", () => {
    expect(page).toContain("/videos?vue=archivees&format=");
    expect(page).toContain("Archivées de ce format");
  });
  it("le titre reste celui d'avant", () => {
    expect(page).toContain("<EnTetePage titre={titrePageFormat(f.nom, bientot)} />");
  });
});

describe("Mes vidéos : « Autres » et filtre par format des archivées", () => {
  it("onglet Autres", () => {
    expect(onglets).toContain("/videos?vue=autres");
    expect(pageVideos).toContain('"autres"');
  });
  it("paramètre format pour les archivées", () => {
    expect(pageVideos).toMatch(/sp\.format/);
  });
});

describe("Mes vidéos : compteur de l'onglet Archivées filtré par format", () => {
  it("l'onglet affiche le nombre de la liste filtrée, pas le total", () => {
    expect(pageVideos).toMatch(/nbArchivees=\{vue === "archivees" \? archivees\.length : compteurs\.archivees\}/);
  });
});
