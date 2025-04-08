// Simple API endpoint for Vercel deployment
export default function handler(req, res) {
  res.status(200).json({
    message: 'Hello from FantaFort API!',
    version: '1.0.0'
  });
};
