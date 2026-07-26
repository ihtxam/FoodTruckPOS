import { getChaiBuilderTailwindConfig } from '@chaibuilder/sdk/tailwind';

const chai = getChaiBuilderTailwindConfig([
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}',
  './node_modules/@chaibuilder/sdk/dist/**/*.{js,cjs}',
]);

/** @type {import('tailwindcss').Config} */
export default {
  ...chai,
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@chaibuilder/sdk/dist/**/*.{js,cjs}',
  ],
  theme: {
    ...chai.theme,
    extend: {
      ...(chai.theme?.extend || {}),
      colors: {
        ...(chai.theme?.extend?.colors || {}),
        // Keep panel tokens used outside CMS
        success: '#15803d',
        warning: '#b45309',
        error: '#b91c1c',
      },
    },
  },
  plugins: [...(chai.plugins || [])],
};
