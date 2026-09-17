import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Marqa",
    short_name: "Marqa",
    description: "Marketing com IA para agências, marcas e profissionais.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0d0f",
    theme_color: "#f76b15",
    lang: "pt-BR",
    icons: [
      { src: "/brand/marqa-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/marqa-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
