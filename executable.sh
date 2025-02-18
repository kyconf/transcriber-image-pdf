#!/bin/bash

# Navigate to the correct project directory
cd "/c/Users/Kyle/Desktop/project" || { echo "Directory not found!"; exit 1; }

# Run commands in background
echo "Starting frontend..."
npm run dev &

echo "Starting backend..."
npm run server &

echo "Running Python script..."
python app.py &

# Keep terminal open
wait
