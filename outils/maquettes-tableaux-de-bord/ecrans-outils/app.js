/*
 * T-EXT-49 · Dessin des 5 vues du « bureau exemple » et porte window.demoMaquette.
 * Aucun texte d'histoire ici : tout vient de window.DONNEES_ECRANS (demo-data.js).
 * Seuls les libellés d'interface sont dans LIBELLES (registre des textes, T-EXT-40).
 * Déterministe : durées d'animation fixes, aucune lecture de l'heure, aucun hasard, aucun appel réseau.
 */
(function () {
  "use strict";

  var LIBELLES = {
    organisation: "Entreprise exemple",
    boiteReception: "Boîte de réception",
    nonLus: "non lus",
    nouveau: "Nouveau",
    retour: "← Retour",
    dossiers: "Dossiers",
    aValider: "À valider",
    envoyer: "Envoyer (simulation, aucun envoi)",
    agenda: "Agenda",
    creneauPropose: "Créneau proposé",
    confirme: "Confirmé",
    tableur: "Tableur",
    aVerifier: "À vérifier",
    clients: "Clients",
    messages: "Messages",
    tacheCreee: "Tâche créée",
  };

  var SIGNATURE = "cubic-bezier(0.16, 1, 0.3, 1)";
  var GLISSE = "cubic-bezier(0.65, 0, 0.35, 1)";

  var courant = { vue: null, etat: null };
  var file = Promise.resolve();

  function el(balise, classe, texte) {
    var n = document.createElement(balise);
    if (classe) n.className = classe;
    if (texte !== undefined && texte !== null) n.textContent = texte;
    return n;
  }

  function trouver(liste, id) {
    for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i];
    return null;
  }

  /** Programme une animation (jouée après insertion dans la page) ; sans animation, rien n'est programmé. */
  function jouer(ctx, noeud, images, duree, delai, courbe) {
    if (!ctx.anime || !noeud.animate) return;
    ctx.anims.push(function () {
      var a = noeud.animate(images, { duration: duree, delay: delai || 0, easing: courbe || SIGNATURE, fill: "backwards" });
      return a.finished.catch(function () {});
    });
  }

  function apparaitre(ctx, noeud, delai, duree) {
    jouer(ctx, noeud, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "translateY(0)" }], duree || 400, delai || 0);
  }

  // ---------------------------------------------------------------- Boîte de réception
  function dessinerBoite(d, etat, ctx) {
    var racine = el("div", "boite");
    var nouveau = trouver(d.messages, d.nouveau);
    var anciens = d.messages.filter(function (m) { return m.id !== d.nouveau; });

    if (etat === "ouvert" || etat === "brouillon") {
      var carte = el("article", "carte");
      carte.appendChild(el("div", "retour", LIBELLES.retour));
      carte.appendChild(el("div", "qui", nouveau.de + " · " + nouveau.adresse));
      carte.appendChild(el("h2", "", nouveau.objet));
      carte.appendChild(el("p", "corps", nouveau.corps));
      if (etat === "brouillon") {
        var rep = el("div", "reponse");
        rep.appendChild(el("span", "puce accent", LIBELLES.aValider));
        rep.appendChild(el("p", "corps", d.brouillon.texte));
        rep.appendChild(el("span", "bouton", LIBELLES.envoyer));
        apparaitre(ctx, rep, 0, 500);
        carte.appendChild(rep);
      }
      racine.appendChild(carte);
      return racine;
    }

    var entete = el("h2", "", LIBELLES.boiteReception);
    if (etat === "avant") {
      entete.appendChild(document.createTextNode(" "));
      entete.appendChild(el("span", "puce accent", anciens.length + " " + LIBELLES.nonLus));
    }
    racine.appendChild(entete);

    var avecDossiers = etat !== "avant";
    if (avecDossiers) {
      var barre = el("div", "dossiers");
      barre.appendChild(el("span", "", LIBELLES.dossiers));
      d.dossiers.forEach(function (dos) {
        var compte = anciens.filter(function (m) { return m.dossier === dos.id; }).length;
        var grimpe = etat === "etiquete" && nouveau.dossier === dos.id;
        var puce = el("span", "puce", dos.nom + " " + (compte + (grimpe ? 1 : 0)));
        if (grimpe) apparaitre(ctx, puce, 500, 400);
        barre.appendChild(puce);
      });
      racine.appendChild(barre);
    }

    function ligne(m, nonLu, avecPuce) {
      var l = el("div", "ligne" + (nonLu ? " non-lu" : ""));
      l.appendChild(el("div", "qui", m.de));
      l.appendChild(el("div", "objet", m.objet));
      if (avecPuce) {
        var dos = trouver(d.dossiers, m.dossier);
        var p = el("span", "puce", dos ? dos.nom : "");
        l.appendChild(p);
        return { ligne: l, puce: p };
      }
      return { ligne: l, puce: null };
    }

    if (etat === "nouveau" || etat === "etiquete") {
      var haut = ligne(nouveau, etat === "nouveau", etat === "etiquete");
      if (etat === "nouveau") {
        haut.ligne.appendChild(el("span", "puce accent", LIBELLES.nouveau));
        jouer(ctx, haut.ligne, [{ opacity: 0, transform: "translateY(-40px)" }, { opacity: 1, transform: "translateY(0)" }], 500, 0);
      } else {
        apparaitre(ctx, haut.puce, 0, 400);
      }
      racine.appendChild(haut.ligne);
    }
    anciens.forEach(function (m) {
      racine.appendChild(ligne(m, etat === "avant", etat !== "avant").ligne);
    });
    return racine;
  }

  // ---------------------------------------------------------------- Agenda
  function dessinerAgenda(d, etat, ctx) {
    var racine = el("div", "agenda");
    racine.appendChild(el("h2", "", LIBELLES.agenda));
    d.jours.forEach(function (j) {
      var rang = el("div", "jour");
      rang.appendChild(el("div", "nom", j.nom));
      var blocs = el("div", "blocs");
      d.evenements
        .filter(function (e) { return e.jour === j.id; })
        .forEach(function (e) { blocs.appendChild(el("div", "bloc", e.heure + " · " + e.titre)); });
      if (etat !== "semaine" && d.creneau.jour === j.id) {
        var propose = etat === "creneau-propose";
        var b = el("div", "bloc " + (propose ? "propose" : "confirme"), d.creneau.heure + " · " + d.creneau.titre + " · " + (propose ? LIBELLES.creneauPropose : LIBELLES.confirme));
        apparaitre(ctx, b, 200, 500);
        blocs.appendChild(b);
      }
      rang.appendChild(blocs);
      racine.appendChild(rang);
    });
    return racine;
  }

  // ---------------------------------------------------------------- Tableur
  function dessinerTableur(d, etat, ctx) {
    var racine = el("div", "tableur");
    racine.appendChild(el("h2", "", LIBELLES.tableur));
    var table = el("table", "table");
    var tete = el("tr");
    d.colonnes.forEach(function (c) { tete.appendChild(el("th", "", c)); });
    table.appendChild(tete);

    var lignes = d.lignes.slice();
    if (etat !== "lignes") lignes.push(d.nouvelleLigne);
    lignes.forEach(function (l, i) {
      var tr = el("tr");
      var estNouvelle = etat !== "lignes" && i === lignes.length - 1;
      l.cellules.forEach(function (c, k) {
        var texte = c;
        var td = el("td", "");
        if (etat === "colonne-a-jour" && d.statut.ligne === i && d.statut.colonne === k) {
          texte = d.statut.apres;
          td.className = "change";
          apparaitre(ctx, td, 100, 500);
        } else if (estNouvelle && etat === "ligne-ajoutee") {
          apparaitre(ctx, td, k * 250, 400);
        }
        td.textContent = texte;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    racine.appendChild(table);
    return racine;
  }

  // ---------------------------------------------------------------- Clients
  function dessinerCrm(d, etat, ctx) {
    var racine = el("div", "crm");
    racine.appendChild(el("h2", "", LIBELLES.clients));
    var suite = etat === "etape-suivante";
    var indexJeton = d.etapeDepart + (suite ? 1 : 0);
    var plateau = el("div", "etapes");
    var colonnes = [];
    d.etapes.forEach(function (e) {
      var col = el("div", "colonne");
      col.appendChild(el("div", "titre", e.nom));
      colonnes.push(col);
      plateau.appendChild(col);
    });
    var jeton = el("div", "jeton", d.fiche.titre);
    colonnes[indexJeton].appendChild(jeton);
    if (suite && ctx.anime && jeton.animate) {
      ctx.anims.push(function () {
        var avant = colonnes[d.etapeDepart].getBoundingClientRect().left;
        var apres = colonnes[indexJeton].getBoundingClientRect().left;
        var a = jeton.animate(
          [{ transform: "translateX(" + (avant - apres) + "px)" }, { transform: "translateX(0)" }],
          { duration: 600, easing: GLISSE, fill: "backwards" }
        );
        return a.finished.catch(function () {});
      });
    }
    racine.appendChild(plateau);

    var fiche = el("div", "carte");
    fiche.appendChild(el("h2", "", d.fiche.titre));
    d.fiche.champs.forEach(function (c, i) {
      var rang = el("div", "champ" + (etat === "fiche-vide" ? " vide" : ""));
      rang.appendChild(el("div", "libelle", c.libelle));
      var v = el("div", "valeur", etat === "fiche-vide" ? "" : c.valeur);
      if (etat === "fiche-remplie") apparaitre(ctx, v, i * 300, 400);
      rang.appendChild(v);
      fiche.appendChild(rang);
    });
    if (etat !== "fiche-vide") {
      var tampon = el("span", "tampon", LIBELLES.aVerifier);
      if (etat === "fiche-remplie") apparaitre(ctx, tampon, d.fiche.champs.length * 300, 400);
      fiche.appendChild(tampon);
    }
    racine.appendChild(fiche);
    return racine;
  }

  // ---------------------------------------------------------------- Messages
  function dessinerMessagerie(d, etat, ctx) {
    var racine = el("div", "messagerie");
    racine.appendChild(el("h2", "", LIBELLES.messages));
    if (etat === "notification") {
      var n = el("div", "notif");
      n.appendChild(el("div", "qui", d.notification.de));
      n.appendChild(el("div", "", d.notification.texte));
      jouer(ctx, n, [{ opacity: 0, transform: "translateY(-80px)" }, { opacity: 1, transform: "translateY(0)" }], 300, 0, GLISSE);
      racine.appendChild(n);
    }
    d.fil.forEach(function (m) {
      var b = el("div", "bulle");
      b.appendChild(el("div", "qui", m.de));
      b.appendChild(el("div", "", m.texte));
      racine.appendChild(b);
    });
    if (etat === "tache-creee") {
      var t = el("div", "tache");
      t.appendChild(el("span", "case"));
      var corps = el("div", "corps");
      corps.appendChild(el("div", "titre", d.tache.titre));
      corps.appendChild(el("div", "", d.tache.responsable));
      t.appendChild(corps);
      t.appendChild(el("span", "puce accent", LIBELLES.tacheCreee));
      apparaitre(ctx, t, 100, 500);
      racine.appendChild(t);
    }
    return racine;
  }

  var DESSINS = {
    boite: dessinerBoite,
    agenda: dessinerAgenda,
    tableur: dessinerTableur,
    crm: dessinerCrm,
    messagerie: dessinerMessagerie,
  };

  // ---------------------------------------------------------------- Affichage et porte
  function donnees() {
    return window.DONNEES_ECRANS;
  }

  function afficher(vue, etat, anime) {
    var zone = document.getElementById("vue");
    var ctx = { anime: anime, anims: [] };
    var noeud = DESSINS[vue](donnees().contenus[vue], etat, ctx);
    var changeDeVue = courant.vue !== vue;

    document.getElementById("titre-vue").textContent = window.ETATS_ECRANS.vues[vue].nom;
    document.getElementById("organisation").textContent = LIBELLES.organisation;
    Array.prototype.forEach.call(document.querySelectorAll("#barre .entree"), function (e) {
      var actif = e.getAttribute("data-vue") === vue;
      if (actif) e.setAttribute("aria-current", "true");
      else e.removeAttribute("aria-current");
      e.setAttribute("title", window.ETATS_ECRANS.vues[e.getAttribute("data-vue")].nom);
    });
    document.body.setAttribute("data-vue", vue);
    document.body.setAttribute("data-etat", etat);

    zone.replaceChildren(noeud);
    courant = { vue: vue, etat: etat };

    if (anime && changeDeVue && zone.animate) {
      ctx.anims.push(function () {
        var a = zone.animate(
          [{ opacity: 0, transform: "translateX(60px)" }, { opacity: 1, transform: "translateX(0)" }],
          { duration: 300, easing: GLISSE, fill: "backwards" }
        );
        return a.finished.catch(function () {});
      });
    }
    return Promise.all(ctx.anims.map(function (f) { return f(); }));
  }

  window.demoMaquette = {
    aller: function (id) {
      var d = donnees();
      var etape = null;
      if (d && d.etapes) {
        for (var i = 0; i < d.etapes.length; i++) if (d.etapes[i].id === id) etape = d.etapes[i];
      }
      if (!etape) {
        console.error("demoMaquette.aller : étape inconnue « " + id + " », rien n'a bougé.");
        return Promise.resolve(false);
      }
      if (!window.ETATS_ECRANS.etatPermis(etape.vue, etape.etat)) {
        console.error("demoMaquette.aller : vue ou état non permis (" + etape.vue + " / " + etape.etat + "), rien n'a bougé.");
        return Promise.resolve(false);
      }
      file = file.then(function () { return afficher(etape.vue, etape.etat, true); }).then(function () { return true; });
      return file;
    },
    reinitialiser: function () {
      file = Promise.resolve();
      afficher(window.ETATS_ECRANS.ordre[0], window.ETATS_ECRANS.vues[window.ETATS_ECRANS.ordre[0]].etats[0], false);
    },
  };

  window.demoMaquette.reinitialiser();
})();
