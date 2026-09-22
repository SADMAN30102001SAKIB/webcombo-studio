export function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function showStage(allStages, targetStage) {
  allStages.forEach((s) => s.classList.add('hidden'));
  targetStage.classList.remove('hidden');
}

export function appendLog(consoleElement, message, type = 'info') {
  if (!consoleElement) return;
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  const timestamp = new Date().toLocaleTimeString();
  line.textContent = `[${timestamp}] ${message}`;
  consoleElement.appendChild(line);
  consoleElement.scrollTop = consoleElement.scrollHeight;
}

export function updateStepper(stepper, step) {
  const { steps, lines } = stepper;

  steps.forEach((el) => el.classList.remove('active', 'completed'));
  lines.forEach((el) => el.classList.remove('filled'));

  switch (step) {
    case 'uploading':
    case 'navigating':
    case 'starting':
      steps[0].classList.add('active');
      break;

    case 'processing':
      steps[0].classList.add('completed');
      lines[0].classList.add('filled');
      steps[1].classList.add('active');
      break;

    case 'saving':
      steps[0].classList.add('completed');
      steps[1].classList.add('completed');
      lines[0].classList.add('filled');
      lines[1].classList.add('filled');
      steps[2].classList.add('active');
      break;

    case 'downloading':
    case 'completed':
      steps[0].classList.add('completed');
      steps[1].classList.add('completed');
      steps[2].classList.add('completed');
      lines[0].classList.add('filled');
      lines[1].classList.add('filled');
      lines[2].classList.add('filled');
      steps[3].classList.add(step === 'completed' ? 'completed' : 'active');
      break;
  }
}

export function updateReverbStepper(stepper, step) {
  const { steps, lines } = stepper;

  steps.forEach((el) => el.classList.remove('active', 'completed'));
  lines.forEach((el) => el.classList.remove('filled'));

  switch (step) {
    case 'reverb_starting':
    case 'reverb_navigating':
    case 'reverb_uploading':
      steps[0].classList.add('active');
      break;

    case 'reverb_configuring':
      steps[0].classList.add('completed');
      lines[0].classList.add('filled');
      steps[1].classList.add('active');
      break;

    case 'reverb_processing':
      steps[0].classList.add('completed');
      steps[1].classList.add('completed');
      lines[0].classList.add('filled');
      lines[1].classList.add('filled');
      steps[2].classList.add('active');
      break;

    case 'reverb_downloading':
    case 'reverb_completed':
      steps[0].classList.add('completed');
      steps[1].classList.add('completed');
      steps[2].classList.add('completed');
      lines[0].classList.add('filled');
      lines[1].classList.add('filled');
      lines[2].classList.add('filled');
      steps[3].classList.add(step === 'reverb_completed' ? 'completed' : 'active');
      break;
  }
}

export function displayError(errorElements, message, errorType) {
  const { title, text, recommendation, networkRecommendation, reverbRecommendation } = errorElements;
  text.textContent = message;

  if (recommendation) recommendation.classList.add('hidden');
  if (networkRecommendation) networkRecommendation.classList.add('hidden');
  if (reverbRecommendation) reverbRecommendation.classList.add('hidden');

  if (errorType === 'RATE_LIMIT' || /too many requests|free tier/i.test(message)) {
    title.textContent = 'VocalRemover Daily Limit Reached';
    if (recommendation) recommendation.classList.remove('hidden');
  } else if (errorType === 'NETWORK_ERROR' || /network error|network problem|check your internet connection/i.test(message)) {
    title.textContent = 'Network Error Detected on VocalRemover';
    if (networkRecommendation) networkRecommendation.classList.remove('hidden');
  } else if (errorType === 'REVERB_ERROR' || /slowedreverb|reverb|synthesis/i.test(message)) {
    title.textContent = 'Slowed + Reverb Synthesis Error';
    if (reverbRecommendation) reverbRecommendation.classList.remove('hidden');
  } else {
    title.textContent = 'Automation Error';
  }
}
