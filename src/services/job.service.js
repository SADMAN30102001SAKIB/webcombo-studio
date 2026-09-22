import crypto from 'crypto';
import fs from 'fs';

class JobService {
  constructor() {
    this.jobs = new Map();
    setInterval(() => {
      this.cleanOldJobs(30 * 60 * 1000);
    }, 10 * 60 * 1000).unref();
  }

  createJob(fileInfo) {
    const jobId = crypto.randomUUID();
    const job = {
      id: jobId,
      originalName: fileInfo.originalName,
      fileName: fileInfo.fileName,
      filePath: fileInfo.filePath,
      size: fileInfo.size,
      status: 'uploaded',
      history: [],
      listeners: new Set(),
      createdAt: Date.now(),
      resultPath: null,
      stemPath: null,
      reverbPath: null,
      error: null
    };

    this.jobs.set(jobId, job);
    return job;
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  updateJob(jobId, updates) {
    const job = this.getJob(jobId);
    if (!job) return null;
    Object.assign(job, updates);
    return job;
  }

  addSubscriber(jobId, listener) {
    const job = this.getJob(jobId);
    if (!job) return false;
    job.listeners.add(listener);
    return true;
  }

  removeSubscriber(jobId, listener) {
    const job = this.getJob(jobId);
    if (!job) return;
    job.listeners.delete(listener);
  }

  broadcastEvent(jobId, eventData) {
    const job = this.getJob(jobId);
    if (!job) return;

    job.history.push(eventData);

    job.listeners.forEach((listener) => {
      try {
        listener(eventData);
      } catch {}
    });
  }

  cleanOldJobs(maxAgeMs = 30 * 60 * 1000) {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (now - job.createdAt > maxAgeMs) {
        const paths = [job.filePath, job.stemPath, job.reverbPath, job.resultPath];
        for (const p of paths) {
          try {
            if (p && fs.existsSync(p)) {
              fs.unlinkSync(p);
            }
          } catch {}
        }
        this.jobs.delete(id);
      }
    }
  }
}

export const jobService = new JobService();
export default jobService;
