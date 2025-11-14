import React, { useState, useRef } from 'react';
import axios from 'axios';
import PerlinAura from './PerlinAura';
import './Transcription.css';

const Transcription = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState('');
  const [aiResult, setAiResult] = useState(null);
  
  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

  // README: Put your deepgram API here:
  const DEEPGRAM_API_KEY = 'example';

  const startRecording = async () => {
    try {
      setError('');
      setTranscription('');
      setAiResult(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      streamRef.current = stream;
      
      // Deepgram WebSocket connection
      const socket = new WebSocket(
        'wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&smart_format=true',
        ['token', DEEPGRAM_API_KEY]
      );
      socketRef.current = socket;
      
      socket.onopen = () => {
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm'
        });
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
          }
        });
        mediaRecorder.start(250); // Send chunks every 250ms
        setIsRecording(true);
      };
      
      socket.onmessage = (message) => {
        const received = JSON.parse(message.data);
        const transcript = received.channel?.alternatives[0]?.transcript;
        if (transcript && transcript.trim().length > 0) {
          setTranscription(prev => prev + (prev === '' ? '' : ' ') + transcript);
        }
      };
      
      socket.onerror = (error) => {
        setError('WebSocket error: Check your Deepgram API key.');
      };
      socket.onclose = () => {};
    } catch (err) {
      setError('Failed to access microphone: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    if (socketRef.current) socketRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    setIsRecording(false);
  };

  // Send transcript to FastAPI for AI analysis
  const sendToAI = async () => {
    try {
      setError('');
      setAiResult({ loading: true });
      const response = await axios.post('http://localhost:8000/process_text', { text: transcription });
      setAiResult(response.data.data); // Store the parsed data object
    } catch (err) {
      setError('AI analysis failed: ' + (err.response?.data?.detail || err.message));
      setAiResult(null);
    }
  };

  return (
    <div className="transcription-container">
      {/* Perlin Noise Aura Background */}
      <PerlinAura 
        sentiment={aiResult?.sentiment || 'neutral'}
        sentimentScore={aiResult?.sentiment_score || 0.5}
        emotions={aiResult?.emotions || ['neutral']}
      />

      <div className="content-overlay">
        <h1>🎤 Real-Time Transcription</h1>
        
        <div className="controls">
          {!isRecording ? (
            <button onClick={startRecording} className="btn btn-primary">
              Start Recording
            </button>
          ) : (
            <button onClick={stopRecording} className="btn btn-danger">
              Stop Recording
            </button>
          )}
        </div>

        <button
          onClick={sendToAI}
          className="btn btn-secondary"
          disabled={!transcription}
          style={{ marginBottom: '15px' }}
        >
          Send to AI
        </button>

        {error && <p className="error">{error}</p>}

        <div className="transcription-box">
          <h2>Transcription:</h2>
          <p>{transcription || 'Click "Start Recording" and start speaking...'}</p>
        </div>

        {aiResult && !aiResult.loading && (
          <>
            <div className="sentiment-display">
              <h2>Sentiment Analysis:</h2>
              <div className="sentiment-card" style={{
                backgroundColor: `rgba(${
                  aiResult.sentiment === 'positive' ? '72, 187, 120' :
                  aiResult.sentiment === 'negative' ? '245, 101, 101' :
                  '160, 174, 192'
                }, 0.2)`,
                border: `2px solid ${
                  aiResult.sentiment === 'positive' ? '#48bb78' :
                  aiResult.sentiment === 'negative' ? '#f56565' :
                  '#a0aec0'
                }`,
                padding: '20px',
                borderRadius: '10px',
                marginBottom: '15px'
              }}>
                <p><strong>Sentiment:</strong> {aiResult.sentiment}</p>
                <p><strong>Confidence:</strong> {(aiResult.sentiment_score * 100).toFixed(1)}%</p>
                <p><strong>Emotions:</strong> {aiResult.emotions.join(', ')}</p>
              </div>
            </div>

            <div className="keywords-display">
              <h2>Keywords:</h2>
              <div className="keywords-container">
                {aiResult.keywords.map((keyword, index) => (
                  <span 
                    key={index} 
                    className="keyword-tag"
                    style={{
                      animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`
                    }}
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {aiResult?.loading && (
          <div className="loading">
            <p>Analyzing...</p>
          </div>
        )}

        <button
          onClick={() => { setTranscription(''); setAiResult(null); }}
          className="btn btn-clear"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default Transcription;