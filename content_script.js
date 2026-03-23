/**
 * 事務誤り防止用バリデーション・ロジック
 */
const THRESHOLD_PRICE = 3500;

function validateMonotaro() {
    const url = window.location.href;

    // --- ページA: バスケット一覧画面 ---
    if (url.includes("monotaro.basket.showListServlet.ShowListServlet")) {
        const priceElement = document.querySelector(".NextStepPriceValue .Price");
        if (priceElement) {
            const currentPrice = parsePrice(priceElement.textContent);
            const registerBtn = document.querySelector(".Button--NextStepLogin");
            const estimateBtn = document.getElementById("estimate");

            if (currentPrice < THRESHOLD_PRICE) {
                applyRestriction(registerBtn, `小計が￥${THRESHOLD_PRICE}未満のため進めません`);
                applyRestriction(estimateBtn, `￥${THRESHOLD_PRICE}未満は見積不可`);
            }
        }
    }
    
// --- ページB: ご注文内容確認画面 ---
    else if (url.includes("monotaro.checkout.confirm.show_init_edit_servlet.ShowInitEditServlet")) {
        
        // (1) キャンペーンコード・クーポン入力欄の非表示
        const codePart = document.querySelector('tr[data-analytics-tag="code_part"]');
        if (codePart) {
            codePart.style.display = "none";
        }

        // (2) 支払い方法の厳密なチェック（「都度払い」以外を排除）
        const payMethods = document.querySelectorAll('.pay_method');
        let hasCorrectBankTransfer = false; 
        let correctInput = null;

        payMethods.forEach(input => {
            // 親要素（labelやli）からテキストを取得して「都度払い」が含まれるか確認
            const labelText = input.closest('label')?.textContent || "";
            
            if (input.value === "1" && labelText.includes("都度払い")) {
                hasCorrectBankTransfer = true;
                correctInput = input;
            } else {
                // 「都度払い」ではない選択肢（月締め、代引き、カード等）はすべて非表示
                const parentLi = input.closest('li');
                if (parentLi) parentLi.style.display = "none";
            }
        });

        // 銀行振込(都度払い)が正しく存在すれば、強制的にチェックを入れる
        if (hasCorrectBankTransfer && !correctInput.checked) {
            correctInput.click();
        }

        // 【デバッグ用】配送料を強制的に￥100に書き換える
        /*
        const debugFreight = document.getElementById("checkoutNext__rg_d_charge");
        if (debugFreight) {
            debugFreight.innerHTML = "<em>￥100</em>";
            console.log("Debug: 配送料を￥100に書き換えました。判定ロジックを確認してください。");
        }  
        */      

        // (3) バリデーション（金額・配送料・設定ミス）
        const subTotalElement = document.getElementById("checkoutNext__rg_sub_total_span");
        const freightElement = document.getElementById("checkoutNext__rg_d_charge");
        const orderButtons = [
            document.getElementById("checkoutNext__order_submit"),
            document.getElementById("order_submit")
        ];

        if (subTotalElement && freightElement) {
            const subTotal = parsePrice(subTotalElement.textContent);
            const freight = parsePrice(freightElement.textContent);

            orderButtons.forEach(btn => {
                if (!btn) return;

                // 以前の警告表示をクリア
                const existingWarn = document.getElementById("ext-warning-" + btn.id);
                if (existingWarn) existingWarn.remove();

                // --- 判定1: 支払い設定ミス（都度払いになっていない） ---
                if (!hasCorrectBankTransfer) {
                    applyRestriction(btn, "【重要】お支払方法に「都度払い」が追加されていません。マニュアルを確認して設定してください");
                    return; 
                }

                // --- 判定2: 金額不足（3,500円未満はボタン抑制） ---
                if (subTotal < THRESHOLD_PRICE) {
                    applyRestriction(btn, `小計が￥${THRESHOLD_PRICE}未満のため確定できません`);
                } 
                // --- 判定3: 配送料発生（注記のみ表示・ボタンは有効） ---
                else if (freight > 0) {
                    btn.style.opacity = "1.0";
                    btn.style.pointerEvents = "auto";
                    
                    const note = document.createElement("div");
                    note.id = "ext-warning-" + btn.id;
                    note.innerText = "※配送料が発生しているので事務担当者に連絡した上で注文してください";
                    note.style = "color: #d93025; font-size: 14px; font-weight: bold; margin-top: 8px; padding: 8px; border: 2px solid #d93025; background: #fff5f5; display: inline-block;";
                    btn.parentNode.insertBefore(note, btn.nextSibling);
                }
                // --- 全て正常 ---
                else {
                    btn.style.opacity = "1.0";
                    btn.style.pointerEvents = "auto";
                }
            });
        }
    }
    

    // --- ページC: 見積書表示ページ ---
    else if (document.querySelector(".kakaku")) {

        // 金額判定と印刷ボタン
        const kakakuArea = document.querySelector(".kakaku");
        const priceText = kakakuArea.firstChild.textContent; 
        const price = parsePrice(priceText);

        if (price >= THRESHOLD_PRICE) {
            if (!document.getElementById("custom-print-btn")) {
                const style = document.createElement("style");
                style.innerHTML = "@media print { #custom-print-btn { display: none !important; } }";
                document.head.appendChild(style);

                const printBtn = document.createElement("button");
                printBtn.id = "custom-print-btn";
                printBtn.innerText = "印刷する";
                printBtn.style = "display: block; margin: 10px auto 20px auto; padding: 12px 30px; background: #0078d4; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 18px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);";
                printBtn.onclick = () => window.print();
                
                const mainTable = document.querySelector("div[align='center'] > table");
                if (mainTable) mainTable.parentNode.insertBefore(printBtn, mainTable);
            }
        } else {
            // 警告表示
            if (!document.getElementById("ext-error-msg")) {
                const errorMsg = document.createElement("div");
                errorMsg.id = "ext-error-msg";
                errorMsg.style = "color:red; font-weight:bold; padding:15px; border:2px solid red; margin: 20px auto; width: 660px; text-align: center; background: #fff5f5;";
                errorMsg.innerText = `【警告】合計金額が￥${THRESHOLD_PRICE}未満のため、この見積書での決裁・発注はできません。`;
                
                const mainTable = document.querySelector("div[align='center'] > table");
                if (mainTable) {
                    mainTable.parentNode.insertBefore(errorMsg, mainTable);
                }
            }
        }
    }
}

function parsePrice(text) {
    if (!text) return 0;
    const num = text.replace(/[^0-9]/g, "");
    return parseInt(num, 10) || 0;
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
        warn.style = "color:red; font-size:12px; font-weight:bold; margin-top:5px; background: #fff5f5; padding: 4px; border: 1px solid red; display: inline-block;";
        element.parentNode.insertBefore(warn, element.nextSibling);
    }
}

validateMonotaro();