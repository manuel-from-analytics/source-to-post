"""E2E: login -> /dashboard on iPhone/Safari and inside the embedded preview iframe.

Run:  python3 e2e/auth_dashboard_e2e.py [base_url]

Scenarios
  1. iPhone 13 (WebKit/Safari) direct navigation
  2. Same viewport, app loaded inside an iframe (Lovable embedded preview)

Each scenario:
  - loads the app and asserts the auth screen renders (no error banner)
  - if a Supabase session is available in the environment
    (LOVABLE_BROWSER_SUPABASE_STORAGE_KEY + _SESSION_JSON, optional _COOKIES_JSON),
    it restores it and asserts the app lands on /dashboard authenticated
  - otherwise it drives the Google button and asserts the OAuth flow starts
    (accounts.google.com) without the app showing a session error
Screenshots are written to e2e/screenshots/.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080").rstrip("/")
SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)

ERROR_TEXTS = [
    "No se pudo confirmar la sesión",
    "Could not confirm the session",
    "Something went wrong",
]

STORAGE_KEY = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
SESSION_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
COOKIES_JSON = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
HAS_SESSION = bool(STORAGE_KEY and SESSION_JSON)

results = []


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + ((" — " + detail) if detail else ""))


async def restore_session(context, page):
    if COOKIES_JSON:
        cookies = json.loads(COOKIES_JSON)
        for c in cookies:
            c["url"] = BASE_URL
        await context.add_cookies(cookies)
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(STORAGE_KEY)}, {json.dumps(SESSION_JSON)})"
    )


async def assert_no_error(page, label):
    body = await page.inner_text("body")
    hit = next((t for t in ERROR_TEXTS if t.lower() in body.lower()), None)
    record(f"{label}: no session-error banner", hit is None, hit or "")


async def check_dashboard(page, label):
    try:
        await page.wait_for_url("**/dashboard", timeout=20000)
        record(f"{label}: reached /dashboard", True, page.url)
    except Exception:
        record(f"{label}: reached /dashboard", False, f"stuck at {page.url}")


async def check_google_flow(page, label):
    button = page.get_by_role("button", name="Google")
    try:
        await button.first.wait_for(timeout=15000)
    except Exception:
        record(f"{label}: Google sign-in button visible", False, "button not found")
        return
    record(f"{label}: Google sign-in button visible", True)

    popup = None
    try:
        async with page.context.expect_page(timeout=8000) as info:
            await button.first.click()
        popup = await info.value
        await popup.wait_for_load_state("domcontentloaded")
        target = popup.url
    except Exception:
        await page.wait_for_timeout(4000)
        target = page.url
    ok = any(
        m in target
        for m in ("accounts.google.com", "supabase.co/auth", "/~oauth/initiate")
    )
    record(f"{label}: OAuth flow starts", ok, target)
    if popup:
        await popup.close()


async def scenario_iphone(pw):
    label = "iPhone/Safari"
    device = pw.devices["iPhone 13"]
    browser = await pw.webkit.launch(headless=True)
    context = await browser.new_context(**device)
    page = await context.new_page()
    if HAS_SESSION:
        await restore_session(context, page)
        await page.goto(f"{BASE_URL}/dashboard", wait_until="domcontentloaded")
        await check_dashboard(page, label)
    else:
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        await check_google_flow(page, label)
    await assert_no_error(page, label)
    await page.screenshot(path=str(SHOTS / "iphone_safari.png"))
    await browser.close()


async def scenario_embedded(pw):
    label = "Embedded preview"
    browser = await pw.chromium.launch(headless=True)
    context = await browser.new_context(
        viewport={"width": 402, "height": 725},
        user_agent=(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        ),
        is_mobile=True,
        has_touch=True,
    )
    page = await context.new_page()
    if HAS_SESSION:
        await restore_session(context, page)
    await page.set_content(
        f'<html><body style="margin:0">'
        f'<iframe src="{BASE_URL}/dashboard" style="width:402px;height:725px;border:0"></iframe>'
        f"</body></html>",
        wait_until="domcontentloaded",
    )
    await page.wait_for_timeout(4000)
    frame = next((f for f in page.frames if BASE_URL in f.url), None)
    if frame is None:
        record(f"{label}: app frame loaded", False, "iframe not loaded")
    else:
        record(f"{label}: app frame loaded", True, frame.url)
        if HAS_SESSION:
            ok = "/dashboard" in frame.url
            record(f"{label}: reached /dashboard", ok, frame.url)
        else:
            body = await frame.inner_text("body")
            has_login = "Google" in body
            record(f"{label}: auth screen rendered in iframe", has_login, frame.url)
        frame_body = (await frame.inner_text("body")).lower()
        hit = next((t for t in ERROR_TEXTS if t.lower() in frame_body), None)
        record(f"{label}: no session-error banner", hit is None, hit or "")
    await page.screenshot(path=str(SHOTS / "embedded_preview.png"))
    await browser.close()


async def main():
    print(f"Base URL: {BASE_URL}")
    print("Session injected: " + ("yes" if HAS_SESSION else "no (OAuth-start assertions only)"))
    async with async_playwright() as pw:
        await scenario_iphone(pw)
        await scenario_embedded(pw)
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    sys.exit(1 if failed else 0)


asyncio.run(main())
