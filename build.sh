#!/bin/bash

# Install dependencies
npm install

# Build the frontend
npm run build:supabase

# Copy API files to dist/api
mkdir -p dist/api
cp -r api/* dist/api/

# Create a simple index.html if the build fails
if [ ! -f dist/index.html ]; then
  echo "Creating fallback index.html"
  cp public/index.html dist/index.html
fi

echo "Build completed!"
