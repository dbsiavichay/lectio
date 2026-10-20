import type { MetadataRoute } from "next";

/** Installable on the phone's home screen, opening full screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lectio",
    short_name: "Lectio",
    description: "Estudio guiado de libros: sesiones, repasos espaciados y compromisos.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf8f3",
    theme_color: "#0b5f5b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
