/** @type {import('tailwindcss').Config} */
module.exports = {
  // En v4, el 'content' se detecta solo, lo dejamos vacío o comentado para evitar errores
  // content: ["./src/**/*.{html,ts}"],

  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        light: {
          ...require("daisyui/src/theming/themes")["light"],
          "primary": "#00d4ff",
          "secondary": "#00b5d8",
          "base-100": "#ffffff",
          "base-200": "#f0f2f5",
        },
        dark: {
          ...require("daisyui/src/theming/themes")["dark"],
          "primary": "#00d4ff",
          "base-100": "#111b21", // Tu fondo oscuro WhatsApp
          "base-200": "#202c33",
          "base-300": "#2a3942",
        },
      },
    ],
  },
}
