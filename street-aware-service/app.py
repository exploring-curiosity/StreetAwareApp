#!/usr/bin/env python3

import os
import asyncio

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Relative path to your SSH script
SCRIPT_PATH = os.path.normpath("../StreetAwareScripts/ssh_multiple_run_script.py")

# Holds the currently running subprocess
current_proc = None

def _terminate_current():
    """Terminate the child if still running."""
    global current_proc
    if current_proc and current_proc.returncode is None:
        current_proc.terminate()
        current_proc = None

@app.on_event("shutdown")
def cleanup_child():
    """Called when the FastAPI app is shutting down (e.g. on Ctrl-C)."""
    _terminate_current()

async def run_ssh_script(timeout: int):
    """
    Launch the SSH script in unbuffered mode and yield each stdout line.
    """
    global current_proc
    proc = await asyncio.create_subprocess_exec(
        "python3", "-u", SCRIPT_PATH,
        "--timeout", str(timeout),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    current_proc = proc
    try:
        # Read and yield lines as they appear
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            yield line.decode(errors="replace").rstrip()
    finally:
        await proc.wait()
        current_proc = None

@app.get("/start-ssh/logs")
async def stream_logs(timeout: int = Query(600, ge=1)):
    """
    SSE endpoint:
      • sends a huge retry so the client won’t auto-reconnect
      • streams each log line as `data: …`
      • emits a custom `end` event when done
    """
    async def event_generator():
        # keep-alive and prevent auto-reconnect
        yield "retry: 2147483647\n\n"

        # stream log data
        async for log_line in run_ssh_script(timeout):
            yield f"data: {log_line}\n\n"

        # signal the client we’re done
        yield "event: end\n"
        yield "data:\n\n"

    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )

@app.post("/start-ssh/stop")
def stop_script():
    """
    Manually terminate the SSH script if it’s running.
    """
    if current_proc and current_proc.returncode is None:
        current_proc.terminate()
        return {"status": "stopping"}
    raise HTTPException(status_code=404, detail="No active process to stop")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=False
    )
