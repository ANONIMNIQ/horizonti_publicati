module.exports = {
  extends: ['expo', 'prettier'],
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': [
      'error',
      {
        endOfLine: 'auto',
      },
    ],
    // Add any other specific rules you want to enforce
    // For example, to enforce consistent imports:
    // 'import/order': [
    //   'error',
    //   {
    //     'newlines-between': 'always',
    //     groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
    //     pathGroups: [
    //       {
    //         pattern: '@/**',
    //         group: 'internal',
    //       },
    //     ],
    //     alphabetize: {
    //       order: 'asc',
    //       caseInsensitive: true,
    //     },
    //   },
    // ],
  },
};
