// API entry point for Vercel deployment
export default function handler(req, res) {
  res.json({
    message: 'FantaFort API is running',
    version: '1.0.0',
    endpoints: [
      '/api/auth',
      '/api/team',
      '/api/team/players',
      '/api/team/:teamId/prize-pool',
      '/api/team/:teamId/prize-pool/toggle',
      '/api/team/:teamId/prize-pool/add',
      '/api/team/:teamId/prize-pool/transactions',
      '/api/health'
    ]
  });
}
