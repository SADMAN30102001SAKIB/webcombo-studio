import {
  uploadAudioFile,
  startProcessing,
  startReverb,
  subscribeProgress,
} from "./api.js";
import {
  formatBytes,
  showStage,
  appendLog,
  updateStepper,
  updateReverbStepper,
  displayError,
} from "./ui.js";

let selectedFile = null;
let currentJobId = null;
let activeEventSource = null;
let selectedTrack = "vocal";
let isStemReady = false;
let isReverbTriggered = false;

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const browseBtn = document.getElementById("browse-btn");
const filePreviewCard = document.getElementById("file-preview-card");
const previewFilename = document.getElementById("preview-filename");
const previewFilesize = document.getElementById("preview-filesize");
const removeFileBtn = document.getElementById("remove-file-btn");
const localAudioPlayer = document.getElementById("local-audio-player");
const startBtn = document.getElementById("start-btn");
const trackLabels = document.querySelectorAll(".track-radio-label");

const stages = {
  upload: document.getElementById("upload-stage"),
  processing: document.getElementById("processing-stage"),
  result: document.getElementById("result-stage"),
  error: document.getElementById("error-stage"),
};
const allStagesList = Object.values(stages);

const stepper = {
  steps: [
    document.getElementById("step-upload"),
    document.getElementById("step-ai"),
    document.getElementById("step-extract"),
    document.getElementById("step-ready"),
  ],
  lines: [
    document.getElementById("line-1"),
    document.getElementById("line-2"),
    document.getElementById("line-3"),
  ],
};

const reverbStepper = {
  steps: [
    document.getElementById("reverb-step-load"),
    document.getElementById("reverb-step-dsp"),
    document.getElementById("reverb-step-synth"),
    document.getElementById("reverb-step-ready"),
  ],
  lines: [
    document.getElementById("reverb-line-1"),
    document.getElementById("reverb-line-2"),
    document.getElementById("reverb-line-3"),
  ],
};

const currentStepTitle = document.getElementById("current-step-title");
const currentStepDesc = document.getElementById("current-step-desc");
const logConsole = document.getElementById("log-console");

const resultAudioPlayer = document.getElementById("result-audio-player");
const downloadTrackBtn = document.getElementById("download-track-btn");
const resultFilename = document.getElementById("result-filename");
const resetBtn = document.getElementById("reset-btn");

const speedModeToggle = document.getElementById("speed-mode-toggle");
const speedLabelText = document.getElementById("speed-label-text");
const valSpeed = document.getElementById("val-speed");
const sliderSpeed = document.getElementById("slider-speed");
const valReverb = document.getElementById("val-reverb");
const sliderReverb = document.getElementById("slider-reverb");
const applyReverbBtn = document.getElementById("apply-reverb-btn");
const reverbProgressCard = document.getElementById("reverb-progress-card");
const reverbStatusTitle = document.getElementById("reverb-status-title");
const reverbStatusMessage = document.getElementById("reverb-status-message");
const reverbLogConsole = document.getElementById("reverb-log-console");
const finalMasterCard = document.getElementById("final-master-card");
const finalMasterFilename = document.getElementById("final-master-filename");
const finalAudioPlayer = document.getElementById("final-audio-player");
const downloadMasterBtn = document.getElementById("download-master-btn");
const reverbReconfigureBtn = document.getElementById("reverb-reconfigure-btn");

const autoChainToggle = document.getElementById("auto-chain-toggle");
const upfrontReverbBox = document.getElementById("upfront-reverb-box");
const upfrontSpeedModeToggle = document.getElementById(
  "upfront-speed-mode-toggle",
);
const upfrontSpeedLabelText = document.getElementById(
  "upfront-speed-label-text",
);
const upfrontSliderSpeed = document.getElementById("upfront-slider-speed");
const upfrontValSpeed = document.getElementById("upfront-val-speed");
const upfrontSliderReverb = document.getElementById("upfront-slider-reverb");
const upfrontValReverb = document.getElementById("upfront-val-reverb");

