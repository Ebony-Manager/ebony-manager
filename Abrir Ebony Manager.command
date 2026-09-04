#!/bin/bash
cd "$(dirname "$0")"
echo "================================"
echo "  Ebony Manager — arrancando..."
echo "  Abre: http://localhost:3001"
echo "================================"
( sleep 2 && open http://localhost:3001 ) &
npm run dev
