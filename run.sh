#!/bin/bash

rm -f react.pid fastapi.pid fastapi.log react.log

echo "Starting React App..."
nohup bash -c "cd street-aware-app && npm start" > react.log 2>&1 & echo $! > react.pid

echo "Starting FastAPI Service..."
nohup bash -c "cd street-aware-service && source myenv/bin/activate && python app.py" > fastapi.log 2>&1 & echo $! > fastapi.pid

echo "✅ Services started in background. Use ./stop.sh to terminate them."
