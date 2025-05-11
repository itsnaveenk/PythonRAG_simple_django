document.addEventListener('DOMContentLoaded', () => {
    // Common DOM Elements
    const currentYearEl = document.getElementById('current-year');
    if (currentYearEl) currentYearEl.textContent = new Date().getFullYear();
    const toastContainer = document.getElementById('toast-container');

    // --- Upload Section Elements ---
    const fileUploadInput = document.getElementById('file-upload');
    const stagedFilesContainer = document.getElementById('staged-files-container');
    const stagedFilesList = document.getElementById('staged-files-list');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadProgressContainer = document.getElementById('upload-progress-container');
    const uploadProgressBar = document.getElementById('upload-progress-bar');
    const uploadProgressPercentage = document.getElementById('upload-progress-percentage');
    const uploadStatusEl = document.getElementById('upload-status');

    // --- Query Section Elements ---
    const documentsLoadingEl = document.getElementById('documents-loading');
    const documentsListEl = document.getElementById('documents-list');
    const selectedDocStatusEl = document.getElementById('selected-doc-status');
    const chatMessagesEl = document.getElementById('chat-messages');
    const emptyChatEl = document.getElementById('empty-chat');
    const queryForm = document.getElementById('query-form');
    const queryInput = document.getElementById('query-input');
    const sendBtn = document.getElementById('send-btn');
    const voiceToggleBtn = document.getElementById('voice-toggle-btn');
    const clearChatBtn = document.getElementById('clear-chat-btn');

    // --- State Variables ---
    let filesToUpload = [];
    let isUploading = false;
    let allDocumentNames = [];
    let selectedDocumentNames = [];
    let chatMessages = [];
    let speechRecognition;
    let isListening = false;
    const synth = window.speechSynthesis;

    // --- API Base URL ---
    const API_BASE_URL = 'http://localhost:8000/api';

    // --- Helper Functions ---
    function showToast(title, message, type = 'default', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<div class="toast-title">${title}</div><div class="toast-message">${message}</div>`;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10); // Trigger animation

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function formatTime(date) {
        return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric' }).format(date);
    }

    // --- Upload Logic ---
    if (fileUploadInput) {
        fileUploadInput.addEventListener('change', handleFileSelection);
        uploadBtn.addEventListener('click', handleUpload);
    }

    function handleFileSelection(event) {
        const newFiles = Array.from(event.target.files);
        newFiles.forEach(file => {
            if (!filesToUpload.some(f => f.name === file.name && f.size === file.size)) {
                if (validateFile(file)) {
                    filesToUpload.push(file);
                }
            } else {
                showToast('Duplicate File', `${file.name} is already selected.`, 'default');
            }
        });
        renderStagedFiles();
        fileUploadInput.value = ''; // Allow selecting the same file again if removed
    }

    function validateFile(file) {
        const allowedTypes = ['.pdf', '.docx', '.txt', '.pptx'];
        const maxFileSize = 50 * 1024 * 1024; // 50MB
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(fileExtension)) {
            showToast('Invalid File Type', `${file.name} is not supported.`, 'error');
            return false;
        }
        if (file.size > maxFileSize) {
            showToast('File Too Large', `${file.name} exceeds 50MB.`, 'error');
            return false;
        }
        return true;
    }

    function renderStagedFiles() {
        stagedFilesList.innerHTML = '';
        if (filesToUpload.length > 0) {
            stagedFilesContainer.classList.remove('hidden');
            filesToUpload.forEach((file, index) => {
                const li = document.createElement('li');
                li.className = 'staged-file-item';
                li.innerHTML = `
                    <span>${file.name} (${formatFileSize(file.size)})</span>
                    <button class="remove-staged-file-btn" data-index="${index}">Remove</button>
                `;
                stagedFilesList.appendChild(li);
            });
            uploadBtn.disabled = false;
        } else {
            stagedFilesContainer.classList.add('hidden');
            uploadBtn.disabled = true;
        }
        document.querySelectorAll('.remove-staged-file-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                removeStagedFile(parseInt(e.target.dataset.index));
            });
        });
    }

    function removeStagedFile(index) {
        filesToUpload.splice(index, 1);
        renderStagedFiles();
    }

    async function handleUpload() {
        if (filesToUpload.length === 0 || isUploading) return;

        isUploading = true;
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';
        uploadProgressContainer.classList.remove('hidden');
        uploadProgressBar.style.width = '0%';
        uploadProgressPercentage.textContent = '0%';
        uploadStatusEl.textContent = 'Starting upload...';

        const formData = new FormData();
        filesToUpload.forEach(file => formData.append('file', file)); // Send all files at once

        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${API_BASE_URL}/upload/`, true);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    uploadProgressBar.style.width = `${percentComplete}%`;
                    uploadProgressPercentage.textContent = `${percentComplete}%`;
                    uploadStatusEl.textContent = `Uploading ${filesToUpload.length} file(s)... ${percentComplete}%`;
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        showToast('Upload Successful', `${response.message || filesToUpload.length + ' file(s) processed.'}`, 'success');
                        uploadStatusEl.textContent = 'Upload complete!';
                        fetchDocuments(); // Refresh document list
                    } else {
                        throw new Error(response.message || 'Upload failed on server.');
                    }
                } else {
                    let errorMsg = `Upload failed. Status: ${xhr.status}`;
                    try {
                        const errResp = JSON.parse(xhr.responseText);
                        errorMsg = errResp.message || errorMsg;
                    } catch (e) {/* ignore */}
                    throw new Error(errorMsg);
                }
                resetUploadState();
            };

            xhr.onerror = () => {
                throw new Error('Network error during upload.');
            };
            
            xhr.send(formData);

        } catch (error) {
            showToast('Upload Error', error.message, 'error');
            uploadStatusEl.textContent = `Error: ${error.message}`;
            resetUploadState(true);
        }
    }
    
    function resetUploadState(isError = false) {
        isUploading = false;
        filesToUpload = [];
        renderStagedFiles();
        uploadBtn.textContent = 'Upload Files';
        if (!isError) {
             setTimeout(() => {
                uploadProgressContainer.classList.add('hidden');
                uploadStatusEl.textContent = '';
            }, 3000);
        }
    }

    // --- Query Logic ---
    async function fetchDocuments() {
        if (!documentsListEl) return;
        documentsLoadingEl.classList.remove('hidden');
        documentsListEl.innerHTML = '';
        try {
            const response = await fetch(`${API_BASE_URL}/documents/`);
            if (!response.ok) throw new Error('Failed to fetch documents.');
            const data = await response.json();
            allDocumentNames = data.documents || [];
            renderDocumentsList();
        } catch (error) {
            showToast('Error', error.message, 'error');
            documentsListEl.innerHTML = '<li>Failed to load documents.</li>';
        } finally {
            documentsLoadingEl.classList.add('hidden');
        }
    }

    function renderDocumentsList() {
        documentsListEl.innerHTML = '';
        if (allDocumentNames.length === 0) {
            documentsListEl.innerHTML = '<li>No documents uploaded yet.</li>';
        } else {
            allDocumentNames.forEach(docName => {
                const li = document.createElement('li');
                li.className = 'document-item';
                const checkboxId = `doc-${docName.replace(/[^a-zA-Z0-9]/g, '-')}`;
                li.innerHTML = `
                    <input type="checkbox" id="${checkboxId}" value="${docName}" name="documentSelection">
                    <label for="${checkboxId}">${docName}</label>
                `;
                documentsListEl.appendChild(li);
            });
            documentsListEl.querySelectorAll('input[name="documentSelection"]').forEach(cb => {
                cb.addEventListener('change', updateSelectedDocuments);
            });
        }
        updateSelectedDocumentsUI();
    }

    function updateSelectedDocuments() {
        selectedDocumentNames = Array.from(documentsListEl.querySelectorAll('input[name="documentSelection"]:checked'))
                                   .map(cb => cb.value);
        updateSelectedDocumentsUI();
    }

    function updateSelectedDocumentsUI() {
        if (allDocumentNames.length === 0) {
            selectedDocStatusEl.textContent = 'No documents available to query.';
            queryInput.disabled = true;
            sendBtn.disabled = true;
        } else if (selectedDocumentNames.length === 0) {
            selectedDocStatusEl.textContent = `Querying all ${allDocumentNames.length} document(s).`;
            queryInput.disabled = false;
        } else {
            selectedDocStatusEl.textContent = `Querying ${selectedDocumentNames.length} selected document(s).`;
            queryInput.disabled = false;
        }
        sendBtn.disabled = queryInput.value.trim() === '' || (allDocumentNames.length === 0 && selectedDocumentNames.length === 0);
    }

    if (queryForm) {
        queryForm.addEventListener('submit', handleQuerySubmit);
        queryInput.addEventListener('input', () => {
            sendBtn.disabled = queryInput.value.trim() === '' || (allDocumentNames.length === 0 && selectedDocumentNames.length === 0);
            // Auto-resize textarea
            queryInput.style.height = 'auto';
            queryInput.style.height = `${queryInput.scrollHeight}px`;
        });
        clearChatBtn.addEventListener('click', clearConversation);
    }

    async function handleQuerySubmit(event) {
        event.preventDefault();
        const queryText = queryInput.value.trim();
        if (!queryText) return;

        addMessageToChat('user', queryText);
        queryInput.value = '';
        queryInput.style.height = 'auto'; // Reset height
        sendBtn.disabled = true;
        const tempAssistantMsgId = `temp-${Date.now()}`;
        addMessageToChat('assistant', 'Thinking...', tempAssistantMsgId, true);


        try {
            const response = await fetch(`${API_BASE_URL}/query/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: queryText, document_names: selectedDocumentNames }),
            });
            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ message: 'Unknown server error' }));
                 throw new Error(errorData.message || `Server error: ${response.status}`);
            }
            const data = await response.json();
            updateMessageInChat(tempAssistantMsgId, data.success ? data.response : `Error: ${data.message}`);

        } catch (error) {
            updateMessageInChat(tempAssistantMsgId, `Sorry, an error occurred: ${error.message}`);
        } finally {
            sendBtn.disabled = queryInput.value.trim() === '';
            updateSelectedDocumentsUI(); // Re-check if input should be enabled
        }
    }

    function addMessageToChat(sender, text, id = Date.now().toString(), isLoading = false) {
        const message = { id, role: sender, content: text, timestamp: new Date(), isLoading };
        chatMessages.push(message);
        renderChatMessages();
    }
    
    function updateMessageInChat(id, newText) {
        const messageIndex = chatMessages.findIndex(msg => msg.id === id);
        if (messageIndex !== -1) {
            chatMessages[messageIndex].content = newText;
            chatMessages[messageIndex].isLoading = false; // No longer loading
            renderChatMessages();
        }
    }

    function renderChatMessages() {
        if (chatMessages.length === 0) {
            emptyChatEl.classList.remove('hidden');
        } else {
            emptyChatEl.classList.add('hidden');
        }
        chatMessagesEl.innerHTML = chatMessages.map(msg => `
            <div class="message ${msg.role}">
                <div class="message-sender">${msg.role === 'user' ? 'You' : 'TextAssist'}</div>
                <div class="message-content">${msg.isLoading ? '<i>Typing...</i>' : msg.content.replace(/\n/g, '<br>')}</div>
                <div class="message-time">${formatTime(msg.timestamp)}</div>
            </div>
        `).join('');
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }

    function clearConversation() {
        chatMessages = [];
        renderChatMessages();
        showToast('Chat Cleared', 'The conversation has been cleared.', 'default');
    }

    // --- Speech Recognition & Synthesis ---
    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            speechRecognition = new SpeechRecognition();
            speechRecognition.continuous = false;
            speechRecognition.interimResults = true;

            speechRecognition.onresult = (event) => {
                let transcript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    transcript += event.results[i][0].transcript;
                }
                queryInput.value = transcript;
                queryInput.dispatchEvent(new Event('input')); // Trigger input event for button state
            };
            speechRecognition.onend = () => {
                isListening = false;
                voiceToggleBtn.classList.remove('active');
                voiceToggleBtn.textContent = '🎤';
            };
            speechRecognition.onerror = (event) => {
                showToast('Voice Error', event.error, 'error');
                isListening = false;
                voiceToggleBtn.classList.remove('active');
                voiceToggleBtn.textContent = '🎤';
            };
        } else {
            voiceToggleBtn.disabled = true;
            showToast('Unsupported', 'Speech recognition is not supported in your browser.', 'default');
        }
    }

    if (voiceToggleBtn) {
        voiceToggleBtn.addEventListener('click', () => {
            if (!speechRecognition) return;
            if (isListening) {
                speechRecognition.stop();
            } else {
                speechRecognition.start();
                isListening = true;
                voiceToggleBtn.classList.add('active');
                voiceToggleBtn.textContent = '🛑'; // Stop icon
            }
        });
    }

    // --- Initializations ---
    fetchDocuments();
    initSpeechRecognition();
    updateSelectedDocumentsUI(); // Initial UI state for query section
});