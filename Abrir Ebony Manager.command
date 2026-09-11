#!/bin/bash
cd "$(dirname "$0")"
echo "================================"
echo "  Ebony Manager — arrancando..."
echo "  Abre: http://localhost:4001"
echo "================================"
( sleep 2 && open http://localhost:4001 ) &
npm run dev
