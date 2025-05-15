document.addEventListener('DOMContentLoaded', function() {
    // Get all the elements
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
    const stagedFilesContainer = document.getElementById('staged-files-container');
    const stagedFilesList = document.getElementById('staged-files-list');

    // Variables to track state
    let uploading = false;
    let uploadedFilesHistory = [];
    let filesToUpload = [];

    // Handle drag and drop events
    uploadDropzone.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadDropzone.classList.add('active');
    });

    uploadDropzone.addEventListener('dragleave', function() {
        uploadDropzone.classList.remove('active');
    });

    uploadDropzone.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadDropzone.classList.remove('active');
        if (e.dataTransfer.files.length) {
            handleFileSelection(e.dataTransfer.files);
        }
    });

    // Handle file input change
    fileInput.addEventListener('change', function() {
        if (fileInput.files.length) {
            handleFileSelection(fileInput.files);
        }
        fileInput.value = ''; // Reset input to allow selecting same file again
    });

    // Handle upload button click
    uploadBtn.addEventListener('click', function() {
        handleUpload();
    });

    // Check if file is valid
    function validateFile(file) {
        // Check file type
        const allowedTypes = ['.pdf', '.docx', '.txt', '.pptx'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!allowedTypes.includes(fileExtension)) {
            alert('Invalid file type: ' + file.name + '\nPlease use PDF, DOCX, TXT, or PPTX files.');
            return false;
        }
        
        // Check file size (max 50MB)
        if (file.size > 50 * 1024 * 1024) {
            alert('File too large: ' + file.name + '\nMaximum size is 50MB.');
            return false;
        }
        return true;
    }

    // Handle file selection (from drag&drop or input)
    function handleFileSelection(selectedFiles) {
        // Filter valid files and check for duplicates
        const newValidFiles = Array.from(selectedFiles).filter(function(file) {
            const isDuplicate = filesToUpload.some(function(existingFile) {
                return existingFile.name === file.name && existingFile.size === file.size;
            });
            
            if (isDuplicate) {
                alert(file.name + ' is already in the list.');
                return false;
            }
            return validateFile(file);
        });

        // Add valid files to our list
        if (newValidFiles.length > 0) {
            filesToUpload.push(...newValidFiles);
        }
        
        // Update the UI
        renderStagedFiles();
    }

    // Update the UI with selected files
    function renderStagedFiles() {
        if (filesToUpload.length === 0) {
            // No files selected
            stagedFilesContainer.classList.add('hidden');
            uploadFilename.textContent = 'Drag and drop or click to upload';
            uploadFilesize.textContent = 'PDF, DOCX, TXT, PPTX (Max 50MB)';
            uploadDropzone.classList.remove('active');
        } else {
            // Show selected files
            stagedFilesContainer.classList.remove('hidden');
            stagedFilesList.innerHTML = ''; // Clear existing items

            // Add each file to the list
            filesToUpload.forEach(function(file, index) {
                const listItem = document.createElement('li');
                listItem.className = 'staged-file-item';
                listItem.dataset.fileIndex = index;

                listItem.innerHTML = `
                    <div class="staged-file-info">
                        <span class="staged-file-name" title="${file.name}">${file.name}</span>
                        <span class="staged-file-size">(${formatFileSize(file.size)})</span>
                    </div>
                    <button class="remove-staged-file-btn" title="Remove ${file.name}">✕</button>
                `;
                stagedFilesList.appendChild(listItem);
            });

            // Add remove button functionality
            stagedFilesList.querySelectorAll('.remove-staged-file-btn').forEach(function(button) {
                button.addEventListener('click', function(e) {
                    const itemToRemove = e.currentTarget.closest('.staged-file-item');
                    const fileIndex = parseInt(itemToRemove.dataset.fileIndex, 10);
                    removeStagedFile(fileIndex);
                });
            });
            
            // Update dropzone text
            uploadFilename.textContent = `${filesToUpload.length} file(s) selected`;
            const totalSize = filesToUpload.reduce(function(total, file) {
                return total + file.size;
            }, 0);
            uploadFilesize.textContent = `Total size: ${formatFileSize(totalSize)}`;
            uploadDropzone.classList.add('active');
        }
        
        // Update upload button state
        uploadBtn.disabled = filesToUpload.length === 0;
        uploadBtnText.textContent = filesToUpload.length > 0 ? 
            `Upload ${filesToUpload.length} File(s)` : 'Upload Document';
    }

    // Remove a file from the selection
    function removeStagedFile(index) {
        if (index >= 0 && index < filesToUpload.length) {
            const removedFile = filesToUpload.splice(index, 1)[0];
            alert(removedFile.name + ' has been removed from the selection.');
            renderStagedFiles();
        }
    }

    // Handle the upload process
    async function handleUpload() {
        if (filesToUpload.length === 0 || uploading) return;

        uploading = true;
        let successCount = 0;
        const totalFiles = filesToUpload.length;
        const filesToProcess = [...filesToUpload];

        // Process each file
        for (let i = 0; i < filesToProcess.length; i++) {
            const file = filesToProcess[i];
            
            // Update UI for current file
            uploadBtnText.textContent = `Uploading ${file.name} (${i + 1}/${totalFiles})...`;
            uploadBtnIcon.classList.add('hidden');
            uploadBtnLoader.classList.remove('hidden');
            uploadProgressContainer.classList.remove('hidden');
            uploadProgressBar.style.width = '0%';
            uploadProgressPercentage.textContent = '0%';
            uploadStatus.innerHTML = `Starting upload of ${file.name}...`;

            // Create form data with the file
            const formData = new FormData();
            formData.append('file', file);

            try {
                // Upload the file
                const response = await fetch('http://localhost:8000/api/upload/', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Upload successful
                    updateProgress(100);
                    addUploadedFileToHistory(file);
                    alert('Upload successful: ' + file.name);
                    successCount++;
                } else {
                    // Server returned error
                    updateProgress(0);
                    uploadStatus.innerHTML = `<span style="color: red;">Failed: ${file.name} - ${data.message || 'Unknown error'}</span>`;
                    alert('Upload failed: ' + file.name + ' - ' + (data.message || 'Unknown error'));
                }
            } catch (error) {
                // Network or other error
                updateProgress(0);
                uploadStatus.innerHTML = `<span style="color: red;">Failed: ${file.name} - Network error</span>`;
                alert('Upload failed: ' + file.name + ' - Network error');
                console.error('Upload error:', error);
            }
        }

        // Update UI after all uploads complete
        uploading = false;
        uploadBtnIcon.classList.remove('hidden');
        uploadBtnLoader.classList.add('hidden');
        
        if (successCount === totalFiles) {
            uploadStatus.innerHTML = `All ${totalFiles} files uploaded successfully!`;
        } else if (successCount > 0) {
            uploadStatus.innerHTML = `${successCount} of ${totalFiles} files uploaded. Some had issues.`;
        } else {
            uploadStatus.innerHTML = `All file uploads failed.`;
        }

        // Reset for next upload
        filesToUpload = [];
        renderStagedFiles();
    }
    
    // Update progress bar
    function updateProgress(progress) {
        uploadProgressBar.style.width = `${progress}%`;
        uploadProgressPercentage.textContent = `${progress}%`;
    }

    // Format file size for display
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Add uploaded file to history
    function addUploadedFileToHistory(file) {
        uploadedFilesHistory.push({
            name: file.name,
            size: file.size,
            type: file.type,
            uploadedAt: new Date()
        });
        renderUploadedFilesHistory();
    }

    // Update the UI with uploaded files history
    function renderUploadedFilesHistory() {
        if (uploadedFilesHistory.length === 0) {
            uploadedFilesCard.classList.add('hidden');
            return;
        }

        uploadedFilesCard.classList.remove('hidden');
        uploadedFilesList.innerHTML = '';

        // Sort by most recent first
        const sortedHistory = [...uploadedFilesHistory].sort(function(a, b) {
            return b.uploadedAt - a.uploadedAt;
        });

        // Add each file to the history list
        sortedHistory.forEach(function(file) {
            const listItem = document.createElement('li');
            listItem.className = 'uploaded-file-item';
            
            listItem.innerHTML = `
                <span class="uploaded-file-name" title="${file.name}">${file.name}</span>
                <span class="uploaded-file-time">${formatTime(file.uploadedAt)}</span>
            `;
            uploadedFilesList.appendChild(listItem);
        });
    }
    
    // Format time for display
    function formatTime(date) {
        return new Date(date).toLocaleTimeString();
    }
    
    // Initialize UI
    renderStagedFiles();
    renderUploadedFilesHistory();
});