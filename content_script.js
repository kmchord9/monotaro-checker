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
    element.disabled = true;
    element.classList.add("is-Disabled");

    // サイトの仕様に合わせたスタイル適用
    element.style.color = "#999";
    element.style.backgroundColor = "#fff";
    element.style.border = "1px solid #ccc";
    element.style.boxShadow = "none";
    element.style.opacity = "0.5";
    element.style.pointerEvents = "none";

    const identifier = element.id || element.className.split(' ').join('-');
    const msgId = "ext-warning-" + identifier;

    let warn = document.getElementById(msgId);
    if (!warn) {
        warn = document.createElement("div");
        warn.id = msgId;
        warn.className = "ext-alert-msg";
        warn.style = "color:red; font-size:12px; font-weight:bold; margin-top:5px; background:#fff5f5; padding:4px; border:1px solid red; display:inline-block;";
        element.parentNode.insertBefore(warn, element.nextSibling);
    }
    warn.innerText = message;
}

function clearWarnings(elements) {
    elements.forEach(el => {
        if (!el) return;
        const identifier = el.id || el.className.split(' ').join('-');
        const msg = document.getElementById("ext-warning-" + identifier);
        if (msg) msg.remove();

        el.disabled = false;
        el.classList.remove("is-Disabled");

        // スタイルを元に戻す
        el.style.color = "";
        el.style.backgroundColor = "";
        el.style.border = "";
        el.style.boxShadow = "";
        el.style.opacity = "1.0";
        el.style.pointerEvents = "auto";
    });
}

let isPanicMode = false;

/**
 * ページ全体をロックする (ボタン欠損などの異常事態)
 */
function triggerPanicMode(message, title = "【システムエラー】") {
    if (isPanicMode) return;
    isPanicMode = true;

    document.body.innerHTML = `
        <div style="padding: 50px; text-align: center; font-family: sans-serif;">
            <div style="background: #fff5f5; border: 2px solid red; padding: 30px; border-radius: 8px; display: inline-block;">
                <h1 style="color: red; margin-bottom: 20px;">${title}</h1>
                <p style="font-size: 18px; font-weight: bold; margin-bottom: 20px; white-space: pre-wrap;">${message}</p>
                ${title === "【システムエラー】" ? '<p style="margin-bottom: 30px;">サイトの仕様が変更された可能性があります。管理者に連絡してください。</p>' : ''}
                <button onclick="window.history.back()" style="padding: 10px 30px; font-size: 16px; cursor: pointer; background: #333; color: #fff; border: none; border-radius: 4px;">戻る</button>
            </div>
        </div>
    `;
    window.stop(); // 読み込み停止
}

/**
 * 各ページの個別処理
 */

// ページA: バスケット
function processPageA() {
    const registerBtn = document.querySelector(".Button--NextStepLogin");
    const estimateBtn = document.getElementById("estimate");

    // ボタンの存在確認 (パニックモード判定)
    if (!registerBtn) {
        triggerPanicMode(
            "注文に進むボタン（.Button--NextStepLogin）が見つかりません。\n※カートに何も入っていない場合もこの画面が表示されます。"
        );
        return;
    }

    const btns = [registerBtn, estimateBtn].filter(Boolean);

    // 【ホワイトリスト方式】まずは一旦無効化
    btns.forEach(btn => applyRestriction(btn, "システム判定中..."));

    const priceElement = document.querySelector(".NextStepPriceValue .Price");
    if (!priceElement) {
        triggerPanicMode("金額表示（.Price）が見つかりません。サイト仕様変更の可能性があります。");
        return;
    }

    const subtotal = parsePrice(priceElement.textContent);

    if (subtotal < THRESHOLD_PRICE) {
        btns.forEach(btn => applyRestriction(btn, `小計が￥${THRESHOLD_PRICE}未満のため購入できません`));
    } else if (!checkTaxDecimal(subtotal)) {
        btns.forEach(btn => applyRestriction(btn, "税計算不一致リスクのため購入できません"));
    } else {
        clearWarnings(btns);
    }
}

// ページB: 注文確認
function processPageB() {
    const btns = [document.getElementById("checkoutNext__order_submit"), document.getElementById("order_submit")].filter(Boolean);

    // ボタンの存在確認 (パニックモード判定)
    if (btns.length === 0) {
        triggerPanicMode(
            "注文確定ボタンが見つかりません。\n※カートに何も入っていない場合もこの画面が表示されます。"
        );
        return;
    }

    // 【ホワイトリスト方式】まずは一旦無効化
    btns.forEach(btn => applyRestriction(btn, "システム判定中..."));

    const codePart = document.querySelector('tr[data-analytics-tag="code_part"]');
    if (codePart) codePart.style.display = "none";

    const payMethods = document.querySelectorAll('.pay_method');
    if (payMethods.length === 0) {
        triggerPanicMode("支払方法選択エリア（.pay_method）が見つかりません。サイト仕様変更の可能性があります。");
        return;
    }
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

    if (!subTotalEl || !freightEl) {
        triggerPanicMode("金額表示要素（小計/配送料）が見つかりません。サイト仕様変更の可能性があります。");
        return;
    }

    const subtotal = parsePrice(subTotalEl.textContent);
    const freight = parsePrice(freightEl.textContent);

        if (!hasBankTransfer) {
            btns.forEach(btn => applyRestriction(btn, "【重要】お支払方法を「都度払い」に設定してください。"));
        } else if (subtotal < THRESHOLD_PRICE) {
            btns.forEach(btn => applyRestriction(btn, `小計が￥${THRESHOLD_PRICE}未満のため確定できません`));
        } else if (!checkTaxDecimal(subtotal)) {
            btns.forEach(btn => applyRestriction(btn, "税計算不一致リスクのため確定できません"));
        } else {
            clearWarnings(btns);

            // 配送料の警告はボタン自体は押せるが注意を促す
            if (freight > 0) {
                btns.forEach(btn => {
                    const identifier = btn.id || btn.className.split(' ').join('-');
                    const noteId = "ext-note-" + identifier;
                    if (!document.getElementById(noteId)) {
                        const note = document.createElement("div");
                        note.id = noteId;
                        note.innerText = "※配送料が発生しているので事務担当者に連絡した上で注文してください";
                        note.style = "color:#d93025; font-size:14px; font-weight:bold; margin-top:8px; padding:8px; border:2px solid #d93025; background:#fff5f5; display:inline-block;";
                        btn.parentNode.insertBefore(note, btn.nextSibling);
                    }
                });
            }
        }
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
    if (isPanicMode) return;
    const type = getPageType();
    if (type === 'basket') processPageA();
    else if (type === 'confirm') processPageB();
    else if (type === 'quote') processPageC();
}

// 初回実行
validate();

// 数量変更(Ajax)などの操作を考慮し、クリック時に再評価
document.addEventListener('click', () => setTimeout(validate, 800), true);