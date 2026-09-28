/**
 * Kisan Web Project - AI Crop Leaf Disease Diagnostic Tool
 *
 * Handles:
 * - Image selection
 * - Drag and drop
 * - Image preview
 * - Crop / plant selection
 * - Custom crop name when "Other" is selected
 * - AI disease diagnosis request
 * - Gemini API result display
 * - Sample image testing
 * - YouTube tutorial display
 * - Error handling
 */

(function () {
  "use strict";

  // ============================================================
  // STATE
  // ============================================================

  let selectedFile = null;
  let selectedCropName = null;

  const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16 MB

  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function initAIDiagnostics() {
    const dropzone = document.getElementById("ai-scanner-box");
    const fileInput = document.getElementById("ai-file-input");
    const analyzeBtn = document.getElementById("ai-analyze-btn");

    const cropSelector =
      document.getElementById("ai-crop-selector");

    const customCropWrapper =
      document.getElementById("ai-custom-crop-wrapper");

    const customCropInput =
      document.getElementById("ai-custom-crop-input");

    if (!dropzone) {
      console.error(
        "[AI Diagnostics] Element #ai-scanner-box was not found."
      );
      return;
    }

    if (!fileInput) {
      console.error(
        "[AI Diagnostics] Element #ai-file-input was not found."
      );
      return;
    }

    console.log("[AI Diagnostics] Initialized successfully.");

    // ----------------------------------------------------------
    // Crop selector
    // ----------------------------------------------------------

    if (cropSelector) {
      cropSelector.addEventListener("change", () => {
        const isOther = cropSelector.value === "Other";

        if (customCropWrapper) {
          customCropWrapper.classList.toggle(
            "hidden",
            !isOther
          );
        }

        if (isOther) {
          selectedCropName = null;

          if (customCropInput) {
            customCropInput.focus();
          }
        } else {
          selectedCropName =
            cropSelector.value || null;

          if (customCropInput) {
            customCropInput.value = "";
          }
        }
      });
    }

    // ----------------------------------------------------------
    // Custom crop input
    // ----------------------------------------------------------

    if (customCropInput) {
      customCropInput.addEventListener("input", () => {
        if (cropSelector?.value === "Other") {
          selectedCropName =
            customCropInput.value.trim() || null;
        }
      });
    }

    // ----------------------------------------------------------
    // Drag enter / drag over
    // ----------------------------------------------------------

    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();

        dropzone.classList.add(
          "border-emerald-400",
          "bg-emerald-950/30"
        );
      });
    });

    // ----------------------------------------------------------
    // Drag leave
    // ----------------------------------------------------------

    dropzone.addEventListener("dragleave", (event) => {
      event.preventDefault();
      event.stopPropagation();

      dropzone.classList.remove(
        "border-emerald-400",
        "bg-emerald-950/30"
      );
    });

    // ----------------------------------------------------------
    // Drop image
    // ----------------------------------------------------------

    dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();

      dropzone.classList.remove(
        "border-emerald-400",
        "bg-emerald-950/30"
      );

      const files = event.dataTransfer?.files;

      if (!files || files.length === 0) {
        return;
      }

      handleFileSelection(files[0]);
    });

    // ----------------------------------------------------------
    // File input change
    // ----------------------------------------------------------

    fileInput.addEventListener("change", (event) => {
      const files = event.target.files;

      if (!files || files.length === 0) {
        return;
      }

      handleFileSelection(files[0]);
    });

    // ----------------------------------------------------------
    // Analyze button
    // ----------------------------------------------------------

    if (analyzeBtn) {
      analyzeBtn.addEventListener("click", () => {
        if (!selectedFile) {
          showToast(
            "Please select or drag-and-drop a crop leaf image first.",
            "warning"
          );
          return;
        }

        const resolvedCropName =
          getSelectedCropName();

        if (!resolvedCropName) {
          showToast(
            "Please select the crop or plant type before analysis.",
            "warning"
          );
          return;
        }

        performScanAnalysis(
          selectedFile,
          resolvedCropName
        );
      });
    }

    // ----------------------------------------------------------
    // Sample image buttons
    // ----------------------------------------------------------

    const sampleButtons =
      document.querySelectorAll(".ai-sample-btn");

    sampleButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const sampleUrl = button.dataset.url;

        const cropName =
          button.dataset.crop || "Unknown";

        const originalText = button.textContent;

        try {
          button.disabled = true;
          button.textContent = "Loading sample...";

          const response = await fetch(sampleUrl);

          if (!response.ok) {
            throw new Error(
              `Could not load sample image: HTTP ${response.status}`
            );
          }

          const blob = await response.blob();

          const file = new File(
            [blob],
            `sample_${cropName
              .toLowerCase()
              .replace(/\s+/g, "_")}.jpg`,
            {
              type: blob.type || "image/jpeg",
            }
          );

          // Synchronize crop selector with sample crop
          const cropSelector =
            document.getElementById(
              "ai-crop-selector"
            );

          const customCropWrapper =
            document.getElementById(
              "ai-custom-crop-wrapper"
            );

          const customCropInput =
            document.getElementById(
              "ai-custom-crop-input"
            );

          if (cropSelector) {
            const matchingOption =
              Array.from(
                cropSelector.options
              ).some(
                (option) =>
                  option.value === cropName
              );

            if (matchingOption) {
              cropSelector.value = cropName;

              if (customCropWrapper) {
                customCropWrapper.classList.add(
                  "hidden"
                );
              }

              if (customCropInput) {
                customCropInput.value = "";
              }
            }
          }

          selectedCropName = cropName;

          const loaded = handleFileSelection(
            file,
            cropName
          );

          if (loaded) {
            await performScanAnalysis(
              file,
              cropName
            );
          }
        } catch (error) {
          console.error(
            "[AI Diagnostics] Sample load error:",
            error
          );

          showToast(
            "Unable to load the sample image.",
            "error"
          );
        } finally {
          button.disabled = false;
          button.textContent = originalText;
        }
      });
    });
  }

  // ============================================================
  // CROP NAME RESOLUTION
  // ============================================================

  function getSelectedCropName() {
    const cropSelector =
      document.getElementById(
        "ai-crop-selector"
      );

    const customCropInput =
      document.getElementById(
        "ai-custom-crop-input"
      );

    /*
     * If the HTML does not contain the crop selector,
     * fall back to the crop name already stored in state.
     */
    if (!cropSelector) {
      return selectedCropName || null;
    }

    const selectedValue =
      cropSelector.value?.trim();

    /*
     * No crop has been selected.
     */
    if (!selectedValue) {
      return selectedCropName || null;
    }

    /*
     * If "Other" is selected, use whatever the user
     * typed into the custom crop input.
     */
    if (selectedValue === "Other") {
      const customValue =
        customCropInput?.value?.trim();

      return customValue || null;
    }

    /*
     * Otherwise return the crop selected from
     * the dropdown.
     */
    return selectedValue;
  }

  // ============================================================
  // IMAGE SELECTION
  // ============================================================

  function handleFileSelection(
    file,
    cropName = null
  ) {
    if (!file) {
      showToast(
        "No image was selected.",
        "warning"
      );
      return false;
    }

    // ----------------------------------------------------------
    // Validate type
    // ----------------------------------------------------------

    if (
      !file.type.startsWith("image/") ||
      (
        file.type &&
        !ALLOWED_TYPES.includes(file.type)
      )
    ) {
      showToast(
        "Please upload a PNG, JPG, JPEG or WEBP image.",
        "error"
      );

      resetFileInput();

      return false;
    }

    // ----------------------------------------------------------
    // Validate file size
    // ----------------------------------------------------------

    if (file.size > MAX_FILE_SIZE) {
      showToast(
        "Image is too large. Maximum file size is 16MB.",
        "error"
      );

      resetFileInput();

      return false;
    }

    selectedFile = file;

    selectedCropName =
      cropName ||
      getSelectedCropName() ||
      null;

    console.log(
      "[AI Diagnostics] Selected:",
      {
        name: file.name,
        type: file.type,
        size: file.size,
        crop: selectedCropName,
      }
    );

    // ----------------------------------------------------------
    // UI references
    // ----------------------------------------------------------

    const previewContainer =
      document.getElementById(
        "ai-preview-container"
      );

    const previewImg =
      document.getElementById(
        "ai-preview-img"
      );

    const dropzonePlaceholder =
      document.getElementById(
        "ai-dropzone-placeholder"
      );

    const analyzeBtn =
      document.getElementById(
        "ai-analyze-btn"
      );

    const scanStatus =
      document.getElementById(
        "ai-scan-status"
      );

    const resultCard =
      document.getElementById(
        "ai-result-card"
      );

    const videoSection =
      document.getElementById(
        "diag-video-section"
      );

    const videoIframe =
      document.getElementById(
        "diag-youtube-iframe"
      );

    // Hide previous result
    if (resultCard) {
      resultCard.classList.add("hidden");
    }

    // Hide previous video
    if (videoSection) {
      videoSection.classList.add("hidden");
    }

    if (videoIframe) {
      videoIframe.src = "";
    }

    // Reset AI Assessment area for the next image
    const assessmentPanel =
      document.getElementById(
        "diag-assessment-panel"
      );

    const cropMismatchWarning =
      document.getElementById(
        "diag-crop-mismatch-warning"
      );

    const uncertainWarning =
      document.getElementById(
        "diag-uncertain-warning"
      );

    if (assessmentPanel) {
      assessmentPanel.classList.add(
        "hidden"
      );
    }

    if (cropMismatchWarning) {
      cropMismatchWarning.classList.add(
        "hidden"
      );
    }

    if (uncertainWarning) {
      uncertainWarning.classList.add(
        "hidden"
      );
    }

    // ----------------------------------------------------------
    // Generate image preview
    // ----------------------------------------------------------

    const reader = new FileReader();

    reader.onload = (event) => {
      if (previewImg) {
        previewImg.src =
          event.target.result;
      }

      if (previewContainer) {
        previewContainer.classList.remove(
          "hidden"
        );
      }

      if (dropzonePlaceholder) {
        dropzonePlaceholder.classList.add(
          "hidden"
        );
      }

      if (scanStatus) {
        scanStatus.textContent =
          "Specimen Loaded • Ready to Scan";
      }

      if (analyzeBtn) {
        analyzeBtn.disabled = false;

        analyzeBtn.classList.remove(
          "opacity-50",
          "cursor-not-allowed"
        );

        analyzeBtn.innerHTML = `
          <i data-lucide="cpu" class="w-4 h-4"></i>
          <span>Analyze Leaf Specimen</span>
        `;

        refreshLucideIcons();
      }
    };

    reader.onerror = () => {
      showToast(
        "Unable to preview the selected image.",
        "error"
      );
    };

    reader.readAsDataURL(file);

    return true;
  }

  // ============================================================
  // SEND IMAGE TO AI BACKEND
  // ============================================================

  async function performScanAnalysis(
    file,
    cropName = null
  ) {
    const scannerBox =
      document.getElementById(
        "ai-scanner-box"
      );

    const analyzeBtn =
      document.getElementById(
        "ai-analyze-btn"
      );

    const scanStatus =
      document.getElementById(
        "ai-scan-status"
      );

    if (!file) {
      showToast(
        "Please choose a leaf image first.",
        "warning"
      );
      return;
    }

    // ----------------------------------------------------------
    // Resolve crop before starting analysis
    // ----------------------------------------------------------

    const resolvedCropName =
      cropName ||
      getSelectedCropName();

    if (!resolvedCropName) {
      if (scanStatus) {
        scanStatus.textContent =
          "Select Crop / Plant Type Before Analysis";
      }

      showToast(
        "Please select the crop or plant type before analysis.",
        "warning"
      );

      return;
    }

    selectedCropName =
      resolvedCropName;

    // ----------------------------------------------------------
    // Start scanning UI
    // ----------------------------------------------------------

    if (scannerBox) {
      scannerBox.classList.add(
        "scanning"
      );
    }

    if (analyzeBtn) {
      analyzeBtn.disabled = true;

      analyzeBtn.classList.add(
        "opacity-70",
        "cursor-wait"
      );

      analyzeBtn.innerHTML = `
        <svg
          class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>

          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373
               0 0 5.373 0 12h4zm2
               5.291A7.962 7.962 0
               014 12H0c0 3.042 1.135
               5.824 3 7.938l3-2.647z"
          ></path>
        </svg>

        Analyzing with AI...
      `;
    }

    if (scanStatus) {
      scanStatus.textContent =
        `AI is examining ${resolvedCropName} leaf patterns and symptoms...`;
    }

    // ----------------------------------------------------------
    // Prepare multipart/form-data
    // ----------------------------------------------------------

    const formData =
      new FormData();

    formData.append(
      "image",
      file,
      file.name
    );

    formData.append(
      "crop_name",
      resolvedCropName
    );

    try {
      console.log(
        "[AI Diagnostics] Sending image to /api/ai/diagnose...",
        {
          crop_name: resolvedCropName,
          file_name: file.name,
        }
      );

      const response = await fetch(
        "/api/ai/diagnose",
        {
          method: "POST",
          body: formData,
        }
      );

      // --------------------------------------------------------
      // Read API response safely
      // --------------------------------------------------------

      let data;

      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error(
          `Server returned an invalid response (HTTP ${response.status}).`
        );
      }

      console.log(
        "[AI Diagnostics] API response:",
        data
      );

      // --------------------------------------------------------
      // Handle HTTP/API error
      // --------------------------------------------------------

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.details ||
            `Diagnosis failed with HTTP ${response.status}.`
        );
      }

      if (
        data.status &&
        data.status !== "success"
      ) {
        throw new Error(
          data.error ||
            "AI diagnosis failed."
        );
      }

      // --------------------------------------------------------
      // Show successful result
      // --------------------------------------------------------

      finishScanUI();

      if (scanStatus) {
        scanStatus.textContent =
          "Diagnostic Complete";
      }

      /*
       * Keep a short scanning effect before
       * displaying the result.
       */
      setTimeout(() => {
        renderDiagnosticReport(data);
      }, 500);
    } catch (error) {
      console.error(
        "[AI Diagnostics] Diagnostic error:",
        error
      );

      finishScanUI();

      if (scanStatus) {
        scanStatus.textContent =
          "Analysis Failed • Please Try Again";
      }

      showToast(
        error.message ||
          "Unable to analyze the leaf. Please try again.",
        "error"
      );
    }
  }

  // ============================================================
  // FINISH / RESET SCANNING UI
  // ============================================================

  function finishScanUI() {
    const scannerBox =
      document.getElementById(
        "ai-scanner-box"
      );

    const analyzeBtn =
      document.getElementById(
        "ai-analyze-btn"
      );

    if (scannerBox) {
      scannerBox.classList.remove(
        "scanning"
      );
    }

    if (analyzeBtn) {
      analyzeBtn.disabled = false;

      analyzeBtn.classList.remove(
        "opacity-70",
        "cursor-wait"
      );

      analyzeBtn.classList.remove(
        "opacity-50",
        "cursor-not-allowed"
      );

      analyzeBtn.innerHTML = `
        <i data-lucide="scan-line" class="w-4 h-4"></i>
        <span>Scan Another Specimen</span>
      `;

      refreshLucideIcons();
    }
  }

  // ============================================================
  // DISPLAY DIAGNOSTIC RESULT
  // ============================================================

  function renderDiagnosticReport(data) {
    const resultCard =
      document.getElementById(
        "ai-result-card"
      );

    if (!resultCard) {
      console.error(
        "[AI Diagnostics] Result card not found."
      );
      return;
    }

    const diseaseNameEl =
      document.getElementById(
        "diag-disease-name"
      );

    const cropNameEl =
      document.getElementById(
        "diag-crop-name"
      );

    const confidenceEl =
      document.getElementById(
        "diag-confidence"
      );

    const confidenceBarEl =
      document.getElementById(
        "diag-confidence-bar"
      );

    const severityBadgeEl =
      document.getElementById(
        "diag-severity-badge"
      );

    const symptomsListEl =
      document.getElementById(
        "diag-symptoms-list"
      );

    const organicTreatmentEl =
      document.getElementById(
        "diag-organic-treatment"
      );

    const chemicalTreatmentEl =
      document.getElementById(
        "diag-chemical-treatment"
      );

    const videoIframeEl =
      document.getElementById(
        "diag-youtube-iframe"
      );

    const videoSectionEl =
      document.getElementById(
        "diag-video-section"
      );

    const assessmentPanelEl =
      document.getElementById(
        "diag-assessment-panel"
      );

    const assessmentTitleEl =
      document.getElementById(
        "diag-assessment-title"
      );

    const reasoningSummaryEl =
      document.getElementById(
        "diag-reasoning-summary"
      );

    const healthStatusBadgeEl =
      document.getElementById(
        "diag-health-status-badge"
      );

    const cropMismatchWarningEl =
      document.getElementById(
        "diag-crop-mismatch-warning"
      );

    const uncertainWarningEl =
      document.getElementById(
        "diag-uncertain-warning"
      );

    // ==========================================================
    // Find parent sections
    // ==========================================================

    const symptomsSectionEl =
      symptomsListEl
        ? symptomsListEl.closest(".my-6")
        : null;

    const treatmentsSectionEl =
      organicTreatmentEl
        ? organicTreatmentEl.closest(
            ".grid.grid-cols-1.md\\:grid-cols-2"
          )
        : null;

    // ==========================================================
    // NON-PLANT / INVALID IMAGE REJECTION
    // ==========================================================

    if (
      data.validation_status === "rejected" ||
      data.is_plant_image === false
    ) {
      const visibleSubject =
        data.visible_subject ||
        "non-plant object";

      const rejectionReason =
        data.reasoning_summary ||
        "The uploaded image does not clearly contain plant material.";

      // --------------------------------------------------------
      // Heading
      // --------------------------------------------------------

      if (diseaseNameEl) {
        diseaseNameEl.textContent =
          "Unable to Diagnose";
      }

      // --------------------------------------------------------
      // Selected crop
      // --------------------------------------------------------

      if (cropNameEl) {
        cropNameEl.textContent =
          `Selected Crop: ${
            data.crop_name ||
            selectedCropName ||
            "Unknown"
          }`;
      }

      // --------------------------------------------------------
      // Confidence
      // --------------------------------------------------------

      if (confidenceEl) {
        confidenceEl.textContent =
          "0.0% Diagnostic Confidence";
      }

      if (confidenceBarEl) {
        confidenceBarEl.style.width =
          "0%";
      }

      // --------------------------------------------------------
      // Invalid image badge
      // --------------------------------------------------------

      if (severityBadgeEl) {
        severityBadgeEl.textContent =
          "INVALID IMAGE";

        severityBadgeEl.className =
          [
            "px-3",
            "py-1",
            "text-xs",
            "font-bold",
            "rounded-full",
            "uppercase",
            "tracking-wider",
            "border",
            "bg-red-500/20",
            "text-red-400",
            "border-red-500/40",
          ].join(" ");
      }

      // --------------------------------------------------------
      // Hide disease-specific sections
      // --------------------------------------------------------

      if (symptomsSectionEl) {
        symptomsSectionEl.classList.add(
          "hidden"
        );
      }

      if (treatmentsSectionEl) {
        treatmentsSectionEl.classList.add(
          "hidden"
        );
      }

      if (videoSectionEl) {
        videoSectionEl.classList.add(
          "hidden"
        );
      }

      if (videoIframeEl) {
        videoIframeEl.src = "";
      }

      if (assessmentPanelEl) {
        assessmentPanelEl.classList.add(
          "hidden"
        );
      }

      if (cropMismatchWarningEl) {
        cropMismatchWarningEl.classList.add(
          "hidden"
        );
      }

      if (uncertainWarningEl) {
        uncertainWarningEl.classList.add(
          "hidden"
        );
      }

      if (healthStatusBadgeEl) {
        healthStatusBadgeEl.classList.add(
          "hidden"
        );
      }

      // --------------------------------------------------------
      // Show result card
      // --------------------------------------------------------

      resultCard.classList.remove(
        "hidden"
      );

      resultCard.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });

      // --------------------------------------------------------
      // User notification
      // --------------------------------------------------------

      showToast(
        `Image rejected: ${visibleSubject}. ${rejectionReason}`,
        "warning"
      );

      console.warn(
        "[AI Diagnostics] Non-plant image rejected:",
        {
          subject:
            visibleSubject,

          reason:
            rejectionReason,

          validationConfidence:
            data.validation_confidence,
        }
      );

      /*
       * IMPORTANT:
       * Stop here.
       *
       * We must not continue into normal disease
       * rendering for an invalid image.
       */
      return;
    }

    // ==========================================================
    // RESTORE SECTIONS FOR A VALID PLANT IMAGE
    // ==========================================================

    /*
     * A previous scan may have been an invalid object.
     *
     * Those sections were hidden during that rejection.
     * Restore them before displaying the next genuine
     * plant diagnosis.
     */

    if (symptomsSectionEl) {
      symptomsSectionEl.classList.remove(
        "hidden"
      );
    }

    if (treatmentsSectionEl) {
      treatmentsSectionEl.classList.remove(
        "hidden"
      );
    }

    // Video remains hidden unless a video ID exists.
    if (videoSectionEl) {
      videoSectionEl.classList.add(
        "hidden"
      );
    }

    // ==========================================================
    // BASIC VALUES
    // ==========================================================

    const diseaseName =
      data.disease_name ||
      "Unknown Condition";

    /*
     * Prefer the crop returned by the backend.
     *
     * Otherwise use the crop selected in the UI.
     */

    const cropName =
      data.crop_name ||
      selectedCropName ||
      getSelectedCropName() ||
      "Unknown Crop";

    let confidence =
      Number(data.confidence);

    if (Number.isNaN(confidence)) {
      confidence = 0;
    }

    confidence = Math.max(
      0,
      Math.min(
        100,
        confidence
      )
    );

    const severity =
      data.severity ||
      "Unknown";

    // ==========================================================
    // DISEASE NAME
    // ==========================================================

    if (diseaseNameEl) {
      diseaseNameEl.textContent =
        diseaseName;
    }

    // ==========================================================
    // HOST CROP
    // ==========================================================

    if (cropNameEl) {
      cropNameEl.textContent =
        `Host Crop: ${cropName}`;
    }

    // ==========================================================
    // CONFIDENCE
    // ==========================================================

    if (confidenceEl) {
      confidenceEl.textContent =
        `${confidence.toFixed(1)}% Confidence`;
    }

    if (confidenceBarEl) {
      confidenceBarEl.style.width =
        `${confidence}%`;
    }

    // ==========================================================
    // SEVERITY BADGE
    // ==========================================================

    if (severityBadgeEl) {
      severityBadgeEl.textContent =
        `${severity} Severity`;

      severityBadgeEl.className =
        "px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider border";

      const severityLower =
        String(
          severity
        ).toLowerCase();

      if (
        severityLower === "critical"
      ) {
        severityBadgeEl.classList.add(
          "bg-red-500/20",
          "text-red-400",
          "border-red-500/40"
        );
      }

      else if (
        severityLower === "high"
      ) {
        severityBadgeEl.classList.add(
          "bg-orange-500/20",
          "text-orange-400",
          "border-orange-500/40"
        );
      }

      else if (
        severityLower === "medium"
      ) {
        severityBadgeEl.classList.add(
          "bg-amber-500/20",
          "text-amber-400",
          "border-amber-500/40"
        );
      }

      else {
        severityBadgeEl.classList.add(
          "bg-emerald-500/20",
          "text-emerald-400",
          "border-emerald-500/40"
        );
      }
    }

    // ==========================================================
    // AI ASSESSMENT / REASONING / CROP MATCH / UNCERTAINTY
    // ==========================================================

    const reasoningSummary =
      String(
        data.reasoning_summary || ""
      ).trim();

    const healthStatus =
      String(
        data.health_status || ""
      )
        .trim()
        .toLowerCase();

    const cropMismatch =
      data.crop_match === false;

    const diagnosisUncertain =
      data.uncertain === true;

    const validHealthStatuses =
      [
        "healthy",
        "diseased",
        "uncertain",
      ];

    const hasHealthStatus =
      validHealthStatuses.includes(
        healthStatus
      );

    const shouldShowAssessment =
      Boolean(reasoningSummary) ||
      cropMismatch ||
      diagnosisUncertain ||
      hasHealthStatus;

    if (assessmentPanelEl) {
      assessmentPanelEl.classList.toggle(
        "hidden",
        !shouldShowAssessment
      );
    }

    if (assessmentTitleEl) {
      if (cropMismatch) {
        assessmentTitleEl.textContent =
          "AI Assessment • Crop Verification Needed";
      }

      else if (diagnosisUncertain) {
        assessmentTitleEl.textContent =
          "AI Assessment • Diagnosis Uncertain";
      }

      else {
        assessmentTitleEl.textContent =
          "AI Assessment";
      }
    }

    // ----------------------------------------------------------
    // Reasoning summary
    // ----------------------------------------------------------

    if (reasoningSummaryEl) {
      if (reasoningSummary) {
        reasoningSummaryEl.textContent =
          reasoningSummary;
      }

      else if (diagnosisUncertain) {
        reasoningSummaryEl.textContent =
          "The visible symptoms were not strong enough for a confident diagnosis. Try a clearer close-up of the affected area.";
      }

      else {
        reasoningSummaryEl.textContent =
          "The AI completed its visual assessment of the uploaded plant image.";
      }
    }

    // ----------------------------------------------------------
    // Crop mismatch warning
    // ----------------------------------------------------------

    if (cropMismatchWarningEl) {
      cropMismatchWarningEl.classList.toggle(
        "hidden",
        !cropMismatch
      );
    }

    // ----------------------------------------------------------
    // Uncertainty warning
    // ----------------------------------------------------------

    if (uncertainWarningEl) {
      uncertainWarningEl.classList.toggle(
        "hidden",
        !diagnosisUncertain
      );
    }

    // ----------------------------------------------------------
    // Health-status badge
    // ----------------------------------------------------------

    if (healthStatusBadgeEl) {
      if (!hasHealthStatus) {
        healthStatusBadgeEl.classList.add(
          "hidden"
        );
      }

      else {
        healthStatusBadgeEl.className =
          "px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider border";

        healthStatusBadgeEl.textContent =
          healthStatus.toUpperCase();

        if (healthStatus === "healthy") {
          healthStatusBadgeEl.classList.add(
            "bg-emerald-500/20",
            "text-emerald-300",
            "border-emerald-500/40"
          );
        }

        else if (healthStatus === "diseased") {
          healthStatusBadgeEl.classList.add(
            "bg-red-500/20",
            "text-red-300",
            "border-red-500/40"
          );
        }

        else {
          healthStatusBadgeEl.classList.add(
            "bg-amber-500/20",
            "text-amber-300",
            "border-amber-500/40"
          );
        }
      }
    }

    refreshLucideIcons();

    // ==========================================================
    // SYMPTOMS
    // ==========================================================

    if (symptomsListEl) {
      symptomsListEl.innerHTML =
        "";

      const symptoms =
        Array.isArray(
          data.symptoms
        )
          ? data.symptoms
          : [];

      if (
        symptoms.length === 0
      ) {
        const item =
          document.createElement(
            "li"
          );

        item.className =
          "text-xs text-slate-400";

        item.textContent =
          "No specific symptoms were returned.";

        symptomsListEl.appendChild(
          item
        );
      }

      else {
        symptoms.forEach(
          (symptom) => {
            const item =
              document.createElement(
                "li"
              );

            item.className =
              "flex items-start gap-2 text-xs text-slate-300";

            const icon =
              document.createElement(
                "span"
              );

            icon.className =
              "text-emerald-400 shrink-0 mt-0.5";

            icon.textContent =
              "✓";

            const text =
              document.createElement(
                "span"
              );

            text.textContent =
              String(
                symptom
              );

            item.appendChild(
              icon
            );

            item.appendChild(
              text
            );

            symptomsListEl.appendChild(
              item
            );
          }
        );
      }
    }

    // ==========================================================
    // ORGANIC TREATMENT
    // ==========================================================

    if (organicTreatmentEl) {
      organicTreatmentEl.textContent =
        data.organic_treatment ||
        "No organic treatment recommendation was returned.";
    }

    // ==========================================================
    // CHEMICAL TREATMENT
    // ==========================================================

    if (chemicalTreatmentEl) {
      chemicalTreatmentEl.textContent =
        data.chemical_treatment ||
        "Consult a qualified agricultural expert before applying chemicals.";
    }

    // ==========================================================
    // YOUTUBE TUTORIAL
    // ==========================================================

    if (videoIframeEl) {
      if (
        data.youtube_tutorial_id
      ) {
        videoIframeEl.src =
          `https://www.youtube.com/embed/${encodeURIComponent(
            data.youtube_tutorial_id
          )}`;

        if (videoSectionEl) {
          videoSectionEl.classList.remove(
            "hidden"
          );
        }
      }

      else {
        videoIframeEl.src =
          "";

        if (videoSectionEl) {
          videoSectionEl.classList.add(
            "hidden"
          );
        }
      }
    }

    // ==========================================================
    // SHOW RESULT
    // ==========================================================

    resultCard.classList.remove(
      "hidden"
    );

    resultCard.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });

    console.log(
      "[AI Diagnostics] Result rendered.",
      {
        disease:
          diseaseName,

        crop:
          cropName,

        confidence:
          confidence,

        severity:
          severity,

        validationStatus:
          data.validation_status,

        plantImage:
          data.is_plant_image,

        cropMatch:
          data.crop_match,

        healthStatus:
          data.health_status,

        uncertain:
          data.uncertain,

        reasoningSummary:
          data.reasoning_summary,

        source:
          data.analysis_source,
      }
    );

    // ==========================================================
    // COMPLETION MESSAGE
    // ==========================================================

    if (
      data.analysis_source ===
      "fallback"
    ) {
      showToast(
        "AI model was unavailable, so backup image analysis was used.",
        "warning"
      );
    }

    else if (
      data.uncertain === true
    ) {
      showToast(
        "The AI found the image difficult to diagnose with confidence.",
        "warning"
      );
    }

    else if (
      data.crop_match === false
    ) {
      showToast(
        "The plant may not match the crop type you selected. Please verify the crop.",
        "warning"
      );
    }

    else {
      showToast(
        "AI diagnosis completed successfully.",
        "success"
      );
    }
  }

  // ============================================================
  // RESET INPUT
  // ============================================================

  function resetFileInput() {
    selectedFile = null;

    /*
     * Do not automatically reset the crop dropdown.
     * This allows a farmer to scan multiple leaves
     * from the same crop without selecting it again.
     */
    selectedCropName =
      getSelectedCropName();

    const fileInput =
      document.getElementById(
        "ai-file-input"
      );

    if (fileInput) {
      fileInput.value = "";
    }
  }

  // ============================================================
  // TOAST NOTIFICATIONS
  // ============================================================

  function showToast(
    message,
    type = "info"
  ) {
    const toast =
      document.createElement("div");

    let typeClasses =
      "bg-emerald-950/90 text-emerald-200 border-emerald-500/30";

    if (type === "error") {
      typeClasses =
        "bg-red-950/90 text-red-200 border-red-500/30";
    } else if (
      type === "warning"
    ) {
      typeClasses =
        "bg-amber-950/90 text-amber-200 border-amber-500/30";
    }

    toast.className = `
      fixed
      bottom-6
      right-6
      z-50
      max-w-sm
      px-4
      py-3
      rounded-xl
      shadow-2xl
      backdrop-blur-md
      border
      text-sm
      font-medium
      flex
      items-center
      gap-3
      transform
      transition-all
      duration-300
      translate-y-10
      opacity-0
      ${typeClasses}
    `;

    const icon =
      document.createElement(
        "span"
      );

    icon.className =
      "text-lg shrink-0";

    if (type === "error") {
      icon.textContent = "✕";
    } else if (
      type === "warning"
    ) {
      icon.textContent = "⚠";
    } else {
      icon.textContent = "✓";
    }

    const text =
      document.createElement(
        "span"
      );

    text.textContent =
      message;

    toast.appendChild(icon);
    toast.appendChild(text);

    document.body.appendChild(
      toast
    );

    setTimeout(() => {
      toast.classList.remove(
        "translate-y-10",
        "opacity-0"
      );
    }, 50);

    setTimeout(() => {
      toast.classList.add(
        "translate-y-10",
        "opacity-0"
      );

      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 4500);
  }

  // ============================================================
  // LUCIDE ICON REFRESH
  // ============================================================

  function refreshLucideIcons() {
    if (
      window.lucide &&
      typeof window.lucide
        .createIcons === "function"
    ) {
      window.lucide.createIcons();
    }
  }

  // ============================================================
  // GLOBAL ACCESS
  // ============================================================

  window.showToast =
    showToast;

  // ============================================================
  // START
  // ============================================================

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initAIDiagnostics
    );
  } else {
    initAIDiagnostics();
  }
})();