"use client";

import { useState, useTransition } from "react";
import { creerElementAction } from "@/app/(studio)/bibliotheque/actions";
import { Bouton, Champ, FeuilleBas, Icone, Interrupteur, notifier, SelecteurPastilles, ZoneDepot } from "@/components/ui";
import type { TypeElement, ValeurElement } from "@/domaine/types";
import { envoyerFichiers } from "@/lib/envoi-multipart";
import { dureeMedia, nomDepuisFichier, tailleLisible } from "../personnages/outils";
import { FICHIER_PAR_TYPE, lireJeton, valeurParDefaut } from "./outils";

type V<T extends ValeurElement["type"]> = Extract<ValeurElement, { type: T }>;

const MONTAGES: Record<V<"style-montage">["rythme"], V<"style-montage">> = {
  calme: { type: "style-montage", rythme: "calme", dureePlanMoyenneSec: 5, zooms: "aucun", transitions: "fondu", bruitagesTransitions: false },
  rythme: { type: "style-montage", rythme: "rythme", dureePlanMoyenneSec: 3, zooms: "doux", transitions: "coupe", bruitagesTransitions: true },
  "tres-rythme": { type: "style-montage", rythme: "tres-rythme", dureePlanMoyenneSec: 1.8, zooms: "frequents", transitions: "coupe", bruitagesTransitions: true },
};

const PROFILS: Record<string, V<"profil-son">> = {
  "Voix claire": { type: "profil-son", volumeMusique: 18, baisseSousVoixDb: 12, traitementVoix: "naturel", densiteBruitages: "leger", niveauCibleLufs: -14 },
  "Rythmé avec bruitages": { type: "profil-son", volumeMusique: 30, baisseSousVoixDb: 9, traitementVoix: "radio", densiteBruitages: "rythme", niveauCibleLufs: -13 },
  Podcast: { type: "profil-son", volumeMusique: 8, baisseSousVoixDb: 18, traitementVoix: "chaud", densiteBruitages: "aucun", niveauCibleLufs: -16 },
};

/** Feuille d'ajout générique d'un élément de la Bibliothèque (un petit bloc propre à chaque type). */
export function FeuilleAjoutElement({ type, nomType, ouverte, onOuverteChange }: { type: TypeElement; nomType: string; ouverte: boolean; onOuverteChange: (v: boolean) => void }) {
  return (
    <FeuilleBas ouverte={ouverte} onOuverteChange={onOuverteChange} titre={`Ajouter : ${nomType.toLowerCase()}`}>
      {ouverte && <Formulaire type={type} onFini={() => onOuverteChange(false)} />}
    </FeuilleBas>
  );
}

