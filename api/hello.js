// Simple API endpoint for Vercel deployment
module.exports = (req, res) => {
  res.status(200).json({
    message: 'Hello from FantaFort API!',
    version: '1.0.0'
  });
};
