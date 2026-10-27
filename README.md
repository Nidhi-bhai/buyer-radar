# BuyerRadar

BuyerRadar ranks **where** a small brand or exporter should look for buyers who have money, authority, and need. You enter a product. The page returns buyer company types, importing countries, communities, marketplaces, RFQ boards, trade shows, and job titles. Each one has a Money / Authority / Need score, a written reason, and a source.

The free result is the **top 5** channels. The full ranking, with an outreach angle on every channel, is a one-time **$19** Markdown and PDF report paid with PayPal Smart Buttons.

## What is sourced, and what is a judgment

- **Import dollars** come from the [UN Comtrade public preview API](https://uncomtrade.org/docs/un-comtrade-api/). The query is annual merchandise **imports** (`flowCode=M`) from partner **World** (`partnerCode=0`) for one HS code. `primaryValue` is stored as the JSON literal the API returned. BuyerRadar does not estimate, scale, or sum figures. If a reporter was published under more than one HS edition, only the later edition is kept.
- The public API does not send CORS headers, so the browser cannot call it. `data/trade-snapshots.json` is that response, retrieved by `scripts/refresh-trade.py`. Every country card links the query URL.
- When an HS heading is wider than the product (moringa leaf powder inside HS 121190, for example), the page says so and lowers Need. The dollars stay the heading's dollars.
- **Services** have no goods code. Those reports do not invent a trade number.
- **Company types** cite the U.S. Census Bureau [NAICS 2022](https://www.census.gov/naics/) title. **Job titles** cite [O*NET OnLine](https://www.onetonline.org/). Shows, marketplaces, and communities cite their own sites. The 1–5 scores on those channels are editorial judgments explained in the reason. They are not measurements.

A product that is not in the knowledge base gets no report. The tool will not invent a market.

## PayPal

`config.js` exposes `PAYPAL_CLIENT_ID`. Replace `YOUR_PAYPAL_CLIENT_ID` with the **client id** of a PayPal REST app. That id is public by design (it ships in the page). Do not commit a PayPal secret, webhook secret, or access token.

Until the placeholder is replaced, the button is not loaded. After a capture, this browser offers the Markdown and PDF downloads. GitHub Pages cannot verify the payment on a server, and the knowledge base is a public file. The paywall is the Smart Buttons flow the product asked for, not DRM.

## Pages

Industry pages live in `industries/`. Each is titled “Where to find buyers for …”, with the Comtrade table and the free top 5. `sitemap.xml` lists them. The expected GitHub Pages URL is:

https://nidhi-bhai.github.io/buyer-radar/

## Develop

```bash
python3 scripts/refresh-trade.py   # refresh Comtrade snapshots
node scripts/build.js              # industries.json, SEO pages, sitemap
node scripts/test-reports.js       # five sample products plus page checks
```

Sample reports written by the test are in `samples/`.

There is no application secret and no build dependency beyond Node and Python 3.

Built by [Nidhi Karuturi](https://github.com/Nidhi-bhai).
