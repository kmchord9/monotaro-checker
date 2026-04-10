/**
 * 定数・設定
 */
const THRESHOLD_PRICE = 3500;
const TAX_RATE = 0.1;

/**
 * 消費税小数点第一位判定 (3,916円等で不一致を防ぐ整数計算ロジック)
 */
function checkTaxDecimal(subtotal) {
    const subtotalInt = Math.round(subtotal);
    const taxRateInt = 10; // 0.1 * 100 / 10
    const taxAmountX10 = (subtotalInt * taxRateInt) / 10; 
    const firstDecimalDigit = Math.floor(taxAmountX10) % 10;
    
    // 0〜4の範囲(切り捨て/四捨五入が一致)ならtrue
    return firstDecimalDigit >= 0 && firstDecimalDigit <= 4;
}

/**
 * ページ判定ロジック (URL消失・パフォーマンス対策)
 */
function getPageType() {
    const url = window.location.href;
    const params = new URLSearchParams(window.location.search);
    const func = params.get('func');

    try {
        if (func === "monotaro.basket.showListServlet.ShowListServlet") {
            sessionStorage.setItem('monotaro_page_state', 'basket');
            return 'basket';
        }
        if (func === "monotaro.checkout.confirm.show_init_edit_servlet.ShowInitEditServlet") {
            sessionStorage.setItem('monotaro_page_state', 'confirm');
            return 'confirm';
        }
        if (url.includes("/basket/estimate/print")) {
            return 'quote';
        }
        if (url.endsWith("monotaroMain.py")) {
            return sessionStorage.getItem('monotaro_page_state') || 'unknown';
        }
        sessionStorage.removeItem('monotaro_page_state');
    } catch (e) {
        console.error("Storage access error:", e);
    }
    return 'unknown';
}

/**
 * ユーティリティ
 */
function parsePrice(text) {
    if (!text) return 0;
    return parseInt(text.replace(/[^0-9]/g, ""), 10) || 0;
}

function applyRestriction(element, message) {
    if (!element) return;
    element.style.opacity = "0.5";
    element.style.pointerEvents = "none";
    const msgId = "ext-warning-" + (element.id || "btn");
    if (!document.getElementById(msgId)) {
        const warn = document.createElement("div");
        warn.id = msgId;
        warn.innerText = message;
        warn.className = "ext-alert-msg";
        warn.style = "color:red; font-size:12px; font-weight:bold; margin-top:5px; background:#fff5f5; padding:4px; border:1px solid red; display:inline-block;";
        element.parentNode.insertBefore(warn, element.nextSibling);
    }
}

function clearWarnings(elements) {
    elements.forEach(el => {
        if (!el) return;
        const msg = document.getElementById("ext-warning-" + (el.id || "btn"));
        if (msg) msg.remove();
        el.style.opacity = "1.0";
        el.style.pointerEvents = "auto";
    });
}

/**
 * 各ページの個別処理
 */

// ページA: バスケット
function processPageA() {
    const priceElement = document.querySelector(".NextStepPriceValue .Price");
    if (!priceElement) return;

    const subtotal = parsePrice(priceElement.textContent);
    const registerBtn = document.querySelector(".Button--NextStepLogin");
    const estimateBtn = document.getElementById("estimate");

    clearWarnings([registerBtn, estimateBtn]);

    if (subtotal < THRESHOLD_PRICE) {
        applyRestriction(registerBtn, `小計が￥${THRESHOLD_PRICE}未満のため購入できません`);
        applyRestriction(estimateBtn, `￥${THRESHOLD_PRICE}未満は見積不可`);
    } else if (!checkTaxDecimal(subtotal)) {
        applyRestriction(registerBtn, "税計算不一致リスクのため購入できません");
        applyRestriction(estimateBtn, "税計算不一致リスクのため見積できません");
    }
}

