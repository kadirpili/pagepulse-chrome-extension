# Chrome Web Store Submission Guide & Metadata

Use the copy and details below when filling out your extension listing on the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

## 0. Mandatory Publisher Setup: Email Verification ⚠️

Before Google allows you to submit any extension for review, you must verify your publisher contact email address:

1. In the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), look at the left sidebar menu.
2. Click **Account** (or the **Gear ⚙️ Settings** icon at the bottom of the sidebar).
3. Under **Contact information**, locate the **Publisher email** (or **Contact email**) field.
4. Enter your email address and click **Verify email** (or **Save**).
5. Open your email inbox (check Spam/Promotions if not found immediately) and look for an email from **Google Chrome Web Store** with subject: *"Verify your contact email"*.
6. Click the verification link in the email.
7. Return to your extension draft in the Developer Dashboard and refresh the page. The warning banner will vanish, and the blue **"Submit for Review"** button will be unlocked.

---

## 1. Store Listing Information

### Extension Name (Max 45 characters)
```text
YouTube Misinformation Detector & Fact Checker
```

### Summary / Short Description (Max 132 characters)
```text
Real-time AI fact-checking for YouTube. Detects misleading claims, displays warning badges, and provides an interactive timeline.
```
*(Length: 130 / 132 characters)*

### Category
* **Primary Category**: `Productivity` *(or `News & Weather`)*
* **Language**: `English (United States)`

---

## 2. Detailed Description (Paste into the "Description" box)

```markdown
Stay informed while watching YouTube. YouTube Misinformation Detector analyzes spoken video transcripts in real-time, displaying non-intrusive warning overlays and a comprehensive timeline drawer whenever questionable or debunked factual claims are made.

Powered by Google Gemini AI, the detector flags misleading statements and provides authoritative reference sources so you can evaluate the facts for yourself without leaving the video.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⭐ KEY FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ Real-Time In-Video Warnings
As you watch a video, non-intrusive alert cards appear when misleading statements are spoken, giving you immediate context with zero interruption to your playback.

📊 Interactive Timeline Drawer
Open the collapsible side panel beside the YouTube player to browse every analyzed statement chronologically. Filter by verified facts, questionable context, or debunked claims.

🎯 Color-Coded Suspicion Indicators
• 🔴 Red Warning (Score 4–5): Flagged as false, misleading, or contradicted by scientific consensus.
• 🟡 Yellow Warning (Score 2–3): Loaded, questionable, or lacking essential context.
• 🟢 Green Badge: Verified factual claim backed by documented evidence.

🔗 Transparent Citations & Sources
Every warning card includes direct links to reputable fact-checking bodies, scientific journals, government databases (NASA, IPCC, NOAA), and encyclopedic sources.

⏭️ Click-to-Seek Navigation
Click any claim in the timeline drawer to instantly jump the video player to the exact timestamp where the statement was made.

🎨 Native Dark & Light Theme
Seamlessly integrates with YouTube's dark and light modes with smooth animations and zero screen clutter.

🔒 Privacy First
• No account or sign-in required.
• No browsing history or personal data is collected, tracked, or sold.
• Works strictly on YouTube watch pages.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 HOW TO USE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Install the extension.
2. Navigate to any YouTube video (e.g. news, documentaries, commentary).
3. The detector automatically activates and mounts a subtle status pill in the bottom-left corner.
4. Watch normally—warning cards will appear during flagged statements, or click the badge/drawer to inspect the entire timeline!

Stay one step ahead of misinformation with real-time AI fact-checking on YouTube.
```

---

## 3. Privacy Practices (Required by Chrome Web Store Review)

Google requires explicit justification for each permission requested in `manifest.json`. Copy and paste the answers below into the **Privacy** tab of the Developer Dashboard:

### Single Purpose Description
```text
Analyze spoken YouTube video transcripts in real-time to detect factual misinformation and display contextual warning overlays with citations.
```

### Standard Permissions Justifications

| Permission | Justification Copy to Paste |
| :--- | :--- |
| **`storage`** | `Used to persist user interface preferences (such as overlay display toggles, verdict filters, and drawer collapsed state) and cache retrieved claim datasets locally to prevent redundant network calls.` |
| **`activeTab`** | `Required to interact with the active YouTube video player DOM element, synchronizing timeline overlays with the video's current playback time and allowing click-to-seek timestamp navigation.` |

