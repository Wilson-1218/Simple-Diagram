# Simple Diagram

手繪風格立體／平面數學圖編輯器 · Hand-drawn math diagram editor（黑線、白底、數學斜體標籤）。靜態站，無需建置。

---

## 目標 / Objective

| 中文 | English |
|---|---|
| **主要目的**：用手繪方式畫簡單的數學考試圖 | **Main purpose**: draw simple math exam diagrams by hand |
| 主要面向 **HKDSE**（香港中學文憑試） | Mainly for **HKDSE** (Hong Kong Diploma of Secondary Education) |
| 更新不定時 | Updates are irregular |

產品名稱：**Simple Diagram**

---

## 注意 / Notice

| 中文 | English |
|---|---|
| **不支援移動設備**（手機／平板） | **Not supported on mobile devices** (phones / tablets) |
| 請用桌上型電腦瀏覽器，或本機開檔 | Use a **desktop** browser, or open the files locally |

---

## 線上使用 / Use online

開啟 GitHub Pages（無需下載）：

**https://wilson-1218.github.io/Simple-Diagram/**

建議 **Chrome／Edge**（桌面版）。
---

## 本機開啟 / Open locally

**方式一：直接開檔**

- 瀏覽器開啟 `index.html`
- 或單檔版 `simple-diagram-standalone.html`（無需其他檔案）

**方式二：本機伺服器（建議）**

```bash
npx --yes serve -l 5173 .
```

然後開啟 http://localhost:5173/

以 `file://` 開啟時，部分 API 可能改為下載行為。

---

## 介面語言 / UI language

頂欄可切換 **中｜EN**（按鈕與工具提示同步；畫布數學標籤不變）。

Toggle **中｜EN** in the top bar (buttons and tooltips follow; canvas math labels stay the same).

---

## 目前版本 / Current version（v13.1）

**左側兩欄網格**（繪製／構造／記號）｜**上方屬性／檔案列**｜**匯出 ▾**

預設：網格開、三角格、匯出隱藏點開、畫布縮放 **2×**。  
長度沿邊傾斜；標籤避線；對齊輔助（不進匯出）；離開警告僅未儲存時。

| 位置 | 內容 |
|---|---|
| **左：繪製** | 選取、手掌、點、線段、圓弧、橢圓、扇弧（旁：**弧｜扇**）、標籤 |
| **左：構造** | 交點、中點、比例、水平、垂線、座標 |
| **左：記號** | 直角、角弧、優角、平行、等長（旁：**單｜雙｜翻面**）、長度 |
| **上：模板** | 模板 ▾、「存為模板」 |
| **上：屬性** | 線型、字級 |
| **上：檢視** | 網格、深色、最近、複製／復原、「匯出 ▾」、`?` |

更多說明：[`docs/simple-diagram-features.md`](docs/simple-diagram-features.md) · 視覺風格：[`docs/simple-diagram-style.md`](docs/simple-diagram-style.md)

---

## 檔案 / Files

| 檔案 | 說明 |
|---|---|
| `index.html` | 主頁（搭配 `styles.css`、`app.js`） |
| `styles.css` | 樣式 |
| `app.js` | 應用邏輯 |
| `simple-diagram-standalone.html` | 單檔可攜版 |
