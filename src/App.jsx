import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [timeLeft, setTimeLeft] = useState(25 * 60) // 25 minutes in seconds
  const [isRunning, setIsRunning] = useState(false)
  const [isBreak, setIsBreak] = useState(false)
  const [sessions, setSessions] = useState(0)
  const [mode, setMode] = useState('work') // 'work', 'shortBreak', 'longBreak'
  const [audioSettings, setAudioSettings] = useState({
    frequency: 800,
    duration: 0.3,
    volume: 0.4,
    beepCount: 3,
    beepGap: 400
  })
  const [customAudio, setCustomAudio] = useState(null)
  const [audioType, setAudioType] = useState('synthesized') // 'synthesized' or 'custom'
  const [audioFileName, setAudioFileName] = useState('')
  const [isTestPlaying, setIsTestPlaying] = useState(false)
  const [testAudioContext, setTestAudioContext] = useState(null)
  const intervalRef = useRef(null)

  const workTime = 25 * 60 // 25 minutes
  const shortBreakTime = 5 * 60 // 5 minutes
  const longBreakTime = 15 * 60 // 15 minutes

  // Load saved audio on component mount
  useEffect(() => {
    loadAudioFromStorage()
  }, [])

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            // Timer finished
            clearInterval(intervalRef.current)
            setIsRunning(false)
            
            // Play notification sound
            playNotification()
            
            // Handle session completion
            if (mode === 'work') {
              const newSessions = sessions + 1
              setSessions(newSessions)
              
              // Every 4 sessions, take a long break
              if (newSessions % 4 === 0) {
                setMode('longBreak')
                setTimeLeft(longBreakTime)
                setIsBreak(true)
              } else {
                setMode('shortBreak')
                setTimeLeft(shortBreakTime)
                setIsBreak(true)
              }
            } else {
              // Break finished, start work session
              setMode('work')
              setTimeLeft(workTime)
              setIsBreak(false)
            }
            
            return prevTime
          }
          return prevTime - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }

    return () => clearInterval(intervalRef.current)
  }, [isRunning, mode, sessions])

  const playNotification = () => {
    // Method 1: Browser Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      const message = isBreak ? 'Break time is over! Time to work!' : 'Work session complete! Take a break!'
      new Notification('🍅 Tomato Clock', {
        body: message,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50" font-size="50">🍅</text></svg>',
        requireInteraction: true,
        silent: false
      })
    }

    // Method 2: Audio notification (enhanced)
    try {
      if (audioType === 'custom' && customAudio) {
        // Play custom uploaded audio
        customAudio.volume = audioSettings.volume
        customAudio.currentTime = 0
        customAudio.play()
      } else {
        // Play synthesized beeps
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        
        // Play multiple beeps for better attention
        for (let i = 0; i < audioSettings.beepCount; i++) {
          setTimeout(() => {
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()
            
            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)
            
            oscillator.frequency.setValueAtTime(audioSettings.frequency, audioContext.currentTime)
            oscillator.frequency.setValueAtTime(audioSettings.frequency * 0.75, audioContext.currentTime + 0.1)
            oscillator.frequency.setValueAtTime(audioSettings.frequency, audioContext.currentTime + 0.2)
            
            gainNode.gain.setValueAtTime(audioSettings.volume, audioContext.currentTime)
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + audioSettings.duration)
            
            oscillator.start(audioContext.currentTime)
            oscillator.stop(audioContext.currentTime + audioSettings.duration)
          }, i * audioSettings.beepGap)
        }
      }
    } catch (error) {
      console.log('Audio notification failed:', error)
    }

    // Method 3: Visual notification (page title flash)
    let flashCount = 0
    const originalTitle = document.title
    const flashInterval = setInterval(() => {
      document.title = flashCount % 2 === 0 ? '🔔 TIMER COMPLETE! 🔔' : originalTitle
      flashCount++
      if (flashCount > 10) {
        clearInterval(flashInterval)
        document.title = originalTitle
      }
    }, 500)

    // Method 4: Request notification permission if not granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  const testAudio = () => {
    if (isTestPlaying) {
      // Stop test audio
      if (testAudioContext) {
        testAudioContext.close()
        setTestAudioContext(null)
      }
      if (customAudio) {
        customAudio.pause()
        customAudio.currentTime = 0
      }
      setIsTestPlaying(false)
      return
    }

    // Start test audio
    setIsTestPlaying(true)
    
    try {
      if (audioType === 'custom' && customAudio) {
        // Test custom uploaded audio
        customAudio.volume = audioSettings.volume
        customAudio.currentTime = 0
        customAudio.play()
        
        // Auto-stop after audio ends
        customAudio.onended = () => {
          setIsTestPlaying(false)
        }
      } else {
        // Test synthesized beeps
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        setTestAudioContext(audioContext)
        
        // Play multiple beeps for testing
        for (let i = 0; i < audioSettings.beepCount; i++) {
          setTimeout(() => {
            if (!isTestPlaying) return // Stop if user clicked stop
            
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()
            
            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)
            
            oscillator.frequency.setValueAtTime(audioSettings.frequency, audioContext.currentTime)
            oscillator.frequency.setValueAtTime(audioSettings.frequency * 0.75, audioContext.currentTime + 0.1)
            oscillator.frequency.setValueAtTime(audioSettings.frequency, audioContext.currentTime + 0.2)
            
            gainNode.gain.setValueAtTime(audioSettings.volume, audioContext.currentTime)
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + audioSettings.duration)
            
            oscillator.start(audioContext.currentTime)
            oscillator.stop(audioContext.currentTime + audioSettings.duration)
          }, i * audioSettings.beepGap)
        }
        
        // Auto-stop after all beeps
        setTimeout(() => {
          setIsTestPlaying(false)
          setTestAudioContext(null)
        }, (audioSettings.beepCount * audioSettings.beepGap) + (audioSettings.duration * 1000))
      }
    } catch (error) {
      console.log('Test audio failed:', error)
      setIsTestPlaying(false)
    }
  }

  const startTimer = () => {
    setIsRunning(true)
  }

  const pauseTimer = () => {
    setIsRunning(false)
  }

  const resetTimer = () => {
    setIsRunning(false)
    setSessions(0)
    setMode('work')
    setTimeLeft(workTime)
    setIsBreak(false)
  }

  const skipTimer = () => {
    setIsRunning(false)
    if (mode === 'work') {
      const newSessions = sessions + 1
      setSessions(newSessions)
      
      if (newSessions % 4 === 0) {
        setMode('longBreak')
        setTimeLeft(longBreakTime)
        setIsBreak(true)
      } else {
        setMode('shortBreak')
        setTimeLeft(shortBreakTime)
        setIsBreak(true)
      }
    } else {
      setMode('work')
      setTimeLeft(workTime)
      setIsBreak(false)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getProgress = () => {
    const totalTime = mode === 'work' ? workTime : mode === 'shortBreak' ? shortBreakTime : longBreakTime
    return ((totalTime - timeLeft) / totalTime) * 100
  }

  const getStrokeDashoffset = () => {
    const progress = getProgress()
    const circumference = 2 * Math.PI * 140
    return (1 - progress / 100) * circumference
  }

  const saveAudioToStorage = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const audioData = {
            name: file.name,
            type: file.type,
            size: file.size,
            data: reader.result,
            timestamp: Date.now()
          }
          localStorage.setItem('tomatoClockCustomAudio', JSON.stringify(audioData))
          resolve(audioData)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const loadAudioFromStorage = () => {
    try {
      const savedAudio = localStorage.getItem('tomatoClockCustomAudio')
      if (savedAudio) {
        const audioData = JSON.parse(savedAudio)
        const audio = new Audio(audioData.data)
        
        audio.addEventListener('loadeddata', () => {
          setCustomAudio(audio)
          setAudioFileName(audioData.name)
          setAudioType('custom')
        })
        
        audio.addEventListener('error', () => {
          console.log('Error loading saved audio, clearing storage')
          localStorage.removeItem('tomatoClockCustomAudio')
        })
      }
    } catch (error) {
      console.log('Error loading saved audio:', error)
      localStorage.removeItem('tomatoClockCustomAudio')
    }
  }

  const handleAudioUpload = async (event) => {
    const file = event.target.files[0]
    if (file) {
      // Check if it's an audio file
      if (!file.type.startsWith('audio/')) {
        alert('Please select an audio file (MP3, WAV, OGG, etc.)')
        return
      }
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB')
        return
      }
      
      try {
        // Save to localStorage
        await saveAudioToStorage(file)
        
        // Create audio object
        const audioUrl = URL.createObjectURL(file)
        const audio = new Audio(audioUrl)
        
        audio.addEventListener('loadeddata', () => {
          setCustomAudio(audio)
          setAudioFileName(file.name)
          setAudioType('custom')
        })
        
        audio.addEventListener('error', () => {
          alert('Error loading audio file. Please try a different file.')
        })
      } catch (error) {
        alert('Error saving audio file. Please try again.')
        console.error('Audio save error:', error)
      }
    }
  }

  const clearCustomAudio = () => {
    setCustomAudio(null)
    setAudioFileName('')
    setAudioType('synthesized')
    localStorage.removeItem('tomatoClockCustomAudio')
  }

  return (
    <div className="app">
      <div className="container">
        <h1 className="title">🍅 Tomato Clock</h1>
        
        <div className="mode-indicator">
          <span className={`mode ${mode === 'work' ? 'active' : ''}`}>Work</span>
          <span className={`mode ${mode === 'shortBreak' ? 'active' : ''}`}>Short Break</span>
          <span className={`mode ${mode === 'longBreak' ? 'active' : ''}`}>Long Break</span>
        </div>

        <div className="timer-container">
          <div className="timer-circle">
            <svg className="progress-ring" width="300" height="300">
              <circle
                className="progress-ring-circle-bg"
                stroke="#e0e0e0"
                strokeWidth="12"
                fill="transparent"
                r="140"
                cx="150"
                cy="150"
              />
              <circle
                className="progress-ring-circle"
                stroke={isBreak ? "#4CAF50" : "#FF6B6B"}
                strokeWidth="12"
                fill="transparent"
                r="140"
                cx="150"
                cy="150"
                strokeDasharray={2 * Math.PI * 140}
                strokeDashoffset={getStrokeDashoffset()}
                strokeLinecap="round"
                transform="rotate(-90 150 150)"
                key={`progress-${timeLeft}`}
              />
            </svg>
            <div className="timer-display">
              <div className="time">{formatTime(timeLeft)}</div>
              <div className="status">{isBreak ? 'Break Time!' : 'Focus Time!'}</div>
            </div>
          </div>
        </div>

        <div className="controls">
          {!isRunning ? (
            <button className="btn btn-start" onClick={startTimer}>
              ▶️ Start
            </button>
          ) : (
            <button className="btn btn-pause" onClick={pauseTimer}>
              ⏸️ Pause
            </button>
          )}
          <button className="btn btn-reset" onClick={resetTimer}>
            🔄 Reset
          </button>
          <button className="btn btn-skip" onClick={skipTimer}>
            ⏭️ Skip
          </button>
        </div>

        <div className="stats">
          <div className="stat">
            <span className="stat-label">Sessions Completed:</span>
            <span className="stat-value">{sessions}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Current Mode:</span>
            <span className="stat-value">{mode === 'work' ? 'Work' : mode === 'shortBreak' ? 'Short Break' : 'Long Break'}</span>
          </div>
        </div>

        <div className="info">
          <h3>How to use:</h3>
          <ul>
            <li>Work for 25 minutes, then take a 5-minute break</li>
            <li>After 4 work sessions, take a 15-minute long break</li>
            <li>Stay focused during work time!</li>
          </ul>
          
          <div className="notification-section">
            <h4>🔔 Notifications</h4>
            <p>Get notified when your timer completes!</p>
            {Notification.permission === 'default' && (
              <button 
                className="btn btn-notification" 
                onClick={() => Notification.requestPermission()}
              >
                Enable Notifications
              </button>
            )}
            {Notification.permission === 'granted' && (
              <p className="notification-status">✅ Notifications enabled</p>
            )}
            {Notification.permission === 'denied' && (
              <p className="notification-status">❌ Notifications blocked - check browser settings</p>
            )}
            
            <div className="audio-settings">
              <h5>🎵 Audio Settings</h5>
              
              <div className="audio-type-selector">
                <label>
                  <input 
                    type="radio" 
                    name="audioType" 
                    value="synthesized"
                    checked={audioType === 'synthesized'}
                    onChange={(e) => setAudioType(e.target.value)}
                  />
                  Synthesized Beeps
                </label>
                <label>
                  <input 
                    type="radio" 
                    name="audioType" 
                    value="custom"
                    checked={audioType === 'custom'}
                    onChange={(e) => setAudioType(e.target.value)}
                  />
                  Custom Audio File
                </label>
              </div>

              {audioType === 'synthesized' && (
                <>
                  <div className="setting-group">
                    <label>Frequency (Hz): {audioSettings.frequency}</label>
                    <input 
                      type="range" 
                      min="200" 
                      max="2000" 
                      value={audioSettings.frequency}
                      onChange={(e) => setAudioSettings(prev => ({...prev, frequency: parseInt(e.target.value)}))}
                    />
                  </div>
                  <div className="setting-group">
                    <label>Beep Count: {audioSettings.beepCount}</label>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={audioSettings.beepCount}
                      onChange={(e) => setAudioSettings(prev => ({...prev, beepCount: parseInt(e.target.value)}))}
                    />
                  </div>
                  <div className="setting-group">
                    <label>Beep Gap (ms): {audioSettings.beepGap}</label>
                    <input 
                      type="range" 
                      min="100" 
                      max="1000" 
                      step="100"
                      value={audioSettings.beepGap}
                      onChange={(e) => setAudioSettings(prev => ({...prev, beepGap: parseInt(e.target.value)}))}
                    />
                  </div>
                </>
              )}

              {audioType === 'custom' && (
                <div className="custom-audio-section">
                  <div className="file-upload">
                    <label htmlFor="audio-upload" className="btn btn-upload">
                      📁 Choose Audio File
                    </label>
                    <input 
                      id="audio-upload"
                      type="file" 
                      accept="audio/*"
                      onChange={handleAudioUpload}
                      style={{ display: 'none' }}
                    />
                  </div>
                  {customAudio && (
                    <div className="audio-info">
                      <p>✅ Custom audio loaded</p>
                      <p className="audio-file-name">File: {audioFileName}</p>
                      <p className="audio-duration">
                        Duration: {Math.round(customAudio.duration || 0)}s
                      </p>
                      <button 
                        className="btn btn-clear-audio" 
                        onClick={clearCustomAudio}
                      >
                        🗑️ Remove Audio
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="setting-group">
                <label>Volume: {Math.round(audioSettings.volume * 100)}%</label>
                <input 
                  type="range" 
                  min="0.1" 
                  max="1" 
                  step="0.1"
                  value={audioSettings.volume}
                  onChange={(e) => setAudioSettings(prev => ({...prev, volume: parseFloat(e.target.value)}))}
                />
              </div>

              <button 
                className={`btn ${isTestPlaying ? 'btn-stop-audio' : 'btn-test-audio'}`}
                onClick={testAudio}
              >
                {isTestPlaying ? '⏹️ Stop Audio' : '🔊 Test Audio'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
