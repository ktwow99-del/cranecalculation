(function () {
  "use strict";

  var form = document.getElementById("stability-form");
  var resultSection = document.getElementById("result-section");
  var overturningEl = document.getElementById("overturning-moment");
  var restoringEl = document.getElementById("restoring-moment");
  var safetyEl = document.getElementById("safety-factor");
  var messageEl = document.getElementById("result-message");

  if (!form) return;

  /**
   * 풍압 q = 0.5 * rho * v^2 (N/m²), rho ≈ 1.25
   * 풍하중 F = q * A (N) → ton 단위로 변환 (÷ 1000 ÷ 9.81)
   * 풍하중이 붐 선단 등에 작용한다고 가정 시 전복 모멘트에 기여
   */
  function windForceTon(windSpeedMs, areaM2) {
    if (!windSpeedMs || !areaM2) return 0;
    var rho = 1.25;
    var q = 0.5 * rho * windSpeedMs * windSpeedMs; // N/m²
    var Fn = q * areaM2; // N
    return Fn / 1000 / 9.81; // ton
  }

  function runStabilityReview() {
    var craneWeight = parseFloat(form.craneWeight.value) || 0;
    var supportPlateWidth = parseFloat(form.supportPlateWidth.value) || 0;
    var supportPlateHeight = parseFloat(form.supportPlateHeight.value) || 0;
    var boomLength = form.boomLength ? parseFloat(form.boomLength.value) || 0 : 0;
    var radius = form.radius ? parseFloat(form.radius.value) || 0 : 0;
    var loadWeight = parseFloat(form.loadWeight.value) || 0;
    var riggingWeight = parseFloat(form.riggingWeight.value) || 0;
    var windSpeed = form.windSpeed ? parseFloat(form.windSpeed.value) || 0 : 0;
    var windArea = form.windArea ? parseFloat(form.windArea.value) || 0 : 0;

    // 전복 지점까지 거리: 지지 철판 중심에서 가장 가까운 변까지 (보수적으로 짧은 쪽의 1/2)
    var fulcrumDistance = Math.min(supportPlateWidth, supportPlateHeight) / 2;

    var totalLoad = loadWeight + riggingWeight;
    // 전복 모멘트: 하중에 의한 모멘트 + 풍하중을 붐 선단에 작용한다고 가정한 모멘트
    var windLoadTon = windForceTon(windSpeed, windArea);
    var momentOverturning = totalLoad * radius + windLoadTon * boomLength;
    // 복원 모멘트: 크레인 자중 × 전복 지점까지 거리
    var momentRestoring = craneWeight * fulcrumDistance;
    var safetyFactor = momentRestoring > 0 ? momentRestoring / momentOverturning : 0;

    overturningEl.textContent = momentOverturning.toFixed(2);
    restoringEl.textContent = momentRestoring.toFixed(2);
    safetyEl.textContent = safetyFactor.toFixed(2);

    messageEl.textContent = "";
    messageEl.className = "result-message";

    if (momentOverturning <= 0) {
      messageEl.textContent = "전복 모멘트가 0 이하입니다. 입력값을 확인하세요.";
      messageEl.classList.add("warning");
    } else if (safetyFactor >= 1.5) {
      messageEl.textContent = "안정율 " + safetyFactor.toFixed(2) + " ≥ 1.5 — 전도 안정성 충족 (권장 기준).";
      messageEl.classList.add("success");
    } else if (safetyFactor >= 1.25) {
      messageEl.textContent = "안정율 " + safetyFactor.toFixed(2) + " — 전도에 대한 여유는 있으나, 1.5 이상을 권장합니다.";
      messageEl.classList.add("warning");
    } else {
      messageEl.textContent = "안정율 " + safetyFactor.toFixed(2) + " < 1.25 — 전도 위험. 하중·반경·풍하중을 줄이거나 크레인 배치를 재검토하세요.";
      messageEl.classList.add("danger");
    }

    resultSection.classList.remove("hidden");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = {};
    var i, el;
    for (i = 0; i < form.elements.length; i++) {
      el = form.elements[i];
      if (el.name && el.name.length > 0) data[el.name] = el.value;
    }
    try {
      localStorage.setItem("craneInputData", JSON.stringify(data));
    } catch (err) {}
    window.location.href = "calculation.html";
  });

  form.addEventListener("reset", function () {
    resultSection.classList.add("hidden");
    messageEl.textContent = "";
    messageEl.className = "result-message";
    toggleSlingHitch();
    setTimeout(toggleGroundBearingDirect, 0);
  });

  /** 줄걸이 방식에 따라 '메다는 방법' 표시/숨김 */
  function toggleSlingHitch() {
    var slingType = document.getElementById("sling-type");
    var hitchWrap = document.getElementById("sling-hitch-wrap");
    if (!slingType || !hitchWrap) return;
    if (slingType.value === "sling-belt") {
      hitchWrap.classList.remove("hidden");
    } else {
      hitchWrap.classList.add("hidden");
    }
  }

  var slingTypeEl = document.getElementById("sling-type");
  if (slingTypeEl) {
    slingTypeEl.addEventListener("change", toggleSlingHitch);
    toggleSlingHitch();
  }

  /** 지반 지지력 '직접입력' 선택 시 입력란 표시 */
  function toggleGroundBearingDirect() {
    var groundBearing = document.getElementById("ground-bearing");
    var directWrap = document.getElementById("ground-bearing-direct-wrap");
    if (!groundBearing || !directWrap) return;
    if (groundBearing.value === "direct") {
      directWrap.classList.remove("hidden");
    } else {
      directWrap.classList.add("hidden");
    }
  }
  var groundBearingEl = document.getElementById("ground-bearing");
  if (groundBearingEl) {
    groundBearingEl.addEventListener("change", toggleGroundBearingDirect);
    toggleGroundBearingDirect();
  }

  /** 메다는 방법 커스텀 드롭다운 (곧게 옵션에 이미지 표시) */
  (function () {
    var selectEl = document.getElementById("hitch-method-select");
    var triggerContent = selectEl && selectEl.querySelector(".custom-select-trigger-content");
    var hiddenInput = document.getElementById("hitch-method-value");
    var listbox = document.getElementById("hitch-method-listbox");
    var options = listbox && listbox.querySelectorAll(".custom-select-option");
    var labels = { straight: "곧게", choker: "초크", basket: "바구니" };
    var straightImg = "<img src=\"assets/sling-straight.png\" alt=\"\" class=\"hitch-option-img hitch-option-img--trigger\" width=\"24\" height=\"28\">";
    var chokerImg = "<img src=\"assets/sling-choker.png\" alt=\"\" class=\"hitch-option-img hitch-option-img--trigger\" width=\"24\" height=\"28\">";
    var basketImg = "<img src=\"assets/sling-basket.png\" alt=\"\" class=\"hitch-option-img hitch-option-img--trigger\" width=\"24\" height=\"28\">";

    function setTrigger(value) {
      if (!triggerContent || !hiddenInput) return;
      hiddenInput.value = value;
      if (value === "straight") {
        triggerContent.innerHTML = straightImg + "<span>" + labels[value] + "</span>";
      } else if (value === "choker") {
        triggerContent.innerHTML = chokerImg + "<span>" + labels[value] + "</span>";
      } else if (value === "basket") {
        triggerContent.innerHTML = basketImg + "<span>" + labels[value] + "</span>";
      } else {
        triggerContent.innerHTML = "<span>" + (labels[value] || value) + "</span>";
      }
      if (options) {
        options.forEach(function (opt) {
          opt.setAttribute("aria-selected", opt.getAttribute("data-value") === value ? "true" : "false");
        });
      }
    }

    function close() {
      if (selectEl) selectEl.classList.remove("open");
      selectEl.setAttribute("aria-expanded", "false");
    }

    if (selectEl && triggerContent && listbox) {
      selectEl.querySelector(".custom-select-trigger").addEventListener("click", function (e) {
        e.stopPropagation();
        var isOpen = selectEl.classList.toggle("open");
        selectEl.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });

      options.forEach(function (opt) {
        opt.addEventListener("click", function (e) {
          e.stopPropagation();
          var val = opt.getAttribute("data-value");
          setTrigger(val);
          close();
        });
      });

      document.addEventListener("click", function () { close(); });
      selectEl.addEventListener("keydown", function (e) {
        if (e.key === "Escape") close();
      });
    }
  })();
})();