function Formulaire({ type, onFini }: { type: TypeElement; onFini: () => void }) {
  const fichierAttendu = FICHIER_PAR_TYPE[type];
  const [nom, setNom] = useState("");
  const [motsCles, setMotsCles] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);
  const [duree, setDuree] = useState(0);
  const [valeur, setValeur] = useState<ValeurElement>(() => valeurParDefaut(type, { couleurs: [{ nom: "Orange", valeur: lireJeton("orange") }], teinte: lireJeton("fond") }));
  const [enCours, demarrer] = useTransition();

  async function choisir(f: File) {
    setFichier(f);
    if (!nom) setNom(nomDepuisFichier(f.name));
    setDuree(await dureeMedia(f));
  }

  function ajouter() {
    if (!nom.trim()) return void notifier.erreur("Donnez-lui un nom.");
    const v: ValeurElement = valeur.type === "musique" || valeur.type === "bruitage" ? { ...valeur, dureeSec: Math.max(1, Math.round(duree || valeur.dureeSec)) } : valeur;
    demarrer(async () => {
      const e = fichier ? await envoyerFichiers([fichier], { typeEntite: "element", entiteId: type }) : null;
      if (e && !e.ok) return void notifier.erreur(e.message);
      const r = await creerElementAction({ type, nom, motsCles: motsCles.split(",").map((m) => m.trim()), valeur: v, fichier: e ? { fichierId: e.fichierIds[0] } : null });
      if (!r.ok) return void notifier.erreur(r.message);
      if (e?.simulation) notifier.essai(`« ${nom.trim()} » ajouté, rien n'a été envoyé`);
      else notifier.succes(`« ${nom.trim()} » ajouté`);
      onFini();
    });
  }

  return (
    <div className="grid gap-5 pb-2">
      {fichierAttendu &&
        (fichier ? (
          <div className="flex min-h-14 items-center gap-3 rounded-carte border border-trait bg-surface-2 px-4">
            <Icone nom="document" size={18} className="text-orange-vif" />
            <span className="min-w-0 flex-1 truncate text-sm text-texte">{fichier.name}</span>
            <span className="text-xs text-texte-faible">{tailleLisible(fichier.size)}</span>
            <button type="button" aria-label="Retirer le fichier" onClick={() => setFichier(null)} className="-mr-2 grid size-11 place-items-center rounded-full text-texte-faible hover:text-texte">
              <Icone nom="fermer" size={16} />
            </button>
          </div>
        ) : (
          <ZoneDepot compacte multiple={false} libelle={fichierAttendu.libelle} accepte={fichierAttendu.accepte} onFichiers={(f) => f[0] && void choisir(f[0])} />
        ))}

      <Champ libelle="Nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={80} />

      {valeur.type === "police" && (
        <>
          <Champ libelle="Famille" value={valeur.famille} onChange={(e) => setValeur({ ...valeur, famille: e.target.value })} maxLength={60} />
          <SelecteurPastilles libelle="Usage" options={[{ valeur: "titre", libelle: "Titres" }, { valeur: "texte", libelle: "Texte" }]} valeur={valeur.usage} onChange={(u) => setValeur({ ...valeur, usage: u })} />
        </>
      )}
      {valeur.type === "logo" && (
        <SelecteurPastilles
          libelle="Version"
          options={[
            { valeur: "clair", libelle: "Claire" },
            { valeur: "sombre", libelle: "Sombre" },
            { valeur: "monochrome", libelle: "Une couleur" },
          ]}
          valeur={valeur.variante}
          onChange={(x) => setValeur({ ...valeur, variante: x })}
        />
      )}
      {valeur.type === "musique" && (
        <SelecteurPastilles
          libelle="Ambiance"
          options={["calme", "tension-douce", "energique", "rythme"].map((a) => ({ valeur: a, libelle: a.replace("-", " ") }))}
          valeur={valeur.ambiance}
          onChange={(a) => setValeur({ ...valeur, ambiance: a })}
        />
      )}
      {valeur.type === "bruitage" && (
        <SelecteurPastilles
          libelle="Catégorie"
          options={[
            { valeur: "transition", libelle: "Transition" },
            { valeur: "impact", libelle: "Impact" },
            { valeur: "notification", libelle: "Notification" },
            { valeur: "ambiance", libelle: "Ambiance" },
          ]}
          valeur={valeur.categorie}
          onChange={(c) => setValeur({ ...valeur, categorie: c })}
        />
      )}
      {valeur.type === "habillage" && (
        <div className="grid gap-1">
          <Interrupteur icone="lecture" libelle="Début" coche={valeur.intro} onChange={(x) => setValeur({ ...valeur, intro: x })} />
          <Interrupteur icone="clap" libelle="Fin" coche={valeur.fin} onChange={(x) => setValeur({ ...valeur, fin: x })} />
          <Interrupteur icone="etincelles" libelle="Logo animé" coche={valeur.logoAnime} onChange={(x) => setValeur({ ...valeur, logoAnime: x })} />
          <Interrupteur icone="texte" libelle="Grand titre" coche={valeur.grandTitre} onChange={(x) => setValeur({ ...valeur, grandTitre: x })} />
          <Interrupteur
            icone="megaphone"
            libelle="Carte finale"
            coche={!!valeur.carteFinale}
            onChange={(x) => setValeur({ ...valeur, carteFinale: x ? { titre: "Axion-IA", appel: "Abonnez-vous" } : undefined })}
          />
          {valeur.carteFinale && <Champ libelle="Appel à l'action" value={valeur.carteFinale.appel} onChange={(e) => setValeur({ ...valeur, carteFinale: { ...valeur.carteFinale!, appel: e.target.value } })} maxLength={40} />}
        </div>
      )}
      {valeur.type === "style-montage" && (
        <SelecteurPastilles
          libelle="Rythme"
          options={[
            { valeur: "calme", libelle: "Calme", detail: "5 s par plan" },
            { valeur: "rythme", libelle: "Rythmé", detail: "3 s" },
            { valeur: "tres-rythme", libelle: "Très rythmé", detail: "1,8 s" },
          ]}
          valeur={valeur.rythme}
          onChange={(r) => setValeur(MONTAGES[r])}
        />
      )}
      {valeur.type === "profil-son" && (
        <SelecteurPastilles
          libelle="Départ"
          options={Object.keys(PROFILS).map((p) => ({ valeur: p, libelle: p }))}
          valeur={Object.entries(PROFILS).find(([, p]) => p.niveauCibleLufs === valeur.niveauCibleLufs && p.volumeMusique === valeur.volumeMusique)?.[0]}
          onChange={(p) => setValeur(PROFILS[p])}
        />
      )}
      {valeur.type === "couleurs" && (
        <div>
          <p className="mb-2 text-sm font-semibold text-texte-doux">Couleurs</p>
          <div className="flex flex-wrap gap-2">
            {valeur.couleurs.map((c, i) => (
              <label key={i} className="relative grid size-14 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-trait">
                <input
                  type="color"
                  value={c.valeur || lireJeton("fond")}
                  onChange={(e) => setValeur({ ...valeur, couleurs: valeur.couleurs.map((x, j) => (j === i ? { ...x, valeur: e.target.value } : x)) })}
                  className="absolute inset-0 size-full cursor-pointer border-0 p-0"
                  aria-label={`Couleur ${i + 1}`}
                />
              </label>
            ))}
            {valeur.couleurs.length < 6 && (
              <button
                type="button"
                onClick={() => setValeur({ ...valeur, couleurs: [...valeur.couleurs, { nom: `Couleur ${valeur.couleurs.length + 1}`, valeur: lireJeton("texte") }] })}
                className="grid size-14 place-items-center rounded-2xl border-2 border-dashed border-trait-fort text-texte-faible hover:text-texte"
                aria-label="Ajouter une couleur"
              >
                <Icone nom="plus" size={20} />
              </button>
            )}
          </div>
        </div>
      )}
      {valeur.type === "fond" && (
        <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-carte border border-trait bg-surface-2 px-4">
          <input type="color" value={valeur.teinte || lireJeton("fond")} onChange={(e) => setValeur({ ...valeur, teinte: e.target.value })} className="size-9 cursor-pointer rounded-lg border-0 p-0" aria-label="Teinte du fond" />
          <span className="text-sm font-semibold text-texte">Teinte</span>
        </label>
      )}
      {valeur.type === "decor" && (
        <>
          <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-carte border border-trait bg-surface-2 px-4">
            <input type="color" value={valeur.teinte || lireJeton("fond")} onChange={(e) => setValeur({ ...valeur, teinte: e.target.value })} className="size-9 cursor-pointer rounded-lg border-0 p-0" aria-label="Teinte du décor" />
            <span className="text-sm font-semibold text-texte">Teinte (sans image)</span>
          </label>
          <Champ libelle="Ambiance" value={valeur.ambiance ?? ""} onChange={(e) => setValeur({ ...valeur, ambiance: e.target.value })} maxLength={40} />
        </>
      )}

      <Champ libelle="Mots-clés (facultatif)" value={motsCles} onChange={(e) => setMotsCles(e.target.value)} placeholder="séparés par des virgules" />

      <Bouton taille="lg" pleineLargeur icone="coche" essai={!!fichier} chargement={enCours} disabled={!nom.trim()} onClick={ajouter}>
        Ajouter
      </Bouton>
    </div>
  );
}
