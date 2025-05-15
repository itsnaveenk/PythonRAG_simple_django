# Flask RAG Application

A simple Flask-based RAG (Retrieval Augmented Generation) application that uses ChromaDB, Sentence Transformers, and Google Gemini.

## Setup

1. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install requirements:
   ```
   pip install -r requirements.txt
   ```

3. Create a `.env` file in the project root with:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. Run the application:
   ```
   flask run
   ```

5. Access the application at: http://127.0.0.1:5000/

## Features

- Upload various document formats (PDF, DOCX, TXT, PPT, etc.)
- Store text embeddings in ChromaDB
- Query documents with natural language
- Filter queries by specific documents

## API Endpoints

- `POST /api/upload/`: Upload and process documents
- `POST /api/query/`: Query processed documents
- `GET /api/documents/`: List all uploaded documents