const errorElements = {
  title: document.getElementById("error-title"),
  text: document.getElementById("error-message"),
  recommendation: document.getElementById("error-recommendation"),
  networkRecommendation: document.getElementById("network-recommendation"),
  reverbRecommendation: document.getElementById("reverb-error-recommendation"),
  screenshotCard: document.getElementById("error-screenshot-card"),
  screenshotImg: document.getElementById("error-screenshot-img"),
  screenshotLink: document.getElementById("error-screenshot-link"),
};
const errorRetryBtn = document.getElementById("error-retry-btn");

function setupCustomAudioPlayer(wrapElement) {
  if (!wrapElement) return;
  const audio = wrapElement.querySelector("audio");
  const playBtn = wrapElement.querySelector(".player-play-btn");
  const iconPlay = wrapElement.querySelector(".icon-play");
  const iconPause = wrapElement.querySelector(".icon-pause");
  const timeline =
    wrapElement.querySelector(".player-timeline-box") ||
    wrapElement.querySelector(".player-timeline");
  const progressFill = wrapElement.querySelector(".player-progress-fill");
  const timeCurrent = wrapElement.querySelector(".player-time-current");
  const timeDuration = wrapElement.querySelector(".player-time-duration");
  const muteBtn = wrapElement.querySelector(".player-mute-btn");
  const iconVolume = wrapElement.querySelector(".icon-volume");
  const iconMuted = wrapElement.querySelector(".icon-muted");

  function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  playBtn.addEventListener("click", () => {
    if (audio.paused) {
      document.querySelectorAll("audio").forEach(a => {
        if (a !== audio) a.pause();
      });
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  });

  audio.addEventListener("play", () => {
    iconPlay.classList.add("hidden");
    iconPause.classList.remove("hidden");
  });

  audio.addEventListener("pause", () => {
    iconPlay.classList.remove("hidden");
    iconPause.classList.add("hidden");
  });

  audio.addEventListener("ended", () => {
    iconPlay.classList.remove("hidden");
    iconPause.classList.add("hidden");
    progressFill.style.width = "0%";
    timeCurrent.textContent = "0:00";
  });

  const updateDuration = () => {
    if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
      timeDuration.textContent = formatTime(audio.duration);
    }
  };

  audio.addEventListener("loadedmetadata", () => {
    updateDuration();
    timeCurrent.textContent = "0:00";
    progressFill.style.width = "0%";
  });

  audio.addEventListener("durationchange", updateDuration);
  audio.addEventListener("canplay", updateDuration);

  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = `${pct}%`;
    timeCurrent.textContent = formatTime(audio.currentTime);
  });

  timeline.addEventListener("click", e => {
    if (!audio.duration) return;
    const rect = timeline.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pos * audio.duration;
  });

  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      audio.muted = !audio.muted;
      if (audio.muted) {
        iconVolume.classList.add("hidden");
        iconMuted.classList.remove("hidden");
      } else {
        iconVolume.classList.remove("hidden");
        iconMuted.classList.add("hidden");
      }
    });
  }
}

setupCustomAudioPlayer(document.getElementById("local-player-wrap"));
setupCustomAudioPlayer(document.getElementById("stem-player-wrap"));
setupCustomAudioPlayer(document.getElementById("final-player-wrap"));

function resetCustomPlayer(wrapElement) {
  if (!wrapElement) return;
  const audio = wrapElement.querySelector("audio");
  const iconPlay = wrapElement.querySelector(".icon-play");
  const iconPause = wrapElement.querySelector(".icon-pause");
  const progressFill = wrapElement.querySelector(".player-progress-fill");
  const timeCurrent = wrapElement.querySelector(".player-time-current");
  const timeDuration = wrapElement.querySelector(".player-time-duration");

  if (audio) {
    audio.pause();
    audio.src = "";
  }
  if (iconPlay) iconPlay.classList.remove("hidden");
  if (iconPause) iconPause.classList.add("hidden");
  if (progressFill) progressFill.style.width = "0%";
  if (timeCurrent) timeCurrent.textContent = "0:00";
  if (timeDuration) timeDuration.textContent = "0:00";
}

