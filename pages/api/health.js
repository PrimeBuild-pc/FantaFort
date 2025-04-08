// Simple health check API endpoint
export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    message: 'FantaFort API is running',
    version: '1.0.0'
  });
}
