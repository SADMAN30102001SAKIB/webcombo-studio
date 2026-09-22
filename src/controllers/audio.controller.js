import fs from "fs";
import path from "path";
import { streamSSE } from "hono/streaming";
import jobService from "../services/job.service.js";
import { separateAudio } from "../services/stem.service.js";
import { applySlowedReverb } from "../services/reverb.service.js";
import { saveUploadedAudio } from "../middleware/upload.middleware.js";
import config from "../config/index.js";

export async function uploadAudio(c) {
  try {
    const body = await c.req.parseBody();
    const file = body["audio"];

    if (!file) {
      return c.json({ error: "No audio file uploaded." }, 400);
    }

    const fileInfo = await saveUploadedAudio(file);
    const job = jobService.createJob(fileInfo);

    return c.json({
      success: true,
      jobId: job.id,
      file: {
        originalName: job.originalName,
        size: job.size,
      },
    });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
}

export function streamProgress(c) {
  const jobId = c.req.param("jobId");
  const job = jobService.getJob(jobId);

  if (!job) {
    return c.json({ error: "Job not found." }, 404);
  }

  return streamSSE(c, async stream => {
    for (const evt of job.history) {
      await stream.writeSSE({ data: JSON.stringify(evt) });
    }

    const listener = async eventData => {
      try {
        await stream.writeSSE({ data: JSON.stringify(eventData) });
      } catch {}
    };

    jobService.addSubscriber(jobId, listener);

    stream.onAbort(() => {
      jobService.removeSubscriber(jobId, listener);
    });

    while (!stream.aborted) {
      await stream.sleep(500);
    }
  });
}

export async function processAudio(c) {
  const jobId = c.req.param("jobId");
  const body = await c.req.json().catch(() => ({}));
  const track = body.track || "vocal";
  const job = jobService.getJob(jobId);

  if (!job) {
    return c.json({ error: "Job not found." }, 404);
  }

  if (job.status === "processing") {
    return c.json({ error: "Job is already running." }, 400);
  }

  jobService.updateJob(jobId, { status: "processing", track });

  (async () => {
    try {
      jobService.broadcastEvent(jobId, {
        step: "init",
        message: `Job initialized. Target track: ${track.toUpperCase()}`,
      });

      const resultPath = await separateAudio(job.filePath, track, evt => {
        if (evt.filePath) {
          jobService.updateJob(jobId, {
            status: "stem_ready",
            stemPath: evt.filePath,
            resultPath: evt.filePath,
          });
        }
        jobService.broadcastEvent(jobId, evt);
      });

      jobService.updateJob(jobId, {
        status: "stem_ready",
        stemPath: resultPath,
        resultPath,
      });
    } catch (err) {
      jobService.updateJob(jobId, {
        status: "failed",
        error: err.message,
      });
      console.error(`[Job ${jobId}] Failed:`, err.message);
    }
  })();

  return c.json({ success: true, message: "Processing started.", jobId });
}

export async function applyReverb(c) {
  const jobId = c.req.param("jobId");
  const body = await c.req.json().catch(() => ({}));
  const job = jobService.getJob(jobId);

  if (!job) {
    return c.json({ error: "Job not found." }, 404);
  }

  const stemPath = job.stemPath || job.resultPath;
  if (!stemPath || !fs.existsSync(stemPath)) {
    return c.json(
      { error: "Stem audio file not available. Please extract stems first." },
      400,
    );
  }

  if (job.status === "processing_reverb") {
    return c.json({ error: "Reverb processing is already running." }, 400);
  }

  jobService.updateJob(jobId, { status: "processing_reverb" });

  (async () => {
    try {
      const options = {
        slowByPitch:
          body.slowByPitch !== undefined ? Boolean(body.slowByPitch) : true,
        speed:
          body.speed !== undefined
            ? Number(body.speed)
            : body.slowByPitch
              ? -2
              : 87,
        reverbMix: body.reverbMix !== undefined ? Number(body.reverbMix) : 35,
      };

      const reverbPath = await applySlowedReverb(stemPath, options, evt => {
        if (evt.outputPath) {
          jobService.updateJob(jobId, {
            status: "completed",
            reverbPath: evt.outputPath,
            resultPath: evt.outputPath,
          });
        }
        jobService.broadcastEvent(jobId, evt);
      });

      jobService.updateJob(jobId, {
        status: "completed",
        reverbPath,
        resultPath: reverbPath,
      });
    } catch (err) {
      jobService.updateJob(jobId, {
        status: "failed",
        error: err.message,
      });
      console.error(`[Job ${jobId}] Reverb failed:`, err.message);
    }
  })();

  return c.json({
    success: true,
    message: "Reverb processing started.",
    jobId,
  });
}

export function getStatus(c) {
  const jobId = c.req.param("jobId");
  const job = jobService.getJob(jobId);

  if (!job) {
    return c.json({ error: "Job not found." }, 404);
  }

  return c.json({
    id: job.id,
    originalName: job.originalName,
    status: job.status,
    history: job.history,
    resultPath: job.resultPath,
    stemPath: job.stemPath,
    reverbPath: job.reverbPath,
    error: job.error,
  });
}

function resolveTargetAudioPath(job, type) {
  if (type === "stem") {
    return job.stemPath && fs.existsSync(job.stemPath) ? job.stemPath : null;
  }
  if (type === "reverb") {
    return job.reverbPath && fs.existsSync(job.reverbPath)
      ? job.reverbPath
      : null;
  }
  if (job.reverbPath && fs.existsSync(job.reverbPath)) {
    return job.reverbPath;
  }
  if (job.stemPath && fs.existsSync(job.stemPath)) {
    return job.stemPath;
  }
  if (job.resultPath && fs.existsSync(job.resultPath)) {
    return job.resultPath;
  }
  return null;
}

export async function previewAudio(c) {
  const jobId = c.req.param("jobId");
  const type = c.req.query("type");
  const job = jobService.getJob(jobId);

  if (!job) {
    return c.json({ error: "Job not found." }, 404);
  }

  const targetPath = resolveTargetAudioPath(job, type);
  if (!targetPath) {
    return c.json({ error: "Audio file not found or has expired." }, 404);
  }

  const stat = await fs.promises.stat(targetPath);
  const fileSize = stat.size;
  const range = c.req.header("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(targetPath, { start, end });
    const { Readable } = await import("stream");

    return new Response(Readable.toWeb(stream), {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize.toString(),
        "Content-Type": "audio/mpeg",
      },
    });
  }

  const fileBuffer = await fs.promises.readFile(targetPath);
  return new Response(fileBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": fileSize.toString(),
      "Accept-Ranges": "bytes",
    },
  });
}

