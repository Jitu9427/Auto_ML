import subprocess
import sys
import time

def main():
    print("🚀 Starting ML Automation Platform...")
    
    # Start Backend
    print("⏳ Starting FastAPI Backend on port 8000...")
    backend = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--reload", "--port", "8000"], 
        cwd="backend"
    )
    
    # Start Frontend
    print("⏳ Starting React Frontend on port 5173...")
    frontend = subprocess.Popen(
        ["npm", "run", "dev"], 
        cwd="frontend", 
        shell=True
    )
    
    print("\n✅ Both servers are running!")
    print("💡 Press Ctrl+C at any time to properly shut down both servers.\n")
    
    try:
        # Wait for both processes to finish (runs indefinitely until interrupted)
        backend.wait()
        frontend.wait()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down servers gracefully...")
        backend.terminate()
        frontend.terminate()
        
        # Give them a moment to terminate
        time.sleep(1)
        print("Goodbye! 👋")
        sys.exit(0)

if __name__ == "__main__":
    main()
