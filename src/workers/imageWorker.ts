/// <reference lib="webworker" />

import {
  createWorkerPipelineEnvironment,
  runPipelineWithEnv,
  type PipelineOptions,
  type PipelineProgress,
} from "../lib/imagePipelineCore";

interface PipelineMessage {
  type: "pipeline";
  bitmap: ImageBitmap;
  options?: PipelineOptions;
  orientation?: number;
}

interface PipelineResultMessage {
  type: "result";
  ok: true;
  base64: string;
  width: number;
  height: number;
}

interface PipelineErrorMessage {
  type: "error";
  ok: false;
  message: string;
}

interface PipelineProgressMessage {
  type: "progress";
  value: number;
  stage?: string;
  note?: string;
}

type WorkerResponse = PipelineResultMessage | PipelineErrorMessage | PipelineProgressMessage;

declare const self: DedicatedWorkerGlobalScope;

const env = createWorkerPipelineEnvironment();

self.addEventListener("message", async (event: MessageEvent<PipelineMessage>) => {
  const data = event.data;
  if (!data || data.type !== "pipeline") {
    return;
  }

  try {
    const result = await runPipelineWithEnv(
      { bitmap: data.bitmap, orientation: data.orientation },
      data.options,
      env,
      postProgress,
    );
    if (result.bitmap) {
      result.bitmap.close();
    }

    const message: PipelineResultMessage = {
      type: "result",
      ok: true,
      base64: result.base64,
      width: result.width,
      height: result.height,
    };
    self.postMessage(message as WorkerResponse);
  } catch (error) {
    const message: PipelineErrorMessage = {
      type: "error",
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(message as WorkerResponse);
  }
});

function postProgress(progress: PipelineProgress) {
  const message: PipelineProgressMessage = {
    type: "progress",
    value: progress.value,
    stage: progress.stage,
    note: progress.note,
  };
  self.postMessage(message as WorkerResponse);
}
