import type { LegalDoc } from "./legal-types";

// Draft for the owner's review (not legal advice). Company identity comes only
// from environment variables (see lib/legal.ts). Brazilian law governs; the
// Portuguese version prevails if the two differ.

export const TERMS_EN: LegalDoc = {
  slug: "terms",
  lang: "en",
  title: "Terms of Use",
  intro:
    "These terms govern your use of Marqa, an AI marketing platform that connects agencies, brands and creative professionals. By creating an account or using the platform you agree to them.",
  sections: [
    {
      heading: "1. Who we are and how to reach us",
      paragraphs: [
        "Marqa is operated by the party identified in the \"Who runs Marqa\" box on this page. Questions, requests and complaints go through the contact form on the site; every message is logged and answered by email.",
      ],
    },
    {
      heading: "2. Accounts",
      paragraphs: [
        "You need an account with a valid email address. Keep your password private; you are responsible for activity on your account. Tell us through the contact form if you suspect misuse.",
        "An agency may create accounts for its brands and professionals. In that case the agency receives a temporary password that must be changed at the first sign-in.",
        "Agency sign-up may require approval. We may suspend or close accounts that break these terms or the law, or that put other people or the platform at risk.",
      ],
    },
    {
      heading: "3. What the platform does",
      paragraphs: [
        "Marqa organises briefs, clients, production jobs, content calendars, approvals and reports, and produces AI suggestions (strategy, campaigns, copy, visual identity, reply drafts and more).",
        "Payment tracking between agency, brand and professional inside a job is a status record only: Marqa does not receive, hold or transfer that money and does not act as an intermediary or guarantor of those payments.",
        "Features that rely on third parties (WhatsApp and Instagram through Meta's official API, Google Analytics, ads, AI voice, image generation) only work once the matching account is configured and active.",
      ],
    },
    {
      heading: "4. AI-generated content",
      paragraphs: [
        "AI output is a suggestion and may contain mistakes, outdated information or claims that need evidence. Review everything before publishing or sending it to clients. You are responsible for how you use it, including in ads and consumer communications.",
        "Do not use the platform to create unlawful, misleading or discriminatory content, to infringe third-party rights, or to send unsolicited bulk messages (spam).",
      ],
    },
    {
      heading: "5. Your data and your content",
      paragraphs: [
        "What you upload (briefs, files, photos, messages) remains yours. You allow us to store and process it only to provide the service, including sending it to the AI providers listed in the Privacy Policy.",
        "You confirm you have the right to use what you upload, including images of people, brands and third-party works.",
        "You can download your data and delete your account at any time under My account.",
      ],
    },
    {
      heading: "6. Plans, coins and payments",
      paragraphs: [
        "There are two ways to pay for a plan. With a one-off payment (Pix, bank slip or a single card charge) the plan is prepaid for a period (monthly, quarterly, half-yearly or yearly) and does not renew automatically: when the period ends the account returns to the free plan and nothing else is charged.",
        "With a card subscription you authorise Mercado Pago to charge the same amount every period (monthly by default) until you cancel. The charge happens on the renewal date shown under Plans, at the price of your own subscription; if we change prices we tell you first and you can cancel. Each account has at most one card subscription: subscribing to another plan cancels the previous one as soon as the new one is approved.",
        "To stop the renewal, click \"Cancelar renovação\" on the Plans screen — no penalty, no need to talk to anyone. The plan stays active until the end of the period you already paid for and the account then returns to the free plan. If a charge does not go through, access continues for up to 3 days while Mercado Pago retries.",
        "Each plan includes a monthly coin allowance, refilled every month of the paid period; unused allowance does not roll over. Coins bought separately do not expire while the account exists. Each AI action uses the number of coins shown in the platform; failed actions are not charged.",
        "Prices are in Brazilian reais (BRL, R$) and payments are processed by Mercado Pago (Pix, card or boleto). Your plan or coins are released once Mercado Pago confirms the payment.",
        "Cancellation, refunds and chargebacks follow the Refund Policy.",
      ],
    },
    {
      heading: "7. Fair use and limits",
      paragraphs: [
        "To keep the platform stable and costs under control we apply usage limits per account and per network (for example, the number of AI requests within a few minutes) and a daily AI usage ceiling for the whole platform. When a limit is reached, AI pauses for a while and the rest of the platform keeps working.",
      ],
    },
    {
      heading: "8. Availability",
      paragraphs: [
        "We work to keep Marqa available, but maintenance or third-party failures (hosting, AI providers, payment providers) can cause interruptions. We keep backups, and we recommend you keep copies of anything important (for example, by downloading your data).",
      ],
    },
    {
      heading: "9. Liability",
      paragraphs: [
        "To the extent the law allows, Marqa is not liable for business decisions based on generated content, campaign results, negotiations between users or outages of third-party services. Nothing in these terms limits rights you have under the Brazilian Consumer Protection Code.",
      ],
    },
    {
      heading: "10. Changes",
      paragraphs: [
        "We may update these terms and will announce relevant changes in the platform. The date of the current version is shown at the top; the acceptance recorded at sign-up stores the version you accepted.",
      ],
    },
    {
      heading: "11. Governing law",
      paragraphs: [
        "These terms are governed by Brazilian law. If you are a consumer, you may bring a claim in the courts where you live. If this English version and the Portuguese version differ, the Portuguese version prevails.",
      ],
    },
  ],
};