// ページB: 注文確認
function processPageB() {
    const codePart = document.querySelector('tr[data-analytics-tag="code_part"]');
    if (codePart) codePart.style.display = "none";

    const payMethods = document.querySelectorAll('.pay_method');
    let hasBankTransfer = false;
    let bankInput = null;

    payMethods.forEach(input => {
        const labelText = input.closest('label')?.textContent || "";
        if (input.value === "1" && labelText.includes("都度払い")) {
            hasBankTransfer = true;
            bankInput = input;
        } else {
            const li = input.closest('li');
            if (li) li.style.display = "none";
        }
    });

    if (hasBankTransfer && !bankInput.checked) bankInput.click();

    const subTotalEl = document.getElementById("checkoutNext__rg_sub_total_span");
    const freightEl = document.getElementById("checkoutNext__rg_d_charge");
    const btns = [document.getElementById("checkoutNext__order_submit"), document.getElementById("order_submit")];

    if (subTotalEl && freightEl) {
        const subtotal = parsePrice(subTotalEl.textContent);
        const freight = parsePrice(freightEl.textContent);

        btns.forEach(btn => {
            if (!btn) return;
            clearWarnings([btn]);

            if (!hasBankTransfer) {
                applyRestriction(btn, "【重要】お支払方法を「都度払い」に設定してください。");
            } else if (subtotal < THRESHOLD_PRICE) {
                applyRestriction(btn, `小計が￥${THRESHOLD_PRICE}未満のため確定できません`);
            } else if (!checkTaxDecimal(subtotal)) {
                applyRestriction(btn, "税計算不一致リスクのため確定できません");
            } else if (freight > 0) {
                const note = document.createElement("div");
                note.id = "ext-warning-" + btn.id;
                note.innerText = "※配送料が発生しているので事務担当者に連絡した上で注文してください";
                note.style = "color:#d93025; font-size:14px; font-weight:bold; margin-top:8px; padding:8px; border:2px solid #d93025; background:#fff5f5; display:inline-block;";
                btn.parentNode.insertBefore(note, btn.nextSibling);
            }
        });
    }
}

// ページC: 見積書
function processPageC() {
    const kakakuArea = document.querySelector(".kakaku");
    if (!kakakuArea) return;
    const subtotal = parsePrice(kakakuArea.firstChild.textContent);

    if (subtotal >= THRESHOLD_PRICE && checkTaxDecimal(subtotal)) {
        if (!document.getElementById("custom-print-btn")) {
            const style = document.createElement("style");
            style.innerHTML = "@media print { #custom-print-btn { display: none !important; } }";
            document.head.appendChild(style);

            const printBtn = document.createElement("button");
            printBtn.id = "custom-print-btn";
            printBtn.innerText = "印刷する";
            printBtn.style = "display:block; margin:10px auto 20px auto; padding:12px 30px; background:#0078d4; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:18px;";
            printBtn.onclick = () => window.print();
            const mainTable = document.querySelector("div[align='center'] > table");
            if (mainTable) mainTable.parentNode.insertBefore(printBtn, mainTable);
        }
    } else {
        if (!document.getElementById("ext-err-quote")) {
            const err = document.createElement("div");
            err.id = "ext-err-quote";
            err.style = "color:red; font-weight:bold; padding:15px; border:2px solid red; margin:20px auto; width:660px; text-align:center; background:#fff5f5;";
            err.innerText = "【警告】金額不足または税不一致のため、この見積書は使用できません。";
            const mainTable = document.querySelector("div[align='center'] > table");
            if (mainTable) mainTable.parentNode.insertBefore(err, mainTable);
        }
    }
}

/**
 * 実行コントロール
 */
function validate() {
    const type = getPageType();
    if (type === 'basket') processPageA();
    else if (type === 'confirm') processPageB();
    else if (type === 'quote') processPageC();
}

// 初回実行
validate();

// 数量変更(Ajax)などの操作を考慮し、クリック時に再評価
document.addEventListener('click', () => setTimeout(validate, 800), true);