export async function downloadAudio(c) {
  const jobId = c.req.param("jobId");
  const type = c.req.query("type");
  const job = jobService.getJob(jobId);

  if (!job) {
    return c.json({ error: "Job not found." }, 404);
  }

  const targetPath = resolveTargetAudioPath(job, type);
  if (!targetPath) {
    return c.json({ error: "Audio file not found or has expired." }, 404);
  }

  const fileName = path.basename(targetPath);
  const fileBuffer = await fs.promises.readFile(targetPath);

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": fileBuffer.length.toString(),
    },
  });
}

export async function cleanupJob(c) {
  const jobId = c.req.param("jobId");
  const job = jobService.getJob(jobId);

  if (job) {
    const paths = [job.filePath, job.stemPath, job.reverbPath, job.resultPath];
    for (const p of paths) {
      try {
        if (p && fs.existsSync(p)) {
          await fs.promises.unlink(p);
        }
      } catch {}
    }
    jobService.jobs.delete(jobId);
  }

  const errScreen = path.join(config.downloadDir, "error-screenshot.png");
  const errSlowed = path.join(config.downloadDir, "slowed-error.png");
  try {
    if (fs.existsSync(errScreen)) await fs.promises.unlink(errScreen);
    if (fs.existsSync(errSlowed)) await fs.promises.unlink(errSlowed);
  } catch {}

  return c.json({ success: true });
}