function handleFileSelection(file) {
  if (!file) return;

  const validAudioPattern = /\.(mp3|wav|ogg|flac|m4a|aac)$/i;
  if (!file.type.startsWith("audio/") && !validAudioPattern.test(file.name)) {
    alert("Please select a valid audio file (.mp3, .wav, .flac, .ogg, .m4a)");
    return;
  }

  selectedFile = file;
  previewFilename.textContent = file.name;
  previewFilesize.textContent = formatBytes(file.size);

  localAudioPlayer.src = URL.createObjectURL(file);
  dropzone.classList.add("hidden");
  filePreviewCard.classList.remove("hidden");
  startBtn.removeAttribute("disabled");
}

function clearSelectedFile() {
  selectedFile = null;
  isStemReady = false;
  isReverbTriggered = false;
  fileInput.value = "";
  resetCustomPlayer(document.getElementById("local-player-wrap"));
  resetCustomPlayer(document.getElementById("stem-player-wrap"));
  resetCustomPlayer(document.getElementById("final-player-wrap"));
  filePreviewCard.classList.add("hidden");
  dropzone.classList.remove("hidden");
  startBtn.setAttribute("disabled", "true");
  reverbProgressCard.classList.add("hidden");
  finalMasterCard.classList.add("hidden");
  applyReverbBtn.removeAttribute("disabled");
  const stemBox = document.querySelector(".stem-result-box");
  const reverbBox = document.querySelector(".reverb-studio-box");
  if (stemBox) stemBox.classList.remove("hidden");
  if (reverbBox) reverbBox.classList.remove("hidden");
  if (errorElements.screenshotCard) {
    errorElements.screenshotCard.classList.add("hidden");
  }
  if (errorElements.screenshotImg) {
    errorElements.screenshotImg.src = "";
  }
}

function updateSpeedSliderMode() {
  const isPitchMode = speedModeToggle.checked;
  if (isPitchMode) {
    speedLabelText.textContent = "Speed (Semitones)";
    sliderSpeed.min = "-12";
    sliderSpeed.max = "0";
    sliderSpeed.value = "-2";
    valSpeed.textContent = "-2";
  } else {
    speedLabelText.textContent = "Speed (%)";
    sliderSpeed.min = "50";
    sliderSpeed.max = "100";
    sliderSpeed.value = "87";
    valSpeed.textContent = "87%";
  }
}

