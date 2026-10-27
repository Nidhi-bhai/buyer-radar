# BuyerRadar

BuyerRadar ranks **where** a small brand or exporter should look for buyers who have money, authority, and need. You enter a product. The page returns buyer company types, importing countries, communities, marketplaces, RFQ boards, trade shows, and job titles. Each one has a Money / Authority / Need score, a written reason, and a source.

The free tier is the **top 5** channels. A one-time **$19** Markdown and PDF report is offered when the industry has at least five further channels. The report states that count and includes an outreach angle on every channel. Company types are United States NAICS industries. Job titles are United States O*NET occupations. Aggregate Comtrade partners (World, Areas, nes, Other Asia, nes) are left out of the country ranking.

## What is sourced, and what is a judgment

- **Import dollars** come from the [UN Comtrade public preview API](https://uncomtrade.org/docs/un-comtrade-api/). The query is annual merchandise **imports** (`flowCode=M`) from partner **World** (`partnerCode=0`) for one HS code. `primaryValue` is stored as the JSON literal the API returned. BuyerRadar does not estimate, scale, or sum figures. If a reporter was published under more than one HS edition, only the later edition is kept.
- The public API does not send CORS headers, so the browser cannot call it. `data/trade-snapshots.json` is that response, retrieved by `scripts/refresh-trade.py`. Every country card links the query URL.
- When an HS heading is wider than the product (moringa leaf powder inside HS 121190, for example), the page says so and lowers Need. The dollars stay the heading's dollars.
- **Services** have no goods code. Those reports do not invent a trade number.
- **Company types** cite the United States [NAICS 2022](https://www.census.gov/naics/) classification. **Job titles** cite the United States [O*NET](https://www.onetonline.org/) occupation classification. Shows, marketplaces, directories, and communities cite their own sites. The 1–5 scores on those channels are editorial judgments explained in the reason. They are not measurements. Spam-prone RFQ boards (TradeKey, go4WorldBusiness, and Alibaba Sourcing) are scored Need 2, with a caution in the reason.

A product that is not in the knowledge base gets no report. The tool will not invent a market.

## PayPal

The live client id is already in `config.js`. It is public by design. Do not commit a PayPal secret, webhook secret, or access token, and do not replace the live client id.

After a capture, this browser stores the product, order id, and purchase time in `localStorage` and can download the report again on a later visit. The order id is shown on the page and in the file. Refunds: email nidhi69n@gmail.com within 7 days with your order id.

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
