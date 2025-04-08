import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create dist directory if it doesn't exist
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Copy API files
const apiFiles = ['api/index.js', 'api/auth-simple.js', 'api/team.js', 'api/prize-pool.js', 'api/supabase.js'];
apiFiles.forEach(file => {
  const destDir = path.dirname(path.join('dist', file));
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(file, path.join('dist', file));
});

// Create a simple index.html
const indexHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FantaFort</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #121212;
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background-color: #1E1E1E;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      max-width: 600px;
    }
    h1 {
      color: #00F0B5;
    }
    p {
      margin-bottom: 1.5rem;
    }
    .button {
      background-color: #2D0E75;
      color: white;
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      transition: background-color 0.3s;
    }
    .button:hover {
      background-color: #3A1C98;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>FantaFort API Server</h1>
    <p>The API server is running. This is a backend service for the FantaFort application.</p>
    <p>API endpoints are available at /api/*</p>
    <a href="https://github.com/PrimeBuild-pc/FantaFort" class="button">View on GitHub</a>
  </div>
</body>
</html>
`;

fs.writeFileSync('dist/index.html', indexHtml);

console.log('Build completed successfully!');
