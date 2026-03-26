(function () {
  "use strict";

  var LABELS = {
    craneWeight: "크레인 자체 중량 (ton)",
    supportPlateWidth: "지지 철판 가로 (m)",
    supportPlateHeight: "지지 철판 세로 (m)",
    loadWeight: "양중 하중 (ton)",
    riggingWeight: "슬링·훅 등 부가 하중 (ton)",
    sectionShapeFactor: "단면형상계수 (k)",
    shackleDiameter: "샤클 직경 (mm)",
    shackleAllowableShear: "샤클 허용전단응력 (MPa)",
    shackleWorkingLoad: "샤클 사용하중 (ton)",
    slingType: "줄걸이 방식",
    slingCount: "줄걸이 수 (ea)",
    slingAngle: "줄걸이 각도 (도)",
    breakingLoad: "파단 하중 (kN)",
    hitchMethod: "메다는 방법"
  };

  var SLING_TYPE = { "wire-rope": "와이어 로프", "sling-belt": "슬링 벨트" };
  var HITCH_METHOD = { straight: "곧게", choker: "초크", basket: "바구니" };
  var GROUND_BEARING_LABELS = {
    "direct": "직접입력",
    "hard-rock": "경암반",
    "soft-rock-a": "연암반(판암, 편암 등 수성암)",
    "soft-rock-b": "연암반(혈암, 토단반 등)",
    "gravel": "자갈",
    "gravel-sand": "자갈+모래",
    "sand-clay": "모래+점토 또는 롬토",
    "sand-loam": "모래 또는 롬토"
  };
  var GROUND_BEARING_VALUES = {
    "hard-rock": 6000,
    "soft-rock-a": 3000,
    "soft-rock-b": 1500,
    "gravel": 450,
    "gravel-sand": 300,
    "sand-clay": 225,
    "sand-loam": 150
  };

  function getDisplayValue(key, value) {
    if (value === undefined || value === null || String(value).trim() === "") return "—";
    if (key === "slingType") return SLING_TYPE[value] || value;
    if (key === "hitchMethod") return HITCH_METHOD[value] || value;
    return value;
  }

  var order = [
    "craneWeight", "loadWeight", "riggingWeight", "supportPlateWidth", "supportPlateHeight",
    "sectionShapeFactor", "shackleDiameter", "shackleAllowableShear", "shackleWorkingLoad",
    "slingType", "slingCount", "slingAngle", "breakingLoad", "hitchMethod"
  ];

  var summaryEl = document.getElementById("input-summary");
  var sectionEl = document.getElementById("input-summary-section");
  if (!summaryEl) return;

  var raw;
  try {
    raw = localStorage.getItem("craneInputData");
    if (!raw) raw = sessionStorage.getItem("craneInputData");
  } catch (e) {}
  var data = raw ? JSON.parse(raw) : {};

  if (Object.keys(data).length === 0) {
    sectionEl.innerHTML = "<p class=\"result-placeholder\">저장된 입력값이 없습니다. <a href=\"index.html\">입력 페이지</a>에서 먼저 값을 입력하세요.</p>";
    return;
  }

  order.forEach(function (key) {
    if (!data.hasOwnProperty(key)) return;
    if (key === "hitchMethod" && data.slingType !== "sling-belt") return;
    var row = document.createElement("div");
    row.className = "summary-row";
    row.innerHTML = "<span class=\"label\">" + (LABELS[key] || key) + "</span><span class=\"value\">" + getDisplayValue(key, data[key]) + "</span>";
    summaryEl.appendChild(row);
  });

  var groundBearingType = data.groundBearing || "";
  var groundBearingVal;
  if (groundBearingType === "direct" && data.groundBearingDirect != null && String(data.groundBearingDirect).trim() !== "") {
    groundBearingVal = parseFloat(data.groundBearingDirect) || 0;
  } else {
    groundBearingVal = GROUND_BEARING_VALUES[groundBearingType] != null ? GROUND_BEARING_VALUES[groundBearingType] : 0;
  }
  var groundBearingLabel = GROUND_BEARING_LABELS[groundBearingType] || groundBearingType || "—";
  var groundBearingDisplay = groundBearingVal > 0
    ? groundBearingLabel + " · " + groundBearingVal.toLocaleString() + " kN/m²"
    : (groundBearingLabel !== "—" ? groundBearingLabel : "—");
  var gbRow = document.createElement("div");
  gbRow.className = "summary-row";
  gbRow.innerHTML = "<span class=\"label\">지반 지지력</span><span class=\"value\">" + groundBearingDisplay + "</span>";
  summaryEl.appendChild(gbRow);

  var cw = parseFloat(data.craneWeight) || 0;
  var lw = parseFloat(data.loadWeight) || 0;
  var rw = parseFloat(data.riggingWeight) || 0;
  var sumTon = cw + lw + rw;
  var pmaxKN = 0.85 * sumTon * 1.3 * 0.5 * 1.5 * 9.81;
  var pmaxEl = document.getElementById("outrigger-pmax-value");
  if (pmaxEl) pmaxEl.textContent = sumTon === 0 ? "—" : pmaxKN.toFixed(2);

  var plateW = parseFloat(data.supportPlateWidth) || 0;
  var plateH = parseFloat(data.supportPlateHeight) || 0;
  var area = plateW * plateH;
  var qKNm2 = area > 0 ? pmaxKN / area : 0;
  var qEl = document.getElementById("outrigger-q-value");
  if (qEl) qEl.textContent = area <= 0 ? "—" : qKNm2.toFixed(2);

  var groundBearingEl = document.getElementById("ground-bearing-value");
  if (groundBearingEl) groundBearingEl.textContent = groundBearingVal === 0 ? "—" : groundBearingVal.toLocaleString();

  var resultEl = document.getElementById("bearing-result-label");
  if (resultEl) {
    if (qKNm2 <= 0 || groundBearingVal <= 0) {
      resultEl.textContent = "";
      resultEl.className = "bearing-result";
    } else {
      resultEl.textContent = groundBearingVal >= qKNm2 ? "적합" : "부적합";
      resultEl.className = "bearing-result " + (groundBearingVal >= qKNm2 ? "bearing-ok" : "bearing-ng");
    }
  }

  /** 인양고리 안정성 검토 (샤클 전단) */
  var loadW = parseFloat(data.loadWeight) || 0;
  var slingCnt = Math.max(1, parseInt(data.slingCount, 10) || 1);
  var shackleV = (loadW * 9.81 * 1.3) / slingCnt;
  var k = parseFloat(data.sectionShapeFactor) || 0;
  var d = parseFloat(data.shackleDiameter) || 0;
  var areaShackle = d > 0 ? (d * d * Math.PI / 4) : 0;
  var tauMpa = (areaShackle > 0 && k > 0) ? (k * shackleV * 1000 / areaShackle) : 0;
  var shackleAllowable = parseFloat(data.shackleAllowableShear) || 0;

  var shackleVEl = document.getElementById("shackle-v-value");
  var shackleTauEl = document.getElementById("shackle-tau-value");
  var shackleAllowableEl = document.getElementById("shackle-allowable-value");
  var shackleResultEl = document.getElementById("shackle-result-label");
  if (shackleVEl) shackleVEl.textContent = shackleV.toFixed(2);
  if (shackleTauEl) shackleTauEl.textContent = tauMpa > 0 ? tauMpa.toFixed(2) : "—";
  if (shackleAllowableEl) shackleAllowableEl.textContent = shackleAllowable > 0 ? shackleAllowable.toFixed(2) : "—";
  if (shackleResultEl) {
    if (tauMpa <= 0 || shackleAllowable <= 0) {
      shackleResultEl.textContent = "";
      shackleResultEl.className = "bearing-result";
    } else {
      shackleResultEl.textContent = tauMpa < shackleAllowable ? "적합" : "부적합";
      shackleResultEl.className = "bearing-result " + (tauMpa < shackleAllowable ? "bearing-ok" : "bearing-ng");
    }
  }

  /** 샤클 사용하중 검토: 사용하중(kN) = 인양물중량×9.81×하중계수/줄걸이수, 적합 = 사용하중 < 샤클사용하중×9.8 */
  var slingAngleDeg = parseFloat(data.slingAngle) || 0;
  var loadFactorAngles = [0, 10, 20, 30, 40, 50, 60];
  var loadFactorValues = [1, 1, 1.01, 1.035, 1.065, 1.103, 1.155];
  function getLoadFactor(angle, count) {
    if (count >= 3) return angle <= 40 ? 1.43 : 2;
    angle = Math.max(0, Math.min(60, angle));
    var i = 0;
    while (i < loadFactorAngles.length - 1 && loadFactorAngles[i + 1] <= angle) i++;
    if (i >= loadFactorAngles.length - 1) return loadFactorValues[loadFactorValues.length - 1];
    var a0 = loadFactorAngles[i], a1 = loadFactorAngles[i + 1];
    var v0 = loadFactorValues[i], v1 = loadFactorValues[i + 1];
    return v0 + (v1 - v0) * (angle - a0) / (a1 - a0);
  }
  var loadFactorShackle = getLoadFactor(slingAngleDeg, slingCnt);
  var workingLoadKN = (loadW * 9.81 * loadFactorShackle) / slingCnt;
  var shackleWorkingTon = parseFloat(data.shackleWorkingLoad) || 0;
  var workingAllowableKN = shackleWorkingTon * 9.8;

  var workingCalcEl = document.getElementById("shackle-working-load-calc");
  var workingAllowableEl = document.getElementById("shackle-working-allowable");
  var workingResultEl = document.getElementById("shackle-working-result-label");
  if (workingCalcEl) workingCalcEl.textContent = workingLoadKN.toFixed(2);
  if (workingAllowableEl) workingAllowableEl.textContent = workingAllowableKN > 0 ? workingAllowableKN.toFixed(2) : "—";
  if (workingResultEl) {
    if (workingAllowableKN <= 0) {
      workingResultEl.textContent = "";
      workingResultEl.className = "bearing-result";
    } else {
      workingResultEl.textContent = workingLoadKN < workingAllowableKN ? "적합" : "부적합";
      workingResultEl.className = "bearing-result " + (workingLoadKN < workingAllowableKN ? "bearing-ok" : "bearing-ng");
    }
  }

  /** 줄걸이 안정성 검토 (와이어 로프 / 슬링 벨트) */
  var slingBlock = document.getElementById("sling-stability-block");
  var slingType = data.slingType || "";
  var formulaWire = document.getElementById("sling-formula-wire");
  var formulaBelt = document.getElementById("sling-formula-belt");
  var allowableNameEl = document.getElementById("sling-allowable-name");
  var vEl = document.getElementById("sling-v-value");
  var allowableValueEl = document.getElementById("sling-allowable-value");
  var slingResultEl = document.getElementById("sling-result-label");

  if (slingBlock && (slingType === "wire-rope" || slingType === "sling-belt")) {
    slingBlock.classList.remove("hidden");
    var loadWeightTon = parseFloat(data.loadWeight) || 0;
    var slingCount = Math.max(1, parseInt(data.slingCount, 10) || 1);
    var slingAngleDeg = parseFloat(data.slingAngle) || 0;
    var breakingLoadKN = parseFloat(data.breakingLoad) || 0;
    var V, allowable;

    if (slingType === "wire-rope") {
      if (formulaWire) formulaWire.classList.remove("hidden");
      if (formulaBelt) formulaBelt.classList.add("hidden");
      if (allowableNameEl) allowableNameEl.textContent = "FN";

      var loadFactorAngles = [0, 10, 20, 30, 40, 50, 60];
      var loadFactorValues = [1, 1, 1.01, 1.035, 1.065, 1.103, 1.155];
      function getLoadFactor(angle, count) {
        if (count >= 3) return angle <= 40 ? 1.43 : 2;
        angle = Math.max(0, Math.min(60, angle));
        var i = 0;
        while (i < loadFactorAngles.length - 1 && loadFactorAngles[i + 1] <= angle) i++;
        if (i >= loadFactorAngles.length - 1) return loadFactorValues[loadFactorValues.length - 1];
        var a0 = loadFactorAngles[i], a1 = loadFactorAngles[i + 1];
        var v0 = loadFactorValues[i], v1 = loadFactorValues[i + 1];
        return v0 + (v1 - v0) * (angle - a0) / (a1 - a0);
      }
      var loadFactor = getLoadFactor(slingAngleDeg, slingCount);
      V = (loadWeightTon * 9.81 * 1.3) / slingCount;
      allowable = breakingLoadKN / 7 / (loadFactor > 0 ? loadFactor : 1);
    } else {
      if (formulaWire) formulaWire.classList.add("hidden");
      if (formulaBelt) formulaBelt.classList.remove("hidden");
      if (allowableNameEl) allowableNameEl.textContent = "FT";

      var hitchMult = { straight: 1, choker: 0.8, basket: 2 };
      var hitch = data.hitchMethod || "straight";
      var hitchFactor = hitchMult[hitch] != null ? hitchMult[hitch] : 1;
      var strands = Math.min(slingCount, 3);
      var angleHalfRad = (slingAngleDeg / 2) * Math.PI / 180;
      var modeFactor = strands * hitchFactor * Math.cos(angleHalfRad);
      modeFactor = Math.max(0.001, modeFactor);
      V = loadWeightTon * 9.81 * 1.3;
      allowable = (breakingLoadKN / 7) * modeFactor;
    }

    if (vEl) vEl.textContent = V.toFixed(2);
    if (allowableValueEl) allowableValueEl.textContent = allowable.toFixed(2);
    if (slingResultEl) {
      slingResultEl.textContent = V < allowable ? "적합" : "부적합";
      slingResultEl.className = "bearing-result " + (V < allowable ? "bearing-ok" : "bearing-ng");
    }
  } else if (slingBlock) {
    slingBlock.classList.add("hidden");
  }
})();
