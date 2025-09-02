# Quiz autonome v5
- Auto-liste des `.csv` depuis le dossier `data/` (via l'API GitHub) — zéro modif de `config.json` quand tu ajoutes un CSV.
- Envoi Google Sheets compatible CORS (fallback `no-cors` + `text/plain`).
- UI mobile-first, thème clair/sombre, accessibilité.

## Installation rapide
1) Remplis `data/` avec tes CSV.
2) Mets `apps-script/Code.gs` dans Google Apps Script, remplace `SHEET_ID`, déploie en Web App et récupère l'URL `/exec`.
3) Dans `data/config.json`, mets `sendResults.enabled: true` et colle l'URL dans `endpoint`.
4) Pousse tout sur GitHub Pages. Le menu du quiz se remplit tout seul.

## CSV — entêtes minimales
`question,option_a,option_b,option_c,option_d,correct` (+ `time,explanation,feedback,image` optionnels)
