
document.addEventListener('DOMContentLoaded', function() {
    // API Configuration
    const GEMINI_API_KEY = "AIzaSyAdu_bOvDCTXV2TcFzHcx0bdmXyi2xozw0"; // Load API key from environment variables
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
   
    // Initialize DOM elements
    const chatContainer = document.getElementById('chatContainer');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const voiceButton = document.getElementById('voiceButton');
    const voiceInputIndicator = document.getElementById('voiceInputIndicator');
    const voiceInputText = document.getElementById('voiceInputText');
    const destinationMarker = document.getElementById('destinationMarker');
    const destinationCard = document.getElementById('destinationCard');
    const destinationTitle = document.getElementById('destinationTitle');
    const destinationDesc = document.getElementById('destinationDesc');
    const loadingBar = document.getElementById('loadingBar');
    const exploreMoreBtn = document.getElementById('exploreMoreBtn');
    const voiceSearchSelectInput = document.getElementById('voiceSearchSelectInput'); // New input
    const voiceDropdownList = document.getElementById('voiceDropdownList'); // New dropdown list div
    const voiceDropdownContainer = document.getElementById('voiceDropdownContainer'); // Container div
    const voiceSelectHidden = document.getElementById('voiceSelectHidden'); // Hidden select
    const stopSpeakingBtn = document.getElementById('stopSpeakingBtn');

    // Mode toggle elements
    const modeToggle = document.getElementById('modeToggle');
    const modeText = document.getElementById('modeText');
    const textInputSection = document.getElementById('textInputSection');
    const voiceInputSection = document.getElementById('voiceInputSection');
    let isVoiceMode = true; // Start in voice mode by default

    // Mode toggle handler
    modeToggle.addEventListener('click', () => {
        isVoiceMode = !isVoiceMode;
        if (isVoiceMode) {
            modeToggle.innerHTML = '<i class="fas fa-microphone"></i><span id="modeText">Voice Mode</span>';
            textInputSection.classList.add('hidden');
            voiceInputSection.classList.remove('hidden');
            modeToggle.classList.remove('bg-gray-200', 'hover:bg-gray-300');
            modeToggle.classList.add('bg-red-100', 'hover:bg-red-200');
        } else {
            modeToggle.innerHTML = '<i class="fas fa-keyboard"></i><span id="modeText">Text Mode</span>';
            textInputSection.classList.remove('hidden');
            voiceInputSection.classList.add('hidden');
            modeToggle.classList.remove('bg-red-100', 'hover:bg-red-200');
            modeToggle.classList.add('bg-gray-200', 'hover:bg-gray-300');
            stopListening(); // Stop any ongoing voice recognition
            if (synth.speaking) {
                synth.cancel(); // Stop any ongoing speech
            }
            stopSpeakingBtn.classList.add('hidden'); // Hide stop button
        }
    });

    // Speech synthesis setup
    const synth = window.speechSynthesis;
    let voices = [];
    let doraVoice = null;
    let recognition;
    let isListening = false;
    let isAISpeaking = false;
    let currentDestination = null;
    let finalTranscript = '';
    let conversationHistory = []; // Initialize conversation history

    // Voice priority matching function
    function findDoraVoice(voices) {
        const voicePriority = [
            (v) => v.lang.startsWith('es') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('paulina') || v.name.toLowerCase().includes('mónica')),
            (v) => (v.lang.startsWith('es-MX') || v.lang.startsWith('es-419')) && !v.name.toLowerCase().includes('male'),
            (v) => (v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('samantha')),
            (v) => v.lang.startsWith('es'),
            (v) => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman')
        ];
        for (const priorityFn of voicePriority) {
            const match = voices.find(priorityFn);
            if (match) return match;
        }
        return voices[0] || null;
    }

    // --- Custom Searchable Voice Dropdown Logic ---

    function populateVoiceList(filter = '') {
        voiceDropdownList.innerHTML = ''; // Clear current list
        const searchTerm = filter.toLowerCase();
        const filteredVoices = voices.filter(voice =>
            voice.name.toLowerCase().includes(searchTerm) || voice.lang.toLowerCase().includes(searchTerm)
        );

        // Add "Auto-select" option
        const autoOptionDiv = document.createElement('div');
        autoOptionDiv.textContent = 'Auto-select voice';
        autoOptionDiv.dataset.value = ''; // Store value in data attribute
        autoOptionDiv.className = 'px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm';
        autoOptionDiv.addEventListener('click', handleVoiceSelection);
        voiceDropdownList.appendChild(autoOptionDiv);


        filteredVoices.forEach(voice => {
            const optionDiv = document.createElement('div');
            const langName = voice.lang.includes('-') ? voice.lang.split('-')[0].toUpperCase() : voice.lang.toUpperCase();
            optionDiv.textContent = `${voice.name} (${langName})`;
            optionDiv.dataset.value = voice.name; // Store value in data attribute
            optionDiv.className = 'px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm';
            optionDiv.addEventListener('click', handleVoiceSelection);
            voiceDropdownList.appendChild(optionDiv);
        });
    }

    function handleVoiceSelection(event) {
        const selectedValue = event.target.dataset.value;
        const selectedText = event.target.textContent;

        voiceSearchSelectInput.value = selectedText; // Update the input field text
        voiceDropdownList.classList.add('hidden'); // Hide the dropdown
        voiceSearchSelectInput.readOnly = true; // Make input readonly again after selection

        // Update the actual voice used
        if (selectedValue) {
            doraVoice = voices.find(voice => voice.name === selectedValue);
            if (doraVoice) {
                console.log('Changed voice to:', doraVoice.name);
                 // Optionally speak a confirmation, but might be annoying
                 // speak('Voice changed!');
            }
        } else {
            // Auto-select logic (find default Dora voice again)
            doraVoice = findDoraVoice(voices);
            console.log('Reverted to auto-select voice:', doraVoice?.name);
        }
         // Update hidden select for potential form submission or other uses
         voiceSelectHidden.value = selectedValue;
    }

    // Populate voices when available
    synth.onvoiceschanged = function() {
        voices = synth.getVoices();
        populateVoiceList(); // Initial population

        // Set default selection in the custom dropdown
        doraVoice = findDoraVoice(voices);
        if (doraVoice) {
            const langName = doraVoice.lang.includes('-') ? doraVoice.lang.split('-')[0].toUpperCase() : doraVoice.lang.toUpperCase();
            voiceSearchSelectInput.value = `${doraVoice.name} (${langName})`;
            voiceSelectHidden.value = doraVoice.name; // Update hidden select
            console.log('Selected voice for Dora:', doraVoice.name, `(${doraVoice.lang})`);
        } else {
             voiceSearchSelectInput.value = 'Auto-select voice'; // Default text
             voiceSelectHidden.value = '';
        }
    };

    // Toggle dropdown and enable search on input click
    voiceSearchSelectInput?.addEventListener('click', () => {
        voiceDropdownList.classList.toggle('hidden');
        if (!voiceDropdownList.classList.contains('hidden')) {
            voiceSearchSelectInput.readOnly = false; // Allow typing for search
            voiceSearchSelectInput.select(); // Select text for easy replacement/search
            populateVoiceList(voiceSearchSelectInput.value.startsWith('Auto-select') ? '' : voiceSearchSelectInput.value); // Repopulate/filter
        } else {
            voiceSearchSelectInput.readOnly = true; // Make readonly when closed
        }
    });

    // Filter list while typing
    voiceSearchSelectInput?.addEventListener('input', () => {
        if (!voiceSearchSelectInput.readOnly) { // Only filter when dropdown is open and input is active
            populateVoiceList(voiceSearchSelectInput.value);
        }
    });

    // Close dropdown if clicked outside
    document.addEventListener('click', (event) => {
        if (!voiceDropdownContainer.contains(event.target)) {
            voiceDropdownList.classList.add('hidden');
            voiceSearchSelectInput.readOnly = true;
             // Reset input text to current selection if user didn't select anything new
             const currentVoiceName = doraVoice ? doraVoice.name : '';
             const currentOption = Array.from(voiceDropdownList.children).find(div => div.dataset.value === currentVoiceName);
             if (currentOption) {
                 voiceSearchSelectInput.value = currentOption.textContent;
             } else {
                 voiceSearchSelectInput.value = 'Auto-select voice'; // Fallback
             }
        }
    });

    // --- End Custom Dropdown Logic ---

    // --- Speech Recognition Setup ---

    async function initializeMicrophone() {
        if (!('webkitSpeechRecognition' in window)) {
            console.warn("Speech recognition not supported.");
            addMessage('Dora', 'Your browser doesn\'t support voice recognition. Try typing instead!');
            return false;
        }

        try {
            // Initialize microphone without checking permissions
            console.log('Initializing microphone');
            
            // Set up basic visual state
            voiceButton.classList.remove('opacity-50', 'bg-gray-400');
            voiceButton.classList.add('bg-red-500', 'hover:bg-red-600');
            
            return true;
        } catch (error) {
            console.error('Error initializing microphone:', error);
            return false;
        }
    }

    // Initialize recognition only if supported and not already initialized
    if ('webkitSpeechRecognition' in window && !recognition) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        let speechTimeout = null;
        const SPEECH_TIMEOUT = 1500;

        recognition.onstart = function() {
            isListening = true;
            finalTranscript = '';
            voiceButton.innerHTML = '<i class="fas fa-stop"></i>';
            voiceButton.classList.remove('bg-red-500');
            voiceButton.classList.add('bg-red-600');
            voiceInputIndicator.classList.remove('hidden');
        };

        recognition.onresult = function(event) {
            if (isAISpeaking) return;
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }
            voiceInputText.textContent = interimTranscript || 'Listening...';
            userInput.value = finalTranscript + interimTranscript; // Update text input as well
            if (speechTimeout) clearTimeout(speechTimeout);
            speechTimeout = setTimeout(() => {
                if (finalTranscript.trim()) {
                    processUserInput(finalTranscript.trim());
                    finalTranscript = '';
                    stopListening();
                }
            }, SPEECH_TIMEOUT);
        };
                
                recognition.onerror = function(event) {
                    console.error('Speech recognition error', event);
                    let errorMessage = 'Oops! I ran into a problem with voice recognition. ';

                    switch (event.error) {
                        case 'no-speech':
                            errorMessage += 'No speech was detected. Make sure your microphone is working and speak clearly.';
                            break;
                        case 'aborted':
                            errorMessage += 'Voice recognition was aborted, likely due to no input or cancellation.';
                            break;
                        case 'audio-capture':
                            errorMessage += 'Audio capture failed. Check your microphone and browser permissions.';
                            break;
                        case 'network':
                            errorMessage += 'Network error occurred. Please check your internet connection.';
                            break;
                        case 'not-allowed':
                        case 'service-not-allowed':
                            errorMessage += 'Microphone access was denied or blocked. Please check your browser permissions.';
                            break;
                        default:
                            errorMessage += 'An unexpected error occurred. Please try again.';
                            break;
                    }

                    console.error('Speech recognition error details:', event.error, event);
                    stopListening();
                    addMessage('Dora', errorMessage);
                    speak(errorMessage);
                };

        recognition.onend = function() {
            // We might not need to stop listening automatically if continuous is true
            // Let the timeout handle processing
             if (!isAISpeaking) {
                 // If recognition ends unexpectedly (e.g., network error), reset state
                 console.log("Recognition ended unexpectedly while not speaking.");
                 stopListening();
             } else {
                 console.log("Recognition ended while AI was speaking (expected).");
             }
        };
        // Initialize microphone
        initializeMicrophone();
    }

    function stopListening() {
        isListening = false;
        voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceButton.classList.remove('bg-red-600');
        voiceButton.classList.add('bg-red-500');
        voiceInputIndicator.classList.add('hidden');
        voiceInputText.textContent = 'Listening...';
        if (recognition) {
            try {
                recognition.stop();
            } catch (e) {
                console.warn("Recognition stop error:", e);
            }
        }
    }

    // Voice button handler - Updated
    let voiceClickTimeout = null;
    voiceButton.addEventListener('click', function() {
        if (voiceClickTimeout) clearTimeout(voiceClickTimeout);
        voiceClickTimeout = setTimeout(() => {
            if (isListening) {
                console.log('Stopping listening via button.');
                 // If user stops manually, process any pending transcript immediately
                 //if (speechTimeout) clearTimeout(speechTimeout);
                 if (finalTranscript.trim()) {
                     processUserInput(finalTranscript.trim());
                     finalTranscript = '';
                 }
                stopListening();
            } else if (!isAISpeaking) { // Only start if AI is not speaking
                try {
                    console.log('Starting listening via button.');
                    finalTranscript = '';
                    userInput.value = ''; // Clear text input when starting voice
                    recognition.start();
                } catch(e) {
                    console.error('Error starting recognition:', e);
                    addMessage('Dora', 'I had trouble starting the microphone. Please try again.');
                    speak('I had trouble starting the microphone. Please try again.');
                }
            } else {
                 console.log("Voice button clicked while AI speaking - ignored.");
            }
        }, 200); // Debounce click
    });

    // Text input handlers
    sendButton.addEventListener('click', () => {
        const message = userInput.value.trim();
        if (message) {
            processUserInput(message);
            userInput.value = '';
        }
    });

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const message = userInput.value.trim();
            if (message) {
                processUserInput(message);
                userInput.value = '';
            }
        }
    });

    // Explore button handler
    exploreMoreBtn?.addEventListener('click', function() {
        if (currentDestination) {
            processUserInput(`Tell me more about ${currentDestination}`);
        } else {
            const message = 'First tell me where you want to go, then I can tell you more about it!';
            addMessage('Dora', message);
            if (isVoiceMode) {
                speak(message);
            }
        }
    });

    // Stop speaking handler
    stopSpeakingBtn?.addEventListener('click', () => {
        if (synth.speaking) {
            synth.cancel();
            isAISpeaking = false;
            stopSpeakingBtn.classList.add('hidden');
        }
    });

    // Speech synthesis function
    function speak(text) {
        if (isListening) stopListening();
        isAISpeaking = true;
        if (synth.speaking) synth.cancel();
        
        // Show stop button when speaking starts (only in voice mode)
        if (stopSpeakingBtn && isVoiceMode) {
            stopSpeakingBtn.classList.remove('hidden');
        }

        const utterance = new SpeechSynthesisUtterance(text);
        if (doraVoice) {
            utterance.voice = doraVoice;
            utterance.rate = 1.1;
            utterance.pitch = 1.2;
        }
        
        utterance.onend = function() {
            console.log('AI finished speaking');
            setTimeout(() => {
                console.log('Clearing AI speaking flag');
                isAISpeaking = false;
                if (stopSpeakingBtn) {
                    stopSpeakingBtn.classList.add('hidden');
                }
            }, 100); // Short delay after speech ends
        };
        
        utterance.oncancel = () => { 
            console.log('AI speech cancelled'); 
            isAISpeaking = false;
            if (stopSpeakingBtn) {
                stopSpeakingBtn.classList.add('hidden');
            }
        };
        
        utterance.onerror = (event) => { 
            console.error('Speech synthesis error:', event); 
            isAISpeaking = false;
            if (stopSpeakingBtn) {
                stopSpeakingBtn.classList.add('hidden');
            }
        };
        
        synth.speak(utterance);
    }

    // Message handling functions
    function addMessage(sender, message, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = isUser ? 'message-bubble user-bubble' : 'message-bubble';
        let formattedMessage = message;
        if (!isUser) {
            const spanishWords = { 'great': '¡fantástico!', 'good': 'bueno', 'wonderful': 'maravilloso', 'friend': 'amigo', 'let\'s go': '¡vamos!', 'look': 'mira', 'thank you': 'gracias', 'please': 'por favor' };
            for (const [eng, esp] of Object.entries(spanishWords)) {
                formattedMessage = formattedMessage.replace(new RegExp(eng, 'gi'), esp);
            }
        }
        messageDiv.innerHTML = `<p><strong>${sender}:</strong> ${formattedMessage}</p>`;
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Define the system prompt
    const systemPrompt = `You are Dora the Explorer, your friendly travel guide!.
    Keep the conversation simple, precise,fun, educational, and interactive for kids.
    Your goal is to help kids learn about different places, cultures, and languages while having fun!
    You are a friendly, enthusiastic, and adventurous character who loves to explore the world with kids.

    Core Personality:
    - Talk like you're hosting a TV show for kids - be SUPER enthusiastic and energetic!
    - Ask lots of questions like "Can you see it?", "Where should we go next?", 
    - Make everything an exciting adventure, even simple things
    - Pause for "responses" like you're interacting with the audience

    Language Style:
    - Mix English and Spanish naturally
    - When using Spanish words, explain them: "¡Vámonos! That means let's go!"
    - Use Dora's catchphrases: "We did it! , "Swiper, no swiping!"
    - Keep it simple and clear, but fun and educational

    Educational Focus:
    - Share cool facts about places and cultures
    - Teach basic geography and directions
    - Include local foods, celebrations, and traditions
    - Encourage cultural appreciation

    Travel Guide Style:
    - Make every destination sound like an amazing adventure
    - Point out interesting landmarks: "Do you see the big mountain? ¡La montaña!"
    - Give simple, kid-friendly travel tips
    - Keep everything positive and exciting

    Interaction Style:
    - Celebrate every response: "¡Excelente! You're so smart!"
    - Make it interactive: "Can you point to the beach? "
    - Create mini-challenges: "Let's count the palm trees! Uno, dos, tres..."
    - Always end with enthusiasm: "¡Fantástico! What an amazing adventure!"`;

    // Gemini API integration
    async function callGeminiAPI() {
        try {
            // Ensure the last message is from the user before sending
            if (conversationHistory.length === 0 || conversationHistory[conversationHistory.length - 1].role !== "user") {
                 console.warn("Attempted to call API without a preceding user message."); // Corrected console spelling
                 return "¡Hola amigo! What adventure should we go on next?";
            }

            // Prepare the contents for the API call, ensuring alternating user/model roles
            // Exclude the system prompt if it's the first element, as gemini-pro might not expect it in contents
            const apiContents = conversationHistory.filter(msg => msg.role === 'user' || msg.role === 'model');

            // Basic validation for alternating roles (optional but good practice)
            for (let i = 0; i < apiContents.length - 1; i++) {
                if (apiContents[i].role === apiContents[i+1].role) {
                    console.warn("Conversation history roles are not alternating correctly.", apiContents);
                    // Handle error or attempt to fix history if necessary
                    // For now, we'll proceed but log the warning
                }
            }

            const requestBody = {
                contents: apiContents, // Send only user and model messages
                // System instruction might be handled differently depending on the exact API version/model
                // For now, we rely on the model's pre-training or context from the history
            };

            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.candidates && data.candidates[0].content.parts[0].text) {
                return data.candidates[0].content.parts[0].text.replace(/[^a-zA-Z0-9\s.,!?]/g, '');
            } else {
                // Handle cases where the API response might be blocked or empty
                console.warn("Received invalid or blocked response from Gemini API:", data);
                return "¡Ay caramba! Something went wrong with my map. Can you ask again?";
            }
        } catch (error) {
            console.error('Error calling Gemini API:', error);
            throw error; // Re-throw to be caught by processUserInput
        }
    }

    async function processUserInput(message) {
        addMessage('You', message, true);
        // Add user message to history
        conversationHistory.push({ role: "user", parts: [{ text: message }] });

        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
        chatContainer.appendChild(typingDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        loadingBar.classList.remove('hidden');

        try {
            const response = await callGeminiAPI(); // Call API with history
            chatContainer.removeChild(typingDiv);
            loadingBar.classList.add('hidden');
            addMessage('Dora', response.replace(/[^a-zA-Z0-9\s.,!?]/g, '')); addMessage('Dora', response);
            // Add AI response to history
            conversationHistory.push({ role: "model", parts: [{ text: response }] });
            // Only speak in voice mode
            if (isVoiceMode) {
                speak(response);
            }

            const destination = extractDestination(message);
            if (destination) {
                currentDestination = destination;
                showDestinationOnMap(destination);
                updateDestinationCard(destination, response);
            }
        } catch (error) {
            // Error is already logged in callGeminiAPI
            chatContainer.removeChild(typingDiv);
            loadingBar.classList.add('hidden');
            const errorMessage = '¡Ay caramba! I had trouble connecting to the AI. Can you try again?';
            addMessage('Dora', errorMessage);
            if (isVoiceMode) {
                speak(errorMessage);
            }
            // Optionally remove the last user message from history if the call failed
            if (conversationHistory[conversationHistory.length - 1].role === "user") {
                conversationHistory.pop();
            }
        }
    }

    function extractDestination(message) {
        const placeKeywords = ['visit', 'go to', 'travel to', 'about', 'tell me about', 'information about', 'where is'];
        const lowerMessage = message.toLowerCase();
        for (const keyword of placeKeywords) {
            if (lowerMessage.includes(keyword)) {
                const startIndex = lowerMessage.indexOf(keyword) + keyword.length;
                const potentialPlace = message.substring(startIndex).trim();
                if (potentialPlace) {
                    return potentialPlace.split(/[.,!?;]/)[0].trim();
                }
            }
        }
        return null;
    }

    // Map and UI functions
    function showDestinationOnMap(destination) {
        if (!destinationMarker) return;
        destinationMarker.classList.remove('hidden');
        destinationMarker.style.transition = 'all 1.5s ease-in-out';
        destinationMarker.style.transform = 'rotate(-45deg) scale(1.5)';
        setTimeout(() => {
            destinationMarker.style.transform = 'rotate(-45deg) scale(1)';
        }, 1500);
    }

    function updateDestinationCard(destination, info) {
        if (!destinationCard || !destinationTitle || !destinationDesc) return;
        destinationTitle.textContent = destination;
        const shortDesc = info.split('.')[0] + (info.split('.').length > 1 ? '.' : '');
        destinationDesc.textContent = shortDesc;
        destinationCard.classList.remove('hidden');
        setTimeout(() => {
            destinationCard.classList.add('show-card');
        }, 100);
    }

    // Set initial mode based on the default isVoiceMode value
    function setInitialMode() {
        if (isVoiceMode) {
            modeToggle.innerHTML = '<i class="fas fa-microphone"></i><span id="modeText">Voice Mode</span>';
            textInputSection.classList.add('hidden');
            voiceInputSection.classList.remove('hidden');
            modeToggle.classList.remove('bg-gray-200', 'hover:bg-gray-300');
            modeToggle.classList.add('bg-red-100', 'hover:bg-red-200');
        } else {
            modeToggle.innerHTML = '<i class="fas fa-keyboard"></i><span id="modeText">Text Mode</span>';
            textInputSection.classList.remove('hidden');
            voiceInputSection.classList.add('hidden');
            modeToggle.classList.remove('bg-red-100', 'hover:bg-red-200');
            modeToggle.classList.add('bg-gray-200', 'hover:bg-gray-300');
        }
    }
    setInitialMode(); // Call this function on load

    // Initial greeting
    setTimeout(() => {
        const greeting = 'Hola! I am Dora, your AI-powered travel assistant. Just press the microphone button to start talking to me!';
        addMessage('Dora', greeting);
        if (isVoiceMode) {
            speak(greeting);
        }
    }, 5000);
});
