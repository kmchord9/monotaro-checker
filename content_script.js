/**
 * 共通設定・ロジック
 */
const THRESHOLD_PRICE = 3500;
const TAX_RATE = 0.10; // 標準税率10%

/**
 * 消費税の小数点第一位が0-4（切り捨てと四捨五入が一致）ならtrue
 */
function checkTaxDecimal(subtotal) {
  // 小計に税率をかけた値を算出
  const taxAmount = subtotal * TAX_RATE;
  // 小数点第一位を抽出
  const firstDecimalDigit = Math.floor(taxAmount * 10) % 10;
  // 0〜4の範囲にあるか判定
  return firstDecimalDigit >= 0 && firstDecimalDigit <= 4;
}

/**
 * 数値抽出ユーティリティ
 */
function parsePrice(text) {
    if (!text) return 0;
    const num = text.replace(/[^0-9]/g, "");
    return parseInt(num, 10) || 0;
}

/**
 * 制限適用ユーティリティ
 */
function applyRestriction(element, message) {
    if (!element) return;
    element.style.opacity = "0.5";
    element.style.pointerEvents = "none";
    const msgId = "ext-warning-" + (element.id || "btn");
    if (!document.getElementById(msgId)) {
        const warn = document.createElement("div");
        warn.id = msgId;
        warn.innerText = message;
        warn.style = "color:red; font-size:12px; font-weight:bold; margin-top:5px; background: #fff5f5; padding: 4px; border: 1px solid red; display: inline-block;";
        element.parentNode.insertBefore(warn, element.nextSibling);
    }
}

/**
 * メインバリデーション
 */
function validateMonotaro() {
    const url = window.location.href;

    // --- ページA: バスケット一覧画面 ---
    if (url.includes("monotaro.basket.showListServlet.ShowListServlet")) {
        const priceElement = document.querySelector(".NextStepPriceValue .Price");
        if (priceElement) {
            const subtotal = parsePrice(priceElement.textContent);
            const registerBtn = document.querySelector(".Button--NextStepLogin");
            const estimateBtn = document.getElementById("estimate");

            if (subtotal < THRESHOLD_PRICE) {
                applyRestriction(registerBtn, `小計が￥${THRESHOLD_PRICE}未満のため進めません`);
                applyRestriction(estimateBtn, `￥${THRESHOLD_PRICE}未満は見積不可`);
            } else if (!checkTaxDecimal(subtotal)) {
                const msg = "消費税端数計算の不一致リスクがあるため、商品構成を調整してください";
                applyRestriction(registerBtn, msg);
                applyRestriction(estimateBtn, msg);
            }
        }
    }

    // --- ページB: ご注文内容確認画面 ---
    else if (url.includes("monotaro.checkout.confirm.show_init_edit_servlet.ShowInitEditServlet")) {
        // キャンペーン・支払い方法制御（省略せず実行）
        const codePart = document.querySelector('tr[data-analytics-tag="code_part"]');
        if (codePart) codePart.style.display = "none";

        const payMethods = document.querySelectorAll('.pay_method');
        let hasCorrectBankTransfer = false;
        let correctInput = null;

        payMethods.forEach(input => {
            const labelText = input.closest('label')?.textContent || "";
            if (input.value === "1" && labelText.includes("都度払い")) {
                hasCorrectBankTransfer = true;
                correctInput = input;
            } else {
                const parentLi = input.closest('li');
                if (parentLi) parentLi.style.display = "none";
            }
        });
        if (hasCorrectBankTransfer && !correctInput.checked) correctInput.click();

        // 金額・税判定
        const subTotalElement = document.getElementById("checkoutNext__rg_sub_total_span");
        const freightElement = document.getElementById("checkoutNext__rg_d_charge");
        const orderButtons = [document.getElementById("checkoutNext__order_submit"), document.getElementById("order_submit")];

        if (subTotalElement && freightElement) {
            const subtotal = parsePrice(subTotalElement.textContent);
            const freight = parsePrice(freightElement.textContent);

            orderButtons.forEach(btn => {
                if (!btn) return;
                const existingWarn = document.getElementById("ext-warning-" + btn.id);
                if (existingWarn) existingWarn.remove();

                if (!hasCorrectBankTransfer) {
                    applyRestriction(btn, "【重要】お支払方法を「都度払い」に設定してください。");
                } else if (subtotal < THRESHOLD_PRICE) {
                    applyRestriction(btn, `小計が￥${THRESHOLD_PRICE}未満のため確定できません`);
                } else if (!checkTaxDecimal(subtotal)) {
                    applyRestriction(btn, "消費税計算の不一致リスクがあるため、この金額では注文できません");
                } else if (freight > 0) {
                    // 配送料あり：ボタンは有効だが注記
                    btn.style.opacity = "1.0";
                    btn.style.pointerEvents = "auto";
                    const note = document.createElement("div");
                    note.id = "ext-warning-" + btn.id;
                    note.innerText = "※配送料が発生しているので事務担当者に連絡した上で注文してください";
                    note.style = "color: #d93025; font-size: 14px; font-weight: bold; margin-top: 8px; padding: 8px; border: 2px solid #d93025; background: #fff5f5; display: inline-block;";
                    btn.parentNode.insertBefore(note, btn.nextSibling);
                }
            });
        }
    }

    // --- ページC: 見積書表示ページ ---
    else if (document.querySelector(".kakaku")) {

        const kakakuArea = document.querySelector(".kakaku");
        const subtotal = parsePrice(kakakuArea.firstChild.textContent);

        // 条件：3500円以上 かつ 税計算が0-4の範囲
        if (subtotal >= THRESHOLD_PRICE && checkTaxDecimal(subtotal)) {
            if (!document.getElementById("custom-print-btn")) {
                const style = document.createElement("style");
                style.innerHTML = "@media print { #custom-print-btn { display: none !important; } }";
                document.head.appendChild(style);

                const printBtn = document.createElement("button");
                printBtn.id = "custom-print-btn";
                printBtn.innerText = "PDFを印刷する";
                printBtn.style = "display: block; margin: 10px auto 20px auto; padding: 12px 30px; background: #0078d4; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 18px;";
                printBtn.onclick = () => window.print();
                const mainTable = document.querySelector("div[align='center'] > table");
                if (mainTable) mainTable.parentNode.insertBefore(printBtn, mainTable);
            }
        } else {
            // エラー表示（金額不足または税計算不一致）
            const reason = subtotal < THRESHOLD_PRICE ? `￥${THRESHOLD_PRICE}未満` : "税端数計算不一致";
            const errorMsg = document.createElement("div");
            errorMsg.style = "color:red; font-weight:bold; padding:15px; border:2px solid red; margin: 20px auto; width: 660px; text-align: center; background: #fff5f5;";
            errorMsg.innerText = `【警告】${reason}のため、この見積書での稟議・発注は禁止されています。`;
            const mainTable = document.querySelector("div[align='center'] > table");
            if (mainTable) mainTable.parentNode.insertBefore(errorMsg, mainTable);
        }
    }
}

validateMonotaro();