#!/bin/bash
cd "$(dirname "$0")/dist"
echo "================================"
echo "  Ebony Manager — arrancando..."
echo "  Abre: http://localhost:8080"
echo "================================"
open http://localhost:8080
python3 -m http.server 8080
