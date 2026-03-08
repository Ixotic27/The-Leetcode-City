import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LeetCode City",
    short_name: "LeetCode City",
    description:
      "Explore LeetCode users as buildings in a 3D pixel art city. Fly through the city and discover developers.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d1117",
    theme_color: "#4ADE80",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
