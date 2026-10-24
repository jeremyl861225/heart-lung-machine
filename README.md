# 人工心肺機互動圖 · Heart-lung machine figures

體外循環 (cardiopulmonary bypass, CPB) 人工心肺機的等角互動圖。圖上不畫心臟，由右側的插管位置標示板標出每條管路接在病人身上的位置。

| 頁面 | 內容 |
|---|---|
| [`index.html`](index.html) | 目錄與兩種配置的對照表 |
| [`cpb-machine.html`](cpb-machine.html) | Fig 1 基本配置：四個滾輪泵（動脈、晶體心麻痺液、左心減壓、抽吸），5 個插管位置 |
| [`cpb-advanced.html`](cpb-advanced.html) | Fig 2 進階配置：離心動脈泵、4:1 血液心麻痺液（順行／逆行）、上下腔靜脈雙插管、負壓輔助靜脈引流、主動脈根部減壓、血液濃縮器，8 個插管位置 |

每個頁面都是單一 HTML 檔，不需要網路資源，會跟隨系統的淺色／深色設定。

## 操作

- **Fig 1**：左右拖曳或方向鍵調整動脈泵轉速；點泵頭或按 C／V／S 開關心麻痺液泵、左心減壓泵、抽吸泵；Home 全部停機。
- **Fig 2**：左右拖曳或方向鍵調整離心泵轉速（Shift 一次 500 rpm）；K 夾住／放開動脈管路；C 心麻痺液、R 切換順行／逆行；V 左心減壓、O 主動脈根部減壓、S 抽吸；A 負壓輔助引流；Home 夾管並全部停機。
- 不操作時會自動播放導覽；系統設定「減少動態效果」時不播放。

## 重新產生

兩張圖用 [anatomy](https://github.com/wheresryan22/anatomy) 繪圖工具組（MIT 授權）產生。需要 Node.js 20.10 以上，稽核與截圖需要 Chrome 或 Chromium。

```sh
git clone https://github.com/wheresryan22/anatomy src/anatomy
node src/cpb-machine/build.mjs --audit    # 寫出 cpb-machine.html
node src/cpb-advanced/build.mjs --audit   # 寫出 cpb-advanced.html
```

`--audit` 會檢查零件沒有互相穿過、每條管路的兩端都接在接頭上、轉彎不會在畫面上摺疊、遮擋順序正確。每張圖的數字都來自同目錄的 `model.mjs`。

## 說明

教學用示意圖，不是臨床操作指引。流量、壓力與儲血槽液面都是簡化模型，各數值的來源與假設寫在每張圖下方的說明裡；實際設定依器材與各院體外循環常規。
