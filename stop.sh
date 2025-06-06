#!/bin/bash

echo "Stopping services..."
kill -9 $(cat react.pid) 2>/dev/null
kill -9 $(cat fastapi.pid) 2>/dev/null
# rm -f react.pid fastapi.pid
echo "✅ All services terminated."
