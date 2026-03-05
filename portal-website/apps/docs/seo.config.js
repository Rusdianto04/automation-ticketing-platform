const seoConfig = {
  metadataBase: new URL("https://peppermint.sh"),
  title: {
    template: "Peppermint",
    default:
      "Peppermint - Revolutionizing Customer Support for Rapid Resolutions. Your Premier Zendesk Alternative.",
  },
  description:
    "Experience Peppermint's revolutionary approach to customer support, ensuring swift resolutions. Discover your ultimate alternative to Zendesk.",
  themeColor: "#F6E458",
  openGraph: {
    images: "/og-image.png",
    url: "https://peppermint.sh",
  },
  manifest: "/site.webmanifest",
  icons: [
    { rel: "icon", url: "/logo-seamolec.ico" },
    { rel: "apple-touch-icon", url: "/logo-seamolec.ico" },
    { rel: "mask-icon", url: "/logo-seamolec.ico" },
    { rel: "image/x-icon", url: "/logo-seamolec.ico" },
  ],
  twitter: {
    site: "@potts_dev",
    creator: "@potts_dev",
  },
};

export default seoConfig;