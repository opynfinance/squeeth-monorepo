module.exports = {
  env: {
    mocha: true,
  },
  extends: ["airbnb", "plugin:prettier/recommended"],
  plugins: ["babel"],
  parser: "@typescript-eslint/parser",
  rules: {
    "prettier/prettier": ["error"],
    "import/extensions": [
      "error",
      "ignorePackages",
      {
        js: "never",
        ts: "never",
      },
    ],
    "import/prefer-default-export": "off",
    "prefer-destructuring": "off",
    "prefer-template": "off",
    "no-console": "off",
    "func-names": "off",
    "no-unused-expressions": "off",
    "no-use-before-define": "off",
    "no-await-in-loop": "off",
    "no-underscore-dangle": "off",
    "no-unused-vars": "off"
  },
  ignorePatterns: ["package.json", "contracts/*", "tasks/default.ts"],
  settings: {
    "import/resolver": {
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
    },
  },
};
