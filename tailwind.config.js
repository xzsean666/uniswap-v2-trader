/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: "#0b0f17",
          card: "#0f1722",
          cardInner: "#131d2b",
          cyan: "#00e5ff",
          cyanHover: "#00c4db",
          teal: "#00f0ff",
          border: "rgba(0, 229, 255, 0.22)",
          borderHover: "rgba(0, 229, 255, 0.45)",
          textPrimary: "#f8fafc",
          textMuted: "#8da0b6",
          pillBg: "#16202e",
          danger: "#f43f5e",
        },
      },
      boxShadow: {
        glowCyan: "0 0 15px rgba(0, 229, 255, 0.18)",
        glowCyanStrong: "0 0 25px rgba(0, 229, 255, 0.35)",
        cardDark: "0 8px 24px rgba(0, 0, 0, 0.4)",
      },
    },
  },
  plugins: [],
};
