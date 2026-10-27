# Privacy Policy for YouTube Misinformation Detector

**Last Updated:** October 25, 2026

This Privacy Policy explains how the **YouTube Misinformation Detector** Chrome Extension ("we", "our", or "the extension") handles user information. We are committed to protecting your privacy and ensuring transparent data practices.

---

## 1. Core Commitment: Privacy by Design

The **YouTube Misinformation Detector** is designed with a strict privacy-first architecture:
* **No Account Required**: You do not need to register, log in, or provide any personal details to use the extension.
* **No Tracking or Profiling**: We do not track your browsing habits, record your viewing history, or build user profiles.
* **No Sale of Data**: We do not sell, rent, monetize, or trade any user data with advertisers, third-party brokers, or commercial entities.

---

## 2. Information We Process

### A. Information Processed Automatically
When you visit a YouTube video watch page (`https://www.youtube.com/watch?v=...`), the extension processes:
1. **Public YouTube Video Identifier**: The 11-character video ID (e.g., `dQw4w9WgXcQ`) extracted from the URL.
2. **Current Playback Time**: The local HTML5 video player's `currentTime` is read on your device solely to display warning overlays at the corresponding timestamp during playback.

### B. Information We Do NOT Collect
We do **NOT** collect, access, transmit, or store:
* Personally Identifiable Information (PII) such as your name, email, phone number, or physical address.
* Google or YouTube account credentials, profile details, comments, watchlists, or search history.
* Browsing history on any website outside YouTube watch pages.
* Payment, credit, financial, or biometric data.
* Device hardware identifiers, MAC addresses, or location data.

---

## 3. How Information is Used

The public video ID is transmitted to our secure backend API (`https://youtube-factcheck-api.vercel.app/check`) for the **single purpose** of:
1. Retrieving public captions/transcripts for that specific video.
2. Analyzing spoken factual claims against authoritative verification databases using AI (Google Gemini).
3. Returning chronological timestamps, claim verdicts, explanations, and authoritative citation sources.

This information is never linked to your identity or stored in persistent user profiles.

---

## 4. Local Data Storage

All user customization preferences are saved **locally on your device** using Chrome's native `chrome.storage.local` API:
* Master enable/disable toggle.
* In-video warning overlay toggle.
* Preferred timeline drawer filter (All, Misinformation, Verified, Unverified).
* Temporary in-memory cache of retrieved fact-checks to prevent redundant network requests.

This local storage never leaves your browser and can be cleared at any time by uninstalling the extension or clearing extension data in `chrome://settings`.

---

## 5. Third-Party Services & Telemetry

To deliver fact-checking analysis and monitor product performance, the extension interfaces with:
* **Google Gemini API**: Processes public speech transcripts to evaluate claim veracity and cite reputable sources (e.g., NASA, Reuters, AP News, Wikipedia). No user identifiers are forwarded to Google.
* **Supadata API**: Fetches public YouTube video subtitles.
* **Google Analytics 4 (GA4)**: Anonymous, aggregated telemetry events (such as extension installs, popup views, and feature toggles) are transmitted via the official Measurement Protocol to measure product stability and adoption. No personally identifiable information (PII), browsing history outside YouTube video IDs, or user credentials are ever collected or sent.

Neither service receives personal user information or cookies.

---

## 6. Permissions Justification

* **`storage`**: Used exclusively to save UI settings and cache claim datasets locally on your device.
* **`activeTab`**: Allows interaction with the active YouTube video player DOM to synchronize warning cards with video playback.
* **`*://*.youtube.com/*`**: Limits the extension's execution exclusively to YouTube pages where fact-checking is requested.
* **`https://youtube-factcheck-api.vercel.app/*`**: Secure HTTPS endpoint for querying fact-checks for the active video ID.
* **`https://www.google-analytics.com/*`**: Secure endpoint for transmitting anonymous product telemetry without executing remote code.

---

## 7. Compliance Declarations (Chrome Web Store)

In accordance with the Google Chrome Web Store Developer Program Policies:
* We certify that we do not sell user data to third parties.
* We certify that we do not use or transfer user data for purposes unrelated to the extension's single core functionality.
* We certify that we do not use or transfer user data for creditworthiness or lending purposes.

---

## 8. Changes to This Policy

We may update this Privacy Policy to reflect improvements or regulatory requirements. Any updates will be posted to this document and the extension's public repository with an updated revision date.

---

## 9. Contact Us

If you have questions, feedback, or concerns regarding this Privacy Policy, please open an issue on our GitHub repository:
* **GitHub Repository**: [https://github.com/kadirpili/pagepulse-chrome-extension](https://github.com/kadirpili/pagepulse-chrome-extension)
