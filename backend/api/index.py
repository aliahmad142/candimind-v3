import os
import sys

# Add the parent directory to the path so imports like 'main', 'database', etc. work
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

# This is the entry point for Vercel
# Vercel needs the FastAPI instance named 'app'
