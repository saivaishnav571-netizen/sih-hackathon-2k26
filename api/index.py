import os
import sys

# Add the 'backend' folder to sys.path so its internal imports work properly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from main import app
