"use client";

/**
 * Feuille « Importer un fichier de publications » (L4-12) : un tableau collé ou un fichier, une ligne par publication.
 * Le bouton « Importer » n'est inactif que sur une erreur de format (ou pendant l'envoi). Un passé, une proximité, un quota
 * atteint ou un week-end s'affichent et se confirment d'un clic : « Importer quand même ». Chaque publication arrive « à valider ».
 */
import { useRef, useState } from "react";
import { analyserImport, importerPublications, type AnalyseImport, type AvertissementImport, type ErreurImport, type ResultatImport } from "@/app/(studio)/calendrier/importer/actions";
import { Bouton } from "@/components/ui/Bouton";

/** Inactif seulement quand l'analyse a trouvé une erreur de format. */
export function importerInactif(analyse: (Pick<AnalyseImport, "erreurs"> & Partial<AnalyseImport>) | null): boolean {
  return !!analyse && analyse.erreurs.length > 0;
}

const MODELE = "jour;heure;réseau;texte\n2026-12-03;09:00;LinkedIn;Mon premier texte\n04/12/2026;12:30;Instagram;Mon deuxième texte";

export function FeuilleImportPlan({ compteCible = "" }: { compteCible?: string }) {
  const cle = useRef(crypto.randomUUID());
  const [texte, setTexte] = useState("");
  const [compte, setCompte] = useState(compteCible);
  const [analyse, setAnalyse] = useState<AnalyseImport | null>(null);
  const [retour, setRetour] = useState<ResultatImport | null>(null);
  const [aConfirmer, setAConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);

  async function verifier(contenu: string) {
    setRetour(null);
    setAConfirmer(false);
    setAnalyse(await analyserImport({ texte: contenu }));
  }

  async function choisirFichier(fichier: File | undefined) {
    if (!fichier) return;
    const contenu = await fichier.text();
    setTexte(contenu);
    await verifier(contenu);
  }

  async function importer() {
    if (enCours) return;
    setEnCours(true);
    try {
      const r = await importerPublications({ texte, compteCible: compte, cle: cle.current, confirmer: aConfirmer });
      setRetour(r);
      if (r.ok) {
        // Un autre fichier, ensuite, repart d'une clé neuve.
        cle.current = crypto.randomUUID();
        setAConfirmer(false);
      } else if (r.aConfirmer) {
        setAConfirmer(true);
      } else if (r.erreurs) {
        setAnalyse({ ok: false, lus: 0, lignes: [], erreurs: r.erreurs, avertissements: [] });
      }
    } finally {
      setEnCours(false);
    }
  }

  const erreurs: ErreurImport[] = analyse?.erreurs ?? (retour && !retour.ok ? retour.erreurs ?? [] : []);
  const avertissements: AvertissementImport[] = retour && !retour.ok && retour.avertissements ? retour.avertissements : analyse?.avertissements ?? [];

  return (
    <form
      className="grid gap-4"
      aria-label="Importer un fichier de publications"
      onSubmit={(e) => {
        e.preventDefault();
        void importer();
      }}
    >
      <label className="grid gap-1 text-sm font-semibold">
        Compte de publication
        <input className="min-h-11 rounded-xl border border-trait-fort bg-surface-1 px-3 font-normal" type="text" value={compte} onChange={(e) => setCompte(e.target.value)} />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Choisir un fichier (tableau)
        <input className="min-h-11 text-sm font-normal" type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={(e) => void choisirFichier(e.target.files?.[0])} />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Ou coller ici : une ligne par publication (jour, heure, réseau, texte)
        <textarea
          className="min-h-48 rounded-xl border border-trait-fort bg-surface-1 p-3 font-mono text-sm font-normal"
          value={texte}
          placeholder={MODELE}
          onChange={(e) => { setTexte(e.target.value); setRetour(null); setAConfirmer(false); }}
          onBlur={() => void verifier(texte)}
        />
      </label>
      <p className="text-sm text-texte-doux">Séparez les colonnes par une tabulation, un point-virgule ou une barre verticale. L&apos;heure est facultative (9 h, heure de Paris). Réseaux : LinkedIn, Instagram, Facebook, TikTok.</p>

      {analyse?.ok && <p role="status" className="text-sm">{analyse.lus} ligne{analyse.lus > 1 ? "s" : ""} lue{analyse.lus > 1 ? "s" : ""}, toutes lisibles.</p>}
      {erreurs.length > 0 && (
        <ul role="alert" className="grid gap-1 rounded-xl bg-brique-doux p-3 text-sm text-brique">
          {erreurs.map((x) => <li key={`${x.numero}-${x.message}`}>{x.message}</li>)}
        </ul>
      )}
      {avertissements.length > 0 && (
        <div role="alert" className="grid gap-1 rounded-xl bg-surface-2 p-3 text-sm">
          <p className="font-semibold">À regarder avant d&apos;importer (rien n&apos;est bloqué) :</p>
          <ul className="grid gap-1">{avertissements.map((x) => <li key={`${x.numero}-${x.type}-${x.message}`}>{x.message}</li>)}</ul>
        </div>
      )}
      {retour?.ok === false && !retour.aConfirmer && !retour.erreurs && <p role="alert" className="text-sm text-brique">{retour.message}</p>}
      {retour?.ok === true && <p role="status" className="text-sm font-semibold">{retour.lus} ligne{retour.lus > 1 ? "s" : ""} lue{retour.lus > 1 ? "s" : ""} = {retour.crees} publication{retour.crees > 1 ? "s" : ""} créée{retour.crees > 1 ? "s" : ""}, « Proposée{retour.crees > 1 ? "s" : ""} » : à valider avant tout envoi.</p>}

      <div className="flex flex-wrap gap-3">
        <Bouton type="button" variante="secondaire" disabled={enCours} onClick={() => void verifier(texte)}>Vérifier</Bouton>
        <Bouton type="submit" disabled={enCours || importerInactif(analyse)}>{aConfirmer ? "Importer quand même" : "Importer"}</Bouton>
      </div>
    </form>
  );
}
