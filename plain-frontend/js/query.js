document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const documentsList = document.getElementById('documents-list');
    const documentsLoading = document.getElementById('documents-loading');
    const selectedCount = document.getElementById('selected-count');
    const chatMessages = document.getElementById('chat-messages');
    const emptyChat = document.getElementById('empty-chat');
    const queryForm = document.getElementById('query-form');
    const queryInput = document.getElementById('query-input');
    const sendBtn = document.getElementById('send-btn');
    const voiceToggleBtn = document.getElementById('voice-toggle-btn');
    const micIcon = voiceToggleBtn.querySelector('.mic-icon');
    const micOffIcon = voiceToggleBtn.querySelector('.mic-off-icon');
    const downloadBtn = document.getElementById('download-btn');
    const clearBtn = document.getElementById('clear-btn');
    const queryStatus = document.getElementById('query-status');
    
    // State
    let documents = [];
    let selectedDocIds = [];
    let messages = [];
    let isLoading = false;
    let isListening = false;
    let isSpeaking = false;
    let recognition = null;
    let synth = window.speechSynthesis;

    let allDocumentNames = [];
    let selectedDocumentNames = [];
    
    // Initialize
    initSpeechRecognition();
    fetchDocuments();
    
    // Event Listeners
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
    
    queryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleQuerySubmit(e);
    });
    
    queryInput.addEventListener('input', () => {
        sendBtn.disabled = !queryInput.value.trim() || isLoading;
        
        // Auto-resize textarea
        queryInput.style.height = 'auto';
        queryInput.style.height = queryInput.scrollHeight + 'px';
    });
    
    voiceToggleBtn.addEventListener('click', toggleListening);
    downloadBtn.addEventListener('click', downloadConversation);
    clearBtn.addEventListener('click', clearConversation);
    
    // Functions
    function initSpeechRecognition() {
        if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            
            recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0])
                    .map(result => result.transcript)
                    .join('');
                
                queryInput.value = transcript;
                queryInput.dispatchEvent(new Event('input'));
            };
            
            recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                isListening = false;
                updateVoiceToggleUI();
                showToast('Voice Input Error', `Error: ${event.error}. Please try again.`, 'error');
            };
        }
    }

    async function fetchDocuments() {
        documentsLoading.classList.remove('hidden');
        documentsList.innerHTML = ''; // Clear previous list

        try {
            const response = await fetch('http://localhost:8000/api/documents/');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch documents');
            }
            const data = await response.json();
            allDocumentNames = data.documents || [];
            renderDocumentsList();
        } catch (error) {
            console.error('Error fetching documents:', error);
            showToast(`Error: ${error.message}`, 'error');
            documentsList.innerHTML = '<li class="document-item">Failed to load documents.</li>';
        } finally {
            documentsLoading.classList.add('hidden');
        }
    }

    function renderDocumentsList() {
        documentsList.innerHTML = ''; // Clear previous items
        if (allDocumentNames.length === 0) {
            documentsList.innerHTML = '<li class="document-item" style="padding: 0.5rem;">No documents uploaded yet.</li>';
        } else {
            allDocumentNames.forEach(docName => {
                const listItem = document.createElement('li');
                listItem.classList.add('document-item');

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.classList.add('document-checkbox');
                checkbox.value = docName;
                checkbox.id = `doc-${docName.replace(/[^a-zA-Z0-9]/g, '-')}`; // Sanitize name for ID
                checkbox.addEventListener('change', updateSelectedDocuments);

                const label = document.createElement('label');
                label.classList.add('document-info');
                label.htmlFor = checkbox.id;

                const nameSpan = document.createElement('span');
                nameSpan.classList.add('document-name');
                nameSpan.textContent = docName;
                // Add a title attribute for full name on hover if it's too long
                if (docName.length > 25) { // Heuristic for "too long"
                    nameSpan.title = docName;
                }

                label.appendChild(nameSpan);
                listItem.appendChild(checkbox);
                listItem.appendChild(label);
                documentsList.appendChild(listItem);
            });
        }
        updateSelectedDocumentsUI(); // Initial UI update
    }

    function updateSelectedDocuments() {
        selectedDocumentNames = [];
        const checkboxes = documentsList.querySelectorAll('.document-checkbox:checked');
        checkboxes.forEach(checkbox => {
            selectedDocumentNames.push(checkbox.value);
        });
        updateSelectedDocumentsUI();
    }

    function updateSelectedDocumentsUI() {
        if (selectedCount) {
            selectedCount.textContent = `${selectedDocumentNames.length} of ${allDocumentNames.length} selected`;
        }

        if (queryStatus) {
            if (allDocumentNames.length === 0) {
                queryStatus.textContent = 'No documents to query.';
                queryInput.disabled = true;
                sendBtn.disabled = true;
            } else if (selectedDocumentNames.length === 0) {
                queryStatus.textContent = `Querying all ${allDocumentNames.length} document(s).`;
                queryInput.disabled = false;
            } else {
                queryStatus.textContent = `Querying ${selectedDocumentNames.length} selected document(s).`;
                queryInput.disabled = false;
            }
            // Re-evaluate send button state based on input text
            sendBtn.disabled = queryInput.value.trim() === '' || (allDocumentNames.length === 0);
        }
    }

    async function handleQuerySubmit(event) {
        event.preventDefault();
        const queryText = queryInput.value.trim();
        if (!queryText) return;

        // Disable input and button during processing
        queryInput.disabled = true;
        sendBtn.disabled = true;
        addMessageToChat('user', queryText);
        queryInput.value = '';
        queryInput.style.height = 'auto'; // Reset height
        emptyChat.classList.add('hidden');
        clearBtn.disabled = false;
        downloadBtn.disabled = false;

        try {
            const response = await fetch('http://localhost:8000/api/query/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    query: queryText,
                    document_names: selectedDocumentNames // Send selected document names
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to get response from server');
            }

            const data = await response.json();
            if (data.success) {
                addMessageToChat('assistant', data.response);
            } else {
                addMessageToChat('assistant', `Error: ${data.message}`);
            }
        } catch (error) {
            console.error('Query error:', error);
            addMessageToChat('assistant', `Sorry, I encountered an error: ${error.message}`);
        } finally {
            // Re-enable input and button
            queryInput.disabled = (allDocumentNames.length === 0); // Disable if no docs overall
            sendBtn.disabled = queryInput.value.trim() === '' || (allDocumentNames.length === 0);
            updateSelectedDocumentsUI(); // Refresh status and button state
        }
    }

    function toggleListening() {
        if (!recognition) {
            showToast('Voice Input Not Supported', 'Your browser doesn\'t support voice input. Please use a modern browser like Chrome.', 'error');
            return;
        }
        
        if (isListening) {
            recognition.stop();
            isListening = false;
        } else {
            recognition.start();
            isListening = true;
            queryInput.value = '';
            queryInput.dispatchEvent(new Event('input'));
        }
        
        updateVoiceToggleUI();
    }
    
    function updateVoiceToggleUI() {
        if (isListening) {
            voiceToggleBtn.classList.add('active');
            micIcon.classList.add('hidden');
            micOffIcon.classList.remove('hidden');
            queryInput.placeholder = 'Listening...';
        } else {
            voiceToggleBtn.classList.remove('active');
            micIcon.classList.remove('hidden');
            micOffIcon.classList.add('hidden');
            queryInput.placeholder = 'Ask a question about your documents...';
        }
    }
    
    function speakMessage(text) {
        if (!synth) {
            showToast('Text-to-Speech Not Supported', 'Your browser doesn\'t support text-to-speech. Please use a modern browser.', 'error');
            return;
        }
        
        if (isSpeaking) {
            synth.cancel();
            isSpeaking = false;
            return;
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => {
            isSpeaking = false;
        };
        utterance.onerror = () => {
            isSpeaking = false;
            showToast('Text-to-Speech Error', 'There was an error playing the audio. Please try again.', 'error');
        };
        
        isSpeaking = true;
        synth.speak(utterance);
    }
    
    function addMessageToChat(sender, text) {
        const message = {
            id: Date.now().toString(),
            role: sender,
            content: text,
            timestamp: new Date()
        };
        
        messages.push(message);
        renderMessages();
    }

    function renderMessages() {
        if (messages.length === 0) {
            emptyChat.classList.remove('hidden');
            return;
        }
        
        emptyChat.classList.add('hidden');
        
        // Clear existing messages
        const existingMessages = chatMessages.querySelectorAll('.message');
        existingMessages.forEach(msg => {
            if (!msg.isEqualNode(emptyChat)) {
                msg.remove();
            }
        });
        
        // Add messages
        messages.forEach(message => {
            const messageEl = document.createElement('div');
            messageEl.className = `message ${message.role}`;
            
            messageEl.innerHTML = `
                <div class="message-header">
                    <span class="message-sender">${message.role === 'user' ? 'You' : 'TextAssist'}</span>
                    <span class="message-time">${formatTime(message.timestamp)}</span>
                </div>
                <div class="message-bubble">
                    <div class="message-content">${message.content}</div>
                </div>
            `;
            
            if (message.role === 'assistant') {
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'message-actions';
                
                const speakBtn = document.createElement('button');
                speakBtn.className = 'message-action-btn';
                speakBtn.title = 'Speak response';
                speakBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                `;
                
                speakBtn.addEventListener('click', () => {
                    speakMessage(message.content);
                });
                
                actionsDiv.appendChild(speakBtn);
                messageEl.appendChild(actionsDiv);
            }
            
            chatMessages.appendChild(messageEl);
        });
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function downloadConversation() {
        if (messages.length === 0) {
            showToast('No Conversation', 'There\'s no conversation to download.', 'default');
            return;
        }
        
        const text = messages
            .map(msg => `${msg.role === 'user' ? 'You' : 'TextAssist'} (${new Date(msg.timestamp).toLocaleString()}):\n${msg.content}\n\n`)
            .join('');
        
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `textassist-conversation-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('Download Complete', 'Your conversation has been downloaded.', 'success');
    }
    
    function clearConversation() {
        if (messages.length === 0) return;
        
        messages = [];
        renderMessages();
        
        // Disable download and clear buttons
        downloadBtn.disabled = true;
        clearBtn.disabled = true;
        
        showToast('Conversation Cleared', 'Your conversation history has been cleared.', 'success');
    }
});