function handleProgressEvent(data) {
  const { step, message, errorType, fileName } = data;

  if (message) {
    if (step.startsWith("reverb_")) {
      appendLog(
        reverbLogConsole,
        message,
        step === "error"
          ? "error"
          : step === "reverb_completed"
            ? "success"
            : "info",
      );
    } else {
      appendLog(
        logConsole,
        message,
        step === "error" ? "error" : step === "completed" ? "success" : "info",
      );
    }
  }

  updateStepper(stepper, step);

  switch (step) {
    case "starting":
    case "navigating":
      currentStepTitle.textContent = "Launching Engine...";
      currentStepDesc.textContent = message;
      break;

    case "uploading":
      currentStepTitle.textContent = "Uploading to VocalRemover...";
      currentStepDesc.textContent = message;
      break;

    case "processing":
      currentStepTitle.textContent = "AI Stem Separation Working...";
      currentStepDesc.textContent =
        "Separating frequencies. This typically takes 30 to 60 seconds.";
      break;

    case "saving":
      currentStepTitle.textContent = "Extracting Requested Stem...";
      currentStepDesc.textContent = message;
      break;

    case "downloading":
      currentStepTitle.textContent = "Saving Downloaded Audio...";
      currentStepDesc.textContent = message;
      break;

    case "completed":
      isStemReady = true;
      showStage(allStagesList, stages.result);
      resultFilename.textContent = fileName;
      resultAudioPlayer.src = `/api/preview/${currentJobId}?type=stem`;
      downloadTrackBtn.href = `/api/download/${currentJobId}?type=stem`;
      downloadTrackBtn.download = fileName;

      if (autoChainToggle && autoChainToggle.checked && !isReverbTriggered) {
        isReverbTriggered = true;
        const reverbPanel = document.querySelector(".reverb-studio-box");
        if (reverbPanel) reverbPanel.classList.add("hidden");
        reverbProgressCard.classList.remove("hidden");
        if (reverbLogConsole) {
          reverbLogConsole.innerHTML = "";
          appendLog(
            reverbLogConsole,
            "Auto-chaining Slowed + Reverb DSP synthesis...",
            "info",
          );
        }
        applyReverbBtn.setAttribute("disabled", "true");
        updateReverbStepper(reverbStepper, "reverb_starting");
        reverbStatusTitle.textContent = "Auto-Chaining Slowed + Reverb...";
        reverbStatusMessage.textContent =
          "Stem extracted! Synthesizing DSP audio...";
        const options = {
          slowByPitch: upfrontSpeedModeToggle
            ? upfrontSpeedModeToggle.checked
            : speedModeToggle.checked,
          speed: Number(
            upfrontSliderSpeed ? upfrontSliderSpeed.value : sliderSpeed.value,
          ),
          reverbMix: Number(
            upfrontSliderReverb
              ? upfrontSliderReverb.value
              : sliderReverb.value,
          ),
        };
        startReverb(currentJobId, options).catch(err => {
          reverbProgressCard.classList.add("hidden");
          if (reverbPanel) reverbPanel.classList.remove("hidden");
          applyReverbBtn.removeAttribute("disabled");
          showStage(allStagesList, stages.error);
          displayError(errorElements, err.message, "REVERB_ERROR");
        });
      }
      break;

    case "reverb_starting":
    case "reverb_navigating":
      reverbProgressCard.classList.remove("hidden");
      updateReverbStepper(reverbStepper, data.step);
      reverbStatusTitle.textContent = "Connecting to SlowedReverb Engine...";
      reverbStatusMessage.textContent = message;
      break;

    case "reverb_uploading":
      reverbProgressCard.classList.remove("hidden");
      updateReverbStepper(reverbStepper, data.step);
      reverbStatusTitle.textContent = "Uploading Audio to Engine...";
      reverbStatusMessage.textContent = message;
      break;

    case "reverb_configuring":
      reverbProgressCard.classList.remove("hidden");
      updateReverbStepper(reverbStepper, data.step);
      reverbStatusTitle.textContent = "Applying Pitch & Reverb Settings...";
      reverbStatusMessage.textContent = message;
      break;

    case "reverb_processing":
      reverbProgressCard.classList.remove("hidden");
      updateReverbStepper(reverbStepper, data.step);
      reverbStatusTitle.textContent = "DSP Audio Synthesis In Progress...";
      reverbStatusMessage.textContent = message;
      break;

    case "reverb_downloading":
      reverbProgressCard.classList.remove("hidden");
      updateReverbStepper(reverbStepper, data.step);
      reverbStatusTitle.textContent = "Encoding 320kbps Master MP3...";
      reverbStatusMessage.textContent = message;
      break;

    case "reverb_completed":
      updateReverbStepper(reverbStepper, data.step);
      reverbProgressCard.classList.add("hidden");
      applyReverbBtn.removeAttribute("disabled");
      const stemPanel = document.querySelector(".stem-result-box");
      const reverbPanel = document.querySelector(".reverb-studio-box");
      if (stemPanel) stemPanel.classList.add("hidden");
      if (reverbPanel) reverbPanel.classList.add("hidden");
      finalMasterCard.classList.remove("hidden");
      finalMasterFilename.textContent = fileName;
      finalAudioPlayer.src = `/api/preview/${currentJobId}?type=reverb&t=${Date.now()}`;
      finalAudioPlayer.load();
      downloadMasterBtn.href = `/api/download/${currentJobId}?type=reverb`;
      downloadMasterBtn.download = fileName;
      finalMasterCard.scrollIntoView({ behavior: "smooth", block: "start" });
      break;

    case "error":
      reverbProgressCard.classList.add("hidden");
      applyReverbBtn.removeAttribute("disabled");
      const errorStemPanel = document.querySelector(".stem-result-box");
      const errorReverbPanel = document.querySelector(".reverb-studio-box");
      if (errorStemPanel) errorStemPanel.classList.remove("hidden");
      if (errorReverbPanel) errorReverbPanel.classList.remove("hidden");
      showStage(allStagesList, stages.error);
      displayError(
        errorElements,
        message,
        errorType || (isStemReady ? "REVERB_ERROR" : "SITE_ERROR"),
        data.screenshot,
      );
      break;
  }
}

speedModeToggle.addEventListener("change", updateSpeedSliderMode);