export const PRIVACY_EN: LegalDoc = {
  slug: "privacy",
  lang: "en",
  title: "Privacy Policy",
  intro:
    "This policy explains which personal data Marqa processes, why, who we share it with and how you can exercise your rights under Brazil's General Data Protection Law (Law 13,709/2018, LGPD).",
  sections: [
    {
      heading: "1. Controller and data protection officer",
      paragraphs: [
        "The controller is the party identified in the \"Who runs Marqa\" box on this page. To reach the data protection officer, use the contact form and choose \"Privacy and my data (LGPD)\".",
        "When an agency registers its own clients and professionals, the agency is the controller of that work data and Marqa acts as a processor on the agency's instructions.",
        "Brands that sign up directly on Marqa, without an agency's invitation, are looked after by Marqa's own team: that team can see and edit the brand's data to give support and, if the brand chooses to have an agency handle its work, to deliver it. No other agency can see that data.",
      ],
    },
    {
      heading: "2. Data we process",
      bullets: [
        "Sign-up: name, email, username, password (stored only as a hash), account type, date and version of the terms you accepted, and the visit source (utm parameters) that brought you to the sign-up form.",
        "Usage: sign-in records, source IP (for security and rate limits), first-session events, theme and language preferences.",
        "Our own measurement of the public pages (no cookies): page visited, referrer, utm parameters, device type and an identifier that is a hash of a daily salt + IP + browser. The salt changes every day and is not stored with the event, so the identifier cannot follow you from one day to the next. We also record account events (sign-up, first value delivered, checkout started and payment approved).",
        "Clicks on short links (/l/...) and visits to a brand's link page (/b/...): the same cookie-free measurement, done so the agency that owns the link can see what works.",
        "Approval links: the name a person types when approving or asking for changes, and the date of the decision.",
        "Content: briefs, uploaded files and images, deliverables, comments, messages, reports and AI output.",
        "Spoken brief: the transcript of what you say. Your browser's speech recognition produces it (in Chrome, a Google service); Marqa only receives the text and does not record audio.",
        "Messaging (when an agency connects it): contact names and numbers/identifiers and the text of WhatsApp/Instagram messages.",
        "Payments: plan, amounts, status and transaction ID. Card and Pix details stay with Mercado Pago; we never receive them.",
        "Contact: name, email and message sent through the form, and agency public pages (name and WhatsApp number of people asking for a quote).",
      ],
    },
    {
      heading: "3. Purposes and legal bases",
      bullets: [
        "Providing the service (accounts, AI generation, approvals, reports) — performance of a contract (art. 7, V).",
        "Charging for plans and coins and keeping financial records — contract and legal obligation (art. 7, II and V).",
        "Security, fraud and abuse prevention, rate limits and access logs — legitimate interest and the legal obligation in Brazil's Internet Civil Framework (art. 7, II and IX).",
        "Answering contact and access requests — pre-contract steps and legitimate interest (art. 7, V and IX).",
        "Improving the product with aggregated usage metrics and measuring where visits and sign-ups come from, with no cookies and no personal profiling — legitimate interest (art. 7, IX).",
      ],
      paragraphs: ["We do not sell personal data and we do not use it for third-party advertising."],
    },
    {
      heading: "4. Who we share data with (sub-processors)",
      bullets: [
        "Anthropic (United States) — AI models that produce strategy, copy and analysis from the content you provide.",
        "Mercado Pago (Brazil) — payment processing in BRL. Stripe (United States) may be used for other currencies once enabled.",
        "ElevenLabs and OpenAI (United States) — text-to-speech in the spoken brief, when voice is enabled.",
        "Meta / WhatsApp and Instagram (United States and other countries) — sending and receiving messages, when an agency connects the official API.",
        "Google (United States) — Google Analytics data and image generation, only when that account is connected.",
        "Hostinger — hosting of the server that stores the database and files.",
      ],
      paragraphs: ["We may also disclose data when the law or a competent authority requires it."],
    },
    {
      heading: "5. International transfers",
      paragraphs: [
        "Some providers above process data outside Brazil. These transfers are needed to perform our contract with you (LGPD art. 33, II and IX) and go to providers that use contractual clauses and security measures compatible with the LGPD. Please avoid putting sensitive data in briefs and messages.",
      ],
    },
    {
      heading: "6. Retention",
      bullets: [
        "Account data and content: while the account exists. When you delete your account we erase it together with your own workspace (self-registered brand or professional profile).",
        "Financial records: kept for the period tax law requires (usually 5 years), unlinked from you after account deletion.",
        "Access logs (date, time and IP of sign-ins): 6 months, as Brazil's Internet Civil Framework requires, then deleted.",
        "Measurement events for public pages and link clicks: 90 days in detail; after that only the daily counts remain, with no identifier.",
        "Contact messages: up to 2 years after they are answered.",
        "Backups: rotated within a few weeks; deleted data leaves them at the end of that cycle.",
      ],
    },
    {
      heading: "7. Your rights",
      paragraphs: [
        "You can ask for confirmation of and access to your data, correction, anonymisation, blocking or deletion, portability, information about sharing, and withdrawal of consent (LGPD art. 18).",
        "Under My account you can download your data as JSON and delete your account yourself. For anything else, use the contact form with \"Privacy and my data (LGPD)\"; we answer within 15 days. You may also complain to Brazil's data protection authority (ANPD).",
        "If an agency created your account, some work data belongs to that agency and we may forward your request to it.",
      ],
    },
    {
      heading: "8. Security",
      paragraphs: [
        "We use encrypted connections (HTTPS), strong password hashing, sessions that expire and can be revoked, limits against repeated attempts and role-based access control. No system is fully immune; if a relevant incident happens we will notify the people affected and the ANPD as the law requires.",
      ],
    },
    {
      heading: "9. Cookies",
      paragraphs: [
        "We only use an essential sign-in cookie and browser storage for theme and language and, while the tab is open, the source (utm) of your first visit. Our audience measurement uses no cookies and no third-party trackers. See the Cookie Policy.",
      ],
    },
    {
      heading: "10. Children",
      paragraphs: ["Marqa is meant for adults (18+) and businesses. We do not knowingly collect data from minors."],
    },
    {
      heading: "11. Updates",
      paragraphs: ["This policy may change. The date of the current version is at the top; relevant changes are announced in the platform."],
    },
  ],
};

