import logging
from django.http import JsonResponse
from django.conf import settings
import os
import json
import uuid
from . import utils
from django.views.decorators.csrf import csrf_exempt  # Add this import

logger = logging.getLogger(__name__)

@csrf_exempt
def upload_view(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': "Invalid request method. Only POST is allowed."}, status=405)

    file = request.FILES.get('file')
    if not file:
        return JsonResponse({'success': False, 'message': "No file provided."}, status=400)

    # Replace the PDF validation with supported document formats
    SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.rtf', '.ppt', '.pptx']
    file_extension = os.path.splitext(file.name.lower())[1]
    
    if file_extension not in SUPPORTED_EXTENSIONS:
        return JsonResponse({
            'success': False, 
            'message': f"Invalid file type. Supported formats: {', '.join(SUPPORTED_EXTENSIONS)}"
        }, status=400)

    # Consider adding file size validation
    MAX_UPLOAD_SIZE = 200 * 1024 * 1024 # Example: 200MB limit
    if file.size > MAX_UPLOAD_SIZE:
        return JsonResponse({'success': False, 'message': f"File size exceeds the limit of {MAX_UPLOAD_SIZE // 1024 // 1024}MB."}, status=413)

    temp_path = os.path.join(settings.BASE_DIR, 'temp_uploads')
    os.makedirs(temp_path, exist_ok=True)
    # Generate a unique temporary filename to avoid collisions and potential security issues
    original_extension = os.path.splitext(file.name)[1] # Get original extension
    temp_filename = f"{uuid.uuid4()}{original_extension}" # Use original extension
    file_path = os.path.join(temp_path, temp_filename)

    try:
        # Save the uploaded file securely
        with open(file_path, 'wb') as f:
            for chunk in file.chunks():
                f.write(chunk)

        # Process the file
        try:
            # Replace direct call to extract_text_from_pdf with the new function
            text = utils.extract_text_from_document(file_path)
            if not text or not text.strip():
                logger.warning(f"Extracted empty text from document: {file.name}")
                return JsonResponse({'success': False, 'message': "Could not extract text from the document."}, status=400)

            chunks = utils.chunk_text(text)
            if not chunks:
                logger.warning(f"Could not chunk text from PDF: {file.name}")
                return JsonResponse({'success': False, 'message': "Failed to process text chunks."}, status=500)

            embeddings = utils.get_embeddings(chunks)
            if embeddings is None:
                logger.error(f"Failed to get embeddings for PDF: {file.name}")
                return JsonResponse({'success': False, 'message': "Failed to generate document embeddings."}, status=500)

            # ---- Start: Add to ChromaDB ----
            try:
                collection = utils.initialize_chromadb()
                if collection is None:
                    logger.error("Failed to initialize ChromaDB collection during upload.")
                    return JsonResponse({'success': False, 'message': "Failed to connect to the document database."}, status=503)

                # Generate unique IDs for each chunk
                base_doc_id = file.name # Consider sanitizing or using a hash if filename is complex/unsafe
                chunk_ids = [f"{base_doc_id}_{i}" for i in range(len(chunks))]
                # Create metadatas list, ensuring 'filename' is stored for filtering
                metadatas = [{"filename": file.name, "chunk_index": i} for i in range(len(chunks))]

                collection.add(
                    embeddings=embeddings,
                    documents=chunks,
                    ids=chunk_ids,
                    metadatas=metadatas # Add metadatas here
                )
                logger.info(f"Added {len(chunks)} chunks from {file.name} to ChromaDB with metadata.")

            except Exception as e:
                logger.error(f"Failed to add embeddings for {file.name} to ChromaDB: {e}", exc_info=True)
                return JsonResponse({'success': False, 'message': "Failed to store document embeddings in the database."}, status=500)
            # ---- End: Add to ChromaDB ----

        except Exception as e:
            logger.error(f"Error processing PDF {file.name}: {e}", exc_info=True)
            return JsonResponse({'success': False, 'message': f"An error occurred during file processing: {e}"}, status=500)

        # Return success only after all steps (including DB add) are complete
        return JsonResponse({'success': True, 'message': f"File '{file.name}' processed and stored successfully."}, status=200)

    except IOError as e:
        logger.error(f"IOError saving uploaded file {file.name}: {e}", exc_info=True)
        return JsonResponse({'success': False, 'message': "Failed to save uploaded file."}, status=500)
    except Exception as e:
        logger.error(f"Unexpected error handling upload for {file.name}: {e}", exc_info=True)
        return JsonResponse({'success': False, 'message': "An unexpected error occurred."}, status=500)
    finally:
        # Ensure the temporary file is always removed
        if os.path.exists(file_path): # Checks if the file exists
            try:
                os.remove(file_path) # Deletes the file
            except OSError as e:
                # Logs an error if deletion fails, but doesn't stop the response
                logger.error(f"Error removing temporary file {file_path}: {e}", exc_info=True)

@csrf_exempt  # Add this decorator to exempt this view from CSRF protection
def query_view(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': "Invalid request method. Only POST is allowed."}, status=405)

    try:
        data = json.loads(request.body)
        query = data.get('query', '').strip() # Trim whitespace
        document_names = data.get('document_names', []) # New: Get document_names for filtering
    except json.JSONDecodeError:
        logger.warning("Received invalid JSON in query request body.")
        return JsonResponse({'success': False, 'message': "Invalid JSON format in request body."}, status=400)
    except Exception as e:
        logger.error(f"Error reading request body: {e}", exc_info=True)
        return JsonResponse({'success': False, 'message': "Could not read request data."}, status=400)

    if not query:
        logger.warning("Received empty query.")
        return JsonResponse({'success': False, 'message': "Query cannot be empty."}, status=400)

    # Add query length validation if desired
    # MAX_QUERY_LENGTH = 500
    # if len(query) > MAX_QUERY_LENGTH:
    #     logger.warning(f"Query length exceeded limit: {len(query)} chars.")
    #     return JsonResponse({'success': False, 'message': f"Query length exceeds the limit of {MAX_QUERY_LENGTH} characters."}, status=413)

    try: # This try block covers the core query processing logic
        collection = utils.initialize_chromadb()
        if collection is None:
            logger.error("Failed to initialize ChromaDB collection.")
            # Return 503 Service Unavailable as the backend dependency is down
            return JsonResponse({'success': False, 'message': "Failed to connect to the document database."}, status=503)

        # Pass document_names to query_chromadb
        context_chunks = utils.query_chromadb(collection, query, n_results=5, document_names=document_names)
        if not context_chunks:
            logger.info(f"No relevant context found for query: '{query}' with specified documents: {document_names}")
            # Return a specific message indicating no context was found.
            return JsonResponse({'success': True, 'query': query, 'response': "No relevant information found in the uploaded documents for your query."}, status=200)

        response_text = utils.generate_response(query, context_chunks)
        if response_text is None: # Assuming generate_response returns None on failure
            logger.error(f"Failed to generate response for query: '{query}'")
            return JsonResponse({'success': False, 'message': "Failed to generate a response from the language model."}, status=500)

        return JsonResponse({'success': True, 'query': query, 'response': response_text}, status=200)

    except Exception as e: # This except block catches errors specifically from the core logic try block above
        logger.error(f"Error processing query '{query}': {e}", exc_info=True)
        # Return a generic 500 error for internal processing issues
        return JsonResponse({'success': False, 'message': f"An error occurred while processing your query."}, status=500)

# New view to list uploaded documents
def documents_view(request):
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': "Invalid request method. Only GET is allowed."}, status=405)
    try:
        collection = utils.initialize_chromadb()
        if collection is None:
            logger.error("Failed to initialize ChromaDB collection for listing documents.")
            return JsonResponse({'success': False, 'message': "Failed to connect to the document database."}, status=503)

        # Fetch all items and extract unique filenames from metadatas
        # This assumes 'filename' is stored in metadatas as specified in upload_view modifications
        all_items = collection.get(include=["metadatas"]) # Fetch only metadatas to be more efficient
        
        filenames = set()
        if all_items and all_items.get('metadatas'):
            for metadata_item in all_items['metadatas']: # Corrected variable name
                if metadata_item and 'filename' in metadata_item: # Check metadata_item directly
                    filenames.add(metadata_item['filename'])
        
        return JsonResponse({'success': True, 'documents': sorted(list(filenames))}, status=200)
    except Exception as e:
        logger.error(f"Error listing documents: {e}", exc_info=True)
        return JsonResponse({'success': False, 'message': "An error occurred while retrieving document list."}, status=500)
