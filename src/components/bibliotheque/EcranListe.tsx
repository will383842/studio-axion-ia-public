"use client";

import { useState, useTransition } from "react";
import { ajouterRushsAction } from "@/app/(studio)/bibliotheque/actions";
import { BarreActionCollee, Bouton, Champ, EtatVide, FeuilleBas, Icone, ListeElements, notifier, ZoneDepot, type ElementAffichable, type NomIcone } from "@/components/ui";
import type { TypeElement } from "@/domaine/types";
import type { VueRush } from "@/services/B-personnages-bibliotheque";
import type { VueElement } from "@/services/vues";
import { envoyerFichiers } from "@/lib/envoi-multipart";
import { dureeMedia, tailleLisible } from "../personnages/outils";
import { FeuilleAjoutElement } from "./FeuilleAjoutElement";
import { FeuilleDetailElement } from "./FeuilleDetailElement";
import type { FormatCourt } from "./outils";

/** Écran GÉNÉRIQUE d'un type (AV2.5 niveau 2) : ListeElements + feuille de détail + feuille d'ajout. */
export function EcranListe({ type, nomType, icone, elements, formats, ajouterAuDepart }: { type: TypeElement; nomType: string; icone: NomIcone; elements: VueElement[]; formats: FormatCourt[]; ajouterAuDepart?: boolean }) {
  const [ouvertId, setOuvertId] = useState<string | null>(null);
  const [ajout, setAjout] = useState(!!ajouterAuDepart);
  const ouvert = elements.find((e) => e.id === ouvertId) ?? null;
  return (
    <div>
      <ListeElements
        elements={elements}
        onOuvrir={setOuvertId}
        vide={<EtatVide icone={icone} titre="Rien ici pour l'instant" phrase="Ajoutez votre premier élément." />}
        colonnes={type === "musique" || type === "bruitage" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : undefined}
      />
      <BarreActionCollee>
        <Bouton taille="lg" icone="plus" onClick={() => setAjout(true)}>
          Ajouter
        </Bouton>
      </BarreActionCollee>
      <FeuilleDetailElement element={ouvert} formats={formats} onFermer={() => setOuvertId(null)} />
      <FeuilleAjoutElement type={type} nomType={nomType} ouverte={ajout} onOuverteChange={setAjout} />
    </div>
  );
}

/** RUSHS (AV2.3-8) : mes images réellement tournées, rangées comme la Bibliothèque. */
export function EcranRushs({ rushs, ajouterAuDepart }: { rushs: VueRush[]; ajouterAuDepart?: boolean }) {
  const [ouvertId, setOuvertId] = useState<string | null>(null);
  const [ajout, setAjout] = useState(!!ajouterAuDepart);
  const ouvert = rushs.find((r) => r.id === ouvertId) ?? null;
  return (
    <div>
      <ListeElements<ElementAffichable & VueRush>
        elements={rushs}
        onOuvrir={setOuvertId}
        vide={<EtatVide icone="camera" titre="Aucun rush" phrase="Déposez des images que vous avez filmées vous-même." />}
      />
      <BarreActionCollee>
        <Bouton taille="lg" icone="plus" onClick={() => setAjout(true)}>
          Ajouter des rushs
        </Bouton>
      </BarreActionCollee>
      <FeuilleDetailElement element={ouvert ? { ...ouvert, type: "rushs" } : null} formats={[]} onFermer={() => setOuvertId(null)} lectureSeule />
      <FeuilleAjoutRushs ouverte={ajout} onOuverteChange={setAjout} />
    </div>
  );
}

function FeuilleAjoutRushs({ ouverte, onOuverteChange }: { ouverte: boolean; onOuverteChange: (v: boolean) => void }) {
  const [fichiers, setFichiers] = useState<{ f: File; sec: number }[]>([]);
  const [mots, setMots] = useState("");
  const [enCours, demarrer] = useTransition();

  async function ajouter(liste: File[]) {
    const x = await Promise.all(liste.map(async (f) => ({ f, sec: (await dureeMedia(f)) || 10 })));
    setFichiers((l) => [...l, ...x].slice(0, 30));
  }

  function envoyer() {
    demarrer(async () => {
      const e = await envoyerFichiers(fichiers.map((x) => x.f), { typeEntite: "element", entiteId: "rush" });
      if (!e.ok) return void notifier.erreur(e.message);
      const r = await ajouterRushsAction(
        fichiers.map((x, i) => ({ fichier: { fichierId: e.fichierIds[i] }, dureeSec: x.sec })),
        mots.split(",").map((m) => m.trim()),
      );
      if (!r.ok) return void notifier.erreur(r.message);
      const n = r.donnees.ids.length;
      if (e.simulation) notifier.essai(`${n} rush${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""}, rien n'a été envoyé`);
      else notifier.succes(`${n} rush${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""}`);
      setFichiers([]);
      setMots("");
      onOuverteChange(false);
    });
  }

  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={onOuverteChange}
      titre="Ajouter des rushs"
      pied={
        <Bouton taille="lg" pleineLargeur icone="coche" essai chargement={enCours} disabled={!fichiers.length} onClick={envoyer}>
          {fichiers.length ? `Ajouter ${fichiers.length}` : "Ajouter"}
        </Bouton>
      }
    >
      <div className="grid gap-3">
        <ZoneDepot libelle="Choisir des vidéos" detail="Filmées par vous" accepte="video/*" icone="camera" onFichiers={(f) => void ajouter(f)} />
        {fichiers.map((x, i) => (
          <div key={`${x.f.name}-${i}`} className="flex min-h-12 items-center gap-3 rounded-champ bg-surface-2 px-3">
            <Icone nom="film" size={18} className="text-orange-vif" />
            <span className="min-w-0 flex-1 truncate text-sm text-texte">{x.f.name}</span>
            <span className="text-xs tabular-nums text-texte-faible">
              {Math.round(x.sec)} s · {tailleLisible(x.f.size)}
            </span>
          </div>
        ))}
        <Champ libelle="Mots-clés (facultatif)" value={mots} onChange={(e) => setMots(e.target.value)} placeholder="bureau, marche…" />
      </div>
    </FeuilleBas>
  );
}