export const REFUNDS_EN: LegalDoc = {
  slug: "refunds",
  lang: "en",
  title: "Refund and Cancellation Policy",
  intro: "How cancellation, refunds and plan endings work for Marqa plans and coin packs.",
  sections: [
    {
      heading: "1. 7-day cooling-off period",
      paragraphs: [
        "Because you buy online, you can withdraw within 7 calendar days of the confirmed payment and get the full amount back, under article 49 of the Brazilian Consumer Protection Code.",
        "To ask for it, use the contact form with \"Payment, plan or refund\" and include your account email and, if you have it, the Mercado Pago payment number.",
      ],
    },
    {
      heading: "2. How the refund is made",
      paragraphs: [
        "Mercado Pago refunds through the original method: Pix goes back to the source account; cards show a credit on the statement (timing depends on the issuer, usually up to two statements); boleto is refunded by bank transfer to your account.",
        "Once the refund is confirmed, the paid plan returns to free and the pack's coins are removed from the wallet.",
      ],
    },
    {
      heading: "3. Card subscription: how to cancel",
      paragraphs: [
        "A card subscription renews on its own every period until you cancel. To cancel, open Plans and click \"Cancelar renovação\": nothing else is charged, the plan stays active until the end of the period you already paid for, and the account then returns to the free plan. You can also cancel the authorisation directly at Mercado Pago.",
        "The 7-day cooling-off right applies to each charge: cancel within 7 calendar days of a renewal and we refund that charge and move the account back to the free plan.",
        "If a renewal is not paid, access continues for up to 3 days while Mercado Pago retries; after that the account returns to the free plan with nothing outstanding.",
      ],
    },
    {
      heading: "4. After 7 days",
      paragraphs: [
        "Outside the cooling-off period we do not refund a period already started or coins already bought, except for a failure on our side that prevents you from using the service, a billing error, or where the law requires it. Contact us through the form in those cases.",
      ],
    },
    {
      heading: "5. Failed AI actions",
      paragraphs: ["If an AI action fails, the coins reserved for it return to your wallet automatically."],
    },
    {
      heading: "6. Payments between agency, brand and professional",
      paragraphs: [
        "Amounts agreed between agency, brand and professional inside a job are negotiated and paid directly between them. Marqa does not intermediate or refund those payments.",
      ],
    },
  ],
};

