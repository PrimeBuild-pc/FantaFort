import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WebSocketMessage, WebSocketMessageType } from '@/lib/websocket-types';

// User interface for WebSocket authentication
interface User {
  id: number;
  username: string;
  coins: number;
  teamId: string | null;
}

interface WebSocketHookOptions {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  reconnectAttempts?: number;
}

export function useWebSocket(
  options: WebSocketHookOptions = {}
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<Event | null>(null);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);

  // Get the current user for authentication
  const { data: user } = useQuery<User>({
    queryKey: ['/api/user/current'],
    retry: false,
    refetchOnWindowFocus: false,
  });

  const {
    onOpen,
    onClose,
    onError,
    reconnectInterval = 3000,
    reconnectAttempts = 5
  } = options;

  const connect = useCallback(() => {
    // Clean up any existing socket
    if (socketRef.current) {
      socketRef.current.close();
    }

    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    // Create new WebSocket connection
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);
      reconnectCountRef.current = 0;

      if (onOpen) {
        onOpen();
      }
    };

    socket.onclose = (event) => {
      console.log('WebSocket disconnected', event);
      setIsConnected(false);

      if (onClose) {
        onClose();
      }

      // Attempt to reconnect if not a clean close and within reconnect attempts
      if (!event.wasClean && reconnectCountRef.current < reconnectAttempts) {
        reconnectCountRef.current += 1;

        if (reconnectTimerRef.current) {
          window.clearTimeout(reconnectTimerRef.current);
        }

        reconnectTimerRef.current = window.setTimeout(() => {
          console.log(`Attempting to reconnect (${reconnectCountRef.current}/${reconnectAttempts})`);
          connect();
        }, reconnectInterval);
      }
    };

    socket.onerror = (event) => {
      console.error('WebSocket error:', event);
      setError(event);

      if (onError) {
        onError(event);
      }
    };

    socket.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        console.log('WebSocket message received:', data);

        setMessages((prev) => [...prev, data]);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  }, [onOpen, onClose, onError, reconnectInterval, reconnectAttempts]);

  // Send message to WebSocket server
  const sendMessage = useCallback((type: WebSocketMessageType | string, payload: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type,
        payload,
        timestamp: Date.now()
      };
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Authenticate the WebSocket connection with current user
  const authenticate = useCallback(() => {
    if (user && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const userData = user as User;
      sendMessage('AUTHENTICATE', {
        userId: userData.id,
        timestamp: Date.now()
      });
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, [user, sendMessage]);

  // Reset messages array
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Connect on component mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }

      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  // Attempt to authenticate once user data is available and socket is connected
  useEffect(() => {
    if (user && isConnected && !isAuthenticated) {
      authenticate();
    }
  }, [user, isConnected, isAuthenticated, authenticate]);

  return {
    isConnected,
    isAuthenticated,
    error,
    messages,
    sendMessage,
    authenticate,
    clearMessages
  };
}