/**
 * Tailwind preset for MKT SEO AI brand.
 * Brand colors (per Sprint 2 Task 2.4 brief):
 *   - primary blue:   #1F4E79
 *   - accent orange:  #E97132
 * Sprint 2 will extend with shadcn semantic tokens (background, foreground, ...).
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1F4E79',
          50: '#EAF1F8',
          100: '#C9DCEC',
          200: '#A6C5DF',
          300: '#7DAACE',
          400: '#5A92BF',
          500: '#3D7AAE',
          600: '#1F4E79',
          700: '#1A4267',
          800: '#143356',
          900: '#0E2543',
        },
        accent: {
          DEFAULT: '#E97132',
          50: '#FDEEE4',
          100: '#FACDB1',
          200: '#F6AB7E',
          300: '#F18A4D',
          400: '#EE7C3D',
          500: '#E97132',
          600: '#C75C27',
          700: '#A04820',
          800: '#7A3719',
          900: '#522410',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
};
