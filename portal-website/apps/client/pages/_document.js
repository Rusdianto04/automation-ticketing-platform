import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html>
      <Head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no"
        />
        <meta
          name="description"
          content="Ticket management system selfhosted open source"
        />
        <meta name="keywords" content="Keywords" />

        <meta name="theme-color" content="#ffffff" />
        <link rel="manifest" href="/manifest.json" />

        <title>Ticketing</title>

        <link href="/favicon/logo-seamolec.ico" rel="icon" />
        <link
          href="/favicon/logo-seamolec.png"
          rel="icon"
          type="image/png"
          sizes="16x16"
        />
        <link
          href="/favicon/logo-seamolec.png"
          rel="icon"
          type="image/png"
          sizes="32x32"
        />
        <link rel="apple-touch-icon" href="/favicon/logo-seamolec.png"></link>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
