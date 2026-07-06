"""
像素表情包工厂 v3 - 自动化测试 (配件版)
"""
from playwright.sync_api import sync_playwright
import sys, os, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HTML_PATH = r"e:\vs code\像素小人\index.html"
FILE_URL = "file:///" + HTML_PATH.replace("\\", "/") if os.name == 'nt' else "file://" + HTML_PATH

print(f"URL: {FILE_URL}")

failures = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 900}, bypass_csp=True)
    page = context.new_page()

    page.on("pageerror", lambda err: failures.append(f"PAGE_ERROR: {err}"))
    console_msgs = []
    page.on("console", lambda msg: console_msgs.append(msg))

    # 1. Load page
    print("\n=== 1. Page Load ===")
    try:
        page.goto(FILE_URL, wait_until="networkidle", timeout=15000)
        page.wait_for_timeout(1000)
        print(f"Title: {page.title()}")
    except Exception as e:
        failures.append(f"Load: {e}")
        browser.close()
        sys.exit(1)

    page.screenshot(path="/tmp/test_home.png", full_page=True)

    # 2. Steps
    print("\n=== 2. Steps ===")
    steps = page.locator(".step-indicator .step").count()
    print(f"Steps: {steps}")
    if steps != 4: failures.append(f"Expected 4 steps, got {steps}")

    # 3. Step guard
    print("\n=== 3. Step Guard ===")
    page.locator("#nextBtn").click()
    page.wait_for_timeout(400)
    active = page.locator(".step-indicator .step.active .step-num").inner_text()
    print(f"Guard active step: {active}")
    if active != "01": failures.append("Step guard failed")

    # 4. Upload + API
    print("\n=== 4. Upload + API ===")
    for sel in ["#uploadZone", "#selectFileBtn", ".api-key-section", "#apiKeyInput"]:
        ok = page.locator(sel).count() > 0
        if not ok: failures.append(f"Missing: {sel}")
    key = page.evaluate("() => window.getSeedreamApiKey()")
    print(f"API Key: {'OK' if key else 'MISSING'}")

    # 5. Prompt templates
    print("\n=== 5. Prompt Templates ===")
    tpl_count = page.evaluate("() => document.querySelectorAll('#promptTemplateGrid .prompt-card').length")
    print(f"Templates: {tpl_count}")
    if tpl_count != 12: failures.append(f"Templates: {tpl_count}")

    prompt_len = page.evaluate("() => document.querySelector('#promptTextarea').value.length")
    print(f"Default prompt: {prompt_len} chars")
    if prompt_len == 0: failures.append("Empty prompt")

    # Switch template
    page.evaluate("() => document.querySelectorAll('#promptTemplateGrid .prompt-card')[1].click()")
    page.wait_for_timeout(300)
    active = page.evaluate("() => document.querySelectorAll('#promptTemplateGrid .prompt-card')[1].classList.contains('active')")
    print(f"Template switch: {'OK' if active else 'FAIL'}")
    if not active: failures.append("Template switch")
    page.evaluate("() => document.querySelectorAll('#promptTemplateGrid .prompt-card')[0].click()")

    # 6. Step 3 elements
    print("\n=== 6. Step 3 (Generate) ===")
    for sel in ["#generateBtn", "#downloadPngBtn", "#pixelCanvas"]:
        ok = page.locator(sel).count() > 0
        if not ok: failures.append(f"Missing step3: {sel}")
    # Check default size is 2K
    size_2k = page.evaluate("() => document.querySelector('input[name=\"outputSize\"][value=\"2K\"]').checked")
    print(f"Default size 2K: {size_2k}")
    if not size_2k: failures.append("Default size should be 2K")
    print("Step 3: OK")

    # 7. Step 4 - Accessories
    print("\n=== 7. Step 4 (Accessories) ===")
    for sel in ["#accCanvas", "#accGrid", "#accCategories", "#removeAccBtn", "#clearAccBtn", "#downloadAccBtn"]:
        ok = page.locator(sel).count() > 0
        if not ok: failures.append(f"Missing acc: {sel}")
    print("Accessory elements: OK")

    # Check category buttons (won't be populated until step 4 is entered, but containers exist)
    cat_container = page.locator("#accCategories").count() > 0
    print(f"Categories container: {'OK' if cat_container else 'MISSING'}")

    # Check accessories data is loaded (JS level)
    acc_total = page.evaluate("() => window.ACCESSORIES.length")
    cat_total = page.evaluate("() => window.ACCESSORY_CATEGORIES.length")
    print(f"Total accessories: {acc_total}, Categories: {cat_total}")
    if acc_total < 120: failures.append(f"Accessory count: {acc_total} (< 120)")
    if cat_total != 6: failures.append(f"Categories: expected 6, got {cat_total}")

    # Check accessory rendering works
    render_ok = page.evaluate("() => { const a = window.ACCESSORIES[0]; const c = window.renderAccessoryToCanvas(a, 2, true); return c.width > 0 && c.height > 0; }")
    print(f"Accessory render: {'OK' if render_ok else 'FAIL'}")
    if not render_ok: failures.append("Accessory rendering failed")

    # Check acc grid container exists
    grid_container = page.locator("#accGrid").count() > 0
    print(f"Acc grid container: {'OK' if grid_container else 'MISSING'}")

    # 8. JS modules
    print("\n=== 8. JS Modules ===")
    checks = [
        ("seedream-api", "typeof window.getSeedreamApiKey === 'function'"),
        ("seedream-api", "typeof window.generatePixelArt === 'function'"),
        ("prompt-templates", "Array.isArray(window.PROMPT_TEMPLATES) && window.PROMPT_TEMPLATES.length === 12"),
        ("prompt-templates", "typeof window.countPromptChars === 'function'"),
        ("accessories", "Array.isArray(window.ACCESSORIES) && window.ACCESSORIES.length >= 120"),
        ("accessories", "typeof window.renderAccessoryToCanvas === 'function'"),
        ("accessories", "typeof window.AccessoryManager === 'object'"),
        ("accessories", "typeof window.getAccessoriesByCategory === 'function'"),
        ("accessories", "Array.isArray(window.ACCESSORY_CATEGORIES) && window.ACCESSORY_CATEGORIES.length === 6"),
        ("app", "window.AppState && window.AppState.outputSize === '2K'"),
        ("app", "window.StepManager && typeof window.StepManager.goToStep === 'function'"),
    ]
    for src, expr in checks:
        result = page.evaluate(f"() => ({expr})")
        status = "OK" if result else "FAIL"
        if not result: failures.append(f"{src}: {expr}")
        print(f"  {src}: {status}")

    # 9. countPromptChars
    print("\n=== 9. countPromptChars ===")
    cnt = page.evaluate("() => window.countPromptChars('你好 test 123')")
    print(f"  '你好 test 123' -> {cnt}")
    if cnt != 9: failures.append(f"countPromptChars: {cnt}")

    # 10. Accessory Manager API
    print("\n=== 10. AccessoryManager ===")
    mgr = page.evaluate("() => typeof window.AccessoryManager === 'object' && window.AccessoryManager !== null")
    has_add = page.evaluate("() => typeof window.AccessoryManager.add === 'function'")
    has_remove = page.evaluate("() => typeof window.AccessoryManager.remove === 'function'")
    has_clear = page.evaluate("() => typeof window.AccessoryManager.clear === 'function'")
    has_composite = page.evaluate("() => typeof window.AccessoryManager.composite === 'function'")
    print(f"Manager: object={mgr}, add={has_add}, remove={has_remove}, clear={has_clear}, composite={has_composite}")
    if not all([mgr, has_add, has_remove, has_clear, has_composite]):
        failures.append("AccessoryManager API incomplete")

    # 11. Panels
    print("\n=== 11. Panels ===")
    for i in range(1, 5):
        ok = page.locator(f"#panel-step{i}").count() > 0
        if not ok: failures.append(f"Panel {i} missing")

    # 12. Console errors
    console_errors = [m for m in console_msgs if m.type == "error"]
    if console_errors:
        print(f"\n=== Console Errors ({len(console_errors)}) ===")
        for e in console_errors[:10]:
            print(f"  {e.text[:150]}")

    page.screenshot(path="/tmp/test_final.png", full_page=True)
    browser.close()

# Report
print("\n" + "=" * 50)
if failures:
    print(f"FAILURES: {len(failures)}")
    for f in failures:
        print(f"  - {f}")
else:
    print("ALL TESTS PASSED!")
print(f"Total: {len(failures)} failures")
sys.exit(0 if not failures else 1)
