import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

async function generateScreenshots() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

  const extStyles = await fs.readFile('src/styles.css', 'utf8');
  const popupHtml = await fs.readFile('popup/popup.html', 'utf8');
  const popupCss = await fs.readFile('popup/popup.css', 'utf8');

  // ==========================================
  // SCREENSHOT 1: Real-Time In-Video Warning Overlay
  // ==========================================
  console.log('Rendering Screenshot 1: In-Video Warning Overlay...');
  const htmlOverlay = `
    <!DOCTYPE html>
    <html lang="en" dark="true">
    <head>
      <meta charset="utf-8">
      <title>YouTube Watch Page with Warning Overlay</title>
      <style>
        ${extStyles}
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background-color: #0f0f0f;
          color: #f1f1f1;
          font-family: "Roboto", Arial, sans-serif;
          overflow: hidden;
          width: 1280px;
          height: 800px;
        }

        /* Top YouTube Navbar */
        .yt-navbar {
          height: 56px;
          background: #0f0f0f;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          border-bottom: 1px solid #272727;
        }
        .yt-logo {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 700;
          font-size: 19px;
          letter-spacing: -0.5px;
        }
        .yt-logo-badge {
          background: #ff0000;
          color: #fff;
          font-size: 12px;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .yt-search-box {
          background: #121212;
          border: 1px solid #303030;
          border-radius: 20px;
          width: 480px;
          padding: 8px 16px;
          color: #aaa;
          font-size: 14px;
        }

        /* Main Container */
        .yt-content {
          display: flex;
          padding: 24px;
          gap: 24px;
          height: calc(800px - 56px);
        }
        .yt-primary {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        /* Video Player */
        .yt-player {
          width: 100%;
          height: 480px;
          background: linear-gradient(135deg, #1e1e24 0%, #0d0d11 100%);
          border-radius: 12px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.7);
        }
        .yt-video-visual {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #666;
        }
        .yt-video-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 48px;
          background: linear-gradient(to top, rgba(0,0,0,0.85), transparent);
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 16px;
        }
        .yt-playhead {
          position: absolute;
          top: 0;
          left: 0;
          height: 3px;
          width: 42%;
          background: #ff0000;
        }

        /* Video Info Header */
        .yt-video-info {
          margin-top: 16px;
        }
        .yt-video-title {
          font-size: 20px;
          font-weight: 600;
          line-height: 1.3;
          margin-bottom: 8px;
        }
        .yt-video-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #aaa;
          font-size: 14px;
        }

        /* Right Sidebar Recommended Videos */
        .yt-secondary {
          width: 380px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .yt-rec-card {
          display: flex;
          gap: 12px;
        }
        .yt-rec-thumb {
          width: 140px;
          height: 78px;
          background: #272727;
          border-radius: 8px;
          flex-shrink: 0;
        }
        .yt-rec-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 13px;
        }
      </style>
    </head>
    <body>
      <div class="yt-navbar">
        <div class="yt-logo">
          <span style="color:#ff0000; font-size:24px;">▶</span> YouTube
        </div>
        <div class="yt-search-box">Search climate change documentary...</div>
        <div style="width: 32px; height: 32px; border-radius: 50%; background: #4f46e5;"></div>
      </div>

      <div class="yt-content">
        <div class="yt-primary">
          <div class="yt-player" id="player-container">
            <div class="yt-video-visual">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="#333">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <p style="margin-top:12px; font-size:14px; color:#555;">Documentary Playback - 02:48 / 05:12</p>
            </div>

            <!-- In-Video Warning Overlay Card -->
            <div class="yt-misinfo-overlay" style="display:flex;">
              <div class="yt-misinfo-card">
                <div class="yt-misinfo-header">
                  <div class="yt-misinfo-badge is-misinformation">
                    <span>⚠️</span>
                    <span>MISINFORMATION DETECTED &bull; SCORE 3.5 / 5.0</span>
                  </div>
                  <button class="yt-misinfo-dismiss">&times;</button>
                </div>
                <div class="yt-misinfo-claim">
                  &ldquo;The IPCC acknowledged in its own 2007 report that 'The long-term prediction of future climate states is not possible.'&rdquo;
                </div>
                <div class="yt-misinfo-explanation">
                  The quoted passage appeared in the 2001 Third Assessment Report (not 2007) discussing daily weather determinism vs climate projections. The IPCC reliably projects statistical probability distributions of future climate states decades ahead.
                </div>
                <div class="yt-misinfo-sources">
                  <span class="yt-misinfo-sources-label">Verified Sources:</span>
                  <a href="#" class="yt-misinfo-source-link">NASA Global Climate Change</a>
                  <a href="#" class="yt-misinfo-source-link">IPCC 6th Assessment Report (AR6 WG1)</a>
                  <a href="#" class="yt-misinfo-source-link">Skeptical Science Consensus</a>
                </div>
              </div>
            </div>

            <!-- YouTube Player Controls Bar -->
            <div class="yt-video-bar">
              <div class="yt-playhead"></div>
              <span style="font-size:13px; color:#fff;">▶ 02:48 / 05:12 &bull; HD</span>
            </div>
          </div>

          <div class="yt-video-info">
            <h1 class="yt-video-title">Climate Modeling: Historical Consensus and Global Observations</h1>
            <div class="yt-video-meta">
              <span>Scientific Review &bull; 1.4M views &bull; Fact-Checked with Gemini 3.5 AI</span>
              <span style="background:#272727; padding:6px 12px; border-radius:18px; color:#fff;">👍 84K &bull; Share</span>
            </div>
          </div>
        </div>

        <div class="yt-secondary">
          <div style="font-size:15px; font-weight:600; margin-bottom:4px;">Up next</div>
          <div class="yt-rec-card">
            <div class="yt-rec-thumb"></div>
            <div class="yt-rec-info">
              <b>Earth's Atmospheric Trends Explained</b>
              <span style="color:#aaa;">Atmospheric Institute</span>
              <span style="color:#aaa;">420K views &bull; 3 months ago</span>
            </div>
          </div>
          <div class="yt-rec-card">
            <div class="yt-rec-thumb"></div>
            <div class="yt-rec-info">
              <b>How Climate Models Simulate Centuries Ahead</b>
              <span style="color:#aaa;">Science Decoded</span>
              <span style="color:#aaa;">1.1M views &bull; 1 year ago</span>
            </div>
          </div>
          <div class="yt-rec-card">
            <div class="yt-rec-thumb"></div>
            <div class="yt-rec-info">
              <b>Evaluating Consensus in Scientific Literature</b>
              <span style="color:#aaa;">Data & Research</span>
              <span style="color:#aaa;">180K views &bull; 5 months ago</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Floating Detector Status Badge -->
      <div id="yt-misinfo-status-badge" style="
        position: fixed;
        bottom: 24px;
        left: 24px;
        z-index: 999999;
        background: #0f0f0f;
        color: #fff;
        border: 1px solid #52c41a;
        border-radius: 20px;
        padding: 8px 16px;
        font-family: Roboto, Arial, sans-serif;
        font-size: 13px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.6);
      ">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#52c41a;box-shadow:0 0 8px #52c41a;"></span>
        <span>🛡️ Misinfo Detector Active [PROD] (5 claims detected)</span>
      </div>
    </body>
    </html>
  `;

  await page.setContent(htmlOverlay);
  await page.screenshot({ path: 'screenshots/screenshot-1-overlay.png' });
  console.log('Saved screenshots/screenshot-1-overlay.png');

  // ==========================================
  // SCREENSHOT 2: Interactive Timeline Drawer
  // ==========================================
  console.log('Rendering Screenshot 2: Interactive Timeline Drawer...');
  const htmlDrawer = `
    <!DOCTYPE html>
    <html lang="en" dark="true">
    <head>
      <meta charset="utf-8">
      <title>YouTube Watch Page with Timeline Drawer</title>
      <style>
        ${extStyles}
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background-color: #0f0f0f;
          color: #f1f1f1;
          font-family: "Roboto", Arial, sans-serif;
          overflow: hidden;
          width: 1280px;
          height: 800px;
        }
        .yt-navbar {
          height: 56px;
          background: #0f0f0f;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          border-bottom: 1px solid #272727;
        }
        .yt-logo {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 700;
          font-size: 19px;
        }
        .yt-search-box {
          background: #121212;
          border: 1px solid #303030;
          border-radius: 20px;
          width: 480px;
          padding: 8px 16px;
          color: #aaa;
          font-size: 14px;
        }
        .yt-content {
          display: flex;
          padding: 24px;
          gap: 24px;
          height: calc(800px - 56px);
        }
        .yt-primary {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .yt-player {
          width: 100%;
          height: 500px;
          background: linear-gradient(135deg, #1e1e24 0%, #0d0d11 100%);
          border-radius: 12px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        /* Custom side placement for screenshot */
        .yt-misinfo-drawer {
          position: relative !important;
          width: 420px !important;
          height: 100% !important;
          box-shadow: -4px 0 24px rgba(0,0,0,0.8);
          border-radius: 12px;
        }
      </style>
    </head>
    <body>
      <div class="yt-navbar">
        <div class="yt-logo">
          <span style="color:#ff0000; font-size:24px;">▶</span> YouTube
        </div>
        <div class="yt-search-box">Fact-checking in progress...</div>
        <div style="width: 32px; height: 32px; border-radius: 50%; background: #4f46e5;"></div>
      </div>

      <div class="yt-content">
        <div class="yt-primary">
          <div class="yt-player">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="#333">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <span style="position:absolute; bottom:16px; left:16px; font-size:13px; color:#aaa;">02:48 / 05:12</span>
          </div>

          <div style="margin-top:16px;">
            <h1 style="font-size:20px; font-weight:600;">The Science of Climate Change: Fact-Checking Common Claims</h1>
            <p style="color:#aaa; font-size:14px; margin-top:4px;">Analysis powered by Gemini 3.5 Flash Lite &bull; 5 total claims identified</p>
          </div>
        </div>

        <!-- Embedded Full Timeline Drawer -->
        <div class="yt-misinfo-drawer" id="drawer-container">
          <div class="yt-misinfo-drawer-header">
            <div class="yt-misinfo-drawer-title">
              <span>🛡️ Fact-Check Timeline</span>
              <span class="yt-misinfo-mode-badge is-prod">PROD</span>
            </div>
            <button class="yt-misinfo-drawer-close">&times;</button>
          </div>

          <div class="yt-misinfo-filter-bar">
            <button class="yt-misinfo-filter-btn is-active">All (5)</button>
            <button class="yt-misinfo-filter-btn">Misinfo (3)</button>
            <button class="yt-misinfo-filter-btn">Questionable (1)</button>
            <button class="yt-misinfo-filter-btn">Verified (1)</button>
          </div>

          <div class="yt-misinfo-claims-list">
            <!-- Claim 1 -->
            <div class="yt-misinfo-claim-card" style="margin-bottom:12px;">
              <div class="yt-misinfo-card-header">
                <span class="yt-misinfo-badge is-misinformation">Score 3.5 &bull; False</span>
                <span class="yt-misinfo-timestamp">⏱ 00:02</span>
              </div>
              <div class="yt-misinfo-card-sentence">
                &ldquo;For 30 years I taught at MIT, during which time the climate has changed remarkably little.&rdquo;
              </div>
              <div class="yt-misinfo-card-explanation">
                Empirical surface temperature datasets from NASA and NOAA document that global mean temperatures increased by over 0.6°C during this period.
              </div>
              <div class="yt-misinfo-card-sources">
                <a href="#" class="yt-misinfo-source-link">climate.nasa.gov</a>
              </div>
            </div>

            <!-- Claim 2 (Active/Current) -->
            <div class="yt-misinfo-claim-card is-active" style="margin-bottom:12px; border-color:#faad14;">
              <div class="yt-misinfo-card-header">
                <span class="yt-misinfo-badge is-yellow" style="background:#faad14; color:#000;">Score 2.5 &bull; Questionable</span>
                <span class="yt-misinfo-timestamp" style="color:#faad14;">⏱ 01:41 (Active)</span>
              </div>
              <div class="yt-misinfo-card-sentence">
                &ldquo;None of these is fully understood, and there is no evidence that CO2 emissions are the dominant factor.&rdquo;
              </div>
              <div class="yt-misinfo-card-explanation">
                Multiple radiative forcing studies and IPCC assessments establish human greenhouse emissions as the primary driver of warming.
              </div>
              <div class="yt-misinfo-card-sources">
                <a href="#" class="yt-misinfo-source-link">ipcc.ch/report/ar6</a>
              </div>
            </div>

            <!-- Claim 3 -->
            <div class="yt-misinfo-claim-card" style="margin-bottom:12px;">
              <div class="yt-misinfo-card-header">
                <span class="yt-misinfo-badge is-misinformation">Score 3.0 &bull; False</span>
                <span class="yt-misinfo-timestamp">⏱ 02:48</span>
              </div>
              <div class="yt-misinfo-card-sentence">
                &ldquo;The IPCC acknowledged in its own 2007 report that 'The long-term prediction of future climate states is not possible.'&rdquo;
              </div>
              <div class="yt-misinfo-card-explanation">
                Out-of-context excerpt distinguishing local day-to-day weather prediction from forced long-term climate projections.
              </div>
              <div class="yt-misinfo-card-sources">
                <a href="#" class="yt-misinfo-source-link">ipcc.ch</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await page.setContent(htmlDrawer);
  await page.screenshot({ path: 'screenshots/screenshot-2-drawer.png' });
  console.log('Saved screenshots/screenshot-2-drawer.png');

  // ==========================================
  // SCREENSHOT 3: Extension Popup & Controls
  // ==========================================
  console.log('Rendering Screenshot 3: Extension Popup Interface...');
  const htmlPopupShowcase = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Popup Interface Showcase</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: radial-gradient(circle at 50% 30%, #1e1b4b 0%, #0f172a 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1280px;
          height: 800px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #f1f5f9;
        }

        .showcase-container {
          display: flex;
          align-items: center;
          gap: 64px;
          max-width: 1040px;
        }

        .showcase-text {
          flex: 1;
        }
        .showcase-title {
          font-size: 40px;
          font-weight: 800;
          line-height: 1.2;
          background: linear-gradient(135deg, #ffffff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 16px;
        }
        .showcase-subtitle {
          font-size: 18px;
          color: #94a3b8;
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .showcase-features {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .showcase-features li {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 15px;
          color: #cbd5e1;
        }
        .showcase-features li span {
          color: #38bdf8;
          font-weight: bold;
        }

        /* The Actual Extension Popup Frame */
        .popup-frame {
          width: 360px;
          background: #0f0f0f;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1);
        }

        ${popupCss}
      </style>
    </head>
    <body>
      <div class="showcase-container">
        <div class="showcase-text">
          <div style="display:inline-flex; align-items:center; gap:8px; background:rgba(56, 189, 248, 0.1); border:1px solid rgba(56, 189, 248, 0.3); padding:6px 14px; border-radius:20px; font-size:13px; color:#38bdf8; font-weight:600; margin-bottom:20px;">
            <span>⚡ POWERED BY GEMINI 3.5 AI</span>
          </div>
          <h1 class="showcase-title">Real-Time Verification Right in Your Browser</h1>
          <p class="showcase-subtitle">
            Configure detector sensitivity, filter by factual verdict, and view instant summary statistics for any YouTube video.
          </p>
          <ul class="showcase-features">
            <li><span>✓</span> Instant claim extraction and sentence breakdown</li>
            <li><span>✓</span> Seamless switching between Live AI and Mock mode</li>
            <li><span>✓</span> Fully private, zero-tracking architecture</li>
          </ul>
        </div>

        <div class="popup-frame">
          ${popupHtml}
        </div>
      </div>
    </body>
    </html>
  `;

  await page.setContent(htmlPopupShowcase);
  await page.screenshot({ path: 'screenshots/screenshot-3-popup.png' });
  console.log('Saved screenshots/screenshot-3-popup.png');

  await browser.close();
  console.log('All 3 Chrome Web Store screenshots generated successfully in 1280x800!');
}

generateScreenshots().catch(console.error);
