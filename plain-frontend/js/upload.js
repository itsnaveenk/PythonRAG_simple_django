document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const uploadDropzone = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('file-upload');
    const uploadFilename = document.getElementById('upload-filename');
    const uploadFilesize = document.getElementById('upload-filesize');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadBtnText = document.getElementById('upload-btn-text');
    const uploadBtnIcon = document.getElementById('upload-btn-icon');
    const uploadBtnLoader = document.getElementById('upload-btn-loader');
    const uploadProgressContainer = document.getElementById('upload-progress-container');
    const uploadProgressBar = document.getElementById('upload-progress-bar');
    const uploadProgressPercentage = document.getElementById('upload-progress-percentage');
    const uploadStatus = document.getElementById('upload-status');
    const uploadedFilesList = document.getElementById('uploaded-files-list');
    const uploadedFilesCard = document.getElementById('uploaded-files-card');
    const stagedFilesContainer = document.getElementById('staged-files-container'); // For the list of files to be uploaded
    const stagedFilesList = document.getElementById('staged-files-list'); // The <ul> for staged files

    // State
    let uploading = false;
    let uploadedFilesHistory = []; // Stores files that have been successfully uploaded in the past
    let filesToUpload = []; // Current batch of files selected for upload

    // Event Listeners
    uploadDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadDropzone.classList.add('active');
    });

    uploadDropzone.addEventListener('dragleave', () => {
        uploadDropzone.classList.remove('active');
    });

    uploadDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadDropzone.classList.remove('active');
        if (e.dataTransfer.files.length) {
            handleFileSelection(e.dataTransfer.files);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            handleFileSelection(fileInput.files);
        }
        // Reset file input to allow selecting the same file again if removed then re-added
        fileInput.value = ''; 
    });

    uploadBtn.addEventListener('click', () => {
        handleUpload();
    });

    // Functions
    function validateFile(selectedFile) {
        const allowedTypes = ['.pdf', '.docx', '.txt', '.pptx'];
        const fileExtension = '.' + selectedFile.name.split('.').pop().toLowerCase();
        
        if (!allowedTypes.includes(fileExtension)) {
            showToast('Invalid File Type', `File ${selectedFile.name} is not a PDF, DOCX, TXT, or PPTX file.`, 'error');
            return false;
        }
        
        if (selectedFile.size > 50 * 1024 * 1024) { // Max 50MB
            showToast('File Too Large', `File ${selectedFile.name} is larger than 50MB.`, 'error');
            return false;
        }
        return true;
    }

    function handleFileSelection(selectedFiles) {
        const newValidFiles = Array.from(selectedFiles).filter(file => {
            // Check if file is valid and not already in the filesToUpload list
            const isDuplicate = filesToUpload.some(existingFile => existingFile.name === file.name && existingFile.size === file.size);
            if (isDuplicate) {
                showToast('Duplicate File', `${file.name} is already in the list.`, 'default');
                return false;
            }
            return validateFile(file);
        });

        if (newValidFiles.length > 0) {
            filesToUpload.push(...newValidFiles);
            renderStagedFiles();
        } else if (selectedFiles.length > 0 && filesToUpload.length === 0) {
            // If some files were selected but none were valid and the list is empty
            showToast('No Valid Files', 'No valid files were selected or added.', 'default');
        }
        // If newValidFiles is empty but filesToUpload already has items, renderStagedFiles will just update the existing list display
        // (though no new files were added, so no visual change unless an invalid file was attempted)
        if (filesToUpload.length > 0 && newValidFiles.length === 0 && selectedFiles.length > 0) {
             // This case means user tried to add files, but all were invalid or duplicates.
             // renderStagedFiles() will ensure the UI is consistent.
        }
         if (filesToUpload.length === 0 && newValidFiles.length === 0 && selectedFiles.length === 0){
            // This case means no files were selected (e.g. user cancelled file dialog)
            // renderStagedFiles() will ensure the UI is consistent.
        }
        renderStagedFiles(); // Always re-render to ensure UI consistency
    }

    function renderStagedFiles() {
        if (filesToUpload.length === 0) {
            stagedFilesContainer.classList.add('hidden');
            uploadFilename.textContent = 'Drag and drop or click to upload'; // Reset dropzone text
            uploadFilesize.textContent = 'PDF, DOCX, TXT, PPTX (Max 50MB)';
            uploadDropzone.classList.remove('active'); // Reset dropzone style
        } else {
            stagedFilesContainer.classList.remove('hidden');
            stagedFilesList.innerHTML = ''; // Clear existing items

            filesToUpload.forEach((file, index) => {
                const listItem = document.createElement('li');
                listItem.className = 'staged-file-item';
                // Use a unique ID for each file, e.g., based on name and size, for removal
                // For simplicity, using index here, but ensure it's stable if list reorders.
                // Using a timestamp or a simple counter for a unique key could be more robust if files can be reordered.
                // For now, index is fine as we re-render the whole list.
                listItem.dataset.fileIndex = index; 

                listItem.innerHTML = `
                    <div class="staged-file-info">
                        <span class="staged-file-name" title="${file.name}">${file.name}</span>
                        <span class="staged-file-size">(${formatFileSize(file.size)})</span>
                    </div>
                    <button class="remove-staged-file-btn" title="Remove ${file.name}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                `;
                stagedFilesList.appendChild(listItem);
            });

            // Add event listeners to remove buttons
            stagedFilesList.querySelectorAll('.remove-staged-file-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const itemToRemove = e.currentTarget.closest('.staged-file-item');
                    const fileIndexToRemove = parseInt(itemToRemove.dataset.fileIndex, 10);
                    removeStagedFile(fileIndexToRemove);
                });
            });
            
            // Update the main dropzone text to indicate files are staged
            uploadFilename.textContent = `${filesToUpload.length} file(s) selected for upload.`;
            const totalSize = filesToUpload.reduce((acc, curr) => acc + curr.size, 0);
            uploadFilesize.textContent = `Total size: ${formatFileSize(totalSize)}`;
            uploadDropzone.classList.add('active'); // Keep dropzone styled as active
        }
        updateUploadButtonState(); // Update button based on whether files are staged
    }

    function removeStagedFile(indexToRemove) {
        if (indexToRemove >= 0 && indexToRemove < filesToUpload.length) {
            const removedFile = filesToUpload.splice(indexToRemove, 1)[0]; // Remove file from array
            showToast('File Removed', `${removedFile.name} has been removed from the selection.`, 'default');
            renderStagedFiles(); // Re-render the list of staged files
        }
    }

    function updateUploadButtonState() {
        if (filesToUpload.length > 0) {
            uploadBtn.disabled = false;
            uploadBtnText.textContent = `Upload ${filesToUpload.length} File(s)`;
        } else {
            uploadBtn.disabled = true;
            uploadBtnText.textContent = 'Upload Document';
        }
    }
    
    async function handleUpload() {
        if (filesToUpload.length === 0 || uploading) return;

        uploading = true;
        let filesUploadedSuccessfullyCount = 0;
        const totalFilesToProcess = filesToUpload.length;
        const currentBatch = [...filesToUpload];

        for (let i = 0; i < currentBatch.length; i++) {
            const currentFile = currentBatch[i];
            
            // Update UI for the current file being uploaded
            uploadBtnText.textContent = `Uploading ${currentFile.name} (${i + 1}/${totalFilesToProcess})...`;
            uploadBtnIcon.classList.add('hidden');
            uploadBtnLoader.classList.remove('hidden');
            uploadProgressContainer.classList.remove('hidden');
            uploadProgressBar.style.width = '0%';
            uploadProgressPercentage.textContent = '0%';
            uploadStatus.innerHTML = `Starting upload of ${currentFile.name}...`;

            const formData = new FormData();
            formData.append('file', currentFile);

            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', 'http://localhost:8000/api/upload/', true);

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const rawPercentage = (event.loaded / event.total) * 100;
                        // Cap at 99% during the onprogress events.
                        // The final 100% will be set by onload upon success.
                        const displayPercentage = Math.min(Math.round(rawPercentage), 80);
                        updateProgress(displayPercentage);
                        uploadStatus.innerHTML = `Uploading ${currentFile.name}: ${displayPercentage}%`;
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            if (data.success) {
                                updateProgress(100); // Final progress for this file
                                addUploadedFileToHistory(currentFile);
                                showToast('Upload Successful', `${currentFile.name} processed.`, 'success');
                                filesUploadedSuccessfullyCount++;
                                resolve(data);
                            } else {
                                throw new Error(data.message || `Unknown error for ${currentFile.name}`);
                            }
                        } catch (parseError) {
                            console.error(`Error parsing response for ${currentFile.name}:`, parseError, xhr.responseText);
                            updateProgress(0); 
                            uploadStatus.innerHTML = `<span style="color: var(--destructive);">Failed: ${currentFile.name} - Invalid server response</span>`;
                            showToast('Upload Failed', `${currentFile.name}: Invalid server response`, 'error');
                            reject(new Error('Invalid server response'));
                        }
                    } else {
                        let errorMessage = `Failed to upload ${currentFile.name}`;
                        try {
                            const errorData = JSON.parse(xhr.responseText);
                            errorMessage = errorData.message || errorMessage;
                        } catch (e) {
                            // Keep default error message if response is not JSON
                        }
                        updateProgress(0);
                        uploadStatus.innerHTML = `<span style="color: var(--destructive);">Failed: ${currentFile.name} - ${xhr.statusText}</span>`;
                        showToast('Upload Failed', `${currentFile.name}: ${errorMessage}`, 'error');
                        reject(new Error(errorMessage));
                    }
                };

                xhr.onerror = () => {
                    updateProgress(0);
                    uploadStatus.innerHTML = `<span style="color: var(--destructive);">Failed: ${currentFile.name} - Network error</span>`;
                    showToast('Upload Failed', `${currentFile.name}: Network error. Please check your connection.`, 'error');
                    reject(new Error('Network error'));
                };

                xhr.send(formData);
            }).catch(error => {
                // Error is already handled in onload and onerror, but catch prevents unhandled promise rejection
                console.error(`Upload promise rejected for ${currentFile.name}:`, error);
                // Ensure UI reflects failure for this specific file if not already done
                if (uploadStatus.innerHTML.indexOf(currentFile.name) === -1 || !uploadStatus.innerHTML.includes("Failed")){
                    uploadStatus.innerHTML = `<span style="color: var(--destructive);">Failed: ${currentFile.name} - ${error.message}</span>`;
                }
            });
        }

        // After all files in the batch are processed
        uploading = false;
        uploadBtnIcon.classList.remove('hidden');
        uploadBtnLoader.classList.add('hidden');
        
        if (filesUploadedSuccessfullyCount === totalFilesToProcess && totalFilesToProcess > 0) {
            uploadStatus.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span style="color: var(--primary)">All ${totalFilesToProcess} files uploaded successfully!</span>`;
        } else if (filesUploadedSuccessfullyCount > 0) {
            uploadStatus.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="orange" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                     <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span style="color: orange">${filesUploadedSuccessfullyCount} of ${totalFilesToProcess} files uploaded. Some had issues.</span>`;
        } else if (totalFilesToProcess > 0) {
            uploadStatus.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--destructive)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span style="color: var(--destructive)">All file uploads failed.</span>`;
        } else {
             uploadStatus.innerHTML = ''; // No files were attempted
        }

        // Reset for next batch
        filesToUpload = []; // Clear the staged files list
        renderStagedFiles(); // This will hide the list and reset dropzone text & button
        // fileInput.value = ''; // Already done in 'change' event to allow re-selection
    }
    
    function updateProgress(progress) {
        uploadProgressBar.style.width = `${progress}%`;
        uploadProgressPercentage.textContent = `${progress}%`;
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function addUploadedFileToHistory(file) { // Renamed from addUploadedFile
        uploadedFilesHistory.push({
            name: file.name,
            size: file.size,
            type: file.type,
            uploadedAt: new Date()
        });
        renderUploadedFilesHistory(); // New function to render the history list
    }

    function renderUploadedFilesHistory() {
        if (uploadedFilesHistory.length === 0) {
            uploadedFilesCard.classList.add('hidden');
            return;
        }

        uploadedFilesCard.classList.remove('hidden');
        uploadedFilesList.innerHTML = ''; // Clear existing items

        // Sort by most recent first
        const sortedHistory = [...uploadedFilesHistory].sort((a, b) => b.uploadedAt - a.uploadedAt);

        sortedHistory.forEach(file => {
            const listItem = document.createElement('li');
            listItem.className = 'uploaded-file-item';
            
            // Basic icon, could be enhanced based on file type
            let iconSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="uploaded-file-icon">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
            `;

            listItem.innerHTML = `
                ${iconSvg}
                <span class="uploaded-file-name" title="${file.name}">${file.name}</span>
                <span class="uploaded-file-time">${formatTime(file.uploadedAt)}</span>
            `;
            uploadedFilesList.appendChild(listItem);
        });
    }
    
    // Initial UI setup
    renderStagedFiles(); // Initialize the staged files view (should be empty)
    renderUploadedFilesHistory(); // Initialize the uploaded files history view
});