/**
 * Simple Diagram editor (vanilla canvas)
 * Wilson Li — hand-drawn 3D exam geometry sketches
 */
(() => {
  "use strict";

  // ——— DOM ———
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const statusTool = document.getElementById("statusTool");
  const statusSnap = document.getElementById("statusSnap");
  const statusHint = document.getElementById("statusHint");
  const fileInput = document.getElementById("fileInput");
  const labelDialog = document.getElementById("labelDialog");
  const labelInput = document.getElementById("labelInput");
  const labelSizeInput = document.getElementById("labelSizeInput");
  const labelSizeSelect = document.getElementById("labelSizeSelect");
  const rightAngleSizeSelect = document.getElementById("rightAngleSizeSelect");
  const labelForm = document.getElementById("labelForm");
  const labelCancel = document.getElementById("labelCancel");
  const ratioDialog = document.getElementById("ratioDialog");
  const ratioInput = document.getElementById("ratioInput");
  const ratioLabelInput = document.getElementById("ratioLabelInput");
  const ratioForm = document.getElementById("ratioForm");
  const ratioCancel = document.getElementById("ratioCancel");
  const arcLabelDialog = document.getElementById("arcLabelDialog");
  const arcLabelInput = document.getElementById("arcLabelInput");
  const arcLabelForm = document.getElementById("arcLabelForm");
  const arcLabelSkip = document.getElementById("arcLabelSkip");
  const arcLabelCancel = document.getElementById("arcLabelCancel");
  const lengthDialog = document.getElementById("lengthDialog");
  const lengthInput = document.getElementById("lengthInput");
  const lengthForm = document.getElementById("lengthForm");
  const lengthCancel = document.getElementById("lengthCancel");
  const shortcutsDialog = document.getElementById("shortcutsDialog");
  const chkGridSnap = document.getElementById("chkGridSnap");
  const chkHideExportPoints = document.getElementById("chkHideExportPoints");
  const gridModeSelect = document.getElementById("gridModeSelect");
  const templateMenu = document.getElementById("templateMenu");
  const btnTemplateMenu = document.getElementById("btnTemplateMenu");
  const customTplList = document.getElementById("customTplList");
  const customTplEmpty = document.getElementById("customTplEmpty");
  const btnSaveTemplate = document.getElementById("btnSaveTemplate");
  const templateNameDialog = document.getElementById("templateNameDialog");
  const templateNameForm = document.getElementById("templateNameForm");
  const templateNameInput = document.getElementById("templateNameInput");
  const templateNameCancel = document.getElementById("templateNameCancel");
  const chkDarkCanvas = document.getElementById("chkDarkCanvas");
  const btnRecentMenu = document.getElementById("btnRecentMenu");
  const recentMenu = document.getElementById("recentMenu");
  const recentList = document.getElementById("recentList");
  const recentEmpty = document.getElementById("recentEmpty");
  const btnRestoreBackup = document.getElementById("btnRestoreBackup");
  const backupRestoreDialog = document.getElementById("backupRestoreDialog");
  const backupRestoreNote = document.getElementById("backupRestoreNote");
  const backupRestoreCancel = document.getElementById("backupRestoreCancel");
  const shortcutMapList = document.getElementById("shortcutMapList");
  const shortcutConflict = document.getElementById("shortcutConflict");
  const shortcutsReset = document.getElementById("shortcutsReset");

  // ——— Constants ———
  const PERP_MIN_PX = 12;
  const HORIZ_MIN_PX = 12;
  const TANGENT_MIN_PX = 24;
  const GRID_SIZE = 20;
  const SNAP_PX = 14;
  const POINT_R = 3.2;
  const HIT_POINT = 10;
  const HIT_LINE = 8;
  const MID_TICK = 7;
  const LINE_WIDTH = 1.35;
  const EXPORT_PAD = 40;
  const LABEL_SIZE_MIN = 12;
  const LABEL_SIZE_MAX = 36;
  const LABEL_SIZES = [];
  for (let s = LABEL_SIZE_MIN; s <= LABEL_SIZE_MAX; s += 2) LABEL_SIZES.push(s);
  const DEFAULT_LABEL_SIZE = 16;
  const DEFAULT_RA_SIZE = 10;
  /** Angle-arc radius = size × this (was 1.35; ~1.5× larger now). Presets 小/中/大 share this base. */
  const ANGLE_ARC_R = 1.35 * 1.5;
  /** Screen stroke multiplier for angle arcs (thicker than before). */
  const ANGLE_ARC_LW = 1.35;
  /** Export/SVG stroke multiplier for angle arcs. */
  const ANGLE_ARC_LW_EXPORT = 1.05;
  const TOOL_NAMES = {
    select: "選取",
    hand: "手掌",
    point: "點",
    line: "線段",
    horizontal: "水平線",
    circle: "圓／弧",
    ellipse: "橢圓",
    sector: "扇形／弧",
    fill: "填色",
    exportCrop: "框選匯出",
    label: "標籤",
    intersect: "交點",
    rightAngle: "直角",
    angleArc: "角弧",
    midTick: "中點",
    ratio: "比例",
    parallel: "平行記號",
    equal: "等長記號",
    length: "長度標註",
    perpendicular: "垂線",
    tangent: "切線",
    circlePart: "圓件",
    shape: "圖形",
    reflex: "優角",
    coord: "座標圖",
  };
  // Dashes sized for screen-space strokes (butt caps). Keep gaps obvious vs solid.
  const STYLE_DASH = {
    solid: [],
    dashed: [12, 9],
    dotted: [2.2, 5.5],
    dashdot: [12, 5, 2.2, 5],
  };

  function fillSizeSelect(sel, selected) {
    if (!sel) return;
    sel.innerHTML = "";
    for (const s of LABEL_SIZES) {
      const opt = document.createElement("option");
      opt.value = String(s);
      opt.textContent = String(s);
      if (s === selected) opt.selected = true;
      sel.appendChild(opt);
    }
  }
  fillSizeSelect(labelSizeSelect, DEFAULT_LABEL_SIZE);
  fillSizeSelect(labelSizeInput, DEFAULT_LABEL_SIZE);

  // ——— State ———
  const DEFAULT_VIEW_SCALE = 2;
  let view = { x: 0, y: 0, scale: DEFAULT_VIEW_SCALE };
  let tool = "select";
  let lineStyle = "solid";
  let spaceDown = false;
  let panning = false;
  let panLast = null;

  /** @type {{id:string,x:number,y:number,marker?:string}[]} */
  let points = [];
  /** @type {{id:string,a:string,b:string,style:string}[]} */
  let segments = [];
  /** @type {{id:string,pointId:string,text:string,ox:number,oy:number,size:number}[]} */
  let labels = [];
  /** @type {{id:string,vertex:string,arm1:string,arm2:string,size:number}[]} */
  let rightAngles = [];
  /** @type {{id:string,vertex:string,arm1:string,arm2:string,size:number,group:number,text?:string}[]} */
  let angleArcs = []; // group 0 = single arc, 1 = double; optional text; optional reflex:true
  /** @type {object[]} Simple coordinate axes + optional curve overlays */
  let coordPlots = [];
  /** @type {{id:string,segmentId:string,pointId?:string}[]} */
  let midTicks = []; // ratio division ticks only (midpoint tool does not use these)
  /** @type {{id:string,segmentId:string,group:number,side?:number}[]} */
  let parallelMarks = []; // group 0 = single chevron, 1 = double; side ±1
  /** @type {{id:string,segmentId:string,group:number,side?:number}[]} */
  let equalMarks = []; // group 0 = single tick, 1 = double; side ±1
  /** @type {{id:string,segmentId:string,text:string,side?:number}[]} */
  let lengthLabels = [];
  /** @type {{id:string,centerId:string,throughId:string,style?:string}[]} */
  let circles = [];
  /** Axis-aligned ellipse: rxId on horizontal axis, ryId on vertical; optional backDashed for 3D rim. */
  /** @type {{id:string,centerId:string,rxId:string,ryId:string,style?:string,backDashed?:boolean}[]} */
  let ellipses = [];
  /** Circular arc / sector pie: startId defines radius+start angle; endId end angle (on same r). */
  /** @type {{id:string,centerId:string,startId:string,endId:string,style?:string,mode?:string}[]} */
  let sectors = [];
  /** Region shade fills: polygon | sector | segment. */
  /** @type {{id:string,kind?:string,pointIds?:string[],circleId?:string,centerId?:string,startId?:string,endId?:string,color:string,opacity:number}[]} */
  let fills = [];
  /** Active fill preset key (see FILL_PRESETS). */
  let activeFillKey = "g20";
  const FILL_PRESETS = [
    { key: "g10", color: "#666666", opacity: 0.1 },
    { key: "g20", color: "#666666", opacity: 0.2 },
    { key: "g35", color: "#666666", opacity: 0.35 },
    { key: "g50", color: "#666666", opacity: 0.5 },
    { key: "bg22", color: "#6b8799", opacity: 0.22 },
  ];
  /** @type {"polygon"|"sector"|"segment"} */
  let fillMode = "polygon";
  /** @type {"square"|"equilateral"|"rect"|"iso"} */
  let shapeMode = "square";
  /** @type {"chord"|"diameter"|"radius"} */
  let circlePartMode = "chord";
  /** Layer visibility / lock (grid draw vs gridSnap are independent). */
  let layers = {
    gridShow: true,
    gridLock: false,
    coordsShow: true,
    coordsLock: false,
    helpersShow: true,
    helpersLock: false,
  };
  /** @type {"arc"|"sector"} */
  let sectorMode = "arc";
  /** Optional world-space crop for export/preview: {minX,minY,maxX,maxY} */
  let exportCrop = null;
  /** @type {{type:string,id:string}[]} */
  let selection = [];
  let selected = null; // last item in selection (compat)
  let hoverSnap = null;
  /** @type {{x:number,y:number,kind:string,segmentId?:string,circleId?:string,ellipseId?:string,sectorId?:string,aId?:string,bId?:string,centerId?:string,throughId?:string,d:number}|null} */
  let hoverGeomSnap = null;
  let draft = null;
  let drag = null;
  let nextLetter = "A";
  let labelFontSize = DEFAULT_LABEL_SIZE;
  let rightAngleSize = DEFAULT_RA_SIZE;
  let activeParallelGroup = 0; // 0 or 1
  let activeEqualGroup = 0;
  let activeArcGroup = 0; // 0 = single, 1 = double arc
  /** Document defaults (first load / clear-all). Saved JSON may override. */
  const DEFAULT_GRID_SNAP = true;
  const DEFAULT_HIDE_EXPORT_POINTS = true;
  /** @type {"square"|"triangle"} */
  const DEFAULT_GRID_MODE = "triangle";

  let gridSnap = DEFAULT_GRID_SNAP;
  /** @type {"square"|"triangle"} */
  let gridMode = DEFAULT_GRID_MODE;
  let hideExportPoints = DEFAULT_HIDE_EXPORT_POINTS;
  let pendingLengthSeg = null;

  // Pref keys: simple-diagram-* with one-time fallback from exam-diagram-*.
  const LS_GRID_MODE = "simple-diagram-grid-mode-v13";
  const LS_CUSTOM_TPL = "simple-diagram-custom-templates";
  const LS_DARK = "simple-diagram-dark-canvas";
  const LS_LANG = "simple-diagram-ui-lang";
  const LS_SHORTCUTS = "simple-diagram-shortcuts-v13";
  const LS_RECENT = "simple-diagram-recent-v13";
  const LS_AUTOBACKUP = "simple-diagram-autobackup-v13";
  const LS_LEGACY = {
    [LS_GRID_MODE]: ["exam-diagram-grid-mode-v114"],
    [LS_CUSTOM_TPL]: ["exam-diagram-custom-templates"],
    [LS_DARK]: ["exam-diagram-dark-canvas"],
    [LS_LANG]: ["exam-diagram-ui-lang"],
    [LS_SHORTCUTS]: ["exam-diagram-shortcuts-v12"],
    [LS_RECENT]: ["exam-diagram-recent-v12"],
    [LS_AUTOBACKUP]: ["exam-diagram-autobackup-v12"],
  };
  function lsGet(key) {
    try {
      let v = localStorage.getItem(key);
      if (v != null) return v;
      const olds = LS_LEGACY[key] || [];
      for (const o of olds) {
        v = localStorage.getItem(o);
        if (v != null) {
          try { localStorage.setItem(key, v); } catch (_) {}
          return v;
        }
      }
    } catch (_) {}
    return null;
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, val); } catch (_) {}
  }
  const RECENT_MAX = 8;
  const ALIGN_THRESH_PX = 6;
  const EQUAL_LEN_RATIO = 0.04;

  let darkCanvas = false;
  darkCanvas = lsGet(LS_DARK) === "1";
  let uiLang = "zh";
  {
    const lg = lsGet(LS_LANG);
    if (lg === "en" || lg === "zh") uiLang = lg;
  }

  const I18N = {
    zh: {
      tool_select: "選取", tool_hand: "手掌", tool_point: "點", tool_line: "線段",
      tool_horizontal: "水平", tool_circle: "圓弧", tool_ellipse: "橢圓", tool_sector: "扇弧",
      tool_exportCrop: "框選", tool_label: "標籤", tool_intersect: "交點",
      tool_rightAngle: "直角", tool_angleArc: "角弧", tool_midTick: "中點", tool_ratio: "比例",
      tool_parallel: "平行", tool_equal: "等長", tool_length: "長度", tool_perpendicular: "垂線",
      tool_tangent: "切線", tool_circlePart: "圓件", tool_shape: "圖形",
      tool_reflex: "優角", tool_coord: "座標", tool_fill: "填色",
      group_templates: "模板", group_props: "屬性", group_view: "檢視／匯出",
      rail_draw: "繪", rail_construct: "構", rail_marks: "記",
      rail_draw_title: "繪製", rail_construct_title: "構造", rail_marks_title: "記號",
      chk_grid: "網格", chk_hide_pts: "匯出隱藏點", chk_dark: "深色畫布",
      btn_layers: "圖層 ▾", layers_title: "圖層", layers_grid: "網格", layers_coords: "座標",
      layers_helpers: "記號", layers_show: "顯示", layers_lock: "鎖定",
      tip_layers: "圖層顯示／鎖定（網格／座標／記號）",
      shape_square: "正方", shape_equilateral: "等邊", shape_rect: "長方", shape_iso: "等腰",
      tip_shape_bar: "常用圖形", tip_shape_square: "正方形：對角拖曳",
      tip_shape_equilateral: "等邊三角形：底邊拖曳", tip_shape_rect: "長方形：自由寬高",
      tip_shape_iso: "等腰三角形：底×高",
      circlePart_chord: "弦", circlePart_diameter: "直徑", circlePart_radius: "半徑",
      tip_circlePart_bar: "弦／直徑／半徑", tip_circlePart_chord: "弦：圓上兩點",
      tip_circlePart_diameter: "直徑：過圓心", tip_circlePart_radius: "半徑：圓心到圓周",
      fill_mode_polygon: "多邊形", fill_mode_sector: "扇形", fill_mode_segment: "弓形",
      tip_fill_mode: "填色模式", tip_fill_polygon: "多邊形填色", tip_fill_sector: "扇形填色",
      tip_fill_segment: "弓形填色",
      align_title: "對齊", align_distH: "橫距", align_distV: "縱距", align_equalLen: "等長",
      tip_align_left: "左對齊", tip_align_center: "水平置中", tip_align_right: "右對齊",
      tip_align_top: "上對齊", tip_align_middle: "垂直置中", tip_align_bottom: "下對齊",
      tip_align_distH: "水平等距", tip_align_distV: "垂直等距", tip_align_equalLen: "等長（≥2 線段）",
      grid_square: "方格", grid_triangle: "三角格",
      btn_ok: "確定", btn_cancel: "取消",
      coord_title: "座標圖／曲線", coord_curve_type: "曲線類型", coord_none: "僅座標軸",
      coord_window: "視窗（軸單位）xmin,xmax,ymin,ymax", coord_axis_labels: "軸標籤 x,y",
      coord_show_tick_labels: "顯示軸上數值",
      coord_x_unit: "三角參數單位",
      coord_x_unit_rad: "弧度 rad",
      coord_x_unit_deg: "角度 °",
      coord_x_unit_note: "只影響 sin／cos／tan：角度模式下 Bx、C 以「度」計（內部轉弧度）。與下方「角度軸刻度」分開。",
      coord_angle_axis: "角度軸刻度",
      coord_angle_axis_note: "開啟後 x 軸改為 π（弧度）或 °（角度）刻度，並可暫用三角視窗；關閉後還原原本視窗與數字刻度。",
      coord_log_base: "底 b",
      coord_curves_note: "可加多條曲線；對數可改底數（例 10、2、e）。",
      coord_add_curve: "＋曲線",
      coord_remove_curve: "刪除",
      coord_no_curves: "尚未加曲線（僅座標軸）",
      coord_circle_general: "一般式 x²+y²+Dx+Ey+F=0",
      coord_circle_standard: "標準式 (x−h)²+(y−k)²=r²",
      coord_circle_center: "圓心＋半徑",
      coord_label_show: "顯示曲線標籤",
      coord_label_formula: "公式",
      coord_label_custom: "自訂",
      coord_label_formula_mode: "公式樣式",
      coord_label_alg: "代數",
      coord_label_num: "數值",
      coord_label_custom_ph: "自訂文字",
      coord_label_t: "沿曲線 t",
      coord_label_n: "線上方偏移 n",
      coord_label_pos_note: "正 n＝螢幕上方（線上方）；可拖曳標籤或改數值。",
      coord_sec_window: "視窗",
      coord_sec_display: "顯示",
      coord_sec_trig: "三角",
      coord_sec_curves: "曲線",
      status_tool: "工具：", status_snap: "吸附：", status_snap_none: "吸附：—",
      snap_point: "點", snap_seg: "線段", snap_circle: "圓／弧", snap_ellipse: "橢圓", snap_sector: "扇形／弧",
      hint_reflex_vertex: "請點選優角的頂點",
      hint_reflex_arms: "請再點兩條邊的端點（優角 >180°）",
      hint_arm_end: "請點選臂端點（高亮候選優先）",
      hint_second_arm: "請再點第二條臂的端點",
      hint_coord_origin: "點選原點位置以放置座標軸",
      hint_coord_placed: "已放置座標軸；雙擊可改曲線／視窗",
      hint_select: "拖曳移動 · Shift 多選 · 空白處框選 · Ctrl+D 複製",
      hint_hand: "拖曳平移畫布（不建立圖形；空白鍵暫用亦可）",
      hint_point: "點擊放置頂點；靠近線段／圓／橢圓／弧會吸附",
      hint_line: "兩點連線：左鍵＝實線 · 右鍵＝虛線（隱藏邊）",
      hint_horizontal: "點選既有點後左右拖曳定長（實線；放開完成）",
      hint_circle: "先點圓心，再點圓周上的半徑點",
      hint_ellipse: "圓心 → 水平半徑點 → 鉛垂半徑點；完成時左鍵實線／右鍵虛線",
      hint_sector_arc: "弧段：圓心 → 起點 → 終點；完成時左鍵實線／右鍵虛線 · 工具列弧／扇切換",
      hint_sector_pie: "扇形：圓心 → 起點 → 終點；完成時左鍵實線／右鍵虛線 · 工具列弧／扇切換",
      hint_exportCrop_set: "已設裁切範圍 · 再拖可重設 · Esc 取消拖曳 ·「清除裁切」還原整圖",
      hint_exportCrop: "拖曳框選匯出範圍，放開後開預覽",
      hint_label: "點頂點：左鍵開對話框 · 右鍵直接套預設字母／字級",
      hint_intersect: "依序點兩條線段 → 交點",
      hint_rightAngle: "恰兩條邊可一鍵；否則頂點→兩臂端點",
      hint_angleArc: "角弧：恰兩條邊可一鍵；否則頂點→兩臂 · G 切換單／雙弧",
      hint_reflex: "優角（>180°）：恰兩條邊可一鍵；否則頂點→兩臂",
      hint_coord: "點選原點放置座標軸，再選曲線類型與參數",
      hint_midTick: "點選線段：建立中點並加標籤（無短劃）",
      hint_ratio: "點選線段，輸入比例（由第一端→第二端）",
      hint_length: "點選線段，輸入長度文字（例：6）",
      hint_perpendicular: "點選既有點後向下拖曳定長（點線；放開完成）",
      hint_parallel: "點線段：左鍵＝單箭 · 右鍵＝雙箭（工具列「單／雙」或 G 可預設）",
      hint_equal: "點線段：左鍵＝單劃 · 右鍵＝雙劃（工具列「單／雙」或 G 可預設）",
      hint_fill: "依序點頂點，再點起點完成",
      hint_fill_sector: "點既有扇形，或圓心→起點→終點",
      hint_fill_segment: "在同一圓上點兩點（填次要弓形）",
      hint_shape: "拖曳放置圖形，放開完成",
      hint_circlePart: "在圓上拖曳建立弦／直徑／半徑",
      fill_need_point: "請點選既有頂點",
      fill_need_more: "依序點頂點（≥3），再點起點完成",
      fill_closed: "已填色",
      fill_sector_need: "請點扇形或圓心／起／終點",
      fill_segment_need: "請在同一圓上點兩點",
      tip_fill_g10: "灰影 10%",
      tip_fill_g20: "灰影 20%",
      tip_fill_g35: "灰影 35%",
      tip_fill_g50: "灰影 50%",
      tip_fill_bg: "藍灰影 22%",
      tip_fill_bar: "填色陰影透明度",
      tip_tool_shape: "常用圖形：正方／等邊／長方／等腰 (B)",
      tip_tool_circlePart: "弦／直徑／半徑：在圓上拖曳建立 (T)",
      circlePart_need_circle: "請點選圓或圓周上的點",
      circlePart_too_short: "拖曳太短，已取消",
      shape_too_small: "圖形太小，已取消",
      btn_template: "模板 ▾", btn_save_tpl: "存為模板", btn_recent: "最近 ▾",
      btn_copy: "複製", btn_delete: "刪除", btn_clear: "清除", btn_save: "儲存", btn_load: "開啟",
      btn_export_menu: "匯出 ▾", btn_export_crop: "框選匯出", btn_clear_crop: "清除裁切", btn_preview: "預覽匯出",
      btn_restore_backup: "還原自動備份", menu_recent: "最近開啟", menu_backup: "備份",
      menu_plane: "平面", menu_solid: "立體", menu_custom: "自訂",
      size_s: "小", size_m: "中", size_l: "大", size_xl: "特大",
      mark_single: "單", mark_double: "雙", mark_flip: "翻面", sector_arc: "弧", sector_pie: "扇",
      empty_custom_tpl: "尚無自訂模板", empty_recent: "尚無記錄",
      tip_lang_zh: "中文介面",
      tip_lang_en: "English UI",
      tip_templates: "常用平面／立體模板",
      tip_save_tpl: "將目前選取存為自訂模板",
      tip_style_solid: "實線",
      tip_style_dashed: "虛線（隱藏邊）",
      tip_style_dotted: "點線（構造）",
      tip_style_dashdot: "點劃線",
      tip_label_size: "標籤字級",
      tip_mark_size: "直角／角弧大小",
      tip_grid: "開啟網格顯示與格點吸附（預設開啟）",
      tip_grid_mode: "網格樣式",
      tip_dark: "深色畫布（僅編輯；匯出仍為白底黑線）",
      tip_recent: "最近開啟的專案",
      tip_copy: "複製選取 (Ctrl+D)",
      tip_undo: "復原 (Ctrl+Z)",
      tip_redo: "重做 (Ctrl+Y)",
      tip_delete: "刪除 (Delete)",
      tip_clear: "清除整個圖形",
      tip_save: "儲存 JSON",
      tip_load: "開啟 JSON",
      tip_export_menu: "匯出選項",
      tip_export_crop: "自選範圍匯出：拖曳框選裁切範圍",
      tip_clear_crop: "清除自選匯出範圍",
      tip_preview: "預覽匯出效果（若有裁切則只預覽該區）",
      tip_export_png: "匯出 PNG（Chrome／Edge 可選資料夾與檔名）",
      tip_export_svg: "匯出 SVG（Chrome／Edge 可選資料夾與檔名）",
      tip_hide_pts: "匯出 PNG／SVG 時隱藏頂點圓點（預設開啟）",
      tip_shortcuts: "快捷鍵一覽 (?)",
      tip_tool_select: "選取／移動 (V)",
      tip_tool_hand: "手掌：拖曳平移畫布（空白鍵亦可暫用）",
      tip_tool_point: "點 (P)",
      tip_tool_line: "線段 (L)",
      tip_tool_circle: "圓／作圖弧：圓心 → 半徑點 (C)",
      tip_tool_ellipse: "橢圓：圓心 → 水平半徑 → 鉛垂半徑；左鍵實線／右鍵虛線 (E)",
      tip_tool_sector: "扇形／弧段：圓心 → 起點 → 終點；工具列切換弧／扇形 (A)",
      tip_tool_label: "標籤：左鍵自訂／右鍵直接套預設",
      tip_sector_bar: "弧段僅畫弧；扇形含兩條半徑",
      tip_sector_arc: "只畫圓弧",
      tip_sector_pie: "扇形（弧＋兩半徑）",
      tip_tool_intersect: "兩線交點",
      tip_tool_midTick: "中點：建立中點並加標籤 (M)",
      tip_tool_ratio: "比例分點 (R)",
      tip_tool_horizontal: "水平線：點選一點後左右拖曳定長 (H)",
      tip_tool_perpendicular: "垂線：點選一點後向下拖曳定長",
      tip_tool_tangent: "圓的切線：點圓周上（或近圓周）後拖曳定長；可再拖端點調整",
      hint_tangent: "點圓周上（或近圓周），拖曳設定切線長度",
      tangent_need_circle: "請點選圓或圓周上的點",
      tangent_too_short: "拖曳太短，已取消",
      tip_tool_coord: "座標軸：點選原點位置；可加曲線",
      tip_tool_rightAngle: "直角記號",
      tip_tool_angleArc: "角弧：非直角的弧線記號",
      tip_tool_reflex: "優角：大於 180° 的角弧記號",
      tip_tool_parallel: "平行記號：左鍵單箭／右鍵雙箭",
      tip_tool_equal: "等長記號：左鍵單劃／右鍵雙劃",
      tip_mark_bar: "單／雙記號與翻面",
      tip_mark_single: "單箭／單劃（G）",
      tip_mark_double: "雙箭／雙劃（G）",
      tip_mark_flip: "記號翻面（選取平行／等長記號後）",
      tip_tool_length: "線段長度標註（例：6）",
      tip_tool_fill: "填色：多邊形／扇形／弓形；浮層切換模式與色票 (I)",
      tip_preview_crop: "關閉後拖曳框選匯出範圍",
      tip_preview_clear_crop: "改回自動裁切整圖",
      tip_preview_png: "儲存 PNG（Chrome／Edge 可選資料夾與檔名）",
      tip_preview_svg: "儲存 SVG（Chrome／Edge 可選資料夾與檔名）",
      tip_open_recent: "開啟此備份",
      tip_del_tpl: "刪除此模板",
      tip_insert_tpl: "插入「{name}」",
      aria_toolbar_props: "屬性與檔案",
      aria_toolbar_tools: "繪圖工具",
      aria_canvas: "繪圖畫布",
      aria_mark_size: "記號大小",
      aria_label_size: "標籤字級",
      aria_grid_mode: "網格樣式",
      aria_add_curve: "新增曲線類型",
      hint_idle: "空白鍵＋拖曳平移 · 滾輪縮放 · Esc 取消 · ? 快捷鍵",
      title_doc: "Simple Diagram · Wilson",
      shortcuts_title: "快捷鍵（可自訂）",
      shortcuts_note: "點「改」後按一個鍵；衝突會以紅色標示。Ctrl／空白／Delete／Esc 等系統鍵固定。",
      shortcuts_reset: "還原預設",
      btn_close: "關閉",
      attr_credit: "Simple Diagram · Wilson Li · MIT",
      attr_credit_tip: "授權與轉載聲明（開啟 ? 看完整說明）",
      attr_help: "可自由使用、複製及二次開發；轉載或再發佈時請保留來源聲明：Simple Diagram（Wilson Li）及 GitHub 連結。",
    },
    en: {
      tool_select: "Select", tool_hand: "Pan", tool_point: "Point", tool_line: "Line",
      tool_horizontal: "Horiz", tool_circle: "Arc", tool_ellipse: "Ellip", tool_sector: "Sector",
      tool_exportCrop: "Crop", tool_label: "Label", tool_intersect: "Xsect",
      tool_rightAngle: "Right", tool_angleArc: "Angle", tool_midTick: "Mid", tool_ratio: "Ratio",
      tool_parallel: "Par", tool_equal: "Equal", tool_length: "Len", tool_perpendicular: "Perp",
      tool_tangent: "Tan", tool_circlePart: "Chord", tool_shape: "Shape",
      tool_reflex: "Reflex", tool_coord: "Axes", tool_fill: "Fill",
      group_templates: "Templates", group_props: "Props", group_view: "View / Export",
      rail_draw: "Draw", rail_construct: "Build", rail_marks: "Mark",
      rail_draw_title: "Draw", rail_construct_title: "Construct", rail_marks_title: "Marks",
      chk_grid: "Grid", chk_hide_pts: "Hide pts", chk_dark: "Dark",
      btn_layers: "Layers ▾", layers_title: "Layers", layers_grid: "Grid", layers_coords: "Axes",
      layers_helpers: "Marks", layers_show: "Show", layers_lock: "Lock",
      tip_layers: "Layer show/lock (grid / axes / marks)",
      shape_square: "Sq", shape_equilateral: "Eq", shape_rect: "Rect", shape_iso: "Iso",
      tip_shape_bar: "Common shapes", tip_shape_square: "Square: drag from corner",
      tip_shape_equilateral: "Equilateral: drag base", tip_shape_rect: "Rectangle: free w×h",
      tip_shape_iso: "Isosceles: base×height",
      circlePart_chord: "Chord", circlePart_diameter: "Diam", circlePart_radius: "Rad",
      tip_circlePart_bar: "Chord / diameter / radius", tip_circlePart_chord: "Chord: two points on circle",
      tip_circlePart_diameter: "Diameter through center", tip_circlePart_radius: "Radius: center to rim",
      fill_mode_polygon: "Poly", fill_mode_sector: "Pie", fill_mode_segment: "Seg",
      tip_fill_mode: "Fill mode", tip_fill_polygon: "Polygon fill", tip_fill_sector: "Sector fill",
      tip_fill_segment: "Segment fill",
      align_title: "Align", align_distH: "DistH", align_distV: "DistV", align_equalLen: "EqLen",
      tip_align_left: "Align left", tip_align_center: "Align center", tip_align_right: "Align right",
      tip_align_top: "Align top", tip_align_middle: "Align middle", tip_align_bottom: "Align bottom",
      tip_align_distH: "Distribute horizontally", tip_align_distV: "Distribute vertically",
      tip_align_equalLen: "Equal length (≥2 segments)",
      grid_square: "Square", grid_triangle: "Tri",
      btn_ok: "OK", btn_cancel: "Cancel",
      coord_title: "Axes / curves", coord_curve_type: "Curve type", coord_none: "Axes only",
      coord_window: "Window xmin,xmax,ymin,ymax", coord_axis_labels: "Axis labels x,y",
      coord_show_tick_labels: "Show axis numbers",
      coord_x_unit: "Trig argument unit",
      coord_x_unit_rad: "Radians",
      coord_x_unit_deg: "Degrees °",
      coord_x_unit_note: "Affects sin/cos/tan only: in degree mode, Bx and C are in degrees (converted internally). Separate from “Angle axis ticks” below.",
      coord_angle_axis: "Angle axis ticks",
      coord_angle_axis_note: "When on, x ticks use π (radians) or ° (degrees) and may use a trig-friendly window; turning off restores the previous window and numeric ticks.",
      coord_log_base: "base b",
      coord_curves_note: "Add multiple curves; log base editable (e.g. 10, 2, e).",
      coord_add_curve: "+ Curve",
      coord_remove_curve: "Del",
      coord_no_curves: "No curves yet (axes only)",
      coord_circle_general: "General x²+y²+Dx+Ey+F=0",
      coord_circle_standard: "Standard (x−h)²+(y−k)²=r²",
      coord_circle_center: "Centre + r",
      coord_label_show: "Show curve label",
      coord_label_formula: "Formula",
      coord_label_custom: "Custom",
      coord_label_formula_mode: "Formula style",
      coord_label_alg: "Algebraic",
      coord_label_num: "Numeric",
      coord_label_custom_ph: "Custom text",
      coord_label_t: "Along curve t",
      coord_label_n: "Above-line offset n",
      coord_label_pos_note: "Positive n = above the curve (screen-up). Drag the label or edit values.",
      coord_sec_window: "Window",
      coord_sec_display: "Display",
      coord_sec_trig: "Trig",
      coord_sec_curves: "Curves",
      status_tool: "Tool: ", status_snap: "Snap: ", status_snap_none: "Snap: —",
      snap_point: "point", snap_seg: "segment", snap_circle: "circle", snap_ellipse: "ellipse", snap_sector: "sector",
      hint_reflex_vertex: "Click the reflex-angle vertex",
      hint_reflex_arms: "Click the two arm endpoints (reflex >180°)",
      hint_arm_end: "Click an arm endpoint (highlighted preferred)",
      hint_second_arm: "Click the second arm endpoint",
      hint_coord_origin: "Click to place the axes origin",
      hint_coord_placed: "Axes placed; double-click to edit curve/window",
      hint_select: "Drag to move · Shift multi-select · marquee · Ctrl+D duplicate",
      hint_hand: "Drag to pan (Space also pans)",
      hint_point: "Click to place a vertex; snaps to segments/circles",
      hint_line: "Two points: LMB solid · RMB dashed (hidden edge)",
      hint_horizontal: "Pick a point, drag left/right for length",
      hint_circle: "Center, then a radius point",
      hint_ellipse: "Center → horizontal → vertical radius; LMB/RMB style",
      hint_sector_arc: "Arc: center → start → end; LMB/RMB style",
      hint_sector_pie: "Sector: center → start → end; LMB/RMB style",
      hint_exportCrop_set: "Crop set · drag again to reset · Clear crop for full figure",
      hint_exportCrop: "Drag a crop box, release to preview",
      hint_label: "Click vertex: LMB dialog · RMB quick letter",
      hint_intersect: "Click two segments → intersection",
      hint_rightAngle: "Two edges: one click; else vertex → arms",
      hint_angleArc: "Angle arc: two edges one click; else vertex → arms · G toggles",
      hint_reflex: "Reflex (>180°): two edges one click; else vertex → arms",
      hint_coord: "Click origin to place axes, then pick curve + params",
      hint_midTick: "Click a segment: midpoint + label (no tick)",
      hint_ratio: "Click a segment, enter a ratio",
      hint_length: "Click a segment, enter length text",
      hint_perpendicular: "Pick a point, drag down for length (dotted)",
      hint_parallel: "Click segment: LMB single · RMB double chevron",
      hint_equal: "Click segment: LMB single · RMB double tick",
      hint_fill: "Click vertices in order, then click the start point to finish",
      hint_fill_sector: "Click an existing sector, or center → start → end",
      hint_fill_segment: "Click two points on the same circle (minor segment)",
      hint_shape: "Drag to place a shape, release to commit",
      hint_circlePart: "Drag on a circle to make a chord / diameter / radius",
      fill_need_point: "Click an existing vertex",
      fill_need_more: "Click vertices in order (≥3), then click the start point",
      fill_closed: "Fill added",
      fill_sector_need: "Click a sector or center/start/end points",
      fill_segment_need: "Click two points on the same circle",
      tip_fill_g10: "Gray shade 10%",
      tip_fill_g20: "Gray shade 20%",
      tip_fill_g35: "Gray shade 35%",
      tip_fill_g50: "Gray shade 50%",
      tip_fill_bg: "Blue-gray shade 22%",
      tip_fill_bar: "Fill shade opacity",
      tip_tool_shape: "Shapes: square / equilateral / rect / isosceles (B)",
      tip_tool_circlePart: "Chord / diameter / radius: drag on a circle (T)",
      circlePart_need_circle: "Click a circle or a point on a circle",
      circlePart_too_short: "Drag too short — cancelled",
      shape_too_small: "Shape too small — cancelled",
      btn_template: "Templates ▾", btn_save_tpl: "Save tpl", btn_recent: "Recent ▾",
      btn_copy: "Copy", btn_delete: "Delete", btn_clear: "Clear", btn_save: "Save", btn_load: "Open",
      btn_export_menu: "Export ▾", btn_export_crop: "Crop export", btn_clear_crop: "Clear crop", btn_preview: "Preview",
      btn_restore_backup: "Restore backup", menu_recent: "Recent", menu_backup: "Backup",
      menu_plane: "Plane", menu_solid: "Solid", menu_custom: "Custom",
      size_s: "S", size_m: "M", size_l: "L", size_xl: "XL",
      mark_single: "1×", mark_double: "2×", mark_flip: "Flip", sector_arc: "Arc", sector_pie: "Pie",
      empty_custom_tpl: "No custom templates", empty_recent: "No recent files",
      tip_lang_zh: "Chinese UI",
      tip_lang_en: "English UI",
      tip_templates: "Plane / solid templates",
      tip_save_tpl: "Save selection as a custom template",
      tip_style_solid: "Solid",
      tip_style_dashed: "Dashed (hidden edge)",
      tip_style_dotted: "Dotted (construction)",
      tip_style_dashdot: "Dash-dot",
      tip_label_size: "Label size",
      tip_mark_size: "Right-angle / arc mark size",
      tip_grid: "Show grid and snap to lattice (on by default)",
      tip_grid_mode: "Grid style",
      tip_dark: "Dark canvas (edit only; export stays white)",
      tip_recent: "Recent projects",
      tip_copy: "Duplicate selection (Ctrl+D)",
      tip_undo: "Undo (Ctrl+Z)",
      tip_redo: "Redo (Ctrl+Y)",
      tip_delete: "Delete (Delete)",
      tip_clear: "Clear the whole figure",
      tip_save: "Save JSON",
      tip_load: "Open JSON",
      tip_export_menu: "Export options",
      tip_export_crop: "Crop export: drag a crop box",
      tip_clear_crop: "Clear crop region",
      tip_preview: "Preview export (crop region if set)",
      tip_export_png: "Export PNG (Chrome/Edge: pick folder & name)",
      tip_export_svg: "Export SVG (Chrome/Edge: pick folder & name)",
      tip_hide_pts: "Hide vertex dots in PNG/SVG export (on by default)",
      tip_shortcuts: "Keyboard shortcuts (?)",
      tip_tool_select: "Select / move (V)",
      tip_tool_hand: "Pan: drag to move the canvas (Space also pans)",
      tip_tool_point: "Point (P)",
      tip_tool_line: "Segment (L)",
      tip_tool_circle: "Circle/arc: center → radius point (C)",
      tip_tool_ellipse: "Ellipse: center → horiz → vert radius; LMB solid / RMB dashed (E)",
      tip_tool_sector: "Sector/arc: center → start → end; toggle arc/sector in rail (A)",
      tip_tool_label: "Label: LMB dialog / RMB quick letter",
      tip_sector_bar: "Arc = arc only; sector = arc + two radii",
      tip_sector_arc: "Draw arc only",
      tip_sector_pie: "Sector (arc + two radii)",
      tip_tool_intersect: "Intersection of two lines",
      tip_tool_midTick: "Midpoint: create midpoint + label (M)",
      tip_tool_ratio: "Ratio point (R)",
      tip_tool_horizontal: "Horizontal: pick a point, drag left/right for length (H)",
      tip_tool_perpendicular: "Perpendicular: pick a point, drag down for length",
      tip_tool_tangent: "Circle tangent: click on (or near) the circle, then drag for length; drag ends to adjust",
      hint_tangent: "Click on the circle (or near it), drag to set tangent length",
      tangent_need_circle: "Click a circle or a point on a circle",
      tangent_too_short: "Drag too short — cancelled",
      tip_tool_coord: "Axes: click origin; optional curves",
      tip_tool_rightAngle: "Right-angle mark",
      tip_tool_angleArc: "Angle arc mark (non-right angle)",
      tip_tool_reflex: "Reflex angle: arc mark >180°",
      tip_tool_parallel: "Parallel mark: LMB single / RMB double chevron",
      tip_tool_equal: "Equal-length mark: LMB single / RMB double tick",
      tip_mark_bar: "Single/double marks and flip",
      tip_mark_single: "Single chevron/tick (G)",
      tip_mark_double: "Double chevron/tick (G)",
      tip_mark_flip: "Flip mark (select parallel/equal mark first)",
      tip_tool_length: "Segment length label (e.g. 6)",
      tip_tool_fill: "Fill: polygon / sector / segment; float for mode & swatches (I)",
      tip_preview_crop: "Close, then drag a crop box",
      tip_preview_clear_crop: "Back to auto crop of whole figure",
      tip_preview_png: "Save PNG (Chrome/Edge: pick folder & name)",
      tip_preview_svg: "Save SVG (Chrome/Edge: pick folder & name)",
      tip_open_recent: "Open this entry",
      tip_del_tpl: "Delete this template",
      tip_insert_tpl: "Insert “{name}”",
      aria_toolbar_props: "Properties and files",
      aria_toolbar_tools: "Drawing tools",
      aria_canvas: "Drawing canvas",
      aria_mark_size: "Mark size",
      aria_label_size: "Label size",
      aria_grid_mode: "Grid style",
      aria_add_curve: "Add curve type",
      hint_idle: "Space+drag pan · wheel zoom · Esc cancel · ? shortcuts",
      title_doc: "Simple Diagram · Wilson",
      shortcuts_title: "Keyboard shortcuts (editable)",
      shortcuts_note: "Click “Edit”, then press a key. Conflicts show in red. Ctrl / Space / Delete / Esc stay fixed.",
      shortcuts_reset: "Reset defaults",
      btn_close: "Close",
      attr_credit: "Simple Diagram · Wilson Li · MIT",
      attr_credit_tip: "License & attribution (open ? for details)",
      attr_help: "Free to use, copy, and modify. Please keep attribution: “Simple Diagram” by Wilson Li — and the GitHub link.",
    },
  };

  function t(key) {
    const pack = I18N[uiLang] || I18N.zh;
    if (pack[key] != null) return pack[key];
    if (I18N.zh[key] != null) return I18N.zh[key];
    return key;
  }

  function syncToolNamesLang() {
    for (const k of Object.keys(TOOL_NAMES)) {
      const ik = "tool_" + k;
      if (I18N.zh[ik] || I18N.en[ik]) TOOL_NAMES[k] = t(ik);
    }
  }

  function applyChromeLang() {
    syncToolNamesLang();
    document.documentElement.lang = uiLang === "en" ? "en" : "zh-Hant";
    document.title = t("title_doc");
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const k = el.getAttribute("data-i18n");
      if (!k) return;
      const val = t(k);
      if (val && val !== k) el.textContent = val;
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const k = el.getAttribute("data-i18n-title");
      if (k) el.title = t(k);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const k = el.getAttribute("data-i18n-aria");
      if (k) el.setAttribute("aria-label", t(k));
    });
    const mapId = {
      btnTemplateMenu: "btn_template",
      btnSaveTemplate: "btn_save_tpl",
      btnRecentMenu: "btn_recent",
      btnCopy: "btn_copy",
      btnDelete: "btn_delete",
      btnClearAll: "btn_clear",
      btnSave: "btn_save",
      btnLoad: "btn_load",
      btnExportMenu: "btn_export_menu",
      btnExportCrop: "btn_export_crop",
      btnClearExportCrop: "btn_clear_crop",
      btnExportPreview: "btn_preview",
      btnRestoreBackup: "btn_restore_backup",
    };
    for (const [id, key] of Object.entries(mapId)) {
      const el = document.getElementById(id);
      if (el) el.textContent = t(key);
    }
    const secTitles = document.querySelectorAll("#templateMenu .menu-section-title");
    if (secTitles[0]) secTitles[0].textContent = t("menu_plane");
    if (secTitles[1]) secTitles[1].textContent = t("menu_solid");
    if (secTitles[2]) secTitles[2].textContent = t("menu_custom");
    const recentTitles = document.querySelectorAll("#recentMenu .menu-section-title");
    if (recentTitles[0]) recentTitles[0].textContent = t("menu_recent");
    if (recentTitles[1]) recentTitles[1].textContent = t("menu_backup");
    const customEmpty = document.getElementById("customTplEmpty");
    if (customEmpty) customEmpty.textContent = t("empty_custom_tpl");
    const recentEmptyEl = document.getElementById("recentEmpty");
    if (recentEmptyEl) recentEmptyEl.textContent = t("empty_recent");
    const raSel = document.getElementById("rightAngleSizeSelect");
    if (raSel && raSel.options.length >= 4) {
      raSel.options[0].textContent = t("size_s");
      raSel.options[1].textContent = t("size_m");
      raSel.options[2].textContent = t("size_l");
      raSel.options[3].textContent = t("size_xl");
    }
    document.querySelectorAll("[data-mark-group='0']").forEach((b) => { b.textContent = t("mark_single"); });
    document.querySelectorAll("[data-mark-group='1']").forEach((b) => { b.textContent = t("mark_double"); });
    const flip = document.getElementById("btnFlipMark");
    if (flip) flip.textContent = t("mark_flip");
    document.querySelectorAll("[data-sector-mode='arc']").forEach((b) => { b.textContent = t("sector_arc"); });
    document.querySelectorAll("[data-sector-mode='sector']").forEach((b) => { b.textContent = t("sector_pie"); });
    const zhBtn = document.getElementById("btnLangZh");
    const enBtn = document.getElementById("btnLangEn");
    if (zhBtn) zhBtn.classList.toggle("active", uiLang === "zh");
    if (enBtn) enBtn.classList.toggle("active", uiLang === "en");
    renderRecentMenu();
    refreshCustomTemplateMenu();
    updateStatus();
  }

  function setUiLang(lang) {
    uiLang = lang === "en" ? "en" : "zh";
    try { lsSet(LS_LANG, uiLang); } catch (_) {}
    applyChromeLang();
  }

  /** @type {{kind:string,x?:number,y?:number,x1?:number,y1?:number,x2?:number,y2?:number,label?:string}[]} */
  let alignGuides = [];
  let previousTool = "select";
  let currentDocName = "simple-diagram.json";
  let autosaveTimer = null;
  let shortcutListenId = null;
  /** Signature of last explicitly clean doc (save / load / restore / empty boot). */
  let cleanContentSig = "";

  const DEFAULT_SHORTCUTS = {
    tool_select: "v",
    tool_point: "p",
    tool_line: "l",
    tool_horizontal: "h",
    tool_circle: "c",
    tool_ellipse: "e",
    tool_sector: "a",
    tool_fill: "i",
    tool_shape: "b",
    tool_circlePart: "t",
    tool_midTick: "m",
    tool_ratio: "r",
    tool_hand: " ",
    flip_mark: "f",
    cycle_mark: "g",
    cycle_style: "s",
    prev_tool: "q",
    open_shortcuts: "?",
  };
  const SHORTCUT_LABELS = {
    tool_select: "選取工具",
    tool_point: "點工具",
    tool_line: "線段工具",
    tool_horizontal: "水平線工具",
    tool_circle: "圓／弧工具",
    tool_ellipse: "橢圓工具",
    tool_sector: "扇形／弧工具",
    tool_fill: "填色工具",
    tool_shape: "圖形工具",
    tool_circlePart: "圓件（弦／徑）",
    tool_midTick: "中點工具",
    tool_ratio: "比例工具",
    tool_hand: "手掌（空白鍵暫用）",
    flip_mark: "記號翻面",
    cycle_mark: "單／雙記號或弧｜扇",
    cycle_style: "循環線型",
    prev_tool: "上一個工具",
    open_shortcuts: "快捷鍵面板",
  };
  let shortcuts = { ...DEFAULT_SHORTCUTS };
  try {
    const raw = lsGet(LS_SHORTCUTS);
    if (raw) {
      const o = JSON.parse(raw);
      for (const k of Object.keys(DEFAULT_SHORTCUTS)) {
        if (typeof o[k] === "string" && o[k]) shortcuts[k] = o[k].toLowerCase();
      }
    }
  } catch (_) {}

  function edInk(highlight) {
    if (highlight) return darkCanvas ? "#7ec8f0" : "#1a4a6e";
    return darkCanvas ? "#e6e8eb" : "#111";
  }
  function edPaper() {
    return darkCanvas ? "#1e2329" : "#ffffff";
  }
  function edGridStroke() {
    return darkCanvas ? "rgba(255,255,255,0.12)" : "rgba(0, 0, 0, 0.16)";
  }
  function edHalo() {
    return darkCanvas ? "#1e2329" : "#ffffff";
  }
  function applyDarkCanvasClass() {
    document.body.classList.toggle("dark-canvas", !!darkCanvas);
    if (chkDarkCanvas) chkDarkCanvas.checked = !!darkCanvas;
  }
  applyDarkCanvasClass();

  function readGridModePref() {
    try {
      const m = lsGet(LS_GRID_MODE);
      if (m === "square" || m === "triangle") return m;
    } catch (_) {}
    return DEFAULT_GRID_MODE;
  }
  function writeGridModePref(mode) {
    try {
      lsSet(LS_GRID_MODE, mode);
    } catch (_) {}
  }
  function syncGridModeUI() {
    if (gridModeSelect) gridModeSelect.value = gridMode;
  }
  function syncViewOptionUI() {
    if (chkGridSnap) chkGridSnap.checked = !!gridSnap;
    if (chkHideExportPoints) chkHideExportPoints.checked = !!hideExportPoints;
    syncGridModeUI();
  }
  /** Reset view/export options to product defaults (not geometry). */
  function applyDocumentViewDefaults() {
    gridSnap = DEFAULT_GRID_SNAP;
    hideExportPoints = DEFAULT_HIDE_EXPORT_POINTS;
    gridMode = DEFAULT_GRID_MODE;
    writeGridModePref(gridMode);
    syncViewOptionUI();
  }
  // First load: product defaults for snap/hide-points; grid mode from pref (default triangle).
  gridMode = readGridModePref();
  writeGridModePref(gridMode);
  syncViewOptionUI();

  let history = [];
  let histIndex = -1;
  const HIST_MAX = 80;

  let pendingLabelPoint = null;
  let pendingRatioSeg = null;
  let pendingArcLabelId = null; // angle arc id awaiting / editing label

  function setSelection(items) {
    selection = items ? items.filter(Boolean) : [];
    selected = selection.length ? selection[selection.length - 1] : null;
    syncToolbarFromSelection();
    syncFillPresetUI();
    syncContextualFloats();
  }
  function isSelected(type, id) {
    return selection.some((s) => s.type === type && s.id === id);
  }
  function toggleSelect(item, additive) {
    if (!item) {
      if (!additive) setSelection([]);
      return;
    }
    if (additive) {
      const idx = selection.findIndex((s) => s.type === item.type && s.id === item.id);
      if (idx >= 0) selection = selection.filter((_, i) => i !== idx);
      else selection = [...selection, item];
      selected = selection.length ? selection[selection.length - 1] : null;
      syncToolbarFromSelection();
      syncFillPresetUI();
      syncContextualFloats();
    } else {
      setSelection([item]);
    }
  }

  /** Reflect primary selection in toolbar controls (no history). */
  function syncToolbarFromSelection() {
    if (!selected) return;
    if (selected.type === "segment") {
      const seg = segmentById(selected.id);
      if (seg) {
        lineStyle = seg.style || "solid";
        document.querySelectorAll(".style-btn").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.style === lineStyle);
        });
      }
    } else if (selected.type === "circle") {
      const cir = circles.find((c) => c.id === selected.id);
      if (cir) {
        lineStyle = circleStyle(cir);
        document.querySelectorAll(".style-btn").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.style === lineStyle);
        });
      }
    } else if (selected.type === "ellipse") {
      const el = ellipses.find((c) => c.id === selected.id);
      if (el) {
        lineStyle = ellipseStyle(el);
        document.querySelectorAll(".style-btn").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.style === lineStyle);
        });
      }
    } else if (selected.type === "sector") {
      const sec = sectors.find((c) => c.id === selected.id);
      if (sec) {
        lineStyle = sectorStyle(sec);
        document.querySelectorAll(".style-btn").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.style === lineStyle);
        });
        sectorMode = sec.mode === "sector" ? "sector" : "arc";
        syncSectorModeUI();
      }
    } else if (selected.type === "label") {
      const lab = labels.find((l) => l.id === selected.id);
      if (lab && labelSizeSelect) {
        labelSizeSelect.value = String(clampLabelSize(lab.size || DEFAULT_LABEL_SIZE));
      }
    } else if (selected.type === "rightAngle") {
      const ra = rightAngles.find((r) => r.id === selected.id);
      if (ra && rightAngleSizeSelect) {
        rightAngleSizeSelect.value = String(ra.size || DEFAULT_RA_SIZE);
      }
    } else if (selected.type === "angleArc") {
      const arc = angleArcs.find((a) => a.id === selected.id);
      if (arc && rightAngleSizeSelect) {
        rightAngleSizeSelect.value = String(arc.size || DEFAULT_RA_SIZE);
      }
      if (arc) {
        activeArcGroup = arc.group ? 1 : 0;
        syncMarkGroupUI();
      }
    } else if (selected.type === "parallelMark") {
      const m = parallelMarks.find((x) => x.id === selected.id);
      if (m) {
        activeParallelGroup = m.group ? 1 : 0;
        syncMarkGroupUI();
      }
    } else if (selected.type === "equalMark") {
      const m = equalMarks.find((x) => x.id === selected.id);
      if (m) {
        activeEqualGroup = m.group ? 1 : 0;
        syncMarkGroupUI();
      }
    } else if (selected.type === "fill") {
      const f = fills.find((x) => x.id === selected.id);
      if (f) {
        const match = FILL_PRESETS.find(
          (p) => p.color === f.color && Math.abs(p.opacity - f.opacity) < 0.001
        );
        if (match) activeFillKey = match.key;
        syncFillPresetUI();
      }
    }
  }

  /** Select every object whose id is not in beforeSets. */
  function selectCreatedSince(before) {
    const items = [];
    for (const p of points) {
      if (!before.points.has(p.id)) items.push({ type: "point", id: p.id });
    }
    for (const s of segments) {
      if (!before.segments.has(s.id)) items.push({ type: "segment", id: s.id });
    }
    for (const l of labels) {
      if (!before.labels.has(l.id)) items.push({ type: "label", id: l.id });
    }
    for (const r of rightAngles) {
      if (!before.rightAngles.has(r.id)) items.push({ type: "rightAngle", id: r.id });
    }
    for (const a of angleArcs) {
      if (!before.angleArcs.has(a.id)) items.push({ type: "angleArc", id: a.id });
    }
    for (const m of parallelMarks) {
      if (!before.parallelMarks.has(m.id)) items.push({ type: "parallelMark", id: m.id });
    }
    for (const m of equalMarks) {
      if (!before.equalMarks.has(m.id)) items.push({ type: "equalMark", id: m.id });
    }
    for (const m of lengthLabels) {
      if (!before.lengthLabels.has(m.id)) items.push({ type: "lengthLabel", id: m.id });
    }
    for (const c of circles) {
      if (!before.circles.has(c.id)) items.push({ type: "circle", id: c.id });
    }
    for (const el of ellipses) {
      if (!before.ellipses.has(el.id)) items.push({ type: "ellipse", id: el.id });
    }
    for (const sec of sectors) {
      if (!before.sectors.has(sec.id)) items.push({ type: "sector", id: sec.id });
    }
    for (const f of fills) {
      if (!before.fills.has(f.id)) items.push({ type: "fill", id: f.id });
    }
    setSelection(items);
  }

  function snapshotIdSets() {
    return {
      points: new Set(points.map((p) => p.id)),
      segments: new Set(segments.map((s) => s.id)),
      labels: new Set(labels.map((l) => l.id)),
      rightAngles: new Set(rightAngles.map((r) => r.id)),
      angleArcs: new Set(angleArcs.map((a) => a.id)),
      parallelMarks: new Set(parallelMarks.map((m) => m.id)),
      equalMarks: new Set(equalMarks.map((m) => m.id)),
      lengthLabels: new Set(lengthLabels.map((m) => m.id)),
      circles: new Set(circles.map((c) => c.id)),
      ellipses: new Set(ellipses.map((e) => e.id)),
      sectors: new Set(sectors.map((s) => s.id)),
      fills: new Set(fills.map((f) => f.id)),
    };
  }

  // ——— Utils ———
  const uid = () =>
    "id_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function clampLabelSize(n) {
    n = Number(n);
    if (!Number.isFinite(n)) return DEFAULT_LABEL_SIZE;
    return Math.min(LABEL_SIZE_MAX, Math.max(LABEL_SIZE_MIN, Math.round(n)));
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function screenToWorld(sx, sy) {
    return { x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale };
  }

  function worldToScreen(wx, wy) {
    return { x: wx * view.scale + view.x, y: wy * view.scale + view.y };
  }

  function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function pointById(id) {
    return points.find((p) => p.id === id);
  }

  function segmentById(id) {
    return segments.find((s) => s.id === id);
  }

  /** Snap only to rectangular lattice vertices (cell corners). Never mid-edge / diagonal. */
  function applyGrid(wx, wy) {
    if (!gridSnap) return { x: wx, y: wy };
    const s = GRID_SIZE;
    return {
      x: Math.round(wx / s) * s,
      y: Math.round(wy / s) * s,
    };
  }

  function gridBounds(viewW, viewH) {
    const tl = screenToWorld(0, 0);
    const br = screenToWorld(viewW, viewH);
    const s = GRID_SIZE;
    return {
      s,
      x0: Math.floor(tl.x / s) * s,
      y0: Math.floor(tl.y / s) * s,
      x1: br.x + s,
      y1: br.y + s,
    };
  }

  function strokeGridLattice(viewW, viewH, g) {
    for (let x = g.x0; x <= g.x1; x += g.s) {
      const sx = worldToScreen(x, 0).x;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, viewH);
    }
    for (let y = g.y0; y <= g.y1; y += g.s) {
      const sy = worldToScreen(0, y).y;
      ctx.moveTo(0, sy);
      ctx.lineTo(viewW, sy);
    }
  }

  /** Plain square / rectangular grid (no diagonals). */
  function drawSquareGrid(viewW, viewH) {
    const g = gridBounds(viewW, viewH);
    ctx.strokeStyle = edGridStroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    strokeGridLattice(viewW, viewH, g);
    ctx.stroke();
  }

  /** Rectangular lattice + BL→TR diagonal in every cell (guide only). */
  function drawTriangleGrid(viewW, viewH) {
    const g = gridBounds(viewW, viewH);
    ctx.strokeStyle = edGridStroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    strokeGridLattice(viewW, viewH, g);
    for (let x = g.x0; x < g.x1; x += g.s) {
      for (let y = g.y0; y < g.y1; y += g.s) {
        const a = worldToScreen(x, y + g.s);
        const b = worldToScreen(x + g.s, y);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
    }
    ctx.stroke();
  }

  function drawActiveGrid(viewW, viewH) {
    // Visibility is layers.gridShow only (snap uses gridSnap independently).
    if (!layers.gridShow) return;
    if (gridMode === "triangle") drawTriangleGrid(viewW, viewH);
    else drawSquareGrid(viewW, viewH);
  }

  function snapWorld(wx, wy, excludeId) {
    const g = applyGrid(wx, wy);
    wx = g.x;
    wy = g.y;
    const thresh = SNAP_PX / view.scale;
    let best = null;
    let bestD = thresh;
    for (const p of points) {
      if (excludeId && p.id === excludeId) continue;
      const d = dist(p, { x: wx, y: wy });
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** Project onto nearest segment within snap radius. */
  function snapToSegment(wx, wy) {
    const thresh = SNAP_PX / view.scale;
    let best = null;
    let bestD = thresh;
    for (const seg of segments) {
      const a = pointById(seg.a);
      const b = pointById(seg.b);
      if (!a || !b) continue;
      const proj = projectPointToSegment({ x: wx, y: wy }, a, b);
      const d = dist({ x: wx, y: wy }, proj);
      if (d < bestD) {
        bestD = d;
        best = {
          kind: "segment",
          x: proj.x,
          y: proj.y,
          t: proj.t,
          segmentId: seg.id,
          aId: seg.a,
          bId: seg.b,
          d,
        };
      }
    }
    return best;
  }

  /** Project onto nearest circle circumference within snap radius. */
  function snapToCircle(wx, wy) {
    const thresh = SNAP_PX / view.scale;
    let best = null;
    let bestD = thresh;
    for (const cir of circles) {
      const c = pointById(cir.centerId);
      const thr = pointById(cir.throughId);
      if (!c || !thr) continue;
      const r = dist(c, thr);
      if (r < 1e-9) continue;
      const dx = wx - c.x;
      const dy = wy - c.y;
      const distC = Math.hypot(dx, dy);
      // Distance from click to circumference
      const d = Math.abs(distC - r);
      if (d >= bestD) continue;
      let px, py;
      if (distC < 1e-9) {
        // At center: pick through-point direction
        const ux = thr.x - c.x;
        const uy = thr.y - c.y;
        const len = Math.hypot(ux, uy) || 1;
        px = c.x + (ux / len) * r;
        py = c.y + (uy / len) * r;
      } else {
        px = c.x + (dx / distC) * r;
        py = c.y + (dy / distC) * r;
      }
      bestD = d;
      best = {
        kind: "circle",
        x: px,
        y: py,
        circleId: cir.id,
        centerId: cir.centerId,
        throughId: cir.throughId,
        d,
      };
    }
    return best;
  }

  /** Project onto nearest axis-aligned ellipse rim within snap radius. */
  function snapToEllipse(wx, wy) {
    const thresh = SNAP_PX / view.scale;
    let best = null;
    let bestD = thresh;
    for (const el of ellipses) {
      const dims = ellipseDims(el);
      if (!dims) continue;
      const { c, rx, ry } = dims;
      if (rx < 1e-9 || ry < 1e-9) continue;
      const nx = (wx - c.x) / rx;
      const ny = (wy - c.y) / ry;
      const len = Math.hypot(nx, ny);
      let px, py;
      if (len < 1e-9) {
        px = c.x + rx;
        py = c.y;
      } else {
        px = c.x + (nx / len) * rx;
        py = c.y + (ny / len) * ry;
      }
      const d = Math.hypot(wx - px, wy - py);
      if (d >= bestD) continue;
      bestD = d;
      best = {
        kind: "ellipse",
        x: px,
        y: py,
        ellipseId: el.id,
        centerId: el.centerId,
        d,
      };
    }
    return best;
  }

  /** Project onto nearest sector/arc rim within snap radius. */
  function snapToSector(wx, wy) {
    const thresh = SNAP_PX / view.scale;
    let best = null;
    let bestD = thresh;
    for (const sec of sectors) {
      const g = sectorGeom(sec);
      if (!g) continue;
      const dx = wx - g.c.x;
      const dy = wy - g.c.y;
      const distC = Math.hypot(dx, dy);
      let px, py, ang;
      if (distC < 1e-9) {
        ang = g.a0;
        px = g.c.x + Math.cos(ang) * g.r;
        py = g.c.y + Math.sin(ang) * g.r;
      } else {
        ang = Math.atan2(dy, dx);
        px = g.c.x + (dx / distC) * g.r;
        py = g.c.y + (dy / distC) * g.r;
      }
      if (!angleOnMinorArc(ang, g.a0, g.delta)) continue;
      const d = Math.hypot(wx - px, wy - py);
      if (d >= bestD) continue;
      bestD = d;
      best = {
        kind: "sector",
        x: px,
        y: py,
        sectorId: sec.id,
        centerId: sec.centerId,
        d,
      };
    }
    return best;
  }

  /** Nearest of segment / circle / ellipse / sector snaps (whichever closer). */
  function snapToSegmentOrCircle(wx, wy) {
    const candidates = [
      snapToSegment(wx, wy),
      snapToCircle(wx, wy),
      snapToEllipse(wx, wy),
      snapToSector(wx, wy),
    ].filter(Boolean);
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.d - b.d);
    return candidates[0];
  }

  function ellipseDims(el) {
    const c = pointById(el.centerId);
    const px = pointById(el.rxId);
    const py = pointById(el.ryId);
    if (!c || !px || !py) return null;
    return {
      c,
      rx: Math.abs(px.x - c.x) || Math.hypot(px.x - c.x, px.y - c.y),
      ry: Math.abs(py.y - c.y) || Math.hypot(py.x - c.x, py.y - c.y),
    };
  }

  function ellipseStyle(el) {
    return el.style || "solid";
  }

  function sectorStyle(sec) {
    return sec.style || "solid";
  }

  function syncSectorModeUI() {
    document.querySelectorAll("[data-sector-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.sectorMode === sectorMode);
    });
    syncContextualFloats();
  }

  function setSectorMode(mode) {
    sectorMode = mode === "sector" ? "sector" : "arc";
    syncSectorModeUI();
    if (tool === "sector") updateStatus();
  }

  function fillPresetByKey(key) {
    return FILL_PRESETS.find((p) => p.key === key) || FILL_PRESETS[1];
  }

  function activeFillStyle() {
    const p = fillPresetByKey(activeFillKey);
    return { color: p.color, opacity: p.opacity };
  }

  function hexToRgba(hex, opacity) {
    const h = String(hex || "#666666").replace("#", "");
    const full =
      h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h.padEnd(6, "0").slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16) || 0;
    const g = parseInt(full.slice(2, 4), 16) || 0;
    const b = parseInt(full.slice(4, 6), 16) || 0;
    const a = Number.isFinite(Number(opacity)) ? Math.min(1, Math.max(0, Number(opacity))) : 0.2;
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  function syncFillPresetUI() {
    document.querySelectorAll("[data-fill-key]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.fillKey === activeFillKey);
    });
    syncContextualFloats();
  }

  const STROKE_TOOLS = new Set([
    "line",
    "horizontal",
    "perpendicular",
    "tangent",
    "circlePart",
    "shape",
    "circle",
    "ellipse",
    "sector",
  ]);
  const STROKE_SEL_TYPES = new Set(["segment", "circle", "ellipse", "sector"]);
  const SIZE_TOOLS = new Set(["label", "rightAngle", "angleArc", "reflex"]);
  const SIZE_SEL_TYPES = new Set(["label", "rightAngle", "angleArc"]);

  const SECTOR_TOOLS = new Set(["sector"]);
  const MARK_MODE_TOOLS = new Set(["parallel", "equal", "angleArc"]);
  const MARK_SEL_TYPES = new Set(["parallelMark", "equalMark", "angleArc"]);
  const HELPER_HIT_TYPES = new Set([
    "midTick",
    "parallelMark",
    "equalMark",
    "rightAngle",
    "angleArc",
    "lengthLabel",
  ]);

  function selectionHasAlignableItems() {
    let n = 0;
    for (const s of selection) {
      if (s.type === "point" || s.type === "segment" || s.type === "fill") n++;
      else if (
        s.type === "circle" ||
        s.type === "ellipse" ||
        s.type === "sector" ||
        s.type === "label"
      )
        n++;
      if (n >= 2) return true;
    }
    return false;
  }

  /** Show/hide contextual floats beside the left rail. */
  function syncContextualFloats() {
    const styleFloat = document.getElementById("styleFloat");
    const fillFloat = document.getElementById("fillFloat");
    const sectorFloat = document.getElementById("sectorFloat");
    const markFloat = document.getElementById("markFloat");
    const shapeFloat = document.getElementById("shapeFloat");
    const circlePartFloat = document.getElementById("circlePartFloat");
    const alignFloat = document.getElementById("alignFloat");
    if (styleFloat) {
      const strokeSel = selection.some((s) => STROKE_SEL_TYPES.has(s.type));
      const sizeSel = selection.some((s) => SIZE_SEL_TYPES.has(s.type));
      const showStyle =
        STROKE_TOOLS.has(tool) ||
        SIZE_TOOLS.has(tool) ||
        (tool === "select" && (strokeSel || sizeSel));
      styleFloat.hidden = !showStyle;
    }
    if (fillFloat) {
      fillFloat.hidden = tool !== "fill";
    }
    if (sectorFloat) {
      const selSector = selection.some((s) => s.type === "sector");
      sectorFloat.hidden = !(SECTOR_TOOLS.has(tool) || (tool === "select" && selSector));
    }
    if (markFloat) {
      const selMark = selection.some((s) => MARK_SEL_TYPES.has(s.type));
      markFloat.hidden = !(MARK_MODE_TOOLS.has(tool) || (tool === "select" && selMark));
    }
    if (shapeFloat) {
      shapeFloat.hidden = tool !== "shape";
    }
    if (circlePartFloat) {
      circlePartFloat.hidden = tool !== "circlePart";
    }
    if (alignFloat) {
      alignFloat.hidden = !(tool === "select" && selectionHasAlignableItems());
    }
  }

  function syncShapeModeUI() {
    document.querySelectorAll("[data-shape-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.shapeMode === shapeMode);
    });
    syncContextualFloats();
  }

  function setShapeMode(mode) {
    if (mode === "equilateral" || mode === "rect" || mode === "iso") shapeMode = mode;
    else shapeMode = "square";
    syncShapeModeUI();
    if (tool === "shape") updateStatus();
  }

  function syncCirclePartModeUI() {
    document.querySelectorAll("[data-circle-part]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.circlePart === circlePartMode);
    });
    syncContextualFloats();
  }

  function setCirclePartMode(mode) {
    if (mode === "diameter" || mode === "radius") circlePartMode = mode;
    else circlePartMode = "chord";
    syncCirclePartModeUI();
    if (tool === "circlePart") updateStatus();
  }

  function syncFillModeUI() {
    document.querySelectorAll("[data-fill-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.fillMode === fillMode);
    });
    syncContextualFloats();
  }

  function setFillMode(mode) {
    if (mode === "sector" || mode === "segment") fillMode = mode;
    else fillMode = "polygon";
    draft = null;
    syncFillModeUI();
    if (tool === "fill") updateStatus();
    draw();
  }

  function syncLayersUI() {
    document.querySelectorAll("[data-layer-show]").forEach((el) => {
      const k = el.dataset.layerShow;
      if (k === "grid") el.checked = !!layers.gridShow;
      else if (k === "coords") el.checked = !!layers.coordsShow;
      else if (k === "helpers") el.checked = !!layers.helpersShow;
    });
    document.querySelectorAll("[data-layer-lock]").forEach((el) => {
      const k = el.dataset.layerLock;
      if (k === "grid") el.checked = !!layers.gridLock;
      else if (k === "coords") el.checked = !!layers.coordsLock;
      else if (k === "helpers") el.checked = !!layers.helpersLock;
    });
  }

  function applyLayersPatch(patch) {
    layers = { ...layers, ...patch };
    syncLayersUI();
    draw();
    updateStatus();
  }

  function setFillPreset(key, applyToSelection) {
    const preset = fillPresetByKey(key);
    activeFillKey = preset.key;
    syncFillPresetUI();
    if (applyToSelection) {
      const targets = selection.filter((s) => s.type === "fill");
      if (targets.length) {
        pushHistory();
        for (const t of targets) {
          const f = fills.find((x) => x.id === t.id);
          if (f) {
            f.color = preset.color;
            f.opacity = preset.opacity;
          }
        }
        draw();
      }
    }
    if (tool === "fill") updateStatus();
  }

  function fillKindOf(fill) {
    if (!fill) return "polygon";
    if (fill.kind === "sector" || fill.kind === "segment") return fill.kind;
    return "polygon";
  }

  function normalizeFillRecord(f) {
    if (!f || typeof f !== "object") return null;
    const kind = fillKindOf(f);
    const out = {
      id: typeof f.id === "string" ? f.id : uid(),
      kind,
      color: f.color || "#666666",
      opacity: Number.isFinite(Number(f.opacity)) ? Number(f.opacity) : 0.2,
    };
    if (kind === "polygon") {
      out.pointIds = Array.isArray(f.pointIds) ? [...f.pointIds] : [];
    } else if (kind === "sector") {
      out.circleId = f.circleId || null;
      out.centerId = f.centerId || null;
      out.startId = f.startId || null;
      out.endId = f.endId || null;
    } else {
      out.circleId = f.circleId || null;
      out.startId = f.startId || null;
      out.endId = f.endId || null;
    }
    return out;
  }

  function fillWorldPoints(fill) {
    if (!fill || fillKindOf(fill) !== "polygon" || !Array.isArray(fill.pointIds)) return null;
    const pts = [];
    for (const id of fill.pointIds) {
      const p = pointById(id);
      if (!p) return null;
      pts.push(p);
    }
    return pts.length >= 3 ? pts : null;
  }

  function fillSectorGeom(fill) {
    if (!fill || fillKindOf(fill) !== "sector") return null;
    const c = pointById(fill.centerId);
    const s = pointById(fill.startId);
    const e = pointById(fill.endId);
    if (!c || !s || !e) return null;
    const r = dist(c, s);
    if (r < 1e-9) return null;
    const a0 = Math.atan2(s.y - c.y, s.x - c.x);
    const a1 = Math.atan2(e.y - c.y, e.x - c.x);
    let delta = a1 - a0;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    return { c, s, e, r, a0, a1, delta, anticlockwise: delta < 0 };
  }

  function fillSegmentGeom(fill) {
    if (!fill || fillKindOf(fill) !== "segment") return null;
    let c = null;
    let r = 0;
    if (fill.circleId) {
      const cir = circles.find((x) => x.id === fill.circleId);
      const g = circleGeomBasic(cir);
      if (!g) return null;
      c = g.c;
      r = g.r;
    } else if (fill.centerId) {
      c = pointById(fill.centerId);
      const s0 = pointById(fill.startId);
      if (!c || !s0) return null;
      r = dist(c, s0);
    }
    const s = pointById(fill.startId);
    const e = pointById(fill.endId);
    if (!c || !s || !e || r < 1e-9) return null;
    const a0 = Math.atan2(s.y - c.y, s.x - c.x);
    const a1 = Math.atan2(e.y - c.y, e.x - c.x);
    let delta = a1 - a0;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    return { c, s, e, r, a0, a1, delta, anticlockwise: delta < 0 };
  }

  function pointInPolygon(wx, wy, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x;
      const yi = pts[i].y;
      const xj = pts[j].x;
      const yj = pts[j].y;
      const intersect =
        yi > wy !== yj > wy && wx < ((xj - xi) * (wy - yi)) / (yj - yi + 0) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pointInFillSector(wx, wy, g) {
    if (!g) return false;
    const d = Math.hypot(wx - g.c.x, wy - g.c.y);
    if (d > g.r + 1e-9) return false;
    const ang = Math.atan2(wy - g.c.y, wx - g.c.x);
    return angleOnMinorArc(ang, g.a0, g.delta);
  }

  function pointInFillSegment(wx, wy, g) {
    if (!g) return false;
    const d = Math.hypot(wx - g.c.x, wy - g.c.y);
    if (d > g.r + 1e-9) return false;
    const cross =
      (g.e.x - g.s.x) * (wy - g.s.y) - (g.e.y - g.s.y) * (wx - g.s.x);
    const crossC =
      (g.e.x - g.s.x) * (g.c.y - g.s.y) - (g.e.y - g.s.y) * (g.c.x - g.s.x);
    // Minor segment is on the opposite side of the center relative to the chord
    if (cross * crossC > 0) return false;
    return true;
  }

  function pointInFill(fill, wx, wy) {
    const kind = fillKindOf(fill);
    if (kind === "sector") return pointInFillSector(wx, wy, fillSectorGeom(fill));
    if (kind === "segment") return pointInFillSegment(wx, wy, fillSegmentGeom(fill));
    const pts = fillWorldPoints(fill);
    return !!(pts && pointInPolygon(wx, wy, pts));
  }

  function nearestFillHit(wx, wy) {
    for (let i = fills.length - 1; i >= 0; i--) {
      const f = fills[i];
      if (pointInFill(f, wx, wy)) return f;
    }
    return null;
  }

  function buildFillPath(ctxOrC, fill, toS) {
    const kind = fillKindOf(fill);
    if (kind === "sector") {
      const g = fillSectorGeom(fill);
      if (!g) return false;
      const sc = toS(g.c.x, g.c.y);
      const ss = toS(g.s.x, g.s.y);
      const rScreen = Math.hypot(ss.x - sc.x, ss.y - sc.y);
      ctxOrC.beginPath();
      ctxOrC.moveTo(sc.x, sc.y);
      ctxOrC.lineTo(ss.x, ss.y);
      ctxOrC.arc(sc.x, sc.y, rScreen, g.a0, g.a1, g.anticlockwise);
      ctxOrC.closePath();
      return true;
    }
    if (kind === "segment") {
      const g = fillSegmentGeom(fill);
      if (!g) return false;
      const sc = toS(g.c.x, g.c.y);
      const ss = toS(g.s.x, g.s.y);
      const rScreen = Math.hypot(ss.x - sc.x, ss.y - sc.y);
      ctxOrC.beginPath();
      ctxOrC.moveTo(ss.x, ss.y);
      ctxOrC.arc(sc.x, sc.y, rScreen, g.a0, g.a1, g.anticlockwise);
      ctxOrC.closePath();
      return true;
    }
    const pts = fillWorldPoints(fill);
    if (!pts) return false;
    const s0 = toS(pts[0].x, pts[0].y);
    ctxOrC.beginPath();
    ctxOrC.moveTo(s0.x, s0.y);
    for (let i = 1; i < pts.length; i++) {
      const s = toS(pts[i].x, pts[i].y);
      ctxOrC.lineTo(s.x, s.y);
    }
    ctxOrC.closePath();
    return true;
  }

  function drawFillShape(fill, selected, toScreenFn) {
    const toS = toScreenFn || ((x, y) => worldToScreen(x, y));
    if (!buildFillPath(ctx, fill, toS)) return;
    ctx.fillStyle = hexToRgba(fill.color, fill.opacity);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = darkCanvas ? "rgba(126,200,240,0.95)" : "rgba(42,122,176,0.9)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /** SVG path `d` for a fill (polygon / sector pie / circular segment). */
  function fillToSvgPath(fill, toS) {
    const kind = fillKindOf(fill);
    if (kind === "sector") {
      const g = fillSectorGeom(fill);
      if (!g) return null;
      const sc = toS(g.c.x, g.c.y);
      const ss = toS(g.s.x, g.s.y);
      const se = toS(g.e.x, g.e.y);
      const r = Math.hypot(ss.x - sc.x, ss.y - sc.y);
      const large = Math.abs(g.delta) > Math.PI ? 1 : 0;
      const sweep = g.anticlockwise ? 0 : 1;
      return (
        "M" +
        sc.x.toFixed(2) +
        " " +
        sc.y.toFixed(2) +
        " L" +
        ss.x.toFixed(2) +
        " " +
        ss.y.toFixed(2) +
        " A" +
        r.toFixed(2) +
        " " +
        r.toFixed(2) +
        " 0 " +
        large +
        " " +
        sweep +
        " " +
        se.x.toFixed(2) +
        " " +
        se.y.toFixed(2) +
        " Z"
      );
    }
    if (kind === "segment") {
      const g = fillSegmentGeom(fill);
      if (!g) return null;
      const sc = toS(g.c.x, g.c.y);
      const ss = toS(g.s.x, g.s.y);
      const se = toS(g.e.x, g.e.y);
      const r = Math.hypot(ss.x - sc.x, ss.y - sc.y);
      const large = Math.abs(g.delta) > Math.PI ? 1 : 0;
      const sweep = g.anticlockwise ? 0 : 1;
      return (
        "M" +
        ss.x.toFixed(2) +
        " " +
        ss.y.toFixed(2) +
        " A" +
        r.toFixed(2) +
        " " +
        r.toFixed(2) +
        " 0 " +
        large +
        " " +
        sweep +
        " " +
        se.x.toFixed(2) +
        " " +
        se.y.toFixed(2) +
        " Z"
      );
    }
    const pts = fillWorldPoints(fill);
    if (!pts) return null;
    return (
      pts
        .map((p, i) => {
          const s = toS(p.x, p.y);
          return (i === 0 ? "M" : "L") + s.x.toFixed(2) + " " + s.y.toFixed(2);
        })
        .join(" ") + " Z"
    );
  }

  function fillReferencedPointIds(fill) {
    const ids = [];
    const kind = fillKindOf(fill);
    if (kind === "polygon" && Array.isArray(fill.pointIds)) {
      for (const id of fill.pointIds) ids.push(id);
    } else {
      if (fill.centerId) ids.push(fill.centerId);
      if (fill.startId) ids.push(fill.startId);
      if (fill.endId) ids.push(fill.endId);
    }
    return ids;
  }

  function addFillFromPointIds(pointIds, color, opacity, skipHist) {
    if (!pointIds || pointIds.length < 3) return null;
    if (!skipHist) pushHistory();
    const f = {
      id: uid(),
      kind: "polygon",
      pointIds: [...pointIds],
      color: color || activeFillStyle().color,
      opacity: opacity != null ? opacity : activeFillStyle().opacity,
    };
    fills.push(f);
    return f;
  }

  function addFillSector(centerId, startId, endId, circleId, color, opacity, skipHist) {
    if (!centerId || !startId || !endId) return null;
    if (!skipHist) pushHistory();
    const f = {
      id: uid(),
      kind: "sector",
      circleId: circleId || null,
      centerId,
      startId,
      endId,
      color: color || activeFillStyle().color,
      opacity: opacity != null ? opacity : activeFillStyle().opacity,
    };
    fills.push(f);
    return f;
  }

  function addFillSegment(startId, endId, circleId, color, opacity, skipHist) {
    if (!startId || !endId || !circleId) return null;
    if (!skipHist) pushHistory();
    const f = {
      id: uid(),
      kind: "segment",
      circleId,
      startId,
      endId,
      color: color || activeFillStyle().color,
      opacity: opacity != null ? opacity : activeFillStyle().opacity,
    };
    fills.push(f);
    return f;
  }

  function commitFillDraft() {
    if (!draft || draft.kind !== "fill") return false;
    if (!draft.pointIds || draft.pointIds.length < 3) {
      statusHint.textContent = t("fill_need_more");
      return false;
    }
    const style = activeFillStyle();
    const created = addFillFromPointIds(draft.pointIds, style.color, style.opacity);
    draft = null;
    if (created) {
      setSelection([{ type: "fill", id: created.id }]);
      statusHint.textContent = t("fill_closed");
    }
    updateStatus();
    draw();
    return !!created;
  }

  function handleFillClick(world) {
    if (fillMode === "sector") {
      handleFillSectorClick(world);
      return;
    }
    if (fillMode === "segment") {
      handleFillSegmentClick(world);
      return;
    }
    // Prefer start vertex when closing so nearby last-point doesn't steal the hit
    let sn = null;
    if (draft && draft.kind === "fill" && draft.pointIds && draft.pointIds.length >= 3) {
      const start = pointById(draft.pointIds[0]);
      if (start) {
        const thresh = (HIT_POINT * 1.35) / view.scale;
        if (dist(start, world) <= thresh) sn = start;
      }
    }
    if (!sn) sn = nearestPointHit(world.x, world.y);
    if (!sn || !sn.id) {
      statusHint.textContent = t("fill_need_point");
      return;
    }
    const pid = sn.id;
    if (!draft || draft.kind !== "fill") {
      draft = { kind: "fill", pointIds: [pid], cursor: { x: world.x, y: world.y } };
      statusHint.textContent = t("fill_need_more");
      draw();
      return;
    }
    if (draft.pointIds.length >= 3 && pid === draft.pointIds[0]) {
      commitFillDraft();
      return;
    }
    if (pid === draft.pointIds[draft.pointIds.length - 1]) return;
    if (draft.pointIds.includes(pid) && pid !== draft.pointIds[0]) {
      statusHint.textContent =
        draft.pointIds.length >= 3 ? t("hint_fill") : t("fill_need_more");
      return;
    }
    draft.pointIds.push(pid);
    draft.cursor = { x: world.x, y: world.y };
    statusHint.textContent =
      draft.pointIds.length >= 3 ? t("hint_fill") : t("fill_need_more");
    draw();
  }

  function handleFillSectorClick(world) {
    // Click existing sector entity → fill pie
    const secHit = nearestSectorHit(world.x, world.y);
    if (secHit && (!draft || draft.kind !== "fillSector")) {
      const g = sectorGeom(secHit);
      if (g) {
        const style = activeFillStyle();
        const created = addFillSector(
          secHit.centerId,
          secHit.startId,
          secHit.endId,
          null,
          style.color,
          style.opacity
        );
        draft = null;
        if (created) {
          setSelection([{ type: "fill", id: created.id }]);
          statusHint.textContent = t("fill_closed");
        }
        updateStatus();
        draw();
        return;
      }
    }
    const sn = nearestPointHit(world.x, world.y);
    if (!sn) {
      statusHint.textContent = t("fill_sector_need");
      return;
    }
    if (!draft || draft.kind !== "fillSector") {
      draft = {
        kind: "fillSector",
        centerId: sn.id,
        startId: null,
        cursor: { x: sn.x, y: sn.y },
      };
      statusHint.textContent = t("hint_fill_sector");
      draw();
      return;
    }
    if (!draft.startId) {
      if (sn.id === draft.centerId) return;
      draft.startId = sn.id;
      draft.cursor = { x: sn.x, y: sn.y };
      statusHint.textContent = t("hint_fill_sector");
      draw();
      return;
    }
    if (sn.id === draft.centerId || sn.id === draft.startId) return;
    const style = activeFillStyle();
    const created = addFillSector(
      draft.centerId,
      draft.startId,
      sn.id,
      null,
      style.color,
      style.opacity
    );
    draft = null;
    if (created) {
      setSelection([{ type: "fill", id: created.id }]);
      statusHint.textContent = t("fill_closed");
    }
    updateStatus();
    draw();
  }

  function handleFillSegmentClick(world) {
    let cir = null;
    let pid = null;
    let touch = null;
    const pHit = nearestPointHit(world.x, world.y);
    if (pHit) {
      const ons = circlesThroughPoint(pHit);
      if (ons.length) {
        cir = ons[0];
        pid = pHit.id;
        touch = { x: pHit.x, y: pHit.y };
      }
    }
    if (!cir) {
      cir = nearestCircleHit(world.x, world.y);
      if (!cir) {
        statusHint.textContent = t("fill_segment_need");
        return;
      }
      touch = projectOntoCircle(cir, world.x, world.y);
      if (!touch) return;
      const near = nearestPointHit(touch.x, touch.y);
      if (near && pointLiesOnCircle(cir, near, HIT_POINT / view.scale)) {
        pid = near.id;
        touch = { x: near.x, y: near.y };
      }
    }
    if (!pid && touch) {
      // Create rim point once; history folded into fill commit
      pid = addPoint(touch.x, touch.y, true, null, true).id;
    }
    if (!pid) {
      statusHint.textContent = t("fill_segment_need");
      return;
    }
    if (!draft || draft.kind !== "fillSegment") {
      draft = {
        kind: "fillSegment",
        circleId: cir.id,
        startId: pid,
        cursor: pointById(pid) || { x: world.x, y: world.y },
        createdStart: !pHit,
      };
      statusHint.textContent = t("hint_fill_segment");
      draw();
      return;
    }
    if (cir.id !== draft.circleId) {
      statusHint.textContent = t("fill_segment_need");
      return;
    }
    if (pid === draft.startId) return;
    const style = activeFillStyle();
    const created = addFillSegment(
      draft.startId,
      pid,
      draft.circleId,
      style.color,
      style.opacity
    );
    draft = null;
    if (created) {
      setSelection([{ type: "fill", id: created.id }]);
      statusHint.textContent = t("fill_closed");
    }
    updateStatus();
    draw();
  }

  /** Geometry for a sector/arc: radius from center→start; end angle from endId. */
  function sectorGeom(sec) {
    const c = pointById(sec.centerId);
    const s = pointById(sec.startId);
    const e = pointById(sec.endId);
    if (!c || !s || !e) return null;
    const r = dist(c, s);
    if (r < 1e-9) return null;
    const a0 = Math.atan2(s.y - c.y, s.x - c.x);
    const a1 = Math.atan2(e.y - c.y, e.x - c.x);
    let delta = a1 - a0;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    // Minor arc; canvas angles increase clockwise with y-down + atan2.
    const anticlockwise = delta < 0;
    return { c, s, e, r, a0, a1, delta, anticlockwise, mode: sec.mode === "sector" ? "sector" : "arc" };
  }

  function angleOnMinorArc(ang, a0, delta) {
    let d = ang - a0;
    while (d <= -Math.PI) d += Math.PI * 2;
    while (d > Math.PI) d -= Math.PI * 2;
    if (delta >= 0) return d >= -1e-9 && d <= delta + 1e-9;
    return d <= 1e-9 && d >= delta - 1e-9;
  }

  function syncExportCropUI() {
    const btn = document.getElementById("btnClearExportCrop");
    if (btn) btn.hidden = !exportCrop;
    const previewClear = document.getElementById("btnPreviewClearCrop");
    if (previewClear) previewClear.disabled = !exportCrop;
  }

  function clearExportCrop() {
    exportCrop = null;
    syncExportCropUI();
    updateStatus();
    draw();
  }

  function exportBounds() {
    if (exportCrop) {
      return {
        minX: exportCrop.minX,
        minY: exportCrop.minY,
        maxX: exportCrop.maxX,
        maxY: exportCrop.maxY,
      };
    }
    return boundsWorld();
  }

  function updateStatus() {
    statusTool.textContent = t("status_tool") + (TOOL_NAMES[tool] || tool);
    if (hoverSnap) {
      const lab = labels.find((l) => l.pointId === hoverSnap);
      const p = pointById(hoverSnap);
      statusSnap.textContent =
        t("status_snap") + (lab ? lab.text : p ? `(${p.x.toFixed(0)},${p.y.toFixed(0)})` : t("snap_point"));
    } else if (hoverGeomSnap) {
      const kindLabel =
        hoverGeomSnap.kind === "circle"
          ? t("snap_circle")
          : hoverGeomSnap.kind === "ellipse"
            ? t("snap_ellipse")
            : hoverGeomSnap.kind === "sector"
              ? t("snap_sector")
              : t("snap_seg");
      statusSnap.textContent =
        t("status_snap") +
        kindLabel +
        " (" +
        hoverGeomSnap.x.toFixed(0) +
        "," +
        hoverGeomSnap.y.toFixed(0) +
        ")";
    } else {
      statusSnap.textContent = t("status_snap_none");
    }

    if (draft && (draft.kind === "rightAngle" || draft.kind === "angleArc" || draft.kind === "reflex")) {
      statusHint.textContent = draft.arm1 ? t("hint_second_arm") : t("hint_reflex_arms");
      return;
    }
    if (tool === "parallel") {
      statusHint.textContent = t("hint_parallel");
      return;
    }
    if (tool === "equal") {
      statusHint.textContent = t("hint_equal");
      return;
    }
    if (draft && draft.kind === "intersect") {
      statusHint.textContent = draft.seg1
        ? (uiLang === "en" ? "Click the second segment" : "請再點第二條線段")
        : (uiLang === "en" ? "Click the first segment" : "請點第一條線段");
      return;
    }

    const hints = {
      select: t("hint_select"),
      hand: t("hint_hand"),
      point: t("hint_point") + (gridSnap ? (uiLang === "en" ? " (grid on)" : "（網格吸附開）") : ""),
      line: t("hint_line"),
      horizontal: t("hint_horizontal"),
      circle: t("hint_circle"),
      ellipse: t("hint_ellipse"),
      sector: sectorMode === "sector" ? t("hint_sector_pie") : t("hint_sector_arc"),
      exportCrop: exportCrop ? t("hint_exportCrop_set") : t("hint_exportCrop"),
      label: t("hint_label"),
      intersect: t("hint_intersect"),
      rightAngle: t("hint_rightAngle"),
      angleArc: t("hint_angleArc"),
      reflex: t("hint_reflex"),
      coord: t("hint_coord"),
      midTick: t("hint_midTick"),
      ratio: t("hint_ratio"),
      length: t("hint_length"),
      perpendicular: t("hint_perpendicular"),
      tangent: t("hint_tangent"),
      circlePart: t("hint_circlePart"),
      shape: t("hint_shape"),
      fill:
        fillMode === "sector"
          ? t("hint_fill_sector")
          : fillMode === "segment"
            ? t("hint_fill_segment")
            : t("hint_fill"),
    };
    statusHint.textContent = hints[tool] || "";
  }

  function syncCanvasPanCursor() {
    canvas.classList.toggle("tool-hand", tool === "hand");
    if (tool === "hand" || spaceDown) canvas.classList.add("space-pan");
    else if (!panning) canvas.classList.remove("space-pan", "panning");
  }

  function setTool(name) {
    if (name && name !== tool) previousTool = tool;
    tool = name;
    draft = null;
    document.querySelectorAll(".tool").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === name);
    });
    const cropBtn = document.getElementById("btnExportCrop");
    if (cropBtn) cropBtn.classList.toggle("active", name === "exportCrop");
    syncCanvasPanCursor();
    syncMarkGroupUI();
    syncSectorModeUI();
    syncFillPresetUI();
    syncFillModeUI();
    syncShapeModeUI();
    syncCirclePartModeUI();
    syncContextualFloats();
    updateStatus();
    draw();
  }

  function setLineStyle(style) {
    lineStyle = style;
    document.querySelectorAll(".style-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.style === style);
    });
    const targets = selection.filter(
      (s) =>
        s.type === "segment" ||
        s.type === "circle" ||
        s.type === "ellipse" ||
        s.type === "sector"
    );
    if (!targets.length) return;
    let changed = false;
    for (const t of targets) {
      if (t.type === "segment") {
        const seg = segmentById(t.id);
        if (seg && seg.style !== style) {
          if (!changed) {
            pushHistory();
            changed = true;
          }
          seg.style = style;
        }
      } else if (t.type === "circle") {
        const cir = circles.find((c) => c.id === t.id);
        if (cir && circleStyle(cir) !== style) {
          if (!changed) {
            pushHistory();
            changed = true;
          }
          cir.style = style;
        }
      } else if (t.type === "ellipse") {
        const el = ellipses.find((c) => c.id === t.id);
        if (el && ellipseStyle(el) !== style) {
          if (!changed) {
            pushHistory();
            changed = true;
          }
          el.style = style;
        }
      } else {
        const sec = sectors.find((c) => c.id === t.id);
        if (sec && sectorStyle(sec) !== style) {
          if (!changed) {
            pushHistory();
            changed = true;
          }
          sec.style = style;
        }
      }
    }
    if (changed) draw();
  }

  function bumpLetter() {
    if (nextLetter === "Z") {
      nextLetter = "A";
      return;
    }
    nextLetter = String.fromCharCode(nextLetter.charCodeAt(0) + 1);
  }

  function takeNextLetter() {
    const t = nextLetter;
    bumpLetter();
    return t;
  }

  // ——— History ———
  function snapshot() {
    return JSON.stringify({
      points,
      segments,
      labels,
      rightAngles,
      angleArcs,
      midTicks,
      parallelMarks,
      equalMarks,
      lengthLabels,
      circles,
      ellipses,
      sectors,
      fills,
      coordPlots,
      nextLetter,
      labelFontSize,
      rightAngleSize,
      activeParallelGroup,
      activeEqualGroup,
      activeArcGroup,
      gridSnap,
      gridMode,
      hideExportPoints,
      layers,
      fillMode,
      shapeMode,
      circlePartMode,
    });
  }

  function restore(json) {
    const data = JSON.parse(json);
    points = data.points || [];
    segments = data.segments || [];
    labels = (data.labels || []).map((l) => ({
      ...l,
      size: clampLabelSize(l.size || DEFAULT_LABEL_SIZE),
    }));
    rightAngles = (data.rightAngles || []).map((r) => ({
      ...r,
      size: r.size || DEFAULT_RA_SIZE,
    }));
    angleArcs = (data.angleArcs || []).map((a) => ({
      ...a,
      size: a.size || DEFAULT_RA_SIZE,
      group: a.group ? 1 : 0,
      text: a.text || "",
      reflex: !!a.reflex,
    }));
    coordPlots = (data.coordPlots || []).map((p) => normalizeCoordPlot(p) || p);
    midTicks = data.midTicks || [];
    parallelMarks = (data.parallelMarks || []).map((m) => ({
      ...m,
      side: m.side === -1 ? -1 : 1,
    }));
    equalMarks = (data.equalMarks || []).map((m) => ({
      ...m,
      side: m.side === -1 ? -1 : 1,
    }));
    lengthLabels = (data.lengthLabels || []).map((m) => ({
      ...m,
      side: m.side === -1 ? -1 : 1,
    }));
    circles = data.circles || [];
    ellipses = data.ellipses || [];
    sectors = data.sectors || [];
    fills = (data.fills || []).map((f) => normalizeFillRecord(f)).filter(Boolean);
    if (data.activeParallelGroup != null) activeParallelGroup = data.activeParallelGroup ? 1 : 0;
    if (data.activeEqualGroup != null) activeEqualGroup = data.activeEqualGroup ? 1 : 0;
    if (data.activeArcGroup != null) activeArcGroup = data.activeArcGroup ? 1 : 0;
    if (data.gridSnap != null) {
      gridSnap = !!data.gridSnap;
      if (chkGridSnap) chkGridSnap.checked = gridSnap;
    }
    if (data.gridMode === "square" || data.gridMode === "triangle") {
      gridMode = data.gridMode;
      syncGridModeUI();
    }
    if (data.hideExportPoints != null) {
      hideExportPoints = !!data.hideExportPoints;
      if (chkHideExportPoints) chkHideExportPoints.checked = hideExportPoints;
    }
    if (data.layers && typeof data.layers === "object") {
      layers = {
        gridShow: data.layers.gridShow != null ? !!data.layers.gridShow : true,
        gridLock: !!data.layers.gridLock,
        coordsShow: data.layers.coordsShow != null ? !!data.layers.coordsShow : true,
        coordsLock: !!data.layers.coordsLock,
        helpersShow: data.layers.helpersShow != null ? !!data.layers.helpersShow : true,
        helpersLock: !!data.layers.helpersLock,
      };
      syncLayersUI();
    }
    if (data.fillMode === "sector" || data.fillMode === "segment" || data.fillMode === "polygon") {
      fillMode = data.fillMode;
      syncFillModeUI();
    }
    if (
      data.shapeMode === "square" ||
      data.shapeMode === "equilateral" ||
      data.shapeMode === "rect" ||
      data.shapeMode === "iso"
    ) {
      shapeMode = data.shapeMode;
      syncShapeModeUI();
    }
    if (
      data.circlePartMode === "chord" ||
      data.circlePartMode === "diameter" ||
      data.circlePartMode === "radius"
    ) {
      circlePartMode = data.circlePartMode;
      syncCirclePartModeUI();
    }
    nextLetter = data.nextLetter || "A";
    labelFontSize = clampLabelSize(data.labelFontSize || labelFontSize || DEFAULT_LABEL_SIZE);
    rightAngleSize = data.rightAngleSize || rightAngleSize || DEFAULT_RA_SIZE;
    if (labelSizeSelect) labelSizeSelect.value = String(labelFontSize);
    if (rightAngleSizeSelect) rightAngleSizeSelect.value = String(rightAngleSize);
    setSelection([]);
    draft = null;
    pendingLabelPoint = null;
    pendingRatioSeg = null;
    pendingArcLabelId = null;
    pendingLengthSeg = null;
    draw();
  }

  function pushHistory() {
    history = history.slice(0, histIndex + 1);
    history.push(snapshot());
    if (history.length > HIST_MAX) history.shift();
    histIndex = history.length - 1;
    refreshEditButtons();
  }

  function undo() {
    if (histIndex <= 0) return;
    if (histIndex === history.length - 1) {
      const cur = snapshot();
      if (history[histIndex] !== cur) history.push(cur);
    }
    histIndex--;
    restore(history[histIndex]);
    refreshEditButtons();
  }

  function redo() {
    if (histIndex >= history.length - 1) return;
    histIndex++;
    restore(history[histIndex]);
    refreshEditButtons();
  }

  function refreshEditButtons() {
    document.getElementById("btnUndo").disabled = histIndex <= 0;
    document.getElementById("btnRedo").disabled = histIndex >= history.length - 1;
  }

  function initHistory() {
    history = [snapshot()];
    histIndex = 0;
    refreshEditButtons();
    markDocClean();
  }

  // ——— Geometry helpers ———
  function nearestPointHit(wx, wy) {
    const thresh = HIT_POINT / view.scale;
    let best = null;
    let bestD = thresh;
    for (const p of points) {
      const d = dist(p, { x: wx, y: wy });
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  function distToSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return dist(p, a);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
  }

  function nearestSegmentHit(wx, wy) {
    const thresh = HIT_LINE / view.scale;
    let best = null;
    let bestD = thresh;
    for (const seg of segments) {
      const a = pointById(seg.a);
      const b = pointById(seg.b);
      if (!a || !b) continue;
      const d = distToSegment({ x: wx, y: wy }, a, b);
      if (d < bestD) {
        bestD = d;
        best = seg;
      }
    }
    return best;
  }

  function nearestLabelHit(wx, wy) {
    const thresh = 14 / view.scale;
    for (const lab of labels) {
      const p = pointById(lab.pointId);
      if (!p) continue;
      if (dist({ x: wx, y: wy }, { x: p.x + lab.ox, y: p.y + lab.oy }) < thresh) return lab;
    }
    return null;
  }

  function nearestRightHit(wx, wy) {
    const thresh = 12 / view.scale;
    for (const ra of rightAngles) {
      const v = pointById(ra.vertex);
      if (!v) continue;
      if (dist({ x: wx, y: wy }, v) < thresh * 1.5) return ra;
    }
    return null;
  }

  function nearestAngleArcHit(wx, wy) {
    const thresh = 14 / view.scale;
    let best = null;
    let bestD = thresh;
    for (const arc of angleArcs) {
      const v = pointById(arc.vertex);
      const a1 = pointById(arc.arm1);
      const a2 = pointById(arc.arm2);
      if (!v || !a1 || !a2) continue;
      const r = ((arc.size || DEFAULT_RA_SIZE) * ANGLE_ARC_R) / view.scale;
      // sample mid-angle point on arc
      const ang1 = Math.atan2(a1.y - v.y, a1.x - v.x);
      const ang2 = Math.atan2(a2.y - v.y, a2.x - v.x);
      const delta = angleSweepDelta(ang1, ang2, !!arc.reflex);
      const mid = ang1 + delta / 2;
      const rr = r * (arc.reflex ? 1.15 : 1);
      const px = v.x + Math.cos(mid) * rr;
      const py = v.y + Math.sin(mid) * rr;
      const d = dist({ x: wx, y: wy }, { x: px, y: py });
      if (d < bestD) {
        bestD = d;
        best = arc;
      }
    }
    return best;
  }

  function nearestSegMarkHit(wx, wy, list, type) {
    const thresh = 14 / view.scale;
    let best = null;
    let bestD = thresh;
    for (const m of list) {
      const seg = segmentById(m.segmentId);
      if (!seg) continue;
      const a = pointById(seg.a);
      const b = pointById(seg.b);
      if (!a || !b) continue;
      const kind = type === "parallelMark" ? "parallel" : "equal";
      const t = markTAlong(kind, m.segmentId, m.group);
      const pos = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      };
      const d = dist({ x: wx, y: wy }, pos);
      if (d < bestD) {
        bestD = d;
        best = { type, id: m.id };
      }
    }
    return best;
  }

  function hitTest(wx, wy) {
    const helpersOk = !!layers.helpersShow && !layers.helpersLock;
    const coordsOk = !!layers.coordsShow && !layers.coordsLock;
    const p = nearestPointHit(wx, wy);
    if (p) return { type: "point", id: p.id };
    const lab = nearestLabelHit(wx, wy);
    if (lab) return { type: "label", id: lab.id };
    if (helpersOk) {
      const ll = nearestLengthHit(wx, wy);
      if (ll) return { type: "lengthLabel", id: ll.id };
      const ra = nearestRightHit(wx, wy);
      if (ra) return { type: "rightAngle", id: ra.id };
      const aa = nearestAngleArcHit(wx, wy);
      if (aa) return { type: "angleArc", id: aa.id };
      const pm = nearestSegMarkHit(wx, wy, parallelMarks, "parallelMark");
      if (pm) return pm;
      const em = nearestSegMarkHit(wx, wy, equalMarks, "equalMark");
      if (em) return em;
    }
    const cir = nearestCircleHit(wx, wy);
    if (cir) return { type: "circle", id: cir.id };
    const el = nearestEllipseHit(wx, wy);
    if (el) return { type: "ellipse", id: el.id };
    const sec = nearestSectorHit(wx, wy);
    if (sec) return { type: "sector", id: sec.id };
    const seg = nearestSegmentHit(wx, wy);
    if (seg) return { type: "segment", id: seg.id };
    const fillHit = nearestFillHit(wx, wy);
    if (fillHit) return { type: "fill", id: fillHit.id };
    if (coordsOk) {
      const clab = nearestCoordCurveLabelHit(wx, wy);
      if (clab) return { type: "coordPlot", id: clab.plotId, curveId: clab.curveId, label: true };
      const cp = nearestCoordPlotHit(wx, wy);
      if (cp) return { type: "coordPlot", id: cp.id };
    }
    return null;
  }

  function connectedNeighbors(pointId) {
    const ids = new Set();
    for (const seg of segments) {
      if (seg.a === pointId) ids.add(seg.b);
      if (seg.b === pointId) ids.add(seg.a);
    }
    return [...ids];
  }

  function snapRightArm(wx, wy, vertexId, excludeId) {
    const thresh = SNAP_PX / view.scale;
    const candidates = connectedNeighbors(vertexId).filter((id) => id !== excludeId);
    let best = null;
    let bestD = thresh;
    for (const id of candidates) {
      const p = pointById(id);
      if (!p) continue;
      const d = dist(p, { x: wx, y: wy });
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best) return best;
    return snapWorld(wx, wy, vertexId);
  }

  function pointOnSegment(seg, t) {
    const a = pointById(seg.a);
    const b = pointById(seg.b);
    if (!a || !b) return null;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  function findOrCreatePointAt(x, y, skipHist) {
    const sn = snapWorld(x, y);
    if (sn && dist(sn, { x, y }) < (SNAP_PX * 0.6) / view.scale) return sn;
    return addPoint(x, y, skipHist);
  }

  function parseRatio(str) {
    const s = String(str || "").trim().replace(/\s+/g, "");
    if (!s) return null;
    // a:b
    let m = s.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
    if (m) {
      const a = parseFloat(m[1]);
      const b = parseFloat(m[2]);
      if (a < 0 || b < 0 || a + b === 0) return null;
      return a / (a + b);
    }
    // t=1/3 or 1/3
    m = s.match(/^(?:t=)?(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/i);
    if (m) {
      const num = parseFloat(m[1]);
      const den = parseFloat(m[2]);
      if (den === 0) return null;
      const t = num / den;
      if (t < 0 || t > 1) return null;
      return t;
    }
    // plain decimal 0.5
    m = s.match(/^(?:t=)?(\d+(?:\.\d+)?)$/i);
    if (m) {
      const t = parseFloat(m[1]);
      if (t < 0 || t > 1) return null;
      return t;
    }
    return null;
  }

  function projectPointToSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return { x: a.x, y: a.y, t: 0, onSeg: true };
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    const clamped = Math.max(0, Math.min(1, t));
    return {
      x: a.x + clamped * dx,
      y: a.y + clamped * dy,
      t: clamped,
      onSeg: t >= -1e-9 && t <= 1 + 1e-9,
      tRaw: t,
    };
  }

  /** Infinite-line intersection of segments AB and CD. */
  function lineIntersection(a, b, c, d) {
    const x1 = a.x, y1 = a.y, x2 = b.x, y2 = b.y;
    const x3 = c.x, y3 = c.y, x4 = d.x, y4 = d.y;
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 1e-9) return null;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1), t };
  }

  function nearestCircleHit(wx, wy) {
    const thresh = HIT_LINE / view.scale;
    let best = null;
    let bestD = thresh;
    for (const cir of circles) {
      const c = pointById(cir.centerId);
      const thr = pointById(cir.throughId);
      if (!c || !thr) continue;
      const r = dist(c, thr);
      const d = Math.abs(dist(c, { x: wx, y: wy }) - r);
      if (d < bestD) {
        bestD = d;
        best = cir;
      }
    }
    return best;
  }

  function circleGeomBasic(cir) {
    if (!cir) return null;
    const c = pointById(cir.centerId);
    const thr = pointById(cir.throughId);
    if (!c || !thr) return null;
    const r = dist(c, thr);
    if (r < 1e-9) return null;
    return { c, r };
  }

  function pointLiesOnCircle(cir, p, eps) {
    const g = circleGeomBasic(cir);
    if (!g || !p) return false;
    const tol = eps != null ? eps : 3 / view.scale;
    return Math.abs(dist(g.c, p) - g.r) <= tol;
  }

  function projectOntoCircle(cir, wx, wy) {
    const g = circleGeomBasic(cir);
    if (!g) return null;
    const dx = wx - g.c.x;
    const dy = wy - g.c.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return { x: g.c.x + g.r, y: g.c.y };
    return { x: g.c.x + (dx / len) * g.r, y: g.c.y + (dy / len) * g.r };
  }

  /** Unit tangent (±) at point p on circle (perpendicular to radius). */
  function tangentUnitAt(cir, p) {
    const g = circleGeomBasic(cir);
    if (!g || !p) return null;
    const ux = (p.x - g.c.x) / g.r;
    const uy = (p.y - g.c.y) / g.r;
    return { tx: -uy, ty: ux };
  }

  function circlesThroughPoint(p) {
    if (!p) return [];
    const eps = 3 / view.scale;
    return circles.filter((cir) => pointLiesOnCircle(cir, p, eps));
  }

  function nearestEllipseHit(wx, wy) {
    const thresh = HIT_LINE / view.scale;
    let best = null;
    let bestD = thresh;
    for (const el of ellipses) {
      const dims = ellipseDims(el);
      if (!dims) continue;
      const { c, rx, ry } = dims;
      if (rx < 1e-9 || ry < 1e-9) continue;
      const nx = (wx - c.x) / rx;
      const ny = (wy - c.y) / ry;
      const len = Math.hypot(nx, ny);
      if (len < 1e-9) continue;
      const px = c.x + (nx / len) * rx;
      const py = c.y + (ny / len) * ry;
      const d = Math.hypot(wx - px, wy - py);
      if (d < bestD) {
        bestD = d;
        best = el;
      }
    }
    return best;
  }

  function nearestSectorHit(wx, wy) {
    const thresh = HIT_LINE / view.scale;
    let best = null;
    let bestD = thresh;
    for (const sec of sectors) {
      const g = sectorGeom(sec);
      if (!g) continue;
      const dx = wx - g.c.x;
      const dy = wy - g.c.y;
      const distC = Math.hypot(dx, dy);
      if (distC < 1e-9) continue;
      const ang = Math.atan2(dy, dx);
      const dArc = Math.abs(distC - g.r);
      let d = Infinity;
      if (angleOnMinorArc(ang, g.a0, g.delta)) d = dArc;
      if (g.mode === "sector") {
        // also hit radii
        const projS = projectPointToSegment({ x: wx, y: wy }, g.c, g.s);
        const projE = projectPointToSegment(
          { x: wx, y: wy },
          g.c,
          { x: g.c.x + Math.cos(g.a1) * g.r, y: g.c.y + Math.sin(g.a1) * g.r }
        );
        d = Math.min(d, dist({ x: wx, y: wy }, projS), dist({ x: wx, y: wy }, projE));
      }
      if (d < bestD) {
        bestD = d;
        best = sec;
      }
    }
    return best;
  }

  function nearestLengthHit(wx, wy) {
    const thresh = 14 / view.scale;
    let best = null;
    let bestD = thresh;
    for (const ll of lengthLabels) {
      const seg = segmentById(ll.segmentId);
      if (!seg) continue;
      const a = pointById(seg.a);
      const b = pointById(seg.b);
      if (!a || !b) continue;
      const side = ll.side === -1 ? -1 : 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      let dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const nx = -dy * side, ny = dx * side;
      const pos = { x: mx + nx * 14, y: my + ny * 14 };
      const d = dist({ x: wx, y: wy }, pos);
      if (d < bestD) {
        bestD = d;
        best = ll;
      }
    }
    return best;
  }

  // ——— Mutations ———
  function addPoint(x, y, skipHist, marker, skipGrid) {
    const g = skipGrid ? { x, y } : applyGrid(x, y);
    if (!skipHist) pushHistory();
    const p = { id: uid(), x: g.x, y: g.y };
    if (marker) p.marker = marker;
    points.push(p);
    return p;
  }

  function addSegment(aId, bId, style, skipHist) {
    if (aId === bId) return null;
    if (segments.some((s) => (s.a === aId && s.b === bId) || (s.a === bId && s.b === aId))) {
      return null;
    }
    if (!skipHist) pushHistory();
    const seg = { id: uid(), a: aId, b: bId, style: style || lineStyle };
    segments.push(seg);
    return seg;
  }

  function distPointToSeg2D(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay;
    const len2 = vx * vx + vy * vy || 1;
    let t = ((px - ax) * vx + (py - ay) * vy) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t * vx, qy = ay + t * vy;
    return Math.hypot(px - qx, py - qy);
  }

  /** Auto offset so label sits off nearby strokes; used when ox/oy not explicit. */
  function defaultLabelOffset(pointId) {
    const p = pointById(pointId);
    if (!p) return { ox: 0, oy: -14 };
    const nbs = connectedNeighbors(pointId);
    const edgeDirs = [];
    for (const nid of nbs) {
      const q = pointById(nid);
      if (!q) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      edgeDirs.push({ x: dx / len, y: dy / len });
    }
    const candidates = [
      [0, -1],
      [1, -1],
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
      [-1, 0],
      [-1, -1],
      [0.5, -1],
      [-0.5, -1],
      [1, -0.5],
      [-1, -0.5],
    ];
    const distOffs = [12, 16, 20, 24];
    let best = { ox: 0, oy: -14 };
    let bestScore = -Infinity;
    const fontApprox = clampLabelSize(labelFontSize);
    for (const distOff of distOffs) {
      for (const [dx, dy] of candidates) {
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const ox = ux * distOff;
        const oy = uy * distOff;
        const lx = p.x + ox;
        const ly = p.y + oy;
        let dirScore;
        if (!edgeDirs.length) dirScore = uy < 0 ? 2 : 1;
        else {
          dirScore = Infinity;
          for (const e of edgeDirs) dirScore = Math.min(dirScore, 1 - (ux * e.x + uy * e.y));
        }
        let minStroke = Infinity;
        for (const seg of segments) {
          const a = pointById(seg.a);
          const b = pointById(seg.b);
          if (!a || !b) continue;
          const d = distPointToSeg2D(lx, ly, a.x, a.y, b.x, b.y);
          if (d < minStroke) minStroke = d;
        }
        for (const cir of circles) {
          const cen = pointById(cir.centerId);
          const thr = pointById(cir.throughId);
          if (!cen || !thr) continue;
          const r = Math.hypot(thr.x - cen.x, thr.y - cen.y);
          const d = Math.abs(Math.hypot(lx - cen.x, ly - cen.y) - r);
          if (d < minStroke) minStroke = d;
        }
        // Prefer clearance ≥ ~half glyph; penalize sitting on stroke
        const clear = Math.min(minStroke, fontApprox);
        const score = dirScore * 2 + clear * 0.35 - distOff * 0.02;
        if (score > bestScore) {
          bestScore = score;
          best = { ox, oy };
        }
      }
    }
    return best;
  }

  /** Soft auto-nudge for length label side if the default side sits on clutter — keep side flip only. */
  function preferLengthSide(segId) {
    const seg = segmentById(segId);
    if (!seg) return 1;
    const a = pointById(seg.a);
    const b = pointById(seg.b);
    if (!a || !b) return 1;
    let bestSide = 1;
    let best = -Infinity;
    for (const side of [1, -1]) {
      const place = lengthLabelPlacement(seg, side, (x, y) => ({ x, y }), 14);
      if (!place) continue;
      let minD = Infinity;
      for (const s2 of segments) {
        if (s2.id === segId) continue;
        const p = pointById(s2.a);
        const q = pointById(s2.b);
        if (!p || !q) continue;
        minD = Math.min(minD, distPointToSeg2D(place.x, place.y, p.x, p.y, q.x, q.y));
      }
      if (minD > best) {
        best = minD;
        bestSide = side;
      }
    }
    return bestSide;
  }

  function addLabel(pointId, text, ox, oy, size, skipHist) {
    if (!skipHist) pushHistory();
    labels = labels.filter((l) => l.pointId !== pointId);
    const off = ox != null && oy != null ? { ox, oy } : defaultLabelOffset(pointId);
    const lab = {
      id: uid(),
      pointId,
      text,
      ox: off.ox,
      oy: off.oy,
      size: clampLabelSize(size || labelFontSize),
    };
    labels.push(lab);
    return lab;
  }

  function openLabelPrompt(pointId, presetText) {
    pendingLabelPoint = pointId;
    labelInput.value = presetText || nextLetter;
    if (labelSizeInput) labelSizeInput.value = String(labelFontSize);
    labelDialog.showModal();
    labelInput.select();
  }

  /** Apply default letter/size with no dialog (right-click). */
  function placeLabelQuick(pointId) {
    const text = nextLetter || "A";
    addLabel(pointId, text, null, null, labelFontSize);
    if (text.length === 1 && text >= "A" && text <= "Z") {
      bumpLetter();
    }
    const labId = labels.find((l) => l.pointId === pointId)?.id;
    setSelection([labId ? { type: "label", id: labId } : { type: "point", id: pointId }]);
    updateStatus();
    draw();
  }

  function handleLabelClick(world, withDialog) {
    const sn = snapWorld(world.x, world.y) || nearestPointHit(world.x, world.y);
    if (!sn) {
      statusHint.textContent = "請先點選一個頂點";
      return;
    }
    if (withDialog) openLabelPrompt(sn.id, nextLetter);
    else placeLabelQuick(sn.id);
  }

  function setLabelFontSize(size) {
    const n = clampLabelSize(size);
    labelFontSize = n;
    if (labelSizeSelect) labelSizeSelect.value = String(n);
    if (labelSizeInput) labelSizeInput.value = String(n);
    const labs = selection
      .filter((s) => s.type === "label")
      .map((s) => labels.find((l) => l.id === s.id))
      .filter(Boolean);
    if (!labs.length) return;
    if (labs.some((l) => l.size !== n)) {
      pushHistory();
      for (const lab of labs) lab.size = n;
      draw();
    }
  }

  function setRightAngleSize(size) {
    const n = Number(size) || DEFAULT_RA_SIZE;
    rightAngleSize = n;
    if (rightAngleSizeSelect) rightAngleSizeSelect.value = String(n);
    const ras = selection
      .filter((s) => s.type === "rightAngle")
      .map((s) => rightAngles.find((r) => r.id === s.id))
      .filter(Boolean);
    const arcs = selection
      .filter((s) => s.type === "angleArc")
      .map((s) => angleArcs.find((r) => r.id === s.id))
      .filter(Boolean);
    if (!ras.length && !arcs.length) return;
    if (ras.some((r) => r.size !== n) || arcs.some((a) => a.size !== n)) {
      pushHistory();
      for (const ra of ras) ra.size = n;
      for (const arc of arcs) arc.size = n;
      draw();
    }
  }


  function clearAll() {
    const empty =
      !points.length &&
      !segments.length &&
      !labels.length &&
      !rightAngles.length &&
      !angleArcs.length &&
      !midTicks.length &&
      !parallelMarks.length &&
      !equalMarks.length &&
      !lengthLabels.length &&
      !circles.length &&
      !ellipses.length &&
      !sectors.length &&
      !fills.length &&
      !coordPlots.length;
    if (empty) {
      statusHint.textContent = "畫布已是空白";
      return;
    }
    if (!window.confirm("確定清除全部？")) return;
    pushHistory();
    points = [];
    segments = [];
    labels = [];
    rightAngles = [];
    angleArcs = [];
    midTicks = [];
    parallelMarks = [];
    equalMarks = [];
    lengthLabels = [];
    circles = [];
    ellipses = [];
    sectors = [];
    fills = [];
    coordPlots = [];
    setSelection([]);
    draft = null;
    hoverSnap = null;
    hoverGeomSnap = null;
    pendingLabelPoint = null;
    pendingRatioSeg = null;
    pendingArcLabelId = null;
    pendingLengthSeg = null;
    pendingCoordEditId = null;
    nextLetter = "A";
    applyDocumentViewDefaults();
    fitEmptyView();
    // Tip of history remains the pre-clear snapshot; Ctrl+Z restores it.
    updateStatus();
    draw();
    markDocClean();
  }

  function deleteOne(type, id) {
    if (type === "point") {
      points = points.filter((p) => p.id !== id);
      segments = segments.filter((s) => s.a !== id && s.b !== id);
      labels = labels.filter((l) => l.pointId !== id);
      rightAngles = rightAngles.filter(
        (r) => r.vertex !== id && r.arm1 !== id && r.arm2 !== id
      );
      angleArcs = angleArcs.filter(
        (r) => r.vertex !== id && r.arm1 !== id && r.arm2 !== id
      );
      circles = circles.filter((c) => c.centerId !== id && c.throughId !== id);
      ellipses = ellipses.filter(
        (e) => e.centerId !== id && e.rxId !== id && e.ryId !== id
      );
      sectors = sectors.filter(
        (s) => s.centerId !== id && s.startId !== id && s.endId !== id
      );
      fills = fills.filter((f) => {
        const refs = fillReferencedPointIds(f);
        return !refs.includes(id);
      });
      midTicks = midTicks.filter((m) => m.pointId !== id);
      const segIds = new Set(segments.map((s) => s.id));
      midTicks = midTicks.filter((m) => segIds.has(m.segmentId));
      parallelMarks = parallelMarks.filter((m) => segIds.has(m.segmentId));
      equalMarks = equalMarks.filter((m) => segIds.has(m.segmentId));
      lengthLabels = lengthLabels.filter((m) => segIds.has(m.segmentId));
    } else if (type === "segment") {
      segments = segments.filter((s) => s.id !== id);
      midTicks = midTicks.filter((m) => m.segmentId !== id);
      parallelMarks = parallelMarks.filter((m) => m.segmentId !== id);
      equalMarks = equalMarks.filter((m) => m.segmentId !== id);
      lengthLabels = lengthLabels.filter((m) => m.segmentId !== id);
    } else if (type === "label") {
      labels = labels.filter((l) => l.id !== id);
    } else if (type === "rightAngle") {
      rightAngles = rightAngles.filter((r) => r.id !== id);
    } else if (type === "angleArc") {
      angleArcs = angleArcs.filter((r) => r.id !== id);
    } else if (type === "midTick") {
      midTicks = midTicks.filter((m) => m.id !== id);
    } else if (type === "parallelMark") {
      parallelMarks = parallelMarks.filter((m) => m.id !== id);
    } else if (type === "equalMark") {
      equalMarks = equalMarks.filter((m) => m.id !== id);
    } else if (type === "lengthLabel") {
      lengthLabels = lengthLabels.filter((m) => m.id !== id);
    } else if (type === "circle") {
      circles = circles.filter((c) => c.id !== id);
      fills = fills.filter((f) => f.circleId !== id);
    } else if (type === "ellipse") {
      ellipses = ellipses.filter((e) => e.id !== id);
    } else if (type === "sector") {
      sectors = sectors.filter((s) => s.id !== id);
    } else if (type === "fill") {
      fills = fills.filter((f) => f.id !== id);
    } else if (type === "coordPlot") {
      coordPlots = coordPlots.filter((p) => p.id !== id);
    }
  }

  function deleteSelected() {
    if (!selection.length) return;
    pushHistory();
    const items = [...selection];
    // delete points last so dependent cleanup is simpler — actually delete non-points first
    items.sort((a, b) => (a.type === "point" ? 1 : 0) - (b.type === "point" ? 1 : 0));
    for (const { type, id } of items) deleteOne(type, id);
    setSelection([]);
    updateStatus();
    draw();
  }

  /** Ellipse: center → horizontal radius → vertical radius; style from final click. */
  function handleEllipseClick(world, completeStyle) {
    const sn = snapWorld(world.x, world.y) || nearestPointHit(world.x, world.y);
    if (!draft || draft.kind !== "ellipse") {
      const pid = sn ? sn.id : addPoint(world.x, world.y).id;
      draft = {
        kind: "ellipse",
        centerId: pid,
        rxId: null,
        cursor: { x: world.x, y: world.y },
      };
      statusHint.textContent = "再點水平半徑端點";
      draw();
      return;
    }
    const c = pointById(draft.centerId);
    if (!c) {
      draft = null;
      return;
    }
    if (!draft.rxId) {
      let rxPt;
      if (sn && sn.id !== draft.centerId) {
        // Lock to horizontal: reuse point if same y (or create at (sn.x, c.y))
        if (Math.abs(sn.y - c.y) < 0.5 / view.scale) {
          rxPt = sn;
        } else {
          rxPt = findOrCreatePointAt(sn.x, c.y, true);
        }
      } else {
        const gx = applyGrid(world.x, c.y);
        rxPt = findOrCreatePointAt(gx.x, c.y, true);
      }
      if (Math.abs(rxPt.x - c.x) < 1) {
        statusHint.textContent = "水平半徑太短，請再點";
        return;
      }
      draft.rxId = rxPt.id;
      draft.cursor = { x: c.x, y: world.y };
      statusHint.textContent = "再點鉛垂半徑端點（左鍵實線／右鍵虛線）";
      draw();
      return;
    }
    if (sn && (sn.id === draft.centerId || sn.id === draft.rxId)) return;
    let ryPt;
    if (sn) {
      if (Math.abs(sn.x - c.x) < 0.5 / view.scale) {
        ryPt = sn;
      } else {
        ryPt = findOrCreatePointAt(c.x, sn.y, true);
      }
    } else {
      const gy = applyGrid(c.x, world.y);
      ryPt = findOrCreatePointAt(c.x, gy.y, true);
    }
    if (Math.abs(ryPt.y - c.y) < 1) {
      statusHint.textContent = "鉛垂半徑太短，請再點";
      return;
    }
    const style = completeStyle || "solid";
    pushHistory();
    ellipses.push({
      id: uid(),
      centerId: draft.centerId,
      rxId: draft.rxId,
      ryId: ryPt.id,
      style,
      backDashed: false,
    });
    history[histIndex] = snapshot();
    setSelection([{ type: "ellipse", id: ellipses[ellipses.length - 1].id }]);
    draft = null;
    updateStatus();
    draw();
  }

  /** Sector/arc: center → start (radius) → end angle; style from final click. */
  function handleSectorClick(world, completeStyle) {
    const sn = snapWorld(world.x, world.y) || nearestPointHit(world.x, world.y);
    if (!draft || draft.kind !== "sector") {
      const pid = sn ? sn.id : addPoint(world.x, world.y).id;
      draft = {
        kind: "sector",
        centerId: pid,
        startId: null,
        cursor: { x: world.x, y: world.y },
        mode: sectorMode,
      };
      statusHint.textContent = "再點弧起點（定半徑與起始角）";
      draw();
      return;
    }
    const c = pointById(draft.centerId);
    if (!c) {
      draft = null;
      return;
    }
    if (!draft.startId) {
      const start = sn && sn.id !== draft.centerId ? sn : addPoint(world.x, world.y, true);
      if (dist(c, start) < 1) {
        statusHint.textContent = "半徑太短，請再點";
        return;
      }
      draft.startId = start.id;
      draft.cursor = { x: world.x, y: world.y };
      statusHint.textContent =
        (draft.mode === "sector" ? "扇形" : "弧段") + "：再點終點（左鍵實線／右鍵虛線）";
      draw();
      return;
    }
    if (sn && (sn.id === draft.centerId || sn.id === draft.startId)) return;
    const start = pointById(draft.startId);
    if (!start) {
      draft = null;
      return;
    }
    const r = dist(c, start);
    const ang = Math.atan2(
      (sn ? sn.y : world.y) - c.y,
      (sn ? sn.x : world.x) - c.x
    );
    const ex = c.x + Math.cos(ang) * r;
    const ey = c.y + Math.sin(ang) * r;
    let endPt;
    if (sn && Math.abs(dist(c, sn) - r) < (SNAP_PX * 0.8) / view.scale) {
      endPt = sn;
    } else {
      endPt = findOrCreatePointAt(ex, ey, true);
    }
    if (endPt.id === draft.startId) {
      statusHint.textContent = "終點與起點太近，請再點";
      return;
    }
    const style = completeStyle || "solid";
    pushHistory();
    sectors.push({
      id: uid(),
      centerId: draft.centerId,
      startId: draft.startId,
      endId: endPt.id,
      style,
      mode: draft.mode === "sector" ? "sector" : "arc",
    });
    history[histIndex] = snapshot();
    setSelection([{ type: "sector", id: sectors[sectors.length - 1].id }]);
    draft = null;
    updateStatus();
    draw();
  }

  function handleLineClick(world, completeStyle) {
    const sn = snapWorld(world.x, world.y);
    if (!draft || draft.kind !== "line") {
      // First click: start point (left or right both OK)
      const pid = sn ? sn.id : addPoint(world.x, world.y).id;
      if (!sn) setSelection([{ type: "point", id: pid }]);
      draft = {
        kind: "line",
        from: pid,
        cursor: { x: world.x, y: world.y },
        previewStyle: completeStyle || "solid",
      };
      updateStatus();
      draw();
      return;
    }
    // Second click: style from mouse button (left solid / right dashed)
    const style = completeStyle || "solid";
    const fromId = draft.from;
    let created = null;
    if (sn) {
      if (sn.id !== fromId) created = addSegment(fromId, sn.id, style);
    } else {
      const p = addPoint(world.x, world.y);
      if (p.id !== fromId) {
        created = addSegment(fromId, p.id, style, true);
        history[histIndex] = snapshot();
      }
    }
    draft = null;
    if (created) {
      setSelection([{ type: "segment", id: created.id }]);
    } else {
      const existing = segments.find(
        (s) =>
          (s.a === fromId && sn && s.b === sn.id) ||
          (s.b === fromId && sn && s.a === sn.id)
      );
      if (existing) setSelection([{ type: "segment", id: existing.id }]);
    }
    updateStatus();
    draw();
  }

  function handleRightAngleClick(world) {
    if (!draft || draft.kind !== "rightAngle") {
      const sn = snapWorld(world.x, world.y) || nearestPointHit(world.x, world.y);
      if (!sn) {
        statusHint.textContent = "請點選直角頂點（corner）";
        return;
      }
      const nbs = connectedNeighbors(sn.id);
      if (nbs.length === 2) {
        pushHistory();
        rightAngles.push({
          id: uid(),
          vertex: sn.id,
          arm1: nbs[0],
          arm2: nbs[1],
          size: rightAngleSize,
        });
        setSelection([{ type: "rightAngle", id: rightAngles[rightAngles.length - 1].id }]);
        draft = null;
        updateStatus();
        draw();
        return;
      }
      draft = {
        kind: "rightAngle",
        vertex: sn.id,
        arm1: null,
        cursor: { x: world.x, y: world.y },
      };
      statusHint.textContent =
        nbs.length > 2 ? "請再點兩條邊的端點（候選已高亮）" : "請再點兩條邊的端點";
      draw();
      return;
    }

    const sn = snapRightArm(world.x, world.y, draft.vertex, draft.arm1);
    if (!sn) {
      statusHint.textContent = "請點選臂端點（高亮候選優先）";
      return;
    }
    if (!draft.arm1) {
      if (sn.id === draft.vertex) return;
      draft.arm1 = sn.id;
      statusHint.textContent = "請再點第二條臂的端點";
      draw();
      return;
    }
    if (sn.id === draft.vertex || sn.id === draft.arm1) return;
    pushHistory();
    rightAngles.push({
      id: uid(),
      vertex: draft.vertex,
      arm1: draft.arm1,
      arm2: sn.id,
      size: rightAngleSize,
    });
    setSelection([{ type: "rightAngle", id: rightAngles[rightAngles.length - 1].id }]);
    draft = null;
    updateStatus();
    draw();
  }

  function pushAngleArc(vertex, arm1, arm2, reflex) {
    angleArcs.push({
      id: uid(),
      vertex,
      arm1,
      arm2,
      size: rightAngleSize,
      group: activeArcGroup ? 1 : 0,
      text: "",
      reflex: !!reflex,
    });
    return angleArcs[angleArcs.length - 1];
  }

  function openArcLabelPrompt(arcId, presetText) {
    pendingArcLabelId = arcId;
    if (arcLabelInput) {
      arcLabelInput.value = presetText != null ? String(presetText) : "";
    }
    if (arcLabelDialog) {
      arcLabelDialog.showModal();
      if (arcLabelInput) {
        arcLabelInput.focus();
        arcLabelInput.select();
      }
    }
  }

  function finishAngleArcPlacement(arc) {
    setSelection([{ type: "angleArc", id: arc.id }]);
    draft = null;
    updateStatus();
    draw();
    openArcLabelPrompt(arc.id, "");
  }

  function handleAngleArcClick(world) {
    if (!draft || draft.kind !== "angleArc") {
      const sn = snapWorld(world.x, world.y) || nearestPointHit(world.x, world.y);
      if (!sn) {
        statusHint.textContent = "請點選角的頂點";
        return;
      }
      const nbs = connectedNeighbors(sn.id);
      if (nbs.length === 2) {
        pushHistory();
        const arc = pushAngleArc(sn.id, nbs[0], nbs[1], false);
        finishAngleArcPlacement(arc);
        return;
      }
      draft = {
        kind: "angleArc",
        vertex: sn.id,
        arm1: null,
        cursor: { x: world.x, y: world.y },
      };
      statusHint.textContent =
        nbs.length > 2 ? "請再點兩條邊的端點（候選已高亮）" : "請再點兩條邊的端點";
      draw();
      return;
    }

    const sn = snapRightArm(world.x, world.y, draft.vertex, draft.arm1);
    if (!sn) {
      statusHint.textContent = "請點選臂端點（高亮候選優先）";
      return;
    }
    if (!draft.arm1) {
      if (sn.id === draft.vertex) return;
      draft.arm1 = sn.id;
      statusHint.textContent = "請再點第二條臂的端點";
      draw();
      return;
    }
    if (sn.id === draft.vertex || sn.id === draft.arm1) return;
    pushHistory();
    const arc = pushAngleArc(draft.vertex, draft.arm1, sn.id, false);
    finishAngleArcPlacement(arc);
  }

  function handleReflexClick(world) {
    if (!draft || draft.kind !== "reflex") {
      const sn = snapWorld(world.x, world.y) || nearestPointHit(world.x, world.y);
      if (!sn) {
        statusHint.textContent = t("hint_reflex_vertex");
        return;
      }
      const nbs = connectedNeighbors(sn.id);
      if (nbs.length === 2) {
        pushHistory();
        const arc = pushAngleArc(sn.id, nbs[0], nbs[1], true);
        finishAngleArcPlacement(arc);
        return;
      }
      draft = {
        kind: "reflex",
        vertex: sn.id,
        arm1: null,
        cursor: { x: world.x, y: world.y },
      };
      statusHint.textContent = t("hint_reflex_arms");
      draw();
      return;
    }
    const sn = snapRightArm(world.x, world.y, draft.vertex, draft.arm1);
    if (!sn) {
      statusHint.textContent = t("hint_arm_end");
      return;
    }
    if (!draft.arm1) {
      if (sn.id === draft.vertex) return;
      draft.arm1 = sn.id;
      statusHint.textContent = t("hint_second_arm");
      draw();
      return;
    }
    if (sn.id === draft.vertex || sn.id === draft.arm1) return;
    pushHistory();
    const arc = pushAngleArc(draft.vertex, draft.arm1, sn.id, true);
    finishAngleArcPlacement(arc);
  }

  /** Signed minor delta in (-π, π]; reflex uses the complementary major sweep. */
  function angleSweepDelta(ang1, ang2, reflex) {
    let delta = ang2 - ang1;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    if (reflex) {
      if (delta > 0) delta -= Math.PI * 2;
      else delta += Math.PI * 2;
    }
    return delta;
  }


  // ——— Coordinate plots (simple exam axes + multi-curve overlays) ———
  let pendingCoordEditId = null;
  let coordDialogOpen = false;
  /** Window prefs captured when dialog turns angle-axis ON (before suggest). */
  let pendingAngleAxisSaved = null;
  /** Working copy of curves while dialog is open. */
  let coordDialogCurves = [];

  function defaultCurveParams(type) {
    if (type === "line") return { m: -1, c: 4 };
    if (type === "quad") return { a: 1, b: 0, c: 0 };
    if (type === "log") return { a: 1, base: 10 };
    if (type === "ln") return { a: 1 };
    if (type === "exp") return { a: 1, b: Math.E };
    if (type === "circle") return { h: 0, k: 0, r: 2, r2: 4, D: 0, E: 0, F: -4, circleForm: "general" };
    if (type === "sin") return { A: 1, B: 1, C: 0, D: 0 };
    if (type === "cos") return { A: 1, B: 1, C: 0, D: 0 };
    if (type === "tan") return { A: 1, B: 1, C: 0, D: 0 };
    if (type === "log10") return { a: 1, base: 10 };
    return {};
  }

  function defaultCurveLabel() {
    return {
      show: false,
      kind: "formula", // formula | custom
      formulaMode: "algebraic", // algebraic | numeric
      customText: "",
      t: 0.55, // 0–1 along visible curve samples
      n: 0.55, // +n = above curve (screen-up); axis units × unitPx
    };
  }

  function normalizeCurveLabel(lab) {
    const d = defaultCurveLabel();
    if (!lab || typeof lab !== "object") return d;
    let t = Number(lab.t);
    let n = Number(lab.n);
    // migrate legacy free world offsets → default t/n (above line)
    if (!Number.isFinite(t)) t = d.t;
    if (!Number.isFinite(n)) n = d.n;
    t = Math.min(1, Math.max(0, t));
    if (!Number.isFinite(n)) n = d.n;
    n = Math.min(6, Math.max(-6, n));
    return {
      show: !!lab.show,
      kind: lab.kind === "custom" ? "custom" : "formula",
      formulaMode: lab.formulaMode === "numeric" ? "numeric" : "algebraic",
      customText: lab.customText != null ? String(lab.customText) : "",
      t,
      n,
    };
  }

  function makeCoordCurve(type, params, label) {
    const t = type === "log10" ? "log" : type || "line";
    return {
      id: uid(),
      type: t,
      params: { ...defaultCurveParams(t), ...(params || {}) },
      label: normalizeCurveLabel(label),
    };
  }

  function coordFmtNum(n) {
    if (!Number.isFinite(n)) return "?";
    if (Math.abs(n) < 1e-12) return "0";
    if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
    const s = (Math.round(n * 1000) / 1000).toString();
    return s;
  }

  function coordFmtBase(base) {
    if (base === Math.E || base === "e" || base === "E") return "e";
    const n = Number(base);
    if (Number.isFinite(n)) return coordFmtNum(n);
    return String(base);
  }

  function coordTerm(coef, sym, first) {
    // algebraic helpers unused; numeric polynomial term
    const c = coef;
    if (!Number.isFinite(c) || Math.abs(c) < 1e-12) return "";
    const abs = Math.abs(c);
    const sign = c < 0 ? "−" : first ? "" : "+";
    const lead = first ? (c < 0 ? "−" : "") : sign;
    const body =
      abs === 1 && sym ? sym : coordFmtNum(abs) + (sym || "");
    if (first) return (c < 0 ? "−" : "") + (abs === 1 && sym ? sym : coordFmtNum(abs) + (sym || ""));
    return (c < 0 ? "−" : "+") + (abs === 1 && sym ? sym : coordFmtNum(abs) + (sym || ""));
  }

  function coordCurveFormulaText(curve, mode, optPlot) {
    const p = curve.params || {};
    const type = curve.type || "line";
    const alg = mode !== "numeric";
    if (type === "line") {
      if (alg) return "y = mx+c";
      const m = p.m ?? 1;
      const c = p.c ?? 0;
      let s = "y = ";
      if (Math.abs(m) < 1e-12) s += coordFmtNum(c);
      else {
        if (Math.abs(m - 1) < 1e-12) s += "x";
        else if (Math.abs(m + 1) < 1e-12) s += "−x";
        else s += coordFmtNum(m) + "x";
        if (Math.abs(c) >= 1e-12) s += (c < 0 ? "−" : "+") + coordFmtNum(Math.abs(c));
      }
      return s;
    }
    if (type === "quad") {
      if (alg) return "y = ax²+bx+c";
      const a = p.a ?? 1;
      const b = p.b ?? 0;
      const c = p.c ?? 0;
      let parts = [];
      if (Math.abs(a) >= 1e-12) {
        if (Math.abs(a - 1) < 1e-12) parts.push("x²");
        else if (Math.abs(a + 1) < 1e-12) parts.push("−x²");
        else parts.push(coordFmtNum(a) + "x²");
      }
      if (Math.abs(b) >= 1e-12) {
        const sign = parts.length ? (b < 0 ? "−" : "+") : b < 0 ? "−" : "";
        const abs = Math.abs(b);
        parts.push(sign + (abs === 1 ? "x" : coordFmtNum(abs) + "x"));
      }
      if (Math.abs(c) >= 1e-12 || !parts.length) {
        const sign = parts.length ? (c < 0 ? "−" : "+") : c < 0 ? "−" : "";
        parts.push(sign + coordFmtNum(Math.abs(c)));
      }
      return "y = " + parts.join("");
    }
    if (type === "log" || type === "log10") {
      if (alg) return "y = a·log_b(x)";
      const a = p.a ?? 1;
      const base = type === "log10" ? 10 : coordLogBase(p);
      const bs = coordFmtBase(base);
      let head = "y = ";
      if (Math.abs(a - 1) < 1e-12) head += "log";
      else if (Math.abs(a + 1) < 1e-12) head += "−log";
      else head += coordFmtNum(a) + "log";
      return head + (bs === "10" ? "₁₀" : "₍" + bs + "₎") + "(x)";
    }
    if (type === "ln") {
      if (alg) return "y = a·ln(x)";
      const a = p.a ?? 1;
      if (Math.abs(a - 1) < 1e-12) return "y = ln(x)";
      if (Math.abs(a + 1) < 1e-12) return "y = −ln(x)";
      return "y = " + coordFmtNum(a) + "ln(x)";
    }
    if (type === "exp") {
      if (alg) return "y = a·bˣ";
      const a = p.a ?? 1;
      const b = p.b ?? Math.E;
      const bs = b === Math.E ? "e" : coordFmtNum(b);
      let head = "y = ";
      if (Math.abs(a - 1) < 1e-12) head += "";
      else if (Math.abs(a + 1) < 1e-12) head += "−";
      else head += coordFmtNum(a) + "·";
      return head + bs + "ˣ";
    }
    if (type === "circle") {
      const form =
        p.circleForm === "center" ? "center" : p.circleForm === "standard" ? "standard" : "general";
      if (alg) {
        if (form === "center") return "centre (h,k), r";
        if (form === "standard") return "(x−h)²+(y−k)²=r²";
        return "x²+y²+Dx+Ey+F=0";
      }
      const h = p.h ?? 0;
      const k = p.k ?? 0;
      const r = coordCircleRadius(p);
      const r2 = Number.isFinite(Number(p.r2)) ? Number(p.r2) : r * r;
      if (form === "center") {
        return "centre (" + coordFmtNum(h) + "," + coordFmtNum(k) + "), r=" + coordFmtNum(r);
      }
      if (form === "standard") {
        const hx = Math.abs(h) < 1e-12 ? "x" : "x" + (h < 0 ? "+" : "−") + coordFmtNum(Math.abs(h));
        const ky = Math.abs(k) < 1e-12 ? "y" : "y" + (k < 0 ? "+" : "−") + coordFmtNum(Math.abs(k));
        return "(" + hx + ")²+(" + ky + ")²=" + coordFmtNum(Math.abs(r2));
      }
      // general numeric: x²+y²+Dx+Ey+F=0
      const D = Number.isFinite(Number(p.D)) ? Number(p.D) : -2 * h;
      const E = Number.isFinite(Number(p.E)) ? Number(p.E) : -2 * k;
      const F = Number.isFinite(Number(p.F)) ? Number(p.F) : h * h + k * k - r2;
      let s = "x²+y²";
      if (Math.abs(D) >= 1e-12) s += (D < 0 ? "−" : "+") + coordFmtNum(Math.abs(D)) + "x";
      if (Math.abs(E) >= 1e-12) s += (E < 0 ? "−" : "+") + coordFmtNum(Math.abs(E)) + "y";
      if (Math.abs(F) >= 1e-12) s += (F < 0 ? "−" : "+") + coordFmtNum(Math.abs(F));
      return s + "=0";
    }
    if (type === "sin" || type === "cos" || type === "tan") {
      const fn = type;
      const A = p.A ?? 1;
      const B = p.B ?? 1;
      const C = p.C ?? 0;
      const D = p.D ?? 0;
      const deg = !!optPlot && optPlot.xAngleUnit === "deg";
      if (alg) {
        if (type === "tan") return deg ? "y = A tan((Bx)°)" : "y = A tan(Bx)";
        return deg ? "y = A " + fn + "((Bx+C)°)+D" : "y = A " + fn + "(Bx+C)+D";
      }
      // numeric pretty print
      let s = "y = ";
      const absA = Math.abs(A);
      if (A < 0) s += "−";
      if (absA !== 1) s += coordFmtNum(absA);
      s += fn + "(";
      let arg = "";
      if (Math.abs(B - 1) < 1e-12) arg += "x";
      else if (Math.abs(B + 1) < 1e-12) arg += "−x";
      else arg += coordFmtNum(B) + "x";
      if (type !== "tan" && Math.abs(C) >= 1e-12) {
        arg += (C < 0 ? "−" : "+") + coordFmtNum(Math.abs(C));
      }
      s += deg ? "(" + arg + ")°" : arg;
      s += ")";
      if (type !== "tan" && Math.abs(D) >= 1e-12) {
        s += (D < 0 ? "−" : "+") + coordFmtNum(Math.abs(D));
      }
      return s;
    }
    return "";
  }

  function coordCurveLabelText(curve, plot) {
    const lab = normalizeCurveLabel(curve && curve.label);
    if (!lab.show) return "";
    if (lab.kind === "custom") return (lab.customText || "").trim();
    return coordCurveFormulaText(curve, lab.formulaMode, plot);
  }

  /** Visible sample points for label attachment. */
  function coordCurveLabelSamples(plot, curve) {
    return coordSampleOneCurve(plot, curve).filter(Boolean);
  }

  /**
   * Local tangent + normal at sample index.
   * Normal is oriented so +n is screen-up (world −y) = 「線上方」.
   */
  function coordCurveFrameAt(pts, idx) {
    const i0 = Math.max(0, idx - 1);
    const i1 = Math.min(pts.length - 1, idx + 1);
    let tx = pts[i1].x - pts[i0].x;
    let ty = pts[i1].y - pts[i0].y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    // Rotate +90° in y-down coords, then flip so normal points up (ny ≤ 0)
    let nx = -ty;
    let ny = tx;
    if (ny > 0 || (Math.abs(ny) < 1e-9 && nx < 0)) {
      nx = -nx;
      ny = -ny;
    }
    return { tx, ty, nx, ny };
  }

  /**
   * Place label at fraction t along curve with normal offset n (axis units).
   * +n = above the curve (screen-up). Stays attached when unitPx changes.
   */
  function coordCurveLabelPlacement(plot, curve, t, n) {
    const pts = coordCurveLabelSamples(plot, curve);
    const tt = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0.55));
    const nn = Number.isFinite(n) ? n : 0.55;
    if (!pts.length) {
      const fallback = coordWorldFromAxis(
        plot,
        (plot.xmin + plot.xmax) * 0.55,
        (plot.ymin + plot.ymax) * 0.5
      );
      return {
        pos: {
          x: fallback.x,
          y: fallback.y - nn * (plot.unitPx || 40),
        },
        idx: 0,
        pts,
      };
    }
    const idx = Math.min(pts.length - 1, Math.round(tt * (pts.length - 1)));
    const p = pts[idx];
    const fr = coordCurveFrameAt(pts, idx);
    const off = nn * (plot.unitPx || 40);
    return {
      pos: { x: p.x + fr.nx * off, y: p.y + fr.ny * off },
      idx,
      pts,
      tan: { x: fr.tx, y: fr.ty },
      nor: { x: fr.nx, y: fr.ny },
    };
  }

  function coordCurveLabelWorldPos(plot, curve) {
    const lab = normalizeCurveLabel(curve && curve.label);
    return coordCurveLabelPlacement(plot, curve, lab.t, lab.n).pos;
  }

  /** Update label t/n from a world pointer so it slides along the curve. */
  function assignCoordCurveLabelFromWorld(plot, curve, wx, wy) {
    if (!curve.label) curve.label = defaultCurveLabel();
    const lab = normalizeCurveLabel(curve.label);
    const pts = coordCurveLabelSamples(plot, curve);
    if (!pts.length) {
      curve.label = { ...lab, show: true, t: 0.55, n: 0.55 };
      return;
    }
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = dist({ x: wx, y: wy }, pts[i]);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    const t = pts.length === 1 ? 0.5 : bestI / (pts.length - 1);
    const fr = coordCurveFrameAt(pts, bestI);
    const dx = wx - pts[bestI].x;
    const dy = wy - pts[bestI].y;
    let n = (dx * fr.nx + dy * fr.ny) / (plot.unitPx || 40);
    if (!Number.isFinite(n)) n = 0.55;
    n = Math.min(6, Math.max(-6, n));
    // Mutate the live curve object (must be plot.curves entry, not a copy)
    curve.label = { ...lab, show: true, t, n };
  }

  /**
   * Normalize a coord plot in place (keeps curve object identity).
   * Critical for label drag — writers must mutate live plot.curves[].
   */
  function ensureCoordPlot(plot) {
    if (!plot || typeof plot !== "object") return null;
    if (!Array.isArray(plot.curves)) {
      const curves = [];
      const legacyType = plot.curveType || "none";
      if (legacyType && legacyType !== "none") {
        let t = legacyType;
        let params = { ...(plot.params || {}) };
        if (t === "log10") {
          t = "log";
          if (params.base == null) params.base = 10;
        }
        curves.push(makeCoordCurve(t, params));
      }
      plot.curves = curves;
    } else {
      for (let i = 0; i < plot.curves.length; i++) {
        const c = plot.curves[i];
        if (!c || typeof c !== "object") {
          plot.curves[i] = makeCoordCurve("line");
          continue;
        }
        if (!c.id) c.id = uid();
        let typ = c.type === "log10" ? "log" : c.type || "line";
        c.type = typ;
        c.params = { ...defaultCurveParams(typ), ...(c.params || {}) };
        if (typ === "log" && (c.params.base == null || c.params.base === 0)) {
          c.params.base = 10;
        }
        if (typ === "circle") c.params = syncCircleParams(c.params);
        c.label = normalizeCurveLabel(c.label);
      }
    }
    if (plot.showTickLabels == null) plot.showTickLabels = true;
    if (plot.showTicks == null) plot.showTicks = true;
    if (plot.showOrigin == null) plot.showOrigin = true;
    plot.xAngleUnit = plot.xAngleUnit === "deg" ? "deg" : "rad";
    plot.angleAxisOn = !!plot.angleAxisOn;
    if (plot.angleAxisSaved && typeof plot.angleAxisSaved === "object") {
      const s = plot.angleAxisSaved;
      plot.angleAxisSaved = {
        xmin: Number(s.xmin),
        xmax: Number(s.xmax),
        ymin: Number(s.ymin),
        ymax: Number(s.ymax),
        showTickLabels: s.showTickLabels !== false,
      };
      if (
        !Number.isFinite(plot.angleAxisSaved.xmin) ||
        !Number.isFinite(plot.angleAxisSaved.xmax) ||
        !Number.isFinite(plot.angleAxisSaved.ymin) ||
        !Number.isFinite(plot.angleAxisSaved.ymax)
      ) {
        delete plot.angleAxisSaved;
      }
    } else if (!plot.angleAxisOn) {
      delete plot.angleAxisSaved;
    }
    if (!Number.isFinite(plot.unitPx) || plot.unitPx <= 0) plot.unitPx = 40;
    delete plot.curveType;
    return plot;
  }

  /** Migrate / clone for load — returns a fresh normalized object. */
  function normalizeCoordPlot(raw) {
    if (!raw || typeof raw !== "object") return null;
    const plot = { ...raw };
    if (Array.isArray(raw.curves)) {
      plot.curves = raw.curves.map((c) => ({
        id: (c && c.id) || uid(),
        type: c && c.type,
        params: { ...((c && c.params) || {}) },
        label: c && c.label ? { ...c.label } : undefined,
      }));
    } else {
      delete plot.curves;
    }
    return ensureCoordPlot(plot);
  }

  function defaultCoordPlot(ox, oy) {
    return {
      id: uid(),
      ox,
      oy,
      unitPx: 40,
      xmin: -2,
      xmax: 6,
      ymin: -2,
      ymax: 6,
      axisLabelX: "x",
      axisLabelY: "y",
      showOrigin: true,
      showTicks: true,
      showTickLabels: true,
      xAngleUnit: "rad",
      angleAxisOn: false,
      curves: [],
    };
  }

  function parseCoordWindow(str) {
    const parts = String(str || "")
      .split(/[,;\s]+/)
      .map((x) => parseFloat(x))
      .filter((n) => Number.isFinite(n));
    if (parts.length < 4) return null;
    let [xmin, xmax, ymin, ymax] = parts;
    if (xmin === xmax) xmax = xmin + 1;
    if (ymin === ymax) ymax = ymin + 1;
    if (xmin > xmax) [xmin, xmax] = [xmax, xmin];
    if (ymin > ymax) [ymin, ymax] = [ymax, ymin];
    return { xmin, xmax, ymin, ymax };
  }

  function coordWorldFromAxis(plot, u, v) {
    return { x: plot.ox + u * plot.unitPx, y: plot.oy - v * plot.unitPx };
  }

  function coordPlotBounds(plot) {
    const pad = plot.unitPx * 0.55;
    const corners = [
      coordWorldFromAxis(plot, plot.xmin, plot.ymin),
      coordWorldFromAxis(plot, plot.xmax, plot.ymin),
      coordWorldFromAxis(plot, plot.xmin, plot.ymax),
      coordWorldFromAxis(plot, plot.xmax, plot.ymax),
    ];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of corners) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }

  function coordLogBase(params) {
    const b = params && params.base;
    if (b === "e" || b === "E") return Math.E;
    const n = Number(b);
    if (Number.isFinite(n) && n > 0 && n !== 1) return n;
    return 10;
  }

  /** Resolve circle radius from synced h/k/r fields. */
  function coordCircleRadius(params) {
    const p = params || {};
    if (Number.isFinite(Number(p.r)) && Number(p.r) > 0) return Number(p.r);
    if (Number.isFinite(Number(p.r2)) && Number(p.r2) > 0) return Math.sqrt(Number(p.r2));
    return 1;
  }

  /**
   * Keep circle params consistent across general / standard / centre forms.
   * General: x²+y²+Dx+Ey+F=0 → h=-D/2, k=-E/2, r²=(D²+E²)/4−F
   */
  function syncCircleParams(params) {
    const p = { ...(params || {}) };
    const form =
      p.circleForm === "center" || p.circleForm === "standard" || p.circleForm === "general"
        ? p.circleForm
        : "general";
    p.circleForm = form;

    if (form === "general") {
      let D = Number(p.D);
      let E = Number(p.E);
      let F = Number(p.F);
      if (!Number.isFinite(D)) D = 0;
      if (!Number.isFinite(E)) E = 0;
      if (!Number.isFinite(F)) F = -4;
      p.D = D;
      p.E = E;
      p.F = F;
      const h = -D / 2;
      const k = -E / 2;
      let r2 = (D * D + E * E) / 4 - F;
      if (!(r2 > 1e-12)) {
        // invalid → fall back to unit circle at origin in general coeffs
        r2 = 1;
        p.D = 0;
        p.E = 0;
        p.F = -1;
      }
      p.h = h;
      p.k = k;
      p.r2 = r2;
      p.r = Math.sqrt(r2);
      return p;
    }

    if (form === "standard") {
      let r2 = Number(p.r2);
      if (!Number.isFinite(r2) || r2 < 0) {
        const r = Math.abs(Number(p.r));
        r2 = Number.isFinite(r) ? r * r : 4;
      }
      if (!(r2 > 1e-12)) r2 = 1;
      const h = Number.isFinite(Number(p.h)) ? Number(p.h) : 0;
      const k = Number.isFinite(Number(p.k)) ? Number(p.k) : 0;
      p.h = h;
      p.k = k;
      p.r2 = r2;
      p.r = Math.sqrt(r2);
    } else {
      // center
      let r = Math.abs(Number(p.r));
      if (!Number.isFinite(r) || r <= 0) r = 2;
      const h = Number.isFinite(Number(p.h)) ? Number(p.h) : 0;
      const k = Number.isFinite(Number(p.k)) ? Number(p.k) : 0;
      p.h = h;
      p.k = k;
      p.r = r;
      p.r2 = r * r;
    }
    // derive general coeffs from centre/radius
    p.D = -2 * p.h;
    p.E = -2 * p.k;
    p.F = p.h * p.h + p.k * p.k - p.r2;
    return p;
  }

  function coordEvalY(curve, x, plot) {
    const p = curve.params || {};
    const type = curve.type || "none";
    if (type === "line") return (p.m ?? 1) * x + (p.c ?? 0);
    if (type === "quad") return (p.a ?? 1) * x * x + (p.b ?? 0) * x + (p.c ?? 0);
    if (type === "log" || type === "log10") {
      if (x <= 0) return NaN;
      const base = type === "log10" ? 10 : coordLogBase(p);
      const denom = Math.log(base);
      if (!Number.isFinite(denom) || Math.abs(denom) < 1e-15) return NaN;
      return (p.a ?? 1) * (Math.log(x) / denom);
    }
    if (type === "ln") {
      if (x <= 0) return NaN;
      return (p.a ?? 1) * Math.log(x);
    }
    if (type === "exp") {
      const a = p.a ?? 1;
      const b = p.b ?? Math.E;
      if (!(b > 0)) return NaN;
      return a * Math.pow(b, x);
    }
    if (type === "sin" || type === "cos" || type === "tan") {
      const A = p.A ?? 1;
      const B = p.B ?? 1;
      const C = p.C ?? 0;
      const D = p.D ?? 0;
      // Trig-unit mode only: when deg, treat Bx+C as degrees (axes stay numeric)
      let arg = B * x + C;
      if (coordIsDeg(plot)) arg *= Math.PI / 180;
      if (type === "tan") {
        const c = Math.cos(arg);
        if (Math.abs(c) < 1e-3) return NaN;
        return A * Math.tan(arg) + D;
      }
      if (type === "sin") return A * Math.sin(arg) + D;
      return A * Math.cos(arg) + D;
    }
    return NaN;
  }

  function coordSampleOneCurve(plot, curve) {
    const type = curve.type || "none";
    if (!type || type === "none") return [];
    const pts = [];
    if (type === "circle") {
      const p = curve.params || {};
      const h = p.h ?? 0;
      const k = p.k ?? 0;
      const r = coordCircleRadius(p);
      const n = 96;
      for (let i = 0; i <= n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const u = h + r * Math.cos(ang);
        const v = k + r * Math.sin(ang);
        if (u < plot.xmin || u > plot.xmax || v < plot.ymin || v > plot.ymax) {
          pts.push(null);
        } else {
          pts.push(coordWorldFromAxis(plot, u, v));
        }
      }
      return pts;
    }
    const needsPosX = type === "log" || type === "log10" || type === "ln";
    const isTrig = type === "sin" || type === "cos" || type === "tan";
    const n = isTrig ? 280 : 160;
    const x0 = Math.max(plot.xmin, needsPosX ? 1e-4 : plot.xmin);
    const x1 = plot.xmax;
    if (x1 <= x0) return pts;
    let prevV = null;
    for (let i = 0; i <= n; i++) {
      const u = x0 + ((x1 - x0) * i) / n;
      const v = coordEvalY(curve, u, plot);
      if (!Number.isFinite(v) || v < plot.ymin || v > plot.ymax) {
        pts.push(null);
        prevV = null;
        continue;
      }
      // Break tan (and wild jumps) so asymptotes do not connect
      if (type === "tan" && prevV != null && Math.abs(v - prevV) > (plot.ymax - plot.ymin) * 0.85) {
        pts.push(null);
      }
      pts.push(coordWorldFromAxis(plot, u, v));
      prevV = v;
    }
    return pts;
  }

  function coordPlotCurves(plot) {
    if (!plot) return [];
    ensureCoordPlot(plot);
    return Array.isArray(plot.curves) ? plot.curves : [];
  }

  function coordIntegerTicks(min, max) {
    const out = [];
    const a = Math.ceil(min - 1e-9);
    const b = Math.floor(max + 1e-9);
    for (let i = a; i <= b; i++) {
      if (i === 0) continue;
      out.push(i);
    }
    return out;
  }

  /** Trig-only: whether sin/cos/tan treat Bx+C as degrees. */
  function coordIsDeg(plot) {
    return !!(plot && plot.xAngleUnit === "deg");
  }

  function coordAngleAxisOn(plot) {
    return !!(plot && plot.angleAxisOn);
  }

  function coordGcd(a, b) {
    let x = Math.abs(a | 0);
    let y = Math.abs(b | 0);
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x || 1;
  }

  /**
   * π tick as single-line text or stacked fraction parts (exam style: −3π over 2).
   * Returns { kind:"text", text } or { kind:"frac", num, den }.
   */
  function formatPiTickParts(u) {
    const n = u / Math.PI;
    if (!Number.isFinite(n) || Math.abs(n) < 1e-9) return { kind: "text", text: "0" };
    const dens = [1, 2, 3, 4, 6];
    for (let di = 0; di < dens.length; di++) {
      const den = dens[di];
      const num = Math.round(n * den);
      if (Math.abs(n * den - num) > 0.02) continue;
      const g = coordGcd(num, den);
      const nR = num / g;
      const dR = den / g;
      const sign = nR < 0 ? "−" : "";
      const a = Math.abs(nR);
      if (dR === 1) {
        return { kind: "text", text: sign + (a === 1 ? "π" : a + "π") };
      }
      return { kind: "frac", num: sign + (a === 1 ? "π" : a + "π"), den: String(dR) };
    }
    return { kind: "text", text: String(Math.round(u * 100) / 100) };
  }

  /** Slash-form fallback (debug / plain string). */
  function formatPiTick(u) {
    const p = formatPiTickParts(u);
    if (p.kind === "frac") return p.num + "/" + p.den;
    return p.text;
  }

  /** Canvas: draw plain or stacked-fraction tick label; (x,yTop) = top-center of label. */
  function paintCoordTickLabel(c, parts, x, yTop, fontPx, color) {
    const font = `italic ${fontPx}px "STIX Two Text", "Times New Roman", serif`;
    c.font = font;
    c.fillStyle = color;
    c.strokeStyle = color;
    c.textAlign = "center";
    if (!parts || parts.kind !== "frac") {
      c.textBaseline = "top";
      c.fillText((parts && parts.text) || "", x, yTop);
      return;
    }
    const gap = Math.max(1, fontPx * 0.1);
    const barPad = fontPx * 0.18;
    c.textBaseline = "alphabetic";
    const numW = c.measureText(parts.num).width;
    const denW = c.measureText(parts.den).width;
    const barW = Math.max(numW, denW) + barPad * 2;
    const numBaseline = yTop + fontPx * 0.88;
    const barY = yTop + fontPx + gap;
    const denBaseline = barY + gap + fontPx * 0.88;
    c.fillText(parts.num, x, numBaseline);
    const prevCap = c.lineCap;
    const prevW = c.lineWidth;
    c.beginPath();
    c.lineWidth = Math.max(1, fontPx * 0.07);
    c.lineCap = "butt";
    c.moveTo(x - barW / 2, barY);
    c.lineTo(x + barW / 2, barY);
    c.stroke();
    c.lineCap = prevCap;
    c.lineWidth = prevW;
    c.fillText(parts.den, x, denBaseline);
  }

  /** SVG markup for plain or stacked-fraction tick label. */
  function svgCoordTickLabel(parts, x, yTop, fontPx, fill) {
    const fs = Number(fontPx);
    const fam = 'font-family="STIX Two Text, Times New Roman, serif" font-style="italic"';
    if (!parts || parts.kind !== "frac") {
      const t = (parts && parts.text) || "";
      return `<text x="${x.toFixed(2)}" y="${yTop.toFixed(2)}" fill="${fill}" ${fam} font-size="${fontPx}" text-anchor="middle" dominant-baseline="hanging">${escapeXml(t)}</text>\n`;
    }
    const gap = Math.max(1, fs * 0.1);
    const barPad = fs * 0.18;
    const charW = fs * 0.52;
    const numW = parts.num.length * charW;
    const denW = parts.den.length * charW;
    const barW = Math.max(numW, denW) + barPad * 2;
    const numY = yTop + fs * 0.88;
    const barY = yTop + fs + gap;
    const denY = barY + gap + fs * 0.88;
    const sw = Math.max(1, fs * 0.07).toFixed(2);
    let out = "";
    out += `<text x="${x.toFixed(2)}" y="${numY.toFixed(2)}" fill="${fill}" ${fam} font-size="${fontPx}" text-anchor="middle" dominant-baseline="alphabetic">${escapeXml(parts.num)}</text>\n`;
    out += `<line x1="${(x - barW / 2).toFixed(2)}" y1="${barY.toFixed(2)}" x2="${(x + barW / 2).toFixed(2)}" y2="${barY.toFixed(2)}" stroke="${fill}" stroke-width="${sw}" stroke-linecap="butt" />\n`;
    out += `<text x="${x.toFixed(2)}" y="${denY.toFixed(2)}" fill="${fill}" ${fam} font-size="${fontPx}" text-anchor="middle" dominant-baseline="alphabetic">${escapeXml(parts.den)}</text>\n`;
    return out;
  }

  function coordNearZero(u) {
    return Math.abs(u) < 1e-9;
  }

  function formatDegAxisTick(u) {
    const n = Math.abs(u - Math.round(u)) < 1e-6 ? Math.round(u) : Math.round(u * 10) / 10;
    return String(n) + "°";
  }

  function coordSteppedTicks(min, max, step, includeZero) {
    const out = [];
    if (!(step > 0) || !(max > min)) return out;
    const start = Math.ceil((min - 1e-9) / step) * step;
    for (let u = start; u <= max + 1e-9; u += step) {
      const v = Math.abs(u) < 1e-12 ? 0 : u;
      if (!includeZero && v === 0) continue;
      out.push(v);
    }
    return out;
  }

  function coordPiTicks(min, max) {
    const span = Math.max(1e-6, max - min);
    let step = Math.PI / 2;
    if (span <= Math.PI * 1.6) step = Math.PI / 4;
    else if (span <= Math.PI * 5) step = Math.PI / 2;
    else step = Math.PI;
    return coordSteppedTicks(min, max, step, true);
  }

  function coordDegAxisTicks(min, max) {
    const span = Math.max(1e-6, max - min);
    let step = 90;
    if (span <= 60) step = 15;
    else if (span <= 120) step = 30;
    else if (span <= 200) step = 45;
    else if (span <= 400) step = 90;
    else step = 180;
    return coordSteppedTicks(min, max, step, true);
  }

  /** X-axis tick values + label parts (plain / π stacked frac / °). */
  function coordXAxisTickEntries(plot) {
    if (!coordAngleAxisOn(plot)) {
      return coordIntegerTicks(plot.xmin, plot.xmax).map((u) => ({
        u,
        parts: { kind: "text", text: String(u) },
      }));
    }
    if (coordIsDeg(plot)) {
      return coordDegAxisTicks(plot.xmin, plot.xmax).map((u) => ({
        u,
        parts: { kind: "text", text: formatDegAxisTick(u) },
      }));
    }
    return coordPiTicks(plot.xmin, plot.xmax).map((u) => ({
      u,
      parts: formatPiTickParts(u),
    }));
  }

  function snapshotCoordWindowPrefs(plot) {
    return {
      xmin: plot.xmin,
      xmax: plot.xmax,
      ymin: plot.ymin,
      ymax: plot.ymax,
      showTickLabels: plot.showTickLabels !== false,
    };
  }

  function suggestAngleAxisWindow(unit) {
    if (unit === "deg") return { xmin: -180, xmax: 180, ymin: -2, ymax: 2 };
    return { xmin: -2 * Math.PI, xmax: 2 * Math.PI, ymin: -2, ymax: 2 };
  }

  function strokeArrowHead(c, x, y, ang, size) {
    const a1 = ang + Math.PI * 0.82;
    const a2 = ang - Math.PI * 0.82;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a1) * size, y + Math.sin(a1) * size);
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a2) * size, y + Math.sin(a2) * size);
    c.stroke();
  }

  function strokeCoordPolyline(c, toScreen, pts) {
    c.beginPath();
    let pen = false;
    for (const pt of pts) {
      if (!pt) {
        pen = false;
        continue;
      }
      const s = toScreen(pt.x, pt.y);
      if (!pen) {
        c.moveTo(s.x, s.y);
        pen = true;
      } else c.lineTo(s.x, s.y);
    }
    c.stroke();
  }

  /** Draw one coord plot. toScreen(wx,wy)->{x,y}; lw in screen px. */
  function paintCoordPlot(c, plot, toScreen, lw, fontPx, ink, highlight) {
    if (!plot) return;
    const color = highlight ? "#1a5fb4" : ink || "#111";
    const o = toScreen(plot.ox, plot.oy);
    const xNeg = toScreen(plot.ox + plot.xmin * plot.unitPx, plot.oy);
    const xPos = toScreen(plot.ox + plot.xmax * plot.unitPx, plot.oy);
    const yNeg = toScreen(plot.ox, plot.oy - plot.ymin * plot.unitPx);
    const yPos = toScreen(plot.ox, plot.oy - plot.ymax * plot.unitPx);
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = lw;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.setLineDash([]);
    c.beginPath();
    c.moveTo(xNeg.x, xNeg.y);
    c.lineTo(xPos.x, xPos.y);
    c.moveTo(yNeg.x, yNeg.y);
    c.lineTo(yPos.x, yPos.y);
    c.stroke();
    const arrow = Math.max(7, lw * 3.2);
    strokeArrowHead(c, xPos.x, xPos.y, Math.atan2(xPos.y - o.y, xPos.x - o.x), arrow);
    strokeArrowHead(c, yPos.x, yPos.y, Math.atan2(yPos.y - o.y, yPos.x - o.x), arrow);

    const tickLen = Math.max(4, lw * 2.2);
    const showNums = plot.showTickLabels !== false;
    if (plot.showTicks !== false) {
      for (const tick of coordXAxisTickEntries(plot)) {
        const p = toScreen(plot.ox + tick.u * plot.unitPx, plot.oy);
        c.beginPath();
        c.moveTo(p.x, p.y - tickLen);
        c.lineTo(p.x, p.y + tickLen);
        c.stroke();
        // Skip ≈0 label — origin "O" already marks the origin (avoid "O0").
        if (showNums && !coordNearZero(tick.u)) {
          paintCoordTickLabel(c, tick.parts, p.x, p.y + tickLen + 1, fontPx, color);
        }
      }
      for (const v of coordIntegerTicks(plot.ymin, plot.ymax)) {
        const p = toScreen(plot.ox, plot.oy - v * plot.unitPx);
        c.beginPath();
        c.moveTo(p.x - tickLen, p.y);
        c.lineTo(p.x + tickLen, p.y);
        c.stroke();
        if (showNums && !coordNearZero(v)) {
          c.font = `italic ${fontPx}px "STIX Two Text", "Times New Roman", serif`;
          c.fillStyle = color;
          c.textAlign = "right";
          c.textBaseline = "middle";
          c.fillText(String(v), p.x - tickLen - 2, p.y);
        }
      }
    }
    if (plot.showOrigin !== false) {
      c.font = `italic ${fontPx}px "STIX Two Text", "Times New Roman", serif`;
      c.textAlign = "right";
      c.textBaseline = "top";
      c.fillText("O", o.x - 4, o.y + 3);
    }
    const lx = (plot.axisLabelX || "x").trim();
    const ly = (plot.axisLabelY || "y").trim();
    if (lx) {
      c.font = `italic ${fontPx}px "STIX Two Text", "Times New Roman", serif`;
      c.textAlign = "left";
      c.textBaseline = "top";
      c.fillText(lx, xPos.x + 4, xPos.y + 2);
    }
    if (ly) {
      c.font = `italic ${fontPx}px "STIX Two Text", "Times New Roman", serif`;
      c.textAlign = "left";
      c.textBaseline = "bottom";
      c.fillText(ly, yPos.x + 4, yPos.y - 2);
    }

    for (const curve of coordPlotCurves(plot)) {
      strokeCoordPolyline(c, toScreen, coordSampleOneCurve(plot, curve));
    }
    for (const curve of coordPlotCurves(plot)) {
      const text = coordCurveLabelText(curve, plot);
      if (!text) continue;
      const wp = coordCurveLabelWorldPos(plot, curve);
      const sp = toScreen(wp.x, wp.y);
      paintLabelText(c, text, sp.x, sp.y, fontPx, color, true);
    }
  }

  function drawCoordPlot(plot, highlight) {
    const toScreen = (wx, wy) => worldToScreen(wx, wy);
    const lw = LINE_WIDTH * (highlight ? 1.15 : 1);
    const fontPx = clampLabelSize(labelFontSize) * Math.min(Math.max(view.scale, 0.7), 1.4);
    paintCoordPlot(ctx, plot, toScreen, lw, fontPx, edInk(highlight), highlight);
  }

  /** Corner + edge handles of the plot window frame (axis units → world). */
  function coordPlotResizeHandles(plot) {
    const uMid = (plot.xmin + plot.xmax) / 2;
    const vMid = (plot.ymin + plot.ymax) / 2;
    const specs = [
      { id: "sw", u: plot.xmin, v: plot.ymin },
      { id: "se", u: plot.xmax, v: plot.ymin },
      { id: "nw", u: plot.xmin, v: plot.ymax },
      { id: "ne", u: plot.xmax, v: plot.ymax },
      { id: "e", u: plot.xmax, v: vMid },
      { id: "w", u: plot.xmin, v: vMid },
      { id: "n", u: uMid, v: plot.ymax },
      { id: "s", u: uMid, v: plot.ymin },
    ];
    return specs.map((s) => {
      const w = coordWorldFromAxis(plot, s.u, s.v);
      return { id: s.id, u: s.u, v: s.v, x: w.x, y: w.y };
    });
  }

  function drawCoordPlotResizeHandles(plot) {
    const hs = coordPlotResizeHandles(plot);
    const r = 5;
    ctx.save();
    for (const h of hs) {
      const s = worldToScreen(h.x, h.y);
      ctx.beginPath();
      ctx.rect(s.x - r, s.y - r, r * 2, r * 2);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#1a5fb4";
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }
    // light frame
    const x0 = plot.ox + plot.xmin * plot.unitPx;
    const x1 = plot.ox + plot.xmax * plot.unitPx;
    const y0 = plot.oy - plot.ymin * plot.unitPx;
    const y1 = plot.oy - plot.ymax * plot.unitPx;
    const a = worldToScreen(x0, y0);
    const b = worldToScreen(x1, y0);
    const c = worldToScreen(x1, y1);
    const d = worldToScreen(x0, y1);
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "rgba(26,95,180,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function nearestCoordResizeHandle(wx, wy) {
    const thresh = 12 / view.scale;
    let best = null;
    let bestD = thresh;
    for (const plot of coordPlots) {
      if (!isSelected("coordPlot", plot.id)) continue;
      for (const h of coordPlotResizeHandles(plot)) {
        const d = dist({ x: wx, y: wy }, { x: h.x, y: h.y });
        if (d < bestD) {
          bestD = d;
          best = {
            plotId: plot.id,
            handleId: h.id,
            u: h.u,
            v: h.v,
            unit0: plot.unitPx || 40,
          };
        }
      }
    }
    return best;
  }

  function applyCoordResizeFromPointer(plot, drag, wx, wy) {
    const u0 = drag.unit0 || plot.unitPx || 40;
    const au = drag.u;
    const av = drag.v;
    const oldLen = Math.hypot(au * u0, av * u0);
    if (oldLen < 1e-6) return;
    const newLen = Math.hypot(wx - plot.ox, plot.oy - wy);
    let unit = u0 * (newLen / oldLen);
    // Prefer axis-aligned estimate when handle is on an axis edge mid
    if (Math.abs(au) > 1e-6 && Math.abs(av) < 1e-6) {
      unit = (wx - plot.ox) / au;
    } else if (Math.abs(av) > 1e-6 && Math.abs(au) < 1e-6) {
      unit = (plot.oy - wy) / av;
    } else {
      const cands = [];
      if (Math.abs(au) > 1e-6) cands.push((wx - plot.ox) / au);
      if (Math.abs(av) > 1e-6) cands.push((plot.oy - wy) / av);
      const pos = cands.filter((x) => Number.isFinite(x) && x > 0);
      if (pos.length) unit = pos.reduce((a, b) => a + b, 0) / pos.length;
    }
    if (!Number.isFinite(unit) || unit <= 0) return;
    plot.unitPx = Math.min(220, Math.max(10, unit));
  }

  function nearestCoordPlotHit(wx, wy) {
    const thresh = 12 / view.scale;
    let best = null;
    let bestD = thresh;
    for (const plot of coordPlots) {
      let d = dist({ x: wx, y: wy }, { x: plot.ox, y: plot.oy });
      if (d < bestD) {
        bestD = d;
        best = plot;
      }
      const x0 = plot.ox + plot.xmin * plot.unitPx;
      const x1 = plot.ox + plot.xmax * plot.unitPx;
      const y0 = plot.oy - plot.ymin * plot.unitPx;
      const y1 = plot.oy - plot.ymax * plot.unitPx;
      const dX = distToSegment({ x: wx, y: wy }, { x: x0, y: plot.oy }, { x: x1, y: plot.oy });
      const dY = distToSegment({ x: wx, y: wy }, { x: plot.ox, y: y0 }, { x: plot.ox, y: y1 });
      if (dX < bestD) {
        bestD = dX;
        best = plot;
      }
      if (dY < bestD) {
        bestD = dY;
        best = plot;
      }
      for (const curve of coordPlotCurves(plot)) {
        for (const pt of coordSampleOneCurve(plot, curve)) {
          if (!pt) continue;
          d = dist({ x: wx, y: wy }, pt);
          if (d < bestD) {
            bestD = d;
            best = plot;
          }
        }
      }
    }
    return best;
  }


  function nearestCoordCurveLabelHit(wx, wy) {
    const fontW = (clampLabelSize(labelFontSize) * 0.55) / view.scale;
    let best = null;
    let bestD = Infinity;
    for (const plot of coordPlots) {
      ensureCoordPlot(plot);
      for (const curve of plot.curves || []) {
        const text = coordCurveLabelText(curve, plot);
        if (!text) continue;
        const pos = coordCurveLabelWorldPos(plot, curve);
        const halfW = Math.max(18 / view.scale, text.length * fontW * 0.5);
        const halfH = Math.max(14 / view.scale, (clampLabelSize(labelFontSize) * 0.65) / view.scale);
        const dx = Math.abs(wx - pos.x);
        const dy = Math.abs(wy - pos.y);
        if (dx > halfW || dy > halfH) continue;
        const d = dist({ x: wx, y: wy }, pos);
        if (d < bestD) {
          bestD = d;
          best = { plotId: plot.id, curveId: curve.id, plot, curve };
        }
      }
    }
    return best;
  }

  function coordParamFieldsForType(type, params) {
    if (type === "line") return [["m", "m"], ["c", "c"]];
    if (type === "quad") return [["a", "a"], ["b", "b"], ["c", "c"]];
    if (type === "log" || type === "log10") return [["a", "a"], ["base", t("coord_log_base")]];
    if (type === "ln") return [["a", "a"]];
    if (type === "exp") return [["a", "a"], ["b", "b"]];
    if (type === "sin" || type === "cos") {
      return [["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"]];
    }
    if (type === "tan") return [["A", "A"], ["B", "B"]];
    if (type === "circle") {
      const form =
        params && params.circleForm === "center"
          ? "center"
          : params && params.circleForm === "standard"
            ? "standard"
            : "general";
      if (form === "center") return [["h", "h"], ["k", "k"], ["r", "r"]];
      if (form === "standard") return [["h", "h"], ["k", "k"], ["r2", "r²"]];
      return [["D", "D"], ["E", "E"], ["F", "F"]];
    }
    return [];
  }

  function coordTypeOptionsHtml(selected) {
    const opts = [
      ["line", "y = mx + c"],
      ["quad", "y = ax² + bx + c"],
      ["log", "y = a·log_b(x)"],
      ["ln", "y = a·ln(x)"],
      ["exp", "y = a·bˣ"],
      ["sin", "y = A sin(Bx+C)+D"],
      ["cos", "y = A cos(Bx+C)+D"],
      ["tan", "y = A tan(Bx)"],
      ["circle", "(x−h)²+(y−k)²=r²"],
    ];
    return opts
      .map(
        ([v, lab]) =>
          `<option value="${v}"${v === selected ? " selected" : ""}>${lab}</option>`
      )
      .join("");
  }

  const COORD_LABEL_PRESETS = ["L1", "L2", "L3", "y=f(x)", "y=g(x)", "C1", "C2"];

  function renderCoordCurveParams(container, curve) {
    container.innerHTML = "";
    if (curve.type === "circle") {
      const formRow = document.createElement("div");
      formRow.className = "coord-form-toggle";
      const form =
        curve.params && curve.params.circleForm === "center"
          ? "center"
          : curve.params && curve.params.circleForm === "standard"
            ? "standard"
            : "general";
      formRow.innerHTML =
        `<label><input type="radio" name="cform-${curve.id}" data-circle-form="general" ${form === "general" ? "checked" : ""}/> ${t("coord_circle_general")}</label>` +
        `<label><input type="radio" name="cform-${curve.id}" data-circle-form="standard" ${form === "standard" ? "checked" : ""}/> ${t("coord_circle_standard")}</label>` +
        `<label><input type="radio" name="cform-${curve.id}" data-circle-form="center" ${form === "center" ? "checked" : ""}/> ${t("coord_circle_center")}</label>`;
      formRow.querySelectorAll("input[data-circle-form]").forEach((inp) => {
        inp.addEventListener("change", () => {
          if (!inp.checked) return;
          syncCoordDialogCurvesFromDOM();
          const c = coordDialogCurves.find((x) => x.id === curve.id);
          if (!c) return;
          c.params = syncCircleParams({ ...(c.params || {}), circleForm: inp.dataset.circleForm });
          renderCoordCurvesList();
        });
      });
      container.appendChild(formRow);
    }
    const fields = coordParamFieldsForType(curve.type, curve.params);
    for (const [key, lab] of fields) {
      const label = document.createElement("label");
      label.textContent = lab;
      const input = document.createElement("input");
      input.type = key === "base" ? "text" : "number";
      input.step = "any";
      input.dataset.param = key;
      const v = curve.params && curve.params[key];
      if (key === "base") {
        if (v === Math.E || v === "e" || v === "E") input.value = "e";
        else input.value = v != null ? String(v) : "10";
      } else {
        input.value = v != null && Number.isFinite(Number(v)) ? String(v) : "";
      }
      label.appendChild(input);
      container.appendChild(label);
    }
    if (curve.type === "log" || curve.type === "log10") {
      const chips = document.createElement("div");
      chips.className = "coord-base-chips";
      for (const b of ["10", "e", "2"]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = b;
        btn.addEventListener("click", () => {
          const inp = container.querySelector('input[data-param="base"]');
          if (inp) inp.value = b;
        });
        chips.appendChild(btn);
      }
      container.appendChild(chips);
    }
  }

  function readCurveParamsFromRow(row, type) {
    let out = { ...defaultCurveParams(type) };
    if (type === "circle") {
      const formInp = row.querySelector("input[data-circle-form]:checked");
      {
        const f = formInp && formInp.dataset.circleForm;
        out.circleForm = f === "center" || f === "standard" || f === "general" ? f : "general";
      }
    }
    row.querySelectorAll("input[data-param]").forEach((inp) => {
      const key = inp.dataset.param;
      if (key === "base") {
        const raw = String(inp.value || "").trim();
        if (raw.toLowerCase() === "e") out.base = Math.E;
        else {
          const n = parseFloat(raw);
          if (Number.isFinite(n)) out.base = n;
        }
      } else {
        const n = parseFloat(inp.value);
        if (Number.isFinite(n)) out[key] = n;
      }
    });
    if (type === "circle") out = syncCircleParams(out);
    return out;
  }

  function readCurveLabelFromRow(row, prev) {
    const lab = normalizeCurveLabel(prev);
    const show = row.querySelector("[data-label-show]");
    lab.show = !!(show && show.checked);
    const kind = row.querySelector("[data-label-kind]:checked");
    lab.kind = kind && kind.value === "custom" ? "custom" : "formula";
    const mode = row.querySelector("[data-label-formula-mode]");
    lab.formulaMode = mode && mode.value === "numeric" ? "numeric" : "algebraic";
    const custom = row.querySelector("[data-label-custom]");
    lab.customText = custom ? String(custom.value || "") : lab.customText;
    const tInp = row.querySelector("[data-label-t]");
    const nInp = row.querySelector("[data-label-n]");
    if (tInp) {
      const t = parseFloat(tInp.value);
      if (Number.isFinite(t)) lab.t = Math.min(1, Math.max(0, t));
    }
    if (nInp) {
      const n = parseFloat(nInp.value);
      if (Number.isFinite(n)) lab.n = Math.min(6, Math.max(-6, n));
    }
    return lab;
  }

  function renderCoordCurveLabelUI(row, curve) {
    const lab = normalizeCurveLabel(curve.label);
    const box = document.createElement("div");
    box.className = "coord-label-box";
    const showLab = document.createElement("label");
    showLab.className = "check-opt";
    showLab.innerHTML = `<input type="checkbox" data-label-show ${lab.show ? "checked" : ""}/> <span>${t("coord_label_show")}</span>`;
    box.appendChild(showLab);

    const kindRow = document.createElement("div");
    kindRow.className = "coord-label-kinds";
    kindRow.innerHTML =
      `<label><input type="radio" name="lkind-${curve.id}" data-label-kind value="formula" ${lab.kind === "formula" ? "checked" : ""}/> ${t("coord_label_formula")}</label>` +
      `<label><input type="radio" name="lkind-${curve.id}" data-label-kind value="custom" ${lab.kind === "custom" ? "checked" : ""}/> ${t("coord_label_custom")}</label>`;
    box.appendChild(kindRow);

    const formulaRow = document.createElement("div");
    formulaRow.className = "coord-label-formula-row";
    formulaRow.innerHTML =
      `<label>${t("coord_label_formula_mode")} <select data-label-formula-mode>` +
      `<option value="algebraic"${lab.formulaMode === "algebraic" ? " selected" : ""}>${t("coord_label_alg")}</option>` +
      `<option value="numeric"${lab.formulaMode === "numeric" ? " selected" : ""}>${t("coord_label_num")}</option>` +
      `</select></label>` +
      `<span class="coord-label-preview">${coordCurveFormulaText({ ...curve, label: { ...lab, show: true, kind: "formula" } }, lab.formulaMode, coordDialogUnitPlot())}</span>`;
    box.appendChild(formulaRow);

    const customRow = document.createElement("div");
    customRow.className = "coord-label-custom-row";
    const customInp = document.createElement("input");
    customInp.type = "text";
    customInp.maxLength = 24;
    customInp.dataset.labelCustom = "1";
    customInp.placeholder = t("coord_label_custom_ph");
    customInp.value = lab.customText || "";
    customRow.appendChild(customInp);
    const chips = document.createElement("div");
    chips.className = "coord-label-presets";
    for (const p of COORD_LABEL_PRESETS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = p;
      btn.addEventListener("click", () => {
        customInp.value = p;
        const kindCustom = row.querySelector('input[data-label-kind][value="custom"]');
        if (kindCustom) kindCustom.checked = true;
        const show = row.querySelector("[data-label-show]");
        if (show) show.checked = true;
      });
      chips.appendChild(btn);
    }
    customRow.appendChild(chips);
    box.appendChild(customRow);

    const posRow = document.createElement("div");
    posRow.className = "coord-label-pos-row";
    posRow.innerHTML =
      `<label>${t("coord_label_t")} <input type="number" data-label-t min="0" max="1" step="0.05" value="${lab.t}" /></label>` +
      `<label>${t("coord_label_n")} <input type="number" data-label-n min="-6" max="6" step="0.05" value="${lab.n}" /></label>`;
    box.appendChild(posRow);
    const posNote = document.createElement("p");
    posNote.className = "dialog-note";
    posNote.textContent = t("coord_label_pos_note");
    box.appendChild(posNote);

    const syncVis = () => {
      const isCustom = !!(box.querySelector('input[data-label-kind][value="custom"]:checked'));
      formulaRow.style.display = isCustom ? "none" : "";
      customRow.style.display = isCustom ? "" : "none";
    };
    box.querySelectorAll("[data-label-kind]").forEach((el) => el.addEventListener("change", syncVis));
    const modeSel = formulaRow.querySelector("[data-label-formula-mode]");
    if (modeSel) {
      modeSel.addEventListener("change", () => {
        const prev = formulaRow.querySelector(".coord-label-preview");
        if (prev) {
          prev.textContent = coordCurveFormulaText(
            curve,
            modeSel.value === "numeric" ? "numeric" : "algebraic",
            coordDialogUnitPlot()
          );
        }
      });
    }
    syncVis();
    row.appendChild(box);
  }

  function syncCoordDialogCurvesFromDOM() {
    const list = document.getElementById("coordCurvesList");
    if (!list) return;
    const next = [];
    list.querySelectorAll(".coord-curve-row").forEach((row) => {
      const id = row.dataset.curveId || uid();
      const sel = row.querySelector("select[data-curve-type]");
      const type = (sel && sel.value) || "line";
      const prev = coordDialogCurves.find((c) => c.id === id);
      next.push({
        id,
        type,
        params: readCurveParamsFromRow(row, type),
        label: readCurveLabelFromRow(row, prev && prev.label),
      });
    });
    coordDialogCurves = next;
  }

  function renderCoordCurvesList() {
    const list = document.getElementById("coordCurvesList");
    if (!list) return;
    list.innerHTML = "";
    // Scroll only when many curves; 1–3 fit without a Curves scrollbar
    list.classList.toggle("coord-curves-list--scroll", coordDialogCurves.length > 3);
    if (!coordDialogCurves.length) {
      const empty = document.createElement("p");
      empty.className = "dialog-note";
      empty.textContent = t("coord_no_curves");
      list.appendChild(empty);
      return;
    }
    coordDialogCurves.forEach((curve, idx) => {
      const row = document.createElement("div");
      row.className = "coord-curve-row";
      row.dataset.curveId = curve.id;
      const head = document.createElement("div");
      head.className = "coord-curve-head";
      const sel = document.createElement("select");
      sel.dataset.curveType = "1";
      sel.innerHTML = coordTypeOptionsHtml(curve.type);
      sel.addEventListener("change", () => {
        syncCoordDialogCurvesFromDOM();
        const c = coordDialogCurves.find((x) => x.id === curve.id);
        if (c) {
          c.type = sel.value;
          c.params = { ...defaultCurveParams(c.type), ...c.params };
          if (c.type === "circle") c.params = syncCircleParams(c.params);
          if (c.type === "log" && (c.params.base == null || c.params.base === 0)) {
            c.params.base = 10;
          }
          c.label = normalizeCurveLabel(c.label);
        }
        renderCoordCurvesList();
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "coord-curve-del";
      del.textContent = t("coord_remove_curve");
      del.addEventListener("click", () => {
        syncCoordDialogCurvesFromDOM();
        coordDialogCurves = coordDialogCurves.filter((x) => x.id !== curve.id);
        renderCoordCurvesList();
      });
      const title = document.createElement("span");
      title.textContent = String(idx + 1) + ".";
      title.style.color = "var(--muted)";
      title.style.fontSize = "12px";
      head.appendChild(title);
      head.appendChild(sel);
      head.appendChild(del);
      const paramsBox = document.createElement("div");
      paramsBox.className = "coord-params";
      renderCoordCurveParams(paramsBox, curve);
      row.appendChild(head);
      row.appendChild(paramsBox);
      renderCoordCurveLabelUI(row, curve);
      list.appendChild(row);
    });
  }

  function syncCoordWindowInputFromPlot(plot) {
    const winInp = document.getElementById("coordWindow");
    if (winInp && plot) {
      winInp.value = [plot.xmin, plot.xmax, plot.ymin, plot.ymax].join(",");
    }
  }

  function writeCoordWindowInput(win) {
    const winInp = document.getElementById("coordWindow");
    if (!winInp || !win) return;
    winInp.value = [win.xmin, win.xmax, win.ymin, win.ymax].join(",");
  }

  /** Dialog preview context: current trig-unit select. */
  function coordDialogUnitPlot() {
    const angSel = document.getElementById("coordXAngleUnit");
    return { xAngleUnit: angSel && angSel.value === "deg" ? "deg" : "rad" };
  }

  function handleCoordAngleAxisCheckboxChange() {
    const chk = document.getElementById("coordAngleAxis");
    const angSel = document.getElementById("coordXAngleUnit");
    const tickChk = document.getElementById("coordShowTickLabels");
    const winInp = document.getElementById("coordWindow");
    if (!chk) return;
    if (chk.checked) {
      const cur = parseCoordWindow(winInp ? winInp.value : "");
      // Capture original window only once per dialog session (before suggest)
      if (!pendingAngleAxisSaved) {
        pendingAngleAxisSaved = cur
          ? {
              xmin: cur.xmin,
              xmax: cur.xmax,
              ymin: cur.ymin,
              ymax: cur.ymax,
              showTickLabels: !tickChk || !!tickChk.checked,
            }
          : null;
      }
      const unit = angSel && angSel.value === "deg" ? "deg" : "rad";
      const sug = suggestAngleAxisWindow(unit);
      const ySrc = pendingAngleAxisSaved || cur;
      if (ySrc) {
        sug.ymin = ySrc.ymin;
        sug.ymax = ySrc.ymax;
      }
      writeCoordWindowInput(sug);
    } else if (pendingAngleAxisSaved) {
      writeCoordWindowInput(pendingAngleAxisSaved);
      if (tickChk) tickChk.checked = pendingAngleAxisSaved.showTickLabels !== false;
    } else {
      const plot = coordPlots.find((p) => p.id === pendingCoordEditId);
      if (plot && plot.angleAxisSaved) {
        writeCoordWindowInput(plot.angleAxisSaved);
        if (tickChk) tickChk.checked = plot.angleAxisSaved.showTickLabels !== false;
      }
    }
  }

  function openCoordDialog(plotId) {
    const plot = coordPlots.find((p) => p.id === plotId);
    if (!plot) return;
    ensureCoordPlot(plot);
    pendingCoordEditId = plotId;
    pendingAngleAxisSaved = plot.angleAxisSaved
      ? { ...plot.angleAxisSaved }
      : null;
    const labInp = document.getElementById("coordAxisLabels");
    const tickChk = document.getElementById("coordShowTickLabels");
    const angSel = document.getElementById("coordXAngleUnit");
    const axisChk = document.getElementById("coordAngleAxis");
    syncCoordWindowInputFromPlot(plot);
    if (labInp) labInp.value = (plot.axisLabelX || "x") + "," + (plot.axisLabelY || "y");
    if (tickChk) tickChk.checked = plot.showTickLabels !== false;
    if (angSel) angSel.value = plot.xAngleUnit === "deg" ? "deg" : "rad";
    if (axisChk) axisChk.checked = !!plot.angleAxisOn;
    coordDialogCurves = coordPlotCurves(plot).map((c) => ({
      id: c.id || uid(),
      type: c.type,
      params: c.type === "circle"
        ? syncCircleParams({ ...defaultCurveParams(c.type), ...(c.params || {}) })
        : { ...defaultCurveParams(c.type), ...(c.params || {}) },
      label: normalizeCurveLabel(c.label),
    }));
    renderCoordCurvesList();
    const dlg = document.getElementById("coordDialog");
    if (dlg && typeof dlg.showModal === "function") {
      coordDialogOpen = true;
      dlg.showModal();
    }
  }

  function applyCoordDialog() {
    const plot = coordPlots.find((p) => p.id === pendingCoordEditId);
    if (!plot) return false;
    syncCoordDialogCurvesFromDOM();
    const winInp = document.getElementById("coordWindow");
    const labInp = document.getElementById("coordAxisLabels");
    const tickChk = document.getElementById("coordShowTickLabels");
    const angSel = document.getElementById("coordXAngleUnit");
    const axisChk = document.getElementById("coordAngleAxis");
    let win = parseCoordWindow(winInp ? winInp.value : "");
    const labs = String(labInp ? labInp.value : "x,y")
      .split(",")
      .map((s) => s.trim());
    pushHistory();
    const nextUnit = angSel && angSel.value === "deg" ? "deg" : "rad";
    const wantOn = !!(axisChk && axisChk.checked);
    const wasOn = !!plot.angleAxisOn;
    plot.xAngleUnit = nextUnit;

    if (wantOn && !wasOn) {
      // Snapshot pre-angle window (dialog capture, else live plot)
      plot.angleAxisSaved =
        pendingAngleAxisSaved || snapshotCoordWindowPrefs(plot);
      if (win) {
        plot.xmin = win.xmin;
        plot.xmax = win.xmax;
        plot.ymin = win.ymin;
        plot.ymax = win.ymax;
      } else {
        const sug = suggestAngleAxisWindow(nextUnit);
        plot.xmin = sug.xmin;
        plot.xmax = sug.xmax;
        plot.ymin = sug.ymin;
        plot.ymax = sug.ymax;
      }
      plot.showTickLabels = !tickChk || !!tickChk.checked;
    } else if (!wantOn && wasOn) {
      const saved = pendingAngleAxisSaved || plot.angleAxisSaved;
      if (saved) {
        plot.xmin = saved.xmin;
        plot.xmax = saved.xmax;
        plot.ymin = saved.ymin;
        plot.ymax = saved.ymax;
        plot.showTickLabels = saved.showTickLabels !== false;
      } else if (win) {
        plot.xmin = win.xmin;
        plot.xmax = win.xmax;
        plot.ymin = win.ymin;
        plot.ymax = win.ymax;
        plot.showTickLabels = !tickChk || !!tickChk.checked;
      }
      delete plot.angleAxisSaved;
      pendingAngleAxisSaved = null;
    } else {
      // Stay on or stay off: apply form window as edited
      if (win) {
        plot.xmin = win.xmin;
        plot.xmax = win.xmax;
        plot.ymin = win.ymin;
        plot.ymax = win.ymax;
      }
      plot.showTickLabels = !tickChk || !!tickChk.checked;
      if (wantOn && pendingAngleAxisSaved && !plot.angleAxisSaved) {
        plot.angleAxisSaved = { ...pendingAngleAxisSaved };
      }
    }

    plot.angleAxisOn = wantOn;
    plot.axisLabelX = labs[0] || "x";
    plot.axisLabelY = labs[1] || "y";
    plot.showTicks = true;
    plot.curves = coordDialogCurves.map((c) => ({
      id: c.id || uid(),
      type: c.type,
      params: c.type === "circle" ? syncCircleParams({ ...c.params }) : { ...c.params },
      label: normalizeCurveLabel(c.label),
    }));
    ensureCoordPlot(plot);
    delete plot.curveType;
    history[histIndex] = snapshot();
    setSelection([{ type: "coordPlot", id: plot.id }]);
    statusHint.textContent = t("hint_coord_placed");
    return true;
  }

  function handleCoordClick(world) {
    const sn = snapWorld(world.x, world.y);
    const x = sn ? sn.x : world.x;
    const y = sn ? sn.y : world.y;
    pushHistory();
    const plot = defaultCoordPlot(x, y);
    // Start with one editable line so the dialog feels useful
    plot.curves = [makeCoordCurve("line")];
    coordPlots.push(plot);
    history[histIndex] = snapshot();
    setSelection([{ type: "coordPlot", id: plot.id }]);
    updateStatus();
    draw();
    openCoordDialog(plot.id);
  }

  function svgCoordPlot(plot, toS, scale) {
    let body = "";
    const lw = (LINE_WIDTH * scale * 0.75).toFixed(2);
    const o = toS(plot.ox, plot.oy);
    const xNeg = toS(plot.ox + plot.xmin * plot.unitPx, plot.oy);
    const xPos = toS(plot.ox + plot.xmax * plot.unitPx, plot.oy);
    const yNeg = toS(plot.ox, plot.oy - plot.ymin * plot.unitPx);
    const yPos = toS(plot.ox, plot.oy - plot.ymax * plot.unitPx);
    body += `<line x1="${xNeg.x.toFixed(2)}" y1="${xNeg.y.toFixed(2)}" x2="${xPos.x.toFixed(2)}" y2="${xPos.y.toFixed(2)}" stroke="#111" stroke-width="${lw}" stroke-linecap="round" />\n`;
    body += `<line x1="${yNeg.x.toFixed(2)}" y1="${yNeg.y.toFixed(2)}" x2="${yPos.x.toFixed(2)}" y2="${yPos.y.toFixed(2)}" stroke="#111" stroke-width="${lw}" stroke-linecap="round" />\n`;
    const arrow = Math.max(7, LINE_WIDTH * scale * 2.4);
    function arrowPath(x, y, ang) {
      const a1 = ang + Math.PI * 0.82;
      const a2 = ang - Math.PI * 0.82;
      const x1 = x + Math.cos(a1) * arrow;
      const y1 = y + Math.sin(a1) * arrow;
      const x2 = x + Math.cos(a2) * arrow;
      const y2 = y + Math.sin(a2) * arrow;
      return `<path d="M${x.toFixed(2)},${y.toFixed(2)} L${x1.toFixed(2)},${y1.toFixed(2)} M${x.toFixed(2)},${y.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)}" stroke="#111" stroke-width="${lw}" stroke-linecap="round" fill="none" />\n`;
    }
    body += arrowPath(xPos.x, xPos.y, Math.atan2(xPos.y - o.y, xPos.x - o.x));
    body += arrowPath(yPos.x, yPos.y, Math.atan2(yPos.y - o.y, yPos.x - o.x));
    const fontPx = (clampLabelSize(labelFontSize) * scale * 0.75).toFixed(1);
    const tickLen = Math.max(4, LINE_WIDTH * scale * 1.6);
    const showNums = plot.showTickLabels !== false;
    if (plot.showTicks !== false) {
      for (const tick of coordXAxisTickEntries(plot)) {
        const p = toS(plot.ox + tick.u * plot.unitPx, plot.oy);
        body += `<line x1="${p.x.toFixed(2)}" y1="${(p.y - tickLen).toFixed(2)}" x2="${p.x.toFixed(2)}" y2="${(p.y + tickLen).toFixed(2)}" stroke="#111" stroke-width="${lw}" />\n`;
        if (showNums && !coordNearZero(tick.u)) {
          body += svgCoordTickLabel(tick.parts, p.x, p.y + tickLen + 1, fontPx, "#111");
        }
      }
      for (const v of coordIntegerTicks(plot.ymin, plot.ymax)) {
        const p = toS(plot.ox, plot.oy - v * plot.unitPx);
        body += `<line x1="${(p.x - tickLen).toFixed(2)}" y1="${p.y.toFixed(2)}" x2="${(p.x + tickLen).toFixed(2)}" y2="${p.y.toFixed(2)}" stroke="#111" stroke-width="${lw}" />\n`;
        if (showNums && !coordNearZero(v)) {
          body += `<text x="${(p.x - tickLen - 2).toFixed(2)}" y="${p.y.toFixed(2)}" fill="#111" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="${fontPx}" text-anchor="end" dominant-baseline="middle">${escapeXml(String(v))}</text>\n`;
        }
      }
    }
    if (plot.showOrigin !== false) {
      body += `<text x="${(o.x - 4).toFixed(2)}" y="${(o.y + 3).toFixed(2)}" fill="#111" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="${fontPx}" text-anchor="end" dominant-baseline="hanging">O</text>\n`;
    }
    const lx = (plot.axisLabelX || "x").trim();
    const ly = (plot.axisLabelY || "y").trim();
    if (lx) {
      body += `<text x="${(xPos.x + 4).toFixed(2)}" y="${(xPos.y + 2).toFixed(2)}" fill="#111" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="${fontPx}" text-anchor="start" dominant-baseline="hanging">${escapeXml(lx)}</text>\n`;
    }
    if (ly) {
      body += `<text x="${(yPos.x + 4).toFixed(2)}" y="${(yPos.y - 2).toFixed(2)}" fill="#111" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="${fontPx}" text-anchor="start" dominant-baseline="auto">${escapeXml(ly)}</text>\n`;
    }
    for (const curve of coordPlotCurves(plot)) {
      let d = "";
      let pen = false;
      for (const pt of coordSampleOneCurve(plot, curve)) {
        if (!pt) {
          pen = false;
          continue;
        }
        const s = toS(pt.x, pt.y);
        if (!pen) {
          d += `M${s.x.toFixed(2)},${s.y.toFixed(2)}`;
          pen = true;
        } else d += `L${s.x.toFixed(2)},${s.y.toFixed(2)}`;
      }
      if (d) {
        body += `<path d="${d}" fill="none" stroke="#111" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round" />\n`;
      }
    }
    for (const curve of coordPlotCurves(plot)) {
      const text = coordCurveLabelText(curve, plot);
      if (!text) continue;
      const wp = coordCurveLabelWorldPos(plot, curve);
      const sp = toS(wp.x, wp.y);
      const fs = clampLabelSize(labelFontSize) * scale * 0.75;
      const halo = Math.max(3, fs * 0.28);
      body += `<text x="${sp.x.toFixed(2)}" y="${sp.y.toFixed(2)}" fill="none" stroke="#ffffff" stroke-width="${halo.toFixed(2)}" stroke-linejoin="round" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="${fs.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>\n`;
      body += `<text x="${sp.x.toFixed(2)}" y="${sp.y.toFixed(2)}" fill="#111" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="${fs.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>\n`;
    }
    return body;
  }

  /** Screen-space mid-angle label position just outside the arc. */
  function angleArcLabelScreenPos(arc) {
    const v = pointById(arc.vertex);
    const a1 = pointById(arc.arm1);
    const a2 = pointById(arc.arm2);
    if (!v || !a1 || !a2) return null;
    const sv = worldToScreen(v.x, v.y);
    const s1 = worldToScreen(a1.x, a1.y);
    const s2 = worldToScreen(a2.x, a2.y);
    const ang1 = Math.atan2(s1.y - sv.y, s1.x - sv.x);
    const ang2 = Math.atan2(s2.y - sv.y, s2.x - sv.x);
    const delta = angleSweepDelta(ang1, ang2, !!arc.reflex);
    const mid = ang1 + delta / 2;
    const count = (arc.group || 0) === 0 ? 1 : 2;
    const baseR =
      (arc.size || rightAngleSize || DEFAULT_RA_SIZE) *
      ANGLE_ARC_R *
      Math.min(Math.max(view.scale, 0.6), 1.4);
    const outerR =
      baseR + (count - 1) * 6 * Math.min(Math.max(view.scale, 0.6), 1.4);
    const labelR = outerR + 12 * Math.min(Math.max(view.scale, 0.6), 1.4);
    return {
      x: sv.x + Math.cos(mid) * labelR,
      y: sv.y + Math.sin(mid) * labelR,
    };
  }

  function placeDivisionOnSegment(seg, t, withTick, labelText) {
    const pos = pointOnSegment(seg, t);
    if (!pos) return null;
    pushHistory();
    const pt = findOrCreatePointAt(pos.x, pos.y, true);
    if (withTick && !midTicks.some((m) => m.segmentId === seg.id && m.pointId === pt.id)) {
      midTicks.push({ id: uid(), segmentId: seg.id, pointId: pt.id });
    }
    history[histIndex] = snapshot();
    setSelection([{ type: "point", id: pt.id }]);
    openLabelPrompt(pt.id, labelText || takeNextLetter());
    return pt;
  }

  // ——— Draw ———
  function applyStrokeStyle(style, width) {
    ctx.strokeStyle = edInk(false);
    ctx.fillStyle = edInk(false);
    ctx.lineWidth = width;
    // Round caps close dash gaps and make dashed look almost solid — use butt for non-solid.
    ctx.lineCap = style === "solid" || !style ? "round" : "butt";
    ctx.lineJoin = "round";
    const dash = STYLE_DASH[style] || [];
    ctx.setLineDash(dash.map((d) => d));
  }

  function drawSegment(seg, highlight) {
    const a = pointById(seg.a);
    const b = pointById(seg.b);
    if (!a || !b) return;
    const sa = worldToScreen(a.x, a.y);
    const sb = worldToScreen(b.x, b.y);
    const w = (seg.style === "solid" ? LINE_WIDTH : LINE_WIDTH * 0.92) * Math.min(view.scale, 1.8);
    applyStrokeStyle(seg.style, w);
    if (highlight) {
      ctx.strokeStyle = "#1a4a6e";
      ctx.lineWidth = w + 1.2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
      applyStrokeStyle(seg.style, w);
    }
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawPoint(p, highlight) {
    const s = worldToScreen(p.x, p.y);
    if (p.marker === "x" || p.marker === "foot") {
      const r = 5 * Math.min(view.scale, 1.5);
      ctx.strokeStyle = edInk(highlight);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(s.x - r, s.y - r);
      ctx.lineTo(s.x + r, s.y + r);
      ctx.moveTo(s.x + r, s.y - r);
      ctx.lineTo(s.x - r, s.y + r);
      ctx.stroke();
      return;
    }
    const r = POINT_R * Math.min(view.scale, 1.6);
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fillStyle = edInk(highlight);
    ctx.setLineDash([]);
    ctx.fill();
  }

  function labelScreenSize(lab) {
    const base = clampLabelSize(lab.size || labelFontSize);
    return base * Math.min(Math.max(view.scale, 0.7), 1.5);
  }

  function paintLabelText(c, text, x, y, fontPx, fill, withHalo, angleRad) {
    c.save();
    c.translate(x, y);
    if (angleRad) c.rotate(angleRad);
    c.font = `italic ${fontPx}px "STIX Two Text", "Times New Roman", serif`;
    c.textBaseline = "middle";
    c.textAlign = "center";
    if (withHalo) {
      c.lineJoin = "round";
      c.strokeStyle = edHalo();
      c.lineWidth = Math.max(3, fontPx * 0.28);
      c.strokeText(text, 0, 0);
    }
    c.fillStyle = fill;
    c.fillText(text, 0, 0);
    c.restore();
  }

  /** Keep length text readable (not upside-down) while parallel to the edge. */
  function readableEdgeAngle(dx, dy) {
    let ang = Math.atan2(dy, dx);
    if (ang > Math.PI / 2 || ang <= -Math.PI / 2) ang += Math.PI;
    return ang;
  }

  /**
   * Midpoint + normal offset + readable tilt for a length annotation.
   * `toS` maps world → draw/export screen pixels; `offPx` is offset in those pixels.
   */
  function lengthLabelPlacement(seg, side, toS, offPx) {
    const a = pointById(seg.a);
    const b = pointById(seg.b);
    if (!a || !b) return null;
    const s = side === -1 ? -1 : 1;
    const sa = toS(a.x, a.y);
    const sb = toS(b.x, b.y);
    const mx = (sa.x + sb.x) / 2;
    const my = (sa.y + sb.y) / 2;
    let dx = sb.x - sa.x,
      dy = sb.y - sa.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const nx = -dy * s,
      ny = dx * s;
    return {
      x: mx + nx * offPx,
      y: my + ny * offPx,
      angle: readableEdgeAngle(dx, dy),
      dx,
      dy,
      nx,
      ny,
    };
  }

  function drawLabel(lab, highlight) {
    const p = pointById(lab.pointId);
    if (!p) return;
    const s = worldToScreen(p.x + lab.ox, p.y + lab.oy);
    paintLabelText(ctx, lab.text, s.x, s.y, labelScreenSize(lab), edInk(highlight), true);
  }

  function drawRightAngle(ra, highlight) {
    const v = pointById(ra.vertex);
    const a1 = pointById(ra.arm1);
    const a2 = pointById(ra.arm2);
    if (!v || !a1 || !a2) return;
    const sv = worldToScreen(v.x, v.y);
    const s1 = worldToScreen(a1.x, a1.y);
    const s2 = worldToScreen(a2.x, a2.y);
    let ux = s1.x - sv.x,
      uy = s1.y - sv.y;
    let vx = s2.x - sv.x,
      vy = s2.y - sv.y;
    const lu = Math.hypot(ux, uy) || 1;
    const lv = Math.hypot(vx, vy) || 1;
    ux /= lu;
    uy /= lu;
    vx /= lv;
    vy /= lv;
    const size = (ra.size || rightAngleSize || DEFAULT_RA_SIZE) * Math.min(Math.max(view.scale, 0.6), 1.4);
    const p1 = { x: sv.x + ux * size, y: sv.y + uy * size };
    const p2 = { x: sv.x + ux * size + vx * size, y: sv.y + uy * size + vy * size };
    const p3 = { x: sv.x + vx * size, y: sv.y + vy * size };
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.strokeStyle = edInk(highlight);
    ctx.lineWidth = LINE_WIDTH * 0.9;
    ctx.setLineDash([]);
    ctx.stroke();
  }

  /** Circular arc spanning the smaller angle between two arms (exam style). */
  function drawAngleArc(arc, highlight) {
    const v = pointById(arc.vertex);
    const a1 = pointById(arc.arm1);
    const a2 = pointById(arc.arm2);
    if (!v || !a1 || !a2) return;
    const sv = worldToScreen(v.x, v.y);
    const s1 = worldToScreen(a1.x, a1.y);
    const s2 = worldToScreen(a2.x, a2.y);
    const ang1 = Math.atan2(s1.y - sv.y, s1.x - sv.x);
    const ang2 = Math.atan2(s2.y - sv.y, s2.x - sv.x);
    const delta = angleSweepDelta(ang1, ang2, !!arc.reflex);
    const baseR =
      (arc.size || rightAngleSize || DEFAULT_RA_SIZE) *
      ANGLE_ARC_R *
      (arc.reflex ? 1.15 : 1) *
      Math.min(Math.max(view.scale, 0.6), 1.4);
    const count = (arc.group || 0) === 0 ? 1 : 2;
    ctx.strokeStyle = edInk(highlight);
    ctx.lineWidth = LINE_WIDTH * ANGLE_ARC_LW;
    ctx.lineCap = "round";
    ctx.setLineDash([]);
    for (let i = 0; i < count; i++) {
      const r = baseR + i * 6 * Math.min(Math.max(view.scale, 0.6), 1.4);
      ctx.beginPath();
      ctx.arc(sv.x, sv.y, r, ang1, ang1 + delta, delta < 0);
      ctx.stroke();
    }
    const text = (arc.text || "").trim();
    if (text) {
      const pos = angleArcLabelScreenPos(arc);
      if (pos) {
        const fontPx = clampLabelSize(labelFontSize) * Math.min(Math.max(view.scale, 0.7), 1.5);
        paintLabelText(ctx, text, pos.x, pos.y, fontPx, edInk(highlight), true);
      }
    }
  }

  /**
   * Frame for marks on a segment.
   * @param {number} [tAlong=0.5] position along segment 0..1
   * @param {string} [atPointId] override world position (ratio ticks)
   */
  /**
   * Screen-space frame at a point along a segment.
   * dx,dy = unit tangent (segment direction); nx,ny = unit normal (perpendicular).
   * Built from world endpoints so marks stay aligned on diagonals under pan/zoom.
   */
  function segmentScreenFrame(seg, atPointId, tAlong) {
    const a = pointById(seg.a);
    const b = pointById(seg.b);
    if (!a || !b) return null;
    let mx;
    let my;
    if (atPointId) {
      const p = pointById(atPointId);
      if (p) {
        mx = p.x;
        my = p.y;
      }
    }
    if (mx == null) {
      const t = tAlong != null ? tAlong : 0.5;
      mx = a.x + (b.x - a.x) * t;
      my = a.y + (b.y - a.y) * t;
    }
    // Unit direction from world space, then mapped through view (uniform scale → same angle)
    let wdx = b.x - a.x,
      wdy = b.y - a.y;
    const wlen = Math.hypot(wdx, wdy) || 1;
    wdx /= wlen;
    wdy /= wlen;
    const sm = worldToScreen(mx, my);
    const sDir = worldToScreen(mx + wdx, my + wdy);
    let dx = sDir.x - sm.x,
      dy = sDir.y - sm.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    return {
      sm,
      dx,
      dy,
      nx: -dy,
      ny: dx,
      scale: Math.min(Math.max(view.scale, 0.6), 1.4),
    };
  }

  /**
   * Mark basis in the SAME draw space as the segment stroke.
   * `project` maps world → draw (worldToScreen on canvas, toS on export).
   * d = unit tangent in draw space; n = (-d.y, d.x). Uniform scale ⇒ angles preserved.
   */
  function segmentDrawBasis(seg, tAlong, project) {
    const a = pointById(seg.a);
    const b = pointById(seg.b);
    if (!a || !b) return null;
    const t = tAlong != null ? tAlong : 0.5;
    const wx = a.x + (b.x - a.x) * t;
    const wy = a.y + (b.y - a.y) * t;
    const p = project(wx, wy);
    let wdx = b.x - a.x,
      wdy = b.y - a.y;
    const wlen = Math.hypot(wdx, wdy) || 1;
    wdx /= wlen;
    wdy /= wlen;
    // One world-unit along the segment → draw-space direction (handles view.scale)
    const q = project(wx + wdx, wy + wdy);
    let dx = q.x - p.x,
      dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    return {
      px: p.x,
      py: p.y,
      dx,
      dy,
      nx: -dy,
      ny: dx,
      angle: Math.atan2(dy, dx),
    };
  }

  /** @deprecated alias — older call sites / mental model name */
  function segmentWorldBasis(seg, tAlong) {
    return segmentDrawBasis(seg, tAlong, worldToScreen);
  }

  /**
   * Equal-tick strokes in DRAW space: each tick is p ± n*(len/2) (⊥ segment).
   * Lengths/gaps are already in draw pixels (not world).
   */
  function equalMarkDrawStrokes(basis, group, side, halfLen, gap) {
    const count = (group || 0) === 0 ? 1 : 2;
    const start = count === 1 ? 0 : -gap / 2;
    const sideBias = side === -1 ? -gap * 0.25 : 0;
    const strokes = [];
    for (let i = 0; i < count; i++) {
      const along = start + i * gap;
      const cx = basis.px + basis.dx * along + basis.nx * sideBias;
      const cy = basis.py + basis.dy * along + basis.ny * sideBias;
      strokes.push({
        x1: cx - basis.nx * halfLen,
        y1: cy - basis.ny * halfLen,
        x2: cx + basis.nx * halfLen,
        y2: cy + basis.ny * halfLen,
      });
    }
    return strokes;
  }

  /**
   * Textbook parallel marks (圖2): open V / ">" chevrons centered ON the segment.
   * Local +x = segment tangent d, +y = normal n.
   * - Tip points along ±d (side flip reverses tip direction)
   * - Single = one chevron; double = two nested along d (like ">>"), NOT side-by-side on n
   * - Arms symmetric about the segment axis; no normal offset
   */
  function parallelMarkDrawChevrons(basis, group, side, size, gap) {
    const count = (group || 0) === 0 ? 1 : 2;
    // Flip tip direction along the segment (not a lateral offset)
    const dir = side === -1 ? -1 : 1;
    const dx = basis.dx * dir;
    const dy = basis.dy * dir;
    const nx = basis.nx;
    const ny = basis.ny;
    // Open ">" : tip forward, wings back — classic exam // mark
    const tipX = size * 0.52;
    const backX = -size * 0.42;
    const wingY = size * 0.58;
    const chevrons = [];
    for (let i = 0; i < count; i++) {
      // Space along tangent: … -gap/2, +gap/2 …  →  ">>"
      const along = count === 1 ? 0 : (i - (count - 1) / 2) * gap;
      const ox = basis.px + dx * along;
      const oy = basis.py + dy * along;
      const local = [
        { lx: backX, ly: wingY },
        { lx: tipX, ly: 0 },
        { lx: backX, ly: -wingY },
      ];
      chevrons.push(
        local.map(({ lx, ly }) => ({
          x: ox + dx * lx + nx * ly,
          y: oy + dy * lx + ny * ly,
        }))
      );
    }
    return chevrons;
  }

  /** Keep mark pixel size readable under zoom (draw-space unit). */
  function markScreenUnit() {
    return Math.min(Math.max(view.scale, 0.6), 1.4);
  }

  // Back-compat names used by any leftover references
  const equalMarkWorldStrokes = equalMarkDrawStrokes;
  const parallelMarkWorldChevrons = parallelMarkDrawChevrons;

  /** Layout slots along a segment so equal / parallel don't stack on midpoint. */
  function markTAlong(kind, segmentId, group) {
    const hasEqual = equalMarks.some((m) => m.segmentId === segmentId);
    const hasParallel = parallelMarks.some((m) => m.segmentId === segmentId);
    // Keep t=0.5 clear for midpoint point/label
    let t = kind === "equal" ? 0.35 : kind === "parallel" ? 0.65 : 0.5;
    if (kind === "equal" && !hasParallel) t = 0.38;
    if (kind === "parallel" && !hasEqual) t = 0.62;
    if (kind === "equal" && hasParallel) t = 0.32;
    if (kind === "parallel" && hasEqual) t = 0.68;
    // Double-mark groups: nudge further from midpoint
    if ((group || 0) === 1) {
      if (kind === "equal") t -= 0.05;
      if (kind === "parallel") t += 0.05;
    }
    if (kind === "ratio") {
      if (hasEqual && hasParallel) t = 0.5;
      else if (hasEqual) t = 0.55;
      else if (hasParallel) t = 0.45;
      else t = 0.5;
    }
    return Math.max(0.18, Math.min(0.82, t));
  }

  function currentMarkGroupForTool() {
    if (selected) {
      if (selected.type === "parallelMark") {
        const m = parallelMarks.find((x) => x.id === selected.id);
        if (m) return m.group ? 1 : 0;
      }
      if (selected.type === "equalMark") {
        const m = equalMarks.find((x) => x.id === selected.id);
        if (m) return m.group ? 1 : 0;
      }
      if (selected.type === "angleArc") {
        const a = angleArcs.find((x) => x.id === selected.id);
        if (a) return a.group ? 1 : 0;
      }
    }
    if (tool === "parallel") return activeParallelGroup;
    if (tool === "equal") return activeEqualGroup;
    if (tool === "angleArc") return activeArcGroup;
    return activeParallelGroup;
  }

  function setActiveMarkGroup(group) {
    const g = group ? 1 : 0;
    if (tool === "parallel") activeParallelGroup = g;
    else if (tool === "equal") activeEqualGroup = g;
    else if (tool === "angleArc") activeArcGroup = g;
    else {
      activeParallelGroup = g;
      activeEqualGroup = g;
    }
    const markSels = selection.filter(
      (s) =>
        s.type === "parallelMark" ||
        s.type === "equalMark" ||
        s.type === "angleArc"
    );
    if (markSels.length) {
      let changed = false;
      for (const sel of markSels) {
        if (sel.type === "parallelMark") {
          const m = parallelMarks.find((x) => x.id === sel.id);
          if (m && m.group !== g) {
            if (!changed) {
              pushHistory();
              changed = true;
            }
            m.group = g;
            activeParallelGroup = g;
          }
        } else if (sel.type === "equalMark") {
          const m = equalMarks.find((x) => x.id === sel.id);
          if (m && m.group !== g) {
            if (!changed) {
              pushHistory();
              changed = true;
            }
            m.group = g;
            activeEqualGroup = g;
          }
        } else if (sel.type === "angleArc") {
          const a = angleArcs.find((x) => x.id === sel.id);
          if (a && (a.group ? 1 : 0) !== g) {
            if (!changed) {
              pushHistory();
              changed = true;
            }
            a.group = g;
            activeArcGroup = g;
          }
        }
      }
      if (changed) draw();
    }
    syncMarkGroupUI();
    updateStatus();
  }

  function syncMarkGroupUI() {
    const g = currentMarkGroupForTool();
    document.querySelectorAll("[data-mark-group]").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.markGroup) === g);
    });
    syncContextualFloats();
  }

  function drawMidTick(mt) {
    // Ratio division ticks only (midpoint tool has no tick)
    const seg = segmentById(mt.segmentId);
    if (!seg) return;
    const tAlong = mt.pointId ? null : markTAlong("ratio", mt.segmentId, 0);
    const f = segmentScreenFrame(seg, mt.pointId, tAlong == null ? undefined : tAlong);
    if (!f) return;
    const tick = MID_TICK * 1.15 * f.scale;
    ctx.beginPath();
    ctx.moveTo(f.sm.x - f.nx * tick, f.sm.y - f.ny * tick);
    ctx.lineTo(f.sm.x + f.nx * tick, f.sm.y + f.ny * tick);
    ctx.strokeStyle = edInk(false);
    ctx.lineWidth = LINE_WIDTH * 1.15;
    ctx.setLineDash([]);
    ctx.stroke();
  }

  /** Parallel chevron(s) — axis along segment in draw space. */
  function drawParallelMark(mark, highlight) {
    const seg = segmentById(mark.segmentId);
    if (!seg) return;
    const tAlong = markTAlong("parallel", mark.segmentId, mark.group);
    const basis = segmentDrawBasis(seg, tAlong, worldToScreen);
    if (!basis) return;
    const unit = markScreenUnit();
    // size = chevron arm scale; gap = spacing along segment for ">>"
    const size = 11 * unit;
    const gap = 9 * unit;
    const chevrons = parallelMarkDrawChevrons(
      basis,
      mark.group,
      mark.side === -1 ? -1 : 1,
      size,
      gap
    );
    ctx.strokeStyle = edInk(highlight);
    ctx.lineWidth = LINE_WIDTH * 1.55;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([]);
    for (const pts of chevrons) {
      // Open V: wing → tip → wing (stroke only, never filled)
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.stroke();
    }
  }

  /** Congruent length ticks — ⊥ segment in draw space: p ± n*(len/2). */
  function drawEqualMark(mark, highlight) {
    const seg = segmentById(mark.segmentId);
    if (!seg) return;
    const tAlong = markTAlong("equal", mark.segmentId, mark.group);
    const basis = segmentDrawBasis(seg, tAlong, worldToScreen);
    if (!basis) return;
    const unit = markScreenUnit();
    const halfLen = MID_TICK * 2.35 * unit; // slightly longer so ⊥ reads on steep diagonals
    const gap = 7 * unit;
    const strokes = equalMarkDrawStrokes(
      basis,
      mark.group,
      mark.side === -1 ? -1 : 1,
      halfLen,
      gap
    );
    ctx.strokeStyle = edInk(highlight);
    ctx.lineWidth = LINE_WIDTH * 1.55;
    ctx.lineCap = "round";
    ctx.setLineDash([]);
    for (const s of strokes) {
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
  }

  function addOrToggleSegMark(listName, segmentId, group) {
    const list = listName === "parallel" ? parallelMarks : equalMarks;
    const existing = list.find((m) => m.segmentId === segmentId);
    pushHistory();
    if (existing) {
      if (existing.group === group) {
        // toggle off
        if (listName === "parallel") {
          parallelMarks = parallelMarks.filter((m) => m.id !== existing.id);
        } else {
          equalMarks = equalMarks.filter((m) => m.id !== existing.id);
        }
      } else {
        existing.group = group;
      }
    } else {
      const mark = { id: uid(), segmentId, group, side: 1 };
      if (listName === "parallel") parallelMarks.push(mark);
      else equalMarks.push(mark);
    }
  }

  function flipSelectedMarks() {
    const marks = selection.filter(
      (s) => s.type === "parallelMark" || s.type === "equalMark" || s.type === "lengthLabel"
    );
    if (!marks.length) {
      statusHint.textContent = "請先選取平行／等長／長度記號再翻面";
      return;
    }
    pushHistory();
    for (const sel of marks) {
      if (sel.type === "parallelMark") {
        const m = parallelMarks.find((x) => x.id === sel.id);
        if (m) m.side = m.side === -1 ? 1 : -1;
      } else if (sel.type === "equalMark") {
        const m = equalMarks.find((x) => x.id === sel.id);
        if (m) m.side = m.side === -1 ? 1 : -1;
      } else if (sel.type === "lengthLabel") {
        const m = lengthLabels.find((x) => x.id === sel.id);
        if (m) m.side = m.side === -1 ? 1 : -1;
      }
    }
    draw();
  }

  /** Place parallel/equal mark; group 0 = single, 1 = double. Mirrors toolbar. */
  function placeSegMarkAt(world, markTool, group) {
    const g = group ? 1 : 0;
    const seg = nearestSegmentHit(world.x, world.y);
    if (!seg) {
      statusHint.textContent =
        markTool === "parallel"
          ? "請點選要加平行記號的線段"
          : "請點選要加等長記號的線段";
      return;
    }
    if (markTool === "parallel") {
      activeParallelGroup = g;
      addOrToggleSegMark("parallel", seg.id, g);
      const mark = parallelMarks.find((m) => m.segmentId === seg.id);
      setSelection(mark ? [{ type: "parallelMark", id: mark.id }] : []);
    } else {
      activeEqualGroup = g;
      addOrToggleSegMark("equal", seg.id, g);
      const mark = equalMarks.find((m) => m.segmentId === seg.id);
      setSelection(mark ? [{ type: "equalMark", id: mark.id }] : []);
    }
    syncMarkGroupUI();
    updateStatus();
    draw();
  }

  function drawLengthLabel(ll, highlight) {
    const seg = segmentById(ll.segmentId);
    if (!seg) return;
    const off = 14 * Math.min(Math.max(view.scale, 0.6), 1.4);
    const place = lengthLabelPlacement(seg, ll.side, worldToScreen, off);
    if (!place) return;
    const fontPx = clampLabelSize(labelFontSize) * Math.min(Math.max(view.scale, 0.7), 1.5);
    paintLabelText(
      ctx,
      ll.text,
      place.x,
      place.y,
      fontPx,
      edInk(highlight),
      true,
      place.angle
    );
  }

  function circleStyle(cir) {
    return cir.style || "solid";
  }

  function drawCircle(cir, highlight) {
    const c = pointById(cir.centerId);
    const thr = pointById(cir.throughId);
    if (!c || !thr) return;
    const sc = worldToScreen(c.x, c.y);
    const st = worldToScreen(thr.x, thr.y);
    const r = Math.hypot(st.x - sc.x, st.y - sc.y);
    const style = circleStyle(cir);
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = edInk(highlight);
    ctx.lineWidth = LINE_WIDTH * 0.95;
    const dash = STYLE_DASH[style] || [];
    ctx.setLineDash(dash.map((d) => d));
    ctx.lineCap = style === "solid" || !style ? "round" : "butt";
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Stroke an axis-aligned ellipse; with backDashed, far (upper) half is dashed. */
  function strokeEllipsePath(c2d, scx, scy, srx, sry, style, backDashed, color, lw) {
    const dash = STYLE_DASH[style] || [];
    const dashArr = dash.map((d) => d);
    const backDash = STYLE_DASH.dashed.map((d) => d);
    c2d.strokeStyle = color;
    c2d.lineWidth = lw;
    if (backDashed && (style === "solid" || !style)) {
      // Front = lower half (t 0..π, +sin = down in canvas)
      c2d.beginPath();
      c2d.ellipse(scx, scy, srx, sry, 0, 0, Math.PI, false);
      c2d.setLineDash([]);
      c2d.lineCap = "round";
      c2d.stroke();
      c2d.beginPath();
      c2d.ellipse(scx, scy, srx, sry, 0, Math.PI, Math.PI * 2, false);
      c2d.setLineDash(backDash);
      c2d.lineCap = "butt";
      c2d.stroke();
      c2d.setLineDash([]);
    } else {
      c2d.beginPath();
      c2d.ellipse(scx, scy, srx, sry, 0, 0, Math.PI * 2);
      c2d.setLineDash(dashArr);
      c2d.lineCap = style === "solid" || !style ? "round" : "butt";
      c2d.stroke();
      c2d.setLineDash([]);
    }
  }

  function drawEllipse(el, highlight) {
    const dims = ellipseDims(el);
    if (!dims) return;
    const { c, rx, ry } = dims;
    if (rx < 0.5 || ry < 0.5) return;
    const sc = worldToScreen(c.x, c.y);
    const srx = rx * view.scale;
    const sry = ry * view.scale;
    strokeEllipsePath(
      ctx,
      sc.x,
      sc.y,
      srx,
      sry,
      ellipseStyle(el),
      !!el.backDashed,
      edInk(highlight),
      LINE_WIDTH * 0.95
    );
  }

  function drawSector(sec, highlight) {
    const g = sectorGeom(sec);
    if (!g) return;
    const sc = worldToScreen(g.c.x, g.c.y);
    const sr = g.r * view.scale;
    if (sr < 0.5) return;
    const style = sectorStyle(sec);
    const color = edInk(highlight);
    const dash = STYLE_DASH[style] || [];
    ctx.strokeStyle = color;
    ctx.lineWidth = LINE_WIDTH * 0.95;
    ctx.setLineDash(dash.map((d) => d));
    ctx.lineCap = style === "solid" || !style ? "round" : "butt";
    if (g.mode === "sector") {
      const s0 = worldToScreen(g.s.x, g.s.y);
      const s1 = worldToScreen(
        g.c.x + Math.cos(g.a1) * g.r,
        g.c.y + Math.sin(g.a1) * g.r
      );
      ctx.beginPath();
      ctx.moveTo(sc.x, sc.y);
      ctx.lineTo(s0.x, s0.y);
      ctx.moveTo(sc.x, sc.y);
      ctx.lineTo(s1.x, s1.y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, sr, g.a0, g.a1, g.anticlockwise);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawExportCropOverlay() {
    if (!exportCrop && !(draft && draft.kind === "exportCrop")) return;
    let minX, minY, maxX, maxY;
    if (draft && draft.kind === "exportCrop") {
      minX = Math.min(draft.x0, draft.x1);
      minY = Math.min(draft.y0, draft.y1);
      maxX = Math.max(draft.x0, draft.x1);
      maxY = Math.max(draft.y0, draft.y1);
    } else {
      minX = exportCrop.minX;
      minY = exportCrop.minY;
      maxX = exportCrop.maxX;
      maxY = exportCrop.maxY;
    }
    const a = worldToScreen(minX, minY);
    const b = worldToScreen(maxX, maxY);
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    ctx.save();
    ctx.fillStyle = "rgba(26,74,110,0.06)";
    ctx.strokeStyle = "rgba(26,74,110,0.85)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(26,74,110,0.9)";
    ctx.font = "12px " + (getComputedStyle(document.body).fontFamily || "serif");
    ctx.fillText("匯出範圍", x + 6, y + 16);
    ctx.restore();
  }

  function clearAlignGuides() {
    alignGuides = [];
  }

  function updateAlignGuidesForPoint(wx, wy, excludeIds) {
    alignGuides = [];
    const ex = excludeIds instanceof Set ? excludeIds : new Set(excludeIds || []);
    const thresh = ALIGN_THRESH_PX / view.scale;
    let bestDx = thresh + 1;
    let bestDy = thresh + 1;
    let guideX = null;
    let guideY = null;
    for (const p of points) {
      if (ex.has(p.id)) continue;
      const dx = Math.abs(p.x - wx);
      const dy = Math.abs(p.y - wy);
      if (dx < bestDx) {
        bestDx = dx;
        guideX = p.x;
      }
      if (dy < bestDy) {
        bestDy = dy;
        guideY = p.y;
      }
    }
    if (guideX != null && bestDx <= thresh) {
      alignGuides.push({ kind: "v", x: guideX });
    }
    if (guideY != null && bestDy <= thresh) {
      alignGuides.push({ kind: "h", y: guideY });
    }
    return {
      x: guideX != null && bestDx <= thresh ? guideX : wx,
      y: guideY != null && bestDy <= thresh ? guideY : wy,
    };
  }

  function maybeEqualLengthGuide(a, b) {
    if (!a || !b) return;
    const len = dist(a, b);
    if (len < 1e-6) return;
    let best = null;
    let bestRel = EQUAL_LEN_RATIO;
    for (const seg of segments) {
      const p = pointById(seg.a);
      const q = pointById(seg.b);
      if (!p || !q) continue;
      const L = dist(p, q);
      if (L < 1e-6) continue;
      const rel = Math.abs(L - len) / L;
      if (rel < bestRel) {
        bestRel = rel;
        best = { p, q, L };
      }
    }
    if (best) {
      alignGuides.push({
        kind: "equal",
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        label: "≈等長",
      });
    }
  }

  function drawAlignGuidesOverlay() {
    if (!alignGuides.length) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.save();
    for (const g of alignGuides) {
      if (g.kind === "v") {
        const sx = worldToScreen(g.x, 0).x;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, h);
        ctx.strokeStyle = "rgba(42,122,176,0.55)";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
      } else if (g.kind === "h") {
        const sy = worldToScreen(0, g.y).y;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(w, sy);
        ctx.strokeStyle = "rgba(42,122,176,0.55)";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
      } else if (g.kind === "equal") {
        const s0 = worldToScreen(g.x1, g.y1);
        const s1 = worldToScreen(g.x2, g.y2);
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.lineTo(s1.x, s1.y);
        ctx.strokeStyle = "rgba(42,160,120,0.65)";
        ctx.lineWidth = 1.25;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(42,160,120,0.95)";
        ctx.font = "11px " + (getComputedStyle(document.body).fontFamily || "sans-serif");
        ctx.fillText(g.label || "≈等長", (s0.x + s1.x) / 2 + 6, (s0.y + s1.y) / 2 - 6);
      }
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawGuides() {
    drawAlignGuidesOverlay();
    if (!draft) return;
    ctx.save();
    if ((draft.kind === "perpendicular" || draft.kind === "horizontal") && draft.from) {
      const from = pointById(draft.from);
      if (from && draft.cursor) {
        const s0 = worldToScreen(from.x, from.y);
        const s1 = worldToScreen(draft.cursor.x, draft.cursor.y);
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.lineTo(s1.x, s1.y);
        ctx.strokeStyle = "rgba(42,122,176,0.7)";
        ctx.lineWidth = LINE_WIDTH;
        ctx.setLineDash(
          draft.kind === "perpendicular"
            ? STYLE_DASH.dotted.map((v) => v * Math.max(1, view.scale * 0.85))
            : [4, 4]
        );
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(s1.x, s1.y, POINT_R + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(42,122,176,0.85)";
        ctx.fill();
      }
    }
    if (draft.kind === "tangent" && draft.touch) {
      const p = draft.pointId ? pointById(draft.pointId) : draft.touch;
      const cir = circles.find((c) => c.id === draft.circleId);
      const tan = p && cir ? tangentUnitAt(cir, p) : null;
      const half = Math.abs(Number(draft.halfLen) || 0);
      if (p && tan) {
        const a = { x: p.x - half * tan.tx, y: p.y - half * tan.ty };
        const b = { x: p.x + half * tan.tx, y: p.y + half * tan.ty };
        const s0 = worldToScreen(a.x, a.y);
        const s1 = worldToScreen(b.x, b.y);
        const sp = worldToScreen(p.x, p.y);
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.lineTo(s1.x, s1.y);
        ctx.strokeStyle = "rgba(42,122,176,0.75)";
        ctx.lineWidth = LINE_WIDTH;
        ctx.setLineDash([5, 4]);
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, POINT_R + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(42,122,176,0.9)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s0.x, s0.y, POINT_R + 0.5, 0, Math.PI * 2);
        ctx.arc(s1.x, s1.y, POINT_R + 0.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(42,122,176,0.7)";
        ctx.fill();
      }
    }
    if (draft.kind === "circlePart" && draft.touch) {
      const cir = circles.find((c) => c.id === draft.circleId);
      const g = circleGeomBasic(cir);
      const mode = draft.mode || circlePartMode;
      ctx.strokeStyle = "rgba(42,122,176,0.75)";
      ctx.lineWidth = LINE_WIDTH;
      ctx.setLineDash([5, 4]);
      ctx.lineCap = "round";
      if (mode === "chord" && draft.endTouch) {
        const s0 = worldToScreen(draft.touch.x, draft.touch.y);
        const s1 = worldToScreen(draft.endTouch.x, draft.endTouch.y);
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.lineTo(s1.x, s1.y);
        ctx.stroke();
      } else if (mode === "diameter" && g) {
        const end = draft.endTouch || draft.touch;
        const dx = end.x - g.c.x;
        const dy = end.y - g.c.y;
        const L = Math.hypot(dx, dy) || 1;
        const a = { x: g.c.x - g.r * (dx / L), y: g.c.y - g.r * (dy / L) };
        const b = { x: g.c.x + g.r * (dx / L), y: g.c.y + g.r * (dy / L) };
        const s0 = worldToScreen(a.x, a.y);
        const s1 = worldToScreen(b.x, b.y);
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.lineTo(s1.x, s1.y);
        ctx.stroke();
      } else if (mode === "radius" && g) {
        const end = draft.endTouch || draft.touch;
        const s0 = worldToScreen(g.c.x, g.c.y);
        const s1 = worldToScreen(end.x, end.y);
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.lineTo(s1.x, s1.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    if (draft.kind === "shape" && draft.x0 != null) {
      const corners = shapeCornersFromDrag(
        draft.mode || shapeMode,
        draft.x0,
        draft.y0,
        draft.x1,
        draft.y1
      );
      if (corners && corners.length) {
        ctx.beginPath();
        const s0 = worldToScreen(corners[0].x, corners[0].y);
        ctx.moveTo(s0.x, s0.y);
        for (let i = 1; i < corners.length; i++) {
          const s = worldToScreen(corners[i].x, corners[i].y);
          ctx.lineTo(s.x, s.y);
        }
        ctx.closePath();
        ctx.strokeStyle = "rgba(42,122,176,0.7)";
        ctx.lineWidth = LINE_WIDTH;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (draft.kind === "circle" && draft.centerId && draft.cursor) {
      const c = pointById(draft.centerId);
      if (c) {
        const sc = worldToScreen(c.x, c.y);
        const st = worldToScreen(draft.cursor.x, draft.cursor.y);
        const r = Math.hypot(st.x - sc.x, st.y - sc.y);
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(42,122,176,0.6)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (draft.kind === "ellipse" && draft.centerId && draft.cursor) {
      const c = pointById(draft.centerId);
      if (c) {
        const sc = worldToScreen(c.x, c.y);
        ctx.strokeStyle = "rgba(42,122,176,0.6)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        if (draft.rxId) {
          const rxP = pointById(draft.rxId);
          const rx = rxP ? Math.abs(rxP.x - c.x) : Math.abs(draft.cursor.x - c.x);
          const ry = Math.abs(draft.cursor.y - c.y);
          if (rx > 0.5 && ry > 0.5) {
            ctx.beginPath();
            ctx.ellipse(sc.x, sc.y, rx * view.scale, ry * view.scale, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else {
          const rx = Math.abs(draft.cursor.x - c.x);
          if (rx > 0.5) {
            ctx.beginPath();
            ctx.ellipse(sc.x, sc.y, rx * view.scale, rx * view.scale * 0.45, 0, 0, Math.PI * 2);
            ctx.stroke();
            const s1 = worldToScreen(draft.cursor.x, c.y);
            ctx.beginPath();
            ctx.moveTo(sc.x, sc.y);
            ctx.lineTo(s1.x, s1.y);
            ctx.stroke();
          }
        }
        ctx.setLineDash([]);
      }
    }
    if (draft.kind === "sector" && draft.centerId && draft.cursor) {
      const c = pointById(draft.centerId);
      if (c) {
        const sc = worldToScreen(c.x, c.y);
        ctx.strokeStyle = "rgba(42,122,176,0.6)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        if (!draft.startId) {
          const s1 = worldToScreen(draft.cursor.x, draft.cursor.y);
          ctx.beginPath();
          ctx.moveTo(sc.x, sc.y);
          ctx.lineTo(s1.x, s1.y);
          ctx.stroke();
        } else {
          const start = pointById(draft.startId);
          if (start) {
            const r = dist(c, start);
            const a0 = Math.atan2(start.y - c.y, start.x - c.x);
            const a1 = Math.atan2(draft.cursor.y - c.y, draft.cursor.x - c.x);
            let delta = a1 - a0;
            while (delta <= -Math.PI) delta += Math.PI * 2;
            while (delta > Math.PI) delta -= Math.PI * 2;
            const anticlockwise = delta < 0;
            if (draft.mode === "sector") {
              const s0 = worldToScreen(start.x, start.y);
              const s1 = worldToScreen(
                c.x + Math.cos(a1) * r,
                c.y + Math.sin(a1) * r
              );
              ctx.beginPath();
              ctx.moveTo(sc.x, sc.y);
              ctx.lineTo(s0.x, s0.y);
              ctx.moveTo(sc.x, sc.y);
              ctx.lineTo(s1.x, s1.y);
              ctx.stroke();
            }
            ctx.beginPath();
            ctx.arc(sc.x, sc.y, r * view.scale, a0, a1, anticlockwise);
            ctx.stroke();
          }
        }
        ctx.setLineDash([]);
      }
    }
    if (draft.kind === "boxSelect" && draft.x0 != null) {
      const a = worldToScreen(draft.x0, draft.y0);
      const b = worldToScreen(draft.x1, draft.y1);
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
      ctx.fillStyle = "rgba(26,74,110,0.08)";
      ctx.strokeStyle = "rgba(26,74,110,0.7)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
    if (draft.kind === "line" && draft.from) {
      const from = pointById(draft.from);
      if (from) {
        const s0 = worldToScreen(from.x, from.y);
        const s1 = draft.cursor ? worldToScreen(draft.cursor.x, draft.cursor.y) : s0;
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.lineTo(s1.x, s1.y);
        ctx.strokeStyle = "rgba(42,122,176,0.55)";
        ctx.lineWidth = 1;
        // Guide only; final style set by 2nd click (left=solid / right=dashed)
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (draft.kind === "fill" && draft.pointIds && draft.pointIds.length) {
      const style = activeFillStyle();
      const pts = [];
      for (const id of draft.pointIds) {
        const p = pointById(id);
        if (p) pts.push(p);
      }
      if (pts.length) {
        ctx.beginPath();
        const s0 = worldToScreen(pts[0].x, pts[0].y);
        ctx.moveTo(s0.x, s0.y);
        for (let i = 1; i < pts.length; i++) {
          const s = worldToScreen(pts[i].x, pts[i].y);
          ctx.lineTo(s.x, s.y);
        }
        if (draft.cursor) {
          const sc = worldToScreen(draft.cursor.x, draft.cursor.y);
          ctx.lineTo(sc.x, sc.y);
        }
        if (pts.length >= 3) {
          ctx.closePath();
          ctx.fillStyle = hexToRgba(style.color, Math.min(0.35, style.opacity));
          ctx.fill();
        }
        ctx.strokeStyle = "rgba(42,122,176,0.7)";
        ctx.lineWidth = 1.25;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        for (const p of pts) {
          const s = worldToScreen(p.x, p.y);
          ctx.beginPath();
          ctx.arc(s.x, s.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(42,122,176,0.9)";
          ctx.fill();
        }
      }
    }
    if ((draft.kind === "rightAngle" || draft.kind === "angleArc") && draft.vertex) {
      const v = pointById(draft.vertex);
      if (v) {
        const sv = worldToScreen(v.x, v.y);
        ctx.beginPath();
        ctx.arc(sv.x, sv.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(26,74,110,0.9)";
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();
        const candidates = connectedNeighbors(draft.vertex).filter((id) => id !== draft.arm1);
        for (const id of candidates) {
          const p = pointById(id);
          if (!p) continue;
          const s = worldToScreen(p.x, p.y);
          ctx.beginPath();
          ctx.moveTo(sv.x, sv.y);
          ctx.lineTo(s.x, s.y);
          ctx.strokeStyle = "rgba(42,122,176,0.45)";
          ctx.lineWidth = 2.2;
          ctx.setLineDash([5, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(42,122,176,0.85)";
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
        if (draft.arm1) {
          const a1 = pointById(draft.arm1);
          if (a1) {
            const s1 = worldToScreen(a1.x, a1.y);
            ctx.beginPath();
            ctx.moveTo(sv.x, sv.y);
            ctx.lineTo(s1.x, s1.y);
            ctx.strokeStyle = "rgba(26,74,110,0.85)";
            ctx.lineWidth = 2.4;
            ctx.setLineDash([]);
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
  }

  function drawSnapHalo() {
    if (hoverSnap) {
      const p = pointById(hoverSnap);
      if (!p) return;
      const s = worldToScreen(p.x, p.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, SNAP_PX * 0.7, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(42,122,176,0.55)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([]);
      ctx.stroke();
      return;
    }
    if (hoverGeomSnap) {
      if (hoverGeomSnap.kind === "segment" && hoverGeomSnap.segmentId) {
        const seg = segmentById(hoverGeomSnap.segmentId);
        if (seg) {
          const a = pointById(seg.a);
          const b = pointById(seg.b);
          if (a && b) {
            const sa = worldToScreen(a.x, a.y);
            const sb = worldToScreen(b.x, b.y);
            ctx.beginPath();
            ctx.moveTo(sa.x, sa.y);
            ctx.lineTo(sb.x, sb.y);
            ctx.strokeStyle = "rgba(42,122,176,0.55)";
            ctx.lineWidth = LINE_WIDTH + 2.2;
            ctx.setLineDash([]);
            ctx.lineCap = "round";
            ctx.stroke();
          }
        }
      } else if (hoverGeomSnap.kind === "circle" && hoverGeomSnap.circleId) {
        const cir = circles.find((c) => c.id === hoverGeomSnap.circleId);
        if (cir) {
          const c = pointById(cir.centerId);
          const thr = pointById(cir.throughId);
          if (c && thr) {
            const sc = worldToScreen(c.x, c.y);
            const st = worldToScreen(thr.x, thr.y);
            const r = Math.hypot(st.x - sc.x, st.y - sc.y);
            ctx.beginPath();
            ctx.arc(sc.x, sc.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(42,122,176,0.55)";
            ctx.lineWidth = LINE_WIDTH + 2.2;
            ctx.setLineDash([]);
            ctx.lineCap = "round";
            ctx.stroke();
          }
        }
      } else if (hoverGeomSnap.kind === "ellipse" && hoverGeomSnap.ellipseId) {
        const el = ellipses.find((c) => c.id === hoverGeomSnap.ellipseId);
        if (el) {
          const dims = ellipseDims(el);
          if (dims) {
            const sc = worldToScreen(dims.c.x, dims.c.y);
            ctx.beginPath();
            ctx.ellipse(
              sc.x,
              sc.y,
              dims.rx * view.scale,
              dims.ry * view.scale,
              0,
              0,
              Math.PI * 2
            );
            ctx.strokeStyle = "rgba(42,122,176,0.55)";
            ctx.lineWidth = LINE_WIDTH + 2.2;
            ctx.setLineDash([]);
            ctx.lineCap = "round";
            ctx.stroke();
          }
        }
      } else if (hoverGeomSnap.kind === "sector" && hoverGeomSnap.sectorId) {
        const sec = sectors.find((c) => c.id === hoverGeomSnap.sectorId);
        if (sec) drawSector(sec, true);
      }
      const s = worldToScreen(hoverGeomSnap.x, hoverGeomSnap.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, SNAP_PX * 0.7, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(42,122,176,0.7)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s.x, s.y, POINT_R + 1, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(42,122,176,0.85)";
      ctx.fill();
    }
  }


  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.save();
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = edPaper();
    ctx.fillRect(0, 0, w, h);

    if (layers.gridShow) drawActiveGrid(w, h);

    if (points.length === 0 && !draft) {
      const o = worldToScreen(0, 0);
      ctx.strokeStyle = darkCanvas ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(o.x - 20, o.y);
      ctx.lineTo(o.x + 20, o.y);
      ctx.moveTo(o.x, o.y - 20);
      ctx.lineTo(o.x, o.y + 20);
      ctx.stroke();
    }

    for (const f of fills) {
      drawFillShape(f, isSelected("fill", f.id));
    }

    for (const cir of circles) {
      drawCircle(cir, isSelected("circle", cir.id));
    }
    for (const el of ellipses) {
      drawEllipse(el, isSelected("ellipse", el.id));
    }
    for (const sec of sectors) {
      drawSector(sec, isSelected("sector", sec.id));
    }
    for (const seg of segments) {
      drawSegment(seg, isSelected("segment", seg.id));
    }
    if (layers.helpersShow) {
      for (const mt of midTicks) drawMidTick(mt);
      for (const pm of parallelMarks) {
        drawParallelMark(pm, isSelected("parallelMark", pm.id));
      }
      for (const em of equalMarks) {
        drawEqualMark(em, isSelected("equalMark", em.id));
      }
      for (const ll of lengthLabels) {
        drawLengthLabel(ll, isSelected("lengthLabel", ll.id));
      }
      for (const ra of rightAngles) {
        drawRightAngle(ra, isSelected("rightAngle", ra.id));
      }
      for (const arc of angleArcs) {
        drawAngleArc(arc, isSelected("angleArc", arc.id));
      }
    }
    if (layers.coordsShow) {
      for (const cp of coordPlots) {
        drawCoordPlot(cp, isSelected("coordPlot", cp.id));
      }
      for (const cp of coordPlots) {
        if (isSelected("coordPlot", cp.id)) drawCoordPlotResizeHandles(cp);
      }
    }
    for (const p of points) {
      drawPoint(p, isSelected("point", p.id));
    }
    for (const lab of labels) {
      drawLabel(lab, isSelected("label", lab.id));
    }

    drawGuides();
    drawExportCropOverlay();
    drawSnapHalo();
    ctx.restore();
  }

  // ——— Interaction ———
  function updateHoverSnap(wx, wy) {
    if (
      tool === "select" ||
      tool === "hand" ||
      tool === "midTick" ||
      tool === "ratio" ||
      tool === "parallel" ||
      tool === "equal" ||
      tool === "length" ||
      tool === "intersect"
    ) {
      hoverSnap = null;
      hoverGeomSnap = null;
      updateStatus();
      return;
    }
    let p = null;
    hoverGeomSnap = null;
    if (
      (tool === "rightAngle" || tool === "angleArc") &&
      draft &&
      (draft.kind === "rightAngle" || draft.kind === "angleArc") &&
      draft.vertex
    ) {
      p = snapRightArm(wx, wy, draft.vertex, draft.arm1);
    } else {
      p = snapWorld(wx, wy);
    }
    hoverSnap = p ? p.id : null;
    if (!hoverSnap && tool === "point") {
      hoverGeomSnap = snapToSegmentOrCircle(wx, wy);
    }
    updateStatus();
  }

  function onPointerDown(e) {
    canvas.focus();
    const pos = canvasPos(e);
    const world = screenToWorld(pos.x, pos.y);

    if (e.button === 1 || (e.button === 0 && (spaceDown || tool === "hand"))) {
      panning = true;
      panLast = pos;
      canvas.classList.add("panning", "active", "space-pan");
      e.preventDefault();
      return;
    }

    // Line tool: left = solid, right = dashed (override toolbar style)
    if (tool === "line" && (e.button === 0 || e.button === 2)) {
      e.preventDefault();
      handleLineClick(world, e.button === 2 ? "dashed" : "solid");
      return;
    }

    // Ellipse: left = solid, right = dashed on the completing (3rd) click
    if (tool === "ellipse" && (e.button === 0 || e.button === 2)) {
      e.preventDefault();
      handleEllipseClick(world, e.button === 2 ? "dashed" : "solid");
      return;
    }

    // Sector/arc: left = solid, right = dashed on completing click
    if (tool === "sector" && (e.button === 0 || e.button === 2)) {
      e.preventDefault();
      handleSectorClick(world, e.button === 2 ? "dashed" : "solid");
      return;
    }

    // Parallel / equal: left = single, right = double (override toolbar group)
    if (
      (tool === "parallel" || tool === "equal") &&
      (e.button === 0 || e.button === 2)
    ) {
      e.preventDefault();
      const group = e.button === 2 ? 1 : 0;
      placeSegMarkAt(world, tool, group);
      return;
    }

    // Label: left = dialog, right = quick default (no confirm)
    if (tool === "label" && (e.button === 0 || e.button === 2)) {
      e.preventDefault();
      handleLabelClick(world, e.button === 0);
      return;
    }

    // Fill: click existing vertices to define a closed polygon
    if (tool === "fill" && e.button === 0) {
      e.preventDefault();
      handleFillClick(world);
      return;
    }

    if (e.button !== 0) return;

    if (tool === "exportCrop") {
      draft = {
        kind: "exportCrop",
        x0: world.x,
        y0: world.y,
        x1: world.x,
        y1: world.y,
      };
      statusHint.textContent = "拖曳框選匯出範圍，放開完成";
      draw();
      return;
    }

    if (tool === "select") {
      // Curve labels win over resize handles / plot drag
      const labHit0 = nearestCoordCurveLabelHit(world.x, world.y);
      if (labHit0) {
        setSelection([
          {
            type: "coordPlot",
            id: labHit0.plotId,
            curveId: labHit0.curveId,
            label: true,
          },
        ]);
        drag = {
          kind: "coordCurveLabel",
          plotId: labHit0.plotId,
          curveId: labHit0.curveId,
          startWx: world.x,
          startWy: world.y,
          moved: false,
        };
        canvas.style.cursor = "move";
        draw();
        return;
      }
      const rh = nearestCoordResizeHandle(world.x, world.y);
      if (rh) {
        setSelection([{ type: "coordPlot", id: rh.plotId }]);
        drag = {
          kind: "coordResize",
          plotId: rh.plotId,
          handleId: rh.handleId,
          u: rh.u,
          v: rh.v,
          unit0: rh.unit0,
          startWx: world.x,
          startWy: world.y,
          moved: false,
        };
        draw();
        return;
      }
      const hit = hitTest(world.x, world.y);
      const additive = e.shiftKey;
      if (hit) {
        if (additive) toggleSelect(hit, true);
        else if (!isSelected(hit.type, hit.id)) setSelection([hit]);
        else selected = hit; // keep multi, set primary
        if (hit.type === "label") {
          const lab = labels.find((l) => l.id === hit.id);
          if (lab && labelSizeSelect) labelSizeSelect.value = String(lab.size || DEFAULT_LABEL_SIZE);
        }
        if (hit.type === "rightAngle") {
          const ra = rightAngles.find((r) => r.id === hit.id);
          if (ra && rightAngleSizeSelect) {
            rightAngleSizeSelect.value = String(ra.size || DEFAULT_RA_SIZE);
          }
        }
        if (hit.type === "angleArc") {
          const arc = angleArcs.find((r) => r.id === hit.id);
          if (arc && rightAngleSizeSelect) {
            rightAngleSizeSelect.value = String(arc.size || DEFAULT_RA_SIZE);
          }
        }
        // Multi-drag: move all selected points (and label offsets for label-only)
        const pointIds = new Set();
        for (const s of selection) {
          if (s.type === "point") pointIds.add(s.id);
          else if (s.type === "segment") {
            const seg = segmentById(s.id);
            if (seg) { pointIds.add(seg.a); pointIds.add(seg.b); }
          } else if (s.type === "circle") {
            const cir = circles.find((c) => c.id === s.id);
            if (cir) { pointIds.add(cir.centerId); pointIds.add(cir.throughId); }
          } else if (s.type === "ellipse") {
            const el = ellipses.find((c) => c.id === s.id);
            if (el) {
              pointIds.add(el.centerId);
              pointIds.add(el.rxId);
              pointIds.add(el.ryId);
            }
          } else if (s.type === "sector") {
            const sec = sectors.find((c) => c.id === s.id);
            if (sec) {
              pointIds.add(sec.centerId);
              pointIds.add(sec.startId);
              pointIds.add(sec.endId);
            }
          } else if (s.type === "label") {
            const lab = labels.find((l) => l.id === s.id);
            if (lab) pointIds.add(lab.pointId);
          } else if (s.type === "fill") {
            const f = fills.find((x) => x.id === s.id);
            if (f) {
              for (const pid of fillReferencedPointIds(f)) pointIds.add(pid);
            }
          }
        }
        if (pointIds.size) {
          const origins = {};
          for (const id of pointIds) {
            const p = pointById(id);
            if (p) origins[id] = { x: p.x, y: p.y };
          }
          drag = {
            kind: "multi",
            startWx: world.x,
            startWy: world.y,
            origins,
            moved: false,
          };
        } else if (hit.type === "label") {
          const lab = labels.find((l) => l.id === hit.id);
          drag = {
            kind: "label",
            id: hit.id,
            startWx: world.x,
            startWy: world.y,
            ox0: lab.ox,
            oy0: lab.oy,
            moved: false,
          };
        } else if (hit.type === "coordPlot") {
          const labHit =
            hit.label || hit.curveId
              ? nearestCoordCurveLabelHit(world.x, world.y)
              : nearestCoordCurveLabelHit(world.x, world.y);
          if (labHit && labHit.plotId === hit.id) {
            drag = {
              kind: "coordCurveLabel",
              plotId: labHit.plotId,
              curveId: labHit.curveId,
              startWx: world.x,
              startWy: world.y,
              moved: false,
            };
          } else {
            const plot = coordPlots.find((p) => p.id === hit.id);
            if (plot) {
              drag = {
                kind: "coordPlot",
                id: hit.id,
                startWx: world.x,
                startWy: world.y,
                ox0: plot.ox,
                oy0: plot.oy,
                moved: false,
              };
            } else drag = null;
          }
        } else {
          drag = null;
        }
      } else {
        if (!additive) setSelection([]);
        draft = {
          kind: "boxSelect",
          x0: world.x,
          y0: world.y,
          x1: world.x,
          y1: world.y,
          additive,
          pointerId: e.pointerId,
        };
        drag = null;
      }
      draw();
      return;
    }

    if (tool === "point") {
      const sn = snapWorld(world.x, world.y);
      if (sn) {
        setSelection([{ type: "point", id: sn.id }]);
      } else {
        const geom = snapToSegmentOrCircle(world.x, world.y);
        if (geom) {
          const endThresh = (SNAP_PX * 0.5) / view.scale;
          let p = null;
          if (geom.kind === "segment") {
            const endA = pointById(geom.aId);
            const endB = pointById(geom.bId);
            if (endA && dist(endA, geom) <= endThresh) p = endA;
            else if (endB && dist(endB, geom) <= endThresh) p = endB;
          } else if (geom.kind === "circle") {
            const thr = pointById(geom.throughId);
            const cen = pointById(geom.centerId);
            if (thr && dist(thr, geom) <= endThresh) p = thr;
            else if (cen && dist(cen, geom) <= endThresh) p = cen;
          }
          if (!p) p = findOrCreatePointAt(geom.x, geom.y);
          setSelection([{ type: "point", id: p.id }]);
        } else {
          const p = addPoint(world.x, world.y);
          setSelection([{ type: "point", id: p.id }]);
        }
      }
      hoverGeomSnap = null;
      draw();
      return;
    }

    if (tool === "rightAngle") {
      handleRightAngleClick(world);
      return;
    }

    if (tool === "angleArc") {
      handleAngleArcClick(world);
      return;
    }

    if (tool === "reflex") {
      handleReflexClick(world);
      return;
    }

    if (tool === "coord") {
      handleCoordClick(world);
      return;
    }

    if (tool === "midTick") {
      const seg = nearestSegmentHit(world.x, world.y);
      if (!seg) {
        statusHint.textContent = "請點選一條線段";
        return;
      }
      // Midpoint point + label only — no short tick stroke
      placeDivisionOnSegment(seg, 0.5, false, nextLetter);
      draw();
      return;
    }

    if (tool === "ratio") {
      const seg = nearestSegmentHit(world.x, world.y);
      if (!seg) {
        statusHint.textContent = "請點選一條線段";
        return;
      }
      pendingRatioSeg = seg.id;
      ratioInput.value = "1:1";
      ratioLabelInput.value = nextLetter;
      ratioDialog.showModal();
      ratioInput.select();
      return;
    }

    if (tool === "perpendicular") {
      const sn = snapWorld(world.x, world.y) || nearestPointHit(world.x, world.y);
      if (!sn) {
        statusHint.textContent = "請點選既有點後向下拖曳定長";
        return;
      }
      draft = {
        kind: "perpendicular",
        from: sn.id,
        cursor: { x: sn.x, y: sn.y },
        pointerId: e.pointerId,
        button: e.button,
      };
      statusHint.textContent = "向下拖曳設定垂線長度，放開完成";
      draw();
      return;
    }

    if (tool === "horizontal") {
      const sn = snapWorld(world.x, world.y) || nearestPointHit(world.x, world.y);
      if (!sn) {
        statusHint.textContent = "請點選既有點後左右拖曳定長";
        return;
      }
      draft = {
        kind: "horizontal",
        from: sn.id,
        cursor: { x: sn.x, y: sn.y },
        pointerId: e.pointerId,
        button: e.button,
      };
      statusHint.textContent = "左右拖曳設定水平線長度，放開完成";
      draw();
      return;
    }

    if (tool === "tangent") {
      e.preventDefault();
      let cir = null;
      let pid = null;
      let touch = null;
      const pHit = nearestPointHit(world.x, world.y);
      if (pHit) {
        const ons = circlesThroughPoint(pHit);
        if (ons.length) {
          cir = ons[0];
          pid = pHit.id;
          touch = { x: pHit.x, y: pHit.y };
        }
      }
      if (!cir) {
        cir = nearestCircleHit(world.x, world.y);
        if (!cir) {
          statusHint.textContent = t("tangent_need_circle");
          return;
        }
        touch = projectOntoCircle(cir, world.x, world.y);
        if (!touch) {
          statusHint.textContent = t("tangent_need_circle");
          return;
        }
        const near = nearestPointHit(touch.x, touch.y);
        if (near && pointLiesOnCircle(cir, near, HIT_POINT / view.scale)) {
          pid = near.id;
          touch = { x: near.x, y: near.y };
        }
      }
      draft = {
        kind: "tangent",
        circleId: cir.id,
        pointId: pid,
        touch,
        halfLen: 0,
        cursor: { x: touch.x, y: touch.y },
        pointerId: e.pointerId,
        button: e.button,
      };
      statusHint.textContent = t("hint_tangent");
      draw();
      return;
    }

    if (tool === "circlePart") {
      e.preventDefault();
      const picked = pickCircleTouch(world);
      if (!picked) {
        statusHint.textContent = t("circlePart_need_circle");
        return;
      }
      const { cir, pid, touch } = picked;
      const g = circleGeomBasic(cir);
      draft = {
        kind: "circlePart",
        mode: circlePartMode,
        circleId: cir.id,
        pointId: pid,
        touch,
        endTouch: { x: touch.x, y: touch.y },
        endPointId: pid,
        len: g ? g.r : 0,
        cursor: { x: touch.x, y: touch.y },
        pointerId: e.pointerId,
        button: e.button,
      };
      statusHint.textContent = t("hint_circlePart");
      draw();
      return;
    }

    if (tool === "shape") {
      e.preventDefault();
      const sn = snapWorld(world.x, world.y);
      const x0 = sn ? sn.x : applyGrid(world.x, world.y).x;
      const y0 = sn ? sn.y : applyGrid(world.x, world.y).y;
      draft = {
        kind: "shape",
        mode: shapeMode,
        x0,
        y0,
        x1: x0,
        y1: y0,
        pointerId: e.pointerId,
        button: e.button,
      };
      statusHint.textContent = t("hint_shape");
      draw();
      return;
    }

    if (tool === "circle") {
      const sn = snapWorld(world.x, world.y) || nearestPointHit(world.x, world.y);
      if (!draft || draft.kind !== "circle") {
        const pid = sn ? sn.id : addPoint(world.x, world.y).id;
        draft = { kind: "circle", centerId: pid, cursor: { x: world.x, y: world.y } };
        statusHint.textContent = "再點圓周上一點（半徑點）";
        draw();
        return;
      }
      const through = sn ? sn : addPoint(world.x, world.y);
      if (through.id === draft.centerId) return;
      pushHistory();
      circles.push({
        id: uid(),
        centerId: draft.centerId,
        throughId: through.id,
        style: "solid",
      });
      setSelection([{ type: "circle", id: circles[circles.length - 1].id }]);
      draft = null;
      updateStatus();
      draw();
      return;
    }

    if (tool === "intersect") {
      const seg = nearestSegmentHit(world.x, world.y);
      if (!seg) {
        statusHint.textContent = "請點選線段";
        return;
      }
      if (!draft || draft.kind !== "intersect") {
        draft = { kind: "intersect", seg1: seg.id };
        statusHint.textContent = "請再點第二條線段";
        draw();
        return;
      }
      if (seg.id === draft.seg1) return;
      const s1 = segmentById(draft.seg1);
      const s2 = seg;
      draft = null;
      if (!s1 || !s2) return;
      const a = pointById(s1.a), b = pointById(s1.b);
      const c = pointById(s2.a), d = pointById(s2.b);
      if (!a || !b || !c || !d) return;
      const hit = lineIntersection(a, b, c, d);
      if (!hit) {
        statusHint.textContent = "兩線平行，無交點";
        updateStatus();
        draw();
        return;
      }
      pushHistory();
      const pt = findOrCreatePointAt(hit.x, hit.y, true);
      history[histIndex] = snapshot();
      setSelection([{ type: "point", id: pt.id }]);
      openLabelPrompt(pt.id, nextLetter);
      updateStatus();
      draw();
      return;
    }

    if (tool === "length") {
      const seg = nearestSegmentHit(world.x, world.y);
      if (!seg) {
        statusHint.textContent = "請點選要標註長度的線段";
        return;
      }
      pendingLengthSeg = seg.id;
      if (lengthInput) lengthInput.value = "6";
      if (lengthDialog) {
        lengthDialog.showModal();
        if (lengthInput) lengthInput.select();
      }
      return;
    }

  }

  /**
   * Screen-vertical foot: lock x to origin, only allow downward (+y).
   * Snap only if an existing point lies nearly on that vertical (≤1.5px),
   * otherwise a side snap would create a non-vertical segment.
   */
  function perpFootFromCursor(from, world) {
    const y = Math.max(from.y, world.y);
    const colinearPx = 1.5 / view.scale;
    const alongThresh = SNAP_PX / view.scale;
    const sn = snapWorld(from.x, y, from.id);
    if (
      sn &&
      Math.abs(sn.x - from.x) <= colinearPx &&
      sn.y >= from.y + colinearPx &&
      Math.abs(sn.y - y) <= alongThresh
    ) {
      return { x: from.x, y: sn.y, snapId: sn.id };
    }
    return { x: from.x, y, snapId: null };
  }

  function horizEndFromCursor(from, world) {
    const x = world.x;
    const colinearPx = 1.5 / view.scale;
    const alongThresh = SNAP_PX / view.scale;
    const sn = snapWorld(x, from.y, from.id);
    if (
      sn &&
      Math.abs(sn.y - from.y) <= colinearPx &&
      Math.abs(sn.x - x) <= alongThresh
    ) {
      return { x: sn.x, y: from.y, snapId: sn.id };
    }
    return { x, y: from.y, snapId: null };
  }

  function finishHorizontal() {
    if (!draft || draft.kind !== "horizontal") return;
    const from = pointById(draft.from);
    const cursor = draft.cursor;
    draft = null;
    if (!from || !cursor) {
      updateStatus();
      draw();
      return;
    }
    const minLen = HORIZ_MIN_PX / view.scale;
    const end = horizEndFromCursor(from, cursor);
    if (Math.abs(end.x - from.x) < minLen) {
      statusHint.textContent = "拖曳太短，已取消";
      updateStatus();
      draw();
      return;
    }
    pushHistory();
    let endId = end.snapId;
    if (endId) {
      const existing = pointById(endId);
      if (!existing || Math.abs(existing.y - from.y) > 1.5 / view.scale) endId = null;
    }
    if (!endId) endId = addPoint(end.x, from.y, true).id;
    const seg = addSegment(from.id, endId, "solid", true);
    history[histIndex] = snapshot();
    setSelection(
      seg ? [{ type: "segment", id: seg.id }] : [{ type: "point", id: endId }]
    );
    updateStatus();
    draw();
  }

  function finishTangent() {
    if (!draft || draft.kind !== "tangent") return;
    const cir = circles.find((c) => c.id === draft.circleId);
    const touch = draft.touch ? { x: draft.touch.x, y: draft.touch.y } : null;
    const existingPid = draft.pointId || null;
    const halfLen = Math.abs(Number(draft.halfLen) || 0);
    const style = lineStyle || "solid";
    draft = null;
    if (!cir || !touch) {
      updateStatus();
      draw();
      return;
    }
    const minHalf = TANGENT_MIN_PX / view.scale / 2;
    if (halfLen < minHalf) {
      statusHint.textContent = t("tangent_too_short");
      updateStatus();
      draw();
      return;
    }
    const tan = tangentUnitAt(cir, touch);
    if (!tan) {
      statusHint.textContent = t("tangent_need_circle");
      updateStatus();
      draw();
      return;
    }
    pushHistory();
    let pid = existingPid;
    if (pid && !pointById(pid)) pid = null;
    if (!pid) {
      const eps = HIT_POINT / view.scale;
      const near = nearestPointHit(touch.x, touch.y);
      if (near && pointLiesOnCircle(cir, near, eps)) pid = near.id;
      else pid = addPoint(touch.x, touch.y, true, null, true).id;
    }
    const p = pointById(pid) || touch;
    const aId = addPoint(p.x - halfLen * tan.tx, p.y - halfLen * tan.ty, true, null, true).id;
    const bId = addPoint(p.x + halfLen * tan.tx, p.y + halfLen * tan.ty, true, null, true).id;
    const seg = addSegment(aId, bId, style, true);
    history[histIndex] = snapshot();
    setSelection(seg ? [{ type: "segment", id: seg.id }] : [{ type: "point", id: aId }]);
    updateStatus();
    draw();
  }

  function shapeCornersFromDrag(mode, x0, y0, x1, y1) {
    const minSize = 8 / view.scale;
    if (mode === "square") {
      const s = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      if (s < minSize) return null;
      const sx = x1 >= x0 ? 1 : -1;
      const sy = y1 >= y0 ? 1 : -1;
      const xA = x0;
      const yA = y0;
      const xB = x0 + sx * s;
      const yB = y0;
      const xC = x0 + sx * s;
      const yC = y0 + sy * s;
      const xD = x0;
      const yD = y0 + sy * s;
      return [
        { x: xA, y: yA },
        { x: xB, y: yB },
        { x: xC, y: yC },
        { x: xD, y: yD },
      ];
    }
    if (mode === "rect") {
      if (Math.abs(x1 - x0) < minSize || Math.abs(y1 - y0) < minSize) return null;
      return [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ];
    }
    if (mode === "equilateral") {
      const base = x1 - x0;
      if (Math.abs(base) < minSize) return null;
      const h = (Math.abs(base) * Math.sqrt(3)) / 2;
      const midX = (x0 + x1) / 2;
      const apexY = y1 >= y0 ? y0 + h : y0 - h;
      // Prefer drag direction: if y1 suggests upward, flip
      const preferUp = y1 < y0;
      const ay = preferUp ? y0 - h : y0 + (y1 >= y0 ? h : -h);
      void apexY;
      return [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: midX, y: preferUp ? y0 - h : y0 + h },
      ];
    }
    // iso: base from (x0,y0)-(x1,y0), height from y0 to y1
    if (Math.abs(x1 - x0) < minSize || Math.abs(y1 - y0) < minSize) return null;
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: (x0 + x1) / 2, y: y1 },
    ];
  }

  function finishShape() {
    if (!draft || draft.kind !== "shape") return;
    const mode = draft.mode || shapeMode;
    const x0 = draft.x0;
    const y0 = draft.y0;
    const x1 = draft.x1;
    const y1 = draft.y1;
    const style = lineStyle || "solid";
    draft = null;
    const corners = shapeCornersFromDrag(mode, x0, y0, x1, y1);
    if (!corners) {
      statusHint.textContent = t("shape_too_small");
      updateStatus();
      draw();
      return;
    }
    pushHistory();
    const ids = corners.map((p) => addPoint(p.x, p.y, true, null, true).id);
    const newSegs = [];
    for (let i = 0; i < ids.length; i++) {
      const a = ids[i];
      const b = ids[(i + 1) % ids.length];
      const seg = addSegment(a, b, style, true);
      if (seg) newSegs.push({ type: "segment", id: seg.id });
    }
    history[histIndex] = snapshot();
    setSelection(newSegs.length ? newSegs : ids.map((id) => ({ type: "point", id })));
    updateStatus();
    draw();
  }

  function pickCircleTouch(world) {
    let cir = null;
    let pid = null;
    let touch = null;
    const pHit = nearestPointHit(world.x, world.y);
    if (pHit) {
      const ons = circlesThroughPoint(pHit);
      if (ons.length) {
        cir = ons[0];
        pid = pHit.id;
        touch = { x: pHit.x, y: pHit.y };
      }
    }
    if (!cir) {
      cir = nearestCircleHit(world.x, world.y);
      if (!cir) return null;
      touch = projectOntoCircle(cir, world.x, world.y);
      if (!touch) return null;
      const near = nearestPointHit(touch.x, touch.y);
      if (near && pointLiesOnCircle(cir, near, HIT_POINT / view.scale)) {
        pid = near.id;
        touch = { x: near.x, y: near.y };
      }
    }
    return { cir, pid, touch };
  }

  function finishCirclePart() {
    if (!draft || draft.kind !== "circlePart") return;
    const mode = draft.mode || circlePartMode;
    const cir = circles.find((c) => c.id === draft.circleId);
    const style = lineStyle || "solid";
    const g = circleGeomBasic(cir);
    const startTouch = draft.touch ? { x: draft.touch.x, y: draft.touch.y } : null;
    const startPid = draft.pointId || null;
    const endTouch = draft.endTouch ? { x: draft.endTouch.x, y: draft.endTouch.y } : null;
    const endPid = draft.endPointId || null;
    draft = null;
    if (!cir || !g || !startTouch) {
      updateStatus();
      draw();
      return;
    }
    const minLen = TANGENT_MIN_PX / view.scale;
    if (mode === "chord") {
      if (!endTouch || dist(startTouch, endTouch) < minLen) {
        statusHint.textContent = t("circlePart_too_short");
        updateStatus();
        draw();
        return;
      }
      pushHistory();
      let aId = startPid;
      let bId = endPid;
      if (!aId || !pointById(aId)) {
        aId = addPoint(startTouch.x, startTouch.y, true, null, true).id;
      }
      if (!bId || !pointById(bId)) {
        bId = addPoint(endTouch.x, endTouch.y, true, null, true).id;
      }
      const seg = addSegment(aId, bId, style, true);
      history[histIndex] = snapshot();
      setSelection(seg ? [{ type: "segment", id: seg.id }] : [{ type: "point", id: aId }]);
      updateStatus();
      draw();
      return;
    }
    if (mode === "diameter") {
      const dx = endTouch ? endTouch.x - g.c.x : startTouch.x - g.c.x;
      const dy = endTouch ? endTouch.y - g.c.y : startTouch.y - g.c.y;
      const L = Math.hypot(dx, dy) || 1;
      if (L < minLen / 4) {
        statusHint.textContent = t("circlePart_too_short");
        updateStatus();
        draw();
        return;
      }
      const ux = dx / L;
      const uy = dy / L;
      const a = { x: g.c.x - g.r * ux, y: g.c.y - g.r * uy };
      const b = { x: g.c.x + g.r * ux, y: g.c.y + g.r * uy };
      pushHistory();
      const aId = addPoint(a.x, a.y, true, null, true).id;
      const bId = addPoint(b.x, b.y, true, null, true).id;
      const seg = addSegment(aId, bId, style, true);
      history[histIndex] = snapshot();
      setSelection(seg ? [{ type: "segment", id: seg.id }] : [{ type: "point", id: aId }]);
      updateStatus();
      draw();
      return;
    }
    // radius: center → rim point along drag direction
    let rim = endTouch || startTouch;
    if (endTouch) {
      const dx = endTouch.x - g.c.x;
      const dy = endTouch.y - g.c.y;
      const L = Math.hypot(dx, dy) || 1;
      const useR = Math.min(g.r, Math.max(minLen, L));
      rim = { x: g.c.x + (dx / L) * useR, y: g.c.y + (dy / L) * useR };
    } else {
      rim = projectOntoCircle(cir, startTouch.x, startTouch.y) || startTouch;
    }
    if (dist(g.c, rim) < minLen) {
      statusHint.textContent = t("circlePart_too_short");
      updateStatus();
      draw();
      return;
    }
    pushHistory();
    let cId = cir.centerId;
    if (!pointById(cId)) cId = addPoint(g.c.x, g.c.y, true, null, true).id;
    let rId = endPid || startPid;
    const existing = rId ? pointById(rId) : null;
    if (!existing || dist(existing, rim) > HIT_POINT / view.scale) {
      rId = addPoint(rim.x, rim.y, true, null, true).id;
    }
    const seg = addSegment(cId, rId, style, true);
    history[histIndex] = snapshot();
    setSelection(seg ? [{ type: "segment", id: seg.id }] : [{ type: "point", id: rId }]);
    updateStatus();
    draw();
  }

  /** Collect movable point centers from current selection for align/distribute. */
  function alignablePointEntries() {
    const map = new Map();
    function addPid(id) {
      const p = pointById(id);
      if (p && !map.has(id)) map.set(id, p);
    }
    for (const s of selection) {
      if (s.type === "point") addPid(s.id);
      else if (s.type === "segment") {
        const seg = segmentById(s.id);
        if (seg) {
          addPid(seg.a);
          addPid(seg.b);
        }
      } else if (s.type === "circle") {
        const cir = circles.find((c) => c.id === s.id);
        if (cir) {
          addPid(cir.centerId);
          addPid(cir.throughId);
        }
      } else if (s.type === "ellipse") {
        const el = ellipses.find((c) => c.id === s.id);
        if (el) {
          addPid(el.centerId);
          addPid(el.rxId);
          addPid(el.ryId);
        }
      } else if (s.type === "sector") {
        const sec = sectors.find((c) => c.id === s.id);
        if (sec) {
          addPid(sec.centerId);
          addPid(sec.startId);
          addPid(sec.endId);
        }
      } else if (s.type === "fill") {
        const f = fills.find((x) => x.id === s.id);
        if (f) for (const pid of fillReferencedPointIds(f)) addPid(pid);
      } else if (s.type === "label") {
        const lab = labels.find((l) => l.id === s.id);
        if (lab) addPid(lab.pointId);
      }
    }
    return [...map.values()];
  }

  function selectedSegmentsForAlign() {
    const segs = [];
    for (const s of selection) {
      if (s.type === "segment") {
        const seg = segmentById(s.id);
        if (seg) segs.push(seg);
      }
    }
    return segs;
  }

  function runAlignAction(action) {
    if (action === "equalLen") {
      const segs = selectedSegmentsForAlign();
      if (segs.length < 2) {
        statusHint.textContent = t("tip_align_equalLen");
        return;
      }
      pushHistory();
      const lens = segs.map((seg) => {
        const a = pointById(seg.a);
        const b = pointById(seg.b);
        return a && b ? dist(a, b) : 0;
      });
      const target = lens.reduce((s, v) => s + v, 0) / lens.length;
      for (const seg of segs) {
        const a = pointById(seg.a);
        const b = pointById(seg.b);
        if (!a || !b) continue;
        const cur = dist(a, b);
        if (cur < 1e-9) continue;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const ux = (b.x - a.x) / cur;
        const uy = (b.y - a.y) / cur;
        const half = target / 2;
        a.x = mx - ux * half;
        a.y = my - uy * half;
        b.x = mx + ux * half;
        b.y = my + uy * half;
      }
      draw();
      return;
    }
    const pts = alignablePointEntries();
    if (pts.length < 2) return;
    if ((action === "distH" || action === "distV") && pts.length < 3) {
      statusHint.textContent =
        action === "distH" ? t("tip_align_distH") : t("tip_align_distV");
      return;
    }
    pushHistory();
    if (action === "left") {
      const x = Math.min(...pts.map((p) => p.x));
      for (const p of pts) p.x = x;
    } else if (action === "right") {
      const x = Math.max(...pts.map((p) => p.x));
      for (const p of pts) p.x = x;
    } else if (action === "center") {
      const x = (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2;
      for (const p of pts) p.x = x;
    } else if (action === "top") {
      const y = Math.min(...pts.map((p) => p.y));
      for (const p of pts) p.y = y;
    } else if (action === "bottom") {
      const y = Math.max(...pts.map((p) => p.y));
      for (const p of pts) p.y = y;
    } else if (action === "middle") {
      const y = (Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2;
      for (const p of pts) p.y = y;
    } else if (action === "distH" || action === "distV") {
      const sorted = [...pts].sort((a, b) =>
        action === "distH" ? a.x - b.x || a.y - b.y : a.y - b.y || a.x - b.x
      );
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      for (let i = 1; i < sorted.length - 1; i++) {
        const tt = i / (sorted.length - 1);
        if (action === "distH") sorted[i].x = first.x + (last.x - first.x) * tt;
        else sorted[i].y = first.y + (last.y - first.y) * tt;
      }
    }
    draw();
  }

  function finishPerpendicular() {
    if (!draft || draft.kind !== "perpendicular") return;
    const from = pointById(draft.from);
    const cursor = draft.cursor;
    draft = null;
    if (!from || !cursor) {
      updateStatus();
      draw();
      return;
    }
    const minLen = PERP_MIN_PX / view.scale;
    const len = cursor.y - from.y;
    if (len < minLen) {
      statusHint.textContent = "拖曳太短，已取消";
      updateStatus();
      draw();
      return;
    }
    const foot = perpFootFromCursor(from, cursor);
    if (foot.y - from.y < minLen) {
      statusHint.textContent = "拖曳太短，已取消";
      updateStatus();
      draw();
      return;
    }
    pushHistory();
    let footId = foot.snapId;
    if (footId) {
      const existing = pointById(footId);
      // Keep geometry vertical: only reuse point if it already sits on the drop line
      if (!existing || Math.abs(existing.x - from.x) > 1.5 / view.scale) {
        footId = null;
      }
    }
    if (!footId) {
      footId = addPoint(from.x, foot.y, true).id;
    }
    const seg = addSegment(from.id, footId, "dotted", true);
    history[histIndex] = snapshot();
    setSelection(
      seg ? [{ type: "segment", id: seg.id }] : [{ type: "point", id: footId }]
    );
    updateStatus();
    draw();
  }

  function finishBoxSelect() {
    if (!draft || draft.kind !== "boxSelect") return;
    const x0 = Math.min(draft.x0, draft.x1);
    const x1 = Math.max(draft.x0, draft.x1);
    const y0 = Math.min(draft.y0, draft.y1);
    const y1 = Math.max(draft.y0, draft.y1);
    const additive = draft.additive;
    draft = null;
    const hits = [];
    for (const p of points) {
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) {
        hits.push({ type: "point", id: p.id });
      }
    }
    for (const seg of segments) {
      const a = pointById(seg.a);
      const b = pointById(seg.b);
      if (!a || !b) continue;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (mx >= x0 && mx <= x1 && my >= y0 && my <= y1) {
        hits.push({ type: "segment", id: seg.id });
      }
    }
    for (const cir of circles) {
      const c = pointById(cir.centerId);
      if (c && c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1) {
        hits.push({ type: "circle", id: cir.id });
      }
    }
    for (const el of ellipses) {
      const c = pointById(el.centerId);
      if (c && c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1) {
        hits.push({ type: "ellipse", id: el.id });
      }
    }
    for (const sec of sectors) {
      const c = pointById(sec.centerId);
      if (c && c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1) {
        hits.push({ type: "sector", id: sec.id });
      }
    }
    for (const f of fills) {
      const pts = fillWorldPoints(f);
      if (!pts) continue;
      let sx = 0, sy = 0;
      for (const p of pts) { sx += p.x; sy += p.y; }
      const mx = sx / pts.length, my = sy / pts.length;
      if (mx >= x0 && mx <= x1 && my >= y0 && my <= y1) {
        hits.push({ type: "fill", id: f.id });
      }
    }
    if (additive) {
      const map = new Map(selection.map((s) => [s.type + ":" + s.id, s]));
      for (const h of hits) map.set(h.type + ":" + h.id, h);
      setSelection([...map.values()]);
    } else {
      setSelection(hits);
    }
    updateStatus();
    draw();
  }

  function onPointerMove(e) {
    const pos = canvasPos(e);
    const world = screenToWorld(pos.x, pos.y);

    if (panning && panLast) {
      view.x += pos.x - panLast.x;
      view.y += pos.y - panLast.y;
      panLast = pos;
      draw();
      return;
    }

    updateHoverSnap(world.x, world.y);

    if (drag && drag.kind === "multi") {
      if (!drag.moved) {
        pushHistory();
        drag.moved = true;
      }
      let dx = world.x - drag.startWx;
      let dy = world.y - drag.startWy;
      if (gridSnap) {
        dx = Math.round(dx / GRID_SIZE) * GRID_SIZE;
        dy = Math.round(dy / GRID_SIZE) * GRID_SIZE;
      }
      const ids = Object.keys(drag.origins);
      for (const id of ids) {
        const p = pointById(id);
        const o = drag.origins[id];
        if (p && o) {
          p.x = o.x + dx;
          p.y = o.y + dy;
        }
      }
      // Alignment guides from primary selected point
      const primaryId =
        (selected && selected.type === "point" && selected.id) ||
        ids[0];
      const primary = pointById(primaryId);
      if (primary) {
        const snapped = updateAlignGuidesForPoint(primary.x, primary.y, new Set(ids));
        const adx = snapped.x - primary.x;
        const ady = snapped.y - primary.y;
        if (adx || ady) {
          for (const id of ids) {
            const p = pointById(id);
            if (p) {
              p.x += adx;
              p.y += ady;
            }
          }
        }
      }
      draw();
      return;
    }

    if (drag && drag.kind === "label") {
      if (!drag.moved) {
        pushHistory();
        drag.moved = true;
      }
      const lab = labels.find((l) => l.id === drag.id);
      if (lab) {
        lab.ox = drag.ox0 + (world.x - drag.startWx);
        lab.oy = drag.oy0 + (world.y - drag.startWy);
      }
      draw();
      return;
    }

    if (drag && drag.kind === "coordResize") {
      if (!drag.moved) {
        pushHistory();
        drag.moved = true;
      }
      const plot = coordPlots.find((p) => p.id === drag.plotId);
      if (plot) applyCoordResizeFromPointer(plot, drag, world.x, world.y);
      canvas.style.cursor = "nwse-resize";
      draw();
      return;
    }

    if (drag && drag.kind === "coordPlot") {
      if (!drag.moved) {
        pushHistory();
        drag.moved = true;
      }
      const plot = coordPlots.find((p) => p.id === drag.id);
      if (plot) {
        let dx = world.x - drag.startWx;
        let dy = world.y - drag.startWy;
        if (gridSnap) {
          dx = Math.round(dx / GRID_SIZE) * GRID_SIZE;
          dy = Math.round(dy / GRID_SIZE) * GRID_SIZE;
        }
        plot.ox = drag.ox0 + dx;
        plot.oy = drag.oy0 + dy;
      }
      draw();
      return;
    }

    if (drag && drag.kind === "coordCurveLabel") {
      if (!drag.moved) {
        pushHistory();
        drag.moved = true;
      }
      const plot = coordPlots.find((p) => p.id === drag.plotId);
      if (plot) {
        ensureCoordPlot(plot);
        const curve = (plot.curves || []).find((c) => c.id === drag.curveId);
        if (curve) assignCoordCurveLabelFromWorld(plot, curve, world.x, world.y);
      }
      canvas.style.cursor = "move";
      draw();
      return;
    }

    if (draft && draft.kind === "boxSelect") {
      draft.x1 = world.x;
      draft.y1 = world.y;
      draw();
      return;
    }

    if (draft && draft.kind === "perpendicular" && draft.from) {
      const from = pointById(draft.from);
      if (from) {
        const foot = perpFootFromCursor(from, world);
        draft.cursor = { x: foot.x, y: foot.y };
      }
      draw();
      return;
    }

    if (draft && draft.kind === "horizontal" && draft.from) {
      const from = pointById(draft.from);
      if (from) {
        const end = horizEndFromCursor(from, world);
        draft.cursor = { x: end.x, y: end.y };
      }
      draw();
      return;
    }

    if (draft && draft.kind === "tangent" && draft.touch) {
      const p = draft.pointId ? pointById(draft.pointId) : draft.touch;
      const cir = circles.find((c) => c.id === draft.circleId);
      const tan = p && cir ? tangentUnitAt(cir, p) : null;
      if (p && tan) {
        const vx = world.x - p.x;
        const vy = world.y - p.y;
        const half = vx * tan.tx + vy * tan.ty;
        draft.halfLen = half;
        draft.cursor = { x: p.x + half * tan.tx, y: p.y + half * tan.ty };
      }
      draw();
      return;
    }

    if (draft && draft.kind === "circlePart" && draft.touch) {
      const cir = circles.find((c) => c.id === draft.circleId);
      const g = circleGeomBasic(cir);
      const mode = draft.mode || circlePartMode;
      if (mode === "chord" && cir) {
        const touch = projectOntoCircle(cir, world.x, world.y);
        if (touch) {
          draft.endTouch = touch;
          const near = nearestPointHit(touch.x, touch.y);
          if (near && pointLiesOnCircle(cir, near, HIT_POINT / view.scale)) {
            draft.endPointId = near.id;
            draft.endTouch = { x: near.x, y: near.y };
          } else draft.endPointId = null;
          draft.cursor = { x: draft.endTouch.x, y: draft.endTouch.y };
        }
      } else if (mode === "diameter" && g) {
        const dx = world.x - g.c.x;
        const dy = world.y - g.c.y;
        const L = Math.hypot(dx, dy) || 1;
        draft.endTouch = { x: g.c.x + (dx / L) * g.r, y: g.c.y + (dy / L) * g.r };
        draft.cursor = { ...draft.endTouch };
        draft.len = g.r * 2;
      } else if (mode === "radius" && g) {
        const dx = world.x - g.c.x;
        const dy = world.y - g.c.y;
        const L = Math.hypot(dx, dy) || 1;
        const useR = Math.min(g.r, L);
        draft.endTouch = { x: g.c.x + (dx / L) * useR, y: g.c.y + (dy / L) * useR };
        draft.len = useR;
        draft.cursor = { ...draft.endTouch };
        const near = nearestPointHit(draft.endTouch.x, draft.endTouch.y);
        if (near && pointLiesOnCircle(cir, near, HIT_POINT / view.scale)) {
          draft.endPointId = near.id;
        } else draft.endPointId = null;
      }
      draw();
      return;
    }

    if (draft && draft.kind === "shape") {
      const sn = snapWorld(world.x, world.y);
      const cur = sn ? { x: sn.x, y: sn.y } : applyGrid(world.x, world.y);
      draft.x1 = cur.x;
      draft.y1 = cur.y;
      draw();
      return;
    }

    if (draft && draft.kind === "exportCrop") {
      draft.x1 = world.x;
      draft.y1 = world.y;
      draw();
      return;
    }

    if (draft && draft.kind === "ellipse" && draft.centerId) {
      const c = pointById(draft.centerId);
      if (c) {
        const sn = snapWorld(world.x, world.y);
        if (!draft.rxId) {
          const x = sn ? sn.x : applyGrid(world.x, c.y).x;
          draft.cursor = { x, y: c.y };
        } else {
          const y = sn ? sn.y : applyGrid(c.x, world.y).y;
          draft.cursor = { x: c.x, y };
        }
      }
      draw();
      return;
    }

    if (draft && draft.kind === "sector" && draft.centerId) {
      const sn = snapWorld(world.x, world.y);
      draft.cursor = sn ? { x: sn.x, y: sn.y } : applyGrid(world.x, world.y);
      draw();
      return;
    }

    if (draft && draft.kind === "fill") {
      const sn = snapWorld(world.x, world.y) || nearestPointHit(world.x, world.y);
      draft.cursor = sn ? { x: sn.x, y: sn.y } : { x: world.x, y: world.y };
      draw();
      return;
    }

    if (
      draft &&
      (draft.kind === "line" ||
        draft.kind === "rightAngle" ||
        draft.kind === "angleArc" ||
        draft.kind === "reflex" ||
        draft.kind === "circle")
    ) {
      const sn =
        (draft.kind === "rightAngle" || draft.kind === "angleArc" || draft.kind === "reflex") && draft.vertex
          ? snapRightArm(world.x, world.y, draft.vertex, draft.arm1)
          : snapWorld(world.x, world.y);
      let cur = sn ? { x: sn.x, y: sn.y } : applyGrid(world.x, world.y);
      if (draft.kind === "line" && draft.from) {
        const from = pointById(draft.from);
        const snapped = updateAlignGuidesForPoint(cur.x, cur.y, from ? new Set([from.id]) : new Set());
        cur = { x: snapped.x, y: snapped.y };
        if (from) maybeEqualLengthGuide(from, cur);
      } else {
        clearAlignGuides();
      }
      draft.cursor = cur;
      draw();
      return;
    }

    if (!drag) {
      clearAlignGuides();
      if (tool === "select") {
        const lh = nearestCoordCurveLabelHit(world.x, world.y);
        const rh = !lh ? nearestCoordResizeHandle(world.x, world.y) : null;
        canvas.style.cursor = lh ? "move" : rh ? "nwse-resize" : "";
      } else {
        canvas.style.cursor = "";
      }
    }
    draw();
  }

  function onPointerUp(e) {
    if (
      drag &&
      (drag.kind === "coordResize" ||
        drag.kind === "coordPlot" ||
        drag.kind === "coordCurveLabel")
    ) {
      canvas.style.cursor = "";
    }
    if (panning) {
      panning = false;
      panLast = null;
      canvas.classList.remove("active");
      if (!spaceDown && tool !== "hand") {
        canvas.classList.remove("panning", "space-pan");
      } else {
        canvas.classList.remove("panning");
        if (tool === "hand" || spaceDown) canvas.classList.add("space-pan");
      }
    }
    if (draft && draft.kind === "perpendicular") {
      if (e) {
        if (draft.pointerId != null && e.pointerId !== draft.pointerId) return;
        if (draft.button != null && e.button !== draft.button) return;
      }
      finishPerpendicular();
      return;
    }
    if (draft && draft.kind === "horizontal") {
      if (e) {
        if (draft.pointerId != null && e.pointerId !== draft.pointerId) return;
        if (draft.button != null && e.button !== draft.button) return;
      }
      finishHorizontal();
      return;
    }
    if (draft && draft.kind === "tangent") {
      if (e) {
        if (draft.pointerId != null && e.pointerId !== draft.pointerId) return;
        if (draft.button != null && e.button !== draft.button) return;
      }
      finishTangent();
      return;
    }
    if (draft && draft.kind === "circlePart") {
      if (e) {
        if (draft.pointerId != null && e.pointerId !== draft.pointerId) return;
        if (draft.button != null && e.button !== draft.button) return;
      }
      finishCirclePart();
      return;
    }
    if (draft && draft.kind === "shape") {
      if (e) {
        if (draft.pointerId != null && e.pointerId !== draft.pointerId) return;
        if (draft.button != null && e.button !== draft.button) return;
      }
      finishShape();
      return;
    }
    if (draft && draft.kind === "boxSelect") {
      finishBoxSelect();
      return;
    }
    if (draft && draft.kind === "exportCrop") {
      finishExportCrop();
      return;
    }
    if (drag && drag.moved) history[histIndex] = snapshot();
    drag = null;
    clearAlignGuides();
    draw();
  }

  function finishExportCrop() {
    if (!draft || draft.kind !== "exportCrop") return;
    const minX = Math.min(draft.x0, draft.x1);
    const maxX = Math.max(draft.x0, draft.x1);
    const minY = Math.min(draft.y0, draft.y1);
    const maxY = Math.max(draft.y0, draft.y1);
    draft = null;
    if (maxX - minX < 8 / view.scale || maxY - minY < 8 / view.scale) {
      statusHint.textContent = "框選太小，已取消";
      updateStatus();
      draw();
      return;
    }
    exportCrop = { minX, minY, maxX, maxY };
    syncExportCropUI();
    setTool("select");
    statusHint.textContent = "已設定匯出裁切範圍";
    openExportPreview();
    draw();
  }

  function onWheel(e) {
    e.preventDefault();
    const pos = canvasPos(e);
    const before = screenToWorld(pos.x, pos.y);
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    view.scale = Math.min(8, Math.max(0.15, view.scale * factor));
    view.x = pos.x - before.x * view.scale;
    view.y = pos.y - before.y * view.scale;
    draw();
  }

  // ——— Export ———
  function expandBounds(b, x, y) {
    b.minX = Math.min(b.minX, x);
    b.minY = Math.min(b.minY, y);
    b.maxX = Math.max(b.maxX, x);
    b.maxY = Math.max(b.maxY, y);
  }

  /**
   * World AABB for export/preview. Must include circle/ellipse extents —
   * not only control points — or a circle OA with A above O clips to a
   * tall thin strip and looks like a broken arc with O on the edge.
   */
  function boundsWorld() {
    const empty =
      !points.length &&
      !circles.length &&
      !ellipses.length &&
      !sectors.length &&
      !fills.length &&
      !segments.length &&
      !coordPlots.length;
    if (empty) return { minX: -100, minY: -100, maxX: 100, maxY: 100 };
    const b = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    };
    for (const p of points) expandBounds(b, p.x, p.y);
    for (const lab of labels) {
      const p = pointById(lab.pointId);
      if (!p) continue;
      expandBounds(b, p.x + lab.ox - 8, p.y + lab.oy - 8);
      expandBounds(b, p.x + lab.ox + 8, p.y + lab.oy + 8);
    }
    for (const cir of circles) {
      const c = pointById(cir.centerId);
      const thr = pointById(cir.throughId);
      if (!c || !thr) continue;
      const r = dist(c, thr);
      if (r < 1e-9) continue;
      expandBounds(b, c.x - r, c.y - r);
      expandBounds(b, c.x + r, c.y + r);
    }
    for (const el of ellipses) {
      const dims = ellipseDims(el);
      if (!dims) continue;
      const { c, rx, ry } = dims;
      expandBounds(b, c.x - rx, c.y - ry);
      expandBounds(b, c.x + rx, c.y + ry);
    }
    for (const sec of sectors) {
      const g = sectorGeom(sec);
      if (!g) continue;
      // Conservative AABB of the circle (covers any minor arc/sector)
      expandBounds(b, g.c.x - g.r, g.c.y - g.r);
      expandBounds(b, g.c.x + g.r, g.c.y + g.r);
    }
    for (const f of fills) {
      const pts = fillWorldPoints(f);
      if (!pts) continue;
      for (const p of pts) expandBounds(b, p.x, p.y);
    }
    for (const cp of coordPlots) {
      const bb = coordPlotBounds(cp);
      expandBounds(b, bb.minX, bb.minY);
      expandBounds(b, bb.maxX, bb.maxY);
    }
    if (!Number.isFinite(b.minX)) {
      return { minX: -100, minY: -100, maxX: 100, maxY: 100 };
    }
    return b;
  }

  /** Shared export metrics so preview / PNG / SVG use identical crop + padding. */
  function exportLayout(scale) {
    if (scale == null) scale = 2;
    const b = exportBounds();
    // Pad is in *output pixels* (same for cropped and auto bounds).
    const pad = exportCrop ? 12 : EXPORT_PAD;
    const w = Math.max(40, (b.maxX - b.minX) * scale + pad * 2);
    const h = Math.max(40, (b.maxY - b.minY) * scale + pad * 2);
    const toS = (wx, wy) => ({
      x: (wx - b.minX) * scale + pad,
      y: (wy - b.minY) * scale + pad,
    });
    return { b, pad, scale, w, h, toS };
  }

  let lastPreviewPngBlob = null;

  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("PNG blob failed"));
      }, "image/png");
    });
  }

  /** Chromium File System Access API; fallback to download (+ optional filename prompt). */
  async function saveBlobAs(blob, suggestedName, mime, extList) {
    if (typeof window.showSaveFilePicker === "function") {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: suggestedName.endsWith(".svg") ? "SVG" : "PNG",
              accept: { [mime]: extList },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        statusHint.textContent = "已儲存：" + (handle.name || suggestedName);
        return true;
      } catch (err) {
        if (err && (err.name === "AbortError" || err.name === "Abort")) return false;
        // Fall through on unsupported / permission errors (e.g. file://).
      }
    }
    let name = suggestedName;
    try {
      const typed = window.prompt("儲存檔名（瀏覽器可能只下載到預設資料夾）", suggestedName);
      if (typed == null) return false;
      name = String(typed).trim() || suggestedName;
    } catch (_) {
      /* prompt blocked */
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    statusHint.textContent =
      "已觸發下載：" + name + "（Chrome／Edge 可選資料夾；此環境改用下載）";
    return true;
  }

  function buildExportCanvas(scale) {
    if (scale == null) scale = 2;
    const { w, h, toS, scale: sc } = exportLayout(scale);
    scale = sc;
    const off = document.createElement("canvas");
    off.width = Math.ceil(w);
    off.height = Math.ceil(h);
    const c = off.getContext("2d");
    const prevDark = darkCanvas;
    darkCanvas = false; // export always light paper / black ink
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, off.width, off.height);

    for (const f of fills) {
      if (!buildFillPath(c, f, toS)) continue;
      c.fillStyle = hexToRgba(f.color, f.opacity);
      c.fill();
    }

    for (const seg of segments) {
      const a = pointById(seg.a);
      const bp = pointById(seg.b);
      if (!a || !bp) continue;
      const sa = toS(a.x, a.y);
      const sb = toS(bp.x, bp.y);
      c.beginPath();
      c.moveTo(sa.x, sa.y);
      c.lineTo(sb.x, sb.y);
      c.strokeStyle = "#111";
      c.lineWidth = (seg.style === "solid" ? LINE_WIDTH : LINE_WIDTH * 0.92) * scale * 0.75;
      c.lineCap = seg.style === "solid" || !seg.style ? "round" : "butt";
      const dash = STYLE_DASH[seg.style] || [];
      c.setLineDash(dash.map((d) => d * scale * 0.75));
      c.stroke();
      c.setLineDash([]);
    }

    if (layers.helpersShow) {
      for (const mt of midTicks) {
        const seg = segmentById(mt.segmentId);
        if (!seg) continue;
        const a = pointById(seg.a);
        const bp = pointById(seg.b);
        if (!a || !bp) continue;
        let mx, my;
        if (mt.pointId && pointById(mt.pointId)) {
          mx = pointById(mt.pointId).x;
          my = pointById(mt.pointId).y;
        } else {
          mx = (a.x + bp.x) / 2;
          my = (a.y + bp.y) / 2;
        }
        const sa = toS(a.x, a.y);
        const sb = toS(bp.x, bp.y);
        const sm = toS(mx, my);
        let dx = sb.x - sa.x,
          dy = sb.y - sa.y;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        const nx = -dy,
          ny = dx;
        const t = MID_TICK * scale * 0.75;
        c.beginPath();
        c.moveTo(sm.x - nx * t, sm.y - ny * t);
        c.lineTo(sm.x + nx * t, sm.y + ny * t);
        c.strokeStyle = "#111";
        c.lineWidth = LINE_WIDTH * scale * 0.75;
        c.stroke();
      }

      {
        const unit = scale * 0.75;
        const markLw = LINE_WIDTH * 1.55 * unit;
        for (const pm of parallelMarks) {
          const seg = segmentById(pm.segmentId);
          if (!seg) continue;
          const basis = segmentDrawBasis(
            seg,
            markTAlong("parallel", pm.segmentId, pm.group),
            toS
          );
          if (!basis) continue;
          const chevrons = parallelMarkDrawChevrons(
            basis,
            pm.group,
            pm.side === -1 ? -1 : 1,
            11 * unit,
            9 * unit
          );
          c.strokeStyle = "#111";
          c.lineWidth = markLw;
          c.lineCap = "round";
          c.lineJoin = "round";
          for (const pts of chevrons) {
            c.beginPath();
            c.moveTo(pts[0].x, pts[0].y);
            c.lineTo(pts[1].x, pts[1].y);
            c.lineTo(pts[2].x, pts[2].y);
            c.stroke();
          }
        }
        for (const em of equalMarks) {
          const seg = segmentById(em.segmentId);
          if (!seg) continue;
          const basis = segmentDrawBasis(
            seg,
            markTAlong("equal", em.segmentId, em.group),
            toS
          );
          if (!basis) continue;
          const strokes = equalMarkDrawStrokes(
            basis,
            em.group,
            em.side === -1 ? -1 : 1,
            MID_TICK * 2.35 * unit,
            7 * unit
          );
          c.strokeStyle = "#111";
          c.lineWidth = markLw;
          c.lineCap = "round";
          for (const s of strokes) {
            c.beginPath();
            c.moveTo(s.x1, s.y1);
            c.lineTo(s.x2, s.y2);
            c.stroke();
          }
        }
      }

      for (const ra of rightAngles) {
        const v = pointById(ra.vertex);
        const a1 = pointById(ra.arm1);
        const a2 = pointById(ra.arm2);
        if (!v || !a1 || !a2) continue;
        const sv = toS(v.x, v.y);
        const s1 = toS(a1.x, a1.y);
        const s2 = toS(a2.x, a2.y);
        let ux = s1.x - sv.x,
          uy = s1.y - sv.y;
        let vx = s2.x - sv.x,
          vy = s2.y - sv.y;
        const lu = Math.hypot(ux, uy) || 1;
        const lv = Math.hypot(vx, vy) || 1;
        ux /= lu;
        uy /= lu;
        vx /= lv;
        vy /= lv;
        const size = (ra.size || DEFAULT_RA_SIZE) * scale * 0.75;
        c.beginPath();
        c.moveTo(sv.x + ux * size, sv.y + uy * size);
        c.lineTo(sv.x + ux * size + vx * size, sv.y + uy * size + vy * size);
        c.lineTo(sv.x + vx * size, sv.y + vy * size);
        c.strokeStyle = "#111";
        c.lineWidth = LINE_WIDTH * scale * 0.7;
        c.stroke();
      }

      for (const arc of angleArcs) {
        const v = pointById(arc.vertex);
        const a1 = pointById(arc.arm1);
        const a2 = pointById(arc.arm2);
        if (!v || !a1 || !a2) continue;
        const sv = toS(v.x, v.y);
        const s1 = toS(a1.x, a1.y);
        const s2 = toS(a2.x, a2.y);
        const ang1 = Math.atan2(s1.y - sv.y, s1.x - sv.x);
        const ang2 = Math.atan2(s2.y - sv.y, s2.x - sv.x);
        const delta = angleSweepDelta(ang1, ang2, !!arc.reflex);
        const baseR = (arc.size || DEFAULT_RA_SIZE) * ANGLE_ARC_R * (arc.reflex ? 1.15 : 1) * scale * 0.75;
        const count = (arc.group || 0) === 0 ? 1 : 2;
        c.strokeStyle = "#111";
        c.lineWidth = LINE_WIDTH * ANGLE_ARC_LW_EXPORT * scale;
        c.lineCap = "round";
        for (let i = 0; i < count; i++) {
          c.beginPath();
          c.arc(sv.x, sv.y, baseR + i * 6 * scale * 0.75, ang1, ang1 + delta, delta < 0);
          c.stroke();
        }
        const text = (arc.text || "").trim();
        if (text) {
          const mid = ang1 + delta / 2;
          const labelR = baseR + (count - 1) * 6 * scale * 0.75 + 12 * scale * 0.75;
          const lx = sv.x + Math.cos(mid) * labelR;
          const ly = sv.y + Math.sin(mid) * labelR;
          const fontPx = clampLabelSize(labelFontSize) * scale * 0.75;
          paintLabelText(c, text, lx, ly, fontPx, "#111", true);
        }
      }
    }

    if (layers.coordsShow) {
      for (const cp of coordPlots) {
        const fontPx = clampLabelSize(labelFontSize) * scale * 0.75;
        paintCoordPlot(c, cp, toS, LINE_WIDTH * scale * 0.75, fontPx, "#111", false);
      }
    }

    for (const cir of circles) {
      const cen = pointById(cir.centerId);
      const thr = pointById(cir.throughId);
      if (!cen || !thr) continue;
      const sc = toS(cen.x, cen.y);
      const st = toS(thr.x, thr.y);
      const r = Math.hypot(st.x - sc.x, st.y - sc.y);
      const style = circleStyle(cir);
      c.beginPath();
      c.arc(sc.x, sc.y, r, 0, Math.PI * 2);
      c.strokeStyle = "#111";
      c.lineWidth = LINE_WIDTH * 0.95 * scale * 0.75;
      c.lineCap = style === "solid" || !style ? "round" : "butt";
      const dash = STYLE_DASH[style] || [];
      c.setLineDash(dash.map((d) => d * scale * 0.75));
      c.stroke();
      c.setLineDash([]);
    }

    for (const el of ellipses) {
      const dims = ellipseDims(el);
      if (!dims) continue;
      const { c: cen, rx, ry } = dims;
      if (rx < 0.5 || ry < 0.5) continue;
      const sc = toS(cen.x, cen.y);
      const srx = rx * scale;
      const sry = ry * scale;
      const style = ellipseStyle(el);
      const lw = LINE_WIDTH * 0.95 * scale * 0.75;
      if (el.backDashed && (style === "solid" || !style)) {
        c.beginPath();
        c.ellipse(sc.x, sc.y, srx, sry, 0, 0, Math.PI, false);
        c.strokeStyle = "#111";
        c.lineWidth = lw;
        c.setLineDash([]);
        c.lineCap = "round";
        c.stroke();
        c.beginPath();
        c.ellipse(sc.x, sc.y, srx, sry, 0, Math.PI, Math.PI * 2, false);
        c.setLineDash(STYLE_DASH.dashed.map((d) => d * scale * 0.75));
        c.lineCap = "butt";
        c.stroke();
        c.setLineDash([]);
      } else {
        c.beginPath();
        c.ellipse(sc.x, sc.y, srx, sry, 0, 0, Math.PI * 2);
        c.strokeStyle = "#111";
        c.lineWidth = lw;
        c.lineCap = style === "solid" || !style ? "round" : "butt";
        const dash = STYLE_DASH[style] || [];
        c.setLineDash(dash.map((d) => d * scale * 0.75));
        c.stroke();
        c.setLineDash([]);
      }
    }

    for (const sec of sectors) {
      const g = sectorGeom(sec);
      if (!g) continue;
      const sc = toS(g.c.x, g.c.y);
      const sr = g.r * scale;
      const style = sectorStyle(sec);
      const lw = LINE_WIDTH * 0.95 * scale * 0.75;
      const dash = STYLE_DASH[style] || [];
      c.strokeStyle = "#111";
      c.lineWidth = lw;
      c.lineCap = style === "solid" || !style ? "round" : "butt";
      c.setLineDash(dash.map((d) => d * scale * 0.75));
      if (g.mode === "sector") {
        const s0 = toS(g.s.x, g.s.y);
        const s1 = toS(g.c.x + Math.cos(g.a1) * g.r, g.c.y + Math.sin(g.a1) * g.r);
        c.beginPath();
        c.moveTo(sc.x, sc.y);
        c.lineTo(s0.x, s0.y);
        c.moveTo(sc.x, sc.y);
        c.lineTo(s1.x, s1.y);
        c.stroke();
      }
      c.beginPath();
      c.arc(sc.x, sc.y, sr, g.a0, g.a1, g.anticlockwise);
      c.stroke();
      c.setLineDash([]);
    }

    if (!hideExportPoints) {
      for (const p of points) {
        const s = toS(p.x, p.y);
        if (p.marker === "x" || p.marker === "foot") {
          const r = 5 * scale * 0.7;
          c.beginPath();
          c.moveTo(s.x - r, s.y - r);
          c.lineTo(s.x + r, s.y + r);
          c.moveTo(s.x + r, s.y - r);
          c.lineTo(s.x - r, s.y + r);
          c.strokeStyle = "#111";
          c.lineWidth = 1.2 * scale * 0.7;
          c.stroke();
        } else {
          c.beginPath();
          c.arc(s.x, s.y, POINT_R * scale * 0.7, 0, Math.PI * 2);
          c.fillStyle = "#111";
          c.fill();
        }
      }
    }

    if (layers.helpersShow) {
      for (const ll of lengthLabels) {
        const seg = segmentById(ll.segmentId);
        if (!seg) continue;
        const place = lengthLabelPlacement(seg, ll.side, toS, 14 * scale * 0.75);
        if (!place) continue;
        const fontPx = clampLabelSize(labelFontSize) * scale * 0.75;
        paintLabelText(c, ll.text, place.x, place.y, fontPx, "#111", true, place.angle);
      }
    }

    for (const lab of labels) {
      const p = pointById(lab.pointId);
      if (!p) continue;
      const s = toS(p.x + lab.ox, p.y + lab.oy);
      const fontPx = clampLabelSize(lab.size || DEFAULT_LABEL_SIZE) * scale * 0.75;
      paintLabelText(c, lab.text, s.x, s.y, fontPx, "#111", true);
    }

    darkCanvas = prevDark;
    return off;
  }

  async function exportPng(opts) {
    const preferCached = opts && opts.fromPreview && lastPreviewPngBlob;
    try {
      const blob = preferCached
        ? lastPreviewPngBlob
        : await canvasToPngBlob(buildExportCanvas(2));
      await saveBlobAs(blob, "simple-diagram.png", "image/png", [".png"]);
    } catch (err) {
      console.error(err);
      statusHint.textContent = "PNG 匯出失敗";
    }
  }

  async function openExportPreview() {
    const dlg = document.getElementById("exportPreviewDialog");
    const img = document.getElementById("exportPreviewImg");
    const note = document.getElementById("exportPreviewNote");
    const sizeEl = document.getElementById("exportPreviewSize");
    if (!dlg || !img) return;
    const off = buildExportCanvas(2);
    try {
      lastPreviewPngBlob = await canvasToPngBlob(off);
    } catch (_) {
      lastPreviewPngBlob = null;
    }
    if (img._previewUrl) URL.revokeObjectURL(img._previewUrl);
    // Prefer blob URL of the exact PNG that download will use
    if (lastPreviewPngBlob) {
      img._previewUrl = URL.createObjectURL(lastPreviewPngBlob);
    } else {
      img._previewUrl = off.toDataURL("image/png");
    }
    img.src = img._previewUrl;
    img.alt = "匯出預覽 " + off.width + "×" + off.height;
    img.removeAttribute("width");
    img.removeAttribute("height");
    if (sizeEl) {
      const layout = exportLayout(2);
      sizeEl.textContent =
        off.width +
        " × " +
        off.height +
        " px" +
        (exportCrop ? " · 自選裁切" : " · 自動裁切") +
        " · 邊距 " +
        layout.pad +
        "px";
    }
    if (note) {
      let t = hideExportPoints
        ? "預覽＝實際 PNG 匯出（已隱藏頂點圓點）"
        : "預覽＝實際 PNG 匯出（白底、無選取框）";
      if (exportCrop) t += " · 裁切範圍與畫布藍框相同";
      note.textContent = t;
    }
    syncExportCropUI();
    if (typeof dlg.showModal === "function") dlg.showModal();
  }

  function closeExportPreview() {
    const dlg = document.getElementById("exportPreviewDialog");
    if (dlg && dlg.open) dlg.close();
  }

  function escapeXml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function exportSvg() {
    const { w, h, toS, scale, pad } = exportLayout(1.5);
    void pad;
    const dashAttr = (style) => {
      const d = STYLE_DASH[style];
      if (!d || !d.length) return "";
      return ` stroke-dasharray="${d.map((x) => x * scale * 0.75).join(" ")}"`;
    };

    let body = "";
    for (const f of fills) {
      const d = fillToSvgPath(f, toS);
      if (!d) continue;
      body += `<path d="${d}" fill="${hexToRgba(f.color, f.opacity)}" stroke="none" />\n`;
    }
    for (const seg of segments) {
      const a = pointById(seg.a);
      const bp = pointById(seg.b);
      if (!a || !bp) continue;
      const sa = toS(a.x, a.y);
      const sb = toS(bp.x, bp.y);
      const lw = (seg.style === "solid" ? LINE_WIDTH : LINE_WIDTH * 0.92) * scale * 0.75;
      const cap = seg.style === "solid" || !seg.style ? "round" : "butt";
      body += `<line x1="${sa.x.toFixed(2)}" y1="${sa.y.toFixed(2)}" x2="${sb.x.toFixed(2)}" y2="${sb.y.toFixed(2)}" stroke="#111" stroke-width="${lw.toFixed(2)}" stroke-linecap="${cap}"${dashAttr(seg.style)} />\n`;
    }

    if (layers.helpersShow) for (const mt of midTicks) {
      const seg = segmentById(mt.segmentId);
      if (!seg) continue;
      const a = pointById(seg.a);
      const bp = pointById(seg.b);
      if (!a || !bp) continue;
      let mx, my;
      if (mt.pointId && pointById(mt.pointId)) {
        mx = pointById(mt.pointId).x;
        my = pointById(mt.pointId).y;
      } else {
        mx = (a.x + bp.x) / 2;
        my = (a.y + bp.y) / 2;
      }
      const sa = toS(a.x, a.y);
      const sb = toS(bp.x, bp.y);
      const sm = toS(mx, my);
      let dx = sb.x - sa.x,
        dy = sb.y - sa.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const nx = -dy,
        ny = dx;
      const t = MID_TICK * scale * 0.75;
      body += `<line x1="${(sm.x - nx * t).toFixed(2)}" y1="${(sm.y - ny * t).toFixed(2)}" x2="${(sm.x + nx * t).toFixed(2)}" y2="${(sm.y + ny * t).toFixed(2)}" stroke="#111" stroke-width="${(LINE_WIDTH * scale * 0.75).toFixed(2)}" stroke-linecap="round" />\n`;
    }

    if (layers.helpersShow) {
      const unit = scale * 0.75;
      const lw = (LINE_WIDTH * 1.55 * unit).toFixed(2);
      for (const pm of parallelMarks) {
        const seg = segmentById(pm.segmentId);
        if (!seg) continue;
        const basis = segmentDrawBasis(
          seg,
          markTAlong("parallel", pm.segmentId, pm.group),
          toS
        );
        if (!basis) continue;
        const chevrons = parallelMarkDrawChevrons(
          basis,
          pm.group,
          pm.side === -1 ? -1 : 1,
          11 * unit,
          9 * unit
        );
        for (const pts of chevrons) {
          body += `<polyline points="${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)} ${pts[1].x.toFixed(2)},${pts[1].y.toFixed(2)} ${pts[2].x.toFixed(2)},${pts[2].y.toFixed(2)}" fill="none" stroke="#111" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round" />\n`;
        }
      }
      for (const em of equalMarks) {
        const seg = segmentById(em.segmentId);
        if (!seg) continue;
        const basis = segmentDrawBasis(
          seg,
          markTAlong("equal", em.segmentId, em.group),
          toS
        );
        if (!basis) continue;
        const strokes = equalMarkDrawStrokes(
          basis,
          em.group,
          em.side === -1 ? -1 : 1,
          MID_TICK * 2.35 * unit,
          7 * unit
        );
        for (const s of strokes) {
          body += `<line x1="${s.x1.toFixed(2)}" y1="${s.y1.toFixed(2)}" x2="${s.x2.toFixed(2)}" y2="${s.y2.toFixed(2)}" stroke="#111" stroke-width="${lw}" stroke-linecap="round" />\n`;
        }
      }
    }

    if (layers.helpersShow) for (const ra of rightAngles) {
      const v = pointById(ra.vertex);
      const a1 = pointById(ra.arm1);
      const a2 = pointById(ra.arm2);
      if (!v || !a1 || !a2) continue;
      const sv = toS(v.x, v.y);
      const s1 = toS(a1.x, a1.y);
      const s2 = toS(a2.x, a2.y);
      let ux = s1.x - sv.x,
        uy = s1.y - sv.y;
      let vx = s2.x - sv.x,
        vy = s2.y - sv.y;
      const lu = Math.hypot(ux, uy) || 1;
      const lv = Math.hypot(vx, vy) || 1;
      ux /= lu;
      uy /= lu;
      vx /= lv;
      vy /= lv;
      const size = (ra.size || DEFAULT_RA_SIZE) * scale * 0.75;
      const p1x = sv.x + ux * size,
        p1y = sv.y + uy * size;
      const p2x = sv.x + ux * size + vx * size,
        p2y = sv.y + uy * size + vy * size;
      const p3x = sv.x + vx * size,
        p3y = sv.y + vy * size;
      body += `<polyline points="${p1x.toFixed(2)},${p1y.toFixed(2)} ${p2x.toFixed(2)},${p2y.toFixed(2)} ${p3x.toFixed(2)},${p3y.toFixed(2)}" fill="none" stroke="#111" stroke-width="${(LINE_WIDTH * scale * 0.7).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" />\n`;
    }

    if (layers.helpersShow) for (const arc of angleArcs) {
      const v = pointById(arc.vertex);
      const a1 = pointById(arc.arm1);
      const a2 = pointById(arc.arm2);
      if (!v || !a1 || !a2) continue;
      const sv = toS(v.x, v.y);
      const s1 = toS(a1.x, a1.y);
      const s2 = toS(a2.x, a2.y);
      const ang1 = Math.atan2(s1.y - sv.y, s1.x - sv.x);
      const ang2 = Math.atan2(s2.y - sv.y, s2.x - sv.x);
      const delta = angleSweepDelta(ang1, ang2, !!arc.reflex);
      const baseR = (arc.size || DEFAULT_RA_SIZE) * ANGLE_ARC_R * (arc.reflex ? 1.15 : 1) * scale * 0.75;
      const count = (arc.group || 0) === 0 ? 1 : 2;
      const lw = (LINE_WIDTH * ANGLE_ARC_LW_EXPORT * scale).toFixed(2);
      for (let i = 0; i < count; i++) {
        const r = baseR + i * 6 * scale * 0.75;
        const x0 = sv.x + Math.cos(ang1) * r;
        const y0 = sv.y + Math.sin(ang1) * r;
        const x1 = sv.x + Math.cos(ang1 + delta) * r;
        const y1 = sv.y + Math.sin(ang1 + delta) * r;
        const large = Math.abs(delta) > Math.PI ? 1 : 0;
        const sweep = delta > 0 ? 1 : 0;
        body += `<path d="M${x0.toFixed(2)},${y0.toFixed(2)} A${r.toFixed(2)},${r.toFixed(2)} 0 ${large} ${sweep} ${x1.toFixed(2)},${y1.toFixed(2)}" fill="none" stroke="#111" stroke-width="${lw}" stroke-linecap="round" />\n`;
      }
      const text = (arc.text || "").trim();
      if (text) {
        const mid = ang1 + delta / 2;
        const labelR = baseR + (count - 1) * 6 * scale * 0.75 + 12 * scale * 0.75;
        const lx = sv.x + Math.cos(mid) * labelR;
        const ly = sv.y + Math.sin(mid) * labelR;
        const fs = clampLabelSize(labelFontSize) * scale * 0.75;
        const halo = Math.max(3, fs * 0.28);
        body += `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" fill="none" stroke="#ffffff" stroke-width="${halo.toFixed(2)}" stroke-linejoin="round" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="${fs.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>\n`;
        body += `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" fill="#111" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="${fs.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>\n`;
      }
    }

    if (layers.coordsShow) {
      for (const cp of coordPlots) {
        body += svgCoordPlot(cp, toS, scale);
      }
    }

    for (const cir of circles) {
      const cen = pointById(cir.centerId);
      const thr = pointById(cir.throughId);
      if (!cen || !thr) continue;
      const sc = toS(cen.x, cen.y);
      const st = toS(thr.x, thr.y);
      const r = Math.hypot(st.x - sc.x, st.y - sc.y);
      const style = circleStyle(cir);
      const dash = STYLE_DASH[style] || [];
      const dashAttr =
        dash.length > 0
          ? ` stroke-dasharray="${dash.map((d) => (d * scale * 0.75).toFixed(2)).join(" ")}"`
          : "";
      const cap = style === "solid" || !style ? "round" : "butt";
      body += `<circle cx="${sc.x.toFixed(2)}" cy="${sc.y.toFixed(2)}" r="${r.toFixed(2)}" fill="none" stroke="#111" stroke-width="${(LINE_WIDTH * 0.95 * scale * 0.75).toFixed(2)}" stroke-linecap="${cap}"${dashAttr} />\n`;
    }

    for (const el of ellipses) {
      const dims = ellipseDims(el);
      if (!dims) continue;
      const { c: cen, rx, ry } = dims;
      if (rx < 0.5 || ry < 0.5) continue;
      const sc = toS(cen.x, cen.y);
      const srx = rx * scale;
      const sry = ry * scale;
      const style = ellipseStyle(el);
      const lw = (LINE_WIDTH * 0.95 * scale * 0.75).toFixed(2);
      const dashedArr = STYLE_DASH.dashed.map((d) => (d * scale * 0.75).toFixed(2)).join(" ");
      if (el.backDashed && (style === "solid" || !style)) {
        // Approximate halves with two elliptical arcs (front lower, back upper)
        const x0 = (sc.x + srx).toFixed(2),
          y0 = sc.y.toFixed(2);
        const x1 = (sc.x - srx).toFixed(2),
          y1 = sc.y.toFixed(2);
        body += `<path d="M${x0},${y0} A${srx.toFixed(2)},${sry.toFixed(2)} 0 0 1 ${x1},${y1}" fill="none" stroke="#111" stroke-width="${lw}" stroke-linecap="round" />\n`;
        body += `<path d="M${x1},${y1} A${srx.toFixed(2)},${sry.toFixed(2)} 0 0 1 ${x0},${y0}" fill="none" stroke="#111" stroke-width="${lw}" stroke-linecap="butt" stroke-dasharray="${dashedArr}" />\n`;
      } else {
        const dash = STYLE_DASH[style] || [];
        const dashAttr =
          dash.length > 0
            ? ` stroke-dasharray="${dash.map((d) => (d * scale * 0.75).toFixed(2)).join(" ")}"`
            : "";
        const cap = style === "solid" || !style ? "round" : "butt";
        body += `<ellipse cx="${sc.x.toFixed(2)}" cy="${sc.y.toFixed(2)}" rx="${srx.toFixed(2)}" ry="${sry.toFixed(2)}" fill="none" stroke="#111" stroke-width="${lw}" stroke-linecap="${cap}"${dashAttr} />\n`;
      }
    }

    for (const sec of sectors) {
      const g = sectorGeom(sec);
      if (!g) continue;
      const sc = toS(g.c.x, g.c.y);
      const sr = g.r * scale;
      const style = sectorStyle(sec);
      const lw = (LINE_WIDTH * 0.95 * scale * 0.75).toFixed(2);
      const dash = STYLE_DASH[style] || [];
      const dashAttr =
        dash.length > 0
          ? ` stroke-dasharray="${dash.map((d) => (d * scale * 0.75).toFixed(2)).join(" ")}"`
          : "";
      const cap = style === "solid" || !style ? "round" : "butt";
      if (g.mode === "sector") {
        const s0 = toS(g.s.x, g.s.y);
        const s1 = toS(g.c.x + Math.cos(g.a1) * g.r, g.c.y + Math.sin(g.a1) * g.r);
        body += `<line x1="${sc.x.toFixed(2)}" y1="${sc.y.toFixed(2)}" x2="${s0.x.toFixed(2)}" y2="${s0.y.toFixed(2)}" stroke="#111" stroke-width="${lw}" stroke-linecap="${cap}"${dashAttr} />\n`;
        body += `<line x1="${sc.x.toFixed(2)}" y1="${sc.y.toFixed(2)}" x2="${s1.x.toFixed(2)}" y2="${s1.y.toFixed(2)}" stroke="#111" stroke-width="${lw}" stroke-linecap="${cap}"${dashAttr} />\n`;
      }
      const x0 = sc.x + Math.cos(g.a0) * sr;
      const y0 = sc.y + Math.sin(g.a0) * sr;
      const x1 = sc.x + Math.cos(g.a1) * sr;
      const y1 = sc.y + Math.sin(g.a1) * sr;
      const large = Math.abs(g.delta) > Math.PI ? 1 : 0;
      // SVG sweep-flag 1 = clockwise (matches canvas y-down + our atan2)
      const sweep = g.anticlockwise ? 0 : 1;
      body += `<path d="M${x0.toFixed(2)},${y0.toFixed(2)} A${sr.toFixed(2)},${sr.toFixed(2)} 0 ${large} ${sweep} ${x1.toFixed(2)},${y1.toFixed(2)}" fill="none" stroke="#111" stroke-width="${lw}" stroke-linecap="${cap}"${dashAttr} />\n`;
    }

    if (layers.helpersShow) for (const ll of lengthLabels) {
      const seg = segmentById(ll.segmentId);
      if (!seg) continue;
      const place = lengthLabelPlacement(seg, ll.side, toS, 14 * scale * 0.75);
      if (!place) continue;
      const fs = clampLabelSize(labelFontSize) * scale * 0.75;
      const halo = Math.max(3, fs * 0.28);
      const deg = (place.angle * 180) / Math.PI;
      const tf = `translate(${place.x.toFixed(2)} ${place.y.toFixed(2)}) rotate(${deg.toFixed(2)})`;
      const common =
        `transform="${tf}" text-anchor="middle" dominant-baseline="middle" ` +
        `font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="${fs.toFixed(1)}"`;
      body += `<text ${common} fill="none" stroke="#ffffff" stroke-width="${halo.toFixed(2)}" stroke-linejoin="round">${escapeXml(ll.text)}</text>\n`;
      body += `<text ${common} fill="#111">${escapeXml(ll.text)}</text>\n`;
    }

    if (!hideExportPoints) {
      for (const p of points) {
        const s = toS(p.x, p.y);
        if (p.marker === "x" || p.marker === "foot") {
          const r = 5 * scale * 0.7;
          body += `<path d="M${(s.x - r).toFixed(2)},${(s.y - r).toFixed(2)} L${(s.x + r).toFixed(2)},${(s.y + r).toFixed(2)} M${(s.x + r).toFixed(2)},${(s.y - r).toFixed(2)} L${(s.x - r).toFixed(2)},${(s.y + r).toFixed(2)}" stroke="#111" stroke-width="${(1.2 * scale * 0.7).toFixed(2)}" fill="none"/>\n`;
        } else {
          body += `<circle cx="${s.x.toFixed(2)}" cy="${s.y.toFixed(2)}" r="${(POINT_R * scale * 0.7).toFixed(2)}" fill="#111" />\n`;
        }
      }
    }

    for (const lab of labels) {
      const p = pointById(lab.pointId);
      if (!p) continue;
      const s = toS(p.x + lab.ox, p.y + lab.oy);
      const fs = clampLabelSize(lab.size || DEFAULT_LABEL_SIZE) * scale * 0.75;
      const halo = Math.max(3, fs * 0.28);
      body += `<text x="${s.x.toFixed(2)}" y="${s.y.toFixed(2)}" fill="none" stroke="#ffffff" stroke-width="${halo.toFixed(2)}" stroke-linejoin="round" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="${fs.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(lab.text)}</text>\n`;
      body += `<text x="${s.x.toFixed(2)}" y="${s.y.toFixed(2)}" fill="#111" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="${fs.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(lab.text)}</text>\n`;
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(0)}" height="${h.toFixed(0)}" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}">
<rect width="100%" height="100%" fill="#ffffff"/>
${body}</svg>`;

    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    await saveBlobAs(blob, "simple-diagram.svg", "image/svg+xml", [".svg"]);
  }

  // ——— Save / Load / Recent / Autosave ———
  /** Schema version for JSON documents (independent of app UI version). */
  const FORMAT_VERSION = 1;

  function buildProjectData() {
    return {
      formatVersion: FORMAT_VERSION,
      version: "13.5.2",
      app: "simple-diagram",
      points,
      segments,
      labels,
      rightAngles,
      angleArcs,
      midTicks,
      parallelMarks,
      equalMarks,
      lengthLabels,
      circles,
      ellipses,
      sectors,
      fills,
      coordPlots,
      exportCrop,
      sectorMode,
      fillMode,
      shapeMode,
      circlePartMode,
      layers: { ...layers },
      nextLetter,
      labelFontSize,
      rightAngleSize,
      activeParallelGroup,
      activeEqualGroup,
      activeArcGroup,
      gridSnap,
      gridMode,
      hideExportPoints,
      view,
      savedAt: Date.now(),
      name: currentDocName,
    };
  }

  /**
   * Light validation for load path: reject clearly corrupt files;
   * missing formatVersion = v1 (legacy OK). Does not break good old saves.
   * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
   */
  function lightValidateProject(data) {
    const errors = [];
    const warnings = [];
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, errors: ["檔案不是有效的 JSON 物件"], warnings };
    }
    if (data.formatVersion == null || data.formatVersion === "") {
      warnings.push("formatVersion 缺省（視為 v1）");
    } else {
      const fv = Number(data.formatVersion);
      if (!Number.isFinite(fv) || fv < 1) {
        errors.push("formatVersion 無效");
      } else if (fv > FORMAT_VERSION) {
        errors.push("不支援的 formatVersion " + fv + "（目前支援 ≤ " + FORMAT_VERSION + "）");
      }
    }
    const arrayKeys = [
      "points",
      "segments",
      "labels",
      "rightAngles",
      "angleArcs",
      "midTicks",
      "parallelMarks",
      "equalMarks",
      "lengthLabels",
      "circles",
      "ellipses",
      "sectors",
      "fills",
      "coordPlots",
    ];
    for (const k of arrayKeys) {
      if (data[k] != null && !Array.isArray(data[k])) {
        errors.push(k + " 必須是陣列");
      }
    }
    if (Array.isArray(data.points)) {
      for (let i = 0; i < data.points.length; i++) {
        const p = data.points[i];
        if (!p || typeof p !== "object" || typeof p.id !== "string") {
          errors.push("points[" + i + "] 缺少 id");
          break;
        }
        if (!Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) {
          errors.push("points[" + i + "] 座標無效");
          break;
        }
      }
    }
    if (Array.isArray(data.segments) && Array.isArray(data.points)) {
      const ids = new Set(data.points.map((p) => p && p.id).filter(Boolean));
      for (let i = 0; i < Math.min(data.segments.length, 50); i++) {
        const s = data.segments[i];
        if (!s || typeof s !== "object") {
          errors.push("segments[" + i + "] 無效");
          break;
        }
        if (s.a && !ids.has(s.a)) {
          errors.push("線段參照不存在的點：" + s.a);
          break;
        }
        if (s.b && !ids.has(s.b)) {
          errors.push("線段參照不存在的點：" + s.b);
          break;
        }
      }
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  function readRecentList() {
    try {
      const raw = lsGet(LS_RECENT);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function writeRecentList(list) {
    try {
      lsSet(LS_RECENT, JSON.stringify(list.slice(0, RECENT_MAX)));
    } catch (_) {}
  }

  function pushRecentEntry(name, data) {
    const entry = {
      id: uid(),
      name: name || "simple-diagram.json",
      savedAt: Date.now(),
      data,
    };
    const list = readRecentList().filter((r) => r.name !== entry.name);
    list.unshift(entry);
    writeRecentList(list);
    currentDocName = entry.name;
    renderRecentMenu();
  }

  function writeAutosave() {
    try {
      const data = buildProjectData();
      lsSet(
        LS_AUTOBACKUP,
        JSON.stringify({ savedAt: Date.now(), name: currentDocName, data })
      );
    } catch (_) {}
  }

  function readAutosave() {
    try {
      const raw = lsGet(LS_AUTOBACKUP);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function documentIsEmpty() {
    return (
      !points.length &&
      !segments.length &&
      !labels.length &&
      !circles.length &&
      !ellipses.length &&
      !sectors.length &&
      !fills.length &&
      !coordPlots.length &&
      !angleArcs.length
    );
  }

  /** Geometry/content fingerprint (excludes view pan/zoom & savedAt). */
  function contentSignature() {
    return snapshot();
  }

  function markDocClean() {
    cleanContentSig = contentSignature();
  }

  function isDocDirty() {
    return contentSignature() !== cleanContentSig;
  }

  /** Leave-site dialog only when content differs from last clean (save/load/restore/empty). */
  function onBeforeUnloadWarn(e) {
    if (!isDocDirty()) return;
    e.preventDefault();
    e.returnValue = "";
  }

  function renderRecentMenu() {
    if (!recentList) return;
    const list = readRecentList();
    recentList.innerHTML = "";
    if (recentEmpty) recentEmpty.hidden = list.length > 0;
    for (const row of list) {
      const wrap = document.createElement("div");
      wrap.className = "custom-tpl-row";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tpl-insert";
      const when = row.savedAt ? new Date(row.savedAt).toLocaleString() : "";
      btn.textContent = (row.name || "未命名") + (when ? " · " + when : "");
      btn.title = t("tip_open_recent");
      btn.addEventListener("click", () => {
        if (recentMenu) recentMenu.hidden = true;
        if (!row.data) return;
        applyProjectData(row.data, { fromRecent: true, name: row.name });
        statusHint.textContent = "已開啟：" + (row.name || "最近檔案");
      });
      wrap.appendChild(btn);
      recentList.appendChild(wrap);
    }
  }

  function applyProjectData(data, opts) {
    opts = opts || {};
    pushHistory();
    points = data.points || [];
    segments = data.segments || [];
    labels = (data.labels || []).map((l) => ({
      ...l,
      size: clampLabelSize(l.size || data.labelFontSize || DEFAULT_LABEL_SIZE),
    }));
    rightAngles = (data.rightAngles || []).map((r) => ({
      ...r,
      size: r.size || data.rightAngleSize || DEFAULT_RA_SIZE,
    }));
    angleArcs = (data.angleArcs || []).map((a) => ({
      ...a,
      size: a.size || data.rightAngleSize || DEFAULT_RA_SIZE,
      group: a.group ? 1 : 0,
      text: a.text || "",
      reflex: !!a.reflex,
    }));
    coordPlots = (data.coordPlots || []).map((p) => normalizeCoordPlot(p) || p);
    midTicks = data.midTicks || [];
    parallelMarks = (data.parallelMarks || []).map((m) => ({
      ...m,
      side: m.side === -1 ? -1 : 1,
    }));
    equalMarks = (data.equalMarks || []).map((m) => ({
      ...m,
      side: m.side === -1 ? -1 : 1,
    }));
    lengthLabels = (data.lengthLabels || []).map((m) => ({
      ...m,
      side: m.side === -1 ? -1 : 1,
    }));
    circles = data.circles || [];
    ellipses = data.ellipses || [];
    sectors = data.sectors || [];
    fills = (data.fills || []).map((f) => normalizeFillRecord(f)).filter(Boolean);
    exportCrop = data.exportCrop || null;
    if (data.sectorMode === "sector" || data.sectorMode === "arc") sectorMode = data.sectorMode;
    if (data.fillMode === "sector" || data.fillMode === "segment" || data.fillMode === "polygon") {
      fillMode = data.fillMode;
    }
    if (
      data.shapeMode === "square" ||
      data.shapeMode === "equilateral" ||
      data.shapeMode === "rect" ||
      data.shapeMode === "iso"
    ) {
      shapeMode = data.shapeMode;
    }
    if (
      data.circlePartMode === "chord" ||
      data.circlePartMode === "diameter" ||
      data.circlePartMode === "radius"
    ) {
      circlePartMode = data.circlePartMode;
    }
    if (data.layers && typeof data.layers === "object") {
      layers = {
        gridShow: data.layers.gridShow != null ? !!data.layers.gridShow : true,
        gridLock: !!data.layers.gridLock,
        coordsShow: data.layers.coordsShow != null ? !!data.layers.coordsShow : true,
        coordsLock: !!data.layers.coordsLock,
        helpersShow: data.layers.helpersShow != null ? !!data.layers.helpersShow : true,
        helpersLock: !!data.layers.helpersLock,
      };
    }
    nextLetter = data.nextLetter || "A";
    labelFontSize = clampLabelSize(data.labelFontSize || DEFAULT_LABEL_SIZE);
    rightAngleSize = data.rightAngleSize || DEFAULT_RA_SIZE;
    activeParallelGroup = data.activeParallelGroup ? 1 : 0;
    activeEqualGroup = data.activeEqualGroup ? 1 : 0;
    activeArcGroup = data.activeArcGroup ? 1 : 0;
    if (data.gridSnap != null) gridSnap = !!data.gridSnap;
    if (data.gridMode === "square" || data.gridMode === "triangle") {
      gridMode = data.gridMode;
      writeGridModePref(gridMode);
    }
    if (data.hideExportPoints != null) hideExportPoints = !!data.hideExportPoints;
    syncViewOptionUI();
    syncLayersUI();
    if (labelSizeSelect) labelSizeSelect.value = String(labelFontSize);
    if (rightAngleSizeSelect) rightAngleSizeSelect.value = String(rightAngleSize);
    applyLoadedView(data.view);
    if (opts.name) currentDocName = opts.name;
    else if (data.name) currentDocName = data.name;
    setSelection([]);
    draft = null;
    pendingLabelPoint = null;
    pendingRatioSeg = null;
    pendingArcLabelId = null;
    pendingLengthSeg = null;
    history[histIndex] = snapshot();
    syncSectorModeUI();
    syncFillPresetUI();
    syncFillModeUI();
    syncShapeModeUI();
    syncCirclePartModeUI();
    syncExportCropUI();
    syncMarkGroupUI();
    updateStatus();
    draw();
    writeAutosave();
    // Load / recent / autosave restore → clean until the user edits again.
    markDocClean();
  }

  async function saveProject() {
    const data = buildProjectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const ok = await saveBlobAs(blob, currentDocName || "simple-diagram.json", "application/json", [".json"]);
    if (ok) {
      pushRecentEntry(currentDocName || "simple-diagram.json", data);
      writeAutosave();
      markDocClean();
    }
  }

  function loadProject(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const check = lightValidateProject(data);
        if (!check.ok) {
          alert("無法開啟：檔案格式損壞或不支援。\n" + check.errors.join("\n"));
          return;
        }
        const name = (file && file.name) || data.name || "simple-diagram.json";
        applyProjectData(data, { name });
        pushRecentEntry(name, buildProjectData());
        let msg = "已開啟：" + name;
        if (data.formatVersion != null) msg += " · format v" + data.formatVersion;
        else if (check.warnings.length) msg += " · 舊檔（視為 v1）";
        statusHint.textContent = msg;
      } catch (err) {
        alert("無法讀取專案檔：" + err.message);
      }
    };
    reader.readAsText(file);
  }

  // ——— Templates ———
  function viewCenterWorld() {
    return screenToWorld(canvas.clientWidth / 2, canvas.clientHeight / 2);
  }

  /** Always snap to lattice vertices (ignores grid on/off). */
  function latticeSnap(wx, wy) {
    const s = GRID_SIZE;
    return { x: Math.round(wx / s) * s, y: Math.round(wy / s) * s };
  }

  /** Insert origin: view center; when grid on, snapped to a lattice vertex. */
  function templateAnchor() {
    const c = viewCenterWorld();
    return gridSnap ? latticeSnap(c.x, c.y) : c;
  }

  /**
   * World position for a template point.
   * Built-ins pass cell offsets (ci,cj); custom pass world deltas (rx,ry).
   * When grid on → final coords snapped to lattice; when off → free placement.
   */
  function templateWorldPos(dx, dy, fromCells) {
    const o = templateAnchor();
    let x = o.x + (fromCells ? dx * GRID_SIZE : dx);
    let y = o.y + (fromCells ? dy * GRID_SIZE : dy);
    if (gridSnap) {
      const g = latticeSnap(x, y);
      x = g.x;
      y = g.y;
    }
    return { x, y };
  }

  function finishTemplateInsert(before, letterAfter) {
    if (letterAfter) nextLetter = letterAfter;
    history[histIndex] = snapshot();
    selectCreatedSince(before);
    setTool("select");
    draw();
  }

  /**
   * Insert a built-in template.
   * pts use integer CELL offsets: [ci, cj, label?, ox?, oy?, marker?]
   * (world = anchor + ci/cj × GRID_SIZE). Grid ON → all vertices on lattice.
   */
  function insertBuiltinTemplate(spec) {
    pushHistory();
    const before = snapshotIdSets();
    const pts = (spec.pts || []).map((row) => {
      const [ci, cj, lab, ox, oy, marker] = row;
      const pos = templateWorldPos(ci, cj, true);
      const p = addPoint(pos.x, pos.y, true, marker, true);
      if (lab) addLabel(p.id, lab, ox != null ? ox : 0, oy != null ? oy : -14, labelFontSize, true);
      return p;
    });
    for (const row of spec.segs || []) {
      const [i, j, st] = row;
      if (!pts[i] || !pts[j]) continue;
      addSegment(pts[i].id, pts[j].id, st || "solid", true);
    }
    for (const row of spec.circles || []) {
      const [ci, ti, st] = row;
      if (!pts[ci] || !pts[ti]) continue;
      circles.push({
        id: uid(),
        centerId: pts[ci].id,
        throughId: pts[ti].id,
        style: st || "solid",
      });
    }
    // ellipses: [centerIdx, rxIdx, ryIdx, style?, backDashed?]
    for (const row of spec.ellipses || []) {
      const [ci, rxi, ryi, st, back] = row;
      if (!pts[ci] || !pts[rxi] || !pts[ryi]) continue;
      ellipses.push({
        id: uid(),
        centerId: pts[ci].id,
        rxId: pts[rxi].id,
        ryId: pts[ryi].id,
        style: st || "solid",
        backDashed: !!back,
      });
    }
    for (const row of spec.rightAngles || []) {
      const [v, a1, a2] = row;
      if (!pts[v] || !pts[a1] || !pts[a2]) continue;
      rightAngles.push({
        id: uid(),
        vertex: pts[v].id,
        arm1: pts[a1].id,
        arm2: pts[a2].id,
        size: rightAngleSize,
      });
    }
    finishTemplateInsert(before, spec.nextLetter || null);
  }

  /**
   * Built-in templates in GRID CELLS (integer). Edges are 2–5 cells so both
   * 方格 and 三角格 lattice vertices line up when grid is on.
   */
  const BUILTIN_TEMPLATES = {
    rightTri: {
      nextLetter: "D",
      pts: [
        [-4, 3, "A", -14, 10],
        [4, 3, "B", 14, 10],
        [-4, -4, "C", -14, -14],
      ],
      segs: [[0, 1], [1, 2], [2, 0]],
      rightAngles: [[0, 1, 2]],
    },
    isoTri: {
      nextLetter: "D",
      pts: [
        [0, -4, "A", 0, -18],
        [-4, 3, "B", -14, 10],
        [4, 3, "C", 14, 10],
      ],
      segs: [[0, 1], [1, 2], [2, 0]],
    },
    parallelogram: {
      nextLetter: "E",
      pts: [
        [-4, 2, "A", -14, 10],
        [3, 2, "B", 14, 10],
        [5, -2, "C", 14, -10],
        [-2, -2, "D", -14, -10],
      ],
      segs: [[0, 1], [1, 2], [2, 3], [3, 0]],
    },
    trapezoid: {
      nextLetter: "E",
      pts: [
        [-5, 3, "A", -14, 10],
        [5, 3, "B", 14, 10],
        [3, -2, "C", 14, -10],
        [-3, -2, "D", -14, -10],
      ],
      segs: [[0, 1], [1, 2], [2, 3], [3, 0]],
    },
    pentagon: (() => {
      // Lattice-friendly irregular pentagon (approx. regular), all on vertices
      const pts = [
        [0, -4, "A", 0, -18],
        [4, -1, "B", 14, -6],
        [2, 3, "C", 12, 10],
        [-2, 3, "D", -12, 10],
        [-4, -1, "E", -14, -6],
      ];
      const segs = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]];
      return { nextLetter: "F", pts, segs };
    })(),
    circleCenter: {
      nextLetter: "C",
      pts: [
        [0, 0, "O", 12, -12],
        [4, 0, "A", 14, 0],
      ],
      segs: [],
      circles: [[0, 1, "solid"]],
    },
    genTri: {
      nextLetter: "D",
      pts: [
        [-5, 3, "A", -14, 10],
        [4, 2, "B", 14, 10],
        [-1, -3, "C", 0, -16],
      ],
      segs: [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
    },
    circleGeom: {
      nextLetter: "D",
      pts: [
        [0, 0, "O", 12, -12],
        [4, 0, "A", 14, 0],
        [-4, 0, "B", -14, 0],
        [2, 3.464, "C", 12, 12],
        [-2, 3.464, "D", -12, 12],
      ],
      segs: [
        [0, 1], // radius OA
        [1, 2], // diameter AB
        [3, 4], // chord CD
      ],
      circles: [[0, 1, "solid"]],
    },
    rectPrism: {
      nextLetter: "G",
      pts: [
        [-4, 2, "A", -14, 10],
        [2, 3, "B", 14, 10],
        [4, 0, "C", 16, 0],
        [-2, -1, "D", -16, -6],
        [-4, -2, "E", -14, -12],
        [2, -1, "F", 14, -12],
      ],
      segs: [
        [0, 1],
        [1, 2],
        [2, 3, "dashed"],
        [3, 0],
        [0, 4],
        [1, 5],
        [4, 5],
        [2, 5],
        [3, 4, "dashed"],
      ],
    },
    frustum: {
      nextLetter: "I",
      pts: [
        [-5, 3, "A", -16, 10],
        [5, 3, "B", 16, 10],
        [3, -1, "C", 14, -6],
        [-3, -1, "D", -14, -6],
        [-3, -3, "E", -14, -14],
        [3, -3, "F", 14, -14],
        [2, -5, "G", 12, -18],
        [-2, -5, "H", -12, -18],
      ],
      segs: [
        [0, 1],
        [1, 2],
        [2, 3, "dashed"],
        [3, 0],
        [4, 5],
        [5, 6],
        [6, 7, "dashed"],
        [7, 4],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7, "dashed"],
      ],
    },
    tetra: {
      nextLetter: "E",
      pts: [
        [0, -4, "A", 0, -18],
        [-4, 1, "B", -16, 4],
        [0, 4, "C", 0, 18],
        [4, 1, "D", 16, 4],
      ],
      segs: [
        [0, 1],
        [0, 2],
        [0, 3],
        [1, 2],
        [2, 3],
        [1, 3, "dashed"],
      ],
    },
    pyramid: {
      nextLetter: "E",
      pts: [
        [-3, 3, "A", -14, 10],
        [2, 3, "B", 14, 10],
        [4, 0, "C", 16, 0],
        [-1, 0, "D", -16, -6],
        [0, -4, "V", 0, -18],
      ],
      segs: [
        [0, 1],
        [1, 2],
        [2, 3, "dashed"],
        [3, 0],
        [4, 0],
        [4, 1],
        [4, 2],
        [4, 3, "dashed"],
      ],
    },
    altBase: {
      nextLetter: "E",
      pts: [
        [0, -4, "A", 0, -18],
        [-4, 1, "B", -16, 4],
        [0, 4, "C", 0, 18],
        [4, 1, "D", 16, 4],
        [0, 2, "H", 12, 8, "foot"],
      ],
      segs: [
        [0, 1],
        [0, 2],
        [0, 3],
        [1, 2],
        [2, 3],
        [1, 3, "dashed"],
        [0, 4, "dotted"],
      ],
      rightAngles: [[4, 0, 2]],
    },
    triPrism: {
      nextLetter: "G",
      pts: [
        [-4, 2, "A", -14, 10],
        [2, 3, "B", 14, 10],
        [-1, -1, "C", -10, -14],
        [-2, 0, "D", -16, -8],
        [4, 1, "E", 16, 0],
        [1, -3, "F", 10, -16],
      ],
      segs: [
        [0, 1],
        [1, 2],
        [2, 0],
        [3, 4],
        [4, 5],
        [5, 3, "dashed"],
        [0, 3],
        [1, 4],
        [2, 5, "dashed"],
      ],
    },
    cuboid: {
      nextLetter: "I",
      pts: [
        [-4, 2, "A", -14, 10],
        [1, 3, "B", 14, 10],
        [4, 1, "C", 16, 0],
        [-1, 0, "D", -16, -6],
        [-4, -1, "E", -14, -10],
        [1, 0, "F", 14, -10],
        [4, -2, "G", 16, -12],
        [-1, -3, "H", -16, -14],
      ],
      segs: [
        [0, 1],
        [1, 2],
        [2, 3, "dashed"],
        [3, 0],
        [4, 5],
        [5, 6],
        [6, 7, "dashed"],
        [7, 4],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7, "dashed"],
      ],
    },
    cylinder: {
      nextLetter: "C",
      pts: [
        [0, 3, "O", 12, 6], // 0 top center
        [4, 3], // 1 top right (rx)
        [0, 4], // 2 top ry (foreshortened)
        [-4, 3], // 3 top left
        [0, -3, "O′", 12, -14], // 4 bottom center
        [4, -3], // 5 bottom right
        [0, -2], // 6 bottom ry
        [-4, -3], // 7 bottom left
      ],
      segs: [
        [1, 5],
        [3, 7],
        [0, 4, "dotted"],
      ],
      ellipses: [
        [0, 1, 2, "solid", true],
        [4, 5, 6, "solid", true],
      ],
    },
    cone: {
      nextLetter: "C",
      pts: [
        [0, 3, "O", 12, 6], // 0 base center
        [4, 3], // 1 base right
        [0, 4], // 2 base ry
        [-4, 3], // 3 base left
        [0, -4, "V", 0, -18], // 4 apex
      ],
      segs: [
        [4, 1],
        [4, 3],
        [4, 0, "dotted"],
      ],
      ellipses: [[0, 1, 2, "solid", true]],
    },
  };

  function insertBuiltinById(id) {
    const spec = BUILTIN_TEMPLATES[id];
    if (!spec) {
      statusHint.textContent = "未知模板";
      return;
    }
    insertBuiltinTemplate(spec);
  }

  function loadCustomTemplates() {
    try {
      const raw = lsGet(LS_CUSTOM_TPL);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function saveCustomTemplates(list) {
    try {
      lsSet(LS_CUSTOM_TPL, JSON.stringify(list));
    } catch (err) {
      alert("無法儲存自訂模板：" + (err && err.message ? err.message : err));
    }
  }

  function refreshCustomTemplateMenu() {
    if (!customTplList) return;
    const list = loadCustomTemplates();
    customTplList.innerHTML = "";
    if (customTplEmpty) customTplEmpty.hidden = list.length > 0;
    for (const tpl of list) {
      const row = document.createElement("div");
      row.className = "custom-tpl-row";
      const ins = document.createElement("button");
      ins.type = "button";
      ins.className = "tpl-insert";
      ins.textContent = tpl.name || "未命名";
      ins.title = t("tip_insert_tpl").replace("{name}", tpl.name || "");
      ins.addEventListener("click", () => {
        closeTemplateMenu();
        insertCustomTemplate(tpl);
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "tpl-del";
      del.textContent = "×";
      del.title = t("tip_del_tpl");
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm("刪除自訂模板「" + (tpl.name || "") + "」？")) return;
        const next = loadCustomTemplates().filter((t) => t.id !== tpl.id);
        saveCustomTemplates(next);
        refreshCustomTemplateMenu();
      });
      row.appendChild(ins);
      row.appendChild(del);
      customTplList.appendChild(row);
    }
  }

  function closeTemplateMenu() {
    if (!templateMenu || !btnTemplateMenu) return;
    templateMenu.setAttribute("hidden", "");
    btnTemplateMenu.setAttribute("aria-expanded", "false");
  }

  function openTemplateMenu() {
    if (!templateMenu || !btnTemplateMenu) return;
    if (typeof closeExportMenu === "function") closeExportMenu();
    closeRecentMenu();
    const layersMenuEl = document.getElementById("layersMenu");
    const btnLayers = document.getElementById("btnLayersMenu");
    if (layersMenuEl) layersMenuEl.setAttribute("hidden", "");
    if (btnLayers) btnLayers.setAttribute("aria-expanded", "false");
    refreshCustomTemplateMenu();
    templateMenu.removeAttribute("hidden");
    btnTemplateMenu.setAttribute("aria-expanded", "true");
  }

  const btnExportMenu = document.getElementById("btnExportMenu");
  const exportMenu = document.getElementById("exportMenu");

  function closeExportMenu() {
    if (!exportMenu || !btnExportMenu) return;
    exportMenu.setAttribute("hidden", "");
    btnExportMenu.setAttribute("aria-expanded", "false");
  }

  function openExportMenu() {
    if (!exportMenu || !btnExportMenu) return;
    closeTemplateMenu();
    const recentMenuEl = document.getElementById("recentMenu");
    const btnRecent = document.getElementById("btnRecentMenu");
    if (recentMenuEl) recentMenuEl.setAttribute("hidden", "");
    if (btnRecent) btnRecent.setAttribute("aria-expanded", "false");
    exportMenu.removeAttribute("hidden");
    btnExportMenu.setAttribute("aria-expanded", "true");
  }

  /** Collect geometry from current selection into a relative custom template. */
  function captureSelectionAsTemplate(name) {
    const pointIds = new Set();
    const segIds = new Set();
    const circleIds = new Set();
    const ellipseIds = new Set();
    const raIds = new Set();
    const pmIds = new Set();
    const emIds = new Set();
    const llIds = new Set();

    for (const s of selection) {
      if (s.type === "point") pointIds.add(s.id);
      else if (s.type === "segment") {
        segIds.add(s.id);
        const seg = segmentById(s.id);
        if (seg) {
          pointIds.add(seg.a);
          pointIds.add(seg.b);
        }
      } else if (s.type === "circle") {
        circleIds.add(s.id);
        const cir = circles.find((c) => c.id === s.id);
        if (cir) {
          pointIds.add(cir.centerId);
          pointIds.add(cir.throughId);
        }
      } else if (s.type === "ellipse") {
        ellipseIds.add(s.id);
        const el = ellipses.find((c) => c.id === s.id);
        if (el) {
          pointIds.add(el.centerId);
          pointIds.add(el.rxId);
          pointIds.add(el.ryId);
        }
      } else if (s.type === "label") {
        const lab = labels.find((l) => l.id === s.id);
        if (lab) pointIds.add(lab.pointId);
      } else if (s.type === "rightAngle") {
        raIds.add(s.id);
        const ra = rightAngles.find((r) => r.id === s.id);
        if (ra) {
          pointIds.add(ra.vertex);
          pointIds.add(ra.arm1);
          pointIds.add(ra.arm2);
        }
      } else if (s.type === "parallelMark") {
        pmIds.add(s.id);
        const m = parallelMarks.find((x) => x.id === s.id);
        if (m) {
          const seg = segmentById(m.segmentId);
          if (seg) {
            segIds.add(seg.id);
            pointIds.add(seg.a);
            pointIds.add(seg.b);
          }
        }
      } else if (s.type === "equalMark") {
        emIds.add(s.id);
        const m = equalMarks.find((x) => x.id === s.id);
        if (m) {
          const seg = segmentById(m.segmentId);
          if (seg) {
            segIds.add(seg.id);
            pointIds.add(seg.a);
            pointIds.add(seg.b);
          }
        }
      } else if (s.type === "lengthLabel") {
        llIds.add(s.id);
        const ll = lengthLabels.find((x) => x.id === s.id);
        if (ll) {
          const seg = segmentById(ll.segmentId);
          if (seg) {
            segIds.add(seg.id);
            pointIds.add(seg.a);
            pointIds.add(seg.b);
          }
        }
      }
    }

    if (!pointIds.size) {
      statusHint.textContent = "請先選取點／線／圓／橢圓等物件再存為模板";
      return null;
    }

    const idList = [...pointIds];
    const idx = {};
    idList.forEach((id, i) => {
      idx[id] = i;
    });
    let cx = 0,
      cy = 0;
    for (const id of idList) {
      const p = pointById(id);
      cx += p.x;
      cy += p.y;
    }
    cx /= idList.length;
    cy /= idList.length;

    const pts = idList.map((id) => {
      const p = pointById(id);
      const lab = labels.find((l) => l.pointId === id);
      return {
        rx: p.x - cx,
        ry: p.y - cy,
        marker: p.marker || null,
        label: lab ? lab.text : null,
        ox: lab ? lab.ox : null,
        oy: lab ? lab.oy : null,
      };
    });

    const segs = [];
    const segIndex = {};
    for (const id of segIds) {
      const seg = segmentById(id);
      if (!seg || idx[seg.a] == null || idx[seg.b] == null) continue;
      segIndex[id] = segs.length;
      segs.push({ a: idx[seg.a], b: idx[seg.b], style: seg.style || "solid" });
    }

    const cirs = [];
    for (const id of circleIds) {
      const cir = circles.find((c) => c.id === id);
      if (!cir || idx[cir.centerId] == null || idx[cir.throughId] == null) continue;
      cirs.push({
        center: idx[cir.centerId],
        through: idx[cir.throughId],
        style: cir.style || "solid",
      });
    }

    const ells = [];
    for (const id of ellipseIds) {
      const el = ellipses.find((c) => c.id === id);
      if (!el || idx[el.centerId] == null || idx[el.rxId] == null || idx[el.ryId] == null) continue;
      ells.push({
        center: idx[el.centerId],
        rx: idx[el.rxId],
        ry: idx[el.ryId],
        style: el.style || "solid",
        backDashed: !!el.backDashed,
      });
    }

    const ras = [];
    for (const id of raIds) {
      const ra = rightAngles.find((r) => r.id === id);
      if (!ra || idx[ra.vertex] == null || idx[ra.arm1] == null || idx[ra.arm2] == null) continue;
      ras.push({ vertex: idx[ra.vertex], arm1: idx[ra.arm1], arm2: idx[ra.arm2] });
    }

    const pms = [];
    for (const id of pmIds) {
      const m = parallelMarks.find((x) => x.id === id);
      if (!m || segIndex[m.segmentId] == null) continue;
      pms.push({
        segment: segIndex[m.segmentId],
        group: m.group ? 1 : 0,
        side: m.side === -1 ? -1 : 1,
      });
    }
    const ems = [];
    for (const id of emIds) {
      const m = equalMarks.find((x) => x.id === id);
      if (!m || segIndex[m.segmentId] == null) continue;
      ems.push({
        segment: segIndex[m.segmentId],
        group: m.group ? 1 : 0,
        side: m.side === -1 ? -1 : 1,
      });
    }
    const lls = [];
    for (const id of llIds) {
      const ll = lengthLabels.find((x) => x.id === id);
      if (!ll || segIndex[ll.segmentId] == null) continue;
      lls.push({
        segment: segIndex[ll.segmentId],
        text: ll.text || "6",
        side: ll.side === -1 ? -1 : 1,
      });
    }

    return {
      id: uid(),
      name: (name || "我的模板").trim() || "我的模板",
      createdAt: Date.now(),
      points: pts,
      segments: segs,
      circles: cirs,
      ellipses: ells,
      rightAngles: ras,
      parallelMarks: pms,
      equalMarks: ems,
      lengthLabels: lls,
    };
  }

  function insertCustomTemplate(tpl) {
    if (!tpl || !tpl.points || !tpl.points.length) return;
    pushHistory();
    const before = snapshotIdSets();
    const pts = tpl.points.map((row) => {
      // World deltas from saved centroid; grid ON → snap each vertex to lattice
      const pos = templateWorldPos(row.rx, row.ry, false);
      const p = addPoint(pos.x, pos.y, true, row.marker || undefined, true);
      if (row.label) {
        addLabel(
          p.id,
          row.label,
          row.ox != null ? row.ox : 0,
          row.oy != null ? row.oy : -14,
          labelFontSize,
          true
        );
      }
      return p;
    });
    const segIds = [];
    for (const s of tpl.segments || []) {
      if (!pts[s.a] || !pts[s.b]) {
        segIds.push(null);
        continue;
      }
      const ns = addSegment(pts[s.a].id, pts[s.b].id, s.style || "solid", true);
      segIds.push(ns ? ns.id : null);
    }
    for (const cir of tpl.circles || []) {
      if (!pts[cir.center] || !pts[cir.through]) continue;
      circles.push({
        id: uid(),
        centerId: pts[cir.center].id,
        throughId: pts[cir.through].id,
        style: cir.style || "solid",
      });
    }
    for (const el of tpl.ellipses || []) {
      if (!pts[el.center] || !pts[el.rx] || !pts[el.ry]) continue;
      ellipses.push({
        id: uid(),
        centerId: pts[el.center].id,
        rxId: pts[el.rx].id,
        ryId: pts[el.ry].id,
        style: el.style || "solid",
        backDashed: !!el.backDashed,
      });
    }
    for (const ra of tpl.rightAngles || []) {
      if (!pts[ra.vertex] || !pts[ra.arm1] || !pts[ra.arm2]) continue;
      rightAngles.push({
        id: uid(),
        vertex: pts[ra.vertex].id,
        arm1: pts[ra.arm1].id,
        arm2: pts[ra.arm2].id,
        size: rightAngleSize,
      });
    }
    for (const m of tpl.parallelMarks || []) {
      const sid = segIds[m.segment];
      if (!sid) continue;
      parallelMarks.push({
        id: uid(),
        segmentId: sid,
        group: m.group ? 1 : 0,
        side: m.side === -1 ? -1 : 1,
      });
    }
    for (const m of tpl.equalMarks || []) {
      const sid = segIds[m.segment];
      if (!sid) continue;
      equalMarks.push({
        id: uid(),
        segmentId: sid,
        group: m.group ? 1 : 0,
        side: m.side === -1 ? -1 : 1,
      });
    }
    for (const ll of tpl.lengthLabels || []) {
      const sid = segIds[ll.segment];
      if (!sid) continue;
      lengthLabels.push({
        id: uid(),
        segmentId: sid,
        text: ll.text || "6",
        side: ll.side === -1 ? -1 : 1,
      });
    }
    finishTemplateInsert(before, null);
  }

  function openSaveTemplateDialog() {
    if (!selection.length) {
      statusHint.textContent = "請先多選要存成模板的物件";
      return;
    }
    if (templateNameInput) templateNameInput.value = "我的模板";
    if (templateNameDialog && typeof templateNameDialog.showModal === "function") {
      templateNameDialog.showModal();
      if (templateNameInput) templateNameInput.select();
    }
  }

  function copySelection() {
    if (!selection.length) {
      statusHint.textContent = "沒有可複製的選取";
      return;
    }
    const offset = 24;
    // Collect related point ids
    const pointIds = new Set();
    const segIds = new Set();
    const circleIds = new Set();
    const ellipseIds = new Set();
    const sectorIds = new Set();
    const fillIds = new Set();
    for (const s of selection) {
      if (s.type === "point") pointIds.add(s.id);
      else if (s.type === "segment") {
        segIds.add(s.id);
        const seg = segmentById(s.id);
        if (seg) { pointIds.add(seg.a); pointIds.add(seg.b); }
      } else if (s.type === "circle") {
        circleIds.add(s.id);
        const cir = circles.find((c) => c.id === s.id);
        if (cir) { pointIds.add(cir.centerId); pointIds.add(cir.throughId); }
      } else if (s.type === "ellipse") {
        ellipseIds.add(s.id);
        const el = ellipses.find((c) => c.id === s.id);
        if (el) {
          pointIds.add(el.centerId);
          pointIds.add(el.rxId);
          pointIds.add(el.ryId);
        }
      } else if (s.type === "sector") {
        sectorIds.add(s.id);
        const sec = sectors.find((c) => c.id === s.id);
        if (sec) {
          pointIds.add(sec.centerId);
          pointIds.add(sec.startId);
          pointIds.add(sec.endId);
        }
      } else if (s.type === "fill") {
        fillIds.add(s.id);
        const f = fills.find((c) => c.id === s.id);
        if (f) {
          for (const pid of fillReferencedPointIds(f)) pointIds.add(pid);
        }
      } else if (s.type === "label") {
        const lab = labels.find((l) => l.id === s.id);
        if (lab) pointIds.add(lab.pointId);
      }
    }
    if (!pointIds.size && !segIds.size && !circleIds.size && !ellipseIds.size && !sectorIds.size && !fillIds.size) {
      statusHint.textContent = "目前選取無法複製（請選點／線／圓／橢圓／弧／填色）";
      return;
    }
    pushHistory();
    const idMap = {};
    for (const id of pointIds) {
      const p = pointById(id);
      if (!p) continue;
      const np = addPoint(p.x + offset, p.y + offset, true, p.marker);
      idMap[id] = np.id;
    }
    const newSel = [];
    for (const id of segIds) {
      const seg = segmentById(id);
      if (!seg) continue;
      const a = idMap[seg.a], b = idMap[seg.b];
      if (!a || !b) continue;
      const ns = addSegment(a, b, seg.style, true);
      if (ns) newSel.push({ type: "segment", id: ns.id });
    }
    for (const id of circleIds) {
      const cir = circles.find((c) => c.id === id);
      if (!cir) continue;
      const c = idMap[cir.centerId], t = idMap[cir.throughId];
      if (!c || !t) continue;
      const nc = {
        id: uid(),
        centerId: c,
        throughId: t,
        style: cir.style || "solid",
      };
      circles.push(nc);
      newSel.push({ type: "circle", id: nc.id });
    }
    for (const id of ellipseIds) {
      const el = ellipses.find((c) => c.id === id);
      if (!el) continue;
      const c = idMap[el.centerId],
        rx = idMap[el.rxId],
        ry = idMap[el.ryId];
      if (!c || !rx || !ry) continue;
      const ne = {
        id: uid(),
        centerId: c,
        rxId: rx,
        ryId: ry,
        style: el.style || "solid",
        backDashed: !!el.backDashed,
      };
      ellipses.push(ne);
      newSel.push({ type: "ellipse", id: ne.id });
    }
    for (const id of sectorIds) {
      const sec = sectors.find((c) => c.id === id);
      if (!sec) continue;
      const c = idMap[sec.centerId],
        s = idMap[sec.startId],
        e = idMap[sec.endId];
      if (!c || !s || !e) continue;
      const ns = {
        id: uid(),
        centerId: c,
        startId: s,
        endId: e,
        style: sec.style || "solid",
        mode: sec.mode === "sector" ? "sector" : "arc",
      };
      sectors.push(ns);
      newSel.push({ type: "sector", id: ns.id });
    }
    for (const id of fillIds) {
      const f = fills.find((c) => c.id === id);
      if (!f) continue;
      const kind = fillKindOf(f);
      let nf = null;
      if (kind === "sector") {
        const cId = idMap[f.centerId];
        const sId = idMap[f.startId];
        const eId = idMap[f.endId];
        if (!cId || !sId || !eId) continue;
        nf = {
          id: uid(),
          kind: "sector",
          circleId: f.circleId || null,
          centerId: cId,
          startId: sId,
          endId: eId,
          color: f.color || "#666666",
          opacity: Number.isFinite(Number(f.opacity)) ? Number(f.opacity) : 0.2,
        };
      } else if (kind === "segment") {
        const sId = idMap[f.startId];
        const eId = idMap[f.endId];
        if (!sId || !eId || !f.circleId) continue;
        nf = {
          id: uid(),
          kind: "segment",
          circleId: f.circleId,
          startId: sId,
          endId: eId,
          color: f.color || "#666666",
          opacity: Number.isFinite(Number(f.opacity)) ? Number(f.opacity) : 0.2,
        };
      } else {
        const mapped = (f.pointIds || []).map((pid) => idMap[pid]).filter(Boolean);
        if (mapped.length < 3) continue;
        nf = {
          id: uid(),
          kind: "polygon",
          pointIds: mapped,
          color: f.color || "#666666",
          opacity: Number.isFinite(Number(f.opacity)) ? Number(f.opacity) : 0.2,
        };
      }
      fills.push(nf);
      newSel.push({ type: "fill", id: nf.id });
    }
    for (const id of pointIds) {
      const lab = labels.find((l) => l.pointId === id);
      if (lab && idMap[id]) {
        addLabel(idMap[id], lab.text, lab.ox, lab.oy, lab.size, true);
      }
      if (idMap[id]) newSel.push({ type: "point", id: idMap[id] });
    }
    history[histIndex] = snapshot();
    setSelection(newSel);
    updateStatus();
    draw();
  }

  function shortcutDisplay(key) {
    if (key === " ") return "Space";
    if (key === "?") return "?";
    return String(key || "").toUpperCase();
  }

  function shortcutConflicts() {
    const map = {};
    for (const [id, key] of Object.entries(shortcuts)) {
      const k = (key || "").toLowerCase();
      if (!k) continue;
      if (!map[k]) map[k] = [];
      map[k].push(id);
    }
    return Object.entries(map).filter(([, ids]) => ids.length > 1);
  }

  function persistShortcuts() {
    try {
      lsSet(LS_SHORTCUTS, JSON.stringify(shortcuts));
    } catch (_) {}
  }

  function renderShortcutMap() {
    if (!shortcutMapList) return;
    const conflicts = new Set();
    for (const [, ids] of shortcutConflicts()) ids.forEach((id) => conflicts.add(id));
    if (shortcutConflict) {
      const rows = shortcutConflicts();
      if (rows.length) {
        shortcutConflict.hidden = false;
        shortcutConflict.textContent =
          "衝突：" +
          rows
            .map(([k, ids]) => shortcutDisplay(k) + " → " + ids.map((id) => SHORTCUT_LABELS[id] || id).join("／"))
            .join("；");
      } else {
        shortcutConflict.hidden = true;
        shortcutConflict.textContent = "";
      }
    }
    shortcutMapList.innerHTML = "";
    for (const id of Object.keys(DEFAULT_SHORTCUTS)) {
      const row = document.createElement("div");
      row.className = "shortcut-row" + (conflicts.has(id) ? " is-conflict" : "");
      if (shortcutListenId === id) row.classList.add("is-listening");
      const name = document.createElement("span");
      name.textContent = SHORTCUT_LABELS[id] || id;
      const keyEl = document.createElement("span");
      keyEl.className = "sk-key";
      keyEl.textContent = shortcutListenId === id ? "…" : shortcutDisplay(shortcuts[id]);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = shortcutListenId === id ? "按鍵…" : "改";
      btn.addEventListener("click", () => {
        shortcutListenId = id;
        renderShortcutMap();
      });
      row.appendChild(name);
      row.appendChild(keyEl);
      row.appendChild(btn);
      shortcutMapList.appendChild(row);
    }
  }

  function openShortcuts() {
    shortcutListenId = null;
    renderShortcutMap();
    if (shortcutsDialog && typeof shortcutsDialog.showModal === "function") {
      shortcutsDialog.showModal();
    }
  }

  function cycleLineStyle() {
    const order = ["solid", "dashed", "dotted", "dashdot"];
    const i = order.indexOf(lineStyle);
    setLineStyle(order[(i + 1) % order.length]);
  }

  function runShortcutAction(id) {
    if (id === "tool_select") setTool("select");
    else if (id === "tool_point") setTool("point");
    else if (id === "tool_line") setTool("line");
    else if (id === "tool_horizontal") setTool("horizontal");
    else if (id === "tool_circle") setTool("circle");
    else if (id === "tool_ellipse") setTool("ellipse");
    else if (id === "tool_sector") setTool("sector");
    else if (id === "tool_fill") setTool("fill");
    else if (id === "tool_shape") setTool("shape");
    else if (id === "tool_circlePart") setTool("circlePart");
    else if (id === "tool_midTick") setTool("midTick");
    else if (id === "tool_ratio") setTool("ratio");
    else if (id === "tool_hand") setTool("hand");
    else if (id === "flip_mark") flipSelectedMarks();
    else if (id === "cycle_mark") {
      if (tool === "sector") setSectorMode(sectorMode === "arc" ? "sector" : "arc");
      else if (tool === "fill") {
        const order = ["polygon", "sector", "segment"];
        setFillMode(order[(order.indexOf(fillMode) + 1) % order.length]);
      } else if (tool === "shape") {
        const order = ["square", "equilateral", "rect", "iso"];
        setShapeMode(order[(order.indexOf(shapeMode) + 1) % order.length]);
      } else if (tool === "circlePart") {
        const order = ["chord", "diameter", "radius"];
        setCirclePartMode(order[(order.indexOf(circlePartMode) + 1) % order.length]);
      } else if (tool === "parallel") setActiveMarkGroup(activeParallelGroup ? 0 : 1);
      else if (tool === "equal") setActiveMarkGroup(activeEqualGroup ? 0 : 1);
      else if (tool === "angleArc") setActiveMarkGroup(activeArcGroup ? 0 : 1);
      else setActiveMarkGroup(activeParallelGroup ? 0 : 1);
    } else if (id === "cycle_style") cycleLineStyle();
    else if (id === "prev_tool") setTool(previousTool || "select");
    else if (id === "open_shortcuts") openShortcuts();
  }

  // ——— Keyboard ———
  function onKeyDown(e) {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (shortcutListenId && shortcutsDialog && shortcutsDialog.open) {
      e.preventDefault();
      if (e.key === "Escape") {
        shortcutListenId = null;
        renderShortcutMap();
        return;
      }
      let k = e.key.length === 1 ? e.key.toLowerCase() : "";
      if (e.code === "Space") k = " ";
      if (e.key === "?" || (e.shiftKey && e.key === "/")) k = "?";
      if (!k || e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === "delete" || e.key === "Backspace") return;
      shortcuts[shortcutListenId] = k;
      shortcutListenId = null;
      persistShortcuts();
      renderShortcutMap();
      return;
    }

    if (e.code === "Space") {
      // Still allow temporary pan; also fires tool_hand if remapped away from space
      spaceDown = true;
      canvas.classList.add("space-pan", "panning");
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      if (draft && draft.kind === "fill") {
        e.preventDefault();
        commitFillDraft();
        return;
      }
    }
    if (e.key === "Escape") {
      const openDlg = document.querySelector("dialog[open]");
      if (openDlg) {
        return;
      }
      if (draft && draft.kind === "exportCrop") {
        draft = null;
        statusHint.textContent = "已取消框選";
        updateStatus();
        draw();
        return;
      }
      draft = null;
      setSelection([]);
      updateStatus();
      draw();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))
    ) {
      e.preventDefault();
      redo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      copySelection();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "/") {
      e.preventDefault();
      openShortcuts();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selection.length) {
        e.preventDefault();
        deleteSelected();
      }
      return;
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      let k = e.key.length === 1 ? e.key.toLowerCase() : "";
      if (e.key === "?" || (e.shiftKey && e.key === "/")) k = "?";
      if (!k) return;
      for (const [id, key] of Object.entries(shortcuts)) {
        if ((key || "").toLowerCase() === k) {
          e.preventDefault();
          runShortcutAction(id);
          return;
        }
      }
    }
  }

  function onKeyUp(e) {
    if (e.code === "Space") {
      spaceDown = false;
      if (!panning) {
        if (tool === "hand") {
          canvas.classList.remove("panning", "active");
          canvas.classList.add("space-pan", "tool-hand");
        } else {
          canvas.classList.remove("space-pan", "panning");
        }
      }
    }
  }

  // ——— Wire UI ———
  // Delegate tool switching on top bar + left rail. Do not preventDefault on pointerdown —
  // that suppresses click and can make tools appear "dead" under some input paths.
  function toolButtonFromEvent(e) {
    const t = e.target;
    if (!t || !t.closest) return null;
    return t.closest("button.tool[data-tool]");
  }
  function activateToolButton(btn) {
    if (!btn || btn.disabled) return;
    const name = btn.dataset.tool;
    if (!name) return;
    setTool(name);
  }
  const toolClickRoots = [
    document.querySelector(".toolbar"),
    document.querySelector(".tool-rail"),
  ].filter(Boolean);
  if (toolClickRoots.length) {
    for (const root of toolClickRoots) {
      root.addEventListener("click", (e) => {
        activateToolButton(toolButtonFromEvent(e));
      });
    }
  } else {
    document.querySelectorAll(".tool").forEach((btn) => {
      btn.addEventListener("click", () => activateToolButton(btn));
    });
  }
  document.querySelectorAll(".mark-group-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.sectorMode) {
        setSectorMode(btn.dataset.sectorMode);
        if (tool !== "sector") setTool("sector");
        return;
      }
      setActiveMarkGroup(Number(btn.dataset.markGroup) || 0);
    });
  });
  if (btnExportMenu && exportMenu) {
    btnExportMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = exportMenu.hasAttribute("hidden");
      if (open) openExportMenu();
      else closeExportMenu();
    });
    exportMenu.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => closeExportMenu());
  }
  const btnExportCrop = document.getElementById("btnExportCrop");
  if (btnExportCrop) {
    btnExportCrop.addEventListener("click", () => {
      closeExportMenu();
      setTool("exportCrop");
    });
  }
  const btnClearExportCrop = document.getElementById("btnClearExportCrop");
  if (btnClearExportCrop) {
    btnClearExportCrop.addEventListener("click", () => {
      clearExportCrop();
      closeExportMenu();
      statusHint.textContent = uiLang === "en" ? "Export crop cleared" : "已清除匯出裁切範圍";
    });
  }
  const btnPreviewSetCrop = document.getElementById("btnPreviewSetCrop");
  if (btnPreviewSetCrop) {
    btnPreviewSetCrop.addEventListener("click", () => {
      closeExportPreview();
      setTool("exportCrop");
    });
  }
  const btnPreviewClearCrop = document.getElementById("btnPreviewClearCrop");
  if (btnPreviewClearCrop) {
    btnPreviewClearCrop.addEventListener("click", () => {
      clearExportCrop();
      openExportPreview();
    });
  }
  document.querySelectorAll(".style-btn").forEach((btn) => {
    btn.addEventListener("click", () => setLineStyle(btn.dataset.style));
  });
  document.getElementById("btnUndo").addEventListener("click", undo);
  document.getElementById("btnRedo").addEventListener("click", redo);
  document.getElementById("btnDelete").addEventListener("click", deleteSelected);
  document.getElementById("btnClearAll").addEventListener("click", clearAll);
  document.getElementById("btnSave").addEventListener("click", saveProject);
  document.getElementById("btnLoad").addEventListener("click", () => fileInput.click());
  document.getElementById("btnExportPng").addEventListener("click", () => {
    closeExportMenu();
    exportPng();
  });
  document.getElementById("btnExportSvg").addEventListener("click", () => {
    closeExportMenu();
    exportSvg();
  });
  const btnExportPreview = document.getElementById("btnExportPreview");
  if (btnExportPreview) {
    btnExportPreview.addEventListener("click", () => {
      closeExportMenu();
      openExportPreview();
    });
  }
  const btnPreviewPng = document.getElementById("btnPreviewDownloadPng");
  if (btnPreviewPng) {
    btnPreviewPng.addEventListener("click", () => {
      exportPng({ fromPreview: true });
    });
  }
  const btnPreviewSvg = document.getElementById("btnPreviewDownloadSvg");
  if (btnPreviewSvg) {
    btnPreviewSvg.addEventListener("click", () => {
      exportSvg();
    });
  }
  const btnPreviewClose = document.getElementById("btnPreviewClose");
  if (btnPreviewClose) btnPreviewClose.addEventListener("click", closeExportPreview);
  const exportPreviewDialog = document.getElementById("exportPreviewDialog");
  if (exportPreviewDialog) {
    exportPreviewDialog.addEventListener("cancel", (e) => {
      // allow default close on Esc
    });
  }
  if (btnTemplateMenu && templateMenu) {
    btnTemplateMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = templateMenu.hasAttribute("hidden");
      if (open) openTemplateMenu();
      else closeTemplateMenu();
    });
    templateMenu.addEventListener("click", (e) => e.stopPropagation());
    templateMenu.querySelectorAll("[data-tpl]").forEach((btn) => {
      btn.addEventListener("click", () => {
        closeTemplateMenu();
        insertBuiltinById(btn.dataset.tpl);
      });
    });
    document.addEventListener("click", () => closeTemplateMenu());
  }
  if (btnSaveTemplate) btnSaveTemplate.addEventListener("click", openSaveTemplateDialog);
  if (templateNameForm) {
    templateNameForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = templateNameInput ? templateNameInput.value : "我的模板";
      const tpl = captureSelectionAsTemplate(name);
      if (templateNameDialog) templateNameDialog.close();
      if (!tpl) return;
      const list = loadCustomTemplates();
      list.push(tpl);
      saveCustomTemplates(list);
      refreshCustomTemplateMenu();
      statusHint.textContent = "已儲存自訂模板「" + tpl.name + "」";
    });
  }
  if (templateNameCancel) {
    templateNameCancel.addEventListener("click", () => {
      if (templateNameDialog) templateNameDialog.close();
    });
  }
  const btnCopy = document.getElementById("btnCopy");
  if (btnCopy) btnCopy.addEventListener("click", copySelection);
  const btnFlipMark = document.getElementById("btnFlipMark");
  if (btnFlipMark) btnFlipMark.addEventListener("click", flipSelectedMarks);
  const btnShortcuts = document.getElementById("btnShortcuts");
  if (btnShortcuts) btnShortcuts.addEventListener("click", openShortcuts);
  const shortcutsClose = document.getElementById("shortcutsClose");
  if (shortcutsClose) {
    shortcutsClose.addEventListener("click", () => {
      shortcutListenId = null;
      if (shortcutsDialog) shortcutsDialog.close();
    });
  }
  if (shortcutsReset) {
    shortcutsReset.addEventListener("click", () => {
      shortcuts = { ...DEFAULT_SHORTCUTS };
      persistShortcuts();
      shortcutListenId = null;
      renderShortcutMap();
    });
  }
  if (chkDarkCanvas) {
    chkDarkCanvas.addEventListener("change", () => {
      darkCanvas = !!chkDarkCanvas.checked;
      try {
        lsSet(LS_DARK, darkCanvas ? "1" : "0");
      } catch (_) {}
      applyDarkCanvasClass();
      draw();
    });
  }
  function closeRecentMenu() {
    if (recentMenu) recentMenu.hidden = true;
    if (btnRecentMenu) btnRecentMenu.setAttribute("aria-expanded", "false");
  }
  function openRecentMenu() {
    if (typeof closeExportMenu === "function") closeExportMenu();
    closeTemplateMenu();
    renderRecentMenu();
    if (recentMenu) recentMenu.hidden = false;
    if (btnRecentMenu) btnRecentMenu.setAttribute("aria-expanded", "true");
  }
  if (btnRecentMenu && recentMenu) {
    btnRecentMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      if (recentMenu.hidden) openRecentMenu();
      else closeRecentMenu();
    });
    recentMenu.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => closeRecentMenu());
  }
  if (btnRestoreBackup) {
    btnRestoreBackup.addEventListener("click", () => {
      closeRecentMenu();
      const bak = readAutosave();
      if (!bak || !bak.data) {
        statusHint.textContent = "沒有自動備份";
        return;
      }
      applyProjectData(bak.data, { name: bak.name || currentDocName });
      statusHint.textContent = "已還原自動備份";
    });
  }
  if (backupRestoreCancel && backupRestoreDialog) {
    backupRestoreCancel.addEventListener("click", () => backupRestoreDialog.close());
  }
  const backupRestoreForm = document.getElementById("backupRestoreForm");
  if (backupRestoreForm && backupRestoreDialog) {
    backupRestoreForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const bak = readAutosave();
      if (bak && bak.data) {
        applyProjectData(bak.data, { name: bak.name || currentDocName });
        statusHint.textContent = "已還原自動備份";
      }
      backupRestoreDialog.close();
    });
  }
  if (chkGridSnap) {
    chkGridSnap.addEventListener("change", () => {
      // Primary「網格」control: snap + visibility (matches tip_grid / pre-v13.4 UX).
      // Layers「顯示」can still hide without touching snap.
      gridSnap = !!chkGridSnap.checked;
      applyLayersPatch({ gridShow: gridSnap });
    });
  }
  if (gridModeSelect) {
    syncGridModeUI();
    gridModeSelect.addEventListener("change", () => {
      const v = gridModeSelect.value === "triangle" ? "triangle" : "square";
      gridMode = v;
      writeGridModePref(gridMode);
      draw();
      updateStatus();
    });
  }
  if (chkHideExportPoints) {
    chkHideExportPoints.addEventListener("change", () => {
      hideExportPoints = !!chkHideExportPoints.checked;
    });
  }
  if (lengthForm) {
    lengthForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = (lengthInput && lengthInput.value ? lengthInput.value : "").trim() || "6";
      const segId = pendingLengthSeg;
      pendingLengthSeg = null;
      if (lengthDialog) lengthDialog.close();
      if (!segId) return;
      pushHistory();
      const existing = lengthLabels.find((l) => l.segmentId === segId);
      if (existing) existing.text = text;
      else
        lengthLabels.push({
          id: uid(),
          segmentId: segId,
          text,
          side: preferLengthSide(segId),
        });
      history[histIndex] = snapshot();
      const ll = lengthLabels.find((l) => l.segmentId === segId);
      if (ll) setSelection([{ type: "lengthLabel", id: ll.id }]);
      draw();
    });
  }
  if (lengthCancel) {
    lengthCancel.addEventListener("click", () => {
      pendingLengthSeg = null;
      if (lengthDialog) lengthDialog.close();
    });
  }
  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files[0]) {
      loadProject(fileInput.files[0]);
      fileInput.value = "";
    }
  });

  labelForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = (labelInput.value || "").trim() || "A";
    const size = clampLabelSize((labelSizeInput && labelSizeInput.value) || labelFontSize);
    if (pendingLabelPoint) {
      labelFontSize = size;
      if (labelSizeSelect) labelSizeSelect.value = String(labelFontSize);
      const pointId = pendingLabelPoint;
      addLabel(pointId, text, null, null, labelFontSize);
      if (text.length === 1 && text >= "A" && text <= "Z") {
        nextLetter = text;
        bumpLetter();
      }
      const lab = labels.find((l) => l.pointId === pointId);
      setSelection([lab ? { type: "label", id: lab.id } : { type: "point", id: pointId }]);
      pendingLabelPoint = null;
    }
    labelDialog.close();
    draw();
  });
  labelCancel.addEventListener("click", () => {
    pendingLabelPoint = null;
    labelDialog.close();
  });

  function applyArcLabelText(text, { undoable } = { undoable: false }) {
    if (!pendingArcLabelId) return;
    const arcId = pendingArcLabelId;
    const arc = angleArcs.find((a) => a.id === arcId);
    if (arc) {
      const next = String(text || "").trim();
      if ((arc.text || "") !== next) {
        if (undoable) pushHistory();
        arc.text = next;
      }
      setSelection([{ type: "angleArc", id: arcId }]);
    }
    pendingArcLabelId = null;
  }

  let arcLabelEditMode = false; // true when editing an existing arc via double-click

  if (arcLabelForm) {
    arcLabelForm.addEventListener("submit", (e) => {
      e.preventDefault();
      applyArcLabelText(arcLabelInput ? arcLabelInput.value : "", {
        undoable: arcLabelEditMode,
      });
      arcLabelEditMode = false;
      if (arcLabelDialog) arcLabelDialog.close();
      draw();
    });
  }
  if (arcLabelSkip) {
    arcLabelSkip.addEventListener("click", () => {
      applyArcLabelText("", { undoable: arcLabelEditMode });
      arcLabelEditMode = false;
      if (arcLabelDialog) arcLabelDialog.close();
      draw();
    });
  }
  if (arcLabelCancel) {
    arcLabelCancel.addEventListener("click", () => {
      pendingArcLabelId = null;
      arcLabelEditMode = false;
      if (arcLabelDialog) arcLabelDialog.close();
      draw();
    });
  }
  document.querySelectorAll("#greekPicks .greek-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!arcLabelInput) return;
      arcLabelInput.value = btn.dataset.greek || btn.textContent || "";
      arcLabelInput.focus();
    });
  });

  ratioForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = parseRatio(ratioInput.value);
    if (t == null) {
      alert("無法解析比例。請用 1:2、1/3 或 0.5（由第一端點 → 第二端點）。");
      return;
    }
    const seg = segmentById(pendingRatioSeg);
    const labText = (ratioLabelInput.value || "").trim() || nextLetter;
    pendingRatioSeg = null;
    ratioDialog.close();
    if (!seg) return;
    const pos = pointOnSegment(seg, t);
    if (!pos) return;
    pushHistory();
    const pt = findOrCreatePointAt(pos.x, pos.y, true);
    if (!midTicks.some((m) => m.segmentId === seg.id && m.pointId === pt.id)) {
      midTicks.push({ id: uid(), segmentId: seg.id, pointId: pt.id });
    }
    addLabel(pt.id, labText, null, null, labelFontSize, true);
    if (labText.length === 1 && labText >= "A" && labText <= "Z") {
      nextLetter = labText;
      bumpLetter();
    }
    history[histIndex] = snapshot();
    setSelection([{ type: "point", id: pt.id }]);
    draw();
  });

  ratioCancel.addEventListener("click", () => {
    pendingRatioSeg = null;
    ratioDialog.close();
  });

  if (labelSizeSelect) {
    labelSizeSelect.addEventListener("change", () => setLabelFontSize(labelSizeSelect.value));
  }
  if (rightAngleSizeSelect) {
    rightAngleSizeSelect.addEventListener("change", () =>
      setRightAngleSize(rightAngleSizeSelect.value)
    );
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("dblclick", (e) => {
    if (tool === "fill" && draft && draft.kind === "fill") {
      e.preventDefault();
      commitFillDraft();
      return;
    }
    const pos = canvasPos(e);
    const world = screenToWorld(pos.x, pos.y);
    const hit = hitTest(world.x, world.y);
    if (hit && hit.type === "angleArc") {
      const arc = angleArcs.find((a) => a.id === hit.id);
      if (!arc) return;
      setSelection([hit]);
      arcLabelEditMode = true;
      openArcLabelPrompt(arc.id, arc.text || "");
      e.preventDefault();
      return;
    }
    if (hit && hit.type === "coordPlot") {
      setSelection([hit]);
      openCoordDialog(hit.id);
      e.preventDefault();
    }
  });
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", resize);
  canvas.addEventListener("auxclick", (e) => {
    if (e.button === 1) e.preventDefault();
  });

  // Language toggle
  const btnLangZh = document.getElementById("btnLangZh");
  const btnLangEn = document.getElementById("btnLangEn");
  if (btnLangZh) btnLangZh.addEventListener("click", () => setUiLang("zh"));
  if (btnLangEn) btnLangEn.addEventListener("click", () => setUiLang("en"));

  // Coordinate plot dialog
  const coordDialog = document.getElementById("coordDialog");
  const coordForm = document.getElementById("coordForm");
  const coordCancel = document.getElementById("coordCancel");
  const coordAddCurve = document.getElementById("coordAddCurve");
  const coordAddCurveType = document.getElementById("coordAddCurveType");
  if (coordAddCurve) {
    coordAddCurve.addEventListener("click", () => {
      syncCoordDialogCurvesFromDOM();
      const type = (coordAddCurveType && coordAddCurveType.value) || "line";
      coordDialogCurves.push(makeCoordCurve(type));
      renderCoordCurvesList();
    });
  }
  const coordXAngleUnitEl = document.getElementById("coordXAngleUnit");
  if (coordXAngleUnitEl) {
    coordXAngleUnitEl.addEventListener("change", () => {
      // Refresh formula previews; tick style (π vs °) follows unit on apply/draw
      if (coordDialogOpen) {
        syncCoordDialogCurvesFromDOM();
        renderCoordCurvesList();
      }
    });
  }
  const coordAngleAxisEl = document.getElementById("coordAngleAxis");
  if (coordAngleAxisEl) {
    coordAngleAxisEl.addEventListener("change", () => {
      if (coordDialogOpen) handleCoordAngleAxisCheckboxChange();
    });
  }
  if (coordForm) {
    coordForm.addEventListener("submit", (e) => {
      e.preventDefault();
      applyCoordDialog();
      coordDialogOpen = false;
      pendingAngleAxisSaved = null;
      if (coordDialog) coordDialog.close();
      draw();
    });
  }
  if (coordCancel) {
    coordCancel.addEventListener("click", () => {
      pendingCoordEditId = null;
      pendingAngleAxisSaved = null;
      coordDialogCurves = [];
      coordDialogOpen = false;
      if (coordDialog) coordDialog.close();
      draw();
    });
  }

  // ——— Boot ———
  function fitEmptyView() {
    view = {
      x: canvas.clientWidth / 2,
      y: canvas.clientHeight / 2,
      scale: DEFAULT_VIEW_SCALE,
    };
  }

  /** Restore camera from project JSON, or default 2× centered view when missing. */
  function applyLoadedView(saved) {
    if (saved && (saved.scale != null || saved.x != null || saved.y != null)) {
      view = {
        x: saved.x != null ? saved.x : canvas.clientWidth / 2,
        y: saved.y != null ? saved.y : canvas.clientHeight / 2,
        scale: saved.scale != null ? saved.scale : DEFAULT_VIEW_SCALE,
      };
    } else {
      fitEmptyView();
    }
  }

  resize();
  fitEmptyView();
  initHistory();
  syncMarkGroupUI();
  syncSectorModeUI();
  syncFillPresetUI();
  syncFillModeUI();
  syncShapeModeUI();
  syncCirclePartModeUI();
  syncLayersUI();
  document.querySelectorAll("[data-fill-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setFillPreset(btn.dataset.fillKey, true);
    });
  });
  document.querySelectorAll("[data-fill-mode]").forEach((btn) => {
    btn.addEventListener("click", () => setFillMode(btn.dataset.fillMode));
  });
  document.querySelectorAll("[data-shape-mode]").forEach((btn) => {
    btn.addEventListener("click", () => setShapeMode(btn.dataset.shapeMode));
  });
  document.querySelectorAll("[data-circle-part]").forEach((btn) => {
    btn.addEventListener("click", () => setCirclePartMode(btn.dataset.circlePart));
  });
  document.querySelectorAll("[data-align]").forEach((btn) => {
    btn.addEventListener("click", () => runAlignAction(btn.dataset.align));
  });
  document.querySelectorAll("[data-layer-show]").forEach((el) => {
    el.addEventListener("change", () => {
      const k = el.dataset.layerShow;
      if (k === "grid") applyLayersPatch({ gridShow: !!el.checked });
      else if (k === "coords") applyLayersPatch({ coordsShow: !!el.checked });
      else if (k === "helpers") applyLayersPatch({ helpersShow: !!el.checked });
    });
  });
  document.querySelectorAll("[data-layer-lock]").forEach((el) => {
    el.addEventListener("change", () => {
      const k = el.dataset.layerLock;
      if (k === "grid") applyLayersPatch({ gridLock: !!el.checked });
      else if (k === "coords") applyLayersPatch({ coordsLock: !!el.checked });
      else if (k === "helpers") applyLayersPatch({ helpersLock: !!el.checked });
    });
  });
  const btnLayersMenu = document.getElementById("btnLayersMenu");
  const layersMenu = document.getElementById("layersMenu");
  function closeLayersMenu() {
    if (layersMenu) layersMenu.setAttribute("hidden", "");
    if (btnLayersMenu) btnLayersMenu.setAttribute("aria-expanded", "false");
  }
  function openLayersMenu() {
    if (!layersMenu || !btnLayersMenu) return;
    if (typeof closeExportMenu === "function") closeExportMenu();
    if (typeof closeTemplateMenu === "function") closeTemplateMenu();
    if (typeof closeRecentMenu === "function") closeRecentMenu();
    syncLayersUI();
    layersMenu.removeAttribute("hidden");
    btnLayersMenu.setAttribute("aria-expanded", "true");
  }
  if (btnLayersMenu && layersMenu) {
    btnLayersMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      if (layersMenu.hasAttribute("hidden")) openLayersMenu();
      else closeLayersMenu();
    });
    layersMenu.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => closeLayersMenu());
  }
  syncExportCropUI();
  renderRecentMenu();
  applyDarkCanvasClass();
  applyChromeLang();
  updateStatus();
  draw();

  // Autosave every 20s + on hide (never triggers leave-site dialog by itself).
  function maybeAutosave() {
    if (!documentIsEmpty()) writeAutosave();
  }
  autosaveTimer = setInterval(maybeAutosave, 20000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") maybeAutosave();
  });
  window.addEventListener("pagehide", maybeAutosave);
  window.addEventListener("beforeunload", onBeforeUnloadWarn);

  // Offer restore if backup exists and canvas empty
  (function offerBackupRestore() {
    const bak = readAutosave();
    if (!bak || !bak.data || !documentIsEmpty()) return;
    const hasGeom =
      (bak.data.points && bak.data.points.length) ||
      (bak.data.segments && bak.data.segments.length) ||
      (bak.data.circles && bak.data.circles.length);
    if (!hasGeom) return;
    if (backupRestoreNote) {
      const when = bak.savedAt ? new Date(bak.savedAt).toLocaleString() : "";
      backupRestoreNote.textContent =
        "偵測到自動備份" + (when ? "（" + when + "）" : "") + "，是否還原？";
    }
    if (backupRestoreDialog && typeof backupRestoreDialog.showModal === "function") {
      backupRestoreDialog.showModal();
    }
  })();

  // Test/debug hooks (headless capture + fixture load)
  window.__examDiagram = {
    loadData(data) {
      loadProject(new File([JSON.stringify(data)], "f.json", { type: "application/json" }));
    },
    applyData(data) {
      // Synchronous apply (same fields as loadProject) for tests
      points = data.points || [];
      segments = data.segments || [];
      labels = (data.labels || []).map((l) => ({
        ...l,
        size: clampLabelSize(l.size || data.labelFontSize || DEFAULT_LABEL_SIZE),
      }));
      rightAngles = (data.rightAngles || []).map((r) => ({
        ...r,
        size: r.size || data.rightAngleSize || DEFAULT_RA_SIZE,
      }));
      angleArcs = (data.angleArcs || []).map((a) => ({
        ...a,
        size: a.size || data.rightAngleSize || DEFAULT_RA_SIZE,
        group: a.group ? 1 : 0,
        text: a.text || "",
        reflex: !!a.reflex,
      }));
      coordPlots = (data.coordPlots || []).map((p) => normalizeCoordPlot(p) || p);
      midTicks = data.midTicks || [];
      parallelMarks = (data.parallelMarks || []).map((m) => ({
        ...m,
        side: m.side === -1 ? -1 : 1,
      }));
      equalMarks = (data.equalMarks || []).map((m) => ({
        ...m,
        side: m.side === -1 ? -1 : 1,
      }));
      lengthLabels = (data.lengthLabels || []).map((m) => ({
        ...m,
        side: m.side === -1 ? -1 : 1,
      }));
      circles = data.circles || [];
      ellipses = data.ellipses || [];
      sectors = data.sectors || [];
      exportCrop = data.exportCrop || null;
      if (data.sectorMode === "sector" || data.sectorMode === "arc") sectorMode = data.sectorMode;
      nextLetter = data.nextLetter || "A";
      labelFontSize = clampLabelSize(data.labelFontSize || DEFAULT_LABEL_SIZE);
      rightAngleSize = data.rightAngleSize || DEFAULT_RA_SIZE;
      if (data.gridSnap != null) {
        gridSnap = !!data.gridSnap;
        if (chkGridSnap) chkGridSnap.checked = gridSnap;
      }
      if (data.gridMode === "square" || data.gridMode === "triangle") {
        gridMode = data.gridMode;
        syncGridModeUI();
      }
      if (data.hideExportPoints != null) {
        hideExportPoints = !!data.hideExportPoints;
        if (chkHideExportPoints) chkHideExportPoints.checked = hideExportPoints;
      }
      applyLoadedView(data.view);
      setSelection([]);
      draft = null;
      history[histIndex] = snapshot();
      syncSectorModeUI();
      syncExportCropUI();
      updateStatus();
      draw();
      markDocClean();
    },
    buildExportCanvas,
    boundsWorld,
    exportBounds,
    clearExportCrop,
    markTAlong,
    segmentDrawBasis,
    insertBuiltinById,
    isDocDirty,
    markDocClean,
    getView: () => ({ ...view }),
    getGrid: () => ({ gridSnap, gridMode }),
    getPoints: () => points.map((p) => ({ id: p.id, x: p.x, y: p.y })),
    getCircles: () => circles.map((c) => ({ ...c })),
  };
})();
