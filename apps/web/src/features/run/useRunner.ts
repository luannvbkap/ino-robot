import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ProgramRunner,
  SimRobot,
  type RobotState,
  type RunnerStatus,
  type Speed,
} from '@ino/sim-core';

import type { BlocklyApi } from '@/features/blockly/BlocklyCanvas';

export type OutputKind = 'print' | 'warning' | 'error' | 'system';

export interface OutputLine {
  id: number;
  kind: OutputKind;
  text: string;
}

const EMPTY_STATE: RobotState = { x: 0, z: 0, heading: 0, left: 0, right: 0, time: 0 };

/** Không vẽ lại trạng thái 60 lần/giây — mắt không theo kịp mà máy thì tốn */
const REDRAW_EVERY_FRAMES = 6;

/** Giữ tối đa bấy nhiêu dòng thông báo, tránh chương trình in ra vô tận làm đầy bộ nhớ */
const MAX_OUTPUT_LINES = 300;

export function useRunner(api: BlocklyApi | null) {
  const [status, setStatus] = useState<RunnerStatus>('idle');
  const [speed, setSpeedState] = useState<Speed>('normal');
  const [robotState, setRobotState] = useState<RobotState>(EMPTY_STATE);
  const [output, setOutput] = useState<OutputLine[]>([]);

  const runnerRef = useRef<ProgramRunner | null>(null);
  const frameCount = useRef(0);
  const lineId = useRef(0);

  const addLine = useCallback((kind: OutputKind, text: string) => {
    setOutput((lines) => {
      const next = [...lines, { id: lineId.current++, kind, text }];
      return next.length > MAX_OUTPUT_LINES ? next.slice(-MAX_OUTPUT_LINES) : next;
    });
  }, []);

  /* --------------------------- Điều khiển --------------------------- */

  const start = useCallback(() => {
    if (!api) return;

    runnerRef.current?.stop();
    setOutput([]);
    setRobotState(EMPTY_STATE);
    frameCount.current = 0;

    const robot = new SimRobot({
      onPrint: (text) => addLine('print', text),
      onWarning: (text) => addLine('warning', text),
    });

    const runner = new ProgramRunner({
      robot,
      code: api.generateJs(),
      speed,
      onStatus: (next) => {
        setStatus(next);
        if (next === 'finished') addLine('system', 'Chương trình đã chạy xong.');
      },
      onHighlight: (blockId) => api.highlight(blockId),
      onError: (message) => addLine('error', message),
      onFrame: (state) => {
        frameCount.current += 1;
        if (frameCount.current % REDRAW_EVERY_FRAMES === 0) setRobotState({ ...state });
      },
    });

    runnerRef.current = runner;
    runner.start();
  }, [api, speed, addLine]);

  const pause = useCallback(() => runnerRef.current?.pause(), []);
  const resume = useCallback(() => runnerRef.current?.resume(), []);

  const stop = useCallback(() => {
    runnerRef.current?.stop();
    setRobotState(EMPTY_STATE);
    api?.highlight(null);
  }, [api]);

  const setSpeed = useCallback((next: Speed) => {
    setSpeedState(next);
    runnerRef.current?.setSpeed(next);
  }, []);

  /** Dừng chương trình khi rời khỏi màn hình soạn thảo */
  useEffect(() => () => runnerRef.current?.stop(), []);

  return {
    status,
    speed,
    robotState,
    output,
    isRunning: status === 'running',
    isPaused: status === 'paused',
    canRun: Boolean(api?.hasProgram()),
    start,
    pause,
    resume,
    stop,
    setSpeed,
  };
}
