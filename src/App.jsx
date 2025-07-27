import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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
  const [audioContextInitialized, setAudioContextInitialized] = useState(false)
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false)
  const [currentAlarmAudio, setCurrentAlarmAudio] = useState(null)
  const [alarmTimeouts, setAlarmTimeouts] = useState([])
  
  // High-precision timing refs
  const startTimeRef = useRef(null)
  const initialDurationRef = useRef(null)
  const animationFrameRef = useRef(null)
  const lastUpdateRef = useRef(0)

  const workTime = 25 * 60 // 25 minutes
  const shortBreakTime = 5 * 60 // 5 minutes
  const longBreakTime = 15 * 60 // 15 minutes

  // Load saved audio on component mount
  useEffect(() => {
    loadAudioFromStorage()
  }, [])

  // Initialize audio context on first user interaction
  const initializeAudioContext = useCallback(() => {
    if (!audioContextInitialized) {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        
        if (audioContext.state === 'suspended') {
          audioContext.resume().then(() => {
            setAudioContextInitialized(true)
            console.log('Audio context initialized and resumed')
          }).catch(error => {
            console.log('Failed to resume audio context:', error)
          })
        } else {
          setAudioContextInitialized(true)
          console.log('Audio context initialized')
        }
      } catch (error) {
        console.log('Failed to initialize audio context:', error)
      }
    }
  }, [audioContextInitialized])

  // High-precision timer using requestAnimationFrame + Date.now()
  const updateTimer = useCallback(() => {
    if (!isRunning || !startTimeRef.current || !initialDurationRef.current) {
      return
    }

    const now = Date.now()
    const elapsed = Math.floor((now - startTimeRef.current) / 1000)
    const newTimeLeft = Math.max(0, initialDurationRef.current - elapsed)
    
    // Only update state if time actually changed (reduces re-renders)
    if (newTimeLeft !== lastUpdateRef.current) {
      lastUpdateRef.current = newTimeLeft
      setTimeLeft(newTimeLeft)
      
      // Check if timer finished
      if (newTimeLeft <= 0) {
        handleTimerComplete()
        return
      }
    }
    
    // Continue the high-precision timer
    animationFrameRef.current = requestAnimationFrame(updateTimer)
  }, [isRunning])

  // Handle timer completion
  const handleTimerComplete = useCallback(() => {
    setIsRunning(false)
    startTimeRef.current = null
    initialDurationRef.current = null
    
    // Play notification sound
    playNotification()
    
    // Handle session completion
    if (mode === 'work') {
      setSessions(prevSessions => {
        const newSessions = prevSessions + 1
        
        // Schedule the mode change
        setTimeout(() => {
          if (newSessions % 4 === 0) {
            setMode('longBreak')
            setTimeLeft(longBreakTime)
            setIsBreak(true)
          } else {
            setMode('shortBreak')
            setTimeLeft(shortBreakTime)
            setIsBreak(true)
          }
        }, 100) // Small delay to ensure state is updated
        
        return newSessions
      })
    } else {
      // Break finished, start work session
      setMode('work')
      setTimeLeft(workTime)
      setIsBreak(false)
    }
  }, [mode, sessions, longBreakTime, shortBreakTime, workTime])

  // Start high-precision timer when isRunning changes
  useEffect(() => {
    if (isRunning) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now()
        initialDurationRef.current = timeLeft
        lastUpdateRef.current = timeLeft
      }
      
      // Start the high-precision timer
      animationFrameRef.current = requestAnimationFrame(updateTimer)
    } else {
      // Cancel the timer
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isRunning, updateTimer])

  const stopAlarm = useCallback(() => {
    setIsAlarmPlaying(false)
    
    if (currentAlarmAudio) {
      currentAlarmAudio.pause()
      currentAlarmAudio.currentTime = 0
      setCurrentAlarmAudio(null)
    }
    
    alarmTimeouts.forEach(timeout => clearTimeout(timeout))
    setAlarmTimeouts([])
    
    if (testAudioContext) {
      testAudioContext.close().catch(() => {})
      setTestAudioContext(null)
    }
  }, [currentAlarmAudio, alarmTimeouts, testAudioContext])

  const playNotification = useCallback(() => {
    setIsAlarmPlaying(true)
    
    // Browser Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      const message = isBreak ? 'Break time is over! Time to work!' : 'Work session complete! Take a break!'
      new Notification('🍅 Tomato Clock', {
        body: message,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50" font-size="50">🍅</text></svg>',
        requireInteraction: true,
        silent: false
      })
    }

    // Audio notification
    const playAudio = async () => {
      try {
        if (audioType === 'custom' && customAudio) {
          const audioClone = customAudio.cloneNode()
          audioClone.volume = audioSettings.volume
          audioClone.currentTime = 0
          setCurrentAlarmAudio(audioClone)
          
          audioClone.onended = () => {
            setIsAlarmPlaying(false)
            setCurrentAlarmAudio(null)
          }
          
          await audioClone.play()
        } else {
          await playSynthesizedAudio(true)
        }
      } catch (error) {
        console.log('Audio failed, trying fallback:', error)
        playFallbackAudio(true)
      }
    }

    playAudio()

    // Visual notification (page title flash)
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

    // Request notification permission if not granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [isBreak, audioType, customAudio, audioSettings])

  const playSynthesizedAudio = async (isAlarm = false) => {
    try {
      if (!audioContextInitialized) {
        initializeAudioContext()
      }

      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      
      if (isAlarm) {
        setTestAudioContext(audioContext)
      }
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      
      const timeouts = []
      
      for (let i = 0; i < audioSettings.beepCount; i++) {
        const timeout = setTimeout(() => {
          if (isAlarm && !isAlarmPlaying) return
          
          try {
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
          } catch (error) {
            console.log('Oscillator failed:', error)
          }
        }, i * audioSettings.beepGap)
        
        timeouts.push(timeout)
      }
      
      if (isAlarm) {
        setAlarmTimeouts(timeouts)
        
        const stopTimeout = setTimeout(() => {
          setIsAlarmPlaying(false)
          setTestAudioContext(null)
        }, (audioSettings.beepCount * audioSettings.beepGap) + (audioSettings.duration * 1000))
        
        setAlarmTimeouts(prev => [...prev, stopTimeout])
      }
    } catch (error) {
      console.log('Synthesized audio failed:', error)
      throw error
    }
  }

  const playFallbackAudio = (isAlarm = false) => {
    try {
      const beepData = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT'
      const audio = new Audio(beepData)
      audio.volume = audioSettings.volume
      
      if (isAlarm) {
        setCurrentAlarmAudio(audio)
      }
      
      const timeouts = []
      
      for (let i = 0; i < audioSettings.beepCount; i++) {
        const timeout = setTimeout(() => {
          if (isAlarm && !isAlarmPlaying) return
          audio.currentTime = 0
          audio.play().catch(e => console.log('Fallback audio failed:', e))
        }, i * audioSettings.beepGap)
        
        timeouts.push(timeout)
      }
      
      if (isAlarm) {
        setAlarmTimeouts(timeouts)
        
        const stopTimeout = setTimeout(() => {
          setIsAlarmPlaying(false)
          setCurrentAlarmAudio(null)
        }, (audioSettings.beepCount * audioSettings.beepGap) + 1000)
        
        setAlarmTimeouts(prev => [...prev, stopTimeout])
      }
    } catch (error) {
      console.log('Fallback audio failed:', error)
      if (isAlarm) {
        setIsAlarmPlaying(false)
      }
    }
  }

  const testAudio = async () => {
    if (isTestPlaying) {
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

    setIsTestPlaying(true)
    
    try {
      if (audioType === 'custom' && customAudio) {
        customAudio.volume = audioSettings.volume
        customAudio.currentTime = 0
        await customAudio.play()
        
        customAudio.onended = () => {
          setIsTestPlaying(false)
        }
      } else {
        await testSynthesizedAudio()
      }
    } catch (error) {
      console.log('Test audio failed, trying fallback:', error)
      testFallbackAudio()
    }
  }

  const testSynthesizedAudio = async () => {
    try {
      if (!audioContextInitialized) {
        initializeAudioContext()
      }

      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      setTestAudioContext(audioContext)
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      
      for (let i = 0; i < audioSettings.beepCount; i++) {
        setTimeout(() => {
          if (!isTestPlaying) return
          
          try {
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
          } catch (error) {
            console.log('Test oscillator failed:', error)
          }
        }, i * audioSettings.beepGap)
      }
      
      setTimeout(() => {
        setIsTestPlaying(false)
        setTestAudioContext(null)
      }, (audioSettings.beepCount * audioSettings.beepGap) + (audioSettings.duration * 1000))
    } catch (error) {
      console.log('Test synthesized audio failed:', error)
      throw error
    }
  }

  const testFallbackAudio = () => {
    try {
      const beepData = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT'
      const audio = new Audio(beepData)
      audio.volume = audioSettings.volume
      
      for (let i = 0; i < audioSettings.beepCount; i++) {
        setTimeout(() => {
          if (!isTestPlaying) return
          audio.currentTime = 0
          audio.play().catch(e => console.log('Test fallback audio failed:', e))
        }, i * audioSettings.beepGap)
      }
      
      setTimeout(() => {
        setIsTestPlaying(false)
      }, (audioSettings.beepCount * audioSettings.beepGap) + 1000)
    } catch (error) {
      console.log('Test fallback audio failed:', error)
      setIsTestPlaying(false)
    }
  }

  const startTimer = useCallback(() => {
    setIsRunning(true)
  }, [])

  const pauseTimer = useCallback(() => {
    setIsRunning(false)
  }, [])

  const resetTimer = useCallback(() => {
    setIsRunning(false)
    setSessions(0)
    setMode('work')
    setTimeLeft(workTime)
    setIsBreak(false)
    stopAlarm()
    startTimeRef.current = null
    initialDurationRef.current = null
  }, [workTime, stopAlarm])

  const skipTimer = useCallback(() => {
    setIsRunning(false)
    stopAlarm()
    startTimeRef.current = null
    initialDurationRef.current = null
    
    if (mode === 'work') {
      setSessions(prevSessions => {
        const newSessions = prevSessions + 1
        
        setTimeout(() => {
          if (newSessions % 4 === 0) {
            setMode('longBreak')
            setTimeLeft(longBreakTime)
            setIsBreak(true)
          } else {
            setMode('shortBreak')
            setTimeLeft(shortBreakTime)
            setIsBreak(true)
          }
        }, 0)
        
        return newSessions
      })
    } else {
      setMode('work')
      setTimeLeft(workTime)
      setIsBreak(false)
    }
  }, [mode, longBreakTime, shortBreakTime, workTime, stopAlarm])

  // Memoize expensive calculations to reduce re-renders
  const formattedTime = useMemo(() => {
    const mins = Math.floor(timeLeft / 60)
    const secs = timeLeft % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [timeLeft])

  const progressData = useMemo(() => {
    const totalTime = mode === 'work' ? workTime : mode === 'shortBreak' ? shortBreakTime : longBreakTime
    const progress = ((totalTime - timeLeft) / totalTime) * 100
    const circumference = 2 * Math.PI * 140
    const strokeDashoffset = (1 - progress / 100) * circumference
    return { progress, strokeDashoffset }
  }, [mode, timeLeft, workTime, shortBreakTime, longBreakTime])

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
      if (!file.type.startsWith('audio/')) {
        alert('Please select an audio file (MP3, WAV, OGG, etc.)')
        return
      }
      
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB')
        return
      }
      
      try {
        await saveAudioToStorage(file)
        
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
        
        {/* Precision Timer Debug Info */}
        <div className="debug-info" style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
          ⏱️ High-Precision Timer Active | Using: requestAnimationFrame + Date.now()
        </div>
        
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
                strokeDashoffset={progressData.strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 150 150)"
                style={{
                  transition: 'stroke-dashoffset 0.3s ease'
                }}
              />
            </svg>
            <div className="timer-display">
              <div className="time">{formattedTime}</div>
              <div className="status">{isBreak ? 'Break Time!' : 'Focus Time!'}</div>
            </div>
          </div>
        </div>

        {/* Alarm Stop Button - shows when alarm is playing */}
        {isAlarmPlaying && (
          <div className="alarm-notification">
            <p>🔔 Timer Complete!</p>
            <button className="btn btn-stop-alarm" onClick={stopAlarm}>
              🔇 Stop Alarm
            </button>
          </div>
        )}

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
                onClick={() => {
                  initializeAudioContext()
                  testAudio()
                }}
                onTouchStart={() => {
                  if (!audioContextInitialized) {
                    initializeAudioContext()
                  }
                }}
              >
                {isTestPlaying ? '⏹️ Stop Audio' : '🔊 Test Audio'}
              </button>
            </div>
          </div>
          
          <div className="precision-info">
            <h4>⚡ Precision Timer Features</h4>
            <ul>
              <li>✅ Drift-free timing using Date.now() timestamps</li>
              <li>✅ High-frequency updates with requestAnimationFrame</li>
              <li>✅ Optimized React re-renders with useMemo/useCallback</li>
              <li>✅ Accurate to real-world time within 1 second</li>
            </ul>
            <p><small>Test accuracy: Compare with your phone's stopwatch!</small></p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App