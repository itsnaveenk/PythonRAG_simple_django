import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import json
import uuid
import logging
from werkzeug.utils import secure_filename
from utils import (
    extract_text_from_document, chunk_text, get_embeddings,
    initialize_chromadb, query_chromadb, generate_response
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Flask application setup
app = Flask(__name__, static_folder='plain-frontend', static_url_path='')
CORS(app)

# Configuration
app.config['GEMINI_API_KEY'] = os.getenv('GEMINI_API_KEY')
app.config['CHROMA_DB_PATH'] = os.path.join(os.path.dirname(__file__), "chroma_db")
app.config['CHROMA_COLLECTION_NAME'] = "rag_collection"
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'temp_uploads')
app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # 200MB limit

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Routes for static pages
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/upload/')
def upload_page():
    return send_from_directory(app.static_folder, 'upload.html')

@app.route('/query/')
def query_page():
    return send_from_directory(app.static_folder, 'query.html')

# API routes
@app.route('/api/upload/', methods=['POST'])
def upload_view():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': "No file provided."}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': "No file selected."}), 400

    SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.rtf', '.ppt', '.pptx']
    file_extension = os.path.splitext(file.filename.lower())[1]
    
    if file_extension not in SUPPORTED_EXTENSIONS:
        return jsonify({
            'success': False, 
            'message': f"Invalid file type. Supported formats: {', '.join(SUPPORTED_EXTENSIONS)}"
        }), 400

    # Generate a unique temporary filename
    original_extension = os.path.splitext(file.filename)[1]
    temp_filename = f"{uuid.uuid4()}{original_extension}"
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)

    try:
        # Save the uploaded file securely
        file.save(file_path)

        # Process the file
        try:
            text = extract_text_from_document(file_path)
            if not text or not text.strip():
                logger.warning(f"Extracted empty text from document: {file.filename}")
                return jsonify({'success': False, 'message': "Could not extract text from the document."}), 400

            chunks = chunk_text(text)
            if not chunks:
                logger.warning(f"Could not chunk text from document: {file.filename}")
                return jsonify({'success': False, 'message': "Failed to process text chunks."}), 500

            embeddings = get_embeddings(chunks)
            if embeddings is None:
                logger.error(f"Failed to get embeddings for document: {file.filename}")
                return jsonify({'success': False, 'message': "Failed to generate document embeddings."}), 500

            # Add to ChromaDB
            try:
                collection = initialize_chromadb(app.config['CHROMA_DB_PATH'], app.config['CHROMA_COLLECTION_NAME'])
                if collection is None:
                    logger.error("Failed to initialize ChromaDB collection during upload.")
                    return jsonify({'success': False, 'message': "Failed to connect to the document database."}), 503

                # Generate unique IDs for each chunk
                base_doc_id = file.filename
                chunk_ids = [f"{base_doc_id}_{i}" for i in range(len(chunks))]
                # Create metadatas list with filename for filtering
                metadatas = [{"filename": file.filename, "chunk_index": i} for i in range(len(chunks))]

                collection.add(
                    embeddings=embeddings,
                    documents=chunks,
                    ids=chunk_ids,
                    metadatas=metadatas
                )
                logger.info(f"Added {len(chunks)} chunks from {file.filename} to ChromaDB with metadata.")

            except Exception as e:
                logger.error(f"Failed to add embeddings for {file.filename} to ChromaDB: {e}", exc_info=True)
                return jsonify({'success': False, 'message': "Failed to store document embeddings in the database."}), 500

        except Exception as e:
            logger.error(f"Error processing document {file.filename}: {e}", exc_info=True)
            return jsonify({'success': False, 'message': f"An error occurred during file processing: {e}"}), 500

        return jsonify({'success': True, 'message': f"File '{file.filename}' processed and stored successfully."}), 200

    except Exception as e:
        logger.error(f"Unexpected error handling upload for {file.filename}: {e}", exc_info=True)
        return jsonify({'success': False, 'message': "An unexpected error occurred."}), 500
    finally:
        # Ensure the temporary file is always removed
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError as e:
                logger.error(f"Error removing temporary file {file_path}: {e}", exc_info=True)

@app.route('/api/query/', methods=['POST'])
def query_view():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': "Invalid JSON format in request body."}), 400
            
        query = data.get('query', '').strip()
        document_names = data.get('document_names', [])
    except Exception as e:
        logger.error(f"Error reading request body: {e}", exc_info=True)
        return jsonify({'success': False, 'message': "Could not read request data."}), 400

    if not query:
        logger.warning("Received empty query.")
        return jsonify({'success': False, 'message': "Query cannot be empty."}), 400

    try:
        collection = initialize_chromadb(app.config['CHROMA_DB_PATH'], app.config['CHROMA_COLLECTION_NAME'])
        if collection is None:
            logger.error("Failed to initialize ChromaDB collection.")
            return jsonify({'success': False, 'message': "Failed to connect to the document database."}), 503

        context_chunks = query_chromadb(collection, query, n_results=5, document_names=document_names)
        if not context_chunks:
            logger.info(f"No relevant context found for query: '{query}' with specified documents: {document_names}")
            return jsonify({'success': True, 'query': query, 'response': "No relevant information found in the uploaded documents for your query."}), 200

        response_text = generate_response(query, context_chunks)
        if response_text is None:
            logger.error(f"Failed to generate response for query: '{query}'")
            return jsonify({'success': False, 'message': "Failed to generate a response from the language model."}), 500

        return jsonify({'success': True, 'query': query, 'response': response_text}), 200

    except Exception as e:
        logger.error(f"Error processing query '{query}': {e}", exc_info=True)
        return jsonify({'success': False, 'message': f"An error occurred while processing your query."}), 500

@app.route('/api/documents/', methods=['GET'])
def documents_view():
    try:
        collection = initialize_chromadb(app.config['CHROMA_DB_PATH'], app.config['CHROMA_COLLECTION_NAME'])
        if collection is None:
            logger.error("Failed to initialize ChromaDB collection for listing documents.")
            return jsonify({'success': False, 'message': "Failed to connect to the document database."}), 503

        all_items = collection.get(include=["metadatas"])
        
        filenames = set()
        if all_items and all_items.get('metadatas'):
            for metadata_item in all_items['metadatas']:
                if metadata_item and 'filename' in metadata_item:
                    filenames.add(metadata_item['filename'])
        
        return jsonify({'success': True, 'documents': sorted(list(filenames))}), 200
    except Exception as e:
        logger.error(f"Error listing documents: {e}", exc_info=True)
        return jsonify({'success': False, 'message': "An error occurred while retrieving document list."}), 500

if __name__ == '__main__':
    app.run(debug=True)