sliderSpeed.addEventListener("input", () => {
  if (speedModeToggle.checked) {
    valSpeed.textContent = sliderSpeed.value;
  } else {
    valSpeed.textContent = `${sliderSpeed.value}%`;
  }
  if (upfrontSliderSpeed) {
    upfrontSliderSpeed.value = sliderSpeed.value;
    upfrontValSpeed.textContent = valSpeed.textContent;
  }
});

sliderReverb.addEventListener("input", () => {
  valReverb.textContent = `${sliderReverb.value}%`;
  if (upfrontSliderReverb) {
    upfrontSliderReverb.value = sliderReverb.value;
    upfrontValReverb.textContent = `${sliderReverb.value}%`;
  }
});

function updateUpfrontSpeedSliderMode() {
  const isPitchMode = upfrontSpeedModeToggle.checked;
  if (isPitchMode) {
    upfrontSpeedLabelText.textContent = "Speed (Semitones)";
    upfrontSliderSpeed.min = "-12";
    upfrontSliderSpeed.max = "0";
    upfrontSliderSpeed.value = "-2";
    upfrontValSpeed.textContent = "-2";
  } else {
    upfrontSpeedLabelText.textContent = "Speed (%)";
    upfrontSliderSpeed.min = "50";
    upfrontSliderSpeed.max = "100";
    upfrontSliderSpeed.value = "87";
    upfrontValSpeed.textContent = "87%";
  }
  if (speedModeToggle) {
    speedModeToggle.checked = isPitchMode;
    updateSpeedSliderMode();
  }
}

if (autoChainToggle) {
  autoChainToggle.addEventListener("change", () => {
    if (autoChainToggle.checked) {
      if (upfrontReverbBox) upfrontReverbBox.classList.remove("hidden");
      const btnText = startBtn.querySelector(".btn-text");
      if (btnText) btnText.textContent = "Extract & Synthesize 🚀";
    } else {
      if (upfrontReverbBox) upfrontReverbBox.classList.add("hidden");
      const btnText = startBtn.querySelector(".btn-text");
      if (btnText) btnText.textContent = "Extract Audio Stems";
    }
  });
}

if (upfrontSpeedModeToggle) {
  upfrontSpeedModeToggle.addEventListener(
    "change",
    updateUpfrontSpeedSliderMode,
  );
}

if (upfrontSliderSpeed) {
  upfrontSliderSpeed.addEventListener("input", () => {
    if (upfrontSpeedModeToggle.checked) {
      upfrontValSpeed.textContent = upfrontSliderSpeed.value;
    } else {
      upfrontValSpeed.textContent = `${upfrontSliderSpeed.value}%`;
    }
    if (sliderSpeed) {
      sliderSpeed.value = upfrontSliderSpeed.value;
      valSpeed.textContent = upfrontValSpeed.textContent;
    }
  });
}

if (upfrontSliderReverb) {
  upfrontSliderReverb.addEventListener("input", () => {
    upfrontValReverb.textContent = `${upfrontSliderReverb.value}%`;
    if (sliderReverb) {
      sliderReverb.value = upfrontSliderReverb.value;
      valReverb.textContent = `${upfrontSliderReverb.value}%`;
    }
  });
}

applyReverbBtn.addEventListener("click", async () => {
  if (!currentJobId || isReverbTriggered) return;
  isReverbTriggered = true;

  applyReverbBtn.setAttribute("disabled", "true");
  const reverbPanel = document.querySelector(".reverb-studio-box");
  if (reverbPanel) reverbPanel.classList.add("hidden");
  if (finalMasterCard) finalMasterCard.classList.add("hidden");
  reverbProgressCard.classList.remove("hidden");
  if (reverbLogConsole) {
    reverbLogConsole.innerHTML = "";
    appendLog(
      reverbLogConsole,
      "Starting Slowed + Reverb DSP synthesis...",
      "info",
    );
  }
  updateReverbStepper(reverbStepper, "reverb_starting");
  reverbStatusTitle.textContent = "Starting Slowed + Reverb...";
  reverbStatusMessage.textContent =
    "Sending parameters to synthesizer pipeline...";
  reverbProgressCard.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const options = {
      slowByPitch: speedModeToggle.checked,
      speed: Number(sliderSpeed.value),
      reverbMix: Number(sliderReverb.value),
    };
    await startReverb(currentJobId, options);
  } catch (err) {
    reverbProgressCard.classList.add("hidden");
    if (reverbPanel) reverbPanel.classList.remove("hidden");
    applyReverbBtn.removeAttribute("disabled");
    showStage(allStagesList, stages.error);
    displayError(errorElements, err.message, "REVERB_ERROR");
  }
});

