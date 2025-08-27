// static/script.js
document.addEventListener("DOMContentLoaded", () => {
  const recordBtn = document.getElementById("recordBtn");
  const statusDisplay = document.getElementById("statusDisplay");
  const chatLog = document.getElementById("chat-log");
  const uploadBtn = document.getElementById("uploadBtn");
  const fileInput = document.getElementById("fileInput");
  const uploadStatus = document.getElementById("uploadStatus");
  const textInput = document.getElementById("textInput");
  const languageSelect = document.getElementById("languageSelect");
  const personaSelect = document.getElementById("personaSelect");
  const translateBtn = document.getElementById("translateBtn");
  const multilingualStatus = document.getElementById("multilingualStatus");
  
  // New elements for the updated interface
  const addBtn = document.getElementById("addBtn");
  const micBtn = document.getElementById("micBtn");
  const fileBtn = document.getElementById("fileBtn");
  const mainInput = document.getElementById("mainInput");
  const newChatBtn = document.getElementById("newChatBtn");
  const chatHistory = document.getElementById("chatHistory");

  let isRecording = false;
  let ws = null;
  let audioContext;
  let mediaStream;
  let processor;
  let audioQueue = [];
  let isPlaying = false;
  let assistantMessageDiv = null;
  
  // Chat management variables
  let currentChatId = null;
  let chatSessions = JSON.parse(localStorage.getItem('chatSessions') || '{}');
  let chatCounter = Object.keys(chatSessions).length;

  // Chat session management
  const saveChatSession = () => {
    if (currentChatId) {
      const messages = Array.from(chatLog.children).map(msg => ({
        type: msg.classList.contains('user') ? 'user' : 'assistant',
        text: msg.textContent
      }));
      
      chatSessions[currentChatId] = {
        id: currentChatId,
        title: generateChatTitle(messages),
        messages: messages,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
      updateChatHistory();
    }
  };

  const generateChatTitle = (messages) => {
    const firstUserMessage = messages.find(msg => msg.type === 'user');
    if (firstUserMessage) {
      return firstUserMessage.text.substring(0, 30) + (firstUserMessage.text.length > 30 ? '...' : '');
    }
    return `Chat ${new Date().toLocaleString()}`;
  };

  const createNewChat = () => {
    chatCounter++;
    currentChatId = `chat_${Date.now()}_${chatCounter}`;
    chatLog.innerHTML = '<div class="message assistant">Hi! I\'m ready to help. Click the microphone to start talking or use the + button to upload files.</div>';
    updateChatHistory();
  };

  const loadChatSession = (chatId) => {
    const session = chatSessions[chatId];
    if (session) {
      currentChatId = chatId;
      chatLog.innerHTML = '';
      session.messages.forEach(msg => {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${msg.type}`;
        messageDiv.textContent = msg.text;
        chatLog.appendChild(messageDiv);
      });
      chatLog.scrollTop = chatLog.scrollHeight;
      updateChatHistory();
    }
  };

  const deleteChatSession = (chatId) => {
    delete chatSessions[chatId];
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
    if (currentChatId === chatId) {
      createNewChat();
    } else {
      updateChatHistory();
    }
  };

  const updateChatHistory = () => {
    chatHistory.innerHTML = '';
    const sortedSessions = Object.values(chatSessions).sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    sortedSessions.forEach(session => {
      const chatItem = document.createElement('div');
      chatItem.className = `chat-item ${session.id === currentChatId ? 'active' : ''}`;
      chatItem.innerHTML = `
        <div class="chat-item-title">${session.title}</div>
        <div class="chat-item-actions">
          <button class="chat-action-btn delete-btn" data-chat-id="${session.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"></polyline>
              <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
            </svg>
          </button>
        </div>
      `;
      
      chatItem.addEventListener('click', (e) => {
        if (!e.target.closest('.chat-action-btn')) {
          loadChatSession(session.id);
        }
      });

      const deleteBtn = chatItem.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this chat?')) {
          deleteChatSession(session.id);
        }
      });

      chatHistory.appendChild(chatItem);
    });
  };

  const addOrUpdateMessage = (text, type) => {
    if (type === "assistant") {
      // Create a new div for the assistant's message
      assistantMessageDiv = document.createElement("div");
      assistantMessageDiv.className = "message assistant";
      assistantMessageDiv.textContent = text;
      chatLog.appendChild(assistantMessageDiv);
    } else {
      assistantMessageDiv = null; // New user message, so reset assistant div
      const messageDiv = document.createElement("div");
      messageDiv.className = "message user";
      messageDiv.textContent = text;
      chatLog.appendChild(messageDiv);
    }
    chatLog.scrollTop = chatLog.scrollHeight;
    
    // Save the chat session after adding a message
    saveChatSession();
  };

  const playNextInQueue = () => {
    if (audioQueue.length > 0) {
      isPlaying = true;
      const base64Audio = audioQueue.shift();
      const audioData = Uint8Array.from(atob(base64Audio), (c) =>
        c.charCodeAt(0)
      ).buffer;

      audioContext
        .decodeAudioData(audioData)
        .then((buffer) => {
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.connect(audioContext.destination);
          source.onended = playNextInQueue;
          source.start();
        })
        .catch((e) => {
          console.error("Error decoding audio data:", e);
          playNextInQueue();
        });
    } else {
      isPlaying = false;
    }
  };

  const startRecording = async () => {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });

      const source = audioContext.createMediaStreamSource(mediaStream);
      processor = audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(audioContext.destination);
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
        }
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(pcmData.buffer);
        }
      };

      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "assistant") {
          // Changed from "llm" to "assistant"
          addOrUpdateMessage(msg.text, "assistant");
        } else if (msg.type === "final") {
          addOrUpdateMessage(msg.text, "user");
        } else if (msg.type === "audio") {
          audioQueue.push(msg.b64);
          if (!isPlaying) {
            playNextInQueue();
          }
        }
      };
      isRecording = true;
      recordBtn.classList.add("recording");
      statusDisplay.textContent = "Listening...";
    } catch (error) {
      console.error("Could not start recording:", error);
      alert("Microphone access is required to use the voice agent.");
    }
  };

  const stopRecording = () => {
    if (processor) processor.disconnect();
    if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
    if (ws) ws.close();

    isRecording = false;
    recordBtn.classList.remove("recording");
    statusDisplay.textContent = "Ready to chat!";
  };

  // File upload functionality
  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    uploadStatus.textContent = 'Uploading and analyzing...';
    uploadStatus.className = 'upload-status';
    
    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        uploadStatus.textContent = `✓ ${result.filename} analyzed successfully`;
        uploadStatus.className = 'upload-status success';
        
        // Add analysis results to chat
        const analysisMsg = document.createElement("div");
        analysisMsg.className = "message assistant";
        analysisMsg.innerHTML = `
          <strong>📊 Analysis Complete: ${result.filename}</strong><br>
          <em>${result.file_type} • ${result.shape ? result.shape[0] + ' rows, ' + result.shape[1] + ' columns' : 'Processed'}</em><br><br>
          ${result.ai_insights}
        `;
        chatLog.appendChild(analysisMsg);
        chatLog.scrollTop = chatLog.scrollHeight;
        
        // Speak the insights
        if (result.ai_insights) {
          speakText(result.ai_insights);
        }
        
      } else {
        throw new Error(result.detail || 'Upload failed');
      }
    } catch (error) {
      uploadStatus.textContent = `✗ Error: ${error.message}`;
      uploadStatus.className = 'upload-status error';
      console.error('Upload error:', error);
    }
  };

  const speakText = async (text) => {
    try {
      // Create a simple TTS using Web Speech API as fallback
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.log('TTS not available:', error);
    }
  };

  // Connect + button to file upload
  addBtn.addEventListener("click", () => {
    fileInput.click();
  });

  // Connect file button to file upload
  fileBtn.addEventListener("click", () => {
    fileInput.click();
  });

  // Original upload button (hidden but still functional)
  uploadBtn.addEventListener("click", () => {
    fileInput.click();
  });

  // Connect mic button to recording
  micBtn.addEventListener("click", () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  // Handle text input submission
  const sendTextMessage = async () => {
    const text = mainInput.value.trim();
    if (!text) return;

    // Clear input and add user message
    mainInput.value = '';
    addOrUpdateMessage(text, 'user');

    try {
      // Send to your backend API
      const response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          chat_id: currentChatId
        })
      });

      const result = await response.json();
      
      if (response.ok && result.response) {
        addOrUpdateMessage(result.response, 'assistant');
        
        // If there's audio response, play it
        if (result.audio) {
          audioQueue.push(result.audio);
          if (!isPlaying) {
            playNextInQueue();
          }
        }
      } else {
        addOrUpdateMessage('Sorry, I encountered an error processing your message. Please check if API keys are configured.', 'assistant');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      addOrUpdateMessage('Sorry, I couldn\'t connect to the server. Please check if the server is running and API keys are configured.', 'assistant');
    }
  };

  // Add event listeners for text input
  mainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  });

  fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = ['text/csv', 'application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      const allowedExtensions = ['.csv', '.pdf', '.xls', '.xlsx'];
      
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      
      if (allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension)) {
        uploadFile(file);
      } else {
        uploadStatus.textContent = '✗ Please upload CSV, PDF, or Excel files only';
        uploadStatus.className = 'upload-status error';
      }
    }
  });

  // Multilingual Voice Agent functionality
  const handleMultilingualVoice = async () => {
    const text = textInput.value.trim();
    const targetLanguage = languageSelect.value;
    const persona = personaSelect.value;
    
    if (!text) {
      multilingualStatus.textContent = '⚠️ Please enter some text to translate';
      multilingualStatus.className = 'multilingual-status error';
      return;
    }
    
    translateBtn.disabled = true;
    multilingualStatus.textContent = `🔄 Translating to ${targetLanguage} with ${persona} voice...`;
    multilingualStatus.className = 'multilingual-status';
    
    try {
      const response = await fetch('/multilingual-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          target_language: targetLanguage,
          persona: persona
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Add translation to chat
        const translationMsg = document.createElement("div");
        translationMsg.className = "message assistant";
        translationMsg.innerHTML = `
          <strong>🌍 Translation Complete</strong><br>
          <em>Original:</em> "${result.original_text}"<br>
          <em>${targetLanguage.charAt(0).toUpperCase() + targetLanguage.slice(1)}:</em> "${result.translated_text}"<br>
          <em>Voice:</em> ${persona} persona
        `;
        chatLog.appendChild(translationMsg);
        chatLog.scrollTop = chatLog.scrollHeight;
        
        // Play the generated audio
        if (result.audio) {
          const audioData = Uint8Array.from(atob(result.audio), (c) => c.charCodeAt(0)).buffer;
          
          if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
          }
          
          audioContext.decodeAudioData(audioData)
            .then((buffer) => {
              const source = audioContext.createBufferSource();
              source.buffer = buffer;
              source.connect(audioContext.destination);
              source.start();
              
              multilingualStatus.textContent = `✅ Playing ${persona} voice in ${targetLanguage}`;
              multilingualStatus.className = 'multilingual-status success';
            })
            .catch((e) => {
              console.error("Error playing audio:", e);
              multilingualStatus.textContent = '⚠️ Translation successful, but audio playback failed';
              multilingualStatus.className = 'multilingual-status error';
            });
        }
        
        // Clear input
        textInput.value = '';
        
      } else {
        throw new Error(result.error || 'Translation failed');
      }
    } catch (error) {
      multilingualStatus.textContent = `❌ Error: ${error.message}`;
      multilingualStatus.className = 'multilingual-status error';
      console.error('Multilingual voice error:', error);
    } finally {
      translateBtn.disabled = false;
    }
  };

  translateBtn.addEventListener("click", handleMultilingualVoice);
  
  textInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !translateBtn.disabled) {
      handleMultilingualVoice();
    }
  });

  // New Chat button event listener
  newChatBtn.addEventListener("click", () => {
    createNewChat();
  });

  recordBtn.addEventListener("click", () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  // Initialize the app
  if (Object.keys(chatSessions).length === 0) {
    createNewChat();
  } else {
    // Load the most recent chat or create new if none exists
    const recentChat = Object.values(chatSessions).sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    )[0];
    if (recentChat) {
      loadChatSession(recentChat.id);
    } else {
      createNewChat();
    }
  }
  updateChatHistory();
});
