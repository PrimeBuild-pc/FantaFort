import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Redirect to the client app
    window.location.href = '/client/';
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      backgroundColor: '#121212',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#00F0B5' }}>FantaFort</h1>
        <p>Redirecting to the application...</p>
        <div style={{ marginTop: '20px' }}>
          <a 
            href="/client/" 
            style={{
              backgroundColor: '#2D0E75',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '4px',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            Click here if you are not redirected
          </a>
        </div>
      </div>
    </div>
  );
}
