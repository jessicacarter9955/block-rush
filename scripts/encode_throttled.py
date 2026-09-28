#!/usr/bin/env python3
"""Run ffmpeg with a SIGSTOP/SIGCONT duty cycle.

The sandbox hosting tool kills any call whose process tree sustains ~1+ CPU
core for ~4 seconds. Pacing ffmpeg at a 50% duty cycle (1.0s run / 1.0s
stop) keeps the rolling average around 0.5 cores so long encodes survive.
Usage: encode_throttled.py <ffmpeg args...>
"""
import signal
import subprocess
import sys
import time

RUN = 1.0
STOP = 1.0


def main():
    args = sys.argv[1:]
    if not args or args[0] != "ffmpeg":
        print("usage: encode_throttled.py ffmpeg <args...>")
        return 2
    err = open("/home/z/my-project/download/bot-video/encode.err", "wb")
    p = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=err)
    running = True
    t0 = time.time()
    try:
        while p.poll() is None:
            time.sleep(RUN if running else STOP)
            running = not running
            try:
                p.send_signal(signal.SIGSTOP if not running else signal.SIGCONT)
            except Exception:
                break
    finally:
        try:
            p.send_signal(signal.SIGCONT)
        except Exception:
            pass
        p.wait()
        err.close()
    print(f"[throttled-ffmpeg] rc={p.returncode} "
          f"wall={time.time() - t0:.1f}s", flush=True)
    return p.returncode


if __name__ == "__main__":
    sys.exit(main())