if (reverbReconfigureBtn) {
  reverbReconfigureBtn.addEventListener("click", () => {
    if (finalAudioPlayer && !finalAudioPlayer.paused) {
      finalAudioPlayer.pause();
    }
    isReverbTriggered = false;
    applyReverbBtn.removeAttribute("disabled");
    const stemPanel = document.querySelector(".stem-result-box");
    const reverbPanel = document.querySelector(".reverb-studio-box");
    if (stemPanel) stemPanel.classList.remove("hidden");
    if (reverbPanel) {
      reverbPanel.classList.remove("hidden");
      reverbPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (reverbProgressCard) reverbProgressCard.classList.add("hidden");
  });
}

browseBtn.addEventListener("click", e => {
  e.stopPropagation();
  fileInput.click();
});
dropzone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", e => {
  if (e.target.files && e.target.files[0]) {
    handleFileSelection(e.target.files[0]);
  }
});

dropzone.addEventListener("dragover", e => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", e => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleFileSelection(e.dataTransfer.files[0]);
  }
});

removeFileBtn.addEventListener("click", clearSelectedFile);

trackLabels.forEach(label => {
  label.addEventListener("click", () => {
    trackLabels.forEach(l => l.classList.remove("active"));
    label.classList.add("active");
    const radio = label.querySelector("input");
    if (radio) {
      radio.checked = true;
      selectedTrack = radio.value;
    }
  });
});

startBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  isReverbTriggered = false;
  showStage(allStagesList, stages.processing);
  logConsole.innerHTML = "";
  appendLog(
    logConsole,
    `Starting upload for "${selectedFile.name}"...`,
    "info",
  );
  updateStepper(stepper, "uploading");
  currentStepTitle.textContent = "Uploading to Server...";
  currentStepDesc.textContent =
    "Preparing audio file for the AI processing engine.";

  try {
    const uploadResult = await uploadAudioFile(selectedFile);
    currentJobId = uploadResult.jobId;
    appendLog(
      logConsole,
      `Audio uploaded successfully. Job ID: ${currentJobId.slice(0, 8)}`,
      "success",
    );

    if (activeEventSource) activeEventSource.close();
    activeEventSource = subscribeProgress(
      currentJobId,
      data => handleProgressEvent(data),
      err => console.warn("SSE connection warning:", err),
    );

    appendLog(
      logConsole,
      `Requesting ${selectedTrack.toUpperCase()} isolation from engine...`,
      "info",
    );
    await startProcessing(currentJobId, selectedTrack);
  } catch (err) {
    showStage(allStagesList, stages.error);
    displayError(errorElements, err.message);
  }
});

resetBtn.addEventListener("click", () => {
  if (currentJobId) {
    fetch(`/api/cleanup/${currentJobId}`, { method: "POST" }).catch(() => {});
  }
  clearSelectedFile();
  showStage(allStagesList, stages.upload);
});

errorRetryBtn.addEventListener("click", () => {
  if (
    isStemReady &&
    errorElements.title.textContent.includes("Slowed + Reverb")
  ) {
    showStage(allStagesList, stages.result);
    const stemPanel = document.querySelector(".stem-result-box");
    const reverbPanel = document.querySelector(".reverb-studio-box");
    if (stemPanel) stemPanel.classList.remove("hidden");
    if (reverbPanel) reverbPanel.classList.remove("hidden");
    if (reverbProgressCard) reverbProgressCard.classList.add("hidden");
    applyReverbBtn.removeAttribute("disabled");
    return;
  }
  if (currentJobId) {
    fetch(`/api/cleanup/${currentJobId}`, { method: "POST" }).catch(() => {});
  }
  clearSelectedFile();
  showStage(allStagesList, stages.upload);
});

window.addEventListener("beforeunload", () => {
  if (currentJobId) {
    navigator.sendBeacon(`/api/cleanup/${currentJobId}`);
  }
});
