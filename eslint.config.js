import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// Un effet React ne doit renvoyer que rien ou une fonction de nettoyage : toute
// autre valeur (promesse, nombre, booléen…) est « appelée » par React au
// nettoyage et fait planter l'écran en production. TypeScript ne le voit pas
// quand le navigateur change ce que renvoie une fonction (scrollIntoView).
const EFFET =
  'CallExpression:matches([callee.name=/^use(Layout|Insertion)?Effect$/], [callee.property.name=/^use(Layout|Insertion)?Effect$/])'
const RETOUR_NON_FONCTION = 'ReturnStatement[argument]:not([argument.type=/^(ArrowFunctionExpression|FunctionExpression)$/])'
const MESSAGE_RETOUR = "Un effet ne renvoie que rien ou une fonction de nettoyage : sortir cette valeur du « return »."
const REGLES_EFFETS = [
  {
    selector: `${EFFET} > ArrowFunctionExpression[expression=true]`,
    message:
      "Effet à corps-expression : il renvoie la valeur de l'expression, que React appellera au nettoyage. Écrire le corps entre accolades { … }.",
  },
  {
    selector: `${EFFET} > :function[async=true]`,
    message: "Effet « async » : il renvoie une promesse, que React appellera au nettoyage. Appeler une fonction async depuis l'effet.",
  },
  { selector: `${EFFET} > :function > BlockStatement > ${RETOUR_NON_FONCTION}`, message: MESSAGE_RETOUR },
  { selector: `${EFFET} > :function > BlockStatement > IfStatement > ${RETOUR_NON_FONCTION}`, message: MESSAGE_RETOUR },
  { selector: `${EFFET} > :function > BlockStatement > IfStatement > BlockStatement > ${RETOUR_NON_FONCTION}`, message: MESSAGE_RETOUR },
]

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
      'no-restricted-syntax': ['error', ...REGLES_EFFETS],
    },
  },
)
