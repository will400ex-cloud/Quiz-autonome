# Quiz autonome (HTML/JS/CSS + CSV)

Une application **100% statique** qui charge un CSV de questions, enregistre la progression localement (localStorage), calcule le score et peut **envoyer** les résultats vers **Google Sheets** (optionnel via Apps Script).

## Structure
```
quiz-standalone/
  index.html
  assets/
    styles.css
    csv-loader.js
    engine.js
    app.js
  data/
    questions.csv
    config.json
  apps-script/
    Code.gs
```

## Utilisation rapide
1. Ouvrez `data/questions.csv` et remplacez les questions par les vôtres (gardez l'entête).
2. Ouvrez `data/config.json` et ajustez le titre, l'ID de quiz, les options (timer, feedback, mélange…).  
3. Double-cliquez `index.html` pour tester en local (ou servez avec un petit serveur HTTP pour éviter certains blocages de `fetch`).
4. **Optionnel — Envoi des résultats** : 
   - Créez une Google Sheet vide.
   - Ouvrez `apps-script/Code.gs` dans Google Apps Script, remplacez `SHEET_ID` par l'ID de votre feuille.
   - Déployez en Web App et mettez l'URL dans `data/config.json` → `sendResults.endpoint` + `enabled: true`.

### Hébergement conseillé
- GitHub Pages, Netlify, Cloudflare Pages… (déposez *tout* le dossier).

## Format CSV
```
question,option_a,option_b,option_c,option_d,correct,time,explanation,feedback,image
"Texte de la question","Réponse A","Réponse B","Réponse C","Réponse D","A/B/C/D",180,"Explication neutre affichée au review","","https://.../image.png"
```
- `time` (sec) est optionnel (défaut via `config.json`).
- `explanation` est affichée **au moment du review** (ou immédiatement si `feedbackMode: "immediate"`).
- `image` (URL) est optionnelle.

## Paramètres (`data/config.json`)
- `quizId`: identifiant technique du quiz (sert pour la sauvegarde locale et le nom du fichier de résultats).
- `title`: titre affiché.
- `defaultTimeSec`: temps par question (si la colonne `time` est vide).
- `showTimer`: affiche le compte à rebours par question.
- `enforceTimer`: si vrai, passe automatiquement à la question suivante quand le temps est écoulé.
- `feedbackMode`: `"immediate"` (affiche correct/incorrect et explication tout de suite) ou `"end"` (bilan final).
- `allowBack`: autorise le retour à la question précédente.
- `shuffleQuestions`, `shuffleOptions`: mélange des questions/options.
- `passingScore`: seuil de réussite (en %).
- `sendResults`: 
  - `enabled`: activer l'envoi.
  - `endpoint`: URL Apps Script Web App.
  - `apiKey`: clé facultative (si vous ajoutez une vérification côté Apps Script).

## Résultats
- Bouton **Télécharger mes résultats** → `.json` (contient score, temps, détail question par question).
- Bouton **Envoyer** → POST JSON vers `sendResults.endpoint` (si activé).

## Astuces
- Pour tester en local avec `fetch`, utilisez un petit serveur (ex. `python -m http.server`), sinon certains navigateurs bloquent `file://` + `fetch`.
- Vous pouvez créer plusieurs quiz en dupliquant `data/questions.csv` et en ajoutant un menu. (La base supporte déjà 1 quiz, prêt à étendre.)

Bon quiz !