export const COOKIES_EN: LegalDoc = {
  slug: "cookie-policy",
  lang: "en",
  title: "Cookie Policy",
  intro: "Marqa only uses what it needs to work, so there is no consent banner.",
  sections: [
    {
      heading: "Essential cookie",
      bullets: [
        "agencyhub_session — keeps you signed in. Cryptographically signed, readable only by the server (HttpOnly), sent only over HTTPS in production, expires within 30 days or when you sign out.",
      ],
    },
    {
      heading: "Browser local storage",
      bullets: [
        "Light/dark theme and interface language.",
        "Flags for welcome screens and celebrations already shown.",
        "marqa_ft — the source (utm) of your first visit, kept only while the tab is open and sent along if you create an account.",
      ],
      paragraphs: ["This stays in your browser and is not used to track you."],
    },
    {
      heading: "Cookie-free audience measurement",
      paragraphs: [
        "We count visits to the public pages, clicks on short links (/l/...) and visits to brand link pages (/b/...) on our own server, with no cookies: a visitor is identified by a hash of a daily salt + IP + browser that changes every day. Detailed events are kept for 90 days; after that only the daily counts remain.",
      ],
    },
    {
      heading: "What we do not use",
      paragraphs: [
        "No advertising cookies, social media pixels or third-party trackers. If that ever changes, we will ask for your consent first.",
        "You can clear cookies and site data in your browser settings; clearing the session cookie signs you out.",
      ],
    },
  ],
};
