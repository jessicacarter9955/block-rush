#!/usr/bin/env python3
"""Survival probe: appends a timestamp every 2s so we can see exactly
when/if the sandbox reaper kills detached python processes."""
import time

f = open('/home/z/my-project/download/bot-video/heartbeat.log', 'a')
f.write(f"=== started {time.strftime('%H:%M:%S')} pid\n")
f.flush()
while True:
    f.write(f"{time.strftime('%H:%M:%S')}\n")
    f.flush()
    time.sleep(2)
