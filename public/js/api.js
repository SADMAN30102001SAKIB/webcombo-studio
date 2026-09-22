export async function uploadAudioFile(file) {
  const formData = new FormData();
  formData.append('audio', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to upload audio file.');
  }

  return data;
}

export async function startProcessing(jobId, track = 'vocal') {
  const response = await fetch(`/api/process/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track })
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Could not start stem separation.');
  }

  return data;
}

export async function startReverb(jobId, options = {}) {
  const response = await fetch(`/api/reverb/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Could not start Slowed + Reverb processing.');
  }

  return data;
}

export function subscribeProgress(jobId, onMessage, onError) {
  const eventSource = new EventSource(`/api/progress/${jobId}`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (err) {
      console.error('Failed to parse SSE payload:', err);
    }
  };

  if (onError) {
    eventSource.onerror = onError;
  }

  return eventSource;
}

export async function getJobStatus(jobId) {
  const response = await fetch(`/api/status/${jobId}`);
  if (!response.ok) {
    throw new Error('Failed to retrieve job status.');
  }
  return response.json();
}
