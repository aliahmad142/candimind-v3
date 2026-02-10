# AI Interview Platform 🎙️

An AI-powered interview platform that uses **VAPI** to conduct voice-based technical interviews for React Native Frontend and TypeScript Backend developer positions.

## 🌟 Features

- **HR Dashboard**: Create and manage interview links
- **AI Voice Interviews**: Automated technical interviews using VAPI
- **Role-Specific Evaluation**: Separate AI assistants for Frontend (React Native) and Backend (TypeScript) roles
- **Automated Feedback**: Interview transcripts, summaries, and structured evaluations
- **Premium UI**: Modern, dark-mode interface with glassmorphism design

## 🏗️ Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│             │ Creates │              │ Starts  │             │
│ HR Dashboard├────────►│ Interview    ├────────►│  Candidate  │
│             │  Link   │  Link        │ Voice   │  Interview  │
└─────────────┘         └──────────────┘ Call    └──────┬──────┘
                                                        │
                                                        │ VAPI SDK
                                                        ▼
                        ┌──────────────┐         ┌─────────────┐
                        │   FastAPI    │◄────────│    VAPI     │
                        │   Backend    │ Webhook │   Service   │
                        └──────┬───────┘         └─────────────┘
                               │
                               │ Stores
                               ▼
                        ┌──────────────┐
                        │   SQLite     │
                        │   Database   │
                        └──────────────┘
```

## 📋 Prerequisites

- **Python 3.8+**
- **Node.js 18+**
- **VAPI Account** ([Sign up here](https://vapi.ai))
- Git

## 🚀 Quick Start

### 1. VAPI Setup

1. Create a VAPI account at [vapi.ai](https://vapi.ai)
2. Get your API key from the dashboard
3. Create two assistants in VAPI:

#### Frontend React Native Assistant
- **Name**: `Frontend Interview - React Native`
- **First Message**: Use the text from `vapi-prompts/frontend-react-native-prompt.md`
- **System Prompt**: Copy the system prompt from the same file
- **Model**: OpenAI GPT-4 (recommended)
- **Voice**: Choose a professional voice
- Note the Assistant ID

#### Backend TypeScript Assistant
- **Name**: `Backend Interview - TypeScript`
- **First Message**: Use the text from `vapi-prompts/backend-typescript-prompt.md`
- **System Prompt**: Copy the system prompt from the same file
- **Model**: OpenAI GPT-4 (recommended)
- **Voice**: Choose a professional voice
- Note the Assistant ID

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
```

Edit `.env` with your VAPI credentials:
```env
VAPI_API_KEY=your_vapi_api_key_here
VAPI_ASSISTANT_FRONTEND_ID=your_frontend_assistant_id
VAPI_ASSISTANT_BACKEND_ID=your_backend_assistant_id

DATABASE_URL=sqlite:///./interviews.db
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
SECRET_KEY=your-secret-key-change-this
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:8000
```

### 4. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn main:app --reload
```

Backend will run at: `http://localhost:8000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Frontend will run at: `http://localhost:5173`

### 5. Configure VAPI Webhook

1. Go to VAPI Dashboard → Settings → Webhooks
2. Set webhook URL to: `http://your-server-url:8000/api/webhooks/vapi`
3. For local development, use [ngrok](https://ngrok.com):
   ```bash
   ngrok http 8000
   ```
   Then use the ngrok URL: `https://your-ngrok-url.ngrok.io/api/webhooks/vapi`

## 📖 Usage

### For HR:

1. Open `http://localhost:5173`
2. Click "New Interview"
3. Enter candidate details and select role
4. Copy the generated interview link
5. Send the link to the candidate via email
6. View results when interview is completed

### For Candidates:

1. Click the interview link received from HR
2. Allow microphone access
3. Click "Start Interview"
4. Have a voice conversation with the AI interviewer
5. Complete the 20-25 minute interview

## 🗂️ Project Structure

```
Candimind/
├── backend/
│   ├── main.py                 # FastAPI app
│   ├── models.py               # Database models
│   ├── database.py             # Database setup
│   ├── config.py               # Configuration
│   ├── routes/
│   │   ├── interviews.py       # Interview endpoints
│   │   └── webhooks.py         # VAPI webhooks
│   ├── services/
│   │   └── vapi_service.py     # VAPI integration
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── HRDashboard.jsx        # HR interface
│   │   │   └── CandidateInterview.jsx # Interview page
│   │   ├── services/
│   │   │   └── api.js                 # API client
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css                  # Design system
│   ├── package.json
│   └── vite.config.js
└── vapi-prompts/
    ├── frontend-react-native-prompt.md
    └── backend-typescript-prompt.md
```

## 🔧 API Endpoints

### Interviews
- `POST /api/interviews/create` - Create interview link
- `GET /api/interviews` - List all interviews
- `GET /api/interviews/{id}` - Get interview details
- `GET /api/interviews/by-uid/{uid}` - Get interview for candidate

### Webhooks
- `POST /api/webhooks/vapi` - Receive VAPI interview data

## 🎨 Customization

### System Prompts
Edit the system prompts in `vapi-prompts/` to customize:
- Interview questions
- Evaluation criteria
- Interview duration
- Technical focus areas

### UI Theme
Edit `frontend/src/index.css` to customize:
- Color scheme
- Spacing
- Typography
- Border radius

## 🐛 Troubleshooting

**Interview link doesn't work:**
- Check that both backend and frontend are running
- Verify VAPI assistant IDs in `.env`

**No audio during interview:**
- Check microphone permissions in browser
- Ensure VAPI API key is valid
- Check browser console for errors

**Webhook not receiving data:**
- Verify webhook URL in VAPI dashboard
- Check that backend is publicly accessible (use ngrok for local)
- Review backend logs for webhook errors

**Database errors:**
- Delete `interviews.db` and restart backend to recreate
- Check file permissions

## 📝 Environment Variables

### Backend (.env)
- `VAPI_API_KEY` - Your VAPI API key (required)
- `VAPI_ASSISTANT_FRONTEND_ID` - Frontend assistant ID (required)
- `VAPI_ASSISTANT_BACKEND_ID` - Backend assistant ID (required)
- `DATABASE_URL` - Database connection string
- `BACKEND_URL` - Backend URL for CORS
- `FRONTEND_URL` - Frontend URL for links
- `SECRET_KEY` - Secret key for security

### Frontend (.env)
- `VITE_API_URL` - Backend API URL

## 🚢 Deployment

### Backend (Railway, Render, DigitalOcean)
1. Set environment variables
2. Deploy from Git repository
3. Update `BACKEND_URL` to production URL
4. Update VAPI webhook URL

### Frontend (Vercel, Netlify)
1. Set `VITE_API_URL` to production backend URL
2. Deploy from Git repository
3. Update `FRONTEND_URL` in backend

### Database
For production, switch to PostgreSQL:
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

## 📄 License

MIT License - Feel free to use for your projects!

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 💡 Support

For VAPI-specific issues, visit [VAPI Documentation](https://docs.vapi.ai)

---

Built with ❤️ using FastAPI, React, and VAPI