### Host Permissions Justifications
*(Google considers any URL match pattern in `host_permissions` and `content_scripts` as a host permission)*

| Match Pattern | Field | Justification Copy to Paste |
| :--- | :--- | :--- |
| **`*://*.youtube.com/*`** | `content_scripts` & `host_permissions` | `Required to inject the real-time fact-checking overlay banner, floating status badge, and interactive chronological claim drawer directly into YouTube watch pages, as well as synchronize timestamps with the active HTML5 video element.` |
| **`https://youtube-factcheck-api.vercel.app/*`** | `host_permissions` | `Required for the extension background service worker to send the YouTube video ID and fetch factual claim analysis and authoritative citations from our secure production fact-checking backend API powered by Gemini AI.` |

### Remote Code Declaration
When asked: *"Does your extension use remote code?"*
* **Select**: **No, I am not using remote code**
* **Verification & Technical Details**:
  - The extension is fully Manifest V3 compliant.
  - 100% of the code (JavaScript, CSS, HTML) is pre-bundled and packaged inside the `.zip` archive (`src/content-bundle.js`, `src/background.js`, `popup/popup.js`).
  - No external `<script>` tags, remote Wasm binaries, `eval()`, or `new Function()` string executions exist anywhere in the extension.
  - Network calls to `https://youtube-factcheck-api.vercel.app` only fetch structured JSON data payloads (timestamps and fact-check explanations), never executable code.

### Data Usage Declarations
When prompted on user data collection:
* **Does this extension collect user data?** -> Select **No** (The extension does not collect, transmit, or store personally identifiable information, browsing history outside YouTube video IDs, financial info, or health data).
* **Certifications**:
  - [x] *I do not sell user data to third parties.*
  - [x] *I do not use or transfer user data for purposes unrelated to the extension's core functionality.*
  - [x] *I do not use or transfer user data for creditworthiness or lending purposes.*

---

## 4. Graphic Assets Checklist

| Asset | Specifications | Status |
| :--- | :--- | :--- |
| **Store Icon** | 128 x 128 px (PNG format) | ✅ Ready at [`icons/icon128.png`](icons/icon128.png) |
| **Screenshot 1** | 1280 x 800 px (Real-time in-video overlay card) | ✅ Ready at [`screenshots/screenshot-1-overlay.png`](screenshots/screenshot-1-overlay.png) |
| **Screenshot 2** | 1280 x 800 px (Interactive timeline drawer) | ✅ Ready at [`screenshots/screenshot-2-drawer.png`](screenshots/screenshot-2-drawer.png) |
| **Screenshot 3** | 1280 x 800 px (Extension popup interface) | ✅ Ready at [`screenshots/screenshot-3-popup.png`](screenshots/screenshot-3-popup.png) |

---

## 5. Privacy Policy URLs for Chrome Web Store

Paste one of the following live URLs into the **Privacy policy** input field in the Developer Dashboard:

* **Primary Hosted URL (Recommended)**:
  ```text
  https://youtube-factcheck-api.vercel.app/privacy
  ```
* **GitHub Repository URL**:
  ```text
  https://github.com/kadirpili/pagepulse-chrome-extension/blob/main/PRIVACY_POLICY.md
  ```

---

## 6. Privacy Policy Full Text

```text
Privacy Policy for YouTube Misinformation Detector

Last updated: October 2026

1. Information We Collect
YouTube Misinformation Detector does not collect, store, or transmit any Personally Identifiable Information (PII). When you view a YouTube video, the extension retrieves the video's public ID to query factual analysis from our backend service. No personal identity, Google account details, IP addresses, or browsing activities are associated with these requests.

2. Data Storage
All user settings (such as toggle states and filters) are stored locally on your device via the Chrome Storage API and never leave your browser.

3. Third-Party Services
Fact-checking analysis queries are processed using Google Gemini models through our secure API server. No user data is provided to advertisers or third-party data brokers.

4. Contact
If you have questions regarding this privacy policy, please contact the developer via GitHub.
```
